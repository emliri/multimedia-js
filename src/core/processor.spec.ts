import 'should';

import { VoidProcessor } from './processor';
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
  proc = new VoidProcessor();
});

describe('Processor', () => {
  it('should be constructable', () => {
    const proc = new VoidProcessor();
  });

  it('should be abstract and not implement `templateSocketDescriptor` method', () => {
    const proc = new VoidProcessor();

    (proc.templateSocketDescriptor === undefined).should.be.true;
  });

  it('should allow to call `createInput` and `createOutput` when ', () => {
    newProc(proc);

    proc.createInput();
    proc.createOutput();
  });
});
