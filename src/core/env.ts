/**
 * Defaults
 */
const PROXY_WORKER_PATH = '/dist/MMProcessorProxyWorker.umd.js';
const FFMPEG_BIN_PATH = '/vendor/ffmpeg.js/ffmpeg-mp4.js'

type EnvironmentVars = {
  PROXY_WORKER_PATH: string
  FFMPEG_BIN_PATH: string
}

export const EnvironmentVars: EnvironmentVars = {
  PROXY_WORKER_PATH,
  FFMPEG_BIN_PATH
}

export function setEnvironmentVar(name: keyof EnvironmentVars, value: string) {
  EnvironmentVars[name] = value;
}

export function getEnvironmentVar(name: keyof EnvironmentVars): string {
  return EnvironmentVars[name];
}

