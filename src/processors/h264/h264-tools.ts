import { BufferSlice } from "../../core/buffer";
import { BufferProperties } from "../../core/buffer-props";
import { copyArrayBuffer, copyTypedArraySlice, writeTypedArraySlice } from "../../common-utils";
import { getLogger, LoggerLevel } from "../../logger";

import { NALU } from "./nalu";
import { SPSParser } from "../../ext-mod/inspector.js/src/codecs/h264/sps-parser";
import { Sps } from "../../ext-mod/inspector.js/src/codecs/h264/nal-units";

const {log} = getLogger('H264Tools', LoggerLevel.ON, true);

export function debugNALU(bufferSlice: BufferSlice) {
  const nalu: NALU = new NALU(bufferSlice.getUint8Array());
  log('NALU details:', nalu);
}

export function debugAccessUnit(bufferSlice: BufferSlice, debugRbspData: boolean = false) {

  const avcStream = bufferSlice.getUint8Array();
  const avcView = bufferSlice.getDataView();

  let length;
  let count = 0;

  for (let i = 0; i < avcStream.byteLength; i += length) {
    length = avcView.getUint32(i);

    if (length > avcStream.length) {
      console.warn('no NALUs found in this data!');
      break;
    }

    i += 4;

    const naluSlice = bufferSlice.unwrap(i, length);
    const naluBytes = naluSlice.getUint8Array();
    const nalu = new NALU(naluBytes);

    count++;

    log('In access-unit, found NALU of length ' + length + ' bytes, #' + count + ':', nalu);

    if (debugRbspData) {

      switch(nalu.ntype) {
      case NALU.SPS:
        // we need to skip first byte of NALU data
        const sps: Sps = SPSParser.parseSPS(nalu.payload.subarray(1))

        log ('Parsed SPS:', sps);
        break;
      case NALU.PPS:
        break;
      }

    }

  }

}

/**
 *
 * @param rbspBodyData
 * @param naluType From 0 to 31
 * @param nalRefIdc From 0 to 3
 */
export function makeNALUFromH264RbspData(
  rbspBodyData: BufferSlice,
  naluType: number,
  nalRefIdc: number,
  extensionHeaderData: ArrayBuffer = null): BufferSlice {

  let hasExtensionHeader = false;

  if(naluType ===  14 || naluType ===  20) {
    if (!extensionHeaderData) {
      throw new Error('Need extension header data');
    }
    hasExtensionHeader = true;
  }

  const naluHeader = new ArrayBuffer(hasExtensionHeader ? 4 : 1);
  const naluHeaderView = new DataView(naluHeader);

  if (naluType >= 32) {
    throw new Error('Invalid NALU type value: ' + naluType)
  }

  if (nalRefIdc >= 4) {
    throw new Error('Invalued NAL_ref_IDC value: ' + nalRefIdc)
  }

  if (extensionHeaderData && extensionHeaderData.byteLength !== 3) {
    throw new Error('Invalid extension header data size');
  }

  naluHeaderView.setUint8(0, (nalRefIdc << 5) + naluType);

  if(hasExtensionHeader) {
    copyArrayBuffer(extensionHeaderData, naluHeader, extensionHeaderData.byteLength, 0, 1)
  }

  const naluData = rbspBodyData.prepend(new BufferSlice(naluHeader), new BufferProperties('video/avc'));

  return naluData;
}

/**
 *
 * @param naluData list of NAL units in access unit
 */
export function makeAnnexBAccessUnitFromNALUs(naluData: BufferSlice[]): BufferSlice {
  const totalSizeOfNalus = BufferSlice.getTotalSize(naluData);
  const accessUnitData: BufferSlice = BufferSlice.allocateNew(4 * naluData.length + totalSizeOfNalus);
  const auDataView: DataView = accessUnitData.getDataView()

  let offset = 0;
  naluData.forEach((naluBuffer) => {
    auDataView.setUint32(offset, naluBuffer.length);
    offset += 4;
    naluBuffer.write(accessUnitData.arrayBuffer, offset);
    offset += naluBuffer.length;
  })

  return accessUnitData;
}

