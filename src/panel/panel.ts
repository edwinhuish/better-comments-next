import type { PanelConfiguration, PanelGroupBy } from '@/configuration';
import type { TagItem } from './model';
import type { TreeNode } from './view';
import * as configuration from '@/configuration';
import * as log from '@/log';
import * as vscode from 'vscode';
import { compileExcludes } from './files';
import { PanelScanner } from './scanner';
import { TagStore } from './store';
import { COMMAND_REVEAL, TagsViewProvider, VIEW_ID } from './view';
import { PanelWatcher } from './watch';

export const COMMAND_REFRESH = 'better-comments-next.panelRefresh';
export const COMMAND_GROUP_BY_FILE = 'better-comments-next.panelGroupByFile';
export const COMMAND_GROUP_BY_TAG = 'better-comments-next.panelGroupByTag';

let store: TagStore | undefined;
let scanner: PanelScanner | undefined;
let provider: TagsViewProvider | undefined;
let view: vscode.TreeView<TreeNode> | undefined;
/** token of the running scan, so a newer one can cancel it */
let cancellation: vscode.CancellationTokenSource | undefined;
/** watches the scanned files when `panelAutoRefresh` is on */
let watcher: PanelWatcher | undefined;

/**
 * Register the panel view and its commands.
 *
 * The view itself is contributed (and hidden by its own `when` clause when
 * `better-comments.panelEnabled` is off); this only fills it.
 */
export function activate(context: vscode.ExtensionContext) {
  const panel = configuration.getPanelConfiguration();

  store = new TagStore();
  scanner = new PanelScanner(store);
  provider = new TagsViewProvider(store, panel.groupBy);

  view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: provider, showCollapseAll: true });
  context.subscriptions.push(view);

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_REFRESH, () => scanWorkspace()),
    vscode.commands.registerCommand(COMMAND_GROUP_BY_FILE, () => setGroupBy('file')),
    vscode.commands.registerCommand(COMMAND_GROUP_BY_TAG, () => setGroupBy('tag')),
    vscode.commands.registerCommand(COMMAND_REVEAL, (item: TagItem) => revealComment(item)),
  );

  if (panel.enabled && panel.scanOnStartup) {
    void scanWorkspace();
  }

  if (panel.autoRefresh) {
    watcher = createWatcher(panel);
  }
}

/**
 * Watch the scanned files for changes made anywhere — the editor, a build,
 * another tool — and refresh only what was touched.
 */
function createWatcher(panel: PanelConfiguration): PanelWatcher {
  return new PanelWatcher({
    includeGlobs: panel.includeGlobs,
    isExcluded: compileExcludes(panel.excludeGlobs),
    onFlush: (changed, deleted) => {
      // a deleted file cannot be scanned, it has to leave the store
      for (const uri of deleted) {
        store?.delete(uri.toString());
      }

      if (changed.length) {
        void scanFiles(changed);
      }
      else {
        updateView();
      }
    },
  });
}

/**
 * (Re)scan the workspace. A running scan is canceled first: its results belong
 * to the workspace as it was, and a manual refresh always wins.
 */
export async function scanWorkspace(): Promise<void> {
  if (!store || !scanner) {
    return;
  }

  cancellation?.cancel();
  cancellation?.dispose();

  const tokenSource = new vscode.CancellationTokenSource();
  cancellation = tokenSource;

  try {
    const result = await scanner.scan({ token: tokenSource.token });

    log.info(`panel: scanned ${result.files} files, found ${result.tags} tags`);
  }
  catch (e) {
    log.error(e);
  }
  finally {
    updateView();

    if (cancellation === tokenSource) {
      tokenSource.dispose();
      cancellation = undefined;
    }
  }
}

/** Put the dimension the user chose in the title bar into the tree. */
function setGroupBy(groupBy: PanelGroupBy): void {
  provider?.setGroupBy(groupBy);
}

/**
 * Scan only these files (they changed on disk) and refresh the tree.
 * Unlike a full scan this does not cancel anything: it is small by design.
 */
async function scanFiles(files: vscode.Uri[]): Promise<void> {
  if (!store || !scanner) {
    return;
  }

  try {
    const result = await scanner.scan({ files });

    log.info(`panel: rescanned ${result.files} changed files, found ${result.tags} tags`);
  }
  catch (e) {
    log.error(e);
  }
  finally {
    updateView();
  }
}

function updateView(): void {
  provider?.refresh();

  if (view && store) {
    view.message = store.all().length === 0 ? 'No tagged comments found.' : undefined;
  }
}

/** Open the file of a comment and put the cursor on its tag. */
async function revealComment(item: TagItem): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(item.uri));
    const editor = await vscode.window.showTextDocument(document);
    const position = new vscode.Position(item.line, item.character);

    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }
  catch (e) {
    log.error(e);
  }
}

export function deactivate() {
  watcher?.dispose();
  watcher = undefined;

  cancellation?.cancel();
  cancellation?.dispose();
  cancellation = undefined;

  store = undefined;
  scanner = undefined;
  provider = undefined;
  view = undefined;
}
