import { Handler } from './common';

import * as vscode from 'vscode';

import * as configuration from '@/configuration';

export class PlainTextHandler extends Handler {
  public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    if (!editor || editor.document.languageId !== this.languageId) {
      return;
    }

    if (this.triggerUpdateTimeout) {
      clearTimeout(this.triggerUpdateTimeout);
    }

    const linePicked = await this.pickFromLineComment(editor);

    const tagDecorationTypes = configuration.getTagDecorationTypes();

    tagDecorationTypes.forEach((t, tag) => {
      editor.setDecorations(t, linePicked.get(tag) || []);
    });
  }

  protected async pickFromLineComment(editor: vscode.TextEditor, processed: [number, number][] = []) {
    const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

    const configs = configuration.getConfigurationFlatten();

    if (configs.highlightPlainText) {
      const escapedTags = configs.tags.map((tag) => tag.tagEscaped);

      const picker = new RegExp(`(^)([ \\t]*)(${escapedTags.join('|')})+(.*)`, 'igm');

      if (picker) {
        let match: RegExpExecArray | null | undefined;

        while ((match = picker.exec(editor.document.getText()))) {
          const beginIndex = match.index;
          const endIndex = match.index + match[0].length;
          if (processed.find((range) => range[0] <= beginIndex && endIndex <= range[1])) {
            // skip if line mark inside block comments
            continue;
          }

          const startPos = editor.document.positionAt(match.index + match[1].length);
          const endPos = editor.document.positionAt(match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);

          const tagName = match![3].toLowerCase();

          const opt = decorationOptions.get(tagName) || [];
          opt.push({ range });
          decorationOptions.set(tagName, opt);
        }
      }
    }
    return decorationOptions;
  }
}
