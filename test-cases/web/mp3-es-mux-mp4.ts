import { MmjsTestCase } from '../mmjs-test-case';
import { VoidCallback } from '../../src/common-types';
import { Flow, FlowState, FlowCompletionResult } from '../../src/core/flow';
import { ElementaryStreamToMp4 } from '../../src/flows';

const URLs = [
  '/test-data/mp3/shalafon.mp3',
  '/test-data/mp3/9351__guitarz1970__bassics.mp3'
];

export class Mp3EsMuxMp4 extends MmjsTestCase {
  private _flow: Flow = null;
  private _videoEl: HTMLVideoElement;

  setup (done: VoidCallback) {
    const video = document.createElement('video');

    this._videoEl = video;

    video.width = 400;
    video.height = 300;
    video.controls = true;

    this.getDomMountPoint().appendChild(video);

    this._flow =
      new ElementaryStreamToMp4(
        URLs[1]
      );

    this._flow.whenCompleted()
      .then((result: FlowCompletionResult) => {
        video.src = URL.createObjectURL(result.data);
        video.controls = true;
      });

    done();
  }

  run () {
    this._flow.state = FlowState.WAITING;
    this._flow.state = FlowState.FLOWING;
  }
}
