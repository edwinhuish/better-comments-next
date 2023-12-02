import * as vscode from 'vscode';
import type { Configuration } from './configuration';

export interface TagOption {
  tag: string;
  color: string;
  strikethrough: boolean;
  underline: boolean;
  bold: boolean;
  italic: boolean;
  backgroundColor: string;
}

export interface Contributions {
  multilineComments: boolean;
  useJSDocStyle: boolean;
  highlightPlainText: boolean;
  tags: TagOption[];
  tagsLight: TagOption[];
  tagsDark: TagOption[];
}

export interface CommentTag {
  tag: string;
  escapedTag: string;
  decoration: vscode.TextEditorDecorationType;
  decorationOptions: vscode.DecorationOptions[];
}

export interface BlockComment {
  blockPicker: RegExp;
  linePicker: RegExp;
  docLinePicker: RegExp;
  linePrefix: string;
  marks: [string, string];
}

export interface LineComments {
  picker: RegExp | undefined;
  marks: string[];
}

export class Parser {
  private tags: CommentTag[] = [];
  private lineComments: LineComments = { picker: undefined, marks: [] };
  private blockComments: BlockComment[] = [];

  private highlightSingleLineComments = true;
  private highlightMultilineComments = false;

  // * this will allow plaintext files to show comment highlighting if switched on
  private isPlainText = false;

  // * this is used to prevent the first line of the file (specifically python) from coloring like other comments
  private ignoreFirstLine = false;

  // * this is used to trigger the events when a supported language code is found
  public supportedLanguage = true;

  // Read from the package.json
  private contributions: Contributions = vscode.workspace.getConfiguration('better-comments') as any;

  // The configuration necessary to find supported languages on startup
  private configuration: Configuration;

  /**
   * Creates a new instance of the Parser class
   * @param configuration
   */
  public constructor(config: Configuration) {
    this.configuration = config;

    this.initTagsConfig();
  }

  /**
   * Sets the regex to be used by the matcher based on the config specified in the package.json
   * @param languageCode The short code of the current language
   * https://code.visualstudio.com/docs/languages/identifiers
   */
  public async InitPickers(languageCode: string) {
    const collect = await this.getAvailableCommentRules(languageCode);

    // if the language isn't supported, we don't need to go any further
    if (!this.supportedLanguage) {
      return;
    }

    const escapedTags = this.tags.map(tag => tag.escapedTag);

    // Single expression
    if (this.isPlainText && this.contributions.highlightPlainText) {
      this.lineComments = {
        marks: [],
        // start by tying the regex to the first character in a line
        picker: new RegExp(`(^)([ \\t]*)(${escapedTags.join('|')})+(.*)`, 'igm'),
      };
    } else {
      const escapedMarks = collect.lineComments.map(s => `${this.escapeRegExp(s)}+`).join('|');
      this.lineComments = {
        marks: collect.lineComments,
        // start by finding the delimiter (//, --, #, ') with optional spaces or tabs
        picker: new RegExp(`(^|[ \\t]+)(${escapedMarks})[ \\t](${escapedTags.join('|')})(.*)`, 'igm'),
      };
    }

    // Block expression
    this.blockComments = collect.blockComments.map((marks) => {
      const begin = this.escapeRegExp(marks[0]);
      const end = this.escapeRegExp(marks[1]);
      const linePrefix = marks[0].slice(-1);
      const prefix = this.escapeRegExp(linePrefix);
      return {
        blockPicker: new RegExp(`(^|[ \\t]+)(${begin}+)([^]*?)(${end})`, 'gm'),
        linePicker: new RegExp(`(^[ \\t]*)((${escapedTags.join('|')})([ \\t]*|[:])+[^^\\r^\\n]*)`, 'igm'),
        docLinePicker: new RegExp(`(^[ \\t]*${prefix}[ \\t])((${escapedTags.join('|')})([ \\t]*|[:])+[^^\\r^\\n]*)`, 'igm'),
        linePrefix,
        marks,
      } as BlockComment;
    });
  }

  /**
   * Finds all single line comments delimited by a given delimiter and matching tags specified in package.json
   * @param activeEditor The active text editor containing the code document
   */
  public FindSingleLineComments(activeEditor: vscode.TextEditor): void {
    // If highlight single line comments is off, single line comments are not supported for this language
    if (!this.highlightSingleLineComments) {
      return;
    }

    const text = activeEditor.document.getText();

    let match: RegExpExecArray | null | undefined;
    while (match = this.lineComments.picker?.exec(text)) {
      const startPos = activeEditor.document.positionAt(match.index);
      const endPos = activeEditor.document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      // Required to ignore the first line of .py files (#61)
      if (this.ignoreFirstLine && startPos.line === 0 && startPos.character === 0) {
        continue;
      }

      // Find which custom delimiter was used in order to add it to the collection
      const matchTag = this.tags.find(item => item.tag.toLowerCase() === match![3]?.toLowerCase());

      if (matchTag) {
        matchTag.decorationOptions.push({ range });
      }
    }
  }

  /**
   * Finds block comments as indicated by start and end delimiter
   * @param activeEditor The active text editor containing the code document
   */
  public FindBlockComments(activeEditor: vscode.TextEditor): void {
    // If highlight multiline is off in package.json or doesn't apply to his language, return
    if (!this.highlightMultilineComments) {
      return;
    }

    const text = activeEditor.document.getText();

    this.blockComments.forEach((c) => {
      // Find the multiline comment block
      let block: RegExpExecArray | null;
      while (block = c.blockPicker.exec(text)) {
        const comment = block[3];
        const isJsDoc = block[2] === '/**';

        const linePicker = isJsDoc ? c.docLinePicker : c.linePicker;

        // Find the line
        let line: RegExpExecArray | null;
        //
        while (line = linePicker.exec(comment)) {
          // Find which custom delimiter was used in order to add it to the collection
          const matchString = line[3];

          const startIdx = block.index + block[1].length + block[2].length + line.index + line[1].length;
          const startPos = activeEditor.document.positionAt(startIdx);
          const endPos = activeEditor.document.positionAt(startIdx + line[2].length);
          const range = new vscode.Range(startPos, endPos);

          const matchTag = this.tags.find(item => item.tag.toLowerCase() === matchString.toLowerCase());

          if (matchTag) {
            matchTag.decorationOptions.push({ range });
          }
        }
      }
    });
  }

  /**
   * Apply decorations after finding all relevant comments
   * @param activeEditor The active text editor containing the code document
   */
  public ApplyDecorations(activeEditor: vscode.TextEditor): void {
    for (const tag of this.tags) {
      activeEditor.setDecorations(tag.decoration, tag.decorationOptions);

      // clear the ranges for the next pass
      tag.decorationOptions = [];
    }
  }

  // #region  Private Methods

  /**
   * Sets the highlighting tags up for use by the parser
   */
  private initTagsConfig(): void {
    const items = this.contributions.tags;

    const parseOption = (item: TagOption) => {
      const options: vscode.DecorationRenderOptions = { color: item.color, backgroundColor: item.backgroundColor };

      // ? the textDecoration is initialised to empty so we can concat a preceeding space on it
      options.textDecoration = '';

      if (item.strikethrough) {
        options.textDecoration += 'line-through';
      }

      if (item.underline) {
        options.textDecoration += ' underline';
      }

      if (item.bold) {
        options.fontWeight = 'bold';
      }

      if (item.italic) {
        options.fontStyle = 'italic';
      }

      return options;
    };

    for (const item of items) {
      const options = parseOption(item);

      const tagLight = this.contributions.tagsLight.find(t => t.tag === item.tag);
      if (tagLight) {
        options.light = parseOption(tagLight);
      }

      const tagDark = this.contributions.tagsDark.find(t => t.tag === item.tag);
      if (tagDark) {
        options.dark = parseOption(tagDark);
      }

      this.tags.push({
        tag: item.tag,
        escapedTag: this.escapeRegExp(item.tag),
        decoration: vscode.window.createTextEditorDecorationType(options),
        decorationOptions: [],
      });
    }
  }

  /**
   * Escapes a given string for use in a regular expression
   * @param input The input string to be escaped
   * @returns {string} The escaped string
   */
  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); // $& means the whole matched string
  }

  /**
   * Get comment rule collection
   * @param languageCode The short code of the current language
   * https://code.visualstudio.com/docs/languages/identifiers
   */
  private async getAvailableCommentRules(languageCode: string) {
    this.supportedLanguage = false;
    this.ignoreFirstLine = false;
    this.isPlainText = false;

    const collect = await this.configuration.GetAvailableCommentRules(languageCode);

    if (collect.lineComments.length > 0 || collect.blockComments.length > 0) {
      this.supportedLanguage = true;
    }

    this.highlightSingleLineComments = collect.lineComments.length > 0;
    this.highlightMultilineComments = collect.blockComments.length > 0 && this.contributions.multilineComments;

    switch (languageCode) {
      case 'elixir':
      case 'python':
      case 'tcl':
        this.ignoreFirstLine = true;
        break;

      case 'plaintext':
        this.isPlainText = true;

        // If highlight plaintext is enabled, this is a supported language
        this.supportedLanguage = this.contributions.highlightPlainText;
        break;
    }

    return collect;
  }

  // #endregion
}
