import {createWebpackConfig} from './webpack-config-factory'

const configs = []

const path = require('path')

// Main Library
{
  const entrySrc = './index.ts'
  const libName = 'MM'
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

// Processor-proxy worker
{
  const entrySrc = './src/core/processor-proxy.worker.ts'
  const libName = 'MMProcessorProxyWorker'
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

// TestCasesWeb
{
  const entrySrc = './test-cases/web/index.ts'
  const libName = 'MMTestCasesWeb'
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

export default configs

