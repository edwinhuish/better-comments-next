import type { BlockCommentSlice, DocCommentSlice, LineCommentSlice, MatcherOptions, TagRange } from '@/matcher';
import * as configuration from '@/configuration';
import * as definition from '@/definition';
import * as log from '@/log';
import {
  matchBlockTagsInSlice,
  matchDocTagsInSlice,
  matchLineTagsInSlice,
  pickBlockSlices,
  pickDocSlices,
  pickLineSlices,
} from '@/matcher';
import { CancelError, generateUUID } from '@/utils/utils';
import * as vscode from 'vscode';

export interface UpdateParams {
  editor: vscode.TextEditor;
}

export interface PickParams {
  taskID: string;
  editor: vscode.TextEditor;
  text: string;
  offset: number;
  tagRanges: Map<string, vscode.Range[]>;
  processed: [number, number][];
}

export type { BlockCommentSlice, DocCommentSlice, LineCommentSlice } from '@/matcher';

export abstract class Handler {
  public readonly languageId: string;

  /**
   * Latest task token per document uri.
   * Tokens are scoped to documents instead of the handler instance, so
   * concurrent updates on different editors sharing the same language
   * handler never cancel each other.
   */
  private readonly taskTokens = new Map<string, string>();

  // pending full-text scan timers, keyed by document uri
  protected readonly fullTextTimers = new Map<string, NodeJS.Timeout>();

  constructor(languageId: string) {
    this.languageId = languageId;
  }

  public abstract updateDecorations(params: UpdateParams): Promise<void>;

  /**
   * Start a new task for the document, invalidating any running task on the
   * same document (stale tasks will be canceled by verifyTaskID).
   */
  protected newTask(editor: vscode.TextEditor): string {
    const taskID = generateUUID();
    this.taskTokens.set(editor.document.uri.toString(), taskID);
    return taskID;
  }

  protected setDecorations(editor: vscode.TextEditor, tagRanges: Map<string, vscode.Range[]>) {
    configuration.getTagDecorationTypes().forEach((td, tag) => {
      const ranges = tagRanges.get(tag) || [];

      editor.setDecorations(td, ranges);
      const documentUri = editor.document.uri.toString();
      for (const visibleEditor of vscode.window.visibleTextEditors) {
        if (visibleEditor === editor) {
          continue;
        }

        if (visibleEditor.document.uri.toString() !== documentUri) {
          continue;
        }

        visibleEditor.setDecorations(td, ranges);
      }
    });
  }

  /**
   * Verify the task is still the latest task of the document,
   * otherwise it is stale and should be canceled.
   */
  protected verifyTaskID(editor: vscode.TextEditor, taskID: string) {
    if (this.taskTokens.get(editor.document.uri.toString()) !== taskID) {
      throw new CancelError('Task canceled');
    }
  }

  /**
   * Cancel all pending work of the handler. Called on extension deactivation.
   */
  public dispose() {
    for (const timer of this.fullTextTimers.values()) {
      clearTimeout(timer);
    }
    this.fullTextTimers.clear();
    this.taskTokens.clear();
  }
}

export class CommonHandler extends Handler {
  public async updateDecorations(params: UpdateParams): Promise<void> {
    const taskID = this.newTask(params.editor);
    const processed: [number, number][] = [];
    const tagRanges = new Map<string, vscode.Range[]>();

    const { preloadLines, updateDelay } = configuration.getConfigurationFlatten();

    // # update for visible ranges
    for (const visibleRange of params.editor.visibleRanges) {
      this.verifyTaskID(params.editor, taskID);

      const startLineIdx = Math.max(0, visibleRange.start.line - preloadLines);
      const startLine = params.editor.document.lineAt(startLineIdx);
      const endLineIdx = Math.min(params.editor.document.lineCount - 1, visibleRange.end.line + preloadLines);
      const endLine = params.editor.document.lineAt(endLineIdx);
      const range = new vscode.Range(startLine.range.start.line, 0, endLine.range.end.line, endLine.range.end.character);

      const text = params.editor.document.getText(range);
      const offset = params.editor.document.offsetAt(range.start);

      const pickParams: PickParams = { editor: params.editor, text, offset, tagRanges, taskID, processed };

      await this.pickDocCommentDecorationOptions(pickParams);
      await this.pickBlockCommentDecorationOptions(pickParams);
      await this.pickLineCommentDecorationOptions(pickParams);
    }

    this.setDecorations(params.editor, tagRanges);

    // schedule the full-text scan; keep the handle so it can be canceled
    // by a newer task of the same document or on deactivation
    const uri = params.editor.document.uri.toString();
    const previousTimer = this.fullTextTimers.get(uri);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    const fullTextTimer = setTimeout(async () => {
      this.fullTextTimers.delete(uri);
      try {
        // # update for full text
        this.verifyTaskID(params.editor, taskID);
        const text = params.editor.document.getText();
        const pickParams: PickParams = { editor: params.editor, text, offset: 0, tagRanges, taskID, processed };
        await this.pickDocCommentDecorationOptions(pickParams);
        await this.pickBlockCommentDecorationOptions(pickParams);
        await this.pickLineCommentDecorationOptions(pickParams);

        this.setDecorations(params.editor, tagRanges);
      }
      catch (e) {
        if (e instanceof CancelError) {
          return; // superseded by a newer task of the same document
        }
        log.error(e);
      }
    }, updateDelay);
    this.fullTextTimers.set(uri, fullTextTimer);
  }

  /**
   * Build the pure matcher options, wiring the cancellation checkpoint of the
   * current task so long regex scans can be aborted mid-way.
   */
  protected getMatcherOptions(params: PickParams): MatcherOptions {
    const { strict, fullHighlight } = configuration.getConfigurationFlatten();

    return {
      strict,
      fullHighlight,
      multilineTags: configuration.getMultilineTagsEscaped(),
      lineTags: configuration.getLineTagsEscaped(),
      tagPatterns: configuration.getTagMatchers(),
      checkpoint: () => this.verifyTaskID(params.editor, params.taskID),
    };
  }

  /** Convert pure offset ranges into vscode.Range decorations. */
  private pushTagRanges(params: PickParams, ranges: TagRange[]) {
    for (const { key, start, end } of ranges) {
      const startPos = params.editor.document.positionAt(start);
      const endPos = params.editor.document.positionAt(end);
      const opt = params.tagRanges.get(key) || [];
      opt.push(new vscode.Range(startPos, endPos));
      params.tagRanges.set(key, opt);
    }
  }

  protected async pickLineCommentSlices(params: PickParams): Promise<Array<LineCommentSlice>> {
    const { lineComments } = await definition.getAvailableComments(params.editor.document.languageId);
    return pickLineSlices(
      params.text,
      params.offset,
      lineComments,
      params.processed,
      () => this.verifyTaskID(params.editor, params.taskID),
    );
  }

  private async pickLineCommentDecorationOptions(params: PickParams): Promise<void> {
    const slices = await this.pickLineCommentSlices(params);
    const options = this.getMatcherOptions(params);

    this.verifyTaskID(params.editor, params.taskID);

    for (const slice of slices) {
      this.pushTagRanges(params, matchLineTagsInSlice(slice, options));
    }
  }

  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    const { blockComments } = await definition.getAvailableComments(params.editor.document.languageId);
    return pickBlockSlices(
      params.text,
      params.offset,
      blockComments,
      params.processed,
      () => this.verifyTaskID(params.editor, params.taskID),
    );
  }

  private async pickBlockCommentDecorationOptions(params: PickParams): Promise<void> {
    const slices = await this.pickBlockCommentSlices(params);
    const options = this.getMatcherOptions(params);

    this.verifyTaskID(params.editor, params.taskID);

    for (const slice of slices) {
      this.pushTagRanges(params, matchBlockTagsInSlice(slice, options));
    }
  }

  protected async pickDocCommentSlices(params: PickParams): Promise<Array<DocCommentSlice>> {
    const lang = definition.useLanguage(params.editor.document.languageId);
    if (!lang.isUseDocComment()) {
      return [];
    }

    return pickDocSlices(
      params.text,
      params.offset,
      params.processed,
      () => this.verifyTaskID(params.editor, params.taskID),
    );
  }

  private async pickDocCommentDecorationOptions(params: PickParams): Promise<void> {
    const slices = await this.pickDocCommentSlices(params);
    const options = this.getMatcherOptions(params);

    this.verifyTaskID(params.editor, params.taskID);

    for (const slice of slices) {
      this.pushTagRanges(params, matchDocTagsInSlice(slice, options));
    }
  }
}
