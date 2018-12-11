.PHONY: all clean

# SOURCE FILES (all files in `src`)

SRC_FILES = $(shell find src -type f -name "*")

# VENDOR LIBS

VENDOR_LIB_NAME_FFMPEG = ffmpeg.js

# PHONYS

all: dist vendor/$(VENDOR_LIB_NAME_FFMPEG)

clean:
	rm -Rf package-lock.json
	rm -Rf node_modules
	rm -Rf dist

# TARGET FILES

dist: $(SRC_FILES) package-lock.json
	rm -Rf dist
	npm run build

package-lock.json: package.json
	rm -Rf package-lock.json
	npm install

vendor/$(VENDOR_LIB_NAME_FFMPEG): vendor package-lock.json
	rm -Rf vendor/$(VENDOR_LIB_NAME_FFMPEG)
	cp -R node_modules/$(VENDOR_LIB_NAME_FFMPEG) vendor

	# we need to replace module.exports to make this work in global scope as non-module external DOM-like script
	# because this gets imported dynamically via Worker.importScripts
	sed -i -e 's/module.exports=/self.ffmpeg=/' vendor/ffmpeg.js/ffmpeg-mp4.js
	sed -i -e 's/module.exports=/self.ffmpeg=/' vendor/ffmpeg.js/ffmpeg-webm.js
	rm vendor/ffmpeg.js/*-e

vendor: package-lock.json
	mkdir -p vendor






