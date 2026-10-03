import type { MatcherOptions, TagRange } from '../matcher';
import type { ScanSource } from '../scan';
import { matchBlockTagsInSlice } from '../matcher';
import { Matcher } from './common';

/**
 * Plain text has no comment syntax: the whole text is one comment, so there is
 * nothing to pick and the language gets its own scanner instead.
 */
export class PlainTextMatcher extends Matcher {
  public scan(source: ScanSource, opt: MatcherOptions): TagRange[] {
    const { text, offset } = source;

    // The virtual leading newline lets the block regexes match tags at line
    // start (eg: `#` at column 0). It maps to the real newline before `text`
    // (`offset - 1`, since `offset` is a line start); at document start it sits
    // conceptually at -1, which is safe because matching always consumes it via
    // the PRE groups before any position is computed.
    return matchBlockTagsInSlice({
      start: offset - 1,
      end: offset + text.length,
      comment: `\n${text}`,
      content: `\n${text}`,
      marks: ['', ''],
    }, opt);
  }
}
