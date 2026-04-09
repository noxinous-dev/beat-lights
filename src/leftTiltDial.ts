import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

import { landmarkToScreen } from './handHudOverlay'

/**
 * Tilt “knob” centered on the left palm — rotates with tilt so it feels turned in-hand.
 */
export function drawLeftTiltDial(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  hand: NormalizedLandmark[],
  frameW: number,
  frameH: number,
  flipX: boolean,
  tilt01: number,
  time: number,
): void {
  const wrist = hand[0]
  const mid = hand[9]
  if (!wrist || !mid) return

  const pW = landmarkToScreen(wrist, cw, ch, frameW, frameH, flipX)
  const pM = landmarkToScreen(mid, cw, ch, frameW, frameH, flipX)
  const palm = pM

  const handSpan = Math.hypot(pM.x - pW.x, pM.y - pW.y)
  const minR = Math.min(cw, ch) * 0.052
  const maxR = Math.min(cw, ch) * 0.11
  const R = Math.min(maxR, Math.max(minR, handSpan * 0.52))

  const cx = palm.x
  const cy = palm.y

  let dx = pM.x - pW.x
  let dy = pM.y - pW.y
  const len = Math.hypot(dx, dy) || 1
  dx /= len
  dy /= len

  const baseRot = Math.atan2(dy, dx)
  const tiltRot = (tilt01 - 0.5) * Math.PI * 1.1
  const spin = time * 0.35

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(baseRot + tiltRot)

  const segments = 28
  const gap = 0.09
  const step = (Math.PI * 2) / segments

  // Soft knob base on the palm (readability + depth)
  const baseGrad = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R * 1.05)
  baseGrad.addColorStop(0, 'rgba(165, 250, 255, 0.22)')
  baseGrad.addColorStop(0.45, 'rgba(34, 211, 238, 0.12)')
  baseGrad.addColorStop(1, 'rgba(34, 211, 238, 0)')
  ctx.fillStyle = baseGrad
  ctx.beginPath()
  ctx.arc(0, 0, R * 1.12, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = 'rgba(34, 211, 238, 0.95)'
  ctx.shadowBlur = 12
  ctx.strokeStyle = 'rgba(200, 250, 255, 0.75)'
  ctx.lineWidth = 1.65
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0

  for (let i = 0; i < segments; i++) {
    const a0 = i * step + gap * 0.5
    const a1 = a0 + step - gap
    ctx.beginPath()
    ctx.arc(0, 0, R, a0, a1)
    ctx.strokeStyle = `rgba(180, 245, 255, ${0.42 + (i % 3 === 0 ? 0.28 : 0)})`
    ctx.lineWidth = 1.25
    ctx.stroke()
  }

  const tickR = R * 0.82
  ctx.shadowColor = 'rgba(120, 240, 255, 0.7)'
  ctx.shadowBlur = 6
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + spin
    const tlen = i % 4 === 0 ? 5.5 : 2.8
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(230, 255, 255, 0.88)' : 'rgba(180, 240, 255, 0.65)'
    ctx.lineWidth = i % 4 === 0 ? 1.15 : 0.7
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * tickR, Math.sin(a) * tickR)
    ctx.lineTo(Math.cos(a) * (tickR - tlen), Math.sin(a) * (tickR - tlen))
    ctx.stroke()
  }
  ctx.shadowBlur = 0

  const arcStart = -Math.PI * 0.55
  const arcLen = Math.PI * 1.1 * tilt01
  ctx.shadowColor = 'rgba(94, 234, 212, 0.95)'
  ctx.shadowBlur = 10
  ctx.strokeStyle = 'rgba(204, 255, 251, 0.92)'
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.92, arcStart, arcStart + arcLen)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Center cap — reads as the part you “grab”
  ctx.fillStyle = 'rgba(220, 253, 255, 0.35)'
  ctx.strokeStyle = 'rgba(200, 250, 255, 0.85)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.22, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.rotate(-baseRot - tiltRot)
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = 'rgba(240, 253, 255, 0.92)'
  ctx.shadowColor = 'rgba(0, 30, 40, 0.9)'
  ctx.shadowBlur = 4
  ctx.textAlign = 'center'
  ctx.fillText('TLT', 0, R * 1.38)
  ctx.shadowBlur = 0

  ctx.restore()
}
