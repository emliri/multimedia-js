import { VoidCallback } from '../src/common-types';

export abstract class MmjsTestCase {
  constructor (
    public readonly domMountPoint: HTMLElement
  ) {}

  protected getDomMountPoint (): HTMLElement {
    return this.domMountPoint;
  }

  abstract setup(done: VoidCallback);

  abstract run();
}
