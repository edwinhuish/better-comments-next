import * as vscode from 'vscode';
import { updateDefinitions } from './languages';

export type OnDidChangeCallback = () => void;

const onDidChangeCallbacks: OnDidChangeCallback[] = [];
export function onDidChange(callback: OnDidChangeCallback) {
  onDidChangeCallbacks.push(callback);
}

let disposable: vscode.Disposable | undefined;
export function registerEvent() {
  // Refresh languages definitions after extensions changed
  disposable = vscode.extensions.onDidChange(() => {
    updateDefinitions();

    // Run change callbacks
    for (const callback of onDidChangeCallbacks) {
      callback();
    }
  });
}

export function unregisterEvent() {
  if (disposable) {
    disposable.dispose();
  }
}
