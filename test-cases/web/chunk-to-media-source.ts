import * as Multimedia from '../../index';
import { TestCase } from '../test-case';
import { Flow, FlowState } from '../../src/core/flow';
import { getLogger } from '../../src/logger';

const URLs = [
  "/test-data/193039199_mp4_h264_aac_hd_7.ts",
  '/test-data/mp4/v-0576p-1400k-libx264.mp4'
]

const {log} = getLogger('ChunkToMediaSource');

export class ChunkToMediaSource extends TestCase {

  private _fmp4ToMediaSource: Flow;
  private _videoEl: HTMLVideoElement;
  private _mediaSource: MediaSource;

  constructor(domMountPoint: HTMLElement) {
    super(domMountPoint);
  }

  setup() {
    this._videoEl = document.createElement('video');

    this._videoEl.controls = true;

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
        = new Multimedia.Flows.HttpToMediaSourceFlow(
        URLs[1],
        this._mediaSource
      );

    });
  }

  run() {
    this._fmp4ToMediaSource.state = FlowState.WAITING;
    this._fmp4ToMediaSource.state = FlowState.FLOWING;
  }
}
