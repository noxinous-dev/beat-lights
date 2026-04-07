import './style.css'

import type { HandLandmarker, HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'

import { HOTSPOTS, LIGHT_FLASH_MS } from './config'
import { createHandLandmarker } from './handLandmarker'
import { DEFAULT_SOUNDCLOUD_TRACK, soundcloudPlayerSrc } from './soundcloud'
import { drawHandOverlay } from './drawHands'

const video = document.querySelector<HTMLVideoElement>('#cam')!
const camStatus = document.querySelector<HTMLParagraphElement>('#cam-status')!
const handCountEl = document.querySelector<HTMLParagraphElement>('#hand-count')!
const hotspotsRoot = document.querySelector<HTMLDivElement>('#hotspots')!
const photoWrap = document.querySelector<HTMLDivElement>('.photo-wrap')!
const gestureKeyEls = document.querySelectorAll<HTMLElement>('[data-gesture-key]')
const perfList = document.querySelector<HTMLDivElement>('#perf-list')!
const clearLogBtn = document.querySelector<HTMLButtonElement>('#clear-log')!
const songLabel = document.querySelector<HTMLParagraphElement>('#song-label')!
const photoBg = document.querySelector<HTMLImageElement>('#photo-bg')!
const photoFg = document.querySelector<HTMLImageElement>('#photo-fg')!
const soundcloudEmbed = document.querySelector<HTMLIFrameElement>('#soundcloud-embed')!
const handsCanvas = document.querySelector<HTMLCanvasElement>('#hands-canvas')!
const handsCtx = handsCanvas.getContext('2d', { alpha: true })!

/** Hidden canvas: some browsers don’t feed the video element reliably into MediaPipe; a frame copy works. */
const frameCanvas = document.createElement('canvas')
const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true, alpha: false })

let landmarker: HandLandmarker | null = null
let prevLeftGesture: GestureName = 'other'
let prevRightGesture: GestureName = 'other'
let handDetectError = ''
let sessionStartMs = performance.now()
let activeCombo: ComboName = 'none'
let blackoutTimer = 0

type HandSide = 'left' | 'right'
type GestureName = 'pinch' | 'open' | 'point' | 'other'
type ComboName = 'dual-pinch' | 'dual-open' | 'dual-point' | 'none'
type KeyName = GestureName | ComboName
type LogEntry = { t: number; event: string }

const LOG_STORE_PREFIX = 'beat-lights-log::'
const currentTrack = DEFAULT_SOUNDCLOUD_TRACK
const logStorageKey = `${LOG_STORE_PREFIX}${currentTrack}`

function setStatus(_message: string): void {
  // Intentionally no-op: bottom status text has been removed from the UI.
}

function flashEl(el: HTMLElement): void {
  el.classList.add('lit')
  const prev = el.dataset.flashTimer
  if (prev) window.clearTimeout(Number(prev))
  const id = window.setTimeout(() => {
    el.classList.remove('lit')
    delete el.dataset.flashTimer
  }, LIGHT_FLASH_MS)
  el.dataset.flashTimer = String(id)
}

function flashSide(side: HandSide): void {
  const id = HOTSPOTS.find((h) => h.side === side)?.id
  if (!id) return
  const el = hotspotsRoot.querySelector<HTMLElement>(`[data-hotspot="${id}"]`)
  if (el) flashEl(el)
}

function buildHotspots(): void {
  for (const h of HOTSPOTS) {
    const div = document.createElement('div')
    div.className = 'hotspot'
    div.dataset.hotspot = h.id
    div.dataset.side = h.side
    div.style.left = `${h.left * 100}%`
    div.style.top = `${h.top * 100}%`
    div.style.width = `${h.width * 100}%`
    div.style.height = `${h.height * 100}%`
    div.title = `${h.side} light`
    hotspotsRoot.appendChild(div)
  }
}

function setActiveGesture(gesture: KeyName): void {
  for (const el of gestureKeyEls) {
    el.classList.toggle('active', el.dataset.gestureKey === gesture)
  }
}

function triggerStrobe(side: HandSide): void {
  flashSide(side)
  window.setTimeout(() => flashSide(side), 90)
  window.setTimeout(() => flashSide(side), 180)
}

function setContinuousWash(active: boolean): void {
  hotspotsRoot.classList.toggle('wash-continuous', active)
}

function triggerBlackoutPulse(): void {
  hotspotsRoot.classList.add('blackout')
  if (blackoutTimer) window.clearTimeout(blackoutTimer)
  blackoutTimer = window.setTimeout(() => hotspotsRoot.classList.remove('blackout'), 520)
}

function triggerSweep(side: HandSide): void {
  const beam = document.createElement('div')
  beam.className = `sweep-light ${side}`
  hotspotsRoot.appendChild(beam)
  window.setTimeout(() => beam.remove(), 760)
}

function tipClose(a: NormalizedLandmark, b: NormalizedLandmark, threshold: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < threshold
}

function fingerExtended(tip: NormalizedLandmark, pip: NormalizedLandmark): boolean {
  return tip.y < pip.y
}

function classifyGesture(hand: NormalizedLandmark[]): GestureName {
  const thumb = hand[4]
  const indexTip = hand[8]
  const indexPip = hand[6]
  const middleTip = hand[12]
  const middlePip = hand[10]
  const ringTip = hand[16]
  const ringPip = hand[14]
  const pinkyTip = hand[20]
  const pinkyPip = hand[18]
  if (!thumb || !indexTip || !indexPip || !middleTip || !middlePip || !ringTip || !ringPip || !pinkyTip || !pinkyPip) {
    return 'other'
  }

  if (tipClose(thumb, indexTip, 0.058)) return 'pinch'
  const indexUp = fingerExtended(indexTip, indexPip)
  const middleUp = fingerExtended(middleTip, middlePip)
  const ringUp = fingerExtended(ringTip, ringPip)
  const pinkyUp = fingerExtended(pinkyTip, pinkyPip)

  if (indexUp && middleUp && ringUp && pinkyUp) return 'open'
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'point'
  return 'other'
}

function handSideFromResult(result: HandLandmarkerResult, idx: number): HandSide | null {
  const cat = result.handedness[idx]?.[0] ?? result.handednesses?.[idx]?.[0]
  const label = (cat?.categoryName || cat?.displayName || '').trim().toLowerCase()
  if (label === 'left' || label === 'right') return label
  return null
}

function triggerGesture(side: HandSide, gesture: GestureName): void {
  if (gesture === 'other') return
  setActiveGesture(gesture)
  if (gesture === 'pinch') triggerStrobe(side)
  else if (gesture === 'open') setContinuousWash(true)
  else triggerSweep(side)
}

function triggerCombo(combo: ComboName): void {
  if (combo === 'none') return
  setActiveGesture(combo)
  if (combo === 'dual-pinch') {
    triggerStrobe('left')
    window.setTimeout(() => triggerStrobe('right'), 70)
  } else if (combo === 'dual-open') {
    triggerBlackoutPulse()
  } else if (combo === 'dual-point') {
    triggerSweep('left')
    triggerSweep('right')
  }
}

function detectCombo(leftGesture: GestureName, rightGesture: GestureName): ComboName {
  if (leftGesture === 'pinch' && rightGesture === 'pinch') return 'dual-pinch'
  if (leftGesture === 'open' && rightGesture === 'open') return 'dual-open'
  if (leftGesture === 'point' && rightGesture === 'point') return 'dual-point'
  return 'none'
}

function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function loadLog(): LogEntry[] {
  try {
    const raw = window.localStorage.getItem(logStorageKey)
    if (!raw) return []
    const data = JSON.parse(raw) as LogEntry[]
    return Array.isArray(data) ? data.slice(-80) : []
  } catch {
    return []
  }
}

function saveLog(entries: LogEntry[]): void {
  window.localStorage.setItem(logStorageKey, JSON.stringify(entries.slice(-80)))
}

function renderLog(): void {
  const entries = loadLog()
  if (!entries.length) {
    perfList.innerHTML = '<p class="perf-empty">No gestures recorded yet.</p>'
    return
  }
  perfList.innerHTML = entries
    .slice()
    .reverse()
    .map((e) => `<div class="perf-item"><span>${fmtElapsed(e.t)}</span><strong>${e.event}</strong></div>`)
    .join('')
}

function recordEvent(event: string): void {
  const entries = loadLog()
  entries.push({ t: performance.now() - sessionStartMs, event })
  saveLog(entries)
  renderLog()
}

function setupSoundcloud(): void {
  soundcloudEmbed.src = soundcloudPlayerSrc(DEFAULT_SOUNDCLOUD_TRACK)
}

function setupPhoto(): void {
  // Optional split-layer mode:
  // - /public/photo-bg.png (background plate)
  // - /public/tiger-foreground.png (transparent tiger cutout)
  // Missing assets gracefully fall back to legacy single-image mode.
  photoBg.src = '/photo-bg.png'
  photoBg.onerror = () => {
    photoFg.hidden = true
    photoWrap.classList.remove('split-active')
    photoBg.onerror = () => {
      photoBg.onerror = () => {
        photoBg.onerror = null
        photoBg.src = '/photo.svg'
      }
      photoBg.src = '/photo.jpg'
    }
    photoBg.src = '/photo.png'
  }

  photoFg.hidden = true
  photoFg.src = '/tiger-foreground.png'
  photoFg.onload = () => {
    photoFg.hidden = false
    photoWrap.classList.add('split-active')
  }
  photoFg.onerror = () => {
    photoFg.hidden = true
    photoWrap.classList.remove('split-active')
  }
}

async function startCamera(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 }, height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    })
    video.srcObject = stream
    await video.play()
    camStatus.textContent = 'Camera on'
  } catch (e) {
    camStatus.textContent = 'Camera blocked or unavailable — allow access to continue.'
    console.error(e)
    throw e
  }
}

function updateMetrics(): void {
  if (handDetectError) {
    setStatus(handDetectError)
  }
}

function setHandCountDisplay(value: string): void {
  handCountEl.textContent = `Hands: ${value}`
}

/** Transparent skeleton overlay; the live picture comes from the video element underneath. */
function renderHandOverlay(result: HandLandmarkerResult): void {
  const rect = video.getBoundingClientRect()
  const cw = Math.max(1, Math.round(rect.width))
  const ch = Math.max(1, Math.round(rect.height))
  if (cw < 8 || ch < 8) return

  if (handsCanvas.width !== cw || handsCanvas.height !== ch) {
    handsCanvas.width = cw
    handsCanvas.height = ch
  }

  handsCtx.clearRect(0, 0, cw, ch)
  const fw = video.videoWidth
  const fh = video.videoHeight
  drawHandOverlay(handsCtx, cw, ch, result, fw, fh)
}

function loop(): void {
  requestAnimationFrame(loop)

  if (!landmarker || video.readyState < 2) {
    setHandCountDisplay('—')
    updateMetrics()
    return
  }
  if (video.videoWidth < 2) {
    setHandCountDisplay('—')
    updateMetrics()
    return
  }

  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!frameCtx || vw < 2 || vh < 2) {
    setHandCountDisplay('—')
    updateMetrics()
    return
  }
  if (frameCanvas.width !== vw) frameCanvas.width = vw
  if (frameCanvas.height !== vh) frameCanvas.height = vh
  frameCtx.drawImage(video, 0, 0, vw, vh)

  let result: HandLandmarkerResult
  try {
    result = landmarker.detect(frameCanvas)
    handDetectError = ''
  } catch (e) {
    handDetectError = 'hand model error'
    console.error(e)
    setHandCountDisplay('error')
    updateMetrics()
    return
  }

  setHandCountDisplay(String(result.landmarks.length))

  renderHandOverlay(result)

  let leftGesture: GestureName = 'other'
  let rightGesture: GestureName = 'other'
  for (let i = 0; i < result.landmarks.length; i++) {
    const side = handSideFromResult(result, i)
    if (!side) continue
    const gesture = classifyGesture(result.landmarks[i] ?? [])
    if (side === 'left') leftGesture = gesture
    else rightGesture = gesture
  }

  const combo = detectCombo(leftGesture, rightGesture)
  if (combo !== 'none') {
    if (combo !== activeCombo) {
      triggerCombo(combo)
      recordEvent(combo)
    }
    activeCombo = combo
  } else {
    activeCombo = 'none'
    if (leftGesture !== prevLeftGesture) {
      triggerGesture('left', leftGesture)
      if (leftGesture !== 'other') recordEvent(`left ${leftGesture}`)
    }
    if (rightGesture !== prevRightGesture) {
      triggerGesture('right', rightGesture)
      if (rightGesture !== 'other') recordEvent(`right ${rightGesture}`)
    }
  }
  const openNow = leftGesture === 'open' || rightGesture === 'open'
  setContinuousWash(openNow)
  if (leftGesture === 'other' && rightGesture === 'other' && combo === 'none') setActiveGesture('other')
  prevLeftGesture = leftGesture
  prevRightGesture = rightGesture

  updateMetrics()
}

async function boot(): Promise<void> {
  setupSoundcloud()
  setupPhoto()
  buildHotspots()
  songLabel.textContent = `Track: ${new URL(currentTrack).pathname.split('/').filter(Boolean).slice(-1)[0] ?? 'unknown'}`
  renderLog()
  clearLogBtn.addEventListener('click', () => {
    window.localStorage.removeItem(logStorageKey)
    renderLog()
  })
  setStatus('Loading hand model…')

  try {
    await Promise.all([startCamera(), createHandLandmarker().then((lm) => (landmarker = lm))])
    setStatus('Ready — pinch thumb + index to trigger lights.')
  } catch {
    setStatus('Hand tracking failed to load. Check network (model download) and reload.')
    return
  }

  requestAnimationFrame(loop)
}

boot()
