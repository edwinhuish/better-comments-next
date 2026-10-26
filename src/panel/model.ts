import type { TagRange } from '@/matcher';
import { sortTagRanges } from '@/matcher';
import { getLineStarts, positionFromOffset } from '@/utils/text';

// # Types

/**
 * One tagged comment in one file, ready to be displayed.
 *
 * Pure data: the panel builds its tree from these, and only turns `line` and
 * `character` into VS Code positions when it needs to reveal a file.
 */
export interface TagItem {
  /** uri of the file the tag was found in */
  uri: string;
  /** decoration key of the tag (eg: `todo`) */
  key: string;
  /** tag text as written in the source (eg: `TODO`, `todo[FOO-123]`) */
  matched: string;
  /** display text of the tag view: the comment after the tag, marks and tag excluded */
  text: string;
  /** display text of the file view: the tag's line as written, marks excluded */
  labeled: string;
  /** zero-based line of the tag */
  line: number;
  /** zero-based character of the tag inside its line */
  character: number;
  /** absolute offset of the tag inside the file */
  start: number;
  /** absolute end offset of the tag inside the file */
  end: number;
}

/** The tagged comments of one file, in file order. */
export interface FileGroup {
  uri: string;
  items: TagItem[];
}

/** The tagged comments of one tag, in file order. */
export interface TagGroup {
  key: string;
  items: TagItem[];
}

// # Building

export interface BuildTagItemsParams {
  /** uri of the scanned file, kept on every item */
  uri: string;
  /** raw text the ranges were scanned from */
  text: string;
  ranges: TagRange[];
}

/**
 * Turn the pure tag ranges of a scan into display items.
 *
 * The matcher already extracted what to display — the comment after the tag,
 * without marks and tag — so the item only resolves its position. Offsets are
 * converted with the line index helpers instead of opening a document, and
 * ranges are sorted by position, which makes the panel order match the file
 * order.
 */
export function buildTagItems(params: BuildTagItemsParams): TagItem[] {
  const { uri, text } = params;
  const lineStarts = getLineStarts(text);

  return sortTagRanges(params.ranges).map((range) => {
    const { line, character } = positionFromOffset(lineStarts, range.start);

    return {
      uri,
      key: range.key,
      matched: range.matched,
      // a tag standing alone still deserves a label
      text: range.content || range.matched,
      labeled: range.labeled || range.matched,
      line,
      character,
      start: range.start,
      end: range.end,
    };
  });
}

// # Grouping

/**
 * Group items by file. Files are sorted by uri so the panel stays stable no
 * matter in which order the scanner visited them.
 */
export function groupByFile(items: TagItem[]): FileGroup[] {
  const byUri = new Map<string, TagItem[]>();

  for (const item of items) {
    const group = byUri.get(item.uri);
    if (group) {
      group.push(item);
    }
    else {
      byUri.set(item.uri, [item]);
    }
  }

  return [...byUri.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([uri, groupItems]) => ({ uri, items: groupItems }));
}

/**
 * Group items by tag. Groups keep the order of their first item, so the panel
 * shows the most relevant tags first without depending on the configuration.
 */
export function groupByTag(items: TagItem[]): TagGroup[] {
  const byKey = new Map<string, TagItem[]>();
  const order: string[] = [];

  for (const item of items) {
    let group = byKey.get(item.key);
    if (!group) {
      group = [];
      byKey.set(item.key, group);
      order.push(item.key);
    }
    group.push(item);
  }

  return order.map(key => ({ key, items: byKey.get(key) || [] }));
}
