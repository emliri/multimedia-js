import 'should';

import { LambdaProcessor } from './lambda.processor';
import { SocketDescriptor } from '../core/socket';
import { Packet } from '../core/packet';

describe('LambdaProcessor', () => {
  it('should pass transfered packets to the lambda function', (done) => {
    const inputPacket: Packet = Packet.fromArrayBuffer((new Uint8Array(1).buffer));

    const lambdaProc = new LambdaProcessor((s, p) => {
      p.should.be.deepEqual(inputPacket);
      done();
      return true;
    });

    lambdaProc.createInput().transfer(inputPacket);

    // lambdaProc.inputs
  });
});
