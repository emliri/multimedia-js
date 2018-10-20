const uuidv1 = require('uuid/v1');

export function makeUUID_v1 (): number {
  return uuidv1();
}
