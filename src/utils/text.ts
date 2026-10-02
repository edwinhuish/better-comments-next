/**
 * Line index helpers for raw text.
 *
 * Decorations are computed on a `TextDocument` (which offers `positionAt`),
 * but scanning workspace files works on strings read with
 * `vscode.workspace.fs.readFile` — opening every file as a document just to
 * convert offsets would be far too expensive. These helpers build a reusable
 * line index for a string and convert between absolute offsets and
 * line/character pairs, matching VS Code's own line semantics:
 * a line ends right before its `\n`, so `\r\n` keeps the `\r` on the line.
 */

export interface LineStarts {
  /** Number of lines in the text */
  count: number;
  /** Offset of the first character of every line, ascending; always `[0, ...]` */
  starts: number[];
  /** Offset right after the last character of every line content (terminator excluded) */
  ends: number[];
  /** Length of the text these starts were built from */
  length: number;
}

export interface TextPosition {
  /** Zero-based line index */
  line: number;
  /** Zero-based character index inside the line */
  character: number;
}

/**
 * Build the index of line starts and content ends for `text`.
 * Cost is O(n) over the text and O(lines) memory; empty text yields a single
 * empty line, same as VS Code documents.
 */
export function getLineStarts(text: string): LineStarts {
  const starts: number[] = [0];
  const ends: number[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\n') {
      continue;
    }

    let end = i;
    if (text[end - 1] === '\r') {
      end--;
    }
    ends.push(end);
    starts.push(i + 1);
  }

  // last line may be unterminated, or the text may be empty
  ends.push(text.length);

  return {
    count: starts.length,
    starts,
    ends,
    length: text.length,
  };
}

/**
 * Resolve an absolute offset into a line/character pair.
 * Out-of-range offsets are clamped into `[0, length]` instead of throwing, so
 * a slightly off boundary can never break a scan of an untrusted file.
 */
export function positionFromOffset(lineStarts: LineStarts, offset: number): TextPosition {
  if (!Number.isFinite(offset) || offset <= 0) {
    return { line: 0, character: 0 };
  }

  const target = Math.min(offset, lineStarts.length);
  const { starts } = lineStarts;

  // binary search the last line whose start is <= target
  let lo = 0;
  let hi = lineStarts.count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= target) {
      lo = mid;
    }
    else {
      hi = mid - 1;
    }
  }

  return { line: lo, character: target - starts[lo] };
}

/**
 * Convert a line/character pair back into an absolute offset.
 * Out-of-range positions are clamped to the closest valid position inside the
 * line content (a character can never point past the line terminator).
 */
export function offsetFromPosition(lineStarts: LineStarts, position: TextPosition): number {
  const line = Math.min(Math.max(Math.trunc(position.line) || 0, 0), lineStarts.count - 1);
  const maxCharacter = lineStarts.ends[line] - lineStarts.starts[line];
  const character = Math.min(Math.max(Math.trunc(position.character) || 0, 0), maxCharacter);

  return lineStarts.starts[line] + character;
}

/**
 * Read one line out of `text` with its line terminator stripped (`\n`, `\r\n`).
 * Returns an empty string for out-of-range lines.
 */
export function lineTextAt(text: string, lineStarts: LineStarts, line: number): string {
  if (!Number.isInteger(line) || line < 0 || line >= lineStarts.count) {
    return '';
  }

  const start = lineStarts.starts[line];
  const end = lineStarts.ends[line];

  return start > end ? '' : text.slice(start, end);
}
