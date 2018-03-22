import {PayloadDescriptor} from './mime-type';
import {Packet, PacketReceiveCallback} from './packet';

import {getLogger, makeLogTimestamped, LoggerLevels} from '../logger'

const {log} = getLogger('Socket', LoggerLevels.OFF)

export enum SocketType {
    INPUT,
    OUTPUT
}

export class SocketState {
    transferring: boolean;

    constructor() {
        this.transferring = false;
    }
};

export class SocketDescriptor {
    payloads: PayloadDescriptor[];

    constructor(payloads?: PayloadDescriptor[]) {
        this.payloads = payloads || [];
    }
}

export abstract class Socket {
    private type_: SocketType;
    private state_: SocketState;
    private descriptor_: SocketDescriptor;

    constructor(type: SocketType, descriptor: SocketDescriptor) {
        this.type_ = type;
        this.descriptor_ = descriptor;
        this.state_ = new SocketState();
    }

    type() {
        return this.type_;
    }

    payloads() {
        return this.descriptor_.payloads;
    }

    isTransferring(): boolean {
        return this.state_.transferring;
    }

    protected setTransferring_(b: boolean) {
        this.state_.transferring = b;
    }

    abstract transfer(p: Packet): boolean;
}

export class InputSocket extends Socket {

    private onReceive_: PacketReceiveCallback;

    constructor(onReceive: PacketReceiveCallback, descriptor: SocketDescriptor) {
        super(SocketType.INPUT, descriptor);
        this.onReceive_ = onReceive;
    }

    transfer(p: Packet): boolean {
        this.setTransferring_(true);
        const b = this.onReceive_(p);
        this.setTransferring_(false);
        return b;
    }
}

export class OutputSocket extends Socket {

    private peers_: Socket[];

    constructor(descriptor: SocketDescriptor) {
      super(SocketType.OUTPUT, descriptor);
      this.peers_ = [];
    }

    transfer(p: Packet): boolean {

      log(makeLogTimestamped('OutputSocket.transfer packet'))

      let b: boolean;
      this.setTransferring_(true);
      this.peers_.forEach((s) => {

        log('call transfer on peer socket')

        b = s.transfer(p);
        this.onPacketTransferred_(s, b);
      });
      this.setTransferring_(false);
      return b;
    }

    connect(s: Socket) {
      if (this.isConnectedTo(s)) {
        throw new Error('Socket is already connected to peer');
      }
      this.peers_.push(s);
      return this;
    }

    disconnect(s: Socket) {
      const index = this.peers_.indexOf(s);
      if (index < 0) {
        throw new Error('Socket can not be disconnected as its not connected')
      }
      this.peers_.splice(index, 1);
      return this;
    }

    isConnectedTo(s: Socket) {
      const index = this.peers_.indexOf(s);
      return index >= 0;
    }

    getPeerSockets() {
      return this.peers_;
    }

    private onPacketTransferred_(peerSocket: Socket, peerTransferReturnVal: boolean) {
      switch(peerSocket.type()) {
      case SocketType.INPUT:
        this.onPacketTransferredToPeerInput_(peerTransferReturnVal);
        break;
      case SocketType.OUTPUT:
        this.onPacketTransferredToPeerOutput_(peerTransferReturnVal);
        break;
      }
    }

    private onPacketTransferredToPeerInput_(peerTransferReturnVal: boolean) {}

    private onPacketTransferredToPeerOutput_(peerTransferReturnVal: boolean) {}
}
