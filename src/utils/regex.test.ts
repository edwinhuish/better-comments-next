import { describe, expect, it } from 'vitest';
import { ANY, BR, compileGlob, compileRegex, escape, SP, TAG_SUFFIX } from './regex';

describe('escape', () => {
  it('escapes regex metacharacters', () => {
    // note: `-` is only special inside character classes and is left as-is
    expect(escape('a.b*c?d+e^f$g(h)i[j]k\\l/m')).toBe('a\\.b\\*c\\?d\\+e\\^f\\$g\\(h\\)i\\[j\\]k\\\\l\\/m');
  });

  it('leaves plain text untouched', () => {
    expect(escape('todo')).toBe('todo');
    expect(escape('fix-me')).toBe('fix-me');
  });

  it('is idempotent and cached', () => {
    expect(escape('todo')).toBe(escape('todo'));
  });
});

describe('compileGlob', () => {
  const match = (glob: string, input: string) => new RegExp(`^(?:${compileGlob(glob)})$`, 'i').test(input);

  it('matches any run of characters for *', () => {
    expect(match('todo[*]', 'todo[FOO-123]')).toBe(true);
    expect(match('todo[*]', 'todo[]')).toBe(true);
    expect(match('todo[*]', 'todo')).toBe(false);
  });

  it('matches exactly one character for ?', () => {
    expect(match('fix?', 'fix1')).toBe(true);
    expect(match('fix?', 'fix12')).toBe(false);
    expect(match('fix?', 'fix')).toBe(false);
  });

  it('escapes special characters literally', () => {
    expect(match('a.b+c(d)', 'a.b+c(d)')).toBe(true);
    expect(match('a.b+c(d)', 'aXbXcXd)')).toBe(false);
    // brackets are literal, not character classes
    expect(match('todo[FOO]', 'todoFOO')).toBe(false);
    expect(match('todo[FOO]', 'todo[FOO]')).toBe(true);
  });

  it('is case sensitive only when the surrounding regex makes it so', () => {
    expect(match('TODO', 'todo')).toBe(true); // test helper uses 'i' flag
  });

  it('wraps the result in a non-capturing group', () => {
    expect(compileGlob('a*')).toBe('(?:a.*?)');
  });
});

describe('compileRegex', () => {
  const match = (pattern: string, input: string) => new RegExp(`^(?:${compileRegex(pattern)})$`).test(input);

  it('passes valid patterns through', () => {
    expect(match('@\\w+', '@ticket')).toBe(true);
    expect(match('@\\w+', '@ticket foo')).toBe(false);
  });

  it('falls back to a literal match for patterns with named capture groups', () => {
    // (?<x>a) is rejected; the whole input must match literally
    expect(match('(?<x>a)', '(?<x>a)')).toBe(true);
    expect(match('(?<x>a)', 'a')).toBe(false);
  });

  it('falls back to a literal match for invalid patterns', () => {
    expect(match('(a[', '(a[')).toBe(true);
    expect(match('(a[', 'a[')).toBe(false);
  });

  it('is cached', () => {
    expect(compileRegex('@\\w+')).toBe(compileRegex('@\\w+'));
  });
});

describe('regex fragment constants', () => {
  it('have the documented shapes', () => {
    expect(SP).toBe('[ \\t]');
    expect(BR).toBe('(?:\\r?\\n)');
    expect(ANY).toBe('[\\s\\S]');
    expect(TAG_SUFFIX).toBe('[ \\t:：]');
  });
});
