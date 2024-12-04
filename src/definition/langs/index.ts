import type { Language } from './common';
import { CommonLanguage } from './common';
import { PHPLanguage } from './php';

export * from './common';
export * from './php';

export function useLanguage(langId: string): Language {
  switch (langId) {
    case 'php':
      return new PHPLanguage(langId);
    default:
      return new CommonLanguage(langId);
  };
}
