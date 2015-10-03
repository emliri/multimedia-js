this["multimedia"] =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ((function(modules) {
	// Check all modules for deduplicated modules
	for(var i in modules) {
		if(Object.prototype.hasOwnProperty.call(modules, i)) {
			switch(typeof modules[i]) {
			case "function": break;
			case "object":
				// Module can be created from a template
				modules[i] = (function(_m) {
					var args = _m.slice(1), fn = modules[_m[0]];
					return function (a,b,c) {
						fn.apply(this, [a,b,c].concat(args));
					};
				}(modules[i]));
				break;
			default:
				// Module is a copy of another module
				modules[i] = modules[modules[i]];
				break;
			}
		}
	}
	return modules;
}([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	var Multimedia,
		FLVParser = __webpack_require__(1),
		MP4Parser = __webpack_require__(2),
		MP4Parser = __webpack_require__(3),
		MP4Iso = __webpack_require__(4),
		MP4Mux = __webpack_require__(5),
		MSEWriter = __webpack_require__(6),
		WebAudioSink = __webpack_require__(7),
	    Unit = __webpack_require__(8);

	module.exports = Multimedia = {};

	Multimedia.Unit = Unit;

/***/ },
/* 1 */
/***/ function(module, exports) {

	/**
	 * This file was transpiled from TypeScript and modifed from the Mozila RTMP.js research project (https://github.com/yurydelendik/rtmp.js)
	 *
	 * Copyright 2015 Mozilla Foundation, Copyright 2015 SoundCloud Ltd., Copyright 2015 Stephan Hesse <tchakabam@gmail.com>
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 * http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */

	    var FLVParser = (function () {
	        function FLVParser() {
	            this.state = 0;
	            this.state = 0;
	            this.buffer = new ArrayBuffer(1024);
	            this.bufferSize = 0;
	            this.previousTagSize = 0;
	            this.onError = null;
	            this.onHeader = null;
	            this.onTag = null;
	            this.onClose = null;
	        }
	        FLVParser.prototype.push = function (data) {
	            var parseBuffer;
	            if (this.bufferSize > 0) {
	                var needLength = this.bufferSize + data.length;
	                if (this.buffer.byteLength < needLength) {
	                    var tmp = new Uint8Array(this.buffer, 0, this.bufferSize);
	                    this.buffer = new ArrayBuffer(needLength);
	                    parseBuffer = new Uint8Array(this.buffer);
	                    parseBuffer.set(tmp);
	                }
	                else {
	                    parseBuffer = new Uint8Array(this.buffer, 0, needLength);
	                }
	                parseBuffer.set(data, this.bufferSize);
	            }
	            else {
	                parseBuffer = data;
	            }
	            var parsed = 0, end = parseBuffer.length;
	            while (parsed < end) {
	                var chunkParsed = 0;
	                switch (this.state) {
	                    case 0:
	                        if (parsed + 9 > end) {
	                            break;
	                        }
	                        var headerLength = (parseBuffer[parsed + 5] << 24) | (parseBuffer[parsed + 6] << 16) |
	                            (parseBuffer[parsed + 7] << 8) | parseBuffer[parsed + 8];
	                        if (headerLength < 9) {
	                            this._error('Invalid header length');
	                            break;
	                        }
	                        if (parsed + headerLength > end) {
	                            break;
	                        }
	                        if (parseBuffer[parsed] !== 0x46 /* F */ ||
	                            parseBuffer[parsed + 1] !== 0x4C /* L */ ||
	                            parseBuffer[parsed + 2] !== 0x56 /* V */ ||
	                            parseBuffer[parsed + 3] !== 1 /* version 1 */ ||
	                            (parseBuffer[parsed + 4] & 0xFA) !== 0) {
	                            this._error('Invalid FLV header');
	                            break;
	                        }
	                        var flags = parseBuffer[parsed + 4];
	                        var extra = headerLength > 9 ? parseBuffer.subarray(parsed + 9, parsed + headerLength) : null;
	                        this.onHeader && this.onHeader({
	                            hasAudio: !!(flags & 4),
	                            hasVideo: !!(flags & 1),
	                            extra: extra
	                        });
	                        this.state = 2;
	                        chunkParsed = headerLength;
	                        break;
	                    case 2:
	                        if (parsed + 4 + 11 > end) {
	                            break;
	                        }
	                        var previousTagSize = (parseBuffer[parsed + 0] << 24) | (parseBuffer[parsed + 1] << 16) |
	                            (parseBuffer[parsed + 2] << 8) | parseBuffer[parsed + 3];
	                        if (previousTagSize !== this.previousTagSize) {
	                            this._error('Invalid PreviousTagSize');
	                            break;
	                        }
	                        var dataSize = (parseBuffer[parsed + 5] << 16) |
	                            (parseBuffer[parsed + 6] << 8) | parseBuffer[parsed + 7];
	                        var dataOffset = parsed + 4 + 11;
	                        if (dataOffset + dataSize > end) {
	                            break;
	                        }
	                        var flags = parseBuffer[parsed + 4];
	                        var streamID = (parseBuffer[parsed + 12] << 16) |
	                            (parseBuffer[parsed + 13] << 8) | parseBuffer[parsed + 14];
	                        if (streamID !== 0 || (flags & 0xC0) !== 0) {
	                            this._error('Invalid FLV tag');
	                            break;
	                        }
	                        var dataType = flags & 0x1F;
	                        if (dataType !== 8 && dataType !== 9 && dataType !== 18) {
	                            this._error('Invalid FLV tag type');
	                            break;
	                        }
	                        var needPreprocessing = !!(flags & 0x20);
	                        var timestamp = (parseBuffer[parsed + 8] << 16) |
	                            (parseBuffer[parsed + 9] << 8) | parseBuffer[parsed + 10] |
	                            (parseBuffer[parseBuffer + 11] << 24);
	                        this.onTag && this.onTag({
	                            type: dataType,
	                            needPreprocessing: needPreprocessing,
	                            timestamp: timestamp,
	                            data: parseBuffer.subarray(dataOffset, dataOffset + dataSize)
	                        });
	                        chunkParsed += 4 + 11 + dataSize;
	                        this.previousTagSize = dataSize + 11;
	                        this.state = 2;
	                        break;
	                    default:
	                        throw new Error('invalid state');
	                }
	                if (chunkParsed === 0) {
	                    break; // not enough data
	                }
	                parsed += chunkParsed;
	            }
	            if (parsed < parseBuffer.length) {
	                this.bufferSize = parseBuffer.length - parsed;
	                if (this.buffer.byteLength < this.bufferSize) {
	                    this.buffer = new ArrayBuffer(this.bufferSize);
	                }
	                new Uint8Array(this.buffer).set(parseBuffer.subarray(parsed));
	            }
	            else {
	                this.bufferSize = 0;
	            }
	        };
	        FLVParser.prototype._error = function (message) {
	            this.state = -1;
	            this.onError && this.onError(message);
	        };
	        FLVParser.prototype.close = function () {
	            this.onClose && this.onClose();
	        };
	        return FLVParser;
	    })();

	    module.exports = FLVParser;


/***/ },
/* 2 */
/***/ function(module, exports) {

	/**
	 * This file was transpiled from TypeScript and modifed from the Mozila RTMP.js research project (https://github.com/yurydelendik/rtmp.js)
	 *
	 * Copyright 2015 Mozilla Foundation, Copyright 2015 SoundCloud Ltd., Copyright 2015 Stephan Hesse <tchakabam@gmail.com>
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 * http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */

	    var BitratesMap = [
	        32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448,
	        32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384,
	        32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
	        32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256,
	        8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
	    var SamplingRateMap = [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000];
	    var MP3Parser = (function () {
	        function MP3Parser() {
	            this.buffer = null;
	            this.bufferSize = 0;
	        }
	        MP3Parser.prototype.push = function (data) {
	            var length;
	            if (this.bufferSize > 0) {
	                var needBuffer = data.length + this.bufferSize;
	                if (!this.buffer || this.buffer.length < needBuffer) {
	                    var newBuffer = new Uint8Array(needBuffer);
	                    if (this.bufferSize > 0) {
	                        newBuffer.set(this.buffer.subarray(0, this.bufferSize));
	                    }
	                    this.buffer = newBuffer;
	                }
	                this.buffer.set(data, this.bufferSize);
	                this.bufferSize = needBuffer;
	                data = this.buffer;
	                length = needBuffer;
	            }
	            else {
	                length = data.length;
	            }
	            var offset = 0;
	            var parsed;
	            while (offset < length &&
	                (parsed = this._parse(data, offset, length)) > 0) {
	                offset += parsed;
	            }
	            var tail = length - offset;
	            if (tail > 0) {
	                if (!this.buffer || this.buffer.length < tail) {
	                    this.buffer = new Uint8Array(data.subarray(offset, length));
	                }
	                else {
	                    this.buffer.set(data.subarray(offset, length));
	                }
	            }
	            this.bufferSize = tail;
	        };
	        MP3Parser.prototype._parse = function (data, start, end) {
	            if (start + 2 > end) {
	                return -1; // we need at least 2 bytes to detect sync pattern
	            }
	            if (data[start] === 0xFF || (data[start + 1] & 0xE0) === 0xE0) {
	                // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
	                if (start + 24 > end) {
	                    return -1;
	                }
	                var headerB = (data[start + 1] >> 3) & 3;
	                var headerC = (data[start + 1] >> 1) & 3;
	                var headerE = (data[start + 2] >> 4) & 15;
	                var headerF = (data[start + 2] >> 2) & 3;
	                var headerG = !!(data[start + 2] & 2);
	                if (headerB !== 1 && headerE !== 0 && headerE !== 15 && headerF !== 3) {
	                    var columnInBitrates = headerB === 3 ? (3 - headerC) : (headerC === 3 ? 3 : 4);
	                    var bitRate = BitratesMap[columnInBitrates * 14 + headerE - 1] * 1000;
	                    var columnInSampleRates = headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
	                    var sampleRate = SamplingRateMap[columnInSampleRates * 3 + headerF];
	                    var padding = headerG ? 1 : 0;
	                    var frameLength = headerC === 3 ?
	                        ((headerB === 3 ? 12 : 6) * bitRate / sampleRate + padding) << 2 :
	                        ((headerB === 3 ? 144 : 72) * bitRate / sampleRate + padding) | 0;
	                    if (start + frameLength > end) {
	                        return -1;
	                    }
	                    if (this.onFrame) {
	                        this.onFrame(data.subarray(start, start + frameLength));
	                    }
	                    return frameLength;
	                }
	            }
	            // noise or ID3, trying to skip
	            var offset = start + 2;
	            while (offset < end) {
	                if (data[offset - 1] === 0xFF && (data[offset] & 0xE0) === 0xE0) {
	                    // sync pattern is found
	                    if (this.onNoise) {
	                        this.onNoise(data.subarray(start, offset - 1));
	                    }
	                    return offset - start - 1;
	                }
	                offset++;
	            }
	            return -1;
	        };
	        MP3Parser.prototype.close = function () {
	            if (this.bufferSize > 0) {
	                if (this.onNoise) {
	                    this.onNoise(this.buffer.subarray(0, this.bufferSize));
	                }
	            }
	            this.buffer = null;
	            this.bufferSize = 0;
	            if (this.onClose) {
	                this.onClose();
	            }
	        };
	        return MP3Parser;
	    })();
	    module.exports = MP3Parser;


/***/ },
/* 3 */
/***/ function(module, exports) {

	/*

	Modified from https://github.com/mbebenita/Broadway

	The following authors have all licensed their contributions to the project
	under the licensing terms detailed below.

	Michael Bebenita <mbebenita@gmail.com>
	Alon Zakai <alonzakai@gmail.com>
	Andreas Gal <gal@mozilla.com>
	Mathieu 'p01' Henri <mathieu@p01.org>
	Matthias 'soliton4' Behrens <matthias.behrens@gmail.com>
	Stephan Hesse <tchakabam@gmail.com>

	All rights reserved.

	Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

	  *  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
	  *  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
	  *  Neither the names of the Project Authors nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	*/

	function assert(condition, message) {
	  if (!condition) {
	    error(message);
	  }
	};


	/**
	 * Represents a 2-dimensional size value.
	 */
	var Size = (function size() {
	  function constructor(w, h) {
	    this.w = w;
	    this.h = h;
	  }
	  constructor.prototype = {
	    toString: function () {
	      return "(" + this.w + ", " + this.h + ")";
	    },
	    getHalfSize: function() {
	      return new Size(this.w >>> 1, this.h >>> 1);
	    },
	    length: function() {
	      return this.w * this.h;
	    }
	  };
	  return constructor;
	})();





	var Bytestream = (function BytestreamClosure() {
	  function constructor(arrayBuffer, start, length) {
	    this.bytes = new Uint8Array(arrayBuffer);
	    this.start = start || 0;
	    this.pos = this.start;
	    this.end = (start + length) || this.bytes.length;
	  }
	  constructor.prototype = {
	    get length() {
	      return this.end - this.start;
	    },
	    get position() {
	      return this.pos;
	    },
	    get remaining() {
	      return this.end - this.pos;
	    },
	    readU8Array: function (length) {
	      if (this.pos > this.end - length)
	        return null;
	      var res = this.bytes.subarray(this.pos, this.pos + length);
	      this.pos += length;
	      return res;
	    },
	    readU32Array: function (rows, cols, names) {
	      cols = cols || 1;
	      if (this.pos > this.end - (rows * cols) * 4)
	        return null;
	      if (cols == 1) {
	        var array = new Uint32Array(rows);
	        for (var i = 0; i < rows; i++) {
	          array[i] = this.readU32();
	        }
	        return array;
	      } else {
	        var array = new Array(rows);
	        for (var i = 0; i < rows; i++) {
	          var row = null;
	          if (names) {
	            row = {};
	            for (var j = 0; j < cols; j++) {
	              row[names[j]] = this.readU32();
	            }
	          } else {
	            row = new Uint32Array(cols);
	            for (var j = 0; j < cols; j++) {
	              row[j] = this.readU32();
	            }
	          }
	          array[i] = row;
	        }
	        return array;
	      }
	    },
	    read8: function () {
	      return this.readU8() << 24 >> 24;
	    },
	    readU8: function () {
	      if (this.pos >= this.end)
	        return null;
	      return this.bytes[this.pos++];
	    },
	    read16: function () {
	      return this.readU16() << 16 >> 16;
	    },
	    readU16: function () {
	      if (this.pos >= this.end - 1)
	        return null;
	      var res = this.bytes[this.pos + 0] << 8 | this.bytes[this.pos + 1];
	      this.pos += 2;
	      return res;
	    },
	    read24: function () {
	      return this.readU24() << 8 >> 8;
	    },
	    readU24: function () {
	      var pos = this.pos;
	      var bytes = this.bytes;
	      if (pos > this.end - 3)
	        return null;
	      var res = bytes[pos + 0] << 16 | bytes[pos + 1] << 8 | bytes[pos + 2];
	      this.pos += 3;
	      return res;
	    },
	    peek32: function (advance) {
	      var pos = this.pos;
	      var bytes = this.bytes;
	      if (pos > this.end - 4)
	        return null;
	      var res = bytes[pos + 0] << 24 | bytes[pos + 1] << 16 | bytes[pos + 2] << 8 | bytes[pos + 3];
	      if (advance) {
	        this.pos += 4;
	      }
	      return res;
	    },
	    read32: function () {
	      return this.peek32(true);
	    },
	    readU32: function () {
	      return this.peek32(true) >>> 0;
	    },
	    read4CC: function () {
	      var pos = this.pos;
	      if (pos > this.end - 4)
	        return null;
	      var res = "";
	      for (var i = 0; i < 4; i++) {
	        res += String.fromCharCode(this.bytes[pos + i]);
	      }
	      this.pos += 4;
	      return res;
	    },
	    readFP16: function () {
	      return this.read32() / 65536;
	    },
	    readFP8: function () {
	      return this.read16() / 256;
	    },
	    readISO639: function () {
	      var bits = this.readU16();
	      var res = "";
	      for (var i = 0; i < 3; i++) {
	        var c = (bits >>> (2 - i) * 5) & 0x1f;
	        res += String.fromCharCode(c + 0x60);
	      }
	      return res;
	    },
	    readUTF8: function (length) {
	      var res = "";
	      for (var i = 0; i < length; i++) {
	        res += String.fromCharCode(this.readU8());
	      }
	      return res;
	    },
	    readPString: function (max) {
	      var len = this.readU8();
	      assert (len <= max);
	      var res = this.readUTF8(len);
	      this.reserved(max - len - 1, 0);
	      return res;
	    },
	    skip: function (length) {
	      this.seek(this.pos + length);
	    },
	    reserved: function (length, value) {
	      for (var i = 0; i < length; i++) {
	        assert (this.readU8() == value);
	      }
	    },
	    seek: function (index) {
	      if (index < 0 || index > this.end) {
	        error("Index out of bounds (bounds: [0, " + this.end + "], index: " + index + ").");
	      }
	      this.pos = index;
	    },
	    subStream: function (start, length) {
	      return new Bytestream(this.bytes.buffer, start, length);
	    }
	  };
	  return constructor;
	})();


	var PARANOID = true; // Heavy-weight assertions.

	/**
	 * Reads an mp4 file and constructs a object graph that corresponds to the box/atom
	 * structure of the file. Mp4 files are based on the ISO Base Media format, which in
	 * turn is based on the Apple Quicktime format. The Quicktime spec is available at:
	 * http://developer.apple.com/library/mac/#documentation/QuickTime/QTFF. An mp4 spec
	 * also exists, but I cannot find it freely available.
	 *
	 * Mp4 files contain a tree of boxes (or atoms in Quicktime). The general structure
	 * is as follows (in a pseudo regex syntax):
	 *
	 * Box / Atom Structure:
	 *
	 * [size type [version flags] field* box*]
	 *  <32> <4C>  <--8--> <24->  <-?->  <?>
	 *  <------------- box size ------------>
	 *
	 *  The box size indicates the entire size of the box and its children, we can use it
	 *  to skip over boxes that are of no interest. Each box has a type indicated by a
	 *  four character code (4C), this describes how the box should be parsed and is also
	 *  used as an object key name in the resulting box tree. For example, the expression:
	 *  "moov.trak[0].mdia.minf" can be used to access individual boxes in the tree based
	 *  on their 4C name. If two or more boxes with the same 4C name exist in a box, then
	 *  an array is built with that name.
	 *
	 */

	var MP4Reader = (function reader() {
	  var BOX_HEADER_SIZE = 8;
	  var FULL_BOX_HEADER_SIZE = BOX_HEADER_SIZE + 4;

	  function constructor(stream) {
	    this.stream = stream;
	    this.tracks = {};
	  }

	  constructor.prototype = {
	    readBoxes: function (stream, parent) {
	      while (stream.peek32()) {
	        var child = this.readBox(stream);
	        if (child.type in parent) {
	          var old = parent[child.type];
	          if (!(old instanceof Array)) {
	            parent[child.type] = [old];
	          }
	          parent[child.type].push(child);
	        } else {
	          parent[child.type] = child;
	        }
	      }
	    },
	    readBox: function readBox(stream) {
	      var box = { offset: stream.position };

	      function readHeader() {
	        box.size = stream.readU32();
	        box.type = stream.read4CC();
	      }

	      function readFullHeader() {
	        box.version = stream.readU8();
	        box.flags = stream.readU24();
	      }

	      function remainingBytes() {
	        return box.size - (stream.position - box.offset);
	      }

	      function skipRemainingBytes () {
	        stream.skip(remainingBytes());
	      }

	      var readRemainingBoxes = function () {
	        var subStream = stream.subStream(stream.position, remainingBytes());
	        this.readBoxes(subStream, box);
	        stream.skip(subStream.length);
	      }.bind(this);

	      readHeader();

	      switch (box.type) {
	        case 'ftyp':
	          box.name = "File Type Box";
	          box.majorBrand = stream.read4CC();
	          box.minorVersion = stream.readU32();
	          box.compatibleBrands = new Array((box.size - 16) / 4);
	          for (var i = 0; i < box.compatibleBrands.length; i++) {
	            box.compatibleBrands[i] = stream.read4CC();
	          }
	          break;
	        case 'moov':
	          box.name = "Movie Box";
	          readRemainingBoxes();
	          break;
	        case 'mvhd':
	          box.name = "Movie Header Box";
	          readFullHeader();
	          assert (box.version == 0);
	          box.creationTime = stream.readU32();
	          box.modificationTime = stream.readU32();
	          box.timeScale = stream.readU32();
	          box.duration = stream.readU32();
	          box.rate = stream.readFP16();
	          box.volume = stream.readFP8();
	          stream.skip(10);
	          box.matrix = stream.readU32Array(9);
	          stream.skip(6 * 4);
	          box.nextTrackId = stream.readU32();
	          break;
	        case 'trak':
	          box.name = "Track Box";
	          readRemainingBoxes();
	          this.tracks[box.tkhd.trackId] = new Track(this, box);
	          break;
	        case 'tkhd':
	          box.name = "Track Header Box";
	          readFullHeader();
	          assert (box.version == 0);
	          box.creationTime = stream.readU32();
	          box.modificationTime = stream.readU32();
	          box.trackId = stream.readU32();
	          stream.skip(4);
	          box.duration = stream.readU32();
	          stream.skip(8);
	          box.layer = stream.readU16();
	          box.alternateGroup = stream.readU16();
	          box.volume = stream.readFP8();
	          stream.skip(2);
	          box.matrix = stream.readU32Array(9);
	          box.width = stream.readFP16();
	          box.height = stream.readFP16();
	          break;
	        case 'mdia':
	          box.name = "Media Box";
	          readRemainingBoxes();
	          break;
	        case 'mdhd':
	          box.name = "Media Header Box";
	          readFullHeader();
	          assert (box.version == 0);
	          box.creationTime = stream.readU32();
	          box.modificationTime = stream.readU32();
	          box.timeScale = stream.readU32();
	          box.duration = stream.readU32();
	          box.language = stream.readISO639();
	          stream.skip(2);
	          break;
	        case 'hdlr':
	          box.name = "Handler Reference Box";
	          readFullHeader();
	          stream.skip(4);
	          box.handlerType = stream.read4CC();
	          stream.skip(4 * 3);
	          var bytesLeft = box.size - 32;
	          if (bytesLeft > 0) {
	            box.name = stream.readUTF8(bytesLeft);
	          }
	          break;
	        case 'minf':
	          box.name = "Media Information Box";
	          readRemainingBoxes();
	          break;
	        case 'stbl':
	          box.name = "Sample Table Box";
	          readRemainingBoxes();
	          break;
	        case 'stsd':
	          box.name = "Sample Description Box";
	          readFullHeader();
	          box.sd = [];
	          var entries = stream.readU32();
	          readRemainingBoxes();
	          break;
	        case 'avc1':
	          stream.reserved(6, 0);
	          box.dataReferenceIndex = stream.readU16();
	          assert (stream.readU16() == 0); // Version
	          assert (stream.readU16() == 0); // Revision Level
	          stream.readU32(); // Vendor
	          stream.readU32(); // Temporal Quality
	          stream.readU32(); // Spatial Quality
	          box.width = stream.readU16();
	          box.height = stream.readU16();
	          box.horizontalResolution = stream.readFP16();
	          box.verticalResolution = stream.readFP16();
	          assert (stream.readU32() == 0); // Reserved
	          box.frameCount = stream.readU16();
	          box.compressorName = stream.readPString(32);
	          box.depth = stream.readU16();
	          assert (stream.readU16() == 0xFFFF); // Color Table Id
	          readRemainingBoxes();
	          break;
	        case 'mp4a':
	          stream.reserved(6, 0);
	          box.dataReferenceIndex = stream.readU16();
	          box.version = stream.readU16();
	          stream.skip(2);
	          stream.skip(4);
	          box.channelCount = stream.readU16();
	          box.sampleSize = stream.readU16();
	          box.compressionId = stream.readU16();
	          box.packetSize = stream.readU16();
	          box.sampleRate = stream.readU32() >>> 16;

	          // TODO: Parse other version levels.
	          assert (box.version == 0);
	          readRemainingBoxes();
	          break;
	        case 'esds':
	          box.name = "Elementary Stream Descriptor";
	          readFullHeader();
	          // TODO: Do we really need to parse this?
	          skipRemainingBytes();
	          break;
	        case 'avcC':
	          box.name = "AVC Configuration Box";
	          box.configurationVersion = stream.readU8();
	          box.avcProfileIndicaation = stream.readU8();
	          box.profileCompatibility = stream.readU8();
	          box.avcLevelIndication = stream.readU8();
	          box.lengthSizeMinusOne = stream.readU8() & 3;
	          assert (box.lengthSizeMinusOne == 3, "TODO");
	          var count = stream.readU8() & 31;
	          box.sps = [];
	          for (var i = 0; i < count; i++) {
	            box.sps.push(stream.readU8Array(stream.readU16()));
	          }
	          var count = stream.readU8() & 31;
	          box.pps = [];
	          for (var i = 0; i < count; i++) {
	            box.pps.push(stream.readU8Array(stream.readU16()));
	          }
	          skipRemainingBytes();
	          break;
	        case 'btrt':
	          box.name = "Bit Rate Box";
	          box.bufferSizeDb = stream.readU32();
	          box.maxBitrate = stream.readU32();
	          box.avgBitrate = stream.readU32();
	          break;
	        case 'stts':
	          box.name = "Decoding Time to Sample Box";
	          readFullHeader();
	          box.table = stream.readU32Array(stream.readU32(), 2, ["count", "delta"]);
	          break;
	        case 'stss':
	          box.name = "Sync Sample Box";
	          readFullHeader();
	          box.samples = stream.readU32Array(stream.readU32());
	          break;
	        case 'stsc':
	          box.name = "Sample to Chunk Box";
	          readFullHeader();
	          box.table = stream.readU32Array(stream.readU32(), 3,
	            ["firstChunk", "samplesPerChunk", "sampleDescriptionId"]);
	          break;
	        case 'stsz':
	          box.name = "Sample Size Box";
	          readFullHeader();
	          box.sampleSize = stream.readU32();
	          var count = stream.readU32();
	          if (box.sampleSize == 0) {
	            box.table = stream.readU32Array(count);
	          }
	          break;
	        case 'stco':
	          box.name = "Chunk Offset Box";
	          readFullHeader();
	          box.table = stream.readU32Array(stream.readU32());
	          break;
	        case 'smhd':
	          box.name = "Sound Media Header Box";
	          readFullHeader();
	          box.balance = stream.readFP8();
	          stream.reserved(2, 0);
	          break;
	        case 'mdat':
	          box.name = "Media Data Box";
	          assert (box.size >= 8, "Cannot parse large media data yet.");
	          box.data = stream.readU8Array(remainingBytes());
	          break;
	        default:
	          skipRemainingBytes();
	          break;
	      };
	      return box;
	    },
	    read: function () {
	      var start = (new Date).getTime();
	      this.file = {};
	      this.readBoxes(this.stream, this.file);
	      console.info("Parsed stream in " + ((new Date).getTime() - start) + " ms");
	    },
	    traceSamples: function () {
	      var video = this.tracks[1];
	      var audio = this.tracks[2];

	      console.info("Video Samples: " + video.getSampleCount());
	      console.info("Audio Samples: " + audio.getSampleCount());

	      var vi = 0;
	      var ai = 0;

	      for (var i = 0; i < 100; i++) {
	        var vo = video.sampleToOffset(vi);
	        var ao = audio.sampleToOffset(ai);

	        var vs = video.sampleToSize(vi, 1);
	        var as = audio.sampleToSize(ai, 1);

	        if (vo < ao) {
	          console.info("V Sample " + vi + " Offset : " + vo + ", Size : " + vs);
	          vi ++;
	        } else {
	          console.info("A Sample " + ai + " Offset : " + ao + ", Size : " + as);
	          ai ++;
	        }
	      }
	    }
	  };
	  return constructor;
	})();

	var Track = (function track () {
	  function constructor(file, trak) {
	    this.file = file;
	    this.trak = trak;
	  }

	  constructor.prototype = {
	    getSampleSizeTable: function () {
	      return this.trak.mdia.minf.stbl.stsz.table;
	    },
	    getSampleCount: function () {
	      return this.getSampleSizeTable().length;
	    },
	    /**
	     * Computes the size of a range of samples, returns zero if length is zero.
	     */
	    sampleToSize: function (start, length) {
	      var table = this.getSampleSizeTable();
	      var size = 0;
	      for (var i = start; i < start + length; i++) {
	        size += table[i];
	      }
	      return size;
	    },
	    /**
	     * Computes the chunk that contains the specified sample, as well as the offset of
	     * the sample in the computed chunk.
	     */
	    sampleToChunk: function (sample) {

	      /* Samples are grouped in chunks which may contain a variable number of samples.
	       * The sample-to-chunk table in the stsc box describes how samples are arranged
	       * in chunks. Each table row corresponds to a set of consecutive chunks with the
	       * same number of samples and description ids. For example, the following table:
	       *
	       * +-------------+-------------------+----------------------+
	       * | firstChunk  |  samplesPerChunk  |  sampleDescriptionId |
	       * +-------------+-------------------+----------------------+
	       * | 1           |  3                |  23                  |
	       * | 3           |  1                |  23                  |
	       * | 5           |  1                |  24                  |
	       * +-------------+-------------------+----------------------+
	       *
	       * describes 5 chunks with a total of (2 * 3) + (2 * 1) + (1 * 1) = 9 samples,
	       * each chunk containing samples 3, 3, 1, 1, 1 in chunk order, or
	       * chunks 1, 1, 1, 2, 2, 2, 3, 4, 5 in sample order.
	       *
	       * This function determines the chunk that contains a specified sample by iterating
	       * over every entry in the table. It also returns the position of the sample in the
	       * chunk which can be used to compute the sample's exact position in the file.
	       *
	       * TODO: Determine if we should memoize this function.
	       */

	      var table = this.trak.mdia.minf.stbl.stsc.table;

	      if (table.length === 1) {
	        var row = table[0];
	        assert (row.firstChunk === 1);
	        return {
	          index: sample / row.samplesPerChunk,
	          offset: sample % row.samplesPerChunk
	        };
	      }

	      var totalChunkCount = 0;
	      for (var i = 0; i < table.length; i++) {
	        var row = table[i];
	        if (i > 0) {
	          var previousRow = table[i - 1];
	          var previousChunkCount = row.firstChunk - previousRow.firstChunk;
	          var previousSampleCount = previousRow.samplesPerChunk * previousChunkCount;
	          if (sample >= previousSampleCount) {
	            sample -= previousSampleCount;
	            if (i == table.length - 1) {
	              return {
	                index: totalChunkCount + previousChunkCount + Math.floor(sample / row.samplesPerChunk),
	                offset: sample % row.samplesPerChunk
	              };
	            }
	          } else {
	            return {
	              index: totalChunkCount + Math.floor(sample / previousRow.samplesPerChunk),
	              offset: sample % previousRow.samplesPerChunk
	            };
	          }
	          totalChunkCount += previousChunkCount;
	        }
	      }
	      assert(false);
	    },
	    chunkToOffset: function (chunk) {
	      var table = this.trak.mdia.minf.stbl.stco.table;
	      return table[chunk];
	    },
	    sampleToOffset: function (sample) {
	      var res = this.sampleToChunk(sample);
	      var offset = this.chunkToOffset(res.index);
	      return offset + this.sampleToSize(sample - res.offset, res.offset);
	    },
	    /**
	     * Computes the sample at the specified time.
	     */
	    timeToSample: function (time) {
	      /* In the time-to-sample table samples are grouped by their duration. The count field
	       * indicates the number of consecutive samples that have the same duration. For example,
	       * the following table:
	       *
	       * +-------+-------+
	       * | count | delta |
	       * +-------+-------+
	       * |   4   |   3   |
	       * |   2   |   1   |
	       * |   3   |   2   |
	       * +-------+-------+
	       *
	       * describes 9 samples with a total time of (4 * 3) + (2 * 1) + (3 * 2) = 20.
	       *
	       * This function determines the sample at the specified time by iterating over every
	       * entry in the table.
	       *
	       * TODO: Determine if we should memoize this function.
	       */
	      var table = this.trak.mdia.minf.stbl.stts.table;
	      var sample = 0;
	      for (var i = 0; i < table.length; i++) {
	        var delta = table[i].count * table[i].delta;
	        if (time >= delta) {
	          time -= delta;
	          sample += table[i].count;
	        } else {
	          return sample + Math.floor(time / table[i].delta);
	        }
	      }
	    },
	    /**
	     * Gets the total time of the track.
	     */
	    getTotalTime: function () {
	      if (PARANOID) {
	        var table = this.trak.mdia.minf.stbl.stts.table;
	        var duration = 0;
	        for (var i = 0; i < table.length; i++) {
	          duration += table[i].count * table[i].delta;
	        }
	        assert (this.trak.mdia.mdhd.duration == duration);
	      }
	      return this.trak.mdia.mdhd.duration;
	    },
	    getTotalTimeInSeconds: function () {
	      return this.timeToSeconds(this.getTotalTime());
	    },
	    getTimeScale: function () {
	      return this.trak.mdia.mdhd.timeScale;
	    },
	    /**
	     * Converts time units to real time (seconds).
	     */
	    timeToSeconds: function (time) {
	      return time / this.getTimeScale();
	    },
	    /**
	     * Converts real time (seconds) to time units.
	     */
	    secondsToTime: function (seconds) {
	      return seconds * this.getTimeScale();
	    },
	    foo: function () {
	      /*
	      for (var i = 0; i < this.getSampleCount(); i++) {
	        var res = this.sampleToChunk(i);
	        console.info("Sample " + i + " -> " + res.index + " % " + res.offset +
	                     " @ " + this.chunkToOffset(res.index) +
	                     " @@ " + this.sampleToOffset(i));
	      }
	      console.info("Total Time: " + this.timeToSeconds(this.getTotalTime()));
	      var total = this.getTotalTimeInSeconds();
	      for (var i = 50; i < total; i += 0.1) {
	        // console.info("Time: " + i.toFixed(2) + " " + this.secondsToTime(i));

	        console.info("Time: " + i.toFixed(2) + " " + this.timeToSample(this.secondsToTime(i)));
	      }
	      */
	    },
	    /**
	     * AVC samples contain one or more NAL units each of which have a length prefix.
	     * This function returns an array of NAL units without their length prefixes.
	     */
	    getSampleNALUnits: function (sample) {
	      var bytes = this.file.stream.bytes;
	      var offset = this.sampleToOffset(sample);
	      var end = offset + this.sampleToSize(sample, 1);
	      var nalUnits = [];
	      while(end - offset > 0) {
	        var length = (new Bytestream(bytes.buffer, offset)).readU32();
	        nalUnits.push(bytes.subarray(offset + 4, offset + length + 4));
	        offset = offset + length + 4;
	      }
	      return nalUnits;
	    }
	  };
	  return constructor;
	})();


	// Only add setZeroTimeout to the window object, and hide everything
	// else in a closure. (http://dbaron.org/log/20100309-faster-timeouts)
	(function() {
	    var timeouts = [];
	    var messageName = "zero-timeout-message";

	    // Like setTimeout, but only takes a function argument.  There's
	    // no time argument (always zero) and no arguments (you have to
	    // use a closure).
	    function setZeroTimeout(fn) {
	        timeouts.push(fn);
	        window.postMessage(messageName, "*");
	    }

	    function handleMessage(event) {
	        if (event.source == window && event.data == messageName) {
	            event.stopPropagation();
	            if (timeouts.length > 0) {
	                var fn = timeouts.shift();
	                fn();
	            }
	        }
	    }

	    window.addEventListener("message", handleMessage, true);

	    // Add the one thing we want added to the window object.
	    window.setZeroTimeout = setZeroTimeout;
	})();

	var MP4Player = (function reader() {
	  var defaultConfig = {
	    filter: "original",
	    filterHorLuma: "optimized",
	    filterVerLumaEdge: "optimized",
	    getBoundaryStrengthsA: "optimized"
	  };

	  function constructor(stream, useWorkers, webgl, render) {
	    this.stream = stream;
	    this.useWorkers = useWorkers;
	    this.webgl = webgl;
	    this.render = render;

	    this.statistics = {
	      videoStartTime: 0,
	      videoPictureCounter: 0,
	      windowStartTime: 0,
	      windowPictureCounter: 0,
	      fps: 0,
	      fpsMin: 1000,
	      fpsMax: -1000,
	      webGLTextureUploadTime: 0
	    };

	    this.onStatisticsUpdated = function () {};

	    this.avc = new Player({
	      useWorker: useWorkers,
	      reuseMemory: true,
	      webgl: webgl,
	      size: {
	        width: 640,
	        height: 368
	      }
	    });

	    this.webgl = this.avc.webgl;

	    var self = this;
	    this.avc.onPictureDecoded = function(){
	      updateStatistics.call(self);
	    };

	    this.canvas = this.avc.canvas;
	  }

	  function updateStatistics() {
	    var s = this.statistics;
	    s.videoPictureCounter += 1;
	    s.windowPictureCounter += 1;
	    var now = Date.now();
	    if (!s.videoStartTime) {
	      s.videoStartTime = now;
	    }
	    var videoElapsedTime = now - s.videoStartTime;
	    s.elapsed = videoElapsedTime / 1000;
	    if (videoElapsedTime < 1000) {
	      return;
	    }

	    if (!s.windowStartTime) {
	      s.windowStartTime = now;
	      return;
	    } else if ((now - s.windowStartTime) > 1000) {
	      var windowElapsedTime = now - s.windowStartTime;
	      var fps = (s.windowPictureCounter / windowElapsedTime) * 1000;
	      s.windowStartTime = now;
	      s.windowPictureCounter = 0;

	      if (fps < s.fpsMin) s.fpsMin = fps;
	      if (fps > s.fpsMax) s.fpsMax = fps;
	      s.fps = fps;
	    }

	    var fps = (s.videoPictureCounter / videoElapsedTime) * 1000;
	    s.fpsSinceStart = fps;
	    this.onStatisticsUpdated(this.statistics);
	    return;
	  }

	  constructor.prototype = {
	    readAll: function(callback) {
	      console.info("MP4Player::readAll()");
	      this.stream.readAll(null, function (buffer) {
	        this.reader = new MP4Reader(new Bytestream(buffer));
	        this.reader.read();
	        var video = this.reader.tracks[1];
	        this.size = new Size(video.trak.tkhd.width, video.trak.tkhd.height);
	        console.info("MP4Player::readAll(), length: " +  this.reader.stream.length);
	        if (callback) callback();
	      }.bind(this));
	    },
	    play: function() {
	      var reader = this.reader;

	      if (!reader) {
	        this.readAll(this.play.bind(this));
	        return;
	      };

	      var video = reader.tracks[1];
	      var audio = reader.tracks[2];

	      var avc = reader.tracks[1].trak.mdia.minf.stbl.stsd.avc1.avcC;
	      var sps = avc.sps[0];
	      var pps = avc.pps[0];

	      /* Decode Sequence & Picture Parameter Sets */
	      this.avc.decode(sps);
	      this.avc.decode(pps);

	      /* Decode Pictures */
	      var pic = 0;
	      setTimeout(function foo() {
	        var avc = this.avc;
	        video.getSampleNALUnits(pic).forEach(function (nal) {
	          avc.decode(nal);
	        });
	        pic ++;
	        if (pic < 3000) {
	          setTimeout(foo.bind(this), 1);
	        };
	      }.bind(this), 1);
	    }
	  };

	  return constructor;
	})();

	var Broadway = (function broadway() {
	  function constructor(div) {
	    var src = div.attributes.src ? div.attributes.src.value : undefined;
	    var width = div.attributes.width ? div.attributes.width.value : 640;
	    var height = div.attributes.height ? div.attributes.height.value : 480;

	    var controls = document.createElement('div');
	    controls.setAttribute('style', "z-index: 100; position: absolute; bottom: 0px; background-color: rgba(0,0,0,0.8); height: 30px; width: 100%; text-align: left;");
	    this.info = document.createElement('div');
	    this.info.setAttribute('style', "font-size: 14px; font-weight: bold; padding: 6px; color: lime;");
	    controls.appendChild(this.info);
	    div.appendChild(controls);

	    var useWorkers = div.attributes.workers ? div.attributes.workers.value == "true" : false;
	    var render = div.attributes.render ? div.attributes.render.value == "true" : false;

	    var webgl = "auto";
	    if (div.attributes.webgl){
	      if (div.attributes.webgl.value == "true"){
	        webgl = true;
	      };
	      if (div.attributes.webgl.value == "false"){
	        webgl = false;
	      };
	    };

	    var infoStrPre = "Click canvas to load and play - ";
	    var infoStr = "";
	    if (useWorkers){
	      infoStr += "worker thread ";
	    }else{
	      infoStr += "main thread ";
	    };

	    this.player = new MP4Player(new Stream(src), useWorkers, webgl, render);
	    this.canvas = this.player.canvas;
	    this.canvas.onclick = function () {
	      this.play();
	    }.bind(this);
	    div.appendChild(this.canvas);


	    infoStr += " - webgl: " + this.player.webgl;
	    this.info.innerHTML = infoStrPre + infoStr;


	    this.score = null;
	    this.player.onStatisticsUpdated = function (statistics) {
	      if (statistics.videoPictureCounter % 10 != 0) {
	        return;
	      }
	      var info = "";
	      if (statistics.fps) {
	        info += " fps: " + statistics.fps.toFixed(2);
	      }
	      if (statistics.fpsSinceStart) {
	        info += " avg: " + statistics.fpsSinceStart.toFixed(2);
	      }
	      var scoreCutoff = 1200;
	      if (statistics.videoPictureCounter < scoreCutoff) {
	        this.score = scoreCutoff - statistics.videoPictureCounter;
	      } else if (statistics.videoPictureCounter == scoreCutoff) {
	        this.score = statistics.fpsSinceStart.toFixed(2);
	      }
	      // info += " score: " + this.score;

	      this.info.innerHTML = infoStr + info;
	    }.bind(this);
	  }
	  constructor.prototype = {
	    play: function () {
	      this.player.play();
	    }
	  };
	  return constructor;
	})();

	var MP4Parser = {
	  Parser: MP4Parser,
	  Reader: MP4Reader,
	  Player: MP4Player,
	};

	module.exports = MP4Parser;


/***/ },
/* 4 */
/***/ function(module, exports) {

	/**
	 * This file was transpiled from TypeScript and modifed from the Mozila RTMP.js research project (https://github.com/yurydelendik/rtmp.js)
	 *
	 * Copyright 2015 Mozilla Foundation, Copyright 2015 SoundCloud Ltd., Copyright 2015 Stephan Hesse <tchakabam@gmail.com>
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 * http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */


	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};

	var Iso;

	module.exports = Iso = {};

	var START_DATE = -2082844800000; /* midnight after Jan. 1, 1904 */
	var DEFAULT_MOVIE_MATRIX = [1.0, 0, 0, 0, 1.0, 0, 0, 0, 1.0];
	var DEFAULT_OP_COLOR = [0, 0, 0];

	function utf8decode(str) {
	    var bytes = new Uint8Array(str.length * 4);
	    var b = 0;
	    for (var i = 0, j = str.length; i < j; i++) {
	        var code = str.charCodeAt(i);
	        if (code <= 0x7f) {
	            bytes[b++] = code;
	            continue;
	        }
	        if (0xD800 <= code && code <= 0xDBFF) {
	            var codeLow = str.charCodeAt(i + 1);
	            if (0xDC00 <= codeLow && codeLow <= 0xDFFF) {
	                // convert only when both high and low surrogates are present
	                code = ((code & 0x3FF) << 10) + (codeLow & 0x3FF) + 0x10000;
	                ++i;
	            }
	        }
	        if ((code & 0xFFE00000) !== 0) {
	            bytes[b++] = 0xF8 | ((code >>> 24) & 0x03);
	            bytes[b++] = 0x80 | ((code >>> 18) & 0x3F);
	            bytes[b++] = 0x80 | ((code >>> 12) & 0x3F);
	            bytes[b++] = 0x80 | ((code >>> 6) & 0x3F);
	            bytes[b++] = 0x80 | (code & 0x3F);
	        }
	        else if ((code & 0xFFFF0000) !== 0) {
	            bytes[b++] = 0xF0 | ((code >>> 18) & 0x07);
	            bytes[b++] = 0x80 | ((code >>> 12) & 0x3F);
	            bytes[b++] = 0x80 | ((code >>> 6) & 0x3F);
	            bytes[b++] = 0x80 | (code & 0x3F);
	        }
	        else if ((code & 0xFFFFF800) !== 0) {
	            bytes[b++] = 0xE0 | ((code >>> 12) & 0x0F);
	            bytes[b++] = 0x80 | ((code >>> 6) & 0x3F);
	            bytes[b++] = 0x80 | (code & 0x3F);
	        }
	        else {
	            bytes[b++] = 0xC0 | ((code >>> 6) & 0x1F);
	            bytes[b++] = 0x80 | (code & 0x3F);
	        }
	    }
	    return bytes.subarray(0, b);
	}
	function concatArrays(arg0) {
	    var args = [];
	    for (var _i = 1; _i < arguments.length; _i++) {
	        args[_i - 1] = arguments[_i];
	    }
	    return Array.prototype.concat.apply(arg0, args);
	}
	function writeInt32(data, offset, value) {
	    data[offset] = (value >> 24) & 255;
	    data[offset + 1] = (value >> 16) & 255;
	    data[offset + 2] = (value >> 8) & 255;
	    data[offset + 3] = value & 255;
	}
	function decodeInt32(s) {
	    return (s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) |
	        (s.charCodeAt(2) << 8) | s.charCodeAt(3);
	}
	function encodeDate(d) {
	    return ((d - START_DATE) / 1000) | 0;
	}
	function encodeFloat_16_16(f) {
	    return (f * 0x10000) | 0;
	}
	function encodeFloat_2_30(f) {
	    return (f * 0x40000000) | 0;
	}
	function encodeFloat_8_8(f) {
	    return (f * 0x100) | 0;
	}
	function encodeLang(s) {
	    return ((s.charCodeAt(0) & 0x1F) << 10) | ((s.charCodeAt(1) & 0x1F) << 5) | (s.charCodeAt(2) & 0x1F);
	}
	var Box = (function () {
	    function Box(boxtype, extendedType) {
	        this.boxtype = boxtype;
	        if (boxtype === 'uuid') {
	            this.userType = extendedType;
	        }
	    }
	    /**
	     * @param offset Position where writing will start in the output array
	     * @returns {number} Size of the written data
	     */
	    Box.prototype.layout = function (offset) {
	        this.offset = offset;
	        var size = 8;
	        if (this.userType) {
	            size += 16;
	        }
	        this.size = size;
	        return size;
	    };
	    /**
	     * @param data Output array
	     * @returns {number} Amount of written bytes by this Box and its children only.
	     */
	    Box.prototype.write = function (data) {
	        writeInt32(data, this.offset, this.size);
	        writeInt32(data, this.offset + 4, decodeInt32(this.boxtype));
	        if (!this.userType) {
	            return 8;
	        }
	        data.set(this.userType, this.offset + 8);
	        return 24;
	    };
	    Box.prototype.toUint8Array = function () {
	        var size = this.layout(0);
	        var data = new Uint8Array(size);
	        this.write(data);
	        return data;
	    };
	    return Box;
	})();
	Iso.Box = Box;
	var FullBox = (function (_super) {
	    __extends(FullBox, _super);
	    function FullBox(boxtype, version, flags) {
	        if (version === void 0) { version = 0; }
	        if (flags === void 0) { flags = 0; }
	        _super.call(this, boxtype);
	        this.version = version;
	        this.flags = flags;
	    }
	    FullBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 4;
	        return this.size;
	    };
	    FullBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, (this.version << 24) | this.flags);
	        return offset + 4;
	    };
	    return FullBox;
	})(Box);
	Iso.FullBox = FullBox;
	var FileTypeBox = (function (_super) {
	    __extends(FileTypeBox, _super);
	    function FileTypeBox(majorBrand, minorVersion, compatibleBrands) {
	        _super.call(this, 'ftype');
	        this.majorBrand = majorBrand;
	        this.minorVersion = minorVersion;
	        this.compatibleBrands = compatibleBrands;
	    }
	    FileTypeBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 4 * (2 + this.compatibleBrands.length);
	        return this.size;
	    };
	    FileTypeBox.prototype.write = function (data) {
	        var _this = this;
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, decodeInt32(this.majorBrand));
	        writeInt32(data, this.offset + offset + 4, this.minorVersion);
	        offset += 8;
	        this.compatibleBrands.forEach(function (brand) {
	            writeInt32(data, _this.offset + offset, decodeInt32(brand));
	            offset += 4;
	        }, this);
	        return offset;
	    };
	    return FileTypeBox;
	})(Box);
	Iso.FileTypeBox = FileTypeBox;
	var BoxContainerBox = (function (_super) {
	    __extends(BoxContainerBox, _super);
	    function BoxContainerBox(type, children) {
	        _super.call(this, type);
	        this.children = children;
	    }
	    BoxContainerBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset);
	        this.children.forEach(function (child) {
	            if (!child) {
	                return; // skipping undefined
	            }
	            size += child.layout(offset + size);
	        });
	        return (this.size = size);
	    };
	    BoxContainerBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        this.children.forEach(function (child) {
	            if (!child) {
	                return; // skipping undefined
	            }
	            offset += child.write(data);
	        });
	        return offset;
	    };
	    return BoxContainerBox;
	})(Box);
	Iso.BoxContainerBox = BoxContainerBox;
	var MovieBox = (function (_super) {
	    __extends(MovieBox, _super);
	    function MovieBox(header, tracks, extendsBox, userData) {
	        _super.call(this, 'moov', concatArrays([header], tracks, [extendsBox, userData]));
	        this.header = header;
	        this.tracks = tracks;
	        this.extendsBox = extendsBox;
	        this.userData = userData;
	    }
	    return MovieBox;
	})(BoxContainerBox);
	Iso.MovieBox = MovieBox;
	var MovieHeaderBox = (function (_super) {
	    __extends(MovieHeaderBox, _super);
	    function MovieHeaderBox(timescale, duration, nextTrackId, rate, volume, matrix, creationTime, modificationTime) {
	        if (rate === void 0) { rate = 1.0; }
	        if (volume === void 0) { volume = 1.0; }
	        if (matrix === void 0) { matrix = DEFAULT_MOVIE_MATRIX; }
	        if (creationTime === void 0) { creationTime = START_DATE; }
	        if (modificationTime === void 0) { modificationTime = START_DATE; }
	        _super.call(this, 'mvhd', 0, 0);
	        this.timescale = timescale;
	        this.duration = duration;
	        this.nextTrackId = nextTrackId;
	        this.rate = rate;
	        this.volume = volume;
	        this.matrix = matrix;
	        this.creationTime = creationTime;
	        this.modificationTime = modificationTime;
	    }
	    MovieHeaderBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 16 + 4 + 2 + 2 + 8 + 36 + 24 + 4;
	        return this.size;
	    };
	    MovieHeaderBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        // Only version 0
	        writeInt32(data, this.offset + offset, encodeDate(this.creationTime));
	        writeInt32(data, this.offset + offset + 4, encodeDate(this.modificationTime));
	        writeInt32(data, this.offset + offset + 8, this.timescale);
	        writeInt32(data, this.offset + offset + 12, this.duration);
	        offset += 16;
	        writeInt32(data, this.offset + offset, encodeFloat_16_16(this.rate));
	        writeInt32(data, this.offset + offset + 4, encodeFloat_8_8(this.volume) << 16);
	        writeInt32(data, this.offset + offset + 8, 0);
	        writeInt32(data, this.offset + offset + 12, 0);
	        offset += 16;
	        writeInt32(data, this.offset + offset, encodeFloat_16_16(this.matrix[0]));
	        writeInt32(data, this.offset + offset + 4, encodeFloat_16_16(this.matrix[1]));
	        writeInt32(data, this.offset + offset + 8, encodeFloat_16_16(this.matrix[2]));
	        writeInt32(data, this.offset + offset + 12, encodeFloat_16_16(this.matrix[3]));
	        writeInt32(data, this.offset + offset + 16, encodeFloat_16_16(this.matrix[4]));
	        writeInt32(data, this.offset + offset + 20, encodeFloat_16_16(this.matrix[5]));
	        writeInt32(data, this.offset + offset + 24, encodeFloat_2_30(this.matrix[6]));
	        writeInt32(data, this.offset + offset + 28, encodeFloat_2_30(this.matrix[7]));
	        writeInt32(data, this.offset + offset + 32, encodeFloat_2_30(this.matrix[8]));
	        offset += 36;
	        writeInt32(data, this.offset + offset, 0);
	        writeInt32(data, this.offset + offset + 4, 0);
	        writeInt32(data, this.offset + offset + 8, 0);
	        writeInt32(data, this.offset + offset + 12, 0);
	        writeInt32(data, this.offset + offset + 16, 0);
	        writeInt32(data, this.offset + offset + 20, 0);
	        offset += 24;
	        writeInt32(data, this.offset + offset, this.nextTrackId);
	        offset += 4;
	        return offset;
	    };
	    return MovieHeaderBox;
	})(FullBox);
	Iso.MovieHeaderBox = MovieHeaderBox;
	(function (TrackHeaderFlags) {
	    TrackHeaderFlags[TrackHeaderFlags["TRACK_ENABLED"] = 1] = "TRACK_ENABLED";
	    TrackHeaderFlags[TrackHeaderFlags["TRACK_IN_MOVIE"] = 2] = "TRACK_IN_MOVIE";
	    TrackHeaderFlags[TrackHeaderFlags["TRACK_IN_PREVIEW"] = 4] = "TRACK_IN_PREVIEW";
	})(Iso.TrackHeaderFlags || (Iso.TrackHeaderFlags = {}));
	var TrackHeaderFlags = Iso.TrackHeaderFlags;
	var TrackHeaderBox = (function (_super) {
	    __extends(TrackHeaderBox, _super);
	    function TrackHeaderBox(flags, trackId, duration, width, height, volume, alternateGroup, layer, matrix, creationTime, modificationTime) {
	        if (alternateGroup === void 0) { alternateGroup = 0; }
	        if (layer === void 0) { layer = 0; }
	        if (matrix === void 0) { matrix = DEFAULT_MOVIE_MATRIX; }
	        if (creationTime === void 0) { creationTime = START_DATE; }
	        if (modificationTime === void 0) { modificationTime = START_DATE; }
	        _super.call(this, 'tkhd', 0, flags);
	        this.trackId = trackId;
	        this.duration = duration;
	        this.width = width;
	        this.height = height;
	        this.volume = volume;
	        this.alternateGroup = alternateGroup;
	        this.layer = layer;
	        this.matrix = matrix;
	        this.creationTime = creationTime;
	        this.modificationTime = modificationTime;
	    }
	    TrackHeaderBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 20 + 8 + 6 + 2 + 36 + 8;
	        return this.size;
	    };
	    TrackHeaderBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        // Only version 0
	        writeInt32(data, this.offset + offset, encodeDate(this.creationTime));
	        writeInt32(data, this.offset + offset + 4, encodeDate(this.modificationTime));
	        writeInt32(data, this.offset + offset + 8, this.trackId);
	        writeInt32(data, this.offset + offset + 12, 0);
	        writeInt32(data, this.offset + offset + 16, this.duration);
	        offset += 20;
	        writeInt32(data, this.offset + offset, 0);
	        writeInt32(data, this.offset + offset + 4, 0);
	        writeInt32(data, this.offset + offset + 8, (this.layer << 16) | this.alternateGroup);
	        writeInt32(data, this.offset + offset + 12, encodeFloat_8_8(this.volume) << 16);
	        offset += 16;
	        writeInt32(data, this.offset + offset, encodeFloat_16_16(this.matrix[0]));
	        writeInt32(data, this.offset + offset + 4, encodeFloat_16_16(this.matrix[1]));
	        writeInt32(data, this.offset + offset + 8, encodeFloat_16_16(this.matrix[2]));
	        writeInt32(data, this.offset + offset + 12, encodeFloat_16_16(this.matrix[3]));
	        writeInt32(data, this.offset + offset + 16, encodeFloat_16_16(this.matrix[4]));
	        writeInt32(data, this.offset + offset + 20, encodeFloat_16_16(this.matrix[5]));
	        writeInt32(data, this.offset + offset + 24, encodeFloat_2_30(this.matrix[6]));
	        writeInt32(data, this.offset + offset + 28, encodeFloat_2_30(this.matrix[7]));
	        writeInt32(data, this.offset + offset + 32, encodeFloat_2_30(this.matrix[8]));
	        offset += 36;
	        writeInt32(data, this.offset + offset, encodeFloat_16_16(this.width));
	        writeInt32(data, this.offset + offset + 4, encodeFloat_16_16(this.height));
	        offset += 8;
	        return offset;
	    };
	    return TrackHeaderBox;
	})(FullBox);
	Iso.TrackHeaderBox = TrackHeaderBox;
	var MediaHeaderBox = (function (_super) {
	    __extends(MediaHeaderBox, _super);
	    function MediaHeaderBox(timescale, duration, language, creationTime, modificationTime) {
	        if (language === void 0) { language = 'unk'; }
	        if (creationTime === void 0) { creationTime = START_DATE; }
	        if (modificationTime === void 0) { modificationTime = START_DATE; }
	        _super.call(this, 'mdhd', 0, 0);
	        this.timescale = timescale;
	        this.duration = duration;
	        this.language = language;
	        this.creationTime = creationTime;
	        this.modificationTime = modificationTime;
	    }
	    MediaHeaderBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 16 + 4;
	        return this.size;
	    };
	    MediaHeaderBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        // Only version 0
	        writeInt32(data, this.offset + offset, encodeDate(this.creationTime));
	        writeInt32(data, this.offset + offset + 4, encodeDate(this.modificationTime));
	        writeInt32(data, this.offset + offset + 8, this.timescale);
	        writeInt32(data, this.offset + offset + 12, this.duration);
	        writeInt32(data, this.offset + offset + 16, encodeLang(this.language) << 16);
	        return offset + 20;
	    };
	    return MediaHeaderBox;
	})(FullBox);
	Iso.MediaHeaderBox = MediaHeaderBox;
	var HandlerBox = (function (_super) {
	    __extends(HandlerBox, _super);
	    function HandlerBox(handlerType, name) {
	        _super.call(this, 'hdlr', 0, 0);
	        this.handlerType = handlerType;
	        this.name = name;
	        this._encodedName = utf8decode(this.name);
	    }
	    HandlerBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 8 + 12 + (this._encodedName.length + 1);
	        return this.size;
	    };
	    HandlerBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, 0);
	        writeInt32(data, this.offset + offset + 4, decodeInt32(this.handlerType));
	        writeInt32(data, this.offset + offset + 8, 0);
	        writeInt32(data, this.offset + offset + 12, 0);
	        writeInt32(data, this.offset + offset + 16, 0);
	        offset += 20;
	        data.set(this._encodedName, this.offset + offset);
	        data[this.offset + offset + this._encodedName.length] = 0;
	        offset += this._encodedName.length + 1;
	        return offset;
	    };
	    return HandlerBox;
	})(FullBox);
	Iso.HandlerBox = HandlerBox;
	var SoundMediaHeaderBox = (function (_super) {
	    __extends(SoundMediaHeaderBox, _super);
	    function SoundMediaHeaderBox(balance) {
	        if (balance === void 0) { balance = 0.0; }
	        _super.call(this, 'smhd', 0, 0);
	        this.balance = balance;
	    }
	    SoundMediaHeaderBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 4;
	        return this.size;
	    };
	    SoundMediaHeaderBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, encodeFloat_8_8(this.balance) << 16);
	        return offset + 4;
	    };
	    return SoundMediaHeaderBox;
	})(FullBox);
	Iso.SoundMediaHeaderBox = SoundMediaHeaderBox;
	var VideoMediaHeaderBox = (function (_super) {
	    __extends(VideoMediaHeaderBox, _super);
	    function VideoMediaHeaderBox(graphicsMode, opColor) {
	        if (graphicsMode === void 0) { graphicsMode = 0; }
	        if (opColor === void 0) { opColor = DEFAULT_OP_COLOR; }
	        _super.call(this, 'vmhd', 0, 0);
	        this.graphicsMode = graphicsMode;
	        this.opColor = opColor;
	    }
	    VideoMediaHeaderBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 8;
	        return this.size;
	    };
	    VideoMediaHeaderBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, (this.graphicsMode << 16) | this.opColor[0]);
	        writeInt32(data, this.offset + offset + 4, (this.opColor[1] << 16) | this.opColor[2]);
	        return offset + 8;
	    };
	    return VideoMediaHeaderBox;
	})(FullBox);
	Iso.VideoMediaHeaderBox = VideoMediaHeaderBox;
	Iso.SELF_CONTAINED_DATA_REFERENCE_FLAG = 0x000001;
	var DataEntryUrlBox = (function (_super) {
	    __extends(DataEntryUrlBox, _super);
	    function DataEntryUrlBox(flags, location) {
	        if (location === void 0) { location = null; }
	        _super.call(this, 'url ', 0, flags);
	        this.location = location;
	        if (!(flags & Iso.SELF_CONTAINED_DATA_REFERENCE_FLAG)) {
	            this._encodedLocation = utf8decode(location);
	        }
	    }
	    DataEntryUrlBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset);
	        if (this._encodedLocation) {
	            size += this._encodedLocation.length + 1;
	        }
	        return (this.size = size);
	    };
	    DataEntryUrlBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        if (this._encodedLocation) {
	            data.set(this._encodedLocation, this.offset + offset);
	            data[this.offset + offset + this._encodedLocation.length] = 0;
	            offset += this._encodedLocation.length;
	        }
	        return offset;
	    };
	    return DataEntryUrlBox;
	})(FullBox);
	Iso.DataEntryUrlBox = DataEntryUrlBox;
	var DataReferenceBox = (function (_super) {
	    __extends(DataReferenceBox, _super);
	    function DataReferenceBox(entries) {
	        _super.call(this, 'dref', 0, 0);
	        this.entries = entries;
	    }
	    DataReferenceBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset) + 4;
	        this.entries.forEach(function (entry) {
	            size += entry.layout(offset + size);
	        });
	        return (this.size = size);
	    };
	    DataReferenceBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, this.entries.length);
	        this.entries.forEach(function (entry) {
	            offset += entry.write(data);
	        });
	        return offset;
	    };
	    return DataReferenceBox;
	})(FullBox);
	Iso.DataReferenceBox = DataReferenceBox;
	var DataInformationBox = (function (_super) {
	    __extends(DataInformationBox, _super);
	    function DataInformationBox(dataReference) {
	        _super.call(this, 'dinf', [dataReference]);
	        this.dataReference = dataReference;
	    }
	    return DataInformationBox;
	})(BoxContainerBox);
	Iso.DataInformationBox = DataInformationBox;
	var SampleDescriptionBox = (function (_super) {
	    __extends(SampleDescriptionBox, _super);
	    function SampleDescriptionBox(entries) {
	        _super.call(this, 'stsd', 0, 0);
	        this.entries = entries;
	    }
	    SampleDescriptionBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset);
	        size += 4;
	        this.entries.forEach(function (entry) {
	            size += entry.layout(offset + size);
	        });
	        return (this.size = size);
	    };
	    SampleDescriptionBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, this.entries.length);
	        offset += 4;
	        this.entries.forEach(function (entry) {
	            offset += entry.write(data);
	        });
	        return offset;
	    };
	    return SampleDescriptionBox;
	})(FullBox);
	Iso.SampleDescriptionBox = SampleDescriptionBox;
	var SampleTableBox = (function (_super) {
	    __extends(SampleTableBox, _super);
	    function SampleTableBox(sampleDescriptions, timeToSample, sampleToChunk, sampleSizes, // optional?
	        chunkOffset) {
	        _super.call(this, 'stbl', [sampleDescriptions, timeToSample, sampleToChunk, sampleSizes, chunkOffset]);
	        this.sampleDescriptions = sampleDescriptions;
	        this.timeToSample = timeToSample;
	        this.sampleToChunk = sampleToChunk;
	        this.sampleSizes = sampleSizes;
	        this.chunkOffset = chunkOffset;
	    }
	    return SampleTableBox;
	})(BoxContainerBox);
	Iso.SampleTableBox = SampleTableBox;
	var MediaInformationBox = (function (_super) {
	    __extends(MediaInformationBox, _super);
	    function MediaInformationBox(header, // SoundMediaHeaderBox|VideoMediaHeaderBox
	        info, sampleTable) {
	        _super.call(this, 'minf', [header, info, sampleTable]);
	        this.header = header;
	        this.info = info;
	        this.sampleTable = sampleTable;
	    }
	    return MediaInformationBox;
	})(BoxContainerBox);
	Iso.MediaInformationBox = MediaInformationBox;
	var MediaBox = (function (_super) {
	    __extends(MediaBox, _super);
	    function MediaBox(header, handler, info) {
	        _super.call(this, 'mdia', [header, handler, info]);
	        this.header = header;
	        this.handler = handler;
	        this.info = info;
	    }
	    return MediaBox;
	})(BoxContainerBox);
	Iso.MediaBox = MediaBox;
	var TrackBox = (function (_super) {
	    __extends(TrackBox, _super);
	    function TrackBox(header, media) {
	        _super.call(this, 'trak', [header, media]);
	        this.header = header;
	        this.media = media;
	    }
	    return TrackBox;
	})(BoxContainerBox);
	Iso.TrackBox = TrackBox;
	var TrackExtendsBox = (function (_super) {
	    __extends(TrackExtendsBox, _super);
	    function TrackExtendsBox(trackId, defaultSampleDescriptionIndex, defaultSampleDuration, defaultSampleSize, defaultSampleFlags) {
	        _super.call(this, 'trex', 0, 0);
	        this.trackId = trackId;
	        this.defaultSampleDescriptionIndex = defaultSampleDescriptionIndex;
	        this.defaultSampleDuration = defaultSampleDuration;
	        this.defaultSampleSize = defaultSampleSize;
	        this.defaultSampleFlags = defaultSampleFlags;
	    }
	    TrackExtendsBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 20;
	        return this.size;
	    };
	    TrackExtendsBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, this.trackId);
	        writeInt32(data, this.offset + offset + 4, this.defaultSampleDescriptionIndex);
	        writeInt32(data, this.offset + offset + 8, this.defaultSampleDuration);
	        writeInt32(data, this.offset + offset + 12, this.defaultSampleSize);
	        writeInt32(data, this.offset + offset + 16, this.defaultSampleFlags);
	        return offset + 20;
	    };
	    return TrackExtendsBox;
	})(FullBox);
	Iso.TrackExtendsBox = TrackExtendsBox;
	var MovieExtendsBox = (function (_super) {
	    __extends(MovieExtendsBox, _super);
	    function MovieExtendsBox(header, tracDefaults, levels) {
	        _super.call(this, 'mvex', concatArrays([header], tracDefaults, [levels]));
	        this.header = header;
	        this.tracDefaults = tracDefaults;
	        this.levels = levels;
	    }
	    return MovieExtendsBox;
	})(BoxContainerBox);
	Iso.MovieExtendsBox = MovieExtendsBox;
	var MetaBox = (function (_super) {
	    __extends(MetaBox, _super);
	    function MetaBox(handler, otherBoxes) {
	        _super.call(this, 'meta', 0, 0);
	        this.handler = handler;
	        this.otherBoxes = otherBoxes;
	    }
	    MetaBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset);
	        size += this.handler.layout(offset + size);
	        this.otherBoxes.forEach(function (box) {
	            size += box.layout(offset + size);
	        });
	        return (this.size = size);
	    };
	    MetaBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        offset += this.handler.write(data);
	        this.otherBoxes.forEach(function (box) {
	            offset += box.write(data);
	        });
	        return offset;
	    };
	    return MetaBox;
	})(FullBox);
	Iso.MetaBox = MetaBox;
	var MovieFragmentHeaderBox = (function (_super) {
	    __extends(MovieFragmentHeaderBox, _super);
	    function MovieFragmentHeaderBox(sequenceNumber) {
	        _super.call(this, 'mfhd', 0, 0);
	        this.sequenceNumber = sequenceNumber;
	    }
	    MovieFragmentHeaderBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 4;
	        return this.size;
	    };
	    MovieFragmentHeaderBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, this.sequenceNumber);
	        return offset + 4;
	    };
	    return MovieFragmentHeaderBox;
	})(FullBox);
	Iso.MovieFragmentHeaderBox = MovieFragmentHeaderBox;
	(function (TrackFragmentFlags) {
	    TrackFragmentFlags[TrackFragmentFlags["BASE_DATA_OFFSET_PRESENT"] = 1] = "BASE_DATA_OFFSET_PRESENT";
	    TrackFragmentFlags[TrackFragmentFlags["SAMPLE_DESCRIPTION_INDEX_PRESENT"] = 2] = "SAMPLE_DESCRIPTION_INDEX_PRESENT";
	    TrackFragmentFlags[TrackFragmentFlags["DEFAULT_SAMPLE_DURATION_PRESENT"] = 8] = "DEFAULT_SAMPLE_DURATION_PRESENT";
	    TrackFragmentFlags[TrackFragmentFlags["DEFAULT_SAMPLE_SIZE_PRESENT"] = 16] = "DEFAULT_SAMPLE_SIZE_PRESENT";
	    TrackFragmentFlags[TrackFragmentFlags["DEFAULT_SAMPLE_FLAGS_PRESENT"] = 32] = "DEFAULT_SAMPLE_FLAGS_PRESENT";
	})(Iso.TrackFragmentFlags || (Iso.TrackFragmentFlags = {}));
	var TrackFragmentFlags = Iso.TrackFragmentFlags;
	var TrackFragmentHeaderBox = (function (_super) {
	    __extends(TrackFragmentHeaderBox, _super);
	    function TrackFragmentHeaderBox(flags, trackId, baseDataOffset, sampleDescriptionIndex, defaultSampleDuration, defaultSampleSize, defaultSampleFlags) {
	        _super.call(this, 'tfhd', 0, flags);
	        this.trackId = trackId;
	        this.baseDataOffset = baseDataOffset;
	        this.sampleDescriptionIndex = sampleDescriptionIndex;
	        this.defaultSampleDuration = defaultSampleDuration;
	        this.defaultSampleSize = defaultSampleSize;
	        this.defaultSampleFlags = defaultSampleFlags;
	    }
	    TrackFragmentHeaderBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset) + 4;
	        var flags = this.flags;
	        if (!!(flags & TrackFragmentFlags.BASE_DATA_OFFSET_PRESENT)) {
	            size += 8;
	        }
	        if (!!(flags & TrackFragmentFlags.SAMPLE_DESCRIPTION_INDEX_PRESENT)) {
	            size += 4;
	        }
	        if (!!(flags & TrackFragmentFlags.DEFAULT_SAMPLE_DURATION_PRESENT)) {
	            size += 4;
	        }
	        if (!!(flags & TrackFragmentFlags.DEFAULT_SAMPLE_SIZE_PRESENT)) {
	            size += 4;
	        }
	        if (!!(flags & TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT)) {
	            size += 4;
	        }
	        return (this.size = size);
	    };
	    TrackFragmentHeaderBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        var flags = this.flags;
	        writeInt32(data, this.offset + offset, this.trackId);
	        offset += 4;
	        if (!!(flags & TrackFragmentFlags.BASE_DATA_OFFSET_PRESENT)) {
	            writeInt32(data, this.offset + offset, 0);
	            writeInt32(data, this.offset + offset + 4, this.baseDataOffset);
	            offset += 8;
	        }
	        if (!!(flags & TrackFragmentFlags.SAMPLE_DESCRIPTION_INDEX_PRESENT)) {
	            writeInt32(data, this.offset + offset, this.sampleDescriptionIndex);
	            offset += 4;
	        }
	        if (!!(flags & TrackFragmentFlags.DEFAULT_SAMPLE_DURATION_PRESENT)) {
	            writeInt32(data, this.offset + offset, this.defaultSampleDuration);
	            offset += 4;
	        }
	        if (!!(flags & TrackFragmentFlags.DEFAULT_SAMPLE_SIZE_PRESENT)) {
	            writeInt32(data, this.offset + offset, this.defaultSampleSize);
	            offset += 4;
	        }
	        if (!!(flags & TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT)) {
	            writeInt32(data, this.offset + offset, this.defaultSampleFlags);
	            offset += 4;
	        }
	        return offset;
	    };
	    return TrackFragmentHeaderBox;
	})(FullBox);
	Iso.TrackFragmentHeaderBox = TrackFragmentHeaderBox;
	var TrackFragmentBaseMediaDecodeTimeBox = (function (_super) {
	    __extends(TrackFragmentBaseMediaDecodeTimeBox, _super);
	    function TrackFragmentBaseMediaDecodeTimeBox(baseMediaDecodeTime) {
	        _super.call(this, 'tfdt', 0, 0);
	        this.baseMediaDecodeTime = baseMediaDecodeTime;
	    }
	    TrackFragmentBaseMediaDecodeTimeBox.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 4;
	        return this.size;
	    };
	    TrackFragmentBaseMediaDecodeTimeBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, this.baseMediaDecodeTime);
	        return offset + 4;
	    };
	    return TrackFragmentBaseMediaDecodeTimeBox;
	})(FullBox);
	Iso.TrackFragmentBaseMediaDecodeTimeBox = TrackFragmentBaseMediaDecodeTimeBox;
	var TrackFragmentBox = (function (_super) {
	    __extends(TrackFragmentBox, _super);
	    function TrackFragmentBox(header, decodeTime, // move after run?
	        run) {
	        _super.call(this, 'traf', [header, decodeTime, run]);
	        this.header = header;
	        this.decodeTime = decodeTime;
	        this.run = run;
	    }
	    return TrackFragmentBox;
	})(BoxContainerBox);
	Iso.TrackFragmentBox = TrackFragmentBox;
	(function (SampleFlags) {
	    SampleFlags[SampleFlags["IS_LEADING_MASK"] = 201326592] = "IS_LEADING_MASK";
	    SampleFlags[SampleFlags["SAMPLE_DEPENDS_ON_MASK"] = 50331648] = "SAMPLE_DEPENDS_ON_MASK";
	    SampleFlags[SampleFlags["SAMPLE_DEPENDS_ON_OTHER"] = 16777216] = "SAMPLE_DEPENDS_ON_OTHER";
	    SampleFlags[SampleFlags["SAMPLE_DEPENDS_ON_NO_OTHERS"] = 33554432] = "SAMPLE_DEPENDS_ON_NO_OTHERS";
	    SampleFlags[SampleFlags["SAMPLE_IS_DEPENDED_ON_MASK"] = 12582912] = "SAMPLE_IS_DEPENDED_ON_MASK";
	    SampleFlags[SampleFlags["SAMPLE_HAS_REDUNDANCY_MASK"] = 3145728] = "SAMPLE_HAS_REDUNDANCY_MASK";
	    SampleFlags[SampleFlags["SAMPLE_PADDING_VALUE_MASK"] = 917504] = "SAMPLE_PADDING_VALUE_MASK";
	    SampleFlags[SampleFlags["SAMPLE_IS_NOT_SYNC"] = 65536] = "SAMPLE_IS_NOT_SYNC";
	    SampleFlags[SampleFlags["SAMPLE_DEGRADATION_PRIORITY_MASK"] = 65535] = "SAMPLE_DEGRADATION_PRIORITY_MASK";
	})(Iso.SampleFlags || (Iso.SampleFlags = {}));
	var SampleFlags = Iso.SampleFlags;
	(function (TrackRunFlags) {
	    TrackRunFlags[TrackRunFlags["DATA_OFFSET_PRESENT"] = 1] = "DATA_OFFSET_PRESENT";
	    TrackRunFlags[TrackRunFlags["FIRST_SAMPLE_FLAGS_PRESENT"] = 4] = "FIRST_SAMPLE_FLAGS_PRESENT";
	    TrackRunFlags[TrackRunFlags["SAMPLE_DURATION_PRESENT"] = 256] = "SAMPLE_DURATION_PRESENT";
	    TrackRunFlags[TrackRunFlags["SAMPLE_SIZE_PRESENT"] = 512] = "SAMPLE_SIZE_PRESENT";
	    TrackRunFlags[TrackRunFlags["SAMPLE_FLAGS_PRESENT"] = 1024] = "SAMPLE_FLAGS_PRESENT";
	    TrackRunFlags[TrackRunFlags["SAMPLE_COMPOSITION_TIME_OFFSET"] = 2048] = "SAMPLE_COMPOSITION_TIME_OFFSET";
	})(Iso.TrackRunFlags || (Iso.TrackRunFlags = {}));
	var TrackRunFlags = Iso.TrackRunFlags;
	var TrackRunBox = (function (_super) {
	    __extends(TrackRunBox, _super);
	    function TrackRunBox(flags, samples, dataOffset, firstSampleFlags) {
	        _super.call(this, 'trun', 1, flags);
	        this.samples = samples;
	        this.dataOffset = dataOffset;
	        this.firstSampleFlags = firstSampleFlags;
	    }
	    TrackRunBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset) + 4;
	        var samplesCount = this.samples.length;
	        var flags = this.flags;
	        if (!!(flags & TrackRunFlags.DATA_OFFSET_PRESENT)) {
	            size += 4;
	        }
	        if (!!(flags & TrackRunFlags.FIRST_SAMPLE_FLAGS_PRESENT)) {
	            size += 4;
	        }
	        if (!!(flags & TrackRunFlags.SAMPLE_DURATION_PRESENT)) {
	            size += 4 * samplesCount;
	        }
	        if (!!(flags & TrackRunFlags.SAMPLE_SIZE_PRESENT)) {
	            size += 4 * samplesCount;
	        }
	        if (!!(flags & TrackRunFlags.SAMPLE_FLAGS_PRESENT)) {
	            size += 4 * samplesCount;
	        }
	        if (!!(flags & TrackRunFlags.SAMPLE_COMPOSITION_TIME_OFFSET)) {
	            size += 4 * samplesCount;
	        }
	        return (this.size = size);
	    };
	    TrackRunBox.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        var samplesCount = this.samples.length;
	        var flags = this.flags;
	        writeInt32(data, this.offset + offset, samplesCount);
	        offset += 4;
	        if (!!(flags & TrackRunFlags.DATA_OFFSET_PRESENT)) {
	            writeInt32(data, this.offset + offset, this.dataOffset);
	            offset += 4;
	        }
	        if (!!(flags & TrackRunFlags.FIRST_SAMPLE_FLAGS_PRESENT)) {
	            writeInt32(data, this.offset + offset, this.firstSampleFlags);
	            offset += 4;
	        }
	        for (var i = 0; i < samplesCount; i++) {
	            var sample = this.samples[i];
	            if (!!(flags & TrackRunFlags.SAMPLE_DURATION_PRESENT)) {
	                writeInt32(data, this.offset + offset, sample.duration);
	                offset += 4;
	            }
	            if (!!(flags & TrackRunFlags.SAMPLE_SIZE_PRESENT)) {
	                writeInt32(data, this.offset + offset, sample.size);
	                offset += 4;
	            }
	            if (!!(flags & TrackRunFlags.SAMPLE_FLAGS_PRESENT)) {
	                writeInt32(data, this.offset + offset, sample.flags);
	                offset += 4;
	            }
	            if (!!(flags & TrackRunFlags.SAMPLE_COMPOSITION_TIME_OFFSET)) {
	                writeInt32(data, this.offset + offset, sample.compositionTimeOffset);
	                offset += 4;
	            }
	        }
	        return offset;
	    };
	    return TrackRunBox;
	})(FullBox);
	Iso.TrackRunBox = TrackRunBox;
	var MovieFragmentBox = (function (_super) {
	    __extends(MovieFragmentBox, _super);
	    function MovieFragmentBox(header, trafs) {
	        _super.call(this, 'moof', concatArrays([header], trafs));
	        this.header = header;
	        this.trafs = trafs;
	    }
	    return MovieFragmentBox;
	})(BoxContainerBox);
	Iso.MovieFragmentBox = MovieFragmentBox;
	var MediaDataBox = (function (_super) {
	    __extends(MediaDataBox, _super);
	    function MediaDataBox(chunks) {
	        _super.call(this, 'mdat');
	        this.chunks = chunks;
	    }
	    MediaDataBox.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset);
	        this.chunks.forEach(function (chunk) { size += chunk.length; });
	        return (this.size = size);
	    };
	    MediaDataBox.prototype.write = function (data) {
	        var _this = this;
	        var offset = _super.prototype.write.call(this, data);
	        this.chunks.forEach(function (chunk) {
	            data.set(chunk, _this.offset + offset);
	            offset += chunk.length;
	        }, this);
	        return offset;
	    };
	    return MediaDataBox;
	})(Box);
	Iso.MediaDataBox = MediaDataBox;
	var SampleEntry = (function (_super) {
	    __extends(SampleEntry, _super);
	    function SampleEntry(format, dataReferenceIndex) {
	        _super.call(this, format);
	        this.dataReferenceIndex = dataReferenceIndex;
	    }
	    SampleEntry.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + 8;
	        return this.size;
	    };
	    SampleEntry.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, 0);
	        writeInt32(data, this.offset + offset + 4, this.dataReferenceIndex);
	        return offset + 8;
	    };
	    return SampleEntry;
	})(Box);
	Iso.SampleEntry = SampleEntry;
	var AudioSampleEntry = (function (_super) {
	    __extends(AudioSampleEntry, _super);
	    function AudioSampleEntry(codingName, dataReferenceIndex, channelCount, sampleSize, sampleRate, otherBoxes) {
	        if (channelCount === void 0) { channelCount = 2; }
	        if (sampleSize === void 0) { sampleSize = 16; }
	        if (sampleRate === void 0) { sampleRate = 44100; }
	        if (otherBoxes === void 0) { otherBoxes = null; }
	        _super.call(this, codingName, dataReferenceIndex);
	        this.channelCount = channelCount;
	        this.sampleSize = sampleSize;
	        this.sampleRate = sampleRate;
	        this.otherBoxes = otherBoxes;
	    }
	    AudioSampleEntry.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset) + 20;
	        this.otherBoxes && this.otherBoxes.forEach(function (box) {
	            size += box.layout(offset + size);
	        });
	        return (this.size = size);
	    };
	    AudioSampleEntry.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, 0);
	        writeInt32(data, this.offset + offset + 4, 0);
	        writeInt32(data, this.offset + offset + 8, (this.channelCount << 16) | this.sampleSize);
	        writeInt32(data, this.offset + offset + 12, 0);
	        writeInt32(data, this.offset + offset + 16, (this.sampleRate << 16));
	        offset += 20;
	        this.otherBoxes && this.otherBoxes.forEach(function (box) {
	            offset += box.write(data);
	        });
	        return offset;
	    };
	    return AudioSampleEntry;
	})(SampleEntry);
	Iso.AudioSampleEntry = AudioSampleEntry;
	Iso.COLOR_NO_ALPHA_VIDEO_SAMPLE_DEPTH = 0x0018;
	var VideoSampleEntry = (function (_super) {
	    __extends(VideoSampleEntry, _super);
	    function VideoSampleEntry(codingName, dataReferenceIndex, width, height, compressorName, horizResolution, vertResolution, frameCount, depth, otherBoxes) {
	        if (compressorName === void 0) { compressorName = ''; }
	        if (horizResolution === void 0) { horizResolution = 72; }
	        if (vertResolution === void 0) { vertResolution = 72; }
	        if (frameCount === void 0) { frameCount = 1; }
	        if (depth === void 0) { depth = Iso.COLOR_NO_ALPHA_VIDEO_SAMPLE_DEPTH; }
	        if (otherBoxes === void 0) { otherBoxes = null; }
	        _super.call(this, codingName, dataReferenceIndex);
	        this.width = width;
	        this.height = height;
	        this.compressorName = compressorName;
	        this.horizResolution = horizResolution;
	        this.vertResolution = vertResolution;
	        this.frameCount = frameCount;
	        this.depth = depth;
	        this.otherBoxes = otherBoxes;
	        if (compressorName.length > 31) {
	            throw new Error('invalid compressor name');
	        }
	    }
	    VideoSampleEntry.prototype.layout = function (offset) {
	        var size = _super.prototype.layout.call(this, offset) + 16 + 12 + 4 + 2 + 32 + 2 + 2;
	        this.otherBoxes && this.otherBoxes.forEach(function (box) {
	            size += box.layout(offset + size);
	        });
	        return (this.size = size);
	    };
	    VideoSampleEntry.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        writeInt32(data, this.offset + offset, 0);
	        writeInt32(data, this.offset + offset + 4, 0);
	        writeInt32(data, this.offset + offset + 8, 0);
	        writeInt32(data, this.offset + offset + 12, 0);
	        offset += 16;
	        writeInt32(data, this.offset + offset, (this.width << 16) | this.height);
	        writeInt32(data, this.offset + offset + 4, encodeFloat_16_16(this.horizResolution));
	        writeInt32(data, this.offset + offset + 8, encodeFloat_16_16(this.vertResolution));
	        offset += 12;
	        writeInt32(data, this.offset + offset, 0);
	        writeInt32(data, this.offset + offset + 4, (this.frameCount << 16));
	        offset += 6; // weird offset
	        data[this.offset + offset] = this.compressorName.length;
	        for (var i = 0; i < 31; i++) {
	            data[this.offset + offset + i + 1] = i < this.compressorName.length ? (this.compressorName.charCodeAt(i) & 127) : 0;
	        }
	        offset += 32;
	        writeInt32(data, this.offset + offset, (this.depth << 16) | 0xFFFF);
	        offset += 4;
	        this.otherBoxes && this.otherBoxes.forEach(function (box) {
	            offset += box.write(data);
	        });
	        return offset;
	    };
	    return VideoSampleEntry;
	})(SampleEntry);
	Iso.VideoSampleEntry = VideoSampleEntry;
	var RawTag = (function (_super) {
	    __extends(RawTag, _super);
	    function RawTag(type, data) {
	        _super.call(this, type);
	        this.data = data;
	    }
	    RawTag.prototype.layout = function (offset) {
	        this.size = _super.prototype.layout.call(this, offset) + this.data.length;
	        return this.size;
	    };
	    RawTag.prototype.write = function (data) {
	        var offset = _super.prototype.write.call(this, data);
	        data.set(this.data, this.offset + offset);
	        return offset + this.data.length;
	    };
	    return RawTag;
	})(Box);
	Iso.RawTag = RawTag;


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * This file was transpiled from TypeScript and modifed from the Mozila RTMP.js research project (https://github.com/yurydelendik/rtmp.js)
	 *
	 * Copyright 2015 Mozilla Foundation, Copyright 2015 SoundCloud Ltd., Copyright 2015 Stephan Hesse <tchakabam@gmail.com>
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 * http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */


	var MP4Iso = __webpack_require__(4);

	function hex(s) {
	    var len = s.length >> 1;
	    var arr = new Uint8Array(len);
	    for (var i = 0; i < len; i++) {
	        arr[i] = parseInt(s.substr(i * 2, 2), 16);
	    }
	    return arr;
	}
	var SOUNDRATES = [5500, 11025, 22050, 44100];
	var SOUNDFORMATS = ['PCM', 'ADPCM', 'MP3', 'PCM le', 'Nellymouser16', 'Nellymouser8', 'Nellymouser', 'G.711 A-law', 'G.711 mu-law', null, 'AAC', 'Speex', 'MP3 8khz'];
	var MP3_SOUND_CODEC_ID = 2;
	var AAC_SOUND_CODEC_ID = 10;
	var AudioPacketType;
	(function (AudioPacketType) {
	    AudioPacketType[AudioPacketType["HEADER"] = 0] = "HEADER";
	    AudioPacketType[AudioPacketType["RAW"] = 1] = "RAW";
	})(AudioPacketType || (AudioPacketType = {}));
	function parseAudiodata(data) {
	    var i = 0;
	    var packetType = AudioPacketType.RAW;
	    var flags = data[i];
	    var codecId = flags >> 4;
	    var soundRateId = (flags >> 2) & 3;
	    var sampleSize = flags & 2 ? 16 : 8;
	    var channels = flags & 1 ? 2 : 1;
	    var samples;
	    i++;
	    switch (codecId) {
	        case AAC_SOUND_CODEC_ID:
	            var type = data[i++];
	            packetType = type;
	            samples = 1024; // AAC implementations typically represent 1024 PCM audio samples
	            break;
	        case MP3_SOUND_CODEC_ID:
	            var version = (data[i + 1] >> 3) & 3; // 3 - MPEG 1
	            var layer = (data[i + 1] >> 1) & 3; // 3 - Layer I, 2 - II, 1 - III
	            samples = layer === 1 ? (version === 3 ? 1152 : 576) :
	                (layer === 3 ? 384 : 1152);
	            break;
	    }
	    return {
	        codecDescription: SOUNDFORMATS[codecId],
	        codecId: codecId,
	        data: data.subarray(i),
	        rate: SOUNDRATES[soundRateId],
	        size: sampleSize,
	        channels: channels,
	        samples: samples,
	        packetType: packetType
	    };
	}
	var VIDEOCODECS = [null, 'JPEG', 'Sorenson', 'Screen', 'VP6', 'VP6 alpha', 'Screen2', 'AVC'];
	var VP6_VIDEO_CODEC_ID = 4;
	var AVC_VIDEO_CODEC_ID = 7;
	var VideoFrameType;
	(function (VideoFrameType) {
	    VideoFrameType[VideoFrameType["KEY"] = 1] = "KEY";
	    VideoFrameType[VideoFrameType["INNER"] = 2] = "INNER";
	    VideoFrameType[VideoFrameType["DISPOSABLE"] = 3] = "DISPOSABLE";
	    VideoFrameType[VideoFrameType["GENERATED"] = 4] = "GENERATED";
	    VideoFrameType[VideoFrameType["INFO"] = 5] = "INFO";
	})(VideoFrameType || (VideoFrameType = {}));
	var VideoPacketType;
	(function (VideoPacketType) {
	    VideoPacketType[VideoPacketType["HEADER"] = 0] = "HEADER";
	    VideoPacketType[VideoPacketType["NALU"] = 1] = "NALU";
	    VideoPacketType[VideoPacketType["END"] = 2] = "END";
	})(VideoPacketType || (VideoPacketType = {}));
	function parseVideodata(data) {
	    var i = 0;
	    var frameType = data[i] >> 4;
	    var codecId = data[i] & 15;
	    i++;
	    var result = {
	        frameType: frameType,
	        codecId: codecId,
	        codecDescription: VIDEOCODECS[codecId]
	    };
	    switch (codecId) {
	        case AVC_VIDEO_CODEC_ID:
	            var type = data[i++];
	            result.packetType = type;
	            result.compositionTime = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8)) >> 8;
	            i += 3;
	            break;
	        case VP6_VIDEO_CODEC_ID:
	            result.packetType = VideoPacketType.NALU;
	            result.horizontalOffset = (data[i] >> 4) & 15;
	            result.verticalOffset = data[i] & 15;
	            result.compositionTime = 0;
	            i++;
	            break;
	    }
	    result.data = data.subarray(i);
	    return result;
	}
	var AUDIO_PACKET = 8;
	var VIDEO_PACKET = 9;
	var MAX_PACKETS_IN_CHUNK = 50;
	var SPLIT_AT_KEYFRAMES = true;
	var MP4MuxState;
	(function (MP4MuxState) {
	    MP4MuxState[MP4MuxState["CAN_GENERATE_HEADER"] = 0] = "CAN_GENERATE_HEADER";
	    MP4MuxState[MP4MuxState["NEED_HEADER_DATA"] = 1] = "NEED_HEADER_DATA";
	    MP4MuxState[MP4MuxState["MAIN_PACKETS"] = 2] = "MAIN_PACKETS";
	})(MP4MuxState || (MP4MuxState = {}));
	var MP4Mux = (function () {
	    function MP4Mux(metadata) {
	        var _this = this;
	        this.oncodecinfo = function (codecs) {
	            //
	        };
	        this.ondata = function (data) {
	            throw new Error('MP4Mux.ondata is not set');
	        };
	        this.metadata = metadata;
	        this.trackStates = this.metadata.tracks.map(function (t, index) {
	            var state = {
	                trackId: index + 1,
	                trackInfo: t,
	                cachedDuration: 0,
	                samplesProcessed: 0,
	                initializationData: []
	            };
	            if (_this.metadata.audioTrackId === index) {
	                _this.audioTrackState = state;
	            }
	            if (_this.metadata.videoTrackId === index) {
	                _this.videoTrackState = state;
	            }
	            return state;
	        }, this);
	        this._checkIfNeedHeaderData();
	        this.filePos = 0;
	        this.cachedPackets = [];
	        this.chunkIndex = 0;
	    }
	    MP4Mux.prototype.pushPacket = function (type, data, timestamp) {
	        if (this.state === MP4MuxState.CAN_GENERATE_HEADER) {
	            this._tryGenerateHeader();
	        }
	        switch (type) {
	            case AUDIO_PACKET:
	                var audioTrack = this.audioTrackState;
	                var audioPacket = parseAudiodata(data);
	                if (!audioTrack || audioTrack.trackInfo.codecId !== audioPacket.codecId) {
	                    throw new Error('Unexpected audio packet codec: ' + audioPacket.codecDescription);
	                }
	                switch (audioPacket.codecId) {
	                    default:
	                        throw new Error('Unsupported audio codec: ' + audioPacket.codecDescription);
	                    case MP3_SOUND_CODEC_ID:
	                        break; // supported codec
	                    case AAC_SOUND_CODEC_ID:
	                        if (audioPacket.packetType === AudioPacketType.HEADER) {
	                            audioTrack.initializationData.push(audioPacket.data);
	                            return;
	                        }
	                        break;
	                }
	                this.cachedPackets.push({ packet: audioPacket, timestamp: timestamp, trackId: audioTrack.trackId });
	                break;
	            case VIDEO_PACKET:
	                var videoTrack = this.videoTrackState;
	                var videoPacket = parseVideodata(data);
	                if (!videoTrack || videoTrack.trackInfo.codecId !== videoPacket.codecId) {
	                    throw new Error('Unexpected video packet codec: ' + videoPacket.codecDescription);
	                }
	                switch (videoPacket.codecId) {
	                    default:
	                        throw new Error('unsupported video codec: ' + videoPacket.codecDescription);
	                    case VP6_VIDEO_CODEC_ID:
	                        break; // supported
	                    case AVC_VIDEO_CODEC_ID:
	                        if (videoPacket.packetType === VideoPacketType.HEADER) {
	                            videoTrack.initializationData.push(videoPacket.data);
	                            return;
	                        }
	                        break;
	                }
	                this.cachedPackets.push({ packet: videoPacket, timestamp: timestamp, trackId: videoTrack.trackId });
	                break;
	            default:
	                throw new Error('unknown packet type: ' + type);
	        }
	        if (this.state === MP4MuxState.NEED_HEADER_DATA) {
	            this._tryGenerateHeader();
	        }
	        if (this.cachedPackets.length >= MAX_PACKETS_IN_CHUNK &&
	            this.state === MP4MuxState.MAIN_PACKETS) {
	            this._chunk();
	        }
	    };
	    MP4Mux.prototype.flush = function () {
	        if (this.cachedPackets.length > 0) {
	            this._chunk();
	        }
	    };
	    MP4Mux.prototype._checkIfNeedHeaderData = function () {
	        if (this.trackStates.some(function (ts) {
	            return ts.trackInfo.codecId === AAC_SOUND_CODEC_ID || ts.trackInfo.codecId === AVC_VIDEO_CODEC_ID;
	        })) {
	            this.state = MP4MuxState.NEED_HEADER_DATA;
	        }
	        else {
	            this.state = MP4MuxState.CAN_GENERATE_HEADER;
	        }
	    };
	    MP4Mux.prototype._tryGenerateHeader = function () {
	        var allInitializationDataExists = this.trackStates.every(function (ts) {
	            switch (ts.trackInfo.codecId) {
	                case AAC_SOUND_CODEC_ID:
	                case AVC_VIDEO_CODEC_ID:
	                    return ts.initializationData.length > 0;
	                default:
	                    return true;
	            }
	        });
	        if (!allInitializationDataExists) {
	            return; // not enough data, waiting more
	        }
	        var brands = ['isom'];
	        var audioDataReferenceIndex = 1, videoDataReferenceIndex = 1;
	        var traks = [];
	        for (var i = 0; i < this.trackStates.length; i++) {
	            var trackState = this.trackStates[i];
	            var trackInfo = trackState.trackInfo;
	            var sampleEntry;
	            switch (trackInfo.codecId) {
	                case AAC_SOUND_CODEC_ID:
	                    var audioSpecificConfig = trackState.initializationData[0];
	                    sampleEntry = new MP4Iso.AudioSampleEntry('mp4a', audioDataReferenceIndex, trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);
	                    var esdsData = new Uint8Array(41 + audioSpecificConfig.length);
	                    esdsData.set(hex('0000000003808080'), 0);
	                    esdsData[8] = 32 + audioSpecificConfig.length;
	                    esdsData.set(hex('00020004808080'), 9);
	                    esdsData[16] = 18 + audioSpecificConfig.length;
	                    esdsData.set(hex('40150000000000FA000000000005808080'), 17);
	                    esdsData[34] = audioSpecificConfig.length;
	                    esdsData.set(audioSpecificConfig, 35);
	                    esdsData.set(hex('068080800102'), 35 + audioSpecificConfig.length);
	                    sampleEntry.otherBoxes = [
	                        new MP4Iso.RawTag('esds', esdsData)
	                    ];
	                    var objectType = (audioSpecificConfig[0] >> 3); // TODO 31
	                    // mp4a.40.objectType
	                    trackState.mimeTypeCodec = 'mp4a.40.' + objectType;
	                    break;
	                case MP3_SOUND_CODEC_ID:
	                    sampleEntry = new MP4Iso.AudioSampleEntry('.mp3', audioDataReferenceIndex, trackInfo.channels, trackInfo.samplesize, trackInfo.samplerate);
	                    trackState.mimeTypeCodec = 'mp3';
	                    break;
	                case AVC_VIDEO_CODEC_ID:
	                    var avcC = trackState.initializationData[0];
	                    sampleEntry = new MP4Iso.VideoSampleEntry('avc1', videoDataReferenceIndex, trackInfo.width, trackInfo.height);
	                    sampleEntry.otherBoxes = [
	                        new MP4Iso.RawTag('avcC', avcC)
	                    ];
	                    var codecProfile = (avcC[1] << 16) | (avcC[2] << 8) | avcC[3];
	                    // avc1.XXYYZZ -- XX - profile + YY - constraints + ZZ - level
	                    trackState.mimeTypeCodec = 'avc1.' + (0x1000000 | codecProfile).toString(16).substr(1);
	                    brands.push('iso2', 'avc1', 'mp41');
	                    break;
	                case VP6_VIDEO_CODEC_ID:
	                    sampleEntry = new MP4Iso.VideoSampleEntry('VP6F', videoDataReferenceIndex, trackInfo.width, trackInfo.height);
	                    sampleEntry.otherBoxes = [
	                        new MP4Iso.RawTag('glbl', hex('00'))
	                    ];
	                    // TODO to lie about codec to get it playing in MSE?
	                    trackState.mimeTypeCodec = 'avc1.42001E';
	                    break;
	                default:
	                    throw new Error('not supported track type');
	            }
	            var trak;
	            var trakFlags = MP4Iso.TrackHeaderFlags.TRACK_ENABLED | MP4Iso.TrackHeaderFlags.TRACK_IN_MOVIE;
	            if (trackState === this.audioTrackState) {
	                trak = new MP4Iso.TrackBox(new MP4Iso.TrackHeaderBox(trakFlags, trackState.trackId, -1, 0 /*width*/, 0 /*height*/, 1.0, i), new MP4Iso.MediaBox(new MP4Iso.MediaHeaderBox(trackInfo.timescale, -1, trackInfo.language), new MP4Iso.HandlerBox('soun', 'SoundHandler'), new MP4Iso.MediaInformationBox(new MP4Iso.SoundMediaHeaderBox(), new MP4Iso.DataInformationBox(new MP4Iso.DataReferenceBox([new MP4Iso.DataEntryUrlBox(MP4Iso.SELF_CONTAINED_DATA_REFERENCE_FLAG)])), new MP4Iso.SampleTableBox(new MP4Iso.SampleDescriptionBox([sampleEntry]), new MP4Iso.RawTag('stts', hex('0000000000000000')), new MP4Iso.RawTag('stsc', hex('0000000000000000')), new MP4Iso.RawTag('stsz', hex('000000000000000000000000')), new MP4Iso.RawTag('stco', hex('0000000000000000'))))));
	            }
	            else if (trackState === this.videoTrackState) {
	                trak = new MP4Iso.TrackBox(new MP4Iso.TrackHeaderBox(trakFlags, trackState.trackId, -1, trackInfo.width, trackInfo.height, 0 /* volume */, i), new MP4Iso.MediaBox(new MP4Iso.MediaHeaderBox(trackInfo.timescale, -1, trackInfo.language), new MP4Iso.HandlerBox('vide', 'VideoHandler'), new MP4Iso.MediaInformationBox(new MP4Iso.VideoMediaHeaderBox(), new MP4Iso.DataInformationBox(new MP4Iso.DataReferenceBox([new MP4Iso.DataEntryUrlBox(MP4Iso.SELF_CONTAINED_DATA_REFERENCE_FLAG)])), new MP4Iso.SampleTableBox(new MP4Iso.SampleDescriptionBox([sampleEntry]), new MP4Iso.RawTag('stts', hex('0000000000000000')), new MP4Iso.RawTag('stsc', hex('0000000000000000')), new MP4Iso.RawTag('stsz', hex('000000000000000000000000')), new MP4Iso.RawTag('stco', hex('0000000000000000'))))));
	            }
	            traks.push(trak);
	        }
	        var mvex = new MP4Iso.MovieExtendsBox(null, [
	            new MP4Iso.TrackExtendsBox(1, 1, 0, 0, 0),
	            new MP4Iso.TrackExtendsBox(2, 1, 0, 0, 0)
	        ], null);
	        var udat = new MP4Iso.BoxContainerBox('udat', [
	            new MP4Iso.MetaBox(new MP4Iso.RawTag('hdlr', hex('00000000000000006D6469726170706C000000000000000000')), // notice weird stuff in reserved field
	            [new MP4Iso.RawTag('ilst', hex('00000025A9746F6F0000001D6461746100000001000000004C61766635342E36332E313034'))])
	        ]);
	        var mvhd = new MP4Iso.MovieHeaderBox(1000, 0 /* unknown duration */, this.trackStates.length + 1);
	        var moov = new MP4Iso.MovieBox(mvhd, traks, mvex, udat);
	        var ftype = new MP4Iso.FileTypeBox('isom', 0x00000200, brands);
	        var ftypeSize = ftype.layout(0);
	        var moovSize = moov.layout(ftypeSize);
	        var header = new Uint8Array(ftypeSize + moovSize);
	        ftype.write(header);
	        moov.write(header);
	        this.oncodecinfo(this.trackStates.map(function (ts) { return ts.mimeTypeCodec; }));
	        this.ondata(header);
	        this.filePos += header.length;
	        this.state = MP4MuxState.MAIN_PACKETS;
	    };
	    MP4Mux.prototype._chunk = function () {
	        var cachedPackets = this.cachedPackets;
	        if (SPLIT_AT_KEYFRAMES && this.videoTrackState) {
	            var j = cachedPackets.length - 1;
	            var videoTrackId = this.videoTrackState.trackId;
	            // Finding last video keyframe.
	            while (j > 0 &&
	                (cachedPackets[j].trackId !== videoTrackId || cachedPackets[j].packet.frameType !== VideoFrameType.KEY)) {
	                j--;
	            }
	            if (j > 0) {
	                // We have keyframes and not only the first frame is a keyframe...
	                cachedPackets = cachedPackets.slice(0, j);
	            }
	        }
	        if (cachedPackets.length === 0) {
	            return; // No data to produce.
	        }
	        var tdatParts = [];
	        var tdatPosition = 0;
	        var trafs = [];
	        var trafDataStarts = [];
	        for (var i = 0; i < this.trackStates.length; i++) {
	            var trackState = this.trackStates[i];
	            var trackInfo = trackState.trackInfo;
	            var trackId = trackState.trackId;
	            // Finding all packets for this track.
	            var trackPackets = cachedPackets.filter(function (cp) { return cp.trackId === trackId; });
	            if (trackPackets.length === 0) {
	                continue;
	            }
	            //var currentTimestamp = (trackPackets[0].timestamp * trackInfo.timescale / 1000) | 0;
	            var tfdt = new MP4Iso.TrackFragmentBaseMediaDecodeTimeBox(trackState.cachedDuration);
	            var tfhd;
	            var trun;
	            var trunSamples;
	            trafDataStarts.push(tdatPosition);
	            switch (trackInfo.codecId) {
	                case AAC_SOUND_CODEC_ID:
	                case MP3_SOUND_CODEC_ID:
	                    trunSamples = [];
	                    for (var j = 0; j < trackPackets.length; j++) {
	                        var audioPacket = trackPackets[j].packet;
	                        var audioFrameDuration = Math.round(audioPacket.samples * trackInfo.timescale / trackInfo.samplerate);
	                        tdatParts.push(audioPacket.data);
	                        tdatPosition += audioPacket.data.length;
	                        trunSamples.push({ duration: audioFrameDuration, size: audioPacket.data.length });
	                        trackState.samplesProcessed += audioPacket.samples;
	                    }
	                    var tfhdFlags = MP4Iso.TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;
	                    tfhd = new MP4Iso.TrackFragmentHeaderBox(tfhdFlags, trackId, 0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */, MP4Iso.SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);
	                    var trunFlags = MP4Iso.TrackRunFlags.DATA_OFFSET_PRESENT |
	                        MP4Iso.TrackRunFlags.SAMPLE_DURATION_PRESENT | MP4Iso.TrackRunFlags.SAMPLE_SIZE_PRESENT;
	                    trun = new MP4Iso.TrackRunBox(trunFlags, trunSamples, 0 /* data offset */, 0 /* first flags */);
	                    trackState.cachedDuration = Math.round(trackState.samplesProcessed * trackInfo.timescale / trackInfo.samplerate);
	                    break;
	                case AVC_VIDEO_CODEC_ID:
	                case VP6_VIDEO_CODEC_ID:
	                    trunSamples = [];
	                    var samplesProcessed = trackState.samplesProcessed;
	                    var decodeTime = samplesProcessed * trackInfo.timescale / trackInfo.framerate;
	                    var lastTime = Math.round(decodeTime);
	                    for (var j = 0; j < trackPackets.length; j++) {
	                        var videoPacket = trackPackets[j].packet;
	                        samplesProcessed++;
	                        var nextTime = Math.round(samplesProcessed * trackInfo.timescale / trackInfo.framerate);
	                        var videoFrameDuration = nextTime - lastTime;
	                        lastTime = nextTime;
	                        var compositionTime = Math.round(samplesProcessed * trackInfo.timescale / trackInfo.framerate +
	                            videoPacket.compositionTime * trackInfo.timescale / 1000);
	                        tdatParts.push(videoPacket.data);
	                        tdatPosition += videoPacket.data.length;
	                        var frameFlags = videoPacket.frameType === VideoFrameType.KEY ?
	                            MP4Iso.SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS :
	                            (MP4Iso.SampleFlags.SAMPLE_DEPENDS_ON_OTHER | MP4Iso.SampleFlags.SAMPLE_IS_NOT_SYNC);
	                        trunSamples.push({ duration: videoFrameDuration, size: videoPacket.data.length,
	                            flags: frameFlags, compositionTimeOffset: (compositionTime - nextTime) });
	                    }
	                    var tfhdFlags = MP4Iso.TrackFragmentFlags.DEFAULT_SAMPLE_FLAGS_PRESENT;
	                    tfhd = new MP4Iso.TrackFragmentHeaderBox(tfhdFlags, trackId, 0 /* offset */, 0 /* index */, 0 /* duration */, 0 /* size */, MP4Iso.SampleFlags.SAMPLE_DEPENDS_ON_NO_OTHERS);
	                    var trunFlags = MP4Iso.TrackRunFlags.DATA_OFFSET_PRESENT |
	                        MP4Iso.TrackRunFlags.SAMPLE_DURATION_PRESENT | MP4Iso.TrackRunFlags.SAMPLE_SIZE_PRESENT |
	                        MP4Iso.TrackRunFlags.SAMPLE_FLAGS_PRESENT | MP4Iso.TrackRunFlags.SAMPLE_COMPOSITION_TIME_OFFSET;
	                    trun = new MP4Iso.TrackRunBox(trunFlags, trunSamples, 0 /* data offset */, 0 /* first flag */);
	                    trackState.cachedDuration = lastTime;
	                    trackState.samplesProcessed = samplesProcessed;
	                    break;
	                default:
	                    throw new Error('Un codec');
	            }
	            var traf = new MP4Iso.TrackFragmentBox(tfhd, tfdt, trun);
	            trafs.push(traf);
	        }
	        this.cachedPackets.splice(0, cachedPackets.length);
	        var moofHeader = new MP4Iso.MovieFragmentHeaderBox(++this.chunkIndex);
	        var moof = new MP4Iso.MovieFragmentBox(moofHeader, trafs);
	        var moofSize = moof.layout(0);
	        var mdat = new MP4Iso.MediaDataBox(tdatParts);
	        var mdatSize = mdat.layout(moofSize);
	        var tdatOffset = moofSize + 8;
	        for (var i = 0; i < trafs.length; i++) {
	            trafs[i].run.dataOffset = tdatOffset + trafDataStarts[i];
	        }
	        var chunk = new Uint8Array(moofSize + mdatSize);
	        moof.write(chunk);
	        mdat.write(chunk);
	        this.ondata(chunk);
	        this.filePos += chunk.length;
	    };
	    return MP4Mux;
	})();

	module.exports = MP4Mux;

	function parseFLVMetadata(metadata) {
	    var tracks = [];
	    var audioTrackId = -1;
	    var videoTrackId = -1;
	    var duration = +metadata.asGetPublicProperty('duration');
	    var audioCodec, audioCodecId;
	    var audioCodecCode = metadata.asGetPublicProperty('audiocodecid');
	    switch (audioCodecCode) {
	        case MP3_SOUND_CODEC_ID:
	        case 'mp3':
	            audioCodec = 'mp3';
	            audioCodecId = MP3_SOUND_CODEC_ID;
	            break;
	        case AAC_SOUND_CODEC_ID:
	        case 'mp4a':
	            audioCodec = 'mp4a';
	            audioCodecId = AAC_SOUND_CODEC_ID;
	            break;
	        default:
	            if (!isNaN(audioCodecCode)) {
	                throw new Error('Unsupported audio codec: ' + audioCodecCode);
	            }
	            audioCodec = null;
	            audioCodecId = -1;
	            break;
	    }
	    var videoCodec, videoCodecId;
	    var videoCodecCode = metadata.asGetPublicProperty('videocodecid');
	    switch (videoCodecCode) {
	        case VP6_VIDEO_CODEC_ID:
	        case 'vp6f':
	            videoCodec = 'vp6f';
	            videoCodecId = VP6_VIDEO_CODEC_ID;
	            break;
	        case AVC_VIDEO_CODEC_ID:
	        case 'avc1':
	            videoCodec = 'avc1';
	            videoCodecId = AVC_VIDEO_CODEC_ID;
	            break;
	        default:
	            if (!isNaN(videoCodecCode)) {
	                throw new Error('Unsupported video codec: ' + videoCodecCode);
	            }
	            videoCodec = null;
	            videoCodecId = -1;
	            break;
	    }
	    var audioTrack = (audioCodec === null) ? null : {
	        codecDescription: audioCodec,
	        codecId: audioCodecId,
	        language: 'und',
	        timescale: +metadata.asGetPublicProperty('audiosamplerate') || 44100,
	        samplerate: +metadata.asGetPublicProperty('audiosamplerate') || 44100,
	        channels: +metadata.asGetPublicProperty('audiochannels') || 2,
	        samplesize: 16
	    };
	    var videoTrack = (videoCodec === null) ? null : {
	        codecDescription: videoCodec,
	        codecId: videoCodecId,
	        language: 'und',
	        timescale: 60000,
	        framerate: +metadata.asGetPublicProperty('videoframerate') ||
	            +metadata.asGetPublicProperty('framerate'),
	        width: +metadata.asGetPublicProperty('width'),
	        height: +metadata.asGetPublicProperty('height')
	    };
	    var trackInfos = metadata.asGetPublicProperty('trackinfo');
	    if (trackInfos) {
	        // Not in the Adobe's references, red5 specific?
	        for (var i = 0; i < trackInfos.length; i++) {
	            var info = trackInfos[i];
	            var sampleDescription = info.asGetPublicProperty('sampledescription')[0];
	            if (sampleDescription.asGetPublicProperty('sampletype') === audioCodecCode) {
	                audioTrack.language = info.asGetPublicProperty('language');
	                audioTrack.timescale = +info.asGetPublicProperty('timescale');
	            }
	            else if (sampleDescription.asGetPublicProperty('sampletype') === videoCodecCode) {
	                videoTrack.language = info.asGetPublicProperty('language');
	                videoTrack.timescale = +info.asGetPublicProperty('timescale');
	            }
	        }
	    }
	    if (videoTrack) {
	        videoTrackId = tracks.length;
	        tracks.push(videoTrack);
	    }
	    if (audioTrack) {
	        audioTrackId = tracks.length;
	        tracks.push(audioTrack);
	    }
	    return {
	        tracks: tracks,
	        duration: duration,
	        audioTrackId: audioTrackId,
	        videoTrackId: videoTrackId
	    };
	}

	function splitMetadata(metadata) {
	    var tracks = [];
	    if (metadata.audioTrackId >= 0) {
	        tracks.push({
	            tracks: [metadata.tracks[metadata.audioTrackId]],
	            duration: metadata.duration,
	            audioTrackId: 0,
	            videoTrackId: -1
	        });
	    }
	    if (metadata.videoTrackId >= 0) {
	        tracks.push({
	            tracks: [metadata.tracks[metadata.videoTrackId]],
	            duration: metadata.duration,
	            audioTrackId: -1,
	            videoTrackId: 0
	        });
	    }
	    return tracks;
	}



/***/ },
/* 6 */
/***/ function(module, exports) {

	/**
	 * This file was transpiled from TypeScript and modifed from the Mozila RTMP.js research project (https://github.com/yurydelendik/rtmp.js)
	 *
	 * Copyright 2015 Mozilla Foundation, Copyright 2015 SoundCloud Ltd., Copyright 2015 Stephan Hesse <tchakabam@gmail.com>
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 * http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */

	var MSEBufferWriter = (function () {
	    function MSEBufferWriter(mediaSource, dataSource) {
	        this.mediaSource = mediaSource;
	        this.dataSource = dataSource;
	        this.dataSource.onData = this.pushData.bind(this);
	        this.updateEnabled = false;
	        this.buffer = [];
	        this.sourceBuffer = null;
	        this.sourceBufferUpdatedBound = null;
	    }
	    MSEBufferWriter.prototype.allowWriting = function () {
	        this.updateEnabled = true;
	        this.update();
	    };
	    MSEBufferWriter.prototype.pushData = function (data) {
	        this.buffer.push(data);
	        this.update();
	    };
	    MSEBufferWriter.prototype.update = function () {
	        if (!this.updateEnabled || this.buffer.length === 0) {
	            return;
	        }
	        if (!this.sourceBuffer) {
	            this.sourceBuffer = this.mediaSource.addSourceBuffer(this.dataSource.mimeType);
	            this.sourceBufferUpdatedBound = this._sourceBufferUpdated.bind(this);
	            this.sourceBuffer.addEventListener('update', this.sourceBufferUpdatedBound);
	        }
	        this.updateEnabled = false;
	        var data = this.buffer.shift();
	        if (data === null) {
	            // finish
	            this.sourceBuffer.removeEventListener('update', this.sourceBufferUpdatedBound);
	            return;
	        }
	        this.sourceBuffer.appendBuffer(data);
	    };
	    MSEBufferWriter.prototype._sourceBufferUpdated = function (e) {
	        this.updateEnabled = true;
	        this.update();
	    };
	    MSEBufferWriter.prototype.finish = function () {
	        this.buffer.push(null);
	        this.update();
	    };
	    return MSEBufferWriter;
	})();

	var MSEWriter = (function () {
	    function MSEWriter(mediaSource) {
	        this.bufferWriters = [];
	        this.mediaSource = mediaSource;
	        this.mediaSourceOpened = false;
	        this.mediaSource.addEventListener('sourceopen', function (e) {
	            this.mediaSourceOpened = true;
	            this.bufferWriters.forEach(function (writer) {
	                writer.allowWriting();
	            });
	        }.bind(this));
	        this.mediaSource.addEventListener('sourceend', function (e) {
	            this.mediaSourceOpened = false;
	        }.bind(this));
	    }
	    MSEWriter.prototype.listen = function (dataSource) {
	        var writer = new MSEBufferWriter(this.mediaSource, dataSource);
	        this.bufferWriters.push(writer);
	        if (this.mediaSourceOpened) {
	            writer.allowWriting();
	        }
	    };
	    return MSEWriter;
	})();

	module.exports = MSEWriter;



/***/ },
/* 7 */
/***/ function(module, exports) {

	/*
	* Basic examplaray WebAudio player
	*/

	function Player ( url, el ) {
	  this.ac = new ( window.AudioContext || webkitAudioContext )();
	  this.url = url;
	  this.el = el;
	  this.button = el.querySelector('.button');
	  this.track = el.querySelector('.track');
	  this.progress = el.querySelector('.progress');
	  this.scrubber = el.querySelector('.scrubber');
	  this.message = el.querySelector('.message');
	  this.message.innerHTML = 'Loading';
	  this.bindEvents();
	  this.fetch();
	}

	Player.prototype.bindEvents = function() {
	  this.button.addEventListener('click', this.toggle.bind(this));
	  this.scrubber.addEventListener('mousedown', this.onMouseDown.bind(this));
	  window.addEventListener('mousemove', this.onDrag.bind(this));
	  window.addEventListener('mouseup', this.onMouseUp.bind(this));
	};


	Player.prototype.fetch = function() {
	  var xhr = new XMLHttpRequest();
	  xhr.open('GET', this.url, true);
	  xhr.responseType = 'arraybuffer';
	  xhr.onload = function() {
	    this.decode(xhr.response);
	  }.bind(this);
	  xhr.send();
	};

	Player.prototype.decode = function( arrayBuffer ) {
	  this.ac.decodeAudioData(arrayBuffer, function( audioBuffer ) {
	    this.message.innerHTML = '';
	    this.buffer = audioBuffer;
	    this.draw();
	    this.play();
	  }.bind(this));
	};

	Player.prototype.connect = function() {
	  if ( this.playing ) {
	    this.pause();
	  }
	  this.source = this.ac.createBufferSource();
	  this.source.buffer = this.buffer;
	  this.source.connect(this.ac.destination);
	};

	Player.prototype.play = function( position ) {
	  this.connect();
	  this.position = typeof position === 'number' ? position : this.position || 0;
	  this.startTime = this.ac.currentTime - ( this.position || 0 );
	  this.source.start(this.ac.currentTime, this.position);
	  this.playing = true;
	};

	Player.prototype.pause = function() {
	  if ( this.source ) {
	    this.source.stop(0);
	    this.source = null;
	    this.position = this.ac.currentTime - this.startTime;
	    this.playing = false;
	  }
	};

	Player.prototype.seek = function( time ) {
	  if ( this.playing ) {
	    this.play(time);
	  }
	  else {
	    this.position = time;
	  }
	};

	Player.prototype.updatePosition = function() {
	  this.position = this.playing ?
	    this.ac.currentTime - this.startTime : this.position;
	  if ( this.position >= this.buffer.duration ) {
	    this.position = this.buffer.duration;
	    this.pause();
	  }
	  return this.position;
	};

	Player.prototype.toggle = function() {
	  if ( !this.playing ) {
	    this.play();
	  }
	  else {
	    this.pause();
	  }
	};

	Player.prototype.onMouseDown = function( e ) {
	  this.dragging = true;
	  this.startX = e.pageX;
	  this.startLeft = parseInt(this.scrubber.style.left || 0, 10);
	};

	Player.prototype.onDrag = function( e ) {
	  var width, position;
	  if ( !this.dragging ) {
	    return;
	  }
	  width = this.track.offsetWidth;
	  position = this.startLeft + ( e.pageX - this.startX );
	  position = Math.max(Math.min(width, position), 0);
	  this.scrubber.style.left = position + 'px';
	};

	Player.prototype.onMouseUp = function() {
	  var width, left, time;
	  if ( this.dragging ) {
	    width = this.track.offsetWidth;
	    left = parseInt(this.scrubber.style.left || 0, 10);
	    time = left / width * this.buffer.duration;
	    this.seek(time);
	    this.dragging = false;
	  }
	};

	Player.prototype.draw = function() {
	  var progress = ( this.updatePosition() / this.buffer.duration ),
	    width = this.track.offsetWidth;
	  if ( this.playing ) {
	    this.button.classList.add('fa-pause');
	    this.button.classList.remove('fa-play');
	  } else {
	    this.button.classList.add('fa-play');
	    this.button.classList.remove('fa-pause');
	  }
	  this.progress.style.width = ( progress * width ) + 'px';
	  if ( !this.dragging ) {
	    this.scrubber.style.left = ( progress * width ) + 'px';
	  }
	  requestAnimationFrame(this.draw.bind(this));
	};

	module.exports = Player;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	var Unit,
	    Input, Output, Transfer,
	    BaseTransform, BaseSrc, BasePushSrc, BaseSink,
	    create = __webpack_require__(9),
	    stream = __webpack_require__(18);

	module.exports = Unit = function Unit() {

	  this.inputs = [];
	  this.outputs = [];

	};

	Unit.prototype = create(Unit.prototype, {
	  constructor: Unit,

	  in: function(i) {
	    return this.inputs[i];
	  },

	  out: function(i) {
	    return this.outputs[i];
	  },

	  add: function(thing) {

	    if (thing instanceof Input) {
	      this.addInput(thing);
	    }

	    else if (thing instanceof Output) {
	      this.addOutput(thing);
	    }
	    return this;
	  },

	  remove: function(thing) {

	    if (thing instanceof Input) {
	      this.removeInput(thing);
	    }

	    else if (thing instanceof Output) {
	      this.removeOutput(thing);
	    }

	  },

	  addInput: function(input) {
	    this.inputs.push(input);
	  },

	  addOutput: function(output) {
	    this.outputs.push(input);
	  },

	  removeInput: function(input) {
	    removePut(this.inputs, input);
	  },

	  removeOutput: function(output) {
	    removePut(this.outputs, output);
	  },

	  removePut: function(puts, put) {
	    puts.slice().forEach(function(el, idx) {
	      if (el == put) {
	        puts.splice(idx, 1);
	      }
	    });
	  },

	});

	Unit.Transfer = Transfer = function Transfer(data, encoding, doneCallback) {
	  this.data = data;
	  this.encoding = encoding;
	  this.doneCallback = doneCallback;
	};

	Transfer.prototype = create(Object.prototype, {

	  constructor: Transfer,

	  resolve: function() {
	    this.doneCallback();
	  },
	});

	Unit.Input = Input = function Input() {
	  stream.Writable.prototype.constructor.apply(this, arguments);
	};

	Input.prototype = create(stream.Writable.prototype, {
	  constructor: Input,

	  _write: function(transfer, encoding, callback) {
	    this.emit('chain', new Transfer(data, encoding, doneCallback));
	  },
	});

	Unit.Output = Output = function Output() {
	  this._dataRequested = false;
	  this._shouldPushMore = true;
	};

	Output.prototype = create(stream.Readable.prototype, {
	  constructor: Output,

	  _read: function(size) {
	    this._dataRequested = true;
	    this.emit('need-data', this);
	  },

	  push: function() {
	    this._shouldPushMore = stream.Readable.prototype.push.apply(this, arguments);
	    this._dataRequested = false;
	  },

	  isPulling: function() {
	    return this._dataRequested;
	  },

	});

	Unit.BaseTransform = BaseTransform = function BaseTransform() {
	  this.add(new Input())
	      .add(new Output());

	  this.in(0).on('chain', this._onChain.bind(this));
	};

	BaseTransform.prototype = create(Unit.prototype, {

	  constructor: BaseTransform,

	  _onChain: function(transfer) {
	    this._transform(transfer);
	    transfer.resolve();
	    this.out(0).push(transfer.data, transfer.encoding)
	  },

	  _transform: function(transfer) {}, // virtual method to be implemented

	});

	Unit.BaseSrc = BaseSrc = function BaseSrc() {

	  this.add(new Output());

	  this.out(0).on('need-data', this._onNeedData.bind(this));
	};

	BaseSrc.prototype = create(Unit.prototype, {

	  constructor: BaseSrc,

	  _onNeedData: function() {

	    var transfer = this._source();
	    if (!transfer) {
	      return;
	    }

	    this.out(0).push(transfer.data, transfer.encoding);
	  },

	  // returns: Transfer
	  _source: function() {}, // virtual method be implemented

	});

	Unit.BasePushSrc = BasePushSrc = function BasePushSrc() {

	  this.add(new Output());

	  this.out(0).on('need-data', this._onNeedData.bind(this));

	  this._buffer = [];
	};

	BasePushSrc.prototype = create(BaseSrc.prototype, {

	  constructor: BasePushSrc,

	  _source: function() {
	    if (!this._buffer.length) {
	      return null;
	    }
	    return this._buffer.shift();
	  },

	  enqueue: function(transfer) {
	    this._buffer.push(transfer);
	  },

	});

	Unit.BaseSink = BaseSink = function BaseSink() {

	  this.add(new Input());

	  this.in(0).on('chain', this._onChain.bind(this));

	  this._buffer = [];
	};

	BaseSink.prototype = create(Unit.prototype, {

	  constructor: BaseSink,

	  _onChain: function(transfer) {
	    this._buffer.push(transfer.data);
	    transfer.resolve();
	  },

	  dequeue: function() {
	    return this._buffer.shift();
	  },

	});


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * lodash 3.1.1 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */
	var baseAssign = __webpack_require__(10),
	    baseCreate = __webpack_require__(16),
	    isIterateeCall = __webpack_require__(17);

	/**
	 * Creates an object that inherits from the given `prototype` object. If a
	 * `properties` object is provided its own enumerable properties are assigned
	 * to the created object.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} prototype The object to inherit from.
	 * @param {Object} [properties] The properties to assign to the object.
	 * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
	 * @returns {Object} Returns the new object.
	 * @example
	 *
	 * function Shape() {
	 *   this.x = 0;
	 *   this.y = 0;
	 * }
	 *
	 * function Circle() {
	 *   Shape.call(this);
	 * }
	 *
	 * Circle.prototype = _.create(Shape.prototype, {
	 *   'constructor': Circle
	 * });
	 *
	 * var circle = new Circle;
	 * circle instanceof Circle;
	 * // => true
	 *
	 * circle instanceof Shape;
	 * // => true
	 */
	function create(prototype, properties, guard) {
	  var result = baseCreate(prototype);
	  if (guard && isIterateeCall(prototype, properties, guard)) {
	    properties = undefined;
	  }
	  return properties ? baseAssign(result, properties) : result;
	}

	module.exports = create;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * lodash 3.2.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */
	var baseCopy = __webpack_require__(11),
	    keys = __webpack_require__(12);

	/**
	 * The base implementation of `_.assign` without support for argument juggling,
	 * multiple sources, and `customizer` functions.
	 *
	 * @private
	 * @param {Object} object The destination object.
	 * @param {Object} source The source object.
	 * @returns {Object} Returns `object`.
	 */
	function baseAssign(object, source) {
	  return source == null
	    ? object
	    : baseCopy(source, keys(source), object);
	}

	module.exports = baseAssign;


/***/ },
/* 11 */
/***/ function(module, exports) {

	/**
	 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/**
	 * Copies properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property names to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @returns {Object} Returns `object`.
	 */
	function baseCopy(source, props, object) {
	  object || (object = {});

	  var index = -1,
	      length = props.length;

	  while (++index < length) {
	    var key = props[index];
	    object[key] = source[key];
	  }
	  return object;
	}

	module.exports = baseCopy;


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * lodash 3.1.2 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */
	var getNative = __webpack_require__(13),
	    isArguments = __webpack_require__(14),
	    isArray = __webpack_require__(15);

	/** Used to detect unsigned integer values. */
	var reIsUint = /^\d+$/;

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeKeys = getNative(Object, 'keys');

	/**
	 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
	 * of an array-like value.
	 */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	/**
	 * Checks if `value` is array-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 */
	function isArrayLike(value) {
	  return value != null && isLength(getLength(value));
	}

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return value > -1 && value % 1 == 0 && value < length;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * A fallback implementation of `Object.keys` which creates an array of the
	 * own enumerable property names of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function shimKeys(object) {
	  var props = keysIn(object),
	      propsLength = props.length,
	      length = propsLength && object.length;

	  var allowIndexes = !!length && isLength(length) &&
	    (isArray(object) || isArguments(object));

	  var index = -1,
	      result = [];

	  while (++index < propsLength) {
	    var key = props[index];
	    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(1);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Creates an array of the own enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects. See the
	 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
	 * for more details.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keys(new Foo);
	 * // => ['a', 'b'] (iteration order is not guaranteed)
	 *
	 * _.keys('hi');
	 * // => ['0', '1']
	 */
	var keys = !nativeKeys ? shimKeys : function(object) {
	  var Ctor = object == null ? undefined : object.constructor;
	  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
	      (typeof object != 'function' && isArrayLike(object))) {
	    return shimKeys(object);
	  }
	  return isObject(object) ? nativeKeys(object) : [];
	};

	/**
	 * Creates an array of the own and inherited enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keysIn(new Foo);
	 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
	 */
	function keysIn(object) {
	  if (object == null) {
	    return [];
	  }
	  if (!isObject(object)) {
	    object = Object(object);
	  }
	  var length = object.length;
	  length = (length && isLength(length) &&
	    (isArray(object) || isArguments(object)) && length) || 0;

	  var Ctor = object.constructor,
	      index = -1,
	      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
	      result = Array(length),
	      skipIndexes = length > 0;

	  while (++index < length) {
	    result[index] = (index + '');
	  }
	  for (var key in object) {
	    if (!(skipIndexes && isIndex(key, length)) &&
	        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	module.exports = keys;


/***/ },
/* 13 */
/***/ function(module, exports) {

	/**
	 * lodash 3.9.1 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/** `Object#toString` result references. */
	var funcTag = '[object Function]';

	/** Used to detect host constructors (Safari > 5). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;

	/**
	 * Checks if `value` is object-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to resolve the decompiled source of functions. */
	var fnToString = Function.prototype.toString;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);

	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = object == null ? undefined : object[key];
	  return isNative(value) ? value : undefined;
	}

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in older versions of Chrome and Safari which return 'function' for regexes
	  // and Safari 8 equivalents which return 'object' for typed array constructors.
	  return isObject(value) && objToString.call(value) == funcTag;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(1);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Checks if `value` is a native function.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
	 * @example
	 *
	 * _.isNative(Array.prototype.push);
	 * // => true
	 *
	 * _.isNative(_);
	 * // => false
	 */
	function isNative(value) {
	  if (value == null) {
	    return false;
	  }
	  if (isFunction(value)) {
	    return reIsNative.test(fnToString.call(value));
	  }
	  return isObjectLike(value) && reIsHostCtor.test(value);
	}

	module.exports = getNative;


/***/ },
/* 14 */
/***/ function(module, exports) {

	/**
	 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/**
	 * Checks if `value` is object-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/** Native method references. */
	var propertyIsEnumerable = objectProto.propertyIsEnumerable;

	/**
	 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
	 * of an array-like value.
	 */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	/**
	 * Checks if `value` is array-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 */
	function isArrayLike(value) {
	  return value != null && isLength(getLength(value));
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is classified as an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	function isArguments(value) {
	  return isObjectLike(value) && isArrayLike(value) &&
	    hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
	}

	module.exports = isArguments;


/***/ },
/* 15 */
/***/ function(module, exports) {

	/**
	 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/** `Object#toString` result references. */
	var arrayTag = '[object Array]',
	    funcTag = '[object Function]';

	/** Used to detect host constructors (Safari > 5). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;

	/**
	 * Checks if `value` is object-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}

	/** Used for native method references. */
	var objectProto = Object.prototype;

	/** Used to resolve the decompiled source of functions. */
	var fnToString = Function.prototype.toString;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objToString = objectProto.toString;

	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);

	/* Native method references for those with the same name as other `lodash` methods. */
	var nativeIsArray = getNative(Array, 'isArray');

	/**
	 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
	 * of an array-like value.
	 */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = object == null ? undefined : object[key];
	  return isNative(value) ? value : undefined;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(function() { return arguments; }());
	 * // => false
	 */
	var isArray = nativeIsArray || function(value) {
	  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
	};

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in older versions of Chrome and Safari which return 'function' for regexes
	  // and Safari 8 equivalents which return 'object' for typed array constructors.
	  return isObject(value) && objToString.call(value) == funcTag;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(1);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Checks if `value` is a native function.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
	 * @example
	 *
	 * _.isNative(Array.prototype.push);
	 * // => true
	 *
	 * _.isNative(_);
	 * // => false
	 */
	function isNative(value) {
	  if (value == null) {
	    return false;
	  }
	  if (isFunction(value)) {
	    return reIsNative.test(fnToString.call(value));
	  }
	  return isObjectLike(value) && reIsHostCtor.test(value);
	}

	module.exports = isArray;


/***/ },
/* 16 */
/***/ function(module, exports) {

	/**
	 * lodash 3.0.3 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/**
	 * The base implementation of `_.create` without support for assigning
	 * properties to the created object.
	 *
	 * @private
	 * @param {Object} prototype The object to inherit from.
	 * @returns {Object} Returns the new object.
	 */
	var baseCreate = (function() {
	  function object() {}
	  return function(prototype) {
	    if (isObject(prototype)) {
	      object.prototype = prototype;
	      var result = new object;
	      object.prototype = undefined;
	    }
	    return result || {};
	  };
	}());

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(1);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	module.exports = baseCreate;


/***/ },
/* 17 */
/***/ function(module, exports) {

	/**
	 * lodash 3.0.9 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modern modularize exports="npm" -o ./`
	 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/** Used to detect unsigned integer values. */
	var reIsUint = /^\d+$/;

	/**
	 * Used as the [maximum length](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
	 * of an array-like value.
	 */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	/**
	 * Checks if `value` is array-like.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 */
	function isArrayLike(value) {
	  return value != null && isLength(getLength(value));
	}

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return value > -1 && value % 1 == 0 && value < length;
	}

	/**
	 * Checks if the provided arguments are from an iteratee call.
	 *
	 * @private
	 * @param {*} value The potential iteratee value argument.
	 * @param {*} index The potential iteratee index or key argument.
	 * @param {*} object The potential iteratee object argument.
	 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
	 */
	function isIterateeCall(value, index, object) {
	  if (!isObject(object)) {
	    return false;
	  }
	  var type = typeof index;
	  if (type == 'number'
	      ? (isArrayLike(object) && isIndex(index, object.length))
	      : (type == 'string' && index in object)) {
	    var other = object[index];
	    return value === value ? (value === other) : (other !== other);
	  }
	  return false;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is based on [`ToLength`](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength).
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(1);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	module.exports = isIterateeCall;


/***/ },
/* 18 */
[59, 20, 21, 55, 56, 57, 58],
/* 19 */
/***/ function(module, exports) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	function EventEmitter() {
	  this._events = this._events || {};
	  this._maxListeners = this._maxListeners || undefined;
	}
	module.exports = EventEmitter;

	// Backwards-compat with node 0.10.x
	EventEmitter.EventEmitter = EventEmitter;

	EventEmitter.prototype._events = undefined;
	EventEmitter.prototype._maxListeners = undefined;

	// By default EventEmitters will print a warning if more than 10 listeners are
	// added to it. This is a useful default which helps finding memory leaks.
	EventEmitter.defaultMaxListeners = 10;

	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	EventEmitter.prototype.setMaxListeners = function(n) {
	  if (!isNumber(n) || n < 0 || isNaN(n))
	    throw TypeError('n must be a positive number');
	  this._maxListeners = n;
	  return this;
	};

	EventEmitter.prototype.emit = function(type) {
	  var er, handler, len, args, i, listeners;

	  if (!this._events)
	    this._events = {};

	  // If there is no 'error' event listener then throw.
	  if (type === 'error') {
	    if (!this._events.error ||
	        (isObject(this._events.error) && !this._events.error.length)) {
	      er = arguments[1];
	      if (er instanceof Error) {
	        throw er; // Unhandled 'error' event
	      }
	      throw TypeError('Uncaught, unspecified "error" event.');
	    }
	  }

	  handler = this._events[type];

	  if (isUndefined(handler))
	    return false;

	  if (isFunction(handler)) {
	    switch (arguments.length) {
	      // fast cases
	      case 1:
	        handler.call(this);
	        break;
	      case 2:
	        handler.call(this, arguments[1]);
	        break;
	      case 3:
	        handler.call(this, arguments[1], arguments[2]);
	        break;
	      // slower
	      default:
	        args = Array.prototype.slice.call(arguments, 1);
	        handler.apply(this, args);
	    }
	  } else if (isObject(handler)) {
	    args = Array.prototype.slice.call(arguments, 1);
	    listeners = handler.slice();
	    len = listeners.length;
	    for (i = 0; i < len; i++)
	      listeners[i].apply(this, args);
	  }

	  return true;
	};

	EventEmitter.prototype.addListener = function(type, listener) {
	  var m;

	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  if (!this._events)
	    this._events = {};

	  // To avoid recursion in the case that type === "newListener"! Before
	  // adding it to the listeners, first emit "newListener".
	  if (this._events.newListener)
	    this.emit('newListener', type,
	              isFunction(listener.listener) ?
	              listener.listener : listener);

	  if (!this._events[type])
	    // Optimize the case of one listener. Don't need the extra array object.
	    this._events[type] = listener;
	  else if (isObject(this._events[type]))
	    // If we've already got an array, just append.
	    this._events[type].push(listener);
	  else
	    // Adding the second element, need to change to array.
	    this._events[type] = [this._events[type], listener];

	  // Check for listener leak
	  if (isObject(this._events[type]) && !this._events[type].warned) {
	    if (!isUndefined(this._maxListeners)) {
	      m = this._maxListeners;
	    } else {
	      m = EventEmitter.defaultMaxListeners;
	    }

	    if (m && m > 0 && this._events[type].length > m) {
	      this._events[type].warned = true;
	      console.error('(node) warning: possible EventEmitter memory ' +
	                    'leak detected. %d listeners added. ' +
	                    'Use emitter.setMaxListeners() to increase limit.',
	                    this._events[type].length);
	      if (typeof console.trace === 'function') {
	        // not supported in IE 10
	        console.trace();
	      }
	    }
	  }

	  return this;
	};

	EventEmitter.prototype.on = EventEmitter.prototype.addListener;

	EventEmitter.prototype.once = function(type, listener) {
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  var fired = false;

	  function g() {
	    this.removeListener(type, g);

	    if (!fired) {
	      fired = true;
	      listener.apply(this, arguments);
	    }
	  }

	  g.listener = listener;
	  this.on(type, g);

	  return this;
	};

	// emits a 'removeListener' event iff the listener was removed
	EventEmitter.prototype.removeListener = function(type, listener) {
	  var list, position, length, i;

	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  if (!this._events || !this._events[type])
	    return this;

	  list = this._events[type];
	  length = list.length;
	  position = -1;

	  if (list === listener ||
	      (isFunction(list.listener) && list.listener === listener)) {
	    delete this._events[type];
	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);

	  } else if (isObject(list)) {
	    for (i = length; i-- > 0;) {
	      if (list[i] === listener ||
	          (list[i].listener && list[i].listener === listener)) {
	        position = i;
	        break;
	      }
	    }

	    if (position < 0)
	      return this;

	    if (list.length === 1) {
	      list.length = 0;
	      delete this._events[type];
	    } else {
	      list.splice(position, 1);
	    }

	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);
	  }

	  return this;
	};

	EventEmitter.prototype.removeAllListeners = function(type) {
	  var key, listeners;

	  if (!this._events)
	    return this;

	  // not listening for removeListener, no need to emit
	  if (!this._events.removeListener) {
	    if (arguments.length === 0)
	      this._events = {};
	    else if (this._events[type])
	      delete this._events[type];
	    return this;
	  }

	  // emit removeListener for all listeners on all events
	  if (arguments.length === 0) {
	    for (key in this._events) {
	      if (key === 'removeListener') continue;
	      this.removeAllListeners(key);
	    }
	    this.removeAllListeners('removeListener');
	    this._events = {};
	    return this;
	  }

	  listeners = this._events[type];

	  if (isFunction(listeners)) {
	    this.removeListener(type, listeners);
	  } else if (listeners) {
	    // LIFO order
	    while (listeners.length)
	      this.removeListener(type, listeners[listeners.length - 1]);
	  }
	  delete this._events[type];

	  return this;
	};

	EventEmitter.prototype.listeners = function(type) {
	  var ret;
	  if (!this._events || !this._events[type])
	    ret = [];
	  else if (isFunction(this._events[type]))
	    ret = [this._events[type]];
	  else
	    ret = this._events[type].slice();
	  return ret;
	};

	EventEmitter.prototype.listenerCount = function(type) {
	  if (this._events) {
	    var evlistener = this._events[type];

	    if (isFunction(evlistener))
	      return 1;
	    else if (evlistener)
	      return evlistener.length;
	  }
	  return 0;
	};

	EventEmitter.listenerCount = function(emitter, type) {
	  return emitter.listenerCount(type);
	};

	function isFunction(arg) {
	  return typeof arg === 'function';
	}

	function isNumber(arg) {
	  return typeof arg === 'number';
	}

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}

	function isUndefined(arg) {
	  return arg === void 0;
	}


/***/ },
/* 20 */
/***/ function(module, exports) {

	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    ctor.prototype = Object.create(superCtor.prototype, {
	      constructor: {
	        value: ctor,
	        enumerable: false,
	        writable: true,
	        configurable: true
	      }
	    });
	  };
	} else {
	  // old school shim for old browsers
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    var TempCtor = function () {}
	    TempCtor.prototype = superCtor.prototype
	    ctor.prototype = new TempCtor()
	    ctor.prototype.constructor = ctor
	  }
	}


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	var Stream = (function (){
	  try {
	    return __webpack_require__(22); // hack to fix a circular dependency issue when used with browserify
	  } catch(_){}
	}());
	exports = module.exports = __webpack_require__(44);
	exports.Stream = Stream || exports;
	exports.Readable = exports;
	exports.Writable = __webpack_require__(50);
	exports.Duplex = __webpack_require__(49);
	exports.Transform = __webpack_require__(53);
	exports.PassThrough = __webpack_require__(54);


/***/ },
/* 22 */
[59, 23, 24, 40, 41, 42, 43],
/* 23 */
20,
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	exports = module.exports = __webpack_require__(25);
	exports.Stream = __webpack_require__(22);
	exports.Readable = exports;
	exports.Writable = __webpack_require__(36);
	exports.Duplex = __webpack_require__(35);
	exports.Transform = __webpack_require__(38);
	exports.PassThrough = __webpack_require__(39);


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	module.exports = Readable;

	/*<replacement>*/
	var isArray = __webpack_require__(27);
	/*</replacement>*/


	/*<replacement>*/
	var Buffer = __webpack_require__(28).Buffer;
	/*</replacement>*/

	Readable.ReadableState = ReadableState;

	var EE = __webpack_require__(19).EventEmitter;

	/*<replacement>*/
	if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
	  return emitter.listeners(type).length;
	};
	/*</replacement>*/

	var Stream = __webpack_require__(22);

	/*<replacement>*/
	var util = __webpack_require__(32);
	util.inherits = __webpack_require__(33);
	/*</replacement>*/

	var StringDecoder;


	/*<replacement>*/
	var debug = __webpack_require__(34);
	if (debug && debug.debuglog) {
	  debug = debug.debuglog('stream');
	} else {
	  debug = function () {};
	}
	/*</replacement>*/


	util.inherits(Readable, Stream);

	function ReadableState(options, stream) {
	  var Duplex = __webpack_require__(35);

	  options = options || {};

	  // the point at which it stops calling _read() to fill the buffer
	  // Note: 0 is a valid value, means "don't call _read preemptively ever"
	  var hwm = options.highWaterMark;
	  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  this.buffer = [];
	  this.length = 0;
	  this.pipes = null;
	  this.pipesCount = 0;
	  this.flowing = null;
	  this.ended = false;
	  this.endEmitted = false;
	  this.reading = false;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // whenever we return null, then we set a flag to say
	  // that we're awaiting a 'readable' event emission.
	  this.needReadable = false;
	  this.emittedReadable = false;
	  this.readableListening = false;


	  // object stream flag. Used to make read(n) ignore n and to
	  // make all the buffer merging and length checks go away
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex)
	    this.objectMode = this.objectMode || !!options.readableObjectMode;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // when piping, we only care about 'readable' events that happen
	  // after read()ing all the bytes and not getting any pushback.
	  this.ranOut = false;

	  // the number of writers that are awaiting a drain event in .pipe()s
	  this.awaitDrain = 0;

	  // if true, a maybeReadMore has been scheduled
	  this.readingMore = false;

	  this.decoder = null;
	  this.encoding = null;
	  if (options.encoding) {
	    if (!StringDecoder)
	      StringDecoder = __webpack_require__(37).StringDecoder;
	    this.decoder = new StringDecoder(options.encoding);
	    this.encoding = options.encoding;
	  }
	}

	function Readable(options) {
	  var Duplex = __webpack_require__(35);

	  if (!(this instanceof Readable))
	    return new Readable(options);

	  this._readableState = new ReadableState(options, this);

	  // legacy
	  this.readable = true;

	  Stream.call(this);
	}

	// Manually shove something into the read() buffer.
	// This returns true if the highWaterMark has not been hit yet,
	// similar to how Writable.write() returns true if you should
	// write() some more.
	Readable.prototype.push = function(chunk, encoding) {
	  var state = this._readableState;

	  if (util.isString(chunk) && !state.objectMode) {
	    encoding = encoding || state.defaultEncoding;
	    if (encoding !== state.encoding) {
	      chunk = new Buffer(chunk, encoding);
	      encoding = '';
	    }
	  }

	  return readableAddChunk(this, state, chunk, encoding, false);
	};

	// Unshift should *always* be something directly out of read()
	Readable.prototype.unshift = function(chunk) {
	  var state = this._readableState;
	  return readableAddChunk(this, state, chunk, '', true);
	};

	function readableAddChunk(stream, state, chunk, encoding, addToFront) {
	  var er = chunkInvalid(state, chunk);
	  if (er) {
	    stream.emit('error', er);
	  } else if (util.isNullOrUndefined(chunk)) {
	    state.reading = false;
	    if (!state.ended)
	      onEofChunk(stream, state);
	  } else if (state.objectMode || chunk && chunk.length > 0) {
	    if (state.ended && !addToFront) {
	      var e = new Error('stream.push() after EOF');
	      stream.emit('error', e);
	    } else if (state.endEmitted && addToFront) {
	      var e = new Error('stream.unshift() after end event');
	      stream.emit('error', e);
	    } else {
	      if (state.decoder && !addToFront && !encoding)
	        chunk = state.decoder.write(chunk);

	      if (!addToFront)
	        state.reading = false;

	      // if we want the data now, just emit it.
	      if (state.flowing && state.length === 0 && !state.sync) {
	        stream.emit('data', chunk);
	        stream.read(0);
	      } else {
	        // update the buffer info.
	        state.length += state.objectMode ? 1 : chunk.length;
	        if (addToFront)
	          state.buffer.unshift(chunk);
	        else
	          state.buffer.push(chunk);

	        if (state.needReadable)
	          emitReadable(stream);
	      }

	      maybeReadMore(stream, state);
	    }
	  } else if (!addToFront) {
	    state.reading = false;
	  }

	  return needMoreData(state);
	}



	// if it's past the high water mark, we can push in some more.
	// Also, if we have no data yet, we can stand some
	// more bytes.  This is to work around cases where hwm=0,
	// such as the repl.  Also, if the push() triggered a
	// readable event, and the user called read(largeNumber) such that
	// needReadable was set, then we ought to push more, so that another
	// 'readable' event will be triggered.
	function needMoreData(state) {
	  return !state.ended &&
	         (state.needReadable ||
	          state.length < state.highWaterMark ||
	          state.length === 0);
	}

	// backwards compatibility.
	Readable.prototype.setEncoding = function(enc) {
	  if (!StringDecoder)
	    StringDecoder = __webpack_require__(37).StringDecoder;
	  this._readableState.decoder = new StringDecoder(enc);
	  this._readableState.encoding = enc;
	  return this;
	};

	// Don't raise the hwm > 128MB
	var MAX_HWM = 0x800000;
	function roundUpToNextPowerOf2(n) {
	  if (n >= MAX_HWM) {
	    n = MAX_HWM;
	  } else {
	    // Get the next highest power of 2
	    n--;
	    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
	    n++;
	  }
	  return n;
	}

	function howMuchToRead(n, state) {
	  if (state.length === 0 && state.ended)
	    return 0;

	  if (state.objectMode)
	    return n === 0 ? 0 : 1;

	  if (isNaN(n) || util.isNull(n)) {
	    // only flow one buffer at a time
	    if (state.flowing && state.buffer.length)
	      return state.buffer[0].length;
	    else
	      return state.length;
	  }

	  if (n <= 0)
	    return 0;

	  // If we're asking for more than the target buffer level,
	  // then raise the water mark.  Bump up to the next highest
	  // power of 2, to prevent increasing it excessively in tiny
	  // amounts.
	  if (n > state.highWaterMark)
	    state.highWaterMark = roundUpToNextPowerOf2(n);

	  // don't have that much.  return null, unless we've ended.
	  if (n > state.length) {
	    if (!state.ended) {
	      state.needReadable = true;
	      return 0;
	    } else
	      return state.length;
	  }

	  return n;
	}

	// you can override either this method, or the async _read(n) below.
	Readable.prototype.read = function(n) {
	  debug('read', n);
	  var state = this._readableState;
	  var nOrig = n;

	  if (!util.isNumber(n) || n > 0)
	    state.emittedReadable = false;

	  // if we're doing read(0) to trigger a readable event, but we
	  // already have a bunch of data in the buffer, then just trigger
	  // the 'readable' event and move on.
	  if (n === 0 &&
	      state.needReadable &&
	      (state.length >= state.highWaterMark || state.ended)) {
	    debug('read: emitReadable', state.length, state.ended);
	    if (state.length === 0 && state.ended)
	      endReadable(this);
	    else
	      emitReadable(this);
	    return null;
	  }

	  n = howMuchToRead(n, state);

	  // if we've ended, and we're now clear, then finish it up.
	  if (n === 0 && state.ended) {
	    if (state.length === 0)
	      endReadable(this);
	    return null;
	  }

	  // All the actual chunk generation logic needs to be
	  // *below* the call to _read.  The reason is that in certain
	  // synthetic stream cases, such as passthrough streams, _read
	  // may be a completely synchronous operation which may change
	  // the state of the read buffer, providing enough data when
	  // before there was *not* enough.
	  //
	  // So, the steps are:
	  // 1. Figure out what the state of things will be after we do
	  // a read from the buffer.
	  //
	  // 2. If that resulting state will trigger a _read, then call _read.
	  // Note that this may be asynchronous, or synchronous.  Yes, it is
	  // deeply ugly to write APIs this way, but that still doesn't mean
	  // that the Readable class should behave improperly, as streams are
	  // designed to be sync/async agnostic.
	  // Take note if the _read call is sync or async (ie, if the read call
	  // has returned yet), so that we know whether or not it's safe to emit
	  // 'readable' etc.
	  //
	  // 3. Actually pull the requested chunks out of the buffer and return.

	  // if we need a readable event, then we need to do some reading.
	  var doRead = state.needReadable;
	  debug('need readable', doRead);

	  // if we currently have less than the highWaterMark, then also read some
	  if (state.length === 0 || state.length - n < state.highWaterMark) {
	    doRead = true;
	    debug('length less than watermark', doRead);
	  }

	  // however, if we've ended, then there's no point, and if we're already
	  // reading, then it's unnecessary.
	  if (state.ended || state.reading) {
	    doRead = false;
	    debug('reading or ended', doRead);
	  }

	  if (doRead) {
	    debug('do read');
	    state.reading = true;
	    state.sync = true;
	    // if the length is currently zero, then we *need* a readable event.
	    if (state.length === 0)
	      state.needReadable = true;
	    // call internal read method
	    this._read(state.highWaterMark);
	    state.sync = false;
	  }

	  // If _read pushed data synchronously, then `reading` will be false,
	  // and we need to re-evaluate how much data we can return to the user.
	  if (doRead && !state.reading)
	    n = howMuchToRead(nOrig, state);

	  var ret;
	  if (n > 0)
	    ret = fromList(n, state);
	  else
	    ret = null;

	  if (util.isNull(ret)) {
	    state.needReadable = true;
	    n = 0;
	  }

	  state.length -= n;

	  // If we have nothing in the buffer, then we want to know
	  // as soon as we *do* get something into the buffer.
	  if (state.length === 0 && !state.ended)
	    state.needReadable = true;

	  // If we tried to read() past the EOF, then emit end on the next tick.
	  if (nOrig !== n && state.ended && state.length === 0)
	    endReadable(this);

	  if (!util.isNull(ret))
	    this.emit('data', ret);

	  return ret;
	};

	function chunkInvalid(state, chunk) {
	  var er = null;
	  if (!util.isBuffer(chunk) &&
	      !util.isString(chunk) &&
	      !util.isNullOrUndefined(chunk) &&
	      !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  return er;
	}


	function onEofChunk(stream, state) {
	  if (state.decoder && !state.ended) {
	    var chunk = state.decoder.end();
	    if (chunk && chunk.length) {
	      state.buffer.push(chunk);
	      state.length += state.objectMode ? 1 : chunk.length;
	    }
	  }
	  state.ended = true;

	  // emit 'readable' now to make sure it gets picked up.
	  emitReadable(stream);
	}

	// Don't emit readable right away in sync mode, because this can trigger
	// another read() call => stack overflow.  This way, it might trigger
	// a nextTick recursion warning, but that's not so bad.
	function emitReadable(stream) {
	  var state = stream._readableState;
	  state.needReadable = false;
	  if (!state.emittedReadable) {
	    debug('emitReadable', state.flowing);
	    state.emittedReadable = true;
	    if (state.sync)
	      process.nextTick(function() {
	        emitReadable_(stream);
	      });
	    else
	      emitReadable_(stream);
	  }
	}

	function emitReadable_(stream) {
	  debug('emit readable');
	  stream.emit('readable');
	  flow(stream);
	}


	// at this point, the user has presumably seen the 'readable' event,
	// and called read() to consume some data.  that may have triggered
	// in turn another _read(n) call, in which case reading = true if
	// it's in progress.
	// However, if we're not ended, or reading, and the length < hwm,
	// then go ahead and try to read some more preemptively.
	function maybeReadMore(stream, state) {
	  if (!state.readingMore) {
	    state.readingMore = true;
	    process.nextTick(function() {
	      maybeReadMore_(stream, state);
	    });
	  }
	}

	function maybeReadMore_(stream, state) {
	  var len = state.length;
	  while (!state.reading && !state.flowing && !state.ended &&
	         state.length < state.highWaterMark) {
	    debug('maybeReadMore read 0');
	    stream.read(0);
	    if (len === state.length)
	      // didn't get any data, stop spinning.
	      break;
	    else
	      len = state.length;
	  }
	  state.readingMore = false;
	}

	// abstract method.  to be overridden in specific implementation classes.
	// call cb(er, data) where data is <= n in length.
	// for virtual (non-string, non-buffer) streams, "length" is somewhat
	// arbitrary, and perhaps not very meaningful.
	Readable.prototype._read = function(n) {
	  this.emit('error', new Error('not implemented'));
	};

	Readable.prototype.pipe = function(dest, pipeOpts) {
	  var src = this;
	  var state = this._readableState;

	  switch (state.pipesCount) {
	    case 0:
	      state.pipes = dest;
	      break;
	    case 1:
	      state.pipes = [state.pipes, dest];
	      break;
	    default:
	      state.pipes.push(dest);
	      break;
	  }
	  state.pipesCount += 1;
	  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

	  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
	              dest !== process.stdout &&
	              dest !== process.stderr;

	  var endFn = doEnd ? onend : cleanup;
	  if (state.endEmitted)
	    process.nextTick(endFn);
	  else
	    src.once('end', endFn);

	  dest.on('unpipe', onunpipe);
	  function onunpipe(readable) {
	    debug('onunpipe');
	    if (readable === src) {
	      cleanup();
	    }
	  }

	  function onend() {
	    debug('onend');
	    dest.end();
	  }

	  // when the dest drains, it reduces the awaitDrain counter
	  // on the source.  This would be more elegant with a .once()
	  // handler in flow(), but adding and removing repeatedly is
	  // too slow.
	  var ondrain = pipeOnDrain(src);
	  dest.on('drain', ondrain);

	  function cleanup() {
	    debug('cleanup');
	    // cleanup event handlers once the pipe is broken
	    dest.removeListener('close', onclose);
	    dest.removeListener('finish', onfinish);
	    dest.removeListener('drain', ondrain);
	    dest.removeListener('error', onerror);
	    dest.removeListener('unpipe', onunpipe);
	    src.removeListener('end', onend);
	    src.removeListener('end', cleanup);
	    src.removeListener('data', ondata);

	    // if the reader is waiting for a drain event from this
	    // specific writer, then it would cause it to never start
	    // flowing again.
	    // So, if this is awaiting a drain, then we just call it now.
	    // If we don't know, then assume that we are waiting for one.
	    if (state.awaitDrain &&
	        (!dest._writableState || dest._writableState.needDrain))
	      ondrain();
	  }

	  src.on('data', ondata);
	  function ondata(chunk) {
	    debug('ondata');
	    var ret = dest.write(chunk);
	    if (false === ret) {
	      debug('false write response, pause',
	            src._readableState.awaitDrain);
	      src._readableState.awaitDrain++;
	      src.pause();
	    }
	  }

	  // if the dest has an error, then stop piping into it.
	  // however, don't suppress the throwing behavior for this.
	  function onerror(er) {
	    debug('onerror', er);
	    unpipe();
	    dest.removeListener('error', onerror);
	    if (EE.listenerCount(dest, 'error') === 0)
	      dest.emit('error', er);
	  }
	  // This is a brutally ugly hack to make sure that our error handler
	  // is attached before any userland ones.  NEVER DO THIS.
	  if (!dest._events || !dest._events.error)
	    dest.on('error', onerror);
	  else if (isArray(dest._events.error))
	    dest._events.error.unshift(onerror);
	  else
	    dest._events.error = [onerror, dest._events.error];



	  // Both close and finish should trigger unpipe, but only once.
	  function onclose() {
	    dest.removeListener('finish', onfinish);
	    unpipe();
	  }
	  dest.once('close', onclose);
	  function onfinish() {
	    debug('onfinish');
	    dest.removeListener('close', onclose);
	    unpipe();
	  }
	  dest.once('finish', onfinish);

	  function unpipe() {
	    debug('unpipe');
	    src.unpipe(dest);
	  }

	  // tell the dest that it's being piped to
	  dest.emit('pipe', src);

	  // start the flow if it hasn't been started already.
	  if (!state.flowing) {
	    debug('pipe resume');
	    src.resume();
	  }

	  return dest;
	};

	function pipeOnDrain(src) {
	  return function() {
	    var state = src._readableState;
	    debug('pipeOnDrain', state.awaitDrain);
	    if (state.awaitDrain)
	      state.awaitDrain--;
	    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
	      state.flowing = true;
	      flow(src);
	    }
	  };
	}


	Readable.prototype.unpipe = function(dest) {
	  var state = this._readableState;

	  // if we're not piping anywhere, then do nothing.
	  if (state.pipesCount === 0)
	    return this;

	  // just one destination.  most common case.
	  if (state.pipesCount === 1) {
	    // passed in one, but it's not the right one.
	    if (dest && dest !== state.pipes)
	      return this;

	    if (!dest)
	      dest = state.pipes;

	    // got a match.
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;
	    if (dest)
	      dest.emit('unpipe', this);
	    return this;
	  }

	  // slow case. multiple pipe destinations.

	  if (!dest) {
	    // remove all.
	    var dests = state.pipes;
	    var len = state.pipesCount;
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;

	    for (var i = 0; i < len; i++)
	      dests[i].emit('unpipe', this);
	    return this;
	  }

	  // try to find the right one.
	  var i = indexOf(state.pipes, dest);
	  if (i === -1)
	    return this;

	  state.pipes.splice(i, 1);
	  state.pipesCount -= 1;
	  if (state.pipesCount === 1)
	    state.pipes = state.pipes[0];

	  dest.emit('unpipe', this);

	  return this;
	};

	// set up data events if they are asked for
	// Ensure readable listeners eventually get something
	Readable.prototype.on = function(ev, fn) {
	  var res = Stream.prototype.on.call(this, ev, fn);

	  // If listening to data, and it has not explicitly been paused,
	  // then call resume to start the flow of data on the next tick.
	  if (ev === 'data' && false !== this._readableState.flowing) {
	    this.resume();
	  }

	  if (ev === 'readable' && this.readable) {
	    var state = this._readableState;
	    if (!state.readableListening) {
	      state.readableListening = true;
	      state.emittedReadable = false;
	      state.needReadable = true;
	      if (!state.reading) {
	        var self = this;
	        process.nextTick(function() {
	          debug('readable nexttick read 0');
	          self.read(0);
	        });
	      } else if (state.length) {
	        emitReadable(this, state);
	      }
	    }
	  }

	  return res;
	};
	Readable.prototype.addListener = Readable.prototype.on;

	// pause() and resume() are remnants of the legacy readable stream API
	// If the user uses them, then switch into old mode.
	Readable.prototype.resume = function() {
	  var state = this._readableState;
	  if (!state.flowing) {
	    debug('resume');
	    state.flowing = true;
	    if (!state.reading) {
	      debug('resume read 0');
	      this.read(0);
	    }
	    resume(this, state);
	  }
	  return this;
	};

	function resume(stream, state) {
	  if (!state.resumeScheduled) {
	    state.resumeScheduled = true;
	    process.nextTick(function() {
	      resume_(stream, state);
	    });
	  }
	}

	function resume_(stream, state) {
	  state.resumeScheduled = false;
	  stream.emit('resume');
	  flow(stream);
	  if (state.flowing && !state.reading)
	    stream.read(0);
	}

	Readable.prototype.pause = function() {
	  debug('call pause flowing=%j', this._readableState.flowing);
	  if (false !== this._readableState.flowing) {
	    debug('pause');
	    this._readableState.flowing = false;
	    this.emit('pause');
	  }
	  return this;
	};

	function flow(stream) {
	  var state = stream._readableState;
	  debug('flow', state.flowing);
	  if (state.flowing) {
	    do {
	      var chunk = stream.read();
	    } while (null !== chunk && state.flowing);
	  }
	}

	// wrap an old-style stream as the async data source.
	// This is *not* part of the readable stream interface.
	// It is an ugly unfortunate mess of history.
	Readable.prototype.wrap = function(stream) {
	  var state = this._readableState;
	  var paused = false;

	  var self = this;
	  stream.on('end', function() {
	    debug('wrapped end');
	    if (state.decoder && !state.ended) {
	      var chunk = state.decoder.end();
	      if (chunk && chunk.length)
	        self.push(chunk);
	    }

	    self.push(null);
	  });

	  stream.on('data', function(chunk) {
	    debug('wrapped data');
	    if (state.decoder)
	      chunk = state.decoder.write(chunk);
	    if (!chunk || !state.objectMode && !chunk.length)
	      return;

	    var ret = self.push(chunk);
	    if (!ret) {
	      paused = true;
	      stream.pause();
	    }
	  });

	  // proxy all the other methods.
	  // important when wrapping filters and duplexes.
	  for (var i in stream) {
	    if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
	      this[i] = function(method) { return function() {
	        return stream[method].apply(stream, arguments);
	      }}(i);
	    }
	  }

	  // proxy certain important events.
	  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
	  forEach(events, function(ev) {
	    stream.on(ev, self.emit.bind(self, ev));
	  });

	  // when we try to consume some more bytes, simply unpause the
	  // underlying stream.
	  self._read = function(n) {
	    debug('wrapped _read', n);
	    if (paused) {
	      paused = false;
	      stream.resume();
	    }
	  };

	  return self;
	};



	// exposed for testing purposes only.
	Readable._fromList = fromList;

	// Pluck off n bytes from an array of buffers.
	// Length is the combined lengths of all the buffers in the list.
	function fromList(n, state) {
	  var list = state.buffer;
	  var length = state.length;
	  var stringMode = !!state.decoder;
	  var objectMode = !!state.objectMode;
	  var ret;

	  // nothing in the list, definitely empty.
	  if (list.length === 0)
	    return null;

	  if (length === 0)
	    ret = null;
	  else if (objectMode)
	    ret = list.shift();
	  else if (!n || n >= length) {
	    // read it all, truncate the array.
	    if (stringMode)
	      ret = list.join('');
	    else
	      ret = Buffer.concat(list, length);
	    list.length = 0;
	  } else {
	    // read just some of it.
	    if (n < list[0].length) {
	      // just take a part of the first list item.
	      // slice is the same for buffers and strings.
	      var buf = list[0];
	      ret = buf.slice(0, n);
	      list[0] = buf.slice(n);
	    } else if (n === list[0].length) {
	      // first list is a perfect match
	      ret = list.shift();
	    } else {
	      // complex case.
	      // we have enough to cover it, but it spans past the first buffer.
	      if (stringMode)
	        ret = '';
	      else
	        ret = new Buffer(n);

	      var c = 0;
	      for (var i = 0, l = list.length; i < l && c < n; i++) {
	        var buf = list[0];
	        var cpy = Math.min(n - c, buf.length);

	        if (stringMode)
	          ret += buf.slice(0, cpy);
	        else
	          buf.copy(ret, c, 0, cpy);

	        if (cpy < buf.length)
	          list[0] = buf.slice(cpy);
	        else
	          list.shift();

	        c += cpy;
	      }
	    }
	  }

	  return ret;
	}

	function endReadable(stream) {
	  var state = stream._readableState;

	  // If we get here before consuming all the bytes, then that is a
	  // bug in node.  Should never happen.
	  if (state.length > 0)
	    throw new Error('endReadable called on non-empty stream');

	  if (!state.endEmitted) {
	    state.ended = true;
	    process.nextTick(function() {
	      // Check that we didn't get one last unshift.
	      if (!state.endEmitted && state.length === 0) {
	        state.endEmitted = true;
	        stream.readable = false;
	        stream.emit('end');
	      }
	    });
	  }
	}

	function forEach (xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}

	function indexOf (xs, x) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    if (xs[i] === x) return i;
	  }
	  return -1;
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(26)))

/***/ },
/* 26 */
/***/ function(module, exports) {

	// shim for using process in browser

	var process = module.exports = {};
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;

	function cleanUpNextTick() {
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}

	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = setTimeout(cleanUpNextTick);
	    draining = true;

	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    clearTimeout(timeout);
	}

	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        setTimeout(drainQueue, 0);
	    }
	};

	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};

	function noop() {}

	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;

	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};

	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ },
/* 27 */
/***/ function(module, exports) {

	module.exports = Array.isArray || function (arr) {
	  return Object.prototype.toString.call(arr) == '[object Array]';
	};


/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(Buffer, global) {/*!
	 * The buffer module from node.js, for the browser.
	 *
	 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
	 * @license  MIT
	 */
	/* eslint-disable no-proto */

	var base64 = __webpack_require__(29)
	var ieee754 = __webpack_require__(30)
	var isArray = __webpack_require__(31)

	exports.Buffer = Buffer
	exports.SlowBuffer = SlowBuffer
	exports.INSPECT_MAX_BYTES = 50
	Buffer.poolSize = 8192 // not used by this implementation

	var rootParent = {}

	/**
	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
	 *   === true    Use Uint8Array implementation (fastest)
	 *   === false   Use Object implementation (most compatible, even IE6)
	 *
	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
	 * Opera 11.6+, iOS 4.2+.
	 *
	 * Due to various browser bugs, sometimes the Object implementation will be used even
	 * when the browser supports typed arrays.
	 *
	 * Note:
	 *
	 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
	 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
	 *
	 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
	 *     on objects.
	 *
	 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
	 *
	 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
	 *     incorrect length in some situations.

	 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
	 * get the Object implementation, which is slower but behaves correctly.
	 */
	Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
	  ? global.TYPED_ARRAY_SUPPORT
	  : (function () {
	      function Bar () {}
	      try {
	        var arr = new Uint8Array(1)
	        arr.foo = function () { return 42 }
	        arr.constructor = Bar
	        return arr.foo() === 42 && // typed array instances can be augmented
	            arr.constructor === Bar && // constructor can be set
	            typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
	            arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
	      } catch (e) {
	        return false
	      }
	    })()

	function kMaxLength () {
	  return Buffer.TYPED_ARRAY_SUPPORT
	    ? 0x7fffffff
	    : 0x3fffffff
	}

	/**
	 * Class: Buffer
	 * =============
	 *
	 * The Buffer constructor returns instances of `Uint8Array` that are augmented
	 * with function properties for all the node `Buffer` API functions. We use
	 * `Uint8Array` so that square bracket notation works as expected -- it returns
	 * a single octet.
	 *
	 * By augmenting the instances, we can avoid modifying the `Uint8Array`
	 * prototype.
	 */
	function Buffer (arg) {
	  if (!(this instanceof Buffer)) {
	    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
	    if (arguments.length > 1) return new Buffer(arg, arguments[1])
	    return new Buffer(arg)
	  }

	  this.length = 0
	  this.parent = undefined

	  // Common case.
	  if (typeof arg === 'number') {
	    return fromNumber(this, arg)
	  }

	  // Slightly less common case.
	  if (typeof arg === 'string') {
	    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
	  }

	  // Unusual.
	  return fromObject(this, arg)
	}

	function fromNumber (that, length) {
	  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) {
	    for (var i = 0; i < length; i++) {
	      that[i] = 0
	    }
	  }
	  return that
	}

	function fromString (that, string, encoding) {
	  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

	  // Assumption: byteLength() return value is always < kMaxLength.
	  var length = byteLength(string, encoding) | 0
	  that = allocate(that, length)

	  that.write(string, encoding)
	  return that
	}

	function fromObject (that, object) {
	  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

	  if (isArray(object)) return fromArray(that, object)

	  if (object == null) {
	    throw new TypeError('must start with number, buffer, array or string')
	  }

	  if (typeof ArrayBuffer !== 'undefined') {
	    if (object.buffer instanceof ArrayBuffer) {
	      return fromTypedArray(that, object)
	    }
	    if (object instanceof ArrayBuffer) {
	      return fromArrayBuffer(that, object)
	    }
	  }

	  if (object.length) return fromArrayLike(that, object)

	  return fromJsonObject(that, object)
	}

	function fromBuffer (that, buffer) {
	  var length = checked(buffer.length) | 0
	  that = allocate(that, length)
	  buffer.copy(that, 0, 0, length)
	  return that
	}

	function fromArray (that, array) {
	  var length = checked(array.length) | 0
	  that = allocate(that, length)
	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255
	  }
	  return that
	}

	// Duplicate of fromArray() to keep fromArray() monomorphic.
	function fromTypedArray (that, array) {
	  var length = checked(array.length) | 0
	  that = allocate(that, length)
	  // Truncating the elements is probably not what people expect from typed
	  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
	  // of the old Buffer constructor.
	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255
	  }
	  return that
	}

	function fromArrayBuffer (that, array) {
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    array.byteLength
	    that = Buffer._augment(new Uint8Array(array))
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    that = fromTypedArray(that, new Uint8Array(array))
	  }
	  return that
	}

	function fromArrayLike (that, array) {
	  var length = checked(array.length) | 0
	  that = allocate(that, length)
	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255
	  }
	  return that
	}

	// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
	// Returns a zero-length buffer for inputs that don't conform to the spec.
	function fromJsonObject (that, object) {
	  var array
	  var length = 0

	  if (object.type === 'Buffer' && isArray(object.data)) {
	    array = object.data
	    length = checked(array.length) | 0
	  }
	  that = allocate(that, length)

	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255
	  }
	  return that
	}

	if (Buffer.TYPED_ARRAY_SUPPORT) {
	  Buffer.prototype.__proto__ = Uint8Array.prototype
	  Buffer.__proto__ = Uint8Array
	}

	function allocate (that, length) {
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = Buffer._augment(new Uint8Array(length))
	    that.__proto__ = Buffer.prototype
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    that.length = length
	    that._isBuffer = true
	  }

	  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
	  if (fromPool) that.parent = rootParent

	  return that
	}

	function checked (length) {
	  // Note: cannot use `length < kMaxLength` here because that fails when
	  // length is NaN (which is otherwise coerced to zero.)
	  if (length >= kMaxLength()) {
	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
	                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
	  }
	  return length | 0
	}

	function SlowBuffer (subject, encoding) {
	  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

	  var buf = new Buffer(subject, encoding)
	  delete buf.parent
	  return buf
	}

	Buffer.isBuffer = function isBuffer (b) {
	  return !!(b != null && b._isBuffer)
	}

	Buffer.compare = function compare (a, b) {
	  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
	    throw new TypeError('Arguments must be Buffers')
	  }

	  if (a === b) return 0

	  var x = a.length
	  var y = b.length

	  var i = 0
	  var len = Math.min(x, y)
	  while (i < len) {
	    if (a[i] !== b[i]) break

	    ++i
	  }

	  if (i !== len) {
	    x = a[i]
	    y = b[i]
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	}

	Buffer.isEncoding = function isEncoding (encoding) {
	  switch (String(encoding).toLowerCase()) {
	    case 'hex':
	    case 'utf8':
	    case 'utf-8':
	    case 'ascii':
	    case 'binary':
	    case 'base64':
	    case 'raw':
	    case 'ucs2':
	    case 'ucs-2':
	    case 'utf16le':
	    case 'utf-16le':
	      return true
	    default:
	      return false
	  }
	}

	Buffer.concat = function concat (list, length) {
	  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

	  if (list.length === 0) {
	    return new Buffer(0)
	  }

	  var i
	  if (length === undefined) {
	    length = 0
	    for (i = 0; i < list.length; i++) {
	      length += list[i].length
	    }
	  }

	  var buf = new Buffer(length)
	  var pos = 0
	  for (i = 0; i < list.length; i++) {
	    var item = list[i]
	    item.copy(buf, pos)
	    pos += item.length
	  }
	  return buf
	}

	function byteLength (string, encoding) {
	  if (typeof string !== 'string') string = '' + string

	  var len = string.length
	  if (len === 0) return 0

	  // Use a for loop to avoid recursion
	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'ascii':
	      case 'binary':
	      // Deprecated
	      case 'raw':
	      case 'raws':
	        return len
	      case 'utf8':
	      case 'utf-8':
	        return utf8ToBytes(string).length
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return len * 2
	      case 'hex':
	        return len >>> 1
	      case 'base64':
	        return base64ToBytes(string).length
	      default:
	        if (loweredCase) return utf8ToBytes(string).length // assume utf8
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}
	Buffer.byteLength = byteLength

	// pre-set for values that may exist in the future
	Buffer.prototype.length = undefined
	Buffer.prototype.parent = undefined

	function slowToString (encoding, start, end) {
	  var loweredCase = false

	  start = start | 0
	  end = end === undefined || end === Infinity ? this.length : end | 0

	  if (!encoding) encoding = 'utf8'
	  if (start < 0) start = 0
	  if (end > this.length) end = this.length
	  if (end <= start) return ''

	  while (true) {
	    switch (encoding) {
	      case 'hex':
	        return hexSlice(this, start, end)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Slice(this, start, end)

	      case 'ascii':
	        return asciiSlice(this, start, end)

	      case 'binary':
	        return binarySlice(this, start, end)

	      case 'base64':
	        return base64Slice(this, start, end)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return utf16leSlice(this, start, end)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = (encoding + '').toLowerCase()
	        loweredCase = true
	    }
	  }
	}

	Buffer.prototype.toString = function toString () {
	  var length = this.length | 0
	  if (length === 0) return ''
	  if (arguments.length === 0) return utf8Slice(this, 0, length)
	  return slowToString.apply(this, arguments)
	}

	Buffer.prototype.equals = function equals (b) {
	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
	  if (this === b) return true
	  return Buffer.compare(this, b) === 0
	}

	Buffer.prototype.inspect = function inspect () {
	  var str = ''
	  var max = exports.INSPECT_MAX_BYTES
	  if (this.length > 0) {
	    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
	    if (this.length > max) str += ' ... '
	  }
	  return '<Buffer ' + str + '>'
	}

	Buffer.prototype.compare = function compare (b) {
	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
	  if (this === b) return 0
	  return Buffer.compare(this, b)
	}

	Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
	  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
	  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
	  byteOffset >>= 0

	  if (this.length === 0) return -1
	  if (byteOffset >= this.length) return -1

	  // Negative offsets start from the end of the buffer
	  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

	  if (typeof val === 'string') {
	    if (val.length === 0) return -1 // special case: looking for empty string always fails
	    return String.prototype.indexOf.call(this, val, byteOffset)
	  }
	  if (Buffer.isBuffer(val)) {
	    return arrayIndexOf(this, val, byteOffset)
	  }
	  if (typeof val === 'number') {
	    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
	      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
	    }
	    return arrayIndexOf(this, [ val ], byteOffset)
	  }

	  function arrayIndexOf (arr, val, byteOffset) {
	    var foundIndex = -1
	    for (var i = 0; byteOffset + i < arr.length; i++) {
	      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
	        if (foundIndex === -1) foundIndex = i
	        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
	      } else {
	        foundIndex = -1
	      }
	    }
	    return -1
	  }

	  throw new TypeError('val must be string, number or Buffer')
	}

	// `get` is deprecated
	Buffer.prototype.get = function get (offset) {
	  console.log('.get() is deprecated. Access using array indexes instead.')
	  return this.readUInt8(offset)
	}

	// `set` is deprecated
	Buffer.prototype.set = function set (v, offset) {
	  console.log('.set() is deprecated. Access using array indexes instead.')
	  return this.writeUInt8(v, offset)
	}

	function hexWrite (buf, string, offset, length) {
	  offset = Number(offset) || 0
	  var remaining = buf.length - offset
	  if (!length) {
	    length = remaining
	  } else {
	    length = Number(length)
	    if (length > remaining) {
	      length = remaining
	    }
	  }

	  // must be an even number of digits
	  var strLen = string.length
	  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

	  if (length > strLen / 2) {
	    length = strLen / 2
	  }
	  for (var i = 0; i < length; i++) {
	    var parsed = parseInt(string.substr(i * 2, 2), 16)
	    if (isNaN(parsed)) throw new Error('Invalid hex string')
	    buf[offset + i] = parsed
	  }
	  return i
	}

	function utf8Write (buf, string, offset, length) {
	  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
	}

	function asciiWrite (buf, string, offset, length) {
	  return blitBuffer(asciiToBytes(string), buf, offset, length)
	}

	function binaryWrite (buf, string, offset, length) {
	  return asciiWrite(buf, string, offset, length)
	}

	function base64Write (buf, string, offset, length) {
	  return blitBuffer(base64ToBytes(string), buf, offset, length)
	}

	function ucs2Write (buf, string, offset, length) {
	  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
	}

	Buffer.prototype.write = function write (string, offset, length, encoding) {
	  // Buffer#write(string)
	  if (offset === undefined) {
	    encoding = 'utf8'
	    length = this.length
	    offset = 0
	  // Buffer#write(string, encoding)
	  } else if (length === undefined && typeof offset === 'string') {
	    encoding = offset
	    length = this.length
	    offset = 0
	  // Buffer#write(string, offset[, length][, encoding])
	  } else if (isFinite(offset)) {
	    offset = offset | 0
	    if (isFinite(length)) {
	      length = length | 0
	      if (encoding === undefined) encoding = 'utf8'
	    } else {
	      encoding = length
	      length = undefined
	    }
	  // legacy write(string, encoding, offset, length) - remove in v0.13
	  } else {
	    var swap = encoding
	    encoding = offset
	    offset = length | 0
	    length = swap
	  }

	  var remaining = this.length - offset
	  if (length === undefined || length > remaining) length = remaining

	  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
	    throw new RangeError('attempt to write outside buffer bounds')
	  }

	  if (!encoding) encoding = 'utf8'

	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'hex':
	        return hexWrite(this, string, offset, length)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Write(this, string, offset, length)

	      case 'ascii':
	        return asciiWrite(this, string, offset, length)

	      case 'binary':
	        return binaryWrite(this, string, offset, length)

	      case 'base64':
	        // Warning: maxLength not taken into account in base64Write
	        return base64Write(this, string, offset, length)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return ucs2Write(this, string, offset, length)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}

	Buffer.prototype.toJSON = function toJSON () {
	  return {
	    type: 'Buffer',
	    data: Array.prototype.slice.call(this._arr || this, 0)
	  }
	}

	function base64Slice (buf, start, end) {
	  if (start === 0 && end === buf.length) {
	    return base64.fromByteArray(buf)
	  } else {
	    return base64.fromByteArray(buf.slice(start, end))
	  }
	}

	function utf8Slice (buf, start, end) {
	  end = Math.min(buf.length, end)
	  var res = []

	  var i = start
	  while (i < end) {
	    var firstByte = buf[i]
	    var codePoint = null
	    var bytesPerSequence = (firstByte > 0xEF) ? 4
	      : (firstByte > 0xDF) ? 3
	      : (firstByte > 0xBF) ? 2
	      : 1

	    if (i + bytesPerSequence <= end) {
	      var secondByte, thirdByte, fourthByte, tempCodePoint

	      switch (bytesPerSequence) {
	        case 1:
	          if (firstByte < 0x80) {
	            codePoint = firstByte
	          }
	          break
	        case 2:
	          secondByte = buf[i + 1]
	          if ((secondByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
	            if (tempCodePoint > 0x7F) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 3:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
	            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 4:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          fourthByte = buf[i + 3]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
	            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
	              codePoint = tempCodePoint
	            }
	          }
	      }
	    }

	    if (codePoint === null) {
	      // we did not generate a valid codePoint so insert a
	      // replacement char (U+FFFD) and advance only 1 byte
	      codePoint = 0xFFFD
	      bytesPerSequence = 1
	    } else if (codePoint > 0xFFFF) {
	      // encode to utf16 (surrogate pair dance)
	      codePoint -= 0x10000
	      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
	      codePoint = 0xDC00 | codePoint & 0x3FF
	    }

	    res.push(codePoint)
	    i += bytesPerSequence
	  }

	  return decodeCodePointsArray(res)
	}

	// Based on http://stackoverflow.com/a/22747272/680742, the browser with
	// the lowest limit is Chrome, with 0x10000 args.
	// We go 1 magnitude less, for safety
	var MAX_ARGUMENTS_LENGTH = 0x1000

	function decodeCodePointsArray (codePoints) {
	  var len = codePoints.length
	  if (len <= MAX_ARGUMENTS_LENGTH) {
	    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
	  }

	  // Decode in chunks to avoid "call stack size exceeded".
	  var res = ''
	  var i = 0
	  while (i < len) {
	    res += String.fromCharCode.apply(
	      String,
	      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
	    )
	  }
	  return res
	}

	function asciiSlice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)

	  for (var i = start; i < end; i++) {
	    ret += String.fromCharCode(buf[i] & 0x7F)
	  }
	  return ret
	}

	function binarySlice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)

	  for (var i = start; i < end; i++) {
	    ret += String.fromCharCode(buf[i])
	  }
	  return ret
	}

	function hexSlice (buf, start, end) {
	  var len = buf.length

	  if (!start || start < 0) start = 0
	  if (!end || end < 0 || end > len) end = len

	  var out = ''
	  for (var i = start; i < end; i++) {
	    out += toHex(buf[i])
	  }
	  return out
	}

	function utf16leSlice (buf, start, end) {
	  var bytes = buf.slice(start, end)
	  var res = ''
	  for (var i = 0; i < bytes.length; i += 2) {
	    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
	  }
	  return res
	}

	Buffer.prototype.slice = function slice (start, end) {
	  var len = this.length
	  start = ~~start
	  end = end === undefined ? len : ~~end

	  if (start < 0) {
	    start += len
	    if (start < 0) start = 0
	  } else if (start > len) {
	    start = len
	  }

	  if (end < 0) {
	    end += len
	    if (end < 0) end = 0
	  } else if (end > len) {
	    end = len
	  }

	  if (end < start) end = start

	  var newBuf
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    newBuf = Buffer._augment(this.subarray(start, end))
	  } else {
	    var sliceLen = end - start
	    newBuf = new Buffer(sliceLen, undefined)
	    for (var i = 0; i < sliceLen; i++) {
	      newBuf[i] = this[i + start]
	    }
	  }

	  if (newBuf.length) newBuf.parent = this.parent || this

	  return newBuf
	}

	/*
	 * Need to make sure that buffer isn't trying to write out of bounds.
	 */
	function checkOffset (offset, ext, length) {
	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
	}

	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }

	  return val
	}

	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    checkOffset(offset, byteLength, this.length)
	  }

	  var val = this[offset + --byteLength]
	  var mul = 1
	  while (byteLength > 0 && (mul *= 0x100)) {
	    val += this[offset + --byteLength] * mul
	  }

	  return val
	}

	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  return this[offset]
	}

	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return this[offset] | (this[offset + 1] << 8)
	}

	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return (this[offset] << 8) | this[offset + 1]
	}

	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return ((this[offset]) |
	      (this[offset + 1] << 8) |
	      (this[offset + 2] << 16)) +
	      (this[offset + 3] * 0x1000000)
	}

	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset] * 0x1000000) +
	    ((this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    this[offset + 3])
	}

	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }
	  mul *= 0x80

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

	  return val
	}

	Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var i = byteLength
	  var mul = 1
	  var val = this[offset + --i]
	  while (i > 0 && (mul *= 0x100)) {
	    val += this[offset + --i] * mul
	  }
	  mul *= 0x80

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

	  return val
	}

	Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  if (!(this[offset] & 0x80)) return (this[offset])
	  return ((0xff - this[offset] + 1) * -1)
	}

	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset] | (this[offset + 1] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}

	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset + 1] | (this[offset] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}

	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset]) |
	    (this[offset + 1] << 8) |
	    (this[offset + 2] << 16) |
	    (this[offset + 3] << 24)
	}

	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset] << 24) |
	    (this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    (this[offset + 3])
	}

	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, true, 23, 4)
	}

	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, false, 23, 4)
	}

	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, true, 52, 8)
	}

	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, false, 52, 8)
	}

	function checkInt (buf, value, offset, ext, max, min) {
	  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
	  if (value > max || value < min) throw new RangeError('value is out of bounds')
	  if (offset + ext > buf.length) throw new RangeError('index out of range')
	}

	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

	  var mul = 1
	  var i = 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

	  var i = byteLength - 1
	  var mul = 1
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  this[offset] = value
	  return offset + 1
	}

	function objectWriteUInt16 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
	    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
	      (littleEndian ? i : 1 - i) * 8
	  }
	}

	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = value
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = value
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}

	function objectWriteUInt32 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffffffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
	    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
	  }
	}

	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset + 3] = (value >>> 24)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 1] = (value >>> 8)
	    this[offset] = value
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = value
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)

	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }

	  var i = 0
	  var mul = 1
	  var sub = value < 0 ? 1 : 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)

	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }

	  var i = byteLength - 1
	  var mul = 1
	  var sub = value < 0 ? 1 : 0
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  if (value < 0) value = 0xff + value + 1
	  this[offset] = value
	  return offset + 1
	}

	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = value
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = value
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = value
	    this[offset + 1] = (value >>> 8)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 3] = (value >>> 24)
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (value < 0) value = 0xffffffff + value + 1
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = value
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}

	function checkIEEE754 (buf, value, offset, ext, max, min) {
	  if (value > max || value < min) throw new RangeError('value is out of bounds')
	  if (offset + ext > buf.length) throw new RangeError('index out of range')
	  if (offset < 0) throw new RangeError('index out of range')
	}

	function writeFloat (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 23, 4)
	  return offset + 4
	}

	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, true, noAssert)
	}

	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, false, noAssert)
	}

	function writeDouble (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 52, 8)
	  return offset + 8
	}

	Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, true, noAssert)
	}

	Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, false, noAssert)
	}

	// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
	Buffer.prototype.copy = function copy (target, targetStart, start, end) {
	  if (!start) start = 0
	  if (!end && end !== 0) end = this.length
	  if (targetStart >= target.length) targetStart = target.length
	  if (!targetStart) targetStart = 0
	  if (end > 0 && end < start) end = start

	  // Copy 0 bytes; we're done
	  if (end === start) return 0
	  if (target.length === 0 || this.length === 0) return 0

	  // Fatal error conditions
	  if (targetStart < 0) {
	    throw new RangeError('targetStart out of bounds')
	  }
	  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
	  if (end < 0) throw new RangeError('sourceEnd out of bounds')

	  // Are we oob?
	  if (end > this.length) end = this.length
	  if (target.length - targetStart < end - start) {
	    end = target.length - targetStart + start
	  }

	  var len = end - start
	  var i

	  if (this === target && start < targetStart && targetStart < end) {
	    // descending copy from end
	    for (i = len - 1; i >= 0; i--) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
	    // ascending copy from start
	    for (i = 0; i < len; i++) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else {
	    target._set(this.subarray(start, start + len), targetStart)
	  }

	  return len
	}

	// fill(value, start=0, end=buffer.length)
	Buffer.prototype.fill = function fill (value, start, end) {
	  if (!value) value = 0
	  if (!start) start = 0
	  if (!end) end = this.length

	  if (end < start) throw new RangeError('end < start')

	  // Fill 0 bytes; we're done
	  if (end === start) return
	  if (this.length === 0) return

	  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
	  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

	  var i
	  if (typeof value === 'number') {
	    for (i = start; i < end; i++) {
	      this[i] = value
	    }
	  } else {
	    var bytes = utf8ToBytes(value.toString())
	    var len = bytes.length
	    for (i = start; i < end; i++) {
	      this[i] = bytes[i % len]
	    }
	  }

	  return this
	}

	/**
	 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
	 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
	 */
	Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
	  if (typeof Uint8Array !== 'undefined') {
	    if (Buffer.TYPED_ARRAY_SUPPORT) {
	      return (new Buffer(this)).buffer
	    } else {
	      var buf = new Uint8Array(this.length)
	      for (var i = 0, len = buf.length; i < len; i += 1) {
	        buf[i] = this[i]
	      }
	      return buf.buffer
	    }
	  } else {
	    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
	  }
	}

	// HELPER FUNCTIONS
	// ================

	var BP = Buffer.prototype

	/**
	 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
	 */
	Buffer._augment = function _augment (arr) {
	  arr.constructor = Buffer
	  arr._isBuffer = true

	  // save reference to original Uint8Array set method before overwriting
	  arr._set = arr.set

	  // deprecated
	  arr.get = BP.get
	  arr.set = BP.set

	  arr.write = BP.write
	  arr.toString = BP.toString
	  arr.toLocaleString = BP.toString
	  arr.toJSON = BP.toJSON
	  arr.equals = BP.equals
	  arr.compare = BP.compare
	  arr.indexOf = BP.indexOf
	  arr.copy = BP.copy
	  arr.slice = BP.slice
	  arr.readUIntLE = BP.readUIntLE
	  arr.readUIntBE = BP.readUIntBE
	  arr.readUInt8 = BP.readUInt8
	  arr.readUInt16LE = BP.readUInt16LE
	  arr.readUInt16BE = BP.readUInt16BE
	  arr.readUInt32LE = BP.readUInt32LE
	  arr.readUInt32BE = BP.readUInt32BE
	  arr.readIntLE = BP.readIntLE
	  arr.readIntBE = BP.readIntBE
	  arr.readInt8 = BP.readInt8
	  arr.readInt16LE = BP.readInt16LE
	  arr.readInt16BE = BP.readInt16BE
	  arr.readInt32LE = BP.readInt32LE
	  arr.readInt32BE = BP.readInt32BE
	  arr.readFloatLE = BP.readFloatLE
	  arr.readFloatBE = BP.readFloatBE
	  arr.readDoubleLE = BP.readDoubleLE
	  arr.readDoubleBE = BP.readDoubleBE
	  arr.writeUInt8 = BP.writeUInt8
	  arr.writeUIntLE = BP.writeUIntLE
	  arr.writeUIntBE = BP.writeUIntBE
	  arr.writeUInt16LE = BP.writeUInt16LE
	  arr.writeUInt16BE = BP.writeUInt16BE
	  arr.writeUInt32LE = BP.writeUInt32LE
	  arr.writeUInt32BE = BP.writeUInt32BE
	  arr.writeIntLE = BP.writeIntLE
	  arr.writeIntBE = BP.writeIntBE
	  arr.writeInt8 = BP.writeInt8
	  arr.writeInt16LE = BP.writeInt16LE
	  arr.writeInt16BE = BP.writeInt16BE
	  arr.writeInt32LE = BP.writeInt32LE
	  arr.writeInt32BE = BP.writeInt32BE
	  arr.writeFloatLE = BP.writeFloatLE
	  arr.writeFloatBE = BP.writeFloatBE
	  arr.writeDoubleLE = BP.writeDoubleLE
	  arr.writeDoubleBE = BP.writeDoubleBE
	  arr.fill = BP.fill
	  arr.inspect = BP.inspect
	  arr.toArrayBuffer = BP.toArrayBuffer

	  return arr
	}

	var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

	function base64clean (str) {
	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
	  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
	  // Node converts strings with length < 2 to ''
	  if (str.length < 2) return ''
	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
	  while (str.length % 4 !== 0) {
	    str = str + '='
	  }
	  return str
	}

	function stringtrim (str) {
	  if (str.trim) return str.trim()
	  return str.replace(/^\s+|\s+$/g, '')
	}

	function toHex (n) {
	  if (n < 16) return '0' + n.toString(16)
	  return n.toString(16)
	}

	function utf8ToBytes (string, units) {
	  units = units || Infinity
	  var codePoint
	  var length = string.length
	  var leadSurrogate = null
	  var bytes = []

	  for (var i = 0; i < length; i++) {
	    codePoint = string.charCodeAt(i)

	    // is surrogate component
	    if (codePoint > 0xD7FF && codePoint < 0xE000) {
	      // last char was a lead
	      if (!leadSurrogate) {
	        // no lead yet
	        if (codePoint > 0xDBFF) {
	          // unexpected trail
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        } else if (i + 1 === length) {
	          // unpaired lead
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        }

	        // valid lead
	        leadSurrogate = codePoint

	        continue
	      }

	      // 2 leads in a row
	      if (codePoint < 0xDC00) {
	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	        leadSurrogate = codePoint
	        continue
	      }

	      // valid surrogate pair
	      codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
	    } else if (leadSurrogate) {
	      // valid bmp char, but last char was a lead
	      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	    }

	    leadSurrogate = null

	    // encode utf8
	    if (codePoint < 0x80) {
	      if ((units -= 1) < 0) break
	      bytes.push(codePoint)
	    } else if (codePoint < 0x800) {
	      if ((units -= 2) < 0) break
	      bytes.push(
	        codePoint >> 0x6 | 0xC0,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x10000) {
	      if ((units -= 3) < 0) break
	      bytes.push(
	        codePoint >> 0xC | 0xE0,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x110000) {
	      if ((units -= 4) < 0) break
	      bytes.push(
	        codePoint >> 0x12 | 0xF0,
	        codePoint >> 0xC & 0x3F | 0x80,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else {
	      throw new Error('Invalid code point')
	    }
	  }

	  return bytes
	}

	function asciiToBytes (str) {
	  var byteArray = []
	  for (var i = 0; i < str.length; i++) {
	    // Node's code seems to be doing this and not & 0x7F..
	    byteArray.push(str.charCodeAt(i) & 0xFF)
	  }
	  return byteArray
	}

	function utf16leToBytes (str, units) {
	  var c, hi, lo
	  var byteArray = []
	  for (var i = 0; i < str.length; i++) {
	    if ((units -= 2) < 0) break

	    c = str.charCodeAt(i)
	    hi = c >> 8
	    lo = c % 256
	    byteArray.push(lo)
	    byteArray.push(hi)
	  }

	  return byteArray
	}

	function base64ToBytes (str) {
	  return base64.toByteArray(base64clean(str))
	}

	function blitBuffer (src, dst, offset, length) {
	  for (var i = 0; i < length; i++) {
	    if ((i + offset >= dst.length) || (i >= src.length)) break
	    dst[i + offset] = src[i]
	  }
	  return i
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(28).Buffer, (function() { return this; }())))

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

	;(function (exports) {
		'use strict';

	  var Arr = (typeof Uint8Array !== 'undefined')
	    ? Uint8Array
	    : Array

		var PLUS   = '+'.charCodeAt(0)
		var SLASH  = '/'.charCodeAt(0)
		var NUMBER = '0'.charCodeAt(0)
		var LOWER  = 'a'.charCodeAt(0)
		var UPPER  = 'A'.charCodeAt(0)
		var PLUS_URL_SAFE = '-'.charCodeAt(0)
		var SLASH_URL_SAFE = '_'.charCodeAt(0)

		function decode (elt) {
			var code = elt.charCodeAt(0)
			if (code === PLUS ||
			    code === PLUS_URL_SAFE)
				return 62 // '+'
			if (code === SLASH ||
			    code === SLASH_URL_SAFE)
				return 63 // '/'
			if (code < NUMBER)
				return -1 //no match
			if (code < NUMBER + 10)
				return code - NUMBER + 26 + 26
			if (code < UPPER + 26)
				return code - UPPER
			if (code < LOWER + 26)
				return code - LOWER + 26
		}

		function b64ToByteArray (b64) {
			var i, j, l, tmp, placeHolders, arr

			if (b64.length % 4 > 0) {
				throw new Error('Invalid string. Length must be a multiple of 4')
			}

			// the number of equal signs (place holders)
			// if there are two placeholders, than the two characters before it
			// represent one byte
			// if there is only one, then the three characters before it represent 2 bytes
			// this is just a cheap hack to not do indexOf twice
			var len = b64.length
			placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

			// base64 is 4/3 + up to two characters of the original data
			arr = new Arr(b64.length * 3 / 4 - placeHolders)

			// if there are placeholders, only get up to the last complete 4 chars
			l = placeHolders > 0 ? b64.length - 4 : b64.length

			var L = 0

			function push (v) {
				arr[L++] = v
			}

			for (i = 0, j = 0; i < l; i += 4, j += 3) {
				tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
				push((tmp & 0xFF0000) >> 16)
				push((tmp & 0xFF00) >> 8)
				push(tmp & 0xFF)
			}

			if (placeHolders === 2) {
				tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
				push(tmp & 0xFF)
			} else if (placeHolders === 1) {
				tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
				push((tmp >> 8) & 0xFF)
				push(tmp & 0xFF)
			}

			return arr
		}

		function uint8ToBase64 (uint8) {
			var i,
				extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
				output = "",
				temp, length

			function encode (num) {
				return lookup.charAt(num)
			}

			function tripletToBase64 (num) {
				return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
			}

			// go through the array every three bytes, we'll deal with trailing stuff later
			for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
				temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
				output += tripletToBase64(temp)
			}

			// pad the end with zeros, but make sure to not forget the extra bytes
			switch (extraBytes) {
				case 1:
					temp = uint8[uint8.length - 1]
					output += encode(temp >> 2)
					output += encode((temp << 4) & 0x3F)
					output += '=='
					break
				case 2:
					temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
					output += encode(temp >> 10)
					output += encode((temp >> 4) & 0x3F)
					output += encode((temp << 2) & 0x3F)
					output += '='
					break
			}

			return output
		}

		exports.toByteArray = b64ToByteArray
		exports.fromByteArray = uint8ToBase64
	}( false ? (this.base64js = {}) : exports))


/***/ },
/* 30 */
/***/ function(module, exports) {

	exports.read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var nBits = -7
	  var i = isLE ? (nBytes - 1) : 0
	  var d = isLE ? -1 : 1
	  var s = buffer[offset + i]

	  i += d

	  e = s & ((1 << (-nBits)) - 1)
	  s >>= (-nBits)
	  nBits += eLen
	  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & ((1 << (-nBits)) - 1)
	  e >>= (-nBits)
	  nBits += mLen
	  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen)
	    e = e - eBias
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	}

	exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
	  var i = isLE ? 0 : (nBytes - 1)
	  var d = isLE ? 1 : -1
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

	  value = Math.abs(value)

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0
	    e = eMax
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2)
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--
	      c *= 2
	    }
	    if (e + eBias >= 1) {
	      value += rt / c
	    } else {
	      value += rt * Math.pow(2, 1 - eBias)
	    }
	    if (value * c >= 2) {
	      e++
	      c /= 2
	    }

	    if (e + eBias >= eMax) {
	      m = 0
	      e = eMax
	    } else if (e + eBias >= 1) {
	      m = (value * c - 1) * Math.pow(2, mLen)
	      e = e + eBias
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
	      e = 0
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = (e << mLen) | m
	  eLen += mLen
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128
	}


/***/ },
/* 31 */
/***/ function(module, exports) {

	
	/**
	 * isArray
	 */

	var isArray = Array.isArray;

	/**
	 * toString
	 */

	var str = Object.prototype.toString;

	/**
	 * Whether or not the given `val`
	 * is an array.
	 *
	 * example:
	 *
	 *        isArray([]);
	 *        // > true
	 *        isArray(arguments);
	 *        // > false
	 *        isArray('');
	 *        // > false
	 *
	 * @param {mixed} val
	 * @return {bool}
	 */

	module.exports = isArray || function (val) {
	  return !! val && '[object Array]' == str.call(val);
	};


/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(Buffer) {// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	// NOTE: These type checking functions intentionally don't use `instanceof`
	// because it is fragile and can be easily faked with `Object.create()`.
	function isArray(ar) {
	  return Array.isArray(ar);
	}
	exports.isArray = isArray;

	function isBoolean(arg) {
	  return typeof arg === 'boolean';
	}
	exports.isBoolean = isBoolean;

	function isNull(arg) {
	  return arg === null;
	}
	exports.isNull = isNull;

	function isNullOrUndefined(arg) {
	  return arg == null;
	}
	exports.isNullOrUndefined = isNullOrUndefined;

	function isNumber(arg) {
	  return typeof arg === 'number';
	}
	exports.isNumber = isNumber;

	function isString(arg) {
	  return typeof arg === 'string';
	}
	exports.isString = isString;

	function isSymbol(arg) {
	  return typeof arg === 'symbol';
	}
	exports.isSymbol = isSymbol;

	function isUndefined(arg) {
	  return arg === void 0;
	}
	exports.isUndefined = isUndefined;

	function isRegExp(re) {
	  return isObject(re) && objectToString(re) === '[object RegExp]';
	}
	exports.isRegExp = isRegExp;

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}
	exports.isObject = isObject;

	function isDate(d) {
	  return isObject(d) && objectToString(d) === '[object Date]';
	}
	exports.isDate = isDate;

	function isError(e) {
	  return isObject(e) &&
	      (objectToString(e) === '[object Error]' || e instanceof Error);
	}
	exports.isError = isError;

	function isFunction(arg) {
	  return typeof arg === 'function';
	}
	exports.isFunction = isFunction;

	function isPrimitive(arg) {
	  return arg === null ||
	         typeof arg === 'boolean' ||
	         typeof arg === 'number' ||
	         typeof arg === 'string' ||
	         typeof arg === 'symbol' ||  // ES6 symbol
	         typeof arg === 'undefined';
	}
	exports.isPrimitive = isPrimitive;

	function isBuffer(arg) {
	  return Buffer.isBuffer(arg);
	}
	exports.isBuffer = isBuffer;

	function objectToString(o) {
	  return Object.prototype.toString.call(o);
	}
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(28).Buffer))

/***/ },
/* 33 */
20,
/* 34 */
/***/ function(module, exports) {

	/* (ignored) */

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	// a duplex stream is just a stream that is both readable and writable.
	// Since JS doesn't have multiple prototypal inheritance, this class
	// prototypally inherits from Readable, and then parasitically from
	// Writable.

	module.exports = Duplex;

	/*<replacement>*/
	var objectKeys = Object.keys || function (obj) {
	  var keys = [];
	  for (var key in obj) keys.push(key);
	  return keys;
	}
	/*</replacement>*/


	/*<replacement>*/
	var util = __webpack_require__(32);
	util.inherits = __webpack_require__(33);
	/*</replacement>*/

	var Readable = __webpack_require__(25);
	var Writable = __webpack_require__(36);

	util.inherits(Duplex, Readable);

	forEach(objectKeys(Writable.prototype), function(method) {
	  if (!Duplex.prototype[method])
	    Duplex.prototype[method] = Writable.prototype[method];
	});

	function Duplex(options) {
	  if (!(this instanceof Duplex))
	    return new Duplex(options);

	  Readable.call(this, options);
	  Writable.call(this, options);

	  if (options && options.readable === false)
	    this.readable = false;

	  if (options && options.writable === false)
	    this.writable = false;

	  this.allowHalfOpen = true;
	  if (options && options.allowHalfOpen === false)
	    this.allowHalfOpen = false;

	  this.once('end', onend);
	}

	// the no-half-open enforcer
	function onend() {
	  // if we allow half-open state, or if the writable side ended,
	  // then we're ok.
	  if (this.allowHalfOpen || this._writableState.ended)
	    return;

	  // no more data can be written.
	  // But allow more writes to happen in this tick.
	  process.nextTick(this.end.bind(this));
	}

	function forEach (xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(26)))

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	// A bit simpler than readable streams.
	// Implement an async ._write(chunk, cb), and it'll handle all
	// the drain event emission and buffering.

	module.exports = Writable;

	/*<replacement>*/
	var Buffer = __webpack_require__(28).Buffer;
	/*</replacement>*/

	Writable.WritableState = WritableState;


	/*<replacement>*/
	var util = __webpack_require__(32);
	util.inherits = __webpack_require__(33);
	/*</replacement>*/

	var Stream = __webpack_require__(22);

	util.inherits(Writable, Stream);

	function WriteReq(chunk, encoding, cb) {
	  this.chunk = chunk;
	  this.encoding = encoding;
	  this.callback = cb;
	}

	function WritableState(options, stream) {
	  var Duplex = __webpack_require__(35);

	  options = options || {};

	  // the point at which write() starts returning false
	  // Note: 0 is a valid value, means that we always return false if
	  // the entire buffer is not flushed immediately on write()
	  var hwm = options.highWaterMark;
	  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

	  // object stream flag to indicate whether or not this stream
	  // contains buffers or objects.
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex)
	    this.objectMode = this.objectMode || !!options.writableObjectMode;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  this.needDrain = false;
	  // at the start of calling end()
	  this.ending = false;
	  // when end() has been called, and returned
	  this.ended = false;
	  // when 'finish' is emitted
	  this.finished = false;

	  // should we decode strings into buffers before passing to _write?
	  // this is here so that some node-core streams can optimize string
	  // handling at a lower level.
	  var noDecode = options.decodeStrings === false;
	  this.decodeStrings = !noDecode;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // not an actual buffer we keep track of, but a measurement
	  // of how much we're waiting to get pushed to some underlying
	  // socket or file.
	  this.length = 0;

	  // a flag to see when we're in the middle of a write.
	  this.writing = false;

	  // when true all writes will be buffered until .uncork() call
	  this.corked = 0;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // a flag to know if we're processing previously buffered items, which
	  // may call the _write() callback in the same tick, so that we don't
	  // end up in an overlapped onwrite situation.
	  this.bufferProcessing = false;

	  // the callback that's passed to _write(chunk,cb)
	  this.onwrite = function(er) {
	    onwrite(stream, er);
	  };

	  // the callback that the user supplies to write(chunk,encoding,cb)
	  this.writecb = null;

	  // the amount that is being written when _write is called.
	  this.writelen = 0;

	  this.buffer = [];

	  // number of pending user-supplied write callbacks
	  // this must be 0 before 'finish' can be emitted
	  this.pendingcb = 0;

	  // emit prefinish if the only thing we're waiting for is _write cbs
	  // This is relevant for synchronous Transform streams
	  this.prefinished = false;

	  // True if the error was already emitted and should not be thrown again
	  this.errorEmitted = false;
	}

	function Writable(options) {
	  var Duplex = __webpack_require__(35);

	  // Writable ctor is applied to Duplexes, though they're not
	  // instanceof Writable, they're instanceof Readable.
	  if (!(this instanceof Writable) && !(this instanceof Duplex))
	    return new Writable(options);

	  this._writableState = new WritableState(options, this);

	  // legacy.
	  this.writable = true;

	  Stream.call(this);
	}

	// Otherwise people can pipe Writable streams, which is just wrong.
	Writable.prototype.pipe = function() {
	  this.emit('error', new Error('Cannot pipe. Not readable.'));
	};


	function writeAfterEnd(stream, state, cb) {
	  var er = new Error('write after end');
	  // TODO: defer error events consistently everywhere, not just the cb
	  stream.emit('error', er);
	  process.nextTick(function() {
	    cb(er);
	  });
	}

	// If we get something that is not a buffer, string, null, or undefined,
	// and we're not in objectMode, then that's an error.
	// Otherwise stream chunks are all considered to be of length=1, and the
	// watermarks determine how many objects to keep in the buffer, rather than
	// how many bytes or characters.
	function validChunk(stream, state, chunk, cb) {
	  var valid = true;
	  if (!util.isBuffer(chunk) &&
	      !util.isString(chunk) &&
	      !util.isNullOrUndefined(chunk) &&
	      !state.objectMode) {
	    var er = new TypeError('Invalid non-string/buffer chunk');
	    stream.emit('error', er);
	    process.nextTick(function() {
	      cb(er);
	    });
	    valid = false;
	  }
	  return valid;
	}

	Writable.prototype.write = function(chunk, encoding, cb) {
	  var state = this._writableState;
	  var ret = false;

	  if (util.isFunction(encoding)) {
	    cb = encoding;
	    encoding = null;
	  }

	  if (util.isBuffer(chunk))
	    encoding = 'buffer';
	  else if (!encoding)
	    encoding = state.defaultEncoding;

	  if (!util.isFunction(cb))
	    cb = function() {};

	  if (state.ended)
	    writeAfterEnd(this, state, cb);
	  else if (validChunk(this, state, chunk, cb)) {
	    state.pendingcb++;
	    ret = writeOrBuffer(this, state, chunk, encoding, cb);
	  }

	  return ret;
	};

	Writable.prototype.cork = function() {
	  var state = this._writableState;

	  state.corked++;
	};

	Writable.prototype.uncork = function() {
	  var state = this._writableState;

	  if (state.corked) {
	    state.corked--;

	    if (!state.writing &&
	        !state.corked &&
	        !state.finished &&
	        !state.bufferProcessing &&
	        state.buffer.length)
	      clearBuffer(this, state);
	  }
	};

	function decodeChunk(state, chunk, encoding) {
	  if (!state.objectMode &&
	      state.decodeStrings !== false &&
	      util.isString(chunk)) {
	    chunk = new Buffer(chunk, encoding);
	  }
	  return chunk;
	}

	// if we're already writing something, then just put this
	// in the queue, and wait our turn.  Otherwise, call _write
	// If we return false, then we need a drain event, so set that flag.
	function writeOrBuffer(stream, state, chunk, encoding, cb) {
	  chunk = decodeChunk(state, chunk, encoding);
	  if (util.isBuffer(chunk))
	    encoding = 'buffer';
	  var len = state.objectMode ? 1 : chunk.length;

	  state.length += len;

	  var ret = state.length < state.highWaterMark;
	  // we must ensure that previous needDrain will not be reset to false.
	  if (!ret)
	    state.needDrain = true;

	  if (state.writing || state.corked)
	    state.buffer.push(new WriteReq(chunk, encoding, cb));
	  else
	    doWrite(stream, state, false, len, chunk, encoding, cb);

	  return ret;
	}

	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	  state.writelen = len;
	  state.writecb = cb;
	  state.writing = true;
	  state.sync = true;
	  if (writev)
	    stream._writev(chunk, state.onwrite);
	  else
	    stream._write(chunk, encoding, state.onwrite);
	  state.sync = false;
	}

	function onwriteError(stream, state, sync, er, cb) {
	  if (sync)
	    process.nextTick(function() {
	      state.pendingcb--;
	      cb(er);
	    });
	  else {
	    state.pendingcb--;
	    cb(er);
	  }

	  stream._writableState.errorEmitted = true;
	  stream.emit('error', er);
	}

	function onwriteStateUpdate(state) {
	  state.writing = false;
	  state.writecb = null;
	  state.length -= state.writelen;
	  state.writelen = 0;
	}

	function onwrite(stream, er) {
	  var state = stream._writableState;
	  var sync = state.sync;
	  var cb = state.writecb;

	  onwriteStateUpdate(state);

	  if (er)
	    onwriteError(stream, state, sync, er, cb);
	  else {
	    // Check if we're actually ready to finish, but don't emit yet
	    var finished = needFinish(stream, state);

	    if (!finished &&
	        !state.corked &&
	        !state.bufferProcessing &&
	        state.buffer.length) {
	      clearBuffer(stream, state);
	    }

	    if (sync) {
	      process.nextTick(function() {
	        afterWrite(stream, state, finished, cb);
	      });
	    } else {
	      afterWrite(stream, state, finished, cb);
	    }
	  }
	}

	function afterWrite(stream, state, finished, cb) {
	  if (!finished)
	    onwriteDrain(stream, state);
	  state.pendingcb--;
	  cb();
	  finishMaybe(stream, state);
	}

	// Must force callback to be called on nextTick, so that we don't
	// emit 'drain' before the write() consumer gets the 'false' return
	// value, and has a chance to attach a 'drain' listener.
	function onwriteDrain(stream, state) {
	  if (state.length === 0 && state.needDrain) {
	    state.needDrain = false;
	    stream.emit('drain');
	  }
	}


	// if there's something in the buffer waiting, then process it
	function clearBuffer(stream, state) {
	  state.bufferProcessing = true;

	  if (stream._writev && state.buffer.length > 1) {
	    // Fast case, write everything using _writev()
	    var cbs = [];
	    for (var c = 0; c < state.buffer.length; c++)
	      cbs.push(state.buffer[c].callback);

	    // count the one we are adding, as well.
	    // TODO(isaacs) clean this up
	    state.pendingcb++;
	    doWrite(stream, state, true, state.length, state.buffer, '', function(err) {
	      for (var i = 0; i < cbs.length; i++) {
	        state.pendingcb--;
	        cbs[i](err);
	      }
	    });

	    // Clear buffer
	    state.buffer = [];
	  } else {
	    // Slow case, write chunks one-by-one
	    for (var c = 0; c < state.buffer.length; c++) {
	      var entry = state.buffer[c];
	      var chunk = entry.chunk;
	      var encoding = entry.encoding;
	      var cb = entry.callback;
	      var len = state.objectMode ? 1 : chunk.length;

	      doWrite(stream, state, false, len, chunk, encoding, cb);

	      // if we didn't call the onwrite immediately, then
	      // it means that we need to wait until it does.
	      // also, that means that the chunk and cb are currently
	      // being processed, so move the buffer counter past them.
	      if (state.writing) {
	        c++;
	        break;
	      }
	    }

	    if (c < state.buffer.length)
	      state.buffer = state.buffer.slice(c);
	    else
	      state.buffer.length = 0;
	  }

	  state.bufferProcessing = false;
	}

	Writable.prototype._write = function(chunk, encoding, cb) {
	  cb(new Error('not implemented'));

	};

	Writable.prototype._writev = null;

	Writable.prototype.end = function(chunk, encoding, cb) {
	  var state = this._writableState;

	  if (util.isFunction(chunk)) {
	    cb = chunk;
	    chunk = null;
	    encoding = null;
	  } else if (util.isFunction(encoding)) {
	    cb = encoding;
	    encoding = null;
	  }

	  if (!util.isNullOrUndefined(chunk))
	    this.write(chunk, encoding);

	  // .end() fully uncorks
	  if (state.corked) {
	    state.corked = 1;
	    this.uncork();
	  }

	  // ignore unnecessary end() calls.
	  if (!state.ending && !state.finished)
	    endWritable(this, state, cb);
	};


	function needFinish(stream, state) {
	  return (state.ending &&
	          state.length === 0 &&
	          !state.finished &&
	          !state.writing);
	}

	function prefinish(stream, state) {
	  if (!state.prefinished) {
	    state.prefinished = true;
	    stream.emit('prefinish');
	  }
	}

	function finishMaybe(stream, state) {
	  var need = needFinish(stream, state);
	  if (need) {
	    if (state.pendingcb === 0) {
	      prefinish(stream, state);
	      state.finished = true;
	      stream.emit('finish');
	    } else
	      prefinish(stream, state);
	  }
	  return need;
	}

	function endWritable(stream, state, cb) {
	  state.ending = true;
	  finishMaybe(stream, state);
	  if (cb) {
	    if (state.finished)
	      process.nextTick(cb);
	    else
	      stream.once('finish', cb);
	  }
	  state.ended = true;
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(26)))

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	var Buffer = __webpack_require__(28).Buffer;

	var isBufferEncoding = Buffer.isEncoding
	  || function(encoding) {
	       switch (encoding && encoding.toLowerCase()) {
	         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
	         default: return false;
	       }
	     }


	function assertEncoding(encoding) {
	  if (encoding && !isBufferEncoding(encoding)) {
	    throw new Error('Unknown encoding: ' + encoding);
	  }
	}

	// StringDecoder provides an interface for efficiently splitting a series of
	// buffers into a series of JS strings without breaking apart multi-byte
	// characters. CESU-8 is handled as part of the UTF-8 encoding.
	//
	// @TODO Handling all encodings inside a single object makes it very difficult
	// to reason about this code, so it should be split up in the future.
	// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
	// points as used by CESU-8.
	var StringDecoder = exports.StringDecoder = function(encoding) {
	  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
	  assertEncoding(encoding);
	  switch (this.encoding) {
	    case 'utf8':
	      // CESU-8 represents each of Surrogate Pair by 3-bytes
	      this.surrogateSize = 3;
	      break;
	    case 'ucs2':
	    case 'utf16le':
	      // UTF-16 represents each of Surrogate Pair by 2-bytes
	      this.surrogateSize = 2;
	      this.detectIncompleteChar = utf16DetectIncompleteChar;
	      break;
	    case 'base64':
	      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
	      this.surrogateSize = 3;
	      this.detectIncompleteChar = base64DetectIncompleteChar;
	      break;
	    default:
	      this.write = passThroughWrite;
	      return;
	  }

	  // Enough space to store all bytes of a single character. UTF-8 needs 4
	  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
	  this.charBuffer = new Buffer(6);
	  // Number of bytes received for the current incomplete multi-byte character.
	  this.charReceived = 0;
	  // Number of bytes expected for the current incomplete multi-byte character.
	  this.charLength = 0;
	};


	// write decodes the given buffer and returns it as JS string that is
	// guaranteed to not contain any partial multi-byte characters. Any partial
	// character found at the end of the buffer is buffered up, and will be
	// returned when calling write again with the remaining bytes.
	//
	// Note: Converting a Buffer containing an orphan surrogate to a String
	// currently works, but converting a String to a Buffer (via `new Buffer`, or
	// Buffer#write) will replace incomplete surrogates with the unicode
	// replacement character. See https://codereview.chromium.org/121173009/ .
	StringDecoder.prototype.write = function(buffer) {
	  var charStr = '';
	  // if our last write ended with an incomplete multibyte character
	  while (this.charLength) {
	    // determine how many remaining bytes this buffer has to offer for this char
	    var available = (buffer.length >= this.charLength - this.charReceived) ?
	        this.charLength - this.charReceived :
	        buffer.length;

	    // add the new bytes to the char buffer
	    buffer.copy(this.charBuffer, this.charReceived, 0, available);
	    this.charReceived += available;

	    if (this.charReceived < this.charLength) {
	      // still not enough chars in this buffer? wait for more ...
	      return '';
	    }

	    // remove bytes belonging to the current character from the buffer
	    buffer = buffer.slice(available, buffer.length);

	    // get the character that was split
	    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

	    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	    var charCode = charStr.charCodeAt(charStr.length - 1);
	    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	      this.charLength += this.surrogateSize;
	      charStr = '';
	      continue;
	    }
	    this.charReceived = this.charLength = 0;

	    // if there are no more bytes in this buffer, just emit our char
	    if (buffer.length === 0) {
	      return charStr;
	    }
	    break;
	  }

	  // determine and set charLength / charReceived
	  this.detectIncompleteChar(buffer);

	  var end = buffer.length;
	  if (this.charLength) {
	    // buffer the incomplete character bytes we got
	    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
	    end -= this.charReceived;
	  }

	  charStr += buffer.toString(this.encoding, 0, end);

	  var end = charStr.length - 1;
	  var charCode = charStr.charCodeAt(end);
	  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	    var size = this.surrogateSize;
	    this.charLength += size;
	    this.charReceived += size;
	    this.charBuffer.copy(this.charBuffer, size, 0, size);
	    buffer.copy(this.charBuffer, 0, 0, size);
	    return charStr.substring(0, end);
	  }

	  // or just emit the charStr
	  return charStr;
	};

	// detectIncompleteChar determines if there is an incomplete UTF-8 character at
	// the end of the given buffer. If so, it sets this.charLength to the byte
	// length that character, and sets this.charReceived to the number of bytes
	// that are available for this character.
	StringDecoder.prototype.detectIncompleteChar = function(buffer) {
	  // determine how many bytes we have to check at the end of this buffer
	  var i = (buffer.length >= 3) ? 3 : buffer.length;

	  // Figure out if one of the last i bytes of our buffer announces an
	  // incomplete char.
	  for (; i > 0; i--) {
	    var c = buffer[buffer.length - i];

	    // See http://en.wikipedia.org/wiki/UTF-8#Description

	    // 110XXXXX
	    if (i == 1 && c >> 5 == 0x06) {
	      this.charLength = 2;
	      break;
	    }

	    // 1110XXXX
	    if (i <= 2 && c >> 4 == 0x0E) {
	      this.charLength = 3;
	      break;
	    }

	    // 11110XXX
	    if (i <= 3 && c >> 3 == 0x1E) {
	      this.charLength = 4;
	      break;
	    }
	  }
	  this.charReceived = i;
	};

	StringDecoder.prototype.end = function(buffer) {
	  var res = '';
	  if (buffer && buffer.length)
	    res = this.write(buffer);

	  if (this.charReceived) {
	    var cr = this.charReceived;
	    var buf = this.charBuffer;
	    var enc = this.encoding;
	    res += buf.slice(0, cr).toString(enc);
	  }

	  return res;
	};

	function passThroughWrite(buffer) {
	  return buffer.toString(this.encoding);
	}

	function utf16DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 2;
	  this.charLength = this.charReceived ? 2 : 0;
	}

	function base64DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 3;
	  this.charLength = this.charReceived ? 3 : 0;
	}


/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.


	// a transform stream is a readable/writable stream where you do
	// something with the data.  Sometimes it's called a "filter",
	// but that's not a great name for it, since that implies a thing where
	// some bits pass through, and others are simply ignored.  (That would
	// be a valid example of a transform, of course.)
	//
	// While the output is causally related to the input, it's not a
	// necessarily symmetric or synchronous transformation.  For example,
	// a zlib stream might take multiple plain-text writes(), and then
	// emit a single compressed chunk some time in the future.
	//
	// Here's how this works:
	//
	// The Transform stream has all the aspects of the readable and writable
	// stream classes.  When you write(chunk), that calls _write(chunk,cb)
	// internally, and returns false if there's a lot of pending writes
	// buffered up.  When you call read(), that calls _read(n) until
	// there's enough pending readable data buffered up.
	//
	// In a transform stream, the written data is placed in a buffer.  When
	// _read(n) is called, it transforms the queued up data, calling the
	// buffered _write cb's as it consumes chunks.  If consuming a single
	// written chunk would result in multiple output chunks, then the first
	// outputted bit calls the readcb, and subsequent chunks just go into
	// the read buffer, and will cause it to emit 'readable' if necessary.
	//
	// This way, back-pressure is actually determined by the reading side,
	// since _read has to be called to start processing a new chunk.  However,
	// a pathological inflate type of transform can cause excessive buffering
	// here.  For example, imagine a stream where every byte of input is
	// interpreted as an integer from 0-255, and then results in that many
	// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
	// 1kb of data being output.  In this case, you could write a very small
	// amount of input, and end up with a very large amount of output.  In
	// such a pathological inflating mechanism, there'd be no way to tell
	// the system to stop doing the transform.  A single 4MB write could
	// cause the system to run out of memory.
	//
	// However, even in such a pathological case, only a single written chunk
	// would be consumed, and then the rest would wait (un-transformed) until
	// the results of the previous transformed chunk were consumed.

	module.exports = Transform;

	var Duplex = __webpack_require__(35);

	/*<replacement>*/
	var util = __webpack_require__(32);
	util.inherits = __webpack_require__(33);
	/*</replacement>*/

	util.inherits(Transform, Duplex);


	function TransformState(options, stream) {
	  this.afterTransform = function(er, data) {
	    return afterTransform(stream, er, data);
	  };

	  this.needTransform = false;
	  this.transforming = false;
	  this.writecb = null;
	  this.writechunk = null;
	}

	function afterTransform(stream, er, data) {
	  var ts = stream._transformState;
	  ts.transforming = false;

	  var cb = ts.writecb;

	  if (!cb)
	    return stream.emit('error', new Error('no writecb in Transform class'));

	  ts.writechunk = null;
	  ts.writecb = null;

	  if (!util.isNullOrUndefined(data))
	    stream.push(data);

	  if (cb)
	    cb(er);

	  var rs = stream._readableState;
	  rs.reading = false;
	  if (rs.needReadable || rs.length < rs.highWaterMark) {
	    stream._read(rs.highWaterMark);
	  }
	}


	function Transform(options) {
	  if (!(this instanceof Transform))
	    return new Transform(options);

	  Duplex.call(this, options);

	  this._transformState = new TransformState(options, this);

	  // when the writable side finishes, then flush out anything remaining.
	  var stream = this;

	  // start out asking for a readable event once data is transformed.
	  this._readableState.needReadable = true;

	  // we have implemented the _read method, and done the other things
	  // that Readable wants before the first _read call, so unset the
	  // sync guard flag.
	  this._readableState.sync = false;

	  this.once('prefinish', function() {
	    if (util.isFunction(this._flush))
	      this._flush(function(er) {
	        done(stream, er);
	      });
	    else
	      done(stream);
	  });
	}

	Transform.prototype.push = function(chunk, encoding) {
	  this._transformState.needTransform = false;
	  return Duplex.prototype.push.call(this, chunk, encoding);
	};

	// This is the part where you do stuff!
	// override this function in implementation classes.
	// 'chunk' is an input chunk.
	//
	// Call `push(newChunk)` to pass along transformed output
	// to the readable side.  You may call 'push' zero or more times.
	//
	// Call `cb(err)` when you are done with this chunk.  If you pass
	// an error, then that'll put the hurt on the whole operation.  If you
	// never call cb(), then you'll never get another chunk.
	Transform.prototype._transform = function(chunk, encoding, cb) {
	  throw new Error('not implemented');
	};

	Transform.prototype._write = function(chunk, encoding, cb) {
	  var ts = this._transformState;
	  ts.writecb = cb;
	  ts.writechunk = chunk;
	  ts.writeencoding = encoding;
	  if (!ts.transforming) {
	    var rs = this._readableState;
	    if (ts.needTransform ||
	        rs.needReadable ||
	        rs.length < rs.highWaterMark)
	      this._read(rs.highWaterMark);
	  }
	};

	// Doesn't matter what the args are here.
	// _transform does all the work.
	// That we got here means that the readable side wants more data.
	Transform.prototype._read = function(n) {
	  var ts = this._transformState;

	  if (!util.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
	    ts.transforming = true;
	    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
	  } else {
	    // mark that we need a transform, so that any data that comes in
	    // will get processed, now that we've asked for it.
	    ts.needTransform = true;
	  }
	};


	function done(stream, er) {
	  if (er)
	    return stream.emit('error', er);

	  // if there's nothing in the write buffer, then that means
	  // that nothing more will ever be provided
	  var ws = stream._writableState;
	  var ts = stream._transformState;

	  if (ws.length)
	    throw new Error('calling transform done when ws.length != 0');

	  if (ts.transforming)
	    throw new Error('calling transform done when still transforming');

	  return stream.push(null);
	}


/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	// a passthrough stream.
	// basically just the most minimal sort of Transform stream.
	// Every written chunk gets output as-is.

	module.exports = PassThrough;

	var Transform = __webpack_require__(38);

	/*<replacement>*/
	var util = __webpack_require__(32);
	util.inherits = __webpack_require__(33);
	/*</replacement>*/

	util.inherits(PassThrough, Transform);

	function PassThrough(options) {
	  if (!(this instanceof PassThrough))
	    return new PassThrough(options);

	  Transform.call(this, options);
	}

	PassThrough.prototype._transform = function(chunk, encoding, cb) {
	  cb(null, chunk);
	};


/***/ },
/* 40 */
[60, 36],
/* 41 */
[61, 35],
/* 42 */
[62, 38],
/* 43 */
[63, 39],
/* 44 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';

	module.exports = Readable;

	/*<replacement>*/
	var processNextTick = __webpack_require__(45);
	/*</replacement>*/


	/*<replacement>*/
	var isArray = __webpack_require__(46);
	/*</replacement>*/


	/*<replacement>*/
	var Buffer = __webpack_require__(28).Buffer;
	/*</replacement>*/

	Readable.ReadableState = ReadableState;

	var EE = __webpack_require__(19).EventEmitter;

	/*<replacement>*/
	if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
	  return emitter.listeners(type).length;
	};
	/*</replacement>*/



	/*<replacement>*/
	var Stream;
	(function (){try{
	  Stream = __webpack_require__(22);
	}catch(_){}finally{
	  if (!Stream)
	    Stream = __webpack_require__(19).EventEmitter;
	}}())
	/*</replacement>*/

	var Buffer = __webpack_require__(28).Buffer;

	/*<replacement>*/
	var util = __webpack_require__(47);
	util.inherits = __webpack_require__(20);
	/*</replacement>*/



	/*<replacement>*/
	var debug = __webpack_require__(48);
	if (debug && debug.debuglog) {
	  debug = debug.debuglog('stream');
	} else {
	  debug = function () {};
	}
	/*</replacement>*/

	var StringDecoder;

	util.inherits(Readable, Stream);

	function ReadableState(options, stream) {
	  var Duplex = __webpack_require__(49);

	  options = options || {};

	  // object stream flag. Used to make read(n) ignore n and to
	  // make all the buffer merging and length checks go away
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex)
	    this.objectMode = this.objectMode || !!options.readableObjectMode;

	  // the point at which it stops calling _read() to fill the buffer
	  // Note: 0 is a valid value, means "don't call _read preemptively ever"
	  var hwm = options.highWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  this.buffer = [];
	  this.length = 0;
	  this.pipes = null;
	  this.pipesCount = 0;
	  this.flowing = null;
	  this.ended = false;
	  this.endEmitted = false;
	  this.reading = false;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // whenever we return null, then we set a flag to say
	  // that we're awaiting a 'readable' event emission.
	  this.needReadable = false;
	  this.emittedReadable = false;
	  this.readableListening = false;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // when piping, we only care about 'readable' events that happen
	  // after read()ing all the bytes and not getting any pushback.
	  this.ranOut = false;

	  // the number of writers that are awaiting a drain event in .pipe()s
	  this.awaitDrain = 0;

	  // if true, a maybeReadMore has been scheduled
	  this.readingMore = false;

	  this.decoder = null;
	  this.encoding = null;
	  if (options.encoding) {
	    if (!StringDecoder)
	      StringDecoder = __webpack_require__(52).StringDecoder;
	    this.decoder = new StringDecoder(options.encoding);
	    this.encoding = options.encoding;
	  }
	}

	function Readable(options) {
	  var Duplex = __webpack_require__(49);

	  if (!(this instanceof Readable))
	    return new Readable(options);

	  this._readableState = new ReadableState(options, this);

	  // legacy
	  this.readable = true;

	  if (options && typeof options.read === 'function')
	    this._read = options.read;

	  Stream.call(this);
	}

	// Manually shove something into the read() buffer.
	// This returns true if the highWaterMark has not been hit yet,
	// similar to how Writable.write() returns true if you should
	// write() some more.
	Readable.prototype.push = function(chunk, encoding) {
	  var state = this._readableState;

	  if (!state.objectMode && typeof chunk === 'string') {
	    encoding = encoding || state.defaultEncoding;
	    if (encoding !== state.encoding) {
	      chunk = new Buffer(chunk, encoding);
	      encoding = '';
	    }
	  }

	  return readableAddChunk(this, state, chunk, encoding, false);
	};

	// Unshift should *always* be something directly out of read()
	Readable.prototype.unshift = function(chunk) {
	  var state = this._readableState;
	  return readableAddChunk(this, state, chunk, '', true);
	};

	Readable.prototype.isPaused = function() {
	  return this._readableState.flowing === false;
	};

	function readableAddChunk(stream, state, chunk, encoding, addToFront) {
	  var er = chunkInvalid(state, chunk);
	  if (er) {
	    stream.emit('error', er);
	  } else if (chunk === null) {
	    state.reading = false;
	    onEofChunk(stream, state);
	  } else if (state.objectMode || chunk && chunk.length > 0) {
	    if (state.ended && !addToFront) {
	      var e = new Error('stream.push() after EOF');
	      stream.emit('error', e);
	    } else if (state.endEmitted && addToFront) {
	      var e = new Error('stream.unshift() after end event');
	      stream.emit('error', e);
	    } else {
	      if (state.decoder && !addToFront && !encoding)
	        chunk = state.decoder.write(chunk);

	      if (!addToFront)
	        state.reading = false;

	      // if we want the data now, just emit it.
	      if (state.flowing && state.length === 0 && !state.sync) {
	        stream.emit('data', chunk);
	        stream.read(0);
	      } else {
	        // update the buffer info.
	        state.length += state.objectMode ? 1 : chunk.length;
	        if (addToFront)
	          state.buffer.unshift(chunk);
	        else
	          state.buffer.push(chunk);

	        if (state.needReadable)
	          emitReadable(stream);
	      }

	      maybeReadMore(stream, state);
	    }
	  } else if (!addToFront) {
	    state.reading = false;
	  }

	  return needMoreData(state);
	}



	// if it's past the high water mark, we can push in some more.
	// Also, if we have no data yet, we can stand some
	// more bytes.  This is to work around cases where hwm=0,
	// such as the repl.  Also, if the push() triggered a
	// readable event, and the user called read(largeNumber) such that
	// needReadable was set, then we ought to push more, so that another
	// 'readable' event will be triggered.
	function needMoreData(state) {
	  return !state.ended &&
	         (state.needReadable ||
	          state.length < state.highWaterMark ||
	          state.length === 0);
	}

	// backwards compatibility.
	Readable.prototype.setEncoding = function(enc) {
	  if (!StringDecoder)
	    StringDecoder = __webpack_require__(52).StringDecoder;
	  this._readableState.decoder = new StringDecoder(enc);
	  this._readableState.encoding = enc;
	  return this;
	};

	// Don't raise the hwm > 128MB
	var MAX_HWM = 0x800000;
	function roundUpToNextPowerOf2(n) {
	  if (n >= MAX_HWM) {
	    n = MAX_HWM;
	  } else {
	    // Get the next highest power of 2
	    n--;
	    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
	    n++;
	  }
	  return n;
	}

	function howMuchToRead(n, state) {
	  if (state.length === 0 && state.ended)
	    return 0;

	  if (state.objectMode)
	    return n === 0 ? 0 : 1;

	  if (n === null || isNaN(n)) {
	    // only flow one buffer at a time
	    if (state.flowing && state.buffer.length)
	      return state.buffer[0].length;
	    else
	      return state.length;
	  }

	  if (n <= 0)
	    return 0;

	  // If we're asking for more than the target buffer level,
	  // then raise the water mark.  Bump up to the next highest
	  // power of 2, to prevent increasing it excessively in tiny
	  // amounts.
	  if (n > state.highWaterMark)
	    state.highWaterMark = roundUpToNextPowerOf2(n);

	  // don't have that much.  return null, unless we've ended.
	  if (n > state.length) {
	    if (!state.ended) {
	      state.needReadable = true;
	      return 0;
	    } else {
	      return state.length;
	    }
	  }

	  return n;
	}

	// you can override either this method, or the async _read(n) below.
	Readable.prototype.read = function(n) {
	  debug('read', n);
	  var state = this._readableState;
	  var nOrig = n;

	  if (typeof n !== 'number' || n > 0)
	    state.emittedReadable = false;

	  // if we're doing read(0) to trigger a readable event, but we
	  // already have a bunch of data in the buffer, then just trigger
	  // the 'readable' event and move on.
	  if (n === 0 &&
	      state.needReadable &&
	      (state.length >= state.highWaterMark || state.ended)) {
	    debug('read: emitReadable', state.length, state.ended);
	    if (state.length === 0 && state.ended)
	      endReadable(this);
	    else
	      emitReadable(this);
	    return null;
	  }

	  n = howMuchToRead(n, state);

	  // if we've ended, and we're now clear, then finish it up.
	  if (n === 0 && state.ended) {
	    if (state.length === 0)
	      endReadable(this);
	    return null;
	  }

	  // All the actual chunk generation logic needs to be
	  // *below* the call to _read.  The reason is that in certain
	  // synthetic stream cases, such as passthrough streams, _read
	  // may be a completely synchronous operation which may change
	  // the state of the read buffer, providing enough data when
	  // before there was *not* enough.
	  //
	  // So, the steps are:
	  // 1. Figure out what the state of things will be after we do
	  // a read from the buffer.
	  //
	  // 2. If that resulting state will trigger a _read, then call _read.
	  // Note that this may be asynchronous, or synchronous.  Yes, it is
	  // deeply ugly to write APIs this way, but that still doesn't mean
	  // that the Readable class should behave improperly, as streams are
	  // designed to be sync/async agnostic.
	  // Take note if the _read call is sync or async (ie, if the read call
	  // has returned yet), so that we know whether or not it's safe to emit
	  // 'readable' etc.
	  //
	  // 3. Actually pull the requested chunks out of the buffer and return.

	  // if we need a readable event, then we need to do some reading.
	  var doRead = state.needReadable;
	  debug('need readable', doRead);

	  // if we currently have less than the highWaterMark, then also read some
	  if (state.length === 0 || state.length - n < state.highWaterMark) {
	    doRead = true;
	    debug('length less than watermark', doRead);
	  }

	  // however, if we've ended, then there's no point, and if we're already
	  // reading, then it's unnecessary.
	  if (state.ended || state.reading) {
	    doRead = false;
	    debug('reading or ended', doRead);
	  }

	  if (doRead) {
	    debug('do read');
	    state.reading = true;
	    state.sync = true;
	    // if the length is currently zero, then we *need* a readable event.
	    if (state.length === 0)
	      state.needReadable = true;
	    // call internal read method
	    this._read(state.highWaterMark);
	    state.sync = false;
	  }

	  // If _read pushed data synchronously, then `reading` will be false,
	  // and we need to re-evaluate how much data we can return to the user.
	  if (doRead && !state.reading)
	    n = howMuchToRead(nOrig, state);

	  var ret;
	  if (n > 0)
	    ret = fromList(n, state);
	  else
	    ret = null;

	  if (ret === null) {
	    state.needReadable = true;
	    n = 0;
	  }

	  state.length -= n;

	  // If we have nothing in the buffer, then we want to know
	  // as soon as we *do* get something into the buffer.
	  if (state.length === 0 && !state.ended)
	    state.needReadable = true;

	  // If we tried to read() past the EOF, then emit end on the next tick.
	  if (nOrig !== n && state.ended && state.length === 0)
	    endReadable(this);

	  if (ret !== null)
	    this.emit('data', ret);

	  return ret;
	};

	function chunkInvalid(state, chunk) {
	  var er = null;
	  if (!(Buffer.isBuffer(chunk)) &&
	      typeof chunk !== 'string' &&
	      chunk !== null &&
	      chunk !== undefined &&
	      !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  return er;
	}


	function onEofChunk(stream, state) {
	  if (state.ended) return;
	  if (state.decoder) {
	    var chunk = state.decoder.end();
	    if (chunk && chunk.length) {
	      state.buffer.push(chunk);
	      state.length += state.objectMode ? 1 : chunk.length;
	    }
	  }
	  state.ended = true;

	  // emit 'readable' now to make sure it gets picked up.
	  emitReadable(stream);
	}

	// Don't emit readable right away in sync mode, because this can trigger
	// another read() call => stack overflow.  This way, it might trigger
	// a nextTick recursion warning, but that's not so bad.
	function emitReadable(stream) {
	  var state = stream._readableState;
	  state.needReadable = false;
	  if (!state.emittedReadable) {
	    debug('emitReadable', state.flowing);
	    state.emittedReadable = true;
	    if (state.sync)
	      processNextTick(emitReadable_, stream);
	    else
	      emitReadable_(stream);
	  }
	}

	function emitReadable_(stream) {
	  debug('emit readable');
	  stream.emit('readable');
	  flow(stream);
	}


	// at this point, the user has presumably seen the 'readable' event,
	// and called read() to consume some data.  that may have triggered
	// in turn another _read(n) call, in which case reading = true if
	// it's in progress.
	// However, if we're not ended, or reading, and the length < hwm,
	// then go ahead and try to read some more preemptively.
	function maybeReadMore(stream, state) {
	  if (!state.readingMore) {
	    state.readingMore = true;
	    processNextTick(maybeReadMore_, stream, state);
	  }
	}

	function maybeReadMore_(stream, state) {
	  var len = state.length;
	  while (!state.reading && !state.flowing && !state.ended &&
	         state.length < state.highWaterMark) {
	    debug('maybeReadMore read 0');
	    stream.read(0);
	    if (len === state.length)
	      // didn't get any data, stop spinning.
	      break;
	    else
	      len = state.length;
	  }
	  state.readingMore = false;
	}

	// abstract method.  to be overridden in specific implementation classes.
	// call cb(er, data) where data is <= n in length.
	// for virtual (non-string, non-buffer) streams, "length" is somewhat
	// arbitrary, and perhaps not very meaningful.
	Readable.prototype._read = function(n) {
	  this.emit('error', new Error('not implemented'));
	};

	Readable.prototype.pipe = function(dest, pipeOpts) {
	  var src = this;
	  var state = this._readableState;

	  switch (state.pipesCount) {
	    case 0:
	      state.pipes = dest;
	      break;
	    case 1:
	      state.pipes = [state.pipes, dest];
	      break;
	    default:
	      state.pipes.push(dest);
	      break;
	  }
	  state.pipesCount += 1;
	  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

	  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
	              dest !== process.stdout &&
	              dest !== process.stderr;

	  var endFn = doEnd ? onend : cleanup;
	  if (state.endEmitted)
	    processNextTick(endFn);
	  else
	    src.once('end', endFn);

	  dest.on('unpipe', onunpipe);
	  function onunpipe(readable) {
	    debug('onunpipe');
	    if (readable === src) {
	      cleanup();
	    }
	  }

	  function onend() {
	    debug('onend');
	    dest.end();
	  }

	  // when the dest drains, it reduces the awaitDrain counter
	  // on the source.  This would be more elegant with a .once()
	  // handler in flow(), but adding and removing repeatedly is
	  // too slow.
	  var ondrain = pipeOnDrain(src);
	  dest.on('drain', ondrain);

	  function cleanup() {
	    debug('cleanup');
	    // cleanup event handlers once the pipe is broken
	    dest.removeListener('close', onclose);
	    dest.removeListener('finish', onfinish);
	    dest.removeListener('drain', ondrain);
	    dest.removeListener('error', onerror);
	    dest.removeListener('unpipe', onunpipe);
	    src.removeListener('end', onend);
	    src.removeListener('end', cleanup);
	    src.removeListener('data', ondata);

	    // if the reader is waiting for a drain event from this
	    // specific writer, then it would cause it to never start
	    // flowing again.
	    // So, if this is awaiting a drain, then we just call it now.
	    // If we don't know, then assume that we are waiting for one.
	    if (state.awaitDrain &&
	        (!dest._writableState || dest._writableState.needDrain))
	      ondrain();
	  }

	  src.on('data', ondata);
	  function ondata(chunk) {
	    debug('ondata');
	    var ret = dest.write(chunk);
	    if (false === ret) {
	      debug('false write response, pause',
	            src._readableState.awaitDrain);
	      src._readableState.awaitDrain++;
	      src.pause();
	    }
	  }

	  // if the dest has an error, then stop piping into it.
	  // however, don't suppress the throwing behavior for this.
	  function onerror(er) {
	    debug('onerror', er);
	    unpipe();
	    dest.removeListener('error', onerror);
	    if (EE.listenerCount(dest, 'error') === 0)
	      dest.emit('error', er);
	  }
	  // This is a brutally ugly hack to make sure that our error handler
	  // is attached before any userland ones.  NEVER DO THIS.
	  if (!dest._events || !dest._events.error)
	    dest.on('error', onerror);
	  else if (isArray(dest._events.error))
	    dest._events.error.unshift(onerror);
	  else
	    dest._events.error = [onerror, dest._events.error];



	  // Both close and finish should trigger unpipe, but only once.
	  function onclose() {
	    dest.removeListener('finish', onfinish);
	    unpipe();
	  }
	  dest.once('close', onclose);
	  function onfinish() {
	    debug('onfinish');
	    dest.removeListener('close', onclose);
	    unpipe();
	  }
	  dest.once('finish', onfinish);

	  function unpipe() {
	    debug('unpipe');
	    src.unpipe(dest);
	  }

	  // tell the dest that it's being piped to
	  dest.emit('pipe', src);

	  // start the flow if it hasn't been started already.
	  if (!state.flowing) {
	    debug('pipe resume');
	    src.resume();
	  }

	  return dest;
	};

	function pipeOnDrain(src) {
	  return function() {
	    var state = src._readableState;
	    debug('pipeOnDrain', state.awaitDrain);
	    if (state.awaitDrain)
	      state.awaitDrain--;
	    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
	      state.flowing = true;
	      flow(src);
	    }
	  };
	}


	Readable.prototype.unpipe = function(dest) {
	  var state = this._readableState;

	  // if we're not piping anywhere, then do nothing.
	  if (state.pipesCount === 0)
	    return this;

	  // just one destination.  most common case.
	  if (state.pipesCount === 1) {
	    // passed in one, but it's not the right one.
	    if (dest && dest !== state.pipes)
	      return this;

	    if (!dest)
	      dest = state.pipes;

	    // got a match.
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;
	    if (dest)
	      dest.emit('unpipe', this);
	    return this;
	  }

	  // slow case. multiple pipe destinations.

	  if (!dest) {
	    // remove all.
	    var dests = state.pipes;
	    var len = state.pipesCount;
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;

	    for (var i = 0; i < len; i++)
	      dests[i].emit('unpipe', this);
	    return this;
	  }

	  // try to find the right one.
	  var i = indexOf(state.pipes, dest);
	  if (i === -1)
	    return this;

	  state.pipes.splice(i, 1);
	  state.pipesCount -= 1;
	  if (state.pipesCount === 1)
	    state.pipes = state.pipes[0];

	  dest.emit('unpipe', this);

	  return this;
	};

	// set up data events if they are asked for
	// Ensure readable listeners eventually get something
	Readable.prototype.on = function(ev, fn) {
	  var res = Stream.prototype.on.call(this, ev, fn);

	  // If listening to data, and it has not explicitly been paused,
	  // then call resume to start the flow of data on the next tick.
	  if (ev === 'data' && false !== this._readableState.flowing) {
	    this.resume();
	  }

	  if (ev === 'readable' && this.readable) {
	    var state = this._readableState;
	    if (!state.readableListening) {
	      state.readableListening = true;
	      state.emittedReadable = false;
	      state.needReadable = true;
	      if (!state.reading) {
	        processNextTick(nReadingNextTick, this);
	      } else if (state.length) {
	        emitReadable(this, state);
	      }
	    }
	  }

	  return res;
	};
	Readable.prototype.addListener = Readable.prototype.on;

	function nReadingNextTick(self) {
	  debug('readable nexttick read 0');
	  self.read(0);
	}

	// pause() and resume() are remnants of the legacy readable stream API
	// If the user uses them, then switch into old mode.
	Readable.prototype.resume = function() {
	  var state = this._readableState;
	  if (!state.flowing) {
	    debug('resume');
	    state.flowing = true;
	    resume(this, state);
	  }
	  return this;
	};

	function resume(stream, state) {
	  if (!state.resumeScheduled) {
	    state.resumeScheduled = true;
	    processNextTick(resume_, stream, state);
	  }
	}

	function resume_(stream, state) {
	  if (!state.reading) {
	    debug('resume read 0');
	    stream.read(0);
	  }

	  state.resumeScheduled = false;
	  stream.emit('resume');
	  flow(stream);
	  if (state.flowing && !state.reading)
	    stream.read(0);
	}

	Readable.prototype.pause = function() {
	  debug('call pause flowing=%j', this._readableState.flowing);
	  if (false !== this._readableState.flowing) {
	    debug('pause');
	    this._readableState.flowing = false;
	    this.emit('pause');
	  }
	  return this;
	};

	function flow(stream) {
	  var state = stream._readableState;
	  debug('flow', state.flowing);
	  if (state.flowing) {
	    do {
	      var chunk = stream.read();
	    } while (null !== chunk && state.flowing);
	  }
	}

	// wrap an old-style stream as the async data source.
	// This is *not* part of the readable stream interface.
	// It is an ugly unfortunate mess of history.
	Readable.prototype.wrap = function(stream) {
	  var state = this._readableState;
	  var paused = false;

	  var self = this;
	  stream.on('end', function() {
	    debug('wrapped end');
	    if (state.decoder && !state.ended) {
	      var chunk = state.decoder.end();
	      if (chunk && chunk.length)
	        self.push(chunk);
	    }

	    self.push(null);
	  });

	  stream.on('data', function(chunk) {
	    debug('wrapped data');
	    if (state.decoder)
	      chunk = state.decoder.write(chunk);

	    // don't skip over falsy values in objectMode
	    if (state.objectMode && (chunk === null || chunk === undefined))
	      return;
	    else if (!state.objectMode && (!chunk || !chunk.length))
	      return;

	    var ret = self.push(chunk);
	    if (!ret) {
	      paused = true;
	      stream.pause();
	    }
	  });

	  // proxy all the other methods.
	  // important when wrapping filters and duplexes.
	  for (var i in stream) {
	    if (this[i] === undefined && typeof stream[i] === 'function') {
	      this[i] = function(method) { return function() {
	        return stream[method].apply(stream, arguments);
	      }; }(i);
	    }
	  }

	  // proxy certain important events.
	  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
	  forEach(events, function(ev) {
	    stream.on(ev, self.emit.bind(self, ev));
	  });

	  // when we try to consume some more bytes, simply unpause the
	  // underlying stream.
	  self._read = function(n) {
	    debug('wrapped _read', n);
	    if (paused) {
	      paused = false;
	      stream.resume();
	    }
	  };

	  return self;
	};



	// exposed for testing purposes only.
	Readable._fromList = fromList;

	// Pluck off n bytes from an array of buffers.
	// Length is the combined lengths of all the buffers in the list.
	function fromList(n, state) {
	  var list = state.buffer;
	  var length = state.length;
	  var stringMode = !!state.decoder;
	  var objectMode = !!state.objectMode;
	  var ret;

	  // nothing in the list, definitely empty.
	  if (list.length === 0)
	    return null;

	  if (length === 0)
	    ret = null;
	  else if (objectMode)
	    ret = list.shift();
	  else if (!n || n >= length) {
	    // read it all, truncate the array.
	    if (stringMode)
	      ret = list.join('');
	    else
	      ret = Buffer.concat(list, length);
	    list.length = 0;
	  } else {
	    // read just some of it.
	    if (n < list[0].length) {
	      // just take a part of the first list item.
	      // slice is the same for buffers and strings.
	      var buf = list[0];
	      ret = buf.slice(0, n);
	      list[0] = buf.slice(n);
	    } else if (n === list[0].length) {
	      // first list is a perfect match
	      ret = list.shift();
	    } else {
	      // complex case.
	      // we have enough to cover it, but it spans past the first buffer.
	      if (stringMode)
	        ret = '';
	      else
	        ret = new Buffer(n);

	      var c = 0;
	      for (var i = 0, l = list.length; i < l && c < n; i++) {
	        var buf = list[0];
	        var cpy = Math.min(n - c, buf.length);

	        if (stringMode)
	          ret += buf.slice(0, cpy);
	        else
	          buf.copy(ret, c, 0, cpy);

	        if (cpy < buf.length)
	          list[0] = buf.slice(cpy);
	        else
	          list.shift();

	        c += cpy;
	      }
	    }
	  }

	  return ret;
	}

	function endReadable(stream) {
	  var state = stream._readableState;

	  // If we get here before consuming all the bytes, then that is a
	  // bug in node.  Should never happen.
	  if (state.length > 0)
	    throw new Error('endReadable called on non-empty stream');

	  if (!state.endEmitted) {
	    state.ended = true;
	    processNextTick(endReadableNT, state, stream);
	  }
	}

	function endReadableNT(state, stream) {
	  // Check that we didn't get one last unshift.
	  if (!state.endEmitted && state.length === 0) {
	    state.endEmitted = true;
	    stream.readable = false;
	    stream.emit('end');
	  }
	}

	function forEach (xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}

	function indexOf (xs, x) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    if (xs[i] === x) return i;
	  }
	  return -1;
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(26)))

/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';
	module.exports = nextTick;

	function nextTick(fn) {
	  var args = new Array(arguments.length - 1);
	  var i = 0;
	  while (i < args.length) {
	    args[i++] = arguments[i];
	  }
	  process.nextTick(function afterTick() {
	    fn.apply(null, args);
	  });
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(26)))

/***/ },
/* 46 */
27,
/* 47 */
32,
/* 48 */
34,
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	// a duplex stream is just a stream that is both readable and writable.
	// Since JS doesn't have multiple prototypal inheritance, this class
	// prototypally inherits from Readable, and then parasitically from
	// Writable.

	'use strict';

	/*<replacement>*/
	var objectKeys = Object.keys || function (obj) {
	  var keys = [];
	  for (var key in obj) keys.push(key);
	  return keys;
	}
	/*</replacement>*/


	module.exports = Duplex;

	/*<replacement>*/
	var processNextTick = __webpack_require__(45);
	/*</replacement>*/



	/*<replacement>*/
	var util = __webpack_require__(47);
	util.inherits = __webpack_require__(20);
	/*</replacement>*/

	var Readable = __webpack_require__(44);
	var Writable = __webpack_require__(50);

	util.inherits(Duplex, Readable);

	var keys = objectKeys(Writable.prototype);
	for (var v = 0; v < keys.length; v++) {
	  var method = keys[v];
	  if (!Duplex.prototype[method])
	    Duplex.prototype[method] = Writable.prototype[method];
	}

	function Duplex(options) {
	  if (!(this instanceof Duplex))
	    return new Duplex(options);

	  Readable.call(this, options);
	  Writable.call(this, options);

	  if (options && options.readable === false)
	    this.readable = false;

	  if (options && options.writable === false)
	    this.writable = false;

	  this.allowHalfOpen = true;
	  if (options && options.allowHalfOpen === false)
	    this.allowHalfOpen = false;

	  this.once('end', onend);
	}

	// the no-half-open enforcer
	function onend() {
	  // if we allow half-open state, or if the writable side ended,
	  // then we're ok.
	  if (this.allowHalfOpen || this._writableState.ended)
	    return;

	  // no more data can be written.
	  // But allow more writes to happen in this tick.
	  processNextTick(onEndNT, this);
	}

	function onEndNT(self) {
	  self.end();
	}

	function forEach (xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}


/***/ },
/* 50 */
/***/ function(module, exports, __webpack_require__) {

	// A bit simpler than readable streams.
	// Implement an async ._write(chunk, cb), and it'll handle all
	// the drain event emission and buffering.

	'use strict';

	module.exports = Writable;

	/*<replacement>*/
	var processNextTick = __webpack_require__(45);
	/*</replacement>*/


	/*<replacement>*/
	var Buffer = __webpack_require__(28).Buffer;
	/*</replacement>*/

	Writable.WritableState = WritableState;


	/*<replacement>*/
	var util = __webpack_require__(47);
	util.inherits = __webpack_require__(20);
	/*</replacement>*/



	/*<replacement>*/
	var Stream;
	(function (){try{
	  Stream = __webpack_require__(22);
	}catch(_){}finally{
	  if (!Stream)
	    Stream = __webpack_require__(19).EventEmitter;
	}}())
	/*</replacement>*/

	var Buffer = __webpack_require__(28).Buffer;

	util.inherits(Writable, Stream);

	function nop() {}

	function WriteReq(chunk, encoding, cb) {
	  this.chunk = chunk;
	  this.encoding = encoding;
	  this.callback = cb;
	  this.next = null;
	}

	function WritableState(options, stream) {
	  var Duplex = __webpack_require__(49);

	  options = options || {};

	  // object stream flag to indicate whether or not this stream
	  // contains buffers or objects.
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex)
	    this.objectMode = this.objectMode || !!options.writableObjectMode;

	  // the point at which write() starts returning false
	  // Note: 0 is a valid value, means that we always return false if
	  // the entire buffer is not flushed immediately on write()
	  var hwm = options.highWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  this.needDrain = false;
	  // at the start of calling end()
	  this.ending = false;
	  // when end() has been called, and returned
	  this.ended = false;
	  // when 'finish' is emitted
	  this.finished = false;

	  // should we decode strings into buffers before passing to _write?
	  // this is here so that some node-core streams can optimize string
	  // handling at a lower level.
	  var noDecode = options.decodeStrings === false;
	  this.decodeStrings = !noDecode;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // not an actual buffer we keep track of, but a measurement
	  // of how much we're waiting to get pushed to some underlying
	  // socket or file.
	  this.length = 0;

	  // a flag to see when we're in the middle of a write.
	  this.writing = false;

	  // when true all writes will be buffered until .uncork() call
	  this.corked = 0;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // a flag to know if we're processing previously buffered items, which
	  // may call the _write() callback in the same tick, so that we don't
	  // end up in an overlapped onwrite situation.
	  this.bufferProcessing = false;

	  // the callback that's passed to _write(chunk,cb)
	  this.onwrite = function(er) {
	    onwrite(stream, er);
	  };

	  // the callback that the user supplies to write(chunk,encoding,cb)
	  this.writecb = null;

	  // the amount that is being written when _write is called.
	  this.writelen = 0;

	  this.bufferedRequest = null;
	  this.lastBufferedRequest = null;

	  // number of pending user-supplied write callbacks
	  // this must be 0 before 'finish' can be emitted
	  this.pendingcb = 0;

	  // emit prefinish if the only thing we're waiting for is _write cbs
	  // This is relevant for synchronous Transform streams
	  this.prefinished = false;

	  // True if the error was already emitted and should not be thrown again
	  this.errorEmitted = false;
	}

	WritableState.prototype.getBuffer = function writableStateGetBuffer() {
	  var current = this.bufferedRequest;
	  var out = [];
	  while (current) {
	    out.push(current);
	    current = current.next;
	  }
	  return out;
	};

	(function (){try {
	Object.defineProperty(WritableState.prototype, 'buffer', {
	  get: __webpack_require__(51)(function() {
	    return this.getBuffer();
	  }, '_writableState.buffer is deprecated. Use ' +
	      '_writableState.getBuffer() instead.')
	});
	}catch(_){}}());


	function Writable(options) {
	  var Duplex = __webpack_require__(49);

	  // Writable ctor is applied to Duplexes, though they're not
	  // instanceof Writable, they're instanceof Readable.
	  if (!(this instanceof Writable) && !(this instanceof Duplex))
	    return new Writable(options);

	  this._writableState = new WritableState(options, this);

	  // legacy.
	  this.writable = true;

	  if (options) {
	    if (typeof options.write === 'function')
	      this._write = options.write;

	    if (typeof options.writev === 'function')
	      this._writev = options.writev;
	  }

	  Stream.call(this);
	}

	// Otherwise people can pipe Writable streams, which is just wrong.
	Writable.prototype.pipe = function() {
	  this.emit('error', new Error('Cannot pipe. Not readable.'));
	};


	function writeAfterEnd(stream, cb) {
	  var er = new Error('write after end');
	  // TODO: defer error events consistently everywhere, not just the cb
	  stream.emit('error', er);
	  processNextTick(cb, er);
	}

	// If we get something that is not a buffer, string, null, or undefined,
	// and we're not in objectMode, then that's an error.
	// Otherwise stream chunks are all considered to be of length=1, and the
	// watermarks determine how many objects to keep in the buffer, rather than
	// how many bytes or characters.
	function validChunk(stream, state, chunk, cb) {
	  var valid = true;

	  if (!(Buffer.isBuffer(chunk)) &&
	      typeof chunk !== 'string' &&
	      chunk !== null &&
	      chunk !== undefined &&
	      !state.objectMode) {
	    var er = new TypeError('Invalid non-string/buffer chunk');
	    stream.emit('error', er);
	    processNextTick(cb, er);
	    valid = false;
	  }
	  return valid;
	}

	Writable.prototype.write = function(chunk, encoding, cb) {
	  var state = this._writableState;
	  var ret = false;

	  if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (Buffer.isBuffer(chunk))
	    encoding = 'buffer';
	  else if (!encoding)
	    encoding = state.defaultEncoding;

	  if (typeof cb !== 'function')
	    cb = nop;

	  if (state.ended)
	    writeAfterEnd(this, cb);
	  else if (validChunk(this, state, chunk, cb)) {
	    state.pendingcb++;
	    ret = writeOrBuffer(this, state, chunk, encoding, cb);
	  }

	  return ret;
	};

	Writable.prototype.cork = function() {
	  var state = this._writableState;

	  state.corked++;
	};

	Writable.prototype.uncork = function() {
	  var state = this._writableState;

	  if (state.corked) {
	    state.corked--;

	    if (!state.writing &&
	        !state.corked &&
	        !state.finished &&
	        !state.bufferProcessing &&
	        state.bufferedRequest)
	      clearBuffer(this, state);
	  }
	};

	Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
	  // node::ParseEncoding() requires lower case.
	  if (typeof encoding === 'string')
	    encoding = encoding.toLowerCase();
	  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64',
	'ucs2', 'ucs-2','utf16le', 'utf-16le', 'raw']
	.indexOf((encoding + '').toLowerCase()) > -1))
	    throw new TypeError('Unknown encoding: ' + encoding);
	  this._writableState.defaultEncoding = encoding;
	};

	function decodeChunk(state, chunk, encoding) {
	  if (!state.objectMode &&
	      state.decodeStrings !== false &&
	      typeof chunk === 'string') {
	    chunk = new Buffer(chunk, encoding);
	  }
	  return chunk;
	}

	// if we're already writing something, then just put this
	// in the queue, and wait our turn.  Otherwise, call _write
	// If we return false, then we need a drain event, so set that flag.
	function writeOrBuffer(stream, state, chunk, encoding, cb) {
	  chunk = decodeChunk(state, chunk, encoding);

	  if (Buffer.isBuffer(chunk))
	    encoding = 'buffer';
	  var len = state.objectMode ? 1 : chunk.length;

	  state.length += len;

	  var ret = state.length < state.highWaterMark;
	  // we must ensure that previous needDrain will not be reset to false.
	  if (!ret)
	    state.needDrain = true;

	  if (state.writing || state.corked) {
	    var last = state.lastBufferedRequest;
	    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
	    if (last) {
	      last.next = state.lastBufferedRequest;
	    } else {
	      state.bufferedRequest = state.lastBufferedRequest;
	    }
	  } else {
	    doWrite(stream, state, false, len, chunk, encoding, cb);
	  }

	  return ret;
	}

	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	  state.writelen = len;
	  state.writecb = cb;
	  state.writing = true;
	  state.sync = true;
	  if (writev)
	    stream._writev(chunk, state.onwrite);
	  else
	    stream._write(chunk, encoding, state.onwrite);
	  state.sync = false;
	}

	function onwriteError(stream, state, sync, er, cb) {
	  --state.pendingcb;
	  if (sync)
	    processNextTick(cb, er);
	  else
	    cb(er);

	  stream._writableState.errorEmitted = true;
	  stream.emit('error', er);
	}

	function onwriteStateUpdate(state) {
	  state.writing = false;
	  state.writecb = null;
	  state.length -= state.writelen;
	  state.writelen = 0;
	}

	function onwrite(stream, er) {
	  var state = stream._writableState;
	  var sync = state.sync;
	  var cb = state.writecb;

	  onwriteStateUpdate(state);

	  if (er)
	    onwriteError(stream, state, sync, er, cb);
	  else {
	    // Check if we're actually ready to finish, but don't emit yet
	    var finished = needFinish(state);

	    if (!finished &&
	        !state.corked &&
	        !state.bufferProcessing &&
	        state.bufferedRequest) {
	      clearBuffer(stream, state);
	    }

	    if (sync) {
	      processNextTick(afterWrite, stream, state, finished, cb);
	    } else {
	      afterWrite(stream, state, finished, cb);
	    }
	  }
	}

	function afterWrite(stream, state, finished, cb) {
	  if (!finished)
	    onwriteDrain(stream, state);
	  state.pendingcb--;
	  cb();
	  finishMaybe(stream, state);
	}

	// Must force callback to be called on nextTick, so that we don't
	// emit 'drain' before the write() consumer gets the 'false' return
	// value, and has a chance to attach a 'drain' listener.
	function onwriteDrain(stream, state) {
	  if (state.length === 0 && state.needDrain) {
	    state.needDrain = false;
	    stream.emit('drain');
	  }
	}


	// if there's something in the buffer waiting, then process it
	function clearBuffer(stream, state) {
	  state.bufferProcessing = true;
	  var entry = state.bufferedRequest;

	  if (stream._writev && entry && entry.next) {
	    // Fast case, write everything using _writev()
	    var buffer = [];
	    var cbs = [];
	    while (entry) {
	      cbs.push(entry.callback);
	      buffer.push(entry);
	      entry = entry.next;
	    }

	    // count the one we are adding, as well.
	    // TODO(isaacs) clean this up
	    state.pendingcb++;
	    state.lastBufferedRequest = null;
	    doWrite(stream, state, true, state.length, buffer, '', function(err) {
	      for (var i = 0; i < cbs.length; i++) {
	        state.pendingcb--;
	        cbs[i](err);
	      }
	    });

	    // Clear buffer
	  } else {
	    // Slow case, write chunks one-by-one
	    while (entry) {
	      var chunk = entry.chunk;
	      var encoding = entry.encoding;
	      var cb = entry.callback;
	      var len = state.objectMode ? 1 : chunk.length;

	      doWrite(stream, state, false, len, chunk, encoding, cb);
	      entry = entry.next;
	      // if we didn't call the onwrite immediately, then
	      // it means that we need to wait until it does.
	      // also, that means that the chunk and cb are currently
	      // being processed, so move the buffer counter past them.
	      if (state.writing) {
	        break;
	      }
	    }

	    if (entry === null)
	      state.lastBufferedRequest = null;
	  }
	  state.bufferedRequest = entry;
	  state.bufferProcessing = false;
	}

	Writable.prototype._write = function(chunk, encoding, cb) {
	  cb(new Error('not implemented'));
	};

	Writable.prototype._writev = null;

	Writable.prototype.end = function(chunk, encoding, cb) {
	  var state = this._writableState;

	  if (typeof chunk === 'function') {
	    cb = chunk;
	    chunk = null;
	    encoding = null;
	  } else if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (chunk !== null && chunk !== undefined)
	    this.write(chunk, encoding);

	  // .end() fully uncorks
	  if (state.corked) {
	    state.corked = 1;
	    this.uncork();
	  }

	  // ignore unnecessary end() calls.
	  if (!state.ending && !state.finished)
	    endWritable(this, state, cb);
	};


	function needFinish(state) {
	  return (state.ending &&
	          state.length === 0 &&
	          state.bufferedRequest === null &&
	          !state.finished &&
	          !state.writing);
	}

	function prefinish(stream, state) {
	  if (!state.prefinished) {
	    state.prefinished = true;
	    stream.emit('prefinish');
	  }
	}

	function finishMaybe(stream, state) {
	  var need = needFinish(state);
	  if (need) {
	    if (state.pendingcb === 0) {
	      prefinish(stream, state);
	      state.finished = true;
	      stream.emit('finish');
	    } else {
	      prefinish(stream, state);
	    }
	  }
	  return need;
	}

	function endWritable(stream, state, cb) {
	  state.ending = true;
	  finishMaybe(stream, state);
	  if (cb) {
	    if (state.finished)
	      processNextTick(cb);
	    else
	      stream.once('finish', cb);
	  }
	  state.ended = true;
	}


/***/ },
/* 51 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/**
	 * Module exports.
	 */

	module.exports = deprecate;

	/**
	 * Mark that a method should not be used.
	 * Returns a modified function which warns once by default.
	 *
	 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
	 *
	 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
	 * will throw an Error when invoked.
	 *
	 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
	 * will invoke `console.trace()` instead of `console.error()`.
	 *
	 * @param {Function} fn - the function to deprecate
	 * @param {String} msg - the string to print to the console when `fn` is invoked
	 * @returns {Function} a new "deprecated" version of `fn`
	 * @api public
	 */

	function deprecate (fn, msg) {
	  if (config('noDeprecation')) {
	    return fn;
	  }

	  var warned = false;
	  function deprecated() {
	    if (!warned) {
	      if (config('throwDeprecation')) {
	        throw new Error(msg);
	      } else if (config('traceDeprecation')) {
	        console.trace(msg);
	      } else {
	        console.warn(msg);
	      }
	      warned = true;
	    }
	    return fn.apply(this, arguments);
	  }

	  return deprecated;
	}

	/**
	 * Checks `localStorage` for boolean values for the given `name`.
	 *
	 * @param {String} name
	 * @returns {Boolean}
	 * @api private
	 */

	function config (name) {
	  if (!global.localStorage) return false;
	  var val = global.localStorage[name];
	  if (null == val) return false;
	  return String(val).toLowerCase() === 'true';
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 52 */
37,
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	// a transform stream is a readable/writable stream where you do
	// something with the data.  Sometimes it's called a "filter",
	// but that's not a great name for it, since that implies a thing where
	// some bits pass through, and others are simply ignored.  (That would
	// be a valid example of a transform, of course.)
	//
	// While the output is causally related to the input, it's not a
	// necessarily symmetric or synchronous transformation.  For example,
	// a zlib stream might take multiple plain-text writes(), and then
	// emit a single compressed chunk some time in the future.
	//
	// Here's how this works:
	//
	// The Transform stream has all the aspects of the readable and writable
	// stream classes.  When you write(chunk), that calls _write(chunk,cb)
	// internally, and returns false if there's a lot of pending writes
	// buffered up.  When you call read(), that calls _read(n) until
	// there's enough pending readable data buffered up.
	//
	// In a transform stream, the written data is placed in a buffer.  When
	// _read(n) is called, it transforms the queued up data, calling the
	// buffered _write cb's as it consumes chunks.  If consuming a single
	// written chunk would result in multiple output chunks, then the first
	// outputted bit calls the readcb, and subsequent chunks just go into
	// the read buffer, and will cause it to emit 'readable' if necessary.
	//
	// This way, back-pressure is actually determined by the reading side,
	// since _read has to be called to start processing a new chunk.  However,
	// a pathological inflate type of transform can cause excessive buffering
	// here.  For example, imagine a stream where every byte of input is
	// interpreted as an integer from 0-255, and then results in that many
	// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
	// 1kb of data being output.  In this case, you could write a very small
	// amount of input, and end up with a very large amount of output.  In
	// such a pathological inflating mechanism, there'd be no way to tell
	// the system to stop doing the transform.  A single 4MB write could
	// cause the system to run out of memory.
	//
	// However, even in such a pathological case, only a single written chunk
	// would be consumed, and then the rest would wait (un-transformed) until
	// the results of the previous transformed chunk were consumed.

	'use strict';

	module.exports = Transform;

	var Duplex = __webpack_require__(49);

	/*<replacement>*/
	var util = __webpack_require__(47);
	util.inherits = __webpack_require__(20);
	/*</replacement>*/

	util.inherits(Transform, Duplex);


	function TransformState(stream) {
	  this.afterTransform = function(er, data) {
	    return afterTransform(stream, er, data);
	  };

	  this.needTransform = false;
	  this.transforming = false;
	  this.writecb = null;
	  this.writechunk = null;
	}

	function afterTransform(stream, er, data) {
	  var ts = stream._transformState;
	  ts.transforming = false;

	  var cb = ts.writecb;

	  if (!cb)
	    return stream.emit('error', new Error('no writecb in Transform class'));

	  ts.writechunk = null;
	  ts.writecb = null;

	  if (data !== null && data !== undefined)
	    stream.push(data);

	  if (cb)
	    cb(er);

	  var rs = stream._readableState;
	  rs.reading = false;
	  if (rs.needReadable || rs.length < rs.highWaterMark) {
	    stream._read(rs.highWaterMark);
	  }
	}


	function Transform(options) {
	  if (!(this instanceof Transform))
	    return new Transform(options);

	  Duplex.call(this, options);

	  this._transformState = new TransformState(this);

	  // when the writable side finishes, then flush out anything remaining.
	  var stream = this;

	  // start out asking for a readable event once data is transformed.
	  this._readableState.needReadable = true;

	  // we have implemented the _read method, and done the other things
	  // that Readable wants before the first _read call, so unset the
	  // sync guard flag.
	  this._readableState.sync = false;

	  if (options) {
	    if (typeof options.transform === 'function')
	      this._transform = options.transform;

	    if (typeof options.flush === 'function')
	      this._flush = options.flush;
	  }

	  this.once('prefinish', function() {
	    if (typeof this._flush === 'function')
	      this._flush(function(er) {
	        done(stream, er);
	      });
	    else
	      done(stream);
	  });
	}

	Transform.prototype.push = function(chunk, encoding) {
	  this._transformState.needTransform = false;
	  return Duplex.prototype.push.call(this, chunk, encoding);
	};

	// This is the part where you do stuff!
	// override this function in implementation classes.
	// 'chunk' is an input chunk.
	//
	// Call `push(newChunk)` to pass along transformed output
	// to the readable side.  You may call 'push' zero or more times.
	//
	// Call `cb(err)` when you are done with this chunk.  If you pass
	// an error, then that'll put the hurt on the whole operation.  If you
	// never call cb(), then you'll never get another chunk.
	Transform.prototype._transform = function(chunk, encoding, cb) {
	  throw new Error('not implemented');
	};

	Transform.prototype._write = function(chunk, encoding, cb) {
	  var ts = this._transformState;
	  ts.writecb = cb;
	  ts.writechunk = chunk;
	  ts.writeencoding = encoding;
	  if (!ts.transforming) {
	    var rs = this._readableState;
	    if (ts.needTransform ||
	        rs.needReadable ||
	        rs.length < rs.highWaterMark)
	      this._read(rs.highWaterMark);
	  }
	};

	// Doesn't matter what the args are here.
	// _transform does all the work.
	// That we got here means that the readable side wants more data.
	Transform.prototype._read = function(n) {
	  var ts = this._transformState;

	  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
	    ts.transforming = true;
	    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
	  } else {
	    // mark that we need a transform, so that any data that comes in
	    // will get processed, now that we've asked for it.
	    ts.needTransform = true;
	  }
	};


	function done(stream, er) {
	  if (er)
	    return stream.emit('error', er);

	  // if there's nothing in the write buffer, then that means
	  // that nothing more will ever be provided
	  var ws = stream._writableState;
	  var ts = stream._transformState;

	  if (ws.length)
	    throw new Error('calling transform done when ws.length != 0');

	  if (ts.transforming)
	    throw new Error('calling transform done when still transforming');

	  return stream.push(null);
	}


/***/ },
/* 54 */
/***/ function(module, exports, __webpack_require__) {

	// a passthrough stream.
	// basically just the most minimal sort of Transform stream.
	// Every written chunk gets output as-is.

	'use strict';

	module.exports = PassThrough;

	var Transform = __webpack_require__(53);

	/*<replacement>*/
	var util = __webpack_require__(47);
	util.inherits = __webpack_require__(20);
	/*</replacement>*/

	util.inherits(PassThrough, Transform);

	function PassThrough(options) {
	  if (!(this instanceof PassThrough))
	    return new PassThrough(options);

	  Transform.call(this, options);
	}

	PassThrough.prototype._transform = function(chunk, encoding, cb) {
	  cb(null, chunk);
	};


/***/ },
/* 55 */
[60, 50],
/* 56 */
[61, 49],
/* 57 */
[62, 53],
/* 58 */
[63, 54],
/* 59 */
/***/ function(module, exports, __webpack_require__, __webpack_module_template_argument_0__, __webpack_module_template_argument_1__, __webpack_module_template_argument_2__, __webpack_module_template_argument_3__, __webpack_module_template_argument_4__, __webpack_module_template_argument_5__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	module.exports = Stream;

	var EE = __webpack_require__(19).EventEmitter;
	var inherits = __webpack_require__(__webpack_module_template_argument_0__);

	inherits(Stream, EE);
	Stream.Readable = __webpack_require__(__webpack_module_template_argument_1__);
	Stream.Writable = __webpack_require__(__webpack_module_template_argument_2__);
	Stream.Duplex = __webpack_require__(__webpack_module_template_argument_3__);
	Stream.Transform = __webpack_require__(__webpack_module_template_argument_4__);
	Stream.PassThrough = __webpack_require__(__webpack_module_template_argument_5__);

	// Backwards-compat with node 0.4.x
	Stream.Stream = Stream;



	// old-style streams.  Note that the pipe method (the only relevant
	// part of this class) is overridden in the Readable class.

	function Stream() {
	  EE.call(this);
	}

	Stream.prototype.pipe = function(dest, options) {
	  var source = this;

	  function ondata(chunk) {
	    if (dest.writable) {
	      if (false === dest.write(chunk) && source.pause) {
	        source.pause();
	      }
	    }
	  }

	  source.on('data', ondata);

	  function ondrain() {
	    if (source.readable && source.resume) {
	      source.resume();
	    }
	  }

	  dest.on('drain', ondrain);

	  // If the 'end' option is not supplied, dest.end() will be called when
	  // source gets the 'end' or 'close' events.  Only dest.end() once.
	  if (!dest._isStdio && (!options || options.end !== false)) {
	    source.on('end', onend);
	    source.on('close', onclose);
	  }

	  var didOnEnd = false;
	  function onend() {
	    if (didOnEnd) return;
	    didOnEnd = true;

	    dest.end();
	  }


	  function onclose() {
	    if (didOnEnd) return;
	    didOnEnd = true;

	    if (typeof dest.destroy === 'function') dest.destroy();
	  }

	  // don't leave dangling pipes when there are errors.
	  function onerror(er) {
	    cleanup();
	    if (EE.listenerCount(this, 'error') === 0) {
	      throw er; // Unhandled stream error in pipe.
	    }
	  }

	  source.on('error', onerror);
	  dest.on('error', onerror);

	  // remove all the event listeners that were added.
	  function cleanup() {
	    source.removeListener('data', ondata);
	    dest.removeListener('drain', ondrain);

	    source.removeListener('end', onend);
	    source.removeListener('close', onclose);

	    source.removeListener('error', onerror);
	    dest.removeListener('error', onerror);

	    source.removeListener('end', cleanup);
	    source.removeListener('close', cleanup);

	    dest.removeListener('close', cleanup);
	  }

	  source.on('end', cleanup);
	  source.on('close', cleanup);

	  dest.on('close', cleanup);

	  dest.emit('pipe', source);

	  // Allow for unix-like usage: A.pipe(B).pipe(C)
	  return dest;
	};


/***/ },
/* 60 */
/***/ function(module, exports, __webpack_require__, __webpack_module_template_argument_0__) {

	module.exports = __webpack_require__(__webpack_module_template_argument_0__)


/***/ },
/* 61 */
/***/ function(module, exports, __webpack_require__, __webpack_module_template_argument_0__) {

	module.exports = __webpack_require__(__webpack_module_template_argument_0__)


/***/ },
/* 62 */
/***/ function(module, exports, __webpack_require__, __webpack_module_template_argument_0__) {

	module.exports = __webpack_require__(__webpack_module_template_argument_0__)


/***/ },
/* 63 */
/***/ function(module, exports, __webpack_require__, __webpack_module_template_argument_0__) {

	module.exports = __webpack_require__(__webpack_module_template_argument_0__)


/***/ }
/******/ ])));