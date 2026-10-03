import type { PanelGroupBy } from '@/configuration';
import type { TagItem } from './model';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { buildTagItems } from './model';
import { TagStore } from './store';
import { TagsViewProvider } from './view';

const mocks = vi.hoisted(() => ({
  showCounts: true,
  fired: [] as unknown[],
}));

vi.mock('vscode', () => {
  class TreeItem {
    public command?: unknown;
    public contextValue?: string;
    public description?: string | boolean;
    public iconPath?: unknown;
    public tooltip?: string;

    constructor(
      public label: string,
      public collapsibleState: number = 0,
    ) {}
  }

  return {
    TreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class {
      constructor(public id: string) {}
    },
    EventEmitter: class {
      public event = 'tree-data-event';
      public fire(node?: unknown) {
        mocks.fired.push(node);
      }
    },
    Uri: { parse: (value: string) => ({ path: value.replace('file://', ''), toString: () => value }) },
    workspace: { asRelativePath: (uri: { path: string }) => uri.path.replace('/Workspace', '') },
  };
});

vi.mock('@/configuration', () => ({
  getPanelConfiguration: () => ({ showCounts: mocks.showCounts }),
}));

function filledStore(): TagStore {
  const store = new TagStore();

  store.set('file:///Workspace/a.ts', buildTagItems({
    uri: 'file:///Workspace/a.ts',
    text: '// TODO: alpha\n// BUG: beta\n',
    ranges: [
      { key: 'todo', matched: 'TODO', start: 3, end: 7 },
      { key: 'bug', matched: 'BUG', start: 17, end: 20 },
    ],
  }));
  store.set('file:///Workspace/dir/b.ts', buildTagItems({
    uri: 'file:///Workspace/dir/b.ts',
    text: '/* TODO: gamma */\n',
    ranges: [{ key: 'todo', matched: 'TODO', start: 3, end: 7 }],
  }));

  return store;
}

function commentNode(store: TagStore, groupBy: PanelGroupBy = 'file') {
  const provider = new TagsViewProvider(store, groupBy);
  const file = provider.getChildren()[0] as { items: TagItem[] };

  return provider.getChildren(file.items.length ? { kind: 'comment', item: file.items[0] } : file as never);
}

describe('tags view provider', () => {
  beforeEach(() => {
    mocks.showCounts = true;
    mocks.fired = [];
  });

  it('lists one node per file when grouping by file', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');

    expect(provider.getChildren()).toMatchObject([
      { kind: 'file', uri: 'file:///Workspace/a.ts' },
      { kind: 'file', uri: 'file:///Workspace/dir/b.ts' },
    ]);
  });

  it('lists one node per tag when grouping by tag', () => {
    const provider = new TagsViewProvider(filledStore(), 'tag');

    expect(provider.getChildren()).toMatchObject([
      { kind: 'tag', key: 'todo', label: 'TODO' },
      { kind: 'tag', key: 'bug', label: 'BUG' },
    ]);
  });

  it('lists the comments of a file in file order', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const [file] = provider.getChildren() as { items: TagItem[] }[];

    expect(provider.getChildren(file as never).map(node => node.kind)).toEqual(['comment', 'comment']);
  });

  it('lists every file of a tag when grouping by tag', () => {
    const provider = new TagsViewProvider(filledStore(), 'tag');
    const nodes = provider.getChildren() as { key: string; items: TagItem[] }[];
    const todo = nodes.find(node => node.key === 'todo');

    expect(provider.getChildren(todo as never).map(node => (node as { item: TagItem }).item.uri)).toEqual([
      'file:///Workspace/a.ts',
      'file:///Workspace/dir/b.ts',
    ]);
  });

  it('makes a comment node a leaf', () => {
    expect(commentNode(filledStore())).toEqual([]);
  });

  it('labels a file node with its workspace relative path', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const [file] = provider.getChildren();

    expect(provider.getTreeItem(file).label).toBe('/a.ts');
    expect(provider.getTreeItem(file).collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    expect(provider.getTreeItem(file).iconPath).toMatchObject({ id: 'file' });
  });

  it('labels a tag node with the tag as written in the source', () => {
    const provider = new TagsViewProvider(filledStore(), 'tag');
    const [tag] = provider.getChildren();

    expect(provider.getTreeItem(tag).label).toBe('TODO');
    expect(provider.getTreeItem(tag).iconPath).toMatchObject({ id: 'tag' });
  });

  it('shows the comment count on group nodes when asked to', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const nodes = provider.getChildren();

    expect(provider.getTreeItem(nodes[0]).description).toBe('2');

    mocks.showCounts = false;
    expect(provider.getTreeItem(nodes[0]).description).toBeUndefined();
  });

  it('shows where a comment lives, depending on the browsing dimension', () => {
    const store = filledStore();
    const byFile = new TagsViewProvider(store, 'file');
    const [file] = byFile.getChildren() as { items: TagItem[] }[];
    const first = byFile.getChildren(file as never)[0];

    expect(byFile.getTreeItem(first).description).toBe('1');

    const byTag = new TagsViewProvider(store, 'tag');
    const [tag] = byTag.getChildren() as { items: TagItem[] }[];
    const second = byTag.getChildren(tag as never)[0];

    expect(byTag.getTreeItem(second).description).toBe('/a.ts:1');
  });

  it('reveals the comment when its node is clicked', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const [file] = provider.getChildren() as { items: TagItem[] }[];
    const first = provider.getChildren(file as never)[0];

    expect(provider.getTreeItem(first).command).toMatchObject({
      command: 'better-comments-next.panelRevealComment',
      arguments: [{ key: 'todo', line: 0, text: '// TODO: alpha' }],
    });
  });

  it('asks the tree to rebuild when the dimension changes', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');

    provider.setGroupBy('tag');
    expect(mocks.fired).toEqual([undefined]);
    expect(provider.getChildren()[0]).toMatchObject({ kind: 'tag' });

    provider.setGroupBy('tag');
    expect(mocks.fired).toHaveLength(1); // already browsing by tag
  });

  it('reports every change to VS Code', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');

    expect(provider.onDidChangeTreeData).toBe('tree-data-event');

    provider.refresh();
    expect(mocks.fired).toEqual([undefined]);
  });
});
