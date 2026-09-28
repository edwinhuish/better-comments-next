import { ANY, BR, escape, SP, TAG_SUFFIX } from '@/utils/regex';

// # Types

export interface LineSlice {
  start: number;
  end: number;
  comment: string;
  mark: string;
}

export interface BlockSlice {
  start: number;
  end: number;
  comment: string;
  content: string;
  marks: [string, string];
}

export interface DocSlice extends BlockSlice {
  prefix: string;
}

// legacy aliases kept for handler-side imports
export type LineCommentSlice = LineSlice;
export type BlockCommentSlice = BlockSlice;
export type DocCommentSlice = DocSlice;

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

export function pickLineSlices(
  text: string,
  offset: number,
  lineComments: string[],
  processed: [number, number][],
  checkpoint?: () => void,
): LineSlice[] {
  checkpoint?.();

  if (!lineComments || !lineComments.length) {
    return [];
  }

  const slices: LineSlice[] = [];
  const marks = lineComments.map(s => `${escape(s)}+`).join('|');
  const exp = new RegExp(`(?<MARK>${marks}).*?(?:${BR}${SP}*\\1.*?)*(?:${BR}|$)`, 'g');

  let block: RegExpExecArray | null;
  while ((block = exp.exec(text))) {
    checkpoint?.();

    const start = offset + block.index;
    const end = start + block[0].length;

    if (processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.push([start, end]);

    slices.push({
      start,
      end,
      comment: block[0],
      mark: block.groups!.MARK,
    });
  }

  return slices;
}

export function pickBlockSlices(
  text: string,
  offset: number,
  blockComments: [string, string][],
  processed: [number, number][],
  checkpoint?: () => void,
): BlockSlice[] {
  checkpoint?.();

  if (!blockComments || !blockComments.length) {
    return [];
  }

  const slices: BlockSlice[] = [];

  for (const marks of blockComments) {
    checkpoint?.();

    const markStart = escape(marks[0]);
    const markEnd = escape(marks[1]);
    const exp = new RegExp(`(?<PRE>(?:^|${BR})\\s*)(?<START>${markStart})(?<CONTENT>${ANY}*?)(?<END>${markEnd})`, 'g');

    let block: RegExpExecArray | null;
    while ((block = exp.exec(text))) {
      checkpoint?.();

      const start = offset + block.index + block.groups!.PRE.length;
      const end = offset + block.index + block[0].length;

      if (processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
        // skip if already processed
        continue;
      }
      // store processed range
      processed.push([start, end]);

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

export function pickDocSlices(
  text: string,
  offset: number,
  processed: [number, number][],
  checkpoint?: () => void,
): DocSlice[] {
  checkpoint?.();

  const marks: [string, string] = ['/**', '*/'];
  const prefix = '*';

  const slices: DocSlice[] = [];

  const markStart = escape(marks[0]);
  const markEnd = escape(marks[1]);

  const blockExp = new RegExp(`(?<PRE>(?:^|${BR})${SP}*)(?<START>${markStart})(?<CONTENT>(?:${BR}|${SP})${ANY}*?)(?<END>${markEnd})`, 'g');

  let block: RegExpExecArray | null;
  while ((block = blockExp.exec(text))) {
    checkpoint?.();

    const start = offset + block.index + block.groups!.PRE.length;
    const end = offset + block.index + block[0].length;
    if (processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
      // skip if already processed
      continue;
    }
    // store processed range
    processed.push([start, end]);

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

export function matchLineTagsInSlice(slice: LineSlice, opt: MatcherOptions): TagRange[] {
  const ranges: TagRange[] = [];
  const { multilineTags, lineTags, strict, fullHighlight } = opt;
  const mark = escape(slice.mark);

  const lineProcessed: [number, number][] = [];

  if (multilineTags.length) {
    const m1Exp = strict
      ? new RegExp(`(?<PRE>${SP}*${mark}${SP})(?<TAG>${multilineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}${ANY}*)`, 'gi')
      : new RegExp(`(?<PRE>${SP}*${mark}${SP}?)(?<TAG>${multilineTags.join('|')})(?<CONTENT>${ANY}*)`, 'gi');

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
        lineProcessed.push([m2Start, m2End]);

        ranges.push({ key: tagName, start: m2Start, end: m2End });
      }
    }
  }

  if (lineTags.length) {
    const lineExp = strict
      ? new RegExp(`(?<PRE>(?:^|${SP})${mark}${SP})(?<TAG>${lineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}.*)`, 'gim')
      : new RegExp(`(?<PRE>(?:^|${SP})${mark}${SP}?)(?<TAG>${lineTags.join('|')})(?<CONTENT>.*)`, 'gim');

    let line: RegExpExecArray | null;
    while ((line = lineExp.exec(slice.comment))) {
      opt.checkpoint?.();

      const lineStartSince = slice.start + line.index;
      const lineStart = fullHighlight
        ? lineStartSince
        : lineStartSince + line.groups!.PRE.length;
      const lineEnd = lineStartSince + line[0].length;

      if (lineProcessed.find(([pStart, pEnd]) => pStart <= lineStart && lineEnd <= pEnd)) {
        // skip if already processed
        continue;
      }
      // store processed range
      lineProcessed.push([lineStart, lineEnd]);

      const tagName = resolveTagKey(line.groups!.TAG, opt.tagPatterns);

      ranges.push({ key: tagName, start: lineStart, end: lineEnd });
    }
  }

  return ranges;
}

export function matchBlockTagsInSlice(slice: BlockSlice, opt: MatcherOptions): TagRange[] {
  const ranges: TagRange[] = [];

  let content = slice.content;
  let contentStart = slice.start + slice.marks[0].length;

  const pre = escape(slice.marks[0].slice(-1));
  const suf = escape(slice.marks[1].slice(0, 1));
  if (!!pre && !!suf) {
    const trimExp = new RegExp(`^(${pre}*)(${ANY}*)${suf}*$`, 'i');
    const trimed = trimExp.exec(slice.content);
    if (!trimed) {
      return ranges;
    }

    if (!trimed[2].length) {
      return ranges;
    }

    content = trimed[2];
    contentStart += trimed[1].length;
  }

  const lineProcessed: [number, number][] = [];

  if (opt.multilineTags.length) {
    // exec with remember last reg index, reset m2Exp avoid reg cache
    const m1Exp = opt.strict
      ? new RegExp(`(?<PRE>^(?<SPACE1>${SP})|${BR}(?<SPACE2>${SP}*))(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}${ANY}*)`, 'gi')
      : new RegExp(`(?<PRE>^(?<SPACE1>${SP}?)|${BR}(?<SPACE2>${SP}*))(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${ANY}*)`, 'gi');

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
        lineProcessed.push([m2Start, m2End]);

        ranges.push({ key: tagName, start: m2Start, end: m2End });
      }
    }
  }

  const lineTags = opt.lineTags;
  if (lineTags.length) {
    const lineExp = opt.strict
      ? new RegExp(`(?<PRE>^${SP}|${BR}${SP}*)(?<TAG>${lineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}.*)`, 'gim')
      : new RegExp(`(?<PRE>^${SP}?|${BR}${SP}*)(?<TAG>${lineTags.join('|')})(?<CONTENT>.*)`, 'gim');
    // Find the matched line
    let line: RegExpExecArray | null;
    while ((line = lineExp.exec(content))) {
      opt.checkpoint?.();

      const lineStartSince = contentStart + line.index;
      const lineStart = lineStartSince + line.groups!.PRE.length;
      const lineEnd = lineStartSince + line[0].length;

      if (lineProcessed.find(([pStart, pEnd]) => pStart <= lineStart && lineEnd <= pEnd)) {
        continue; // skip if already processed
      }
      // store processed range
      lineProcessed.push([lineStart, lineEnd]);

      const tagName = resolveTagKey(line.groups!.TAG, opt.tagPatterns);

      ranges.push({ key: tagName, start: lineStart, end: lineEnd });
    }
  }

  return ranges;
}

export function matchDocTagsInSlice(slice: DocSlice, opt: MatcherOptions): TagRange[] {
  const ranges: TagRange[] = [];
  const lineProcessed: [number, number][] = [];
  const pre = escape(slice.prefix);

  if (opt.multilineTags.length) {
    const m1Exp = opt.strict
      ? new RegExp(`(?<PRE>^${SP}|${SP}*${pre}${SP})(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${TAG_SUFFIX}${ANY}*)`, 'gi')
      : new RegExp(`(?<PRE>^${SP}?|${SP}*${pre}${SP}?)(?<TAG>${opt.multilineTags.join('|')})(?<CONTENT>${ANY}*)`, 'gi');
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
        lineProcessed.push([m2Start, m2End]);

        ranges.push({ key: tagName, start: m2Start, end: m2End });
      }
    }
  }

  if (opt.lineTags.length) {
    const tags = opt.lineTags.join('|');
    const linePreTag = `(?:(?:${SP}*${BR}${SP}*${pre})|(?:${SP}*${pre}))`;
    const lineExp = opt.strict
      ? new RegExp(`(?<PRE>${linePreTag}${SP})(?<TAG>${tags})(?<CONTENT>${TAG_SUFFIX}.*)`, 'gim')
      : new RegExp(`(?<PRE>${linePreTag}${SP}?)(?<TAG>${tags})(?<CONTENT>.*)`, 'gim');

    // Find the matched line
    let line: RegExpExecArray | null;
    while ((line = lineExp.exec(slice.content))) {
      opt.checkpoint?.();

      const lineStartSince = slice.start + slice.marks[0].length + line.index;
      const lineStart = lineStartSince + line.groups!.PRE.length;
      const lineEnd = lineStartSince + line[0].length;

      if (lineProcessed.find(range => range[0] <= lineStart && lineEnd <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      lineProcessed.push([lineStart, lineEnd]);

      const tagName = resolveTagKey(line.groups!.TAG, opt.tagPatterns);

      ranges.push({ key: tagName, start: lineStart, end: lineEnd });
    }
  }

  return ranges;
}
