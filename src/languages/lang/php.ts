import type { AvailableComments } from './default';
import { Language } from './default';

export class PHPLanguage extends Language {
  setAvailableComments(comments: AvailableComments): this {
    comments.lineComments.push('#');

    return super.setAvailableComments(comments);
  }
}
