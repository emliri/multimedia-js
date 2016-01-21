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

var log = require('./log');

var Unit,
    Input, Output, Transfer,
    BaseTransform, BaseSrc, BasePushSrc, BaseSink, BaseParser,
    InputSelector,
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

Unit.createBasePushSrc = function UnitCreateBasePushSrc(proto) {
  return create(BasePushSrc.prototype, proto);
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

var Event = Unit.Event = {
  CHAIN: 'chain',
  NEED_DATA: 'need-data',
  FINISH: 'finish',
  PIPE: 'pipe',
  UNPIPE: 'unpipe',
  ERROR: 'error',
  END: 'end',
  OPEN: 'open',
  CLOSE: 'close'
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
    this._installEventForwarder(input, Event.FINISH);
    this._installEventForwarder(input, Event.OPEN);
    this._installEventForwarder(input, Event.PIPE);
    this._installEventForwarder(input, Event.UNPIPE);
    this._installEventForwarder(input, Event.ERROR);
    this._installEventForwarder(input, Event.CHAIN);
    this.inputs.push(input);
  },

  addOutput: function(output) {
    this._installEventForwarder(output, Event.END);
    this._installEventForwarder(output, Event.OPEN);
    this._installEventForwarder(output, Event.CLOSE);
    this._installEventForwarder(output, Event.ERROR);
    this._installEventForwarder(output, Event.NEED_DATA);
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
    source.on(event, function(data) {
      this.emit(event, source, data)
    }.bind(this));
  },

});

// Data ownership transfer unit between unit interfaces (inputs/outputs)
Unit.Transfer = Transfer = function Transfer(data, encoding, doneCallback) {

  if (!encoding) {
    if (data instanceof Buffer) {
      encoding = 'buffer';
    } else if (data instanceof String) {
      encoding = 'utf8';
    } else {
      encoding = 'object';
    }
  }

  this.resolved = false;
  this.data = data;
  this.encoding = encoding;
  this.doneCallback = doneCallback;
};

Transfer.prototype = create(Object.prototype, {

  constructor: Transfer,

  resolve: function() {
    if (!this.doneCallback || this.resolved) {
      return;
    }
    this.doneCallback();
    this.resolved = true;
  },

  setFlushing: function(flush) {
    this.data.flush = flush;
    return this;
  },

  setEmpty: function(empty) {
    this.data.empty = empty;
    return this;
  }

});

Transfer.Flush = function() {
  return new Transfer({}, 'binary').setFlushing(true).setEmpty(true);
}

Transfer.EOS = function() {
  return new Transfer(null, 'binary');
}

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
    log('_write: ' + encoding);
    this.emit(Unit.Event.CHAIN, new Transfer(data, encoding, callback));
  },
});

Unit.Output = Output = function Output(readable) {
  stream.Readable.prototype.constructor.call(this, {
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
    this.emit(Event.NEED_DATA, this);
  },

  push: function(data, encoding) {
    this._dataRequested--;
    this._shouldPushMore = stream.Readable.prototype.push.call(this, data, encoding);
    return this._shouldPushMore;
  },

  isPulling: function() {
    return this._dataRequested > 0;
  },

  eos: function() {
    stream.Readable.prototype.push.call(this, null, 'null');
  }

});

Unit.BaseTransform = BaseTransform = function BaseTransform() {
  Unit.prototype.constructor.apply(this, arguments);

  this.add(new Input())
      .add(new Output());

  this.on(Event.CHAIN, this._onChain.bind(this));
  this.on(Event.FINISH, this._onFinish.bind(this));
};

BaseTransform.prototype = create(Unit.prototype, {

  constructor: BaseTransform,

  _onChain: function(input, transfer) {
    this._transform(transfer);
    this.out(0).push(transfer.data, transfer.encoding);
    transfer.resolve();
  },

  _onFinish: function(input) {
    Output.eos(this.out(0));
  },

  _transform: function(transfer) {}, // virtual method to be implemented

});

Unit.BaseSrc = BaseSrc = function BaseSrc() {
  Unit.prototype.constructor.apply(this, arguments);

  this.add(new Output());

  this.on(Event.NEED_DATA, this.squeeze.bind(this));
};

BaseSrc.prototype = create(Unit.prototype, {

  constructor: BaseSrc,

  squeeze: function() {

    log('squeeze');

    var transfer = this._source();
    if (!transfer) {
      return;
    }

    this.out(0).push(transfer.data, transfer.encoding);
    transfer.resolve();
  },

  // returns: Transfer
  _source: function() {}, // virtual method to be implemented

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

  this.on(Event.CHAIN, this._onChain.bind(this));

  this._bufferIn = [];
};

BaseSink.prototype = create(Unit.prototype, {

  constructor: BaseSink,

  _onChain: function(input, transfer) {

    log('BaseSink._onChain: ' + transfer.encoding);

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

  this.on('finish', this._onFinish.bind(this));
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
    log('BaseParser._onFinish');
    Output.eos(this.out(0));
  },

  // Implement _parse and call enqueue whenever you want to push data out
  _parse: function(transfer) {},

});

Unit.InputSelector = InputSelector = function InputSelector(numberOfIns) {
  BaseTransform.prototype.constructor.apply(this, arguments);

  numberOfIns = (numberOfIns || 1) - 1;
  while(numberOfIns-- > 0) {
    this.add(new Input());
  }

  this.selectedInputIndex = 0;
}

assign(InputSelector.prototype,
  BaseTransform.prototype, {
  constructor: InputSelector,

  _onChain: function(input, transfer) {
    var selectedInput = this.in(this.selectedInputIndex);
    if (input !== selectedInput) {
      // just drop and ignore data from non selected inputs
      transfer.resolve();
      return;
    }
    this._transform(transfer);
    this.out(0).push(transfer.data, transfer.encoding);
    transfer.resolve();
  },

  _onFinish: function(input) {
    var selectedInput = this.in(this.selectedInputIndex);
    if (input !== selectedInput) {
      // just ignore eos from non selected inputs
      return;
    }

    Output.eos(this.out(0));
  },

});