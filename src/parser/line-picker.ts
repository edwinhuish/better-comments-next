import * as vscode from 'vscode';
import * as configuration from '../configuration';
import * as languages from '../languages';
import { escapeRegexString } from '../utils';
import type { TagDecorationOptions } from '.';

async function parseLinePicker(langId: string) {
  const configs = configuration.getConfigurationFlatten();

  const escapedTags = configs.tags.map(tag => tag.tagEscaped);

  if (langId === 'plaintext') {
    if (!configs.highlightPlainText) {
      return;
    }

    return new RegExp(`(^)([ \\t]*)(${escapedTags.join('|')})+(.*)`, 'igm');
  }

  const comments = await languages.getAvailableCommentRules(langId);

  if (!comments.lineComments || !comments.lineComments.length) {
    return;
  }

  const escapedMarks = comments.lineComments.map(s => `${escapeRegexString(s)}+`).join('|');

  return new RegExp(`(^|[ \\t]+)(${escapedMarks})[ \\t](${escapedTags.join('|')})(.*)`, 'igm');
}

interface _LinePickOptions {
  editor: vscode.TextEditor;
  picker?: RegExp;
  skipRanges?: [number, number][]; // array of [beginIndex, endIndex]
  text?: string;
}

function _pick(options: _LinePickOptions) {
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

export interface LinePickOptions {
  editor: vscode.TextEditor;
  skipRanges?: [number, number][]; // array of [beginIndex, endIndex]
}

export function useLinePicker(langId: string) {
  let _picker: RegExp | undefined;
  async function getPicker() {
    if (!_picker) {
      _picker = await parseLinePicker(langId);
    }
    return _picker!;
  }

  languages.onDidChange(() => {
    _picker = undefined;
    getPicker(); // Init picker once
  });

  configuration.onDidChange(() => {
    _picker = undefined;
    getPicker(); // Init picker once
  });

  async function pick(opts: LinePickOptions) {
    const {
      editor,
      skipRanges = [],
    } = opts;

    const text = editor.document.getText();
    const picker = await getPicker();

    return await _pick({ skipRanges, text, editor, picker });
  }

  return {
    pick,
  };
}
