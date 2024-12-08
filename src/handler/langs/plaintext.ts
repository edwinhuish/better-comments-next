import * as configuration from '@/configuration';
import * as log from '@/log';
import * as vscode from 'vscode';
import { Handler } from './common';

export class PlainTextHandler extends Handler {
  public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    if (!editor) {
      log.error(`editor undefined in handler languageId (${this.languageId})`);
      return;
    }

    if (editor.document.languageId !== this.languageId) {
      log.error(
        `document languageId (${editor.document.languageId}) does not match handler languageId (${this.languageId}), file: ${editor.document.fileName}`,
      );

      return;
    }

    if (this.triggerUpdateTimeout) {
      clearTimeout(this.triggerUpdateTimeout);
    }

    const decorationOptions = await pickDecorationOptions({ editor });

    const tagDecorationTypes = configuration.getTagDecorationTypes();

    tagDecorationTypes.forEach((t, tag) => {
      editor.setDecorations(t, decorationOptions.get(tag) || []);
    });
  }
}

async function pickDecorationOptions({ editor }: { editor: vscode.TextEditor }) {
  const decorationOptions = new Map<string, vscode.DecorationOptions[]>();

  const configs = configuration.getConfigurationFlatten();

  const multilineTags = configs.tags.filter(t => t.multiline).map(tag => tag.tagEscaped);
  const lineTags = configs.tags.filter(t => !t.multiline).map(tag => tag.tagEscaped);

  const lineProcessed: [number, number][] = [];

  const m1Exp = new RegExp(`(^|\\n[ \\t]*)(${multilineTags.join('|')})([\\s\\S]*?)(?=\\n\\s*\\n|$)`, 'gi');

  const text = editor.document.getText();

  // Find the matched multiline
  let m1: RegExpExecArray | null;
  while ((m1 = m1Exp.exec(text))) {
    const startIdx = m1.index + m1[1].length;
    const endIdx = m1.index + m1[0].length;
    // store processed range
    lineProcessed.push([startIdx, endIdx]);

    const startPos = editor.document.positionAt(startIdx);
    const endPos = editor.document.positionAt(endIdx);
    const range = new vscode.Range(startPos, endPos);

    const tagName = m1[2].toLowerCase();

    const opt = decorationOptions.get(tagName) || [];
    opt.push({ range });
    decorationOptions.set(tagName, opt);
  }

  const lineExp = new RegExp(`(^|\\n[ \\t]*)(${lineTags.join('|')})([^\\n]*)(?=\\n)`, 'gi');

  let line: RegExpExecArray | null | undefined;
  while ((line = lineExp.exec(text))) {
    const startIdx = line.index + line[1].length;
    const endIdx = line.index + line[0].length;

    if (lineProcessed.find(range => range[0] <= startIdx && endIdx <= range[1])) {
      // skip if already processed
      continue;
    }
    // store processed range
    lineProcessed.push([startIdx, endIdx]);

    const startPos = editor.document.positionAt(startIdx);
    const endPos = editor.document.positionAt(endIdx);
    const range = new vscode.Range(startPos, endPos);

    const tagName = line[2].toLowerCase();

    const opt = decorationOptions.get(tagName) || [];
    opt.push({ range });
    decorationOptions.set(tagName, opt);
  }

  return decorationOptions;
}
