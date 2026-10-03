import { describe, expect, it } from 'vitest';
import { buildExcludeGlob, buildIncludeGlob, compileGitignoreGlobs } from './files';

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
