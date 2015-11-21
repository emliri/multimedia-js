var Helpers;

module.exports = Helpers = {

	haveGlobalWindow: function() {
		return (typeof window !== 'undefined');
	},

	haveMediaSourceExtensions: function() {
		return Helpers.haveGlobalWindow() && window.MediaSource;
	},

	haveMediaSourceSupportMimeType: function(mimeType) {
		return Helpers.haveMediaSourceExtensions() && window.MediaSource.isTypeSupported(mimeType);
	}
};