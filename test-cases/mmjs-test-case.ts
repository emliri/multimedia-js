export abstract class MmjsTestCase {

  constructor(
    public readonly domMountPoint: HTMLElement
  ) {}

  protected getDomMountPoint(): HTMLElement {
    return this.domMountPoint;
  }

  abstract setup(done: () => void);

  abstract run();
}
