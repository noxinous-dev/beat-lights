import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'

import {
  MIN_HANDEDNESS_SCORE,
  PINCH_CLOSE,
  PINCH_EMA_ALPHA,
  PINCH_OPEN,
} from './config'

const THUMB_TIP = 4
const INDEX_TIP = 8

function dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function hysteresis(distance: number, wasPinching: boolean): boolean {
  if (distance < PINCH_CLOSE) return true
  if (distance > PINCH_OPEN) return false
  return wasPinching
}

let emaLeft = 0.12
let emaRight = 0.12
let latchLeft = false
let latchRight = false

/** Per-hand thumb–index pinch with EMA smoothing + hysteresis (less jitter than raw threshold). */
export function pinchSidesFromResult(result: HandLandmarkerResult): { left: boolean; right: boolean } {
  let sawLeft = false
  let sawRight = false
  let left = false
  let right = false

  const { landmarks, handedness, handednesses } = result
  for (let i = 0; i < landmarks.length; i++) {
    const hand = landmarks[i]
    const cat = handedness[i]?.[0] ?? handednesses?.[i]?.[0]
    if (!hand?.length || !cat) continue
    if (MIN_HANDEDNESS_SCORE > 0 && (cat.score ?? 0) < MIN_HANDEDNESS_SCORE) continue

    const raw = (cat.categoryName || cat.displayName || '').trim().toLowerCase()
    if (raw !== 'left' && raw !== 'right') continue
    const side = raw as 'left' | 'right'

    const thumb = hand[THUMB_TIP]
    const index = hand[INDEX_TIP]
    if (!thumb || !index) continue

    const d = dist2D(thumb, index)
    if (side === 'left') {
      sawLeft = true
      emaLeft = PINCH_EMA_ALPHA * d + (1 - PINCH_EMA_ALPHA) * emaLeft
      latchLeft = hysteresis(emaLeft, latchLeft)
      left = latchLeft
    } else {
      sawRight = true
      emaRight = PINCH_EMA_ALPHA * d + (1 - PINCH_EMA_ALPHA) * emaRight
      latchRight = hysteresis(emaRight, latchRight)
      right = latchRight
    }
  }

  if (!sawLeft) {
    latchLeft = false
    emaLeft = 0.12
    left = false
  }
  if (!sawRight) {
    latchRight = false
    emaRight = 0.12
    right = false
  }

  return { left, right }
}
