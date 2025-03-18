import type { PickDecorationOptionsParams, UpdateOptions } from './common';
import * as configuration from '@/configuration';
import { replaceWithSpace } from '@/utils/str';
import * as vscode from 'vscode';
import { Handler } from './common';

export class PlainTextHandler extends Handler {
  protected async updateDecorations({ editor, taskID }: UpdateOptions & { taskID: string }): Promise<void> {
    const tagRanges = new Map<string, vscode.Range[]>();

    const { preloadLines, updateDelay } = configuration.getConfigurationFlatten();

    // # update for visible ranges
    for (const visibleRange of editor.visibleRanges) {
      this.verifyTaskID(taskID);

      const startLineIdx = Math.max(0, visibleRange.start.line - preloadLines);
      const startLine = editor.document.lineAt(startLineIdx);
      const endLineIdx = Math.min(editor.document.lineCount - 1, visibleRange.end.line + preloadLines);
      const endLine = editor.document.lineAt(endLineIdx);
      const range = new vscode.Range(startLine.range.start.line, 0, endLine.range.end.line, endLine.range.end.character);

      const text = editor.document.getText(range);
      const offset = editor.document.offsetAt(range.start);

      const opt = { editor, text, offset, tagRanges, taskID };
      await this.pickDecorationOptions(opt);
    }
    this.setDecorations(editor, tagRanges);

    setTimeout(async () => {
      this.verifyTaskID(taskID);
      // # update for full text
      const text = editor.document.getText();
      const opt = { editor, text, offset: 0, tagRanges, taskID };
      await this.pickDecorationOptions(opt);
      this.setDecorations(editor, tagRanges);
    }, updateDelay);
  }

  private async pickDecorationOptions(opt: PickDecorationOptionsParams) {
    const { editor, offset, tagRanges, taskID } = opt;

    this.verifyTaskID(taskID);

    const configs = configuration.getConfigurationFlatten();

    // skip if disabled highlight plain text
    if (!configs.highlightPlainText) {
      return tagRanges;
    }

    const multilineTags = configuration.getMultilineTagsEscaped();
    const lineTags = configuration.getLineTagsEscaped();

    const m1Exp = new RegExp(`(^|\\n[ \\t]*)(${multilineTags.join('|')})([\\s\\S]*?)(?=\\n\\s*\\n|$)`, 'gi');

    // Find the matched multiline
    let m1: RegExpExecArray | null;
    while ((m1 = m1Exp.exec(opt.text))) {
      this.verifyTaskID(taskID);

      const m1StartSince = offset + m1.index;
      const m1Start = m1StartSince + m1[1].length;
      const m1End = m1StartSince + m1[0].length;
      opt.text = replaceWithSpace(opt.text, m1Start, m1End);

      const startPos = editor.document.positionAt(m1Start);
      const endPos = editor.document.positionAt(m1End);
      const range = new vscode.Range(startPos, endPos);

      const tagName = m1[2].toLowerCase();

      const ranges = tagRanges.get(tagName) || [];
      ranges.push(range);
      tagRanges.set(tagName, ranges);
    }

    const lineExp = new RegExp(`(^|\\n[ \\t]*)(${lineTags.join('|')})([^\\n]*)(?=\\n)`, 'gi');

    let line: RegExpExecArray | null | undefined;
    while ((line = lineExp.exec(opt.text))) {
      this.verifyTaskID(taskID);

      const lineStartSince = offset + line.index;
      const lineStart = lineStartSince + line[1].length;
      const lineEnd = lineStartSince + line[0].length;
      opt.text = replaceWithSpace(opt.text, lineStart, lineEnd);

      const startPos = editor.document.positionAt(lineStart);
      const endPos = editor.document.positionAt(lineEnd);
      const range = new vscode.Range(startPos, endPos);

      const tagName = line[2].toLowerCase();

      const ranges = tagRanges.get(tagName) || [];
      ranges.push(range);
      tagRanges.set(tagName, ranges);
    }

    return tagRanges;
  }
}
