import * as configuration from '../../configuration';
import * as definition from '../../definition';
import { escapeRegexString } from '../../utils';

import * as vscode from 'vscode';

export interface BlockPicker {
  markStart: string;
  markEnd: string;
  blockpicker: RegExp;
  linePicker: RegExp;
  docLinePicker: RegExp;
  docLinePrefix: string;
}

export interface TagDecorationOptions extends vscode.DecorationOptions {
  tag: string;
}

export abstract class Handler {
  protected editor: vscode.TextEditor;

  constructor(activedEditor: vscode.TextEditor) {
    this.editor = activedEditor;
  }

  public setEditor(activedEditor: vscode.TextEditor) {
    this.editor = activedEditor;
    return this;
  }

  public getEditor() {
    return this.editor;
  }

  public abstract updateDecorations(): Promise<void>;
}

export class CommonHandler extends Handler {
  protected text?: string;
  protected blockPickers?: BlockPicker[] = undefined;

  public setEditor(activedEditor: vscode.TextEditor) {
    this.editor = activedEditor;
    this.text = undefined;
    this.blockPickers = undefined;
    return this;
  }

  public async updateDecorations(): Promise<void> {
    const blockPicked = await this.pickFromBlockComment();
    const linePicked = await this.pickFromLineComment(blockPicked.blockRanges);

    const tagDecorationTypes = configuration.getTagDecorationTypes();

    for (const t of tagDecorationTypes) {
      const lowerTag = t.tag.toLowerCase();
      const blockOpts = (blockPicked.decorationOptions.filter((opt) => opt.tag === lowerTag) ||
        []) as vscode.DecorationOptions[];
      const lineOpts = (linePicked.decorationOptions.filter((opt) => opt.tag === lowerTag) ||
        []) as vscode.DecorationOptions[];

      this.editor.setDecorations(t.decorationType, [...blockOpts, ...lineOpts]);
    }
  }

  protected getText() {
    if (this.text === undefined) {
      this.text = this.editor.document.getText();
    }

    return this.text;
  }

  protected async getBlockPickers() {
    if (this.blockPickers === undefined) {
      this.blockPickers = await this.parseBlockPickers();
    }

    return this.blockPickers;
  }

  protected async pickFromBlockComment() {
    const pickers = await this.getBlockPickers();

    const blockRanges: [number, number][] = [];
    const decorationOptions: TagDecorationOptions[] = [];

    for (const picker of pickers) {
      // Find the multiline comment block
      let block: RegExpExecArray | null;

      while ((block = picker.blockpicker.exec(this.getText()))) {
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
          const startPos = this.editor.document.positionAt(startIdx);
          const endPos = this.editor.document.positionAt(startIdx + line[3].length);
          const range = new vscode.Range(startPos, endPos);

          const tag = line![4].toLowerCase();

          decorationOptions.push({ tag, range });
        }
      }
    }
    return {
      blockRanges,
      decorationOptions,
    };
  }

  protected async pickFromLineComment(skipRanges: [number, number][] = []) {
    const decorationOptions: TagDecorationOptions[] = [];

    const picker = await this.parseLinePicker();

    if (picker) {
      let match: RegExpExecArray | null | undefined;

      while ((match = picker.exec(this.getText()))) {
        const beginIndex = match.index;
        const endIndex = match.index + match[0].length;
        if (skipRanges.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
          // skip if line mark inside block comments
          continue;
        }

        const startPos = this.editor.document.positionAt(match.index + match[1].length);
        const endPos = this.editor.document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const tag = match![3].toLowerCase();

        decorationOptions.push({ tag, range });
      }
    }

    return {
      decorationOptions,
    };
  }

  private async parseBlockPickers() {
    const comments = await definition.getAvailableComments(this.editor.document.languageId);

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

    const comments = await definition.getAvailableComments(this.editor.document.languageId);

    if (!comments.lineComments || !comments.lineComments.length) {
      return;
    }

    const escapedMarks = comments.lineComments.map((s) => `${escapeRegexString(s)}+`).join('|');

    return new RegExp(`(^|[ \\t]+)(${escapedMarks})[ \\t](${escapedTags.join('|')})(.*)`, 'igm');
  }
}
