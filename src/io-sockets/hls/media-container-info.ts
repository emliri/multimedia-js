import { CloneableScaffold } from "./cloneable";

export type VideoInfo = {
  width: number
  height: number
 }

 export type AudioInfo = {
   language: string
   channels: number
 }

 export type TextInfo = {
   language: string
 }

 export enum MediaTypeFlag {
   AUDIO = 0b001,
   VIDEO = 0b010,
   TEXT = 0b100
 }

 export type MediaTypeSet = Set<MediaTypeFlag>

 /**
  * Human-readable `MediaTypeFlag`
  * @param type
  */
 export function getMediaTypeFlagName(type: MediaTypeFlag): string {
   switch(type) {
   case MediaTypeFlag.AUDIO: return 'audio'
   case MediaTypeFlag.VIDEO: return 'video'
   case MediaTypeFlag.TEXT: return 'text'
   default: return null
   }
}

export class MediaContainerInfo extends CloneableScaffold<MediaContainerInfo> {
  containedTypes: Set<MediaTypeFlag> = new Set()

  containsMediaType(type: MediaTypeFlag): boolean {
    return this.containedTypes.has(type)
  }

  intersectsMediaTypeSet(mediaTypeSet: MediaTypeSet, indentical: boolean = false): boolean {
    let hasOne = false
    let hasAll = true
    mediaTypeSet.forEach((mediaTypeFlag) => {
      hasOne = this.containedTypes.has(mediaTypeFlag)
      if (!hasOne && hasAll) {
        hasAll = false
      }
    })
    return indentical ? hasAll : hasOne
  }

  hasOneOf(mediaTypeSet: MediaTypeSet): boolean {
    return this.intersectsMediaTypeSet(mediaTypeSet, false)
  }

  hasAll(mediaTypeSet: MediaTypeSet) {
    return this.intersectsMediaTypeSet(mediaTypeSet, true)
  }
}

export interface MediaContainer {
  mediaContainerInfo: MediaContainerInfo
}
