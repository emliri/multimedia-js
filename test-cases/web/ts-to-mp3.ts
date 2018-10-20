import { MmjsTestCase } from '../mmjs-test-case';
import { TsToMp3Flow } from '../../src/flows/ts-to-mp3.flow';

export class RemixMovieSoundtrack extends MmjsTestCase {

  private _flow: TsToMp3Flow = null;

  setup(done: () => void) {
    this._flow = new TsToMp3Flow('/test-data/mp4/v-0576p-1400k-libx264.mov');

    //done();
  }

  run() {

  }
}
