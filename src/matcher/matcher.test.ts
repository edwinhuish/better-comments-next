import type { MatcherOptions } from './matcher';
import { BR, compileGlob } from '@/utils/regex';
import { describe, expect, it, vi } from 'vitest';
import {
  matchBlockTagsInSlice,
  matchDocTagsInSlice,
  matchLineTagsInSlice,
  pickBlockSlices,
  pickDocSlices,
  pickLineSlices,
  ProcessedRanges,
  resolveTagKey,
} from './matcher';

function makeOptions(overrides: Partial<MatcherOptions> = {}): MatcherOptions {
  return {
    strict: true,
    fullHighlight: false,
    multilineTags: ['todo'],
    lineTags: ['!', '\\?', '\\#', 'fixme', 'fix\\-me'],
    tagPatterns: [
      { key: 'todo', test: /^todo$/i },
      { key: 'fixme', test: /^(?:fixme|fix-me)$/i },
      { key: 'todo[*]', test: /^todo\[.*?\]$/i },
    ],
    ...overrides,
  };
}

const LINE_COMMENTS = ['//'];
const BLOCK_COMMENTS: [string, string][] = [['/*', '*/']];

describe('pickLineSlices', () => {
  it('picks consecutive line comments as one slice', () => {
    const text = '// TODO: a\n// TODO: b\ncode();\n';
    const processed = new ProcessedRanges();

    const slices = pickLineSlices({ text, offset: 0, lineComments: LINE_COMMENTS, processed });

    // consecutive comment lines are grouped into a single slice,
    // including the trailing line break
    expect(slices).toHaveLength(1);
    expect(slices[0].comment).toBe('// TODO: a\n// TODO: b\n');
  });

  it('returns nothing for text without line comments', () => {
    const slices = pickLineSlices({ text: 'plain code\n', offset: 0, lineComments: LINE_COMMENTS, processed: new ProcessedRanges() });

    expect(slices).toHaveLength(0);
  });

  it('handles CRLF line endings', () => {
    const text = '// TODO: a\r\n// TODO: b\r\ncode();\r\n';
    const slices = pickLineSlices({ text, offset: 0, lineComments: LINE_COMMENTS, processed: new ProcessedRanges() });

    expect(slices).toHaveLength(1);
    expect(slices[0].comment).toBe('// TODO: a\r\n// TODO: b\r\n');
  });

  it('skips ranges already present in processed', () => {
    const text = '// TODO: a\n';
    const processed = new ProcessedRanges();
    processed.add(0, text.length);

    expect(pickLineSlices({ text, offset: 0, lineComments: LINE_COMMENTS, processed })).toHaveLength(0);
  });

  it('invokes the cancellation checkpoint', () => {
    const checkpoint = vi.fn();

    pickLineSlices({ text: '// TODO: a\n', offset: 0, lineComments: LINE_COMMENTS, processed: new ProcessedRanges(), checkpoint });

    expect(checkpoint).toHaveBeenCalled();
  });
});

describe('processedRanges', () => {
  it('detects containment', () => {
    const ranges = new ProcessedRanges();
    ranges.add(10, 20);

    expect(ranges.has(10, 20)).toBe(true);
    expect(ranges.has(12, 18)).toBe(true);
    expect(ranges.has(5, 15)).toBe(false);
    expect(ranges.has(10, 21)).toBe(false);
    expect(ranges.has(21, 25)).toBe(false);
  });

  it('handles out-of-order insertion', () => {
    const ranges = new ProcessedRanges();
    ranges.add(100, 200);
    ranges.add(10, 20); // inserted before
    ranges.add(30, 40);

    expect(ranges.has(10, 20)).toBe(true);
    expect(ranges.has(30, 40)).toBe(true);
    expect(ranges.has(100, 200)).toBe(true);
    expect(ranges.has(10, 40)).toBe(false);
    expect(ranges.has(25, 35)).toBe(false);
  });

  it('supports overlapping nested ranges', () => {
    const ranges = new ProcessedRanges();
    ranges.add(10, 100);
    ranges.add(20, 50); // nested inside the first

    expect(ranges.has(30, 40)).toBe(true);
    expect(ranges.has(60, 90)).toBe(true);
    expect(ranges.has(5, 15)).toBe(false);
  });

  it('handles overlapping ranges with unordered ends', () => {
    const ranges = new ProcessedRanges();
    ranges.add(10, 50);
    ranges.add(55, 80);
    ranges.add(60, 120);

    expect(ranges.has(70, 90)).toBe(true); // contained by [60, 120]
    expect(ranges.has(70, 130)).toBe(false); // no range reaches 130
    expect(ranges.has(30, 90)).toBe(false); // [10, 50] too short, others start later
  });

  it('finds containers off the binary search path', () => {
    // [10, 90] contains the query but sits below the visited nodes when the
    // binary search starts at mid=1 — guards the backwards fallback scan
    const ranges = new ProcessedRanges();
    ranges.add(10, 90);
    ranges.add(15, 20);
    ranges.add(25, 30);

    expect(ranges.has(16, 85)).toBe(true);
    expect(ranges.has(16, 95)).toBe(false);
  });
});

describe('pickBlockSlices', () => {
  it('picks a closed block comment', () => {
    const text = '/* ! alert */ code';
    const slices = pickBlockSlices({ text, offset: 0, blockComments: BLOCK_COMMENTS, processed: new ProcessedRanges() });

    expect(slices).toHaveLength(1);
    expect(slices[0].content).toBe(' ! alert ');
  });

  it('ignores unclosed block comments without looping', () => {
    const slices = pickBlockSlices({ text: '/* never closed ...', offset: 0, blockComments: BLOCK_COMMENTS, processed: new ProcessedRanges() });

    expect(slices).toHaveLength(0);
  });

  it('ignores inline block comments (common handler requires line start)', () => {
    const slices = pickBlockSlices({ text: 'code(); /* ! alert */', offset: 0, blockComments: BLOCK_COMMENTS, processed: new ProcessedRanges() });

    expect(slices).toHaveLength(0);
  });

  it('matches JSX inline comments with the react prefix pattern', () => {
    const text = 'code; {/* ! alert */}';
    const slices = pickBlockSlices({
      text,
      offset: 0,
      blockComments: BLOCK_COMMENTS,
      processed: new ProcessedRanges(),
      prefixPattern: `(?:^|${BR})\\s*|\\{\\s*`,
    });

    expect(slices).toHaveLength(1);
    expect(slices[0].content).toBe(' ! alert ');
  });

  it('matches anywhere with an empty prefix pattern (python docstrings)', () => {
    const text = 'code; """TODO: x"""';
    const slices = pickBlockSlices({
      text,
      offset: 0,
      blockComments: [['"""', '"""']],
      processed: new ProcessedRanges(),
      prefixPattern: '',
    });

    expect(slices).toHaveLength(1);
    expect(slices[0].start).toBe(6); // right at the opening quote
  });
});

describe('pickLineSlices options', () => {
  it('exposes the leading char for handler-level filtering (shell $)', () => {
    // `$` must be adjacent to the mark; consecutive `#` lines merge into one
    // slice via the \1 backreference, so separate the lines with code
    const text = '$# TODO: x\necho hi\n# TODO: y\n';
    const slices = pickLineSlices({
      text,
      offset: 0,
      lineComments: ['#'],
      processed: new ProcessedRanges(),
      prefixPattern: '.?',
    });

    // `.` cannot match the newline itself, so the line-start comment has an
    // empty leading char
    expect(slices.map(s => s.prefix)).toEqual(['$', '']);

    // the handler filters command lines itself
    const kept = slices.filter(s => s.prefix !== '$');
    expect(kept).toHaveLength(1);
    expect(kept[0].comment).toContain('# TODO: y');
  });

  it('keeps all slices without the leading char option', () => {
    const text = '$# TODO: x\necho hi\n# TODO: y\n';
    const slices = pickLineSlices({ text, offset: 0, lineComments: ['#'], processed: new ProcessedRanges() });

    expect(slices).toHaveLength(2);
  });
});

describe('pickDocSlices', () => {
  it('picks a doc comment block', () => {
    const text = '/**\n * TODO: hello\n */\ncode();';
    const slices = pickDocSlices({ text, offset: 0, processed: new ProcessedRanges() });

    expect(slices).toHaveLength(1);
    expect(slices[0].prefix).toBe('*');
  });

  it('requires whitespace after the opening mark', () => {
    const slices = pickDocSlices({ text: '/**not-a-doc*/', offset: 0, processed: new ProcessedRanges() });

    expect(slices).toHaveLength(0);
  });
});

describe('matchLineTagsInSlice', () => {
  const makeSlice = (comment: string, start = 0) => ({ start, end: start + comment.length, comment, mark: '//' });

  it('matches a strict line tag', () => {
    const ranges = matchLineTagsInSlice(makeSlice('// TODO: fix it'), makeOptions());

    // the decoration starts after the comment mark (including the gap space)
    expect(ranges).toEqual([
      { key: 'todo', start: 2, end: 15 },
    ]);
  });

  it('does not match a tag without word boundary in strict mode', () => {
    // `todolist` must not match tag `todo`
    const ranges = matchLineTagsInSlice(makeSlice('// TODOlist: items'), makeOptions());

    expect(ranges).toHaveLength(0);
  });

  it('requires the tag suffix in strict mode', () => {
    // `TODO` at end of comment without separator must not match
    expect(matchLineTagsInSlice(makeSlice('// TODO'), makeOptions())).toHaveLength(0);
    // but a trailing space is enough
    expect(matchLineTagsInSlice(makeSlice('// TODO '), makeOptions())).toHaveLength(1);
  });

  it('does not match without space after the mark in strict mode', () => {
    expect(matchLineTagsInSlice(makeSlice('//TODO: x'), makeOptions())).toHaveLength(0);
  });

  it('matches without space and suffix in non-strict mode', () => {
    const options = makeOptions({ strict: false });

    expect(matchLineTagsInSlice(makeSlice('//TODO: x'), options)).toHaveLength(1);
    expect(matchLineTagsInSlice(makeSlice('// TODOlist'), options)).toHaveLength(1);
  });

  it('supports wildcard tag patterns', () => {
    const options = makeOptions({ multilineTags: [compileGlob('todo[*]')] });
    const ranges = matchLineTagsInSlice(makeSlice('// todo[FOO-123]: ship it'), options);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].key).toBe('todo[*]');
  });

  it('highlights multi-line todo continuations with deeper indentation', () => {
    // continuation lines need more than one space of extra indentation
    const comment = '// TODO: first\n//  continued\n//  more\ncode';
    const ranges = matchLineTagsInSlice(makeSlice(comment), makeOptions());

    // first line + 2 continuation lines
    expect(ranges).toHaveLength(3);
    // continuation lines are keyed to the same tag
    expect(ranges.every(r => r.key === 'todo')).toBe(true);
  });

  it('stops multi-line continuation when indentation becomes shallower', () => {
    const comment = '// TODO: first\n// deeper\n// shallow\n';
    const ranges = matchLineTagsInSlice(makeSlice(comment), makeOptions());

    expect(ranges).toHaveLength(1);
  });

  it('starts single-line tag ranges after the mark unless fullHighlight', () => {
    const withMark = matchLineTagsInSlice(makeSlice('// ! warning'), makeOptions());
    expect(withMark[0]).toMatchObject({ start: 3 }); // after `// `

    const options = makeOptions({ fullHighlight: true });
    const full = matchLineTagsInSlice(makeSlice('// ! warning'), options);
    expect(full[0]).toMatchObject({ start: 0 }); // from the comment mark
  });

  it('supports absolute offsets via slice.start', () => {
    const base = 1000;
    const ranges = matchLineTagsInSlice(makeSlice('// TODO: x', base), makeOptions());

    expect(ranges[0].start).toBe(base + 2);
  });
});

describe('matchBlockTagsInSlice', () => {
  it('matches a single-line tag inside a block comment', () => {
    const slice = { start: 0, end: 15, comment: '/* ! alert */', content: ' ! alert ', marks: ['/*', '*/'] as [string, string] };
    const ranges = matchBlockTagsInSlice(slice, makeOptions());

    expect(ranges).toHaveLength(1);
    expect(ranges[0].key).toBe('!');
  });

  it('matches multi-line tags in subsequent lines of a block comment', () => {
    // note: block comments do not strip `*` line prefixes (that is the doc
    // comment pass); continuation lines need deeper indentation than the tag
    const content = '\n TODO: first\n   deeper indent\n ';
    const slice = {
      start: 0,
      end: 60,
      comment: `/*${content}*/`,
      content,
      marks: ['/*', '*/'] as [string, string],
    };

    const ranges = matchBlockTagsInSlice(slice, makeOptions());

    expect(ranges.filter(r => r.key === 'todo')).toHaveLength(2);
  });

  it('matches single-line tags on their own lines of a block comment', () => {
    const content = '\n ! bang\n   TODO: x\n ';
    const slice = {
      start: 0,
      end: 60,
      comment: `/*${content}*/`,
      content,
      marks: ['/*', '*/'] as [string, string],
    };

    const keys = matchBlockTagsInSlice(slice, makeOptions()).map(r => r.key);

    expect(keys).toContain('!');
    expect(keys).toContain('todo');
  });

  it('returns nothing for empty content', () => {
    const slice = { start: 0, end: 5, comment: '/**/', content: '**', marks: ['/*', '*/'] as [string, string] };

    expect(matchBlockTagsInSlice(slice, makeOptions())).toHaveLength(0);
  });
});

describe('matchDocTagsInSlice', () => {
  const makeDocSlice = (content: string, start = 0) => ({
    start,
    end: start + content.length + 5,
    comment: `/**${content}*/`,
    content,
    marks: ['/**', '*/'] as [string, string],
    prefix: '*',
  });

  it('matches a multi-line todo inside a doc comment', () => {
    const ranges = matchDocTagsInSlice(makeDocSlice('\n * TODO: hello\n * @see elsewhere\n '), makeOptions());

    expect(ranges.filter(r => r.key === 'todo')).toHaveLength(1);
  });

  it('matches a single-line tag after the doc prefix', () => {
    const ranges = matchDocTagsInSlice(makeDocSlice('\n * ! important\n '), makeOptions());

    expect(ranges.map(r => r.key)).toContain('!');
  });
});

describe('resolveTagKey', () => {
  const patterns = makeOptions().tagPatterns;

  it('resolves literal tags via the fast path', () => {
    expect(resolveTagKey('TODO', patterns)).toBe('todo');
  });

  it('resolves wildcard captures to the owning tag', () => {
    expect(resolveTagKey('todo[FOO-1]', patterns)).toBe('todo[*]');
  });

  it('falls back to the lowercased text when nothing matches', () => {
    expect(resolveTagKey('Unknown', patterns)).toBe('unknown');
  });
});
