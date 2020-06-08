/**
 * Copyright 2015 Mozilla Foundation
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

import { hexToBytes, flattenOneDeepNestedArray } from '../../common-utils';
import { getLogger, LoggerLevel } from '../../logger';
import { BoxContainerBox, Box, RawTag } from './mp4iso-base';
import { SampleTablePackager } from './mp4iso-sample-table';

const { warn, debug } = getLogger('MP4Mux(moz)', LoggerLevel.ON, true);

let MAX_PACKETS_IN_CHUNK = Infinity;
let SPLIT_AT_KEYFRAMES = false;

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

export const SOUNDRATES = [5500, 11025, 22050, 44100];

export const SOUNDFORMATS = [
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

type CachedPacket = {
  packet: any;
  timestamp: number;
  trackId: number;
}

export enum AudioPacketType {
    HEADER = 0,
    RAW = 1,
  }

export type AudioPacket = {
  decodingTime: number,
  compositionTime: number,
  codecDescription: string;
  codecId: number;
  data: Uint8Array;
  rate: number;
  size: number;
  channels: number;
  samples: number;
  packetType: AudioPacketType;
  sampleDescriptionIndex: number;
}

export type VideoPacket = {
  frameType: VideoFrameType;
  codecId: number;
  codecDescription: string;
  data: Uint8Array;
  packetType: VideoPacketType;
  decodingTime: number,
  compositionTime: number;
  horizontalOffset?: number;
  verticalOffset?: number;
  sampleDescriptionIndex: number;
}

export const VIDEOCODECS = [null, 'JPEG', 'Sorenson', 'Screen', 'VP6', 'VP6 alpha', 'Screen2', 'AVC'];
export const VP6_VIDEO_CODEC_ID = 4;
export const AVC_VIDEO_CODEC_ID = 7;

export enum VideoFrameType {
    KEY = 1,
    INNER = 2,
    DISPOSABLE = 3,
    GENERATED = 4,
    INFO = 5,
  }

export enum VideoPacketType {
    HEADER = 0,
    NALU = 1,
    END = 2,
  }

export enum MP4MuxPacketType {
  AUDIO_PACKET = 8,
  VIDEO_PACKET = 9 // legacy support numbers, not sure if can be replaced
}

export type MP4Track = {
    codecDescription?: string;
    codecId: number;
    language: string;

    timescale: number;
    duration: number, // -1 for unknown

    samplerate?: number;
    channels?: number;
    samplesize?: number;
    audioObjectType?: number;

    framerate?: number;
    width?: number;
    height?: number;
  }

export type MP4Metadata = {
    tracks: MP4Track[];
    duration: number;
    audioTrackId: number;
    videoTrackId: number;
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

export class MP4Mux {
    // FIXME: should be initialized
    private metadata: MP4Metadata;
    private trackStates: MP4TrackState[];
    private audioTrackState: MP4TrackState;
    private videoTrackState: MP4TrackState;

    private filePos: number = 0;
    private cachedPackets: CachedPacket[] = [];

    private state: MP4MuxState = null; // FIXME

    private chunkIndex: number = 0;

    private fragmentedMode: boolean = true;

    oncodecinfo: (codecs: string[]) => void = function (codecs: string[]) {
      throw new Error('MP4Mux.oncodecinfo is not set');
    };

    ondata: (data) => void = function (data) {
      throw new Error('MP4Mux.ondata is not set');
    };

    public constructor (metadata: MP4Metadata, fragmentedMode: boolean) {
      this.metadata = metadata;
      this.fragmentedMode = fragmentedMode;

      this.trackStates = this.metadata.tracks.map((t: MP4Track, index) => {
        const state = {
          trackId: index + 1,
          trackInfo: t,
          cachedDuration: 0,
          samplesProcessed: 0,
          initializationData: []
        };
        if (this.metadata.audioTrackId === state.trackId) {
          this.audioTrackState = state;
        }
        if (this.metadata.videoTrackId === state.trackId) {
          this.videoTrackState = state;
        }
        return state;
      }, this);

      this._checkIfNeedHeaderData();
    }

    public pushPacket (
      type: MP4MuxPacketType,
      codecId: number,
      data: Uint8Array,
      timestamp: number,
      forceRaw: boolean = false,
      isInitData: boolean = false,
      isKeyframe: boolean = false,
      cto: number = 0,
      audioDetails: {sampleRate: number, sampleDepth: number, samplesPerFrame: number, numChannels: number} = null
    ) {

      if (this.state === MP4MuxState.CAN_GENERATE_HEADER) {
        this._attemptToGenerateMovieHeader();
      }

      switch (type) {
      case MP4MuxPacketType.AUDIO_PACKET: // audio
        const audioTrack = this.audioTrackState;
        let audioPacket: AudioPacket;

        if (forceRaw) {
          if (!audioDetails) {
            throw new Error('We need audio-details in raw sample push mode');
          }

          const { sampleRate, sampleDepth, samplesPerFrame, numChannels } = audioDetails;

          audioPacket = {
            data,
            decodingTime: timestamp,
            compositionTime: timestamp + cto,
            codecId,
            codecDescription: SOUNDFORMATS[codecId],
            rate: sampleRate,
            size: sampleDepth,
            channels: numChannels,
            samples: samplesPerFrame,
            packetType: isInitData ? AudioPacketType.HEADER : AudioPacketType.RAW,
            sampleDescriptionIndex: 1 // FIXME: hard-coding to 1 breaks previous support
                                      // for AAC codec config in-stream discontinuities (used rather in MOV mode)
                                      // -> should use audioDetails as sortof high-level init-data here
          };

        } else {
          throw new Error('Non raw-mode not supported');
        }

        if (!audioTrack || audioTrack.trackInfo.codecId !== audioPacket.codecId) {
          throw new Error('Unexpected audio packet codec: ' + audioPacket.codecDescription);
        }

        switch (audioPacket.codecId) {
        default:
          throw new Error('Unsupported audio codec: ' + audioPacket.codecDescription);
        case MP3_SOUND_CODEC_ID:
          break; // supported codec
        case AAC_SOUND_CODEC_ID:
          break;
        }

        this.cachedPackets.push({ packet: audioPacket, timestamp, trackId: audioTrack.trackId });

        break;
      case MP4MuxPacketType.VIDEO_PACKET:
        var videoTrack = this.videoTrackState;
        var videoPacket: VideoPacket;
        if (forceRaw) {
          videoPacket = {
            frameType: isKeyframe ? VideoFrameType.KEY : VideoFrameType.INNER,
            codecId: AVC_VIDEO_CODEC_ID,
            codecDescription: VIDEOCODECS[AVC_VIDEO_CODEC_ID],
            data,
            packetType: isInitData ? VideoPacketType.HEADER : VideoPacketType.NALU,
            decodingTime: timestamp,
            compositionTime: timestamp + cto,
            sampleDescriptionIndex: videoTrack.initializationData.length
          };
        } else {
          throw new Error('Non raw-mode not supported');
        }
        if (!videoTrack || videoTrack.trackInfo.codecId !== videoPacket.codecId) {
          throw new Error('Unexpected video packet codec: ' + videoPacket.codecDescription);
        }
        switch (videoPacket.codecId) {
        default:
          throw new Error('unsupported video codec: ' + videoPacket.codecDescription);
        case VP6_VIDEO_CODEC_ID:
          break; // supported
        case AVC_VIDEO_CODEC_ID:
          if (videoPacket.packetType === VideoPacketType.HEADER) {
            videoTrack.initializationData.push(videoPacket.data);
            return;
          }
          break;
        }
        this.cachedPackets.push({ packet: videoPacket, timestamp, trackId: videoTrack.trackId });
        break;
      default:
        throw new Error('unknown packet type: ' + type);
      }

      if (this.state === MP4MuxState.NEED_HEADER_DATA) {
        this._attemptToGenerateMovieHeader();
      }

      if (this.fragmentedMode &&
        this.cachedPackets.length >= MAX_PACKETS_IN_CHUNK &&
          this.state === MP4MuxState.MAIN_PACKETS) {
        this._generateMovieFragment();
      }
    }

    public flush () {
      if (this.cachedPackets.length > 0) {
        if (this.fragmentedMode) {
          this._generateMovieFragment();
        } else {
          this._generatePlainMovFile();
        }
      }
    }

    private _checkIfNeedHeaderData () {
      if (this.trackStates.some((ts) =>
        ts.trackInfo.codecId === AAC_SOUND_CODEC_ID
        || ts.trackInfo.codecId === AVC_VIDEO_CODEC_ID)) {
        this.state = MP4MuxState.NEED_HEADER_DATA;
      } else {
        this.state = MP4MuxState.CAN_GENERATE_HEADER;
      }
    }

    private _generatePlainMovFile () {
      const [mdat, sampleTablesData] = this._createPlainMovMediaData();

      const header = this._makeMovHeader(false, sampleTablesData, mdat);
      if (!header) {
        throw new Error('Failed to generate moov header data for plain MOV file')
      }

      this.oncodecinfo(this.trackStates.map((ts) => ts.mimeTypeCodec));
      this.ondata(header);
    }

    // TODO: make static (is stateless)
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
      const cachedPackets = this.cachedPackets;
      const sampleTablesData: StblSample[][] = [];
      const chunks: Uint8Array[][] = [];

      let samples: StblSample[] = null;

      for (let i = 0; i < this.trackStates.length; i++) {
        const trackState = this.trackStates[i];
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
        let dts = 0; // + trackState.cachedDuration ? ... but not really necessary in unfragmented mode

        switch (trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:
        case MP3_SOUND_CODEC_ID: {
          for (var j = 0; j < trackPackets.length; j++) {

            const audioPacket: AudioPacket = trackPackets[j].packet;

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

            const videoPacket: VideoPacket = trackPackets[j].packet;

            const s: StblSample = {
              size: videoPacket.data.length,
              dts: videoPacket.decodingTime,
              cts: videoPacket.compositionTime,
              isRap: videoPacket.frameType === VideoFrameType.KEY,
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

    private _makeMovHeader (fragmentedMode: boolean = true, samples: StblSample[][] = null, mdat?: MediaDataBox): Uint8Array {
      if (fragmentedMode && mdat) {
        throw new Error('Should not get mdat box in fragmented mode');
      }

      const allInitializationDataExists = this.trackStates.every((ts) => {
        switch (ts.trackInfo.codecId) {
        case AVC_VIDEO_CODEC_ID:
          return ts.initializationData.length > 0;
        default:
          return true;
        }
      });

      if (!allInitializationDataExists) {
        warn('missing necessary codec initialization data to create moov atom (needed for all tracks)');
        return null; // not enough data, waiting more
      }

      const brands: string[] = ['isom'];
      const audioDataReferenceIndex = 1;
      const videoDataReferenceIndex = 1;
      const traks: TrackBox[] = [];
      const trexs: TrackExtendsBox[] = [];
      const traksData: {trakFlags: number, trackState: MP4TrackState, trackInfo: MP4Track, sampleDescEntry: SampleEntry[]}[] = [];

      for (let i = 0; i < this.trackStates.length; i++) {
        let trackState = this.trackStates[i];
        let trackInfo = trackState.trackInfo;
        let sampleDescEntry: SampleEntry[] = [];

        let sampleEntry;

        switch (trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:

          sampleEntry = new AudioSampleEntry('mp4a', audioDataReferenceIndex,
            trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);

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
            0x15,  // streamType
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
          ])

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

          sampleEntry = new AudioSampleEntry('.mp3', audioDataReferenceIndex, trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);

          sampleDescEntry.push(sampleEntry);

          trackState.mimeTypeCodec = 'mp3';
          break;

        case AVC_VIDEO_CODEC_ID:

          // For AVC, support multiple video codec data entries
          trackState.initializationData.forEach((codecInitData) => {
            let avcC = codecInitData;

            sampleEntry = new VideoSampleEntry('avc1', videoDataReferenceIndex, trackInfo.width, trackInfo.height);
            sampleEntry.otherBoxes = [
              new RawTag('avcC', avcC)
            ];

            sampleDescEntry.push(sampleEntry);

            // FIXME: we are overriding previous writes here with the last entry of init datas.
            //        the problem with that is that we are only making one call to oncodecinfo callback
            //        so this could be changed to making several calls or passing an array of strings instead
            //        and making mimeTypeCodec field an array then.
            let codecProfile = (avcC[1] << 16) | (avcC[2] << 8) | avcC[3];
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

        let trakFlags = TrackHeaderFlags.TRACK_ENABLED | TrackHeaderFlags.TRACK_IN_MOVIE;

        if (!samples && !fragmentedMode) {
          throw new Error('Need sample-table content in unfragmented mode');
        }

        traksData.push({
          trakFlags, trackState, trackInfo, sampleDescEntry
        });

        let trex = new TrackExtendsBox(trackState.trackId, 1, 0, 0, SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);
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
      const minDurationTrackInfo = this.trackStates
        .sort((a, b) => (a.trackInfo.duration / a.trackInfo.timescale) -
                      (b.trackInfo.duration / b.trackInfo.timescale))
        [0].trackInfo;

      const mvhd = new MovieHeaderBox(
        1, // HACK
        minDurationTrackInfo.duration / minDurationTrackInfo.timescale,
        this.trackStates.length + 1
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
        if (trackState === this.audioTrackState) {
          trak = this._createTrackBox(trakFlags, trackState, trackInfo, 'soun', 'SoundHandler', sampleTable, i);
        } else if (trackState === this.videoTrackState) {
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

    private _attemptToGenerateMovieHeader () {
      if (!this.fragmentedMode) {
        return;
      }

      const header = this._makeMovHeader(true);
      if (!header) {
        //throw new Error('Failed to generate moov header data')
        return;
      }

      this.oncodecinfo(this.trackStates.map((ts) => ts.mimeTypeCodec));
      this.ondata(header);

      this.filePos += header.length;
      this.state = MP4MuxState.MAIN_PACKETS;
    }

    private _generateMovieFragment () {
      if (!this.fragmentedMode) {
        return;
      }

      let cachedPackets = this.cachedPackets;

      if (SPLIT_AT_KEYFRAMES && this.videoTrackState) {
        let j = cachedPackets.length - 1;

        let videoTrackId = this.videoTrackState.trackId;
        // Finding last video keyframe.
        while (j > 0 &&
               (cachedPackets[j].trackId !== videoTrackId || cachedPackets[j].packet.frameType !== VideoFrameType.KEY)) {
          j--;
        }
        if (j > 0) {
          // We have keyframes and not only the first frame is a keyframe...
          cachedPackets = cachedPackets.slice(0, j);
        }
      }
      if (cachedPackets.length === 0) {
        return; // No data to produce.
      }

      let tdatParts: Uint8Array[] = [];
      let tdatPosition: number = 0;
      let trafs: TrackFragmentBox[] = [];
      let trafDataStarts: number[] = [];

      for (let i = 0; i < this.trackStates.length; i++) {
        let trackState = this.trackStates[i];
        let trackInfo = trackState.trackInfo;
        var trackId = trackState.trackId;

        // Finding all packets for this track.
        let trackPackets = cachedPackets.filter((cp) => cp.trackId === trackId);
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

            const audioPacket: AudioPacket = trackPackets[j].packet;
            const audioFrameDuration = Math.round(trackInfo.timescale * audioPacket.samples / trackInfo.samplerate);

            tdatParts.push(audioPacket.data);
            tdatPosition += audioPacket.data.length;

            trunSamples.push({ duration: audioFrameDuration, size: audioPacket.data.length });

            trackState.samplesProcessed += audioPacket.samples;
            trackState.cachedDuration += audioFrameDuration;
          }

          const tfhdFlags = TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;
          tfhd = new TrackFragmentHeaderBox(tfhdFlags, trackId, 0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */,
            SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);

          const trunFlags = TrackRunFlags.DATA_OFFSET_PRESENT |
                            TrackRunFlags.SAMPLE_DURATION_PRESENT | TrackRunFlags.SAMPLE_SIZE_PRESENT;
          trun = new TrackRunBox(trunFlags, trunSamples, 0 /* data offset */, 0 /* first flags */);

          break;
        }

        case AVC_VIDEO_CODEC_ID:
        case VP6_VIDEO_CODEC_ID: {

          for (let j = 0; j < trackPackets.length; j++) {

            const videoPacket: VideoPacket = trackPackets[j].packet;
            const videoFrameDuration = Math.round(trackInfo.timescale / trackInfo.samplerate);

            const compositionTime = videoPacket.compositionTime;
            const compositionTimeOffset = compositionTime - videoPacket.decodingTime;

            tdatParts.push(videoPacket.data);
            tdatPosition += videoPacket.data.length;

            const frameFlags = videoPacket.frameType === VideoFrameType.KEY
              ? SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS
              : (SampleFlags.SAMPLE_DEPENDS_ON_OTHER | SampleFlags.SAMPLE_IS_NOT_SYNC);

            trunSamples.push({ duration: videoFrameDuration,
              size: videoPacket.data.length,
              flags: frameFlags,
              compositionTimeOffset });

              trackState.samplesProcessed++;
              trackState.cachedDuration = videoPacket.decodingTime;
          }

          const tfhdFlags = TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;

          tfhd = new TrackFragmentHeaderBox(tfhdFlags, trackId, 0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */,
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

        let traf = new TrackFragmentBox(tfhd, tfdt, trun);
        trafs.push(traf);
      }

      this.cachedPackets.splice(0, cachedPackets.length);

      let moofHeader = new MovieFragmentHeaderBox(++this.chunkIndex);
      let moof = new MovieFragmentBox(moofHeader, trafs);
      let moofSize = moof.layout(0);
      let mdat = new MediaDataBox(tdatParts);
      let mdatSize = mdat.layout(moofSize);

      let tdatOffset = moofSize + 8;
      for (let i = 0; i < trafs.length; i++) {
        trafs[i].run.dataOffset = tdatOffset + trafDataStarts[i];
      }

      const chunk = new Uint8Array(moofSize + mdatSize);
      moof.write(chunk);
      mdat.write(chunk);

      this.ondata(chunk);
      this.filePos += chunk.length;
    }
}
