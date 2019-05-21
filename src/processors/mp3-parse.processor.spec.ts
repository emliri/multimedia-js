import 'should';

import { Packet } from '../core/packet';

import { MP3ParseProcessor } from './mp3-parse.processor';

import { LambdaProcessor } from './lambda.processor';

const fs = require('fs');
const path = require('path');

describe('MP3ParseProcessor', () => {
  const mp3TestData: Uint8Array[] = [];

  let proc: MP3ParseProcessor;

  beforeAll((done) => {
    proc = new MP3ParseProcessor();

    fs.readFile(path.resolve('./src/processors/mp3/fixtures/shalafon.mp3'), (err, data) => {
      if (err) {
        throw err;
      }
      mp3TestData.push(new Uint8Array(data.buffer));
      done();
    });
  });

  xit('should process an mp3 file as one input packet and output one packet per frame', (done) => {
    const outputPackets = [];

    const termination: LambdaProcessor = new LambdaProcessor((s, p) => {
      outputPackets.push(p);
      return void 0;
    });
    termination.createInput();

    proc.out[0].connect(termination.in[0]);

    const inputPacket = Packet.fromArrayBuffer(mp3TestData[0].buffer);

    proc.in[0].transfer(inputPacket);

    outputPackets.length.should.be.equal(215);

    done();
  });
});
