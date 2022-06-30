import { Processor, ProcessorEvent } from '../core/processor';
import { Packet, PacketSymbol } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { PayloadDescriptor } from '../core/payload-description';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { ErrorCode } from '../core/error';

import { getLogger, LoggerLevel } from '../logger';

import { AAC_SAMPLES_PER_FRAME } from './aac/adts-utils';
import { debugAccessUnit } from './h264/h264-tools';

import { createMp4Demuxer, Mp4Demuxer, Track, Frame, TracksHash } from '../ext-mod/inspector.js/src';
import { Mp4Track } from '../ext-mod/inspector.js/src/demuxer/mp4/mp4-track';
import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';
import { Esds } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/esds';
import { AudioAtom } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/helpers/audio-atom';
import { VideoAtom } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/helpers/video-atom';

import { FRAME_TYPE } from '../ext-mod/inspector.js/src/codecs/h264/nal-units';

const { log, warn, error, debug } = getLogger('MP4DemuxProcessor', LoggerLevel.OFF, true);

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
      log('handling symbol:', PacketSymbol[s]);

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
          error('No tracks found in input data');
          this.emitErrorEvent(ErrorCode.PROC_BAD_FORMAT, 'No tracks were found in the parsed data (expecting MP4/MOV)');
          return;
        }

        for (const trackId in tracks) {
          const track: Mp4Track = <Mp4Track> tracks[trackId];

          log('analyzing track with id:', trackId);

          if (!track.hasTimescale()) {
            throw new Error(`Track type=${track.type} id=${track.id} timescale is not present (has not been set or determined on parsing). Can not proceed with processing frames timing info.`);
          }
          const timescale = track.getTimescale();
          const duration = track.getDuration();
          const durationInSeconds = track.getDuration() / timescale;

          log(
            'id:', track.id,
            'type:', track.type,
            'mime-type:', track.mimeType,
            'duration:', duration, '/', duration / timescale, '[s]',
            'timescale:', timescale
          );

          if (track.isVideo()) {
            log('video-track resolution:', track.getResolution());
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
          const samplesCount: number = 1;
          let constantBitrate: number = NaN;
          const codecDataList: Uint8Array[] = [];
          let codecProfile: number = NaN;

          if (track.isVideo()) {
            log('video track found with id:', track.id);

            // FIXME: support HEVC too
            const avcCList: AvcC[] = (<AvcC[]> track.getReferenceAtoms());
            if (!avcCList.length) {
              warn('no codec data found for video track with id:', track.id);
              continue;
            }

            avcCList.forEach((avcC: AvcC) => {
              const avcCodecData = avcC.data;
              const spsParsed = avcC.spsParsed[0];

              codecProfile = avcC.profile;

              /*
              // we should not rely on this information since it might not be present (it's optional data inside the SPS)
              sampleRate = spsParsed.frameRate.fpsNum;
              sampleDurationNum = spsParsed.frameRate.fpsDen;
              */

              sampleDepth = spsParsed.bitDepth;

              sampleDurationNum = 1;

              if (track.getFrames().length > 1) {
                // NOTE: we need to use DTS here because PTS is unordered so
                // using two consecutive packets results in an arbitrary time-delta
                // whereas he we have to assume however that packet DTS frequency (DTS-deltas between successive packets)
                // is exactly equal to the framerate. This should be the case always, but must not, because
                // in principle the deltas may vary around the framerate (average on the receiver/decoder buffer/queue size they have to keep the
                // framerate otherwise the sequence could not be decoded in real-time).
                // FIXME: Thus the calculation could be wrong here in certain cases.
                // NOTE: In principle, DTS could even also be anything that preserves decoding order unrelated to the PTS timeplane!
                sampleRate = timescale / (track.getFrames()[1].dts - track.getFrames()[0].dts);
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

              codecDataList.push(avcCodecData);
            });

            /*
            const sps: Uint8Array[] = avcC.sps;
            const pps: Uint8Array[] = avcC.pps;
            console.log('pushing SPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(sps[0], initProps)));
            console.log('pushing PPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(pps[0], initProps)));
            */
          } else if (track.isAudio()) {
            log('audio track found with id:', track.id);

            const audioAtom = <AudioAtom> track.getMetadataAtom();
            sampleDepth = audioAtom.sampleSize;
            numChannels = audioAtom.channelCount;
            sampleRate = audioAtom.sampleRate;

            log('channels:', numChannels, 'sample-rate:', sampleRate, 'sample-depth:', sampleDepth);

            // FIXME: support MP3 too (this is for AAC only)
            const esds = (<Esds> track.getReferenceAtoms()[0]);
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
            codecDataList.push(esdsData);
          } else {
            warn('track found is unhandled kind:', track.mimeType);

            throw new Error('Unhandled mp4 track-type. Mime-type is: ' + track.mimeType);
          }

          const sampleDuration = track.getDefaults()[0] ? track.getDefaults()[0].sampleDuration : 1;

          log('sample-duration found:', sampleDuration, 'numerator:', sampleDurationNum, 'sample-rate:', sampleRate);

          const protoProps: BufferProperties = new BufferProperties(
            track.mimeType,
            sampleRate,
            sampleDepth,
            sampleDurationNum,
            samplesCount
          );

          protoProps.details.sequenceDurationInSeconds = durationInSeconds;

          if (track.isVideo()) {
            protoProps.details.width = track.getResolution()[0];
            protoProps.details.height = track.getResolution()[1];
            protoProps.details.samplesPerFrame = 1;
            protoProps.details.codecProfile = codecProfile;
            protoProps.codec = 'avc';
          } else if (track.isAudio()) {
            // TODO: add audio object type (from ESDS DecoderConfigDescriptor)
            protoProps.details.numChannels = numChannels;
            protoProps.details.constantBitrate = constantBitrate;
            protoProps.details.samplesPerFrame = AAC_SAMPLES_PER_FRAME;
            protoProps.codec = 'aac';
          }

          codecDataList.forEach((codecData: Uint8Array) => {
            const initProps: BufferProperties = protoProps.clone();
            initProps.isBitstreamHeader = true;
            log('created/transferring codec data packet; flagged bitstream header');
            const initPacket = Packet.fromSlice(BufferSlice.fromTypedArray(codecData, initProps));
            initPacket.setTimescale(timescale);
            output.transfer(initPacket);
          });

          track.getFrames().forEach((frame: Frame) => {
            let props = protoProps;

            if (frame.frameType === FRAME_TYPE.I) {
              log('got idr-frame at:',
                frame.dts, '/',
                frame.dts / timescale, '[s]');

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
            p.setTimingInfo(frame.dts, frame.cto, timescale);

            debug('pushing packet with:', frameSlice.toString());

            output.transfer(p);
          });
          // flush will remove the frames from the demuxers internal track states
          this._demuxer.flush();
        }
      });

      return true;
    }
}
