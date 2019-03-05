/**
 * Copyright 2015 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { writeInt32, decodeInt32 } from '../../common-utils';

export class Box {
  public offset: number;
  public size: number;

  public boxtype: string;
  public userType: Uint8Array;

  public constructor (boxtype: string, extendedType?: Uint8Array) {
    this.boxtype = boxtype;
    if (boxtype === 'uuid') {
      this.userType = extendedType;
    }
  }

  /**
  offset Position where writing will start in the output array
  {number} Size of the written data
   */
  public layout (offset: number): number {
    this.offset = offset;
    let size = 8;
    if (this.userType) {
      size += 16;
    }
    this.size = size;
    return size;
  }

  /**
  data Output array
  {number} Amount of written bytes by this Box and its children only.
   */
  public write (data: Uint8Array): number {
    writeInt32(data, this.offset, this.size);
    writeInt32(data, this.offset + 4, decodeInt32(this.boxtype));
    if (!this.userType) {
      return 8;
    }
    data.set(this.userType, this.offset + 8);
    return 24;
  }

  public toUint8Array (): Uint8Array {
    let size = this.layout(0);
    let data = new Uint8Array(size);
    this.write(data);
    return data;
  }
}

export class BoxContainerBox extends Box {
  public children: Box[];
  constructor (type: string, children: Box[]) {
    super(type);
    this.children = children;
  }

  public layout (offset: number): number {
    let size = super.layout(offset);
    this.children.forEach((child) => {
      if (!child) {
        return; // skipping undefined <- FIXME: weird
      }
      size += child.layout(offset + size);
    });
    return (this.size = size);
  }

  public write (data: Uint8Array): number {
    let offset = super.write(data);
    this.children.forEach((child) => {
      if (!child) {
        return; // skipping undefined <- FIXME: weird
      }
      offset += child.write(data);
    });
    return offset;
  }
}

export class FullBox extends Box {
  public version: number;
  public flags: number;

  constructor (boxtype: string, version: number = 0, flags: number = 0) {
    super(boxtype);
    this.version = version;
    this.flags = flags;
  }

  public layout (offset: number): number {
    this.size = super.layout(offset) + 4;
    return this.size;
  }

  public write (data: Uint8Array): number {
    let offset = super.write(data);
    writeInt32(data, this.offset + offset, (this.version << 24) | this.flags);
    return offset + 4;
  }
}
