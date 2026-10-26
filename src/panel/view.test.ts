import type { TagItem } from './model';
import type { TagStore } from './store';
import type { TreeNode } from './view';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { buildTagItems } from './model';
import { TagStore as Store } from './store';
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
  getTagLabel: (key: string) => key.toUpperCase(),
}));

function filledStore(): TagStore {
  const store = new Store();

  store.set('file:///Workspace/a.ts', buildTagItems({
    uri: 'file:///Workspace/a.ts',
    text: '// TODO: alpha\n// BUG: beta\n',
    ranges: [
      { key: 'todo', matched: 'TODO', content: 'alpha', labeled: 'TODO: alpha', start: 3, end: 7 },
      { key: 'bug', matched: 'BUG', content: 'beta', labeled: 'BUG: beta', start: 17, end: 20 },
    ],
  }));
  store.set('file:///Workspace/dir/b.ts', buildTagItems({
    uri: 'file:///Workspace/dir/b.ts',
    text: '/* TODO: gamma */\n',
    ranges: [{ key: 'todo', matched: 'TODO', content: 'gamma', labeled: 'TODO: gamma', start: 3, end: 7 }],
  }));

  return store;
}

/** find the node of one file, walking the directories above it */
function findFile(provider: TagsViewProvider, uri: string): { kind: 'file'; uri: string; items: TagItem[] } {
  const visit = (nodes: TreeNode[]): { kind: 'file'; uri: string; items: TagItem[] } | undefined => {
    for (const node of nodes) {
      if (node.kind === 'file' && node.uri === uri) {
        return node;
      }
      if (node.kind === 'directory') {
        const found = visit(provider.getChildren(node));
        if (found) {
          return found;
        }
      }
    }

    return undefined;
  };

  const found = visit(provider.getChildren());
  expect(found, `${uri} should be in the tree`).toBeTruthy();

  return found!;
}

describe('tags view provider', () => {
  beforeEach(() => {
    mocks.showCounts = true;
    mocks.fired = [];
  });

  it('nests files under their directories when grouping by file', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const roots = provider.getChildren();

    // directories come first, files of the workspace root after them
    expect(roots).toMatchObject([
      { kind: 'directory', dir: { name: 'dir', path: 'dir', count: 1 } },
      { kind: 'file', uri: 'file:///Workspace/a.ts' },
    ]);

    expect(provider.getChildren(roots[0])).toMatchObject([
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
    const file = findFile(provider, 'file:///Workspace/a.ts');

    expect(provider.getChildren(file).map(node => node.kind)).toEqual(['comment', 'comment']);
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
    const provider = new TagsViewProvider(filledStore(), 'file');
    const file = findFile(provider, 'file:///Workspace/a.ts');

    expect(provider.getChildren({ kind: 'comment', item: file.items[0] })).toEqual([]);
  });

  it('labels a file node with its name and a directory with its path', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const [directory, file] = provider.getChildren();

    expect(provider.getTreeItem(file).label).toBe('a.ts');
    expect(provider.getTreeItem(file).collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    expect(provider.getTreeItem(file).iconPath).toMatchObject({ id: 'file' });

    expect(provider.getTreeItem(directory).label).toBe('dir');
    expect(provider.getTreeItem(directory).tooltip).toBe('dir');
    expect(provider.getTreeItem(directory).iconPath).toMatchObject({ id: 'folder' });
  });

  it('labels a tag node with the first configured name of its group, uppercased', () => {
    const provider = new TagsViewProvider(filledStore(), 'tag');
    const [tag] = provider.getChildren();

    expect(provider.getTreeItem(tag).label).toBe('TODO');
    expect(provider.getTreeItem(tag).iconPath).toMatchObject({ id: 'tag' });
  });

  it('shows the comment count on group nodes when asked to', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const [directory, file] = provider.getChildren();

    expect(provider.getTreeItem(directory).description).toBe('1'); // the whole subtree
    expect(provider.getTreeItem(file).description).toBe('2');

    mocks.showCounts = false;
    expect(provider.getTreeItem(directory).description).toBeUndefined();
    expect(provider.getTreeItem(file).description).toBeUndefined();
  });

  it('shows where a comment lives, depending on the browsing dimension', () => {
    const store = filledStore();
    const byFile = new TagsViewProvider(store, 'file');
    const first = byFile.getChildren(findFile(byFile, 'file:///Workspace/a.ts'))[0];

    expect(byFile.getTreeItem(first).description).toBe('1');

    const byTag = new TagsViewProvider(store, 'tag');
    const [tag] = byTag.getChildren() as { items: TagItem[] }[];
    const second = byTag.getChildren(tag as never)[0];

    expect(byTag.getTreeItem(second).description).toBe('/a.ts:1');
  });

  it('labels a comment with its tag in the file view, without it in the tag view', () => {
    const store = filledStore();
    const byFile = new TagsViewProvider(store, 'file');
    const first = byFile.getChildren(findFile(byFile, 'file:///Workspace/a.ts'))[0];

    expect(byFile.getTreeItem(first).label).toBe('TODO: alpha');

    const byTag = new TagsViewProvider(store, 'tag');
    const [tag] = byTag.getChildren() as { items: TagItem[] }[];
    const second = byTag.getChildren(tag as never)[0];

    expect(byTag.getTreeItem(second).label).toBe('alpha');
  });

  it('reveals the comment when its node is clicked', () => {
    const provider = new TagsViewProvider(filledStore(), 'file');
    const first = provider.getChildren(findFile(provider, 'file:///Workspace/a.ts'))[0];

    expect(provider.getTreeItem(first).command).toMatchObject({
      command: 'better-comments-next.panelRevealComment',
      arguments: [{ key: 'todo', line: 0, text: 'alpha' }],
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
