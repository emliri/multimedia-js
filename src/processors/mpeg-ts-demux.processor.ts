import { Processor } from '../core/processor';

import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';

import { getLogger } from '../logger';
import { PayloadDescriptor, PayloadCodec } from '../core/payload-description';

const { log } = getLogger('MPEGTSDemuxProcessor');

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
      SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
      SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac', 'application/cea-608') // output
      );

export class MPEGTSDemuxProcessor extends Processor {

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

  protected onWorkerMessage (event: Event) {

    const p = Packet.fromTransferable((event as any).data.packet);

    if (p.isSymbolic()) {
      this.out.forEach((os) => os.transfer(p));
      return;
    }

    this.processDemuxerOutputPacket(p);

  }

  private processDemuxerOutputPacket(p: Packet) {

    const bs = p.data[0];

    if (!this._haveVideo && PayloadCodec.isAvc(bs.props.codec)) {
      this._haveVideo = true;
    } else if (!this._haveAudio && PayloadCodec.isAac(bs.props.codec)) {
      this._haveAudio = true;
    }

    // set mpeg-ts timescale of 90000khz
    p.setTimescale(90000);

    this.getOutput(bs.props).transfer(p);
  }

  private getOutput(payloadDescriptor: PayloadDescriptor): OutputSocket {
    const pid = payloadDescriptor.elementaryStreamId;
    if (this._programMap[pid]) {
      return this._programMap[pid];
    }
    log('creating new output for stream-id (PID):', pid, 'with codec:', payloadDescriptor.codec);
    const s = this._programMap[pid] = this.createOutput(new SocketDescriptor([payloadDescriptor]));
    return s;
  }

  protected processTransfer_ (inS: InputSocket, p: Packet) {

    this.dispatchWorkerTask('tsdemuxer', p);

    return true;
  }

}
