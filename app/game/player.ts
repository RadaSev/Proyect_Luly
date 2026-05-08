// ══════════════════════════════════════════════════════════════
//  JUGADOR — game/player.ts
//  tickPlayer: movimiento, salto, dash, wall slide, ataques del jugador
// ══════════════════════════════════════════════════════════════
import type { G } from "./types"
import {
  STEP, PW, PH, PH_CROUCH, WALK, RUN, JV, GUP, GDN, GMAX, PSPD, WLEN, WDMG,
  EN_HBX, EN_HBT, PL_HBX, PL_HBT, NC, NW, TOT_W, TOT_H, TB_AMMO_MAX
} from "./constants"
import { activePlats, resolve, dmgPlayer, dmgEnemy, getDir } from "./physics"
import { spawnExplosion, triggerShake } from "./utils"

export function tickPlayer(g: G) {
  // ── Freeze de movimiento: shop abierto O animación de entrega de Bolkha ──────
  if (g.bolkhaShopOpen || g.bolkhaState === "giving") {
    const k2 = g.keys
    k2["a"] = false; k2["arrowleft"]  = false
    k2["d"] = false; k2["arrowright"] = false
    k2[" "] = false; k2["arrowup"] = false; k2["w"] = false
    k2["shift"] = false
    g.pl.vx = 0
    g.pl.runMode = false
    // Seguir aplicando física vertical (gravedad/colisión) para no flotar
  }

  const k = g.keys, p = g.pl, now = performance.now()
  const STA_RED = 8, STA_DRAIN = 36, STA_RCH_WALK = 22, STA_RCH_IDLE = 40
  // STA_DRAIN=36: agota en ~2.8s corriendo en suelo (antes 17→5.9s demasiado lento)
  const moving = (k["a"] || k["arrowleft"] || k["d"] || k["arrowright"]) && !p.crouching
  const canRun = !p.exhausted  // drena hasta 0; STA_RED solo se usa para reinicio tras agotamiento
  if (!moving || !canRun) p.runMode = false
  const wantsRun = p.runMode, actuallyRunning = wantsRun && canRun && moving
  if (p.exhausted) {
    p.staminaCooldown = Math.max(0, p.staminaCooldown - STEP)
    if (p.staminaCooldown <= 0) { p.exhausted = false; p.stamina = STA_RED }
  } else if (actuallyRunning) {
    if (p.onGround) {
      // Drena stamina solo al correr en el suelo
      p.stamina = Math.max(0, p.stamina - STA_DRAIN * STEP)
      if (p.stamina <= 0) { p.exhausted = true; p.staminaCooldown = 4.5 }
    }
    // En el aire corriendo: stamina PAUSADA (ni drena ni recupera — efecto impulso)
  } else {
    p.stamina = Math.min(p.maxStamina, p.stamina + (moving ? STA_RCH_WALK : STA_RCH_IDLE) * STEP)
  }
  // Fade stamina circle in/out
  const staActive = p.exhausted || p.stamina < p.maxStamina - 0.5
  g.staCircleAlpha = staActive
    ? Math.min(1, g.staCircleAlpha + STEP * 6)
    : Math.max(0, g.staCircleAlpha - STEP * 1.2)
  const exhaustedMult = p.exhausted ? 0.65 : 1
  const run = actuallyRunning, spd = run ? RUN : Math.round(WALK * exhaustedMult)
  const left = k["a"] || k["arrowleft"], right = k["d"] || k["arrowright"]
  const downKey = k["s"] || k["arrowdown"], jk = k[" "] || k["arrowup"]
  const wantCrouch = downKey && p.onGround && !jk
  if (wantCrouch && !p.crouching) { p.crouching = true }
  else if (!wantCrouch && p.crouching) { p.crouching = false }
  if (left && !right) {
    p.vx = -spd; p.facing = -1
    // pa de movimiento solo en el suelo — en el aire lo controla el override al final del tick
    if (p.onGround) p.pa = run ? "run_left" : (p.exhausted ? "slow_walk_left" : "walk_left")
  } else if (right && !left) {
    p.vx = spd; p.facing = 1
    if (p.onGround) p.pa = run ? "run" : (p.exhausted ? "slow_walk" : "walk")
  }
  else { p.vx = 0; if (p.onGround) p.pa = p.facing === 1 ? "idle" : "idle_left" }

  // ── DASH ────────────────────────────────────────────────────────────
  p.dashCd = Math.max(0, p.dashCd - STEP)
  const shiftKey = k["shift"] || false
  const canDash = g.abilities.has("dash") && !p.crouching && p.dashCd <= 0 && !p.dash
  if (shiftKey && canDash) {
    p.dash = true; p.dashDir = p.facing; p.dashTimer = 0.13
    p.dashCd = 0.70; p.inv = Math.max(p.inv, 0.14)
    p.pa = "run"   // dash_right/dash_left desactivados hasta tener sprites 25fps
    spawnExplosion(g, p.x + p.w / 2, p.y + p.h / 2, ["#FFFFFF", "#CCCCFF", "#8888FF"], 10, 3.5, false)
  }
  if (p.dash) {
    p.vx = p.dashDir * 16
    if (p.vy > 0) p.vy *= 0.12
    p.pa = "run"   // dash_right/dash_left desactivados hasta tener sprites 25fps
    if (p.dashTimer > 0) { p.dashTimer -= STEP }
    else { p.dash = false; p.vx = p.dashDir * RUN }
  }

  if (!jk) p.jh = false
  if (p.onGround) { p.djump = false; p.djumpAvail = true }

  const standingOnOneWay_plat = p.onGround && activePlats(g).some(pl =>
    pl.mode === "t" && p.x + p.w > pl.x && p.x < pl.x + pl.w && Math.abs((p.y + p.h) - pl.y) <= 8
  )

  const dropThruJump = jk && downKey

  let dropThruDouble = false
  if (standingOnOneWay_plat) {
    if (p.crouching && downKey && !p.dropThruPlatform) {
      dropThruDouble = true
    }
  }

  const standingOnOneWay =
    (dropThruJump && p.onGround && standingOnOneWay_plat) ||
    dropThruDouble

  g.dropThru = standingOnOneWay
  p.dropThruPlatform = standingOnOneWay

  if (standingOnOneWay) {
    p.y += 8; p.onGround = false; p.crouching = false; p.h = PH
  } else if (jk && !p.jh && !p.crouching) {
    const jumpAnim = p.facing === 1 ? "jump" : "jump_left"
    if (p.onGround) {
      p.vy = JV; p.onGround = false; p.jh = true; p.djump = true; p.djumpAvail = true; p.pa = jumpAnim; p.pf = 0
    } else if (!p.djump) {
      p.vy = JV; p.jh = true; p.djump = true; p.pa = jumpAnim; p.pf = 0
    } else if (p.djumpAvail) {
      p.vy = JV * 0.88; p.jh = true; p.djumpAvail = false; p.pa = jumpAnim; p.pf = 0
    }
  }

  if (!p.onGround) { p.vy += p.vy < 0 ? GUP : GDN; if (p.vy > GMAX) p.vy = GMAX }
  const hx = p.x + PL_HBX, hy = p.y + PL_HBT, hw = p.w - 2 * PL_HBX, hh = p.h - PL_HBT
  const preResVx = p.vx, preResVy = p.vy
  const res = resolve(hx, hy, hw, hh, p.vx, p.vy, g)
  p.x = res.x - PL_HBX; p.y = res.y - PL_HBT; p.vx = res.vx; p.vy = res.vy; p.onGround = res.og

  // ── WALL SLIDE / WALL JUMP ───────────────────────────────────────────
  p.wallJumpCd = Math.max(0, p.wallJumpCd - STEP)
  const hitWallNow = res.vx === 0 && Math.abs(preResVx) > 0.5 && !p.onGround && !p.crouching && !p.dash
  if (hitWallNow && preResVy > 0 && p.wallJumpCd <= 0) {
    p.wallSliding = true
    p.wallDir = preResVx > 0 ? 1 : -1
    if (p.vy > 2.2) p.vy = 2.2
    if (Math.random() < 0.25) spawnExplosion(g, p.wallDir === 1 ? p.x + p.w : p.x, p.y + p.h * 0.5 + Math.random() * 20, ["#DDDDDD", "#AAAAAA"], 2, 1.2, false)
  } else if (p.onGround || p.dash || (!left && !right)) {
    p.wallSliding = false; p.wallDir = 0
  }
  if (p.wallSliding) p.pa = p.facing === 1 ? "jump" : "jump_left"
  // Wall jump
  if (p.wallSliding && jk && !p.jh && g.abilities.has("walljump")) {
    p.vy = JV * 0.92; p.vx = -p.wallDir * (RUN + 2)
    p.facing = (-p.wallDir) as 1 | -1
    p.jh = true; p.djumpAvail = true
    p.wallSliding = false; p.wallDir = 0; p.wallJumpCd = 0.22
    p.pa = p.facing === 1 ? "jump" : "jump_left"
    spawnExplosion(g, p.x + p.w / 2, p.y + p.h / 2, ["#FFFFFF", "#88AAFF", "#4466FF"], 8, 3, false)
  }

  if (p.onGround && !standingOnOneWay_plat) p.dropThruPlatform = false

  if (k["n"] && p.ammo > 0) {
    const mkP = () => { const d = getDir(g); const px = p.x + (p.facing === 1 ? p.w : 0), py = p.y + p.h / 2; g.projs.push({ x: px, y: py, vx: d.x * PSPD, vy: d.y * PSPD - 1, active: true, pl: true, star: false, rot: Math.atan2(d.y, d.x) * 180 / Math.PI, life: 3.5, dist: 0, ox: px, oy: py }); p.ammo-- }
    if (!p.sh) { mkP(); p.ls = now; p.as2 = now; p.sh = true; p.pa = p.facing === 1 ? "atack_bone" : "atack_bone_left" }
    else if (now - p.as2 > 2500) { mkP(); p.as2 = now; p.pa = p.facing === 1 ? "atack_bone" : "atack_bone_left" }
    else { p.pa = p.facing === 1 ? "atack_bone" : "atack_bone_left" }  // mantiene mientras se sostiene N
  } else p.sh = false
  p.wcd = Math.max(0, p.wcd - STEP * 1000)
  if (k["m"] && !p.wh && p.wcd <= 0 && !g.whip && !p.exhausted) {
    const d = getDir(g); const cx = p.x + p.w / 2, cy = p.y + p.h / 2
    g.whip = { x: cx, y: cy, ex: cx + d.x * WLEN, ey: cy + d.y * WLEN, life: 0.2, dealt: false }
    p.stamina = Math.max(0, p.stamina - 18)
    if (p.stamina <= 0) { p.exhausted = true; p.staminaCooldown = 4.5 }
    p.wcd = 500; p.wh = true; p.pa = p.facing === 1 ? "atack_correa" : "atack_correa_left"
  }
  if (!k["m"]) p.wh = false
  // Mantiene la animación de correa mientras el látigo sigue activo (life=0.2s)
  if (g.whip) p.pa = p.facing === 1 ? "atack_correa" : "atack_correa_left"

  // ── Animación en el aire: sobrescribe estado de movimiento ─────────────
  // Umbrales para evitar falsos positivos en bordes o suelo con pequeñas oscilaciones:
  //   vy < -2  → sube con fuerza → jump
  //   vy > 2.5 → cae con fuerza → fall  (NO se activa por caminar al borde 1-2 frames)
  //   entre -2 y 2.5 → zona de transición, mantiene la animación actual
  if (!p.onGround && !p.wallSliding && !p.dash) {
    const isAttacking = p.pa === "atack_bone" || p.pa === "atack_bone_left" ||
                        p.pa === "atack_correa" || p.pa === "atack_correa_left"
    if (!isAttacking) {
      if (p.vy < -2) {
        p.pa = p.facing === 1 ? "jump" : "jump_left"
      } else if (p.vy > 2.5) {
        // Resetea frame al entrar en fall para que siempre empiece desde el inicio
        const fallAnim = p.facing === 1 ? "fall" : "fall_left"
        if (p.pa !== fallAnim) p.pf = 0
        p.pa = fallAnim
      }
      // zona media (-2 a 2.5): mantiene pa actual (walk/idle/jump congelado)
    }
  }

  if (p.inv > 0) p.inv -= STEP
  if (g.infiniteAmmo) { p.ammo = 15; p.stamina = p.maxStamina; p.exhausted = false; p.staminaCooldown = 0; if (g.abilities.has("tball")) g.tballAmmo = TB_AMMO_MAX }
}

