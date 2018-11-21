import { MmjsTestCase } from '../mmjs-test-case';
import { CombineMp4sToMovFlow } from '../../src/flows/combine-mp4s-to-mov.flow';

export class RemixMovieSoundtrack extends MmjsTestCase {

  private _flow: CombineMp4sToMovFlow = null;

  setup(done: () => void) {

    const audioFileInput = document.createElement('input');
    const videoFileInput = document.createElement('input');

    audioFileInput.type = 'file';
    audioFileInput.id = 'audioFileInput';
    audioFileInput.accept = 'audio/mp4';

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
    const processButton = document.createElement('button');
    processButton.innerText = 'Process'

    // TODO: use the bootstrap grid
    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(processButton);
    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(document.createElement('br'))

    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.addEventListener('error', () => {
      console.error(videoEl.error);
    });

    this.domMountPoint.appendChild(videoEl);

    const mediaSource = new MediaSource();

    videoEl.src = URL.createObjectURL(mediaSource);

    processButton.onclick = () => {

      const videoUrl = videoFileInput.files[0] ? URL.createObjectURL(videoFileInput.files[0]) : '/test-data/mp4/v-0576p-1400k-libx264.mov';
      const audioUrl = audioFileInput.files[0] ? URL.createObjectURL(audioFileInput.files[0]) : '/test-data/mp4/KickOutTheJams.mp4';

      this._flow = new CombineMp4sToMovFlow(
        videoUrl,
        audioUrl,
        document.body);

    }

  }

  run() {}
}
