import 'should';

const fs = require('fs')
const path = require('path')

import {MP3Parser, MP3ParserResult} from './mp3-parser'

describe('MP3Parser', () => {

  let mp3TestData: Uint8Array[] = []

  beforeAll((done) => {

    fs.readFile(path.resolve('./src/processors/mp3/fixtures/shalafon.mp3'), (err, data) => {
      if (err) {
        throw err
      }

      mp3TestData.push(new Uint8Array(data.buffer))

      done()
    })

  })

  it('should probe the first mp3 test data without errors', () => {

    const res = MP3Parser.probe(mp3TestData[0])

    console.log(res)

    res.should.be.false
  })

  it('should parse the first mp3 test data without errors', () => {

    const res: MP3ParserResult = MP3Parser.parse(mp3TestData[0])

    console.log(res.mp3Frames.length)

    res.mp3Frames.length.should.equal(215)
  })

})
