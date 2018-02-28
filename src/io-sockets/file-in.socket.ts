import {InputSocket, SocketDescriptor} from '../core/socket'
import { Packet } from '../core/packet';

const fs = require('fs')
const path = require('path')

export type WritableFileStreamOptions = {
  flags?: string
  encoding?: string
  fd?: number
  mode?: number
  autoClose?: boolean
  start?: number
}

export const createPacketHandler = (filePath: string, options?: WritableFileStreamOptions): ((p: Packet) => boolean) => {
  const ws = fs.createWriteStream(path.resolve(filePath), options)

  return (p: Packet) => {

    p.data.forEach((bs) => {
      ws.write(bs.getBuffer(), () => {

      })
    })

    return true
  }
}

export class FileInSocket extends InputSocket {
  constructor(filePath: string, options?: WritableFileStreamOptions) {
    super(createPacketHandler(filePath, options), new SocketDescriptor())
  }
}
