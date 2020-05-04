import {createWebpackConfig} from './webpack-config-factory'

const configs = []

const path = require('path')

// All Library
{
  const entrySrc = './index.ts'
  const libName = 'mmjs'
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

// Processor-proxy worker
{
  const entrySrc = './src/core/processor-proxy.worker.ts'
  const libName = 'mmjs-procs-worker'
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

//     "build-decls-post": "mv dist/index.d.ts dist/mmjs-core.umd.d.ts && cp dist/src/processors/index.d.ts dist/mmjs-procs.umd.d.ts && cp dist/src/io-sockets/index.d.ts dist/mmjs-io-sockets.umd.d.ts && cp dist/src/flows/index.d.ts dist/mmjs-flows.umd.d.ts",

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


// TestCasesWeb
{
  const entrySrc = './test-cases/web/index.ts'
  const libName = 'mmjs-test-cases'
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


export default configs

