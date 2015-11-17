var Helpers;

module.exports = Helpers = {

	haveGlobalWindow: function() {
		return (typeof window !== 'undefined');
	},

	haveMediaSourceExtensions: function() {
		return Helpers.haveGlobalWindow() && window.MediaSource;
	}
};