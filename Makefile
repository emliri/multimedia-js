.PHONY: all clean

# SOURCE FILES (all JS/TS files in `src`)

SRC_FILES = $(shell find src -type f -name "*.ts") $(shell find src -type f -name "*.js")

# VENDOR LIBS

VENDOR_LIB_NAME_FFMPEG = ffmpeg.js

# PHONYS

all: dist # vendor/$(VENDOR_LIB_NAME_FFMPEG)

clean:
	rm -f package-lock.json.alias
	rm -f .gitmodules.alias
	rm -Rf node_modules
	rm -Rf dist

# TARGET FILES

dist: index.ts $(SRC_FILES) package-lock.json.alias tsconfig.json .gitmodules.alias
	rm -Rf dist
	npm run build

node_modules:
	rm -f package-lock.json.alias
	npm install
	touch package-lock.json.alias

package-lock.json.alias: package.json node_modules
	rm -f package-lock.json.alias
	npm install
	touch package-lock.json.alias

.gitmodules.alias: .gitmodules
	git submodule update --init
	touch .gitmodules.alias

vendor/$(VENDOR_LIB_NAME_FFMPEG): vendor package-lock.json.alias
	rm -Rf vendor/$(VENDOR_LIB_NAME_FFMPEG)
	cp -R node_modules/$(VENDOR_LIB_NAME_FFMPEG) vendor

	# we need to replace module.exports to make this work in global scope as non-module external DOM-like script
	# because this gets imported dynamically via Worker.importScripts

	# doesn't work with GNU (or posix?) shell
	# sed -i "" -e 's/module.exports=/self.ffmpeg=/' vendor/ffmpeg.js/ffmpeg-mp4.js
	# sed -i "" -e 's/module.exports=/self.ffmpeg=/' vendor/ffmpeg.js/ffmpeg-webm.js

	sed -e 's/module.exports=/self.ffmpeg=/' node_modules/$(VENDOR_LIB_NAME_FFMPEG)/ffmpeg-webm.js > vendor/ffmpeg.js/ffmpeg-webm.js
	sed -e 's/module.exports=/self.ffmpeg=/' node_modules/$(VENDOR_LIB_NAME_FFMPEG)/ffmpeg-mp4.js > vendor/ffmpeg.js/ffmpeg-mp4.js

vendor: package-lock.json.alias
	mkdir -p vendor






