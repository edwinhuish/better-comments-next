import { join as joinPath } from 'path';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { parse as parseJson5 } from 'json5';
import { log } from './logger';
import type { CommentRule, WorkspaceConfiguration } from 'vscode';

export interface Tag {
  tag: string | string[];
  color: string;
  strikethrough: boolean;
  underline: boolean;
  bold: boolean;
  italic: boolean;
  backgroundColor: string;
}

export interface TagFlatten extends Tag {
  tag: string;
}

interface Configuration {
  multilineComments: boolean;
  useJSDocStyle: boolean;
  highlightPlainText: boolean;
  tags: Tag[];
  tagsLight: Tag[];
  tagsDark: Tag[];
}

export interface ConfigurationFlatten extends Configuration {
  tags: TagFlatten[];
  tagsLight: TagFlatten[];
  tagsDark: TagFlatten[];
}

export interface LanguageConfig {
  configPath: string;
  embeddedLanguages: string[];
}

export interface AvailableCommentRules {
  lineComments: string[];
  blockComments: [string, string][];
}

// Comment rules of languages
const _commentRules = new Map<string, CommentRule>();
// Language config path and embedded languages
const _languageConfigs = new Map<string, LanguageConfig>();

/**
 * Get better comments configuration
 */
export function getConfiguration() {
  return vscode.workspace.getConfiguration('better-comments') as Configuration & WorkspaceConfiguration;
}

/**
 * Get better comments configuration in flatten
 */
export function getConfigurationFlatten() {
  const orig = getConfiguration();

  const flatten: ConfigurationFlatten = {
    multilineComments: orig.multilineComments,
    useJSDocStyle: orig.useJSDocStyle,
    highlightPlainText: orig.highlightPlainText,
    tags: flattenTags(orig.tags),
    tagsLight: flattenTags(orig.tagsLight),
    tagsDark: flattenTags(orig.tagsDark),
  };

  return flatten;
}

/**
 * Generate a map of configuration files by language as defined by extensions
 * External extensions can override default configurations os VSCode
 */
export function updateLanguagesDefinitions() {
  _languageConfigs.clear();
  _commentRules.clear();

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

      _languageConfigs.set(language.id, {
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

  const commentRule = _commentRules.get(languageCode);

  addLineComment(commentRule?.lineComment);
  addBlockComment(commentRule?.blockComment);

  const embeddedLanguages = _languageConfigs.get(languageCode)?.embeddedLanguages;

  for (const embeddedLanguageCode of (embeddedLanguages || [])) {
    const embeddedCommentRule = _commentRules.get(embeddedLanguageCode);
    addLineComment(embeddedCommentRule?.lineComment);
    addBlockComment(embeddedCommentRule?.blockComment);
  }

  const availables: AvailableCommentRules = {
    lineComments: [...lineComments],
    blockComments: [...blockComments.values()],
  };

  log(`[${languageCode}] Comment Marks: ${[availables.lineComments.join('、'), availables.blockComments.map(block => block.join(' ')).join('、')].join('、')}`);

  return availables;
}

/**
 *
 * @param tags
 * @returns
 */
function flattenTags(tags: Tag[]) {
  const flatTags: TagFlatten[] = [];
  for (const tag of tags) {
    if (!Array.isArray(tag.tag)) {
      flatTags.push(tag as TagFlatten);
      continue;
    }

    for (const tagName of tag.tag) {
      flatTags.push({
        ...tag,
        tag: tagName,
      });
    }
  }
  return flatTags;
}

async function loadCommentRules(languageCode: string) {
  if (_commentRules.has(languageCode)) {
    return;
  }

  const language = _languageConfigs.get(languageCode);

  let commentRule;

  commentRule = await loadCommentRuleFromFile(language?.configPath);
  if (!commentRule) {
    commentRule = getBaseCommentRule(languageCode);
  }

  if (commentRule) {
    _commentRules.set(languageCode, commentRule);
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
    log('[ERROR] ', error);
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
