var UnitMSESink,
	Unit = require('./unit.js'),
	BaseSink = Unit.BaseSink,
	MSEWriter = require('./mse-writer.js');

module.exports = UnitMSESink = function UnitMSESink(mimeType) {
  BaseSink.prototype.constructor.call(this);

  this.mediaSource = new MediaSource();
  this.mseWriter = new MSEWriter(this.mediaSource);

  // FIXME: for now we only support one data-source (i.e only one input)
  this.dataSource = {
  	mimeType: mimeType
  };
  this.mseWriter.listen(this.dataSource);
};

UnitMSESink.prototype = Unit.createBaseSink({
	constructor: UnitMSESink,

	_onData: function() {
		if (this.dataSource.onData) {
			var transfer = this.dequeue();
			if (transfer) {
				this.dataSource.onData(transfer.data);
			}
		} else {
			throw new Error('DataSource has no onData function defined');
		}
	},
});


