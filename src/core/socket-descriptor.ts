import { PayloadDescriptor } from './payload-description';
import { SocketTemplateGenerator, SocketType } from './socket';

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
   * !! NOTE: Keep this aligned with BufferProperties.clone
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

  hasAudio (): boolean {
    return this.payloads.some((payload) => payload.isAudio());
  }

  hasVideo (): boolean {
    return this.payloads.some((payload) => payload.isVideo());
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
