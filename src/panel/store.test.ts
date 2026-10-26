import type { TagItem } from './model';
import { describe, expect, it } from 'vitest';
import { TagStore } from './store';

function item(uri: string, key: string = 'todo'): TagItem {
  return {
    uri,
    key,
    matched: 'TODO',
    text: 'x',
    labeled: 'TODO: x',
    line: 0,
    character: 0,
    start: 0,
    end: 4,
  };
}

describe('tag store', () => {
  it('keeps the items of a file', () => {
    const store = new TagStore();
    store.set('file:///a.ts', [item('file:///a.ts')]);

    expect(store.get('file:///a.ts')).toHaveLength(1);
    expect(store.has('file:///a.ts')).toBe(true);
    expect(store.size).toBe(1);
  });

  it('tells an unscanned file from one without tags', () => {
    const store = new TagStore();
    store.set('file:///a.ts', []);

    expect(store.has('file:///a.ts')).toBe(true);
    expect(store.get('file:///b.ts')).toBeUndefined();
    expect(store.has('file:///b.ts')).toBe(false);
  });

  it('forgets a deleted file', () => {
    const store = new TagStore();
    store.set('file:///a.ts', [item('file:///a.ts')]);

    expect(store.delete('file:///a.ts')).toBe(true);
    expect(store.delete('file:///a.ts')).toBe(false);
    expect(store.size).toBe(0);
  });

  it('forgets every file of a folder that left the workspace', () => {
    const store = new TagStore();
    store.set('file:///proj/a.ts', [item('file:///proj/a.ts')]);
    store.set('file:///proj/src/b.ts', [item('file:///proj/src/b.ts')]);
    store.set('file:///other/c.ts', [item('file:///other/c.ts')]);

    expect(store.deleteFolder('file:///proj')).toBe(2);
    expect(store.uris()).toEqual(['file:///other/c.ts']);
    expect(store.deleteFolder('file:///proj')).toBe(0); // already gone
  });

  it('keeps files of a folder whose uri only shares a prefix', () => {
    const store = new TagStore();
    store.set('file:///project-x/a.ts', [item('file:///project-x/a.ts')]);

    expect(store.deleteFolder('file:///project')).toBe(0);
    expect(store.size).toBe(1);
  });

  it('drops everything on clear', () => {
    const store = new TagStore();
    store.set('file:///a.ts', [item('file:///a.ts')]);
    store.clear();

    expect(store.size).toBe(0);
    expect(store.uris()).toEqual([]);
  });

  it('groups by file and by tag', () => {
    const store = new TagStore();
    store.set('file:///b.ts', [item('file:///b.ts', 'note')]);
    store.set('file:///a.ts', [item('file:///a.ts', 'todo'), item('file:///a.ts', 'note')]);

    expect(store.groupByFile().map(g => g.uri)).toEqual(['file:///a.ts', 'file:///b.ts']);
    expect(store.groupByTag().map(g => g.key)).toEqual(['todo', 'note']);
    expect(store.all()).toHaveLength(3);
  });

  it('reuses the grouped view until a file changes', () => {
    const store = new TagStore();
    store.set('file:///a.ts', [item('file:///a.ts')]);

    const first = store.groupByFile();
    expect(store.groupByFile()).toBe(first);

    store.set('file:///a.ts', [item('file:///a.ts'), item('file:///a.ts')]);
    expect(store.groupByFile()).not.toBe(first);
    expect(store.groupByFile()[0].items).toHaveLength(2);
  });

  it('drops a cached view when a file is deleted or the store is cleared', () => {
    const store = new TagStore();
    store.set('file:///a.ts', [item('file:///a.ts')]);
    const tags = store.groupByTag();

    store.delete('file:///a.ts');
    expect(store.groupByTag()).toEqual([]);
    expect(store.groupByTag()).not.toBe(tags);

    store.set('file:///a.ts', [item('file:///a.ts')]);
    store.clear();
    expect(store.groupByFile()).toEqual([]);
  });
});
