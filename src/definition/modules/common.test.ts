import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommonLanguage, Language } from './common';
import { useLanguage } from './index';
import { PHPLanguage } from './php';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
  },
}));

describe('language.getComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the built-in comment table when no configuration is available', async () => {
    await expect(new Language('python').getComments()).resolves.toEqual({
      lineComment: '#',
      blockComment: ['"""', '"""'],
    });

    await expect(new Language('javascript').getComments()).resolves.toEqual({
      lineComment: '//',
      blockComment: ['/*', '*/'],
    });

    await expect(new Language('css').getComments()).resolves.toEqual({
      blockComment: ['/*', '*/'],
    });

    await expect(new Language('shellscript').getComments()).resolves.toEqual({
      lineComment: '#',
    });
  });

  it('returns undefined for unknown languages without configuration', async () => {
    await expect(new Language('nosuchlang').getComments()).resolves.toBeUndefined();
  });

  it('prefers explicitly set comments over defaults', async () => {
    const lang = new Language('python');
    lang.setComments({ lineComment: '%%' });

    await expect(lang.getComments()).resolves.toEqual({ lineComment: '%%' });
  });

  it('caches the resolved comments', async () => {
    const lang = new Language('python');

    const first = await lang.getComments();
    const second = await lang.getComments();

    expect(second).toBe(first);
  });

  it('accepts valid block comments from configuration', async () => {
    const lang = new Language('mylang');
    lang.setConfigurationUri();
    vi.spyOn(lang, 'getConfiguration').mockResolvedValue({
      comments: { lineComment: '>>', blockComment: ['<#', '#>'] },
    } as never);

    await expect(lang.getComments()).resolves.toEqual({
      lineComment: '>>',
      blockComment: ['<#', '#>'],
    });
  });
});

describe('language embedded languages', () => {
  it('adds and replaces embedded languages', () => {
    const lang = new Language('vue');

    lang.addEmbeddedLanguage('css');
    expect(lang.getEmbeddedLanguages()).toEqual(new Set(['css']));

    lang.addEmbeddedLanguage('javascript');
    expect(lang.getEmbeddedLanguages()).toEqual(new Set(['css', 'javascript']));

    lang.setEmbeddedLanguages(['pug']);
    expect(lang.getEmbeddedLanguages()).toEqual(new Set(['pug']));
  });
});

describe('pHPLanguage', () => {
  it('registers `#` as an additional line comment', () => {
    const php = new PHPLanguage('php');
    const comments = { lineComments: ['//'], blockComments: [['/*', '*/'] as [string, string]] };

    const result = php.setAvailableComments(comments);

    expect(result).toBe(php);
    expect(comments.lineComments).toContain('#');
    expect(comments.lineComments).toContain('//');
  });
});

describe('useLanguage factory', () => {
  it('creates a PHPLanguage for php and CommonLanguage otherwise', () => {
    expect(useLanguage('php')).toBeInstanceOf(PHPLanguage);
    expect(useLanguage('typescript')).toBeInstanceOf(CommonLanguage);
    expect(useLanguage('typescript')).toBeInstanceOf(Language);
  });
});
