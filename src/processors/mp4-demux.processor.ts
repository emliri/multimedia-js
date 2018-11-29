import { Processor } from '../core/processor';
import { Packet, PacketSymbol } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType, OutputSocket, SocketTemplateGenerator } from '../core/socket';

import { getLogger, LoggerLevels } from '../logger';

import { createMp4Demuxer, Mp4Demuxer, Track, Frame, TracksHash, Atom } from '../ext-mod/inspector.js/src';
import { Mp4Track } from '../ext-mod/inspector.js/src/demuxer/mp4/mp4-track';
import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';
import { Esds } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/esds';

import { PayloadDescriptor } from '../core/payload-description';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';

const { log, warn, debug, error } = getLogger('MP4DemuxProcessor', LoggerLevels.LOG);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
      SocketDescriptor.fromMimeTypes('audio/mp4', 'video/mp4'), // valid inputs
      SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac') // output
      );

export class MP4DemuxProcessor extends Processor {

    static getName(): string { return "MP4DemuxProcessor" }

    private _demuxer: Mp4Demuxer;

    private _trackIdToOutputs: { [id: number] : OutputSocket} = {};

    constructor () {
      super();
      this.createInput();

      this._demuxer = createMp4Demuxer();
    }

    templateSocketDescriptor (st: SocketType): SocketDescriptor {
      return getSocketDescriptor(st);
    }

    private _ensureOutputForTrack (track: Track): OutputSocket {
      const payloadDescriptor = new PayloadDescriptor(track.mimeType);
      const sd = new SocketDescriptor([
        payloadDescriptor
      ]);

      if (!this._trackIdToOutputs[track.id]) {
        this._trackIdToOutputs[track.id] = this.createOutput(sd);
      }

      return this._trackIdToOutputs[track.id];
    }

    protected handleSymbolicPacket_(s: PacketSymbol) {
      log('handling symbol:', s)
      return super.handleSymbolicPacket_(s);
    }

    protected processTransfer_ (inS: InputSocket, p: Packet) {

      p.data.forEach((bufferSlice) => {

        this._demuxer.append(bufferSlice.getUint8Array());
        this._demuxer.end();

        const tracks: TracksHash = this._demuxer.tracks;

        for (const trackId in tracks) {

          const track: Mp4Track = <Mp4Track> tracks[trackId];

          log(
            'mime-type:', track.mimeType,
            'id:', track.id,
            'duration:', track.getDuration(),
            'type:', track.type,
            'timescale:', track.getTimescale());

          if (track.isVideo()) {
            log('video-track:', track.getResolution());
          }

          log('defaults:', track.getDefaults());

          if (!track.getDefaults()) {
            warn('no track defaults');
          }

          const output: OutputSocket = this._ensureOutputForTrack(track);

          //let frameRate: number = NaN; // add a Mp4Track property for this and extract inside inspector.js
          let sampleDepth: number = NaN;
          let sampleRate: number = NaN;
          let sampleDurationNum: number = 1;
          let numChannels: number = NaN;
          let samplesCount: number = 1;

          if (track.type === Mp4Track.TYPE_VIDEO) {
            // FIXME: support HEVC too
            const avcC = (<AvcC> track.getReferenceAtom());
            if (!avcC) {
              warn('no codec data found for video track with id:', track.id);
              continue;
            }

            const avcCodecData = avcC.data;

            const initProps: BufferProperties = new BufferProperties(track.mimeType);
            initProps.isBitstreamHeader = true;

            log('flagged packet as bitstream header')

            const spsParsed = avcC.spsParsed[0];

            sampleRate = spsParsed.frameRate.fpsNum;
            sampleDurationNum = spsParsed.frameRate.fpsDen;
            sampleDepth = spsParsed.bitDepth;

            if (avcC.numOfSequenceParameterSets > 1) {
              warn('more than one SPS found, but only handling one here!');
            }

            /*
            const sps: Uint8Array[] = avcC.sps;
            const pps: Uint8Array[] = avcC.pps;
            console.log('pushing SPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(sps[0], initProps)));
            console.log('pushing PPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(pps[0], initProps)));
            */

            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(avcCodecData, initProps)));

            if (avcC.numOfPictureParameterSets > 1 || avcC.numOfSequenceParameterSets > 1) {
              throw new Error('No support for more than one sps/pps pair');
            }
          }

          else if (track.type === Mp4Track.TYPE_AUDIO) {
            // FIXME: support MP3 too (this is for AAC only)
            const esds = (<Esds> track.getReferenceAtom());
            if (!esds) {
              warn('no codec data found for audio track with id:', track.id);
              continue;
            }

            const audioDecoderConfig = esds.decoderConfig.decoderConfigDescriptor;
            log('found AAC decoder config:', audioDecoderConfig);

            sampleDepth = 16;
            //samplesCount =
            numChannels = audioDecoderConfig.channelConfiguration

            const initProps: BufferProperties = new BufferProperties(track.mimeType);
            initProps.isBitstreamHeader = true;

            log('flagged ESDS-atom-data packet as bitstream header')

            const esdsData = esds.data;
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(esdsData, initProps)));
          }

          let sampleDuration = track.getDefaults() ? track.getDefaults().sampleDuration : 1;

          log('sample-duration found:', sampleDuration)

          const protoProps: BufferProperties = new BufferProperties(
            track.mimeType,
            sampleRate,
            sampleDepth,
            sampleDurationNum,
            samplesCount
          );

          if (track.isVideo()) {
            protoProps.details.width = track.getResolution()[0];
            protoProps.details.height = track.getResolution()[1];
          } else if (track.isAudio()) {
            protoProps.details.numChannels = numChannels;
          }

          // General time-delta applied to these tracks buffers
          protoProps.timestampDelta = 0;

          track.getFrames().forEach((frame: Frame) => {

            let props = protoProps;

            if (frame.frameType === Frame.IDR_FRAME) {
              log('got idr-frame at:', frame.timeUs, '[us]')
              props = protoProps.clone();
              props.isKeyframe = true;
            }

            const frameSlice = bufferSlice.unwrap(
              frame.bytesOffset,
              frame.size,
              props
            );

            const p: Packet = Packet.fromSlice(frameSlice);

            // timestamps of this packet
            p.timestamp = frame.scaledDecodingTime;
            p.presentationTimeOffset = frame.scaledPresentationTimeOffset;
            p.setTimescale(frame.timescale);

            //log('timescale:', frame.timescale)

            debug('pushing packet with:', frameSlice.toString());

            output.transfer(p);
          });
        }
      });

      return true;
    }
}
