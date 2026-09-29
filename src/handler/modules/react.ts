import type { BlockCommentSlice, PickParams } from './common';
import * as definition from '@/definition';
import { pickBlockSlices } from '@/matcher';
import { BR } from '@/utils/regex';
import { CommonHandler } from './common';

export class ReactHandler extends CommonHandler {
  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    const { blockComments } = await definition.getAvailableComments(params.editor.document.languageId);

    // JSX inline comments: `{/* ... */}` right after an opening brace
    return pickBlockSlices({
      text: params.text,
      offset: params.offset,
      blockComments,
      processed: params.processed,
      checkpoint: () => this.verifyTaskID(params.editor, params.taskID),
      prefixPattern: `(?:^|${BR})\\s*|\\{\\s*`,
    });
  }
}
