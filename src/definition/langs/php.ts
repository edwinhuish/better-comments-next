import type { AvailableComments } from './common';
import { Language } from './common';

export class PHPLanguage extends Language {
  public setAvailableComments(comments: AvailableComments): this {
    comments.lineComments.push('#');

    return super.setAvailableComments(comments);
  }
}
