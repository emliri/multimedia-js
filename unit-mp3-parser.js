var UnitMP3Parser,
	Unit = require('./unit.js'),
	BaseTransform = Unit.BaseTransform,
	MP3Parser = require('./mp3-parser.js');

module.exports = UnitMP3Parser = function UnitMP3Parser() {
  	Unit.BaseParser.prototype.constructor.apply(this, arguments);

	this.parser = new MP3Parser();

	this.parser.onFrame = this._onMp3Frame.bind(this);
	this.parser.onNoise = this._onNoise.bind(this);
	this.parser.onClose = this._onClose.bind(this);

	this._sampleRate = 0;
	this._bitRate = 0;
}

UnitMP3Parser.prototype = Unit.createBaseParser({

	constructor: UnitMP3Parser,

	_onMp3Frame: function(data, bitRate, sampleRate) {
		console.log('Found frame length ' + data.length + ' bitRate=' + bitRate + ', sampleRate='+sampleRate);
		var buffer = new Buffer(data);
		buffer.mimeType = 'audio/mpeg';
		buffer.bitRate = this._bitRate = bitRate;
		buffer.sampleRate = this._sampleRate = sampleRate;
		this.enqueue(new Unit.Transfer(buffer, 'buffer'));
	},

	_onNoise: function() {
		console.log('mp3 has noise');
	},

	_onClose: function() {
		console.log('parser closed');
	},

	_parse: function(transfer) {

		console.log('parse called');

		if (transfer.data) {
			this._timestamp = transfer.data.timestamp;
		}

		this.parser.push(new Uint8Array(transfer.data));
	},
});