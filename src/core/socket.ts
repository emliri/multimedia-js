import { getLogger, LoggerLevel } from '../logger';
import { Signal, SignalReceiver, SignalReceiverCastResult } from './signal';

import { OutputSocket } from './socket-output';
import { Packet } from './packet';
import { SocketDescriptor } from './socket-descriptor';
import { Socket } from './socket-base';

const { log, error } = getLogger('socket', LoggerLevel.ERROR);

export enum SocketType {
  INPUT,
  OUTPUT
}

// NOTE: '...-transferred' events are triggered ONLY in base class
//       '...-received' events are triggered ONLY in input
export enum SocketEvent {
  ANY_PACKET_TRANSFERRED = 'any-packet-transferred',
  EOS_PACKET_TRANSFERRED = 'eos-packet-transferred',
  ANY_PACKET_RECEIVED = 'any-packet-received',
  DATA_PACKET_RECEIVED = 'data-packet-received', // "non-symbolic"
  EOS_PACKET_RECEIVED = 'eos-packet-received',
}

export type SocketEventHandler = (event: SocketEvent) => void

export class SocketState {
  transferring: boolean;
  closed: boolean;

  constructor () {
    this.closed = false;
    this.transferring = false;
  }
}

export type SocketTemplateGenerator = (st: SocketType) => SocketDescriptor;


export interface SocketOwner extends SignlReceiver {
  getOwnSockets(): Set<Socket>;
  cast(signal: Signal): SignalReceiverCastResult;
}

export interface SeekableOutputSocket extends OutputSocket {
  seek(start: number, end?: number): boolean;
}

export interface URLLoadingOutputSocket extends OutputSocket {
  load(url: string): boolean;
}

export class VoidSocket extends Socket {
  transferSync(p: Packet): boolean {
    return true;
  }
}

export { Socket } from './socket-base';
export { SocketDescriptor } from './socket-descriptor';
export { OutputSocket } from './socket-output';
export { InputSocket } from './socket-input';
