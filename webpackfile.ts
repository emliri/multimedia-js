import {createWebpackConfig} from './webpack-config-factory'

const configs = []

// Main Library
{
  const entrySrc = './index.ts'
  const libName = 'Multimedia'
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

// Worker
{
  const entrySrc = './src/base.worker.ts'
  const libName = 'MultimediaWorker'
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
  const libName = 'MultimediaTestCasesWeb'
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

