/**
 * CHANGELOG.md generator for the `release` npm script.
 *
 * Execution context — bumpp runs this file through `--execute`, i.e. after the
 * new version has been written to `package.json` but BEFORE the release commit
 * and the release tag are created. Three invariants follow from that:
 *
 *   1. `package.json` on disk already holds the NEW version.
 *   2. `git show HEAD:package.json` still holds the OLD version (HEAD is the
 *      last real commit, the release commit does not exist yet).
 *   3. `git log <base>..HEAD` can never contain the release commit itself, so
 *      no commit-message filtering for `chore: release ...` is required.
 *
 * Write rules:
 *   - MINOR / MAJOR bump -> prepend one `## [x.y.z] (date)` section built from
 *     the commits since the previous MINOR release. Patch releases write no
 *     changelog entry, so their commits roll up into the next minor entry.
 *   - PATCH bump         -> CHANGELOG.md is left untouched.
 *   - Prerelease target, unknown previous version, no relevant commits or an
 *     entry for the same minor series already present -> no write at all.
 *
 * Usage: node build/changelog.mjs [--dry-run] [--from <version>] [--to <version>]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const CHANGELOG_FILE = 'CHANGELOG.md';
const PACKAGE_FILE = 'package.json';

/** Ordered changelog sections; the first matching type wins. */
const SECTIONS = [
  { title: 'Features', types: ['feat'] },
  { title: 'Fix', types: ['fix'] },
  { title: 'Performance', types: ['perf'] },
  { title: 'House Keeping', types: ['refactor', 'build', 'ci', 'docs', 'chore', 'style', 'test'] },
];

/** Commits without a known conventional-commit type land here. */
const FALLBACK_SECTION = 'House Keeping';

/** Release plumbing descriptions that must never become changelog entries. */
const IGNORED_CHORE = /^(?:release|bump|update version|version bump)\b/i;
const IGNORED_DOCS = /\bchangelog\b/i;
const IGNORED_SUBJECT = /^release\b/i;

function isIgnoredCommit(commit) {
  // `chore: release v1.2.3`, `chore: bump version`, ...
  if (commit.type === 'chore') {
    return IGNORED_CHORE.test(commit.description);
  }
  // `docs: update changelog for v1.2.3`
  if (commit.type === 'docs') {
    return IGNORED_DOCS.test(commit.description);
  }
  // Non conventional commits, eg. `release v1.2.3`.
  return IGNORED_SUBJECT.test(commit.subject);
}

const CONVENTIONAL_SUBJECT = /^([A-Z]+)(?:\(([^)]*)\))?(!)?:\s*(\S.*)$/i;
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

const FIELD_SEPARATOR = '\u001F';
const RECORD_SEPARATOR = '\u001E';

function say(message) {
  process.stdout.write(`${message}\n`);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function gitOrUndefined(args) {
  try {
    return git(args);
  }
  catch {
    return undefined;
  }
}

function parseArgs(argv) {
  const options = { dryRun: false, from: undefined, to: undefined };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    }
    else if (arg === '--from' || arg === '--to') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`missing value for ${arg}`);
      }
      options[arg === '--from' ? 'from' : 'to'] = value;
      index++;
    }
    else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
}

function parseVersion(input) {
  const matched = VERSION_PATTERN.exec(String(input).trim());
  if (!matched) {
    return undefined;
  }
  return {
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
    prerelease: matched[4],
  };
}

function compareVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) {
      return left[key] < right[key] ? -1 : 1;
    }
  }
  return 0;
}

/** `major` / `minor` / `patch`, or `none` when the version did not increase. */
function resolveBumpType(previous, next) {
  if (compareVersions(next, previous) <= 0) {
    return 'none';
  }
  if (next.major !== previous.major) {
    return 'major';
  }
  if (next.minor !== previous.minor) {
    return 'minor';
  }
  return 'patch';
}

function readPackageVersion(file) {
  return parseVersion(JSON.parse(readFileSync(file, 'utf8')).version);
}

/** Version of the last commit — at this point `package.json` is already bumped. */
function resolvePreviousVersion() {
  const committed = gitOrUndefined(['show', `HEAD:${PACKAGE_FILE}`]);
  if (committed) {
    const version = parseVersion(JSON.parse(committed).version);
    if (version) {
      return version;
    }
  }
  say('[changelog] warn: cannot read the previous version from git, falling back to the latest tag');
  const tags = listVersionTags().filter(tag => !tag.version.prerelease);
  return tags.at(-1)?.version;
}

function listVersionTags() {
  const output = gitOrUndefined(['tag', '--list']);
  if (!output) {
    return [];
  }
  return output
    .split('\n')
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => ({ name, version: parseVersion(name) }))
    .filter(tag => tag.version)
    .sort((left, right) => compareVersions(left.version, right.version));
}

/**
 * Base of the commit range: the tag of the previous MINOR release, because only
 * minor (and major) releases get a changelog entry. Falls back to the latest
 * tag, then to the root commit, then to the whole history.
 */
function resolveBaseRef(next) {
  const previousTags = listVersionTags().filter(tag => compareVersions(tag.version, next) < 0);
  const minorReleases = previousTags.filter(tag => tag.version.patch === 0 && !tag.version.prerelease);
  const baseTag = minorReleases.at(-1) ?? previousTags.at(-1);
  if (baseTag) {
    return baseTag.name;
  }
  return gitOrUndefined(['rev-list', '--max-parents=0', 'HEAD']);
}

function collectCommits(baseRef) {
  const format = ['%H', '%h', '%s'].join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
  const range = baseRef ? `${baseRef}..HEAD` : 'HEAD';
  const raw = gitOrUndefined(['log', '--no-merges', `--pretty=format:${format}`, range]);
  if (!raw) {
    return [];
  }
  return raw
    .split(RECORD_SEPARATOR)
    .map(record => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, shortHash, subject] = record.split(FIELD_SEPARATOR);
      return { hash, shortHash, subject, ...parseSubject(subject) };
    })
    .filter(commit => !isIgnoredCommit(commit));
}

function parseSubject(subject) {
  const matched = CONVENTIONAL_SUBJECT.exec(subject);
  if (!matched) {
    return { type: undefined, scope: undefined, description: subject, breaking: false };
  }
  return {
    type: matched[1].toLowerCase(),
    scope: matched[2],
    breaking: matched[3] === '!',
    description: matched[4].trim(),
  };
}

function sectionTitleOf(type) {
  const section = SECTIONS.find(item => item.types.includes(type));
  return section ? section.title : FALLBACK_SECTION;
}

function groupCommits(commits) {
  const grouped = new Map(SECTIONS.map(item => [item.title, []]));
  for (const commit of commits) {
    grouped.get(sectionTitleOf(commit.type))?.push(commit);
  }
  return SECTIONS
    .filter(item => grouped.get(item.title).length > 0)
    .map(item => ({ title: item.title, commits: grouped.get(item.title) }));
}

function resolveRepoUrl() {
  const remote = gitOrUndefined(['remote', 'get-url', 'origin']);
  if (!remote) {
    return undefined;
  }
  const cleaned = remote.replace(/^(?:https?|ssh):\/\//, '').replace(/^git@/, '');
  const matched = /^([^/:]+)[/:](.+?)(?:\.git)?$/.exec(cleaned);
  if (!matched) {
    return undefined;
  }
  return `https://${matched[1]}/${matched[2]}`;
}

function renderEntry(commit, repoUrl) {
  const text = commit.scope ? `**${commit.scope}:** ${commit.description}` : commit.description;
  const breaking = commit.breaking ? ' (**breaking change**)' : '';
  const link = repoUrl
    ? ` ([${commit.shortHash}](${repoUrl}/commit/${commit.hash}))`
    : ` (${commit.shortHash})`;
  return `${text}${breaking}${link}`;
}

function renderSection(version, date, groups, repoUrl) {
  const lines = [`## [${version}] (${date})`, ''];
  for (const group of groups) {
    lines.push(`### ${group.title}`, '');
    for (const commit of group.commits) {
      lines.push(`* ${renderEntry(commit, repoUrl)}`);
    }
    lines.push('');
  }
  return lines;
}

/** Insert the new section right after the `# Change Log` title. */
function insertSection(content, section) {
  const lines = content.split('\n');
  const titleIndex = lines.findIndex(line => /^#\s+\S/.test(line));
  const insertAt = titleIndex === -1 ? 0 : titleIndex + 1;
  const next = [...lines];
  next.splice(insertAt, 0, '', ...section);
  return next.join('\n');
}

/** True when the changelog already documents this version or its minor series. */
function hasVersionEntry(content, version) {
  const pattern = new RegExp(
    `^##\\s+\\[v?${version.major}\\.${version.minor}(?:\\.\\d+|\\.x)\\]`,
    'm',
  );
  return pattern.test(content);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const next = options.to ? parseVersion(options.to) : readPackageVersion(PACKAGE_FILE);
  if (!next) {
    say('[changelog] skip: cannot resolve the new version');
    return;
  }
  const previous = options.from ? parseVersion(options.from) : resolvePreviousVersion();
  if (!previous) {
    say('[changelog] skip: cannot resolve the previous version');
    return;
  }

  const bump = resolveBumpType(previous, next);
  const version = `${next.major}.${next.minor}.${next.patch}`;

  if (bump === 'none') {
    say(`[changelog] skip: version did not increase (${version})`);
    return;
  }
  if (bump === 'patch') {
    say(`[changelog] skip: ${version} is a patch release, ${CHANGELOG_FILE} is left untouched`);
    return;
  }
  if (next.prerelease) {
    say(`[changelog] skip: ${version} is a prerelease, ${CHANGELOG_FILE} is left untouched`);
    return;
  }

  const content = readFileSync(CHANGELOG_FILE, 'utf8');
  if (hasVersionEntry(content, next)) {
    say(`[changelog] skip: ${CHANGELOG_FILE} already documents ${next.major}.${next.minor}.x`);
    return;
  }

  const baseRef = resolveBaseRef(next);
  const groups = groupCommits(collectCommits(baseRef));
  if (groups.length === 0) {
    say(`[changelog] skip: no changelog-worthy commit since ${baseRef ?? 'the first commit'}`);
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const repoUrl = resolveRepoUrl();
  const section = renderSection(version, date, groups, repoUrl);

  if (options.dryRun) {
    say(section.join('\n'));
    return;
  }

  writeFileSync(CHANGELOG_FILE, insertSection(content, section));
  const total = groups.reduce((count, group) => count + group.commits.length, 0);
  say(`[changelog] ${version} (${bump}): ${total} commit(s) since ${baseRef ?? 'the first commit'} added to ${CHANGELOG_FILE}`);
}

main().catch((error) => {
  console.error(`[changelog] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
