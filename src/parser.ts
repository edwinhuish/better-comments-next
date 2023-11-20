import * as vscode from 'vscode';
import type { Configuration } from './configuration';

export class Parser {
  private tags: CommentTag[] = [];
  private singleLinePicker: RegExp | undefined = undefined;
  private blockPickers: RegExp[] = [];
  private blockLinePicker: RegExp | undefined = undefined;
  private docPicker: RegExp | undefined = undefined;
  private docLinePicker: RegExp | undefined = undefined;

  private delimiter = '';
  private blockComments: [string, string][] = [];

  private highlightSingleLineComments = true;
  private highlightMultilineComments = false;
  private highlightJSDoc = false;

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

    this.setTags();
  }

  /**
   * Sets the regex to be used by the matcher based on the config specified in the package.json
   * @param languageCode The short code of the current language
   * https://code.visualstudio.com/docs/languages/identifiers
   */
  public async InitPickers(languageCode: string) {
    await this.setDelimiter(languageCode);

    // if the language isn't supported, we don't need to go any further
    if (!this.supportedLanguage) {
      return;
    }

    const characters: Array<string> = [];
    for (const commentTag of this.tags) {
      characters.push(commentTag.escapedTag);
    }

    // Single expression
    if (this.isPlainText && this.contributions.highlightPlainText) {
      // start by tying the regex to the first character in a line
      this.singleLinePicker = new RegExp(`(^)+([ \\t]*[ \\t]*)(${characters.join('|')})+(.*)`, 'igm');
    } else {
      // start by finding the delimiter (//, --, #, ') with optional spaces or tabs
      this.singleLinePicker = new RegExp(`(${this.delimiter})+([ |\t]?)(${characters.join('|')})+(.*)`, 'gm');
    }

    // Block expression
    this.blockPickers = this.blockComments.map(mark => new RegExp(`(^|[ \\t]*)(${mark[0]}[\\s])+([\\s\\S]*?)(${mark[1]})`, 'gm'));
    this.blockLinePicker = new RegExp(`([ \\t]*)(${characters.join('|')})([ ]*|[:])+([^*\/][^\\r\\n]*)`, 'igm');

    // Doc expression
    this.docPicker = /(^|[ \t]*)(\/\*\*)+([\s\S]*?)(\*\/)/gm;
    this.docLinePicker = new RegExp(`(^)+([ \\t]*\\*[ \\t]?)(${characters.join('|')})([ ]*|[:])+([^*/][^\\r\\n]*)`, 'igm');
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
    // while (match = this.singleLinePicker.exec(text)) {
    while (match = this.singleLinePicker?.exec(text)) {
      const startPos = activeEditor.document.positionAt(match.index);
      const endPos = activeEditor.document.positionAt(match.index + match[0].length);
      const range = { range: new vscode.Range(startPos, endPos) };

      // Required to ignore the first line of .py files (#61)
      if (this.ignoreFirstLine && startPos.line === 0 && startPos.character === 0) {
        continue;
      }

      // Find which custom delimiter was used in order to add it to the collection
      const matchTag = this.tags.find(item => item.tag.toLowerCase() === match![3]?.toLowerCase());

      if (matchTag) {
        matchTag.ranges.push(range);
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

    this.blockPickers.forEach((blockPicker) => {
      // Find the multiline comment block
      let blocks: RegExpExecArray | null;
      while (blocks = blockPicker.exec(text)) {
        const comment = blocks[3];

        // Find the line
        let line;
        while (line = this.blockLinePicker?.exec(comment)) {
          const startIdx = blocks.index + blocks[0].indexOf(line[0]) + line[1].length;
          const startPos = activeEditor.document.positionAt(startIdx);
          const endPos = activeEditor.document.positionAt(startIdx - line[1].length + line[0].length);
          const range: vscode.DecorationOptions = { range: new vscode.Range(startPos, endPos) };

          // Find which custom delimiter was used in order to add it to the collection
          const matchString = line[2];
          const matchTag = this.tags.find(item => item.tag.toLowerCase() === matchString.toLowerCase());

          if (matchTag) {
            matchTag.ranges.push(range);
          }
        }
      }
    });
  }

  /**
   * Finds all multiline comments starting with "*"
   * @param activeEditor The active text editor containing the code document
   */
  public FindJSDocComments(activeEditor: vscode.TextEditor): void {
    // If highlight multiline is off in package.json or doesn't apply to his language, return
    if (!this.highlightMultilineComments && !this.highlightJSDoc) {
      return;
    }

    const text = activeEditor.document.getText();

    // Find the multiline comment block
    let blocks: RegExpExecArray | null | undefined;
    while (blocks = this.docPicker?.exec(text)) {
      const commentBlock = blocks[0];

      // Find the line
      let line: RegExpExecArray | null | undefined;
      while (line = this.docLinePicker?.exec(commentBlock)) {
        const startPos = activeEditor.document.positionAt(blocks.index + line.index + line[2].length);
        const endPos = activeEditor.document.positionAt(blocks.index + line.index + line[0].length);
        const range: vscode.DecorationOptions = { range: new vscode.Range(startPos, endPos) };

        // Find which custom delimiter was used in order to add it to the collection
        const matchString = line[3];
        const matchTag = this.tags.find(item => item.tag.toLowerCase() === matchString.toLowerCase());

        if (matchTag) {
          matchTag.ranges.push(range);
        }
      }
    }
  }

  /**
   * Apply decorations after finding all relevant comments
   * @param activeEditor The active text editor containing the code document
   */
  public ApplyDecorations(activeEditor: vscode.TextEditor): void {
    for (const tag of this.tags) {
      activeEditor.setDecorations(tag.decoration, tag.ranges);

      // clear the ranges for the next pass
      tag.ranges.length = 0;
    }
  }

  // #region  Private Methods

  /**
   * Sets the comment delimiter [//, #, --, '] of a given language
   * @param languageCode The short code of the current language
   * https://code.visualstudio.com/docs/languages/identifiers
   */
  private async setDelimiter(languageCode: string): Promise<void> {
    this.supportedLanguage = false;
    this.ignoreFirstLine = false;
    this.isPlainText = false;

    const configs = await this.configuration.GetCommentConfiguration(languageCode);
    if (configs.lineComments.length > 0 || configs.blockComments.length > 0) {
      this.setCommentFormat(configs.lineComments, configs.blockComments);
      this.supportedLanguage = true;
    }

    switch (languageCode) {
      case 'apex':
      case 'javascript':
      case 'javascriptreact':
      case 'typescript':
      case 'typescriptreact':
        this.highlightJSDoc = true;
        break;

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
  }

  /**
   * Sets the highlighting tags up for use by the parser
   */
  private setTags(): void {
    const items = this.contributions.tags;
    for (const item of items) {
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

      const escapedSequence = item.tag.replace(/([()[{*+.$^\\|?])/g, '\\$1');
      this.tags.push({
        tag: item.tag,
        escapedTag: escapedSequence.replace(/\//gi, '\\/'), // ! hardcoded to escape slashes
        ranges: [],
        decoration: vscode.window.createTextEditorDecorationType(options),
      });
    }
  }

  /**
   * Escapes a given string for use in a regular expression
   * @param input The input string to be escaped
   * @returns {string} The escaped string
   */
  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

  /**
   * Set up the comment format for single and multiline highlighting
   * @param singleLine The single line comment delimiter. If NULL, single line is not supported
   * @param start The start delimiter for block comments
   * @param end The end delimiter for block comments
   */
  private setCommentFormat(
    singleLine: string[],
    blocks: [string, string][]): void {
    this.delimiter = '';
    this.blockComments = [];

    // If no single line comment delimiter is passed, single line comments are not supported
    if (singleLine.length > 0) {
      const delimiters = singleLine
        .map(s => this.escapeRegExp(s))
        .join('|');
      this.delimiter = delimiters;
    } else {
      this.highlightSingleLineComments = false;
    }

    if (blocks.length > 0) {
      this.blockComments = blocks.map(block => [this.escapeRegExp(block[0]), this.escapeRegExp(block[1])]);
      this.highlightMultilineComments = this.contributions.multilineComments;
    }
  }

  // #endregion
}
