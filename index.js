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

var Multimedia,
	FLVParser = require('./flv-parser.js'),
	MP4Parser = require('./mp3-parser.js'),
	MP4Parser = require('./mp4-parser.js'),
	MP4Iso = require('./mp4-iso.js'),
	MP4Mux = require('./mp4-mux.js'),
	MSEWriter = require('./mse-writer.js'),
	WebAudioSink = require('./web-audio-sink.js'),
    Unit = require('./unit.js');

module.exports = Multimedia = {};

Multimedia.Unit = Unit;