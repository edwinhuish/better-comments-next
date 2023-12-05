import * as vscode from 'vscode';
import { useParser } from './parser';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  let activeEditor: vscode.TextEditor;

  let triggerUpdateTimeout: NodeJS.Timer | undefined;

  const parser = useParser();

  // Get the active editor for the first time and initialise the regex
  if (vscode.window.activeTextEditor) {
    activeEditor = vscode.window.activeTextEditor;

    // Set the regex patterns for the specified language's comments
    await parser.setupPickers(activeEditor.document.languageId);

    // Update decorators
    updateDecorations();
  }

  // * Handle extensions being added or removed
  vscode.extensions.onDidChange(() => {
    parser.updateLanguagesDefinitions();
  }, null, context.subscriptions);

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor) {
      activeEditor = editor;

      // Set regex for updated language
      await parser.setupPickers(editor.document.languageId);

      // Update decorations for newly active file
      updateDecorations();
    }
  }, null, context.subscriptions);

  // * Handle file contents changed
  vscode.workspace.onDidChangeTextDocument((event) => {
    // Trigger updates if the text was changed in the same document
    if (activeEditor && event.document === activeEditor.document) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  // Called to handle events below
  function updateDecorations() {
    // if no active window is open, return
    if (!activeEditor) {
      return;
    }

    // if lanugage isn't supported, return
    if (!parser.isSupportedLanguage()) {
      return;
    }

    // Finds the single line comments using the language comment delimiter
    parser.pickLineComments(activeEditor);

    // Finds the multi line comments using the language comment delimiter
    parser.pickBlockComments(activeEditor);

    // Apply decoration styles
    parser.applyDecorations(activeEditor);
  }

  // * IMPORTANT:
  // * To avoid calling update too often,
  // * set a timer for 100ms to wait before updating decorations
  function triggerUpdateDecorations() {
    if (triggerUpdateTimeout) {
      clearTimeout(triggerUpdateTimeout);
    }
    triggerUpdateTimeout = setTimeout(updateDecorations, 100);
  }
}

export function deactivate() { }
