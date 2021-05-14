/**
 * Copyright 2015 Mozilla Foundation
 * Copyright 2016 - 2020 Stephan Hesse, EMLIRI (c)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  TrackBox,
  SampleEntry,
  SampleFlags,
  AudioSampleEntry,
  VideoSampleEntry,
  VideoMediaHeaderBox,
  TrackHeaderFlags,
  TrackHeaderBox,
  MediaBox,
  MediaHeaderBox,
  MediaInformationBox,
  HandlerBox,
  DataInformationBox,
  DataEntryUrlBox,
  DataReferenceBox,
  SampleTableBox,
  MovieExtendsBox,
  MovieFragmentBox,
  TrackExtendsBox,
  TrackRunBox,
  MetaBox,
  MovieHeaderBox,
  MovieFragmentHeaderBox,
  MovieBox,
  FileTypeBox,
  TrackFragmentBox,
  TrackFragmentBaseMediaDecodeTimeBox,
  TrackFragmentHeaderBox,
  TrackRunSample,
  TrackFragmentFlags,
  TrackRunFlags,
  MediaDataBox,
  StblSample,
  SoundMediaHeaderBox,
  SELF_CONTAINED_DATA_REFERENCE_FLAG
} from './mp4iso-boxes';

import { BoxContainerBox, Box, RawTag } from './mp4iso-base';
import { SampleTablePackager } from './mp4iso-sample-table';

import { hexToBytes, flattenOneDeepNestedArray } from '../../common-utils';
import { getLogger, LoggerLevel } from '../../logger';

const { warn, debug } = getLogger('Mp4Mux', LoggerLevel.OFF, true);

export const AAC_SAMPLES_PER_FRAME = 1024;

export const AAC_SAMPLING_FREQUENCIES = [
  96000,
  88200,
  64000,
  48000,
  44100,
  32000,
  24000,
  22050,
  16000,
  12000,
  11025,
  8000,
  7350
];

export const SOUND_CODECS = [
  'PCM',
  'ADPCM',
  'MP3',
  'PCM le',
  'Nellymouser16',
  'Nellymouser8',
  'Nellymouser',
  'G.711 A-law',
  'G.711 mu-law',
  null, // ???
  'AAC',
  'Speex',
  'MP3 8khz'
];

export const MP3_SOUND_CODEC_ID = 2;
export const AAC_SOUND_CODEC_ID = 10;

export type AudioFrame = {
  decodingTime: number,
  compositionTime: number,
  codecDescription: string;
  codecId: number;
  data: Uint8Array;
  rate: number;
  size: number;
  channels: number;
  samples: number;
  type: AudioFrameType;
  sampleDescriptionIndex: number;
}

export enum AudioFrameType {
  HEADER = 0,
  RAW = 1,
}

export type AudioDetails = {
  sampleRate: number,
  sampleDepth: number,
  samplesPerFrame: number,
  numChannels: number
}

export const VIDEOCODECS = [null, 'JPEG', 'Sorenson', 'Screen', 'VP6', 'VP6 alpha', 'Screen2', 'AVC'];
export const VP6_VIDEO_CODEC_ID = 4;
export const AVC_VIDEO_CODEC_ID = 7;

export type VideoFrame = {
  frameFlag: VideoFrameFlag;
  codecId: number;
  codecDescription: string;
  data: Uint8Array;
  type: VideoFrameType; // TODO: get rid of this
  decodingTime: number,
  compositionTime: number;
  horizontalOffset?: number;
  verticalOffset?: number;
  sampleDescriptionIndex: number;
}

export enum VideoFrameFlag {
  KEY = 1,
  INTRA = 2,
}

export enum VideoFrameType {
  HEADER = 0,
  NALU = 1
}

export enum MP4MuxFrameType {
  AUDIO = 8,
  VIDEO = 9 // legacy support numbers (for FLV package! :D), not sure if can be replaced
}

export type MP4Track = {
  // general
  codecDescription?: string;
  codecId: number;
  timescale: number;
  duration: number, // -1 for unknown

  // video
  framerate?: number;
  width?: number;
  height?: number;

  // audio
  samplerate?: number;
  channels?: number;
  samplesize?: number;
  audioObjectType?: number;

  // audio/subs
  language?: string;
}

export type MP4MovieMetadata = {
  tracks: MP4Track[];
  duration: number;
  audioTrackId: number;
  videoTrackId: number;
  audioBaseDts: number;
  videoBaseDts: number;
}

export enum MP4MuxState {
  CAN_GENERATE_HEADER = 0,
  NEED_HEADER_DATA = 1,
  MAIN_PACKETS = 2
}

export type MP4TrackState = {
  trackId: number;
  trackInfo: MP4Track;
  cachedDuration: number;
  samplesProcessed: number;
  initializationData: Uint8Array[];
  mimeTypeCodec?: string;
}

type CachedFrame = {
  frame: AudioFrame | VideoFrame;
  timestamp: number;
  trackId: number;
}

export class MP4Mux {
    private _trackStates: MP4TrackState[] = null;
    private _audioTrackState: MP4TrackState = null;
    private _videoTrackState: MP4TrackState = null;

    private _cachedFrames: CachedFrame[] = [];

    private _filePos: number = 0;
    private _fragmentCount: number = 0;

    private _state: MP4MuxState = null; // TODO: have proper init state in enum

    oncodecinfo: (codecs: string[]) => void = (codecs: string[]) => {
      throw new Error('MP4Mux.oncodecinfo is not set');
    };

    ondata: (data: Uint8Array) => void = (data) => {
      throw new Error('MP4Mux.ondata is not set');
    };

    public constructor (
      private _movMetadata: MP4MovieMetadata,
      private _fragmentedMode: boolean = true,
      private _generateHeader: boolean = true
    ) {
      this._trackStates = this._movMetadata.tracks.map((trackInfo: MP4Track, index) => {
        const state: MP4TrackState = {
          trackId: index + 1,
          trackInfo,
          cachedDuration: 0,
          samplesProcessed: 0,
          initializationData: []
        };
        if (this._movMetadata.audioTrackId === state.trackId) {
          state.cachedDuration = this._movMetadata.audioBaseDts;
          this._audioTrackState = state;
        }
        if (this._movMetadata.videoTrackId === state.trackId) {
          state.cachedDuration = this._movMetadata.videoBaseDts;
          this._videoTrackState = state;
        }
        return state;
      }, this);

      this._initNeedHeaderDataState();
    }

    /**
     * @returns Number of fragments/chunks written (only fragmented mode)
     */
    public getFragmnentCount (): number {
      return this._fragmentCount; // will be pre-incremented on each fragment
    }

    /**
     * @returns {number} Position bytes offset of output file data
     */
    public getFilePosition (): number {
      return this._filePos;
    }

    public getAudioTrackState (): MP4TrackState {
      return this._audioTrackState;
    }

    public getVideoTrackState (): MP4TrackState {
      return this._videoTrackState;
    }

    getMovieMetadata (): MP4MovieMetadata {
      return this._movMetadata;
    }

    public pushFrame (
      type: MP4MuxFrameType,
      codecId: number,
      data: Uint8Array,
      timestamp: number,
      isInitData: boolean = false,
      isKeyframe: boolean = false,
      cto: number = 0,
      audioDetails: AudioDetails = null
    ) {
      switch (type) {
      case MP4MuxFrameType.AUDIO: {
        const audioTrack = this._audioTrackState;
        const { trackId } = audioTrack;
        let frame: AudioFrame;

        if (!audioDetails) {
          throw new Error('We need audio-details');
        }

        const { sampleRate, sampleDepth, samplesPerFrame, numChannels } = audioDetails;

        frame = {
          data,
          decodingTime: timestamp,
          compositionTime: timestamp + cto,
          codecId,
          codecDescription: SOUND_CODECS[codecId],
          rate: sampleRate,
          size: sampleDepth,
          channels: numChannels,
          samples: samplesPerFrame,
          type: isInitData ? AudioFrameType.HEADER : AudioFrameType.RAW,
          sampleDescriptionIndex: 1 // FIXME: hard-coding to 1 breaks previous support
          // for AAC codec config in-stream discontinuities (used rather in MOV mode)
          // -> should use audioDetails as sortof high-level init-data here
        };

        if (!audioTrack || audioTrack.trackInfo.codecId !== frame.codecId) {
          throw new Error('Unexpected audio packet codec: ' + frame.codecDescription);
        }

        this._cachedFrames.push({ frame, timestamp, trackId });

        break;
      }

      case MP4MuxFrameType.VIDEO: {
        const videoTrack = this._videoTrackState;
        const { trackId } = videoTrack;
        const frame: VideoFrame = {
          data,
          frameFlag: isKeyframe ? VideoFrameFlag.KEY : VideoFrameFlag.INTRA,
          codecId: AVC_VIDEO_CODEC_ID,
          codecDescription: VIDEOCODECS[AVC_VIDEO_CODEC_ID],
          type: isInitData ? VideoFrameType.HEADER : VideoFrameType.NALU,
          decodingTime: timestamp,
          compositionTime: timestamp + cto,
          sampleDescriptionIndex: videoTrack.initializationData.length
        };

        if (!videoTrack || videoTrack.trackInfo.codecId !== frame.codecId) {
          throw new Error('Unexpected video packet codec: ' + frame.codecDescription);
        }

        if (frame.type === VideoFrameType.NALU) { // store frame
          this._cachedFrames.push({ frame, timestamp, trackId });
        } else if (frame.type === VideoFrameType.HEADER) { // store init data
          this._insertCodecInitData(videoTrack, frame);
        }

        break;
      }

      default:
        throw new Error('unknown packet type: ' + type);
      }

      if (this._state === MP4MuxState.CAN_GENERATE_HEADER) {
        this._generateMovieHeaderFragmentedMode();
      }
    }

    public flush () {
      if (this._cachedFrames.length > 0) {
        if (this._fragmentedMode) {
          this._generateMovieFragment();
        } else {
          this._generatePlainMovFile();
        }
      }
    }

    public reset () {
      this._filePos = 0;
      this._fragmentCount = 0;
      this._cachedFrames.length = 0;
    }

    private _initNeedHeaderDataState () {
      if (this._trackStates.some((ts) =>
        ts.trackInfo.codecId === AVC_VIDEO_CODEC_ID)) {
        this._state = MP4MuxState.NEED_HEADER_DATA;
      } else {
        this._state = MP4MuxState.CAN_GENERATE_HEADER;
      }
    }

    private _insertCodecInitData (track: MP4TrackState, frame: VideoFrame) {
      switch (frame.codecId) {
      case VP6_VIDEO_CODEC_ID:
      case AVC_VIDEO_CODEC_ID:
        track.initializationData.push(frame.data);
        this._state = MP4MuxState.CAN_GENERATE_HEADER; // this should only transit on init-data check for all tracks
        break;
      default: throw new Error('unsupported video codec: ' + frame.codecDescription);
      }
    }

    private _generatePlainMovFile () {
      if (this._fragmentedMode) {
        throw new Error('_generatePlainMovFile can not be called in fragmented mode');
      }

      const [mdat, sampleTablesData] = this._createPlainMovMediaData();

      const header = this._makeMovHeader(false, sampleTablesData, mdat);
      if (!header) {
        throw new Error('Failed to generate moov header data for plain MOV file');
      }

      this.oncodecinfo(this._trackStates.map((ts) => ts.mimeTypeCodec));
      this.ondata(header);
    }

    // TODO: make static (is stateless) and/or move to iso-boxes module
    private _createTrackBox (

      trakFlags: number,
      trackState: MP4TrackState,
      trackInfo: MP4Track,
      handlerType: string,
      handlerName: string,
      sampleTable: SampleTableBox,
      ordinalIndex: number): TrackBox {
      let specificMediaHandlerBox: SoundMediaHeaderBox | VideoMediaHeaderBox = null;
      let volume = 0;
      let width = 0;
      let height = 0;

      if (handlerType === 'soun') {
        volume = 1.0;
        specificMediaHandlerBox = new SoundMediaHeaderBox(0);
      } else if (handlerType === 'vide') {
        width = trackInfo.width;
        height = trackInfo.height;
        specificMediaHandlerBox = new VideoMediaHeaderBox();
      } else {
        throw new Error('Unknown handler-type: ' + handlerType);
      }

      // TODO: make these constants

      const trak = new TrackBox(
        new TrackHeaderBox(trakFlags,
          trackState.trackId,
          trackInfo.duration / trackInfo.timescale, // FIXME: use unscaled duration values on external interface
          width, height,
          volume,
          ordinalIndex),
        new MediaBox(
          new MediaHeaderBox(trackInfo.timescale, trackInfo.duration, trackInfo.language),
          new HandlerBox(handlerType, handlerName),
          new MediaInformationBox(
            specificMediaHandlerBox,
            new DataInformationBox(
              new DataReferenceBox([new DataEntryUrlBox(SELF_CONTAINED_DATA_REFERENCE_FLAG)])),
            sampleTable
          )
        )
      );
      return trak;
    }

    private _createPlainMovMediaData (): [MediaDataBox, StblSample[][]] {
      const cachedPackets = this._cachedFrames;
      const sampleTablesData: StblSample[][] = [];
      const chunks: Uint8Array[][] = [];

      let samples: StblSample[] = null;

      for (let i = 0; i < this._trackStates.length; i++) {
        const trackState = this._trackStates[i];
        const trackInfo = trackState.trackInfo;
        const trackId = trackState.trackId;

        // Finding all packets for this track.
        const trackPackets = cachedPackets.filter((cp) => cp.trackId === trackId);
        if (trackPackets.length === 0) {
          continue;
        }

        samples = []; // reset sample list
        chunks.push([]); // init new chunk as empty list of uint8arrays

        let samplesProcessed = trackState.samplesProcessed;
        const dts = 0; // + trackState.cachedDuration ? ... but not really necessary in unfragmented mode

        switch (trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:
        case MP3_SOUND_CODEC_ID: {
          for (var j = 0; j < trackPackets.length; j++) {
            const audioPacket: AudioFrame = trackPackets[j].frame as AudioFrame;

            const s: StblSample = {
              size: audioPacket.data.length,
              dts: audioPacket.decodingTime,
              cts: audioPacket.compositionTime,
              isRap: true,
              sampleDescriptionIndex: audioPacket.sampleDescriptionIndex
            };

            samples.push(s);
            chunks[i].push(audioPacket.data);

            samplesProcessed += audioPacket.samples;
          }

          trackState.samplesProcessed = samplesProcessed;
          trackState.cachedDuration = dts;

          break;
        }
        case AVC_VIDEO_CODEC_ID:
        case VP6_VIDEO_CODEC_ID: {
          for (var j = 0; j < trackPackets.length; j++) {
            const videoPacket: VideoFrame = trackPackets[j].frame as VideoFrame;

            const s: StblSample = {
              size: videoPacket.data.length,
              dts: videoPacket.decodingTime,
              cts: videoPacket.compositionTime,
              isRap: videoPacket.frameFlag === VideoFrameFlag.KEY,
              sampleDescriptionIndex: videoPacket.sampleDescriptionIndex
            };

            samples.push(s);

            chunks[i].push(videoPacket.data);

            samplesProcessed++;
          }

          trackState.samplesProcessed = samplesProcessed;
          trackState.cachedDuration = dts;

          break;
        }

        default:
          throw new Error('Unknown codec');
        }

        if (!samples) {
          throw new Error('No sample list created when iterating on track-state');
        }

        sampleTablesData.push(samples);
      }

      const chunkData = flattenOneDeepNestedArray<Uint8Array>(chunks);

      return [new MediaDataBox(chunkData), sampleTablesData];
    }

    private _haveAllInitData (): boolean {
      return this._trackStates.every((trackState) => {
        switch (trackState.trackInfo.codecId) {
        case AVC_VIDEO_CODEC_ID:
          return trackState.initializationData.length > 0;
        default:
          return true;
        }
      });
    }

    private _makeMovHeader (fragmentedMode: boolean = true, samples: StblSample[][] = null, mdat?: MediaDataBox): Uint8Array {
      if (fragmentedMode && mdat) {
        throw new Error('Should not get mdat box in fragmented mode');
      }

      if (!this._haveAllInitData()) {
        return null;
      }

      const brands: string[] = ['isom'];
      const audioDataReferenceIndex = 1;
      const videoDataReferenceIndex = 1;
      const traks: TrackBox[] = [];
      const trexs: TrackExtendsBox[] = [];
      const traksData: {trakFlags: number, trackState: MP4TrackState, trackInfo: MP4Track, sampleDescEntry: SampleEntry[]}[] = [];

      for (let i = 0; i < this._trackStates.length; i++) {
        const trackState = this._trackStates[i];
        const trackInfo = trackState.trackInfo;
        const sampleDescEntry: SampleEntry[] = [];

        let sampleEntry;

        switch (trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:

          const samplingFrequencyIndex = AAC_SAMPLING_FREQUENCIES.indexOf(trackInfo.samplerate);
          if (samplingFrequencyIndex < 0) {
            throw new Error('Sample-rate not supported for AAC (mp4a): ' + trackInfo.samplerate);
          }

          const esdsData = new Uint8Array([
            0x00, // version
            0x00, 0x00, 0x00, // flags

            // ES_Descriptor
            0x03, // tag, ES_DescrTag
            0x19, // length
            0x00, 0x00, // ES_ID
            0x00, // streamDependenceFlag, URL_flag, reserved, streamPriority

            // DecoderConfigDescriptor
            0x04, // tag, DecoderConfigDescrTag
            0x11, // length
            0x40, // object type
            0x15, // streamType
            0x00, 0x06, 0x00, // bufferSizeDB
            0x00, 0x00, 0xda, 0xc0, // maxBitrate
            0x00, 0x00, 0xda, 0xc0, // avgBitrate

            // DecoderSpecificInfo
            0x05, // tag, DecoderSpecificInfoTag
            0x02, // length
            // ISO/IEC 14496-3, AudioSpecificConfig
            // for samplingFrequencyIndex see ISO/IEC 13818-7:2006, 8.1.3.2.2, Table 35
            (trackInfo.audioObjectType << 3) | (samplingFrequencyIndex >>> 1),
            (samplingFrequencyIndex << 7) | (trackInfo.channels << 3),
            0x06, 0x01, 0x02 // GASpecificConfig
          ]);

          sampleEntry = new AudioSampleEntry('mp4a', audioDataReferenceIndex,
            trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);

          sampleEntry.otherBoxes = [
            new RawTag('esds', esdsData)
          ];

          sampleDescEntry.push(sampleEntry);

          // mp4a.40.objectType

          // FIXME: we are overriding previous writes here with the last entry of init datas.
          //        the problem with that is that we are only making one call to oncodecinfo callback
          //        so this could be changed to making several calls or passing an array of strings instead
          //        and making mimeTypeCodec field an array then.
          trackState.mimeTypeCodec = 'mp4a.40.' + trackInfo.audioObjectType; // 'mp4a.40.2'

          break;

        case MP3_SOUND_CODEC_ID:

          sampleEntry = new AudioSampleEntry('.mp3', audioDataReferenceIndex,
            trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);

          sampleDescEntry.push(sampleEntry);

          trackState.mimeTypeCodec = 'mp3';
          break;

        case AVC_VIDEO_CODEC_ID:

          // For AVC, support multiple video codec data entries
          trackState.initializationData.forEach((codecInitData) => {
            const avcC = codecInitData; // FIXME: synthesize avcC here from SPS/PPS duple

            sampleEntry = new VideoSampleEntry('avc1',
              videoDataReferenceIndex,
              trackInfo.width,
              trackInfo.height
            );

            sampleEntry.otherBoxes = [
              new RawTag('avcC', avcC)
            ];

            sampleDescEntry.push(sampleEntry);

            // FIXME: we are overriding previous writes here with the last entry of init datas.
            //        the problem with that is that we are only making one call to oncodecinfo callback
            //        so this could be changed to making several calls or passing an array of strings instead
            //        and making mimeTypeCodec field an array then.
            const codecProfile = (avcC[1] << 16) | (avcC[2] << 8) | avcC[3];
            // avc1.XXYYZZ -- XX - profile + YY - constraints + ZZ - level
            trackState.mimeTypeCodec = 'avc1.' + (0x1000000 | codecProfile).toString(16).substr(1);
          });

          brands.push('iso2', 'avc1', 'mp41');
          break;

        case VP6_VIDEO_CODEC_ID:

          sampleEntry = new VideoSampleEntry('VP6F', videoDataReferenceIndex, trackInfo.width, trackInfo.height);
          sampleEntry.otherBoxes = [
            new RawTag('glbl', hexToBytes('00'))
          ];

          sampleDescEntry.push(sampleEntry);

          // TODO to lie about codec to get it playing in MSE?
          trackState.mimeTypeCodec = 'avc1.42001E';
          break;

        default:
          throw new Error('not supported track type');
        }

        const trakFlags = TrackHeaderFlags.TRACK_ENABLED | TrackHeaderFlags.TRACK_IN_MOVIE;

        if (!samples && !fragmentedMode) {
          throw new Error('Need sample-table content in unfragmented mode');
        }

        traksData.push({
          trakFlags, trackState, trackInfo, sampleDescEntry
        });

        const trex = new TrackExtendsBox(trackState.trackId, 1, 0, 0, SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);
        trexs.push(trex);
      }

      const mvex = fragmentedMode ? new MovieExtendsBox(null, trexs, null) : null;

      let udat = null;
      if (fragmentedMode) {
        udat = new BoxContainerBox('udat', [
          new MetaBox(
            new RawTag('hdlr', hexToBytes('00000000000000006D6469726170706C000000000000000000')), // notice weird stuff in reserved field
            [new RawTag('ilst', hexToBytes('00000025A9746F6F0000001D6461746100000001000000004C61766635342E36332E313034'))]
          )
        ]);
      }

      /**
       * We are using the smallest of all track durations to set the movie header duration field and timescale
       */
      const minDurationTrackInfo = this._trackStates
        .sort((a, b) => (a.trackInfo.duration / a.trackInfo.timescale) -
                      (b.trackInfo.duration / b.trackInfo.timescale))
        [0].trackInfo;

      const mvhd = new MovieHeaderBox(
        1, // HACK
        minDurationTrackInfo.duration / minDurationTrackInfo.timescale,
        this._trackStates.length + 1
      );

      // first we write the ftyp and eventually the wide & mdat boxes
      let fileSizeBytes = 0;
      const ftype = new FileTypeBox('isom', 0x00000200, brands);

      fileSizeBytes += ftype.layout(0);

      const wide: Box = fragmentedMode ? null : new RawTag('wide', hexToBytes(''));
      if (wide) {
        fileSizeBytes += wide.layout(fileSizeBytes);
      }
      // we store the offset after this, in case we are unfragmented and need to insert mdat now
      // -> we need this offset to write the sample table chunk offsets
      let mdatOffset = fileSizeBytes + 8;
      if (mdat) {
        fileSizeBytes += mdat.layout(fileSizeBytes);
      }

      // -> we can only package the sample-table once we know where the mdat will be
      traksData.forEach(({ trakFlags, trackInfo, trackState, sampleDescEntry }, i) => {
        debug('creating sample table with mdat offset:', mdatOffset);

        let sampleTable: SampleTableBox;

        if (fragmentedMode) {
          sampleTable = SampleTablePackager.createEmptyForFragmentedMode(sampleDescEntry);
        } else if (samples) {
          sampleTable = SampleTablePackager.createFromSamplesInSingleChunk(sampleDescEntry, samples[i], mdatOffset);
          // sum up all sample-sizes and add them up mdat offset now to shift the offset for the next track
          mdatOffset += samples[i].reduce((totalSize, sample) => {
            return totalSize + sample.size;
          }, 0);
        }

        let trak = null;
        if (trackState === this._audioTrackState) {
          trak = this._createTrackBox(trakFlags, trackState, trackInfo, 'soun', 'SoundHandler', sampleTable, i);
        } else if (trackState === this._videoTrackState) {
          trak = this._createTrackBox(trakFlags, trackState, trackInfo, 'vide', 'VideoHandler', sampleTable, i);
        }

        if (!trak) {
          throw new Error('There should be a new trak box created, but got null');
        }

        traks.push(trak);
      });

      // and now we can create the moov box
      const moov = new MovieBox(mvhd, traks, mvex, udat);
      fileSizeBytes += moov.layout(fileSizeBytes);

      // finally we can write the file data with the whole structure
      const fileData = new Uint8Array(fileSizeBytes);
      ftype.write(fileData);
      if (wide) {
        wide.write(fileData);
      }
      if (mdat) {
        mdat.write(fileData);
      }
      moov.write(fileData);
      return fileData;
    }

    private _generateMovieHeaderFragmentedMode () {
      if (!this._fragmentedMode) {
        throw new Error('_generateMovieHeaderFragmentedMode can only be called in fragmented mode');
      }

      if (!this._generateHeader || this._filePos > 0) return;

      const header = this._makeMovHeader(true);
      if (!header) {
        warn('Failed to generate mov header');
        return;
      }

      this._filePos += header.length;
      this._state = MP4MuxState.MAIN_PACKETS;

      this.oncodecinfo(this._trackStates.map((ts) => ts.mimeTypeCodec));
      this.ondata(header);
    }

    private _generateMovieFragment () {
      if (!this._fragmentedMode) {
        throw new Error('_generateMovieFragment can only be called in fragmented mode');
      }

      const cachedPackets = this._cachedFrames;
      if (cachedPackets.length === 0) {
        warn('_generateMovieFragment but no packets cached');
        return; // No data to produce.
      }

      const tdatParts: Uint8Array[] = [];
      let tdatPosition: number = 0;
      const trafs: TrackFragmentBox[] = [];
      const trafDataStarts: number[] = [];

      for (let i = 0; i < this._trackStates.length; i++) {
        const trackState = this._trackStates[i];
        const trackInfo = trackState.trackInfo;
        const trackId = trackState.trackId;

        // Finding all packets for this track.
        const trackPackets = cachedPackets.filter((cachedPacket) => cachedPacket.trackId === trackId);
        if (trackPackets.length === 0) {
          continue;
        }

        const tfdt = new TrackFragmentBaseMediaDecodeTimeBox(trackState.cachedDuration);
        const trunSamples: TrackRunSample[] = [];

        let trun: TrackRunBox;
        let tfhd: TrackFragmentHeaderBox;

        trafDataStarts.push(tdatPosition);

        switch (trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:
        case MP3_SOUND_CODEC_ID: {
          for (let j = 0; j < trackPackets.length; j++) {
            const audioPacket: AudioFrame = trackPackets[j].frame as AudioFrame;
            const audioFrameDuration = Math.round(trackInfo.timescale * audioPacket.samples / trackInfo.samplerate);

            tdatParts.push(audioPacket.data);
            tdatPosition += audioPacket.data.length;

            trunSamples.push({
              duration: audioFrameDuration,
              size: audioPacket.data.length
            });

            trackState.samplesProcessed += audioPacket.samples;
            trackState.cachedDuration += audioFrameDuration;
          }

          const tfhdFlags = TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;

          tfhd = new TrackFragmentHeaderBox(tfhdFlags, trackId,
            0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */,
            SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);

          const trunFlags = TrackRunFlags.DATA_OFFSET_PRESENT |
                            TrackRunFlags.SAMPLE_DURATION_PRESENT | TrackRunFlags.SAMPLE_SIZE_PRESENT;

          trun = new TrackRunBox(trunFlags, trunSamples, 0 /* data offset */, 0 /* first flags */);

          break;
        }

        case AVC_VIDEO_CODEC_ID:
        case VP6_VIDEO_CODEC_ID: {
          let videoFrameDuration: number;
          let ieFps: number;
          const { timescale } = trackInfo;
          if (trackPackets.length === 1) {
            videoFrameDuration = Math.round(timescale / trackInfo.framerate);
            ieFps = timescale / videoFrameDuration;
            debug('Video frame duration computed from metadata FPS:', videoFrameDuration, 'effective FPS:', ieFps);
          } else {
            videoFrameDuration = trackPackets[1].timestamp - trackPackets[0].timestamp;
            ieFps = timescale / videoFrameDuration;
            debug('Video frame duration computed from timestamp-diff:', videoFrameDuration, 'effective FPS:', ieFps);
          }

          if (!Number.isFinite(videoFrameDuration)) {
            throw new Error('Invalid effective FPS value computed: ' + 1 / videoFrameDuration);
          }

          for (let j = 0; j < trackPackets.length; j++) {
            const videoPacket: VideoFrame = trackPackets[j].frame as VideoFrame;

            const decodingTime = videoPacket.decodingTime;
            const compositionTime = videoPacket.compositionTime;
            const compositionTimeOffset = compositionTime - decodingTime;

            tdatParts.push(videoPacket.data);
            tdatPosition += videoPacket.data.length;

            const frameFlags = (videoPacket.frameFlag === VideoFrameFlag.KEY)
              ? SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS
              : (SampleFlags.SAMPLE_DEPENDS_ON_OTHER | SampleFlags.SAMPLE_IS_NOT_SYNC);

            debug('Frame flags at DTS/PTS:',
              videoPacket.frameFlag,
              videoPacket.decodingTime,
              videoPacket.compositionTime
            );

            const trunSample: TrackRunSample = {
              duration: videoFrameDuration,
              compositionTimeOffset,
              size: videoPacket.data.length,
              flags: frameFlags
            };

            trunSamples.push(trunSample);

            trackState.samplesProcessed++;
            trackState.cachedDuration = videoFrameDuration;
          }

          const tfhdFlags = TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;

          tfhd = new TrackFragmentHeaderBox(tfhdFlags, trackId,
            0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */,
            SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);

          const trunFlags = TrackRunFlags.DATA_OFFSET_PRESENT | TrackRunFlags.FIRST_SAMPLE_FLAGS_PRESENT |
                            TrackRunFlags.SAMPLE_DURATION_PRESENT | TrackRunFlags.SAMPLE_SIZE_PRESENT |
                            TrackRunFlags.SAMPLE_FLAGS_PRESENT | TrackRunFlags.SAMPLE_COMPOSITION_TIME_OFFSET;

          trun = new TrackRunBox(trunFlags, trunSamples, 0 /* data offset */, SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);

          break;
        }

        default:
          throw new Error('Unknown codec');
        }

        const traf = new TrackFragmentBox(tfhd, tfdt, trun);
        trafs.push(traf);
      }

      this._cachedFrames.splice(0, cachedPackets.length);

      const moofHeader = new MovieFragmentHeaderBox(++this._fragmentCount);
      const moof = new MovieFragmentBox(moofHeader, trafs);
      const moofSize = moof.layout(0);
      const mdat = new MediaDataBox(tdatParts);
      const mdatSize = mdat.layout(moofSize);

      const tdatOffset = moofSize + 8;
      for (let i = 0; i < trafs.length; i++) {
        trafs[i].run.dataOffset = tdatOffset + trafDataStarts[i];
      }

      const chunk = new Uint8Array(moofSize + mdatSize);
      moof.write(chunk);
      mdat.write(chunk);

      this.ondata(chunk);

      this._filePos += chunk.length;
    }
}
