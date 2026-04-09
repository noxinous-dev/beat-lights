import './style.css'

import type { HandLandmarker, HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'

import { AudioGraph } from './audioGraph'
import { MUSIC_SRC } from './config'
import { fingerSpread01, palmDialTilt01 } from './gestureMetrics'
import { drawHandHudOverlay, TipTrailState } from './handHudOverlay'
import { createHandLandmarker } from './handLandmarker'
import { drawLeftTiltDial } from './leftTiltDial'

const video = document.querySelector<HTMLVideoElement>('#cam')!
const hudCanvas = document.querySelector<HTMLCanvasElement>('#hud')!
const startLayer = document.querySelector<HTMLDivElement>('#start')!
const startBtn = document.querySelector<HTMLButtonElement>('#start-btn')!
const volEl = document.querySelector<HTMLSpanElement>('#vol-readout')!
const tiltEl = document.querySelector<HTMLSpanElement>('#tilt-readout')!
const camStatus = document.querySelector<HTMLParagraphElement>('#cam-status')!

const audio = document.querySelector<HTMLAudioElement>('#music')!
audio.src = MUSIC_SRC
audio.loop = true

const frameCanvas = document.createElement('canvas')
const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true, alpha: false })
const hudCtx = hudCanvas.getContext('2d', { alpha: true })

const tipTrails = new TipTrailState()

let landmarker: HandLandmarker | null = null
let audioGraph: AudioGraph | null = null
let running = false
const mirrorVideo = true

function parseHands(result: HandLandmarkerResult): {
  leftLm: NormalizedLandmark[] | null
  rightLm: NormalizedLandmark[] | null
} {
  let leftLm: NormalizedLandmark[] | null = null
  let rightLm: NormalizedLandmark[] | null = null
  for (let i = 0; i < result.landmarks.length; i++) {
    const cat = result.handedness[i]?.[0] ?? result.handednesses?.[i]?.[0]
    const label = (cat?.categoryName || cat?.displayName || '').trim().toLowerCase()
    const hand = result.landmarks[i]
    if (!hand?.length) continue
    if (label === 'left') leftLm = hand
    if (label === 'right') rightLm = hand
  }
  return { leftLm, rightLm }
}

function resizeHud(): void {
  if (!hudCtx) return
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
  hudCanvas.width = w * dpr
  hudCanvas.height = h * dpr
  hudCanvas.style.width = `${w}px`
  hudCanvas.style.height = `${h}px`
  hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

async function startCamera(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  video.srcObject = stream
  await video.play()
  camStatus.textContent = 'Camera on'
}

function loop(): void {
  requestAnimationFrame(loop)

  if (!running || !landmarker || !audioGraph) return
  if (video.readyState < 2 || video.videoWidth < 2) return

  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!frameCtx || !hudCtx) return
  if (frameCanvas.width !== vw) frameCanvas.width = vw
  if (frameCanvas.height !== vh) frameCanvas.height = vh
  frameCtx.drawImage(video, 0, 0, vw, vh)

  let result: HandLandmarkerResult
  try {
    result = landmarker.detect(frameCanvas)
  } catch {
    return
  }

  const { leftLm, rightLm } = parseHands(result)
  const t = audioGraph.ctx.currentTime

  if (rightLm) {
    const volPct = Math.round(fingerSpread01(rightLm) * 100)
    audioGraph.setVolumePercent(volPct, t)
  }

  if (leftLm) {
    const tilt01 = palmDialTilt01(leftLm, mirrorVideo)
    audioGraph.setTilt01(tilt01, t)
  }

  volEl.textContent = String(Math.round(audioGraph.getVolumeSmoothed() * 100))
  tiltEl.textContent = String(Math.round(audioGraph.getTiltSmoothed() * 100))

  const time = performance.now() * 0.001
  const cw = window.innerWidth
  const ch = window.innerHeight

  hudCtx.clearRect(0, 0, cw, ch)

  if (result.landmarks.length > 0) {
    drawHandHudOverlay(hudCtx, cw, ch, result, vw, vh, mirrorVideo, tipTrails, time)
  }

  if (!leftLm) tipTrails.clearSide('left')
  if (!rightLm) tipTrails.clearSide('right')

  if (leftLm) {
    drawLeftTiltDial(hudCtx, cw, ch, leftLm, vw, vh, mirrorVideo, audioGraph.getTiltSmoothed(), time)
  }
}

async function boot(): Promise<void> {
  resizeHud()
  window.addEventListener('resize', resizeHud)

  try {
    await startCamera()
  } catch (e) {
    camStatus.textContent = 'Camera blocked — allow access to continue.'
    console.error(e)
    return
  }

  try {
    landmarker = await createHandLandmarker()
  } catch (e) {
    camStatus.textContent = 'Hand model failed to load.'
    console.error(e)
    return
  }

  startBtn.addEventListener('click', async () => {
    audioGraph = new AudioGraph(audio)
    await audioGraph.resume()
    try {
      await audio.play()
    } catch {
      // still allow FX if autoplay blocked
    }
    startLayer.hidden = true
    running = true
  })

  requestAnimationFrame(loop)
}

boot()
