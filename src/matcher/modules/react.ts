import { BR } from '@/utils/regex';
import { CommonMatcher } from './common';

export class ReactMatcher extends CommonMatcher {
  /**
   * JSX inline comments, written right after an opening brace, on top of the
   * comments that start a line. (The closing mark is omitted in this comment
   * so it stays a valid comment itself.)
   */
  protected override get blockPrefixPattern(): string {
    return `(?:^|${BR})\\s*|\\{\\s*`;
  }
}
