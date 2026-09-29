import type { LineCommentSlice, PickParams } from './common';
import * as definition from '@/definition';
import { pickLineSlices } from '@/matcher';
import { CommonHandler } from './common';

export class ShellscriptHandler extends CommonHandler {
  protected async pickLineCommentSlices(params: PickParams): Promise<Array<LineCommentSlice>> {
    const { lineComments } = await definition.getAvailableComments(params.editor.document.languageId);

    // capture the optional char before the mark to skip command lines
    // starting with `$` (`.?` — must stay optional so line-start comments match)
    const slices = await pickLineSlices({
      text: params.text,
      offset: params.offset,
      lineComments,
      processed: params.processed,
      checkpoint: () => this.verifyTaskID(params.editor, params.taskID),
      prefixPattern: '.?',
    });

    return slices.filter(slice => slice.prefix !== '$');
  }
}
