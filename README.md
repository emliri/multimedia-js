[![Build Status](https://travis-ci.org/tchakabam/multimedia.js.svg)](https://travis-ci.org/tchakabam/multimedia.js)

# multimedia.js

A toolkit and collection library for all things multimedia in JavaScript. Pipelines processing units using Node-like streams.

It is intended for use in Node (desktop/server) as well as in the browser.  There are distributions for all commonly known package standards (AMD/UMD/CJS/2) or global namespace.

### An Example

"Mux' an MP3 into MP4 from a file into a file"

***Note that we could now exchange the word "file" by anything else like some sort of player, decoder, transcoder, some kind of processing, WebAudio, a MediaSource, an HTTP request ...***

```
  var mm = require('multimedia');
  // Create some pipeline elements
  var src = new mm.Units.File.Src('somefile.mp3'),
  	parser = new mm.Units.MP3Parser(),
  	muxer = new mm.Units.MP4Mux(UnitMP4Mux.Profiles.MP3_AUDIO_ONLY),
  	sink = new mm.Units.File.Sink('somefile.mp4');
  
  sink.on('finish', function() {
    console.log('received eos signal');
  	done();
  });
  
  src.on('open', function() {
  	console.log('file open');
  	
  	// Link the pipeline elements together
  	FileSrc -> MP3Parser -> MP4Muxer -> FileSink
  	
  	mm.Unit.link(src, parser, muxer, sink);
  	
  });
```

### Install it

```
npm install multimedia
```

### Build it

```
npm run build
```

### Test it

```
npm test
```

### How to use it on a web page without `require`

```
  <script src="node_modules/multimedia/dist/multimedia_global.js"></script>
  var mm == window.multimedia;
```

or

```
  <script src="node_modules/multimedia/dist/multimedia_var.js"></script>
  // a variable named multimedia will be set and can be used likewise...
  var mm = multimedia;
```






