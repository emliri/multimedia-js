import fs from 'fs';

export function readFile(path: string): Promise<Uint8Array> {
  return new Promise((res, rej) => {
    fs.readFile(path, (err, buf) => {
      if (err) {
        rej(err);
        return;
      }
      res(new Uint8Array(buf.buffer));
    });
  });
}
