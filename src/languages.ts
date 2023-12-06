import { join as joinPath } from 'path';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parse as parseJson5 } from 'json5';
import * as console from './console';
import type { CharacterPair, CommentRule } from 'vscode';

export interface LanguageConfig {
  configPath: string;
  embeddedLanguages: string[];
}

export interface AvailableCommentRules {
  lineComments: string[];
  blockComments: CharacterPair[];
}

// Comment rules of languages
const commentRules = new Map<string, CommentRule>();
// Language config path and embedded languages
const languageConfigs = new Map<string, LanguageConfig>();

/**
 * Generate a map of configuration files by language as defined by extensions
 * External extensions can override default configurations os VSCode
 */
export function updateDefinitions() {
  languageConfigs.clear();
  commentRules.clear();

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

      const configPath = joinPath(extension.extensionPath, language.configuration);

      languageConfigs.set(language.id, {
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
export async function getAvailableCommentRules(languageCode: string): Promise<AvailableCommentRules> {
  await loadCommentRules(languageCode);

  const lineComments = new Set<string>();
  const blockComments = new Map<string, [string, string]>();

  const addLineComment = (line?: string) => line && lineComments.add(line);
  const addBlockComment = (block?: [string, string]) => block && blockComments.set(`${block[0]}${block[1]}`, block);

  const commentRule = commentRules.get(languageCode);

  addLineComment(commentRule?.lineComment);
  addBlockComment(commentRule?.blockComment);

  const embeddedLanguages = languageConfigs.get(languageCode)?.embeddedLanguages;

  for (const embeddedLanguageCode of (embeddedLanguages || [])) {
    const embeddedCommentRule = commentRules.get(embeddedLanguageCode);
    addLineComment(embeddedCommentRule?.lineComment);
    addBlockComment(embeddedCommentRule?.blockComment);
  }

  const availables: AvailableCommentRules = {
    lineComments: [...lineComments],
    blockComments: [...blockComments.values()],
  };

  return availables;
}

async function loadCommentRules(languageCode: string) {
  if (commentRules.has(languageCode)) {
    return;
  }

  const language = languageConfigs.get(languageCode);

  let commentRule;

  commentRule = await loadCommentRuleFromFile(language?.configPath);
  if (!commentRule) {
    commentRule = getBaseCommentRule(languageCode);
  }

  if (commentRule) {
    commentRules.set(languageCode, commentRule);
  }

  for (const embeddedLanguageCode of (language?.embeddedLanguages || [])) {
    await loadCommentRules(embeddedLanguageCode);
  }
}

async function loadCommentRuleFromFile(filepath?: string): Promise<CommentRule | undefined> {
  if (!filepath) {
    return undefined;
  }
  try {
    // Get the filepath from the map
    const rawContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filepath));

    const content = new TextDecoder().decode(rawContent);

    // use json5, because the config can contains comments
    const config = parseJson5(content);

    return config.comments;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

function getBaseCommentRule(languageCode: string): CommentRule | undefined {
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
