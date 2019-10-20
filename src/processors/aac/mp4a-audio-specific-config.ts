/**
 *
 * @param track
 * @returns payload data of MP4 `esds` atom
 */
export function makeMp4aEsdsAtomData (audioConfigDescriptorData: Uint8Array): ArrayBuffer {
  let configByteLength = audioConfigDescriptorData.length;
  const data = new Uint8Array([
    0x00, // version 0
    0x00, 0x00, 0x00, // flags

    0x03, // descriptor_type
    0x17 + configByteLength, // length
    0x00, 0x01, // es_id
    0x00, // stream_priority

    0x04, // descriptor_type
    0x0f + configByteLength, // length
    0x40, // codec : mpeg4_audio
    0x15, // stream_type
    0x00, 0x00, 0x00, // buffer_size
    0x00, 0x00, 0x00, 0x00, // maxBitrate
    0x00, 0x00, 0x00, 0x00, // avgBitrate

    0x05 // descriptor_type
  ]
  .concat([configByteLength])
  .concat(Array.from(audioConfigDescriptorData))
  .concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
  return data.buffer;
}
