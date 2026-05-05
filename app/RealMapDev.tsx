"use client"
// ══════════════════════════════════════════════════════════════
//  RealMapDev — Mapa realista miniaturizado (solo DEV / PC)
//  Recibe un drawFn que page.tsx provee con acceso al estado del
//  juego; este componente sólo gestiona el canvas y el bucle RAF.
//  onSwipe(dir): +1 = deslizar hacia arriba (sección inferior),
//               -1 = deslizar hacia abajo  (sección superior)
// ══════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react"

export type RealMapDrawFn = (ctx: CanvasRenderingContext2D) => void

interface RealMapDevProps {
  visible: boolean
  drawFn: RealMapDrawFn
  onSwipe?: (dir: 1 | -1) => void
}

const MAP_W = 1050
const MAP_H = 600

export default function RealMapDev({ visible, drawFn, onSwipe }: RealMapDevProps) {
  const cvRef    = useRef<HTMLCanvasElement>(null)
  // Siempre la versión más reciente del drawFn/onSwipe (sin restart del RAF)
  const fnRef    = useRef<RealMapDrawFn>(drawFn)
  const swipeRef = useRef<typeof onSwipe>(onSwipe)
  fnRef.current    = drawFn
  swipeRef.current = onSwipe

  // ── RAF loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return
    const canvas = cvRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    const loop = () => {
      ctx.clearRect(0, 0, MAP_W, MAP_H)
      fnRef.current(ctx)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  // ── Swipe touch: deslizar arriba (+1 = sección inferior),
  //                deslizar abajo  (-1 = sección superior)
  useEffect(() => {
    if (!visible) return
    const canvas = cvRef.current
    if (!canvas) return

    let touchStartY = 0
    const SWIPE_MIN = 50   // px mínimos para considerar swipe

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }
    const onTouchEnd = (e: TouchEvent) => {
      const dy = e.changedTouches[0].clientY - touchStartY
      if (Math.abs(dy) < SWIPE_MIN) return
      swipeRef.current?.(dy < 0 ? 1 : -1)
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: true })
    canvas.addEventListener("touchend",   onTouchEnd,   { passive: true })
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchend",   onTouchEnd)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 950,
        background: "rgba(0,0,0,0.97)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",   // necesita recibir touch para swipe
        touchAction: "none",
      }}
    >
      <canvas
        ref={cvRef}
        width={MAP_W}
        height={MAP_H}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated", touchAction: "none" }}
      />
    </div>
  )
}
