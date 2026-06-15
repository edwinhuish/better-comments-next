const escapeCache = new Map<string, string>();
/**
 * Escapes a given string for use in a regular expression
 * @param input The input string to be escaped
 * @returns {string} The escaped string
 */
export function escape(input: string): string {
  let escaped = escapeCache.get(input);

  if (!escaped) {
    escaped = input.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); // $& means the whole matched string
    escapeCache.set(input, escaped);
  }

  return escaped;
}

const globCache = new Map<string, string>();
/**
 * Compiles a glob-style tag pattern into a regex sub-pattern.
 * `*` matches any run of characters (non-greedy), `?` matches any single
 * character; every other character is escaped literally. The result is wrapped
 * in a non-capturing group so it stays safe when joined with `|`.
 * @param input The glob pattern (eg: `todo[*]`)
 * @returns {string} The compiled regex sub-pattern
 */
export function compileGlob(input: string): string {
  let compiled = globCache.get(input);

  if (!compiled) {
    // Single pass so translated wildcards are never re-processed: `*` -> any run
    // (non-greedy), `?` -> any single char, every other metachar escaped.
    const body = input.replace(/[*?.+^${}()|[\]\\/]/g, (m) => {
      if (m === '*') {
        return '.*?';
      }
      if (m === '?') {
        return '.';
      }
      return `\\${m}`;
    });
    compiled = `(?:${body})`;
    globCache.set(input, compiled);
  }

  return compiled;
}

const regexCache = new Map<string, string>();
/**
 * Compiles a raw JavaScript regex tag pattern into a regex sub-pattern.
 * The pattern is validated; if it is invalid or uses a named capture group
 * (which would collide with the PRE/TAG/CONTENT groups), it falls back to a
 * fully-escaped literal. Valid patterns are wrapped in a non-capturing group.
 * @param input The raw regex pattern (eg: `@\\w+`)
 * @returns {string} The compiled regex sub-pattern
 */
export function compileRegex(input: string): string {
  let compiled = regexCache.get(input);

  if (!compiled) {
    let body: string;
    try {
      if (input.includes('(?<')) {
        throw new Error('named capture groups are not allowed in tag regex');
      }
      // eslint-disable-next-line no-new
      new RegExp(input); // validate
      body = input;
    }
    catch {
      body = escape(input);
    }
    compiled = `(?:${body})`;
    regexCache.set(input, compiled);
  }

  return compiled;
}

export const SP = '[ \\t]' as const;
export const BR = '(?:\\r?\\n)' as const;
export const ANY = '[\\s\\S]' as const;
export const TAG_SUFFIX = '[ \\t:：]' as const;
