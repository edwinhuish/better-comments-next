const escapeRegexCache = new Map<string, string>();
/**
 * Escapes a given string for use in a regular expression
 * @param input The input string to be escaped
 * @returns {string} The escaped string
 */
export function escapeRegexString(input: string): string {
  let escaped = escapeRegexCache.get(input);

  if (!escaped) {
    escaped = input.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); // $& means the whole matched string
    escapeRegexCache.set(input, escaped);
  }

  return escaped;
}

export function trim(str: string, char?: string) {
  const excaped = char !== undefined ? escapeRegexString(char) : '\\s';
  return str.replace(new RegExp(`^${excaped}+|${excaped}+$`, 'g'), '');
}

export function trimLeft(str: string, char?: string) {
  const excaped = char !== undefined ? escapeRegexString(char) : '\\s';
  return str.replace(new RegExp(`^${excaped}+`, 'g'), '');
}

export function trimRight(str: string, char?: string) {
  const excaped = char !== undefined ? escapeRegexString(char) : '\\s';
  return str.replace(new RegExp(`${excaped}+$`, 'g'), '');
}
