import type { FileGroup, TagGroup, TagItem } from './model';
import { groupByFile, groupByTag } from './model';

/**
 * Cache of the tagged comments of a workspace, keyed by file uri.
 *
 * The scanner (step 7) fills it file by file, the panel reads the dimension it
 * is browsing. Grouped views are built lazily and dropped whenever a file
 * changes, so rebuilding the tree never re-groups an unchanged workspace.
 */
export class TagStore {
  private readonly byUri = new Map<string, TagItem[]>();

  private files: FileGroup[] | undefined;
  private tags: TagGroup[] | undefined;
  private flattened: TagItem[] | undefined;

  /**
   * Replace the items of one file. An empty list means "scanned, no tags",
   * which is deliberately different from "never scanned" (`get` → undefined).
   */
  public set(uri: string, items: TagItem[]): void {
    this.byUri.set(uri, items);
    this.invalidate();
  }

  /** Forget a file (deleted, or excluded by a new glob). */
  public delete(uri: string): boolean {
    const deleted = this.byUri.delete(uri);

    if (deleted) {
      this.invalidate();
    }

    return deleted;
  }

  /**
   * Forget every file inside a folder, because the folder left the workspace.
   * Returns how many files were dropped.
   */
  public deleteFolder(folderUri: string): number {
    const prefix = folderUri.endsWith('/') ? folderUri : `${folderUri}/`;
    let deleted = 0;

    for (const uri of this.byUri.keys()) {
      if (uri.startsWith(prefix)) {
        this.byUri.delete(uri);
        deleted++;
      }
    }

    if (deleted) {
      this.invalidate();
    }

    return deleted;
  }

  public clear(): void {
    this.byUri.clear();
    this.invalidate();
  }

  public get(uri: string): TagItem[] | undefined {
    return this.byUri.get(uri);
  }

  public has(uri: string): boolean {
    return this.byUri.has(uri);
  }

  /** Number of scanned files (including the ones without tags). */
  public get size(): number {
    return this.byUri.size;
  }

  public uris(): string[] {
    return [...this.byUri.keys()];
  }

  /** Every item, file by file, in file order. */
  public all(): TagItem[] {
    this.flattened ??= this.groupByFile().flatMap(group => group.items);

    return this.flattened;
  }

  /** The `file` browsing dimension, cached until the next change. */
  public groupByFile(): FileGroup[] {
    this.files ??= groupByFile([...this.byUri.values()].flat());

    return this.files;
  }

  /** The `tag` browsing dimension, cached until the next change. */
  public groupByTag(): TagGroup[] {
    this.tags ??= groupByTag(this.all());

    return this.tags;
  }

  private invalidate(): void {
    this.files = undefined;
    this.tags = undefined;
    this.flattened = undefined;
  }
}
