import 'should';

const fs = require('fs')
const path = require('path')

import {MP4Parser} from './isoboxer-mp4-parser'

import {MP4Writer} from './isoboxer-mp4-writer'

import {ISOFile} from './isoboxer-types'

describe('MP4Writer', () => {

  const mp4TestData = []

  beforeAll((done) => {
    fs.readFile(path.resolve('./src/processors/mp4/fixtures/v-0360p-0750k-libx264.mp4'), (err, data) => {

      if (err) {
        throw err
      }

      mp4TestData.push(new Uint8Array(data.buffer))

      done()
    })
  })

  it('should rewrite an MP4 file from parsed model', () => {

    const res: ISOFile = MP4Parser.parse(mp4TestData[0])

    const arrayBuffer: ArrayBuffer = MP4Writer.writeFile(res)

    Buffer.from(arrayBuffer).equals(Buffer.from(mp4TestData[0])).should.be.true

    /*
    fs.writeFile('mp4-writer.test.mp4', Buffer.from(arrayBuffer), (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
    */

  })

})
