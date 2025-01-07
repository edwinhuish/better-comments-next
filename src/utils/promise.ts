import { CancelError } from './utils';

export type Resolve = (value?: any) => void;

export interface PromiseCancelable<T = any> extends Promise<T> {
  cancel: () => PromiseCancelable<T>;
  isCancel: () => boolean;
}

/**
 * 将一个promise转换为一个可取消的promise
 * @param {Promise} task 希望被转换的promise实例
 * @returns {Promise} 返回具有cancel()&isCancel()的promise对象
 */
export function Cancelable(task: Promise<any>) {
  let _reject: Resolve;
  let isCancel = false;
  const cancelP = new Promise((resolve, reject) => {
    _reject = reject;
  });
  const p = Promise.race([task, cancelP]) as PromiseCancelable;
  /***
     * 调用cancel时可能promise状态已经变为成功,
     * 所以不能在cancel里面改变isCancel
     * 只有catch的原因是cancel才代表被取消成功了
     */
  p.catch((reason) => {
    if (reason instanceof CancelError) {
      isCancel = true;
    }
  });

  p.cancel = () => {
    _reject(new CancelError());
    return p;
  };
  p.isCancel = () => {
    return isCancel;
  };
  return p;
}
