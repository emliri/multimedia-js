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

var UnitMP4Mux,
	Unit = require('./unit.js'),
	BaseTransform = Unit.BaseTransform,
	MP4Mux = require('./mp4-mux.js');

module.exports = UnitMP4Mux = function UnitMP4Mux(mp4MuxProfile) {
  Unit.BaseParser.prototype.constructor.apply(this, arguments);

  // Initialize with empty track info
  if (!mp4MuxProfile) {
    mp4MuxProfile = {
      audioTrackId: -1,
      videoTrackId: -1,
      tracks: [],
    };
  }

	this.muxer = new MP4Mux(mp4MuxProfile);

	this.muxer.ondata = this._onMp4Data.bind(this);
	this.muxer.oncodecinfo = this._onCodecInfo.bind(this);

	this._codecInfo = null;
	this._timestamp = 0;

	this.on('finish', this._onFinish.bind(this));
}

UnitMP4Mux.Profiles = MP4Mux.Profiles;

UnitMP4Mux.prototype = Unit.createBaseParser({

	constructor: UnitMP4Mux,

	_onMp4Data: function(data) {
		this.enqueue(new Unit.Transfer(new Buffer(data), 'buffer'));
	},

	_onCodecInfo: function(codecInfo) {
		console.log("Codec info: " + codecInfo);
		this._codecInfo = codecInfo;
	},

	_onFinish: function(input) {
		this.muxer.flush();
	},

	_parse: function(transfer) {

		if (transfer.data) {
			this._timestamp = transfer.data.timestamp;
		}

    	console.log("UnitMP4Mux Timestamp: " + this._timestamp);
    	console.log("UnitMP4Mux._parse: Payload type: " + typeof(transfer.data));

		this.muxer.pushPacket(MP4Mux.TYPE_AUDIO_PACKET, new Uint8Array(transfer.data), this._timestamp, transfer.data.meta);
	},
});