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
    handler.triggerUpdateDecorations({ editor });
  }

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(
    async (editor) => {
      if (editor) {
        // Update decorations for newly active file
        handler.triggerUpdateDecorations({ editor });
      }
    },
    null,
    context.subscriptions,
  );

  // * Handle file contents changed
  // Debounce per document so typing bursts trigger a single update instead of
  // one full rescan per keystroke.
  const docChangeTimers = new Map<string, NodeJS.Timeout>();
  const DOC_CHANGE_DEBOUNCE = 100;

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      // Trigger updates if the text was changed in the visible editor
      const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
      if (editor) {
        const uri = event.document.uri.toString();
        const previous = docChangeTimers.get(uri);
        if (previous) {
          clearTimeout(previous);
        }
        docChangeTimers.set(uri, setTimeout(() => {
          docChangeTimers.delete(uri);
          handler.triggerUpdateDecorations({ editor });
        }, DOC_CHANGE_DEBOUNCE));
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
  handler.dispose();
}
