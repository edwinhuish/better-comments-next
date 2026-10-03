import type { MatcherOptions, TagRange } from './matcher';
import type { Matcher } from './modules/common';
import { ProcessedRanges } from './matcher';
import { CommonMatcher } from './modules/common';
import { PlainTextMatcher } from './modules/plaintext';
import { PythonMatcher } from './modules/python';
import { ReactMatcher } from './modules/react';
import { ShellscriptMatcher } from './modules/shellscript';

// # Types

/** Comment tokens of the scanned language (already resolved from `@/definition`) */
export interface ScanComments {
  lineComments: string[];
  blockComments: [string, string][];
  /** Whether `/** *\/` doc comments are recognised for this language */
  useDocComment: boolean;
}

export interface ScanSource extends ScanComments {
  /** language of the scanned text, decides which matcher runs the scan */
  languageId: string;
  text: string;
  /** Offset of `text` inside the full document; ranges are absolute */
  offset: number;
}

// # Language dispatch

const cached = new Map<string, Matcher>();

function newMatcher(languageId: string): Matcher {
  switch (languageId) {
    case 'javascriptreact':
    case 'typescriptreact':
      return new ReactMatcher(languageId);
    case 'shellscript':
      return new ShellscriptMatcher(languageId);
    case 'plaintext':
      return new PlainTextMatcher(languageId);
    case 'python':
      return new PythonMatcher(languageId);
    default:
      return new CommonMatcher(languageId);
  }
}

/**
 * Matcher of a language. Matchers are stateless, so one instance serves every
 * caller (editor decorations, panel scanner).
 */
export function useMatcher(languageId: string): Matcher {
  let matcher = cached.get(languageId);

  if (!matcher) {
    matcher = newMatcher(languageId);
    cached.set(languageId, matcher);
  }

  return matcher;
}

// # Scanning

/**
 * Run the language's comment scan over a piece of text and return every
 * decorated tag range.
 *
 * This is the single source of truth shared by the editor decorations and the
 * panel scanner: given the same text they cannot drift apart. Which comments
 * exist and how they are recognised is decided by the language's matcher;
 * callers resolve the comment tokens beforehand and stay `vscode`-free.
 */
export function scanTagRanges(
  source: ScanSource,
  opt: MatcherOptions,
  processed: ProcessedRanges = new ProcessedRanges(),
): TagRange[] {
  return useMatcher(source.languageId).scan(source, opt, processed);
}

/** Sort ranges by their position in the document. */
export function sortTagRanges(ranges: TagRange[]): TagRange[] {
  return [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
}
