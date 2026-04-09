import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

import {
  DIAL_TILT_CENTER_RAD,
  DIAL_TILT_HALF_SPAN_RAD,
  HAND_SPREAD_RATIO_FIST,
  HAND_SPREAD_RATIO_OPEN,
} from './config'

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Openness 0–1: **closed fist → 0**, **fully open → 1** (right hand → volume).
 * Uses mean distance wrist→(index, middle, ring, pinky tips) / palm scale (wrist→middle MCP).
 */
export function fingerSpread01(hand: NormalizedLandmark[]): number {
  const wrist = hand[0]
  const midMcp = hand[9]
  const tips = [hand[8], hand[12], hand[16], hand[20]]
  if (!wrist || !midMcp || tips.some((t) => !t)) return 0
  const scale = dist(wrist, midMcp)
  if (scale < 1e-4) return 0
  let sum = 0
  for (const t of tips) sum += dist(wrist, t!)
  const raw = sum / (4 * scale)

  const lo = HAND_SPREAD_RATIO_FIST
  const hi = HAND_SPREAD_RATIO_OPEN
  if (hi <= lo) return 0
  return Math.min(1, Math.max(0, (raw - lo) / (hi - lo)))
}

/**
 * Left hand “dial”: palm direction from wrist → middle MCP. Twist **left** → lower tilt, **right** → higher.
 * `flipX` matches mirrored webcam preview so “left/right” feels natural.
 */
export function palmDialTilt01(hand: NormalizedLandmark[], flipX: boolean): number {
  const wrist = hand[0]
  const mid = hand[9]
  if (!wrist || !mid) return 0.5
  let dx = mid.x - wrist.x
  if (flipX) dx = -(mid.x - wrist.x)
  const dy = mid.y - wrist.y
  const angle = Math.atan2(dx, -dy)
  const lo = DIAL_TILT_CENTER_RAD - DIAL_TILT_HALF_SPAN_RAD
  const hi = DIAL_TILT_CENTER_RAD + DIAL_TILT_HALF_SPAN_RAD
  if (hi <= lo) return 0.5
  return Math.min(1, Math.max(0, (angle - lo) / (hi - lo)))
}
