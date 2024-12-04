import * as configuration from './configuration';
import * as definition from './definition';
import { useParser } from './parser';
import { debounce } from './utils';

import * as vscode from 'vscode';

import type { Parser } from './parser';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  configuration.activate();
  definition.activate();

  let parser: Parser | undefined;

  // Get the active editor for the first time and initialise the regex
  if (vscode.window.activeTextEditor) {
    parser = useParser(vscode.window.activeTextEditor);

    // Update decorators
    parser!.updateDecorations();
  }

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(
    async (editor) => {
      if (editor) {
        parser = useParser(editor);

        // Update decorations for newly active file
        parser!.updateDecorations();
      }
    },
    null,
    context.subscriptions,
  );

  // * Handle file contents changed
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (!parser) {
        return;
      }
      // Trigger updates if the text was changed in the same document
      if (event.document === parser.getEditor()?.document) {
        debounce(parser.updateDecorations, 100)();
      }
    },
    null,
    context.subscriptions,
  );
}

export function deactivate() {
  configuration.deactivate();
  definition.deactivate();
}
