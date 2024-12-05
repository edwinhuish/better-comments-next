import { CommonHandler } from './langs/common';
import { PlainTextHandler } from './langs/plaintext';

import * as vscode from 'vscode';

import type { Handler } from './langs/common';

const cached = new Map<string, Handler>();
let triggerUpdateTimeout: NodeJS.Timer | undefined;

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

export function updateDecorations(editor: vscode.TextEditor) {
  if (triggerUpdateTimeout) {
    clearTimeout(triggerUpdateTimeout);
  }

  return useHandler(editor.document.languageId).updateDecorations(editor);
}

export function triggerUpdateDecorations(editor: vscode.TextEditor, timeout = 100) {
  triggerUpdateTimeout = setTimeout(() => {
    if (vscode.window.activeTextEditor !== editor) {
      return;
    }
    updateDecorations(editor);
  }, timeout);
}
