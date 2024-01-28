import * as vscode from 'vscode';
import type { ConfigurationFlatten } from '../configuration';
import { escapeRegexString } from '../utils';
import type { TagDecorationOptions } from '.';

export interface UseBlockPickerOptions {
  blockComments: vscode.CharacterPair[];
  configs: ConfigurationFlatten;
}

export interface BlockPicker {
  blockpicker: RegExp;
  linePicker: RegExp;
  docLinePicker: RegExp;
  docLinePrefix: string;
}

function parseBlockPickers(options: UseBlockPickerOptions) {
  const {
    blockComments,
    configs,
  } = options;

  if (!blockComments || !blockComments.length) {
    return [];
  }

  const escapedTags = configs.tags.map(tag => tag.tagEscaped);

  const pickers: BlockPicker[] = blockComments.map((marks) => {
    const begin = escapeRegexString(marks[0]);
    const end = escapeRegexString(marks[1]);
    const linePrefix = marks[0].slice(-1);
    const prefix = escapeRegexString(linePrefix);
    return {
      blockpicker: new RegExp(`(^|[ \\t]+)(${begin}+)([\\s\\S]*?)(${end})`, 'gm'),
      linePicker: new RegExp(`(^[ \\t]*)((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
      docLinePicker: new RegExp(`(^[ \\t]*${prefix}[ \\t])((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
      docLinePrefix: linePrefix,
    };
  });

  return pickers;
}

interface _BlockPickOptions {
  text?: string;
  editor: vscode.TextEditor;
  picker?: BlockPicker;
  hightlight?: boolean;
}

export interface BlockPickOptions {
  text?: string;
  editor: vscode.TextEditor;
  pickers?: BlockPicker[];
}

function _pick(options: _BlockPickOptions) {
  const {
    editor,
    picker,
    hightlight = true,
  } = options;

  if (!editor) {
    return;
  }

  if (!picker) {
    return;
  }

  if (!options.text) {
    options.text = editor.document.getText();
  }

  const blockRanges: [number, number][] = [];

  const decorationOptions: TagDecorationOptions[] = [];

  // Find the multiline comment block
  let block: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while (block = picker.blockpicker.exec(options.text)) {
    blockRanges.push([block.index, block.index + block[0].length]);

    if (!hightlight) {
      continue;
    }

    const comment = block[3];
    const isJsDoc = block[2] === '/**';

    const linePicker = isJsDoc ? picker.docLinePicker : picker.linePicker;
    // Find the line
    let line: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while (line = linePicker.exec(comment)) {
      const startIdx = block.index + block[1].length + block[2].length + line.index + line[1].length;
      const startPos = editor.document.positionAt(startIdx);
      const endPos = editor.document.positionAt(startIdx + line[2].length);
      const range = new vscode.Range(startPos, endPos);

      const tag = line![3].toLowerCase();

      decorationOptions.push({ tag, range });
    }
  }

  return {
    blockRanges,
    decorationOptions,
  };
}

export function useBlockPicker(options: UseBlockPickerOptions) {
  const pickers = parseBlockPickers(options);

  const hightlight = options.blockComments.length > 0 && options.configs.multilineComments;

  function pick(options: BlockPickOptions) {
    let blockRanges: [number, number][] = [];
    let decorationOptions: TagDecorationOptions[] = [];

    for (const picker of (options.pickers || pickers)) {
      const picked = _pick({ ...options, picker, hightlight });

      if (!picked) {
        continue;
      }

      blockRanges = [...blockRanges, ...(picked.blockRanges || [])];
      decorationOptions = [...decorationOptions, ...(picked.decorationOptions || [])];
    }

    return {
      blockRanges,
      decorationOptions,
    };
  }

  return {
    ...options,
    pick,
  };
}
