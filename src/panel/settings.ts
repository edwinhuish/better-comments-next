import type { ConfigurationFlatten, PanelConfiguration } from '@/configuration';

/** whether two string lists hold the same values (settings are re-read on change) */
export function sameStrings(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Whether a settings change alters *what* a scan would find, and therefore
 * needs a rescan. Cosmetic settings (counts, the initial dimension, debounce
 * timings of the renderer) are deliberately left out.
 */
export function scanSettingsChanged(previous: PanelConfiguration, next: PanelConfiguration): boolean {
  return previous.enabled !== next.enabled
    || previous.useGitignore !== next.useGitignore
    || previous.maxFileSize !== next.maxFileSize
    || previous.maxFiles !== next.maxFiles
    || !sameStrings(previous.includeGlobs, next.includeGlobs)
    || !sameStrings(previous.excludeGlobs, next.excludeGlobs);
}

/**
 * Whether a settings change alters the files the watcher reports, and
 * therefore needs a new watcher. Everything else can stay as it is.
 */
export function watchSettingsChanged(previous: PanelConfiguration, next: PanelConfiguration): boolean {
  return previous.autoRefresh !== next.autoRefresh
    || !sameStrings(previous.includeGlobs, next.includeGlobs)
    || !sameStrings(previous.excludeGlobs, next.excludeGlobs);
}

/**
 * Fingerprint of everything outside the panel settings that decides what a
 * scan finds: the tags (with their match modes), the language comment tokens,
 * and the flags that change matching itself. Two equal fingerprints mean the
 * same text is scanned into the same items.
 */
export function scanFingerprint(config: ConfigurationFlatten): string {
  const { tags, languages, highlightPlainText, strict, fullHighlight } = config;

  return JSON.stringify({ tags, languages, highlightPlainText, strict, fullHighlight });
}
