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

    /**
     * Returns a copy of internal array, safe to manipulate
     * @returns {InputSocket[]}
     */
    inputs() {
        return this.inputs_.slice();
    }

    /**
     * Returns a copy of internal array, safe to manipulate
     * @returns {OutputSocket[]}
     */
    outputs() {
        return this.outputs_.slice();
    }

    /**
     * Read-only internal array ref
     * @type {InputSocket[]}
     */
    get in() {
      return this.inputs_
    }

    /**
     * Read-only internal array ref
     * @type {OutputSocket[]}
     */
    get out() {
      return this.outputs_
    }

    /**
     * Adds a new input socket with the given descriptor (or from default template)
     * @param {SocketDescriptor} sd optional
     */
    createInput(sd?: SocketDescriptor): InputSocket {
        const s = new InputSocket((p: Packet) => {
            return this.onReceiveFromInput_(s, p);
        }, this.wrapTemplateSocketDescriptor_(SocketType.INPUT));
        this.inputs_.push(s);
        return s;
    }

    /**
     * Adds a new output socket with the given descriptor (or from default template)
     * @param {SocketDescriptor} sd optional
     */
    createOutput(sd?: SocketDescriptor): OutputSocket {
        const s = new OutputSocket(this.wrapTemplateSocketDescriptor_(SocketType.OUTPUT));
        this.outputs_.push(s);
        return s;
    }

    protected abstract processTransfer_(inS: InputSocket, p: Packet): boolean;

    private onReceiveFromInput_(inS: InputSocket, p: Packet): boolean {
        let result = false
        try {
          result = this.processTransfer_(inS, p);
        } catch(err) {
          console.error(`There was a fatal error processing a packet: ${err.message}. Stacktrace:`)
          console.log(err)
        }
        return result
    }

    private wrapTemplateSocketDescriptor_(type: SocketType, sd?: SocketDescriptor): SocketDescriptor {
        return (sd || this.templateSocketDescriptor(type));
    }
}
