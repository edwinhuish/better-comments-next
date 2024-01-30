import * as vscode from 'vscode';
import type { CharacterPair } from 'vscode';
import Language from './Language';

export * from './Language';

export interface AvailableCommentRules {
  lineComments: string[];
  blockComments: CharacterPair[];
}

const languages = new Map<string, Language>();

/**
 * Init definitions if not inited
 */
export function initDefinitions() {
  if (languages.size === 0) {
    updateDefinitions();
  }
}

/**
 * Generate a map of configuration files by language as defined by extensions
 * External extensions can override default configurations os VSCode
 */
export function updateDefinitions() {
  languages.clear();

  for (const extension of vscode.extensions.all) {
    const packageJSON = extension.packageJSON;
    for (const language of (packageJSON?.contributes?.languages || [])) {
      // if no configuration continue
      if (!language.configuration) {
        continue;
      }

      // already set language
      if (languages.has(language.id)) {
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

      const lang = new Language(language.id, vscode.Uri.joinPath(extension.extensionUri, language.configuration));
      languages.set(language.id, lang);
    }
  }
}

/**
 * Gets the configuration information for the specified language
 */
export async function getAvailableCommentRules(langId: string): Promise<AvailableCommentRules> {
  initDefinitions();

  const language = languages.get(langId);
  if (!language) {
    return {
      lineComments: [],
      blockComments: [],
    };
  }

  const lineComments = new Set<string>();
  const blockComments = new Map<string, CharacterPair>();
  async function addCommentByLang(lang?: Language) {
    if (!lang) {
      return;
    }

    const comments = await lang.getComments();

    if (comments.lineComment) {
      lineComments.add(comments.lineComment);
    }

    if (comments.blockComment) {
      const key = `${comments.blockComment[0]}${comments.blockComment[1]}`;
      blockComments.set(key, comments.blockComment);
    }
  }

  await addCommentByLang(language);

  const embeddedLanguages = language.getEmbeddedLanguages();
  for (const embeddedLanguageCode of embeddedLanguages) {
    const lang = languages.get(embeddedLanguageCode);
    await addCommentByLang(lang);
  }

  return {
    lineComments: Array.from(lineComments),
    blockComments: [...blockComments.values()],
  };
}
