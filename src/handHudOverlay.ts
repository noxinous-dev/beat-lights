import { HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'

const connections = HandLandmarker.HAND_CONNECTIONS
const TIP = new Set([4, 8, 12, 16, 20])
/** Same order as T(1)…T(5) — thumb … pinky. */
const TIP_INDICES: readonly number[] = [4, 8, 12, 16, 20]

/** MediaPipe tip index → finger 1–5 (thumb … pinky). */
const TIP_FINGER: Record<number, number> = {
  4: 1,
  8: 2,
  12: 3,
  16: 4,
  20: 5,
}

function landmarkLabelText(i: number): string {
  if (TIP.has(i)) {
    const n = TIP_FINGER[i]
    return n != null ? `T(${n})` : String(i)
  }
  return String(i)
}

/** Map normalized landmark → overlay CSS pixels (object-fit: cover), mirrored X when `flipX`. */
export function landmarkToScreen(
  lm: NormalizedLandmark,
  cw: number,
  ch: number,
  frameW: number,
  frameH: number,
  flipX: boolean,
): { x: number; y: number } {
  if (frameW < 2 || frameH < 2) {
    let x = lm.x * cw
    if (flipX) x = cw - x
    return { x, y: lm.y * ch }
  }
  const scale = Math.max(cw / frameW, ch / frameH)
  const dw = frameW * scale
  const dh = frameH * scale
  const ox = (cw - dw) / 2
  const oy = (ch - dh) / 2
  let x = ox + lm.x * dw
  if (flipX) x = cw - x
  return { x, y: oy + lm.y * dh }
}

export type HudColors = { line: string; node: string; tip: string; label: string; labelStroke: string }

function colorsForSide(side: 'left' | 'right'): HudColors {
  if (side === 'left') {
    return {
      line: 'rgba(34, 211, 238, 0.55)',
      node: 'rgba(34, 211, 238, 0.92)',
      tip: 'rgba(125, 250, 230, 0.98)',
      label: 'rgba(240, 253, 255, 0.95)',
      labelStroke: 'rgba(2, 12, 24, 0.82)',
    }
  }
  return {
    line: 'rgba(232, 121, 249, 0.55)',
    node: 'rgba(232, 121, 249, 0.9)',
    tip: 'rgba(255, 180, 255, 0.98)',
    label: 'rgba(253, 244, 255, 0.95)',
    labelStroke: 'rgba(12, 6, 18, 0.82)',
  }
}

/** Lightweight fingertip motion trails (readability-first). */
export class TipTrailState {
  private readonly buf = new Map<string, { x: number; y: number }[]>()
  private readonly max = 5

  clearSide(side: 'left' | 'right'): void {
    for (const k of [...this.buf.keys()]) {
      if (k.startsWith(`${side}:`)) this.buf.delete(k)
    }
  }

  push(side: 'left' | 'right', idx: number, x: number, y: number): void {
    if (!TIP.has(idx)) return
    const k = `${side}:${idx}`
    let a = this.buf.get(k)
    if (!a) {
      a = []
      this.buf.set(k, a)
    }
    a.push({ x, y })
    while (a.length > this.max) a.shift()
  }

  draw(ctx: CanvasRenderingContext2D, side: 'left' | 'right', idx: number, color: string): void {
    const k = `${side}:${idx}`
    const a = this.buf.get(k)
    if (!a || a.length < 2) return
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.14
    ctx.beginPath()
    ctx.moveTo(a[0]!.x, a[0]!.y)
    for (let i = 1; i < a.length; i++) ctx.lineTo(a[i]!.x, a[i]!.y)
    ctx.stroke()
    ctx.restore()
  }

}

function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  labelText: string,
  isTip: boolean,
  c: HudColors,
): void {
  const r = isTip ? 4.2 : 3.1
  ctx.save()
  ctx.shadowColor = isTip ? c.tip : c.node
  ctx.shadowBlur = isTip ? 10 : 7
  ctx.fillStyle = isTip ? c.tip : c.node
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 0.85
  ctx.stroke()

  const tx = x + 6
  const ty = y - 5
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.lineWidth = 2.5
  ctx.strokeStyle = c.labelStroke
  ctx.strokeText(labelText, tx, ty)
  ctx.fillStyle = c.label
  ctx.fillText(labelText, tx, ty)
  ctx.restore()
}

/** Cyan (left HUD) + pink (right HUD), blended. */
const LINK_MIX_R = Math.round((34 + 232) / 2)
const LINK_MIX_G = Math.round((211 + 121) / 2)
const LINK_MIX_B = Math.round((238 + 249) / 2)
/** 25% less opaque → multiply prior alphas by 0.75 */
const LINK_OPACITY = 0.75

/** Light link between the same fingertip on left vs right (index↔index, etc.). */
function drawCrossHandFingertipLinks(
  ctx: CanvasRenderingContext2D,
  leftPts: { x: number; y: number }[],
  rightPts: { x: number; y: number }[],
  time: number,
): void {
  const pulse = 0.92 + Math.sin(time * 1.8) * 0.08
  const o = LINK_OPACITY
  for (const idx of TIP_INDICES) {
    const a = leftPts[idx]
    const b = rightPts[idx]
    if (!a || !b) continue

    ctx.save()
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.38 * pulse * o
    ctx.strokeStyle = `rgba(${LINK_MIX_R}, ${LINK_MIX_G}, ${LINK_MIX_B}, 0.55)`
    ctx.lineWidth = 3.2
    ctx.shadowColor = `rgba(${LINK_MIX_R + 10}, ${LINK_MIX_G + 15}, ${LINK_MIX_B}, ${0.45 * o})`
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.globalAlpha = 0.62 * pulse * o
    ctx.strokeStyle = `rgba(${Math.min(255, LINK_MIX_R + 45)}, ${Math.min(255, LINK_MIX_G + 35)}, 255, 0.72)`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.restore()
  }
}

/** Thin connection with slight curve + soft under-glow (still readable). */
function drawConnection(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  lineColor: string,
  alt: number,
): void {
  const mx = (ax + bx) * 0.5
  const my = (ay + by) * 0.5
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const px = (-dy / len) * 3 * alt
  const py = (dx / len) * 3 * alt
  const cx = mx + px
  const cy = my + py

  ctx.save()
  ctx.strokeStyle = lineColor
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.globalAlpha = 0.2
  ctx.lineWidth = 4
  ctx.shadowColor = lineColor
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(cx, cy, bx, by)
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.globalAlpha = 0.75
  ctx.lineWidth = 1.15
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(cx, cy, bx, by)
  ctx.stroke()
  ctx.restore()
}

/**
 * Transparent HUD: hands only. Does not clear the canvas (caller clears).
 * Fingertips use T(1)…T(5) (thumb→pinky); other joints keep index 0–20.
 */
export function drawHandHudOverlay(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  result: HandLandmarkerResult,
  frameW: number,
  frameH: number,
  flipX: boolean,
  trails: TipTrailState,
  time: number,
): void {
  type View = { side: 'left' | 'right'; pts: { x: number; y: number }[]; c: HudColors }
  const views: View[] = []

  for (let hi = 0; hi < result.landmarks.length; hi++) {
    const hand = result.landmarks[hi]
    if (!hand?.length) continue
    const cat = result.handedness[hi]?.[0] ?? result.handednesses?.[hi]?.[0]
    const label = (cat?.categoryName || cat?.displayName || '').trim().toLowerCase()
    const side: 'left' | 'right' = label === 'left' ? 'left' : 'right'
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < hand.length; i++) {
      pts.push(landmarkToScreen(hand[i]!, cw, ch, frameW, frameH, flipX))
    }
    views.push({ side, pts, c: colorsForSide(side) })
  }

  const left = views.find((v) => v.side === 'left')
  const right = views.find((v) => v.side === 'right')
  if (left && right) {
    drawCrossHandFingertipLinks(ctx, left.pts, right.pts, time)
  }

  for (const { side, pts, c } of views) {
    for (const conn of connections) {
      const a = pts[conn.start]
      const b = pts[conn.end]
      if (!a || !b) continue
      drawConnection(ctx, a.x, a.y, b.x, b.y, c.line, conn.start % 2 === 0 ? 1 : -1)
    }

    for (const idx of TIP) {
      const p = pts[idx]
      if (p) trails.draw(ctx, side, idx, c.line)
    }

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      if (TIP.has(i)) trails.push(side, i, p.x, p.y)
      const pulse = 0.96 + Math.sin(time * 2.4 + i * 0.15) * 0.04
      drawNode(ctx, p.x, p.y, landmarkLabelText(i), TIP.has(i), c)
      if (TIP.has(i)) {
        ctx.save()
        ctx.globalAlpha = 0.12 * pulse
        ctx.fillStyle = c.tip
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5.5 * pulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
  }
}

