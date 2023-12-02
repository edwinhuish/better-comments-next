import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Parser } from './parser';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  let activeEditor: vscode.TextEditor;

  let triggerUpdateTimeout: NodeJS.Timer | undefined;

  const configuration: Configuration = new Configuration();
  const parser: Parser = new Parser(configuration);

  // Get the active editor for the first time and initialise the regex
  if (vscode.window.activeTextEditor) {
    activeEditor = vscode.window.activeTextEditor;

    // Set the regex patterns for the specified language's comments
    await parser.InitPickers(activeEditor.document.languageId);

    // Trigger first update of decorators
    triggerUpdateDecorations();
  }

  // * Handle extensions being added or removed
  vscode.extensions.onDidChange(() => {
    configuration.UpdateLanguagesDefinitions();
  }, null, context.subscriptions);

  // * Handle active file changed
  vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor) {
      activeEditor = editor;

      // Set regex for updated language
      await parser.InitPickers(editor.document.languageId);

      // Trigger update to set decorations for newly active file
      triggerUpdateDecorations();
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
    if (!parser.supportedLanguage) {
      return;
    }

    // Finds the single line comments using the language comment delimiter
    parser.FindSingleLineComments(activeEditor);

    // Finds the multi line comments using the language comment delimiter
    parser.FindBlockComments(activeEditor);

    // Apply the styles set in the package.json
    parser.ApplyDecorations(activeEditor);
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
