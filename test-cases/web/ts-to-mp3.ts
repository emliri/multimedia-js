import { MmjsTestCase } from '../mmjs-test-case';
import { TsToMp3Flow } from '../../src/flows/ts-to-mp3.flow';

export class TsToMp3 extends MmjsTestCase {

  private _flow: TsToMp3Flow = null;

  setup(done: () => void) {
    this._flow = new TsToMp3Flow('/test-data/mp3-segment.ts');

    //done();
  }

  run() {

  }
}
