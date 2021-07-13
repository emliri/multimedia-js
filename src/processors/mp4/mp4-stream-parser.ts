const BOX_TYPE_LENGTH = 4;

/**
 * both arrays are ensured to have the same length, being the number
 * of boxes found as "depth-zero atoms" i.e  at the top-level of the structure.
 * first array being the sizes, while the second being the 4-char box-type.
 */
export type Mp4AtomsScanResult = [number[], string[]] | null;

/**
 * Adapter for arbitrary fMP4 streaming-data chunks (like coming from chunked-transfer
 * encoding HTTP response) to output entire sets of box-atoms as specified
 * by the parsing arguments. The appending of the data can happend independently
 * of the parsing rule. As boxes are parsed and retrieved fully, they get flushed
 * from the internal buffer (where they were initially appended).
 * No copying happens on appending. On parsing, one buffer gets allocated with
 * the exact size of the result, and the box data gets copied there accordingly.
 */
export class Mp4StreamParser {
  private _buffers: Uint8Array[] = [];

  append (buf: Uint8Array) {
    this._buffers.push(buf);
  }

  /**
   *
   * @param closingAtoms List of atom-types on which we finish parsing (deliver result)
   * @param numBoxes Number of boxes to scan (defaults to as many as needed to reach closing state)
   */
  parse (
    closingAtoms: string[],
    numBoxes = Infinity
  ): [Uint8Array | null, Mp4AtomsScanResult?] {
    const boxes: Mp4AtomsScanResult = this._scanTopLevelBoxes(numBoxes);
    if (boxes === null) {
      return [null];
    }

    const [boxSizes, boxTypes] = boxes;
    // check if last box in scan equal some box in the closing-atoms argument
    // otherwise, return null when we are in "unlimited parsing mode" (otherwise
    // this would result in endless recursion), or recurse with incremented box-num
    // when in incremental mode (note: in which latter case this could throw
    // a callstack overflow in a super-extreme completely hypothetical case)
    if (
      !closingAtoms.some((boxType) => boxType === boxTypes[boxTypes.length - 1])
    ) {
      if (numBoxes === Infinity) {
        return [null];
      }
      return this.parse(closingAtoms, numBoxes + 1);
    }

    return [this._makeBufferFromBoxScan(boxSizes), boxes];
  }

  /**
   *
   * @param boxSizes List of top-level scanned box sizes
   */
  private _makeBufferFromBoxScan (boxSizes: number[]): Uint8Array {
    // sum up all box-sizes to determine output buffer size
    // and allocate memory with this
    const writeBufSize = boxSizes.reduce((accu, next) => accu + next, 0);
    const writeBuf = new Uint8Array(writeBufSize);

    // write to buffer by iterating over scanned box-sizes.
    // for each box-size, we grab the amount of data from
    // the input-chunks (the data may span over any number of chunks in any way).
    let writeOffset = 0;
    boxSizes.forEach((boxSize) => {
      writeOffset = this._popBoxAndWrite(writeBuf, writeOffset, boxSize);
    });

    return writeBuf;
  }

  /**
   * Write next box in input chunk-list to output buffer
   * @param writeBuf Output buffer
   * @param writeOffsetArg Offset in output buffer
   * @param boxSize Size of box (from scan result)
   * @returns resulting offset in buffer (will be writeOffsetArg + boxSize)
   */
  private _popBoxAndWrite (
    writeBuf: Uint8Array,
    writeOffsetArg: number,
    boxSize: number
  ): number {
    // number of bytes we will write (and need to read from input chunks)
    let remainingBytes = boxSize;
    // copy write offset arg (will be incremented)
    let writeOffset = writeOffsetArg;
    // loop as long as there are remaining bytes to copy
    while (remainingBytes > 0) {
      // pop next input-schunk
      let buf = this._buffers.shift() as Uint8Array;
      if (!buf) {
        throw new Error('Assertion failed on buffer list');
      }
      // the chunk is larger than the bytes we need (has remainder)
      if (buf.byteLength > remainingBytes) {
        // we move the window offset and size of input chunk
        // to end of the data we read
        const wrapOverBuf = new Uint8Array(
          buf.buffer,
          buf.byteOffset + remainingBytes,
          buf.byteLength - remainingBytes
        );
        // and we put the buffer back on the input list beginning
        this._buffers.unshift(wrapOverBuf);
        // create buffer in window we are reading now
        buf = new Uint8Array(buf.buffer, buf.byteOffset, remainingBytes);
      }
      // copy read buffer data to output
      writeBuf.set(buf, writeOffset);
      // increment write offset
      writeOffset += buf.byteLength;
      // decrement read-counter
      remainingBytes -= buf.byteLength;
    }
    if (remainingBytes !== 0 || writeOffsetArg + boxSize !== writeOffset) {
      throw new Error('Assertion failed on popping iso-box from chunks');
    }
    return writeOffset;
  }

  /**
   * Iterates on read-byte method to fill array of unsigned bytes,
   * returns underlying allocated ArrayBuffer or null, if could not read
   * whole number of bytes.
   * @param offset
   * @param numBytes
   */
  private _readArrayBufferAt (
    offset: number,
    numBytes: number
  ): ArrayBuffer | null {
    const buf = new Uint8Array(numBytes);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < numBytes; i++) {
      const val = this._readUByteAt(offset + i);
      if (val === null) {
        return null;
      }
      buf.set([val], i);
    }
    return buf.buffer;
  }

  /**
   * Read the (unsigned) byte-value at offset in the input-chunks list.
   * Returns null when offset is out of bounds of input-chunks combined size.
   * @param offset
   */
  private _readUByteAt (offset: number): number | null {
    let remainingOffset = offset;
    // iterate over input-chunks list until we reached target offset
    // and return value.
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < this._buffers.length; i++) {
      const buf = this._buffers[i];
      if (remainingOffset >= buf.byteLength) {
        remainingOffset -= buf.byteLength;
      } else {
        return buf[remainingOffset];
      }
    }
    return null;
  }

  /**
   * Scan top-level atoms of mp4 boxes
   * @param numBoxes
   */
  private _scanTopLevelBoxes (numBoxes: number): Mp4AtomsScanResult {
    // scan read offset
    let offset = 0;
    // output data: arrays of box-sizes and box-types
    const boxSizes: number[] = [];
    const boxTypes: string[] = [];
    // loop as long as needed for scan (can return early)
    // we keep offset declared above
    while (boxSizes.length < numBoxes) {
      // iterate over box-size parsing-buffer
      // to read amount of bytes needed for reading box-size
      // scan box size
      const boxSizeBuf = this._readArrayBufferAt(offset, BOX_TYPE_LENGTH);
      if (!boxSizeBuf) {
        break;
      }
      // read box-size as uint32
      const boxSize: number = new DataView(boxSizeBuf).getUint32(0);
      // check if we have last byte of box in input-chunks
      // when box not fully in buffer, we finish scan here.
      // (note: checks if we have last byte of this box, not first byte of next)
      if (this._readUByteAt(offset + boxSize - 1) === null) {
        break;
      }
      // scan box-type
      const boxTypeBuf = this._readArrayBufferAt(offset + 4, BOX_TYPE_LENGTH);
      if (!boxTypeBuf) {
        break;
      }
      // convert box-type bytes to char-string
      const boxType: string = String.fromCharCode(
        ...new Uint8Array(boxTypeBuf).values()
      );
      // push results
      boxSizes.push(boxSize);
      boxTypes.push(boxType);
      // increment scan read offset
      offset += boxSize;
    }
    // return what we found
    if (boxSizes.length === 0) {
      return null;
    }
    return [boxSizes, boxTypes];
  }
}
