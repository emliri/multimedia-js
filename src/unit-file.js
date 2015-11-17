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

var UnitFile,
  	FileSrc, FileSink,
  	Unit = require('./unit.js'),
    fs = require('./file.js'),
    create = require('lodash.create');

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
