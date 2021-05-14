/**
 * MP3 demuxer
 */
import { ID3Parser } from './id3-parser';
import { MPEGAudioParser, MPEGAudioFrame } from './mpeg-audio-parser';

export const ID3_TIMESCALE = 90;

export type ID3Sample = {
  pts: number,
  dts: number,
  data: Uint8Array
};

export type MP3ParserResult = {
  endOffset: number,
  mp3Frames: MPEGAudioFrame[]
  id3Samples: ID3Sample[]
};

export class MP3Parser {
  static probe (data) {
    // check if data contains ID3 timestamp and MPEG sync word
    let offset; let length;
    const id3Data = ID3Parser.getID3Data(data, 0);
    if (id3Data && ID3Parser.getTimeStamp(id3Data) !== undefined) {
      // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
      // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
      // More info http://www.mp3-tech.org/programmer/frame_header.html
      for (offset = id3Data.length, length = Math.min(data.length - 1, offset + 100); offset < length; offset++) {
        if (MPEGAudioParser.probe(data, offset)) {
          return true;
        }
      }
    }
    return false;
  }

  static parse (data: Uint8Array, offset: number = 0, onlyNext: boolean = false): MP3ParserResult {
    const mp3Frames: MPEGAudioFrame[] = [];
    const id3Samples: ID3Sample[] = [];
    const length = data.length;

    let pts;
    let id3Data;

    while (offset < length) {
      if (MPEGAudioParser.isHeader(data, offset)) {
        const frame = MPEGAudioParser.parseFrame(data, offset);
        if (frame) {
          mp3Frames.push(frame);

          offset += frame.data.length;

          if (onlyNext) {
            return {
              endOffset: offset,
              mp3Frames,
              id3Samples
            };
          }
        } else {
          break;
        }
      } else if (ID3Parser.isHeader(data, offset)) {
        id3Data = ID3Parser.getID3Data(data, offset);
        pts = ID3_TIMESCALE * ID3Parser.getTimeStamp(id3Data);
        id3Samples.push({ pts: pts, dts: pts, data: id3Data });

        offset += id3Data.length;

        if (onlyNext) {
          return {
            endOffset: offset,
            mp3Frames,
            id3Samples
          };
        }
      } else {
        // nothing found, keep looking
        offset++;
      }
    }

    return {
      endOffset: offset,
      mp3Frames,
      id3Samples
    };
  }
}
