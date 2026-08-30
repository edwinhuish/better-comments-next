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
   * Tag match mode
   *   - text: as same as.
   *   - wildcard: Interpret the tag as a glob pattern (`*` = any run, `?` = any single char).
   *   - regex: Interpret the tag as a raw JavaScript regex.
   */
  tagMode?: 'text' | 'wildcard' | 'regex';
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

export interface ConfigurationFlatten extends Omit<Configuration, 'tagsLight' | 'tagsDark'> {
  tags: TagFlatten[];
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
  const { tags, tagsLight, tagsDark, ...orig } = getConfiguration();

  const mixTags = (origs: TagFlatten[], sources: TagFlatten[]) => {
    if (!sources.length) {
      return origs;
    }

    for (const src of sources) {
      const idx = origs.findIndex(t => t.tag === src.tag);
      if (idx === -1) {
        origs.push(src);
      }
      else {
        origs[idx] = {
          ...origs[idx],
          ...src,
        };
      }
    }
    return origs;
  };

  const tagsFlatten = isDarkTheme()
    ? mixTags(flattenTags(tags), flattenTags(tagsDark))
    : mixTags(flattenTags(tags), flattenTags(tagsLight));

  configFlatten = {
    ...orig,
    tags: tagsFlatten,
  };

  return configFlatten;
}

/**
 * Compile a tag name into a regex sub-pattern based on its match mode.
 */
function compileTagPattern(mode: 'text' | 'wildcard' | 'regex' | undefined, name: string): string {
  switch (mode) {
    case 'regex':
      return compileRegex(name);
    case 'wildcard':
      return compileGlob(name);
    default:
      return escape(name);
  }
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
        flatTags.push({ ...tag, tagEscaped: compileTagPattern(tag.tagMode, tag.tag) } as TagFlatten);
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
        tagEscaped: compileTagPattern(tag.tagMode, tagName),
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

function isDarkTheme(): boolean {
  const currentKind = vscode.window.activeColorTheme.kind;

  switch (currentKind) {
    // 浅色谱系
    case vscode.ColorThemeKind.Light:
    case (4 as vscode.ColorThemeKind): // 显式归类：高对比度浅色也是浅色
      return false;

      // 深色谱系
    case vscode.ColorThemeKind.Dark:
    case vscode.ColorThemeKind.HighContrast: // 显式归类：高对比度（旧/深）也是深色
      return true;

    default:
      return true; // 安全回退方案：如果遇到未定义类型，默认使用深色
  }
}
