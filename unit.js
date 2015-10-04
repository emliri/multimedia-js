var Unit,
    Input, Output, Transfer,
    BaseTransform, BaseSrc, BasePushSrc, BaseSink,
    create = require('lodash.create'),
    stream = require('stream');

module.exports = Unit = function Unit() {

  this.inputs = [];
  this.outputs = [];

};

Unit.link = function(u1, u2) {
  if (arguments.length > 2) {
    return Unit.linkArray(arguments);
  }
  for (var i=0;i<Math.min(u1.numberOfOuts(), u2.numberOfIns()); i++) {
    u1.out(i).pipe(u2.in(i));
  }
  return u2;
};

Unit.linkArray = function(arguments) {
  var u1, u2, i;
  for(i=0;i<arguments.length;i++) {
    u1 = arguments[i];
    if (arguments.length > i+1) {
      u2 = arguments[i+1];
      Unit.link(u1, u2);
    }
  }
  return u2;
};

Unit.IOEvent = {
  CHAIN: 'chain',
  NEED_DATA: 'need-data',
}

Unit.prototype = {
  constructor: Unit,

  in: function(i) {
    return this.inputs[i];
  },

  out: function(i) {
    return this.outputs[i];
  },

  numberOfIns: function() {
    return this.inputs.length;
  },

  numberOfOuts: function() {
    return this.outputs.length;
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
    this.outputs.push(output);
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

};

// Data ownership transfer unit between unit interfaces (inputs/outputs)
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
  stream.Writable.prototype.constructor.call(this, {
    objectMode: true,
    decodeStrings: false,
  });
};

// Listen to 'chain' event to get input data
Input.prototype = create(stream.Writable.prototype, {
  constructor: Input,

  _write: function(data, encoding, callback) {
    console.log('_write: ' + encoding);
    this.emit(Unit.IOEvent.CHAIN, new Transfer(data, encoding, callback));
  },
});

Unit.Output = Output = function Output() {
  stream.Readable.prototype.constructor.apply(this, {
    objectMode: true,
  });

  this._dataRequested = 0;
  this._shouldPushMore = true;
};

// Call push to pass data out
Output.prototype = create(stream.Readable.prototype, {
  constructor: Output,

  _read: function(size) {
    this._dataRequested++;
    this.emit(Unit.IOEvent.NEED_DATA, this);
  },

  push: function(data, encoding) {
    console.log('push: ' + encoding);
    this._dataRequested--;
    this._shouldPushMore = stream.Readable.prototype.push.call(this, data, encoding);
    return this._shouldPushMore;
  },

  isPulling: function() {
    console.log (this._dataRequested);
    return this._dataRequested > 0;
  },

});

Unit.BaseTransform = BaseTransform = function BaseTransform() {
  Unit.prototype.constructor.apply(this, arguments);

  this.add(new Input())
      .add(new Output());

  this.in(0).on(Unit.IOEvent.CHAIN, this._onChain.bind(this));
};

BaseTransform.prototype = create(Unit.prototype, {

  constructor: BaseTransform,

  _onChain: function(transfer) {
    this._transform(transfer);
    this.out(0).push(transfer.data, transfer.encoding);
    transfer.resolve();
  },

  _transform: function(transfer) {}, // virtual method to be implemented

});

Unit.BaseSrc = BaseSrc = function BaseSrc() {

  Unit.prototype.constructor.apply(this, arguments);

  this.add(new Output());

  this.out(0).on(Unit.IOEvent.NEED_DATA, this.squeeze.bind(this));
};

BaseSrc.prototype = create(Unit.prototype, {

  constructor: BaseSrc,

  squeeze: function() {

    console.log('squeeze');

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

  BaseSrc.prototype.constructor.apply(this, arguments);

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

    if (this.out(0).isPulling()) {
      this.squeeze();
    }
  },

});

Unit.BaseSink = BaseSink = function BaseSink() {

  Unit.prototype.constructor.apply(this, arguments);

  this.add(new Input());

  this.in(0).on('chain', this._onChain.bind(this));

  this._buffer = [];
};

BaseSink.prototype = create(Unit.prototype, {

  constructor: BaseSink,

  _onChain: function(transfer) {

    console.log('onChain: ' + transfer.encoding);

    this._buffer.push(transfer);
    transfer.resolve();
    this._onData();
  },

  _onData: function() {},

  dequeue: function() {
    if (!this._buffer.length) {
      return null;
    }
    return this._buffer.shift();
  },

});
