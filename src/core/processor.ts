import {SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketOwner, Socket} from './socket';
import {Packet, PacketSymbol} from './packet';
import { Signal, SignalReceiver, SignalHandler, SignalReceiverCastResult, collectSignalReceiverCastResults } from './signal';

export abstract class Processor implements SocketOwner, SignalReceiver {

    private inputs_: InputSocket[];
    private outputs_: OutputSocket[];
    private onSignal_: SignalHandler;

    public enableSymbolProxying: boolean = true;

    constructor(onSignal?: SignalHandler) {
        this.inputs_ = [];
        this.outputs_ = [];
        this.onSignal_ = onSignal || null;
    }

    // maybe better call protoSocketDescriptor as in prototype pattern?
    abstract templateSocketDescriptor(socketType: SocketType): SocketDescriptor;

    getOwnSockets(): Set<Socket> {
        return new Set(Array.prototype.concat(this.inputs_, this.outputs_));
    }

    cast(signal: Signal): SignalReceiverCastResult {
        return this.onSignalCast_(signal).then((result) => {
            if(result) {
                return Promise.resolve(true);
            } else {
                if (signal.isDirectionDown()) {
                    return signal.emit(this.out);
                } else if (signal.isDirectionUp()) {
                    return signal.emit(this.in);
                } else {
                    return Promise.resolve(false);
                }
            }
        })
    }

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
    get in(): InputSocket[] {
        return this.inputs_
    }

    /**
     * Read-only internal array ref
     * @type {OutputSocket[]}
     */
    get out(): OutputSocket[] {
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

    /**
     * @param p
     * @returns True when packet was forwarded
     */
    private onSymbolicPacketReceived_(p: Packet): boolean {
        const proxy = this.handleSymbolicPacket_(p.symbol);
        if (proxy && this.enableSymbolProxying) {
          console.log('proxy symbol', p.symbol)
          this.transferPacketToAllOutputs_(p);
          return true;
        }
        return false;
    }

    /**
     * @param p packet to transfer to all outputs
     */
    private transferPacketToAllOutputs_(p: Packet) {
        this.out.forEach((socket) => {
          socket.transfer(p);
        })
    }

    private onReceiveFromInput_(inS: InputSocket, p: Packet): boolean {
        if(p.isSymbolic()
            && this.onSymbolicPacketReceived_(p)) {
          return true; // when packet was forwarded we don't pass it on for processing
        }

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

    private onSignalCast_(signal: Signal): SignalReceiverCastResult {
        if (this.onSignal_) {
          return this.onSignal_(signal);
        } else {
          return Promise.resolve(false);
        }
    }

    /**
     * At the same time handler for symbols, as well as
     * arbiter function to determine if this proc proxies or not specific symbols.
     *
     * Default proxies all non-VOID symbols.
     *
     * Per design this merely passes in the symbol, not the actual packet.
     *
     * Symbolic packets are only supposed to be a shell for the symbol itself,
     * their other properties should be ignored in that case. They also should
     * not carry any data.
     *
     * If one wants to actually get the handle of a symbolic packet,
     * it is possible by disabling proxying (return false here in an override of this method)
     * as in this case these packets will be passed into `processTransfer_`.
     *
     * @param symbol
     * @returns True if the symbolic packet should be proxied
     */
    protected handleSymbolicPacket_(symbol: PacketSymbol): boolean {
      return symbol !== PacketSymbol.VOID;
    }

    /**
     * Called when a packet is received on an input socket.
     * Returns true when packet was handled correctly in some way.
     * @param inS
     * @param p
     */
    protected abstract processTransfer_(inS: InputSocket, p: Packet): boolean;

}
