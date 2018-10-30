import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketOwner, Socket } from './socket';
import { PacketSymbol, Packet } from './packet';
import { Signal, SignalReceiver, SignalHandler, SignalReceiverCastResult, collectSignalReceiverCastResults } from './signal';
import { EventEmitter } from 'eventemitter3';
import { WorkerTask } from './worker';
import { getLogger } from '../logger';

const {debug, error} = getLogger("Processor");

// import WorkerLoader from "worker-loader!../base.worker";

// HACK: DIRTY-way worker loading :)
const WORKER_PATH = '/dist/MultimediaWorker.umd.js';

export enum ProcessorEvent {
    ANY_SOCKET_CREATED = 'processor:socket-created',
    INPUT_SOCKET_CREATED = 'processor:input-socket-created',
    OUTPUT_SOCKET_CREATED = 'processor:output-socket-created',
    SYMBOLIC_PACKET = 'processor:symbolic-packet',
    SIGNAL = 'processor:signal'
}

export type ProcessorEventData = {
    event: ProcessorEvent,
    processor: Processor
    socket?: Socket
    symbol?: PacketSymbol,
    packet?: Packet,
    signal?: Signal
};

export type ProcessorEventHandler = (data: ProcessorEventData) => void;

export abstract class Processor extends EventEmitter implements SocketOwner, SignalReceiver {
    private inputs_: InputSocket[] = [];
    private outputs_: OutputSocket[] = [];
    private worker_: Worker = null;

    // TODO: internalize EE instance to avoid polluting interface (we should only expose on/once/off)
    // private eventEmitter_: typeof EventEmitter = new EventEmitter();

    private onSignal_: SignalHandler;

    public enableSymbolProxying: boolean = true;

    constructor (onSignal?: SignalHandler) {
      super();
      this.onSignal_ = onSignal || null;
    }

    terminate () {
      if (this.worker_) {
        this.worker_.terminate();
      }
    }

    // maybe better call protoSocketDescriptor as in prototype pattern?
    abstract templateSocketDescriptor(socketType: SocketType): SocketDescriptor;

    private getWorker (): Worker {
      if (!this.worker_) {
        this.worker_ = new Worker(WORKER_PATH);
        this.worker_.addEventListener('message', (event) => {
          this.onWorkerMessage(event);
        });
      }
      return this.worker_;
    }

    protected onWorkerMessage (event: Event) {
      console.warn('Processor should implement onWorkerMessage');
      console.warn('Worker event not handled:', event);
    }

    protected dispatchWorkerTask (name: string, packet: Packet) {
      const task: WorkerTask = {
        workerContext: null,
        packet,
        name
      };
      this.getWorker()
        .postMessage(task, task.packet.mapArrayBuffers());
    }

    emit (event: ProcessorEvent, data: ProcessorEventData) {
      if (event !== data.event) {
        throw new Error('Event emitted must be identic the one carried in event data');
      }
      return super.emit(event, data);
    }

    on (event: ProcessorEvent, handler: ProcessorEventHandler) {
      super.on(event, handler);
      return this;
    }

    once (event: ProcessorEvent, handler: ProcessorEventHandler) {
      super.once(event, handler);
      return this;
    }

    off (event: ProcessorEvent, handler: ProcessorEventHandler) {
      super.off(event, handler);
      return this;
    }

    getOwnSockets (): Set<Socket> {
      return new Set(Array.prototype.concat(this.inputs_, this.outputs_));
    }

    cast (signal: Signal): SignalReceiverCastResult {
      return this.onSignalCast_(signal).then((result) => {
        if (result) {
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
      });
    }

    /**
     * Returns a copy of internal array, safe to manipulate
     * {InputSocket[]}
     */
    inputs () {
      return this.inputs_.slice();
    }

    /**
     * Returns a copy of internal array, safe to manipulate
     * {OutputSocket[]}
     */
    outputs () {
      return this.outputs_.slice();
    }

    /**
     * Read-only internal array ref
     * {InputSocket[]}
     */
    get in (): InputSocket[] {
      return this.inputs_;
    }

    /**
     * Read-only internal array ref
     * {OutputSocket[]}
     */
    get out (): OutputSocket[] {
      return this.outputs_;
    }

    /**
     * Adds a new input socket with the given descriptor (or from default template)
     * {SocketDescriptor} sd optional
     */
    createInput (sd?: SocketDescriptor): InputSocket {
      const s = new InputSocket((p: Packet) => {
        return this.onReceiveFromInput_(s, p);
      }, this.wrapTemplateSocketDescriptor_(SocketType.INPUT));
      this.inputs_.push(s);
      this.emit(ProcessorEvent.ANY_SOCKET_CREATED, {
        processor: this,
        event: ProcessorEvent.ANY_SOCKET_CREATED,
        socket: s
      });
      this.emit(ProcessorEvent.INPUT_SOCKET_CREATED, {
        processor: this,
        event: ProcessorEvent.INPUT_SOCKET_CREATED,
        socket: s
      });
      return s;
    }

    /**
     * Adds a new output socket with the given descriptor (or from default template)
     * {SocketDescriptor} sd optional
     */
    createOutput (sd?: SocketDescriptor): OutputSocket {
      const s = new OutputSocket(this.wrapTemplateSocketDescriptor_(SocketType.OUTPUT));
      this.outputs_.push(s);
      this.emit(ProcessorEvent.ANY_SOCKET_CREATED, {
        processor: this,
        event: ProcessorEvent.ANY_SOCKET_CREATED,
        socket: s
      });
      this.emit(ProcessorEvent.OUTPUT_SOCKET_CREATED, {
        processor: this,
        event: ProcessorEvent.OUTPUT_SOCKET_CREATED,
        socket: s
      });
      return s;
    }

    /**
     * @returns True when packet was forwarded
     */
    private onSymbolicPacketReceived_ (p: Packet): boolean {
      this.emit(ProcessorEvent.SYMBOLIC_PACKET, {
        processor: this,
        event: ProcessorEvent.SYMBOLIC_PACKET,
        symbol: p.symbol,
        packet: p
      });
      const proxy = this.handleSymbolicPacket_(p.symbol);
      if (proxy && this.enableSymbolProxying) {
        this.transferPacketToAllOutputs_(p);
        return true;
      }
      return false;
    }

    /**
     * p packet to transfer to all outputs
     */
    private transferPacketToAllOutputs_ (p: Packet) {
      this.out.forEach((socket) => {
        socket.transfer(p);
      });
    }

    private onReceiveFromInput_ (inS: InputSocket, p: Packet): boolean {
      if (p.isSymbolic() &&
            this.onSymbolicPacketReceived_(p)) {
        return true; // when packet was forwarded we don't pass it on for processing
      }

      let result = false;
      try {
        result = this.processTransfer_(inS, p);
      } catch (err) {
        error(`There was a fatal error processing a packet: ${err.message}. Stacktrace:`);
        debug(err);
      }
      return result;
    }

    private wrapTemplateSocketDescriptor_ (type: SocketType, sd?: SocketDescriptor): SocketDescriptor {
      return (sd || this.templateSocketDescriptor(type));
    }

    private onSignalCast_ (signal: Signal): SignalReceiverCastResult {
      this.emit(ProcessorEvent.SIGNAL, {
        processor: this,
        event: ProcessorEvent.SIGNAL,
        signal
      });

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
     * @returns True if the symbolic packet should be proxied
     */
    protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
      return symbol !== PacketSymbol.VOID;
    }

    /**
     * Called when a packet is received on an input socket.
     * Returns true when packet was handled correctly in some way.
     */
    protected abstract processTransfer_(inS: InputSocket, p: Packet): boolean;
}
