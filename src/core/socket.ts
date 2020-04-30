import { PayloadDescriptor } from './payload-description';
import { getLogger, makeLogTimestamped, LoggerLevel } from '../logger';
import { Signal, SignalReceiver, SignalReceiverCastResult } from './signal';

import { OutputSocket } from './socket-output';
import { Socket } from './socket-base';

const { log, error } = getLogger('Socket', LoggerLevel.ERROR);

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

  constructor () {
    this.transferring = false;
  }
}

export type SocketTemplateGenerator = (st: SocketType) => SocketDescriptor;

export class SocketDescriptor {
  static fromMimeType (mimeType: string): SocketDescriptor {
    return SocketDescriptor.fromMimeTypes(mimeType);
  }

  static fromMimeTypes (...mimeTypes: string[]): SocketDescriptor {
    return new SocketDescriptor(mimeTypes.map((mimeType) => new PayloadDescriptor(mimeType)));
  }

  static fromPayloads (payloads: PayloadDescriptor[]): SocketDescriptor {
    return new SocketDescriptor(payloads);
  }

  /**
   * !! NOTE: Keep this in sync with BufferProperties.clone
   * @param serializedSd
   */
  static fromJson (serializedSd: string): SocketDescriptor {
    const sd: SocketDescriptor = JSON.parse(serializedSd);
    // now lets brings this dead thing back to life
    return SocketDescriptor.fromPayloads(
      sd.payloads.map((payload) => {
        const pd = new PayloadDescriptor(
          payload.mimeType,
          payload.sampleRateInteger,
          payload.sampleDepth,
          payload.sampleDurationNumerator
        );
        pd.codec = payload.codec;
        pd.elementaryStreamId = payload.elementaryStreamId;
        pd.details = payload.details;
        return pd;
      })
    );
  }

  // TODO: also allow to directly bind this to proc templateSocketDescriptor method on construction
  static createTemplateGenerator (
    inputSd: SocketDescriptor, outputSd: SocketDescriptor): SocketTemplateGenerator {
    return (st: SocketType) => {
      switch (st) {
      case SocketType.INPUT: return inputSd;
      case SocketType.OUTPUT: return outputSd;
      }
    };
  }

  readonly payloads: PayloadDescriptor[];

  payload (): PayloadDescriptor {
    if (this.payloads.length > 1) {
      throw new Error('Socket descriptor has more than on payload descriptor');
    }
    if (this.payloads.length === 0) {
      throw new Error('Socket descriptor has no payload descriptors');
    }
    return this.payloads[0];
  }

  constructor (payloads?: PayloadDescriptor[]) {
    this.payloads = payloads || [];
  }

  isVoid (): boolean {
    return this.payloads.length === 0;
  }

  toJson (): string {
    try {
      return JSON.stringify(this);
    } catch (err) {
      throw new Error('Could not serialize socket descriptor. JSON error: ' + err.messsage);
    }
  }
}

export interface SocketOwner extends SignalReceiver {
  getOwnSockets(): Set<Socket>;
  cast(signal: Signal): SignalReceiverCastResult;
}

export interface SeekableOutputSocket extends OutputSocket {
  seek(start: number, end?: number): boolean;
}

export interface URLLoadingOutputSocket extends OutputSocket {
  load(url: string): boolean;
}

export { Socket } from './socket-base';
export { OutputSocket } from './socket-output';
export { InputSocket } from './socket-input';
