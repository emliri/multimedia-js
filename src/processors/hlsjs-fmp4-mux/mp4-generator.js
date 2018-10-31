/**
 * Generate MP4 Box
*/

const UINT32_MAX = Math.pow(2, 32) - 1;

export class MP4Generator {

  //static types: {[boxType: string]: any}

  static init () {
    MP4Generator.types = {
      avc1: [], // codingname
      avcC: [],
      btrt: [],
      dinf: [],
      dref: [],
      esds: [],
      ftyp: [],
      hdlr: [],
      mdat: [],
      mdhd: [],
      mdia: [],
      mfhd: [],
      minf: [],
      moof: [],
      moov: [],
      mp4a: [],
      '.mp3': [],
      mvex: [],
      mvhd: [],
      pasp: [],
      sdtp: [],
      stbl: [],
      stco: [],
      stsc: [],
      stsd: [],
      stsz: [],
      stts: [],
      tfdt: [],
      tfhd: [],
      traf: [],
      trak: [],
      trun: [],
      trex: [],
      tkhd: [],
      vmhd: [],
      smhd: []
    };

    let i;
    for (i in MP4Generator.types) {
      if (MP4Generator.types.hasOwnProperty(i)) {
        MP4Generator.types[i] = [
          i.charCodeAt(0),
          i.charCodeAt(1),
          i.charCodeAt(2),
          i.charCodeAt(3)
        ];
      }
    }

    let videoHdlr = new Uint8Array([
      0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x56, 0x69, 0x64, 0x65,
      0x6f, 0x48, 0x61, 0x6e,
      0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
    ]);

    let audioHdlr = new Uint8Array([
      0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x53, 0x6f, 0x75, 0x6e,
      0x64, 0x48, 0x61, 0x6e,
      0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
    ]);

    MP4Generator.HDLR_TYPES = {
      'video': videoHdlr,
      'audio': audioHdlr
    };

    let dref = new Uint8Array([
      0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // entry_count
      0x00, 0x00, 0x00, 0x0c, // entry_size
      0x75, 0x72, 0x6c, 0x20, // 'url' type
      0x00, // version 0
      0x00, 0x00, 0x01 // entry_flags
    ]);

    let stco = new Uint8Array([
      0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00 // entry_count
    ]);

    MP4Generator.STTS = MP4Generator.STSC = MP4Generator.STCO = stco;

    MP4Generator.STSZ = new Uint8Array([
      0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // sample_size
      0x00, 0x00, 0x00, 0x00 // sample_count
    ]);
    MP4Generator.VMHD = new Uint8Array([
      0x00, // version
      0x00, 0x00, 0x01, // flags
      0x00, 0x00, // graphicsmode
      0x00, 0x00,
      0x00, 0x00,
      0x00, 0x00 // opcolor
    ]);
    MP4Generator.SMHD = new Uint8Array([
      0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, // balance
      0x00, 0x00 // reserved
    ]);

    MP4Generator.STSD = new Uint8Array([
      0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01]);// entry_count

    let majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
    let avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
    let minorVersion = new Uint8Array([0, 0, 0, 1]);

    MP4Generator.FTYP = MP4Generator.box(MP4Generator.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
    MP4Generator.DINF = MP4Generator.box(MP4Generator.types.dinf, MP4Generator.box(MP4Generator.types.dref, dref));
  }

  static box (type) {
    let
      payload = Array.prototype.slice.call(arguments, 1);

    let size = 8;

    let i = payload.length;

    let len = i;

    let result;
    // calculate the total size we need to allocate
    while (i--) {
      size += payload[i].byteLength;
    }

    result = new Uint8Array(size);
    result[0] = (size >> 24) & 0xff;
    result[1] = (size >> 16) & 0xff;
    result[2] = (size >> 8) & 0xff;
    result[3] = size & 0xff;
    result.set(type, 4);
    // copy the payload into the result
    for (i = 0, size = 8; i < len; i++) {
      // copy payload[i] array @ offset size
      result.set(payload[i], size);
      size += payload[i].byteLength;
    }
    return result;
  }

  static hdlr (type) {
    return MP4Generator.box(MP4Generator.types.hdlr, MP4Generator.HDLR_TYPES[type]);
  }

  static mdat (data) {
    return MP4Generator.box(MP4Generator.types.mdat, data);
  }

  static mdhd (timescale, duration) {
    duration *= timescale;
    const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
    const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
    return MP4Generator.box(MP4Generator.types.mdhd, new Uint8Array([
      0x01, // version 1
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // creation_time
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, // modification_time
      (timescale >> 24) & 0xFF,
      (timescale >> 16) & 0xFF,
      (timescale >> 8) & 0xFF,
      timescale & 0xFF, // timescale
      (upperWordDuration >> 24),
      (upperWordDuration >> 16) & 0xFF,
      (upperWordDuration >> 8) & 0xFF,
      upperWordDuration & 0xFF,
      (lowerWordDuration >> 24),
      (lowerWordDuration >> 16) & 0xFF,
      (lowerWordDuration >> 8) & 0xFF,
      lowerWordDuration & 0xFF,
      0x55, 0xc4, // 'und' language (undetermined)
      0x00, 0x00
    ]));
  }

  static mdia (track) {
    return MP4Generator.box(MP4Generator.types.mdia, MP4Generator.mdhd(track.timescale, track.duration), MP4Generator.hdlr(track.type), MP4Generator.minf(track));
  }

  static mfhd (sequenceNumber) {
    return MP4Generator.box(MP4Generator.types.mfhd, new Uint8Array([
      0x00,
      0x00, 0x00, 0x00, // flags
      (sequenceNumber >> 24),
      (sequenceNumber >> 16) & 0xFF,
      (sequenceNumber >> 8) & 0xFF,
      sequenceNumber & 0xFF // sequence_number
    ]));
  }

  static minf (track) {
    if (track.type === 'audio') {
      return MP4Generator.box(MP4Generator.types.minf, MP4Generator.box(MP4Generator.types.smhd, MP4Generator.SMHD), MP4Generator.DINF, MP4Generator.stbl(track));
    } else {
      return MP4Generator.box(MP4Generator.types.minf, MP4Generator.box(MP4Generator.types.vmhd, MP4Generator.VMHD), MP4Generator.DINF, MP4Generator.stbl(track));
    }
  }

  static moof (sn, baseMediaDecodeTime, track) {
    return MP4Generator.box(MP4Generator.types.moof, MP4Generator.mfhd(sn), MP4Generator.traf(track, baseMediaDecodeTime));
  }
  /**
  tracks... (optional) {array} the tracks associated with this movie
 */
  static moov (tracks) {
    let
      i = tracks.length;

    let boxes = [];

    while (i--) {
      boxes[i] = MP4Generator.trak(tracks[i]);
    }

    return MP4Generator.box.apply(null, [MP4Generator.types.moov, MP4Generator.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4Generator.mvex(tracks)));
  }

  static mvex (tracks) {
    let
      i = tracks.length;

    let boxes = [];

    while (i--) {
      boxes[i] = MP4Generator.trex(tracks[i]);
    }

    return MP4Generator.box.apply(null, [MP4Generator.types.mvex].concat(boxes));
  }

  static mvhd (timescale, duration) {
    duration *= timescale;
    const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
    const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
    let
      bytes = new Uint8Array([
        0x01, // version 1
        0x00, 0x00, 0x00, // flags
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // creation_time
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, // modification_time
        (timescale >> 24) & 0xFF,
        (timescale >> 16) & 0xFF,
        (timescale >> 8) & 0xFF,
        timescale & 0xFF, // timescale
        (upperWordDuration >> 24),
        (upperWordDuration >> 16) & 0xFF,
        (upperWordDuration >> 8) & 0xFF,
        upperWordDuration & 0xFF,
        (lowerWordDuration >> 24),
        (lowerWordDuration >> 16) & 0xFF,
        (lowerWordDuration >> 8) & 0xFF,
        lowerWordDuration & 0xFF,
        0x00, 0x01, 0x00, 0x00, // 1.0 rate
        0x01, 0x00, // 1.0 volume
        0x00, 0x00, // reserved
        0x00, 0x00, 0x00, 0x00, // reserved
        0x00, 0x00, 0x00, 0x00, // reserved
        0x00, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, // pre_defined
        0xff, 0xff, 0xff, 0xff // next_track_ID
      ]);
    return MP4Generator.box(MP4Generator.types.mvhd, bytes);
  }

  static sdtp (track) {
    let
      samples = track.samples || [];

    let bytes = new Uint8Array(4 + samples.length);

    let flags;

    let i;
    // leave the full box header (4 bytes) all zero
    // write the sample table
    for (i = 0; i < samples.length; i++) {
      flags = samples[i].flags;
      bytes[i + 4] = (flags.dependsOn << 4) |
        (flags.isDependedOn << 2) |
        (flags.hasRedundancy);
    }

    return MP4Generator.box(MP4Generator.types.sdtp, bytes);
  }

  static stbl (track) {
    return MP4Generator.box(MP4Generator.types.stbl, MP4Generator.stsd(track), MP4Generator.box(MP4Generator.types.stts, MP4Generator.STTS), MP4Generator.box(MP4Generator.types.stsc, MP4Generator.STSC), MP4Generator.box(MP4Generator.types.stsz, MP4Generator.STSZ), MP4Generator.box(MP4Generator.types.stco, MP4Generator.STCO));
  }

  static avc1 (track) {
    let sps = []; let pps = []; let i; let data; let len;
    // assemble the SPSs

    for (i = 0; i < track.sps.length; i++) {
      data = track.sps[i];
      len = data.byteLength;
      sps.push((len >>> 8) & 0xFF);
      sps.push((len & 0xFF));

      // SPS
      sps = sps.concat(Array.prototype.slice.call(data));
    }

    // assemble the PPSs
    for (i = 0; i < track.pps.length; i++) {
      data = track.pps[i];
      len = data.byteLength;
      pps.push((len >>> 8) & 0xFF);
      pps.push((len & 0xFF));

      pps = pps.concat(Array.prototype.slice.call(data));
    }

    let avcc = MP4Generator.box(MP4Generator.types.avcC, new Uint8Array([
      0x01, // version
      sps[3], // profile
      sps[4], // profile compat
      sps[5], // level
      0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
      0xE0 | track.sps.length // 3bit reserved (111) + numOfSequenceParameterSets
    ].concat(sps).concat([
      track.pps.length // numOfPictureParameterSets
    ]).concat(pps)));
    // "PPS"

    let width = track.width;

    let height = track.height;

    let hSpacing = track.pixelRatio[0];

    let vSpacing = track.pixelRatio[1];

    return MP4Generator.box(MP4Generator.types.avc1, new Uint8Array([
      0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, // pre_defined
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, // pre_defined
      (width >> 8) & 0xFF,
      width & 0xff, // width
      (height >> 8) & 0xFF,
      height & 0xff, // height
      0x00, 0x48, 0x00, 0x00, // horizresolution
      0x00, 0x48, 0x00, 0x00, // vertresolution
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // frame_count
      0x12,
      0x64, 0x61, 0x69, 0x6C, // dailymotion/hls.js
      0x79, 0x6D, 0x6F, 0x74,
      0x69, 0x6F, 0x6E, 0x2F,
      0x68, 0x6C, 0x73, 0x2E,
      0x6A, 0x73, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, // compressorname
      0x00, 0x18, // depth = 24
      0x11, 0x11]), // pre_defined = -1
    avcc,
    MP4Generator.box(MP4Generator.types.btrt, new Uint8Array([
      0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
      0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
      0x00, 0x2d, 0xc6, 0xc0])), // avgBitrate
    MP4Generator.box(MP4Generator.types.pasp, new Uint8Array([
      (hSpacing >> 24), // hSpacing
      (hSpacing >> 16) & 0xFF,
      (hSpacing >> 8) & 0xFF,
      hSpacing & 0xFF,
      (vSpacing >> 24), // vSpacing
      (vSpacing >> 16) & 0xFF,
      (vSpacing >> 8) & 0xFF,
      vSpacing & 0xFF]))
    );
  }

  static esds (track) {
    let configlen = track.config.length;
    return new Uint8Array([
      0x00, // version 0
      0x00, 0x00, 0x00, // flags

      0x03, // descriptor_type
      0x17 + configlen, // length
      0x00, 0x01, // es_id
      0x00, // stream_priority

      0x04, // descriptor_type
      0x0f + configlen, // length
      0x40, // codec : mpeg4_audio
      0x15, // stream_type
      0x00, 0x00, 0x00, // buffer_size
      0x00, 0x00, 0x00, 0x00, // maxBitrate
      0x00, 0x00, 0x00, 0x00, // avgBitrate

      0x05 // descriptor_type
    ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
  }

  static mp4a (track) {
    let samplerate = track.samplerate;
    return MP4Generator.box(MP4Generator.types.mp4a, new Uint8Array([
      0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, track.channelCount, // channelcount
      0x00, 0x10, // sampleSize:16bits
      0x00, 0x00, 0x00, 0x00, // reserved2
      (samplerate >> 8) & 0xFF,
      samplerate & 0xff, //
      0x00, 0x00]),
    MP4Generator.box(MP4Generator.types.esds, MP4Generator.esds(track)));
  }

  static mp3 (track) {
    let samplerate = track.samplerate;
    return MP4Generator.box(MP4Generator.types['.mp3'], new Uint8Array([
      0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, track.channelCount, // channelcount
      0x00, 0x10, // sampleSize:16bits
      0x00, 0x00, 0x00, 0x00, // reserved2
      (samplerate >> 8) & 0xFF,
      samplerate & 0xff, //
      0x00, 0x00]));
  }

  static stsd (track) {
    if (track.type === 'audio') {
      if (!track.isAAC && track.codec === 'mp3') {
        return MP4Generator.box(MP4Generator.types.stsd, MP4Generator.STSD, MP4Generator.mp3(track));
      }

      return MP4Generator.box(MP4Generator.types.stsd, MP4Generator.STSD, MP4Generator.mp4a(track));
    } else {
      return MP4Generator.box(MP4Generator.types.stsd, MP4Generator.STSD, MP4Generator.avc1(track));
    }
  }

  static tkhd (track) {
    let id = track.id;

    let duration = track.duration * track.timescale;

    let width = track.width;

    let height = track.height;

    let upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));

    let lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
    return MP4Generator.box(MP4Generator.types.tkhd, new Uint8Array([
      0x01, // version 1
      0x00, 0x00, 0x07, // flags
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // creation_time
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, // modification_time
      (id >> 24) & 0xFF,
      (id >> 16) & 0xFF,
      (id >> 8) & 0xFF,
      id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x00, // reserved
      (upperWordDuration >> 24),
      (upperWordDuration >> 16) & 0xFF,
      (upperWordDuration >> 8) & 0xFF,
      upperWordDuration & 0xFF,
      (lowerWordDuration >> 24),
      (lowerWordDuration >> 16) & 0xFF,
      (lowerWordDuration >> 8) & 0xFF,
      lowerWordDuration & 0xFF,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, // layer
      0x00, 0x00, // alternate_group
      0x00, 0x00, // non-audio track volume
      0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      (width >> 8) & 0xFF,
      width & 0xFF,
      0x00, 0x00, // width
      (height >> 8) & 0xFF,
      height & 0xFF,
      0x00, 0x00 // height
    ]));
  }

  static traf (track, baseMediaDecodeTime) {
    let sampleDependencyTable = MP4Generator.sdtp(track);

    let id = track.id;

    let upperWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1));

    let lowerWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
    return MP4Generator.box(MP4Generator.types.traf,
      MP4Generator.box(MP4Generator.types.tfhd, new Uint8Array([
        0x00, // version 0
        0x00, 0x00, 0x00, // flags
        (id >> 24),
        (id >> 16) & 0XFF,
        (id >> 8) & 0XFF,
        (id & 0xFF) // track_ID
      ])),
      MP4Generator.box(MP4Generator.types.tfdt, new Uint8Array([
        0x01, // version 1
        0x00, 0x00, 0x00, // flags
        (upperWordBaseMediaDecodeTime >> 24),
        (upperWordBaseMediaDecodeTime >> 16) & 0XFF,
        (upperWordBaseMediaDecodeTime >> 8) & 0XFF,
        (upperWordBaseMediaDecodeTime & 0xFF),
        (lowerWordBaseMediaDecodeTime >> 24),
        (lowerWordBaseMediaDecodeTime >> 16) & 0XFF,
        (lowerWordBaseMediaDecodeTime >> 8) & 0XFF,
        (lowerWordBaseMediaDecodeTime & 0xFF)
      ])),
      MP4Generator.trun(track,
        sampleDependencyTable.length +
                    16 + // tfhd
                    20 + // tfdt
                    8 + // traf header
                    16 + // mfhd
                    8 + // moof header
                    8), // mdat header
      sampleDependencyTable);
  }

  /**
   * Generate a track box.
  track {object} a track definition
  {Uint8Array} the track box
   */
  static trak (track) {
    track.duration = track.duration || 0xffffffff;
    return MP4Generator.box(MP4Generator.types.trak, MP4Generator.tkhd(track), MP4Generator.mdia(track));
  }

  static trex (track) {
    let id = track.id;
    return MP4Generator.box(MP4Generator.types.trex, new Uint8Array([
      0x00, // version 0
      0x00, 0x00, 0x00, // flags
      (id >> 24),
      (id >> 16) & 0XFF,
      (id >> 8) & 0XFF,
      (id & 0xFF), // track_ID
      0x00, 0x00, 0x00, 0x01, // default_sample_description_index
      0x00, 0x00, 0x00, 0x00, // default_sample_duration
      0x00, 0x00, 0x00, 0x00, // default_sample_size
      0x00, 0x01, 0x00, 0x01 // default_sample_flags
    ]));
  }

  static trun (track, offset) {
    let samples = track.samples || [];

    let len = samples.length;

    let arraylen = 12 + (16 * len);

    let array = new Uint8Array(arraylen);

    let i; let sample; let duration; let size; let flags; let cts;
    offset += 8 + arraylen;
    array.set([
      0x00, // version 0
      0x00, 0x0f, 0x01, // flags
      (len >>> 24) & 0xFF,
      (len >>> 16) & 0xFF,
      (len >>> 8) & 0xFF,
      len & 0xFF, // sample_count
      (offset >>> 24) & 0xFF,
      (offset >>> 16) & 0xFF,
      (offset >>> 8) & 0xFF,
      offset & 0xFF // data_offset
    ], 0);
    for (i = 0; i < len; i++) {
      sample = samples[i];
      duration = sample.duration;
      size = sample.size;
      flags = sample.flags;
      cts = sample.cts;
      array.set([
        (duration >>> 24) & 0xFF,
        (duration >>> 16) & 0xFF,
        (duration >>> 8) & 0xFF,
        duration & 0xFF, // sample_duration
        (size >>> 24) & 0xFF,
        (size >>> 16) & 0xFF,
        (size >>> 8) & 0xFF,
        size & 0xFF, // sample_size
        (flags.isLeading << 2) | flags.dependsOn,
        (flags.isDependedOn << 6) |
          (flags.hasRedundancy << 4) |
          (flags.paddingValue << 1) |
          flags.isNonSync,
        flags.degradPrio & 0xF0 << 8,
        flags.degradPrio & 0x0F, // sample_flags
        (cts >>> 24) & 0xFF,
        (cts >>> 16) & 0xFF,
        (cts >>> 8) & 0xFF,
        cts & 0xFF // sample_composition_time_offset
      ], 12 + 16 * i);
    }
    return MP4Generator.box(MP4Generator.types.trun, array);
  }

  static initSegment (tracks) {
    if (!MP4Generator.types) {
      MP4Generator.init();
    }

    let movie = MP4Generator.moov(tracks); let result;
    result = new Uint8Array(MP4Generator.FTYP.byteLength + movie.byteLength);
    result.set(MP4Generator.FTYP);
    result.set(movie, MP4Generator.FTYP.byteLength);
    return result;
  }
}
