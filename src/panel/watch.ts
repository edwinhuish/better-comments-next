import * as vscode from 'vscode';
import { buildIncludeGlob } from './files';

/** how long events collect before the batch is handed over, in milliseconds */
const DEFAULT_DEBOUNCE = 500;

export interface PanelWatcherParams {
  /** include globs of the panel settings; the watcher only reports these files */
  includeGlobs: string[];
  /**
   * Whether the workspace relative path of a changed file must be ignored.
   * Built from the same exclude globs the scan uses.
   */
  isExcluded: (path: string) => boolean;
  /**
   * A debounced batch of what changed on disk. A file that was changed and
   * deleted before the flush counts as deleted only.
   */
  onFlush: (changed: vscode.Uri[], deleted: vscode.Uri[]) => void;
  debounce?: number;
}

/**
 * Watches the files the panel scans and reports them in debounced batches.
 *
 * `FileSystemWatcher` (instead of save events) so changes made outside the
 * editor — a build, a git checkout, another tool — refresh the panel too. The
 * include glob narrows what VS Code reports in the first place, the exclude
 * filter drops the rest, and one timer flushes everything collected meanwhile.
 */
export class PanelWatcher implements vscode.Disposable {
  private readonly watcher: vscode.FileSystemWatcher;

  /** events collected since the last flush, keyed by uri */
  private readonly pending = new Map<string, { uri: vscode.Uri; deleted: boolean }>();

  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly params: PanelWatcherParams) {
    this.watcher = vscode.workspace.createFileSystemWatcher(buildIncludeGlob(params.includeGlobs));

    this.watcher.onDidChange(uri => this.record(uri, false));
    this.watcher.onDidCreate(uri => this.record(uri, false));
    this.watcher.onDidDelete(uri => this.record(uri, true));
  }

  private record(uri: vscode.Uri, deleted: boolean): void {
    if (this.params.isExcluded(vscode.workspace.asRelativePath(uri, false))) {
      return;
    }

    // a later event for the same file wins: changed-then-deleted is a deletion
    this.pending.set(uri.toString(), { uri, deleted });
    this.schedule();
  }

  private schedule(): void {
    // one timer flushes everything collected while it was running
    if (this.timer) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, this.params.debounce ?? DEFAULT_DEBOUNCE);
  }

  private flush(): void {
    const changed: vscode.Uri[] = [];
    const deleted: vscode.Uri[] = [];

    for (const entry of this.pending.values()) {
      (entry.deleted ? deleted : changed).push(entry.uri);
    }

    this.pending.clear();

    if (changed.length || deleted.length) {
      this.params.onFlush(changed, deleted);
    }
  }

  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    this.pending.clear();
    this.watcher.dispose();
  }
}
