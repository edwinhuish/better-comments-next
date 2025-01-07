/**
 * Sleep micro second
 * @param ms micro second to sleep
 */
export function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: NodeJS.Timeout | undefined;
  return function (this: any, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn.apply(this, args), delay);
  } as T;
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class CancelError extends Error {
  constructor(message: string = 'Operation canceled') {
    super(message);
  }
}
