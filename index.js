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
    Unit = require('./src/unit.js'),
    MP4Mux  = require('./src/unit-mp4-mux.js'),
    MP3Mux  = require('./src/unit-mp3-parser.js');

// Node-only packages ...
var File = require('./src/unit-file.js');

module.exports = Multimedia = {
	Unit: Unit,
	Units: {
		File: File,
		MP4Mux: MP4Mux,
		MP3Parser: MP3Parser
	}
};
