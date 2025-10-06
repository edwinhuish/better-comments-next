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

export const SP = '[ \\t]' as const;
export const BR = '(?:\\r?\\n)' as const;
export const SP_BR = '[ \\t\\r\\n]' as const;
export const ANY = '[\\s\\S]' as const;
export const TAG_SUFFIX = '[ \\t:：]' as const;
