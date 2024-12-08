import * as definition from './definition';

import * as configuration from '../configuration';

import * as vscode from 'vscode';

export type OnDidChangeCallback = () => void;

const onDidChangeCallbacks: OnDidChangeCallback[] = [];
export function onDidChange(callback: OnDidChangeCallback) {
  onDidChangeCallbacks.push(callback);
}

let disposable: vscode.Disposable | undefined;
export function activate(context: vscode.ExtensionContext) {
  const refresh = () => {
    definition.refresh();

    // Run change callbacks
    for (const callback of onDidChangeCallbacks) {
      callback();
    }
  };

  // Refresh languages definitions after extensions changed
  disposable = vscode.extensions.onDidChange(refresh, null, context.subscriptions);

  configuration.onDidChange(refresh);

  // refresh once
  refresh();
}

export function deactivate() {
  if (disposable) {
    disposable.dispose();
  }
}
