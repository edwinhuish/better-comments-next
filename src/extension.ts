import * as vscode from 'vscode';
import { useParser } from './parser';
import * as configuration from './configuration';
import * as languages from './languages';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  configuration.activate();
  languages.activate();
  const parser = useParser();

  // Get the active editor for the first time and initialise the regex
  if (vscode.window.activeTextEditor) {
    // Set the regex patterns for the specified language's comments
    await parser.setEditor(vscode.window.activeTextEditor);

    // Update decorators
    parser.updateDecorations(true);
  }

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor) {
      // Set regex for updated language
      await parser.setEditor(editor);

      // Update decorations for newly active file
      parser.updateDecorations(true);
    }
  }, null, context.subscriptions);

  // * Handle file contents changed
  vscode.workspace.onDidChangeTextDocument((event) => {
    // Trigger updates if the text was changed in the same document
    if (event.document === parser.getEditor()?.document) {
      parser.updateDecorations();
    }
  }, null, context.subscriptions);
}

export function deactivate() {
  configuration.deactivate();
  languages.deactivate();
}
