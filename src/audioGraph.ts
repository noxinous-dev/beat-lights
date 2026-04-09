import {
  CONTROL_SMOOTH,
  TILT_HIGH_SHELF_HZ,
  TILT_LOW_SHELF_HZ,
  TILT_MAX_DB,
} from './config'

/**
 * Media element → tilt EQ (low + high shelf) → master gain → destination.
 */
export class AudioGraph {
  readonly ctx: AudioContext
  private readonly source: MediaElementAudioSourceNode
  readonly lowShelf: BiquadFilterNode
  readonly highShelf: BiquadFilterNode
  readonly gain: GainNode
  private volSmoothed = 0
  private tiltSmoothed = 0.5

  constructor(audio: HTMLAudioElement) {
    this.ctx = new AudioContext()
    this.source = this.ctx.createMediaElementSource(audio)

    this.lowShelf = this.ctx.createBiquadFilter()
    this.lowShelf.type = 'lowshelf'
    this.lowShelf.frequency.value = TILT_LOW_SHELF_HZ
    this.lowShelf.Q.value = 0.707
    this.lowShelf.gain.value = 0

    this.highShelf = this.ctx.createBiquadFilter()
    this.highShelf.type = 'highshelf'
    this.highShelf.frequency.value = TILT_HIGH_SHELF_HZ
    this.highShelf.Q.value = 0.707
    this.highShelf.gain.value = 0

    this.gain = this.ctx.createGain()
    this.gain.gain.value = 0

    this.source.connect(this.lowShelf)
    this.lowShelf.connect(this.highShelf)
    this.highShelf.connect(this.gain)
    this.gain.connect(this.ctx.destination)
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  /** Absolute volume 0–100 (right hand). */
  setVolumePercent(percent: number, t: number): void {
    const target = Math.min(1, Math.max(0, percent / 100))
    this.volSmoothed += (target - this.volSmoothed) * CONTROL_SMOOTH
    this.gain.gain.setTargetAtTime(this.volSmoothed, t, 0.04)
  }

  /**
   * Tilt 0–1 (left hand spread): 0 = warm, 0.5 = flat, 1 = bright.
   */
  setTilt01(tilt01: number, time: number): void {
    const target = Math.min(1, Math.max(0, tilt01))
    this.tiltSmoothed += (target - this.tiltSmoothed) * CONTROL_SMOOTH
    const u = this.tiltSmoothed * 2 - 1
    const lowDb = -u * TILT_MAX_DB
    const highDb = u * TILT_MAX_DB
    this.lowShelf.gain.setTargetAtTime(lowDb, time, 0.055)
    this.highShelf.gain.setTargetAtTime(highDb, time, 0.055)
  }

  getVolumeSmoothed(): number {
    return this.volSmoothed
  }

  /** 0 = warm, 0.5 = neutral, 1 = bright (smoothed). */
  getTiltSmoothed(): number {
    return this.tiltSmoothed
  }
}
