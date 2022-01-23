import { VoidCallback } from '../common-types';

export function dispatchTimer (func: VoidCallback, timeoutSeconds: number = 0): number {
  return <any> setTimeout(func, timeoutSeconds * 1000);
}

export function cancelTimer (id: number): void {
  clearTimeout(id);
}
