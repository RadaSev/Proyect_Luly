// ══════════════════════════════════════════════════════════════
//  UTILS — game/utils.ts
//  Efectos visuales: partículas, shake. Sin imports de physics.
// ══════════════════════════════════════════════════════════════
import type { G } from "./types"
import { STEP, NR, NC, TROW, WORLD_P1_BOSS, rid } from "./constants"
import { getEnemySpawns } from "./world_gen"

// Inline version of isSpawnDead (to avoid circular import with physics.ts)
function _isSpawnDead(dead: Set<string>, w: number, c: number, r: number, i: number): boolean {
  const eid = `${rid(w, c, r)}_${i}`
  if (dead.has(eid)) return true
  for (const id of dead) {
    if (id === eid || id.startsWith(eid + "_") || id.includes(`_adopted_${eid}`)) return true
  }
  return false
}

export function spawnExplosion(g: G, x: number, y: number, cols: string[], count = 8, speed = 3.5, big = false) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, spd = speed * (0.4 + Math.random() * 0.8)
    g.sparks.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - (big ? 1.5 : 0.5), life: big ? 0.55 : 0.38, maxLife: big ? 0.55 : 0.38, r: big ? (3 + Math.random() * 4) : (1.5 + Math.random() * 2.5), col: cols[Math.floor(Math.random() * cols.length)] })
  }
}

export function triggerShake(g: G, mag: number, dur = 0.3) {
  g.shakeMag = Math.max(g.shakeMag, mag)
  g.shakeTimer = Math.max(g.shakeTimer, dur)
}

export function tickSparks(g: G) {
  for (const s of g.sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.18; s.vx *= 0.88; s.life -= STEP }
  g.sparks = g.sparks.filter(s => s.life > 0)
}

export function tickShake(g: G) {
  if (g.shakeTimer > 0) {
    g.shakeTimer = Math.max(0, g.shakeTimer - STEP)
    const t = g.shakeTimer > 0 ? Math.min(1, g.shakeTimer * 4) : 0
    g.shakeX = (Math.random() - 0.5) * g.shakeMag * t * 2
    g.shakeY = (Math.random() - 0.5) * g.shakeMag * t * 2
    if (g.shakeTimer <= 0) { g.shakeMag = 0; g.shakeX = 0; g.shakeY = 0 }
  }
  if (g.abilityNotif && g.abilityNotif.timer > 0) {
    g.abilityNotif.timer -= STEP
    if (g.abilityNotif.timer <= 0) g.abilityNotif = null
  }
  if (g.rexPhoneNotif && g.rexPhoneNotif.timer > 0) {
    g.rexPhoneNotif.timer -= STEP
    if (g.rexPhoneNotif.timer <= 0) g.rexPhoneNotif = null
  }
  if (g.comboTimer > 0) {
    g.comboTimer -= STEP
    if (g.comboTimer <= 0) g.combo = 0
  }
}


export function countP1KillsW0(dead: Set<string>): number {
  let count = 0
  for (let c = 0; c < NC; c++) {
    for (let r = 0; r < TROW; r++) {
      const sp = getEnemySpawns(0, c, r)
      for (let i = 0; i < sp.length; i++) {
        if (_isSpawnDead(dead, 0, c, r, i)) count++
      }
    }
  }
  return count
}

