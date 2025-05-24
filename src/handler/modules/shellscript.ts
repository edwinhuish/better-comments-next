import type { LineCommentSlice, PickParams } from './common';
import * as definition from '@/definition';
import { BR, escape, SP } from '@/utils/regex';
import { CommonHandler } from './common';

export class ShellscriptHandler extends CommonHandler {
  protected async pickLineCommentSlices(params: PickParams): Promise<Array<LineCommentSlice>> {
    this.verifyTaskID(params.taskID);

    const { lineComments } = await definition.getAvailableComments(params.editor.document.languageId);
    if (!lineComments || !lineComments.length) {
      return [];
    }

    const slices: LineCommentSlice[] = [];

    const marks = lineComments.map(s => `${escape(s)}+`).join('|');

    const exp = new RegExp(`(?<PRE>.?)(?<MARK>${marks}).*?(?:${BR}${SP}*\\1.*?)*(?:${BR}|$)`, 'g');
    let block: RegExpExecArray | null;
    while ((block = exp.exec(params.text))) {
      this.verifyTaskID(params.taskID);

      const start = params.offset + block.index;
      const end = start + block[0].length;

      if (params.processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
        // skip if already processed
        continue;
      }
      // store processed range
      params.processed.push([start, end]);

      if (block.groups!.PRE === '$') {
        continue; // skip if line starts with $
      }

      slices.push({
        start,
        end,
        comment: block[0],
        mark: block.groups!.MARK,
      });
    }

    return slices;
  }
}
