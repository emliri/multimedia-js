# multimedia-js | MM-JS 

## CI status

<a href="https://travis-ci.org/tchakabam/multimedia-js"><img src="https://api.travis-ci.org/tchakabam/multimedia-js.svg?branch=master"></a>

## A toolkit and collection library for all things multimedia in JavaScript. Data-flow pipelines for processing. 

Our framework allows to decouple processing steps being performed in workers via media-aware data-structures. The details of transferring data across worker instances and synchronizing it is however dealt-with by the core framework itself. Implementors of `processors` don't need to know about the execution context and application details.

Processors can access generic metadata to handle various input flows and generate output data flows (packets), independent of the sources and destinations or the actual application. Every processor serves a specific processing purpose with maximum reusability in mind.

We are using TypeScript to design a solid but flexible framework, while being able to wrap any libraries that implement formats or codecs like H264, MP3, MP4 or Webm. We preferrably wrap libraries that are already written in TS or with detailed type-declarations.

This library is under development to a `1.0` release. Not much documentation exists yet. Have a look at `test-cases` for usage examples.
 
There exists a `v0.x` with various releases. Please see comment at bottom if you are looking for this.

## Development modus and status

Please note: The v1 branch is in *fast-pace* development and as we increase minor versions, some public APIs might change in *non-backward-compatible* way.

API compatibility across versions is *not* any of our priorities at the moment. We are focused on delivering a lean and stable library packed with features and fulfilling for use-cases.

However the most high-level and use-case oriented interfaces usually do not change, and we are integrating against the "test-cases" which we make available as part of the library, so stick to that if you need something to trust in at the moment.

## Roadmap strategy

As a roadmap, we see a potential v2 release as the first "API stable", and therefore a major milestone to achieve. A stable API will be the product of the current phase where we can explore various use-cases and their needs.

## Automated testing

TODO: Next stop, automated CI for unit specs and functional/integration test-cases ...

 ## Build and develop
 
 ```
 npm install
 git submodule update --init
 npm start // starts webpack dev-server
 // or
 npm run build // runs build and exits
 // or
  npm run build // runs build and watches changes to rebuild
 ```
 
 ## Lint
 
 ```
 npm run lint
 // or
 npm run lint-fix // auto-fixes lint errors  
 ```

### Are you looking for package `multimedia` v0.x ?

As of v0.8 of multimedia.js, the v0.x branch is not being maintained anymore (at least here). IT still works anyway fwiw :) Feel free to use it for the use-cases implemented. The last v0 release is here: https://github.com/tchakabam/multimedia.js/tree/b433e471c52cafb18308e859cf740acf3222521c or on NPM: (https://www.npmjs.com/package/multimedia)

