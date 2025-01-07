import type { Handler, UpdateOptions } from './modules/common';
import * as configuration from '../configuration';
import { CommonHandler } from './modules/common';
import { PlainTextHandler } from './modules/plaintext';

const cached = new Map<string, Handler>();

function newHandler(languageId: string): Handler {
  switch (languageId) {
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

export function triggerUpdateDecorations(options: UpdateOptions) {
  const configuratgion = configuration.getConfigurationFlatten();
  return useHandler(options.editor.document.languageId).triggerUpdateDecorations({ ...options, timeout: configuratgion.updateDelay });
}
