import { MmjsTestCase } from "../mmjs-test-case";
import { VoidCallback } from "../../src/common-types";
import { Flow, FlowState } from "../../src/core/flow";

import * as Multimedia from '../../index';

const URLs = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
];

export class HlsToMse extends MmjsTestCase {

  private _flow: Flow = null;
  private _videoEl: HTMLVideoElement;

  setup (done: VoidCallback) {

    const video = document.createElement('video');

    this._videoEl = video;

    video.width = 400;
    video.height = 300;

    this.getDomMountPoint().appendChild(video);

    this._flow =
      new Multimedia.Flows.HlsToMediaSourceFlow(
        URLs[0]
      );

    done();
  }

  run () {
    this._flow.state = FlowState.WAITING;
    this._flow.state = FlowState.FLOWING;
  }

}
