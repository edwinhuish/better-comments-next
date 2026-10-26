import type { MatcherOptions } from '@/matcher';
import type { WorkspaceConfiguration } from 'vscode';
import * as log from '@/log';
import { resolveTagKey as matchResolveTagKey } from '@/matcher';
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
  /**
   * Group every alias of one configured tag shares: the first name of the
   * `tag` array (or the tag itself), lowercased. Aliases match separately but
   * decorate and group together under it.
   */
  group: string;
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

/**
 * Browsing dimension of the panel: group comments by file, or by tag.
 * The value configured here is the *initial* dimension; switching it in the
 * panel title bar is kept per workspace outside of the settings.
 */
export type PanelGroupBy = 'file' | 'tag';

/** Validated, ready-to-use panel options (see `getPanelConfiguration`) */
export interface PanelConfiguration {
  /** Whether the panel view is contributed at all */
  enabled: boolean;
  /** Initial browsing dimension */
  groupBy: PanelGroupBy;
  /** Refresh the panel when documents change */
  autoRefresh: boolean;
  /** Scan the workspace once the panel becomes visible */
  scanOnStartup: boolean;
  /** Only scan these globs; empty means every file */
  includeGlobs: string[];
  /** Globs always excluded, taking precedence over gitignore */
  excludeGlobs: string[];
  /** Respect `.gitignore` files (including nested ones) */
  useGitignore: boolean;
  /** Skip files larger than this size, in kilobytes */
  maxFileSize: number;
  /** Stop scanning after this many files */
  maxFiles: number;
  /** Show the comment count on file and tag nodes */
  showCounts: boolean;
}

/**
 * Falls back to these values whenever a setting is missing or malformed, so a
 * broken user configuration can never break the panel (or the extension).
 */
const DEFAULT_PANEL: PanelConfiguration = {
  enabled: true,
  groupBy: 'file',
  autoRefresh: true,
  scanOnStartup: true,
  includeGlobs: [],
  excludeGlobs: ['**/.git/**'],
  useGitignore: true,
  maxFileSize: 512,
  maxFiles: 5000,
  showCounts: true,
};

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
  panelEnabled: boolean;
  panelGroupBy: PanelGroupBy;
  panelAutoRefresh: boolean;
  panelScanOnStartup: boolean;
  panelIncludeGlobs: string[];
  panelExcludeGlobs: string[];
  panelUseGitignore: boolean;
  /** in kilobytes */
  panelMaxFileSize: number;
  panelMaxFiles: number;
  panelShowCounts: boolean;
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
let panelConfig: PanelConfiguration | undefined;

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
  panelConfig = undefined;
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
 * Merge theme-specific tag overrides into the base tags.
 * Overrides matching an existing tag are merged into it; unmatched overrides
 * are appended instead of being silently dropped (findIndex may return -1).
 */
function mergeTagOverrides(tags: TagFlatten[], overrides: TagFlatten[]) {
  for (const tag of overrides) {
    const idx = tags.findIndex(t => t.tag === tag.tag);
    if (idx === -1) {
      tags.push(tag);
      continue;
    }
    tags[idx] = {
      ...tags[idx],
      ...tag,
      // an override restyles a tag, it never re-groups it
      group: tags[idx].group,
    };
  }
}

/**
 * Get better comments configuration in flatten
 */
export function getConfigurationFlatten() {
  if (configFlatten) {
    return configFlatten;
  }
  const { tagsLight, tagsDark, ...orig } = getConfiguration();

  const tags = flattenTags(orig.tags);

  if (isDarkTheme()) {
    const tdarks = flattenTags(tagsDark);
    if (tdarks.length > 0) {
      mergeTagOverrides(tags, tdarks);
    }
  }
  else {
    const tlights = flattenTags(tagsLight);
    if (tlights.length > 0) {
      mergeTagOverrides(tags, tlights);
    }
  }

  configFlatten = {
    ...orig,
    tags,
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
        flatTags.push({
          ...tag,
          group: tag.tag.toLowerCase(),
          tagEscaped: compileTagPattern(tag.tagMode, tag.tag),
        } as TagFlatten);
      }
      continue;
    }

    // every alias of one configured tag shares the group of the first name,
    // so they decorate and group together under it
    const group = tag.tag.find(name => !!name)?.toLowerCase() || '';
    for (const tagName of tag.tag) {
      // ! add tag only tag name not empty
      if (!tagName) {
        continue;
      }
      flatTags.push({
        ...tag,
        tag: tagName,
        group,
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
      // aliases of one configured tag share one decoration type
      if (tagDecorationTypes.has(tag.group)) {
        continue;
      }

      const opt = parseDecorationRenderOption(tag);
      tagDecorationTypes.set(tag.group, vscode.window.createTextEditorDecorationType(opt));
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

export function getTagMatchers() {
  if (!tagMatchers) {
    tagMatchers = getConfigurationFlatten().tags.map(tag => ({
      // aliases resolve to the group of their configured tag, not to themselves
      key: tag.group,
      test: new RegExp(`^(?:${tag.tagEscaped})$`, 'i'),
    }));
  }

  return tagMatchers;
}

/**
 * Display name of a tag group: the first name of the configured tag,
 * uppercased (eg: `TODO` for a `["todo", "to-do"]` tag). Falls back to the
 * uppercased key for matches the configuration does not know.
 */
export function getTagLabel(key: string): string {
  const name = getConfigurationFlatten().tags.find(tag => tag.group === key)?.tag || key;

  return name.toUpperCase();
}

/**
 * Resolve a matched tag text back to its configured decoration key.
 * Delegates to the pure implementation in `@/matcher`.
 */
export function resolveTagKey(matched: string): string {
  return matchResolveTagKey(matched, getTagMatchers());
}

/**
 * Build the pure matcher options of the current configuration.
 *
 * Shared by every caller of `@/matcher`, so decorations and the panel scan
 * with exactly the same tags. `checkpoint` lets a caller abort a running scan
 * (the renderer passes its task check, the panel its cancellation token).
 */
export function getMatcherOptions(checkpoint?: () => void): MatcherOptions {
  const { strict, fullHighlight } = getConfigurationFlatten();

  return {
    strict,
    fullHighlight,
    multilineTags: getMultilineTagsEscaped(),
    lineTags: getLineTagsEscaped(),
    tagPatterns: getTagMatchers(),
    checkpoint,
  };
}

/**
 * Whether tags are looked for in a language: plain text has no comment syntax
 * of its own, so highlighting it is a setting.
 */
export function isLanguageEnabled(languageId: string): boolean {
  return languageId !== 'plaintext' || getConfigurationFlatten().highlightPlainText;
}

// # Panel configuration

/**
 * Read a boolean setting, degrading to `fallback` instead of trusting whatever
 * the user put in `settings.json`.
 */
function readBoolean(value: unknown, fallback: boolean, key: string): boolean {
  if (typeof value !== 'boolean') {
    if (value !== undefined) {
      log.warn(`(better-comments.${key}) expects a boolean, got ${typeof value}, falling back to ${fallback}`);
    }
    return fallback;
  }

  return value;
}

/** Read a positive number setting, clamped into `[min, max]`. */
function readCount(value: unknown, fallback: number, key: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    if (value !== undefined) {
      log.warn(`(better-comments.${key}) expects a number, got ${typeof value}, falling back to ${fallback}`);
    }
    return fallback;
  }

  const clamped = Math.min(Math.max(Math.trunc(value), min), max);
  if (clamped !== value) {
    log.warn(`(better-comments.${key}) clamped ${value} to ${clamped}`);
  }

  return clamped;
}

/**
 * Read a glob list, dropping every entry that is not a non-empty string.
 * Missing or malformed lists fall back to the default list.
 */
function readGlobs(value: unknown, key: string, fallback: string[]): string[] {
  if (value === undefined) {
    return [...fallback];
  }

  if (!Array.isArray(value)) {
    log.warn(`(better-comments.${key}) expects an array of globs, got ${typeof value}, falling back to the default`);
    return [...fallback];
  }

  return value.filter((glob): glob is string => {
    if (typeof glob === 'string' && glob.trim()) {
      return true;
    }
    log.warn(`(better-comments.${key}) dropped an invalid glob entry`);
    return false;
  });
}

/**
 * Panel options with every field validated and clamped, so the rest of the
 * extension can read them without defensive checks of its own.
 */
export function getPanelConfiguration(): PanelConfiguration {
  if (panelConfig) {
    return panelConfig;
  }

  const config = getConfigurationFlatten();

  panelConfig = {
    enabled: readBoolean(config.panelEnabled, DEFAULT_PANEL.enabled, 'panelEnabled'),
    groupBy: config.panelGroupBy === 'tag' ? 'tag' : DEFAULT_PANEL.groupBy,
    autoRefresh: readBoolean(config.panelAutoRefresh, DEFAULT_PANEL.autoRefresh, 'panelAutoRefresh'),
    scanOnStartup: readBoolean(config.panelScanOnStartup, DEFAULT_PANEL.scanOnStartup, 'panelScanOnStartup'),
    // an empty include list means "every file"
    includeGlobs: readGlobs(config.panelIncludeGlobs, 'panelIncludeGlobs', DEFAULT_PANEL.includeGlobs),
    excludeGlobs: readGlobs(config.panelExcludeGlobs, 'panelExcludeGlobs', DEFAULT_PANEL.excludeGlobs),
    useGitignore: readBoolean(config.panelUseGitignore, DEFAULT_PANEL.useGitignore, 'panelUseGitignore'),
    maxFileSize: readCount(config.panelMaxFileSize, DEFAULT_PANEL.maxFileSize, 'panelMaxFileSize', 1, 102_400),
    maxFiles: readCount(config.panelMaxFiles, DEFAULT_PANEL.maxFiles, 'panelMaxFiles', 1, 100_000),
    showCounts: readBoolean(config.panelShowCounts, DEFAULT_PANEL.showCounts, 'panelShowCounts'),
  };

  return panelConfig;
}

function isDarkTheme(): boolean {
  const currentKind = vscode.window.activeColorTheme.kind;

  switch (currentKind) {
    // 浅色谱系
    case vscode.ColorThemeKind.Light:
    case vscode.ColorThemeKind.HighContrastLight:
      return false;

    // 深色谱系
    case vscode.ColorThemeKind.Dark:
    case vscode.ColorThemeKind.HighContrast:
      return true;

    default:
      return true; // 安全回退方案：如果遇到未定义类型，默认使用深色
  }
}
