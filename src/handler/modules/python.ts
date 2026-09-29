import type { BlockCommentSlice, PickParams } from './common';
import * as definition from '@/definition';
import { pickBlockSlices } from '@/matcher';
import { CommonHandler } from './common';

export class PythonHandler extends CommonHandler {
  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    const { blockComments } = await definition.getAvailableComments(params.editor.document.languageId);

    // docstrings (`""" ... """`) may start anywhere, no line-start prefix
    return pickBlockSlices({
      text: params.text,
      offset: params.offset,
      blockComments,
      processed: params.processed,
      checkpoint: () => this.verifyTaskID(params.editor, params.taskID),
      prefixPattern: '',
    });
  }
}
