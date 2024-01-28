import * as vscode from 'vscode';
import { getConfigurationFlatten } from './configuration';
import * as languages from './languages';
import type { TagFlatten } from './configuration';

export interface TagDecoration {
  tag: string;
  escapedTag: string;
  decoration: vscode.TextEditorDecorationType;
  decorationOptions: vscode.DecorationOptions[];
}

export interface LinePicker {
  pick: RegExp;
  marks: string[];
}
export interface BlockPicker {
  blockPick: RegExp;
  linePick: RegExp;
  docLinePick: RegExp;
  linePrefix: string;
  marks: vscode.CharacterPair;
}

export interface PickParams {
  text: string;
  blockRanges: [number, number][]; // array of [beginIndex, endIndex]
}

export function useParser() {
  // Update languages definitions
  languages.updateDefinitions();

  // Better comments configuration in flatten
  const configs = getConfigurationFlatten();

  // Tags for decoration
  const tagDecorations: TagDecoration[] = generateTagDecorations();

  // Line picker
  let linePicker: LinePicker | undefined;

  // Block pickers
  let blockPickers: BlockPicker[] = [];

  let highlightLineComments = true;
  let highlightBlockComments = false;

  // Vscode active editor
  let activedEditor: vscode.TextEditor | undefined;

  /**
   * Get actived editor
   */
  function getEditor() {
    return activedEditor;
  }

  /**
   * Switch editor for parser and setup pickers
   */
  async function setEditor(editor: vscode.TextEditor) {
    activedEditor = editor;

    const comments = await languages.getAvailableCommentRules(activedEditor.document.languageId);

    setupLinePicker(comments);

    setupBlockPickers(comments);
  }

  /**
   * Set up line picker
   */
  function setupLinePicker({ lineComments }: languages.AvailableCommentRules) {
    if (!activedEditor) {
      linePicker = undefined;
      return;
    }

    highlightLineComments = activedEditor.document.languageId === 'plaintext'
      ? configs.highlightPlainText // If highlight plaintext is enabled, this is a supported language
      : lineComments.length > 0;

    if (!highlightLineComments) {
      linePicker = undefined;

      return;
    }

    const escapedTags = tagDecorations.map(tag => tag.escapedTag);

    if (activedEditor.document.languageId === 'plaintext') {
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
  function setupBlockPickers({ blockComments }: languages.AvailableCommentRules) {
    highlightBlockComments = blockComments.length > 0 && configs.multilineComments;

    if (!activedEditor || !highlightBlockComments) {
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
        blockPick: new RegExp(`(^|[ \\t]+)(${begin}+)([\\s\\S]*?)(${end})`, 'gm'),
        linePick: new RegExp(`(^[ \\t]*)((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
        docLinePick: new RegExp(`(^[ \\t]*${prefix}[ \\t])((${escapedTags.join('|')})[^^\\r^\\n]*)`, 'igm'),
        linePrefix,
        marks,
      } as BlockPicker;
    });
  }

  /**
   * Pick up all single line comments delimited by a given delimiter and matching tags.
   * @param params Pass params in object avoid copy values
   */
  function pickLineComments(params: PickParams): void {
    // If highlight single line comments is off, single line comments are not supported for this language
    if (!activedEditor || !highlightLineComments) {
      return;
    }

    let match: RegExpExecArray | null | undefined;
    while (match = linePicker?.pick.exec(params.text)) {
      // skip if line mark inside block comments
      const beginIndex = match.index;
      const endIndex = match.index + match[0].length;
      if (params.blockRanges.find(range => range[0] <= beginIndex && endIndex <= range[1])) {
        continue;
      }

      const startPos = activedEditor.document.positionAt(match.index + match[1].length);
      const endPos = activedEditor.document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      // Find which custom delimiter was used in order to add it to the collection
      const found = tagDecorations.find(td => td.tag.toLowerCase() === match![3]?.toLowerCase());

      if (found) {
        found.decorationOptions.push({ range });
      }
    }
  }

  /**
   * Pick up block comments as indicated by start and end delimiter.
   * @param params Pass params in object avoid copy values
   */
  function pickBlockComments(params: PickParams): void {
    // If activedEditor undefined then return
    if (!activedEditor) {
      return;
    }

    for (const picker of blockPickers) {
      // Find the multiline comment block
      let block: RegExpExecArray | null;
      while (block = picker.blockPick.exec(params.text)) {
        // remember block comment range
        params.blockRanges.push([block.index, block.index + block[0].length]);

        // If highlight multiline is off then continue
        if (!highlightBlockComments) {
          continue;
        }

        const comment = block[3];
        const isJsDoc = block[2] === '/**';

        const linePick = isJsDoc ? picker.docLinePick : picker.linePick;

        // Find the line
        let line: RegExpExecArray | null;
        while (line = linePick.exec(comment)) {
          // Find which custom delimiter was used in order to add it to the collection
          const matchString = line[3];

          const startIdx = block.index + block[1].length + block[2].length + line.index + line[1].length;
          const startPos = activedEditor.document.positionAt(startIdx);
          const endPos = activedEditor.document.positionAt(startIdx + line[2].length);
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
   */
  function applyDecorations(): void {
    if (!activedEditor) {
      return;
    }

    for (const td of tagDecorations) {
      activedEditor.setDecorations(td.decoration, td.decorationOptions);

      // clear the decoration options for the next pass
      td.decorationOptions = [];
    }
  }

  // * IMPORTANT:
  // * To avoid calling update too often,
  // * set a timer for 100ms to wait before updating decorations
  let triggerUpdateTimeout: NodeJS.Timer | undefined;
  function triggerUpdateDecorations(ms = 100) {
    if (triggerUpdateTimeout) {
      clearTimeout(triggerUpdateTimeout);
    }

    triggerUpdateTimeout = setTimeout(() => {
      // if no active window is open, return
      if (!activedEditor) {
        return;
      }

      const opt: PickParams = {
        text: activedEditor.document.getText(),
        blockRanges: [],
      };

      // Finds the multi line comments using the language comment delimiter
      pickBlockComments(opt);

      // Finds the single line comments using the language comment delimiter
      pickLineComments(opt);

      // Apply decoration styles
      applyDecorations();
    }, ms);
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
    const options: vscode.DecorationRenderOptions = { color: tag.color, backgroundColor: tag.backgroundColor };

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
    updateLanguagesDefinitions: languages.updateDefinitions,
    getEditor,
    setEditor,
    triggerUpdateDecorations,
  };
}
