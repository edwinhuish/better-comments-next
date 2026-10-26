import type { Uri } from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelWatcher } from './watch';

const mocks = vi.hoisted(() => ({
  createFileSystemWatcher: vi.fn(),
  asRelativePath: vi.fn(),
}));

vi.mock('vscode', () => ({
  workspace: {
    createFileSystemWatcher: mocks.createFileSystemWatcher,
    asRelativePath: mocks.asRelativePath,
  },
}));

type Event = 'change' | 'create' | 'delete';
type Handler = (uri: Uri) => void;

function fileUri(path: string): Uri {
  return { toString: () => `file://${path}`, path } as unknown as Uri;
}

/** one object per file: the fake `toString` closures would never be equal */
const A = fileUri('/a.ts');
const B = fileUri('/b.ts');
const LOG = fileUri('/debug.log');

/** a FileSystemWatcher double that hands out its registered handlers */
function installWatcher() {
  const handlers: Record<Event, Handler[]> = { change: [], create: [], delete: [] };
  const disposable = {
    dispose: vi.fn(),
    onDidChange: vi.fn((cb: Handler) => handlers.change.push(cb)),
    onDidCreate: vi.fn((cb: Handler) => handlers.create.push(cb)),
    onDidDelete: vi.fn((cb: Handler) => handlers.delete.push(cb)),
  };

  mocks.createFileSystemWatcher.mockReturnValueOnce(disposable);
  mocks.createFileSystemWatcher.mockClear();

  return {
    disposable,
    emit(event: Event, uri: Uri) {
      for (const handler of handlers[event]) {
        handler(uri);
      }
    },
  };
}

function createPanelWatcher(params: Partial<ConstructorParameters<typeof PanelWatcher>[0]> = {}) {
  const onFlush = vi.fn();
  const watcher = new PanelWatcher({
    includeGlobs: [],
    isExcluded: () => false,
    onFlush,
    ...params,
  });

  return { onFlush, watcher };
}

describe('panel watcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.createFileSystemWatcher.mockReset();
    mocks.asRelativePath.mockReset();
    mocks.asRelativePath.mockImplementation((uri: Uri) => uri.path);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('watches the include globs of the settings', () => {
    installWatcher();
    createPanelWatcher({ includeGlobs: ['src/**', '*.md'] });

    expect(mocks.createFileSystemWatcher).toHaveBeenCalledWith('{src/**,*.md}');
  });

  it('flushes every collected event as one batch', () => {
    const { emit } = installWatcher();
    const { onFlush, watcher } = createPanelWatcher();

    emit('change', A);
    emit('create', B);
    vi.advanceTimersByTime(500);

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([A, B], []);

    watcher.dispose();
  });

  it('counts a file that changed and was deleted as deleted', () => {
    const { emit } = installWatcher();
    const { onFlush, watcher } = createPanelWatcher();

    emit('change', A);
    emit('delete', A);
    vi.advanceTimersByTime(500);

    expect(onFlush).toHaveBeenCalledWith([], [A]);

    watcher.dispose();
  });

  it('ignores files the exclude globs drop', () => {
    const { emit } = installWatcher();
    const { onFlush, watcher } = createPanelWatcher({
      isExcluded: path => path.endsWith('.log'),
    });

    emit('change', LOG);
    vi.advanceTimersByTime(500);

    expect(onFlush).not.toHaveBeenCalled();

    watcher.dispose();
  });

  it('keeps collecting while the flush timer runs', () => {
    const { emit } = installWatcher();
    const { onFlush, watcher } = createPanelWatcher();

    emit('change', A);
    vi.advanceTimersByTime(300); // still inside the window
    emit('change', B);
    vi.advanceTimersByTime(200); // the first timer fires, both are in

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([A, B], []);

    watcher.dispose();
  });

  it('stays quiet when nothing happened', () => {
    installWatcher();
    const { onFlush, watcher } = createPanelWatcher();

    vi.advanceTimersByTime(2000);

    expect(onFlush).not.toHaveBeenCalled();

    watcher.dispose();
  });

  it('honours a custom debounce', () => {
    const { emit } = installWatcher();
    const { onFlush, watcher } = createPanelWatcher({ debounce: 100 });

    emit('change', fileUri('/a.ts'));
    vi.advanceTimersByTime(99);
    expect(onFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFlush).toHaveBeenCalledTimes(1);

    watcher.dispose();
  });

  it('cancels the pending batch when disposed', () => {
    const { disposable, emit } = installWatcher();
    const { onFlush, watcher } = createPanelWatcher();

    emit('change', A);
    watcher.dispose();
    vi.advanceTimersByTime(1000);

    expect(onFlush).not.toHaveBeenCalled();
    expect(disposable.dispose).toHaveBeenCalled();
  });
});
