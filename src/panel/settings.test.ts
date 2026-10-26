import type { ConfigurationFlatten, PanelConfiguration } from '@/configuration';
import { describe, expect, it } from 'vitest';
import { sameStrings, scanFingerprint, scanSettingsChanged, watchSettingsChanged } from './settings';

function panel(overrides: Partial<PanelConfiguration> = {}): PanelConfiguration {
  return {
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
    ...overrides,
  };
}

function flatten(overrides: Partial<ConfigurationFlatten> = {}): ConfigurationFlatten {
  return {
    highlightPlainText: false,
    updateDelay: 0,
    preloadLines: 100,
    strict: true,
    tags: [{ tag: 'todo', color: '#fff', strikethrough: false, underline: false, bold: false, italic: false, backgroundColor: 'transparent', multiline: true, tagEscaped: 'todo' }],
    languages: [],
    ...overrides,
  } as ConfigurationFlatten;
}

describe('sameStrings', () => {
  it('compares the values, not the arrays', () => {
    expect(sameStrings(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameStrings(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameStrings(['a'], ['a', 'a'])).toBe(false);
  });
});

describe('scanSettingsChanged', () => {
  it('is quiet when nothing relevant changed', () => {
    expect(scanSettingsChanged(panel(), panel())).toBe(false);
  });

  it('ignores cosmetic settings', () => {
    expect(scanSettingsChanged(
      panel({ showCounts: true, groupBy: 'file', scanOnStartup: true, autoRefresh: false }),
      panel({ showCounts: false, groupBy: 'tag', scanOnStartup: false, autoRefresh: true }),
    )).toBe(false);
  });

  it('flags the settings a scan is built from', () => {
    expect(scanSettingsChanged(panel(), panel({ useGitignore: false }))).toBe(true);
    expect(scanSettingsChanged(panel(), panel({ maxFiles: 10 }))).toBe(true);
    expect(scanSettingsChanged(panel(), panel({ maxFileSize: 8 }))).toBe(true);
    expect(scanSettingsChanged(panel(), panel({ enabled: false }))).toBe(true);
    expect(scanSettingsChanged(panel(), panel({ includeGlobs: ['src/**'] }))).toBe(true);
    expect(scanSettingsChanged(panel(), panel({ excludeGlobs: ['**/dist/**'] }))).toBe(true);
  });
});

describe('watchSettingsChanged', () => {
  it('is quiet when nothing the watcher uses changed', () => {
    expect(watchSettingsChanged(panel(), panel())).toBe(false);
    expect(watchSettingsChanged(panel(), panel({ showCounts: false, maxFiles: 10 }))).toBe(false);
  });

  it('flags the settings a watcher is built from', () => {
    expect(watchSettingsChanged(panel(), panel({ autoRefresh: false }))).toBe(true);
    expect(watchSettingsChanged(panel(), panel({ includeGlobs: ['src/**'] }))).toBe(true);
    expect(watchSettingsChanged(panel(), panel({ excludeGlobs: [] }))).toBe(true);
  });
});

describe('scanFingerprint', () => {
  it('covers everything that decides what a scan finds', () => {
    const base = flatten();

    expect(scanFingerprint(flatten())).toBe(scanFingerprint(flatten()));
    expect(scanFingerprint(base)).not.toBe(scanFingerprint(flatten({ strict: false })));
    expect(scanFingerprint(base)).not.toBe(scanFingerprint(flatten({ highlightPlainText: true })));
    expect(scanFingerprint(base)).not.toBe(scanFingerprint(flatten({
      tags: [...base.tags, { ...base.tags[0], tag: 'bug' }],
    })));
  });

  it('ignores renderer timings that cannot change a scan', () => {
    expect(scanFingerprint(flatten())).toBe(scanFingerprint(flatten({ updateDelay: 50, preloadLines: 10 })));
  });
});
