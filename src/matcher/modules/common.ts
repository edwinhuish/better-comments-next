import type { BlockCommentSlice, DocCommentSlice, LineCommentSlice, MatcherOptions, TagRange } from '../matcher';
import type { ScanSource } from '../scan';
import {
  matchBlockTagsInSlice,
  matchDocTagsInSlice,
  matchLineTagsInSlice,
  pickBlockSlices,
  pickDocSlices,
  pickLineSlices,
  ProcessedRanges,
} from '../matcher';

export type { BlockCommentSlice, DocCommentSlice, LineCommentSlice } from '../matcher';

/** Everything one slice picking pass needs to run. */
export interface SlicePassParams {
  source: ScanSource;
  processed: ProcessedRanges;
  checkpoint?: () => void;
}

/**
 * Language specific tag scanner — the matcher counterpart of `@/renderer`.
 *
 * A matcher owns everything about how comments are found in its language:
 * where a comment may start, which ones must be ignored, and whether the text
 * counts as a comment at all. The tag guessers themselves stay pure and shared
 * in `../matcher`, so languages only describe their own quirks.
 */
export abstract class Matcher {
  public readonly languageId: string;

  constructor(languageId: string) {
    this.languageId = languageId;
  }

  /**
   * Every decorated tag range of `source`, as absolute document offsets.
   *
   * Passes share one `ProcessedRanges`, so a range claimed by an earlier pass
   * is never matched twice (this is what the renderer did with its
   * document-level `processed`).
   */
  public abstract scan(
    source: ScanSource,
    opt: MatcherOptions,
    processed?: ProcessedRanges,
  ): TagRange[];

  // # shared passes helpers

  protected matchDocSlices(slices: DocCommentSlice[], opt: MatcherOptions): TagRange[] {
    return slices.flatMap(slice => matchDocTagsInSlice(slice, opt));
  }

  protected matchBlockSlices(slices: BlockCommentSlice[], opt: MatcherOptions): TagRange[] {
    return slices.flatMap(slice => matchBlockTagsInSlice(slice, opt));
  }

  protected matchLineSlices(slices: LineCommentSlice[], opt: MatcherOptions): TagRange[] {
    return slices.flatMap(slice => matchLineTagsInSlice(slice, opt));
  }
}

/**
 * The generic scanner: doc comments, then block comments, then line comments.
 * Languages with quirks extend it and only override what differs.
 */
export class CommonMatcher extends Matcher {
  /**
   * Prefix group captured before a *block* comment mark. `undefined` keeps the
   * picker default (comment starts a line), an empty string matches anywhere.
   */
  protected get blockPrefixPattern(): string | undefined {
    return undefined;
  }

  /**
   * Prefix group captured before a *line* comment mark; the captured char is
   * exposed as `LineCommentSlice.prefix` for filtering. `undefined` captures
   * nothing.
   */
  protected get linePrefixPattern(): string | undefined {
    return undefined;
  }

  /** Whether a line slice must be ignored because of its captured prefix. */
  protected skipLinePrefix(prefix: string | undefined): boolean {
    return false;
  }

  public scan(
    source: ScanSource,
    opt: MatcherOptions,
    processed: ProcessedRanges = new ProcessedRanges(),
  ): TagRange[] {
    const checkpoint = opt.checkpoint;
    const pass: SlicePassParams = { source, processed, checkpoint };

    // doc comments are also valid block comments: claiming them first keeps
    // the later passes from matching their content twice
    return [
      ...this.scanDocSlices(pass, opt),
      ...this.scanBlockSlices(pass, opt),
      ...this.scanLineSlices(pass, opt),
    ];
  }

  protected scanDocSlices(params: SlicePassParams, opt: MatcherOptions): TagRange[] {
    if (!params.source.useDocComment) {
      return [];
    }

    return this.matchDocSlices(pickDocSlices({
      text: params.source.text,
      offset: params.source.offset,
      processed: params.processed,
      checkpoint: params.checkpoint,
    }), opt);
  }

  protected scanBlockSlices(params: SlicePassParams, opt: MatcherOptions): TagRange[] {
    if (!params.source.blockComments.length) {
      return [];
    }

    return this.matchBlockSlices(pickBlockSlices({
      text: params.source.text,
      offset: params.source.offset,
      blockComments: params.source.blockComments,
      processed: params.processed,
      checkpoint: params.checkpoint,
      prefixPattern: this.blockPrefixPattern,
    }), opt);
  }

  protected scanLineSlices(params: SlicePassParams, opt: MatcherOptions): TagRange[] {
    if (!params.source.lineComments.length) {
      return [];
    }

    const slices = pickLineSlices({
      text: params.source.text,
      offset: params.source.offset,
      lineComments: params.source.lineComments,
      processed: params.processed,
      checkpoint: params.checkpoint,
      prefixPattern: this.linePrefixPattern,
    }).filter(slice => !this.skipLinePrefix(slice.prefix));

    return this.matchLineSlices(slices, opt);
  }
}
