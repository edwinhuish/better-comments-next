import type { BlockCommentSlice, DocCommentSlice, LineCommentSlice, PickParams } from './common';
import * as configuration from '@/configuration';
import { CommonHandler } from './common';

export class PlainTextHandler extends CommonHandler {
  protected async pickBlockCommentSlices(params: PickParams): Promise<Array<BlockCommentSlice>> {
    if (!configuration.getConfigurationFlatten().highlightPlainText) {
      return [];
    }

    // The virtual leading newline lets block-comment regexes match tags at
    // line start (eg: `#` at column 0). It maps to the real newline before
    // the visible range (`offset - 1`, since offset is always a line start).
    // At document start it conceptually sits at offset -1, which is safe:
    // matching always consumes it via the PRE groups before positions are
    // computed, so positionAt is never called with a negative offset.
    return [{
      start: params.offset - 1,
      end: params.offset + params.text.length,
      comment: `\n${params.text}`,
      content: `\n${params.text}`,
      marks: ['', ''],
    }];
  }

  protected async pickLineCommentSlices(params: PickParams): Promise<Array<LineCommentSlice>> {
    return [];
  }

  protected async pickDocCommentSlices(params: PickParams): Promise<Array<DocCommentSlice>> {
    return [];
  }
}
