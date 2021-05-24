/**
 * Symbols are passed into sockets and thus processors to convey in-band
 * information on the stream of packets.
 */
 export enum PacketSymbol {
  VOID = 0, // void: a placeholder
  WAIT = 1, // further data received should not be processed (or transferred)
  WAIT_BUT_Q = 2, // further data received may be processed but must be queued until transferred (wait for resume)
  RESUME = 3, // further data received should be processed now and pipelined
  FLUSH = 4, // data received before should now be flushed (meaning it should be transferred when already processed)
  GAP = 5, // a time-plane discontinuity in this sync-id domain will arrive after this (this may also mean a lack of data for present processing)
  EOS = 6, // no more data will be transferred after this
  DROP = 7, // data received before (already processed or not) should be dropped (and thus not transferred)
  DROP_Q = 8, // data received before that was queued (not yet processed) should be dropped
  SYNC = 9 // after this, a new packet sync-id may appear (the symbolic packet SHOULD carry its value already)
}
