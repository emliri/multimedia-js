import { MmjsTestCase } from '../mmjs-test-case';
import { MP4DemuxProcessor } from '../../src/processors/mp4-demux.processor';
import { newProcessorWorkerShell, unsafeCastProcessorType } from '../../src/core/processor-factory';
import { XhrSocket } from '../../src/io-sockets/xhr.socket';
import { ProcessorEvent, ProcessorEventData } from '../../src/core/processor';
import { AvcPayloaderProc } from '../../src/processors/avc-network-abstraction.proc';
import { SocketEvent } from '../../src/core/socket';
import { LoggerLevel, getLogger } from '../../src/logger';
import { OutputSocket } from '../../src/core/socket-output';

const ENABLE_INSPECT_AUDIO = false;
const ENABLE_INSPECT_VIDEO = true;

const { log } = getLogger('InspectMp4', LoggerLevel.ON, true);

export class InspectMp4 extends MmjsTestCase {
  setup (done: () => void) {
    done();
  }

  run () {
    let h264Parse;
    let aacParse;

    let videoTrackCnt = 0;
    let audioTrackCnt = 0;

    const mp4Demux = newProcessorWorkerShell(MP4DemuxProcessor);
    mp4Demux.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
      if (data.socket.payload().isVideo()) {
        const videoTrackNo = videoTrackCnt++;

        log(`video track #${videoTrackNo} found`);

        if (ENABLE_INSPECT_VIDEO) {
          h264Parse = newProcessorWorkerShell(unsafeCastProcessorType(AvcPayloaderProc));
          OutputSocket.fromUnsafe(data.socket).connect(h264Parse.in[0]);
        }

        OutputSocket.fromUnsafe(data.socket).addListener(SocketEvent.EOS_PACKET_TRANSFERRED, () => {
          log(`video EOS for track #${videoTrackNo} transferred`);
        });
      } else if (data.socket.payload().isAudio()) {
        const audioTrackNo = audioTrackCnt++;

        log(`audio track #${audioTrackNo} found`);

        if (ENABLE_INSPECT_AUDIO) {
          // TODO
        }

        OutputSocket.fromUnsafe(data.socket).addListener(SocketEvent.EOS_PACKET_TRANSFERRED, () => {
          log(`audio EOS for track #${audioTrackNo} transferred`);
        });
      }
    });

    const xhrSocket: XhrSocket = new XhrSocket(
      '/test-data/mp4/SampleVideo_720x480_10mb.mp4'
      // '/test-data/mp4/SampleVideo_1280x720_5mb.mp4'
      // '/test-data/mp4/buffer0-1562764964156.mp4',
      // '/test-data/mp4/180312_unicorn_hütte2_s.mp4',
      // '/test-data/mp4/01_Closing_campaign_4k.mp4'
      // '/test-data/mp4/ffmpeg-concat-out.mp4',
      // '/test-data/mp4/v-0576p-1400k-libx264.mp4'
      // '/test-data/mp4/180312_unicorn_hütte2_s.mp4'
    );

    xhrSocket.connect(mp4Demux.createInput());
  }
}
