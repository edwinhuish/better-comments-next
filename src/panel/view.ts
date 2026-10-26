import type { PanelGroupBy } from '@/configuration';
import type { TagItem } from './model';
import type { TagStore } from './store';
import * as configuration from '@/configuration';
import * as vscode from 'vscode';

/** id of the contributed tree view */
export const VIEW_ID = 'better-comments-next.panel';

/** command run when a comment node is clicked */
export const COMMAND_REVEAL = 'better-comments-next.panelRevealComment';

// # Nodes

/** A file with every tag found in it */
export interface FileGroupNode {
  kind: 'file';
  uri: string;
  items: TagItem[];
}

/** One tag with every comment written with it */
export interface TagGroupNode {
  kind: 'tag';
  key: string;
  label: string;
  items: TagItem[];
}

/** One comment in one file; the only leaf of the tree */
export interface CommentNode {
  kind: 'comment';
  item: TagItem;
}

export type TreeNode = FileGroupNode | TagGroupNode | CommentNode;

/**
 * Tree data provider of the panel.
 *
 * It knows nothing about scanning: the store already holds the result, the
 * provider only reshapes it into the dimension the user is browsing.
 */
export class TagsViewProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly changes = new vscode.EventEmitter<TreeNode | undefined>();

  public readonly onDidChangeTreeData = this.changes.event;

  private groupBy: PanelGroupBy;

  constructor(private readonly store: TagStore, groupBy: PanelGroupBy) {
    this.groupBy = groupBy;
  }

  /** Switch the browsing dimension and rebuild the tree. */
  public setGroupBy(groupBy: PanelGroupBy): void {
    if (this.groupBy === groupBy) {
      return;
    }

    this.groupBy = groupBy;
    this.refresh();
  }

  /** Notify VS Code that the tree (or one of its nodes) changed. */
  public refresh(node?: TreeNode): void {
    this.changes.fire(node);
  }

  public getChildren(node?: TreeNode): TreeNode[] {
    if (!node) {
      return this.groupBy === 'file'
        ? this.store.groupByFile().map(group => ({ kind: 'file', uri: group.uri, items: group.items }))
        : this.store.groupByTag().map(group => ({
          kind: 'tag',
          key: group.key,
          label: groupLabel(group.key, group.items),
          items: group.items,
        }));
    }

    if (node.kind === 'comment') {
      return [];
    }

    return node.items.map(item => ({ kind: 'comment', item }));
  }

  public getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === 'comment') {
      return this.commentItem(node.item);
    }

    const label = node.kind === 'file' ? pathLabel(node.uri) : node.label;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.tooltip = label;
    item.contextValue = node.kind;
    item.iconPath = new vscode.ThemeIcon(node.kind === 'file' ? 'file' : 'tag');

    if (configuration.getPanelConfiguration().showCounts) {
      item.description = String(node.items.length);
    }

    return item;
  }

  private commentItem(tagItem: TagItem): vscode.TreeItem {
    // the file view needs the tag in front (it names the comment), the tag
    // view already groups by it and shows the comment alone
    const label = this.groupBy === 'file' ? tagItem.labeled : tagItem.text;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.tooltip = label;
    item.contextValue = 'comment';
    item.description = this.groupBy === 'file'
      ? String(tagItem.line + 1) // the file is already known from the parent
      : `${pathLabel(tagItem.uri)}:${tagItem.line + 1}`;
    item.command = {
      command: COMMAND_REVEAL,
      title: 'Go to Comment',
      arguments: [tagItem],
    };

    return item;
  }
}

/** A tag group is labelled with the tag itself, as it is written in the source. */
function groupLabel(key: string, items: TagItem[]): string {
  return items[0]?.matched || key;
}

function pathLabel(uri: string): string {
  return vscode.workspace.asRelativePath(vscode.Uri.parse(uri), false);
}
