import type { PanelConfiguration } from '@/configuration';
import type { TagStore } from './store';
import * as configuration from '@/configuration';
import * as definition from '@/definition';
import * as log from '@/log';
import { scanTagRanges } from '@/matcher';
import * as vscode from 'vscode';
import { buildExcludeGlob, buildIncludeGlob, compileGitignoreGlobs } from './files';
import { buildTagItems } from './model';

/** files read and scanned at once */
const DEFAULT_CONCURRENCY = 8;
/** how many `.gitignore` files are read, they are small but there can be many */
const MAX_GITIGNORE_FILES = 100;
/** the `panelMaxFileSize` setting is in kilobytes */
const KB = 1024;

// # Types

export interface ScanProgress {
  /** files scanned so far */
  done: number;
  /** files the scan started with */
  total: number;
  /** tags found so far */
  tags: number;
}

export interface ScanOptions {
  /** abort the scan from the outside (a newer scan, or deactivation) */
  token?: vscode.CancellationToken;
  /**
   * Scan these files instead of the whole workspace. Used to refresh the
   * files a document change touched without walking the workspace again.
   */
  files?: vscode.Uri[];
  /** how many files are read at once */
  concurrency?: number;
  onProgress?: (progress: ScanProgress) => void;
}

export interface ScanResult {
  /** files that were scanned */
  files: number;
  tags: number;
  /** whether the scan stopped early because its token was canceled */
  cancelled: boolean;
}

/**
 * Fills the panel store with the tagged comments of a workspace.
 *
 * Everything language specific stays outside: the language of a file comes
 * from the file index of `@/definition` (never from opening the file), and the
 * comments themselves are found by `@/matcher` — the same scan the decorations
 * use, so both views cannot drift apart.
 */
export class PanelScanner {
  constructor(private readonly store: TagStore) {}

  /**
   * Scan the workspace (or the given files) and store what was found.
   * Files are read in chunks, so a big workspace never opens thousands of
   * handles at once and a canceled token stops the walk at the next chunk.
   */
  public async scan(options: ScanOptions = {}): Promise<ScanResult> {
    const panel = configuration.getPanelConfiguration();
    const concurrency = Math.max(1, options.concurrency || DEFAULT_CONCURRENCY);
    const files = options.files || await this.findFiles(panel, options.token);

    let done = 0;
    let tags = 0;
    let cancelled = false;

    const report = () => options.onProgress?.({ done, total: files.length, tags });
    report();

    for (let i = 0; i < files.length; i += concurrency) {
      if (options.token?.isCancellationRequested) {
        cancelled = true;
        break;
      }

      const chunk = files.slice(i, i + concurrency);
      const counts = await Promise.all(chunk.map(uri => this.scanFile(uri, panel)));

      done += chunk.length;
      tags += counts.reduce((sum, count) => sum + count, 0);
      report();
    }

    return { files: done, tags, cancelled };
  }

  /** Files of the workspace that the panel settings let through. */
  private async findFiles(panel: PanelConfiguration, token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    const exclude = [...panel.excludeGlobs];

    if (panel.useGitignore) {
      exclude.push(...await this.readGitignoreGlobs(token));
    }

    return vscode.workspace.findFiles(
      buildIncludeGlob(panel.includeGlobs),
      buildExcludeGlob(exclude) ?? null,
      panel.maxFiles,
      token,
    );
  }

  /** Globs of every `.gitignore` of the workspace, resolved against its folder. */
  private async readGitignoreGlobs(token?: vscode.CancellationToken): Promise<string[]> {
    const uris = await vscode.workspace.findFiles('**/.gitignore', null, MAX_GITIGNORE_FILES, token);
    const globs: string[] = [];

    for (const uri of uris) {
      try {
        const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        const relative = vscode.workspace.asRelativePath(uri, false);
        const dirEnd = relative.lastIndexOf('/');
        const baseDir = dirEnd === -1 ? '' : relative.slice(0, dirEnd);

        globs.push(...compileGitignoreGlobs(baseDir, content));
      }
      catch (e) {
        log.error(e); // a single unreadable ignore file must not stop the scan
      }
    }

    return globs;
  }

  /** Scan one file and store its tags; returns how many were found. */
  private async scanFile(uri: vscode.Uri, panel: PanelConfiguration): Promise<number> {
    try {
      const languageId = definition.getLanguageIdByUri(uri);

      // no language claims the file, or the language is switched off
      if (!languageId || !configuration.isLanguageEnabled(languageId)) {
        return 0;
      }

      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > panel.maxFileSize * KB) {
        return 0; // too big to be worth scanning
      }

      const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      const { lineComments, blockComments } = await definition.getAvailableComments(languageId);

      const ranges = scanTagRanges({
        languageId,
        text,
        offset: 0,
        lineComments,
        blockComments,
        useDocComment: definition.useLanguage(languageId).isUseDocComment(),
      }, configuration.getMatcherOptions());

      const items = buildTagItems({ uri: uri.toString(), text, ranges });
      this.store.set(uri.toString(), items);

      return items.length;
    }
    catch (e) {
      log.error(e); // a locked or deleted file must not stop the scan
      return 0;
    }
  }
}
