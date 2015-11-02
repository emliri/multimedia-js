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

var MP4Iso = require('./mp4-iso.js');

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
function parseAudiodata(data, metadata) {
    var i = 0;
    var packetType = AudioPacketType.RAW;
    var samples;
    switch (metadata.codecId) {
        case AAC_SOUND_CODEC_ID:
            var type = data[i++];
            packetType = type;
            samples = 1024; // AAC implementations typically represent 1024 PCM audio samples
            break;
        case MP3_SOUND_CODEC_ID:
            var version = (data[i + 1] >> 3) & 3; // 3 - MPEG 1
            var layer = (data[i + 1] >> 1) & 3; // 3 - Layer I, 2 - II, 1 - III

/*
Sign  Length
(bits)  Position
(bits)  Description
A 11  (31-21) Frame sync (all bits set)
B 2 (20,19) MPEG Audio version ID
00 - MPEG Version 2.5
01 - reserved
10 - MPEG Version 2 (ISO/IEC 13818-3)
11 - MPEG Version 1 (ISO/IEC 11172-3)
Note: MPEG Version 2.5 is not official standard. Bit No 20 in frame header is used to indicate version 2.5. Applications that do not support this MPEG version expect this bit always to be set, meaning that frame sync (A) is twelve bits long, not eleve as stated here. Accordingly, B is one bit long (represents only bit No 19). I recommend using methodology presented here, since this allows you to distinguish all three versions and keep full compatibility.

C 2 (18,17) Layer description
00 - reserved
01 - Layer III
10 - Layer II
11 - Layer I
D 1 (16)  Protection bit
0 - Protected by CRC (16bit crc follows header)
1 - Not protected
*/
            samples = layer === 1 ? (version === 3 ? 1152 : 576) : (layer === 3 ? 384 : 1152);
            break;
    }
    info = {
      codecDescription: SOUNDFORMATS[metadata.codecId],
      codecId: metadata.codecId,
      data: data.subarray(i),
      rate: metadata.sampleRate,
      size: metadata.sampleSize,
      channels: metadata.channels,
      samples: samples,
      packetType: packetType
    };
    console.log("parsed audio packet with %d samples", samples);
    return info;
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
            throw new Error('MP4Mux.oncodecinfo is not set');
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
    MP4Mux.prototype.pushPacket = function (type, data, timestamp, metadata) {
        if (this.state === MP4MuxState.CAN_GENERATE_HEADER) {
            this._tryGenerateHeader();
        }
        switch (type) {
            case AUDIO_PACKET:
                var audioTrack = this.audioTrackState;
                var audioPacket = parseAudiodata(data, metadata);
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

MP4Mux.MP3_SOUND_CODEC_ID = MP3_SOUND_CODEC_ID;
MP4Mux.AAC_SOUND_CODEC_ID = AAC_SOUND_CODEC_ID;
MP4Mux.TYPE_AUDIO_PACKET = AUDIO_PACKET;
MP4Mux.TYPE_VIDEO_PACKET = VIDEO_PACKET;

MP4Mux.Profiles = {
  MP3_AUDIO_ONLY: {
    audioTrackId: 0,
    videoTrackId: -1,
    tracks: [
      {
        codecId: MP4Mux.MP3_SOUND_CODEC_ID,
        channels: 2,
        samplerate: 44100,
        samplesize: 16,
        timescale: 1000000000
      },
    ],
  },
};

/*
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

*/

