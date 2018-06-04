
Hey there. This version 0.8.x of multimedia.js is not being maintained anymore. IT still works anyway fwiw :) Feel free to use it for the use-cases implemented.

**We more than never believe in the need to provide one complete, versatile and modular multimedia pipelines framework to enable creating demanding applications in Browser, Electron, Nodejs or ReactNative etc and allow access to standards implementation under one common generic data-flow API :)**

Currently v2 is under heavy development here: https://github.com/tchakabam/multimedia.js/tree/v2.0.x 

This will be a (more elaborately conceived) core and base components all written in **TypeScript**. 

Featuring: way more format support, more use cases, more performance, more magic + many other goodies. Stay tuned.

(Scroll down to go to previous readme)

<img src="https://media.giphy.com/media/3oEhmM10mIi1dkMfmg/giphy.gif" />

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






