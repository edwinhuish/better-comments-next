import { ANY, BR, escape, SP, TAG_SUFFIX } from '@/utils/regex';

// # Types

export interface LineCommentSlice {
  start: number;
  end: number;
  comment: string;
  mark: string;
  /** char captured before the mark; only present with a `prefixPattern` group */
  prefix?: string;
}

export interface BlockCommentSlice {
  start: number;
  end: number;
  comment: string;
  content: string;
  marks: [string, string];
}

export interface DocCommentSlice extends BlockCommentSlice {
  prefix: string;
}

export interface TagRange {
  /** resolved decoration key of the matched tag */
  key: string;
  /** absolute start offset in the document */
  start: number;
  /** absolute end offset in the document */
  end: number;
}

/** precompiled full-match testers for resolving a matched tag text to its config key */
export interface TagPatternEntry {
  key: string;
  test: RegExp;
}

export interface MatcherOptions {
  strict: boolean;
  fullHighlight: boolean;
  /** escaped tag patterns that enable multi-line decoration */
  multilineTags: string[];
  /** escaped tag patterns for single-line decoration */
  lineTags: string[];
  tagPatterns: TagPatternEntry[];
  /**
   * Optional cancellation checkpoint, invoked between regex matches so a
   * running scan can be aborted by throwing (eg: CancelError).
   */
  checkpoint?: () => void;
}

// # Processed range tracking

/**
 * Interval set tracking already-processed document ranges, kept sorted by
 * start. Containment queries (`has`) binary-search the insertion point and
 * then scan the candidates backwards (their starts are all `<= query start`).
 * Stored ranges rarely nest, so the scan usually terminates immediately;
 * correctness does not rely on that.
 */
export class ProcessedRanges {
  private ranges: [number, number][] = [];

  /** Whether any stored range fully contains `[start, end]`. */
  public has(start: number, end: number): boolean {
    for (const r of this.ranges) {
      if (r[0] > start) {
        return false;
      }
      if (r[1] >= end) {
        return true;
      }
    }

    return false;
  }

  /** Store a range, keeping the set sorted by start. */
  public add(start: number, end: number): void {
    const last = this.ranges[this.ranges.length - 1];

    // fast path: ranges usually arrive in ascending order
    if (!last || last[0] <= start) {
      this.ranges.push([start, end]);
      return;
    }

    let lo = 0;
    let hi = this.ranges.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ranges[mid][0] <= start) {
        lo = mid + 1;
      }
      else {
        hi = mid;
      }
    }
    this.ranges.splice(lo, 0, [start, end]);
  }
}

// # Regex memoization

// Keys are bounded by (config tags, comment marks, doc prefixes); the cache is
// cleared if it ever grows unexpectedly (eg: frequent configuration switches).
const expCache = new Map<string, RegExp>();

function cachedExp(key: string, build: () => RegExp): RegExp {
  let exp = expCache.get(key);
  if (!exp) {
    if (expCache.size >= 200) {
      expCache.clear();
    }
    exp = build();
    expCache.set(key, exp);
  }
  return exp;
}

// # Tag key resolution

/**
 * Resolve a matched tag text back to its configured decoration key.
 *
 * Decoration types are keyed by the configured tag string, but a wildcard/regex
 * match captures arbitrary text (eg: `todo[FOO-123]` for tag `todo[*]`). This
 * maps the captured text to the owning tag's key so the right decoration is
 * applied. Matchers are tested in config order to mirror the alternation's
 * leftmost-match preference.
 */
export function resolveTagKey(matched: string, patterns: TagPatternEntry[]): string {
  const lower = matched.toLowerCase();

  for (const { key, test } of patterns) {
    // fast path: literal tags match their own lowercased key directly
    if (key === lower) {
      return key;
    }
    if (test.test(matched)) {
      return key;
    }
  }

  return lower;
}

// # Slice pickers

export interface PickSlicesParams {
  text: string;
  offset: number;
  processed: ProcessedRanges;
  checkpoint?: () => void;
  /**
   * Pattern for the prefix group captured before the comment mark.
   * - line slices: the optional leading char (eg: `.?` for shell `$` guards);
   *   the captured char is exposed as `LineCommentSlice.prefix` for filtering.
   * - block slices: defaults to line starts only; an empty string matches
   *   anywhere.
   */
  prefixPattern?: string;
}

export function pickLineSlices(params: PickSlicesParams & {
  lineComments: string[];
}): LineCommentSlice[] {
  const { text, offset, lineComments, processed, checkpoint, prefixPattern } = params;
  checkpoint?.();

  if (!lineComments || !lineComments.length) {
    return [];
  }

  const slices: LineCommentSlice[] = [];
  const marks = lineComments.map(s => `${escape(s)}+`).join('|');
  const leading = prefixPattern ? `(?<PRE>${prefixPattern})` : '';
  const exp = cachedExp(
    `line-slices-${marks}-${leading}`,
    () => new RegExp(`${leading}(?<MARK>${marks}).*?(?:${BR}${SP}*\\1.*?)*(?:${BR}|$)`, 'g'),
  );
  exp.lastIndex = 0;

  let block: RegExpExecArray | null;
  while ((block = exp.exec(text))) {
    checkpoint?.();

    const start = offset + block.index;
    const end = start + block[0].length;

    if (processed.has(start, end)) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.add(start, end);

    slices.push({
      start,
      end,
      comment: block[0],
      mark: block.groups!.MARK,
      prefix: block.groups!.PRE,
    });
  }

  return slices;
}

const DEFAULT_BLOCK_PREFIX = `(?:^|${BR})\\s*`;

export function pickBlockSlices(params: PickSlicesParams & {
  blockComments: [string, string][];
}): BlockCommentSlice[] {
  const { text, offset, blockComments, processed, checkpoint, prefixPattern } = params;
  checkpoint?.();

  if (!blockComments || !blockComments.length) {
    return [];
  }

  const prefix = prefixPattern ?? DEFAULT_BLOCK_PREFIX;
  const slices: BlockCommentSlice[] = [];

  for (const marks of blockComments) {
    checkpoint?.();

    const markStart = escape(marks[0]);
    const markEnd = escape(marks[1]);
    const exp = cachedExp(
      `block-slices-${prefix}-${markStart}-${markEnd}`,
      () => new RegExp(`(?<PRE>${prefix})(?<START>${markStart})(?<CONTENT>${ANY}*?)(?<END>${markEnd})`, 'g'),
    );
    exp.lastIndex = 0;

    let block: RegExpExecArray | null;
    while ((block = exp.exec(text))) {
      checkpoint?.();

      const start = offset + block.index + block.groups!.PRE.length;
      const end = offset + block.index + block[0].length;

      if (processed.has(start, end)) {
        // skip if already processed
        continue;
      }
      // store processed range
      processed.add(start, end);

      slices.push({
        start,
        end,
        comment: block[0],
        content: block.groups!.CONTENT,
        marks,
      });
    }
  }

  return slices;
}

export function pickDocSlices(params: PickSlicesParams): DocCommentSlice[] {
  const { text, offset, processed, checkpoint } = params;
  checkpoint?.();

  const marks: [string, string] = ['/**', '*/'];
  const prefix = '*';

  const slices: DocCommentSlice[] = [];

  const markStart = escape(marks[0]);
  const markEnd = escape(marks[1]);

  const blockExp = cachedExp(
    `doc-slices-${markStart}-${markEnd}`,
    () => new RegExp(`(?<PRE>(?:^|${BR})${SP}*)(?<START>${markStart})(?<CONTENT>(?:${BR}|${SP})${ANY}*?)(?<END>${markEnd})`, 'g'),
  );
  blockExp.lastIndex = 0;

  let block: RegExpExecArray | null;
  while ((block = blockExp.exec(text))) {
    checkpoint?.();

    const start = offset + block.index + block.groups!.PRE.length;
    const end = offset + block.index + block[0].length;
    if (processed.has(start, end)) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.add(start, end);

    slices.push({
      start,
      end,
      marks,
      prefix,
      comment: block.groups!.START + block.groups!.CONTENT + block.groups!.END,
      content: block.groups!.CONTENT,
    });
  }

  return slices;
}

// # Tag matching

export function matchLineTagsInSlice(slice: LineCommentSlice, opt: MatcherOptions): TagRange[] {
  const ranges: TagRange[] = [];
  const { multilineTags, lineTags, strict, fullHighlight } = opt;
  const mark = escape(slice.mark);

  const lineProcessed = new ProcessedRanges();

  if (multilineTags.length) {
    const m1Exp = cachedExp(
      `line-m1-${strict}-${multilineTags.join('|')}-${mark}`,
      () => strict
        ? new RegExp(`(?<PRE>${SP}*${mark}${SP})(?<TAG>${multilineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}${ANY}*)`, 'gi')
        : new RegExp(`(?<PRE>${SP}*${mark}${SP}?)(?<TAG>${multilineTags.join('|')})(?<CONTENT>${ANY}*)`, 'gi'),
    );
    m1Exp.lastIndex = 0;

    // Find the matched multiline
    let m1: RegExpExecArray | null;
    while ((m1 = m1Exp.exec(slice.comment))) {
      opt.checkpoint?.();

      const m1Start = slice.start + m1.index;
      const tagName = resolveTagKey(m1.groups!.TAG, opt.tagPatterns);

      // exec with remember last reg index, reset m2Exp avoid reg cache
      const m2Exp = new RegExp(`(?<PRE>^|(?:${BR}?${SP}*))(?<MARK>${mark})(?<SPACE>${SP}*)(?<CONTENT>.*)`, 'gi');

      // Find decoration range
      let m2: RegExpExecArray | null;
      while ((m2 = m2Exp.exec(m1[0]))) {
        opt.checkpoint?.();

        if (!m2.groups!.CONTENT) {
          if ((m2.index + m2[0].length) >= m1[0].length) {
            break; // index 已经移动到最后的位置，跳出循环
          }
          continue; // 空行
        }

        if (m2.index !== 0 && m2.groups!.SPACE.length <= 1) {
          m1Exp.lastIndex = m1.index + m2.index - 1;
          break;
        }

        const m2StartSince = m1Start + m2.index;
        const m2Start = fullHighlight
          ? m2StartSince + m2.groups!.PRE.length
          : m2StartSince + m2.groups!.PRE.length + m2.groups!.MARK.length;
        const m2End = m2StartSince + m2[0].length;
        // store processed range
        lineProcessed.add(m2Start, m2End);

        ranges.push({ key: tagName, start: m2Start, end: m2End });
      }
    }
  }

  if (lineTags.length) {
    const lineExp = cachedExp(
      `line-tags-${strict}-${lineTags.join('|')}-${mark}`,
      () => strict
        ? new RegExp(`(?<PRE>(?:^|${SP})${mark}${SP})(?<TAG>${lineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}.*)`, 'gim')
        : new RegExp(`(?<PRE>(?:^|${SP})${mark}${SP}?)(?<TAG>${lineTags.join('|')})(?<CONTENT>.*)`, 'gim'),
    );
    lineExp.lastIndex = 0;

    let line: RegExpExecArray | null;
    while ((line = lineExp.exec(slice.comment))) {
      opt.checkpoint?.();

      const lineStartSince = slice.start + line.index;
      const lineStart = fullHighlight
        ? lineStartSince
        : lineStartSince + line.groups!.PRE.length;
      const lineEnd = lineStartSince + line[0].length;

      if (lineProcessed.has(lineStart, lineEnd)) {
        // skip if already processed
        continue;
      }
      // store processed range
      lineProcessed.add(lineStart, lineEnd);

      const tagName = resolveTagKey(line.groups!.TAG, opt.tagPatterns);

      ranges.push({ key: tagName, start: lineStart, end: lineEnd });
    }
  }

  return ranges;
}

export function matchBlockTagsInSlice(slice: BlockCommentSlice, opt: MatcherOptions): TagRange[] {
  const ranges: TagRange[] = [];

  let content = slice.content;
  let contentStart = slice.start + slice.marks[0].length;

  const pre = escape(slice.marks[0].slice(-1));
  const suf = escape(slice.marks[1].slice(0, 1));
  if (!!pre && !!suf) {
    const trimExp = new RegExp(`^(${pre}*)(${ANY}*)${suf}*$`, 'i');
    const trimmed = trimExp.exec(slice.content);
    if (!trimmed) {
      return ranges;
    }

    if (!trimmed[2].length) {
      return ranges;
    }

    content = trimmed[2];
    contentStart += trimmed[1].length;
  }

  const lineProcessed = new ProcessedRanges();

  if (opt.multilineTags.length) {
    // exec with remember last reg index, reset m2Exp avoid reg cache
    const m1Exp = cachedExp(
      `block-m1-${opt.strict}-${opt.multilineTags.join('|')}`,
      () => opt.strict
        ? new RegExp(`(?<PRE>^(?<SPACE1>${SP})|${BR}(?<SPACE2>${SP}*))(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}${ANY}*)`, 'gi')
        : new RegExp(`(?<PRE>^(?<SPACE1>${SP}?)|${BR}(?<SPACE2>${SP}*))(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${ANY}*)`, 'gi'),
    );
    m1Exp.lastIndex = 0;

    // Find the matched multiline
    let m1: RegExpExecArray | null;
    while ((m1 = m1Exp.exec(content))) {
      opt.checkpoint?.();

      const m1Start = contentStart + m1.index;
      const tagName = resolveTagKey(m1.groups!.TAG, opt.tagPatterns);
      const m1Space = m1.groups!.SPACE1 || m1.groups!.SPACE2 || '';

      const m2Exp = /(?<PRE>(?:\r?\n|^)(?<SPACE>[ \t]*))(?<CONTENT>.*)/g;

      // Find decoration range
      let m2: RegExpExecArray | null;
      while ((m2 = m2Exp.exec(m1[0]))) {
        opt.checkpoint?.();

        if (!m2.groups!.CONTENT) {
          if (m2.index >= m1[0].length) {
            break; // index 已经移动到最后的位置，跳出循环
          }

          continue; // 空行，继续下次匹配
        }

        const m2Space = m2.groups!.SPACE || '';
        if (m2.index !== 0 && m2Space.length <= m1Space.length) {
          m1Exp.lastIndex = m1.index + m2.index - 1; // 行的缩进比tag的缩进少，跳出遍历，并修改 m1 的 lastIndex
          break;
        }

        const m2StartSince = m1Start + m2.index;
        const m2Start = m2StartSince + m2.groups!.PRE.length;
        const m2End = m2StartSince + m2[0].length;
        // store processed range
        lineProcessed.add(m2Start, m2End);

        ranges.push({ key: tagName, start: m2Start, end: m2End });
      }
    }
  }

  const lineTags = opt.lineTags;
  if (lineTags.length) {
    const lineExp = cachedExp(
      `block-line-${opt.strict}-${lineTags.join('|')}`,
      () => opt.strict
        ? new RegExp(`(?<PRE>^${SP}|${BR}${SP}*)(?<TAG>${lineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}.*)`, 'gim')
        : new RegExp(`(?<PRE>^${SP}?|${BR}${SP}*)(?<TAG>${lineTags.join('|')})(?<CONTENT>.*)`, 'gim'),
    );
    lineExp.lastIndex = 0;
    // Find the matched line
    let line: RegExpExecArray | null;
    while ((line = lineExp.exec(content))) {
      opt.checkpoint?.();

      const lineStartSince = contentStart + line.index;
      const lineStart = lineStartSince + line.groups!.PRE.length;
      const lineEnd = lineStartSince + line[0].length;

      if (lineProcessed.has(lineStart, lineEnd)) {
        continue; // skip if already processed
      }
      // store processed range
      lineProcessed.add(lineStart, lineEnd);

      const tagName = resolveTagKey(line.groups!.TAG, opt.tagPatterns);

      ranges.push({ key: tagName, start: lineStart, end: lineEnd });
    }
  }

  return ranges;
}

export function matchDocTagsInSlice(slice: DocCommentSlice, opt: MatcherOptions): TagRange[] {
  const ranges: TagRange[] = [];
  const lineProcessed = new ProcessedRanges();
  const pre = escape(slice.prefix);

  if (opt.multilineTags.length) {
    const m1Exp = cachedExp(
      `doc-m1-${opt.strict}-${opt.multilineTags.join('|')}`,
      () => opt.strict
        ? new RegExp(`(?<PRE>^${SP}|${SP}*${pre}${SP})(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}${ANY}*)`, 'gi')
        : new RegExp(`(?<PRE>^${SP}?|${SP}*${pre}${SP}?)(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${ANY}*)`, 'gi'),
    );
    m1Exp.lastIndex = 0;
    // Find the matched multiline
    let m1: RegExpExecArray | null;
    while ((m1 = m1Exp.exec(slice.content))) {
      opt.checkpoint?.();

      const m1Start = slice.start + slice.marks[0].length + m1.index;
      const tagName = resolveTagKey(m1.groups!.TAG, opt.tagPatterns);

      // exec with remember last reg index, reset m2Exp avoid reg cache
      const m2Exp = new RegExp(`(?<PRE>${BR}?${SP}*${pre}|^)(?<SPACE>${SP}*)(?<CONTENT>.*)`, 'gi');

      // Find decoration range
      let m2: RegExpExecArray | null;
      const m2Str = m1.groups!.TAG + m1.groups!.CONTENT;
      while ((m2 = m2Exp.exec(m2Str))) {
        opt.checkpoint?.();

        if (!m2.groups!.CONTENT) {
          if ((m2.index + m2[0].length) >= m2Str.length) {
            break; // index 已经移动到最后的位置，跳出循环
          }

          continue; // 空行
        }

        const m2Space = m2.groups!.SPACE || '';
        if (m2.index !== 0 && m2Space.length <= 1) { // 必须大于1个空格缩进
          m1Exp.lastIndex = m1.index + m2.index - 1;
          break;
        }

        const m2StartSince = m1Start + m1.groups!.PRE.length + m2.index;
        const m2Start = m2StartSince + m2.groups!.PRE.length;
        const m2End = m2StartSince + m2[0].length;
        // store processed range
        lineProcessed.add(m2Start, m2End);

        ranges.push({ key: tagName, start: m2Start, end: m2End });
      }
    }
  }

  if (opt.lineTags.length) {
    const tags = opt.lineTags.join('|');
    const linePreTag = `(?:(?:${SP}*${BR}${SP}*${pre})|(?:${SP}*${pre}))`;
    const lineExp = cachedExp(
      `doc-line-${opt.strict}-${tags}-${pre}`,
      () => opt.strict
        ? new RegExp(`(?<PRE>${linePreTag}${SP})(?<TAG>${tags})(?<CONTENT>${TAG_SUFFIX}.*)`, 'gim')
        : new RegExp(`(?<PRE>${linePreTag}${SP}?)(?<TAG>${tags})(?<CONTENT>.*)`, 'gim'),
    );
    lineExp.lastIndex = 0;

    // Find the matched line
    let line: RegExpExecArray | null;
    while ((line = lineExp.exec(slice.content))) {
      opt.checkpoint?.();

      const lineStartSince = slice.start + slice.marks[0].length + line.index;
      const lineStart = lineStartSince + line.groups!.PRE.length;
      const lineEnd = lineStartSince + line[0].length;

      if (lineProcessed.has(lineStart, lineEnd)) {
        // skip if already processed
        continue;
      }
      // store processed range
      lineProcessed.add(lineStart, lineEnd);

      const tagName = resolveTagKey(line.groups!.TAG, opt.tagPatterns);

      ranges.push({ key: tagName, start: lineStart, end: lineEnd });
    }
  }

  return ranges;
}
