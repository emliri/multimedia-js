var webpack = require('webpack');

module.exports = [{
  entry: './index.js',
  output: {
    path: __dirname,
    filename: 'multimedia_debug.js',
    libraryTarget: 'this',
    library: 'multimedia'
  }
}];
