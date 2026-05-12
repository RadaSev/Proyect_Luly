// ══════════════════════════════════════════════════════════════
//  INIT / WORLD MANAGEMENT — game/init.ts
//  mkG_lazy, loadWorld, suspendWorld, applyLoad, activateWorld,
//  tickCamera, tickWorldAnim
// ══════════════════════════════════════════════════════════════
import type { G, WorldSnapshot } from "./types"
import type { LulySave } from "./save"
import {
  CW, CH, RW, RH, NC, NW, NR, TROW, WT, PW, PH,
  TOT_W, TOT_H, STEP,
  PLAYER_START, WORLD_NAMES, WORLD_SUBS,
  WORLD_P1_BOSS, WORLD_P2_BOSS, TRANSIT_BOSS_COL,
  TBALL_PICKUP_POS,
  KENNEL_WORLD_POS,
  ro,
} from "./constants"
import { getWorldPlats } from "./world_gen"
import { ALL_CPS } from "./world_gen"
import {
  mkPlayer, mkEnemiesForWorld, mkCratesForWorld,
  clearActivePlatsCache,
  areRegularP1EnemiesDead, areRegularP2EnemiesDead,
  isPart1BossDead, isPart2BossDead,
} from "./physics"
import { saveGame } from "./save"

// ── World loading / suspension ────────────────────────────────────────────────

export function loadWorld(g: G, w: number) {
  if (g.loadedWorlds.has(w)) return  // ya está cargado

  // Generar geometría si no existe
  getWorldPlats(w)

  const snap = g.worldSnapshots.get(w)
  if (snap) {
    // Restaurar estado previo (enemigos vivos, cajas sin romper)
    g.enemies.push(...snap.enemies)
    g.crates.push(...snap.crates)
    // Integrar muertos y explorados del snapshot al estado global
    for (const id of snap.dead) g.dead.add(id)
    for (const id of snap.explored) g.explored.add(id)
  } else {
    // Primera vez: generar desde cero con el estado global de muertos
    const deadForWorld = new Set([...g.dead].filter(id => {
      if (id.startsWith("crate_")) return true  // cajas son globales
      const parts = id.split("_")
      return parts.length >= 1 && parseInt(parts[0]) === w
    }))
    g.enemies.push(...mkEnemiesForWorld(w, deadForWorld))
    g.crates.push(...mkCratesForWorld(w, deadForWorld))
    for (const id of deadForWorld) g.dead.add(id)
  }

  g.loadedWorlds.add(w)
  // Invalidar cache de plataformas
  clearActivePlatsCache()
}

export function suspendWorld(g: G, w: number) {
  if (!g.loadedWorlds.has(w)) return

  // Extraer enemigos y cajas de este mundo
  const worldEnemies = g.enemies.filter(e => e.world === w)
  const worldCrates = g.crates.filter(c => {
    const wOfCrate = Math.max(0, Math.min(Math.floor(c.x / (NC * RW)), NW - 1))
    return wOfCrate === w
  })

  // Guardar explorados de este mundo
  const worldExplored = new Set([...g.explored].filter(k => k.startsWith(`${w}_`)))
  // Guardar muertos de este mundo
  const worldDead = new Set([...g.dead].filter(id => {
    const parts = id.split("_")
    return parts.length >= 1 && parseInt(parts[0]) === w
  }))

  g.worldSnapshots.set(w, {
    enemies: worldEnemies,
    crates: worldCrates,
    dead: worldDead,
    explored: worldExplored,
  })

  // Quitar del estado activo
  g.enemies = g.enemies.filter(e => e.world !== w)
  g.crates = g.crates.filter(c => {
    const wOfCrate = Math.max(0, Math.min(Math.floor(c.x / (NC * RW)), NW - 1))
    return wOfCrate !== w
  })

  g.loadedWorlds.delete(w)
  // Invalidar cache
  clearActivePlatsCache()
}

export function applyLoad(g: G, s: LulySave): void {
  g.score = s.score; g.lives = s.lives; g.kills = s.kills || 0
  g.pl.hp = s.hp; g.pl.maxHp = s.maxHp; g.pl.ammo = s.ammo
  g.tballAmmo = s.tballAmmo ?? 0
  g.checkpoint = { ...s.checkpoint }
  g.pl.x = s.checkpoint.x; g.pl.y = s.checkpoint.y
  g.dead = new Set(s.dead); g.explored = new Set(s.explored)
  g.discoveredCPs = new Set(s.discoveredCPs)
  g.cw = new Set(s.cw as number[]); g.abilities = new Set(s.abilities)
  // Restaurar pickups recogidos y boss CPs recompensados
  if (s.pickedUpItems) for (const id of s.pickedUpItems) { const p = g.pickups.find(pk => pk.id === id); if (p) p.active = false }
  g.bossRewardedCPs = new Set(s.bossRewardedCPs || [])
  g.viejoDogState = (s.viejoDogState as G["viejoDogState"]) || "waiting"
  g.tballKeyHeld = s.tballKeyHeld ?? false
  g.questKillBaseline = s.questKillBaseline ?? 0
  g.rexBallFirstSeen = (s as any).rexBallFirstSeen ?? false
  g.rexIntroLeft  = (s as any).rexIntroLeft  ?? false
  g.rexBatonHeld           = s.rexBatonHeld           ?? false
  g.tballUpgraded          = s.tballUpgraded          ?? false
  g.rexBatonDeliveredSeen  = s.rexBatonDeliveredSeen  ?? false
  g.rexUltraDoneSeen       = s.rexUltraDoneSeen       ?? false
  g.p1BossRexSeen          = s.p1BossRexSeen          ?? false
  g.p2BossRexSeen          = s.p2BossRexSeen          ?? false
  g.ultraBossRexSeen       = s.ultraBossRexSeen        ?? false
  g.croquetas              = s.croquetas               ?? 0
  g.bolkhaAppearedOnce     = s.bolkhaAppearedOnce      ?? false
  g.bolkhaRexTold          = s.bolkhaRexTold           ?? false
  g.bolkhaMetDialogSeen    = s.bolkhaMetDialogSeen     ?? false
  g.rexKeyAnimTimer        = s.rexKeyAnimTimer         ?? 0
  g.rexPhoneNotif          = null
  // Si el estado guardado es "key_dropped" pero la llave ya no está activa, volver a spawnarla
  if (g.viejoDogState === "key_dropped" && !g.pickups.find(p => p.id === "tball_key" && p.active)) {
    // Ubicar llave cerca de donde está la jaula (pickup secundario de emergencia)
    g.pickups.push({ id: "tball_key", kind: "tball_key", x: TBALL_PICKUP_POS.x + 80, y: TBALL_PICKUP_POS.y, active: true, floatPhase: 0 })
  }
  // Restaurar poder activo según habilidades guardadas
  if (g.abilities.has("tball")) g.activePower = "tball"
  // Reload worlds with the restored dead set
  g.loadedWorlds.clear(); g.enemies = []; g.crates = []
  loadWorld(g, 0)
  const tw = s.checkpoint.w; if (tw !== 0) loadWorld(g, tw)
  // Center camera on checkpoint
  g.cx = s.checkpoint.x - CW / 2; g.cy = s.checkpoint.y - CH / 2
}

// Activa un mundo y pone en stand-by el actual (si es diferente).
// Llama esto al cruzar una puerta o al teletransportar con dev map.
export function activateWorld(g: G, newWorld: number) {
  const currentWorlds = [...g.loadedWorlds]
  for (const w of currentWorlds) {
    if (w !== newWorld) suspendWorld(g, w)
  }
  loadWorld(g, newWorld)
}

export function tickCamera(g: G) {
  const p = g.pl
  const sc = g.mobileZoom === "close" ? 1.35 : 1.0
  const vpW = CW / sc, vpH = CH / sc
  const activeW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const minCX = activeW * NC * RW
  const maxCX = Math.max(minCX, (activeW + 1) * NC * RW - vpW)
  g.cx = Math.max(minCX, Math.min(g.cx, maxCX))
  g.cx += (p.x + p.w / 2 - vpW / 2 - g.cx) * 0.10
  g.cy += (p.y + p.h / 2 - vpH / 2 - g.cy) * 0.10
  g.cx = Math.max(0, Math.min(g.cx, TOT_W - vpW))
  g.cy = Math.max(0, Math.min(g.cy, TOT_H - vpH))
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  g.explored.add(`${curW}_${curC}_${curR}`)
  // Revelar salas de jefes en el mapa en cuanto se abran sus puertas
  if (areRegularP1EnemiesDead(g, curW)) {
    const [p1c, p1r] = WORLD_P1_BOSS[curW]
    g.explored.add(`${curW}_${p1c}_${p1r}`)
  }
  if (areRegularP2EnemiesDead(g, curW)) {
    const [p2c, p2r] = WORLD_P2_BOSS[curW]
    g.explored.add(`${curW}_${p2c}_${p2r}`)
  }
  if (isPart1BossDead(g, curW) && isPart2BossDead(g, curW)) {
    g.explored.add(`${curW}_${TRANSIT_BOSS_COL}_${TROW}`)
  }
  if (curW !== g.lastWorld) {
    activateWorld(g, curW)
    g.lastWorld = curW
    const westCP = ALL_CPS.find(cp => cp.w === curW && cp.c === 0 && cp.r === 4)
    if (westCP) { g.checkpoint = { w: curW, x: westCP.x, y: westCP.y }; g.discoveredCPs.add(westCP.id) }
    g.worldAnim = { name: WORLD_NAMES[curW], sub: WORLD_SUBS[curW], alpha: 0, phase: "in", timer: 0 }
  }
}

export function tickWorldAnim(g: G) {
  if (g.kennelMsg > 0) g.kennelMsg = Math.max(0, g.kennelMsg - STEP)
  if (!g.worldAnim) return
  const a = g.worldAnim; a.timer += STEP
  if (a.phase === "in") { a.alpha = Math.min(1, a.timer / 0.55); if (a.timer >= 0.55) { a.phase = "hold"; a.timer = 0 } }
  else if (a.phase === "hold") { if (a.timer >= 1.9) { a.phase = "out"; a.timer = 0 } }
  else { a.alpha = Math.max(0, 1 - a.timer / 0.65); if (a.timer >= 0.65) g.worldAnim = null }
}

// ── mkG_lazy ─────────────────────────────────────────────────────────────────

export function mkG_lazy(): G {
  const dead = new Set<string>()
  const kp = KENNEL_WORLD_POS
  const loadedWorlds = new Set<number>([0])

  // Pre-generar geometría del mundo 0
  getWorldPlats(0)

  const enemies0 = mkEnemiesForWorld(0, dead)
  const crates0 = mkCratesForWorld(0, dead)

  return {
    pl: mkPlayer(),
    enemies: enemies0,
    projs: [], bones: [], whip: null, drops: [],
    crates: crates0,
    cx: 0, cy: 0, keys: {}, lives: 3, score: 0, kills: 0,
    dead, cw: new Set(),
    paused: false, over: false, won: false, info: false,
    gfx: 2, autoGfx: false, fps: [], lfps: 60,
    dropThru: false, showMap: false,
    explored: new Set([`${PLAYER_START[0]}_${PLAYER_START[1]}_${PLAYER_START[2]}`]),
    checkpoint: { w: 0, x: kp[0].x, y: kp[0].y },
    lastWorld: 0, worldAnim: null, kennelMsg: 0,
    minimapLarge: false, sparks: [], gpadIdx: -1,
    devMode: false, godMode: false, infiniteAmmo: false,
    noEnemies: false, showDevMap: false, devMapWorld: 0,
    devMapCursor: { c: 0, r: 0 },
    ohko: false,

    // NUEVO: gestión de mundos lazy
    loadedWorlds,
    worldSnapshots: new Map<number, WorldSnapshot>(),

    // Metroidvania: habilidades, combo, shake, notificaciones
    abilities: new Set<string>(),
    combo: 0, comboTimer: 0,
    shakeX: 0, shakeY: 0, shakeMag: 0, shakeTimer: 0,
    abilityNotif: null,
    discoveredCPs: new Set<string>(["0_0_4"]),
    tpMenu: null,
    tpAnim: null,
    staDisplay: "circle",
    staCircleAlpha: 0,
    mobileZoom: (typeof window !== "undefined" && window.innerWidth < 900) ? "close" : "far",
    overFade: 0,
    tBalls: [],
    tballAmmo: 0,
    pickups: [{ id: "tball_w0", kind: "tball", x: TBALL_PICKUP_POS.x, y: TBALL_PICKUP_POS.y, active: true, floatPhase: 0 }],
    activePower: null,
    bossRewardedCPs: new Set<string>(),
    viejoDogState: "waiting",
    tballKeyHeld: false,
    questKillBaseline: 0,
    rexBallFirstSeen: false,
    rexIntroLeft: false,
    rexBatonHeld: false,
    tballUpgraded: false,
    rexBatonDeliveredSeen: false,
    rexUltraDoneSeen: false,
    p1BossRexSeen: false,
    p2BossRexSeen: false,
    ultraBossRexSeen: false,
    rexPhoneNotif: null,
    gpadType: "keyboard",
    isMobile: typeof window !== "undefined" && (window.innerWidth < 900 || navigator.maxTouchPoints > 0),
    mapView: "single",
    mapViewWorld: 0,
    showRealMap: false,
    realMapWorld: 0,
    realMapScale: 1.5,
    realMapIconMode: 0,
    realMapSection: 0,
    bossArenaLocked: new Set<number>(),
    bossArenaPlats: [],
    toolMounds: [],
    flyingTools: [],
    croquetas: 0,
    bolkhaState: "hidden",
    bolkhaFacing: -1,
    bolkhaEf: 0, bolkhaEft: 0,
    bolkhaGivingTimer: 0,
    bolkhaGivingItem: null,
    bolkhaShopOpen: false,
    bolkhaShopCursor: 0,
    bolkhaAppearedOnce: false,
    bolkhaTalkText: "",
    bolkhaTalkTimer: 0,
    bolkhaGreetedThisVisit: false,
    bolkhaAffordTimer: 0,
    bolkhaShopDescCursor: -1,
    bolkhaRexTold: false,
    bolkhaMetDialogSeen: false,
    rexKeyAnimTimer: 0,
    sessionStart: Date.now(),
  } as G
}
