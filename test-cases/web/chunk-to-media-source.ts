
import { MmjsTestCase } from '../mmjs-test-case';
import { Flow, FlowState, FlowCompletionResult } from '../../src/core/flow';
import { getLogger } from '../../src/logger';
import { ChunkToMediaSourceFlow } from '../../src/flows';

const URLs = [
  '/test-data/3303963094001_5147667971001_5147609827001-1.ts',
  '/test-data/193039199_mp4_h264_aac_hd_7.ts',
  '/test-data/mp4/v-0576p-1400k-libx264.mp4'
];

const { log, error } = getLogger('ChunkToMediaSource');

export class ChunkToMediaSource extends MmjsTestCase {
  private _flow: Flow;
  private _videoEl: HTMLVideoElement;
  private _mediaSource: MediaSource;

  setup (done) {
    this._videoEl = document.createElement('video');
    this._videoEl.controls = true;
    this._videoEl.addEventListener('error', () => {
      error(this._videoEl.error);
    });

    this.domMountPoint.appendChild(this._videoEl);

    this._mediaSource = new MediaSource();

    this._flow =
      new ChunkToMediaSourceFlow(
        URLs[1]
      );

    const video = this._videoEl;

    this._flow.whenCompleted()
      .then((result: FlowCompletionResult) => {
        video.src = URL.createObjectURL(result.data);
        video.controls = true;
      });

    done();
  }

  // TODO: create a generic flow-testbench
  run () {
    this._flow.state = FlowState.WAITING;
    this._flow.state = FlowState.FLOWING;
  }
}
