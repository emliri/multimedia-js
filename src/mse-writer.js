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

