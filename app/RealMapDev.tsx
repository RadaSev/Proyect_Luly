"use client"
// ══════════════════════════════════════════════════════════════
//  RealMapDev — Mapa realista miniaturizado (solo DEV / PC)
//  Recibe un drawFn que page.tsx provee con acceso al estado del
//  juego; este componente sólo gestiona el canvas y el bucle RAF.
// ══════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react"

export type RealMapDrawFn = (ctx: CanvasRenderingContext2D) => void

interface RealMapDevProps {
  visible: boolean
  drawFn: RealMapDrawFn
}

const MAP_W = 1050
const MAP_H = 600

export default function RealMapDev({ visible, drawFn }: RealMapDevProps) {
  const cvRef  = useRef<HTMLCanvasElement>(null)
  // Siempre la versión más reciente del drawFn (sin restart del RAF)
  const fnRef  = useRef<RealMapDrawFn>(drawFn)
  fnRef.current = drawFn

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
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={cvRef}
        width={MAP_W}
        height={MAP_H}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
      />
    </div>
  )
}
