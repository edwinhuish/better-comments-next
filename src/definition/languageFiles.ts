import { compileGlob } from '@/utils/regex';

// # Types

/**
 * Files a language claims, mirroring `contributes.languages` of an extension's
 * package.json.
 */
export interface LanguageFileFilter {
  /** extensions with their leading dot (eg: `['.ts', '.tsx']`) */
  extensions?: string[];
  /** exact file names (eg: `['Makefile', 'Dockerfile']`) */
  filenames?: string[];
  /** glob patterns matched against the file name (eg: `['*.eslintrc*']`) */
  filenamePatterns?: string[];
}

// # Glob compilation

/**
 * Compile a contributed `filenamePattern` into a regex matched against a file
 * name. A leading path prefix (a `**` or `*` segment followed by a separator)
 * is dropped; a pattern that still contains a separator cannot match a bare
 * file name and is rejected.
 *
 * Reuses the shared glob compiler, so `*` and `?` behave exactly like they do
 * for tag patterns.
 */
export function compileFilenameGlob(pattern: string): RegExp | undefined {
  const body = pattern.replace(/^(?:\*\*|\*)\//, '');
  if (body.includes('/')) {
    return undefined;
  }

  try {
    return new RegExp(`^${compileGlob(body)}$`, 'i');
  }
  catch {
    return undefined;
  }
}

// # Index

/**
 * Maps file names to language ids.
 *
 * The panel has to know the language of a file before it can scan it, and
 * opening every file of a workspace with `openTextDocument` just to read its
 * language id costs far too much. The index is built once per refresh from the
 * languages contributed by all extensions — the same source VS Code uses to
 * pick the language of a document.
 *
 * Pure by design (no `vscode` dependency) so it stays unit testable.
 */
export class LanguageFileIndex {
  // extensions keep their leading dot, keys are lowercased
  private readonly byExtension = new Map<string, string>();
  private readonly byFilename = new Map<string, string>();
  private readonly byFilenamePattern: { languageId: string; exp: RegExp }[] = [];

  /**
   * Register the files of a language.
   *
   * The first registration of a key wins: built-in languages are enumerated
   * before user extensions, so a random extension cannot hijack `.md` or `.ts`.
   */
  public add(languageId: string, filter: LanguageFileFilter): void {
    for (const extension of filter.extensions || []) {
      if (!extension.startsWith('.')) {
        continue;
      }

      const key = extension.toLowerCase();
      if (!this.byExtension.has(key)) {
        this.byExtension.set(key, languageId);
      }
    }

    for (const filename of filter.filenames || []) {
      const key = filename.toLowerCase();
      if (!this.byFilename.has(key)) {
        this.byFilename.set(key, languageId);
      }
    }

    for (const pattern of filter.filenamePatterns || []) {
      const exp = compileFilenameGlob(pattern);
      if (exp) {
        this.byFilenamePattern.push({ languageId, exp });
      }
    }
  }

  /**
   * Language id of a file, or `undefined` when no language claims it — callers
   * decide whether that means "skip" or "open the file to find out".
   */
  public resolve(fileName: string): string | undefined {
    const name = fileName.toLowerCase();

    // an exact file name is the strongest claim
    const byName = this.byFilename.get(name);
    if (byName) {
      return byName;
    }

    // longest extension first, so `.d.ts` wins over `.ts`
    for (let dot = name.indexOf('.'); dot !== -1; dot = name.indexOf('.', dot + 1)) {
      const byExtension = this.byExtension.get(name.slice(dot));
      if (byExtension) {
        return byExtension;
      }
    }

    for (const { languageId, exp } of this.byFilenamePattern) {
      if (exp.test(name)) {
        return languageId;
      }
    }

    return undefined;
  }

  /** Drop every registered file; called when the languages are refreshed. */
  public clear(): void {
    this.byExtension.clear();
    this.byFilename.clear();
    this.byFilenamePattern.length = 0;
  }
}
