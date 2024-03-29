import 'should';

import { MP4DemuxProcessor } from './mp4-demux.processor';

import { AvcPayloaderProc } from './avc-network-abstraction.proc';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { OutputSocket } from '../core/socket';

const fs = require('fs');
const path = require('path');

describe('AVCNetworkAbstractionProcessor', () => {
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

  it('should parse single NALUs and output them', (done) => {
    const h264parse = new AvcPayloaderProc();

    const onMp4DemuxCreateOutput = (out: OutputSocket) => {
      out.connect(h264parse.in[0]);
    };

    const mp4Demux = new MP4DemuxProcessor();

    const p: Packet = Packet.fromArrayBuffer(testData[0]);

    mp4Demux.in[0].transfer(p);

    done();
  });
});
