import { MmjsTestCase } from '../mmjs-test-case';
import { ConcatMp4sFlow } from '../../src/flows/concat-mp4s.flow';
import { FlowState, FlowCompletionResult } from '../../src/core/flow';

export class ConcatMp4s extends MmjsTestCase {
  private _flow: ConcatMp4sFlow = null;

  setup (done: () => void) {
    this._flow = new ConcatMp4sFlow(

      // '/test-data/mp4/v-0576p-1400k-libx264.mp4',
      // '/test-data/mp4/Jul-17-2019_12-32-47.mp4',
      // '/test-data/mp4/SampleVideo_1280x720_5mb.mp4',
      '/test-data/mp4/SampleVideo_720x480_10mb.mp4',
      // '/test-data/mp4/180312_unicorn_hütte2_s.mp4',
      '/test-data/mp4/SH_Logo_animation_Sound_NoFadeIn.mp4',
      // '/test-data/video-2018-10-04T18_54_27.577Z.mp4',
      // '/test-data/mp4/v-0576p-1400k-libx264.mp4',

      null,
      true // toggle concat order !
    );

    const video = document.createElement('video');

    video.width = 400;
    video.height = 300;

    this.getDomMountPoint().appendChild(video);

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
