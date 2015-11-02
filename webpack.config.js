var webpack = require('webpack');
var path = require("path");
var ignore = new webpack.IgnorePlugin(new RegExp("fs"))
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

configure('var')
configure('this')
configure('commonjs')
configure('commonjs2')
configure('amd')
configure('umd');

module.exports = config;
