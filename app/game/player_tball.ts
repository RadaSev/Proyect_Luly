// ══════════════════════════════════════════════════════════════
//  PELOTA REBOTANTE — game/player_tball.ts
//  fireTBall, tickPickups, tickTBalls
// ══════════════════════════════════════════════════════════════
import type { G } from "./types"
import {
  STEP, TOT_W, TOT_H,
  TB_AMMO_INIT, TB_AMMO_MAX, TB_AMMO_DROP,
  TB_R, TB_SPD, TB_GRAVITY, TB_MAX_BOUNCES, TB_MAX_LIFE, TB_MAX_SIMULTANEOUS,
  TBALL_PICKUP_POS,
} from "./constants"
import { activePlats, dmgEnemy } from "./physics"
import { spawnExplosion } from "./utils"
import { saveGame } from "./save"

export function fireTBall(g: G) {
  if (!g.abilities.has("tball")) return
  if (!g.infiniteAmmo && g.tballAmmo <= 0) return   // sin munición (salvo ammo∞)
  if (g.tBalls.filter(b => b.active).length >= TB_MAX_SIMULTANEOUS) return
  const p = g.pl
  const dx = g.keys["arrowright"] || g.keys["d"] ? 1 : g.keys["arrowleft"] || g.keys["a"] ? -1 : p.facing
  const dy = g.keys["arrowup"] || g.keys["w"] ? -0.5 : g.keys["arrowdown"] || g.keys["s"] ? 0.4 : -0.2
  const len = Math.sqrt(dx * dx + dy * dy)
  const px = p.x + (p.facing === 1 ? p.w + 4 : -TB_R * 2 - 4)
  const py = p.y + p.h * 0.4
  const extraBounces = g.tballUpgraded ? 4 : 0
  g.tBalls.push({ x: px, y: py, vx: (dx / len) * TB_SPD, vy: (dy / len) * TB_SPD, active: true, bounces: TB_MAX_BOUNCES + extraBounces, life: TB_MAX_LIFE })
  if (!g.infiniteAmmo) g.tballAmmo--
  spawnExplosion(g, px, py, ["#CCFF00", "#88FF44"], 4, 1.5)
}

export function tickPickups(g: G) {
  const p = g.pl
  for (const pk of g.pickups) {
    if (!pk.active) continue
    pk.floatPhase += STEP * 2.4  // oscilación de flotación
    // Countdown de inmunidad al spawn (evita recoger inmediatamente)
    if (pk.spawnTimer !== undefined && pk.spawnTimer > 0) {
      pk.spawnTimer = Math.max(0, pk.spawnTimer - STEP)
      continue
    }
    // Colisión con el jugador (hitbox generosa)
    const dx = p.x + p.w / 2 - pk.x, dy = p.y + p.h / 2 - pk.y
    if (Math.sqrt(dx * dx + dy * dy) < 70) {
      pk.active = false
      if (pk.kind === "tball" && !g.abilities.has("tball")) {
        // La pelota solo se puede recoger cuando la jaula está abierta
        if (g.viejoDogState !== "cage_opened") {
          pk.active = true   // re-activar, la jaula sigue cerrada
          continue
        }
        g.abilities.add("tball")
        g.tballAmmo = TB_AMMO_INIT
        g.activePower = "tball"
        g.abilityNotif = { text: "🎾 PELOTA REBOTANTE — 5 balas  [V / botón 🎾]", timer: 5.5 }
        spawnExplosion(g, pk.x, pk.y, ["#CCFF00", "#88FF44", "#FFFFFF", "#FFFF00"], 18, 5)
        saveGame(g)
      } else if (pk.kind === "tball_key" && !g.tballKeyHeld) {
        // El jugador recoge la media llave
        g.tballKeyHeld = true
        g.viejoDogState = "key_held"
        g.abilityNotif = { text: "½ Llave recogida — ¡Llévala a Rex! Él tiene la otra mitad", timer: 5.0 }
        spawnExplosion(g, pk.x, pk.y, ["#FFD700", "#FFA500", "#FFFFFF", "#FFE066"], 12, 4)
        saveGame(g)
      } else if (pk.kind === "baton" && !g.rexBatonHeld) {
        g.rexBatonHeld = true
        g.abilityNotif = { text: "¡Bastón recogido! Llévalo a Rex el Viejo.", timer: 5.0 }
        spawnExplosion(g, pk.x, pk.y, ["#8B4513", "#D2691E", "#FFD700", "#FFFFFF"], 14, 4)
        saveGame(g)
      }
    }
  }
}

export function tickTBalls(g: G) {
  const ap = activePlats(g)
  for (const b of g.tBalls) {
    if (!b.active) continue
    b.life -= STEP
    if (b.life <= 0) { b.active = false; continue }

    b.vy += TB_GRAVITY
    const nx = b.x + b.vx, ny = b.y + b.vy

    // Colisión con plataformas sólidas → rebote
    let bounced = false
    for (const pl of ap) {
      if (pl.mode !== "s" && pl.mode !== "d") continue
      // Expandir hitbox por radio
      const left = pl.x - TB_R, right = pl.x + pl.w + TB_R
      const top  = pl.y - TB_R, bot   = pl.y + pl.h + TB_R
      if (nx > left && nx < right && ny > top && ny < bot) {
        // Determinar eje de rebote
        const fromLeft  = b.x <= pl.x - TB_R + 4
        const fromRight = b.x >= pl.x + pl.w + TB_R - 4
        const fromTop   = b.y <= pl.y - TB_R + 4
        const fromBot   = b.y >= pl.y + pl.h + TB_R - 4
        if ((fromLeft || fromRight) && !(fromTop || fromBot)) b.vx *= -0.85
        else if ((fromTop || fromBot) && !(fromLeft || fromRight)) b.vy *= -0.85
        else { b.vx *= -0.85; b.vy *= -0.85 }
        b.bounces--; bounced = true
        spawnExplosion(g, b.x, b.y, ["#CCFF00", "#FFFF44"], 3, 1.2)
        if (b.bounces <= 0) { b.active = false }
        break
      }
    }
    if (!b.active) continue
    if (!bounced) { b.x = nx; b.y = ny }

    // Límites del mundo
    if (b.x < 0 || b.x > TOT_W || b.y < 0 || b.y > TOT_H) { b.active = false; continue }

    // Colisión con enemigos → daño + rebote
    for (const e of g.enemies) {
      if (!e.active || e.dying) continue
      if (b.x + TB_R > e.x && b.x - TB_R < e.x + e.w && b.y + TB_R > e.y && b.y - TB_R < e.y + e.h) {
        // Jefes: 1 dmg por rebote (igual que un hueso, pero puede rebotar varias veces)
        // Enemigos normales: fórmula proporcional al HP máximo
        dmgEnemy(g, e, e.boss ? 1 : Math.max(1, Math.floor(e.mhp / 8)))
        spawnExplosion(g, b.x, b.y, ["#CCFF00", "#88FF44", "#FFFFFF"], 6, 2.5)
        b.vx *= -0.9; b.vy *= -0.9  // rebota en el enemigo
        b.bounces--
        if (b.bounces <= 0) { b.active = false }
        break
      }
    }
  }
  g.tBalls = g.tBalls.filter(b => b.active)
}
