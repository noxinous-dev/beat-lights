/** Keep in sync with package.json `dependencies[@mediapipe/tasks-vision]`. */
export const MEDIAPIPE_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'

export const HAND_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/**
 * Pinch = thumb tip ↔ index tip distance in normalized image coords (0–1 scale).
 * Hysteresis: pinch starts when smoothed distance is below PINCH_CLOSE, ends when above PINCH_OPEN
 * (stops edge-flicker). Slightly tighter close = more deliberate pinch.
 */
export const PINCH_CLOSE = 0.052
export const PINCH_OPEN = 0.078
/** Higher = EMA catches up to true pinch faster (still smooth). */
export const PINCH_EMA_ALPHA = 0.58
/** 0 = don’t filter by handedness score; raise only if L/R mix-ups happen. */
export const MIN_HANDEDNESS_SCORE = 0

/** Accept pinch if within this many ms of a beat (wider = easier to hit). */
export const BEAT_WINDOW_MS = 280

/** How long a “light” stays visibly on after a hit. */
export const LIGHT_FLASH_MS = 520

/**
 * Hotspots as fractions of the photo (0–1).
 * left = behind tiger head, right = around rear legs/hindquarters.
 */
export const HOTSPOTS: ReadonlyArray<{
  id: string
  side: 'left' | 'right'
  left: number
  top: number
  width: number
  height: number
}> = [
  { id: 'left', side: 'left', left: 0.08, top: 0.30, width: 0.26, height: 0.48 },
  { id: 'right', side: 'right', left: 0.62, top: 0.30, width: 0.28, height: 0.48 },
]
