import * as vscode from 'vscode';
import { parse as json5Parse } from 'json5';
import { getBaseCommentRule } from '../base';

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

    return getBaseCommentRule(this.id) || {};
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
