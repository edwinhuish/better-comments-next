import * as vscode from 'vscode';
import type { CharacterPair } from 'vscode';
import Language from './Language';

export interface AvailableCommentRules {
  lineComments: string[];
  blockComments: CharacterPair[];
}

export type Languages = Map<string, Language>;

const languages: Languages = new Map<string, Language>();
function useLanguage(langId: string, autoUpdateDefinition = true) {
  if (languages.size === 0 && autoUpdateDefinition) {
    updateDefinitions();
  }

  let lang = languages.get(langId);

  if (!lang) {
    lang = new Language(langId);
    languages.set(langId, lang);
  }

  return lang;
}

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
      const lang = useLanguage(language.id, false);

      // if has configuration
      if (language.configuration) {
        lang.setConfigUri(vscode.Uri.joinPath(extension.extensionUri, language.configuration));
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

      lang.setEmbeddedLanguages(embeddedLanguages);
    }
  }
}

/**
 * Gets the configuration information for the specified language
 */
export async function getAvailableCommentRules(langId: string): Promise<AvailableCommentRules> {
  const language = useLanguage(langId);

  let availableComments = language.getAvailableComments();

  if (availableComments) {
    return availableComments;
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
    const lang = useLanguage(embeddedLanguageCode);
    await addCommentByLang(lang);
  }

  availableComments = {
    lineComments: Array.from(lineComments),
    blockComments: [...blockComments.values()],
  };

  language.setAvailableComments(availableComments);

  return availableComments;
}
