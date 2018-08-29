/* not needed for compilation, just for VS Code intellisense */
/// <reference path="./node_modules/@types/node/index.d.ts"/>
/// <reference path="./node_modules/@types/webpack/index.d.ts"/>

const path = require('path')

//const webpack = require('webpack')

const env = process.env

console.log('Release mode:', !!env.release, '\n')

/**
    @type {WebpackConfigFactoryOptions}
    {string} buildPath
    {string} libName
    {libraryTarget} libraryTarget
    {boolean} debug
 */
export function createWebpackConfig(options) {

  const libName = options.libName

  const buildPath = path.resolve(options.buildPath)

  console.log('Generating config for library:', libName, 'with options:\n', options, '\n')
  console.log('Resolved build path:', buildPath)

  const baseConfig = {
    devtool: options.debug && !env.release ? 'inline-source-map' : 'source-map',
    entry: options.entrySrc,
    externals: options.externals,
    output: {
      path: buildPath,
      publicPath: '/' + options.buildPath + '/',
      filename: libName + '.' + options.libraryTarget + '.js',
      library: libName,
      libraryTarget: options.libraryTarget,
      sourceMapFilename: '[file].map'
    },
    resolve: {
      extensions: ['*', '.ts', '.tsx', '.js', '.json', '.html', '.css', '.vue',],
      alias: {
        'vue$': 'vue/dist/vue.esm.js'
      },
    },
    module: {
      rules: [
        /*
        {
          test: /\.worker\.ts$/,
          use: [
            {
            loader: 'ts-loader'
          },
          {
            loader: 'worker-loader',
            options: {
              inline: true,
              fallback: false
            }
          }]
        },
        //*/
        {
          test: /\.tsx?$|\.js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'ts-loader'
          }
        },
        {
          test: /\.(html)$/,
          use: {
            loader: 'html-loader',
            options: {
              //attrs: [':data-src']
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            'vue-style-loader', // see https://github.com/vuejs/vue-style-loader
            'css-loader'
          ],
        },      {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: {
            loaders: {
            }
            // other vue-loader options go here
          }
        },
        {
          test: /\.(png|jpg|gif|svg)$/,
          loader: 'file-loader',
          options: {
            name: '[name].[ext]?[hash]'
          }
        }
      ]
    },
    plugins: [
      /*
          new Visualizer({
              filename: '../build_statistics.html'
          })
      */
    ]

  }

  return baseConfig
}

