import { CommonHandler } from './langs/common';
import { PlainTextHandler } from './langs/plaintext';

import type { Handler } from './langs/common';
import type * as vscode from 'vscode';

function newHandler(editor: vscode.TextEditor): Handler {
  switch (editor.document.languageId) {
    case 'plaintext':
      return new PlainTextHandler(editor);
    default:
      return new CommonHandler(editor);
  }
}

const cached = new Map<string, Handler>();
let triggerUpdateTimeout: NodeJS.Timer | undefined;

export function updateDecorations(editor: vscode.TextEditor) {
  let handler = cached.get(editor.document.languageId);

  if (!handler) {
    handler = newHandler(editor);
    cached.set(editor.document.languageId, handler);
  }

  if (handler.getEditor() !== editor) {
    handler.setEditor(editor);
  }

  if (triggerUpdateTimeout) {
    clearTimeout(triggerUpdateTimeout);
  }

  return handler.updateDecorations();
}

export function triggerUpdateDecorations(editor: vscode.TextEditor, timeout = 100) {
  triggerUpdateTimeout = setTimeout(() => {
    updateDecorations(editor);
  }, timeout);
}
