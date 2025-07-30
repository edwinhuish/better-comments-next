import * as log from '@/log';
import { isString } from '@/utils/str';
import { parse as json5Parse } from 'json5';
import * as vscode from 'vscode';

export interface AvailableComments {
  lineComments: string[];
  blockComments: vscode.CharacterPair[];
}

export class Language {
  public readonly id: string;
  protected configurationUri?: vscode.Uri;
  protected configuration?: vscode.LanguageConfiguration;

  protected comments?: vscode.CommentRule;
  protected embeddedLanguages: Set<string>;
  protected availableComments?: AvailableComments;

  protected useDocComment: boolean = true;

  constructor(id: string) {
    this.id = id;

    this.embeddedLanguages = new Set();
  }

  /**
   * Set configuration uri
   */
  public setConfigurationUri(configurationUri?: vscode.Uri) {
    this.configurationUri = configurationUri;
    return this;
  }

  /**
   * Check if config uri already setup
   */
  public hasConfigurationUri() {
    return !!this.configurationUri;
  }

  /**
   * Get language configuration
   */
  public async getConfiguration() {
    if (this.configuration) {
      return this.configuration;
    }

    if (!this.configurationUri) {
      return undefined;
    }

    try {
      // Read file
      const raw = await vscode.workspace.fs.readFile(this.configurationUri);

      const content = raw.toString();

      // use json5, because the config can contains comments
      this.configuration = json5Parse(content) as vscode.LanguageConfiguration;

      return this.configuration;
    }
    catch (error: any) {
      log.error(`Parse configuration file ${this.configurationUri.toString()} failed: ${error.message}`);
      return undefined;
    }
  }

  public setComments(comments: vscode.CommentRule) {
    this.comments = comments;
    return this;
  }

  /**
   * Get language comments rules
   */
  public async getComments(): Promise<vscode.CommentRule | undefined> {
    if (!this.comments) {
      const config = await this.getConfiguration();

      this.comments = {};

      if (config && config.comments) {
        const { lineComment, blockComment } = config.comments;
        if (isString(lineComment)) {
          this.comments.lineComment = lineComment;
        }
        if (Array.isArray(blockComment) && blockComment.length === 2 && isString(blockComment[0]) && isString(blockComment[1])) {
          this.comments.blockComment = blockComment;
        }
      }
      else {
        this.comments = getDefaultComments(this.id);
      }
    }

    return this.comments;
  }

  /**
   * Add embedded language id
   */
  public addEmbeddedLanguage(langId: string) {
    this.embeddedLanguages.add(langId);
    return this;
  }

  /**
   * Get embedded language ids
   */
  public getEmbeddedLanguages() {
    return this.embeddedLanguages;
  }

  /**
   * Replace embeddedLanguages
   */
  public setEmbeddedLanguages(embeddedLanguages: string[] | Set<string>) {
    this.embeddedLanguages = new Set(embeddedLanguages);
    return this;
  }

  /**
   * Get avaiable comments
   */
  public getAvailableComments() {
    return this.availableComments;
  }

  /**
   * Set avaiable comments
   */
  public setAvailableComments(comments: AvailableComments) {
    this.availableComments = comments;
    if (comments.lineComments.length) {
      log.info(`(${this.id}) LINE COMMENTS: ${comments.lineComments.join('、')}`);
    }
    if (comments.blockComments.length) {
      log.info(`(${this.id}) BLOCK COMMENTS: ${comments.blockComments.map(c => `${c[0]} ${c[1]}`).join('、')}`);
    }
    return this;
  }

  public setUseDocComment(useDocComment: boolean) {
    this.useDocComment = useDocComment;
    return this;
  }

  public isUseDocComment() {
    return this.useDocComment;
  }
}

export class CommonLanguage extends Language {
  // ignore eslint-prettier error
}

function getDefaultComments(languageCode: string): vscode.CommentRule | undefined {
  switch (languageCode) {
    case 'asciidoc':
      return { lineComment: '//', blockComment: ['////', '////'] };
    case 'apex':
    case 'javascript':
    case 'javascriptreact':
    case 'typescript':
    case 'typescriptreact':
    case 'al':
    case 'c':
    case 'cpp':
    case 'csharp':
    case 'dart':
    case 'flax':
    case 'fsharp':
    case 'go':
    case 'groovy':
    case 'haxe':
    case 'java':
    case 'jsonc':
    case 'kotlin':
    case 'less':
    case 'pascal':
    case 'objectpascal':
    case 'php':
    case 'rust':
    case 'scala':
    case 'sass':
    case 'scss':
    case 'stylus':
    case 'swift':
    case 'verilog':
      return { lineComment: '//', blockComment: ['/*', '*/'] };
    case 'css':
      return { blockComment: ['/*', '*/'] };
    case 'coffeescript':
    case 'dockerfile':
    case 'gdscript':
    case 'graphql':
    case 'julia':
    case 'makefile':
    case 'perl':
    case 'perl6':
    case 'puppet':
    case 'r':
    case 'ruby':
    case 'shellscript':
    case 'tcl':
    case 'yaml':
      return { lineComment: '#' };
    case 'elixir':
    case 'python':
      return { lineComment: '#', blockComment: ['"""', '"""'] };
    case 'nim':
      return { lineComment: '#', blockComment: ['#[', ']#'] };
    case 'powershell':
      return { lineComment: '#', blockComment: ['<#', '#>'] };
    case 'ada':
    case 'hive-sql':
    case 'pig':
    case 'plsql':
    case 'sql':
      return { lineComment: '--' };
    case 'lua':
      return { lineComment: '--', blockComment: ['--[[', ']]'] };
    case 'elm':
    case 'haskell':
      return { lineComment: '--', blockComment: ['{-', '-}'] };
    case 'vb':
    case 'asp':
    case 'diagram': // ? PlantUML is recognized as Diagram (diagram)
      return { lineComment: '\'' };
    case 'bibtex':
    case 'erlang':
    case 'latex':
    case 'matlab':
      return { lineComment: '%' };
    case 'clojure':
    case 'elps':
    case 'racket':
    case 'lisp':
      return { lineComment: ';' };
    case 'terraform':
      return { lineComment: '#', blockComment: ['/*', '*/'] };
    case 'COBOL':
      return { lineComment: '*>' };
    case 'fortran-modern':
      return { lineComment: 'c' };
    case 'SAS':
    case 'stata':
      return { lineComment: '*', blockComment: ['/*', '*/'] };
    case 'html':
    case 'xml':
    case 'markdown':
    case 'vue':
      return { blockComment: ['<!--', '-->'] };
    case 'twig':
      return { blockComment: ['{#', '#}'] };
    case 'genstat':
      return { lineComment: '\\', blockComment: ['"', '"'] };
    case 'cfml':
      return { blockComment: ['<!---', '--->'] };
    case 'shaderlab':
      return { lineComment: '//' };
    case 'razor':
      return { blockComment: ['@*', '*@'] };
    default:
      return undefined;
  }
}
