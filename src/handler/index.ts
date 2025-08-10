import * as vscode from 'vscode';
import * as configuration from '@/configuration';
import * as handler from './handler';

export * from './event';
export * from './handler';

configuration.onDidChange((config) => {
  for (const editor of vscode.window.visibleTextEditors) {
    handler.triggerUpdateDecorations({ editor });
  }
});
