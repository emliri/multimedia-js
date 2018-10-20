import 'should';

import { Processor } from './processor';
import { SocketDescriptor } from './socket';

let sd;
let proc;

const newProc = (proc) => {
  proc.templateSocketDescriptor = (sd) => {
    return sd;
  };
  return proc;
};

beforeEach(() => {
  sd = new SocketDescriptor();
  proc = new Processor();
});

describe('Processor', () => {
  it('should be constructable', () => {
    const proc = new Processor();
  });

  it('should be abstract and not implement `templateSocketDescriptor` method', () => {
    const proc = new Processor();

    (proc.templateSocketDescriptor === undefined).should.be.true;
  });

  it('should allow to call `createInput` and `createOutput` when ', () => {
    newProc(proc);

    proc.createInput();
    proc.createOutput();
  });
});
