import type { MatcherOptions, TagRange } from './matcher';
import {
  matchBlockTagsInSlice,
  matchDocTagsInSlice,
  matchLineTagsInSlice,
  pickBlockSlices,
  pickDocSlices,
  pickLineSlices,
  ProcessedRanges,
} from './matcher';

// # Types

/** Comment tokens of the scanned language (already resolved from `@/definition`) */
export interface ScanComments {
  lineComments: string[];
  blockComments: [string, string][];
  /** Whether `/** *\/` doc comments are recognised for this language */
  useDocComment: boolean;
}

/**
 * Per-language quirks of where a comment may start and which ones to skip.
 * Kept as data so both the decoration handlers and the panel scanner can share
 * exactly one slice-picking pipeline.
 */
export interface ScanProfile {
  /**
   * Pattern for the prefix group captured before a *line* comment mark; the
   * captured char is exposed as `LineCommentSlice.prefix` for filtering.
   * (eg: `.?` for shell `$` guards)
   */
  linePrefixPattern?: string;
  /**
   * Pattern for the prefix group captured before a *block* comment mark.
   * Defaults to line starts only; an empty string matches anywhere.
   * (eg: `''` for python docstrings, `\{\s*` for JSX inline comments)
   */
  blockPrefixPattern?: string;
  /** Drop line slices captured with this prefix char (eg: `$` in shellscripts) */
  skipLinePrefix?: string;
  /** Treat the whole text as one block comment (plaintext) */
  plainText?: boolean;
}

export interface ScanSource extends ScanComments, ScanProfile {
  text: string;
  /** Offset of `text` inside the full document; ranges are absolute */
  offset: number;
}

// # Scanning

/**
 * Run the full comment scan (doc comments, then block comments, then line
 * comments) over a piece of text and return every decorated tag range.
 *
 * This is the single source of truth shared by the editor decorations and the
 * panel scanner: given the same text they cannot drift apart. Pure by design —
 * no `vscode` dependency, callers resolve the comment tokens beforehand.
 *
 * The three passes share one `ProcessedRanges`, so a range already claimed by
 * an earlier pass is never matched twice (this is what the handlers did with
 * their instance-level `processed`).
 */
export function scanTagRanges(
  source: ScanSource,
  opt: MatcherOptions,
  processed: ProcessedRanges = new ProcessedRanges(),
): TagRange[] {
  const { text, offset } = source;
  const checkpoint = opt.checkpoint;
  const ranges: TagRange[] = [];

  if (source.plainText) {
    // The virtual leading newline lets the block regexes match tags at line
    // start (eg: `#` at column 0). It maps to the real newline before `text`
    // (`offset - 1`, since `offset` is a line start); at document start it sits
    // conceptually at -1, which is safe because matching always consumes it via
    // the PRE groups before any position is computed.
    ranges.push(...matchBlockTagsInSlice({
      start: offset - 1,
      end: offset + text.length,
      comment: `\n${text}`,
      content: `\n${text}`,
      marks: ['', ''],
    }, opt));

    return ranges;
  }

  if (source.useDocComment) {
    for (const slice of pickDocSlices({ text, offset, processed, checkpoint })) {
      ranges.push(...matchDocTagsInSlice(slice, opt));
    }
  }

  if (source.blockComments.length) {
    const slices = pickBlockSlices({
      text,
      offset,
      blockComments: source.blockComments,
      processed,
      checkpoint,
      prefixPattern: source.blockPrefixPattern,
    });

    for (const slice of slices) {
      ranges.push(...matchBlockTagsInSlice(slice, opt));
    }
  }

  if (source.lineComments.length) {
    let slices = pickLineSlices({
      text,
      offset,
      lineComments: source.lineComments,
      processed,
      checkpoint,
      prefixPattern: source.linePrefixPattern,
    });

    if (source.skipLinePrefix !== undefined) {
      slices = slices.filter(slice => slice.prefix !== source.skipLinePrefix);
    }

    for (const slice of slices) {
      ranges.push(...matchLineTagsInSlice(slice, opt));
    }
  }

  return ranges;
}

/** Sort ranges by their position in the document. */
export function sortTagRanges(ranges: TagRange[]): TagRange[] {
  return [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
}
