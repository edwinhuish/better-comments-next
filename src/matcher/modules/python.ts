import { CommonMatcher } from './common';

export class PythonMatcher extends CommonMatcher {
  /**
   * Docstrings may start anywhere in the line, there is no line-start prefix
   * to require.
   */
  protected override get blockPrefixPattern(): string {
    return '';
  }
}
