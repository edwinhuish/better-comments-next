import type { Tag } from './configuration';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfigurationFlatten, getLineTagsEscaped, getMultilineTagsEscaped, refresh, resolveTagKey } from './configuration';

const mocks = vi.hoisted(() => ({
  getConfiguration: vi.fn(),
  themeKind: { value: 2 as number },
}));

vi.mock('vscode', () => ({
  window: {
    get activeColorTheme() {
      return {
        get kind() {
          return mocks.themeKind.value;
        },
      };
    },
    createTextEditorDecorationType: vi.fn(),
    visibleTextEditors: [],
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
  },
  workspace: {
    getConfiguration: mocks.getConfiguration,
  },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
}));

function makeTag(partial: Partial<Tag> & { tag: Tag['tag'] }): Tag {
  return {
    color: '#000000',
    strikethrough: false,
    underline: false,
    bold: false,
    italic: false,
    backgroundColor: 'transparent',
    multiline: false,
    ...partial,
  };
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    highlightPlainText: false,
    tags: [
      makeTag({ tag: 'todo', color: '#FF8C00', multiline: true }),
      makeTag({ tag: ['fixme', 'fix-me'], color: '#FD79A8' }),
      makeTag({ tag: '' }), // empty names must be dropped
      makeTag({ tag: 'todo[*]', tagMode: 'wildcard', color: '#FF8C00', multiline: true }),
      makeTag({ tag: '@\\w+', tagMode: 'regex', color: '#3498DB' }),
    ],
    tagsLight: [],
    tagsDark: [],
    languages: [],
    updateDelay: 0,
    preloadLines: 100,
    fullHighlight: false,
    strict: true,
    ...overrides,
  };
}

beforeEach(() => {
  refresh();
  mocks.themeKind.value = 2; // Dark
});

describe('getConfigurationFlatten', () => {
  it('expands string[] tags into individual flattened tags', () => {
    mocks.getConfiguration.mockReturnValue(makeConfig());

    const tags = getConfigurationFlatten().tags;
    const names = tags.map(t => t.tag);

    expect(names).toContain('fixme');
    expect(names).toContain('fix-me');
    expect(names.filter(n => n === 'fixme')).toHaveLength(1);
  });

  it('drops tags with empty names', () => {
    mocks.getConfiguration.mockReturnValue(makeConfig());

    const tags = getConfigurationFlatten().tags;

    expect(tags.map(t => t.tag)).not.toContain('');
  });

  it('compiles tagEscaped per match mode', () => {
    mocks.getConfiguration.mockReturnValue(makeConfig());

    const tags = getConfigurationFlatten().tags;

    expect(tags.find(t => t.tag === 'fix-me')?.tagEscaped).toBe('fix-me');
    expect(tags.find(t => t.tag === 'todo[*]')?.tagEscaped).toBe('(?:todo\\[.*?\\])');
    expect(tags.find(t => t.tag === '@\\w+')?.tagEscaped).toBe('(?:@\\w+)');
  });

  it('merges tagsDark overrides on dark themes', () => {
    mocks.themeKind.value = 2; // Dark
    // user overrides only carry the fields they set, absent fields stay from base
    mocks.getConfiguration.mockReturnValue(makeConfig({
      tagsDark: [{ tag: 'todo', color: '#FFFFFF', bold: true } as Tag],
    }));

    const todo = getConfigurationFlatten().tags.find(t => t.tag === 'todo');

    expect(todo?.color).toBe('#FFFFFF');
    expect(todo?.bold).toBe(true);
    expect(todo?.multiline).toBe(true); // base fields retained
  });

  it('merges tagsLight overrides on light themes', () => {
    mocks.themeKind.value = 1; // Light
    mocks.getConfiguration.mockReturnValue(makeConfig({
      tagsLight: [{ tag: 'fixme', color: '#111111' } as Tag],
    }));

    const fixme = getConfigurationFlatten().tags.find(t => t.tag === 'fixme');

    expect(fixme?.color).toBe('#111111');
  });

  it('appends theme overrides that match no base tag instead of dropping them', () => {
    // regression test for the tags[idx] (idx === -1) silent loss bug
    mocks.themeKind.value = 2; // Dark
    mocks.getConfiguration.mockReturnValue(makeConfig({
      tagsDark: [makeTag({ tag: 'darkonly', color: '#ABCDEF' })],
    }));

    const tags = getConfigurationFlatten().tags;

    expect(tags.find(t => t.tag === 'darkonly')?.color).toBe('#ABCDEF');
  });

  it('caches the flattened config until refresh', () => {
    mocks.getConfiguration.mockReturnValue(makeConfig());

    getConfigurationFlatten();
    getConfigurationFlatten();
    expect(mocks.getConfiguration).toHaveBeenCalledTimes(1);

    refresh();
    getConfigurationFlatten();
    expect(mocks.getConfiguration).toHaveBeenCalledTimes(2);
  });

  it('passes scalar options through', () => {
    mocks.getConfiguration.mockReturnValue(makeConfig({ updateDelay: 250, preloadLines: 50, fullHighlight: true, strict: false }));

    const config = getConfigurationFlatten();

    expect(config.updateDelay).toBe(250);
    expect(config.preloadLines).toBe(50);
    expect(config.fullHighlight).toBe(true);
    expect(config.strict).toBe(false);
  });
});

describe('getMultilineTagsEscaped / getLineTagsEscaped', () => {
  it('splits tags by the multiline flag', () => {
    mocks.getConfiguration.mockReturnValue(makeConfig());

    expect(getMultilineTagsEscaped()).toContain('todo');
    expect(getMultilineTagsEscaped()).toContain('(?:todo\\[.*?\\])');
    expect(getLineTagsEscaped()).toContain('fix-me');
    expect(getLineTagsEscaped()).not.toContain('todo');
  });
});

describe('resolveTagKey', () => {
  beforeEach(() => {
    mocks.getConfiguration.mockReturnValue(makeConfig());
  });

  it('resolves literal tags case-insensitively via the fast path', () => {
    expect(resolveTagKey('TODO')).toBe('todo');
    expect(resolveTagKey('fixme')).toBe('fixme');
  });

  it('maps wildcard captures back to the owning tag', () => {
    expect(resolveTagKey('todo[FOO-123]')).toBe('todo[*]');
    expect(resolveTagKey('TODO[FOO-123]')).toBe('todo[*]');
  });

  it('maps regex captures back to the owning tag', () => {
    expect(resolveTagKey('@ticket')).toBe('@\\w+');
  });

  it('falls back to the lowercased matched text when nothing matches', () => {
    expect(resolveTagKey('NoSuchTag')).toBe('nosuchtag');
  });
});
