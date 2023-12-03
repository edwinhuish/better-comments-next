import * as vscode from 'vscode';
import { getAvailableCommentRules, getConfigurationFlatten, updateLanguagesDefinitions } from './configuration';
import type { TagFlatten } from './configuration';
import type { DecorationRenderOptions, TextEditor } from 'vscode';

export interface TagDecoration {
  tag: string;
  escapedTag: string;
  decoration: vscode.TextEditorDecorationType;
  decorationOptions: vscode.DecorationOptions[];
}

export interface LinePicker {
  picker: RegExp | undefined;
  marks: string[];
}
export interface BlockPicker {
  blockPicker: RegExp;
  linePicker: RegExp;
  docLinePicker: RegExp;
  linePrefix: string;
  marks: [string, string];
}

// Better comments configuration in flatten
const _configs = getConfigurationFlatten();

// Tags for decoration
const _tagDecorations: TagDecoration[] = generateTagDecorations();

// Line picker
let _linePicker: LinePicker = { picker: undefined, marks: [] };

// Block pickers
let _blockPickers: BlockPicker[] = [];

let _highlightSingleLineComments = true;
let _highlightMultilineComments = false;

// * this will allow plaintext files to show comment highlighting if switched on
let _isPlainText = false;

// * this is used to prevent the first line of the file (specifically python) from coloring like other comments
let _ignoreFirstLine = false;

// * this is used to trigger the events when a supported language code is found
let _supportedLanguage = true;

/**
 * Sets the regex to be used by the matcher based on the config specified
 * @param languageCode The short code of the current language
 * https://code.visualstudio.com/docs/languages/identifiers
 */
async function setupPickers(languageCode: string) {
  _supportedLanguage = false;
  _ignoreFirstLine = false;
  _isPlainText = false;

  const comments = await getAvailableCommentRules(languageCode);

  if (comments.lineComments.length > 0 || comments.blockComments.length > 0) {
    _supportedLanguage = true;
  }

  _highlightSingleLineComments = comments.lineComments.length > 0;
  _highlightMultilineComments = comments.blockComments.length > 0 && _configs.multilineComments;

  switch (languageCode) {
    case 'elixir':
    case 'python':
    case 'tcl':
      _ignoreFirstLine = true;
      break;

    case 'plaintext':
      _isPlainText = true;

      // If highlight plaintext is enabled, this is a supported language
      _supportedLanguage = _configs.highlightPlainText;
      break;
  }

  // if the language isn't supported, we don't need to go any further
  if (!_supportedLanguage) {
    return;
  }

  const escapedTags = _tagDecorations.map(tag => tag.escapedTag);

  // Single expression
  if (_isPlainText && _configs.highlightPlainText) {
    _linePicker = {
      marks: [],
      // start by tying the regex to the first character in a line
      picker: new RegExp(`(^)([ \\t]*)(${escapedTags.join('|')})+(.*)`, 'igm'),
    };
  } else {
    const escapedMarks = comments.lineComments.map(s => `${escapeRegExp(s)}+`).join('|');
    _linePicker = {
      marks: comments.lineComments,
      // start by finding the delimiter (//, --, #, ') with optional spaces or tabs
      picker: new RegExp(`(^|[ \\t]+)(${escapedMarks})[ \\t](${escapedTags.join('|')})(.*)`, 'igm'),
    };
  }

  // Block expression
  _blockPickers = comments.blockComments.map((marks) => {
    const begin = escapeRegExp(marks[0]);
    const end = escapeRegExp(marks[1]);
    const linePrefix = marks[0].slice(-1);
    const prefix = escapeRegExp(linePrefix);
    return {
      blockPicker: new RegExp(`(^|[ \\t]+)(${begin}+)([^]*?)(${end})`, 'gm'),
      linePicker: new RegExp(`(^[ \\t]*)((${escapedTags.join('|')})([ \\t]*|[:])+[^^\\r^\\n]*)`, 'igm'),
      docLinePicker: new RegExp(`(^[ \\t]*${prefix}[ \\t])((${escapedTags.join('|')})([ \\t]*|[:])+[^^\\r^\\n]*)`, 'igm'),
      linePrefix,
      marks,
    } as BlockPicker;
  });
}

/**
 * Finds all single line comments delimited by a given delimiter and matching tags specified in package.json
 * @param activeEditor The active text editor containing the code document
 */
function findLineComments(activeEditor: TextEditor): void {
  // If highlight single line comments is off, single line comments are not supported for this language
  if (!_highlightSingleLineComments) {
    return;
  }

  const text = activeEditor.document.getText();

  let match: RegExpExecArray | null | undefined;
  while (match = _linePicker.picker?.exec(text)) {
    const startPos = activeEditor.document.positionAt(match.index + match[1].length);
    const endPos = activeEditor.document.positionAt(match.index + match[0].length);
    const range = new vscode.Range(startPos, endPos);

    // Required to ignore the first line of .py files (#61)
    if (_ignoreFirstLine && startPos.line === 0 && startPos.character === 0) {
      continue;
    }

    // Find which custom delimiter was used in order to add it to the collection
    const found = _tagDecorations.find(td => td.tag.toLowerCase() === match![3]?.toLowerCase());

    if (found) {
      found.decorationOptions.push({ range });
    }
  }
}

/**
 * Finds block comments as indicated by start and end delimiter
 * @param activeEditor The active text editor containing the code document
 */
function findBlockComments(activeEditor: TextEditor): void {
  // If highlight multiline is off in package.json or doesn't apply to his language, return
  if (!_highlightMultilineComments) {
    return;
  }

  const text = activeEditor.document.getText();

  for (const picker of _blockPickers) {
    // Find the multiline comment block
    let block: RegExpExecArray | null;
    while (block = picker.blockPicker.exec(text)) {
      const comment = block[3];
      const isJsDoc = block[2] === '/**';

      const linePicker = isJsDoc ? picker.docLinePicker : picker.linePicker;

      // Find the line
      let line: RegExpExecArray | null;
      while (line = linePicker.exec(comment)) {
        // Find which custom delimiter was used in order to add it to the collection
        const matchString = line[3];

        const startIdx = block.index + block[1].length + block[2].length + line.index + line[1].length;
        const startPos = activeEditor.document.positionAt(startIdx);
        const endPos = activeEditor.document.positionAt(startIdx + line[2].length);
        const range = new vscode.Range(startPos, endPos);

        const found = _tagDecorations.find(td => td.tag.toLowerCase() === matchString?.toLowerCase());

        if (found) {
          found.decorationOptions.push({ range });
        }
      }
    }
  }
}
/**
 * Apply decorations after finding all relevant comments
 * @param activeEditor The active text editor containing the code document
 */
function applyDecorations(activeEditor: vscode.TextEditor): void {
  for (const td of _tagDecorations) {
    activeEditor.setDecorations(td.decoration, td.decorationOptions);

    // clear the decoration options for the next pass
    td.decorationOptions = [];
  }
}

function isSupportedLanguage() {
  return _supportedLanguage;
}

/**
 * Escapes a given string for use in a regular expression
 * @param input The input string to be escaped
 * @returns {string} The escaped string
 */
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Initialization tags decorations
 */
function generateTagDecorations() {
  const tagDecorations: TagDecoration[] = [];
  for (const tag of _configs.tags) {
    const opt = parseDecorationRenderOption(tag);

    const tagLight = _configs.tagsLight.find(t => t.tag === tag.tag);
    if (tagLight) {
      opt.light = parseDecorationRenderOption(tagLight);
    }

    const tagDark = _configs.tagsDark.find(t => t.tag === tag.tag);
    if (tagDark) {
      opt.dark = parseDecorationRenderOption(tagDark);
    }

    tagDecorations.push({
      tag: tag.tag,
      escapedTag: escapeRegExp(tag.tag),
      decoration: vscode.window.createTextEditorDecorationType(opt),
      decorationOptions: [],
    });
  }

  return tagDecorations;
}

/**
 * Parse decoration render option by tag configuration
 */
function parseDecorationRenderOption(tag: TagFlatten) {
  const options: DecorationRenderOptions = { color: tag.color, backgroundColor: tag.backgroundColor };

  // ? the textDecoration is initialised to empty so we can concat a preceeding space on it
  options.textDecoration = '';

  if (tag.strikethrough) {
    options.textDecoration += 'line-through';
  }

  if (tag.underline) {
    options.textDecoration += ' underline';
  }

  if (tag.bold) {
    options.fontWeight = 'bold';
  }

  if (tag.italic) {
    options.fontStyle = 'italic';
  }

  return options;
}

export function setup() {
  updateLanguagesDefinitions();

  return {
    setupPickers,
    findLineComments,
    findBlockComments,
    applyDecorations,
    updateLanguagesDefinitions,
    isSupportedLanguage,
  };
}
