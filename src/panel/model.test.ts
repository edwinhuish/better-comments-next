import type { TagRange } from '@/matcher';
import type { TagItem } from './model';
import { describe, expect, it } from 'vitest';
import { buildTagItems, groupByFile, groupByTag } from './model';

function rangesOf(...ranges: Partial<TagRange>[]): TagRange[] {
  return ranges.map(range => ({
    key: 'todo',
    matched: 'TODO',
    start: 0,
    end: 4,
    ...range,
  }));
}

function item(overrides: Partial<TagItem> = {}): TagItem {
  return {
    uri: 'file:///a.ts',
    key: 'todo',
    matched: 'TODO',
    text: 'TODO: x',
    line: 0,
    character: 0,
    start: 0,
    end: 4,
    ...overrides,
  };
}

describe('buildTagItems', () => {
  it('resolves the line and character of every tag', () => {
    const text = 'const x = 1;\n// TODO: alpha\n';

    const items = buildTagItems({
      uri: 'file:///a.ts',
      text,
      ranges: rangesOf({ start: 16, end: 20 }),
    });

    expect(items).toHaveLength(1);
    expect(items[0].line).toBe(1);
    expect(items[0].character).toBe(3);
    expect(items[0].text).toBe('// TODO: alpha');
    expect(items[0].uri).toBe('file:///a.ts');
  });

  it('keeps the matched text and the tag key', () => {
    const items = buildTagItems({
      uri: 'file:///a.ts',
      text: '// todo[FOO-1]: x\n',
      ranges: rangesOf({ key: 'todo', matched: 'todo[FOO-1]', start: 3, end: 14 }),
    });

    expect(items[0].key).toBe('todo');
    expect(items[0].matched).toBe('todo[FOO-1]');
  });

  it('sorts the items by their position in the file', () => {
    const text = '// TODO: second\n// TODO: first\n';

    const items = buildTagItems({
      uri: 'file:///a.ts',
      text,
      ranges: rangesOf({ start: 16, end: 20 }, { start: 0, end: 4 }),
    });

    expect(items.map(i => i.line)).toEqual([0, 1]);
  });

  it('strips the line terminator of CRLF files from the display text', () => {
    const text = '// TODO: alpha\r\n';

    const items = buildTagItems({ uri: 'file:///a.ts', text, ranges: rangesOf({ start: 3, end: 7 }) });

    expect(items[0].text).toBe('// TODO: alpha');
  });

  it('clamps offsets that fall outside the text', () => {
    const items = buildTagItems({
      uri: 'file:///a.ts',
      text: '',
      ranges: rangesOf({ start: 999, end: 1003 }),
    });

    expect(items[0]).toMatchObject({ line: 0, character: 0, text: '' });
  });

  it('returns nothing for a file without tags', () => {
    expect(buildTagItems({ uri: 'file:///a.ts', text: 'const x = 1;\n', ranges: [] })).toEqual([]);
  });
});

describe('groupByFile', () => {
  it('groups the items of a file together', () => {
    const items = [
      item({ uri: 'file:///b.ts' }),
      item({ uri: 'file:///a.ts' }),
      item({ uri: 'file:///b.ts', line: 3 }),
    ];

    const groups = groupByFile(items);

    expect(groups.map(g => g.uri)).toEqual(['file:///a.ts', 'file:///b.ts']);
    expect(groups[1].items.map(i => i.line)).toEqual([0, 3]);
  });

  it('sorts the files, whatever order they were scanned in', () => {
    const groups = groupByFile([item({ uri: 'file:///z.ts' }), item({ uri: 'file:///a.ts' })]);

    expect(groups.map(g => g.uri)).toEqual(['file:///a.ts', 'file:///z.ts']);
  });
});

describe('groupByTag', () => {
  it('groups the items of a tag together in order of first appearance', () => {
    const items = [
      item({ key: 'todo' }),
      item({ key: 'note' }),
      item({ key: 'todo', line: 5 }),
    ];

    const groups = groupByTag(items);

    expect(groups.map(g => g.key)).toEqual(['todo', 'note']);
    expect(groups[0].items.map(i => i.line)).toEqual([0, 5]);
  });

  it('returns nothing for an empty workspace', () => {
    expect(groupByFile([])).toEqual([]);
    expect(groupByTag([])).toEqual([]);
  });
});
