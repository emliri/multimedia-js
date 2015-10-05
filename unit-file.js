var UnitFile,
  	FileSrc, FileSink
  	Unit = require('./unit.js'),
    create = require('lodash.create'),
  	fs = require('fs');

FileSrc = function FileSrc (path, options) {
  Unit.prototype.constructor.call(this);

  this.addOutput(fs.createReadStream(path, options));
};

FileSrc.prototype = Unit.create({
  constructor: FileSrc,
});

FileSink = function FileSink (path, options) {
  Unit.prototype.constructor.call(this);

  this.addInput(fs.createWriteStream(path, options));
};

FileSink.prototype = Unit.create({
  constructor: FileSink,
});

module.exports = UnitFile = {
  Src: FileSrc,
  Sink: FileSink,
};
