import { Flow } from "../core/flow";
import { VoidCallback } from "../common-types";


export class ConcatMp4sFlow extends Flow {

    constructor(
        private _videoUrlA: string,
        private _videoUrlB:  string
    ) {
        super();
    }

    protected onVoidToWaiting_(done: VoidCallback) {
        throw new Error("Method not implemented.");
    }
    
    protected onWaitingToVoid_(done: VoidCallback) {
        throw new Error("Method not implemented.");
    }

    protected onWaitingToFlowing_(done: VoidCallback) {
        throw new Error("Method not implemented.");
    }

    protected onFlowingToWaiting_(done: VoidCallback) {
        throw new Error("Method not implemented.");
    }

    protected onCompleted_(done: VoidCallback) {
        throw new Error("Method not implemented.");
    }

    protected onStateChangeAborted_(reason: string) {
        throw new Error("Method not implemented.");
    }
}