import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketOwner, Socket, SocketTemplateGenerator } from './socket';
import { PacketSymbol, Packet } from './packet';
import { Signal, SignalReceiver, SignalHandler, SignalReceiverCastResult, collectSignalReceiverCastResults } from './signal';
import { EventEmitter } from 'eventemitter3';
import { ProcessorTask } from './processor-task';
import { getLogger } from '../logger';
import { EnvironmentVars } from './env';
import { ErrorInfo, ErrorCode, ErrorCodeSpace, ErrorInfoSpace } from './error';

const { debug, log, error } = getLogger('Processor');

// import WorkerLoader from "worker-loader!../base.worker";

export enum ProcessorEvent {
    ANY_SOCKET_CREATED = 'processor:socket-created',
    INPUT_SOCKET_CREATED = 'processor:input-socket-created',
    OUTPUT_SOCKET_CREATED = 'processor:output-socket-created',
    SYMBOLIC_PACKET = 'processor:symbolic-packet',
    SIGNAL = 'processor:signal',
    ERROR = 'processor:error'
}

export type ProcessorError = ErrorInfoSpace<ErrorCodeSpace.PROC> & {
    processor: Processor
}

export type ProcessorEventDataProps = Partial<{
  socket: Socket
  symbol: PacketSymbol,
  packet: Packet,
  signal: Signal,
  error: ProcessorError
}>

export type ProcessorEventData = {
    event: ProcessorEvent,
    processor: Processor
} & ProcessorEventDataProps;

export type ProcessorEventHandler = (data: ProcessorEventData) => void;

export const PROCESSOR_RPC_INVOKE_PACKET_HANDLER = 'mmjs:processor:RPC:invokePacketHandler';

export abstract class Processor extends EventEmitter<ProcessorEvent> implements SocketOwner, SignalReceiver {
  static getName (): string {
    return null;
  }

  // FIXME: crashes with "Object prototype may only be an Object or null"
  /*
    static createWorkerShell(onReady: VoidCallback = noop): ProcessorProxy {
      const name = this.getName();
      if (!name) {
        throw new Error('Can not use factory, static name is not defined');
      }
      return new ProcessorProxy(name, onReady);
    };
    */

    private inputs_: InputSocket[] = [];
    private outputs_: OutputSocket[] = [];
    private taskWorker_: Worker = null;

    // TODO: internalize EE instance to avoid polluting interface (we should only expose on/once/off)
    // private eventEmitter_: typeof EventEmitter = new EventEmitter();

    public enableSymbolProxying: boolean = true;
    public muteSymbolProcessing: boolean = false;

    constructor (
      private onSignal_: SignalHandler = null,
      private socketTemplate_: SocketTemplateGenerator = null
    ) {
      super();

      /**
       * RPC-compatible wrapper for processTransfer_. Avoids to recover a Socket-type object on the remote
       * for which we don't ensure tranferability i.e for which we don't have a proxy.
       *
       * Not supposed to be directly called but to be invoked remotely.
       *
       * @param p
       * @param inputIndex
       */
      this[PROCESSOR_RPC_INVOKE_PACKET_HANDLER] = (p: Packet, inputIndex: number) => {
        this.onReceiveFromInput_(this.in[inputIndex], Packet.fromTransferable(p), inputIndex);
      };
    }

    terminate () {
      if (this.taskWorker_) {
        this.taskWorker_.terminate();
      }
    }

    // maybe better call protoSocketDescriptor as in prototype pattern?
    templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
      if (!this.socketTemplate_) {
        throw new Error('No socket-template generator function set');
      }
      return this.socketTemplate_(socketType);
    }

    createEvent (event: ProcessorEvent, eventProps: ProcessorEventDataProps): ProcessorEventData {
      const eventData = Object.assign({
        event,
        processor: this
      }, eventProps);
      return eventData;
    }

    createErrorEvent (code: ErrorCode, message: string, nativeError?: Error): ProcessorEventData {
      if (code < ErrorCode.PROC_GENERIC) {
        throw new Error('Error-code is not for proc-type');
      }
      error('creating error event with code:', code, 'message:', message)
      const event = this.createEvent(ProcessorEvent.ERROR, {
        error: {
          code,
          space: ErrorCodeSpace.PROC,
          message,
          processor: this
        }
      });
      return event;
    }

    emitErrorEvent(code: ErrorCode, message: string, nativeError?: Error) {
      this.emit(ProcessorEvent.ERROR, this.createErrorEvent(code, message, nativeError));
    }

    emit (event: ProcessorEvent, data: ProcessorEventData) {
      if (event !== data.event) {
        throw new Error('Event emitted must be identic the one carried in event data');
      }
      if (data.processor !== this) {
        throw new Error('Event data must point to this');
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
      const inputIndex: number = this.inputs_.length;
      const s = new InputSocket((p: Packet) => {
        return this.onReceiveFromInput_(s, p, inputIndex);
      }, sd || this.wrapTemplateSocketDescriptor_(SocketType.INPUT));
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
      const s = new OutputSocket(sd || this.wrapTemplateSocketDescriptor_(SocketType.OUTPUT));
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

    private getTaskWorker (): Worker {
      if (!this.taskWorker_) {
        this.taskWorker_ = new Worker(EnvironmentVars.TASK_WORKER_PATH);
        this.taskWorker_.addEventListener('message', (event) => {
          this.onTaskWorkerMessage(event);
        });
      }
      return this.taskWorker_;
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
      return this.muteSymbolProcessing;
    }

    /**
     * p packet to transfer to all outputs
     */
    private transferPacketToAllOutputs_ (p: Packet) {
      this.out.forEach((socket) => {
        socket.transfer(p);
      });
    }

    private onReceiveFromInput_ (inS: InputSocket, p: Packet, inputIndex: number): boolean {
      if (p.isSymbolic() &&
            this.onSymbolicPacketReceived_(p)) {
        return true; // when packet was forwarded we don't pass it on for processing
      }

      let result = false;
      try {
        result = this.processTransfer_(inS, p, inputIndex);
      } catch (err) {
        const msg = `There was an internal fatal error processing a packet: ${err.message}.`
        error(msg, err);
        debug('Stacktrace:')
        debug(err);
        this.emitErrorEvent(ErrorCode.PROC_INTERNAL, msg, err)
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

    protected onTaskWorkerMessage (event: MessageEvent) {
      console.warn('Processor should implement onWorkerMessage');
      console.warn('Worker event not handled:', event);
    }

    protected dispatchTask (name: string, packet: Packet) {
      const task: ProcessorTask = {
        workerContext: null,
        packet,
        name
      };
      this.getTaskWorker()
        .postMessage(task, task.packet.mapArrayBuffers());
    }

    /**
     * FIXME: explain this better
     *
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
     * Returning false will have this packet carrying the symbol be passed into `processTransfer_`.
     *
     * Setting the Processor instance property `enableSymbolProxying` to false (default true)
     * will disable proxying generally for all packets. That way, proxying can be disabled while
     * packets with symbols will also not be passed into the processing scope.
     *
     * NOTE: Transferring the packet with the symbol to all output sockets "manually" is de-facto performing proxying.
     *
     * @returns True if the symbolic packet should be proxied, false if we want to handle this manually in the processing scope (when symbol-proxying enabled)
     */
    protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
      return symbol !== PacketSymbol.VOID;
    }

    /**
     * Called when a packet is received on an input socket.
     * Returns true when packet was handled correctly in some way.
     */
    protected abstract processTransfer_(inS: InputSocket, p: Packet, inputIndex: number): boolean;

    /**
     * Needed by proxy shell
     * @param st
     */
    protected overrideSocketTemplate (st: SocketTemplateGenerator) {
      this.socketTemplate_ = st;
    }
}
