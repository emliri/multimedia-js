export abstract class MmjsTestCase {

  constructor(
    public domMountPoint: HTMLElement
  ) {}

  abstract setup(done: () => void);

  abstract run();
}
