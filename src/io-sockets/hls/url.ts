
// We may extend our own container classes with a few of these methods
// @see https://github.com/tjenkinson/url-toolkit
import {
  buildAbsoluteURL,
  buildURLFromParts,
  normalizePath,
  parseURL
} from 'url-toolkit'

/**
 * Idea is to extend from the URL W3C standard interface
 * (i.e implement it where not supported natively)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/URL
 * @see https://www.npmjs.com/package/url-polyfill (relying on this for now as implementation shim)
 */
/*
export class URLObject extends URL {
  constructor(uri: string, base: string = null) {
    super(uri, base || undefined)
  }
}
*/

export function resolveUri(relativeUri: string, baseUri: string): string {

  //console.log('resolveUri:', relativeUri, baseUri);

  if (!baseUri) {
    return relativeUri
  }

  const resolvedUrl = buildAbsoluteURL(baseUri, relativeUri, {
    alwaysNormalize: true
  });

  //console.log(resolvedUrl);

  return resolvedUrl;
}





