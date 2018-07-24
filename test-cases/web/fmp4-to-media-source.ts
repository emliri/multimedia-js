import * as Multimedia from '../../index';
import { TestCase } from '../test-case';
import { Tubing, TubingState } from '../../src/core/tubing';

export class Fmp4ToMediaSource extends TestCase {

  private _fmp4ToMediaSource: Tubing;
  private _videoEl: HTMLVideoElement;
  private _mediaSource: MediaSource;

  constructor(domMountPoint: HTMLElement) {
    super(domMountPoint);
  }

  setup() {
    this._videoEl = document.createElement('video');

    this._videoEl.addEventListener('error', () => {
      console.error(this._videoEl.error);
    })

    this.domMountPoint.appendChild(this._videoEl);

    this._mediaSource = new MediaSource();

    console.log('MediaSource created');

    this._videoEl.src = URL.createObjectURL(this._mediaSource);

    this._mediaSource.addEventListener('sourceopen', () => {
      if (this._fmp4ToMediaSource) {
        return;
      }

      console.log('MediaSource opened');

      this._fmp4ToMediaSource
        = new Multimedia.Tubings.HttpToMediaSourceTubing(
        '/test-data/mp4/v-0576p-1400k-libx264.mp4', this._mediaSource);

    });
  }

  run() {
    this._fmp4ToMediaSource.state = TubingState.WAITING;
    this._fmp4ToMediaSource.state = TubingState.FLOWING;
  }
}
