var UnitMSESink,
	Helpers = require('./helpers.js'),
	Unit = require('./unit.js'),
	BaseSink = Unit.BaseSink,
	MSEWriter = require('./mse-writer.js');

module.exports = UnitMSESink = function UnitMSESink(mimeType) {
  BaseSink.prototype.constructor.call(this);

  if (!Helpers.haveMediaSourceSupportMimeType(mimeType)) {
  	throw new Error('Local MediaSource doesn\'t support provided MIME type: ' + mimeType);
  }

  var mimeTypes;
  if (arguments.length > 1) {
  	mimeTypes = Array.prototype.slice.call(arguments);
  } else if(mimeType instanceof Array) {
  	mimeTypes = mimeType;
  } else {
  	mimeTypes = [mimeType];
  }

  this.mimeTypes = mimeTypes;
  this.mediaSource = new MediaSource();
  this.mseWriter = new MSEWriter(this.mediaSource);

  this.dataSources = [];
  this.selectedDataSourceIndex = 0;

  this.mimeTypes.forEach(function(mimeType) {
  	var dataSource = {
      mimeType: mimeType
  	};
  	this.mseWriter.listen(dataSource);
    this.dataSources.push(dataSource);
  }.bind(this));

};

UnitMSESink.prototype = Unit.createBaseSink({
	constructor: UnitMSESink,

	_onData: function() {
    var dataSource = this.dataSources[this.selectedDataSourceIndex];
		if (dataSource && dataSource.onData) {
			var transfer = this.dequeue();
			if (transfer) {
				dataSource.onData(transfer.data);
			}
		} else {
			throw new Error('DataSource is not existing or has no onData function defined');
		}
	},

	getMediaSourceUrl: function() {
		return URL.createObjectURL(this.mediaSource);
	}
});


