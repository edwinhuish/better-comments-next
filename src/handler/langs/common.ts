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
    log.info(`handler created for languageId (${languageId})`);
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

const _missingLineComments = new Set<string>();
function logMissingLineComments(languageId: string) {
  if (_missingLineComments.has(languageId)) return;

  _missingLineComments.add(languageId);
  log.warn(`Missing line comments for language (${languageId})`);
}

export async function pickLineCommentDecorationOptions({ editor, processed = [] }: PickDecorationOptionsParams) {
  const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

  const configs = configuration.getConfigurationFlatten();

  const comments = await definition.getAvailableComments(editor.document.languageId);

  if (!comments.lineComments || !comments.lineComments.length) {
    logMissingLineComments(editor.document.languageId);
    return decorationOptions;
  }

  const escapedMarks = comments.lineComments.map((s) => `${escapeRegexString(s)}+`).join('|');

  const blockExp = new RegExp(`(${escapedMarks}).*?(?:\\n[ \\t]*\\1.*?)*[\\n$]`, 'g');

  const multilineTags = configs.tags.filter((t) => t.multiline).map((tag) => tag.tagEscaped);
  const lineTags = configs.tags.filter((t) => !t.multiline).map((tag) => tag.tagEscaped);

  let block: RegExpExecArray | null;
  while ((block = blockExp.exec(editor.document.getText()))) {
    const beginIndex = block.index;
    const endIndex = block.index + block[0].length;

    if (processed.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.push([beginIndex, endIndex]);

    const content = block[0];
    const contentBegin = beginIndex;
    const mark = escapeRegexString(block[1]);

    const lineProcessed: [number, number][] = [];

    const m1Exp = new RegExp(
      `([ \\t]*(${mark})[ \\t])((${multilineTags.join('|')})([\\s\\S]*?))(?=\\n(\\s*${mark}\\s*)\\n|$)`,
      'ig',
    );
    const m2Exp = new RegExp(`(^|[ \\t]*(${mark}))([^\\n]*?)(?=\\n|$)`, 'ig');

    // Find the matched multiline
    let m1: RegExpExecArray | null;
    while ((m1 = m1Exp.exec(content))) {
      const m1Begin = contentBegin + m1.index;
      const tagName = m1[4].toLowerCase();

      // Find decoration range
      let m2: RegExpExecArray | null;
      while ((m2 = m2Exp.exec(m1[3]))) {
        const m2Begin = m1Begin + m1[1].length + m2.index;
        const startIdx = m2Begin + m2[1].length;
        const endIdx = m2Begin + m2[0].length;
        // store processed range
        lineProcessed.push([startIdx, endIdx]);

        const startPos = editor.document.positionAt(startIdx);
        const endPos = editor.document.positionAt(endIdx);
        const range = new vscode.Range(startPos, endPos);

        const opt = decorationOptions.get(tagName) || [];
        opt.push({ range });
        decorationOptions.set(tagName, opt);
      }
    }

    const lineExp = new RegExp(`((^|\\s)(${mark}))([ \\t])(${lineTags.join('|')})([^\\n]*)(?=\\n)`, 'ig');

    let line: RegExpExecArray | null | undefined;
    while ((line = lineExp.exec(editor.document.getText()))) {
      const startIdx = line.index;
      const endIdx = line.index + line[0].length;

      if (lineProcessed.find((range) => range[0] <= startIdx && endIdx <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      lineProcessed.push([startIdx, endIdx]);

      const startPos = editor.document.positionAt(line.index + line[1].length + line[4].length);
      const endPos = editor.document.positionAt(line.index + line[0].length);
      const range = new vscode.Range(startPos, endPos);

      const tagName = line[5].toLowerCase();

      const opt = decorationOptions.get(tagName) || [];
      opt.push({ range });
      decorationOptions.set(tagName, opt);
    }
  }

  return decorationOptions;
}

const _missingBlockComments = new Set<string>();
function logMissingBlockComments(languageId: string) {
  if (_missingBlockComments.has(languageId)) return;

  _missingBlockComments.add(languageId);
  log.warn(`Missing block comments for language (${languageId})`);
}

export async function pickBlockCommentDecorationOptions({ editor, processed = [] }: PickDecorationOptionsParams) {
  const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

  const comments = await definition.getAvailableComments(editor.document.languageId);

  if (!comments.blockComments || !comments.blockComments.length) {
    logMissingBlockComments(editor.document.languageId);
    return decorationOptions;
  }

  const configs = configuration.getConfigurationFlatten();

  const multilineTags = configs.tags.filter((t) => t.multiline).map((tag) => tag.tagEscaped);
  const m1Exp = new RegExp(`([ \\t])(${multilineTags.join('|')})([\\s\\S]*?)(\\n\\s*\\n|$)`, 'ig');

  const lineTags = configs.tags.filter((t) => !t.multiline).map((tag) => tag.tagEscaped);
  const lineExp = new RegExp(`(^|[ \\t])(${lineTags.join('|')})([^\\n]*?)(\\n|$)`, 'ig');

  for (const marks of comments.blockComments) {
    const start = escapeRegexString(marks[0]);
    const end = escapeRegexString(marks[1]);

    const blockExp = new RegExp(`(^|\\s)(${start}+)((\\s+)([\\s\\S]*?))(${end})`, 'g');

    // Find the multiline comment block
    let block: RegExpExecArray | null;
    while ((block = blockExp.exec(editor.document.getText()))) {
      const beginIndex = block.index;
      const endIndex = block.index + block[0].length;
      if (processed.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      processed.push([beginIndex, endIndex]);

      if (!block[5].length) {
        continue;
      }

      const content = block[3];
      const contentBegin = block.index + block[1].length + block[2].length;

      const lineProcessed: [number, number][] = [];

      // Find the matched multiline
      let m1: RegExpExecArray | null;
      while ((m1 = m1Exp.exec(content))) {
        const m1Begin = contentBegin + m1.index;
        const tagName = m1[2].toLowerCase();

        const startIdx = m1Begin + m1[1].length;
        const endIdx = m1Begin + m1[0].length;
        // store processed range
        lineProcessed.push([startIdx, endIdx]);

        const startPos = editor.document.positionAt(startIdx);
        const endPos = editor.document.positionAt(endIdx);
        const range = new vscode.Range(startPos, endPos);

        const opt = decorationOptions.get(tagName) || [];
        opt.push({ range });
        decorationOptions.set(tagName, opt);
      }

      // Find the matched line
      let line: RegExpExecArray | null;
      while ((line = lineExp.exec(content))) {
        const lineBeginIndex = contentBegin + line.index;
        const startIdx = lineBeginIndex + line[1].length - line[4].length; // line[4] is the newline character (\n)
        const endIdx = lineBeginIndex + line[0].length;

        if (lineProcessed.find((range) => range[0] <= startIdx && endIdx <= range[1])) {
          // skip if already processed
          continue;
        }
        // store processed range
        lineProcessed.push([startIdx, endIdx]);

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

export async function pickDocCommentDecorationOptions({
  editor,
  processed = [],
  marks = ['/**', '*/'],
}: PickDecorationOptionsParams & { marks?: [string, string] }) {
  const start = escapeRegexString(marks[0]);
  const end = escapeRegexString(marks[1]);
  const prefix = escapeRegexString(marks[0].slice(-1));

  const configs = configuration.getConfigurationFlatten();

  const blockExp = new RegExp(`(^|\\s)(${start})(([ \\t]+|[ \\t]*\\n)[\\s\\S]*?)(${end})`, 'g');

  const multilineTags = configs.tags.filter((t) => t.multiline).map((tag) => tag.tagEscaped);
  const m1Exp = new RegExp(
    `([ \\t]*(${prefix}?)[ \\t])((${multilineTags.join('|')})([\\s\\S]*?))(\\n(\\s*${prefix}?\\s*)\\n|$)`,
    'ig',
  );
  const m2Exp = new RegExp(`(^|[ \\t]*(${prefix}))([^\\n]*?)(\\n|$)`, 'ig');

  const lineTags = configs.tags.filter((t) => !t.multiline).map((tag) => tag.tagEscaped);
  const lineExp = new RegExp(`(^|[ \\t]*(${prefix})[ \\t])(${lineTags.join('|')})([^\\n]*?)(\\n|$)`, 'ig');

  const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

  let block: RegExpExecArray | null;
  while ((block = blockExp.exec(editor.document.getText()))) {
    const beginIndex = block.index;
    const endIndex = block.index + block[0].length;
    if (processed.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.push([beginIndex, endIndex]);

    const content = block[3];
    const contentBegin = block.index + block[1].length + block[2].length;

    const lineProcessed: [number, number][] = [];

    // Find the matched multiline
    let m1: RegExpExecArray | null;
    while ((m1 = m1Exp.exec(content))) {
      const m1Begin = contentBegin + m1.index;
      const tagName = m1[4].toLowerCase();

      // Find decoration range
      let m2: RegExpExecArray | null;
      while ((m2 = m2Exp.exec(m1[3]))) {
        const m2Begin = m1Begin + m1[1].length + m2.index;
        const startIdx = m2Begin + m2[1].length;
        const endIdx = m2Begin + m2[0].length;
        // store processed range
        lineProcessed.push([startIdx, endIdx]);

        const startPos = editor.document.positionAt(startIdx);
        const endPos = editor.document.positionAt(endIdx);
        const range = new vscode.Range(startPos, endPos);

        const opt = decorationOptions.get(tagName) || [];
        opt.push({ range });
        decorationOptions.set(tagName, opt);
      }
    }

    // Find the matched line
    let line: RegExpExecArray | null;
    while ((line = lineExp.exec(content))) {
      const lineBeginIndex = contentBegin + line.index;
      const startIdx = lineBeginIndex + line[1].length;
      const endIdx = lineBeginIndex + line[0].length;

      if (lineProcessed.find((range) => range[0] <= startIdx && endIdx <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      lineProcessed.push([startIdx, endIdx]);

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
