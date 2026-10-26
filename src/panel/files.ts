/**
 * File discovery helpers of the panel scan.
 *
 * Pure by design: the globs are built as strings and handed to
 * `workspace.findFiles`, so the rules stay unit testable without a workspace.
 */

// # Glob building

/** Include pattern of `findFiles`; no include glob means every file. */
export function buildIncludeGlob(includeGlobs: string[]): string {
  return joinGlobs(includeGlobs) || '**/*';
}

/**
 * Exclude pattern of `findFiles`, or `undefined` when nothing is excluded
 * (callers pass `null` to `findFiles` in that case).
 */
export function buildExcludeGlob(excludeGlobs: string[]): string | undefined {
  return joinGlobs(excludeGlobs);
}

/**
 * `findFiles` takes a single pattern, so several globs are combined into a
 * brace alternation (`{a,b}`).
 */
function joinGlobs(globs: string[]): string | undefined {
  const patterns = globs.map(glob => glob.trim()).filter(Boolean);

  return patterns.length ? `{${patterns.join(',')}}` : undefined;
}

// # Gitignore

/**
 * Translate the patterns of one `.gitignore` into globs for the exclude
 * pattern of `findFiles`.
 *
 * An approximation of the real rules, on purpose: `findFiles` can only
 * exclude, so negated patterns (`!foo`) are skipped, and a name is excluded
 * both as a file and as a directory (its whole subtree) because a pattern
 * alone does not tell them apart.
 *
 * @param baseDir workspace relative directory of the `.gitignore`, `''` for the
 * root; patterns are resolved against it, as git does
 */
export function compileGitignoreGlobs(baseDir: string, content: string): string[] {
  const root = joinDir(baseDir);
  const globs: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    // comments and negations: an exclude glob cannot un-exclude a file
    if (!line || line.startsWith('#') || line.startsWith('!')) {
      continue;
    }

    const pattern = line.replace(/^\//, '').replace(/\/$/, '');
    if (!pattern) {
      continue;
    }

    // a pattern without a separator matches at any depth below `baseDir`,
    // one with a separator is anchored to it
    const path = pattern.includes('/')
      ? `${root}${pattern}`
      : `${root}**/${pattern}`;

    globs.push(path);
    globs.push(`${path}/**`); // a bare name may well be a directory
  }

  return globs;
}

function joinDir(baseDir: string): string {
  // `.`, `/` and `./` all mean the workspace root, which needs no prefix
  const base = baseDir.replace(/^\/+/, '').replace(/\/+$/, '').replace(/^\.$/, '');

  return base ? `${base}/` : '';
}

// # Path matching

/**
 * Compile a workspace path glob into a regex over workspace relative paths.
 *
 * Semantics follow `findFiles`: a double star crosses path separators and may
 * match no segment at all, while `*` and `?` stay inside one segment. Used to
 * filter file watcher events with the same excludes the scan uses.
 */
export function compilePathGlob(pattern: string): RegExp | undefined {
  let source = '';

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // a double star swallows a following slash, and may match nothing at
        // all: `a` + `**` + `/b` also matches the plain path `a/b`
        if (pattern[i + 2] === '/') {
          source += '(?:.*/)?';
          i += 2; // swallow the second star and the slash it carries
        }
        else {
          source += '.*';
          i++;
        }
      }
      else {
        source += '[^/]*';
      }
    }
    else if (char === '?') {
      source += '[^/]';
    }
    else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  try {
    return new RegExp(`^${source}$`);
  }
  catch {
    return undefined;
  }
}

/**
 * Matcher over workspace relative paths for the exclude globs of the panel
 * settings, so watcher events and the scan ignore the same files.
 */
export function compileExcludes(excludeGlobs: string[]): (path: string) => boolean {
  const patterns = excludeGlobs
    .map(glob => glob.trim())
    .filter(Boolean)
    .map(compilePathGlob)
    .filter((exp): exp is RegExp => !!exp);

  return path => patterns.some(exp => exp.test(path));
}
