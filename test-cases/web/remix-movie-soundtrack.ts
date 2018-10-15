import * as Multimedia from '../../index';
import { MmjsTestCase } from '../mmjs-test-case';
import { Flow, FlowState } from '../../src/core/flow';
import { getLogger } from '../../src/logger';
import { MovToFmp4Flow } from '../../src/flows/mov-to-fmp4.flow';

export class RemixMovieSoundtrack extends MmjsTestCase {

  private _flow: MovToFmp4Flow = null;

  setup(done: () => void) {
    this._flow = new MovToFmp4Flow('/test-data/mp4/ToS-4k-1920.mov');


  }

  run() {

  }
}
