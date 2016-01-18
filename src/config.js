var loggingEnabled = false;

module.exports = {

	loggingEnabled: function(enable) {
		if (enable !== undefined) {
			loggingEnabled = enable;
		}
		return loggingEnabled;
	}
};