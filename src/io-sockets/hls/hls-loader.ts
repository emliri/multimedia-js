import { HlsM3u8File } from './hls-m3u8';
import { AdaptiveMedia, AdaptiveMediaPeriod } from './adaptive-media';
import { AdaptiveMediaStreamConsumer } from './adaptive-stream-consumer';
import { MediaSegment } from './media-segment';

import { getLogger, LoggerLevel as LoggerLevels } from '../../logger';

const { log } = getLogger('hls-loader', LoggerLevels.ON);

export class HlsLoader {
  private _media: AdaptiveMedia = null;
  private _streams: AdaptiveMediaStreamConsumer[] = null;

  constructor (url: string, private _onMediaUpdate: () => void, private _onSegmentLoaded: (segment: MediaSegment) => void = null) {
    log('created HLS loader for URL:', url);
    const m3u8 = new HlsM3u8File(url);
    m3u8.fetch().then(() => {
      m3u8.parse().then((adaptiveMediaPeriods: AdaptiveMediaPeriod[]) => {
        this._onM3u8Parsed(adaptiveMediaPeriods);
      });
    });
  }

  reset () {
    // TODO
  }

  private _onM3u8Parsed (adaptiveMediaPeriods: AdaptiveMediaPeriod[]) {
    log('m3u8 parsed:', adaptiveMediaPeriods);
    const streams: AdaptiveMediaStreamConsumer[] = [];
    const media: AdaptiveMedia = adaptiveMediaPeriods[0].getDefaultSet().getDefaultMedia();
    media.refresh().then((media: AdaptiveMedia) => {
      const consumer: AdaptiveMediaStreamConsumer =
        new AdaptiveMediaStreamConsumer(media, (segment: MediaSegment) => {
          log(`loaded mime-type ${segment.mimeType} segment:`, segment.uri);
          this._onSegmentLoaded && this._onSegmentLoaded(segment);
        });
      log('add stream:', consumer);
      streams.push(consumer);
      this._onMediaUpdate();
    });
    this._streams = streams;
    this._media = media;
  }

  getMasterMedia (): AdaptiveMedia {
    return this._media;
  }

  getVariantStreams (): AdaptiveMediaStreamConsumer[] {
    return this._streams;
  }
}
