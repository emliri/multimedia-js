var webpack = require('webpack');
var path = require("path");
var ignore = new webpack.IgnorePlugin(/^fs$/);
var config = [];

const BUILD_DIR = "dist"

function distroFilename(libraryTarget) {
  if (libraryTarget == 'this') {
    return distroFilename('global');
  }
  return 'multimedia_' + libraryTarget + '.js';
}

function configure(libraryTarget) {
  config.push({
    entry: './index.js',
    output: {
      path: path.resolve(__dirname, BUILD_DIR),
      filename: distroFilename(libraryTarget),
      libraryTarget: libraryTarget,
      library: 'multimedia'
    },
    plugins: [
      new webpack.DefinePlugin({
        '__BROWSER__': true
      }),
      ignore,
    ]
  });
  return config;
}

configure('var');
configure('this');
configure('commonjs2');

//configure('commonjs')
//configure('amd')
//configure('umd');

config.push({
  entry: './src/mp4-mux-worker.js',
  output: {
    path: path.resolve(__dirname, BUILD_DIR),
    filename: 'mp4-mux-worker-bundle.js',
    libraryTarget: 'this',
    library: 'MP4MuxWorker'
  },
  plugins: [
    new webpack.DefinePlugin({
      '__BROWSER__': true
    }),
    ignore,
  ]
});

module.exports = config;
