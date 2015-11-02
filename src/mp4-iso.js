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
