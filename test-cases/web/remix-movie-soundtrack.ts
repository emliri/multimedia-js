import { MmjsTestCase } from '../mmjs-test-case';
import { CombineMp4sToMovFlow } from '../../src/flows/combine-mp4s-to-mov.flow';
import { FlowCompletionResult, FlowState } from '../../src/core/flow';

export class RemixMovieSoundtrack extends MmjsTestCase {

  audioFileInput: HTMLInputElement;
  videoFileInput: HTMLInputElement;
  videoEl: HTMLVideoElement;

  setup(done: () => void) {

    // FIXME: use file-chooser socket instead
    const audioFileInput = this.audioFileInput = document.createElement('input');
    const videoFileInput = this.videoFileInput = document.createElement('input');

    audioFileInput.type = 'file';
    audioFileInput.id = 'audioFileInput';
    audioFileInput.accept = 'audio/mp4,audio/mpeg';

    videoFileInput.type = 'file';
    videoFileInput.id = 'videoFileInput';
    videoFileInput.accept = 'video/mp4,video/quicktime';

    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(document.createTextNode('Audio file: '))
    this.domMountPoint.appendChild(audioFileInput);
    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(document.createTextNode('Video file: '))
    this.domMountPoint.appendChild(videoFileInput);

    this.domMountPoint.appendChild(document.createElement('br'))

    // TODO: use the bootstrap grid
    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(document.createElement('br'))

    const videoEl = this.videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.addEventListener('error', () => {
      console.error(videoEl.error);
    });

    this.domMountPoint.appendChild(videoEl);

    done();
  }

  run() {
    const audioFile: File = this.audioFileInput.files[0];
    const videoFile: File = this.videoFileInput.files[0];

    console.log('selected audio file:', audioFile)
    console.log('selected video file:', videoFile)

    /**
     *
     * SampleVideo_1280x720_5mb.mp4
     *
     * v-0576p-1400k-libx264.mov
     *
     */

    const videoUrl = videoFile ? URL.createObjectURL(videoFile) : '/test-data/mp4/SampleVideo_1280x720_5mb.mp4';
    const audioUrl = audioFile ? URL.createObjectURL(audioFile) : '/test-data/mp3/shalafon.mp3';

    // "good guess"
    const isMp3Audio = audioUrl.endsWith('.mp3');

    const flow = new CombineMp4sToMovFlow(
      videoUrl,
      audioUrl,
      false, // call saveAs when done
      null,
      isMp3Audio
    );

    flow.whenCompleted().then((result: FlowCompletionResult) => {

      this.videoEl.src = URL.createObjectURL(result.data);

      this.videoEl.play()

      console.log('flow completed with result:', result);

    });

    flow.state = FlowState.WAITING;
    flow.state = FlowState.FLOWING;
  }
}
