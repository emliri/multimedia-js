/**
 * Defaults
 */
const PROXY_WORKER_PATH = '/dist/mmjs-procs-worker.umd.js';
const TASK_WORKER_PATH = null;
const FFMPEG_BIN_PATH = '/vendor/ffmpeg.js/ffmpeg-mp4.js';

export enum EnvironmentVar {
  PROXY_WORKER_PATH = 'proxy-worker-path',
  TASK_WORKER_PATH = 'task-worker-path',
  FFMPEG_BIN_PATH = 'ffmpeg-bin-path'
}

export type EnvironmentVars = {
  [name: string]: string
}

export const EnvVars: EnvironmentVars = {
  TASK_WORKER_PATH,
  PROXY_WORKER_PATH,
  FFMPEG_BIN_PATH
} as const;

export function setEnvironmentVar (name: EnvironmentVar, value: string) {
  EnvVars[name] = value;
}

export function getEnvironmentVar (name: EnvironmentVar): string {
  if (!EnvVars[name]) {
    throw new Error('No such environment variable exists: ' + name);
  }
  return EnvVars[name];
}
