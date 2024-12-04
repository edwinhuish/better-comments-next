import * as vscode from 'vscode';
import * as configuration from '../../configuration';
import type { TagDecorationOptions } from './common';
import { CommonParser } from './common';

export class PlainTextParser extends CommonParser {
  protected async pickFromBlockComment() {
    return {
      blockRanges: [],
      decorationOptions: [],
    };
  }

  protected async pickFromLineComment(skipRanges: [number, number][] = []) {
    const decorationOptions: TagDecorationOptions[] = [];

    const configs = configuration.getConfigurationFlatten();

    if (configs.highlightPlainText) {
      const escapedTags = configs.tags.map(tag => tag.tagEscaped);

      const picker = new RegExp(`(^)([ \\t]*)(${escapedTags.join('|')})+(.*)`, 'igm');

      if (picker) {
        let match: RegExpExecArray | null | undefined;
        // eslint-disable-next-line no-cond-assign
        while (match = picker.exec(this.getText())) {
          const beginIndex = match.index;
          const endIndex = match.index + match[0].length;
          if (skipRanges.find(range => range[0] <= beginIndex && endIndex <= range[1])) {
            // skip if line mark inside block comments
            continue;
          }

          const startPos = this.editor.document.positionAt(match.index + match[1].length);
          const endPos = this.editor.document.positionAt(match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);

          const tag = match![3].toLowerCase();

          decorationOptions.push({ tag, range });
        }
      }
    }
    return {
      decorationOptions,
    };
  }
}