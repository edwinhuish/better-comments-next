import * as vscode from 'vscode';
import { PHPLanguage } from './lang/php';
import { Language } from './lang/default';
import type { AvailableComments } from './lang/default';

export type Languages = Map<string, Language>;

const languages: Languages = new Map<string, Language>();
function useLanguage(langId: string) {
  let lang = languages.get(langId);

  if (lang) {
    return lang;
  }

  switch (langId) {
    case 'php':
      lang = new PHPLanguage(langId);
      break;
    default:
      lang = new Language(langId);
  }

  languages.set(langId, lang);

  return lang;
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
      const lang = useLanguage(language.id);

      // if has configuration
      if (language.configuration) {
        lang.setConfigurationUri(vscode.Uri.joinPath(extension.extensionUri, language.configuration));
      }

      const embeddedLanguages = lang.getEmbeddedLanguages();
      if (embeddedLanguages.size > 0) {
        // If already set embedded languages, skip it
        continue;
      }
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
export async function getAvailableComments(langId: string): Promise<AvailableComments> {
  const language = useLanguage(langId);

  let availableComments = language.getAvailableComments();

  if (availableComments) {
    return availableComments;
  }

  const lineComments = new Set<string>();
  const blockComments = new Map<string, vscode.CharacterPair>();
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
