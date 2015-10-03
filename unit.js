var Unit,
    Input, Output, Transfer,
    BaseTransform, BaseSrc, BasePushSrc, BaseSink,
    create = require('lodash.create'),
    stream = require('stream-browserify');

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
