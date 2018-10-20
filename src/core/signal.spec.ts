import 'should';

import { Signal, SignalDirection, SignalReceiverCastResult } from './signal';

const receiver1 = {
  cast (s: Signal): SignalReceiverCastResult {
    return Promise.resolve(true);
  }
};

const receiver2 = {
  cast (s: Signal): SignalReceiverCastResult {
    return Promise.resolve(false);
  }
};

const receiver3 = {
  cast (s: Signal): SignalReceiverCastResult {
    return Promise.resolve(false);
  }
};

const receiver4 = {
  cast (s: Signal): SignalReceiverCastResult {
    return Promise.resolve(false);
  }
};

describe('Signal', () => {
  it('should emit itself to all receivers and collect results - case 1', (done) => {
    const sig = new Signal(SignalDirection.ZERO);

    sig.emit([receiver1, receiver2]).then((res) => {
      res.should.be.equal(true);
      done();
    });
  });

  it('should emit itself to all receivers and collect results - case 2', (done) => {
    const sig = new Signal(SignalDirection.UP);

    sig.emit([receiver3, receiver4]).then((res) => {
      res.should.be.equal(false);
      done();
    });
  });

  it('should emit itself to all receivers and collect results - case 3', (done) => {
    const sig = new Signal(SignalDirection.UP);

    sig.emit([receiver3, receiver4, receiver1]).then((res) => {
      res.should.be.equal(true);
      done();
    });
  });

  it('should emit itself to all receivers and collect results - case 4', (done) => {
    const sig = new Signal(SignalDirection.UP);

    sig.emit([receiver1]).then((res) => {
      res.should.be.equal(true);
      done();
    });
  });

  it('should emit itself to all receivers and collect results - case 5', (done) => {
    const sig = new Signal(SignalDirection.UP);

    sig.emit([receiver4]).then((res) => {
      res.should.be.equal(false);
      done();
    });
  });
});
