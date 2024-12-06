import * as vscode from 'vscode';

import * as configuration from '@/configuration';
import * as definition from '@/definition';
import * as log from '@/log';
import { escapeRegexString } from '@/utils';

export abstract class Handler {
  public readonly languageId: string;
  protected triggerUpdateTimeout?: NodeJS.Timeout = undefined;

  constructor(languageId: string) {
    this.languageId = languageId;
  }

  public abstract updateDecorations(editor: vscode.TextEditor): Promise<void>;

  public async triggerUpdateDecorations(editor: vscode.TextEditor, timeout = 100) {
    if (this.triggerUpdateTimeout) {
      clearTimeout(this.triggerUpdateTimeout);
    }

    this.triggerUpdateTimeout = setTimeout(() => {
      if (vscode.window.activeTextEditor !== editor) {
        return;
      }
      this.updateDecorations(editor);
    }, timeout);
  }
}

export class CommonHandler extends Handler {
  public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    if (!editor) {
      log.error(`editor undefined in handler languageId (${this.languageId})`);
      return;
    }

    if (editor.document.languageId !== this.languageId) {
      log.error(
        `document languageId (${editor.document.languageId}) does not match handler languageId (${this.languageId}), file: ${editor.document.fileName}`,
      );

      return;
    }

    if (this.triggerUpdateTimeout) {
      clearTimeout(this.triggerUpdateTimeout);
    }

    const processed: [number, number][] = [];

    const docPicked = await pickDocCommentDecorationOptions({ editor, processed });
    const blockPicked = await pickBlockCommentDecorationOptions({ editor, processed });
    const linePicked = await pickLineCommentDecorationOptions({ editor, processed });

    configuration.getTagDecorationTypes().forEach((td, tag) => {
      const docOpts = docPicked.get(tag) || [];
      const blockOpts = blockPicked.get(tag) || [];
      const lineOpts = linePicked.get(tag) || [];
      const ranges = [...docOpts, ...blockOpts, ...lineOpts];
      editor.setDecorations(td, ranges);
    });
  }
}

export interface PickDecorationOptionsParams {
  editor: vscode.TextEditor;
  processed: [number, number][];
}

export async function pickLineCommentDecorationOptions({ editor, processed = [] }: PickDecorationOptionsParams) {
  const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

  const configs = configuration.getConfigurationFlatten();

  const escapedTags = configs.tags.map((tag) => tag.tagEscaped);

  const comments = await definition.getAvailableComments(editor.document.languageId);

  if (!comments.lineComments || !comments.lineComments.length) {
    return decorationOptions;
  }

  const escapedMarks = comments.lineComments.map((s) => `${escapeRegexString(s)}+`).join('|');

  const picker = new RegExp(`(^|[ \\t]+)(${escapedMarks})([ \\t])(${escapedTags.join('|')})(.*)`, 'igm');

  let block: RegExpExecArray | null | undefined;
  while ((block = picker.exec(editor.document.getText()))) {
    const beginIndex = block.index;
    const endIndex = block.index + block[0].length;
    if (processed.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.push([beginIndex, endIndex]);

    const startPos = editor.document.positionAt(block.index + block[1].length + block[2].length + block[3].length);
    const endPos = editor.document.positionAt(block.index + block[0].length);
    const range = new vscode.Range(startPos, endPos);

    const tagName = block[4].toLowerCase();

    const opt = decorationOptions.get(tagName) || [];
    opt.push({ range });
    decorationOptions.set(tagName, opt);
  }

  return decorationOptions;
}

export async function pickBlockCommentDecorationOptions({ editor, processed = [] }: PickDecorationOptionsParams) {
  const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

  const comments = await definition.getAvailableComments(editor.document.languageId);

  if (!comments.blockComments || !comments.blockComments.length) {
    return decorationOptions;
  }

  const configs = configuration.getConfigurationFlatten();

  const escapedTags = configs.tags.map((tag) => tag.tagEscaped);

  for (const marks of comments.blockComments) {
    const start = escapeRegexString(marks[0]);
    const end = escapeRegexString(marks[1]);

    const blockpicker = new RegExp(`(${start}+)(\\s+)([\\s\\S]*?)(${end})`, 'g');
    const linePicker = new RegExp(`(^|[ \\t])(${escapedTags.join('|')})([^\\n]*?)(\\n|$)`, 'ig');

    // Find the multiline comment block
    let block: RegExpExecArray | null;
    while ((block = blockpicker.exec(editor.document.getText()))) {
      const beginIndex = block.index;
      const endIndex = block.index + block[0].length;
      if (processed.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      processed.push([beginIndex, endIndex]);

      const content = block[3];

      if (!content) {
        continue;
      }

      const contentBeginIndex = block.index + block[1].length + block[2].length;

      // Find the matched line
      let line: RegExpExecArray | null;
      while ((line = linePicker.exec(content))) {
        const lineBeginIndex = contentBeginIndex + line.index;
        const startIdx = lineBeginIndex + line[1].length - line[4].length; // line[4] is the newline character (\n)
        const endIdx = lineBeginIndex + line[0].length;
        const startPos = editor.document.positionAt(startIdx);
        const endPos = editor.document.positionAt(endIdx);
        const range = new vscode.Range(startPos, endPos);

        const tagName = line[2].toLowerCase();

        const opt = decorationOptions.get(tagName) || [];
        opt.push({ range });
        decorationOptions.set(tagName, opt);
      }
    }
  }
  return decorationOptions;
}

export async function pickDocCommentDecorationOptions({ editor, processed = [] }: PickDecorationOptionsParams) {
  const marks = ['/**', '*/'];
  const start = escapeRegexString(marks[0]);
  const end = escapeRegexString(marks[1]);
  const prefix = escapeRegexString('*');

  const configs = configuration.getConfigurationFlatten();

  const escapedTags = configs.tags.map((tag) => tag.tagEscaped);

  const blockPicker = new RegExp(`(${start})([ \\t]+|[ \\t]*\\n)([\\s\\S]*?)(${end})`, 'g');
  const linePicker = new RegExp(`(^|[ \\t]*(${prefix})[ \\t])(${escapedTags.join('|')})([^\\n]*?)(\\n|$)`, 'ig');

  const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

  let block: RegExpExecArray | null;
  while ((block = blockPicker.exec(editor.document.getText()))) {
    const beginIndex = block.index;
    const endIndex = block.index + block[0].length;
    if (processed.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.push([beginIndex, endIndex]);

    const content = block[3];
    const contentBeginIndex = block.index + block[1].length + block[2].length;

    // Find the matched line
    let line: RegExpExecArray | null;
    while ((line = linePicker.exec(content))) {
      const lineBeginIndex = contentBeginIndex + line.index;
      const startIdx = lineBeginIndex + line[1].length;
      const endIdx = lineBeginIndex + line[0].length - line[5].length; // line[5] is the newline character (\n)

      const startPos = editor.document.positionAt(startIdx);
      const endPos = editor.document.positionAt(endIdx);
      const range = new vscode.Range(startPos, endPos);

      const tagName = line[3].toLowerCase();

      const opt = decorationOptions.get(tagName) || [];
      opt.push({ range });
      decorationOptions.set(tagName, opt);
    }
  }

  return decorationOptions;
}
