export enum H264SliceType {
  P = 0,
  B,
  I,
  SP,
  SI
}

/**
0 	Unspecified 		non-VCL 	non-VCL 	non-VCL
1 	Coded slice of a non-IDR picture
slice_layer_without_partitioning_rbsp( ) 	2, 3, 4 	VCL 	VCL 	VCL
2 	Coded slice data partition A
slice_data_partition_a_layer_rbsp( ) 	2 	VCL 	not applicable 	not applicable
3 	Coded slice data partition B
slice_data_partition_b_layer_rbsp( ) 	3 	VCL 	not applicable 	not applicable
4 	Coded slice data partition C
slice_data_partition_c_layer_rbsp( ) 	4 	VCL 	not applicable 	not applicable
5 	Coded slice of an IDR picture
slice_layer_without_partitioning_rbsp( ) 	2, 3 	VCL 	VCL 	VCL
6 	Supplemental enhancement information (SEI)
sei_rbsp( ) 	5 	non-VCL 	non-VCL 	non-VCL
7 	Sequence parameter set
seq_parameter_set_rbsp( ) 	0 	non-VCL 	non-VCL 	non-VCL
8 	Picture parameter set
pic_parameter_set_rbsp( ) 	1 	non-VCL 	non-VCL 	non-VCL
9 	Access unit delimiter
access_unit_delimiter_rbsp( ) 	6 	non-VCL 	non-VCL 	non-VCL
10 	End of sequence
end_of_seq_rbsp( ) 	7 	non-VCL 	non-VCL 	non-VCL
11 	End of stream
end_of_stream_rbsp( ) 	8 	non-VCL 	non-VCL 	non-VCL
12 	Filler data
filler_data_rbsp( ) 	9 	non-VCL 	non-VCL 	non-VCL
13 	Sequence parameter set extension
seq_parameter_set_extension_rbsp( ) 	10 	non-VCL 	non-VCL 	non-VCL
14 	Prefix NAL unit
prefix_nal_unit_rbsp( ) 	2 	non-VCL 	suffix dependent 	suffix dependent
15 	Subset sequence parameter set
subset_seq_parameter_set_rbsp( ) 	0 	non-VCL 	non-VCL 	non-VCL
16 – 18 	Reserved 		non-VCL 	non-VCL 	non-VCL
19 	Coded slice of an auxiliary coded picture without partitioning
slice_layer_without_partitioning_rbsp( ) 	2, 3, 4 	non-VCL 	non-VCL 	non-VCL
20 	Coded slice extension
slice_layer_extension_rbsp( ) 	2, 3, 4 	non-VCL 	VCL 	VCL
21 	Coded slice extension for depth view components
slice_layer_extension_rbsp( )
(specified in Annex I) 	2, 3, 4 	non-VCL 	non-VCL 	VCL
22 – 23 	Reserved 		non-VCL 	non-VCL 	VCL
24 – 31 	Unspecified 		non-VCL 	non-VCL 	non-VCL

 */

export enum H264NaluType {
  UNS = 0,
  NOI = 1,
  SDA = 2,
  SDB = 3,
  SDC = 4,
  // TODO: add types 2 to 4
  IDR = 5,
  SEI = 6,
  SPS = 7,
  PPS = 8,
  AUD = 9,
  SEE = 10,
  STE = 11,
  FIL = 12
}

export function getH264NaluTypeTag (nalType: H264NaluType): string {
  return H264NaluType[nalType].toLowerCase();
}

export class NALU {
  // TODO: make enum

  // TODO: remove below

  static get NON_IDR () {
    return H264NaluType.NOI;
  }

  static get IDR () {
    return H264NaluType.IDR;
  }

  static get SEI () {
    return H264NaluType.SEI;
  }

  static get SPS () {
    return H264NaluType.SPS;
  }

  static get PPS () {
    return H264NaluType.PPS;
  }

  static get AU_DELIM () {
    return H264NaluType.AUD;
  }

  static get SEQ_END () {
    return H264NaluType.SEE;
  }

  static get STREAM_END () {
    return H264NaluType.STE;
  }

  static getNALUnitTypeName (nalType: number): string {
    switch (nalType) {
    case NALU.NON_IDR:
      return 'NON_IDR_SLICE';
    case NALU.SEI:
      return 'SEI';
    case NALU.PPS:
      return 'PPS';
    case NALU.SPS:
      return 'SPS';
    case NALU.AU_DELIM:
      return 'AUD';
    case NALU.IDR:
      return 'IDR';
    case NALU.SEQ_END:
      return 'END SEQUENCE';
    case NALU.STREAM_END:
      return 'END STREAM';
    default:
      return `${nalType} (unknown NAL type)`;
      // throw new Error('Unknown NALU type: ' + nalType);
    }
  }

  payload: Uint8Array;
  refIdc: number;
  nalType: number;

  constructor (data: Uint8Array) {
    if (data.byteLength < 2) {
      throw new Error('Data is to little bytes to be a NALU (needs at least 2 or more)');
    }
    this.payload = data;
    this.refIdc = (this.payload[0] & 0x60) >> 5;
    this.nalType = this.payload[0] & 0x1f;
  }

  getTypeName (): string {
    return NALU.getNALUnitTypeName(this.nalType);
  }
}
