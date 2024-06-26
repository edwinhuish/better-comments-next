import * as vscode from 'vscode';
import { parse as json5Parse } from 'json5';

export interface AvailableComments {
  lineComments: string[];
  blockComments: vscode.CharacterPair[];
}

export class Language {
  public readonly id: string;
  protected configurationUri?: vscode.Uri;
  protected configuration?: vscode.LanguageConfiguration;

  protected embeddedLanguages = new Set<string>();
  protected availableComments: AvailableComments | undefined;

  constructor(
    id: string,
    configurationUri?: vscode.Uri,
  ) {
    this.id = id;
    this.configurationUri = configurationUri;
  }

  /**
   * Set configuration uri
   */
  setConfigurationUri(configurationUri?: vscode.Uri) {
    this.configurationUri = configurationUri;
    return this;
  }

  /**
   * Check if config uri already setup
   */
  hasConfigurationUri() {
    return !!this.configurationUri;
  }

  /**
   * Get language configuration
   * @param forceRefresh force refresh configuration
   */
  async getConfiguration(forceRefresh = false) {
    if (this.configuration && !forceRefresh) {
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
      console.error(`Parse configuration file ${this.configurationUri.toString()} failed: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Get language comments rules
   * @param forceRefresh force refresh configuration
   */
  async getComments(forceRefresh = false) {
    const config = await this.getConfiguration(forceRefresh);

    if (config && config.comments) {
      return config.comments;
    }

    return getDefaultComments(this.id) || {};
  }

  /**
   * Add embedded language id
   */
  addEmbeddedLanguage(langId: string) {
    this.embeddedLanguages.add(langId);
    return this;
  }

  /**
   * Get embedded language ids
   */
  getEmbeddedLanguages() {
    return this.embeddedLanguages;
  }

  /**
   * Replace embeddedLanguages
   */
  setEmbeddedLanguages(embeddedLanguages: string[] | Set<string>) {
    this.embeddedLanguages = new Set(embeddedLanguages);
    return this;
  }

  /**
   * Get avaiable comments
   */
  getAvailableComments() {
    return this.availableComments;
  }

  /**
   * Set avaiable comments
   */
  setAvailableComments(comments: AvailableComments) {
    this.availableComments = comments;
    return this;
  }
}

function getDefaultComments(languageCode: string): vscode.CommentRule | undefined {
  switch (languageCode) {
    case 'asciidoc':
      return ({ lineComment: '//', blockComment: ['////', '////'] });
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
      return ({ lineComment: '//', blockComment: ['/*', '*/'] });
    case 'css':
      return ({ blockComment: ['/*', '*/'] });
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
      return ({ lineComment: '#' });
    case 'elixir':
    case 'python':
      return ({ lineComment: '#', blockComment: ['"""', '"""'] });
    case 'nim':
      return ({ lineComment: '#', blockComment: ['#[', ']#'] });
    case 'powershell':
      return ({ lineComment: '#', blockComment: ['<#', '#>'] });
    case 'ada':
    case 'hive-sql':
    case 'pig':
    case 'plsql':
    case 'sql':
      return ({ lineComment: '--' });
    case 'lua':
      return ({ lineComment: '--', blockComment: ['--[[', ']]'] });
    case 'elm':
    case 'haskell':
      return ({ lineComment: '--', blockComment: ['{-', '-}'] });
    case 'vb':
    case 'asp':
    case 'diagram': // ? PlantUML is recognized as Diagram (diagram)
      return ({ lineComment: '\'' });
    case 'bibtex':
    case 'erlang':
    case 'latex':
    case 'matlab':
      return ({ lineComment: '%' });
    case 'clojure':
    case 'elps':
    case 'racket':
    case 'lisp':
      return ({ lineComment: ';' });
    case 'terraform':
      return ({ lineComment: '#', blockComment: ['/*', '*/'] });
    case 'COBOL':
      return ({ lineComment: '*>' });
    case 'fortran-modern':
      return ({ lineComment: 'c' });
    case 'SAS':
    case 'stata':
      return ({ lineComment: '*', blockComment: ['/*', '*/'] });
    case 'html':
    case 'xml':
    case 'markdown':
    case 'vue':
      return ({ blockComment: ['<!--', '-->'] });
    case 'twig':
      return ({ blockComment: ['{#', '#}'] });
    case 'genstat':
      return ({ lineComment: '\\', blockComment: ['"', '"'] });
    case 'cfml':
      return ({ blockComment: ['<!---', '--->'] });
    case 'shaderlab':
      return ({ lineComment: '//' });
    case 'razor':
      return ({ blockComment: ['@*', '*@'] });
    default:
      return undefined;
  }
}
