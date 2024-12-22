import type * as vscode from 'vscode';
import type { Handler } from './langs/common';
import * as configuration from '../configuration';
import { CommonHandler } from './langs/common';
import { PlainTextHandler } from './langs/plaintext';

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

export function triggerUpdateDecorations(editor: vscode.TextEditor) {
  const configuratgion = configuration.getConfigurationFlatten();
  return useHandler(editor.document.languageId).triggerUpdateDecorations(editor, configuratgion.updateDelay);
}
