var Unit,
    Input, Output, Transfer,
    BaseTransform, BaseSrc, BasePushSrc, BaseSink, BaseParser,
    create = require('lodash.create'),
    assign = require('lodash.assign'),
    EventEmitter = require('events'),
    stream = require('stream');

module.exports = Unit = function Unit() {
  EventEmitter.call(this);

  if (!this.inputs) {
    this.inputs = [];
  }

  if (!this.outputs) {
    this.outputs = [];
  }

};

Unit.create = function UnitCreate(proto) {
  return create(Unit.prototype, proto);
}

Unit.createBaseSrc = function UnitCreateBaseSrc(proto) {
  return create(BaseSrc.prototype, proto);
};

Unit.createBaseSink = function UnitCreateBaseSink(proto) {
  return create(BaseSink.prototype, proto);
};

Unit.createBaseTransform = function UnitCreateBaseTransform(proto) {
  return create(BaseTransform.prototype, proto);
};

Unit.createBaseParser = function UnitCreateBaseParser(proto) {
  return create(BaseParser.prototype, proto);
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

Unit.prototype = create(EventEmitter.prototype, {
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
    this._installEventForwarder(input, 'finish');
    this._installEventForwarder(input, 'open');
    this._installEventForwarder(input, 'pipe');
    this._installEventForwarder(input, 'unpipe');
    this._installEventForwarder(input, 'error');
    this.inputs.push(input);
  },

  addOutput: function(output) {
    this._installEventForwarder(output, 'end');
    this._installEventForwarder(output, 'open');
    this._installEventForwarder(output, 'close');
    this._installEventForwarder(output, 'error');
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

  _installEventForwarder: function(source, event) {
    source.on(event, function() { this.emit(event, source) }.bind(this));
  },

});

// Data ownership transfer unit between unit interfaces (inputs/outputs)
Unit.Transfer = Transfer = function Transfer(data, encoding, doneCallback) {

  if (!encoding) {
    if (data instanceof Buffer) {
      encoding = 'buffer';
    }
    else if (data instanceof String) {
      encoding = 'utf8';
    } else {
      encoding = 'object';
    }
  }

  this.data = data;
  this.encoding = encoding;
  this.doneCallback = doneCallback;
};

Transfer.prototype = create(Object.prototype, {

  constructor: Transfer,

  resolve: function() {
    if (!this.doneCallback) {
      return;
    }
    this.doneCallback();
  },
});

Unit.Input = Input = function Input(writable, arguments) {
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

Unit.Output = Output = function Output(readable) {
  stream.Readable.prototype.constructor.apply(this, {
    objectMode: true,
  });

  this._dataRequested = 0;
  this._shouldPushMore = true;
};

Output.eos = function(readable) {
  readable.push(null, 'null');
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

  this.in(0).on('finish', this._onFinish.bind(this));
};

BaseTransform.prototype = create(Unit.prototype, {

  constructor: BaseTransform,

  _onChain: function(transfer) {
    this._transform(transfer);
    this.out(0).push(transfer.data, transfer.encoding);
    transfer.resolve();
  },

  _onFinish: function() {
    Output.eos(this.out(0));
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
    transfer.resolve();
  },

  // returns: Transfer
  _source: function() {}, // virtual method be implemented

});

Unit.BasePushSrc = BasePushSrc = function BasePushSrc() {
  BaseSrc.prototype.constructor.apply(this, arguments);

  this._bufferOut = [];
};

BasePushSrc.prototype = create(BaseSrc.prototype, {

  constructor: BasePushSrc,

  _source: function() {
    if (!this._bufferOut.length) {
      return null;
    }
    return this._bufferOut.shift();
  },

  enqueue: function(transfer) {
    this._bufferOut.push(transfer);

    if (this.out(0).isPulling && this.out(0).isPulling()) {
      this.squeeze();
    }
  },

});

Unit.BaseSink = BaseSink = function BaseSink() {
  Unit.prototype.constructor.apply(this, arguments);

  this.add(new Input());

  this.in(0).on(Unit.IOEvent.CHAIN, this._onChain.bind(this));

  this._bufferIn = [];
};

BaseSink.prototype = create(Unit.prototype, {

  constructor: BaseSink,

  _onChain: function(transfer) {

    console.log('BaseSink._onChain: ' + transfer.encoding);

    this._bufferIn.push(transfer);
    this._onData();
    transfer.resolve();
  },

  _onData: function() {},

  dequeue: function() {
    if (!this._bufferIn.length) {
      return null;
    }
    return this._bufferIn.shift();
  },

});

Unit.BaseParser = BaseParser = function BaseParser() {
  BasePushSrc.prototype.constructor.apply(this, arguments);
  BaseSink.prototype.constructor.apply(this, arguments);

  this.in(0).on('finish', this._onFinish.bind(this));
};

assign(BaseParser.prototype,
  //
  Unit.prototype, EventEmitter.prototype,
  BaseSrc.prototype, BasePushSrc.prototype,
  BaseSink.prototype, {

  constructor: BaseParser,

  _onData: function() {
    this._parse(this.dequeue());
  },

  _onFinish: function() {
    Output.eos(this.out(0));
  },

  // Implement _parse and call enqueue whenever you want to push data out
  _parse: function(transfer) {},

});