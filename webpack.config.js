
const path = require('path');
const webpack = require('webpack');
const ignore = new webpack.IgnorePlugin(/^fs$/);

function generate(options) {

    const libName = options.libName;

    const buildPath = path.resolve(options.buildPath);

    console.log('Generating config for library:', libName, 'with options:\n', options, '\n');
    console.log('Resolved build path:', buildPath);

    const baseConfig = {
        devtool: 'source-map',
        entry: options.entrySrc,
        externals: options.externals,
        output: {
            path: buildPath,
            publicPath: buildPath + '/',
            filename: libName + '.' + options.libraryTarget + '.js',
            library: libName,
            libraryTarget: options.libraryTarget,
            sourceMapFilename: '[file].map'
        },
        module: {
          rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'ts-loader'
                }
            }
          ]
        },
        //watch: options.watch,
        plugins: [
          new webpack.DefinePlugin({
            '__BROWSER__': true
          }),
          ignore,
        ]
    };

    return baseConfig;
}

const config = [];

const entrySrc = './index';
const libName = 'multimedia';
const buildPath = 'dist';
const libraryTarget = 'umd';

config.push(generate({
    entrySrc,
    libName,
    libraryTarget,
    buildPath
}));

module.exports = config;