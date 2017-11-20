import {SocketDescriptor, SocketType, InputSocket, OutputSocket} from './socket';
import {Packet} from './packet';

export abstract class Processor {

    private inputs_: InputSocket[];
    private outputs_: OutputSocket[];

    constructor() {}

    abstract templateSocketDescriptor(socketType: SocketType): SocketDescriptor;

    protected abstract processTransfer_(inS: InputSocket, p: Packet): boolean;

    protected onReceiveFromInput_(inS: InputSocket, p: Packet): boolean {
        return this.processTransfer_(inS, p);
    }

    inputs() {
        return this.inputs_.slice();
    }

    outputs() {
        return this.outputs_.slice();
    }

    createInput(sd: SocketDescriptor | null): InputSocket {
        const s = new InputSocket((p: Packet) => {
            return this.onReceiveFromInput_(s, p);
        }, sd || this.templateSocketDescriptor(SocketType.INPUT));
        this.inputs_.push(s);
        return s;
    }

    createOutput(sd: SocketDescriptor | null): OutputSocket {
        const s = new OutputSocket(sd || this.templateSocketDescriptor(SocketType.OUTPUT));
        this.outputs_.push(s);
        return s;
    }
}
