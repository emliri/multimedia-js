require('./global-performance-api');

import * as Procs from '../src/processors'

import yargs from 'yargs';

yargs
  .usage('Usage: mmjs-proc [[infile options] -i infile]... -p <proc-name>')
  .option('i', {
    alias: 'in',
    type: 'string',
    description: 'Path to input',
    demandOption: true
  })
  .option('p', {
    alias: 'proc',
    type: 'string',
    describe: 'Processor name',
    demandOption: true
  })
  .parse();

const procName: string = String(yargs.argv['p']);

if (!Procs[procName]) {
  throw new Error('No processor exists with name: ' + procName);
}



