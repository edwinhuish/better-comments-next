import { describe, expect, it } from 'vitest';

import {
  getLineStarts,
  lineTextAt,
  offsetFromPosition,
  positionFromOffset,
} from './text';

const LF = 'alpha\nbeta\ngamma\n';
const CRLF = 'alpha\r\nbeta\r\ngamma\r\n';

describe('getLineStarts', () => {
  it('indexes LF terminated lines', () => {
    const index = getLineStarts(LF);

    expect(index.count).toBe(4);
    expect(index.starts).toEqual([0, 6, 11, 17]);
    expect(index.ends).toEqual([5, 10, 16, 17]);
    expect(index.length).toBe(LF.length);
  });

  it('indexes CRLF terminated lines keeping CR on the line', () => {
    const index = getLineStarts(CRLF);

    expect(index.count).toBe(4);
    expect(index.starts).toEqual([0, 7, 13, 20]);
  });

  it('excludes CRLF terminators from line content ends', () => {
    const index = getLineStarts(CRLF);

    expect(index.ends).toEqual([5, 11, 18, 20]);
  });

  it('treats text without trailing newline as one extra line', () => {
    const index = getLineStarts('alpha\nbeta');

    expect(index.count).toBe(2);
    expect(index.starts).toEqual([0, 6]);
    expect(index.ends).toEqual([5, 10]);
  });

  it('yields a single empty line for empty text', () => {
    const index = getLineStarts('');

    expect(index.count).toBe(1);
    expect(index.starts).toEqual([0]);
    expect(index.ends).toEqual([0]);
    expect(index.length).toBe(0);
  });

  it('counts blank lines', () => {
    const index = getLineStarts('a\n\nb\n');

    expect(index.starts).toEqual([0, 2, 3, 5]);
    expect(index.ends).toEqual([1, 2, 4, 5]);
  });
});

describe('positionFromOffset', () => {
  it('resolves offsets on LF text', () => {
    const index = getLineStarts(LF);

    expect(positionFromOffset(index, 0)).toEqual({ line: 0, character: 0 });
    expect(positionFromOffset(index, 5)).toEqual({ line: 0, character: 5 });
    expect(positionFromOffset(index, 6)).toEqual({ line: 1, character: 0 });
    expect(positionFromOffset(index, 16)).toEqual({ line: 2, character: 5 });
  });

  it('resolves offsets on CRLF text', () => {
    const index = getLineStarts(CRLF);

    expect(positionFromOffset(index, 5)).toEqual({ line: 0, character: 5 });
    expect(positionFromOffset(index, 7)).toEqual({ line: 1, character: 0 });
  });

  it('keeps the offset of a line terminator on the previous line', () => {
    const index = getLineStarts(LF);

    expect(positionFromOffset(index, 5)).toEqual({ line: 0, character: 5 }); // '\n' of line 0
  });

  it('clamps negative and out-of-range offsets', () => {
    const index = getLineStarts(LF);

    expect(positionFromOffset(index, -10)).toEqual({ line: 0, character: 0 });
    expect(positionFromOffset(index, 999)).toEqual({ line: 3, character: 0 });
    expect(positionFromOffset(index, Number.NaN)).toEqual({ line: 0, character: 0 });
  });

  it('resolves every offset of the text consistently', () => {
    const index = getLineStarts(CRLF);

    for (let offset = 0; offset <= index.length; offset++) {
      const { line, character } = positionFromOffset(index, offset);
      expect(index.starts[line] + character).toBe(offset);
    }
  });
});

describe('offsetFromPosition', () => {
  it('round-trips with positionFromOffset inside line content', () => {
    const index = getLineStarts(CRLF);

    // offsets sitting inside a terminator have no distinct position (both map to
    // the end of the line content), so only content offsets round-trip
    for (let line = 0; line < index.count; line++) {
      for (let offset = index.starts[line]; offset <= index.ends[line]; offset++) {
        expect(offsetFromPosition(index, positionFromOffset(index, offset))).toBe(offset);
      }
    }
  });

  it('clamps out-of-range lines and characters', () => {
    const index = getLineStarts(LF);

    expect(offsetFromPosition(index, { line: -3, character: 0 })).toBe(0);
    expect(offsetFromPosition(index, { line: 99, character: 0 })).toBe(index.length);
    expect(offsetFromPosition(index, { line: 0, character: 99 })).toBe(5);
    expect(offsetFromPosition(index, { line: 0, character: -1 })).toBe(0);
  });
});

describe('lineTextAt', () => {
  it('returns the line without its terminator', () => {
    expect(lineTextAt(LF, getLineStarts(LF), 0)).toBe('alpha');
    expect(lineTextAt(LF, getLineStarts(LF), 2)).toBe('gamma');
  });

  it('strips CR of CRLF text', () => {
    expect(lineTextAt(CRLF, getLineStarts(CRLF), 0)).toBe('alpha');
    expect(lineTextAt(CRLF, getLineStarts(CRLF), 1)).toBe('beta');
  });

  it('returns the trailing line without terminator', () => {
    const text = 'alpha\nbeta';
    expect(lineTextAt(text, getLineStarts(text), 1)).toBe('beta');
  });

  it('returns empty string for blank and out-of-range lines', () => {
    const index = getLineStarts('a\n\nb\n');

    expect(lineTextAt('a\n\nb\n', index, 1)).toBe('');
    expect(lineTextAt('a\n\nb\n', index, -1)).toBe('');
    expect(lineTextAt('a\n\nb\n', index, 99)).toBe('');
  });
});
