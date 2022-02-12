
import { spawnSync } from 'child_process';

import { createWebpackConfig } from './webpack-config-factory';

function AfterEmitHookPlugin (onAfterEmit) {
  this.apply = function AfterEmitHook (compiler) {
    compiler.hooks.afterEmit.tap('AfterEmitHook', (compilation) => {
      onAfterEmit(compilation);
    });
  };
}

const configs = [];
const debug = process.env.DEBUG === '1';
const noFrills = process.env.NO_FRILLS === '1';
const noTypes = process.env.NO_TYPES === '1';

function execCompilerTypesOnly (compilation) {
  setTimeout(() => {
    /*
    exec('npm run build-decls', (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    });
    */
    console.log('Building type-declarations ...');
    spawnSync('npm run build-decls', { shell: true, stdio: 'inherit' });
  }, 0);
}

const plugins = [];

if (!noTypes) {
  plugins.push(new AfterEmitHookPlugin(execCompilerTypesOnly));
}

// All Library
{
  const entrySrc = './index.ts';
  const libName = 'mmjs';
  const buildPath = 'dist';
  const libraryTarget = 'umd';

  configs.push(
    createWebpackConfig({
      debug,
      entrySrc,
      libName,
      libraryTarget,
      buildPath,
      plugins
    })
  );
}

if (!noFrills) {
  // Processor-proxy worker
  {
    const entrySrc = './src/core/processor-proxy.worker.ts';
    const libName = 'mmjs-procs-worker';
    const buildPath = 'dist';
    const libraryTarget = 'umd';

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    );
  }

  // TestCasesWeb
  {
    const entrySrc = './test-cases/web/index.ts';
    const libName = 'mmjs-test-cases';
    const buildPath = 'dist';
    const libraryTarget = 'umd';

    configs.push(
      createWebpackConfig({
        debug,
        entrySrc,
        libName,
        libraryTarget,
        buildPath
      })
    );
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

}

export default configs;
