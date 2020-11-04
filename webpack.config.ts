import path from 'path';

import {createWebpackConfig} from './webpack-config-factory'

const configs = []
const debug = process.env.DEBUG === '1'
const noFrills = process.env.NO_FRILLS === '1'
const noTypes = process.env.NO_TYPES === '1'

const exec = require('child_process').exec;

function onAfterEmit(compilation) {
  setTimeout(() => {
    process.stdout.write('\n\n ---> Building exported type declarations now...\n\n')
    exec('npm run build-decls \n npm run build-decls-post', (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    });
  }, 0)
}

function AfterEmitHookPlugin(onAfterEmit) {
  this.apply = function AfterEmitHookPlugin(compiler) {
    compiler.hooks.afterEmit.tap('AfterEmitHookPlugin', (compilation) => {
      onAfterEmit(compilation)
    });
  }
}

const plugins = [];

if (!noTypes) {
  plugins.push(new AfterEmitHookPlugin(onAfterEmit));
}

// All Library
{
  const entrySrc = path.resolve(__dirname, 'index.ts')
  const libName = 'mmjs'
  const buildPath = 'dist'
  const libraryTarget = 'umd'

  /*
  configs.push(
    createWebpackConfig({
      debug,
      entrySrc,
      libName,
      libraryTarget,
      buildPath,
      plugins
    })
  )
  */
}

if (!noFrills) {

  // Processor-proxy worker
  {
    const entrySrc = path.resolve(__dirname, './src/core/processor-proxy.worker.ts')
    const libName = 'mmjs-procs-worker'
    const buildPath = 'dist'
    const libraryTarget = 'umd'

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    )
  }


  // TestCasesWeb
  {
    const entrySrc = path.resolve('./test-cases/web/index.ts')
    const libName = 'mmjs-test-cases'
    const buildPath = 'dist'
    const libraryTarget = 'umd'

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    )
  }

  /*

  // Procs Library
  {
    const entrySrc = './src/processors/index.ts'
    const libName = 'mmjs-procs'
    const buildPath = 'dist'
    const libraryTarget = 'umd'
    const debug = true

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    )
  }

  // Flows Library
  {
    const entrySrc = './src/flows/index.ts'
    const libName = 'mmjs-flows'
    const buildPath = 'dist'
    const libraryTarget = 'umd'
    const debug = true

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    )
  }

  // I/O-Sockets Library
  {
    const entrySrc = './src/io-sockets/index.ts'
    const libName = 'mmjs-io-sockets'
    const buildPath = 'dist'
    const libraryTarget = 'umd'
    const debug = true

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    )
  }
  */


  // Task worker
  /*
  {
    const entrySrc = './src/core/processor-task.worker.ts'
    const libName = 'MMProcessorTaskWorker'
    const buildPath = 'dist'
    const libraryTarget = 'umd'
    const debug = true

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    )
  }
  */
}

export default configs

