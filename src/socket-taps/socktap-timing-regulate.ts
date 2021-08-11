import { millisToSecs, secsToMillis, timeMillisSince } from "../common-utils";
import { Packet } from "../core/packet";
import { mixinSocketTapQueuedWithOpts } from "../core/socket-tap";
import { getLogger } from "../logger";

const { warn } = getLogger("socktap-timing-regulate");

const SocketTapQueuedWithOpts
  = mixinSocketTapQueuedWithOpts<SocketTapTimingRegulateOpts>({
  timingRegulationOn: false,
  timingRegulationSpeed: 1,
  timingRegulationSkipPrior: NaN,
  timingRegulationPollMs: 1000
});

export interface SocketTapTimingRegulateOpts {
  timingRegulationOn: boolean
  timingRegulationSpeed: number
  timingRegulationSkipPrior: number
  timingRegulationPollMs: number
}

export class SocketTapTimingRegulate extends SocketTapQueuedWithOpts {

  private _playOutDtsInSecs: number = NaN;
  private _playOutClockRef: number = NaN;
  private _pollTimer: number;

  constructor(opts?: Partial<SocketTapTimingRegulateOpts>) {
    super();
    this.setOptions(opts);
    this._onQueuePushed = this._pollQueue.bind(this);
  }

  pushPacket(p) {
    super.pushPacket(p);
    this._pollQueue();
    return false;
  }

  popPacket() {
    const pkt = super.popPacket();
    return pkt;
  }

  flush() {
    this._playOutDtsInSecs =
      this._playOutClockRef = NaN;
    super.flush();
  }

  private _pollQueue () {

    // optimized early return as we may poll periodically on empty queue
    // and avoids further checks in logic below
    if (!this._sockTapPushQueue.length) return;
    if (!this.options_.timingRegulationOn) {
      // transfer/flush whole queue
      this._sockTapPushQueue.forEach(this._enqueueOutPacket.bind(this));
      this._sockTapPushQueue.length = 0;
      this._playOutClockRef = Date.now();
    } else {

      const [playOutToWallClockDiff, now] = timeMillisSince(this._playOutClockRef);
      // initial condition setup
      if (!Number.isFinite(this._playOutDtsInSecs) || !Number.isFinite(this._playOutClockRef)) {
        this._enqueueOutPacket(this._sockTapPushQueue.shift());
        this._playOutClockRef = now;
      }

      const playSeconds = millisToSecs(playOutToWallClockDiff);
      const playRate = this.options_.timingRegulationSpeed;
      const playOutTicks = playRate * playSeconds;

      // pre: this._playOutDtsInSecs is positive integer
      const refDts = this._playOutDtsInSecs;
      const maxTransferOutDtsSecs = refDts + playOutTicks;

      let dtsCycled = false;
      while (this._sockTapPushQueue.length &&
        this._sockTapPushQueue[0].getNormalizedDts() <= maxTransferOutDtsSecs) {
        // post: DTS counter change
        this._enqueueOutPacket(this._sockTapPushQueue.shift());
        if (this._playOutDtsInSecs < refDts) {
          warn('Regulation-delay hit DTS rollover/discontinuity, resetting');
          dtsCycled = true;
          break;
        }
      }
      if (!dtsCycled) {
        this._playOutClockRef += secsToMillis(((this._playOutDtsInSecs - refDts) / playRate));
      } else {
        this._playOutClockRef = now;
      }
    }
    // reschedule if polling
    if (this.options_.timingRegulationPollMs > 0) {
      clearTimeout(this._pollTimer);
      this._pollTimer = setTimeout(() => {
        this._pollQueue();
      }, this.options_.timingRegulationPollMs) as unknown as number;
    }
  }

  private _enqueueOutPacket (pkt: Packet) {
    this._sockTapPopQueue.push(pkt);
    this._playOutDtsInSecs = pkt.getNormalizedDts();
    this.pull();
  }

}
