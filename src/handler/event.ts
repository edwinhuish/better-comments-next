import * as handler from './handler';

import * as vscode from 'vscode';

export type OnDidChangeCallback = (event: vscode.TextDocumentChangeEvent) => void;

const onDidChangeCallbacks: OnDidChangeCallback[] = [];
export function onDidChange(callback: OnDidChangeCallback) {
  onDidChangeCallbacks.push(callback);
}

let disposable: vscode.Disposable | undefined;
export function activate(context: vscode.ExtensionContext) {
  // Get the active editor for the first time and initialise the regex
  if (vscode.window.activeTextEditor) {
    // Update decorators
    handler.updateDecorations(vscode.window.activeTextEditor);
  }

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(
    async (editor) => {
      if (editor) {
        // Update decorations for newly active file
        handler.updateDecorations(editor);
      }
    },
    null,
    context.subscriptions,
  );

  // * Handle file contents changed
  disposable = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      // Trigger updates if the text was changed in the same document
      if (event.document === vscode.window.activeTextEditor?.document) {
        handler.triggerUpdateDecorations(vscode.window.activeTextEditor!);
      }

      // Run change callbacks
      for (const callback of onDidChangeCallbacks) {
        callback(event);
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
