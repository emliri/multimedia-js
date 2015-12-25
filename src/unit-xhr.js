var UnitXHR,
	Unit = require('./unit.js'),
	Sink, Src;

Src = function Src(url) {
  Unit.BasePushSrc.prototype.constructor.call(this);

  var req = this.req = new XMLHttpRequest();

  req.open('GET', url, true);
  req.responseType = 'arraybuffer';
  req.onload = function(e) {
  	this.enqueue(new Unit.Transfer(new Uint8Array(req.response), 'binary'));
    this.enqueue(new Unit.Transfer(null, 'binary'));
  }.bind(this);
  req.send();
}

Src.prototype = Unit.createBasePushSrc({
	constructor: Src
});

module.exports = UnitXHR = {
	Src: Src
};