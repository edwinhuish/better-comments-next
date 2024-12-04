import type * as vscode from 'vscode';
import { PlainTextParser } from './langs/plaintext';
import type { Parser } from './langs/common';
import { CommonParser } from './langs/common';

export { Parser } from './langs/common';

export function useParser(activedEditor: vscode.TextEditor): Parser {
  switch (activedEditor.document.languageId) {
    case 'plaintext':
      return new PlainTextParser(activedEditor);
    default:
      return new CommonParser(activedEditor);
  };
}
