import * as vscode from 'vscode';
import type { WorkspaceConfiguration } from 'vscode';
import { escapeRegexString } from '../utils';

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
  tagEscaped: string;
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

/**
 * Get better comments configuration
 */
function getConfiguration() {
  return vscode.workspace.getConfiguration('better-comments') as Configuration & WorkspaceConfiguration;
}

// Cache configuration
let configFlatten: ConfigurationFlatten;
/**
 * Get better comments configuration in flatten
 */
export function getConfigurationFlatten(forceRefresh = false) {
  if (configFlatten && !forceRefresh) {
    return configFlatten;
  }
  const orig = getConfiguration();

  configFlatten = {
    multilineComments: orig.multilineComments,
    useJSDocStyle: orig.useJSDocStyle,
    highlightPlainText: orig.highlightPlainText,
    tags: flattenTags(orig.tags),
    tagsLight: flattenTags(orig.tagsLight),
    tagsDark: flattenTags(orig.tagsDark),
  };

  return configFlatten;
}

/**
 * Flatten config tags
 */
function flattenTags(tags: Tag[]) {
  const flatTags: TagFlatten[] = [];
  for (const tag of tags) {
    if (!Array.isArray(tag.tag)) {
      flatTags.push({ ...tag, tagEscaped: escapeRegexString(tag.tag) } as TagFlatten);
      continue;
    }

    for (const tagName of tag.tag) {
      flatTags.push({
        ...tag,
        tag: tagName,
        tagEscaped: escapeRegexString(tagName),
      });
    }
  }
  return flatTags;
}
