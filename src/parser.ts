import * as vscode from 'vscode';
import { getConfigurationFlatten } from './configuration';
import * as languages from './languages';
import type { TagFlatten } from './configuration';
import type { DecorationRenderOptions, TextEditor } from 'vscode';

export interface TagDecoration {
  tag: string;
  escapedTag: string;
  decoration: vscode.TextEditorDecorationType;
  decorationOptions: vscode.DecorationOptions[];
}

export interface LinePicker {
  pick: RegExp | undefined;
  marks: string[];
}
export interface BlockPicker {
  blockPick: RegExp;
  linePick: RegExp;
  docLinePick: RegExp;
  linePrefix: string;
  marks: [string, string];
}

const ignoreFirstLineLanguageCodes: string[] = [
  'elixir',
  'python',
  'tcl',
];

export function useParser() {
  // Update languages definitions
  languages.updateDefinitions();

  // Better comments configuration in flatten
  const configs = getConfigurationFlatten();

  // Tags for decoration
  const tagDecorations: TagDecoration[] = generateTagDecorations();

  // Line picker
  let linePicker: LinePicker = { pick: undefined, marks: [] };

  // Block pickers
  let blockPickers: BlockPicker[] = [];

  let highlightLineComments = true;
  let highlightBlockComments = false;

  // * this is used to prevent the first line of the file (specifically python) from coloring like other comments
  let ignoreFirstLine = false;

  /**
   * Sets the regex to be used by the matcher based on the config specified
   * @param languageCode The short code of the current language
   * https://code.visualstudio.com/docs/languages/identifiers
   */
  async function setupPickers(languageCode: string) {
    const comments = await languages.getAvailableCommentRules(languageCode);

    ignoreFirstLine = ignoreFirstLineLanguageCodes.includes(languageCode);

    setupLinePicker(languageCode, comments.lineComments);

    setupBlockPickers(languageCode, comments.blockComments);
  }

  /**
   * Set up line picker
   */
  function setupLinePicker(languageCode: string, lineComments: languages.AvailableCommentRules['lineComments']) {
    highlightLineComments = languageCode === 'plaintext'
      ? configs.highlightPlainText // If highlight plaintext is enabled, this is a supported language
      : lineComments.length > 0;

    if (!highlightLineComments) {
      linePicker = { pick: undefined, marks: [] };

      return;
    }

    const escapedTags = tagDecorations.map(tag => tag.escapedTag);

    if (languageCode === 'plaintext') {
      linePicker = {
        marks: [],
        // start by tying the regex to the first character in a line
        pick: new RegExp(`(^)([ \\t]*)(${escapedTags.join('|')})+(.*)`, 'igm'),
      };
      return;
    }

    const escapedMarks = lineComments.map(s => `${escapeRegExp(s)}+`).join('|');

    linePicker = {
      marks: lineComments,
      // start by finding the delimiter (//, --, #, ') with optional spaces or tabs
      pick: new RegExp(`(^|[ \\t]+)(${escapedMarks})[ \\t](${escapedTags.join('|')})(.*)`, 'igm'),
    };
  }

  /**
   * Set up block pickers
   */
  function setupBlockPickers(languageCode: string, blockComments: languages.AvailableCommentRules['blockComments']) {
    highlightBlockComments = blockComments.length > 0 && configs.multilineComments;

    if (!highlightBlockComments) {
      blockPickers = [];
      return;
    }

    const escapedTags = tagDecorations.map(tag => tag.escapedTag);

    blockPickers = blockComments.map((marks) => {
      const begin = escapeRegExp(marks[0]);
      const end = escapeRegExp(marks[1]);
      const linePrefix = marks[0].slice(-1);
      const prefix = escapeRegExp(linePrefix);
      return {
        blockPick: new RegExp(`(^|[ \\t]+)(${begin}+)([^]*?)(${end})`, 'gm'),
        linePick: new RegExp(`(^[ \\t]*)((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
        docLinePick: new RegExp(`(^[ \\t]*${prefix}[ \\t])((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
        linePrefix,
        marks,
      } as BlockPicker;
    });
  }

  /**
   * Pick up all single line comments delimited by a given delimiter and matching tags.
   * @param activeEditor The active text editor containing the code document
   */
  function pickLineComments(activeEditor: TextEditor): void {
  // If highlight single line comments is off, single line comments are not supported for this language
    if (!highlightLineComments) {
      return;
    }

    const text = activeEditor.document.getText();

    let match: RegExpExecArray | null | undefined;
    while (match = linePicker.pick?.exec(text)) {
      const startPos = activeEditor.document.positionAt(match.index + match[1].length);
      const endPos = activeEditor.document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      // Required to ignore the first line of .py files (#61)
      if (ignoreFirstLine && startPos.line === 0 && startPos.character === 0) {
        continue;
      }

      // Find which custom delimiter was used in order to add it to the collection
      const found = tagDecorations.find(td => td.tag.toLowerCase() === match![3]?.toLowerCase());

      if (found) {
        found.decorationOptions.push({ range });
      }
    }
  }

  /**
   * Pick up block comments as indicated by start and end delimiter.
   * @param activeEditor The active text editor containing the code document
   */
  function pickBlockComments(activeEditor: TextEditor): void {
  // If highlight multiline is off in package.json or doesn't apply to his language, return
    if (!highlightBlockComments) {
      return;
    }

    const text = activeEditor.document.getText();

    for (const picker of blockPickers) {
    // Find the multiline comment block
      let block: RegExpExecArray | null;
      while (block = picker.blockPick.exec(text)) {
        const comment = block[3];
        const isJsDoc = block[2] === '/**';

        const linePick = isJsDoc ? picker.docLinePick : picker.linePick;

        // Find the line
        let line: RegExpExecArray | null;
        while (line = linePick.exec(comment)) {
        // Find which custom delimiter was used in order to add it to the collection
          const matchString = line[3];

          const startIdx = block.index + block[1].length + block[2].length + line.index + line[1].length;
          const startPos = activeEditor.document.positionAt(startIdx);
          const endPos = activeEditor.document.positionAt(startIdx + line[2].length);
          const range = new vscode.Range(startPos, endPos);

          const found = tagDecorations.find(td => td.tag.toLowerCase() === matchString?.toLowerCase());

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
    for (const td of tagDecorations) {
      activeEditor.setDecorations(td.decoration, td.decorationOptions);

      // clear the decoration options for the next pass
      td.decorationOptions = [];
    }
  }

  /**
   * This is used to trigger the events when a supported language code is found
   */
  function isSupportedLanguage() {
    return highlightLineComments || highlightBlockComments;
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
   * Generate tags decorations
   */
  function generateTagDecorations() {
    const decorations: TagDecoration[] = [];
    for (const tag of configs.tags) {
      const opt = parseDecorationRenderOption(tag);

      const tagLight = configs.tagsLight.find(t => t.tag === tag.tag);
      if (tagLight) {
        opt.light = parseDecorationRenderOption(tagLight);
      }

      const tagDark = configs.tagsDark.find(t => t.tag === tag.tag);
      if (tagDark) {
        opt.dark = parseDecorationRenderOption(tagDark);
      }

      decorations.push({
        tag: tag.tag,
        escapedTag: escapeRegExp(tag.tag),
        decoration: vscode.window.createTextEditorDecorationType(opt),
        decorationOptions: [],
      });
    }

    return decorations;
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

  return {
    setupPickers,
    pickLineComments,
    pickBlockComments,
    applyDecorations,
    updateLanguagesDefinitions: languages.updateDefinitions,
    isSupportedLanguage,
  };
}
