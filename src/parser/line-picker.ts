import * as vscode from 'vscode';
import { escapeRegexString } from '../utils';
import type { ConfigurationFlatten } from '../configuration';
import type { AvailableCommentRules } from '../languages';
import type { TagDecorationOptions } from '.';

export interface UseLinePickerOptions {
  editor: vscode.TextEditor;
  comments: AvailableCommentRules;
  configs: ConfigurationFlatten;
}

function parseLinePicker(options: UseLinePickerOptions) {
  const {
    editor,
    comments,
    configs,
  } = options;

  const escapedTags = configs.tags.map(tag => tag.tagEscaped);

  if (editor.document.languageId === 'plaintext') {
    if (!configs.highlightPlainText) {
      return;
    }

    return new RegExp(`(^)([ \\t]*)(${escapedTags.join('|')})+(.*)`, 'igm');
  }

  if (!comments.lineComments || !comments.lineComments.length) {
    return;
  }

  const escapedMarks = comments.lineComments.map(s => `${escapeRegexString(s)}+`).join('|');

  return new RegExp(`(^|[ \\t]+)(${escapedMarks})[ \\t](${escapedTags.join('|')})(.*)`, 'igm');
}

export interface LinePickOptions {
  text?: string;
  picker?: RegExp;
  skipRanges?: [number, number][]; // array of [beginIndex, endIndex]
}

function _pick(options: LinePickOptions & { editor: vscode.TextEditor }) {
  if (!options.editor) {
    return;
  }

  if (!options.picker) {
    return;
  }

  if (!options.text) {
    options.text = options.editor.document.getText();
  }

  const decorationOptions: TagDecorationOptions[] = [];

  let match: RegExpExecArray | null | undefined;
  // eslint-disable-next-line no-cond-assign
  while (match = options.picker.exec(options.text)) {
    const beginIndex = match.index;
    const endIndex = match.index + match[0].length;
    if (options.skipRanges?.find(range => range[0] <= beginIndex && endIndex <= range[1])) {
      // skip if line mark inside block comments
      continue;
    }

    const startPos = options.editor.document.positionAt(match.index + match[1].length);
    const endPos = options.editor.document.positionAt(match.index + match[0].length);
    const range = new vscode.Range(startPos, endPos);

    const tag = match![3].toLowerCase();

    decorationOptions.push({ tag, range });
  }

  return {
    decorationOptions,
  };
}

export function useLinePicker(options: UseLinePickerOptions) {
  const {
    editor,
    comments,
    configs,
  } = options;

  return {
    pick: (opt: LinePickOptions = {}) => {
      const picker = parseLinePicker({ editor, comments, configs });
      opt.text = opt.text || editor.document.getText();
      return _pick({ ...opt, picker, editor });
    },
  };
}
