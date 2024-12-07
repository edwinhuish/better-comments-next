import * as langs from './langs';

import * as extConfig from '../configuration';

import * as vscode from 'vscode';

const cached = new Map<string, langs.Language>();

function useLanguage(langId: string): langs.Language {
  let lang = cached.get(langId);

  if (!lang) {
    lang = langs.useLanguage(langId);
    cached.set(langId, lang);
  }

  return lang;
}

/**
 * Refresh the language cache
 */
export function refresh() {
  cached.clear();

  for (const extension of vscode.extensions.all) {
    const packageJSON = extension.packageJSON;
    for (const language of packageJSON?.contributes?.languages || []) {
      // if language is not defined, skip it
      if (!language || !language.id) {
        continue;
      }

      const lang = useLanguage(language.id);

      const configUri = language.configuration
        ? vscode.Uri.joinPath(extension.extensionUri, language.configuration)
        : undefined;
      lang.setConfigurationUri(configUri);

      const embeddedLanguages = lang.getEmbeddedLanguages();
      if (embeddedLanguages.size > 0) {
        // If already set embedded languages, skip it
        continue;
      }
      for (const grammar of packageJSON.contributes?.grammars || []) {
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

  const extConf = extConfig.getConfigurationFlatten();
  for (const language of extConf.languages) {
    const lang = useLanguage(language.id);

    if (language.lineComment || language.blockComment.length) {
      lang.setComments({ lineComment: language.lineComment, blockComment: language.blockComment });
    }

    if (language.embeddedLanguages) {
      for (const embeddedLanguageCode of language.embeddedLanguages) {
        lang.addEmbeddedLanguage(embeddedLanguageCode);
      }
    }
  }
}

/**
 * Gets the configuration information for the specified language
 */
export async function getAvailableComments(langId: string): Promise<langs.AvailableComments> {
  const language = useLanguage(langId);

  let availableComments = language.getAvailableComments();

  if (availableComments) {
    return availableComments;
  }

  const lineComments = new Set<string>();
  const blockComments = new Map<string, vscode.CharacterPair>();
  async function addCommentByLang(lang?: langs.Language) {
    if (!lang) {
      return;
    }

    const comments = await lang.getComments();

    if (comments?.lineComment) {
      lineComments.add(comments.lineComment);
    }

    if (comments?.blockComment) {
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
