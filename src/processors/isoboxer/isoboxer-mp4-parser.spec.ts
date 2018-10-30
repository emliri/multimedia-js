import 'should';

import { IB_MP4Parser } from './isoboxer-mp4-parser';

import { ISOFile } from './isoboxer-types';

const fs = require('fs');
const path = require('path');

describe('MP4Parser', () => {
  const mp4TestData = [];

  beforeAll((done) => {
    fs.readFile(path.resolve('./src/processors/mp4/fixtures/v-0576p-1400k-libx264.mp4'), (err, data) => {
      if (err) {
        throw err;
      }

      mp4TestData.push(new Uint8Array(data.buffer));

      done();
    });
  });

  it('should parse an MP4 file without errors', () => {
    const res: ISOFile = IB_MP4Parser.parse(mp4TestData[0]);
    // console.log(res)
    // TODO: perform validation
  });
});
