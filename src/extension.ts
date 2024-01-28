import * as vscode from 'vscode';
import { useParser } from './parser';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  let parser = useParser();

  // Get the active editor for the first time and initialise the regex
  if (vscode.window.activeTextEditor) {
    // Set the regex patterns for the specified language's comments
    await parser.setEditor(vscode.window.activeTextEditor);

    // Update decorators
    parser.triggerUpdateDecorations(0);
  }

  // * Handle extensions being added or removed
  vscode.extensions.onDidChange(() => {
    parser.updateLanguagesDefinitions();
  }, null, context.subscriptions);

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor) {
      // Set regex for updated language
      await parser.setEditor(editor);

      // Update decorations for newly active file
      parser.triggerUpdateDecorations(0);
    }
  }, null, context.subscriptions);

  // * Handle file contents changed
  vscode.workspace.onDidChangeTextDocument((event) => {
    // Trigger updates if the text was changed in the same document
    if (event.document === parser.getEditor()?.document) {
      parser.triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  // * Handle configuration changed
  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (!event.affectsConfiguration('better-comments')) {
      return;
    }

    parser = useParser();
    // Get the active editor for the first time and initialise the regex
    if (vscode.window.activeTextEditor) {
      // Set the regex patterns for the specified language's comments
      await parser.setEditor(vscode.window.activeTextEditor);

      // Update decorators
      parser.triggerUpdateDecorations(0);
    }
  }, null, context.subscriptions);
}

export function deactivate() { }
