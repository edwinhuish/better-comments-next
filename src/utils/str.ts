import { escape } from './regex';

export function trim(str: string, char?: string) {
  const excaped = char !== undefined ? escape(char) : '\\s';
  return str.replace(new RegExp(`^${excaped}+|${excaped}+$`, 'g'), '');
}

export function trimLeft(str: string, char?: string) {
  const excaped = char !== undefined ? escape(char) : '\\s';
  return str.replace(new RegExp(`^${excaped}+`, 'g'), '');
}

export function trimRight(str: string, char?: string) {
  const excaped = char !== undefined ? escape(char) : '\\s';
  return str.replace(new RegExp(`${excaped}+$`, 'g'), '');
}
