import 'should';

import { IsoboxerMP4DemuxProcessor } from './isoboxer-mp4-demux.processor';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';

const fs = require('fs');
const path = require('path');

describe('IsoboxerMP4DemuxProcessor', () => {
  const testData: ArrayBuffer[] = [];
  const files = [
    './src/processors/mp4/fixtures/KickOutTheJams.mp4',
    './src/processors/mp4/fixtures/v-0576p-1400k-libx264.mp4'
  ];

  beforeAll((done) => {
    files.forEach((file) => {
      fs.readFile(path.resolve(file), (err, data) => {
        if (err) {
          throw err;
        }
        testData.push(data.buffer);
        if (testData.length === files.length) {
          done();
        }
      });
    });
  });

  it('should create an output for each track in the input file', (done) => {
    const mp4Demux = new IsoboxerMP4DemuxProcessor();

    const p: Packet = Packet.fromArrayBuffer(testData[0]);

    mp4Demux.in[0].transfer(p);

    done();
  });
});
