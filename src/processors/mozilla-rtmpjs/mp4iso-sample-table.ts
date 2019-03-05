import { Box } from './mp4iso-base';

import { SampleTableBox,
  SampleDescriptionBox,
  DecodingTimeToSampleBox,
  CompositionTimeToSampleBox,
  SampleToChunkBox, SampleSizeBox,
  ChunkOffsetBox,
  StblSample,
  DecodingTimeToSampleEntry,
  CompositionTimeToSampleEntry,
  SampleToChunkEntry,
  SyncSampleBox } from './mp4iso-boxes';

import { getLogger } from '../../logger';

const { log } = getLogger('MP4SampleTablePackager(moz)');

export class SampleTablePackager {
  static createEmptyForFragmentedMode (sampleDescriptionEntries: Box[]): SampleTableBox {
    return new SampleTableBox(
      new SampleDescriptionBox(sampleDescriptionEntries),
      new DecodingTimeToSampleBox(0, []),
      new CompositionTimeToSampleBox(0, []),
      new SampleToChunkBox([]),
      new SampleSizeBox([]),
      new ChunkOffsetBox([])
      // new SyncSampleBox([])
    );
  }

  /**
   * Assumes all samples be located in a contiguous chunk
   * where every sample is followed by the next one. This means
   * only the original offset needs to be input, and all sample offsets
   * can get derived from the aforementioned sample sizes.
   *
   * @param sampleDescriptionEntry
   * @param samples
   * @param chunkOffset
   */
  static createFromSamplesInSingleChunk (
    sampleDescriptionEntry: Box,
    samples: StblSample[],
    chunkOffset: number
  ): SampleTableBox {
    log('creating sample table from samples:',
      samples, 'at offset:', chunkOffset, 'sample description entry:', sampleDescriptionEntry);

    const stts: DecodingTimeToSampleEntry[] = [];
    const ctts: CompositionTimeToSampleEntry[] = [];

    // reduce all the indices where a random-access-point is found into a covenient list...
    const stss: number[] =
        samples.reduce((array, sample, index) => {
          if (sample.isRap) {
            array.push(index + 1);
          }
          return array;
        },
        []);

    const stsz: number[] = samples.map(sample => sample.size);

    // "now must we compress thy deltas & offsets ..."
    {
      // we want to compact the timing information using the following iteration
      // => delta(i+1) = DTS(i+1) - DTS(i)

      let previousSampleDts: number = null;
      let sampleCount = 0;
      let sampleDelta: number = null;
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];

        // here we need to a previous sample dts to compute any delta at all
        if (previousSampleDts !== null) {
          // if we have a new delta coming up push new entry and reset
          // (only we have had sampleDelta set at all before - init case!)
          const latestDelta = sample.dts - previousSampleDts;

          if (latestDelta != sampleDelta && sampleDelta !== null ||
              (i === samples.length - 1)) {
            if (sampleDelta === null) {
              sampleDelta = latestDelta;
            }
            stts.push({
              sampleCount,
              sampleDelta
            });
            // reset sample count after writing an entry
            sampleCount = 0;
            // reset / store latest delta
            sampleDelta = latestDelta;
          }
        }
        // as long as we are on the same delta, increment sample count
        sampleCount++;
        // store previous dts (even very first)
        previousSampleDts = sample.dts;
      }
    }

    // similar to above ^ but not same. now we are looking at CTO(n) = CTS(n) - DTS(n)
    // so this is coding the difference between the two time-series for (n) as opposed to
    // the difference between n and n+1 in the same series
    {
      let sampleCount = 0;
      let sampleOffset: number = null;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        // compute cto of this sample position
        const latestPtOffset = sample.cts - sample.dts;
        // check for init case
        if (sampleOffset !== null) { // only go here when previous offset set
          // if we have a new cto value push an entry and reset counter
          if (latestPtOffset !== sampleOffset ||
              (i === samples.length - 1)) {
            // write entry
            ctts.push({
              sampleCount,
              sampleOffset
            });
            // reset counters
            sampleCount = 0;
            sampleOffset = latestPtOffset;
          }
        } else {
          // only for init case
          sampleOffset = latestPtOffset;
        }
        // increment sample count every time
        sampleCount++;
      }
    }

    const stsc: SampleToChunkEntry[] = [{
      firstChunk: 1,
      samplesPerChunk: samples.length,
      sampleDescriptionIndex: 1
    }];

    return new SampleTableBox(
      new SampleDescriptionBox([sampleDescriptionEntry]),
      new DecodingTimeToSampleBox(0, stts),
      new CompositionTimeToSampleBox(0, ctts),
      new SampleToChunkBox(stsc),
      new SampleSizeBox(stsz),
      new ChunkOffsetBox([chunkOffset]),
      new SyncSampleBox(stss)
    );
  }
}
