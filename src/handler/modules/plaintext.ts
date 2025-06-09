import type { BlockCommentSlice, PickParams } from './common';
import * as configuration from '@/configuration';
import { CommonHandler } from './common';

export class PlainTextHandler extends CommonHandler {
  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    if (!configuration.getConfigurationFlatten().highlightPlainText) {
      return [];
    }

    return [{
      start: params.offset - 1,
      end: params.offset + params.text.length,
      comment: `\n${params.text}`,
      content: `\n${params.text}`,
      marks: ['', ''],
    }];
  }
}
