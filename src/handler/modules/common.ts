import * as configuration from '@/configuration';
import * as definition from '@/definition';
import * as log from '@/log';
import { CancelError, escapeRegexString, generateUUID } from '@/utils';
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

    const preloadLines = configuration.getConfigurationFlatten().preloadLines;

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

    this.verifyTaskID(taskID);

    // # update for full text
    const text = editor.document.getText();
    await this.pickDocCommentDecorationOptions({ editor, text, offset: 0, tagRanges, processed, taskID });
    await this.pickBlockCommentDecorationOptions({ editor, text, offset: 0, tagRanges, processed, taskID });
    await this.pickLineCommentDecorationOptions({ editor, text, offset: 0, tagRanges, processed, taskID });

    this.setDecorations(editor, tagRanges);
  }

  private async pickLineCommentDecorationOptions({ editor, text, offset, tagRanges, taskID, processed = [] }: PickDecorationOptionsParams) {
    this.verifyTaskID(taskID);

    const comments = await definition.getAvailableComments(editor.document.languageId);

    if (!comments.lineComments || !comments.lineComments.length) {
      return tagRanges;
    }

    const escapedMarks = comments.lineComments.map(s => `${escapeRegexString(s)}+`).join('|');

    const blockExp = new RegExp(`(${escapedMarks}).*?(?:\\r?\\n[ \\t]*\\1.*?)*(\\r?\\n|$)`, 'g');

    const multilineTags = configuration.getMultilineTagsEscaped();
    const lineTags = configuration.getLineTagsEscaped();
    const allTags = configuration.getAllTagsEscaped();

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
      const mark = escapeRegexString(block[1]);

      const lineProcessed: [number, number][] = [];

      if (multilineTags.length) {
        const m1Exp = new RegExp(
          `([ \\t]*(${mark})[ \\t])((${multilineTags.join('|')})([\\s\\S]*?(?=\\n\\s*${mark}[ \\t](${allTags.join('|')})|\\n\\s*${mark}\\s*\\r?\\n|$)))`,
          'gi',
        );

        // Find the matched multiline
        let m1: RegExpExecArray | null;
        while ((m1 = m1Exp.exec(content))) {
          this.verifyTaskID(taskID);

          const m1Start = contentStart + m1.index;
          const tagName = m1[4].toLowerCase();

          // exec with remember last reg index, reset m2Exp avoid reg cache
          const m2Exp = new RegExp(`(^|[ \\t]*(${mark})([ \\t]*))([^\\n]*?(?=\\r?\\n|$))`, 'gi');

          // Find decoration range
          let m2: RegExpExecArray | null;
          while ((m2 = m2Exp.exec(m1[3]))) {
            this.verifyTaskID(taskID);

            const m2Space = m2[3];
            if (m2.index !== 0 && m2Space.length <= 1) {
              break;
            }

            const m2StartSince = m1Start + m1[1].length + m2.index;
            const m2Start = m2StartSince + m2[1].length;
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
        const lineExp = new RegExp(`((^|\\s)(${mark}))([ \\t])(${lineTags.join('|')})([^\\n]*)`, 'gi');

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
    const allTags = configuration.getAllTagsEscaped();

    // exec with remember last reg index, reset m2Exp avoid reg cache
    const m1Exp = new RegExp(`(^([ \\t])|\\n([ \\t]*))(${multilineTags.join('|')})([\\s\\S]*?)(?=\\n\\s*(${allTags.join('|')})|\\n\\s*\\n|$)`, 'gi');

    const lineExp = new RegExp(`(^[ \\t]|\\n[ \\t]*)(${lineTags.join('|')})([^\\n]*?)(?=\\n|$)`, 'gi');

    for (const marks of comments.blockComments) {
      this.verifyTaskID(taskID);

      const markStart = escapeRegexString(marks[0]);
      const markEnd = escapeRegexString(marks[1]);

      const pre = escapeRegexString(marks[0].slice(-1));
      const suf = escapeRegexString(marks[1].slice(0, 1));
      const trimExp = new RegExp(`^(${pre}*)([\\s\\S]*)${suf}*$`, 'i');

      /**
       * ! 去除前置 (^|\\n)\\s* 判断会导致错误匹配字符串内的字符
       * ! 如：const mather = '/*'
       */
      const blockExp = new RegExp(`((^|\\n)\\s*(${markStart}))([\\s\\S]*?)(${markEnd})`, 'g');

      // Find the multiline comment block
      let block: RegExpExecArray | null;
      while ((block = blockExp.exec(text))) {
        this.verifyTaskID(taskID);

        const blocStart = offset + block.index;
        const blockEnd = blocStart + block[0].length;
        if (processed.find(range => range[0] <= blocStart && blockEnd <= range[1])) {
          // skip if already processed
          continue;
        }
        // store processed range
        processed.push([blocStart, blockEnd]);

        const trimed = trimExp.exec(block[4]);
        if (!trimed) {
          continue;
        }

        const content = trimed[2];
        if (!content.length) {
          continue;
        }

        const contentStart = blocStart + block[1].length + trimed[1].length;

        const lineProcessed: [number, number][] = [];

        if (multilineTags.length) {
          // Find the matched multiline
          let m1: RegExpExecArray | null;
          while ((m1 = m1Exp.exec(content))) {
            this.verifyTaskID(taskID);

            const m1Start = contentStart + m1.index;
            const tagName = m1[4].toLowerCase();
            const m1Space = m1[2] || m1[3] || '';

            // eslint-disable-next-line regexp/no-unused-capturing-group, regexp/no-super-linear-backtracking
            const m2Exp = /((\n|^)([ \t]*))([^\n]*)(?=\n|$)/g;

            // Find decoration range
            let m2: RegExpExecArray | null;
            while ((m2 = m2Exp.exec(m1[0]))) {
              this.verifyTaskID(taskID);
              const m2Space = m2[3] || '';
              if (m2.index !== 0 && m2Space.length <= m1Space.length) {
                break;
              }

              const m2StartSince = m1Start + m2.index;
              const m2Start = m2StartSince + m2[1].length;
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
            const lineStart = lineStartSince + line[1].length;
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

            const tagName = line[2].toLowerCase();

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
    const marks: vscode.CharacterPair = ['/**', '*/'];
    const prefix = '*';

    const lang = definition.useLanguage(editor.document.languageId);
    if (!lang.isUseDocComment()) {
      return tagRanges;
    }

    // const comments = await lang.getComments();
    // if (comments?.blockComment?.length) {
    //   prefix = comments.blockComment[0].slice(-1);
    //   marks = [comments.blockComment[0] + prefix, comments.blockComment[1]];
    // }

    const start = escapeRegexString(marks[0]);
    const end = escapeRegexString(marks[1]);
    const pre = escapeRegexString(prefix);

    const multilineTags = configuration.getMultilineTagsEscaped();
    const lineTags = configuration.getLineTagsEscaped();
    const allTags = [...multilineTags, ...lineTags];

    /**
     * ! 去除前置 (^|\\n)\\s* 判断会导致错误匹配字符串内的字符
     * ! 如：const mather = '/*'
     *
     * ! doc comment 第一个标识符后必须加空格或换行，否则被识别为 block comment
     */
    const blockExp = new RegExp(`((^|\\n)\\s*(${start}))\\s([\\s\\S]*?)(${end})`, 'g');
    const m1Exp = new RegExp(
      `(^[ \\t]|([ \\t]*(${pre})([ \\t])))((${multilineTags.join('|')})([\\s\\S]*?))(?=\\n\\s*${pre}[ \\t](${allTags.join('|')})|\\n\\s*${pre}\\s*\\n|$)`,
      'gi',
    );
    const lineExp = new RegExp(`(^|[ \\t]*(${pre})[ \\t])(${lineTags.join('|')})([^\\n]*?)(\\n|$)`, 'gi');

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

      const content = block[4];
      const contentStart = blockStart + block[1].length + 1;

      const lineProcessed: [number, number][] = [];

      if (multilineTags.length) {
        // Find the matched multiline
        let m1: RegExpExecArray | null;
        while ((m1 = m1Exp.exec(content))) {
          this.verifyTaskID(taskID);

          const m1Start = contentStart + m1.index;
          const tagName = m1[6].toLowerCase();
          const m1Space = m1[4] || '';

          // exec with remember last reg index, reset m2Exp avoid reg cache
          const m2Exp = new RegExp(`(^|[ \\t]*(${pre})([ \\t]*))([^\\n]*?)(\\n|$)`, 'gi');

          // Find decoration range
          let m2: RegExpExecArray | null;
          while ((m2 = m2Exp.exec(m1[5]))) {
            this.verifyTaskID(taskID);

            const m2Space = m2[3] || '';
            if (m2.index !== 0 && m2Space.length <= m1Space.length) {
              break;
            }

            const m2StartSince = m1Start + m1[1].length + m2.index;
            const m2Start = m2StartSince + m2[1].length;
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
          const lineStart = lineStartSince + line[1].length;
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

          const tagName = line[3].toLowerCase();

          const opt = tagRanges.get(tagName) || [];
          opt.push(range);
          tagRanges.set(tagName, opt);
        }
      }
    }

    return tagRanges;
  }
}
