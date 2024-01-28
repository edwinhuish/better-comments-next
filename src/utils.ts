/**
 * Escapes a given string for use in a regular expression
 * @param input The input string to be escaped
 * @returns {string} The escaped string
 */
export function escapeRegexString(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Sleep micro second
 * @param ms micro second to sleep
 */
export function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
