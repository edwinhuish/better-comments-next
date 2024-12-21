import * as vscode from 'vscode';
import * as handler from './handler';

export type OnDidChangeCallback = (event: vscode.TextDocumentChangeEvent, editor?: vscode.TextEditor) => void;

const onDidChangeCallbacks: OnDidChangeCallback[] = [];
export function onDidChange(callback: OnDidChangeCallback) {
  onDidChangeCallbacks.push(callback);
}

export function activate(context: vscode.ExtensionContext) {
  // Loop all visible editor for the first time and initialise the regex
  for (const editor of vscode.window.visibleTextEditors) {
    handler.triggerUpdateDecorations(editor);
  }

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(
    async (editor) => {
      if (editor) {
        // Update decorations for newly active file
        handler.triggerUpdateDecorations(editor);
      }
    },
    null,
    context.subscriptions,
  );

  // * Handle visible range changed
  vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    handler.triggerUpdateDecorations(event.textEditor);
  }, null, context.subscriptions);

  // * Handle file contents changed
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      // Trigger updates if the text was changed in the visible editor
      const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
      if (editor) {
        handler.triggerUpdateDecorations(editor);
      }

      // Run change callbacks
      for (const callback of onDidChangeCallbacks) {
        callback(event, editor);
      }
    },
    null,
    context.subscriptions,
  );
}

export function deactivate() {

}
