import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

import { HAND_LANDMARKER_MODEL, MEDIAPIPE_WASM_BASE } from './config'

export async function createHandLandmarker(): Promise<HandLandmarker> {
  /** `false` = classic WASM scripts. `true` (ESM) breaks in some browsers with import.meta outside a module. */
  const wasm = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE, false)

  const tryCreate = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: HAND_LANDMARKER_MODEL,
        delegate,
      },
      /** IMAGE + detect(video) is more reliable across browsers than VIDEO + detectForVideo timestamps. */
      runningMode: 'IMAGE',
      numHands: 2,
      minHandDetectionConfidence: 0.32,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    })

  try {
    return await tryCreate('GPU')
  } catch {
    return await tryCreate('CPU')
  }
}
