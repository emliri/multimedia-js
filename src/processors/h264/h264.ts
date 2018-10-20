import { ExpGolomb } from './exp-golomb';
import { NALU } from './nalu';

export class H264Parser {
  static extractNALu (buffer: Uint8Array): Uint8Array[] {
    let i: number = 0;
    let length: number = buffer.byteLength;
    let value: number;
    let state: number = 0;
    const result: Uint8Array[] = [];
    let lastIndex: number;

    while (i < length) {
      value = buffer[i++];
      // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
      switch (state) {
      case 0:
        if (value === 0) {
          state = 1;
        }
        break;
      case 1:
        if (value === 0) {
          state = 2;
        } else {
          state = 0;
        }
        break;
      case 2:
      case 3:
        if (value === 0) {
          state = 3;
        } else if (value === 1 && i < length) {
          if (lastIndex) {
            result.push(buffer.subarray(lastIndex, i - state - 1));
          }
          lastIndex = i;
          state = 0;
        } else {
          state = 0;
        }
        break;
      default:
        break;
      }
    }

    if (lastIndex) {
      result.push(buffer.subarray(lastIndex, length));
    }
    return result;
  }

  /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
  decoder {ExpGolomb} exp golomb decoder
  count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */
  static skipScalingList (decoder, count) {
    let lastScale = 8;

    let nextScale = 8;

    let deltaScale;
    for (let j = 0; j < count; j++) {
      if (nextScale !== 0) {
        deltaScale = decoder.readEG();
        nextScale = (lastScale + deltaScale + 256) % 256;
      }
      lastScale = (nextScale === 0) ? lastScale : nextScale;
    }
  }

  /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
  data {Uint8Array} the bytes of a sequence parameter set
  {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */
  static readSPS (data) {
    let decoder = new ExpGolomb(data);
    let frameCropLeftOffset = 0;

    let frameCropRightOffset = 0;

    let frameCropTopOffset = 0;

    let frameCropBottomOffset = 0;

    let sarScale = 1;

    let profileIdc;

    let profileCompat;

    let levelIdc;

    let numRefFramesInPicOrderCntCycle;

    let picWidthInMbsMinus1;

    let picHeightInMapUnitsMinus1;

    let frameMbsOnlyFlag;

    let scalingListCount;
    decoder.readUByte();
    profileIdc = decoder.readUByte(); // profile_idc
    profileCompat = decoder.readBits(5); // constraint_set[0-4]_flag, u(5)
    decoder.skipBits(3); // reserved_zero_3bits u(3),
    levelIdc = decoder.readUByte(); // level_idc u(8)
    decoder.skipUEG(); // seq_parameter_set_id
    // some profiles have more optional data we don't need
    if (profileIdc === 100 ||
            profileIdc === 110 ||
            profileIdc === 122 ||
            profileIdc === 244 ||
            profileIdc === 44 ||
            profileIdc === 83 ||
            profileIdc === 86 ||
            profileIdc === 118 ||
            profileIdc === 128) {
      let chromaFormatIdc = decoder.readUEG();
      if (chromaFormatIdc === 3) {
        decoder.skipBits(1); // separate_colour_plane_flag
      }
      decoder.skipUEG(); // bit_depth_luma_minus8
      decoder.skipUEG(); // bit_depth_chroma_minus8
      decoder.skipBits(1); // qpprime_y_zero_transform_bypass_flag
      if (decoder.readBoolean()) { // seq_scaling_matrix_present_flag
        scalingListCount = (chromaFormatIdc !== 3) ? 8 : 12;
        for (let i = 0; i < scalingListCount; ++i) {
          if (decoder.readBoolean()) { // seq_scaling_list_present_flag[ i ]
            if (i < 6) {
              H264Parser.skipScalingList(decoder, 16);
            } else {
              H264Parser.skipScalingList(decoder, 64);
            }
          }
        }
      }
    }
    decoder.skipUEG(); // log2_max_frame_num_minus4
    let picOrderCntType = decoder.readUEG();
    if (picOrderCntType === 0) {
      decoder.readUEG(); // log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      decoder.skipBits(1); // delta_pic_order_always_zero_flag
      decoder.skipEG(); // offset_for_non_ref_pic
      decoder.skipEG(); // offset_for_top_to_bottom_field
      numRefFramesInPicOrderCntCycle = decoder.readUEG();
      for (let i = 0; i < numRefFramesInPicOrderCntCycle; ++i) {
        decoder.skipEG(); // offset_for_ref_frame[ i ]
      }
    }
    decoder.skipUEG(); // max_num_ref_frames
    decoder.skipBits(1); // gaps_in_frame_num_value_allowed_flag
    picWidthInMbsMinus1 = decoder.readUEG();
    picHeightInMapUnitsMinus1 = decoder.readUEG();
    frameMbsOnlyFlag = decoder.readBits(1);
    if (frameMbsOnlyFlag === 0) {
      decoder.skipBits(1); // mb_adaptive_frame_field_flag
    }
    decoder.skipBits(1); // direct_8x8_inference_flag
    if (decoder.readBoolean()) { // frame_cropping_flag
      frameCropLeftOffset = decoder.readUEG();
      frameCropRightOffset = decoder.readUEG();
      frameCropTopOffset = decoder.readUEG();
      frameCropBottomOffset = decoder.readUEG();
    }
    if (decoder.readBoolean()) {
      // vui_parameters_present_flag
      if (decoder.readBoolean()) {
        // aspect_ratio_info_present_flag
        let sarRatio;
        const aspectRatioIdc = decoder.readUByte();
        switch (aspectRatioIdc) {
        case 1: sarRatio = [1, 1]; break;
        case 2: sarRatio = [12, 11]; break;
        case 3: sarRatio = [10, 11]; break;
        case 4: sarRatio = [16, 11]; break;
        case 5: sarRatio = [40, 33]; break;
        case 6: sarRatio = [24, 11]; break;
        case 7: sarRatio = [20, 11]; break;
        case 8: sarRatio = [32, 11]; break;
        case 9: sarRatio = [80, 33]; break;
        case 10: sarRatio = [18, 11]; break;
        case 11: sarRatio = [15, 11]; break;
        case 12: sarRatio = [64, 33]; break;
        case 13: sarRatio = [160, 99]; break;
        case 14: sarRatio = [4, 3]; break;
        case 15: sarRatio = [3, 2]; break;
        case 16: sarRatio = [2, 1]; break;
        case 255: {
          sarRatio = [decoder.readUByte() << 8 | decoder.readUByte(), decoder.readUByte() << 8 | decoder.readUByte()];
          break;
        }
        }
        if (sarRatio) {
          sarScale = sarRatio[0] / sarRatio[1];
        }
      }
      if (decoder.readBoolean()) {
        decoder.skipBits(1);
      }

      if (decoder.readBoolean()) {
        decoder.skipBits(4);
        if (decoder.readBoolean()) {
          decoder.skipBits(24);
        }
      }
      if (decoder.readBoolean()) {
        decoder.skipUEG();
        decoder.skipUEG();
      }
      if (decoder.readBoolean()) {
        let unitsInTick = decoder.readUInt();
        let timeScale = decoder.readUInt();
        let fixedFrameRate = decoder.readBoolean();
        let frameDuration = timeScale / (2 * unitsInTick);
      }
    }
    return {
      width: Math.ceil((((picWidthInMbsMinus1 + 1) * 16) - frameCropLeftOffset * 2 - frameCropRightOffset * 2) * sarScale),
      height: ((2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16) - ((frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset))
    };
  }

    width: number;
    height: number;
    sps: Uint8Array[];
    pps: Uint8Array[];
    codec: string;
    readyToDecode: boolean;
    isHDAvailable: boolean;

    parseSPS (sps: Uint8Array) {
      let config = H264Parser.readSPS(new Uint8Array(sps)); // why new?

      this.width = config.width;
      this.height = config.height;
      this.sps = [new Uint8Array(sps)];
      this.codec = 'avc1.';

      let codecarray = new DataView(sps.buffer, sps.byteOffset + 1, 4);
      for (let i = 0; i < 3; ++i) {
        let h = codecarray.getUint8(i).toString(16);
        if (h.length < 2) {
          h = '0' + h;
        }
        this.codec += h;
      }
    }

    parsePPS (pps: Uint8Array) {
      this.pps = [new Uint8Array(pps)]; // why new?
    }

    parseNAL (unit: NALU) {
      if (!unit) return false;

      let push = false;
      switch (unit.type()) {
      case NALU.NDR:
        push = true;
        break;
      case NALU.IDR:
        push = true;
        break;
      case NALU.PPS:
        if (!this.pps) {
          this.parsePPS(unit.getData().subarray(4));
          if (!this.readyToDecode && this.pps && this.sps) {
            this.readyToDecode = true;
          }
        }
        push = true;
        break;
      case NALU.SPS:
        if (!this.sps) {
          this.parseSPS(unit.getData().subarray(4));
          if (!this.readyToDecode && this.pps && this.sps) {
            this.readyToDecode = true;
          }
        }
        push = true;
        break;
      case NALU.AUD:
        if (this.isHDAvailable) {
          this.isHDAvailable = false;
        }
        break;
      case NALU.SEI:
        break;
      default:
      }
      return push;
    }
}
