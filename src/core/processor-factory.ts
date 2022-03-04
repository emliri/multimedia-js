import { Processor } from './processor';
import { ProcessorProxy } from './processor-proxy';
import { VoidCallback } from '../common-types';
import { noop } from '../common-utils';

import * as Procs from '../processors/index';

/*
export abstract class FactorizableProcessor extends Processor {
  private constructor() {
    super() // TODO: have protected signal handler setter
  }

  static create(): FactorizableProcessor {
    const name = this.getName();
    return new Processors[name]();
  }
}
*/

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

let Processors: {[factoryName: string]: typeof Processor} = Procs as unknown as {[factoryName: string]: typeof Processor};
export function setProcessors (ProcessorsLib: {[factoryName: string]: typeof Processor}) {
  Processors = ProcessorsLib;
}

export function getProcessors () {
  return Processors;
}

export function getProcessorConstructorByName (factoryName: string): typeof Processor {
  return Processors[factoryName];
}

export function createProcessorFromConstructor (ProcessorConstructor: typeof Processor, args: any[] = []): Processor {
  return new (<any> ProcessorConstructor)(...args);
}

export function createProcessorByName (factoryName: string, args?: any[]): Processor {
  return createProcessorFromConstructor(getProcessorConstructorByName(factoryName), args);
}

export function newProcessorWorkerShell<T extends typeof Processor = typeof Processor> (
  procConstructor: T,
  args?: any[],
  importScriptPaths?: string[],
  onReady: VoidCallback = noop): ProcessorProxy {
  const name = procConstructor.getName();
  if (!name) {
    throw new Error('Factory failure: Processor.getName() returns undefined: ' + procConstructor.name);
  }
  return new ProcessorProxy(name, onReady, args, importScriptPaths);
}

export const newProc = newProcessorWorkerShell; // shorthand

export function newProcWorkerUnsafeCast (
  procConstructor: any,
  args?: any[],
  importScriptPaths?: string[],
  onReady: VoidCallback = noop): ProcessorProxy {
  return newProc(unsafeCastProcessorType(procConstructor),
    args, importScriptPaths, onReady);
}

export function createProcessorWorkerShellAsync (factoryName: string, args: any[] = [], timeoutMs: number = 1000): Promise<ProcessorProxy> {
  return new Promise<ProcessorProxy>((resolve, reject) => {
    const proc = new ProcessorProxy(factoryName, () => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout creating processor proxy'));
      }, timeoutMs);
      clearTimeout(timeout);
      resolve(proc);
    }, args);
  });
}

export function checkProcessorType (procType: any) {
  return typeof procType.getName === 'function' && procType.getName() !== null;
}

// TODO: remove need to use this by enabling `configure` method
//
export function unsafeCastProcessorType (procType: any) {
  return <typeof Processor> procType;
}
