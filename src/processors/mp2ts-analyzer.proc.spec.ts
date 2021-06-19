import * as path from 'path';

import { describeSpecTopLevel } from "../utils-spec";
import { readFile } from '../utils-fs';

import { Mp2TsAnalyzerProc } from './mp2ts-analyzer.proc';
import { Packet } from "../..";
import { SocketTapPacketCapture } from "../core/socket-tap";

describeSpecTopLevel(__filename, () => {

  it('should output a model packet for each PES complete A/V sample/frame', async (done) => {

    const tsData = await readFile(path.resolve(__dirname,
      '../../test-data/smptebars-beeps-mainhd30fps-15-secs.ts'));

    const proc = new Mp2TsAnalyzerProc();

    const pktCapTap = proc.out[0].setAndGetTap(new SocketTapPacketCapture());

    proc.in[0].transferSync(Packet.fromArrayBuffer(tsData.buffer));

    console.log(pktCapTap.dataList);
    done();
  });

})
