import { mixinProcessorWithOptions } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';
import { BufferSlice } from '../core/buffer';
import { CommonMimeTypes } from '../core/payload-description';

import { getLogger, LoggerLevel } from '../logger';
import { Nullable } from '../common-types';
import { secsToMillis } from '../common-utils';

import { debugAccessUnit, debugNALU, makeAccessUnitFromNALUs, parseNALU, H264NaluType, makeNALUFromH264RbspData } from './h264/h264-tools';
import { AvcCodecDataBox } from './mozilla-rtmpjs/mp4iso-boxes';
import { H264ParameterSetParser } from '../ext-mod/inspector.js/src/codecs/h264/param-set-parser';
import { Sps } from '../ext-mod/inspector.js/src/codecs/h264/nal-units';
import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';

const { debug, log, warn, error } = getLogger('AvcPayloaderProc', LoggerLevel.OFF, true);

const DEBUG_H264 = false;

const DEFAULT_FRAME_RATE = 24; // "best guess" if unable to determine (lowest FPS typical to avoid gaps)
const DEFAULT_PACKET_DELAY_TIMEOUT_FACTOR = 16; // typical GOP length

const auDelimiterNalu = makeNALUFromH264RbspData(BufferSlice.fromTypedArray(new Uint8Array([7 << 5])), H264NaluType.AUD, 3);

const AvcPayloaderProcWithOpts = mixinProcessorWithOptions<AvcPayloaderOpts>({
  useAnnexB: false,
  enableSpsPpsToAvcc: true,
  enableSampleDurationPacketDelay: true,
  timeoutFactorPacketDelay: DEFAULT_PACKET_DELAY_TIMEOUT_FACTOR,
  defaultFrameRate: DEFAULT_FRAME_RATE,
});

export type AvcPayloaderOpts = {
  useAnnexB: boolean
  enableSpsPpsToAvcc: boolean
  enableSampleDurationPacketDelay: boolean
  timeoutFactorPacketDelay: number // set to Infinity to disable timeout
  defaultFrameRate: number // "best guess" if unable to determine
};

export class AvcPayloaderProc extends AvcPayloaderProcWithOpts {

  static getName (): string {
    return 'AvcPayloaderProc';
  }

  private _spsSliceCache: Nullable<BufferSlice> = null;
  private _ppsSliceCache: Nullable<BufferSlice> = null;
  private _packetDelayStore: Nullable<Packet> = null;
  private _packetDelayTimeout: unknown;
  private _previousFrameTimeDiff: number = NaN;

  constructor (opts?: Partial<AvcPayloaderOpts>) {
    super();

    this.setOptions(opts);

    this.createInput();
    this.createOutput();
  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return new SocketDescriptor();
  }

  protected processTransfer_ (inS: InputSocket, p: Packet): boolean {
    log('parsing packet:', p.toString());

    const { properties } = p;
    if (!properties) {
      warn('no buffer-props, dropping packet');
      return false;
    }

    if (properties.tags.has('nalu')) {
      debug('input packet is tagged as NALU with tags:', properties.tags,
      'and nb of slices:', p.dataSlicesLength);

      // only needed for AvcC generation ??
      if (properties.tags.has('sps') || properties.tags.has('pps')) {
        p.forEachBufferSlice(this._handleParameterSetNalus.bind(this, p), null, this);
      }

      this._processPacket(p);

    } else {
      error('Got packet not tagged NALU');
      return false;
    }

    return true;
  }

  private _processPacket (p: Packet) {
    const { properties } = p;

    // packet data might contain multiple slices for the frame:
    // this proc replaces that by a single AU containing all slices.

    const slices = p.data;
    const bufferSlice = makeAccessUnitFromNALUs(slices, this.options_.useAnnexB);

    bufferSlice.props = properties;
    bufferSlice.props.mimeType = CommonMimeTypes.VIDEO_AVC;

    // first drop all slices from data list
    p.data.length = 0;
    // set as data single buffer with frame AU
    p.data[0] = bufferSlice;

    log('wrote multi-slice AU for packet:', p.toString());
    DEBUG_H264 && debugAccessUnit(bufferSlice, true, log);

    // cache packet for sample-timing
    if (this.options_.enableSampleDurationPacketDelay) {
      this._processWithPacketDelay(p);
    } else {
      // just pass on the packet as is to only output
      this.out[0].transfer(
        p
      );
    }
  }

  private _processWithPacketDelay(p: Packet) {
    // process current delay-store
    if (this._packetDelayStore) {
      if (this._packetDelayTimeout) {
        clearTimeout(<number> this._packetDelayTimeout);
        this._packetDelayTimeout = null;
      }
      this._popPacketDelayStore(p);
    }

    // put packet into delay-store
    this._packetDelayStore = p;

    // on EOS or network source congestion any "last" packet in store stays stuck:
    // -> we priorly store last sample-duration as "best guess"
    // and release this packet after a given delay
    // (e.g the sample-duration time itself or multiple)
    // so that in any case all packets received by proc actually get transfered...
    this._packetDelayTimeout = <unknown> setTimeout(() => {
      this._packetDelayTimeout = null;
      if (!this._packetDelayStore) {
        throw new Error('Packet-delay timer called on empty store');
      }
      this._popPacketDelayStore();
      this._packetDelayStore = null;
    }, this.options_.timeoutFactorPacketDelay * secsToMillis(p.properties.getSampleDuration()));

  }

  private _popPacketDelayStore(p: Packet = null) {
    const { timeScale } = this._packetDelayStore;
    if (!p || p.timeScale === timeScale) {

      let frameTimeDiff;
      if (p) {
        const prevDts = this._packetDelayStore.getDts();
        const nextDts = p.getDts();
        frameTimeDiff = nextDts - prevDts;
      }

      if (frameTimeDiff >= 0) {
        this._previousFrameTimeDiff = frameTimeDiff;
        this._packetDelayStore
          .properties.setSampleDuration(frameTimeDiff, timeScale);
      } else {
        if (this._previousFrameTimeDiff) {
          this._packetDelayStore
            .properties.setSampleDuration(this._previousFrameTimeDiff, timeScale);
        } else {
          this._packetDelayStore
            .properties.setSampleDuration(1, this.options_.defaultFrameRate);
        }
      }
    }
    this.out[0].transfer(
      this._packetDelayStore
    );
  }

  private _handleParameterSetNalus (p: Packet, bufferSlice: BufferSlice) {
    // DEBUG_H264 && debugNALU(bufferSlice)

    const propsCache = bufferSlice.props;
    const nalu = parseNALU(bufferSlice);
    const naluType = nalu.nalType;

    if (naluType === H264NaluType.SPS) {
      if (this.options_.enableSpsPpsToAvcc) {
        if (this._spsSliceCache) {
          bufferSlice = null;
        } else {
          this._spsSliceCache = bufferSlice;
          bufferSlice = null;
          const avcCDataSlice = this._tryWriteAvcCDataFromSpsPpsCache();
          if (avcCDataSlice) {
            bufferSlice = avcCDataSlice;
            bufferSlice.props = propsCache;
            bufferSlice.props.isBitstreamHeader = true;
          }
        }
      }
    } else if (naluType === H264NaluType.PPS) {
      if (this.options_.enableSpsPpsToAvcc) {
        if (this._ppsSliceCache) {
          bufferSlice = null;
        } else {
          this._ppsSliceCache = bufferSlice;
          bufferSlice = null;
          const avcCDataSlice = this._tryWriteAvcCDataFromSpsPpsCache();
          if (avcCDataSlice) {
            bufferSlice = avcCDataSlice;
            bufferSlice.props = propsCache;
            bufferSlice.props.isBitstreamHeader = true;
          }
        }
      }
    }

    if (bufferSlice) {
      /*
      try {
        let avcC: AvcC = <AvcC> AvcC.parse(bufferSlice.getUint8Array());
        log('wrote MP4 AvcC atom:', avcC);
      } catch (err) {
        warn('failed to parse data expected to be AvcC atom:', bufferSlice);
        throw err;
      }
      */
      this.out[0].transfer(Packet.fromSlice(bufferSlice, p.timestamp));
    }

  }

  private _tryWriteAvcCDataFromSpsPpsCache (): BufferSlice {
    if (!this._spsSliceCache || !this._ppsSliceCache) {
      return null;
    }

    const spsInfo: Sps = H264ParameterSetParser.parseSPS(this._spsSliceCache.getUint8Array().subarray(1));
    // const ppsInfo: Pps = H264ParameterSetParser.parsePPS(this._ppsSliceCache.getUint8Array().subarray(1));

    DEBUG_H264 && debugNALU(this._spsSliceCache, log);
    DEBUG_H264 && debugNALU(this._ppsSliceCache, log);

    const avcCodecDataBox: AvcCodecDataBox = new AvcCodecDataBox(
      [this._spsSliceCache.getUint8Array()],
      [this._ppsSliceCache.getUint8Array()],
      spsInfo.profileIdc,
      64, // "profileCompatibility" - not clear exactly what this does but this value is in other common test-data
      spsInfo.levelIdc
    );

    // layout, allocate and write AvcC box
    const numBytesAlloc = avcCodecDataBox.layout(0);
    const bufferSlice = BufferSlice.allocateNew(numBytesAlloc);
    avcCodecDataBox.write(bufferSlice.getUint8Array());

    // Reset here if need to handle multiple embedded SPS/PPS in stream
    /// *
    this._spsSliceCache = null;
    this._ppsSliceCache = null;
    //* /

    log('made AvcC atom data');

    // we need to unwrap the first 8 bytes of iso-boxing because
    // downstream we only expect the actual atom payload data
    // (without type & size headers of each 4 bytes)
    return bufferSlice.shrinkFront(8);
  }
}
