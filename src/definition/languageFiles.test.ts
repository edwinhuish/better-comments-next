import { describe, expect, it } from 'vitest';
import { compileFilenameGlob, LanguageFileIndex } from './languageFiles';

function makeIndex(): LanguageFileIndex {
  const index = new LanguageFileIndex();

  index.add('typescript', { extensions: ['.ts', '.tsx'], filenamePatterns: ['**/*.d.ts'] });
  index.add('python', { extensions: ['.py'] });
  index.add('makefile', { filenames: ['Makefile', 'makefile', 'GNUmakefile'] });
  index.add('jsonc', { filenamePatterns: ['*.eslintrc*'] });
  index.add('shellscript', { extensions: ['.sh'] });

  return index;
}

describe('language file index', () => {
  it('resolves by extension', () => {
    const index = makeIndex();

    expect(index.resolve('main.ts')).toBe('typescript');
    expect(index.resolve('app.tsx')).toBe('typescript');
    expect(index.resolve('script.py')).toBe('python');
  });

  it('resolves the longest extension', () => {
    // `.d.ts` is claimed by its pattern, which must beat the `.ts` extension
    expect(makeIndex().resolve('index.d.ts')).toBe('typescript');
  });

  it('resolves by exact file name', () => {
    const index = makeIndex();

    expect(index.resolve('Makefile')).toBe('makefile');
    expect(index.resolve('GNUmakefile')).toBe('makefile');
  });

  it('prefers an exact file name over an extension', () => {
    // `Makefile.ts` is not `Makefile`, so the extension decides
    expect(makeIndex().resolve('Makefile.ts')).toBe('typescript');
  });

  it('resolves by file name pattern', () => {
    const index = makeIndex();

    expect(index.resolve('.eslintrc.json')).toBe('jsonc');
    expect(index.resolve('.eslintrc')).toBe('jsonc');
  });

  it('resolves case-insensitively', () => {
    const index = makeIndex();

    expect(index.resolve('MAKEFILE')).toBe('makefile');
    expect(index.resolve('Main.TS')).toBe('typescript');
  });

  it('keeps the first language that claims a file', () => {
    const index = new LanguageFileIndex();
    index.add('typescript', { extensions: ['.ts'] });
    index.add('other', { extensions: ['.ts'] });

    expect(index.resolve('main.ts')).toBe('typescript');
  });

  it('ignores extensions without their leading dot', () => {
    const index = new LanguageFileIndex();
    index.add('typescript', { extensions: ['ts'] });

    expect(index.resolve('main.ts')).toBeUndefined();
  });

  it('returns undefined for unknown files', () => {
    expect(makeIndex().resolve('archive.tar.gz')).toBeUndefined();
  });

  it('forgets every file on clear', () => {
    const index = makeIndex();
    index.clear();

    expect(index.resolve('main.ts')).toBeUndefined();
    expect(index.resolve('Makefile')).toBeUndefined();
  });
});

describe('compileFilenameGlob', () => {
  it('drops a leading path prefix', () => {
    expect(compileFilenameGlob('**/Makefile')?.test('makefile')).toBe(true);
    expect(compileFilenameGlob('*/Makefile')?.test('makefile')).toBe(true);
  });

  it('rejects patterns that keep a separator', () => {
    expect(compileFilenameGlob('src/**/*.ts')).toBeUndefined();
  });

  it('matches the whole file name only', () => {
    const exp = compileFilenameGlob('*.eslintrc*');

    expect(exp?.test('.eslintrc.json')).toBe(true);
    expect(exp?.test('foo.eslintrc.json.js')).toBe(true);
    expect(exp?.test('eslintrc.json')).toBe(false);
  });
});
