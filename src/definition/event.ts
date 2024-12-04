import * as definition from './definition';

import * as vscode from 'vscode';

export type OnDidChangeCallback = () => void;

const onDidChangeCallbacks: OnDidChangeCallback[] = [];
export function onDidChange(callback: OnDidChangeCallback) {
  onDidChangeCallbacks.push(callback);
}

let disposable: vscode.Disposable | undefined;
export function registerEvent() {
  const refresh = () => {
    definition.refresh();

    // Run change callbacks
    for (const callback of onDidChangeCallbacks) {
      callback();
    }
  };

  // Refresh languages definitions after extensions changed
  disposable = vscode.extensions.onDidChange(refresh);

  // refresh once
  refresh();
}

export function unregisterEvent() {
  if (disposable) {
    disposable.dispose();
  }
}
