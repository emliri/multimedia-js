const DEFAULT_ALLOW_UPDATES = false
const MAX_CACHE_SIZE_BYTES = 1024 * 1e6 // 1024 Mbytes

const cache = new Map()

let bytesRead = 0
let bytesWritten = 0
let misses = 0
let hits = 0

export type MediaCacheResource = {
  uri: string;
  createdAt: number;
  accessedAt: number;
  data: ArrayBuffer;
}

export const mediaCacheInstance = {
  allowUpdates: DEFAULT_ALLOW_UPDATES,
  errorOnOverflow: false,
  get: (uri: string, onlyData: boolean = true): MediaCacheResource | ArrayBuffer => {
    let resource : MediaCacheResource
    if (!cache.has(uri)) {
      misses++
      return null
    }
    hits++
    resource = cache.get(uri)
    resource.accessedAt = Date.now()
    if (typeof resource.data.byteLength === 'number') {
      bytesRead += resource.data.byteLength
    }
    if (onlyData) {
      return resource.data
    } else {
      return resource
    }
  },
  put: (uri: string, data: ArrayBuffer): Object => {
    if (!mediaCacheInstance.allowUpdates && cache.has(uri)) {
      throw new Error('Cache updates not allowed. Purge first! URI:' + uri)
    }
    const createdAt = Date.now()
    const accessedAt = null
    const resource: MediaCacheResource = {
      uri,
      data,
      createdAt,
      accessedAt
    }
    cache.set(uri, resource)
    if (typeof resource.data.byteLength === 'number') {
      bytesWritten += resource.data.byteLength
    }
    let totalSize = mediaCacheInstance.countBytes()
    if (totalSize > MAX_CACHE_SIZE_BYTES) {
      if (mediaCacheInstance.errorOnOverflow) throw new Error('Cache exceeds max size, has' + totalSize + 'bytes')
      mediaCacheInstance.purgeOldest()
    }
    return mediaCacheInstance
  },
  purgeByUri: (uri: string): boolean => {
    return cache.delete(uri)
  },
  purgeAll: () => {
    cache.clear()
  },
  purgeNotAccessedSince: (timeMillisSince: number) => {
    let now = Date.now()
    cache.forEach((resource, uri) => {
      if (!resource.accessedAt // never accessed
        || resource.accessedAt < now - timeMillisSince)
        cache.delete(uri)
    })
  },
  purgeCreatedBefore: (timestamp: number) => {
    cache.forEach((resource, uri) => {
      if (resource.createdAt < timestamp)
        cache.delete(uri)
    })
  },
  purgeOldest: (type: string = 'accessed', count: number = 1) => {
    let prop = type + 'At'
    for (let i = 0; i < count; i++) {
      let oldest = null
      cache.forEach((resource) => {
        if (!oldest || resource[prop] < oldest[prop]) {
          oldest = resource
        }
      })
      cache.delete(oldest.uri)
    }
  },
  reduce: (reducer: (accu: any, resource: MediaCacheResource) => any, accuInit = 0): number | string => {
    let accu = accuInit
    cache.forEach((resource: MediaCacheResource, uri: string) => {
      accu = reducer.bind(this)(accu, resource)
    })
    return accu
  },
  sumDataProperty: (field: string): number | string => {
    return mediaCacheInstance.reduce((accu, resource) => {
      return accu + resource.data[field]
    })
  },
  countBytes: () => {
    return mediaCacheInstance.sumDataProperty('byteLength')
  }
}

export const getInfo = function() {
  return {
    bytesRead,
    bytesWritten,
    hits,
    misses
  }
}

