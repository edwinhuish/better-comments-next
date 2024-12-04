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

export interface TagDecorationType {
  tag: string;
  decorationType: vscode.TextEditorDecorationType;
}

export function getTagDecorationTypes() {
  const configs = getConfigurationFlatten();
  const types: TagDecorationType[] = [];
  for (const tag of configs.tags) {
    const opt = parseDecorationRenderOption(tag);

    const tagLight = configs.tagsLight.find(t => t.tag === tag.tag);
    if (tagLight) {
      opt.light = parseDecorationRenderOption(tagLight);
    }

    const tagDark = configs.tagsDark.find(t => t.tag === tag.tag);
    if (tagDark) {
      opt.dark = parseDecorationRenderOption(tagDark);
    }

    types.push({
      tag: tag.tag,
      decorationType: vscode.window.createTextEditorDecorationType(opt),
    });
  }

  return types;
}

/**
 * Parse decoration render option by tag configuration
 */
function parseDecorationRenderOption(tag: TagFlatten) {
  const options: vscode.DecorationRenderOptions = { color: tag.color, backgroundColor: tag.backgroundColor };

  const textDecorations: string[] = [];
  tag.strikethrough && textDecorations.push('line-through');
  tag.underline && textDecorations.push('underline');
  options.textDecoration = textDecorations.join(' ');

  if (tag.bold) {
    options.fontWeight = 'bold';
  }

  if (tag.italic) {
    options.fontStyle = 'italic';
  }

  return options;
}
