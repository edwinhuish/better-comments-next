import * as vscode from 'vscode';

import * as configuration from '@/configuration';
import * as definition from '@/definition';
import { escapeRegexString } from '@/utils';

export interface BlockPicker {
  markStart: string;
  markEnd: string;
  blockpicker: RegExp;
  linePicker: RegExp;
  docLinePicker: RegExp;
  docLinePrefix: string;
}

export abstract class Handler {
  public readonly langId: string;
  constructor(langId: string) {
    this.langId = langId;
  }

  public abstract updateDecorations(editor: vscode.TextEditor): Promise<void>;
  public abstract triggerUpdateDecorations(editor: vscode.TextEditor, timeout?: number): Promise<void>;
}

export class CommonHandler extends Handler {
  protected linePicker?: RegExp = undefined;
  protected blockPickers?: BlockPicker[] = undefined;

  protected triggerUpdateTimeout?: NodeJS.Timeout = undefined;

  public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    if (!editor || editor.document.languageId !== this.langId) {
      return;
    }

    if (this.triggerUpdateTimeout) {
      clearTimeout(this.triggerUpdateTimeout);
    }

    const blockPicked = await this.pickFromBlockComment(editor);
    const linePicked = await this.pickFromLineComment(editor, blockPicked.blockRanges);

    const tagDecorationTypes = configuration.getTagDecorationTypes();

    tagDecorationTypes.forEach((t, tag) => {
      const blockOpts = blockPicked.decorationOptions.get(tag) || [];
      const lineOpts = linePicked.decorationOptions.get(tag) || [];
      const ranges = [...blockOpts, ...lineOpts];
      editor.setDecorations(t, ranges);
    });
  }

  public async triggerUpdateDecorations(editor: vscode.TextEditor, timeout = 100) {
    this.triggerUpdateTimeout = setTimeout(() => {
      if (vscode.window.activeTextEditor !== editor) {
        return;
      }
      this.updateDecorations(editor);
    }, timeout);
  }

  protected async getLinePicker() {
    if (this.linePicker === undefined) {
      this.linePicker = await this.parseLinePicker();
    }

    return this.linePicker;
  }

  protected async getBlockPickers() {
    if (this.blockPickers === undefined) {
      this.blockPickers = await this.parseBlockPickers();
    }

    return this.blockPickers;
  }

  protected async pickFromBlockComment(editor: vscode.TextEditor) {
    const pickers = await this.getBlockPickers();

    const blockRanges: [number, number][] = [];
    const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

    for (const picker of pickers) {
      // Find the multiline comment block
      let block: RegExpExecArray | null;

      while ((block = picker.blockpicker.exec(editor.document.getText()))) {
        blockRanges.push([block.index, block.index + block[0].length]);

        // if the regex of block as line comment
        const isLineComment = block[1] !== undefined;

        const comment = isLineComment ? block[3] : block[7];
        const space = isLineComment ? block[2] : block[6];

        if (!comment || !space) {
          continue;
        }

        const markStart = isLineComment ? block[1] : block[5];
        // const markEnd = isLineComment ? block[4] : block[8];
        const isDocComment = !isLineComment && markStart === '/**';
        const linePicker = isDocComment ? picker.docLinePicker : picker.linePicker;

        // Find the matched line
        let line: RegExpExecArray | null;

        while ((line = linePicker.exec(comment))) {
          const startIdx = block.index + markStart.length + space.length + line.index + line[1].length;
          const startPos = editor.document.positionAt(startIdx);
          const endPos = editor.document.positionAt(startIdx + line[3].length);
          const range = new vscode.Range(startPos, endPos);

          const tagName = line![4].toLowerCase();

          const opt = decorationOptions.get(tagName) || [];
          opt.push({ range });
          decorationOptions.set(tagName, opt);
        }
      }
    }
    return {
      blockRanges,
      decorationOptions,
    };
  }

  protected async pickFromLineComment(editor: vscode.TextEditor, skipRanges: [number, number][] = []) {
    const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

    const picker = await this.getLinePicker();

    if (picker) {
      let match: RegExpExecArray | null | undefined;

      while ((match = picker.exec(editor.document.getText()))) {
        const beginIndex = match.index;
        const endIndex = match.index + match[0].length;
        if (skipRanges.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
          // skip if line mark inside block comments
          continue;
        }

        const startPos = editor.document.positionAt(match.index + match[1].length);
        const endPos = editor.document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const tagName = match![3].toLowerCase();

        const opt = decorationOptions.get(tagName) || [];
        opt.push({ range });
        decorationOptions.set(tagName, opt);
      }
    }

    return {
      decorationOptions,
    };
  }

  private async parseBlockPickers() {
    const comments = await definition.getAvailableComments(this.langId);

    if (!comments.blockComments || !comments.blockComments.length) {
      return [];
    }

    const configs = configuration.getConfigurationFlatten();

    const escapedTags = configs.tags.map((tag) => tag.tagEscaped);

    const pickers: BlockPicker[] = comments.blockComments.map((marks) => {
      const start = escapeRegexString(marks[0]);
      const end = escapeRegexString(marks[1]);
      const linePrefix = marks[0].slice(-1);
      const prefix = escapeRegexString(linePrefix);
      return {
        markStart: marks[0],
        markEnd: marks[1],
        blockpicker: new RegExp(
          `(${start}+)([ \\t]?)(.*?)(${end})|(${start}+)([ \\t\\r\\n]?)([\\s\\S]*?)(${end})`,
          'gm',
        ),
        linePicker: new RegExp(`(^([ \\t]*))((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
        docLinePicker: new RegExp(`(^[ \\t]*${prefix}([ \\t]))((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
        docLinePrefix: linePrefix,
      };
    });

    return pickers;
  }

  private async parseLinePicker() {
    const configs = configuration.getConfigurationFlatten();

    const escapedTags = configs.tags.map((tag) => tag.tagEscaped);

    const comments = await definition.getAvailableComments(this.langId);

    if (!comments.lineComments || !comments.lineComments.length) {
      return;
    }

    const escapedMarks = comments.lineComments.map((s) => `${escapeRegexString(s)}+`).join('|');

    return new RegExp(`(^|[ \\t]+)(${escapedMarks})[ \\t](${escapedTags.join('|')})(.*)`, 'igm');
  }
}
