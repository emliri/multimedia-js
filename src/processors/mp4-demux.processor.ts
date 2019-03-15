import { Processor, ProcessorEvent } from '../core/processor';
import { Packet, PacketSymbol } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType, OutputSocket, SocketTemplateGenerator } from '../core/socket';

import { getLogger, LoggerLevel } from '../logger';

import { createMp4Demuxer, Mp4Demuxer, Track, Frame, TracksHash, Atom } from '../ext-mod/inspector.js/src';
import { Mp4Track } from '../ext-mod/inspector.js/src/demuxer/mp4/mp4-track';
import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';
import { Esds } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/esds';
import { AudioAtom } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/helpers/audio-atom';
import { VideoAtom } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/helpers/video-atom';

import { PayloadDescriptor } from '../core/payload-description';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { ErrorCode } from '../core/error';

const { log, warn, debug } = getLogger('MP4DemuxProcessor', LoggerLevel.ERROR);

export const AUDIO_SAMPLING_RATES_LUT = [5500, 11025, 22050, 44100];
export const AAC_SAMPLES_PER_FRAME = 1024;

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('audio/mp4', 'video/mp4'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac') // output
  );

export class MP4DemuxProcessor extends Processor {
  static getName (): string {
    return 'MP4DemuxProcessor';
  }

    private _demuxer: Mp4Demuxer;

    private _haveStreamStart: boolean = false;

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
        log('creating ouput socket with mime-type:', track.mimeType, 'socket-descriptor:', sd);
        this._trackIdToOutputs[track.id] = this.createOutput(sd);
      }

      return this._trackIdToOutputs[track.id];
    }

    protected handleSymbolicPacket_ (s: PacketSymbol) {
      log('handling symbol:', s);

      if (!this._haveStreamStart && s === PacketSymbol.EOS) {
        this.emit(ProcessorEvent.ERROR,
          this.createErrorEvent(ErrorCode.PROC_EARLY_EOS,
            'Got EOS without any previous data. Input socket may have failed to consume.'));
      }

      return super.handleSymbolicPacket_(s);
    }

    protected processTransfer_ (inS: InputSocket, p: Packet) {

      this._haveStreamStart = true;

      p.data.forEach((bufferSlice) => {
        this._demuxer.append(bufferSlice.getUint8Array());
        this._demuxer.end();

        const tracks: TracksHash = this._demuxer.tracks;

        if (Object.keys(tracks).length === 0) {
          this.emitErrorEvent(ErrorCode.PROC_BAD_FORMAT, "No tracks were found in the parsed data (expecting MP4/MOV)");
          return;
        }

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

          // let frameRate: number = NaN; // add a Mp4Track property for this and extract inside inspector.js
          let sampleDepth: number = NaN;
          let sampleRate: number = NaN;
          let sampleDurationNum: number = 1;
          let numChannels: number = NaN;
          let samplesCount: number = 1;
          let constantBitrate: number = NaN;
          let codecData: Uint8Array = null;

          if (track.type === Mp4Track.TYPE_VIDEO) {
            const videoAtom = <VideoAtom> track.getMetadataAtom();
            // FIXME: support HEVC too
            const avcC = (<AvcC> track.getReferenceAtom());
            if (!avcC) {
              warn('no codec data found for video track with id:', track.id);
              continue;
            }

            const avcCodecData = avcC.data;
            const spsParsed = avcC.spsParsed[0];

            /*
            // we should not rely on this information since it might not be present (it's optional data inside the SPS)
            sampleRate = spsParsed.frameRate.fpsNum;
            sampleDurationNum = spsParsed.frameRate.fpsDen;
            */

            sampleDepth = spsParsed.bitDepth;

            sampleDurationNum = 1;

            if (track.getFrames().length > 1) {
              sampleRate = 1 / (track.getFrames()[1].getDecodingTimestampInSeconds() -
                                  track.getFrames()[0].getDecodingTimestampInSeconds());
              sampleRate = Math.round(sampleRate);
              log('estimated FPS:', sampleRate);
            } else {
              warn('only found 1 single frame in video track, setting FPS to zero');
              sampleRate = 0;
            }

            if (avcC.numOfSequenceParameterSets > 1) {
              warn('more than one SPS found, but only handling one here');
            }

            if (avcC.numOfPictureParameterSets > 1 || avcC.numOfSequenceParameterSets > 1) {
              throw new Error('No support for more than one sps/pps pair');
            }

            codecData = avcCodecData;

            /*
            const sps: Uint8Array[] = avcC.sps;
            const pps: Uint8Array[] = avcC.pps;
            console.log('pushing SPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(sps[0], initProps)));
            console.log('pushing PPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(pps[0], initProps)));
            */

          } else if (track.type === Mp4Track.TYPE_AUDIO) {
            const audioAtom = <AudioAtom> track.getMetadataAtom();
            sampleDepth = audioAtom.sampleSize;
            numChannels = audioAtom.channelCount;
            sampleRate = audioAtom.sampleRate;

            log('channels:', numChannels, 'sample-rate:', sampleRate, 'sample-depth:', sampleDepth);

            // FIXME: support MP3 too (this is for AAC only)
            const esds = (<Esds> track.getReferenceAtom());
            if (!esds) {
              warn('no codec data found for audio track with id:', track.id);
              continue;
            }

            const audioDecoderConfig = esds.decoderConfig;
            log('found ESDS/AAC decoder config:', audioDecoderConfig);

            constantBitrate = audioDecoderConfig.avgBitrate;

            log('cbr:', constantBitrate, 'b/s');
            log('flagged ESDS-atom-data packet as bitstream header');

            const esdsData = esds.data;
            codecData = esdsData;
          }

          let sampleDuration = track.getDefaults() ? track.getDefaults().sampleDuration : 1;

          log('sample-duration found:', sampleDuration, 'numerator:', sampleDurationNum);

          const protoProps: BufferProperties = new BufferProperties(
            track.mimeType,
            sampleRate,
            sampleDepth,
            sampleDurationNum,
            samplesCount
          );

          protoProps.details.sequenceDurationInSeconds = track.getDurationInSeconds();

          if (track.isVideo()) {
            protoProps.details.width = track.getResolution()[0];
            protoProps.details.height = track.getResolution()[1];
            protoProps.details.samplesPerFrame = 1;
            protoProps.codec = 'avc';
          } else if (track.isAudio()) {
            protoProps.details.numChannels = numChannels;
            protoProps.details.constantBitrate = constantBitrate;
            protoProps.details.samplesPerFrame = AAC_SAMPLES_PER_FRAME;
            protoProps.codec = 'aac';
          }

          if (codecData) {
            const initProps: BufferProperties = protoProps.clone();
            initProps.isBitstreamHeader = true;
            log('created/transferring codec data packet; flagged bitstream header');
            const initPacket = Packet.fromSlice(BufferSlice.fromTypedArray(codecData, initProps));
            initPacket.setTimescale(track.getTimescale());
            output.transfer(initPacket);
          }

          track.getFrames().forEach((frame: Frame) => {
            let props = protoProps;

            if (frame.frameType === Frame.IDR_FRAME) {
              log('got idr-frame at:', frame.timeUs, '[us]');
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

            // log('timescale:', frame.timescale)

            debug('pushing packet with:', frameSlice.toString());

            output.transfer(p);
          });
        }
      });

      return true;
    }
}
