import {EventEmitter} from 'eventemitter3'

export class Queue<T> extends EventEmitter {

  private _list: T[] = []

  /**
   * Returns a copy of the internal array
   */
  getArray(): Array<T> {
    return this._list.slice(0);
  }

  get size() {
    return this._list.length
  }

  /**
   * First item
   */
  begin(): T {
    return this._list[0] || null
  }

  /**
   * Last item
   */
  end(): T {
    return this._list[this._list.length - 1] || null
  }

  /**
   * Adds to the end
   * @param item
   */
  add(item: T): Queue<T> {
    this._list.push(item)
    return this
  }

  /**
   * Removes from the end
   */
  subtract(): T {
    return this._list.pop()
  }

  /**
   * Alias for subtract method
   */
  pop(): T {
    return this.subtract();
  }

  /**
   * Adds to the begin
   * @param item
   */
  enqueue(item: T): Queue<T> {
    this._list.unshift(item)
    return this
  }

  /**
   * Removes from begin
   */
  dequeue(): T {
    return this._list.shift()
  }

  insertAt(index: number, ...items: T[]): Queue<T> {
    this._list.splice(index, 0, ...items)
    return this
  }

  removeAll(item: T, limit = Infinity): number {
    let rmCnt = 0
    while(true) {
      const index = this._list.indexOf(item)
      if (index < 0 || rmCnt + 1 > limit) {
        break
      }
      this._list.splice(index, 1)
      rmCnt++
    }
    return rmCnt
  }

  removeOne(item: T): boolean {
    return !! this.removeAll(item, 1)
  }

  get(index: number): T {
    return this._list[index] || null
  }

  forEach(forEachFn: (item, index?) => void): Queue<T> {
    this._list.forEach(forEachFn)
    return this
  }

  containsAtLeastOnce(item: T) {
    return this._list.indexOf(item) >= 0;
  }
}
