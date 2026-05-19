// ══════════════════════════════════════════════════════════════
//  FÍSICA — game/physics.ts
//  resolve, activePlats, dmgPlayer, dmgEnemy, arena plats, tool mounds,
//  breakCrate, tickProjs, tickWhip, tickBones, tickDrops
// ══════════════════════════════════════════════════════════════
import type { G, WPlat, Enemy, Crate, Player, ToolMound } from "./types"
import {
  STEP, RW, RH, NW, NC, NR, TOT_W, TOT_H, PW, PH, PH_CROUCH, PL_HBX, PL_HBT, EN_HBX, EN_HBT,
  WT, DW, DH, GDN, GUP, GMAX,
  ARENA_PLAT_SHOW, ARENA_PLAT_HIDE, ARENA_PLAT_AMP, ARENA_PLAT_SPD, ARENA_PLAT_W, ARENA_PLAT_H,
  MOUND_W, MOUND_H, WORLD_P1_BOSS, WORLD_P2_BOSS, TRANSIT_BOSS_COL, TROW,
  PROJ_GRAV, PROJ_MAXD, TB_AMMO_MAX, TB_AMMO_INIT, TB_AMMO_DROP, WLEN, WDMG,
  EW, EH, BW, BH, W1P1_BW, W1P1_BH, W1P2_BW, W1P2_BH, UB_W, UB_H,
  TBALL_KEY_DROP_CHANCE, TBALL_KEY_MIN_KILLS, TBALL_KEY_FORCE_KILL,
  PLAYER_START,
  ro, rid,
  TUN_V_WIDTH,
} from "./constants"
import { getWorldPlats, getEnemySpawns, isBossRoom, getWorldCrateDefs, computeDoors, udDoorX_rel, getRoomChannelBounds } from "./world_gen"
import { spawnExplosion, triggerShake, countP1KillsW0 } from "./utils"
import { saveGame } from "./save"

// ══════════════════════════════════════════════════════════════
//  FÍSICA
// ══════════════════════════════════════════════════════════════
let _apCache2: WPlat[] | null = null
let _apLoadedKey = ""  // string de mundos cargados para invalidar cache

export function clearActivePlatsCache() {
  _apCache2 = null
  _apLoadedKey = ""
}

export function activePlats(g: G): WPlat[] {
  const key = [...g.loadedWorlds].sort().join(",") + "|" + g.cw.size + "|" + g.dead.size
    + "|" + (g.p1BossRexSeen ? 1 : 0) + (g.p2BossRexSeen ? 1 : 0) + (g.ultraBossRexSeen ? 1 : 0)
    + "|arena:" + g.bossArenaLocked.size
  if (_apCache2 && _apLoadedKey === key) return _apCache2

  const allPlats: WPlat[] = []
  for (const w of g.loadedWorlds) allPlats.push(...getWorldPlats(w))

  _apCache2 = allPlats.filter(p => {
    if (p.mode !== "d") return true
    if (p.sw === undefined) return true
    if (p.sw >= 600 && p.sw < 610) {
      // puerta arena ultra boss: sólida durante la batalla
      const arenaKey = (p.sw - 600) + 20   // world + 20 = ultra arena key
      return g.bossArenaLocked.has(arenaKey)
    }
    if (p.sw >= 510 && p.sw < 520) {
      // puerta arena jefe P2: sólida durante la batalla
      const arenaKey = (p.sw - 510) + 10   // world + 10 = P2 arena key
      return g.bossArenaLocked.has(arenaKey)
    }
    if (p.sw >= 500 && p.sw < 510) {
      // puerta arena jefe P1: sólida durante la batalla (bossArenaLocked activo)
      const bossW = p.sw - 500
      return g.bossArenaLocked.has(bossW)
    }
    if (p.sw >= 400 && p.sw < 500) {
      // puerta roja Jefe P2: sólida hasta que Rex explique al Herrero
      return !g.p2BossRexSeen
    }
    if (p.sw >= 300 && p.sw < 400) {
      // puerta verde Jefe P1: sólida hasta que Rex explique al Castigador
      return !g.p1BossRexSeen
    }
    if (p.sw >= 200 && p.sw < 300) {
      // puerta dorada ultra-boss: sólida hasta que Rex explique al Torturado
      return !g.ultraBossRexSeen
    }
    if (p.sw >= 100 && p.sw < 200) {
      // puerta cian: sólida hasta que muera el boss de la Part1
      const bossW = p.sw - 100
      return !isPart1BossDead(g, bossW)
    }
    if (p.sw >= 0) return !g.cw.has(p.sw)  // puerta salida: sólida hasta mundo completado
    // puerta entrada boss legacy (sw = -(w+1))
    const bossW = -(p.sw + 1)
    return !areRegularEnemiesDead(g, bossW)
  })
  _apLoadedKey = key
  return _apCache2
}

export function worldBoundsX(w: number): { minX: number; maxX: number } {
  return { minX: w * NC * RW, maxX: (w + 1) * NC * RW }
}

export function resolve(ex: number, ey: number, ew: number, eh: number, vx: number, vy: number, g: G) {
  let x = ex + vx, y = ey + vy, og = false
  for (const p of activePlats(g)) {
    if (p.x + p.w < x - 4 || p.x > x + ew + 4 || p.y + p.h < y - 4 || p.y > y + eh + 4) continue
    const ov = (ax: number, ay: number, aw: number, ah: number) => ax < p.x + p.w && ax + aw > p.x && ay < p.y + p.h && ay + ah > p.y
    if (p.mode === "t") {
      if (g.dropThru) continue
      if (vy >= 0 && ey + eh <= p.y + 5 && ov(x, ey + vy, ew, eh)) { y = p.y - eh; vy = 0; og = true }
    } else if (p.mode === "s" || p.mode === "d") {
      if (ov(x, ey + vy, ew, eh) && vy >= 0 && ey + eh <= p.y + 5) { y = p.y - eh; vy = 0; og = true }
      if ((p.mode === "s" || p.mode === "d") && ov(x, y, ew, eh)) {
        if (vx > 0 && ex + ew <= p.x + 5) { x = p.x - ew; vx = 0 }
        else if (vx < 0 && ex >= p.x + p.w - 5) { x = p.x + p.w; vx = 0 }
        if (vy < 0 && ey >= p.y + p.h - 5) { y = p.y + p.h; vy = 0 }
      }
    }
  }
  // Plataformas móviles del arena del jefe (one-way, modo "t")
  for (const mp of g.bossArenaPlats) {
    if (!mp.visible) continue
    const p = mp
    if (p.x + p.w < x - 4 || p.x > x + ew + 4) continue
    if (vy >= 0 && ey + eh <= p.y + 5) {
      const overlapX = x < p.x + p.w && x + ew > p.x
      const overlapFuture = x < p.x + p.w && x + ew > p.x && ey + eh + vy >= p.y && ey + eh <= p.y + 5
      if (overlapFuture && !g.dropThru) { y = p.y - eh; vy = 0; og = true }
    }
  }
  x = Math.max(0, Math.min(x, TOT_W - ew))
  if (y + eh > TOT_H) { y = TOT_H - eh; vy = 0; og = true }
  return { x, y, vx, vy, og }
}

export function getDir(g: G) {
  const k = g.keys, p = g.pl; let dx = 0, dy = 0
  if (k["w"] || k["arrowup"]) dy -= 1; if (k["s"] || k["arrowdown"]) dy += 1
  if (!(k["a"] || k["arrowleft"] || k["d"] || k["arrowright"])) dx = p.facing
  else { if (k["d"] || k["arrowright"]) dx += 1; if (k["a"] || k["arrowleft"]) dx -= 1 }
  const len = Math.sqrt(dx * dx + dy * dy) || 1; return { x: dx / len, y: dy / len }
}


// Crea las dos plataformas móviles del arena del boss P1 (llamado una sola vez al activar)
export function spawnBossArenaPlats(g: G, bossWorld: number, bossCol: number, bossRow: number) {
  if (g.bossArenaPlats.length > 0) return  // ya existen
  const { x: rx, y: ry } = ro(bossWorld, bossCol, bossRow)
  const floorY  = ry + RH - WT                  // piso interior
  const ceilY   = ry + WT                        // techo interior
  const midY    = (floorY + ceilY) / 2
  // baseY: posición central del recorrido, dejando espacio para que Luly pueda saltar desde el suelo
  const baseY   = midY - 30

  // Plataforma 1: izquierda, fase 0
  const platW   = ARENA_PLAT_W
  const p1x     = rx + WT + Math.floor((RW - 2 * WT) * 0.22) - platW / 2
  // Plataforma 2: derecha, fase π (opuesta → alterna)
  const p2x     = rx + WT + Math.floor((RW - 2 * WT) * 0.72) - platW / 2

  g.bossArenaPlats = [
    {
      baseX: p1x, baseY, w: platW, h: ARENA_PLAT_H,
      ampY: ARENA_PLAT_AMP, phase: 0, speed: ARENA_PLAT_SPD,
      visible: true, hiddenTimer: 0, showTimer: ARENA_PLAT_SHOW,
      x: p1x, y: baseY,
    },
    {
      baseX: p2x, baseY, w: platW, h: ARENA_PLAT_H,
      ampY: ARENA_PLAT_AMP, phase: Math.PI, speed: ARENA_PLAT_SPD,
      visible: false, hiddenTimer: ARENA_PLAT_HIDE * 0.5, showTimer: 0,  // empieza desfasada
      x: p2x, y: baseY,
    },
  ]
}

export function tickBossArenaPlats(g: G, dt: number) {
  for (const mp of g.bossArenaPlats) {
    mp.phase += mp.speed * STEP
    mp.y = mp.baseY + Math.sin(mp.phase) * mp.ampY

    if (mp.visible) {
      mp.showTimer -= STEP
      if (mp.showTimer <= 0) {
        mp.visible = false
        mp.hiddenTimer = ARENA_PLAT_HIDE
        // Si el jugador está parado encima, bajarlo un poco para que caiga
      }
    } else {
      mp.hiddenTimer -= STEP
      if (mp.hiddenTimer <= 0) {
        mp.visible = true
        mp.showTimer = ARENA_PLAT_SHOW
      }
    }
  }
  // Limpiar plataformas si el boss murió (arena desbloqueada)
  if (g.bossArenaPlats.length > 0 && !g.bossArenaLocked.has(0)) {
    g.bossArenaPlats = []
  }
}

// Crea 3 montículos de herramientas en el arena del Blacksmith
export function spawnToolMounds(g: G, e: Enemy) {
  if (g.toolMounds.length > 0) return
  const hr = { w: e.world, c: parseInt(e.id.split("_")[1]), r: parseInt(e.id.split("_")[2]) }
  const { x: rx, y: ry } = ro(hr.w, hr.c, hr.r)
  // El sprite del montículo tiene padB=153/768 de transparencia inferior y content llega a 614/768.
  // Para que el contenido quede al ras del suelo, ajustamos Y:
  const moundContentBotFrac = 614 / 768
  const floorY = ry + RH - WT - Math.ceil(MOUND_H * moundContentBotFrac)
  const innerW = RW - 2 * WT
  // 3 montículos distribuidos horizontalmente (evitar zona de paredes flotantes)
  const positions = [0.25, 0.50, 0.75]
  g.toolMounds = positions.map((frac, i) => ({
    id: i,
    x: rx + WT + Math.floor(innerW * frac) - MOUND_W / 2,
    y: floorY,
    w: MOUND_W,
    h: MOUND_H,
    active: true,
  }))
}

// Lanza herramientas desde un montículo cuando el boss lo golpea
export function launchToolsFromMound(g: G, mound: ToolMound, dir: number) {
  const cx = mound.x + mound.w / 2
  const cy = mound.y + mound.h / 4  // lanzar desde la parte superior del montículo
  const count = 6 + Math.floor(Math.random() * 4)  // 6-9 herramientas
  for (let i = 0; i < count; i++) {
    // Lanzar en abanico: algunas hacia el lado del boss, algunas al opuesto
    const dirFrac = i < count * 0.7 ? dir : -dir  // 70% hacia el lado del boss
    const spreadY = -(1.5 + Math.random() * 3)   // siempre hacia arriba primero
    const spreadX = (0.6 + Math.random() * 0.8) * dirFrac
    const spd = 8 + Math.random() * 6
    g.flyingTools.push({
      x: cx + (Math.random() - 0.5) * 30,
      y: cy,
      vx: spreadX * spd,
      vy: spreadY,
      life: 3.0,
      active: true,
      dealt: false,
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 15,
    })
  }
}

export function tickToolMounds(g: G) {
  // Tick de herramientas voladoras
  for (const ft of g.flyingTools) {
    if (!ft.active) continue
    ft.x += ft.vx
    ft.y += ft.vy
    ft.vy += 0.35  // gravedad
    ft.vx *= 0.98  // fricción del aire
    ft.rot += ft.rotSpd * STEP
    ft.life -= STEP
    if (ft.life <= 0) { ft.active = false; continue }
    // Colisión con paredes sólidas (plataformas flotantes del arena)
    const ap2 = activePlats(g)
    for (const pl of ap2) {
      if (pl.mode !== "s") continue
      if (ft.x > pl.x && ft.x < pl.x + pl.w && ft.y > pl.y && ft.y < pl.y + pl.h) {
        ft.vx *= -0.4  // rebotar un poco
        ft.vy *= -0.3
        ft.active = false  // se destruye al tocar la pared
      }
    }
    // Daño al jugador (2 corazones = 4 unidades)
    if (!ft.dealt) {
      const p = g.pl
      if (ft.x > p.x && ft.x < p.x + p.w && ft.y > p.y && ft.y < p.y + p.h && p.inv <= 0) {
        dmgPlayer(g, 4)
        ft.dealt = true
        ft.active = false
      }
    }
  }
  g.flyingTools = g.flyingTools.filter(f => f.active)
  // Limpiar montículos si el boss murió
  const w1p2dead = g.toolMounds.length > 0 && !g.bossArenaLocked.has(10)
  if (w1p2dead) { g.toolMounds = []; g.flyingTools = [] }
}

export function dmgPlayer(g: G, dmg: number) {
  if (g.godMode) { g.pl.hp = g.pl.maxHp; g.pl.inv = 0.5; return }
  if (g.pl.inv > 0) return
  g.pl.hp = Math.max(0, g.pl.hp - dmg); g.pl.inv = 2
  triggerShake(g, 7, 0.28)
  g.combo = 0; g.comboTimer = 0
  if (g.pl.hp <= 0) {
    triggerShake(g, 12, 0.5)
    g.lives--; if (g.lives <= 0) { g.over = true; return }
    g.pl.hp = g.pl.maxHp
    g.pl.vx = 0; g.pl.vy = 0; g.pl.crouching = false; g.pl.h = PH
    g.pl.dash = false; g.pl.wallSliding = false; g.pl.inv = 2
    g.ultraFlames = null  // limpiar llamas al morir

    // ── Detectar muerte en arena de jefe ANTES de limpiar los locks ─────
    const _curW = Math.max(0, Math.min(Math.floor(g.pl.x / (NC * RW)), NW - 1))
    const _diedInBoss = g.bossArenaLocked.has(_curW)
                     || g.bossArenaLocked.has(_curW + 10)
                     || g.bossArenaLocked.has(_curW + 20)

    // ── Abrir puertas de arenas de jefes vivos ───────────────────────────
    // Solo limpiamos los bloqueos de puerta y los objetos de arena.
    // El reset completo del jefe (HP, estado, posición) se hace de forma segura
    // en tickEnemies cuando el jugador ya no está en la misma sala,
    // evitando modificar campos del enemigo mientras el loop de ataque sigue corriendo.
    for (const e of g.enemies) {
      if (!e.boss || e.dying || e.deathFalling) continue
      if (isW1P1Boss(e)) {
        g.bossArenaLocked.delete(e.world)
        g.bossArenaPlats = []
      }
      if (isW1P2Boss(e)) {
        g.bossArenaLocked.delete(e.world + 10)
        g.toolMounds = []
        g.flyingTools = []
      }
      if (isUltraBoss(e)) {
        g.bossArenaLocked.delete(e.world + 20)
      }
    }

    // ── Recompensa de consuelo al morir frente a un jefe: recursos completos ─
    if (_diedInBoss) {
      g.lives  = 3                    // restaurar todas las vidas
      g.pl.ammo = 15                  // restaurar todos los huesos
      if (g.abilities.has("tball"))
        g.tballAmmo = g.tballUpgraded ? TB_AMMO_MAX : TB_AMMO_INIT  // restaurar pelotas
    }

    // Reaparece en el último checkpoint con animación de teletransporte
    g.tpAnim = { timer: 0, phase: 0, destX: g.checkpoint.x, destY: g.checkpoint.y }
  }
}

export function dmgEnemy(g: G, e: Enemy, dmg: number) {
  if (e.dying || e.deathFalling) return
  // El Torturado: inmune durante todo el ataque (startup→warn→dmg); vuln = daño normal
  if (isUltraBoss(e) && g.ultraFlames) {
    const ufPhase = g.ultraFlames.phase
    if (ufPhase === "startup" || ufPhase === "warn" || ufPhase === "dmg") return
  }
  const finalDmg = g.ohko ? e.hp : dmg
  e.hp -= finalDmg
  if (e.hp > 0) {
    e.hurtTimer = 0.32; e.ef = 0; e.eft = 0
    return
  }
  // Si el enemigo está en el aire (no en suelo), caer antes de morir
  // Bosses mueren directamente (tienen animación de muerte especial)
  const isAirborne = !e.boss && (e as any).onGround !== true
  e.deathFalling = isAirborne
  e.dying = !isAirborne
  e.deathTimer = 0; e.deathDir = e.dir; e.ef = 0; e.eft = 0
  e.vx = 0; e.alert = false; e.sa = 0; e.chainHit = null

  // Normalizar el ID spawn original (w_c_r_i = exactamente 4 segmentos)
  const parts = e.originalId.split("_")

  // Siempre registrar el ID spawn original limpio (w_c_r_i = exactamente 4 segmentos)
  const origParts = e.originalId.split("_")
  if (origParts.length >= 4) {
    // Registrar todas las combinaciones posibles de prefijo
    const cleanId = origParts.slice(0, 4).join("_")
    g.dead.add(cleanId)
  }
  g.dead.add(e.originalId)
  g.dead.add(e.id)
  g.kills++

  const originalWorld = parseInt(e.originalId.split("_")[0]) || e.world
  g.pl.ammo = Math.min(15, g.pl.ammo + 1)
  // Sistema de combo
  g.combo = Math.min(g.combo + 1, 20)
  g.comboTimer = 3.0
  const mult = Math.min(g.combo, 5)
  g.score += (e.boss ? 2000 : 100) * (originalWorld + 1) * mult
  // Shake en muerte de enemigo
  if (e.boss) triggerShake(g, 14, 0.6)
  else triggerShake(g, 3, 0.12)
  // Desbloquear arenas al morir el boss
  if (isW1P1Boss(e)) g.bossArenaLocked.delete(e.world)
  if (isW1P2Boss(e)) g.bossArenaLocked.delete(e.world + 10)
  if (isUltraBoss(e)) g.bossArenaLocked.delete(e.world + 20)
  // ── Desbloqueo de habilidades al matar boss ─────────────────────────
  // Solo el ultra-jefe [TRANSIT_BOSS_COL, TROW] = [4,4] otorga la habilidad del mundo.
  if (e.boss) {
    const bParts = e.originalId.split("_")
    const bC = parseInt(bParts[1]), bR = parseInt(bParts[2])
    const isUltraBoss = bC === TRANSIT_BOSS_COL && bR === TROW
    if (isUltraBoss) {
      if (originalWorld === 0 && !g.abilities.has("dash")) {
        g.abilities.add("dash")
        g.abilityNotif = { text: "DASH  [SHIFT / LT]", timer: 4.0 }
      } else if (originalWorld === 1 && !g.abilities.has("walljump")) {
        g.abilities.add("walljump")
        g.abilityNotif = { text: "SALTO EN PARED  [← / → + SALTO]", timer: 4.0 }
      } else if (originalWorld === 2 && !g.abilities.has("hpup")) {
        g.abilities.add("hpup")
        g.pl.maxHp = Math.min(g.pl.maxHp + 2, 12)  // +1 corazón (escala ×2), máx 6 corazones
        g.pl.hp    = Math.min(g.pl.hp    + 2, g.pl.maxHp)
        g.abilityNotif = { text: "VIDA MÁXIMA +1  ❤", timer: 4.0 }
      }
    }
  }
  checkWorldClear(g, originalWorld)

  // ── Drop del bastón de Rex: El Herrero (P2-W0) lo lleva ──────────────────────
  if (e.boss && e.world === 0 && !g.rexBatonHeld && !g.tballUpgraded) {
    const bParts2 = e.originalId.split("_")
    const bC2 = parseInt(bParts2[1]), bR2 = parseInt(bParts2[2])
    const [p2c, p2r] = WORLD_P2_BOSS[0]
    if (bC2 === p2c && bR2 === p2r) {
      g.pickups.push({
        id: "rex_baton", kind: "baton",
        x: e.x + e.w / 2,
        y: e.y + e.h * 0.2,
        active: true, floatPhase: 0, spawnTimer: 0.8
      })
      spawnExplosion(g, e.x + e.w / 2, e.y + e.h / 2, ["#8B4513", "#D2691E", "#FFD700", "#FFFFFF"], 22, 5, true)
      g.abilityNotif = { text: "¡El bastón de Rex! Llévalo a Rex el Viejo.", timer: 6.0 }
      saveGame(g)
    }
  }
  // ── Quest media llave: drop de llave en P1-W0 ──────────────────────────────
  if (!e.boss && e.world === 0 && (g.viejoDogState === "quest_active" || g.viejoDogState === "waiting")) {
    const eRow = Math.floor(e.y / RH)
    if (eRow < TROW) {
      const noQuestLastKill = g.viejoDogState === "waiting" && areRegularP1EnemiesDead(g, 0)
      const killsSince = Math.max(0, countP1KillsW0(g.dead) - g.questKillBaseline)
      const forceDropNow = noQuestLastKill || killsSince >= TBALL_KEY_FORCE_KILL
      const canDrop = killsSince >= TBALL_KEY_MIN_KILLS
      if (forceDropNow || (canDrop && Math.random() < TBALL_KEY_DROP_CHANCE)) {
        g.viejoDogState = "key_dropped"
        const keyDir = g.pl.x < e.x + e.w / 2 ? 1 : -1
        g.pickups.push({
          id: "tball_key", kind: "tball_key",
          x: e.x + e.w / 2 + keyDir * 120,
          y: e.y + e.h * 0.2,   // ligeramente por encima del suelo del enemigo
          active: true, floatPhase: 0,
          spawnTimer: 1.0        // 1s antes de que sea recogible
        })
        spawnExplosion(g, e.x + e.w / 2, e.y + e.h / 2, ["#FFD700", "#FFA500", "#FFFFFF", "#FFE066"], 18, 5, true)
        triggerShake(g, 8, 0.5)
        g.abilityNotif = { text: "¡MEDIA LLAVE! ¡Llévala a Rex el Viejo!", timer: 5.5 }
        saveGame(g)
      }
    }
  }
  // ── Notificación de celular cuando el último enemigo de una sección muere ──
  const ew = e.world ?? 0
  const _triggerPhoneAnim = (kind: "p1" | "section2" | "p2" | "ultra") => {
    const now_ms = Date.now()
    // Siempre sobreescribir: si había un phone activo, reiniciar con el nuevo
    g.rexPhoneNotif = { kind, timer: 20.0, setAt: now_ms }
    // Reiniciar animación de Luly solo si no estaba ya en el celular
    if (!g.pl.usingPhone) {
      g.pl.usingPhone = true
      g.pl.pf = 0
    }
  }
  // Trigger 1: todos los regulares P1 muertos → celular sobre El Castigador
  if (!e.boss) {
    if (areRegularP1EnemiesDead(g, ew) && !g.p1BossRexSeen && !g.rexPhoneNotif)
      _triggerPhoneAnim("p1")
    // Trigger 3: todos los regulares P2 muertos → celular sobre El Herrero
    else if (areRegularP2EnemiesDead(g, ew) && !g.p2BossRexSeen && !g.rexPhoneNotif)
      _triggerPhoneAnim("p2")
  }
  if (e.boss) {
    const bParts = e.originalId.split("_")
    const bC = parseInt(bParts[1]), bR = parseInt(bParts[2])
    const [p1c, p1r] = WORLD_P1_BOSS[ew]
    const [p2c, p2r] = WORLD_P2_BOSS[ew]
    // Trigger 2: Castigador muerto → celular sobre la segunda sección
    if (bC === p1c && bR === p1r && !g.rexSection2Notified) {
      g.rexSection2Notified = true
      _triggerPhoneAnim("section2")
    }
    // ── Recompensa al matar El Castigador (solo W0): stamina mejorada ─────────
    if (bC === p1c && bR === p1r && ew === 0 && !g.staminaUp) {
      g.staminaUp = true
      g.pl.maxStamina = 150       // 100 → 150: +50% de resistencia (más tiempo corriendo)
      g.pl.stamina = 150          // refill completo al recibir el buff
      g.abilityNotif = { text: "¡Resistencia mejorada! Ahora podrás correr más 🏃", timer: 5.5 }
      saveGame(g)
    }
    // Trigger 4: Herrero muerto → celular sobre el último jefe (sin revelar nombre)
    if (bC === p2c && bR === p2r && !g.ultraBossRexSeen) {
      _triggerPhoneAnim("ultra")
    }
  }
}

// Helper global para saber si un spawn está muerto (tolerante a adopciones)
export function isSpawnDead(dead: Set<string>, w: number, c: number, r: number, i: number): boolean {
  const eid = `${rid(w, c, r)}_${i}`
  if (dead.has(eid)) return true
  for (const id of dead) {
    if (id === eid || id.startsWith(eid + "_") || id.includes(`_adopted_${eid}`)) return true
  }
  return false
}

export function checkWorldClear(g: G, w: number) {
  if (g.cw.has(w)) return
  // Mundo completado cuando el Ultra-Jefe [TRANSIT_BOSS_COL, TROW] está muerto
  const sp = getEnemySpawns(w, TRANSIT_BOSS_COL, TROW)
  const ultraDead = sp.length > 0 && sp.every((_, i) => isSpawnDead(g.dead, w, TRANSIT_BOSS_COL, TROW, i))
  if (ultraDead) { g.cw.add(w); saveGame(g); if (g.cw.size >= NW) setTimeout(() => { g.won = true }, 1200) }
}

// Helper: todos los enemigos NORMALES de la Part1 (rows 0..TROW-1) están muertos
export function areRegularP1EnemiesDead(g: G, w: number): boolean {
  if (g.noEnemies) return true   // modo dev sin enemigos → puertas de boss abiertas
  const [p1c, p1r] = WORLD_P1_BOSS[w]
  for (let c = 0; c < NC; c++) for (let r = 0; r < TROW; r++) {
    if (c === p1c && r === p1r) continue  // ignorar sala boss P1
    const sp = getEnemySpawns(w, c, r)
    for (let i = 0; i < sp.length; i++) {
      if (!isSpawnDead(g.dead, w, c, r, i)) return false
    }
  }
  return true
}

// Helper: todos los enemigos NORMALES de la Part2 (rows TROW+1..NR-1) están muertos
export function areRegularP2EnemiesDead(g: G, w: number): boolean {
  if (g.noEnemies) return true   // modo dev sin enemigos → puertas de boss abiertas
  const [p2c, p2r] = WORLD_P2_BOSS[w]
  for (let c = 0; c < NC; c++) for (let r = TROW + 1; r < NR; r++) {
    if (c === p2c && r === p2r) continue  // ignorar sala boss P2
    const sp = getEnemySpawns(w, c, r)
    for (let i = 0; i < sp.length; i++) {
      if (!isSpawnDead(g.dead, w, c, r, i)) return false
    }
  }
  return true
}

// Helper: todos los enemigos normales (no boss) del mundo w están muertos (legacy)
export function areRegularEnemiesDead(g: G, w: number): boolean {
  const [p1c, p1r] = WORLD_P1_BOSS[w]
  const [p2c, p2r] = WORLD_P2_BOSS[w]
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    if (r === TROW) continue
    if (c === p1c && r === p1r) continue
    if (c === p2c && r === p2r) continue
    if (c === TRANSIT_BOSS_COL && r === TROW) continue
    const sp = getEnemySpawns(w, c, r)
    for (let i = 0; i < sp.length; i++) {
      if (!isSpawnDead(g.dead, w, c, r, i)) return false
    }
  }
  return true
}

export function isPart1BossDead(g: G, w: number): boolean {
  const [p1c, p1r] = WORLD_P1_BOSS[w]
  const sp = getEnemySpawns(w, p1c, p1r)
  return sp.every((_, i) => isSpawnDead(g.dead, w, p1c, p1r, i))
}

export function isPart2BossDead(g: G, w: number): boolean {
  const [p2c, p2r] = WORLD_P2_BOSS[w]
  const sp = getEnemySpawns(w, p2c, p2r)
  return sp.every((_, i) => isSpawnDead(g.dead, w, p2c, p2r, i))
}

export function isUltraBossDead(g: G, w: number): boolean {
  const sp = getEnemySpawns(w, TRANSIT_BOSS_COL, TROW)
  return sp.length > 0 && sp.every((_, i) => isSpawnDead(g.dead, w, TRANSIT_BOSS_COL, TROW, i))
}

// ── Enemy section / boss type helpers ────────────────────────────────────────
export function enemySection(e: Enemy): "f" | "s" {
  const row = parseInt(e.id.split("_")[2]) || 0
  return row < TROW ? "f" : "s"
}

export function getBossSection(e: Enemy): "fs" | "ss" | "fb" {
  const row = parseInt(e.id.split("_")[2]) || 0
  if (row < TROW) return "fs"   // First Section boss
  if (row === TROW) return "fb" // Transit/Final boss (row=TROW, col=TRANSIT_BOSS_COL)
  return "ss"                   // Second Section boss
}

export function isW1P1Boss(e: Enemy): boolean {
  return e.boss && e.world === 0 && getBossSection(e) === "fs"
}

export function isW1P2Boss(e: Enemy): boolean {
  return e.boss && e.world === 0 && getBossSection(e) === "ss"
}

export function isUltraBoss(e: Enemy): boolean {
  return e.boss && getBossSection(e) === "fb"
}

export function breakCrate(g: G, c: Crate) {
  c.active = false; g.dead.add(`crate_${c.id}`)
  const cx2 = c.x + c.w / 2, cy2 = c.y

  // Fragmentos: siempre salen
  for (let i = 0; i < 8; i++) {
    const a = (Math.random() - .5) * Math.PI * 1.4, spd = 3 + Math.random() * 2
    g.bones.push({ x: cx2 + (Math.random() - .5) * 20, y: cy2, w: 11, h: 11, vx: Math.cos(a) * spd, vy: -Math.abs(Math.sin(a) * spd) - 1, active: true, life: 12 })
  }

  const drop = (k: "h" | "a" | "tba" | "c") =>
    g.drops.push({ x: cx2 + (Math.random() - .5) * 24, y: cy2 - 4, vx: (Math.random() - .5) * 2, vy: -3.5 - Math.random() * 1.2, active: true, life: 20, kind: k })

  // Drop aleatorio puro:
  //  0–34 %  → corazón
  // 35–69 %  → munición
  // 70–84 %  → corazón + munición
  // 85–99 %  → caja vacía (solo fragmentos)
  const roll = Math.random()
  if      (roll < 0.35) { drop("h") }
  else if (roll < 0.70) { drop("a") }
  else if (roll < 0.85) { drop("h"); drop("a") }
  // else: solo fragmentos

  // 65 % de chance de soltar 1 croqueta (independiente del drop principal)
  if (Math.random() < 0.65) drop("c")

  // Bonus: si el jugador tiene tball y le falta munición, 25 % de chance extra
  if (g.abilities.has("tball") && g.tballAmmo < (g.tballUpgraded ? TB_AMMO_MAX : TB_AMMO_INIT) && Math.random() < 0.25) {
    drop("tba")
  }
}

export function tickProjs(g: G) {
  const p = g.pl
  for (const pr of g.projs) {
    if (!pr.active) continue
    pr.life -= STEP; if (pr.life <= 0) { if (!pr.pl) spawnExplosion(g, pr.x, pr.y, ["#FF6600", "#CC4400"], 4, 1.8, false); pr.active = false; continue }
    if (pr.pl) { pr.vy += PROJ_GRAV; pr.rot += 8 * (pr.vx > 0 ? 1 : -1) }
    pr.x += pr.vx; pr.y += pr.vy
    if (pr.pl) { pr.dist = Math.sqrt((pr.x - pr.ox) ** 2 + (pr.y - pr.oy) ** 2); if (pr.dist > PROJ_MAXD) { pr.active = false; continue } }
    if (pr.x < 0 || pr.x > TOT_W || pr.y < 0 || pr.y > TOT_H) { pr.active = false; if (!pr.pl) spawnExplosion(g, pr.x, pr.y, ["#FF6600", "#FF9900"], 5, 2.5, false); continue }
    for (const pl of activePlats(g)) {
      if (pl.mode === "t") continue
      if (pr.x > pl.x - 6 && pr.x < pl.x + pl.w + 6 && pr.y > pl.y - 6 && pr.y < pl.y + pl.h + 6) {
        if (!pr.pl) spawnExplosion(g, pr.x, pr.y, ["#FF6600", "#FF9900", "#FFCC44"], 6, 2.8, false)
        pr.active = false; break
      }
    }
    if (!pr.active) continue
    if (!pr.pl) {
      const phx = p.x + PL_HBX + 6, phy = p.y + PL_HBT + 6, phw = p.w - 2 * PL_HBX - 12, phh = p.h - PL_HBT - 12
      if (p.inv <= 0 && pr.x > phx && pr.x < phx + phw && pr.y > phy && pr.y < phy + phh) {
        pr.active = false
        spawnExplosion(g, pr.x, pr.y, ["#FF4400", "#FF8800", "#FFCC00", "#FF2200"], 12, 4.5, true)
        dmgPlayer(g, 2); continue  // ataque 2 (proyectil) = 1 corazón completo
      }
    }
    if (pr.pl) {
      const PR = 9
      // ── Esquiva de enemigos ante proyectiles desviados ─────────────────
      if (pr.parried) {
        for (const e of g.enemies) {
          if (!e.active || e.dying) continue
          const ex = e.x + e.w / 2, ey = e.y + e.h / 2
          const dist = Math.sqrt((pr.x - ex) ** 2 + (pr.y - ey) ** 2)
          const approaching = (pr.vx > 0 ? pr.x < ex : pr.x > ex)
          if (dist < 180 && approaching) {
            // Intento de esquiva: saltar o correr al lado opuesto
            if (e.vy === 0 && Math.random() < 0.08) e.vy = -9  // salto de esquiva
            e.vx = (pr.x < ex ? 2.5 : -2.5)  // correr en dirección contraria
          }
        }
      }
      for (const e of g.enemies) {
        if (!e.active || e.dying) continue
        const ecx = e.x + EN_HBX, ecy = e.y + EN_HBT, ecw = e.w - 2 * EN_HBX, ech = e.h - EN_HBT
        const nearX = Math.max(ecx, Math.min(pr.x, ecx + ecw)), nearY = Math.max(ecy, Math.min(pr.y, ecy + ech))
        if ((pr.x - nearX) ** 2 + (pr.y - nearY) ** 2 < PR * PR) {
          pr.active = false
          // Proyectil desviado: daño mínimo = mitad del HP máximo del enemigo
          const dmg = pr.parried ? Math.max(1, Math.ceil(e.mhp * 0.5)) : 1
          dmgEnemy(g, e, dmg)
          if (pr.parried) spawnExplosion(g, pr.x, pr.y, ["#FFFFFF", "#FF8800", "#FFFF00"], 12, 5, false)
          break
        }
      }
      if (!pr.active) continue
      for (const c of g.crates) {
        if (!c.active) continue
        if (pr.x + PR > c.x && pr.x - PR < c.x + c.w && pr.y + PR > c.y && pr.y - PR < c.y + c.h) { pr.active = false; breakCrate(g, c); break }
      }
    }
  }
  g.projs = g.projs.filter(pr => pr.active)
}

export function segAABB(ax: number, ay: number, bx: number, by: number, rx: number, ry: number, rw: number, rh: number): number {
  const dx = bx - ax, dy = by - ay
  let tMin = 0, tMax = 1
  const check = (o: number, d2: number, lo: number, hi: number) => {
    if (Math.abs(d2) < 1e-9) { return o >= lo && o <= hi }
    const t1 = (lo - o) / d2, t2 = (hi - o) / d2
    tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2))
    return tMin <= tMax
  }
  if (!check(ax, dx, rx, rx + rw)) return Infinity
  if (!check(ay, dy, ry, ry + rh)) return Infinity
  return tMin <= tMax ? tMin : Infinity
}

export function tickWhip(g: G) {
  const w = g.whip; if (!w) return
  const p = g.pl, d = { x: w.ex - w.x, y: w.ey - w.y }, len = Math.sqrt(d.x * d.x + d.y * d.y) || 1
  w.x = p.x + p.w / 2; w.y = p.y + p.h / 2
  const tx = w.x + d.x / len * WLEN, ty = w.y + d.y / len * WLEN
  let bestT = 1.0
  for (const pl of activePlats(g)) {
    if (pl.mode !== "s") continue
    const t2 = segAABB(w.x, w.y, tx, ty, pl.x, pl.y, pl.w, pl.h)
    if (t2 < bestT) bestT = t2
  }
  const back = Math.max(0, bestT - 2 / WLEN)
  w.ex = w.x + (tx - w.x) * back; w.ey = w.y + (ty - w.y) * back
  const mg = 22, wx = Math.min(w.x, w.ex) - mg, wy = Math.min(w.y, w.ey) - mg, ww = Math.abs(w.ex - w.x) + mg * 2, wh = Math.abs(w.ey - w.y) + mg * 2
  // ── PARRY: desviar proyectiles enemigos con el látigo ─────────────────
  let parried = false
  for (const pr of g.projs) {
    if (!pr.active || pr.pl) continue  // solo projs enemigos
    if (pr.x > wx && pr.x < wx + ww && pr.y > wy && pr.y < wy + wh) {
      const staCost = p.maxStamina * 0.5
      if (p.exhausted) break  // sin stamina, no se puede desviar
      p.stamina = Math.max(0, p.stamina - staCost)
      if (p.stamina <= 0) { p.exhausted = true; p.staminaCooldown = 4.5 }
      // Convertir en proyectil del jugador con dirección revertida y reforzada
      const spd = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy) * 1.3 + 2
      const ang = Math.atan2(-pr.vy, -pr.vx)  // dirección opuesta
      pr.pl = true; pr.parried = true
      pr.vx = Math.cos(ang) * spd; pr.vy = Math.sin(ang) * spd
      pr.life = 4; pr.dist = 0; pr.ox = pr.x; pr.oy = pr.y
      spawnExplosion(g, pr.x, pr.y, ["#FFFFFF", "#88FFFF", "#FFFF88"], 8, 3.5, false)
      parried = true
    }
  }
  if (!w.dealt && !parried) {
    for (const e of g.enemies) {
      if (!e.active || e.dying) continue
      const ecx = e.x + EN_HBX, ecy = e.y + EN_HBT, ecw = e.w - 2 * EN_HBX, ech = e.h - EN_HBT
      if (ecx < wx + ww && ecx + ecw > wx && ecy < wy + wh && ecy + ech > wy) { dmgEnemy(g, e, WDMG); w.dealt = true; break }
    }
    if (!w.dealt) for (const c of g.crates) { if (!c.active) continue; if (c.x < wx + ww && c.x + c.w > wx && c.y < wy + wh && c.y + c.h > wy) { breakCrate(g, c); w.dealt = true; break } }
  }
  w.life -= STEP; if (w.life <= 0) g.whip = null
}

export function tickBones(g: G) {
  const p = g.pl
  for (const b of g.bones) {
    if (!b.active) continue
    b.life -= STEP; if (b.life <= 0) { b.active = false; continue }
    b.vy += GDN * .5; if (b.vy > 8) b.vy = 8; b.x += b.vx; b.y += b.vy
    for (const pl of activePlats(g)) { if (pl.mode === "t" || pl.mode === "d") continue; if (b.vy >= 0 && b.y + b.h >= pl.y && b.y + b.h <= pl.y + pl.h + 2 && b.x + b.w > pl.x && b.x < pl.x + pl.w) { b.y = pl.y - b.h; b.vy = 0; b.vx *= .85 } }
    if (b.y + b.h > TOT_H) { b.y = TOT_H - b.h; b.vy = 0 }
    if (Math.abs(b.x - p.x) < p.w && Math.abs(b.y - p.y) < p.h) { g.score += 10; b.active = false }
  }
  g.bones = g.bones.filter(b => b.active)
}

export function tickDrops(g: G) {
  const p = g.pl, plats = activePlats(g).filter(pl => pl.mode !== "d")
  for (const d of g.drops) {
    if (!d.active) continue
    d.life -= STEP; if (d.life <= 0) { d.active = false; continue }
    d.vy += GDN * .5; if (d.vy > 8) d.vy = 8; d.x += d.vx; d.y += d.vy
    if (d.vy >= 0) {
      let bestY = TOT_H + 999
      for (const pl of plats) { if (d.x + 14 > pl.x && d.x + 4 < pl.x + pl.w && d.y + 18 >= pl.y && d.y + 18 <= pl.y + pl.h + 8 && pl.y < bestY) bestY = pl.y }
      if (bestY < TOT_H + 999) { d.y = bestY - 18; d.vy = 0; d.vx *= 0.75 }
    }
    if (d.y + 18 >= TOT_H) { d.y = TOT_H - 18; d.vy = 0 }
    if (p.x < d.x + 18 && p.x + p.w > d.x && p.y < d.y + 18 && p.y + p.h > d.y) {
      if (d.kind === "h") p.hp = Math.min(p.maxHp, p.hp + 1)
      else if (d.kind === "a") p.ammo = Math.min(15, p.ammo + 10)
      else if (d.kind === "tba") g.tballAmmo = Math.min(g.tballUpgraded ? TB_AMMO_MAX : TB_AMMO_INIT, g.tballAmmo + TB_AMMO_DROP)
      else if (d.kind === "c") { g.score += 50; g.croquetas++ }
      d.active = false
    }
  }
  g.drops = g.drops.filter(d => d.active)
}


// ══════════════════════════════════════════════════════════════
//  SPAWN HELPERS (usados por mkEnemiesForWorld y tickEnemies)
// ══════════════════════════════════════════════════════════════
export function getShaftRangesX(w: number, c: number, r: number): { x0: number; x1: number }[] {
  const { x: x0 } = ro(w, c, r)
  const d = computeDoors(w, c, r)
  const ranges: { x0: number; x1: number }[] = []
  const hw = TUN_V_WIDTH[w] / 2 + 20  // margen extra

  if (d.U) {
    const mx = x0 + udDoorX_rel(w, c, r - 1) + DW / 2
    ranges.push({ x0: mx - hw, x1: mx + hw })
  }
  if (d.D) {
    const mx = x0 + udDoorX_rel(w, c, r) + DW / 2
    ranges.push({ x0: mx - hw, x1: mx + hw })
  }
  return ranges
}

// Retorna true si la posición X (con ancho eW) está dentro de un shaft
export function isInShaft(px: number, eW: number, shafts: { x0: number; x1: number }[]): boolean {
  for (const s of shafts) {
    if (px + eW > s.x0 && px < s.x1) return true
  }
  return false
}

// Retorna true si hay un hueco (shaft o vacío) justo al frente del enemigo
export function voidAhead(e: Enemy, dir: number, g: G, shafts: { x0: number; x1: number }[]): boolean {
  const footY = e.y + e.h

  // Shaft: solo esquivar si el centro del enemigo ya estaría dentro, no en el borde
  const centerX = dir > 0 ? (e.x + e.w + e.w * 0.4) : (e.x - e.w * 0.4)
  if (isInShaft(centerX, 2, shafts)) return true

  // Hueco real: tres sondas escalonadas para no fallar en bordes de escalones
  const probePoints = [
    dir > 0 ? (e.x + e.w + 4) : (e.x - 4),
    dir > 0 ? (e.x + e.w + 14) : (e.x - 14),
    dir > 0 ? (e.x + e.w + 24) : (e.x - 24),
  ]
  // Solo es hueco si las primeras DOS sondas no tienen suelo
  let misses = 0
  for (const px of probePoints.slice(0, 2)) {
    const hasFloor = activePlats(g).some(pl =>
      pl.mode === "s" &&
      px > pl.x && px < pl.x + pl.w &&
      pl.y >= footY - 4 && pl.y <= footY + 36
    )
    if (!hasFloor) misses++
  }
  return misses >= 2
}

// Devuelve los rangos X seguros para spawn dentro del túnel horizontal,
// excluyendo zonas de shafts verticales (conexiones arriba/abajo)
export function getSafeSpawnRangesX(w: number, c: number, r: number, eW: number): { x0: number; x1: number }[] {
  const { x: x0 } = ro(w, c, r)
  const iL = x0 + WT + 4
  const iR = x0 + RW - WT - eW - 4

  const shafts = getShaftRangesX(w, c, r)
  // Expandir margen de exclusión para spawn
  const excluded = shafts.map(s => ({
    x0: s.x0 - (eW + 16),
    x1: s.x1 + (eW + 16)
  }))

  const ranges: { x0: number; x1: number }[] = [{ x0: iL, x1: iR }]
  for (const ex of excluded) {
    const next: { x0: number; x1: number }[] = []
    for (const seg of ranges) {
      if (ex.x1 <= seg.x0 || ex.x0 >= seg.x1) {
        next.push(seg)
      } else {
        if (ex.x0 - seg.x0 > eW * 2) next.push({ x0: seg.x0, x1: ex.x0 })
        if (seg.x1 - ex.x1 > eW * 2) next.push({ x0: ex.x1, x1: seg.x1 })
      }
    }
    ranges.length = 0; ranges.push(...next)
  }
  return ranges
}

export function mkEnemiesForWorld(w: number, dead: Set<string>): Enemy[] {
  const es: Enemy[] = []
  const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 } }

  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const { x: x0, y: y0 } = ro(w, c, r)
    const spawns = getEnemySpawns(w, c, r)
    if (spawns.length === 0) continue

    const rand = rng(w * 10000 + c * 1000 + r * 100 + (Date.now() % 97))
    const { chanBot } = getRoomChannelBounds(w, c, r)
    const usedX: number[] = []
    const worldPlats = getWorldPlats(w)  // ← usa plats del mundo específico

    spawns.forEach((sp, i) => {
      const eid = `${rid(w, c, r)}_${i}`
      if (dead.has(eid)) return
      const [, , hp, spd, cd, boss] = sp
      // W1 Second Section (world=0, row≥TROW): tamaño similar a Luly
      const isW1S2spawn = w === 0 && r >= TROW && !boss
      // W1 P1 boss: tamaño moderado (un poco más grande que Luly)
      const [bp1cs, bp1rs] = WORLD_P1_BOSS[w]
      const isW1P1bossSpawn = boss && w === 0 && c === bp1cs && r === bp1rs
      const [bp2cs, bp2rs] = WORLD_P2_BOSS[w]
      const isW1P2bossSpawn = boss && w === 0 && c === bp2cs && r === bp2rs
      const isUltraBossSpawn = boss && c === TRANSIT_BOSS_COL && r === TROW
      const eW = boss ? (isW1P1bossSpawn ? W1P1_BW : isW1P2bossSpawn ? W1P2_BW : isUltraBossSpawn ? UB_W : BW) : (isW1S2spawn ? 60 : EW)
      const eH = boss ? (isW1P1bossSpawn ? W1P1_BH : isW1P2bossSpawn ? W1P2_BH : isUltraBossSpawn ? UB_H : BH) : (isW1S2spawn ? 72 : EH)

      // Para jefes: ignorar exclusión de shafts (su sala siempre tiene espacio suficiente)
      // y validar posición al nivel del PISO en vez del canal (chanBot puede estar
      // cerca del techo en salas como [8,1], bloqueando todos los intentos).
      const rawRanges = getSafeSpawnRangesX(w, c, r, eW)
      const safeRanges = boss
        ? [{ x0: x0 + WT + 4, x1: x0 + RW - WT - eW - 4 }]  // ancho completo para bosses
        : rawRanges
      if (safeRanges.length === 0) return

      const totalW = safeRanges.reduce((acc, s) => acc + (s.x1 - s.x0), 0)
      if (totalW <= 0) return

      // testY para validación: para jefes usar el piso real; para normales usar chanBot
      const spawnTestY = boss ? (y0 + RH - WT - eH + EN_HBT - 4) : (chanBot - eH + EN_HBT)

      let ex = -1, tries = 0
      while (tries < 30) {
        let pick = rand() * totalW, chosen = safeRanges[0]
        for (const seg of safeRanges) {
          const sw = seg.x1 - seg.x0
          if (pick <= sw) { chosen = seg; break }
          pick -= sw
        }
        const candidate = chosen.x0 + Math.floor(rand() * (chosen.x1 - chosen.x0))
        const tooClose = usedX.some(ux => Math.abs(ux - candidate) < eW * 1.6)
        if (!tooClose) {
          const testX = candidate + EN_HBX
          const testW = eW - 2 * EN_HBX
          const testH = eH - EN_HBT
          // Solo verifica colisión con plats del mundo actual
          const inside = worldPlats.some(p =>
            p.mode === "s" &&
            testX < p.x + p.w && testX + testW > p.x &&
            spawnTestY < p.y + p.h && spawnTestY + testH > p.y
          )
          if (!inside) { ex = candidate; break }
        }
        tries++
      }
      if (ex < 0) {
        if (boss) {
          // Fallback seguro para jefes: centro de la sala
          ex = x0 + Math.floor(RW / 2) - Math.floor(eW / 2)
        } else {
          dead.add(`${rid(w, c, r)}_${i}`)  // spawn fantasma: nunca existió, nunca puede morir
          return
        }
      }

      usedX.push(ex)
      // Jefes: siempre en el piso real de la sala (chanBot puede estar muy arriba si
      // la única puerta está en el techo, dejando al boss fuera del viewport).
      const safeFloor = boss ? (y0 + RH - WT - eH - 4) : (chanBot - eH - 2)
      const tunLeft = x0 + WT + 6
      const tunRight = x0 + RW - WT - eW - 6

      es.push({
        id: eid, originalId: eid, x: ex, y: safeFloor,
        w: eW, h: eH,
        vx: 0, vy: 0, hp, mhp: hp,
        dir: rand() > .5 ? 1 : -1,
        p0: tunLeft, p1: tunRight,
        spd, cd,
        ls: Math.floor(rand() * cd * 0.5), sa: 0,
        active: true, boss, ef: 0, eft: 0, world: w,
        state: "patrol", alert: false, alertT: 0, guardX: boss ? (x0 + Math.floor(RW / 2) - Math.floor(eW / 2)) : -1,
        idleT: Math.floor(rand() * 500), jumpCd: 0,
        dying: false, deathTimer: 0, deathDir: 1, deathFalling: false,
        hurtTimer: 0, isMoving: false, alertDelay: 0, phase: 1,
        ls2: 0, chainHit: null,
        spinTimer: 0, stunTimer: 0, spinHitMound: false, atkPending: false,
      })
    })
  }
  return es
}

export function mkCratesForWorld(w: number, dead: Set<string>): Crate[] {
  return getWorldCrateDefs(w)
    .filter(c => !dead.has(`crate_${c.id}`))
    .map(c => ({ ...c, active: true }))
}

// ── mkPlayer: estado inicial del jugador
export function mkPlayer(): Player {
  const [sw, sc, sr] = PLAYER_START; const { x: x0, y: y0 } = ro(sw, sc, sr)
  return { x: x0 + 80, y: y0 + RH - WT - PH, w: PW, h: PH, vx: 0, vy: 0, onGround: false, facing: 1, hp: 10, maxHp: 10, inv: 0, ammo: 15, ls: 0, as2: 0, sh: false, jh: false, djump: false, djumpAvail: false, wh: false, wcd: 0, pf: 0, pft: 0, pa: "idle", crouching: false, stamina: 100, maxStamina: 100, staminaCooldown: 0, exhausted: false, runMode: false, tapLeft: 0, tapRight: 0, tapDown: 0, dropThruPlatform: false, dash: false, dashCd: 0, dashDir: 1 as (1 | -1), dashTimer: 0, wallSliding: false, wallDir: 0 as (0 | 1 | -1), wallJumpCd: 0, usingPhone: false, atkLock: 0 }
}

