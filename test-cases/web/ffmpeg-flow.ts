import { MmjsTestCase } from "../mmjs-test-case";

import { FFmpegTool } from '../../src/processors/ffmpeg/ffmpeg-tool';
import { makeGetRequest } from "../../src/common-http";

import { getLogger } from "../../src/logger";
import { XhrSocket } from "../../src/io-sockets/xhr.socket";
import { InputSocket } from "../../src/core/socket";
import { Packet } from "../../src/core/packet";
import { WebFileDownloadSocket } from "../../src/io-sockets/web-file-download.socket";

const {log, error} = getLogger('ffmpeg-basic-testcase');

declare var ffmpeg: any;

export class FFmpegFlow extends MmjsTestCase {

  setup(done: () => void) {

    const inputFile = '/test-data/mp3/212438__pcfstnk__ubahn.mp3';

    const xhrSocket = new XhrSocket(inputFile);

    const fileDownloadSocket = new WebFileDownloadSocket(document.querySelector('#root'), 'audio/mp4');

    xhrSocket.connect(InputSocket.fromFunction((p: Packet) => {
      fileDownloadSocket.transfer(p);
      return true;
    }));

  }

  run() {
    throw new Error("Method not implemented.");
  }
}
