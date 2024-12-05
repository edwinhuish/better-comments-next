import { getConfigurationFlatten } from './configuration';

import * as vscode from 'vscode';

import type { ConfigurationFlatten } from './configuration';

export type OnDidChangeCallback = (config: ConfigurationFlatten) => void;

const onDidChangeCallbacks: OnDidChangeCallback[] = [];
export function onDidChange(callback: OnDidChangeCallback) {
  onDidChangeCallbacks.push(callback);
}

let disposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Refresh configuration after configuration changed
  disposable = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (!event.affectsConfiguration('better-comments')) {
        return;
      }

      const config = getConfigurationFlatten(true);

      // Run change callback
      for (const callback of onDidChangeCallbacks) {
        callback(config);
      }
    },
    null,
    context.subscriptions,
  );
}

export function deactivate() {
  if (disposable) {
    disposable.dispose();
  }
}
