import * as Multimedia from '../../index';
import { TestCase } from '../test-case';
import { Tubing, TubingState } from '../../src/core/tubing';

export class Fmp4ToMediaSource extends TestCase {

  private _fmp4ToMediaSource: Tubing;

  constructor(domMountPoint: HTMLElement) {
    super(domMountPoint);
  }

  setup() {
    this._fmp4ToMediaSource = new Multimedia.Tubings.HttpToMediaSourceTubing('/test-data/mp4/v-0576p-1400k-libx264.mp4');
  }

  run() {
    this._fmp4ToMediaSource.state = TubingState.WAITING;
    this._fmp4ToMediaSource.state = TubingState.FLOWING;
  }
}
