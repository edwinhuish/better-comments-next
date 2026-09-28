import type { Handler, UpdateParams } from './modules/common';
import * as log from '@/log';
import { CancelError } from '@/utils/utils';
import * as configuration from '../configuration';
import { CommonHandler } from './modules/common';
import { PlainTextHandler } from './modules/plaintext';
import { PythonHandler } from './modules/python';
import { ReactHandler } from './modules/react';
import { ShellscriptHandler } from './modules/shellscript';

const cached = new Map<string, Handler>();

// pending debounce timers, keyed by document uri
const updateTimers = new Map<string, NodeJS.Timeout>();

function newHandler(languageId: string): Handler {
  switch (languageId) {
    case 'javascriptreact':
    case 'typescriptreact':
      return new ReactHandler(languageId);
    case 'shellscript':
      return new ShellscriptHandler(languageId);
    case 'plaintext':
      return new PlainTextHandler(languageId);
    case 'python':
      return new PythonHandler(languageId);
    default:
      return new CommonHandler(languageId);
  }
}

function useHandler(languageId: string): Handler {
  let handler = cached.get(languageId);

  if (!handler) {
    handler = newHandler(languageId);
    cached.set(languageId, handler);
  }

  return handler;
}

export function triggerUpdateDecorations(params: UpdateParams) {
  const { updateDelay } = configuration.getConfigurationFlatten();

  // Debounce per document (uri), so concurrent editors never cancel each
  // other's pending updates even when they share the same language handler.
  const uri = params.editor.document.uri.toString();
  const timer = updateTimers.get(uri);
  if (timer) {
    clearTimeout(timer);
  }

  updateTimers.set(uri, setTimeout(async () => {
    updateTimers.delete(uri);
    try {
      await useHandler(params.editor.document.languageId).updateDecorations(params);
    }
    catch (e) {
      if (e instanceof CancelError) {
        return; // superseded by a newer task of the same document
      }
      log.error(e);
    }
  }, updateDelay));
}

/**
 * Cancel all pending update timers and handlers. Called on extension deactivation.
 */
export function dispose() {
  for (const timer of updateTimers.values()) {
    clearTimeout(timer);
  }
  updateTimers.clear();

  for (const handler of cached.values()) {
    handler.dispose();
  }
}
