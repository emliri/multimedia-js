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
var UnitMP4Mux,
    Unit = require('./unit.js'),
    BaseTransform = Unit.BaseTransform,
    BaseParser = Unit.BaseParser,
    MP4Mux = require('./mp4-mux.js');

module.exports = UnitMP4Mux = function UnitMP4Mux(mp4MuxProfile, useWorker) {
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

  if (useWorker) {
    this.worker = typeof Worker !== 'undefined' ? new Worker('/dist/mp4-mux-worker-bundle.js') : null;
  }

  if (this.worker) {
    this.worker.onmessage = function(e) {
      this._onMp4Data(e.data);
    }.bind(this);
    this.worker.postMessage({mp4MuxProfile: mp4MuxProfile});
  }
}

UnitMP4Mux.Profiles = MP4Mux.Profiles;

UnitMP4Mux.prototype = Unit.createBaseParser({

	constructor: UnitMP4Mux,

	_onMp4Data: function(data) {
    log("_onMp4Data");
		this.enqueue(new Unit.Transfer(new Buffer(data), 'buffer'));
	},

	_onCodecInfo: function(codecInfo) {
		log("Codec info: " + codecInfo);
		this._codecInfo = codecInfo;
	},

	_onFinish: function(input) {
    log('MP4Mux._onFinish');
    if (this.worker) {
      this.worker.postMessage({eos: true});
    } else if (this.muxer) {
      this.muxer.flush();
    }
    BaseParser.prototype._onFinish.call(this, input);
	},

	_parse: function(transfer) {
    var timestamp;
		if (transfer.data) {
			timestamp = this._timestamp = transfer.data.timestamp;
		}

    if (transfer.data.flush) {
      this._needFlush = true;
    }

  	log("UnitMP4Mux Timestamp: " + this._timestamp);
  	log("UnitMP4Mux._parse: Payload type: " + typeof(transfer.data));

    if (this.worker) {

      if (!transfer.data.empty) {
        this.worker.postMessage({data: transfer.data, meta: transfer.data.meta, timestamp: timestamp, packetType: MP4Mux.TYPE_AUDIO_PACKET});
      }

      if (this._needFlush) {
        this.worker.postMessage({eos: true});
        this._needFlush = false;
      }

    } else if (this.muxer) {

      if (!transfer.data.empty) {
        this.muxer.pushPacket(MP4Mux.TYPE_AUDIO_PACKET, new Uint8Array(transfer.data), timestamp, transfer.data.meta);
      }

      if (this._needFlush) {
        this.muxer.flush();
        this._needFlush = false;
      }
    }
  },
});
