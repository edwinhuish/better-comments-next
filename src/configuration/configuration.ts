import type { WorkspaceConfiguration } from 'vscode';
import { compileGlob, compileRegex, escape } from '@/utils/regex';
import * as vscode from 'vscode';

export interface Tag {
  tag: string | string[];
  color: string;
  strikethrough: boolean;
  underline: boolean;
  bold: boolean;
  italic: boolean;
  backgroundColor: string;
  multiline: boolean;
  /**
   * Interpret the tag as a glob pattern (`*` = any run, `?` = any single char).
   */
  wildcard?: boolean;
  /**
   * Interpret the tag as a raw JavaScript regex. Takes precedence over `wildcard`.
   */
  regex?: boolean;
}

export interface TagFlatten extends Tag {
  tag: string;
  tagEscaped: string;
}

export interface Language {
  /**
   * The language id
   */
  id: string;

  /**
   * The language's comment settings.
   */
  comments: vscode.CommentRule;

  /**
   * Whether the language has doc comment
   */
  useDocComment: boolean;

  /**
   * The embedded languages ids
   */
  embeddedLanguages: string[];
}

interface Configuration {
  highlightPlainText: boolean;
  tags: Tag[];
  tagsLight: Tag[];
  tagsDark: Tag[];
  languages: Language[];
  updateDelay: number;
  preloadLines: number;
  fullHighlight: boolean; // Highlight entire line of line comment
  strict: boolean;
}

export interface ConfigurationFlatten extends Configuration {
  tags: TagFlatten[];
  tagsLight: TagFlatten[];
  tagsDark: TagFlatten[];
}

let config: (Configuration & WorkspaceConfiguration) | undefined;
let configFlatten: ConfigurationFlatten | undefined;
let tagDecorationTypes: Map<string, vscode.TextEditorDecorationType> | undefined;
let multilineTagsEscaped: string[] | undefined;
let lineTagsEscaped: string[] | undefined;
let allTagsEscaped: string[] | undefined;
let tagMatchers: { key: string; test: RegExp }[] | undefined;

export function refresh() {
  // if already set tagDecorationTypes, clear decoration for visible editors
  if (tagDecorationTypes) {
    for (const editor of vscode.window.visibleTextEditors) {
      for (const [, decorationType] of tagDecorationTypes) {
        // clear decoration
        editor.setDecorations(decorationType, []);
      }
    }
  }

  config = undefined;
  configFlatten = undefined;
  tagDecorationTypes = undefined;
  multilineTagsEscaped = undefined;
  lineTagsEscaped = undefined;
  allTagsEscaped = undefined;
  tagMatchers = undefined;
}

/**
 * Get better comments configuration
 */
function getConfiguration() {
  if (!config) {
    config = vscode.workspace.getConfiguration('better-comments') as Configuration & WorkspaceConfiguration;
  }

  return config!;
}

/**
 * Get better comments configuration in flatten
 */
export function getConfigurationFlatten() {
  if (configFlatten) {
    return configFlatten;
  }
  const orig = getConfiguration();

  configFlatten = {
    ...orig,
    tags: flattenTags(orig.tags),
    tagsLight: flattenTags(orig.tagsLight),
    tagsDark: flattenTags(orig.tagsDark),
  };

  return configFlatten;
}

/**
 * Compile a tag name into a regex sub-pattern based on its matching flags.
 * Precedence: regex > wildcard > literal.
 */
function compileTagPattern(tag: Tag, name: string): string {
  if (tag.regex) {
    return compileRegex(name);
  }
  if (tag.wildcard) {
    return compileGlob(name);
  }
  return escape(name);
}

/**
 * Flatten config tags
 */
function flattenTags(tags: Tag[]) {
  const flatTags: TagFlatten[] = [];
  for (const tag of tags) {
    if (!Array.isArray(tag.tag)) {
      // ! add tag only tag name not empty
      if (tag.tag) {
        flatTags.push({ ...tag, tagEscaped: compileTagPattern(tag, tag.tag) } as TagFlatten);
      }
      continue;
    }

    for (const tagName of tag.tag) {
      // ! add tag only tag name not empty
      if (!tagName) {
        continue;
      }
      flatTags.push({
        ...tag,
        tag: tagName,
        tagEscaped: compileTagPattern(tag, tagName),
      });
    }
  }
  return flatTags;
}

export function getTagDecorationTypes() {
  if (!tagDecorationTypes) {
    const configs = getConfigurationFlatten();

    tagDecorationTypes = new Map<string, vscode.TextEditorDecorationType>();

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

      const tagName = tag.tag.toLowerCase();
      tagDecorationTypes.set(tagName, vscode.window.createTextEditorDecorationType(opt));
    }
  }

  return tagDecorationTypes;
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

export function getMultilineTagsEscaped() {
  if (!multilineTagsEscaped) {
    multilineTagsEscaped = getConfigurationFlatten().tags.filter(t => t.multiline).map(tag => tag.tagEscaped);
  }

  return multilineTagsEscaped;
}

export function getLineTagsEscaped() {
  if (!lineTagsEscaped) {
    lineTagsEscaped = getConfigurationFlatten().tags.filter(t => !t.multiline).map(tag => tag.tagEscaped);
  }

  return lineTagsEscaped;
}

export function getAllTagsEscaped() {
  if (!allTagsEscaped) {
    allTagsEscaped = getConfigurationFlatten().tags.map(tag => tag.tagEscaped);
  }

  return allTagsEscaped;
}

function getTagMatchers() {
  if (!tagMatchers) {
    tagMatchers = getConfigurationFlatten().tags.map(tag => ({
      key: tag.tag.toLowerCase(),
      test: new RegExp(`^(?:${tag.tagEscaped})$`, 'i'),
    }));
  }

  return tagMatchers;
}

/**
 * Resolve a matched tag text back to its configured decoration key.
 *
 * Decoration types are keyed by the configured tag string, but a wildcard/regex
 * match captures arbitrary text (eg: `todo[FOO-123]` for tag `todo[*]`). This
 * maps the captured text to the owning tag's key so the right decoration is
 * applied. Matchers are tested in config order to mirror the alternation's
 * leftmost-match preference.
 */
export function resolveTagKey(matched: string): string {
  const lower = matched.toLowerCase();

  for (const { key, test } of getTagMatchers()) {
    // fast path: literal tags match their own lowercased key directly
    if (key === lower) {
      return key;
    }
    if (test.test(matched)) {
      return key;
    }
  }

  return lower;
}
