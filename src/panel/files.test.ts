import { describe, expect, it } from 'vitest';
import {
  buildExcludeGlob,
  buildIncludeGlob,
  compileExcludes,
  compileGitignoreGlobs,
  compilePathGlob,
} from './files';

describe('buildIncludeGlob', () => {
  it('scans everything without an include glob', () => {
    expect(buildIncludeGlob([])).toBe('**/*');
    expect(buildIncludeGlob(['', '  '])).toBe('**/*');
  });

  it('combines several globs into one brace pattern', () => {
    expect(buildIncludeGlob(['src/**', '*.md'])).toBe('{src/**,*.md}');
  });
});

describe('buildExcludeGlob', () => {
  it('is undefined when nothing is excluded', () => {
    expect(buildExcludeGlob([])).toBeUndefined();
  });

  it('combines the globs of the settings and of gitignore', () => {
    const exclude = ['**/.git/**', '**/node_modules/**'];

    expect(buildExcludeGlob(exclude)).toBe('{**/.git/**,**/node_modules/**}');
  });
});

describe('compileGitignoreGlobs', () => {
  it('matches a bare name anywhere and excludes its subtree', () => {
    expect(compileGitignoreGlobs('', 'node_modules\n')).toEqual([
      '**/node_modules',
      '**/node_modules/**',
    ]);
  });

  it('anchors a pattern with a separator to its folder', () => {
    expect(compileGitignoreGlobs('', '/build/output\n')).toEqual([
      'build/output',
      'build/output/**',
    ]);
  });

  it('resolves the patterns of a nested gitignore against its folder', () => {
    expect(compileGitignoreGlobs('packages/core', 'dist\n')).toEqual([
      'packages/core/**/dist',
      'packages/core/**/dist/**',
    ]);
  });

  it('ignores a leading dot path and the root folder itself', () => {
    expect(compileGitignoreGlobs('.', '*.log\n')).toEqual(['**/*.log', '**/*.log/**']);
  });

  it('skips comments, empty lines and negations', () => {
    const content = [
      '# a comment',
      '',
      '   ',
      '!keep-me',
      'drop-me',
    ].join('\n');

    expect(compileGitignoreGlobs('', content)).toEqual(['**/drop-me', '**/drop-me/**']);
  });

  it('drops a trailing slash of a directory pattern', () => {
    expect(compileGitignoreGlobs('', 'coverage/\n')).toEqual(['**/coverage', '**/coverage/**']);
  });
});

describe('compilePathGlob', () => {
  it('matches a literal path', () => {
    const exp = compilePathGlob('src/panel/view.ts');

    expect(exp?.test('src/panel/view.ts')).toBe(true);
    expect(exp?.test('src/panel/view.tsx')).toBe(false);
  });

  it('keeps a single star inside one segment', () => {
    const exp = compilePathGlob('*.md');

    expect(exp?.test('readme.md')).toBe(true);
    expect(exp?.test('docs/readme.md')).toBe(false);
  });

  it('lets a double star cross separators and match zero segments', () => {
    const exp = compilePathGlob('a/**/b');

    expect(exp?.test('a/b')).toBe(true);
    expect(exp?.test('a/x/b')).toBe(true);
    expect(exp?.test('a/x/y/b')).toBe(true);
    expect(exp?.test('x/a/b')).toBe(false);
  });

  it('matches the contents of a starred directory', () => {
    const exp = compilePathGlob('**/.git/**');

    expect(exp?.test('.git/config')).toBe(true);
    expect(exp?.test('nested/.git/HEAD')).toBe(true);
    expect(exp?.test('.gitignore')).toBe(false);
  });

  it('matches a single character with a question mark', () => {
    const exp = compilePathGlob('a?.ts');

    expect(exp?.test('ab.ts')).toBe(true);
    expect(exp?.test('abc.ts')).toBe(false);
  });
});

describe('compileExcludes', () => {
  it('matches any of the globs over workspace relative paths', () => {
    const isExcluded = compileExcludes(['**/node_modules/**', '*.log']);

    expect(isExcluded('node_modules/x/index.js')).toBe(true);
    expect(isExcluded('debug.log')).toBe(true);
    expect(isExcluded('src/panel/view.ts')).toBe(false);
  });

  it('ignores empty globs', () => {
    const isExcluded = compileExcludes(['', '   ']);

    expect(isExcluded('anything')).toBe(false);
  });
});
