import { MmjsTestCase } from '../mmjs-test-case';
import { MovToFmp4Flow } from '../../src/flows/mov-to-fmp4.flow';

export class RemixMovieSoundtrack extends MmjsTestCase {

  private _flow: MovToFmp4Flow = null;

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
    this.domMountPoint.appendChild(document.createTextNode('Audio file:'))
    this.domMountPoint.appendChild(audioFileInput);
    this.domMountPoint.appendChild(document.createElement('br'))
    this.domMountPoint.appendChild(document.createTextNode('Video file:'))
    this.domMountPoint.appendChild(videoFileInput);

    this.domMountPoint.appendChild(document.createElement('br'))
    const processButton = document.createElement('button');
    processButton.innerText = 'Process'

    this.domMountPoint.appendChild(processButton);
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

      const videoUrl = URL.createObjectURL(videoFileInput.files[0])
      const audioUrl = URL.createObjectURL(audioFileInput.files[0]);

      //const videoUrl = '/test-data/mp4/v-0576p-1400k-libx264.mov';
      //const audioUrl = '/test-data/mp4/KickOutTheJams.mp4';

      this._flow = new MovToFmp4Flow(
        videoUrl,
        audioUrl,
        mediaSource);
    }


  }

  run() {}
}
