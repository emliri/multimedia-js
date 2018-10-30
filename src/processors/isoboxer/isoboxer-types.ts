export type ISOFileCursor = {
  offset: number
};

export type ISOBox = {
  size: number,
  type: string,
  boxes: ISOBox[],

  _offset: number,
  _root: ISOBox,
  _raw: DataView,
  _parent: ISOBox,
  _cursor: ISOFileCursor,
  _parsing: boolean

  write: () => number
  append: (box: ISOBox, pos: number) => void
  getLength: () => number
};

export type ISOFile = {
  boxes: ISOBox[]

  _raw: DataView

  fetch: (type: string) => ISOBox
  fetchAll: (type: string) => ISOBox[]
  parse: () => ISOFile
  write: () => ArrayBuffer
  append: (box: ISOBox, pos: number) => void
};
