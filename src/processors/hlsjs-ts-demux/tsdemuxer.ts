/**
 * highly optimized TS demuxer:
 * parse PAT, PMT
 * extract PES packet from audio and video PIDs
 * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
 * trigger the remuxer upon parsing completion
 * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
 * it also controls the remuxing process :
 * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
*/

import * as ADTS from './adts';
import MpegAudio from './mpegaudio';
import ExpGolomb from './exp-golomb';
import SampleAesDecrypter from './sample-aes';

import { getLogger } from '../../logger';

// import Hex from '../utils/hex';

const { log, warn, error } = getLogger('TSDemuxer');

// We are using fixed track IDs for driving the MP4 remuxer
// instead of following the TS PIDs.
// There is no reason not to do this and some browsers/SourceBuffer-demuxers
// may not like if there are TrackID "switches"
// See https://github.com/video-dev/hls.js/issues/1331
// Here we are mapping our internal track types to constant MP4 track IDs
// With MSE currently one can only have one track of each, and we are muxing
// whatever video/audio rendition in them.
const RemuxerTrackIdConfig = {
  video: 1,
  audio: 2,
  id3: 3,
  text: 4
};

export type TSDemuxerConfig = {
  forceKeyFrameOnDiscontinuity: boolean
};

export type TSDemuxerCallback = (audioTrack, avcTrack, id3Track, txtTrack, timeOffset, contiguous, accurateTimeOffset) => {};

export class TSDemuxer {

  static probe (data): boolean {
    const syncOffset = TSDemuxer.findSyncOffset(data);
    if (syncOffset < 0) {
      return false;
    } else {
      if (syncOffset) {
        warn(`MPEG2-TS detected but first sync word found @ offset ${syncOffset}, junk ahead ?`);
      }

      return true;
    }
  }

  static findSyncOffset (data): number {

    // scan 4096 first bytes
    const scanwindow = Math.min(4096, data.length - 3 * 188);
    let i = 0;
    while (i < scanwindow) {
      // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
      if (data[i] === 0x47 && data[i + 188] === 0x47 && data[i + 2 * 188] === 0x47) {
        if (i > 0) {
          log('sync-offset at ')
        }
        return i;
      } else {
        i++;
      }
    }
    return -1;
  }

  /**
   * Creates a track model internal to demuxer used to drive remuxing input
   *
  {string} type 'audio' | 'video' | 'id3' | 'text'
  {number} duration
  {object} TSDemuxer's internal track model
   */
  private static _createTrack (type, duration) {
    return {
      container: type === 'video' || type === 'audio' ? 'video/mp2t' : undefined,
      type,
      id: RemuxerTrackIdConfig[type],
      pid: -1,
      inputTimeScale: 90000,
      sequenceNumber: 0,
      samples: [],
      len: 0,
      dropped: type === 'video' ? 0 : undefined,
      isAAC: type === 'audio' ? true : undefined,
      duration: type === 'audio' ? duration : undefined
    };
  }

  config: any;
  typeSupported: {mpeg: boolean, mp3: boolean};
  onDemux: TSDemuxerCallback;
  sampleAes: any;
  observer: any;
  pmtParsed: boolean;
  _pmtId: number;
  _avcTrack: any;
  _audioTrack: any;
  _id3Track: any;
  _txtTrack: any;
  aacOverFlow: any;
  aacLastPTS: any;
  avcSample: any;
  _duration: any;
  contiguous: any;
  _initPTS: any;
  _initDTS: any;

  constructor (onDemux: TSDemuxerCallback, config: Partial<TSDemuxerConfig> = {}, typeSupported: {mpeg: boolean, mp3: boolean} = { mpeg: true, mp3: true }) {
    this.config = config;
    this.typeSupported = typeSupported;
    this.onDemux = onDemux;
    this.sampleAes = null;
  }

  setDecryptionInfo (decryptdata) {
    if ((decryptdata != null) && (decryptdata.key != null) && (decryptdata.method === 'SAMPLE-AES')) {
      this.sampleAes = new SampleAesDecrypter(this.observer, this.config, decryptdata, this.discardEPB);
    } else {
      this.sampleAes = null;
    }
  }

  /**
   * Initializes a new init segment on the demuxer. Needed for discontinuities/track-switches (or at stream start)
   * Resets all internal track instances of the demuxer.
   *
  {string} audioCodec
  {string} videoCodec
  {number} duration (in TS timescale = 90kHz)
   */
  reset (duration: number = 0) {
    this.pmtParsed = false;
    this._pmtId = -1;

    this._avcTrack = TSDemuxer._createTrack('video', duration);
    this._audioTrack = TSDemuxer._createTrack('audio', duration);
    this._id3Track = TSDemuxer._createTrack('id3', duration);
    this._txtTrack = TSDemuxer._createTrack('text', duration);

    // flush any partial content
    this.aacOverFlow = null;
    this.aacLastPTS = null;
    this.avcSample = null;
    this._duration = duration;
  }

  // feed incoming data to the front of the parsing pipeline
  append (data, timeOffset, contiguous, accurateTimeOffset) {

    let start = 0;
    let len = data.length;
    let stt;
    let pid;
    let atf;
    let offset;
    let pes;

    let unknownPIDs = false;
    let pmtParsed = this.pmtParsed;

    let avcTrack = this._avcTrack;
    let audioTrack = this._audioTrack;
    let id3Track = this._id3Track;

    let avcId = avcTrack.pid;
    let audioId = audioTrack.pid;
    let id3Id = id3Track.pid;
    let pmtId = this._pmtId;

    let avcData = avcTrack.pesData;
    let audioData = audioTrack.pesData;
    let id3Data = id3Track.pesData;

    let parsePAT = this._parsePAT;
    let parsePMT = this._parsePMT;
    let parsePES = this._parsePES;
    let parseAVCPES = this._parseAVCPES.bind(this);
    let parseAACPES = this._parseAACPES.bind(this);
    let parseMPEGPES = this._parseMPEGPES.bind(this);
    let parseID3PES = this._parseID3PES.bind(this);

    this.contiguous = contiguous;

    const syncOffset = TSDemuxer.findSyncOffset(data);

    if (syncOffset < 0) {
      throw new Error('No ts-packet found in stream');
    }

    // don't parse last TS packet if incomplete
    len -= (len + syncOffset) % 188;

    // loop through TS packets
    for (start = syncOffset; start < len; start += 188) {

      if (data[start] !== 0x47) { // try to skip until next sync-byte
        for (let i = start; i < len; i++) {
          if (data[i] === 0x47) {
            warn(`Skipped ${i - start} bytes in stream to find next TS package`);
            start = i;
            break;
          }
        }
      }

      stt = !!(data[start + 1] & 0x40);
      // pid is a 13-bit field starting at the last bit of TS[1]
      pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
      atf = (data[start + 3] & 0x30) >> 4;
      // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
      if (atf > 1) {
        offset = start + 5 + data[start + 4];
        // continue if there is only adaptation field
        if (offset === (start + 188)) {
          continue;
        }
      } else {
        offset = start + 4;
      }
      switch (pid) {
      case avcId:
        if (stt) {
          if (avcData && (pes = parsePES(avcData)) && pes.pts !== undefined) {
            parseAVCPES(pes, false);
          }

          avcData = { data: [], size: 0 };
        }
        if (avcData) {
          avcData.data.push(data.subarray(offset, start + 188));
          avcData.size += start + 188 - offset;
        }
        break;
      case audioId:
        if (stt) {
          if (audioData && (pes = parsePES(audioData)) && pes.pts !== undefined) {
            if (audioTrack.isAAC) {
              parseAACPES(pes);
            } else {
              parseMPEGPES(pes);
            }
          }
          audioData = { data: [], size: 0 };
        }
        if (audioData) {
          audioData.data.push(data.subarray(offset, start + 188));
          audioData.size += start + 188 - offset;
        }
        break;
      case id3Id:
        if (stt) {
          if (id3Data && (pes = parsePES(id3Data)) && pes.pts !== undefined) {
            parseID3PES(pes);
          }

          id3Data = { data: [], size: 0 };
        }
        if (id3Data) {
          id3Data.data.push(data.subarray(offset, start + 188));
          id3Data.size += start + 188 - offset;
        }
        break;
      case 0:
        if (stt) {
          offset += data[offset] + 1;
        }

        pmtId = this._pmtId = parsePAT(data, offset);
        break;
      case pmtId:
        if (stt) {
          offset += data[offset] + 1;
        }

        let parsedPIDs = parsePMT(data, offset, this.typeSupported.mpeg || this.typeSupported.mp3, this.sampleAes != null);

        // only update track id if track PID found while parsing PMT
        // this is to avoid resetting the PID to -1 in case
        // track PID transiently disappears from the stream
        // this could happen in case of transient missing audio samples for example
        // NOTE this is only the PID of the track as found in TS,
        // but we are not using this for MP4 track IDs.
        avcId = parsedPIDs.avc;
        if (avcId > 0) {
          avcTrack.pid = avcId;
        }

        audioId = parsedPIDs.audio;
        if (audioId > 0) {
          audioTrack.pid = audioId;
          audioTrack.isAAC = parsedPIDs.isAAC;
        }
        id3Id = parsedPIDs.id3;
        if (id3Id > 0) {
          id3Track.pid = id3Id;
        }

        if (unknownPIDs && !pmtParsed) {
          log('reparse from beginning');
          unknownPIDs = false;
          // we set it to -188, the += 188 in the for loop will reset start to 0
          start = syncOffset - 188;
        }
        pmtParsed = this.pmtParsed = true;
        break;
      case 17:
      case 0x1fff:
        break;
      default:
        unknownPIDs = true;
        break;
      }
    }
    // try to parse last PES packets
    if (avcData && (pes = parsePES(avcData)) && pes.pts !== undefined) {
      parseAVCPES(pes, true);
      avcTrack.pesData = null;
    } else {
      // either avcData null or PES truncated, keep it for next frag parsing
      avcTrack.pesData = avcData;
    }

    if (audioData && (pes = parsePES(audioData)) && pes.pts !== undefined) {
      if (audioTrack.isAAC) {
        parseAACPES(pes);
      } else {
        parseMPEGPES(pes);
      }

      audioTrack.pesData = null;
    } else {
      if (audioData && audioData.size) {
        log('last AAC PES packet truncated,might overlap between fragments');
      }

      // either audioData null or PES truncated, keep it for next frag parsing
      audioTrack.pesData = audioData;
    }

    if (id3Data && (pes = parsePES(id3Data)) && pes.pts !== undefined) {
      parseID3PES(pes);
      id3Track.pesData = null;
    } else {
      // either id3Data null or PES truncated, keep it for next frag parsing
      id3Track.pesData = id3Data;
    }

    if (this.sampleAes == null) {
      this.onDemux(audioTrack, avcTrack, id3Track, this._txtTrack, timeOffset, contiguous, accurateTimeOffset);
    } else {
      this.decryptAndRemux(audioTrack, avcTrack, id3Track, this._txtTrack, timeOffset, contiguous, accurateTimeOffset);
    }
  }

  decryptAndRemux (audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset) {
    if (audioTrack.samples && audioTrack.isAAC) {
      this.sampleAes.decryptAacSamples(audioTrack.samples, 0, function () {
        this.decryptAndRemuxAvc(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
      }.bind(this));
    } else {
      this.decryptAndRemuxAvc(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
    }
  }

  decryptAndRemuxAvc (audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset) {
    if (videoTrack.samples) {
      this.sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, function () {
        this.onDemux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
      }.bind(this));
    } else {
      this.onDemux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
    }
  }

  destroy () {
    this._initPTS = this._initDTS = undefined;
    this._duration = 0;
  }

  _parsePAT (data, offset) {
    // skip the PSI header and parse the first PMT entry
    return (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
    // log('PMT PID:'  + this._pmtId);
  }

  _parsePMT (data, offset, mpegSupported, isSampleAes) {
    let sectionLength; let tableEnd; let programInfoLength; let pid; let result = { audio: -1, avc: -1, id3: -1, isAAC: true };
    sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
    tableEnd = offset + 3 + sectionLength - 4;
    // to determine where the table is, we have to figure out how
    // long the program info descriptors are
    programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
    // advance the offset to the first entry in the mapping table
    offset += 12 + programInfoLength;
    while (offset < tableEnd) {
      pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
      switch (data[offset]) {
      case 0xcf: // SAMPLE-AES AAC
        if (!isSampleAes) {
          log('unkown stream type:' + data[offset]);
          break;
        }
        /* falls through */

        // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
      case 0x0f:
        // log('AAC PID:'  + pid);
        if (result.audio === -1) {
          result.audio = pid;
        }

        break;

        // Packetized metadata (ID3)
      case 0x15:
        // log('ID3 PID:'  + pid);
        if (result.id3 === -1) {
          result.id3 = pid;
        }

        break;

      case 0xdb: // SAMPLE-AES AVC
        if (!isSampleAes) {
          log('unkown stream type:' + data[offset]);
          break;
        }
        /* falls through */

        // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
      case 0x1b:
        // log('AVC PID:'  + pid);
        if (result.avc === -1) {
          result.avc = pid;
        }

        break;

        // ISO/IEC 11172-3 (MPEG-1 audio)
        // or ISO/IEC 13818-3 (MPEG-2 halved sample rate audio)
      case 0x03:
      case 0x04:
        // log('MPEG PID:'  + pid);
        if (!mpegSupported) {
          log('MPEG audio found, not supported in this browser for now');
        } else if (result.audio === -1) {
          result.audio = pid;
          result.isAAC = false;
        }
        break;

      case 0x24:
        warn('HEVC stream type found, not supported for now');
        break;

      default:
        log('unkown stream type:' + data[offset]);
        break;
      }
      // move to the next table entry
      // skip past the elementary stream descriptors, if present
      offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
    }
    return result;
  }

  _parsePES (stream) {
    let i = 0; let frag; let pesFlags; let pesPrefix; let pesLen; let pesHdrLen; let pesData; let pesPts; let pesDts; let payloadStartOffset; let data = stream.data;
    // safety check
    if (!stream || stream.size === 0) {
      return null;
    }

    // we might need up to 19 bytes to read PES header
    // if first chunk of data is less than 19 bytes, let's merge it with following ones until we get 19 bytes
    // usually only one merge is needed (and this is rare ...)
    while (data[0].length < 19 && data.length > 1) {
      let newData = new Uint8Array(data[0].length + data[1].length);
      newData.set(data[0]);
      newData.set(data[1], data[0].length);
      data[0] = newData;
      data.splice(1, 1);
    }
    // retrieve PTS/DTS from first fragment
    frag = data[0];
    pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
    if (pesPrefix === 1) {
      pesLen = (frag[4] << 8) + frag[5];
      // if PES parsed length is not zero and greater than total received length, stop parsing. PES might be truncated
      // minus 6 : PES header size
      if (pesLen && pesLen > stream.size - 6) {
        return null;
      }

      pesFlags = frag[7];
      if (pesFlags & 0xC0) {
        /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
            as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
            as Bitwise operators treat their operands as a sequence of 32 bits */
        pesPts = (frag[9] & 0x0E) * 536870912 +// 1 << 29
          (frag[10] & 0xFF) * 4194304 +// 1 << 22
          (frag[11] & 0xFE) * 16384 +// 1 << 14
          (frag[12] & 0xFF) * 128 +// 1 << 7
          (frag[13] & 0xFE) / 2;
        // check if greater than 2^32 -1
        if (pesPts > 4294967295) {
          // decrement 2^33
          pesPts -= 8589934592;
        }
        if (pesFlags & 0x40) {
          pesDts = (frag[14] & 0x0E) * 536870912 +// 1 << 29
            (frag[15] & 0xFF) * 4194304 +// 1 << 22
            (frag[16] & 0xFE) * 16384 +// 1 << 14
            (frag[17] & 0xFF) * 128 +// 1 << 7
            (frag[18] & 0xFE) / 2;
          // check if greater than 2^32 -1
          if (pesDts > 4294967295) {
            // decrement 2^33
            pesDts -= 8589934592;
          }
          if (pesPts - pesDts > 60 * 90000) {
            warn(`${Math.round((pesPts - pesDts) / 90000)}s delta between PTS and DTS, align them`);
            pesPts = pesDts;
          }
        } else {
          pesDts = pesPts;
        }
      }
      pesHdrLen = frag[8];
      // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
      payloadStartOffset = pesHdrLen + 9;

      stream.size -= payloadStartOffset;
      // reassemble PES packet
      pesData = new Uint8Array(stream.size);
      for (let j = 0, dataLen = data.length; j < dataLen; j++) {
        frag = data[j];
        let len = frag.byteLength;
        if (payloadStartOffset) {
          if (payloadStartOffset > len) {
            // trim full frag if PES header bigger than frag
            payloadStartOffset -= len;
            continue;
          } else {
            // trim partial frag if PES header smaller than frag
            frag = frag.subarray(payloadStartOffset);
            len -= payloadStartOffset;
            payloadStartOffset = 0;
          }
        }
        pesData.set(frag, i);
        i += len;
      }
      if (pesLen) {
        // payload size : remove PES header + PES extension
        pesLen -= pesHdrLen + 3;
      }
      return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
    } else {
      return null;
    }
  }

  pushAccesUnit (avcSample, avcTrack) {
    if (avcSample.units.length && avcSample.frame) {
      const samples = avcTrack.samples;
      const nbSamples = samples.length;
      // only push AVC sample if starting with a keyframe is not mandatory OR
      //    if keyframe already found in this fragment OR
      //       keyframe found in last fragment (track.sps) AND
      //          samples already appended (we already found a keyframe in this fragment) OR fragment is contiguous
      if (!this.config.forceKeyFrameOnDiscontinuity ||
          avcSample.key === true ||
          (avcTrack.sps && (nbSamples || this.contiguous))) {
        avcSample.id = nbSamples;
        samples.push(avcSample);
      } else {
        // dropped samples, track it
        avcTrack.dropped++;
      }
    }
    if (avcSample.debug.length) {
      log(avcSample.pts + '/' + avcSample.dts + ':' + avcSample.debug);
    }
  }

  _parseAVCPES (pes, last) {
    // log('parse new PES');
    let track = this._avcTrack;

    let units = this._parseAVCNALu(pes.data);

    let debug = true;

    let expGolombDecoder;

    let avcSample = this.avcSample;

    let push;

    let spsfound = false;

    let i;

    let pushAccesUnit = this.pushAccesUnit.bind(this);

    let createAVCSample = function (key, pts, dts, debug) {
      return { key: key, pts: pts, dts: dts, units: [], debug: debug };
    };
    // free pes.data to save up some memory
    pes.data = null;

    // if new NAL units found and last sample still there, let's push ...
    // this helps parsing streams with missing AUD (only do this if AUD never found)
    if (avcSample && units.length && !track.audFound) {
      pushAccesUnit(avcSample, track);
      avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, '');
    }

    units.forEach(unit => {
      switch (unit.type) {
      // NDR
      case 1:
        push = true;
        if (!avcSample) {
          avcSample = this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
        }

        if (debug) {
          avcSample.debug += 'NDR ';
        }

        avcSample.frame = true;
        let data = unit.data;
        // only check slice type to detect KF in case SPS found in same packet (any keyframe is preceded by SPS ...)
        if (spsfound && data.length > 4) {
          // retrieve slice type by parsing beginning of NAL unit (follow H264 spec, slice_header definition) to detect keyframe embedded in NDR
          let sliceType = new ExpGolomb(data).readSliceType();
          // 2 : I slice, 4 : SI slice, 7 : I slice, 9: SI slice
          // SI slice : A slice that is coded using intra prediction only and using quantisation of the prediction samples.
          // An SI slice can be coded such that its decoded samples can be constructed identically to an SP slice.
          // I slice: A slice that is not an SI slice that is decoded using intra prediction only.
          // if (sliceType === 2 || sliceType === 7) {
          if (sliceType === 2 || sliceType === 4 || sliceType === 7 || sliceType === 9) {
            avcSample.key = true;
          }
        }
        break;
        // IDR
      case 5:
        push = true;
        // handle PES not starting with AUD
        if (!avcSample) {
          avcSample = this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
        }

        if (debug) {
          avcSample.debug += 'IDR ';
        }

        avcSample.key = true;
        avcSample.frame = true;
        break;
        // SEI
      case 6:
        push = true;
        if (debug && avcSample) {
          avcSample.debug += 'SEI ';
        }

        expGolombDecoder = new ExpGolomb(this.discardEPB(unit.data));

        // skip frameType
        expGolombDecoder.readUByte();

        var payloadType = 0;
        var payloadSize = 0;
        var endOfCaptions = false;
        var b = 0;

        while (!endOfCaptions && expGolombDecoder.bytesAvailable > 1) {
          payloadType = 0;
          do {
            b = expGolombDecoder.readUByte();
            payloadType += b;
          } while (b === 0xFF);

          // Parse payload size.
          payloadSize = 0;
          do {
            b = expGolombDecoder.readUByte();
            payloadSize += b;
          } while (b === 0xFF);

          // TODO: there can be more than one payload in an SEI packet...
          // TODO: need to read type and size in a while loop to get them all
          if (payloadType === 4 && expGolombDecoder.bytesAvailable !== 0) {
            endOfCaptions = true;

            let countryCode = expGolombDecoder.readUByte();

            if (countryCode === 181) {
              let providerCode = expGolombDecoder.readUShort();

              if (providerCode === 49) {
                let userStructure = expGolombDecoder.readUInt();

                if (userStructure === 0x47413934) {
                  let userDataType = expGolombDecoder.readUByte();

                  // Raw CEA-608 bytes wrapped in CEA-708 packet
                  if (userDataType === 3) {
                    let firstByte = expGolombDecoder.readUByte();
                    let secondByte = expGolombDecoder.readUByte();

                    let totalCCs = 31 & firstByte;
                    let byteArray = [firstByte, secondByte];

                    for (i = 0; i < totalCCs; i++) {
                      // 3 bytes per CC
                      byteArray.push(expGolombDecoder.readUByte());
                      byteArray.push(expGolombDecoder.readUByte());
                      byteArray.push(expGolombDecoder.readUByte());
                    }

                    this._insertSampleInOrder(this._txtTrack.samples, { type: 3, pts: pes.pts, bytes: byteArray });
                  }
                }
              }
            }
          } else if (payloadSize < expGolombDecoder.bytesAvailable) {
            for (i = 0; i < payloadSize; i++) {
              expGolombDecoder.readUByte();
            }
          }
        }
        break;
        // SPS
      case 7:
        push = true;
        spsfound = true;
        if (debug && avcSample) {
          avcSample.debug += 'SPS ';
        }

        if (!track.sps) {
          expGolombDecoder = new ExpGolomb(unit.data);
          let config = expGolombDecoder.readSPS();
          track.width = config.width;
          track.height = config.height;
          track.pixelRatio = config.pixelRatio;
          track.sps = [unit.data];
          track.duration = this._duration;
          let codecarray = unit.data.subarray(1, 4);
          let codecstring = 'avc1.';
          for (i = 0; i < 3; i++) {
            let h = codecarray[i].toString(16);
            if (h.length < 2) {
              h = '0' + h;
            }

            codecstring += h;
          }
          track.codec = codecstring;
        }
        break;
        // PPS
      case 8:
        push = true;
        if (debug && avcSample) {
          avcSample.debug += 'PPS ';
        }

        if (!track.pps) {
          track.pps = [unit.data];
        }

        break;
        // AUD
      case 9:
        push = false;
        track.audFound = true;
        if (avcSample) {
          pushAccesUnit(avcSample, track);
        }

        avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, debug ? 'AUD ' : '');
        break;
        // Filler Data
      case 12:
        push = false;
        break;
      default:
        push = false;
        if (avcSample) {
          avcSample.debug += 'unknown NAL ' + unit.type + ' ';
        }

        break;
      }
      if (avcSample && push) {
        let units = avcSample.units;
        units.push(unit);
      }
    });
    // if last PES packet, push samples
    if (last && avcSample) {
      pushAccesUnit(avcSample, track);
      this.avcSample = null;
    }
  }

  _insertSampleInOrder (arr, data) {
    let len = arr.length;
    if (len > 0) {
      if (data.pts >= arr[len - 1].pts) {
        arr.push(data);
      } else {
        for (let pos = len - 1; pos >= 0; pos--) {
          if (data.pts < arr[pos].pts) {
            arr.splice(pos, 0, data);
            break;
          }
        }
      }
    } else {
      arr.push(data);
    }
  }

  _getLastNalUnit () {
    let avcSample = this.avcSample; let lastUnit;
    // try to fallback to previous sample if current one is empty
    if (!avcSample || avcSample.units.length === 0) {
      let track = this._avcTrack; let samples = track.samples;
      avcSample = samples[samples.length - 1];
    }
    if (avcSample) {
      let units = avcSample.units;
      lastUnit = units[units.length - 1];
    }
    return lastUnit;
  }

  _parseAVCNALu (array) {
    let i = 0; let len = array.byteLength; let value; let overflow; let track = this._avcTrack; let state = track.naluState || 0; let lastState = state;
    let units = []; let unit; let unitType; let lastUnitStart = -1; let lastUnitType;
    // log('PES:' + Hex.hexDump(array));

    if (state === -1) {
    // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
      lastUnitStart = 0;
      // NALu type is value read from offset 0
      lastUnitType = array[0] & 0x1f;
      state = 0;
      i = 1;
    }

    while (i < len) {
      value = array[i++];
      // optimization. state 0 and 1 are the predominant case. let's handle them outside of the switch/case
      if (!state) {
        state = value ? 0 : 1;
        continue;
      }
      if (state === 1) {
        state = value ? 0 : 2;
        continue;
      }
      // here we have state either equal to 2 or 3
      if (!value) {
        state = 3;
      } else if (value === 1) {
        if (lastUnitStart >= 0) {
          unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
          // log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
          units.push(unit);
        } else {
          // lastUnitStart is undefined => this is the first start code found in this PES packet
          // first check if start code delimiter is overlapping between 2 PES packets,
          // ie it started in last packet (lastState not zero)
          // and ended at the beginning of this PES packet (i <= 4 - lastState)
          let lastUnit = this._getLastNalUnit();
          if (lastUnit) {
            if (lastState && (i <= 4 - lastState)) {
              // start delimiter overlapping between PES packets
              // strip start delimiter bytes from the end of last NAL unit
              // check if lastUnit had a state different from zero
              if (lastUnit.state) {
                // strip last bytes
                lastUnit.data = lastUnit.data.subarray(0, lastUnit.data.byteLength - lastState);
              }
            }
            // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
            overflow = i - state - 1;
            if (overflow > 0) {
              // log('first NALU found with overflow:' + overflow);
              let tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
              tmp.set(lastUnit.data, 0);
              tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
              lastUnit.data = tmp;
            }
          }
        }
        // check if we can read unit type
        if (i < len) {
          unitType = array[i] & 0x1f;
          // log('find NALU @ offset:' + i + ',type:' + unitType);
          lastUnitStart = i;
          lastUnitType = unitType;
          state = 0;
        } else {
          // not enough byte to read unit type. let's read it on next PES parsing
          state = -1;
        }
      } else {
        state = 0;
      }
    }
    if (lastUnitStart >= 0 && state >= 0) {
      unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType, state: state };
      units.push(unit);
      // log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
    }
    // no NALu found
    if (units.length === 0) {
      // append pes.data to previous NAL unit
      let lastUnit = this._getLastNalUnit();
      if (lastUnit) {
        let tmp = new Uint8Array(lastUnit.data.byteLength + array.byteLength);
        tmp.set(lastUnit.data, 0);
        tmp.set(array, lastUnit.data.byteLength);
        lastUnit.data = tmp;
      }
    }
    track.naluState = state;
    return units;
  }

  /**
   * remove Emulation Prevention bytes from a RBSP
   */
  discardEPB (data) {
    let length = data.byteLength;

    let EPBPositions = [];

    let i = 1;

    let newLength; let newData;

    // Find all `Emulation Prevention Bytes`
    while (i < length - 2) {
      if (data[i] === 0 &&
          data[i + 1] === 0 &&
          data[i + 2] === 0x03) {
        EPBPositions.push(i + 2);
        i += 2;
      } else {
        i++;
      }
    }

    // If no Emulation Prevention Bytes were found just return the original
    // array
    if (EPBPositions.length === 0) {
      return data;
    }

    // Create a new array to hold the NAL unit data
    newLength = length - EPBPositions.length;
    newData = new Uint8Array(newLength);
    let sourceIndex = 0;

    for (i = 0; i < newLength; sourceIndex++, i++) {
      if (sourceIndex === EPBPositions[0]) {
        // Skip this byte
        sourceIndex++;
        // Remove this position index
        EPBPositions.shift();
      }
      newData[i] = data[sourceIndex];
    }
    return newData;
  }

  _parseAACPES (pes) {
    let track = this._audioTrack;

    let data = pes.data;

    let pts = pes.pts;

    let startOffset = 0;

    let aacOverFlow = this.aacOverFlow;

    let aacLastPTS = this.aacLastPTS;

    let frameDuration; let frameIndex; let offset; let stamp; let len;
    if (aacOverFlow) {
      let tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
      tmp.set(aacOverFlow, 0);
      tmp.set(data, aacOverFlow.byteLength);
      // log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
      data = tmp;
    }
    // look for ADTS header (0xFFFx)
    for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
      if (ADTS.isHeader(data, offset)) {
        break;
      }
    }
    // if ADTS header does not start straight from the beginning of the PES payload, raise an error
    if (offset) {
      let reason; let fatal;
      if (offset < len - 1) {
        reason = `AAC PES did not start with ADTS header,offset:${offset}`;
        fatal = false;
      } else {
        reason = 'no ADTS header found in AAC PES';
        fatal = true;
      }
      warn(`parsing error:${reason}`);
      error({ fatal: fatal, reason: reason });
      if (fatal) {
        return;
      }
    }

    ADTS.initTrackConfig(track, data, offset, null); // FIXME: pass in known audio codec info (mimetype + details) here
    frameIndex = 0;
    frameDuration = ADTS.getFrameDuration(track.samplerate);

    // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
    // first sample PTS should be equal to last sample PTS + frameDuration
    if (aacOverFlow && aacLastPTS) {
      let newPTS = aacLastPTS + frameDuration;
      if (Math.abs(newPTS - pts) > 1) {
        log(`AAC: align PTS for overlapping frames by ${Math.round((newPTS - pts) / 90)}`);
        pts = newPTS;
      }
    }

    // scan for aac samples
    while (offset < len) {
      if (ADTS.isHeader(data, offset) && (offset + 5) < len) {
        let frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
        if (frame) {
          // log(`${Math.round(frame.sample.pts)} : AAC`);
          offset += frame.length;
          stamp = frame.sample.pts;
          frameIndex++;
        } else {
          // log('Unable to parse AAC frame');
          break;
        }
      } else {
        // nothing found, keep looking
        offset++;
      }
    }

    if (offset < len) {
      aacOverFlow = data.subarray(offset, len);
      // log(`AAC: overflow detected:${len-offset}`);
    } else {
      aacOverFlow = null;
    }

    this.aacOverFlow = aacOverFlow;
    this.aacLastPTS = stamp;
  }

  _parseMPEGPES (pes) {
    let data = pes.data;
    let length = data.length;
    let frameIndex = 0;
    let offset = 0;
    let pts = pes.pts;

    while (offset < length) {
      if (MpegAudio.isHeader(data, offset)) {
        let frame = MpegAudio.appendFrame(this._audioTrack, data, offset, pts, frameIndex);
        if (frame) {
          offset += frame.length;
          frameIndex++;
        } else {
          // log('Unable to parse Mpeg audio frame');
          break;
        }
      } else {
        // nothing found, keep looking
        offset++;
      }
    }
  }

  _parseID3PES (pes) {
    this._id3Track.samples.push(pes);
  }
}

export default TSDemuxer;
