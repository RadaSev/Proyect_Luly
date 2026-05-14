// ══════════════════════════════════════════════════════════════
//  CHECKPOINTS — game/checkpoints.ts
//  isBossCPUnlocked, spawnBossCPReward, tickCheckpoints
// ══════════════════════════════════════════════════════════════
import type { G, CPDef } from "./types"
import { STEP, CW, CH, TOT_W, TOT_H, PW, PH, CP_RADIUS } from "./constants"
import { ALL_CPS } from "./world_gen"
import { isPart1BossDead, isPart2BossDead, isUltraBossDead } from "./physics"
import { spawnExplosion, triggerShake } from "./utils"
import { saveGame } from "./save"

// Comprueba si el boss de un CP de boss está muerto
export function isBossCPUnlocked(g: G, cp: CPDef): boolean {
  if (!cp.bossKind) return true
  const w = cp.w
  if (cp.bossKind === "p1")    return isPart1BossDead(g, w)
  if (cp.bossKind === "p2")    return isPart2BossDead(g, w)
  if (cp.bossKind === "ultra") return isUltraBossDead(g, w)
  return false
}

// Spawn de recompensa al activar CP de boss por primera vez
export function spawnBossCPReward(g: G, cp: CPDef) {
  const cx = cp.x + PW / 2, cy = cp.y
  for (let i = 0; i < 7; i++) {
    const a = (Math.random() - 0.5) * Math.PI * 2, spd = 3 + Math.random() * 3
    g.bones.push({ x: cx, y: cy, w: 11, h: 11, vx: Math.cos(a) * spd, vy: -Math.abs(Math.sin(a) * spd) - 1, active: true, life: 20 })
  }
  for (let i = 0; i < 3; i++)
    g.drops.push({ x: cx + (Math.random() - 0.5) * 80, y: cy - 20, vx: (Math.random() - 0.5) * 2.5, vy: -3 - Math.random() * 1.5, active: true, life: 22, kind: "h" })
  for (let i = 0; i < 2; i++)
    g.drops.push({ x: cx + (Math.random() - 0.5) * 60, y: cy - 20, vx: (Math.random() - 0.5) * 2, vy: -3 - Math.random() * 1.5, active: true, life: 22, kind: "a" })
  for (let i = 0; i < 3; i++)
    g.drops.push({ x: cx + (Math.random() - 0.5) * 70, y: cy - 20, vx: (Math.random() - 0.5) * 2.2, vy: -3.5 - Math.random() * 1.2, active: true, life: 22, kind: "c" })
  triggerShake(g, 8, 0.3)
  spawnExplosion(g, cx, cy, ["#FFD700", "#FFAA00", "#FFFFFF", "#00FF88"], 20, 6)
}

export function tickCheckpoints(g: G) {
  const p = g.pl
  // Descubrir checkpoints cercanos automáticamente (solo si no son boss-CP bloqueado)
  for (const cp of ALL_CPS) {
    if (g.discoveredCPs.has(cp.id)) continue
    if (cp.bossKind && !isBossCPUnlocked(g, cp)) continue  // boss CP bloqueado, no descubrir aún
    const bdx = p.x + p.w / 2 - (cp.x + PW / 2)
    const bdy = p.y + p.h / 2 - (cp.y + PH)
    if (Math.sqrt(bdx * bdx + bdy * bdy) < CP_RADIUS) g.discoveredCPs.add(cp.id)
  }
  // Animar teletransporte
  if (g.tpAnim) {
    g.tpAnim.timer += STEP
    if (g.tpAnim.phase === 0 && g.tpAnim.timer >= 0.42) {
      // Mover al jugador
      g.pl.x = g.tpAnim.destX; g.pl.y = g.tpAnim.destY
      g.pl.vx = 0; g.pl.vy = 0
      g.cx = g.pl.x - CW / 2 + PW / 2; g.cy = g.pl.y - CH / 2 + PH / 2
      g.cx = Math.max(0, Math.min(g.cx, TOT_W - CW)); g.cy = Math.max(0, Math.min(g.cy, TOT_H - CH))
      spawnExplosion(g, g.tpAnim.destX + PW / 2, g.tpAnim.destY + PH / 2, ["#FFFFFF", "#AAFFAA", "#FFFF88", "#88FFFF"], 16, 4.5)
      g.tpAnim.phase = 1; g.tpAnim.timer = 0
    } else if (g.tpAnim.phase === 1 && g.tpAnim.timer >= 0.42) {
      // Al llegar: actualizar checkpoint al destino y guardar automáticamente
      const arrived = ALL_CPS.find(cp =>
        Math.abs(cp.x - g.tpAnim!.destX) < 8 && Math.abs(cp.y - g.tpAnim!.destY) < 8
      )
      if (arrived) {
        g.checkpoint = { w: arrived.w, x: arrived.x, y: arrived.y }
        saveGame(g)
        g.sessionStart = Date.now()   // reinicia el contador de sesión tras guardar
        g.kennelMsg = 3   // muestra el mensaje de guardado
      }
      g.tpAnim = null
    }
  }
}
