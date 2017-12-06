import {Packet} from '../core/packet';
import {Processor} from '../core/processor';
import {SocketDescriptor, SocketType, InputSocket, OutputSocket} from '../core/socket';

export type LambdaTransferFunction = (inS: InputSocket, p: Packet) => boolean;
export type LambdaSocketDescriptor = (socketType: SocketType) => SocketDescriptor;

export class LambdaProcessor extends Processor {

    private transferFunc_: LambdaTransferFunction;
    private lsd_: LambdaSocketDescriptor;

    constructor(tf: LambdaTransferFunction, lsd: LambdaSocketDescriptor) {
        super();
        this.transferFunc_ = tf;
        this.lsd_ = lsd;
    }

    templateSocketDescriptor(st: SocketType): SocketDescriptor {
        return this.lsd_(st);
    }

    protected processTransfer_(inS: InputSocket, p: Packet): boolean {
        return this.transferFunc_(inS, p);
    }
}
