import type { BlockCommentSlice, PickParams } from './common';
import { CommonHandler } from './common';

export class PlainTextHandler extends CommonHandler {
  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    return [{
      start: params.offset,
      end: params.offset + params.text.length,
      comment: params.text,
      content: params.text,
      marks: ['', ''],
    }];
  }
}
