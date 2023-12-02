import * as path from 'path';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';

import * as json5 from 'json5';
import { log } from './logger';

export interface LanguageConfig {
  configPath: string;
  embeddedLanguages: string[];
}

export interface CommentConfiguration {
  lineComments: string[];
  blockComments: [string, string][];
}
export class Configuration {
  private readonly commentConfigs = new Map<string, CommentConfig | undefined>();
  private readonly languageConfigs = new Map<string, LanguageConfig>();

  /**
   * Creates a new instance of the Parser class
   */
  public constructor() {
    this.UpdateLanguagesDefinitions();
  }

  /**
   * Generate a map of configuration files by language as defined by extensions
   * External extensions can override default configurations os VSCode
   */
  public UpdateLanguagesDefinitions() {
    this.languageConfigs.clear();
    this.commentConfigs.clear();

    for (const extension of vscode.extensions.all) {
      const packageJSON = extension.packageJSON;

      for (const language of (packageJSON?.contributes?.languages || [])) {
        if (!language.configuration) {
          continue;
        }

        const embeddedLanguages = new Set<string>();
        for (const grammar of (packageJSON.contributes?.grammars || [])) {
          if (grammar.language !== language.id || !grammar.embeddedLanguages) {
            continue;
          }
          for (const embeddedLanguageCode of Object.values(grammar.embeddedLanguages)) {
            embeddedLanguages.add(embeddedLanguageCode as string);
          }
        }

        const configPath = path.join(extension.extensionPath, language.configuration);

        this.languageConfigs.set(language.id, {
          configPath,
          embeddedLanguages: [...embeddedLanguages],
        });
      }
    }
  }

  /**
   * Gets the configuration information for the specified language
   * @param languageCode
   * @returns
   */
  public async GetCommentConfiguration(languageCode: string): Promise<CommentConfiguration> {
    await this.loadLanguageConfigs(languageCode);

    const lineComments = new Set<string>();
    const blockComments = new Map<string, [string, string]>();

    const addLineComment = (line?: string) => line && lineComments.add(line);
    const addBlockComment = (block?: [string, string]) => block && blockComments.set(`${block[0]}${block[1]}`, block);

    const commentConfig = this.commentConfigs.get(languageCode);

    addLineComment(commentConfig?.lineComment);
    addBlockComment(commentConfig?.blockComment);

    const embeddedLanguages = this.languageConfigs.get(languageCode)?.embeddedLanguages;

    if (embeddedLanguages) {
      for (const embeddedLanguageCode of embeddedLanguages) {
        const embeddedLanguageConfig = this.commentConfigs.get(embeddedLanguageCode);
        addLineComment(embeddedLanguageConfig?.lineComment);
        addBlockComment(embeddedLanguageConfig?.blockComment);
      }
    }

    const commentConfiguration: CommentConfiguration = {
      lineComments: [...lineComments],
      blockComments: [...blockComments.values()],
    };

    log(`[${languageCode}] Comment Marks: ${[commentConfiguration.lineComments.join('、'), commentConfiguration.blockComments.map(block => block.join(' ')).join('、')].join('、')}`);

    return commentConfiguration;
  }

  private async loadLanguageConfigs(languageCode: string) {
    if (this.commentConfigs.has(languageCode)) {
      return;
    }

    const language = this.languageConfigs.get(languageCode);

    let commentConfig;

    commentConfig = await this.loadLanguageConfigFromFile(language?.configPath);
    if (!commentConfig) {
      commentConfig = this.getBaseCommentConfigs(languageCode);
    }

    this.commentConfigs.set(languageCode, commentConfig);

    for (const embeddedLanguageCode of (language?.embeddedLanguages || [])) {
      await this.loadLanguageConfigs(embeddedLanguageCode);
    }
  }

  private async loadLanguageConfigFromFile(filepath?: string): Promise<CommentConfig | undefined> {
    if (!filepath) {
      return;
    }
    try {
      // Get the filepath from the map
      const rawContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filepath));

      const content = new TextDecoder().decode(rawContent);

      // use json5, because the config can contains comments
      const config = json5.parse(content);

      return config.comments;
    } catch (error) {
      log('[ERROR] ', error);
      return undefined;
    }
  }

  private getBaseCommentConfigs(languageCode: string): CommentConfig | undefined {
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
      case 'scss':
      case 'stylus':
      case 'swift':
      case 'verilog':
        return ({ lineComment: '//', blockComment: ['/*', '*/'] });
      case 'vue':
        return ({ blockComment: ['<!--', '-->'] });
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
      case 'markdown':
        return ({ blockComment: ['<!--', '-->'] });
      case 'twig':
        return ({ blockComment: ['{#', '#}'] });
      case 'genstat':
        return ({ lineComment: '\\', blockComment: ['"', '"'] });
      case 'cfml':
        return ({ blockComment: ['<!---', '--->'] });
      default:
        return undefined;
    }
  }
}
