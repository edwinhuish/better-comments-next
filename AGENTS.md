# AGENTS.md

> Guidelines for AI agents (and human contributors) working on **Better Comments Next**.
> This document describes the project, the agent's role, available tools, workflows,
> I/O conventions, error handling, security constraints, and coding standards.
> Related documents: [`README.md`](./README.md), [`CHANGELOG.md`](./CHANGELOG.md), [`TODO.md`](./TODO.md).

---

## 1. Project Overview & Goals

**Better Comments Next** is a VS Code extension (forked from
[aaron-bond/better-comments v3.0.2](https://github.com/aaron-bond/better-comments)) that
improves code readability by highlighting annotated comments (`!`, `?`, `TODO`, `//`, etc.)
via [TextEditorDecorationType](https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType).

### Goals

1. **Correctness** — accurate tag matching across all languages, including embedded
   languages (Vue SFC, HTML, Markdown) and multi-line comments.
2. **Performance** — decorations must update fast enough for interactive typing on
   large files (see `better-comments.updateDelay` / `better-comments.preloadLines`).
3. **Compatibility** — run in Node.js host *and* VS Code for the Web (dual build via tsup).
4. **Extensibility** — user-configurable tags (`text` / `wildcard` / `regex` modes),
   light/dark theme overrides, and custom language comment definitions.

### Tech Stack

| Concern     | Choice                                                    |
| ----------- | --------------------------------------------------------- |
| Language    | TypeScript (strict mode, `target: ES2022`)                |
| Build       | tsup → `dist/extension.js` (node) + `dist/extension.web.js` (web) |
| Lint        | ESLint 9 + `@antfu/eslint-config`                         |
| Package mgr | pnpm (workspace)                                          |
| Hooks       | husky + lint-staged (tsc + eslint on pre-commit)          |

### Source Layout

```
src/
├── extension.ts          # Activation entry point
├── configuration/        # Tag/theme config, decoration types, caching
├── definition/           # Per-language comment tokens (from all installed extensions)
├── handler/              # Decoration computation pipeline (per-language subclasses)
│   └── modules/          # common / plaintext / python / react / shellscript
├── log/                  # OutputChannel logger
└── utils/                # regex compilers, string helpers, promise helpers
samples/                  # Sample files in 60+ languages (also future test fixtures)
```

**Core data flow**:
`configuration.activate` → `definition.activate` (scan all extensions' `contributes.languages`)
→ `handler.activate` (listen to editor events) → `Handler.triggerUpdateDecorations`
(regex scan → `vscode.Range` list → `editor.setDecorations`).

---

## 2. Agent Role & Responsibilities

The agent acts as a **senior TypeScript/VS Code extension developer** collaborating on this repo.

### In Scope

- Implementing bug fixes and features listed in [`TODO.md`](./TODO.md).
- Refactoring (e.g., extracting pure matching functions, deduplicating Handler subclasses).
- Writing/running lint, type checks, and builds; authoring tests (see TODO.md §P3).
- Updating docs (`README.md`, `CHANGELOG.md`, `TODO.md`) when behavior changes.

### Out of Scope

- Publishing to the marketplace (`vsce publish`) — human only.
- Changing the fork lineage, license, or `publisher` identity.
- Introducing new runtime dependencies without explicit user approval
  (currently the only runtime dependency is `json5`).
- Committing or pushing unless the user explicitly asks. When asked, commit
  messages MUST follow §4 "Git Commit Rules" (English, Conventional Commits).

### Autonomy Rules

- **State assumptions and proceed** — do not block on questions when a reasonable
  default exists; record the assumption in the final summary.
- **Preserve user edits** — re-read files before editing if they may have changed.
- **Minimal diffs** — never rewrite large files wholesale; prefer targeted edits.

---

## 3. Available Tools & How to Invoke Them

| Tool                | When to Use                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| `read_file`         | Read specific files (prefer `readSymbol`-style targeted reads when available). |
| `search_file`       | Locate files by glob (e.g. `**/*.ts`).                                   |
| `search_content`    | Exact-text/regex search: comments, config keys, log strings.             |
| `list_dir`          | Explore directory structure.                                             |
| `replace_in_file`   | Targeted edits (always read the file first).                             |
| `write_to_file`     | Create new files or full rewrites (only when necessary).                 |
| `execute_command`   | Run pnpm scripts, git read-only commands. Non-interactive flags required. |
| `read_lints`        | Check diagnostics on edited files before finishing.                      |
| LSP (if available)  | Semantic navigation: `documentSymbol`, `workspaceSymbol`, `hover`, `findReferences`, `readSymbol`. Prefer over text search for symbol queries. |

### Commands Reference

```bash
pnpm install            # bootstrap
pnpm lint               # tsc --noEmit + eslint --fix (must pass with 0 warnings)
pnpm build              # node build → dist/extension.js
pnpm build-web          # web build → dist/extension.web.js
pnpm watch              # node build in watch mode
pnpm package            # clean + lint + build + build-web (release path)
pnpm release            # bump version (bumpp) + update CHANGELOG.md on minor/major
```

`pnpm release` runs `bumpp --all --execute "node build/changelog.mjs"`: bumpp bumps
`package.json`, then `build/changelog.mjs` runs **before** the release commit/tag so
the changelog lands in the very same `chore: release vX.Y.Z` commit. Rules:

- **minor / major bump** → prepend one `## [x.y.z] (date)` section built from the
  commits since the previous minor release tag (patch releases are not logged, so
  their commits roll up into the next minor entry).
- **patch bump / prerelease / duplicate version / no relevant commits** → `CHANGELOG.md`
  is not written at all.
- Preview without touching the file: `node build/changelog.mjs --dry-run --from 3.5.1 --to 3.6.0`.

---

## 4. Workflow & Task Execution Steps

Follow this order for every non-trivial task:

1. **Understand** — locate the relevant module with `search_file`/`search_content`/LSP.
   Read enough context to confirm the current behavior; do not guess.
2. **Plan** — for multi-step tasks, record a todo list; keep items user-visible
   (feature-level), not file-level trivia.
3. **Implement**
   - Read the target file immediately before editing it.
   - Use `replace_in_file` with unique, whitespace-exact anchors.
   - Respect the module conventions in §8 (lazy cache + `refresh()` pattern).
4. **Verify**
   - Run `pnpm lint` (type check + eslint) after meaningful changes.
   - Check diagnostics with `read_lints` on files you touched; fix clear errors
     (max 3 fix iterations per file, then ask the user).
   - If tests exist (future: vitest / @vscode/test-cli), run them.
5. **Report** — summarize what changed, why, and any assumptions or follow-ups.
   Reference code as ` ```startLine:endLine:path ``` ` blocks.
6. **TODO.md hygiene** — when a TODO item is completed, tick its checkbox in
   `TODO.md` and note the change.

### Git Commit Rules

- **Language**: commit messages MUST be written in **English**, matching the
  project's documentation language (README / CHANGELOG / code comments in English).
  Chinese (or any other language) commit messages are not allowed, regardless of
  the language used in conversation.
- **Format**: follow [Conventional Commits](https://www.conventionalcommits.org/)
  — `type(scope): subject`.
  - Allowed `type`: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
    `ci`, `style`, `chore`, `revert`.
  - `scope` (optional) is a module name: `configuration`, `definition`,
    `handler`, `utils`, `log`, or a file base name.
  - `subject`: imperative mood, lowercase start, no trailing period, ≤ 72 chars.
  - Reference issues when applicable (e.g. `(#7)` or `closes #7` in the body).
- **Examples**:

  ```bash
  # good
  git commit -m "fix(handler): scope debounce timers and task tokens per document uri"
  git commit -m "perf(regex): cache compiled tag matchers on config refresh"
  git commit -m "docs: add AGENTS.md for agent collaboration"

  # bad
  git commit -m "修复多编辑器互相取消的问题"   # non-English
  git commit -m "update code"                 # not descriptive, no type
  git commit -m "Fixed the bug in the handler module that caused decorations to be lost."  # past tense, too long
  ```

---

## 5. Input / Output Format Requirements

### Inputs the Agent Should Expect

- Natural-language tasks (Chinese or English).
- Issue references (`#NNN`), stack traces, editor diagnostics.
- Configuration snippets in **jsonc** (VS Code `settings.json` style).

### Outputs the Agent Should Produce

- **Code**: TypeScript in `src/`, following §8.
- **Explanations**: concise; use backticks for file/function/identifier names;
  inline math with `\(...\)`.
- **Code citations**: exactly
  ` ```12:15:src/handler/modules/common.ts ``` ` (startLine:endLine:filepath).
- **Config examples**: jsonc with comments allowed, 4-space indent (matches
  `jsonc/indent` rule for `package.json`).
- **Changelog entries**: the `release` script generates them under a new
  `## [x.y.z] (date)` heading using the sections `### Features` / `### Fix` /
  `### Performance` / `### House Keeping` (mapped from the conventional-commit type).

---

## 6. Error Handling & Exception Response

### In the Codebase (conventions to follow when writing code)

- **Cancellation** — long decoration tasks check `verifyTaskID(taskID)` and throw
  `CancelError` (`src/utils/utils.ts`). Callers must swallow `CancelError` and
  rethrow everything else. Any `setTimeout(async ...)` callback MUST wrap its body
  in try/catch to avoid unhandled rejections (see TODO.md B2).
- **User config is untrusted** — tag/language settings may be malformed. Validate
  and degrade silently (skip the bad item + `log.warn`); never let a bad value
  throw during decoration updates.
- **File I/O** (`vscode.workspace.fs.readFile` in `definition`) — wrap in try/catch,
  log via `log.error`, and return `undefined` to fall back to default comments.
- **Regex safety** — never construct `RegExp` from user input without going through
  `src/utils/regex.ts` (`escape`, `compileGlob`, `compileRegex`); invalid or
  dangerous patterns must fall back to a literal match.

### For the Agent Itself

| Situation                     | Response                                                                   |
| ----------------------------- | -------------------------------------------------------------------------- |
| `replace_in_file` fails       | Re-read the file, then retry with a corrected anchor (do not guess).        |
| Lint errors after edit        | Fix if obvious; stop and ask after 3 failed attempts on the same file.      |
| Command needs interaction     | Use non-interactive flags (`--yes`, `| cat`); never assume a user is present.|
| Ambiguous requirement         | State an assumption and continue; only ask when truly blocked.              |
| Destructive git operations    | Never run (reset/force-push/amend) without explicit user request.           |

---

## 7. Security & Privacy Constraints

1. **No telemetry, no network** — the extension must not make network calls or
   collect user data. Do not add analytics or update-checkers.
2. **Workspace-only access** — file reads are limited to
   `vscode.workspace.fs` on extension-provided URIs. Never read outside the
   workspace or exfiltrate paths/content.
3. **Untrusted input** — user settings, language-configuration files (parsed with
   json5), and document text are all untrusted. Guard against:
   - **ReDoS** — arbitrary user regexes (`tagMode: "regex"`) must stay bounded
     (length limits, nested-quantifier rejection; see TODO.md P4).
   - **Prototype pollution / injection** — do not `eval`, never build code strings
     from config; only regex/JSON parsing is allowed.
4. **Secrets** — never hard-code tokens; never commit `.env`, publisher keys, or
   personal access tokens. `pnpm-lock.yaml` is the source of dependency truth.
5. **Logs** — the OutputChannel must not log file contents or user settings
   wholesale at `info` level; log identifiers and counts instead.
6. **Agent hygiene** — do not delete `.codebuddy/` or `.vscode-test/` directories;
   do not modify `.git/config` or git hooks behavior.

---

## 8. Code & Configuration Standards

### TypeScript

- **Strict mode** — `tsconfig.json` enables `strict`, `noImplicitAny`,
  `noImplicitReturns`, `noUnusedLocals`. Do not weaken these; avoid new `!`
  non-null assertions and `any` unless interfacing with untyped VS Code payloads.
- **Imports** — use the path alias `@/*` → `src/*` (`tsconfig.json` `paths`);
  order: type imports first (`import type`), then aliased internals, then `vscode`.
- **Naming** — `PascalCase` for classes/types, `camelCase` for functions/vars,
  `SCREAMING_SNAKE_CASE` for regex fragment constants (`SP`, `BR`, `ANY`, `TAG_SUFFIX`).

### Style (enforced by `@antfu/eslint-config`, 0 warnings allowed)

- Semicolons required (`style/semi: always`); quotes single (antfu default).
- `curly: all` — always use braces for `if`/`for`.
- Max 1 statement per line; property quotes only when needed (`quote-props: as-needed`).
- `package.json` / jsonc: **4-space indent**.
- `unicorn/prefer-node-protocol` is off; `no-cond-assign` is off (regex exec loops
  like `while ((m = exp.exec(text)))` are idiomatic here).

### Module Conventions (follow existing patterns)

- **Lazy cache + refresh** — module-level caches (`let config`, `Map<string, T>`)
  are populated on first access and cleared by a module-level `refresh()`.
  Any new cached value MUST be added to the corresponding `refresh()` (see
  `configuration.ts:74-92` — missing one entry causes stale-config bugs).
- **Event bus** — cross-module reactivity uses `onDidChange(callback)` registries
  (see `configuration/event.ts`), not direct imports of listeners.
- **Handler subclassing** — language-specific behavior subclasses
  `CommonHandler` and overrides only the minimal `pick*Slices` hook. When adding
  a language, prefer a new `Language` subclass in `definition/modules/` or a new
  entry in `getDefaultComments` over duplicating handler logic.
- **Regex fragments** — compose patterns from the shared constants in
  `src/utils/regex.ts`; document any `lastIndex` manual-rewind trick with the
  invariant it maintains.

### Configuration & Metadata

- `package.json`: 4-space indent; keep `keywords`, `contributes.configuration`
  descriptions in sync when adding settings; update `engines.vscode` if a new API
  is used and verify the API's minimum version.
- Builds must succeed for **both** targets (`pnpm build` and `pnpm build-web`);
  web build runs in a browser sandbox — no Node-only APIs outside tsup `inject`/
  `noExternal` handling.

### Documentation

- Markdown, English, sentence-style headings; relative links between docs.
- User-facing settings documented in `README.md` Configuration section (jsonc example)
  *and* `package.json` descriptions — keep both in sync.
- `CHANGELOG.md`: minor/major releases get a generated entry under `### Features` /
  `### Fix` / `### Performance` / `### House Keeping`; patch releases add nothing.
- `TODO.md`: tick completed items; add new discovered work under the right priority
  group (P0 correctness → P1 performance → P2 refactoring → P3 tests/CI).

### Example: Adding a New Config Option (reference pattern)

```jsonc
// package.json → contributes.configuration.properties
{
  "better-comments.exampleOption": {
    "type": "boolean",
    "description": "What the option does, one sentence.",
    "default": false
  }
}
```

```ts
// src/configuration/configuration.ts
interface Configuration {
  exampleOption: boolean; // 1. declare in the interface
}
// 2. lazy caches holding derived state must be reset in refresh()
```

```ts
// src/handler/modules/common.ts — consuming the option
const { exampleOption } = configuration.getConfigurationFlatten(); // 3. read via flatten
if (exampleOption) {
  // 4. document README section + CHANGELOG entry
}
```
