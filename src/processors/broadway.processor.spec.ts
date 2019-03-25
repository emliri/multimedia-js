import 'should';

import { MP4DemuxProcessor } from './mp4-demux.processor';

import { H264ParseProcessor } from './h264-parse.processor';

import { BroadwayProcessor } from './broadway.processor';

import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { OutputSocket } from '../core/socket';

const fs = require('fs');
const path = require('path');

describe('BroadwayProcessor', () => {
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

  it('should decode NALUs and render them to ghost canvas', (done) => {
    const broadway = new BroadwayProcessor();

    const h264parse = new H264ParseProcessor();

    const onMp4DemuxCreateOutput = (out: OutputSocket) => {
      // out.connect(h264parse.in[0]);
    };

    const mp4Demux = new MP4DemuxProcessor(onMp4DemuxCreateOutput);

    const p: Packet = Packet.fromArrayBuffer(testData[0]);

    mp4Demux.in[0].transfer(p);

    done();
  });
});
