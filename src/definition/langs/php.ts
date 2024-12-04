import { Language } from './common';

import type { AvailableComments } from './common';

export class PHPLanguage extends Language {
  public setAvailableComments(comments: AvailableComments): this {
    comments.lineComments.push('#');

    return super.setAvailableComments(comments);
  }
}
