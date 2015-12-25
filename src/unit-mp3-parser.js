/*

Copyright (c) Stephan Hesse 2015 <tchakabam@gmail.com>

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

*/

var log = require('./log');
var UnitMP3Parser,
	Unit = require('./unit.js'),
	BaseTransform = Unit.BaseTransform,
	MP3Parser = require('./mp3-parser.js'),
	Constants = require('./constants.js');

module.exports = UnitMP3Parser = function UnitMP3Parser() {
  	Unit.BaseParser.prototype.constructor.apply(this, arguments);

	this.parser = new MP3Parser();

	this.parser.onFrame = this._onMp3Frame.bind(this);
	this.parser.onNoise = this._onNoise.bind(this);
	this.parser.onClose = this._onClose.bind(this);

	this._sampleRate = 0;
	this._bitRate = 0;
	this._timestamp = 0;
}

UnitMP3Parser.prototype = Unit.createBaseParser({

	constructor: UnitMP3Parser,

	_onMp3Frame: function(data, bitRate, sampleRate) {
		log('Found frame length ' + data.length + ' bitRate=' + bitRate + ', sampleRate=' + sampleRate);
		var buffer = new Buffer(data);
		/* to avoid rounding issues, timescale is the sample-rate */
		var duration =  1152; // =(1152 / sampleRate) * sampleRate;

		buffer.meta = {
			mimeType: 'audio/mpeg',
			codecId: 2,
			channels: 2,
			bitRate: bitRate,
			sampleRate: sampleRate,
			sampleSize: 16,
		};

		buffer.duration = duration;
		buffer.timestamp = this._timestamp;
		this.enqueue(new Unit.Transfer(buffer, 'buffer'));

		this._bitRate = bitRate;
		this._timestamp += duration;
	},

	_onNoise: function() {
		log('mp3 has noise');
	},

	_onClose: function() {
		log('parser closed');
	},

	_parse: function(transfer) {

		log('parse called');

		this.parser.push(new Uint8Array(transfer.data));
	},
});