export { XhrSocket } from './xhr.socket';
export { HlsOutputSocket } from './hls/hls-output-socket';

// TODO: use node-externals in webpack config
/*
export { NodeFsWriteSocket } from './src/io-sockets/node-fs-write.socket';
export { NodeFsReadSocket } from './src/io-sockets/node-fs-read.socket';
*/

export { WebFileChooserSocket } from './web-file-chooser.socket';
export { MediaSourceInputSocket } from './web-mse-render.sock';
export { WebFileDownloadSocket } from './web-file-download.socket';

export { AppInputSocket } from './app-input-socket';
export { AppOutputSocket, AppOutputSocketAsyncFunc, AppOutputSocketSyncFunc } from './app-output-socket';
