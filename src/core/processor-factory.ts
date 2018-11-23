import { Processor } from "./processor";
import { Processors } from "../../index";
import { ProcessorProxy } from "./processor-proxy";

export abstract class FactorizableProcessor extends Processor {
  private constructor() {
    super() // TODO: have protected signal handler setter
  }

  static create(): FactorizableProcessor {
    const name = this.getName();
    return new Processors[name]();
  }
}

/*
export class FactorizableProcessorImpl extends FactorizableProcessor {

  get name() { return null; }

  protected processTransfer_(inS: import("/Users/stephan/Code/emliri/es-libs/multimedia.js/src/core/socket").InputSocket, p: import("/Users/stephan/Code/emliri/es-libs/multimedia.js/src/core/packet").Packet, inputIndex: number): boolean {
    throw new Error("Method not implemented.");
  }
}

export interface FactorizableProcessorImpl extends FactorizableProcessor {

}
*/

export function getProcessorConstructorByName(factoryName: string): typeof Processor {
  return Processors[factoryName];
}

export function createProcessorFromConstructor(ProcessorConstructor: typeof Processor): Processor {
  return new (<any> ProcessorConstructor)();
}

export function createProcessorFromShellName(factoryName: string): Processor {
  return createProcessorFromConstructor(getProcessorConstructorByName(factoryName));
}

export function createProcessorProxyWorkerShell(factoryName: string, timeoutMs: number = 1000): Promise<ProcessorProxy> {
  return new Promise<ProcessorProxy>((resolve, reject) => {
    const proc = new ProcessorProxy(factoryName, () => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout creating processor proxy'));
      }, timeoutMs)
      clearTimeout(timeout);
      resolve(proc);
    })
  })

}



