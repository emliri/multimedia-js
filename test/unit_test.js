var create = require('lodash.create'),
	mm = require('../index.js'),
	fs = require('../src/file.js'),
	Helpers = require('../src/helpers.js'),
	Unit = mm.Unit,
	UnitFile = mm.Units.File,
	UnitMP4Mux = mm.Units.MP4Mux,
	UnitMP3Parser = mm.Units.MP3Parser,
	Transfer = mm.Unit.Transfer,
	BaseSink = mm.Unit.BaseSink,
	BasePushSrc = mm.Unit.BasePushSrc;
	BaseTransform = mm.Unit.BaseTransform;

const FIXTURES_DIR = 'test/fixtures/';

var FooBarTransform = function FooBarTransform() {
	BaseTransform.prototype.constructor.apply(this, arguments);
};

FooBarTransform.prototype = create(BaseTransform.prototype, {

	constructor: FooBarTransform,

	_transform: function(transfer) {
		console.log('FooBarTransform._transform');

		transfer.data += 'barfoo';
		transfer.encoding = 'utf8';

		console.log(transfer.data);
	},
});

function testTransfer1(src, sink, done) {

	var transfer,
		dataCtr = 0;

	sink._onData = function() {
		transfer = sink.dequeue();

		console.log(transfer.encoding);
		console.log(transfer.data+"");

		dataCtr++;

		console.log('data ' + dataCtr);

		if (dataCtr == 4) {
			src.out(0).pause();

			//console.log(src.out(0).isPaused());

			src.enqueue(new Transfer('foobar', 'utf8'));
			src.enqueue(new Transfer('foobar', 'utf8'));
			src.enqueue(new Transfer('foobar', 'utf8'));
			src.enqueue(new Transfer('foobar', 'utf8'));

			src.out(0).resume();
		}
		else if (dataCtr == 5) {
			done();
		}
	};

	src.out(0).on('end', function() {
		console.log('end of stream');
	});

	src.out(0).pause();

	src.enqueue(new Transfer('foobar', 'utf8'));
	src.enqueue(new Transfer('foobar', 'utf8'));
	src.enqueue(new Transfer('foobar', 'utf8'));
	src.enqueue(new Transfer('foobar', 'utf8'));

	src.out(0).resume();
}

describe("Unit", function() {

	describe("BasePushSrc -> BaseSink", function() {

		it('should pass data', function (done) {

			var src = new BasePushSrc(),
				sink = new BaseSink();

						// link them
			src.out(0).pipe(sink.in(0));

			testTransfer1(src, sink, done);
		});

	});

	describe("BasePushSrc -> FooBarTransform -> BaseSink", function() {

		it('should pass data and transform it', function (done) {

			var src = new BasePushSrc(),
				transform = new FooBarTransform(),
				sink = new BaseSink();

			// link them
			Unit.link(src, transform, sink);

			testTransfer1(src, sink, done);
		});

	});

});

describe("UnitFile", function() {

	var foobar = FIXTURES_DIR + 'foobar.txt';
	var copy = FIXTURES_DIR + 'foobar_copy.txt';

	if (Helpers.haveGlobalWindow()) {
		return;
	}

	describe("basic tests", function() {
		it('should open', function (done) {
			var src = new UnitFile.Src(foobar);
			var sink = new UnitFile.Sink(copy);

			src.on('open', function() {done();});
		});

		it('should pipe', function (done) {
			var src = new UnitFile.Src(foobar);
			var sink = new UnitFile.Sink(copy);

			sink.on('finish', function() {done();});

			Unit.link(src, sink);

		});

		it('should pipe on opening', function (done) {
			var src = new UnitFile.Src(foobar);
			var sink = new UnitFile.Sink(copy);

			src.on('open', function() {
				Unit.link(src, sink);
			});

			sink.on('finish', function() {done();});

		});

		it('should write modified file', function (done) {
			var src = new UnitFile.Src(foobar),
				transform = new FooBarTransform(),
				sink = new UnitFile.Sink(copy);

			src.on('open', function() {
				Unit.link(src, transform, sink);
			});

			sink.on('finish', function() {done();});

		});

		afterEach(function() {
		    fs.unlinkSync(copy);
  		});

	});
});


describe("UnitMP3Parser", function() {

	if (Helpers.haveGlobalWindow()) {
		return;
	}

	describe("basic tests", function() {
		it('should initialize', function () {
			var unitMp3Parser = new UnitMP3Parser();
		});

		it('should parse a file', function (done) {
			var src = new UnitFile.Src(FIXTURES_DIR + 'shalafon.mp3'),
				parser = new UnitMP3Parser(),
				sink = new BaseSink();

			sink.on('finish', function() {done();});

			src.on('open', function() {
				console.log('file open');
				Unit.link(src, parser, sink);
			});

		});
	});
});

describe("UnitMP4Mux", function() {

	if (Helpers.haveGlobalWindow()) {
		return;
	}

	describe("constructor", function() {
		it('should initialize', function () {
			var unitMp4Mux = new UnitMP4Mux();
		});
	});

	describe("mux mp3 frames as mp4a payload", function() {
		it('should pass all data through', function (done) {
			var src = new UnitFile.Src(FIXTURES_DIR + 'shalafon.mp3'),
				parser = new UnitMP3Parser(),
				muxer = new UnitMP4Mux(UnitMP4Mux.Profiles.MP3_AUDIO_ONLY),
				sink = new UnitFile.Sink(FIXTURES_DIR + 'shalafon.mp4');

			// when the sink has processed last byte
			sink.on('finish', function() {
				done();
				// FIXME: make this work repeatedly
				/*
				console.log('done');
				src = new UnitFile.Src(FIXTURES_DIR + 'shalafon.mp3');
				Unit.link(src, parser);
				*/
			});

			// when the src has pushed last byte
			src.on('end', function() {
				// file handle is released now
			});

			src.on('open', function() {
				console.log('file open');
				Unit.link(src, parser, muxer, sink);
			});


		});
	});
});

describe("UnitMSESink", function() {

	if (!Helpers.haveMediaSourceExtensions()) {
		return;
	}

	describe("constructor", function() {
		it('should initialize', function () {

			var unitMseSink = new mm.Units.MSESink('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');


		});
	});

	describe("mp3 playback pipeline", function() {
		it('should play', function () {

			var mimeType = 'audio/mpeg';

			if (!Helpers.haveMediaSourceSupportMimeType('audio/mpeg')) {
				return;
			}

			var	xhrSrc = new mm.Units.XHR.Src('test/fixtures/shalafon.mp3');
			var transform = new Unit.BaseTransform();
			transform._transform = function(transfer) {
				transfer.data.timestamp = 0;
			};
			var unitMseSink = new mm.Units.MSESink(mimeType);
			var media = document.createElement('audio');

			media.controls = true;

			document.body.appendChild(media);

			media.src = window.URL.createObjectURL(unitMseSink.mediaSource);

			Unit.link(xhrSrc, transform, unitMseSink);

			media.play();
		});
	});

	/*
	describe("mp4 audio playback pipeline", function() {
		it('should play', function () {

			var	xhrSrc = new mm.Units.XHR.Src('test/fixtures/Dolphins.mp4');
			var transform = new Unit.BaseTransform();
			transform._transform = function(transfer) {
				transfer.data.timestamp = 0;
			};
			var unitMseSink = new mm.Units.MSESink('audio/mp4');

			var media = document.createElement('audio');

			media.controls = true;

			document.body.appendChild(media);

			media.src = window.URL.createObjectURL(unitMseSink.mediaSource);

			Unit.link(xhrSrc, transform, unitMseSink);

			media.play();
		});
	});
	*/

	describe("mp3->mp4 audio muxing & playback pipeline", function() {
		it('should play', function () {

			var mimeType = 'audio/mp4; codecs="mp4a.40.2"';

			if (!Helpers.haveMediaSourceSupportMimeType(mimeType)) {
				return;
			}

			var	xhrSrc = new mm.Units.XHR.Src('test/fixtures/shalafon.mp3'),
		    	parser = new UnitMP3Parser(),
				muxer = new UnitMP4Mux(UnitMP4Mux.Profiles.MP3_AUDIO_ONLY);
			var transform = new Unit.BaseTransform();
			transform._transform = function(transfer) {
				transfer.data.timestamp = 0;
			};
			var unitMseSink = new mm.Units.MSESink(mimeType);
			var media = document.createElement('audio');

			media.controls = true;

			document.body.appendChild(media);

			media.src = window.URL.createObjectURL(unitMseSink.mediaSource);

			Unit.link(xhrSrc, parser, muxer, transform, unitMseSink);

			media.play();
		});
	});

});
