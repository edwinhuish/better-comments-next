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

export function replaceWithSpace(input: string, startIndex: number, endIndex: number): string {
  if (startIndex < 0 || endIndex >= input.length || startIndex > endIndex) {
    throw new RangeError('Invalid range specified');
  }

  let result = input.slice(0, startIndex);

  for (let i = startIndex; i <= endIndex; i++) {
    const char = input[i];
    if (char !== ' ' && char !== '\t' && char !== '\n') {
      result += ' ';
    }
    else {
      result += char;
    }
  }

  result += input.slice(endIndex + 1);

  return result;
}
