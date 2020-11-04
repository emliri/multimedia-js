const path = require('path')

export type WebpackConfigFactoryOptions = {
  entrySrc: string
  buildPath: string
  libName: string
  libraryTarget: string
  debug?: boolean,
  externals?: string[]
  plugins?: unknown[]
}

export function createWebpackConfig(options: WebpackConfigFactoryOptions, excludePaths: string[] = []) {

  const libName = options.libName

  const buildPath = path.resolve(options.buildPath)

  console.log('Generating config for library:', libName, 'with options:\n', options, '\n')
  console.log('Resolved build path:', buildPath)

  const baseConfig = {
    mode: options.debug ? "development" : "production",
    entry: options.entrySrc,
    externals: options.externals,
    output: {
      path: buildPath,
      publicPath: '/' + options.buildPath + '/',
      filename: libName + '.' + options.libraryTarget + '.js',
      library: libName,
      libraryTarget: options.libraryTarget,
      sourceMapFilename: '[file].map',
      globalObject: 'this'
    },
    resolve: {
      extensions: ['*', '.ts', '.tsx', '.js', '.json', '.html', '.css']
    },
    module: {
      rules: [
        {
          test: /\.tsx?$|\.js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'ts-loader'
          }
        }
      ]
    },
    devtool: "source-map", //options.debug ? "inline-source-map" : "source-map",
    optimization: {
      minimize: ! options.debug
    },
    plugins: options.plugins || [],
    watchOptions: {
      poll: 1000 // Check for changes every second
    },

  }

  return baseConfig
}

