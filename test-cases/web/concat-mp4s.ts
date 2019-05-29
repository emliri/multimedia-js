import { MmjsTestCase } from "../mmjs-test-case";
import { ConcatMp4sFlow } from "../../src/flows/concat-mp4s.flow";
import { FlowState } from "../../src/core/flow";

export class ConcatMp4s extends MmjsTestCase {

  private _flow: ConcatMp4sFlow = null;

  setup(done: () => void) {

    this._flow = new ConcatMp4sFlow(
      '/test-data/mp4/v-0576p-1400k-libx264.mp4',
      '/test-data/mp4/v-0576p-1400k-libx264.mp4',
      true,
      false
    );

    done();

  }

  run() {
    this._flow.state = FlowState.WAITING;
    this._flow.state = FlowState.FLOWING;
  }

}
