import * as configuration from '@/configuration';
import * as definition from '@/definition';
import { ANY, BR, escape, SP, SP_BR } from '@/utils/regex';
import { CancelError, generateUUID } from '@/utils/utils';
import * as vscode from 'vscode';

export interface UpdateParams {
  editor: vscode.TextEditor;
}

export interface PickParams {
  taskID: string;
  editor: vscode.TextEditor;
  text: string;
  offset: number;
  tagRanges: Map<string, vscode.Range[]>;
  processed: [number, number][];
}

export interface CommentSlice {
  start: number;
  end: number;
  comment: string;
}

export interface LineCommentSlice extends CommentSlice {
  mark: string;
}

export interface BlockCommentSlice extends CommentSlice {
  marks: [string, string];
  content: string;
}

export interface DocCommentSlice extends BlockCommentSlice {
  prefix: string;
}

export abstract class Handler {
  public readonly languageId: string;
  protected triggerUpdateTimeout?: NodeJS.Timeout = undefined;
  protected taskID = '';

  constructor(languageId: string) {
    this.languageId = languageId;
  }

  protected abstract updateDecorations(params: UpdateParams): Promise<void>;

  public async triggerUpdateDecorations({ timeout, ...params }: UpdateParams & { timeout: number }) {
    if (this.triggerUpdateTimeout) {
      clearTimeout(this.triggerUpdateTimeout);
    }

    this.triggerUpdateTimeout = setTimeout(async () => {
      try {
        await this.updateDecorations(params);
      }
      catch (e: any) {
        if (!(e instanceof CancelError)) {
          throw e;
        }
      }
    }, timeout);
  }

  protected setDecorations(editor: vscode.TextEditor, tagRanges: Map<string, vscode.Range[]>) {
    configuration.getTagDecorationTypes().forEach((td, tag) => {
      const ranges = tagRanges.get(tag) || [];

      editor.setDecorations(td, ranges);
      const documentUri = editor.document.uri.toString();
      for (const visibleEditor of vscode.window.visibleTextEditors) {
        if (visibleEditor === editor) {
          continue;
        }

        if (visibleEditor.document.uri.toString() !== documentUri) {
          continue;
        }

        visibleEditor.setDecorations(td, ranges);
      }
    });
  }

  // verify taskID is current task
  protected verifyTaskID(taskID: string) {
    if (taskID !== this.taskID) {
      throw new CancelError('Task canceled');
    }
  }
}

export class CommonHandler extends Handler {
  public async updateDecorations(params: UpdateParams): Promise<void> {
    const taskID = this.taskID = generateUUID();
    const processed: [number, number][] = [];
    const tagRanges = new Map<string, vscode.Range[]>();

    const { preloadLines, updateDelay } = configuration.getConfigurationFlatten();

    // # update for visible ranges
    for (const visibleRange of params.editor.visibleRanges) {
      this.verifyTaskID(taskID);

      const startLineIdx = Math.max(0, visibleRange.start.line - preloadLines);
      const startLine = params.editor.document.lineAt(startLineIdx);
      const endLineIdx = Math.min(params.editor.document.lineCount - 1, visibleRange.end.line + preloadLines);
      const endLine = params.editor.document.lineAt(endLineIdx);
      const range = new vscode.Range(startLine.range.start.line, 0, endLine.range.end.line, endLine.range.end.character);

      const text = params.editor.document.getText(range);
      const offset = params.editor.document.offsetAt(range.start);

      const pickParams: PickParams = { editor: params.editor, text, offset, tagRanges, taskID, processed };

      await this.pickDocCommentDecorationOptions(pickParams);
      await this.pickBlockCommentDecorationOptions(pickParams);
      await this.pickLineCommentDecorationOptions(pickParams);
    }

    this.setDecorations(params.editor, tagRanges);

    setTimeout(async () => {
      // # update for full text
      this.verifyTaskID(taskID);
      const text = params.editor.document.getText();
      const pickParams: PickParams = { editor: params.editor, text, offset: 0, tagRanges, taskID, processed };
      await this.pickDocCommentDecorationOptions(pickParams);
      await this.pickBlockCommentDecorationOptions(pickParams);
      await this.pickLineCommentDecorationOptions(pickParams);

      this.setDecorations(params.editor, tagRanges);
    }, updateDelay);
  }

  protected async pickLineCommentSlices(params: PickParams): Promise<Array<LineCommentSlice>> {
    this.verifyTaskID(params.taskID);

    const { lineComments } = await definition.getAvailableComments(params.editor.document.languageId);
    if (!lineComments || !lineComments.length) {
      return [];
    }

    const slices: LineCommentSlice[] = [];

    const marks = lineComments.map(s => `${escape(s)}+`).join('|');

    const exp = new RegExp(`(?<MARK>${marks}).*?(?:${BR}${SP}*\\1.*?)*(?:${BR}|$)`, 'g');
    let block: RegExpExecArray | null;
    while ((block = exp.exec(params.text))) {
      this.verifyTaskID(params.taskID);

      const start = params.offset + block.index;
      const end = start + block[0].length;

      if (params.processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
        // skip if already processed
        continue;
      }
      // store processed range
      params.processed.push([start, end]);

      slices.push({
        start,
        end,
        comment: block[0],
        mark: block.groups!.MARK,
      });
    }

    return slices;
  }

  private async pickLineCommentDecorationOptions(params: PickParams): Promise<void> {
    const slices = await this.pickLineCommentSlices(params);

    this.verifyTaskID(params.taskID);

    const multilineTags = configuration.getMultilineTagsEscaped();
    const lineTags = configuration.getLineTagsEscaped();
    const fullHighlight = configuration.getConfigurationFlatten().fullHighlight;

    for (const slice of slices) {
      this.verifyTaskID(params.taskID);

      const mark = escape(slice.mark);

      const lineProcessed: [number, number][] = [];
      if (multilineTags.length) {
        const m1Exp = (() => {
          const tag = multilineTags.join('|');
          return new RegExp(`(?<PRE>${SP}*${mark}${SP})(?<TAG>${tag})(?<CONTENT>${ANY}*)`, 'gi');
        })();

        // Find the matched multiline
        let m1: RegExpExecArray | null;
        while ((m1 = m1Exp.exec(slice.comment))) {
          this.verifyTaskID(params.taskID);

          const m1Start = slice.start + m1.index;
          const tagName = m1.groups!.TAG.toLowerCase();

          // exec with remember last reg index, reset m2Exp avoid reg cache
          const m2Exp = new RegExp(`(?<PRE>^|${SP}*)(?<MARK>${mark})(?<SPACE>${SP}*)(?<CONTENT>.*)`, 'gim');

          // Find decoration range
          let m2: RegExpExecArray | null;
          while ((m2 = m2Exp.exec(m1[0]))) {
            this.verifyTaskID(params.taskID);

            if (!m2.groups!.CONTENT) {
              continue; // 空行
            }

            if (m2.index !== 0 && m2.groups!.SPACE.length <= 1) {
              m1Exp.lastIndex = m1.index + m2.index - 1;
              break;
            }

            const m2StartSince = m1Start + m2.index;
            const m2Start = fullHighlight
              ? m2StartSince + m2.groups!.PRE.length
              : m2StartSince + m2.groups!.PRE.length + m2.groups!.MARK.length;
            const m2End = m2StartSince + m2[0].length;
            // store processed range
            lineProcessed.push([m2Start, m2End]);

            const startPos = params.editor.document.positionAt(m2Start);
            const endPos = params.editor.document.positionAt(m2End);
            const range = new vscode.Range(startPos, endPos);

            const opt = params.tagRanges.get(tagName) || [];
            opt.push(range);
            params.tagRanges.set(tagName, opt);
          }
        }
      }

      if (lineTags.length) {
        const lineExp = new RegExp(`(?<PRE>(?:^|${SP})${mark}${SP})(?<TAG>${lineTags.join('|')})(?<CONTENT>.*)`, 'gim');

        let line: RegExpExecArray | null | undefined;
        while ((line = lineExp.exec(slice.comment))) {
          this.verifyTaskID(params.taskID);

          const lineStartSince = slice.start + line.index;
          const lineStart = fullHighlight
            ? lineStartSince
            : lineStartSince + line.groups!.PRE.length;
          const lineEnd = lineStartSince + line[0].length;

          if (lineProcessed.find(([pStart, pEnd]) => pStart <= lineStart && lineEnd <= pEnd)) {
            // skip if already processed
            continue;
          }
          // store processed range
          lineProcessed.push([lineStart, lineEnd]);

          const startPos = params.editor.document.positionAt(lineStart);
          const endPos = params.editor.document.positionAt(lineEnd);
          const range = new vscode.Range(startPos, endPos);

          const tagName = line.groups!.TAG.toLowerCase();

          const opt = params.tagRanges.get(tagName) || [];
          opt.push(range);
          params.tagRanges.set(tagName, opt);
        }
      }
    }
  }

  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    this.verifyTaskID(params.taskID);

    const { blockComments } = await definition.getAvailableComments(params.editor.document.languageId);
    if (!blockComments || !blockComments.length) {
      return [];
    }

    const slices: BlockCommentSlice[] = [];

    for (const marks of blockComments) {
      this.verifyTaskID(params.taskID);

      const markStart = escape(marks[0]);
      const markEnd = escape(marks[1]);
      const exp = new RegExp(`(?<PRE>(?:^|${BR})\\s*)(?<START>${markStart})(?<CONTENT>${ANY}*?)(?<END>${markEnd})`, 'g');

      let block: RegExpExecArray | null;
      while ((block = exp.exec(params.text))) {
        this.verifyTaskID(params.taskID);

        const start = params.offset + block.index + block.groups!.PRE.length;
        const end = params.offset + block.index + block[0].length;

        if (params.processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
          // skip if already processed
          continue;
        }
        // store processed range
        params.processed.push([start, end]);

        slices.push({
          start,
          end,
          comment: block[0],
          content: block.groups!.CONTENT,
          marks,
        });
      }
    }

    return slices;
  }

  private async pickBlockCommentDecorationOptions(params: PickParams): Promise<void> {
    const slices = await this.pickBlockCommentSlices(params);
    for (const slice of slices) {
      this.verifyTaskID(params.taskID);

      let content = slice.content;
      let contentStart = slice.start + slice.marks[0].length;

      const pre = escape(slice.marks[0].slice(-1));
      const suf = escape(slice.marks[1].slice(0, 1));
      if (!!pre && !!suf) {
        const trimExp = new RegExp(`^(${pre}*)(${ANY}*)${suf}*$`, 'i');
        const trimed = trimExp.exec(slice.content);
        if (!trimed) {
          continue;
        }

        if (!trimed[2].length) {
          continue;
        }

        content = trimed[2];
        contentStart += trimed[1].length;
      }

      const lineProcessed: [number, number][] = [];

      const multilineTags = configuration.getMultilineTagsEscaped();
      if (multilineTags.length) {
        // exec with remember last reg index, reset m2Exp avoid reg cache
        const m1Exp = (() => {
          const tag = multilineTags.join('|');
          const pre = `^(?<SPACE1>${SP})|${BR}(?<SPACE2>${SP}*)`;
          return new RegExp(`(?<PRE>${pre})(?<TAG>${tag})(?<CONTENT>${ANY}*)`, 'gi');
        })();

        // Find the matched multiline
        let m1: RegExpExecArray | null;
        while ((m1 = m1Exp.exec(content))) {
          this.verifyTaskID(params.taskID);

          const m1Start = contentStart + m1.index;
          const tagName = m1.groups!.TAG.toLowerCase();
          const m1Space = m1.groups!.SPACE1 || m1.groups!.SPACE2 || '';

          const m2Exp = /(?<PRE>(?:\r?\n|^)(?<SPACE>[ \t]*))(?<CONTENT>.*)/gm;

          // Find decoration range
          let m2: RegExpExecArray | null;
          while ((m2 = m2Exp.exec(m1[0]))) {
            this.verifyTaskID(params.taskID);

            if (!m2.groups!.CONTENT) {
              continue; // 空行
            }

            const m2Space = m2.groups!.SPACE || '';
            if (m2.index !== 0 && m2Space.length <= m1Space.length) {
              m1Exp.lastIndex = m1.index + m2.index - 1;
              break;
            }

            const m2StartSince = m1Start + m2.index;
            const m2Start = m2StartSince + m2.groups!.PRE.length;
            const m2End = m2StartSince + m2[0].length;
            // store processed range
            lineProcessed.push([m2Start, m2End]);

            const startPos = params.editor.document.positionAt(m2Start);
            const endPos = params.editor.document.positionAt(m2End);
            const range = new vscode.Range(startPos, endPos);

            const opt = params.tagRanges.get(tagName) || [];
            opt.push(range);
            params.tagRanges.set(tagName, opt);
          }
        }
      }

      const lineTags = configuration.getLineTagsEscaped();
      if (lineTags.length) {
        const lineExp = new RegExp(`(?<PRE>^${SP}|${BR}${SP}*)(?<TAG>${lineTags.join('|')})(?<CONTENT>.*)`, 'gim');
        // Find the matched line
        let line: RegExpExecArray | null;
        while ((line = lineExp.exec(content))) {
          this.verifyTaskID(params.taskID);

          const lineStartSince = contentStart + line.index;
          const lineStart = lineStartSince + line.groups!.PRE.length;
          const lineEnd = lineStartSince + line[0].length;

          if (lineProcessed.find(([pStart, pEnd]) => pStart <= lineStart && lineEnd <= pEnd)) {
            continue; // skip if already processed
          }
          // store processed range
          lineProcessed.push([lineStart, lineEnd]);

          const startPos = params.editor.document.positionAt(lineStart);
          const endPos = params.editor.document.positionAt(lineEnd);
          const range = new vscode.Range(startPos, endPos);

          const tagName = line.groups!.TAG.toLowerCase();

          const opt = params.tagRanges.get(tagName) || [];
          opt.push(range);
          params.tagRanges.set(tagName, opt);
        }
      }
    }
  }

  protected async pickDocCommentSlices(params: PickParams): Promise<Array<DocCommentSlice>> {
    this.verifyTaskID(params.taskID);
    const lang = definition.useLanguage(params.editor.document.languageId);
    if (!lang.isUseDocComment()) {
      return [];
    }

    // const comments = await lang.getComments();
    // if (comments?.blockComment?.length) {
    //   prefix = comments.blockComment[0].slice(-1);
    //   marks = [comments.blockComment[0] + prefix, comments.blockComment[1]];
    // }

    const marks: vscode.CharacterPair = ['/**', '*/'];
    const prefix = '*';

    const slices: DocCommentSlice[] = [];

    const markStart = escape(marks[0]);
    const markEnd = escape(marks[1]);

    const blockExp = new RegExp(`(?<PRE>(?:^|${BR})${SP}*)(?<START>${markStart})(?<CONTENT>${SP_BR}${ANY}*?)(?<END>${markEnd})`, 'g');

    let block: RegExpExecArray | null;
    while ((block = blockExp.exec(params.text))) {
      this.verifyTaskID(params.taskID);

      const start = params.offset + block.index + block.groups!.PRE.length;
      const end = params.offset + block.index + block[0].length;
      if (params.processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
        // skip if already processed
        continue;
      }
      // store processed range
      params.processed.push([start, end]);

      slices.push({
        start,
        end,
        marks,
        prefix,
        comment: block.groups!.START + block.groups!.CONTENT + block.groups!.END,
        content: block.groups!.CONTENT,
      });
    }

    return slices;
  }

  private async pickDocCommentDecorationOptions(params: PickParams): Promise<void> {
    const slices = await this.pickDocCommentSlices(params);
    const lineProcessed: [number, number][] = [];
    for (const slice of slices) {
      this.verifyTaskID(params.taskID);
      const pre = escape(slice.prefix);

      const multilineTags = configuration.getMultilineTagsEscaped();
      if (multilineTags.length) {
        const m1Exp = (() => {
          const tag = multilineTags.join('|');
          const preTag = `^${SP}|${SP}*${pre}${SP}`;
          return new RegExp(`(?<PRE>${preTag})(?<TAG>${tag})(?<CONTENT>${ANY}*)`, 'gi');
        })();
        // Find the matched multiline
        let m1: RegExpExecArray | null;
        while ((m1 = m1Exp.exec(slice.content))) {
          this.verifyTaskID(params.taskID);

          const m1Start = slice.start + slice.marks[0].length + m1.index;
          const tagName = m1.groups!.TAG.toLowerCase();

          // exec with remember last reg index, reset m2Exp avoid reg cache
          const m2Exp = new RegExp(`(?<PRE>${SP}*${pre}|^)(?<SPACE>${SP}*)(?<CONTENT>.*)`, 'gim');

          // Find decoration range
          let m2: RegExpExecArray | null;
          while ((m2 = m2Exp.exec(m1.groups!.TAG + m1.groups!.CONTENT))) {
            this.verifyTaskID(params.taskID);

            if (!m2.groups!.CONTENT) {
              continue; // 空行
            }

            const m2Space = m2.groups!.SPACE || '';
            if (m2.index !== 0 && m2Space.length <= 1) { // 必须大于1个空格缩进
              m1Exp.lastIndex = m1.index + m2.index - 1;
              break;
            }

            const m2StartSince = m1Start + m1.groups!.PRE.length + m2.index;
            const m2Start = m2StartSince + m2.groups!.PRE.length;
            const m2End = m2StartSince + m2[0].length;
            // store processed range
            lineProcessed.push([m2Start, m2End]);

            const startPos = params.editor.document.positionAt(m2Start);
            const endPos = params.editor.document.positionAt(m2End);
            const range = new vscode.Range(startPos, endPos);

            const opt = params.tagRanges.get(tagName) || [];
            opt.push(range);
            params.tagRanges.set(tagName, opt);
          }
        }
      }

      const lineTags = configuration.getLineTagsEscaped();
      if (lineTags.length) {
        const tags = lineTags.join('|');
        const linePreTag = `(?:(?:${SP}*${BR}${SP}*${pre})|(?:${SP}*${pre}))`;
        const lineExp = new RegExp(`(?<PRE>${linePreTag}${SP})(?<TAG>${tags})(?<CONTENT>.*)`, 'gim');

        // Find the matched line
        let line: RegExpExecArray | null;
        while ((line = lineExp.exec(slice.content))) {
          this.verifyTaskID(params.taskID);

          const lineStartSince = slice.start + slice.marks[0].length + line.index;
          const lineStart = lineStartSince + line.groups!.PRE.length;
          const lineEnd = lineStartSince + line[0].length;

          if (lineProcessed.find(range => range[0] <= lineStart && lineEnd <= range[1])) {
            // skip if already processed
            continue;
          }
          // store processed range
          lineProcessed.push([lineStart, lineEnd]);

          const startPos = params.editor.document.positionAt(lineStart);
          const endPos = params.editor.document.positionAt(lineEnd);
          const range = new vscode.Range(startPos, endPos);

          const tagName = line.groups!.TAG.toLowerCase();

          const opt = params.tagRanges.get(tagName) || [];
          opt.push(range);
          params.tagRanges.set(tagName, opt);
        }
      }
    }
  }
}
