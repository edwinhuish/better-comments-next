import { CommonLanguage } from './common';
import { PHPLanguage } from './php';

import type { Language } from './common';

export * from './common';
export * from './php';

export function useLanguage(langId: string): Language {
  switch (langId) {
    case 'php':
      return new PHPLanguage(langId);
    default:
      return new CommonLanguage(langId);
  }
}
