import * as vscode from 'vscode';
import { parse as parseJson5 } from 'json5';
import { getBaseCommentRule } from './base';

async function loadCommentRuleFromFile(fileUri?: vscode.Uri): Promise<vscode.CommentRule | undefined> {
  if (!fileUri) {
    return undefined;
  }
  try {
    // Read file
    const raw = await vscode.workspace.fs.readFile(fileUri);

    const content = raw.toString();

    // use json5, because the config can contains comments
    const config = parseJson5(content);

    return config.comments;
  }
  catch (error) {
    console.error(error);
    return undefined;
  }
}

export default class Language {
  public readonly langId: string;
  private configUri: vscode.Uri | undefined;
  private embeddedLanguages = new Set<string>();
  private comments: vscode.CommentRule | undefined;

  constructor(
    langId: string,
    configUri?: vscode.Uri,
  ) {
    this.langId = langId;
    this.configUri = configUri;
  }

  /**
   * Get language comments rules
   */
  async getComments() {
    if (!this.comments) {
      // load comment rule from file
      let comments = await loadCommentRuleFromFile(this.configUri);
      // get base comment rule if undefined from file
      if (!comments) {
        comments = getBaseCommentRule(this.langId);
      }
      // set comments
      this.comments = comments || {};
    }

    return this.comments;
  }

  /**
   * Get language line comment
   */
  async getLineComment() {
    return (await this.getComments()).lineComment;
  }

  /**
   * Get language block comment
   */
  async getBlockComment() {
    return (await this.getComments()).blockComment;
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
    return Array.from(this.embeddedLanguages);
  }

  /**
   * Replace embeddedLanguages
   */
  setEmbeddedLanguages(embeddedLanguages: Set<string>) {
    this.embeddedLanguages = embeddedLanguages;
    return this;
  }
}
