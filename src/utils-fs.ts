import fs from 'fs';

export function readFile (path: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, buf) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(new Uint8Array(buf.buffer));
    });
  });
}
