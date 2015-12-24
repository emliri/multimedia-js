var MP4Mux = require('./mp4-mux.js');

var muxer = null;

onmessage = function(e) {

  var input = e.data;

  if (!muxer && input.mp4MuxProfile) {
    var mp4MuxProfile = input.mp4MuxProfile;
    muxer = new MP4Mux(mp4MuxProfile);
    muxer.ondata = function(data) {
      postMessage(data);
    };
    muxer.oncodecinfo = function(codecInfo) {
      // TODO
    };
  }

  if (muxer && input.data && input.meta && input.packetType) {
    var data = input.data;
    var meta = input.meta;
    var timestamp = input.timestamp;
    var packetType = input.packetType;
    muxer.pushPacket(
      packetType,
      new Uint8Array(data),
      timestamp,
      meta
    );
  }

  if (muxer && input.eos) {
    muxer.flush();
  }
}