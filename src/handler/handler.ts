import type { Handler, UpdateParams } from './modules/common';
import * as configuration from '../configuration';
import { CommonHandler } from './modules/common';
import { PlainTextHandler } from './modules/plaintext';
import { ReactHandler } from './modules/react';
import { ShellscriptHandler } from './modules/shellscript';

const cached = new Map<string, Handler>();

function newHandler(languageId: string): Handler {
  switch (languageId) {
    case 'javascriptreact':
    case 'typescriptreact':
      return new ReactHandler(languageId);
    case 'shellscript':
      return new ShellscriptHandler(languageId);
    case 'plaintext':
      return new PlainTextHandler(languageId);
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
  const configuratgion = configuration.getConfigurationFlatten();
  return useHandler(params.editor.document.languageId).triggerUpdateDecorations({ ...params, timeout: configuratgion.updateDelay });
}
