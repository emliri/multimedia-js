import bowser = require('bowser');

export enum BrowserBrandname {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  SAFARI = 'safari',
  IE = 'ie',
  EDGE = 'edge'
}

// ADD browser rendering-engines detection; see https://github.com/lancedikson/bowser/tree/v1.x

export function isBrowserBrand (brandName: BrowserBrandname) {
  return bowser[brandName];
}

export function isMseSupported (): boolean {
  return !!(window as any).MediaSource;
}
