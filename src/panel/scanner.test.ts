import type { Uri } from 'vscode';
import type { TagStore } from './store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelScanner } from './scanner';
import { TagStore as Store } from './store';

const mocks = vi.hoisted(() => ({
  findFiles: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  asRelativePath: vi.fn(),
  multilineTags: [] as string[],
  lineTags: ['todo', 'to-do'] as string[],
  panel: {
    enabled: true,
    groupBy: 'file' as string,
    autoRefresh: true,
    scanOnStartup: true,
    includeGlobs: [] as string[],
    excludeGlobs: [] as string[],
    useGitignore: false,
    maxFileSize: 512,
    maxFiles: 5000,
    showCounts: true,
  },
  highlightPlainText: false,
  languageId: 'typescript' as string | undefined,
}));

vi.mock('vscode', () => ({
  workspace: {
    findFiles: mocks.findFiles,
    asRelativePath: mocks.asRelativePath,
    fs: { readFile: mocks.readFile, stat: mocks.stat },
  },
  window: { createOutputChannel: () => ({ appendLine: vi.fn() }) },
}));

vi.mock('@/configuration', () => ({
  getPanelConfiguration: () => mocks.panel,
  getMatcherOptions: () => ({
    strict: false,
    fullHighlight: false,
    multilineTags: mocks.multilineTags,
    lineTags: mocks.lineTags,
    // both spellings resolve to the same group, like aliases of one config tag
    tagPatterns: [
      { key: 'todo', test: /^todo$/i },
      { key: 'todo', test: /^to-do$/i },
    ],
  }),
  isLanguageEnabled: (languageId: string) => languageId !== 'plaintext' || mocks.highlightPlainText,
}));

vi.mock('@/definition', () => ({
  getLanguageIdByUri: () => mocks.languageId,
  getAvailableComments: async () => ({ lineComments: ['//'], blockComments: [['/*', '*/']] }),
  useLanguage: () => ({ isUseDocComment: () => true }),
}));

function fileUri(path: string): Uri {
  return { toString: () => `file://${path}`, path } as unknown as Uri;
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** the workspace walk returns `files`, the gitignore walk nothing */
function workspaceFiles(files: Uri[]) {
  mocks.findFiles.mockImplementation(async (include: string) => (include === '**/.gitignore' ? [] : files));
}

function store(): TagStore {
  return new Store();
}

describe('panel scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.panel.useGitignore = false;
    mocks.panel.includeGlobs = [];
    mocks.panel.excludeGlobs = [];
    mocks.panel.maxFileSize = 512;
    mocks.panel.maxFiles = 5000;
    mocks.highlightPlainText = false;
    mocks.languageId = 'typescript';
    mocks.multilineTags = [];
    mocks.lineTags = ['todo', 'to-do'];
    mocks.stat.mockResolvedValue({ size: 32 });
    mocks.asRelativePath.mockImplementation((uri: Uri) => uri.path);
  });

  it('stores the tags of every file it scans', async () => {
    const a = fileUri('/a.ts');
    const b = fileUri('/b.ts');
    workspaceFiles([a, b]);
    mocks.readFile.mockImplementation(async (uri: Uri) => encode(uri.path === '/a.ts'
      ? '// TODO: alpha\nconst x = 1;\n'
      : 'const y = 2; // to-do: beta\n'));

    const tags = store();
    const result = await new PanelScanner(tags).scan();

    expect(result).toEqual({ files: 2, tags: 2, cancelled: false });
    expect(tags.get('file:///a.ts')).toMatchObject([{ key: 'todo', line: 0, text: 'alpha', labeled: 'TODO: alpha' }]);
    expect(tags.get('file:///b.ts')).toMatchObject([{ key: 'todo', line: 0, character: 16 }]);

    // both spellings are the same configured tag: one group, two comments
    expect(tags.groupByTag().map(group => [group.key, group.items.length])).toEqual([['todo', 2]]);
  });

  it('shows one item for a multiline comment, not one per line', async () => {
    const a = fileUri('/a.ts');
    workspaceFiles([a]);
    mocks.multilineTags = ['todo'];
    mocks.lineTags = [];
    mocks.readFile.mockImplementation(async () => encode('// TODO: fix it\n//   and the rest\n'));

    const tags = store();
    const result = await new PanelScanner(tags).scan();

    expect(result.tags).toBe(1);
    expect(tags.get('file:///a.ts')).toHaveLength(1);
    expect(tags.get('file:///a.ts')![0]).toMatchObject({ text: 'fix it', labeled: 'TODO: fix it', line: 0 });
  });

  it('passes the settings of the panel to the file search', async () => {
    workspaceFiles([]);
    mocks.panel.includeGlobs = ['src/**'];
    mocks.panel.excludeGlobs = ['**/.git/**'];
    mocks.panel.maxFiles = 10;

    await new PanelScanner(store()).scan();

    expect(mocks.findFiles).toHaveBeenCalledWith('{src/**}', '{**/.git/**}', 10, undefined);
  });

  it('adds the globs of every gitignore to the exclude pattern', async () => {
    const gitignore = fileUri('/.gitignore');
    mocks.findFiles.mockImplementation(async (include: string) => (include === '**/.gitignore' ? [gitignore] : []));
    mocks.readFile.mockImplementation(async () => encode('# comment\nnode_modules\n!keep\n'));
    mocks.panel.useGitignore = true;

    await new PanelScanner(store()).scan();

    const exclude = mocks.findFiles.mock.calls.at(-1)?.[1] as string;
    expect(exclude).toBe('{**/node_modules,**/node_modules/**}');
  });

  it('scans only the given files when they are passed', async () => {
    const a = fileUri('/a.ts');
    mocks.readFile.mockImplementation(async () => encode('// TODO: alpha\n'));

    const result = await new PanelScanner(store()).scan({ files: [a] });

    expect(mocks.findFiles).not.toHaveBeenCalled();
    expect(result.files).toBe(1);
  });

  it('skips a file no language claims', async () => {
    const a = fileUri('/a.unknownext');
    workspaceFiles([a]);
    mocks.languageId = undefined;

    const tags = store();
    const result = await new PanelScanner(tags).scan();

    expect(result).toEqual({ files: 1, tags: 0, cancelled: false });
    expect(tags.size).toBe(0);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('skips plain text unless the setting highlights it', async () => {
    const notes = fileUri('/notes.txt');
    workspaceFiles([notes]);
    mocks.languageId = 'plaintext';

    const tags = store();
    await new PanelScanner(tags).scan();
    expect(tags.size).toBe(0);

    mocks.highlightPlainText = true;
    mocks.readFile.mockImplementation(async () => encode('TODO: no marks\n'));
    await new PanelScanner(tags).scan();

    expect(tags.get('file:///notes.txt')).toHaveLength(1);
  });

  it('skips a file larger than the size limit', async () => {
    const big = fileUri('/big.ts');
    workspaceFiles([big]);
    mocks.panel.maxFileSize = 1; // kilobytes
    mocks.stat.mockResolvedValue({ size: 4096 });

    const tags = store();
    const result = await new PanelScanner(tags).scan();

    expect(result.tags).toBe(0);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('reports its progress chunk by chunk', async () => {
    workspaceFiles([fileUri('/a.ts'), fileUri('/b.ts'), fileUri('/c.ts')]);
    mocks.readFile.mockImplementation(async () => encode('// TODO: x\n'));

    const progress: { done: number; total: number; tags: number }[] = [];
    await new PanelScanner(store()).scan({
      concurrency: 2,
      onProgress: p => progress.push({ ...p }),
    });

    expect(progress).toEqual([
      { done: 0, total: 3, tags: 0 },
      { done: 2, total: 3, tags: 2 },
      { done: 3, total: 3, tags: 3 },
    ]);
  });

  it('stops when its token is canceled', async () => {
    workspaceFiles([fileUri('/a.ts'), fileUri('/b.ts')]);
    mocks.readFile.mockImplementation(async () => encode('// TODO: x\n'));

    const tags = store();
    const result = await new PanelScanner(tags).scan({ token: { isCancellationRequested: true } as never });

    expect(result.cancelled).toBe(true);
    expect(result.files).toBe(0);
    expect(tags.size).toBe(0);
  });

  it('keeps scanning when one file cannot be read', async () => {
    const broken = fileUri('/broken.ts');
    const fine = fileUri('/fine.ts');
    workspaceFiles([broken, fine]);
    mocks.readFile.mockImplementation(async (uri: Uri) => {
      if (uri.path === '/broken.ts') {
        throw new Error('locked');
      }
      return encode('// TODO: x\n');
    });

    const tags = store();
    const result = await new PanelScanner(tags).scan({ concurrency: 1 });

    expect(result).toEqual({ files: 2, tags: 1, cancelled: false });
    expect(tags.get('file:///fine.ts')).toHaveLength(1);
  });
});
