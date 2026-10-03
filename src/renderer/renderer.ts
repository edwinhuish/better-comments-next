import type { MatcherOptions } from '@/matcher';
import * as configuration from '@/configuration';
import * as definition from '@/definition';
import * as log from '@/log';
import { ProcessedRanges, scanTagRanges } from '@/matcher';
import { CancelError, generateUUID } from '@/utils/utils';
import * as vscode from 'vscode';

export interface RenderParams {
  editor: vscode.TextEditor;
}

/** One slice of a document (a visible range, or the whole text). */
export interface SliceRenderParams {
  taskID: string;
  editor: vscode.TextEditor;
  text: string;
  /** Offset of `text` inside the document; matcher ranges are absolute */
  offset: number;
  tagRanges: Map<string, vscode.Range[]>;
  processed: ProcessedRanges;
}

/**
 * Render the tag ranges computed by `@/matcher` as editor decorations.
 *
 * The renderer is language agnostic on purpose: which ranges exist — and how
 * the comments of a language are recognised — is decided by that language's
 * matcher. It only turns the ranges into decorations, keeps the work debounced
 * and cancellable, and applies them to every visible editor of the document.
 */
export class Renderer {
  /**
   * Latest task token per document uri.
   * Tokens are scoped to documents instead of the renderer instance, so
   * concurrent updates on different editors never cancel each other.
   */
  private readonly taskTokens = new Map<string, string>();

  // pending full-text scan timers, keyed by document uri
  private readonly fullTextTimers = new Map<string, NodeJS.Timeout>();

  public async updateDecorations(params: RenderParams): Promise<void> {
    const taskID = this.newTask(params.editor);
    const processed = new ProcessedRanges();
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

      const sliceParams: SliceRenderParams = { editor: params.editor, text, offset, tagRanges, taskID, processed };

      await this.renderSlice(sliceParams);
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
        const sliceParams: SliceRenderParams = { editor: params.editor, text, offset: 0, tagRanges, taskID, processed };
        await this.renderSlice(sliceParams);

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
   * Cancel all pending work of the renderer. Called on extension deactivation.
   */
  public dispose() {
    for (const timer of this.fullTextTimers.values()) {
      clearTimeout(timer);
    }
    this.fullTextTimers.clear();
    this.taskTokens.clear();
  }

  /**
   * Build the pure matcher options, wiring the cancellation checkpoint of the
   * current task so long regex scans can be aborted mid-way.
   */
  protected getMatcherOptions(params: SliceRenderParams): MatcherOptions {
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

  /**
   * Scan one slice of the document and queue its tag ranges for decoration.
   *
   * The scan lives in `@/matcher/scan.ts` and is shared with the panel scanner,
   * so editor decorations and the panel can never drift apart; every language
   * quirk belongs to the language's own matcher.
   */
  private async renderSlice(params: SliceRenderParams): Promise<void> {
    const languageId = params.editor.document.languageId;
    if (!isLanguageEnabled(languageId)) {
      return; // nothing to decorate for this language with the current settings
    }

    const { lineComments, blockComments } = await definition.getAvailableComments(languageId);
    const options = this.getMatcherOptions(params);

    this.verifyTaskID(params.editor, params.taskID);

    const ranges = scanTagRanges({
      languageId,
      text: params.text,
      offset: params.offset,
      lineComments,
      blockComments,
      useDocComment: definition.useLanguage(languageId).isUseDocComment(),
    }, options, params.processed);

    for (const { key, start, end } of ranges) {
      const startPos = params.editor.document.positionAt(start);
      const endPos = params.editor.document.positionAt(end);
      const opt = params.tagRanges.get(key) || [];
      opt.push(new vscode.Range(startPos, endPos));
      params.tagRanges.set(key, opt);
    }
  }
}

/**
 * Whether a language is decorated at all: plain text has no comment syntax of
 * its own, so highlighting it is a setting. Every other language is always
 * rendered — recognising its comments is the matcher's job, not the renderer's.
 */
function isLanguageEnabled(languageId: string): boolean {
  return languageId !== 'plaintext' || configuration.getConfigurationFlatten().highlightPlainText;
}

// one renderer serves every language: matching already decided what to render
const renderer = new Renderer();

// pending debounce timers, keyed by document uri
const updateTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounce per document (uri), so concurrent editors never cancel each
 * other's pending updates even when they share the same renderer.
 */
export function triggerUpdateDecorations(params: RenderParams) {
  const { updateDelay } = configuration.getConfigurationFlatten();

  const uri = params.editor.document.uri.toString();
  const timer = updateTimers.get(uri);
  if (timer) {
    clearTimeout(timer);
  }

  updateTimers.set(uri, setTimeout(async () => {
    updateTimers.delete(uri);
    try {
      await renderer.updateDecorations(params);
    }
    catch (e) {
      if (e instanceof CancelError) {
        return; // superseded by a newer task of the same document
      }
      log.error(e);
    }
  }, updateDelay));
}

/**
 * Cancel all pending update timers and renderer work. Called on extension
 * deactivation.
 */
export function dispose() {
  for (const timer of updateTimers.values()) {
    clearTimeout(timer);
  }
  updateTimers.clear();

  renderer.dispose();
}
