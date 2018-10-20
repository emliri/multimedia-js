import 'should';

import { MP3Parser, MP3ParserResult } from './mp3-parser';

const fs = require('fs');
const path = require('path');

describe('MP3Parser', () => {
  const mp3TestData: Uint8Array[] = [];

  beforeAll((done) => {
    fs.readFile(path.resolve('./src/processors/mp3/fixtures/shalafon.mp3'), (err, data) => {
      if (err) {
        throw err;
      }

      mp3TestData.push(new Uint8Array(data.buffer));

      done();
    });
  });

  it('should probe the first mp3 test data without errors', () => {
    const res = MP3Parser.probe(mp3TestData[0]);

    res.should.be.false;
  });

  it('should parse the first mp3 test data without errors', () => {
    const res: MP3ParserResult = MP3Parser.parse(mp3TestData[0]);

    res.id3Samples.length.should.equal(0);
    res.mp3Frames.length.should.equal(215);
  });

  it('should parse the first mp3 test data without errors, using only-next option', () => {
    const res: MP3ParserResult = MP3Parser.parse(mp3TestData[0], 0, true);

    res.id3Samples.length.should.equal(0);
    res.mp3Frames.length.should.equal(1);

    // console.log(res.offset)
    // console.log(res.mp3Frames[0])
  });
});
