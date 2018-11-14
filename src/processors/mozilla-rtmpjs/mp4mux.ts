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
  RawTag,
  VideoSampleEntry,
  VideoMediaHeaderBox,
  TrackHeaderFlags,
  TrackHeaderBox,
  MediaBox,
  MediaHeaderBox,
  MediaInformationBox,
  HandlerBox,
  SoundMediaHeaderBox,
  DataInformationBox,
  DataEntryUrlBox,
  DataReferenceBox,
  SampleTableBox,
  MovieExtendsBox,
  MovieFragmentBox,
  TrackExtendsBox,
  TrackRunBox,
  BoxContainerBox,
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
  SELF_CONTAINED_DATA_REFERENCE_FLAG
} from './mp4iso';

import { hexToBytes } from '../../common-utils';
import { getLogger } from '../../logger';

const {warn} = getLogger('MP4Mux(moz)');

// module RtmpJs.MP4 {


export const SOUNDRATES = [5500, 11025, 22050, 44100];
export const SOUNDFORMATS = ['PCM', 'ADPCM', 'MP3', 'PCM le', 'Nellymouser16', 'Nellymouser8', 'Nellymouser', 'G.711 A-law', 'G.711 mu-law', null, 'AAC', 'Speex', 'MP3 8khz'];
export const MP3_SOUND_CODEC_ID = 2;
export const AAC_SOUND_CODEC_ID = 10;

export enum AudioPacketType {
    HEADER = 0,
    RAW = 1,
  }

export type AudioPacket = {
  codecDescription: string;
  codecId: number;
  data: Uint8Array;
  rate: number;
  size: number;
  channels: number;
  samples: number;
  packetType: AudioPacketType;
}

export type VideoPacket = {
  frameType: VideoFrameType;
  codecId: number;
  codecDescription: string;
  data: Uint8Array;
  packetType: VideoPacketType;
  compositionTime: number;
  horizontalOffset?: number;
  verticalOffset?: number;
}

export function parseAudiodata (data: Uint8Array): AudioPacket {
  let i = 0;
  let packetType = AudioPacketType.RAW;
  let flags = data[i];
  let codecId = flags >> 4;
  let soundRateId = (flags >> 2) & 3;
  let sampleSize = flags & 2 ? 16 : 8;
  let channels = flags & 1 ? 2 : 1;
  let samples: number;
  i++;
  switch (codecId) {
  case AAC_SOUND_CODEC_ID:
    var type = data[i++];
    packetType = <AudioPacketType>type;
    samples = 1024; // AAC implementations typically represent 1024 PCM audio samples
    break;
  case MP3_SOUND_CODEC_ID:
    var version = (data[i + 1] >> 3) & 3; // 3 - MPEG 1
    var layer = (data[i + 1] >> 1) & 3; // 3 - Layer I, 2 - II, 1 - III
    samples = layer === 1 ? (version === 3 ? 1152 : 576)
      : (layer === 3 ? 384 : 1152);
    break;
  }
  return {
    codecDescription: SOUNDFORMATS[codecId],
    codecId: codecId,
    data: data.subarray(i),
    rate: SOUNDRATES[soundRateId],
    size: sampleSize,
    channels: channels,
    samples: samples,
    packetType: packetType
  };
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

export function parseVideodata (data: Uint8Array): VideoPacket {
  let i = 0;
  let frameType = data[i] >> 4;
  let codecId = data[i] & 15;
  i++;
  let result: any = {
    frameType: <VideoFrameType>frameType,
    codecId: codecId,
    codecDescription: VIDEOCODECS[codecId]
  };
  switch (codecId) {
  case AVC_VIDEO_CODEC_ID:
    var type = data[i++];
    result.packetType = <VideoPacketType>type;
    result.compositionTime = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8)) >> 8;
    i += 3;
    break;
  case VP6_VIDEO_CODEC_ID:
    result.packetType = VideoPacketType.NALU;
    result.horizontalOffset = (data[i] >> 4) & 15;
    result.verticalOffset = data[i] & 15;
    result.compositionTime = 0;
    i++;
    break;
  }
  result.data = data.subarray(i);
  return result;
}

export enum MP4MuxPacketType {
  AUDIO_PACKET = 8,
  VIDEO_PACKET = 9 // legacy support numbers, not sure if can be replaced
};

let MAX_PACKETS_IN_CHUNK = Infinity;
let SPLIT_AT_KEYFRAMES = true;

type CachedPacket = {
  packet: any;
  timestamp: number;
  trackId: number;
}

export interface MP4Track {
    codecDescription?: string;
    codecId: number;
    language: string;

    timescale: number;
    duration: number, // -1 for unknown

    samplerate?: number;
    channels?: number;
    samplesize?: number;

    framerate?: number;
    width?: number;
    height?: number;
  }

export interface MP4Metadata {
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

export interface MP4TrackState {
    trackId: number;
    trackInfo: MP4Track;
    cachedDuration: number;
    samplesProcessed: number;
    initializationData: Uint8Array[];
    mimeTypeCodec?: string;
  }

export class MP4Mux {
    private metadata: MP4Metadata;

    private filePos: number;
    private cachedPackets: CachedPacket[];
    private trackStates: MP4TrackState[];
    private audioTrackState: MP4TrackState;
    private videoTrackState: MP4TrackState;
    private state: MP4MuxState;
    private chunkIndex: number;

    oncodecinfo: (codecs: string[]) => void = function (codecs: string[]) {
      throw new Error('MP4Mux.oncodecdata is not set');
    };

    ondata: (data) => void = function (data) {
      throw new Error('MP4Mux.ondata is not set');
    };

    public constructor (metadata: MP4Metadata) {
      this.metadata = metadata;

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

      this.filePos = 0;
      this.cachedPackets = [];
      this.chunkIndex = 0;
    }

    public pushPacket (
      type: MP4MuxPacketType,
      codecId: number,
      data: Uint8Array,
      timestamp: number,
      forceRaw: boolean = false,
      isInitData: boolean = false,
      isKeyframe: boolean = false,
      cto: number = 0
    ) {

      if (this.state === MP4MuxState.CAN_GENERATE_HEADER) {
        this._attemptGenerateHeader();
      }

      switch (type) {
      case MP4MuxPacketType.AUDIO_PACKET: // audio
        const audioTrack = this.audioTrackState;
        let audioPacket: AudioPacket;

        if (forceRaw) {
          audioPacket = {
            data,
            codecId,
            codecDescription: SOUNDFORMATS[codecId],
            rate: SOUNDRATES[3], // FIXME: hardcoded 44100khz
            size: 16, // FIXME: hardcoded 16 bit sampledepth
            channels: 2, // FIXME: hardcoded stereo
            samples: 1152,
            packetType: isInitData ? AudioPacketType.HEADER : AudioPacketType.RAW,
          };
        } else {
          audioPacket = parseAudiodata(data);
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
          if (audioPacket.packetType === AudioPacketType.HEADER) {
            audioTrack.initializationData.push(audioPacket.data);
            return;
          }
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
            data: data,
            packetType: isInitData ? VideoPacketType.HEADER : VideoPacketType.NALU,
            compositionTime: timestamp + cto
          };
        } else {
          videoPacket = parseVideodata(data);
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
        this._attemptGenerateHeader();
      }
      if (this.cachedPackets.length >= MAX_PACKETS_IN_CHUNK &&
          this.state === MP4MuxState.MAIN_PACKETS) {
        this._generateChunk();
      }
    }

    public flush () {
      if (this.cachedPackets.length > 0) {
        this._generateChunk();
      }
    }

    private _checkIfNeedHeaderData () {
      if (this.trackStates.some((ts) =>
        ts.trackInfo.codecId === AAC_SOUND_CODEC_ID || ts.trackInfo.codecId === AVC_VIDEO_CODEC_ID)) {
        this.state = MP4MuxState.NEED_HEADER_DATA;
      } else {
        this.state = MP4MuxState.CAN_GENERATE_HEADER;
      }
    }

    private _generatePlainMovFile () {

    }

    private _attemptGenerateHeader () {
      const allInitializationDataExists = this.trackStates.every((ts) => {
        switch (ts.trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:
        case AVC_VIDEO_CODEC_ID:
          return ts.initializationData.length > 0;
        default:
          return true;
        }
      });

      if (!allInitializationDataExists) {
        //warn('missing some initialization data to create moov atom');
        return; // not enough data, waiting more
      }

      let brands: string[] = ['isom'];
      let audioDataReferenceIndex = 1; let videoDataReferenceIndex = 1;
      let traks: TrackBox[] = [];
      const trexs: TrackExtendsBox[] = [];

      for (let i = 0; i < this.trackStates.length; i++) {
        let trackState = this.trackStates[i];
        let trackInfo = trackState.trackInfo;
        var sampleEntry: SampleEntry;
        switch (trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:
          var audioSpecificConfig = trackState.initializationData[0];
          sampleEntry = new AudioSampleEntry('mp4a', audioDataReferenceIndex, trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);

          var esdsData = audioSpecificConfig;

          // FIXME: instead of taking the data inside the ES_Descriptor we are using the data of the esds atom directly
          /*
          var esdsData = new Uint8Array(41 + audioSpecificConfig.length);
          esdsData.set(hexToBytes('0000000003808080'), 0);
          esdsData[8] = 32 + audioSpecificConfig.length;
          esdsData.set(hexToBytes('00020004808080'), 9);
          esdsData[16] = 18 + audioSpecificConfig.length;
          esdsData.set(hexToBytes('40150000000000FA000000000005808080'), 17);
          esdsData[34] = audioSpecificConfig.length;
          esdsData.set(audioSpecificConfig, 35);
          esdsData.set(hexToBytes('068080800102'), 35 + audioSpecificConfig.length);
          */

          (<AudioSampleEntry>sampleEntry).otherBoxes = [
            new RawTag('esds', esdsData)
          ];

          var objectType = (audioSpecificConfig[0] >> 3); // TODO 31
          // mp4a.40.objectType
          trackState.mimeTypeCodec = 'mp4a.40.' + objectType; // 'mp4a.40.2'
          break;
        case MP3_SOUND_CODEC_ID:
          sampleEntry = new AudioSampleEntry('.mp3', audioDataReferenceIndex, trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);
          trackState.mimeTypeCodec = 'mp3';
          break;
        case AVC_VIDEO_CODEC_ID:
          var avcC = trackState.initializationData[0];
          sampleEntry = new VideoSampleEntry('avc1', videoDataReferenceIndex, trackInfo.width, trackInfo.height);
          (<VideoSampleEntry>sampleEntry).otherBoxes = [
            new RawTag('avcC', avcC)
          ];
          var codecProfile = (avcC[1] << 16) | (avcC[2] << 8) | avcC[3];
          // avc1.XXYYZZ -- XX - profile + YY - constraints + ZZ - level
          trackState.mimeTypeCodec = 'avc1.' + (0x1000000 | codecProfile).toString(16).substr(1);
          brands.push('iso2', 'avc1', 'mp41');
          break;
        case VP6_VIDEO_CODEC_ID:
          sampleEntry = new VideoSampleEntry('VP6F', videoDataReferenceIndex, trackInfo.width, trackInfo.height);
          (<VideoSampleEntry>sampleEntry).otherBoxes = [
            new RawTag('glbl', hexToBytes('00'))
          ];
          // TODO to lie about codec to get it playing in MSE?
          trackState.mimeTypeCodec = 'avc1.42001E';
          break;
        default:
          throw new Error('not supported track type');
        }

        let trak;
        let trex;

        let trakFlags = TrackHeaderFlags.TRACK_ENABLED | TrackHeaderFlags.TRACK_IN_MOVIE;
        if (trackState === this.audioTrackState) {
          trak = new TrackBox(
            new TrackHeaderBox(trakFlags, trackState.trackId, trackInfo.duration / trackInfo.timescale, 0 /* width */, 0 /* height */, 1.0, i),
            new MediaBox(
              new MediaHeaderBox(trackInfo.timescale, trackInfo.duration, trackInfo.language),
              new HandlerBox('soun', 'SoundHandler'),
              new MediaInformationBox(
                new SoundMediaHeaderBox(),
                new DataInformationBox(
                  new DataReferenceBox([new DataEntryUrlBox(SELF_CONTAINED_DATA_REFERENCE_FLAG)])),
                  SampleTableBox.createEmptyForFragmentedMode([sampleEntry])
              )
            )
          );

        } else if (trackState === this.videoTrackState) {

          trak = new TrackBox(
            new TrackHeaderBox(trakFlags, trackState.trackId, trackInfo.duration / trackInfo.timescale, trackInfo.width, trackInfo.height, 0 /* volume */, i),
            new MediaBox(
              new MediaHeaderBox(trackInfo.timescale, trackInfo.duration, trackInfo.language),
              new HandlerBox('vide', 'VideoHandler'),
              new MediaInformationBox(
                new VideoMediaHeaderBox(),
                new DataInformationBox(
                  new DataReferenceBox([new DataEntryUrlBox(SELF_CONTAINED_DATA_REFERENCE_FLAG)])),
                  SampleTableBox.createEmptyForFragmentedMode([sampleEntry])
              )
            )
          );
        }

        trex = new TrackExtendsBox(trackState.trackId, 0, 0, 0, SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);

        traks.push(trak);
        trexs.push(trex);
      }

      let mvex = new MovieExtendsBox(null, trexs, null);

      let udat = new BoxContainerBox('udat', [
        new MetaBox(
          new RawTag('hdlr', hexToBytes('00000000000000006D6469726170706C000000000000000000')), // notice weird stuff in reserved field
          [new RawTag('ilst', hexToBytes('00000025A9746F6F0000001D6461746100000001000000004C61766635342E36332E313034'))]
        )
      ]);

      /**
       * We are using the smallest of all track durations to set the movie header duration field and timescale
       */
      const minDurationTrackInfo = this.trackStates
        .sort((a, b) => (a.trackInfo.duration / a.trackInfo.timescale) -
                      (b.trackInfo.duration / b.trackInfo.timescale))
        [0].trackInfo;

      let mvhd = new MovieHeaderBox(
        1, // HACK
        minDurationTrackInfo.duration / minDurationTrackInfo.timescale,
        this.trackStates.length + 1
      );

      let moov = new MovieBox(mvhd, traks, mvex, udat);
      let ftype = new FileTypeBox('isom', 0x00000200, brands);

      let ftypeSize = ftype.layout(0);
      let moovSize = moov.layout(ftypeSize);

      let header = new Uint8Array(ftypeSize + moovSize);
      ftype.write(header);
      moov.write(header);

      this.oncodecinfo(this.trackStates.map((ts) => ts.mimeTypeCodec));
      this.ondata(header);
      this.filePos += header.length;
      this.state = MP4MuxState.MAIN_PACKETS;

    }

    _generateChunk () {
      let cachedPackets = this.cachedPackets;

      if (SPLIT_AT_KEYFRAMES && this.videoTrackState) {
        var j = cachedPackets.length - 1;
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

      for (var i = 0; i < this.trackStates.length; i++) {
        let trackState = this.trackStates[i];
        let trackInfo = trackState.trackInfo;
        var trackId = trackState.trackId;

        // Finding all packets for this track.
        let trackPackets = cachedPackets.filter((cp) => cp.trackId === trackId);
        if (trackPackets.length === 0) {
          continue;
        }

        // ??? not sure what this was doing but lets keep it around -> var currentTimestamp = (trackPackets[0].timestamp * trackInfo.timescale / 1000) | 0; ???

        let tfdt = new TrackFragmentBaseMediaDecodeTimeBox(trackState.cachedDuration);
        let trun: TrackRunBox;
        let tfhd: TrackFragmentHeaderBox;
        let trunSamples: TrackRunSample[];

        trafDataStarts.push(tdatPosition);
        switch (trackInfo.codecId) {
        case AAC_SOUND_CODEC_ID:
        case MP3_SOUND_CODEC_ID:
          trunSamples = [];
          for (var j = 0; j < trackPackets.length; j++) {
            let audioPacket: AudioPacket = trackPackets[j].packet;
            let audioFrameDuration = Math.round(audioPacket.samples * trackInfo.timescale / trackInfo.samplerate);
            tdatParts.push(audioPacket.data);
            tdatPosition += audioPacket.data.length;
            trunSamples.push({ duration: audioFrameDuration, size: audioPacket.data.length });
            trackState.samplesProcessed += audioPacket.samples;
          }
          var tfhdFlags = TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;
          tfhd = new TrackFragmentHeaderBox(tfhdFlags, trackId, 0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */,
            SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);
          var trunFlags = TrackRunFlags.DATA_OFFSET_PRESENT |
                            TrackRunFlags.SAMPLE_DURATION_PRESENT | TrackRunFlags.SAMPLE_SIZE_PRESENT;
          trun = new TrackRunBox(trunFlags, trunSamples, 0 /* data offset */, 0 /* first flags */);
          trackState.cachedDuration = Math.round(trackState.samplesProcessed * trackInfo.timescale / trackInfo.samplerate);
          break;
        case AVC_VIDEO_CODEC_ID:
        case VP6_VIDEO_CODEC_ID:
          trunSamples = [];
          var samplesProcessed = trackState.samplesProcessed;
          var decodeTime = samplesProcessed * trackInfo.timescale / trackInfo.framerate;
          var lastTime = Math.round(decodeTime);
          for (var j = 0; j < trackPackets.length; j++) {
            let videoPacket: VideoPacket = trackPackets[j].packet;
            samplesProcessed++;
            let nextTime = Math.round(samplesProcessed * trackInfo.timescale / trackInfo.framerate);
            let videoFrameDuration = nextTime - lastTime;
            lastTime = nextTime;

            let compositionTime = (trackInfo.timescale / trackInfo.framerate) + videoPacket.compositionTime;

            // ??? not sure what this was doing but lets keep it around ... Math.round(samplesProcessed * trackInfo.timescale / trackInfo.framerate + videoPacket.compositionTime * trackInfo.timescale / 1000);

            // -> this seems more senseful given that CT is defined as CT(n)  =  DT(n)  +  CTO(n)
            let compositionTimeOffset = compositionTime - nextTime;

            tdatParts.push(videoPacket.data);
            tdatPosition += videoPacket.data.length;
            let frameFlags = videoPacket.frameType === VideoFrameType.KEY
              ? SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS
              : (SampleFlags.SAMPLE_DEPENDS_ON_OTHER | SampleFlags.SAMPLE_IS_NOT_SYNC);
            trunSamples.push({ duration: videoFrameDuration,
              size: videoPacket.data.length,
              flags: frameFlags,
              compositionTimeOffset });
          }
          var tfhdFlags = TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;
          tfhd = new TrackFragmentHeaderBox(tfhdFlags, trackId, 0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */,
            SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);
          var trunFlags = TrackRunFlags.DATA_OFFSET_PRESENT | TrackRunFlags.FIRST_SAMPLE_FLAGS_PRESENT |
                            TrackRunFlags.SAMPLE_DURATION_PRESENT | TrackRunFlags.SAMPLE_SIZE_PRESENT |
                            TrackRunFlags.SAMPLE_FLAGS_PRESENT | TrackRunFlags.SAMPLE_COMPOSITION_TIME_OFFSET;
          trun = new TrackRunBox(trunFlags, trunSamples, 0 /* data offset */, SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);
          trackState.cachedDuration = lastTime;
          trackState.samplesProcessed = samplesProcessed;
          break;
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
      for (var i = 0; i < trafs.length; i++) {
        trafs[i].run.dataOffset = tdatOffset + trafDataStarts[i];
      }

      let chunk = new Uint8Array(moofSize + mdatSize);
      moof.write(chunk);
      mdat.write(chunk);

      this.ondata(chunk);
      this.filePos += chunk.length;
    }
}

