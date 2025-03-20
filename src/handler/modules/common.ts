import * as configuration from '@/configuration';
import * as definition from '@/definition';
import * as log from '@/log';
import { ANY, BR, escape, SP, SP_BR } from '@/utils/regex';
import { CancelError, generateUUID } from '@/utils/utils';
import * as vscode from 'vscode';

export interface UpdateOptions {
  editor: vscode.TextEditor;
}

export interface PickDecorationOptionsParams {
  editor: vscode.TextEditor;
  text: string;
  offset: number;
  tagRanges: Map<string, vscode.Range[]>;
  processed?: [number, number][];
  taskID: string;
}

export abstract class Handler {
  public readonly languageId: string;
  protected triggerUpdateTimeout?: NodeJS.Timeout = undefined;
  protected taskID = '';

  constructor(languageId: string) {
    this.languageId = languageId;
    log.info(`(${languageId}) decoration handler created`);
  }

  protected abstract updateDecorations(options: UpdateOptions & { taskID: string }): Promise<void>;

  public async triggerUpdateDecorations({ editor, timeout }: UpdateOptions & { timeout: number }) {
    if (this.triggerUpdateTimeout) {
      clearTimeout(this.triggerUpdateTimeout);
    }

    this.triggerUpdateTimeout = setTimeout(async () => {
      this.taskID = generateUUID();
      try {
        await this.updateDecorations({ editor, taskID: this.taskID });
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
  public async updateDecorations({ editor, taskID }: UpdateOptions & { taskID: string }): Promise<void> {
    this.verifyTaskID(taskID);
    const processed: [number, number][] = [];
    const tagRanges = new Map<string, vscode.Range[]>();

    const { preloadLines, updateDelay } = configuration.getConfigurationFlatten();

    // # update for visible ranges
    for (const visibleRange of editor.visibleRanges) {
      this.verifyTaskID(taskID);

      const startLineIdx = Math.max(0, visibleRange.start.line - preloadLines);
      const startLine = editor.document.lineAt(startLineIdx);
      const endLineIdx = Math.min(editor.document.lineCount - 1, visibleRange.end.line + preloadLines);
      const endLine = editor.document.lineAt(endLineIdx);
      const range = new vscode.Range(startLine.range.start.line, 0, endLine.range.end.line, endLine.range.end.character);

      const text = editor.document.getText(range);
      const offset = editor.document.offsetAt(range.start);

      await this.pickDocCommentDecorationOptions({ editor, text, offset, tagRanges, processed, taskID });
      await this.pickBlockCommentDecorationOptions({ editor, text, offset, tagRanges, processed, taskID });
      await this.pickLineCommentDecorationOptions({ editor, text, offset, tagRanges, processed, taskID });
    }

    this.setDecorations(editor, tagRanges);

    setTimeout(async () => {
      // # update for full text
      this.verifyTaskID(taskID);
      const text = editor.document.getText();
      await this.pickDocCommentDecorationOptions({ editor, text, offset: 0, tagRanges, processed, taskID });
      await this.pickBlockCommentDecorationOptions({ editor, text, offset: 0, tagRanges, processed, taskID });
      await this.pickLineCommentDecorationOptions({ editor, text, offset: 0, tagRanges, processed, taskID });

      this.setDecorations(editor, tagRanges);
    }, updateDelay);
  }

  private async pickLineCommentDecorationOptions({ editor, text, offset, tagRanges, taskID, processed = [] }: PickDecorationOptionsParams) {
    this.verifyTaskID(taskID);

    const comments = await definition.getAvailableComments(editor.document.languageId);

    if (!comments.lineComments || !comments.lineComments.length) {
      return tagRanges;
    }

    const escapedMarks = comments.lineComments.map(s => `${escape(s)}+`).join('|');

    const blockExp = new RegExp(`(?<MARK>${escapedMarks}).*?(?:${BR}${SP}*\\1.*?)*(?:${BR}|$)`, 'g');

    const multilineTags = configuration.getMultilineTagsEscaped();
    const lineTags = configuration.getLineTagsEscaped();

    let block: RegExpExecArray | null;
    while ((block = blockExp.exec(text))) {
      this.verifyTaskID(taskID);

      const blockStart = offset + block.index;
      const blockEnd = blockStart + block[0].length;

      if (processed.find(range => range[0] <= blockStart && blockEnd <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      processed.push([blockStart, blockEnd]);

      const content = block[0];
      const contentStart = blockStart;
      const mark = escape(block.groups!.MARK);

      const lineProcessed: [number, number][] = [];

      if (multilineTags.length) {
        const m1Exp = (() => {
          const tag = multilineTags.join('|');
          return new RegExp(`(?<PRE>${SP}*${mark}${SP})(?<TAG>${tag})(?<CONTENT>${ANY}*)`, 'gi');
        })();

        // Find the matched multiline
        let m1: RegExpExecArray | null;
        while ((m1 = m1Exp.exec(content))) {
          this.verifyTaskID(taskID);

          const m1Start = contentStart + m1.index;
          const tagName = m1.groups!.TAG.toLowerCase();

          // exec with remember last reg index, reset m2Exp avoid reg cache
          const m2Exp = new RegExp(`(?<PRE>^|${SP}*)(?<MARK>${mark})(?<SPACE>${SP}*)(?<CONTENT>.*)`, 'gim');

          // Find decoration range
          let m2: RegExpExecArray | null;
          while ((m2 = m2Exp.exec(m1[0]))) {
            this.verifyTaskID(taskID);

            if (!m2.groups!.CONTENT) {
              continue; // 空行
            }

            if (m2.index !== 0 && m2.groups!.SPACE.length <= 1) {
              m1Exp.lastIndex = m1.index + m2.index - 1;
              break;
            }

            const m2StartSince = m1Start + m2.index;
            const m2Start = m2StartSince + m2.groups!.PRE.length + m2.groups!.MARK.length;
            const m2End = m2StartSince + m2[0].length;
            // store processed range
            lineProcessed.push([m2Start, m2End]);

            const startPos = editor.document.positionAt(m2Start);
            const endPos = editor.document.positionAt(m2End);
            const range = new vscode.Range(startPos, endPos);

            const opt = tagRanges.get(tagName) || [];
            opt.push(range);
            tagRanges.set(tagName, opt);
          }
        }
      }

      if (lineTags.length) {
        const lineExp = new RegExp(`((^|${SP})(${mark}))(${SP})(${lineTags.join('|')})([^\\n]*)`, 'gi');

        let line: RegExpExecArray | null | undefined;
        while ((line = lineExp.exec(content))) {
          this.verifyTaskID(taskID);

          const lineStartSince = contentStart + line.index;
          const lineStart = lineStartSince + line[1].length + line[4].length;
          const lineEnd = lineStartSince + line[0].length;

          if (lineProcessed.find(range => range[0] <= lineStart && lineEnd <= range[1])) {
            // skip if already processed
            continue;
          }
          // store processed range
          lineProcessed.push([lineStart, lineEnd]);

          const startPos = editor.document.positionAt(lineStart);
          const endPos = editor.document.positionAt(lineEnd);
          const range = new vscode.Range(startPos, endPos);

          const tagName = line[5].toLowerCase();

          const opt = tagRanges.get(tagName) || [];
          opt.push(range);
          tagRanges.set(tagName, opt);
        }
      }
    }

    return tagRanges;
  }

  private async pickBlockCommentDecorationOptions({ editor, text, offset, tagRanges, taskID, processed = [] }: PickDecorationOptionsParams) {
    this.verifyTaskID(taskID);

    const comments = await definition.getAvailableComments(editor.document.languageId);

    if (!comments.blockComments || !comments.blockComments.length) {
      return tagRanges;
    }

    const multilineTags = configuration.getMultilineTagsEscaped();
    const lineTags = configuration.getLineTagsEscaped();

    // exec with remember last reg index, reset m2Exp avoid reg cache
    const m1Exp = (() => {
      const tag = multilineTags.join('|');
      const pre = `^(?<SPACE1>${SP})|${BR}(?<SPACE2>${SP}*)`;
      return new RegExp(`(?<PRE>${pre})(?<TAG>${tag})(?<CONTENT>${ANY}*)`, 'gi');
    })();

    const lineExp = new RegExp(`(?<PRE>^${SP}|${BR}${SP}*)(?<TAG>${lineTags.join('|')})(?<CONTENT>.*)`, 'gim');

    for (const marks of comments.blockComments) {
      this.verifyTaskID(taskID);

      const start = escape(marks[0]);
      const end = escape(marks[1]);

      const pre = escape(marks[0].slice(-1));
      const suf = escape(marks[1].slice(0, 1));
      const trimExp = new RegExp(`^(${pre}*)(${ANY}*)${suf}*$`, 'i');

      const blockExp = new RegExp(`(?<PRE>(?:^|${BR})\\s*)(?<START>${start})(?<CONTENT>${ANY}*?)(?<END>${end})`, 'g');

      // Find the multiline comment block
      let block: RegExpExecArray | null;
      while ((block = blockExp.exec(text))) {
        this.verifyTaskID(taskID);

        const blocStart = offset + block.index + block.groups!.PRE.length;
        const blockEnd = offset + block.index + block[0].length;
        if (processed.find(range => range[0] <= blocStart && blockEnd <= range[1])) {
          // skip if already processed
          continue;
        }
        // store processed range
        processed.push([blocStart, blockEnd]);

        const trimed = trimExp.exec(block.groups!.CONTENT);
        if (!trimed) {
          continue;
        }

        const content = trimed[2];
        if (!content.length) {
          continue;
        }

        const contentStart = blocStart + block.groups!.START.length + trimed[1].length;

        const lineProcessed: [number, number][] = [];

        if (multilineTags.length) {
          // Find the matched multiline
          let m1: RegExpExecArray | null;
          while ((m1 = m1Exp.exec(content))) {
            this.verifyTaskID(taskID);

            const m1Start = contentStart + m1.index;
            const tagName = m1.groups!.TAG.toLowerCase();
            const m1Space = m1.groups!.SPACE1 || m1.groups!.SPACE2 || '';

            const m2Exp = /(?<PRE>(?:\n|^)(?<SPACE>[ \t]*))(?<CONTENT>.*)/gm;

            // Find decoration range
            let m2: RegExpExecArray | null;
            while ((m2 = m2Exp.exec(m1[0]))) {
              this.verifyTaskID(taskID);

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

              const startPos = editor.document.positionAt(m2Start);
              const endPos = editor.document.positionAt(m2End);
              const range = new vscode.Range(startPos, endPos);

              const opt = tagRanges.get(tagName) || [];
              opt.push(range);
              tagRanges.set(tagName, opt);
            }
          }
        }

        if (lineTags.length) {
          // Find the matched line
          let line: RegExpExecArray | null;
          while ((line = lineExp.exec(content))) {
            this.verifyTaskID(taskID);

            const lineStartSince = contentStart + line.index;
            const lineStart = lineStartSince + line.groups!.PRE.length;
            const lineEnd = lineStartSince + line[0].length;

            if (lineProcessed.find(range => range[0] <= lineStart && lineEnd <= range[1])) {
              continue; // skip if already processed
            }
            // store processed range
            lineProcessed.push([lineStart, lineEnd]);

            const startPos = editor.document.positionAt(lineStart);
            const endPos = editor.document.positionAt(lineEnd);
            const range = new vscode.Range(startPos, endPos);

            const tagName = line.groups!.TAG.toLowerCase();

            const opt = tagRanges.get(tagName) || [];
            opt.push(range);
            tagRanges.set(tagName, opt);
          }
        }
      }
    }

    return tagRanges;
  }

  private async pickDocCommentDecorationOptions({ editor, text, offset, tagRanges, taskID, processed = [] }: PickDecorationOptionsParams) {
    this.verifyTaskID(taskID);

    const lang = definition.useLanguage(editor.document.languageId);
    if (!lang.isUseDocComment()) {
      return tagRanges;
    }

    // const comments = await lang.getComments();
    // if (comments?.blockComment?.length) {
    //   prefix = comments.blockComment[0].slice(-1);
    //   marks = [comments.blockComment[0] + prefix, comments.blockComment[1]];
    // }

    const marks: vscode.CharacterPair = ['/**', '*/'];
    const prefix = '*';

    const start = escape(marks[0]);
    const end = escape(marks[1]);
    const pre = escape(prefix);

    const multilineTags = configuration.getMultilineTagsEscaped();
    const lineTags = configuration.getLineTagsEscaped();

    const blockExp = new RegExp(`(?<PRE>(?:^|${BR})${SP}*)(?<START>${start})(?<CONTENT>${SP_BR}${ANY}*?)(?<END>${end})`, 'g');

    const m1Exp = (() => {
      const tag = multilineTags.join('|');
      const preTag = `^${SP}|${SP}*${pre}${SP}`;
      return new RegExp(`(?<PRE>${preTag})(?<TAG>${tag})(?<CONTENT>${ANY}*)`, 'gi');
    })();

    const tags = lineTags.join('|');
    const linePreTag = `(?:(?:${SP}*${BR}${SP}*${pre})|(?:${SP}*${pre}))`;
    const lineExp = new RegExp(`(?<PRE>${linePreTag}${SP})(?<TAG>${tags})(?<CONTENT>.*)`, 'gim');

    let block: RegExpExecArray | null;
    while ((block = blockExp.exec(text))) {
      this.verifyTaskID(taskID);

      const blockStart = offset + block.index + block.groups!.PRE.length;
      const blockEnd = offset + block.index + block[0].length;
      if (processed.find(range => range[0] <= blockStart && blockEnd <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      processed.push([blockStart, blockEnd]);

      const contentStart = blockStart + block.groups!.START.length;

      const lineProcessed: [number, number][] = [];

      if (multilineTags.length) {
        // Find the matched multiline
        let m1: RegExpExecArray | null;
        while ((m1 = m1Exp.exec(block.groups!.CONTENT))) {
          this.verifyTaskID(taskID);

          const m1Start = contentStart + m1.index;
          const tagName = m1.groups!.TAG.toLowerCase();

          // exec with remember last reg index, reset m2Exp avoid reg cache
          const m2Exp = new RegExp(`(?<PRE>${SP}*${pre}|^)(?<SPACE>${SP}*)(?<CONTENT>.*)`, 'gim');

          // Find decoration range
          let m2: RegExpExecArray | null;
          while ((m2 = m2Exp.exec(m1.groups!.TAG + m1.groups!.CONTENT))) {
            this.verifyTaskID(taskID);

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

            const startPos = editor.document.positionAt(m2Start);
            const endPos = editor.document.positionAt(m2End);
            const range = new vscode.Range(startPos, endPos);

            const opt = tagRanges.get(tagName) || [];
            opt.push(range);
            tagRanges.set(tagName, opt);
          }
        }
      }

      if (lineTags.length) {
        // Find the matched line
        let line: RegExpExecArray | null;
        while ((line = lineExp.exec(block.groups!.CONTENT))) {
          this.verifyTaskID(taskID);

          const lineStartSince = contentStart + line.index;
          const lineStart = lineStartSince + line.groups!.PRE.length;
          const lineEnd = lineStartSince + line[0].length;

          if (lineProcessed.find(range => range[0] <= lineStart && lineEnd <= range[1])) {
            // skip if already processed
            continue;
          }
          // store processed range
          lineProcessed.push([lineStart, lineEnd]);

          const startPos = editor.document.positionAt(lineStart);
          const endPos = editor.document.positionAt(lineEnd);
          const range = new vscode.Range(startPos, endPos);

          const tagName = line.groups!.TAG.toLowerCase();

          const opt = tagRanges.get(tagName) || [];
          opt.push(range);
          tagRanges.set(tagName, opt);
        }
      }
    }

    return tagRanges;
  }
}
