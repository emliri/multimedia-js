import {SocketDescriptor, SocketType, InputSocket, OutputSocket} from './socket';
import {Packet} from './packet';

export abstract class Processor {

    private inputs_: InputSocket[];
    private outputs_: OutputSocket[];

    constructor() {
        this.inputs_ = [];
        this.outputs_ = [];
    }

    abstract templateSocketDescriptor(socketType: SocketType): SocketDescriptor;

    inputs() {
        return this.inputs_.slice();
    }

    outputs() {
        return this.outputs_.slice();
    }

    createInput(sd?: SocketDescriptor): InputSocket {
        const s = new InputSocket((p: Packet) => {
            return this.onReceiveFromInput_(s, p);
        }, this.wrapTemplateSocketDescriptor_(SocketType.INPUT));
        this.inputs_.push(s);
        return s;
    }

    createOutput(sd?: SocketDescriptor): OutputSocket {
        const s = new OutputSocket(this.wrapTemplateSocketDescriptor_(SocketType.OUTPUT));
        this.outputs_.push(s);
        return s;
    }

    protected abstract processTransfer_(inS: InputSocket, p: Packet): boolean;

    private onReceiveFromInput_(inS: InputSocket, p: Packet): boolean {
        return this.processTransfer_(inS, p);
    }

    private wrapTemplateSocketDescriptor_(type: SocketType, sd?: SocketDescriptor): SocketDescriptor {
        return (sd || this.templateSocketDescriptor(type));
    }
}