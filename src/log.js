var config = require('./config');

module.exports = function() {
	if (config.loggingEnabled()) {
		console.log.apply(console, arguments);
	}
}