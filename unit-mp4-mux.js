var UnitMP4Mux,
	Unit = require('./unit.js'),
	BaseTransform = Unit.BaseTransform,
	MP4Mux = require('./mp4-mux.js');

module.exports = UnitMP4Mux = function UnitMP4Mux() {
  	Unit.BaseParser.prototype.constructor.apply(this, arguments);

	this.muxer = new MP4Mux({
		audioTrackId: 0,
		videoTrackId: -1,
		tracks: [
			{
				codecId: MP4Mux.MP3_SOUND_CODEC_ID,
				channels: 2,
				samplerate: 44100,
				samplesize: 16,
			},
		],
	});

	this.muxer.ondata = this._onMp4Data.bind(this);
	this.muxer.oncodecinfo = this._onCodecInfo.bind(this);

	this._codecInfo = null;
	this._timestamp = 0;

	this.on('finish', this._onFinish.bind(this));
}

UnitMP4Mux.prototype = Unit.createBaseParser({

	constructor: UnitMP4Mux,

	_onMp4Data: function(data) {
		this.enqueue(new Unit.Transfer(new Buffer(data), 'buffer'));
	},

	_onCodecInfo: function(codecInfo) {
		console.log(codecInfo);
		this._codecInfo = codecInfo;
	},

	_onFinish: function(input) {
		this.muxer.flush();
	},

	_parse: function(transfer) {

		if (transfer.data) {
			this._timestamp = transfer.data.timestamp;
		}
		this.muxer.pushPacket(MP4Mux.TYPE_AUDIO_PACKET, transfer.data, this._timestamp);
	},
});