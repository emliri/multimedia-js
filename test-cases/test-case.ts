export abstract class TestCase {

  constructor(
    public domMountPoint: HTMLElement
  ) {}

  abstract setup(done: () => void);

  abstract setup(done: () => void);
}
