import { HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'

/**
 * Map normalized landmarks (0–1 of the decoded frame) to canvas pixels when the
 * video uses object-fit: contain (letterboxing inside the element).
 */
function toCanvas(
  lm: NormalizedLandmark,
  cw: number,
  ch: number,
  frameW: number,
  frameH: number,
): { x: number; y: number } {
  if (frameW < 2 || frameH < 2) {
    return { x: lm.x * cw, y: lm.y * ch }
  }
  const scale = Math.min(cw / frameW, ch / frameH)
  const dw = frameW * scale
  const dh = frameH * scale
  const ox = (cw - dw) / 2
  const oy = (ch - dh) / 2
  return {
    x: ox + lm.x * dw,
    y: oy + lm.y * dh,
  }
}

/** Draw hand skeleton + points. Pass videoWidth/Height from the HTMLVideoElement. */
export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  result: HandLandmarkerResult,
  frameW: number,
  frameH: number,
): void {
  const connections = HandLandmarker.HAND_CONNECTIONS

  for (let hi = 0; hi < result.landmarks.length; hi++) {
    const hand = result.landmarks[hi]
    if (!hand?.length) continue

    const cat = result.handedness[hi]?.[0] ?? result.handednesses?.[hi]?.[0]
    const raw = (cat?.categoryName || cat?.displayName || '').trim().toLowerCase()
    const hue = raw === 'left' ? 195 : 320
    const stroke = `hsla(${hue}, 95%, 58%, 0.95)`
    const fill = `hsla(${hue}, 100%, 70%, 1)`

    ctx.strokeStyle = stroke
    ctx.lineWidth = Math.max(2.5, cw * 0.006)
    ctx.lineCap = 'round'

    for (const c of connections) {
      const a = hand[c.start]
      const b = hand[c.end]
      if (!a || !b) continue
      const pA = toCanvas(a, cw, ch, frameW, frameH)
      const pB = toCanvas(b, cw, ch, frameW, frameH)
      ctx.beginPath()
      ctx.moveTo(pA.x, pA.y)
      ctx.lineTo(pB.x, pB.y)
      ctx.stroke()
    }

    const r = Math.max(3, cw * 0.008)
    ctx.fillStyle = fill
    for (const lm of hand) {
      const p = toCanvas(lm, cw, ch, frameW, frameH)
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
