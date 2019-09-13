import { Processor } from '../core/processor';

import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet, PacketSymbol } from '../core/packet';

import { getLogger } from '../logger';
import { PayloadDescriptor, PayloadCodec } from '../core/payload-description';
import { runMpegTsDemux } from './mpeg-ts/ts-demuxer-w';
import { BufferSlice } from '../core/buffer';
import { debugAccessUnit } from './h264/h264-tools';

const { log } = getLogger('MPEGTSDemuxProcessor');

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac', 'application/cea-608') // output
  );

export class MPEGTSDemuxProcessor extends Processor {
  static getName (): string {
    return 'MPEGTSDemuxProcessor';
  }

  private _programMap: {[pid: number]: OutputSocket} = {};
  private _haveAudio: boolean = false;
  private _haveVideo: boolean = false;

  constructor () {
    super();
    this.createInput();
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected onTaskWorkerMessage (event: Event) {
    const p = Packet.fromTransferable((event as any).data.packet);

    if (p.isSymbolic()) {
      this.out.forEach((os) => os.transfer(p));
      return;
    }

    this._processDemuxerOutputPacket(p);
  }

  private _processDemuxerOutputPacket (p: Packet) {
    const bs = p.data[0];

    if (!this._haveVideo && PayloadCodec.isAvc(bs.props.codec)) {
      this._haveVideo = true;
    } else if (!this._haveAudio && PayloadCodec.isAac(bs.props.codec)) {
      this._haveAudio = true;
    }

    // set mpeg-ts timescale of 90000khz
    p.setTimescale(90000);

    this._getOutputForPayload(bs.props).transfer(p);
  }

  private _getOutputForPayload (payloadDescriptor: PayloadDescriptor): OutputSocket {
    const pid = payloadDescriptor.elementaryStreamId;
    if (this._programMap[pid]) {
      return this._programMap[pid];
    }
    log('creating new output for stream-id (PID):', pid, 'with codec:', payloadDescriptor.codec);
    const s = this._programMap[pid] = this.createOutput(new SocketDescriptor([payloadDescriptor]));
    return s;
  }

  protected processTransfer_ (inS: InputSocket, inPacket: Packet) {
    const outputPackets: Packet[] = runMpegTsDemux(inPacket);

    let audioSocket: OutputSocket = null;
    let videoSocket: OutputSocket = null;

    outputPackets.forEach((p: Packet) => {
      if (p.isSymbolic()) {
        console.log('got symbolic packet:', p.getSymbolName());
        return;
      }

      if (p.defaultPayloadInfo.isVideo()) {
        if (!videoSocket) {
          videoSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        // if (videoSocket.

        p.forEachBufferSlice((bs) => debugAccessUnit(bs, true));

        videoSocket.transfer(p);
      } else if (p.defaultPayloadInfo.isAudio()) {
        if (!audioSocket) {
          audioSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        audioSocket.transfer(p);
      } else {
        throw new Error('Unsupported payload: ' + p.defaultMimeType);
      }
    });

    return true;
  }
}
