/**
 * MP3 demuxer
 */
import {ID3Parser} from './id3-parser';
import {MPEGAudioParser} from './mpeg-audio-parser';

export class MP3Parser {

  static probe(data) {
    // check if data contains ID3 timestamp and MPEG sync word
    var offset, length;
    let id3Data = ID3Parser.getID3Data(data, 0);
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

  // feed incoming data to the front of the parsing pipeline
  static append(data, timeOffset, contiguous, accurateTimeOffset) {

    let id3Data = ID3Parser.getID3Data(data, 0);
    let pts = 90 * ID3Parser.getTimeStamp(id3Data);
    var offset = id3Data.length;
    var length = data.length;
    var frameIndex = 0,
        stamp = 0;

    let id3Samples = [{ pts: pts, dts: pts, data: id3Data }];

    while (offset < length) {
      if (MPEGAudioParser.isHeader(data, offset)) {

        var frame = MPEGAudioParser.parseFrame(data, offset);

        if (frame) {
          offset += frame.data.length;
          //stamp = frame.
          frameIndex++;
        } else {
          break;
        }

      } else if (ID3Parser.isHeader(data, offset)) {
        id3Data = ID3Parser.getID3Data(data, offset);
        id3Samples.push({ pts: stamp, dts: stamp, data: id3Data });
        offset += id3Data.length;
      } else {
        //nothing found, keep looking
        offset++;
      }
    }


  }
}

