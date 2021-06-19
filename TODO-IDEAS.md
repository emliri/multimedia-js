# Testing

- Generalize test-case for flows that take URL as entry point

- Automate running web test-cases




# Dependencies

- Copy our inspector.js & mux.js dev branches into source-tree



# Use-Cases

- Inside flow: Proc/Proxy UID (like a PID for each to identify them across proxy vs worker instances)

- Read from file or HTTP (or other URI-based source) transparently

- Inspect files and their bitsreams (mp4, ...). Tool for "online" mp4 / TS / web analysis and diff :)

- Inspect AAC (like for h264)

- Fix MP3 ES -> fMP4 case





# Use-case: MP4 Concatenation

- Enable AAC codec data embedding / sample-description-indexing

- Insert silent AAC soundtrack to movie file (special case of "remix")




# Performance

- Analyze bottlenecks around:
  * Worker message event handler in processor-proxy
  * Socket.transfer => dispatchAsync => Socket.transferSync
  * XHR-socket readystatechange event handler




# Model design

- Review PacketSymbols design

- Take care of mime-types and 4cc codec strings properly

- Remove all the "hard-coded" litteral strings and use codec string enums

- Remove all the litteral numbers (especialy duplicated values) and replace by const vars




# Architecture

- Ref-counting of packets via socket transfers (and sealing?)

- "Seal" processor (no more sockets added/removed)

- RAII all the things

- Handle async proc initialization
  -> Handle case like: where MP4-muxer releases codec-info after
     parsing first bits and MediaSource can only be initialized async
  -> Socket has now `whenReady` promise to handle the async-io-socket case in a non-blocking-RAII-like way





# Memory/Buffer handling

- Accu-buffer / Method to create "grow" new BufferSlice from original data and (list of) additional slices

- Abstract away read/write of binary data (byte-parser/writer) for using DataView implementations transparently




# CI

- Document NO_FRILLS & NO_TYPES env vars

- Setup strict compiler mode





# Build

- Rename proc impl to be nice CamelCase

- Move to multi-package "monorepo" build (Rush/Lerna like)

- Rename src to lib

- Compile worker-lib without procs-index

- Analyze package size





