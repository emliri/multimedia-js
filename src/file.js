var Helpers = require('./helpers.js');

module.exports = Helpers.haveGlobalWindow() ? (new (require('node-browserfs'))()) : require('fs');