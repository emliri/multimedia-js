import {createWebpackConfig} from './webpack-config-factory'

const configs = []

const exec = require('child_process').exec;

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
      buildPath,
      plugins: [

        // custom "AfterEmitPlugin" to exec shell script post-build
        {
          apply: (compiler) => {
            compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
              exec('npm run build-decls \n npm run build-decls-post', (err, stdout, stderr) => {
                if (stdout) process.stdout.write(stdout);
                if (stderr) process.stderr.write(stderr);
              });
            });
          }
        }
      ]
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


export default configs

