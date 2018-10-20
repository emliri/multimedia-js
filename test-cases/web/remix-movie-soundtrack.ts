import { MmjsTestCase } from '../mmjs-test-case';
import { MovToFmp4Flow } from '../../src/flows/mov-to-fmp4.flow';

export class RemixMovieSoundtrack extends MmjsTestCase {

  private _flow: MovToFmp4Flow = null;

  setup(done: () => void) {
    this._flow = new MovToFmp4Flow('/test-data/mp4/v-0576p-1400k-libx264.mov');

    //done();
  }

  run() {

  }
}
