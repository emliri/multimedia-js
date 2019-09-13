# multimedia-js | MM-JS 

## CI status

<a href="https://travis-ci.org/tchakabam/multimedia-js"><img src="https://api.travis-ci.org/tchakabam/multimedia-js.svg?branch=master"></a>

## A toolkit and collection library for all things multimedia in JavaScript. Data-flow pipelines for processing. 

Our framework allows to decouple processing steps being performed in workers via media-aware data-structures. The details of transferring data across worker instances and synchronizing it is however dealt-with by the core framework itself. Implementors of `processors` don't need to know about the execution context and application details.

Processors can access generic metadata to handle various input flows and generate output data flows (packets), independent of the sources and destinations or the actual application. Every processor serves a specific processing purpose with maximum reusability in mind.

We are using TypeScript to design a solid but flexible framework, while being able to wrap any libraries that implement formats or codecs like H264, MP3, MP4 or Webm. We preferrably wrap libraries that are already written in TS or with detailed type-declarations.

This library is under development to a `1.0` release. Not much documentation exists yet. Have a look at `test-cases` for usage examples.
 
There exists a `v0.x` with various releases. Please see comment at bottom if you are looking for this.

## Getting started

To get started with Multimedia-js (mmjs), simply clone & build the project, and check our `test-cases` in the project root.

```
git@github.com:emliri/multimedia-js.git
make # only needed once because we want to install some third-party binaries in publishable `vendor` directory
npm start # if you only modify TS codebase, you can only run this next time
```

In your browser, navigate to http://localhost:8080/test-cases/web/?case=0 

Replace `0` by any index (see initial console output).

## Online demo & Latest "Nightly" builds deploys

In a hurry or too lazy to build it yourself? ;P

We always make the latest build of master available through the Netlify network here: https://multimedia-js-nightly.netlify.com/

You can even directly check out web test-cases here: https://multimedia-js-nightly.netlify.com/test-cases/web

## Development modus and status

Please note: The v1 branch is in *fast-pace* development and as we increase minor versions, some public APIs might change in *non-backward-compatible* way.

API compatibility across versions is *not* any of our priorities at the moment. We are focused on delivering a lean and stable library packed with features and fulfilling for use-cases.

However the most high-level and use-case oriented interfaces usually do not change, and we are integrating against the "test-cases" which we make available as part of the library, so stick to that if you need something to trust in at the moment.

## Roadmap strategy

As a roadmap, we see a potential v2 release as the first "API stable", and therefore a major milestone to achieve. A stable API will be the product of the current phase where we can explore various use-cases and their needs.

## Automated testing & Spec-writing philosophy

### Unit/Integration BDD spec-based testing

We are running automated unit & integration tests in our [CI](https://travis-ci.org/tchakabam/multimedia-js) using the [JEST](https://jestjs.io) test runner. This means the runtime environment is enforced to be bare Node.js (as opposed to browser or other Web based engine). 

This approach allows us to constrain the testing scope on non-DOM dependent modules, non browser-API dependent modules (and/or forcing us to mock these where really needed, as they "should" interact with our code). We want to test *our* code, not some browser implementation or platform-specific part of the runtime. 

Ideally, we write a "spec" in BDD style for each module (that's the goal). This is to be considered a "unit test" for the module, and should contain sub-specifications (tests) for all various cases the UuT should comply to.

We can also write integration tests that will depend on several modules (in terms of source files or object families). There is no formal technical limitation at the moment between writing a spec that is to be considered a unit test or an integration test in the strict definition at the moment in our setup, from the point of view of one "module". 

#### Scope of testing

For every module, we test everything that is a meaningful use-case, and there with the maximum range of data. We don't test everything (we can't), and most importantly we don't test things that aren't supposed to be done with our stuff.

#### On the "unit" vs "integration" terminology

Please consider the terms unit vs integration test is sometimes a matter of point of view (and more specifically in the case of mmjs). If we write a unit test for a `Flow` type component, then that is an integration test for all the processors it uses. To be meaningful, we think that unit tests are useful for all the "core" API abstract functionalities and components as well as specific "processors" and "io-sockets". When it comes to more high-level functionality like "flows", it would be regarded an integration test by the nature of the UuT.

### Functional (web browser) testing

TODO: Next, we will set up functional testing in an automated browser environment to deliver on acceptance criterias for high-level use-cases, especially where Web-API specific integration may play a role. 

### Various Node versions

So far, we don't see the need to extend this approach on different Node API and runtime versions or platform integrations as stronger integrity is given there naturally. Our CI uses a specific Node version (which we officially support in that sense), and developers are allowed to use any recent version on their side. We don't constrain the development environment to a specific one. 

Also see information on the [Supported Node.js version](#supported-nodejs-version).

## Build and develop

### On our build system

* We use `make` to bring together all the things, since we don't consider npm a task-runner worthy of this term (but a great package-system however). Nor do we want to misue Webpack as such a one. We appreciate the ability of Make to guard us from having the computer do the same thing twice unnecessarily.

* We rely on Webpack for JS compilation and bundling. We use the official Typescript toolchain with it (not Babel).

* Our build is a bit more complex than just installing a few packages and hitting Webpack however. We are making use of prebuilt WASM binaries for example, and rely on them being copied to a specific place outside of `node_modules`, or allow them to come from other sources than `npm` in the first place.

* We happily take advantage of using GIT "submodules" where it is meaningful.

### Build system requirements

* Nodejs v8+ (with `npm`)
* GNU or BSD Make (MacOS users check if the XCode CLI toolchain is installed)

Development on MS Windows is not supported at the moment, but you may try by installing CygWin tools or similar (maybe?).

### To build just run ...

First build? You don't need to care about installing dependencies! Our build system does it for you.

```
make
```

That's it. 

Don't be afraid to call `make` again! It is going to check thoroughly before acting and never going to do anything useless that wastes time.

### Running a dev-server

You need to run `make` at least once before to make sure 3rd-party binaries have been vendorized.

```
npm start
```

Go to http://localhost:8080/test-cases/web/

### Supported Node.js version

We support down to Node.js v8.10.0 and higher and are running our CI on v11.

## Lint
 
```
npm run lint
// or
npm run lint-fix // auto-fixes lint errors  
```

Pro tip: To omit warnings, run `npm run lint -- --quiet`

## Test

Runs all unit/integration tests under JEST:

```
npm test
```

See JEST documentation (or `./node_modules/.bin/jest --help`) to check how to constrain testing on spec file-paths or names.

### Are you looking for package `multimedia` v0.x ?

As of v0.8 of multimedia.js, the v0.x branch is not being maintained anymore (at least here). IT still works anyway fwiw :) Feel free to use it for the use-cases implemented. The last v0 release is here: https://github.com/tchakabam/multimedia.js/tree/b433e471c52cafb18308e859cf740acf3222521c or on NPM: (https://www.npmjs.com/package/multimedia)

