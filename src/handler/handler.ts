import { CommonHandler } from './langs/common';
import { PlainTextHandler } from './langs/plaintext';

import type { Handler } from './langs/common';
import type * as vscode from 'vscode';

const cached = new Map<string, Handler>();
let triggerUpdateTimeout: NodeJS.Timer | undefined;

function newHandler(editor: vscode.TextEditor): Handler {
  switch (editor.document.languageId) {
    case 'plaintext':
      return new PlainTextHandler(editor);
    default:
      return new CommonHandler(editor);
  }
}

function useHandler(editor: vscode.TextEditor): Handler {
  let handler = cached.get(editor.document.languageId);

  if (!handler) {
    handler = newHandler(editor);
    cached.set(editor.document.languageId, handler);
  }

  if (handler.getEditor() !== editor) {
    handler.setEditor(editor);
  }

  return handler;
}

export function updateDecorations(editor: vscode.TextEditor) {
  if (triggerUpdateTimeout) {
    clearTimeout(triggerUpdateTimeout);
  }

  return useHandler(editor).updateDecorations();
}

export function triggerUpdateDecorations(editor: vscode.TextEditor, timeout = 100) {
  triggerUpdateTimeout = setTimeout(() => {
    updateDecorations(editor);
  }, timeout);
}
