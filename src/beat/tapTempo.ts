/** Tap-to-tempo: BPM from recent taps; phase anchored on last tap. */
export class TapTempo {
  private tapTimesMs: number[] = []
  private anchorMs = 0
  private periodMs = 500

  recordTap(nowMs: number): void {
    this.tapTimesMs.push(nowMs)
    if (this.tapTimesMs.length > 8) this.tapTimesMs.shift()

    if (this.tapTimesMs.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < this.tapTimesMs.length; i++) {
        intervals.push(this.tapTimesMs[i] - this.tapTimesMs[i - 1])
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      this.periodMs = Math.max(200, Math.min(2000, avg))
    }

    this.anchorMs = nowMs
  }

  getPeriodMs(): number {
    return this.periodMs
  }

  getBpm(): number {
    return 60000 / this.periodMs
  }

  getTapCount(): number {
    return this.tapTimesMs.length
  }

  getPhaseMs(nowMs: number): number {
    const elapsed = nowMs - this.anchorMs
    const p = this.periodMs
    return ((elapsed % p) + p) % p
  }

  getBeatIndex(nowMs: number): number {
    const elapsed = nowMs - this.anchorMs
    return Math.floor(elapsed / this.periodMs)
  }

  distToNearestBeatMs(nowMs: number): number {
    const phase = this.getPhaseMs(nowMs)
    const p = this.periodMs
    return Math.min(phase, p - phase)
  }
}
