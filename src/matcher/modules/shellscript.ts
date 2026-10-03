import { CommonMatcher } from './common';

export class ShellscriptMatcher extends CommonMatcher {
  /**
   * Capture the optional char before the mark (`.?` — it must stay optional so
   * comments starting a line still match) ...
   */
  protected override get linePrefixPattern(): string {
    return '.?';
  }

  /** ... so `$#` command lines can be dropped, they are not comments. */
  protected override skipLinePrefix(prefix: string | undefined): boolean {
    return prefix === '$';
  }
}
