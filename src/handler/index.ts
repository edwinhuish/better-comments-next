export * from './event';
export * from './handler';

import * as handler from './handler';

import * as vscode from 'vscode';

import * as configuration from '@/configuration';

configuration.onDidChange((config) => {
  for (const editor of vscode.window.visibleTextEditors) {
    handler.triggerUpdateDecorations(editor, 100);
  }
});
