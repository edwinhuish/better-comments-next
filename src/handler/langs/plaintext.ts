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

  // skip if disabled highlight plain text
  if (!configs.highlightPlainText) {
    return decorationOptions;
  }

  const multilineTags = configuration.getMultilineTagsEscaped();
  const lineTags = configuration.getLineTagsEscaped();

  const lineProcessed: [number, number][] = [];

  const m1Exp = new RegExp(`(^|\\n[ \\t]*)(${multilineTags.join('|')})([\\s\\S]*?)(?=\\n\\s*\\n|$)`, 'gi');

  for (const visibleRange of editor.visibleRanges) {
    const visibleText = editor.document.getText(visibleRange);
    const rangeStart = editor.document.offsetAt(visibleRange.start);

    // Find the matched multiline
    let m1: RegExpExecArray | null;
    while ((m1 = m1Exp.exec(visibleText))) {
      const m1StartSince = rangeStart + m1.index;
      const m1Start = m1StartSince + m1[1].length;
      const m1End = m1StartSince + m1[0].length;
      // store processed range
      lineProcessed.push([m1Start, m1End]);

      const startPos = editor.document.positionAt(m1Start);
      const endPos = editor.document.positionAt(m1End);
      const range = new vscode.Range(startPos, endPos);

      const tagName = m1[2].toLowerCase();

      const opt = decorationOptions.get(tagName) || [];
      opt.push({ range });
      decorationOptions.set(tagName, opt);
    }

    const lineExp = new RegExp(`(^|\\n[ \\t]*)(${lineTags.join('|')})([^\\n]*)(?=\\n)`, 'gi');

    let line: RegExpExecArray | null | undefined;
    while ((line = lineExp.exec(visibleText))) {
      const lineStartSince = rangeStart + line.index;
      const lineStart = lineStartSince + line[1].length;
      const lineEnd = lineStartSince + line[0].length;

      if (lineProcessed.find(range => range[0] <= lineStart && lineEnd <= range[1])) {
        // skip if already processed
        continue;
      }
      // store processed range
      lineProcessed.push([lineStart, lineEnd]);

      const startPos = editor.document.positionAt(lineStart);
      const endPos = editor.document.positionAt(lineEnd);
      const range = new vscode.Range(startPos, endPos);

      const tagName = line[2].toLowerCase();

      const opt = decorationOptions.get(tagName) || [];
      opt.push({ range });
      decorationOptions.set(tagName, opt);
    }
  }

  return decorationOptions;
}
