import { AdaptiveMedia, AdaptiveMediaSet } from "./adaptive-media";
//import { Scheduler } from "../../objec-ts/lib/scheduler";
import { getLogger } from "../../logger";

const { log, error } = getLogger("adaptive-media-client");

export abstract class AdaptiveMediaClient implements AdaptiveMediaEngine {

  private mediaEl: HTMLMediaElement;

  constructor(mediaElement: HTMLMediaElement) {
    this.mediaEl = mediaElement;
  }

  get mediaElement(): HTMLMediaElement {
    return this.mediaEl;
  }

  protected setMediaSource(source: MediaSource) {
    this.mediaEl.src = URL.createObjectURL(source);
  }

  abstract setSourceURL(url: string, mimeType?: string);
  abstract activateMediaStream(stream: AdaptiveMedia): Promise<boolean>
  abstract enableMediaSet(set: AdaptiveMediaSet);
}

export interface AdaptiveMediaEngine {
  enableMediaSet(set: AdaptiveMediaSet)
  activateMediaStream(stream: AdaptiveMedia): Promise<boolean>
}



