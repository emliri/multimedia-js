/// <reference types="node" />

import path from 'path';

import { LambdaFunc } from './common-types';

export function describeSpecTopLevel(filename: string, fn: LambdaFunc) {
  if (filename.endsWith('.spec.ts') || filename.endsWith('.test.ts')) filename = filename.substr(0, filename.length - 8);
  describe(path.basename(filename).toUpperCase(), fn);
}

