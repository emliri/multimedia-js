import 'should';

import { Socket, SocketType, SocketDescriptor, InputSocket, OutputSocket } from './socket';
import { Packet, PacketReceiveCallback } from './packet';
import { PayloadDescriptor } from './mime-type';
import { Signal, SignalDirection } from './signal';

describe('SocketDescriptor', () => {
  it('should be constructable without args and have certain default properties', () => {
    const sd = new SocketDescriptor();

    sd.payloads.should.be.instanceOf(Array);
    sd.payloads.length.should.equal(0);
  });
});

describe('Socket', () => {
  it('should be constructable as INPUT and accept a SocketDescriptor as argument', () => {
    let s; let sd;

    // FIXME: this is weird, it should not compile since the class is abstract!!! :D
    // but in Jest, it does!
    // is it a feature in order to test abstract things still?
    sd = new SocketDescriptor();
    s = new Socket(SocketType.INPUT, sd);

    s.type().should.be.equal(SocketType.INPUT);
    s.payloads().should.be.equal(sd.payloads);
    s.isTransferring().should.be.equal(false);
  });

  it('should be constructable as OUTPUT and accept a SocketDescriptor as argument', () => {
    let s; let sd;

    sd = new SocketDescriptor();
    s = new Socket(SocketType.OUTPUT, sd);

    s.type().should.be.equal(SocketType.OUTPUT);
    s.payloads().should.be.equal(sd.payloads);
    s.isTransferring().should.be.equal(false);
  });

  it('should accept the SocketDescriptor argument by reference not value so that this can be shared and mutated across them', () => {
    let s; let sd;

    sd = new SocketDescriptor();
    s = new Socket(SocketType.INPUT, sd);

    s.payloads().should.be.equal(sd.payloads);

    sd.payloads.push(new PayloadDescriptor('foo/bar'));

    s.payloads().should.be.equal(sd.payloads);
  });

  it('should be abstract and not implement `transfer` method', () => {
    let s; let sd;

    sd = new SocketDescriptor();
    s = new Socket(SocketType.INPUT, sd);

    (s.transfer === undefined).should.be.true;
  });

  it('should set/get its owner', () => {
    const socket = new Socket(SocketType.INPUT, new SocketDescriptor());
    const owner = {
      getOwnSockets: () => {},
      cast: () => {}
    };

    socket.setOwner(owner);
    socket.getOwner().should.be.equal(owner);
  });

  it('should on calling cast method pass signals to its signal-handler and return the result', (done) => {
    const socket = new Socket(SocketType.INPUT, new SocketDescriptor());

    socket.setSignalHandler((s: Signal) => {
      return Promise.resolve(true);
    });

    socket.cast(new Signal(SignalDirection.DOWN)).then((res) => {
      res.should.be.equal(true);
      done();
    });
  });
});

describe('InputSocket', () => {
  it('should be constructable with a PacketReceiveCallback and a SocketDescriptor', () => {
    const cb = (p: Packet) => true;

    let sd = new SocketDescriptor();

    let is = new InputSocket(cb, sd);

    is.isTransferring().should.be.equal(false);

    is.payloads().should.be.equal(sd.payloads);
  });

  it('should transfer a packet to the callback and set the transferring state flag during transfer accordingly', () => {
    let packet = new Packet();
    let cbRetVal = true;
    let is;

    let sd = new SocketDescriptor();

    const cb = (p: Packet) => {
      p.should.be.equal(packet);
      is.isTransferring().should.be.true;
      return cbRetVal;
    };

    is = new InputSocket(cb, sd);

    is.payloads().should.be.equal(sd.payloads);

    is.isTransferring().should.be.equal(false);
    is.transfer(packet).should.be.equal(cbRetVal);
    is.isTransferring().should.be.equal(false);
  });

  it('should transfer a packet to the callback and set the transferring state flag during transfer accordingly (with falsy callback return val)', () => {
    let packet = new Packet();
    let cbRetVal = false;
    let is;

    const cb = (p: Packet) => {
      p.should.be.equal(packet);
      is.isTransferring().should.be.true;
      return cbRetVal;
    };

    is = new InputSocket(cb, new SocketDescriptor());

    is.isTransferring().should.be.equal(false);
    is.transfer(packet).should.be.equal(cbRetVal);
    is.isTransferring().should.be.equal(false);
  });

  it('should on calling cast method pass signals to its signal-handler and to the owner of the socket and return the result - case 1', (done) => {
    const socket = new Socket(SocketType.INPUT, new SocketDescriptor());

    socket.setSignalHandler((s: Signal) => {
      return Promise.resolve(false);
    });

    const owner = {
      getOwnSockets: () => {},
      cast: (s: Signal) => {
        return Promise.resolve(false);
      }
    };

    socket.setOwner(owner);

    socket.cast(new Signal(SignalDirection.DOWN)).then((res) => {
      res.should.be.equal(false);
      done();
    });
  });

  it('should on calling cast method pass signals to its signal-handler and to the owner of the socket and return the result - case 2', (done) => {
    const socket = new Socket(SocketType.INPUT, new SocketDescriptor());

    socket.setSignalHandler((s: Signal) => {
      return Promise.resolve(true);
    });

    const owner = {
      getOwnSockets: () => {},
      cast: (s: Signal) => {
        return Promise.resolve(false);
      }
    };

    socket.setOwner(owner);

    socket.cast(new Signal(SignalDirection.DOWN)).then((res) => {
      res.should.be.equal(true);
      done();
    });
  });
});

describe('OutputSocket', () => {
  it('should be constructable with a SocketDescriptor (same as base class)', () => {
    let sd = new SocketDescriptor();
    let os = new OutputSocket(sd);

    os.payloads().should.be.equal(sd.payloads);

    os.getPeerSockets().should.be.instanceOf(Array);
    os.getPeerSockets().length.should.be.equal(0);
  });

  it('should be able to connect/disconnect an OutputSocket and give access to peer sockets related methods', () => {
    let sd = new SocketDescriptor();
    let os = new OutputSocket(sd);

    let os2 = new OutputSocket(sd);

    os.connect(os2).should.be.equal(os);

    os.isConnectedTo(os2).should.be.true;

    os.getPeerSockets().length.should.be.equal(1);

    os.disconnect(os2).should.be.equal(os);

    os.isConnectedTo(os2).should.be.false;

    os.getPeerSockets().length.should.be.equal(0);
  });

  /*
    // more of this stuff
    it('should be able to connect/disconnect an OutputSocket and give access to peer sockets related methods', () => {
        let sd = new SocketDescriptor();
        let os = new OutputSocket(sd);

        let os2 = new OutputSocket(sd);

        os.connect(os2).should.be.equal(os);

        os.isConnectedTo(os2).should.be.true;

        os.getPeerSockets().length.should.be.equal(1);

        os.disconnect(os2).should.be.equal(os);

        os.isConnectedTo(os2).should.be.false;

        os.getPeerSockets().length.should.be.equal(0);
    });
    */

  it('should be able to connect/disconnect an InputSocket and give access to peer sockets related methods', () => {
    let is;
    let sd = new SocketDescriptor();
    let os = new OutputSocket(sd);

    const cb = (p: Packet) => true;

    is = new InputSocket(cb, sd);

    os.connect(is).should.be.equal(os);

    os.isConnectedTo(is).should.be.true;

    os.getPeerSockets().length.should.be.equal(1);

    os.disconnect(is).should.be.equal(os);

    os.isConnectedTo(is).should.be.false;

    os.getPeerSockets().length.should.be.equal(0);
  });

  it('should be able to transfer a Packet to a peer InputSocket', (done) => {
    let is;
    let packetCount = 0;
    let sd = new SocketDescriptor();
    let os = new OutputSocket(sd);
    let packet = new Packet();

    const cb = (p: Packet) => {
      setTimeout(() => {
        done();
      }, 0);

      p.should.be.equal(packet);

      (packetCount++).should.be.equal(0);

      return true;
    };

    is = new InputSocket(cb, sd);

    os.connect(is).should.be.equal(os);

    os.transfer(packet).should.be.true;
  });

  it('should be able to transfer a Packet to a peer OutputSocket (and on to its peers)', (done) => {
    let is;
    let packetCount = 0;
    let sd = new SocketDescriptor();
    let os = new OutputSocket(sd);
    let os2 = new OutputSocket(sd);
    let packet = new Packet();

    let cbRetVal = false;

    const cb = (p: Packet) => {
      setTimeout(() => {
        done();
      }, 0);

      p.should.be.equal(packet);

      (packetCount++).should.be.equal(0);

      return cbRetVal;
    };

    is = new InputSocket(cb, sd);

    os.connect(os2).should.be.equal(os);

    os2.connect(is).should.be.equal(os2);

    os.transfer(packet).should.be.equal(cbRetVal);
  });
});
