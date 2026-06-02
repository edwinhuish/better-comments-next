import type { BlockCommentSlice, PickParams } from './common';
import * as definition from '@/definition';
import { ANY, escape } from '@/utils/regex';
import { CommonHandler } from './common';

export class PythonHandler extends CommonHandler {
  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    this.verifyTaskID(params.taskID);

    const { blockComments } = await definition.getAvailableComments(params.editor.document.languageId);
    if (!blockComments || !blockComments.length) {
      return [];
    }

    const slices: BlockCommentSlice[] = [];

    for (const marks of blockComments) {
      this.verifyTaskID(params.taskID);

      const markStart = escape(marks[0]);
      const markEnd = escape(marks[1]);
      const exp = new RegExp(`(?<START>${markStart})(?<CONTENT>${ANY}*?)(?<END>${markEnd})`, 'g');

      let block: RegExpExecArray | null;
      while ((block = exp.exec(params.text))) {
        this.verifyTaskID(params.taskID);

        const start = params.offset + block.index;
        const end = params.offset + block.index + block[0].length;

        if (params.processed.find(([pStart, pEnd]) => pStart <= start && end <= pEnd)) {
          // skip if already processed
          continue;
        }
        // store processed range
        params.processed.push([start, end]);

        slices.push({
          start,
          end,
          comment: block[0],
          content: block.groups!.CONTENT,
          marks,
        });
      }
    }

    return slices;
  }
}
