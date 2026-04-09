/** Keep in sync with package.json `dependencies[@mediapipe/tasks-vision]`. */
export const MEDIAPIPE_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'

export const HAND_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Local track (served from /public). */
export const MUSIC_SRC = '/poster-boy.mp3'

/** EMA-style smoothing for volume / tilt (0–1 targets). */
export const CONTROL_SMOOTH = 0.18

/**
 * Hand open/closed (both hands): normalized spread ratio = mean(wrist→finger tips) / dist(wrist, middle MCP).
 * Fist → lower bound, full open → upper bound. Tune if 0%/100% don’t match your camera.
 */
export const HAND_SPREAD_RATIO_FIST = 1.06
export const HAND_SPREAD_RATIO_OPEN = 2.25

/**
 * Single-knob tilt: lowshelf + highshelf opposite gains (pivot-style tone).
 * Closed fist → warm (boost lows / cut highs); open → bright (cut lows / boost highs); mid = flat.
 */
export const TILT_LOW_SHELF_HZ = 400
export const TILT_HIGH_SHELF_HZ = 3200
/** Max ±dB per shelf at full fist / full open (0.5 = neutral). */
export const TILT_MAX_DB = 9

/**
 * Left-hand “dial”: `angle = atan2(dx, -dy)` from wrist → middle MCP.
 * **Upright, fingers-up** (natural rest) → angle ≈ **0** → **TLT 50%** (`DIAL_TILT_CENTER_RAD`).
 * Full **0–100%** sweep = **60°** total (±`DIAL_TILT_HALF_SPAN_RAD` from center).
 * Nudge `CENTER` if your “neutral” pose reads slightly off.
 */
export const DIAL_TILT_CENTER_RAD = 0
/** Half of full sweep (30° → 60° total). */
export const DIAL_TILT_HALF_SPAN_RAD = Math.PI / 6
