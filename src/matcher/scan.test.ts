import type { MatcherOptions } from './matcher';
import type { ScanSource } from './scan';
import { compileGlob } from '@/utils/regex';
import { describe, expect, it, vi } from 'vitest';
import { ProcessedRanges } from './matcher';
import { CommonMatcher } from './modules/common';
import { PlainTextMatcher } from './modules/plaintext';
import { PythonMatcher } from './modules/python';
import { ReactMatcher } from './modules/react';
import { ShellscriptMatcher } from './modules/shellscript';
import { scanTagRanges, sortTagRanges, useMatcher } from './scan';

function makeOptions(overrides: Partial<MatcherOptions> = {}): MatcherOptions {
  return {
    strict: true,
    fullHighlight: false,
    multilineTags: ['todo'],
    lineTags: ['!', '\\?', '\\#', 'fixme'],
    tagPatterns: [
      { key: 'todo', test: /^todo$/i },
      { key: 'fixme', test: /^fixme$/i },
      { key: 'todo[*]', test: /^todo\[.*?\]$/i },
    ],
    ...overrides,
  };
}

/** C-like languages, the common case */
function makeSource(overrides: Partial<ScanSource> = {}): ScanSource {
  return {
    languageId: 'typescript',
    text: '',
    offset: 0,
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    useDocComment: true,
    ...overrides,
  };
}

/** `key:matched` pairs, sorted by document position */
function tagsOf(source: ScanSource, options = makeOptions()): string[] {
  return sortTagRanges(scanTagRanges(source, options)).map(range => `${range.key}:${range.matched}`);
}

/** text covered by a range, useful to assert what gets highlighted */
function coveredText(source: ScanSource, options = makeOptions()): string[] {
  return sortTagRanges(scanTagRanges(source, options)).map(range => source.text.slice(range.start - source.offset, range.end - source.offset));
}

describe('scanTagRanges', () => {
  it('collects line, block and doc comments in one pass', () => {
    const source = makeSource({
      text: [
        '// TODO: first',
        'code();',
        '/* ! alert */',
        '/**',
        ' * FIXME: doc',
        ' */',
        '',
      ].join('\n'),
    });
    const tags = tagsOf(source);

    expect(tags).toEqual([
      'todo:TODO',
      '!:!',
      'fixme:FIXME',
    ]);
  });

  it('reports absolute offsets when scanning a slice of a document', () => {
    const full = 'code();\n// TODO: later\n';
    const offset = full.indexOf('// TODO');
    const source = makeSource({ text: full.slice(offset), offset });

    const [range] = sortTagRanges(scanTagRanges(source, makeOptions()));

    // decorations start right after the comment mark, and unlike the visible
    // range pass this one uses the absolute offsets of the whole document
    expect(full.slice(range.start, range.end)).toBe(' TODO: later');
    expect(range.start).toBe(offset + 2);
  });

  it('never matches the same range twice', () => {
    // the doc comment is claimed first, so the line pass must skip it
    const source = makeSource({ text: '/**\n * TODO: inside\n */\n' });

    expect(tagsOf(source)).toEqual(['todo:TODO']);
  });

  it('skips ranges already registered by the caller', () => {
    const text = '// TODO: skipped\n';
    const processed = new ProcessedRanges();
    processed.add(0, text.length);

    expect(scanTagRanges(makeSource({ text }), makeOptions(), processed)).toHaveLength(0);
  });

  it('skips doc comments when the language does not use them', () => {
    const source = makeSource({ text: '/**\n * TODO: doc\n */\n', useDocComment: false });

    expect(tagsOf(source)).toEqual([]);
  });

  it('honours python docstrings starting mid-line', () => {
    const source = makeSource({
      languageId: 'python',
      text: 'code()\n""" TODO: inline """\n',
      lineComments: ['#'],
      blockComments: [['"""', '"""']],
    });

    expect(tagsOf(source)).toEqual(['todo:TODO']);
  });

  it('drops shell command lines that only look like comments', () => {
    const source = makeSource({
      languageId: 'shellscript',
      text: '$# TODO: nope\necho hi\n# TODO: yes\n',
      lineComments: ['#'],
      blockComments: [],
    });
    const covered = coveredText(source);

    expect(covered.join('|')).toContain('TODO: yes');
    expect(covered.join('|')).not.toContain('TODO: nope');
  });

  it('picks JSX inline comments in react files', () => {
    const source = makeSource({
      languageId: 'typescriptreact',
      text: 'const a = <div>{/* TODO: jsx */}</div>;\n',
    });

    expect(tagsOf(source)).toEqual(['todo:TODO']);
  });

  it('treats the whole text as one block comment for plaintext', () => {
    const source = makeSource({
      languageId: 'plaintext',
      text: 'TODO: no comment marks here\nmore text\n',
    });

    expect(tagsOf(source)).toEqual(['todo:TODO']);
  });

  it('ignores languages without known comment tokens', () => {
    const source = makeSource({ text: 'just text // TODO: nope\n', lineComments: [], blockComments: [] });

    expect(tagsOf(source)).toEqual([]);
  });

  it('keeps the source text of dynamic tags', () => {
    const options = makeOptions({ multilineTags: [compileGlob('todo[*]')] });
    const source = makeSource({ text: '// TODO[AB-1]: tracked elsewhere\n' });

    expect(tagsOf(source, options)).toEqual(['todo[*]:TODO[AB-1]']);
  });

  it('highlights multi-line continuation lines under one tag', () => {
    const source = makeSource({ text: '// TODO: first\n//  continued\ncode();\n' });

    expect(tagsOf(source)).toEqual(['todo:TODO', 'todo:TODO']);
  });

  it('invokes the cancellation checkpoint', () => {
    const checkpoint = vi.fn();
    const options = makeOptions({ checkpoint });

    scanTagRanges(makeSource({ text: '// TODO: a\n/* ! b */\n' }), options);

    expect(checkpoint).toHaveBeenCalled();
  });

  it('stops when the checkpoint throws', () => {
    const options = makeOptions({
      checkpoint: () => {
        throw new Error('canceled');
      },
    });

    expect(() => scanTagRanges(makeSource({ text: '// TODO: a\n' }), options)).toThrow('canceled');
  });
});

describe('useMatcher', () => {
  it('builds one matcher per language', () => {
    expect(useMatcher('python')).toBeInstanceOf(PythonMatcher);
    expect(useMatcher('shellscript')).toBeInstanceOf(ShellscriptMatcher);
    expect(useMatcher('plaintext')).toBeInstanceOf(PlainTextMatcher);
    expect(useMatcher('typescript')).toBeInstanceOf(CommonMatcher);
  });

  it('maps the react dialects to their own matcher', () => {
    expect(useMatcher('javascriptreact')).toBeInstanceOf(ReactMatcher);
    expect(useMatcher('typescriptreact')).toBeInstanceOf(ReactMatcher);
  });

  it('shares one stateless instance per language', () => {
    expect(useMatcher('python')).toBe(useMatcher('python'));
    expect(useMatcher('python')).not.toBe(useMatcher('typescript'));
  });
});

describe('sortTagRanges', () => {
  it('orders ranges by position and leaves the input untouched', () => {
    const ranges = [
      { key: 'a', matched: 'a', content: '', labeled: '', start: 10, end: 20 },
      { key: 'b', matched: 'b', content: '', labeled: '', start: 0, end: 5 },
    ];

    expect(sortTagRanges(ranges).map(range => range.key)).toEqual(['b', 'a']);
    expect(ranges[0].key).toBe('a');
  });
});
