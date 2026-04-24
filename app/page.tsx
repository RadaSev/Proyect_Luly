"use client"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

// Prefijo de ruta para GitHub Pages — vacío en local, "/Proyect_Luly" en producción
const BASE_PATH = process.env.NODE_ENV === "production" ? "/Proyect_Luly" : ""
const asset = (path: string) => `${BASE_PATH}${path}`

// ══════════════════════════════════════════════════════════════
//  CONSTANTES
// ══════════════════════════════════════════════════════════════
const CW = 1050, CH = 600
const RW = 1400, RH = 680
const WT = 24, DW = 140, DH = 140
const NW = 4, NC = 9, NR = 9
const PW = 48, PH = 72, PH_CROUCH = 38
const PL_HBX = 10, PL_HBT = 8
const EN_HBX = 14, EN_HBT = 10
const EW = 96, EH = 96, BW = 140, BH = 140
const WALK = 3, RUN = 6, JV = -12, GUP = 0.38, GDN = 0.62, GMAX = 13
const PSPD = 6, WLEN = 70, WDMG = 1, STEP = 1 / 60
const KENNEL_R = 100
const TOT_W = NW * NC * RW   // 50400
const TOT_H = NR * RH      // 6120

function ro(w: number, c: number, r: number) { return { x: w * NC * RW + c * RW, y: r * RH } }
function rid(w: number, c: number, r: number) { return `${w}_${c}_${r}` }

// ══════════════════════════════════════════════════════════════
//  TIPOS
// ══════════════════════════════════════════════════════════════
type WPlat = { x: number; y: number; w: number; h: number; mode: "s" | "t" | "d"; sw?: number }
type Player = {
  x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean; facing: 1 | -1; hp: number; maxHp: number; inv: number; ammo: number; ls: number; as2: number; sh: boolean; jh: boolean; djump: boolean; djumpAvail: boolean; wh: boolean; wcd: number; pf: number; pft: number; pa: string; crouching: boolean; stamina: number; maxStamina: number; staminaCooldown: number; exhausted: boolean; runMode: boolean; tapLeft: number; tapRight: number;
  tapDown: number; dropThruPlatform: boolean
  // Dash
  dash: boolean; dashCd: number; dashDir: 1 | -1; dashTimer: number
  // Wall slide / wall jump
  wallSliding: boolean; wallDir: 0 | 1 | -1; wallJumpCd: number
}

type Enemy = {
  id: string; x: number; originalId: string; y: number; w: number; h: number; vx: number; vy: number; hp: number; mhp: number; dir: number; p0: number; p1: number; spd: number; cd: number; ls: number; sa: number; active: boolean; boss: boolean; ef: number; eft: number; world: number; state: "patrol" | "guard" | "chase"; alert: boolean; alertT: number; guardX: number; idleT: number; jumpCd: number;
  dying: boolean; deathTimer: number; deathDir: number
  hurtTimer: number
  isMoving: boolean
  alertDelay: number
  phase: number
}
type Proj = { x: number; y: number; vx: number; vy: number; active: boolean; pl: boolean; star: boolean; rot: number; life: number; dist: number; ox: number; oy: number; parried?: boolean }
type Bone = { x: number; y: number; w: number; h: number; vx: number; vy: number; active: boolean; life: number }
type Whip = { x: number; y: number; ex: number; ey: number; life: number; dealt: boolean }
type Drop = { x: number; y: number; vx: number; vy: number; active: boolean; life: number; kind: "h" | "a" }
type Crate = { id: number; x: number; y: number; w: number; h: number; active: boolean }
type WorldAnim = { name: string; sub: string; alpha: number; phase: "in" | "hold" | "out"; timer: number }
type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; col: string }
type WorldSnapshot = {
  enemies: Enemy[]
  crates: Crate[]
  dead: Set<string>
  explored: Set<string>
}
type G = {
  pl: Player; enemies: Enemy[]; projs: Proj[]; bones: Bone[]; whip: Whip | null; drops: Drop[]; crates: Crate[]; cx: number; cy: number; keys: Record<string, boolean>; lives: number; score: number; kills: number; dead: Set<string>; cw: Set<number>; paused: boolean; over: boolean; won: boolean; info: boolean; gfx: 0 | 1 | 2; autoGfx: boolean; fps: number[]; lfps: number; dropThru: boolean; showMap: boolean; explored: Set<string>; checkpoint: { w: number; x: number; y: number }; lastWorld: number; worldAnim: WorldAnim | null; kennelMsg: number; minimapLarge: boolean; sparks: Spark[]; gpadIdx: number; devMode: boolean; godMode: boolean; infiniteAmmo: boolean;
  noEnemies: boolean;
  showDevMap: boolean; devMapWorld: number;
  // FIX: cursor celda a celda en dev map (reemplaza mapScrollX/Y)
  devMapCursor: { c: number; r: number };
  loadedWorlds: Set<number>
  worldSnapshots: Map<number, WorldSnapshot>
  ohko: boolean;
  // Habilidades desbloqueadas
  abilities: Set<string>
  // Combo
  combo: number; comboTimer: number
  // Screen shake
  shakeX: number; shakeY: number; shakeMag: number; shakeTimer: number
  // Notificación de habilidad
  abilityNotif: { text: string; timer: number } | null
  // Sistema de checkpoints con teletransportación
  discoveredCPs: Set<string>
  tpMenu: { open: boolean; idx: number } | null
  tpAnim: { timer: number; phase: 0 | 1; destX: number; destY: number } | null
  // Stamina display mode: "bar" = classic top-right bar, "circle" = circle near player
  staDisplay: "bar" | "circle"
  staCircleAlpha: number
  // Mobile zoom: "far" = full world (default), "close" = zoom-in (personaje más grande)
  mobileZoom: "far" | "close"
}

// ══════════════════════════════════════════════════════════════
//  PALETA
// ══════════════════════════════════════════════════════════════
type Theme = { bg0: string; bg1: string; wall: string; wallHi: string; platC: string; platHi: string; accent: string; doorC: string; fog: string; rock: string; rockHi: string; rockShadow: string }
const THEMES: Theme[] = [
  // ── W0 LAS PERRERAS ── regla de 3: 60% hormigón/suciedad | 30% hierro oxidado | 10% luz kennel amarilla
  { bg0:"#0E0C09",bg1:"#080604",wall:"#2A2218",wallHi:"#3C3025",platC:"#3E3220",platHi:"#524030",accent:"#D4C400",doorC:"#FF5500",fog:"#150E08",rock:"#1E1610",rockHi:"#2C2018",rockShadow:"#0A0806" },
  // ── W1 FÁBRICA CANINA ── regla de 3: 60% acero azul-gris | 30% metal oscuro | 10% naranja industrial/horno
  { bg0:"#060810",bg1:"#030408",wall:"#101A2E",wallHi:"#182440",platC:"#1E2C44",platHi:"#283C5C",accent:"#FF5500",doorC:"#FF1500",fog:"#0C1020",rock:"#0E1828",rockHi:"#162240",rockShadow:"#04060C" },
  // ── W2 LOS TUBOS ── regla de 3: 60% pantano oscuro | 30% ladrillo húmedo/musgo | 10% cian tóxico
  { bg0:"#050908",bg1:"#030604",wall:"#0E1C12",wallHi:"#162A1A",platC:"#1A2C18",platHi:"#223C22",accent:"#00DD88",doorC:"#FF4400",fog:"#080E08",rock:"#0A1810",rockHi:"#122418",rockShadow:"#030604" },
  // ── W3 CTRL. CENTRAL ── regla de 3: 60% vacío digital negro | 30% concreto urbano morado | 10% magenta eléctrico
  { bg0:"#06040E",bg1:"#030208",wall:"#12102A",wallHi:"#1A1840",platC:"#1E1A38",platHi:"#28224C",accent:"#CC00FF",doorC:"#FF0088",fog:"#0C0A1C",rock:"#10102A",rockHi:"#1A1A3C",rockShadow:"#050310" },
]
const WORLD_NAMES = ["LAS PERRERAS", "FÁBRICA CANINA", "LOS TUBOS", "CTRL. CENTRAL"]
const WORLD_SUBS = ["Libertad o destino", "Engranajes de opresión", "Las venas del sistema", "El corazón del control"]

// ══════════════════════════════════════════════════════════════
//  SISTEMA DE GUARDADO
// ══════════════════════════════════════════════════════════════
const SAVE_KEY = "proyecto_luly_v2"

interface LulySave {
  version: 2; savedAt: number; score: number; lives: number; kills: number
  hp: number; maxHp: number; ammo: number
  checkpoint: { w: number; x: number; y: number }
  dead: string[]; explored: string[]; discoveredCPs: string[]
  cw: number[]; abilities: string[]
}

function saveGame(g: G): void {
  try {
    const s: LulySave = {
      version: 2, savedAt: Date.now(), score: g.score, lives: g.lives, kills: g.kills,
      hp: g.pl.hp, maxHp: g.pl.maxHp, ammo: g.pl.ammo,
      checkpoint: { ...g.checkpoint },
      dead: [...g.dead], explored: [...g.explored],
      discoveredCPs: [...g.discoveredCPs], cw: [...g.cw], abilities: [...g.abilities],
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch (_) {}
}

function loadSaveData(): LulySave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as LulySave
    return s.version === 2 ? s : null
  } catch (_) { return null }
}

function generateWorldMaze(w: number): { H: [number, number][]; V: [number, number][] } {
  let s = 42 + w * 1337
  const rnd = () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
  const visited = new Uint8Array(NC * NR)
  const H: [number, number][] = []
  const V: [number, number][] = []

  // FIX: DFS iterativo que garantiza visitar TODAS las celdas
  // Partimos desde [0, floor(NR/2)] igual que antes
  const startC = 0, startR = Math.floor(NR / 2)
  const stack: [number, number][] = [[startC, startR]]
  visited[startR * NC + startC] = 1

  while (stack.length > 0) {
    const [c, r] = stack[stack.length - 1]
    const nb: [number, number, string][] = []
    if (c + 1 < NC && !visited[r * NC + c + 1]) nb.push([c + 1, r, "R"])
    if (c - 1 >= 0 && !visited[r * NC + c - 1]) nb.push([c - 1, r, "L"])
    if (r + 1 < NR && !visited[(r + 1) * NC + c]) nb.push([c, r + 1, "D"])
    if (r - 1 >= 0 && !visited[(r - 1) * NC + c]) nb.push([c, r - 1, "U"])
    if (nb.length === 0) { stack.pop() }
    else {
      for (let i = nb.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[nb[i], nb[j]] = [nb[j], nb[i]] }
      const [nc2, nr2, dir] = nb[0]
      visited[nr2 * NC + nc2] = 1; stack.push([nc2, nr2])
      if (dir === "R") H.push([c, r])
      else if (dir === "L") H.push([nc2, nr2])
      else if (dir === "D") V.push([c, r])
      else V.push([nc2, nr2])
    }
  }

  // FIX: segunda pasada — conectar cualquier celda no visitada por el DFS
  // Esto garantiza conectividad total independientemente del RNG
  for (let r = 0; r < NR; r++) {
    for (let c = 0; c < NC; c++) {
      if (visited[r * NC + c]) continue
      // Buscar vecino visitado más cercano y abrir paso
      const cands: [number, number, string][] = []
      if (c + 1 < NC && visited[r * NC + c + 1]) cands.push([c, r, "R"])
      if (c - 1 >= 0 && visited[r * NC + c - 1]) cands.push([c - 1, r, "R"])
      if (r + 1 < NR && visited[(r + 1) * NC + c]) cands.push([c, r, "D"])
      if (r - 1 >= 0 && visited[(r - 1) * NC + c]) cands.push([c, r - 1, "D"])
      if (cands.length > 0) {
        const [hc, hr, dir] = cands[Math.floor(rnd() * cands.length)]
        if (dir === "R") H.push([hc, hr])
        else V.push([hc, hr])
        visited[r * NC + c] = 1
        // Re-agregar al stack para expandir desde aquí
        stack.push([c, r])
        while (stack.length > 0) {
          const [sc, sr] = stack[stack.length - 1]
          const nb2: [number, number, string][] = []
          if (sc + 1 < NC && !visited[sr * NC + sc + 1]) nb2.push([sc + 1, sr, "R"])
          if (sc - 1 >= 0 && !visited[sr * NC + sc - 1]) nb2.push([sc - 1, sr, "L"])
          if (sr + 1 < NR && !visited[(sr + 1) * NC + sc]) nb2.push([sc, sr + 1, "D"])
          if (sr - 1 >= 0 && !visited[(sr - 1) * NC + sc]) nb2.push([sc, sr - 1, "U"])
          if (nb2.length === 0) { stack.pop() }
          else {
            for (let i = nb2.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[nb2[i], nb2[j]] = [nb2[j], nb2[i]] }
            const [nc2, nr2, dir2] = nb2[0]
            visited[nr2 * NC + nc2] = 1; stack.push([nc2, nr2])
            if (dir2 === "R") H.push([sc, sr])
            else if (dir2 === "L") H.push([nc2, nr2])
            else if (dir2 === "D") V.push([sc, sr])
            else V.push([nc2, nr2])
          }
        }
      }
    }
  }

  const hSet = new Set(H.map(([hc, hr]) => `${hc},${hr}`))
  const vSet = new Set(V.map(([vc, vr]) => `${vc},${vr}`))
  const extra = Math.floor(NC * NR * 0.25)
  for (let i = 0; i < extra; i++) {
    const c = Math.floor(rnd() * (NC - 1)), r = Math.floor(rnd() * NR)
    const k = `${c},${r}`; if (!hSet.has(k)) { H.push([c, r]); hSet.add(k) }
  }
  for (let i = 0; i < extra; i++) {
    const c = Math.floor(rnd() * NC), r = Math.floor(rnd() * (NR - 1))
    const k = `${c},${r}`; if (!vSet.has(k)) { V.push([c, r]); vSet.add(k) }
  }
  return { H, V }
}

const _MAZES = Array.from({ length: NW }, (_, w) => generateWorldMaze(w))
const H_CONN = _MAZES.map(m => m.H)
const V_CONN = _MAZES.map(m => m.V)

// ══════════════════════════════════════════════════════════════
//  CONFIG DE MUNDOS
// ══════════════════════════════════════════════════════════════
const WORLD_EXITS = [[8, 4], [8, 4], [8, 4], [8, 4]]
const WORLD_ENTRIES = [null, [0, 4], [0, 4], [0, 4]]
const PLAYER_START = [0, 0, 4]
const KENNEL_ROOMS = [{ w: 0, c: 0, r: 4 }, { w: 1, c: 0, r: 4 }, { w: 2, c: 0, r: 4 }, { w: 3, c: 0, r: 4 }]
const KENNEL_WORLD_POS = KENNEL_ROOMS.map(({ w, c, r }) => {
  const { x: x0, y: y0 } = ro(w, c, r)
  return { x: x0 + WT + 90, y: y0 + RH - WT - PH }
})

// ── Sistema de Checkpoints (colchoncitos de perro) ────────────────────────────
// 5 checkpoints por mundo: Oeste, Norte, Este, Sur, Centro
const CP_LOCS: [number, number][] = [[0, 4], [4, 0], [8, 4], [4, 8], [4, 4]]
const CP_COMPASS = ["OESTE", "NORTE", "ESTE", "SUR", "CENTRO"]
const CP_ICON = ["◀", "▲", "▶", "▼", "◆"]
type CPDef = { id: string; w: number; c: number; r: number; x: number; y: number; label: string; icon: string }
// ALL_CPS se define más abajo, después de getWorldPlats, para poder validar contra plataformas
const CP_RADIUS = 115  // radio de descubrimiento/uso

// ══════════════════════════════════════════════════════════════
//  TEMPLATE DE SALA
// ══════════════════════════════════════════════════════════════
function getTemplate(w: number, c: number, r: number): number {
  return (w * 31 + c * 17 + r * 11 + w * c % 7 + c * r % 5) % 10
}

// ══════════════════════════════════════════════════════════════
//  SPAWNS DE ENEMIGOS
// ══════════════════════════════════════════════════════════════
type ES = [number, number, number, number, number, boolean]
function getEnemySpawns(w: number, c: number, r: number): ES[] {
  const kr = KENNEL_ROOMS[w]
  if (kr.c === c && kr.r === r) return []

  // NO spawnear en salas sin túnel horizontal
  const doors = computeDoors(w, c, r)
  if (!doors.L && !doors.R) return []

  const { x: x0 } = ro(w, c, r)
  const iL = x0 + WT, iR = x0 + RW - WT
  if (iR - iL < EW * 1.5) return []  // sala demasiado estrecha

  const ex = WORLD_EXITS[w]
  const spdB = [1, 1.15, 1.35, 1.55][w]
  const cdB = [9000, 8000, 7000, 6200][w]
  if (ex[0] === c && ex[1] === r) {
    const bHp = [14, 22, 34, 50][w]
    return [[0.5, 0, bHp, spdB * 0.8, cdB * 0.6, true]]
  }
  const hpMult = [1, 1.4, 1.85, 2.3][w]
  const dist = Math.abs(c - kr.c) + Math.abs(r - kr.r)
  const hash = (w * 97 + c * 31 + r * 17) % 100
  if (dist <= 1 || (dist <= 3 && hash < 40) || (hash < 12)) return []
  const count = Math.min(1 + Math.floor(dist / 3) + Math.floor(w * 0.6), 5)
  const finalCount = hash < 55 ? count : Math.max(1, count - 1)
  const baseHp = Math.round((2 + w + Math.floor(dist * 0.35)) * hpMult)
  const spawns: ES[] = []
  for (let i = 0; i < finalCount; i++) {
    const rx = finalCount === 1 ? 0.5 : 0.12 + (i * (0.76 / (finalCount - 1)))
    spawns.push([rx, 0, baseHp, spdB, cdB, false])
  }
  return spawns
}

// ══════════════════════════════════════════════════════════════
//  HASH DETERMINISTA POR SALA
// ══════════════════════════════════════════════════════════════
function roomHash(w: number, c: number, r: number): number {
  return ((w * 2971 + c * 1193 + r * 7919) ^ (w * c * r * 137 + c * r * 41)) >>> 0
}

// ══════════════════════════════════════════════════════════════
//  POSICIÓN DE PUERTAS
// ══════════════════════════════════════════════════════════════
function lrDoorY_rel(w: number, leftC: number, r: number): number {
  const h = roomHash(w, leftC, r)
  const slots = [
    WT + 20,
    Math.floor((RH - WT - DH) * 0.28),
    Math.floor((RH - WT - DH) * 0.52),
    Math.floor((RH - WT - DH) * 0.74),
    RH - WT - DH,
  ]
  return slots[h % 5]
}

function udDoorX_rel(w: number, c: number, topR: number): number {
  const h = roomHash(w, c, topR)
  const slots = [
    Math.floor((RW - DW) * 0.15),
    Math.floor((RW - DW) * 0.38),
    Math.floor((RW - DW) * 0.62),
    Math.floor((RW - DW) * 0.85),
  ]
  return slots[h % 4]
}

// ══════════════════════════════════════════════════════════════
//  CÁLCULO DE PUERTAS
// ══════════════════════════════════════════════════════════════
function computeDoors(w: number, c: number, r: number): { L: boolean; R: boolean; U: boolean; D: boolean; Rx?: boolean } {
  const hc = H_CONN[w], vc = V_CONN[w]
  const d = { L: false, R: false, U: false, D: false, Rx: false }
  for (const [hc1, hr1] of hc) {
    if (hc1 === c && hr1 === r) d.R = true
    if (hc1 === c - 1 && hr1 === r) d.L = true
  }
  for (const [vc1, vr1] of vc) {
    if (vc1 === c && vr1 === r) d.D = true
    if (vc1 === c && vr1 === r - 1) d.U = true
  }
  const en = WORLD_ENTRIES[w]
  if (en && en[0] === c && en[1] === r) d.L = true
  const ex = WORLD_EXITS[w]
  if (ex[0] === c && ex[1] === r) { d.R = true; d.Rx = true }
  return d
}

// ══════════════════════════════════════════════════════════════
//  RNG DETERMINISTA POR SALA
// ══════════════════════════════════════════════════════════════
function makeRoomRng(w: number, c: number, r: number) {
  let seed = roomHash(w, c, r) * 1000003 + 7
  return () => { seed = (seed * 48271 + 0) % 2147483647; return (seed - 1) / 2147483646 }
}

// ── helper: devuelve chanTop/chanBot igual que makeInternalPlats ──────────
function getRoomChannelBounds(w: number, c: number, r: number): { chanTop: number; chanBot: number } {
  const { x: x0, y: y0 } = ro(w, c, r)
  const d = computeDoors(w, c, r)
  const iT = y0 + WT, iB = y0 + RH - WT, iH = iB - iT, PAD = 54
  const lDoorY = d.L ? y0 + lrDoorY_rel(w, c - 1, r) : null
  const rDoorY = d.R ? y0 + lrDoorY_rel(w, c, r) : null
  const hasH = d.L || d.R
  const MIN_PASS = PH + 32, MIN_CHAN = Math.max(DH + 90, MIN_PASS + 40)
  let chanTop: number, chanBot: number
  if (hasH) {
    const doorYs = [lDoorY, rDoorY].filter(v => v !== null) as number[]
    const dTop = Math.min(...doorYs), dBot = Math.max(...doorYs) + DH
    chanTop = Math.max(iT + 4, dTop - PAD); chanBot = Math.min(iB - 4, dBot + PAD)
    if (chanBot - chanTop < MIN_CHAN) {
      const mid = (chanTop + chanBot) / 2
      chanTop = Math.max(iT + 4, Math.round(mid - MIN_CHAN / 2))
      chanBot = Math.min(iB - 4, Math.round(mid + MIN_CHAN / 2))
    }
  } else if (d.U && d.D) {
    chanTop = iT + Math.floor(iH * 0.38); chanBot = iT + Math.floor(iH * 0.62)
  } else if (d.U) {
    chanTop = iT + Math.floor(iH * 0.55); chanBot = Math.min(iB - 4, iT + Math.floor(iH * 0.82))
  } else if (d.D) {
    chanTop = Math.max(iT + 4, iT + Math.floor(iH * 0.18)); chanBot = iT + Math.floor(iH * 0.45)
  } else {
    chanTop = iT + Math.floor(iH * 0.25); chanBot = iT + Math.floor(iH * 0.72)
  }
  return { chanTop, chanBot }
}

// ══════════════════════════════════════════════════════════════
//  SISTEMA DE TÚNELES
// ══════════════════════════════════════════════════════════════
const TUN_H_INNER = [170, 155, 160, 148]
const TUN_V_WIDTH = [270, 250, 260, 240]
const STAIR_H = 24
const JUMP_H = 190

interface TunRect { x: number; y: number; w: number; h: number }

// ══════════════════════════════════════════════════════════════
//  GENERADOR DE PAREDES DE SALA
// ══════════════════════════════════════════════════════════════
function makeRoomWalls(w: number, c: number, r: number): WPlat[] {
  const { x: x0, y: y0 } = ro(w, c, r)
  const d = computeDoors(w, c, r)
  const result: WPlat[] = []
  const solid = (x: number, y: number, pw: number, ph: number): WPlat => ({ x, y, w: pw, h: ph, mode: "s" })

  if (!d.U) {
    result.push(solid(x0, y0, RW, WT))
  } else {
    const gx = x0 + udDoorX_rel(w, c, r - 1)
    if (gx - x0 > 0) result.push(solid(x0, y0, gx - x0, WT))
    if (x0 + RW - (gx + DW) > 0) result.push(solid(gx + DW, y0, x0 + RW - (gx + DW), WT))
    // Bloquear puerta superior del boss room
    const exU = WORLD_EXITS[w]
    if (exU[0] === c && exU[1] === r) {
      result.push({ x: gx, y: y0, w: DW, h: WT, mode: "d", sw: -(w + 1) })
    }
  }
  const floorY = y0 + RH - WT
  if (!d.D) {
    result.push(solid(x0, floorY, RW, WT))
  } else {
    const gx = x0 + udDoorX_rel(w, c, r)
    if (gx - x0 > 0) result.push(solid(x0, floorY, gx - x0, WT))
    if (x0 + RW - (gx + DW) > 0) result.push(solid(gx + DW, floorY, x0 + RW - (gx + DW), WT))
    // Bloquear puerta inferior del boss room
    const exD = WORLD_EXITS[w]
    if (exD[0] === c && exD[1] === r) {
      result.push({ x: gx, y: floorY, w: DW, h: WT, mode: "d", sw: -(w + 1) })
    }
  }
  if (!d.L) {
    result.push(solid(x0, y0 + WT, WT, RH - 2 * WT))
  } else {
    const dy = lrDoorY_rel(w, c - 1, r)
    const topH = dy - WT
    const botH = RH - WT - dy - DH
    if (topH > 0) result.push(solid(x0, y0 + WT, WT, topH))
    if (botH > 0) result.push(solid(x0, y0 + dy + DH, WT, botH))
    // Puerta de entrada al boss room — bloqueada hasta matar todos los enemigos normales
    const ex = WORLD_EXITS[w]
    if (ex[0] === c && ex[1] === r) {
      result.push({ x: x0, y: y0 + dy, w: WT, h: DH, mode: "d", sw: -(w + 1) })
    }
  }
  if (!d.R) {
    result.push(solid(x0 + RW - WT, y0 + WT, WT, RH - 2 * WT))
  } else {
    const dy = lrDoorY_rel(w, c, r)
    const topH = dy - WT
    const botH = RH - WT - dy - DH
    if (topH > 0) result.push(solid(x0 + RW - WT, y0 + WT, WT, topH))
    if (botH > 0) result.push(solid(x0 + RW - WT, y0 + dy + DH, WT, botH))
    if (d.Rx) {
      const exitDoorY = y0 + Math.floor((RH - DH) / 2)  // centrada verticalmente
      // Reconstruir paredes laterales derecha con esta Y fija
      result.pop()  // quitar la pared derecha recién agregada
      result.pop()
      const exitTopH = exitDoorY - y0 - WT
      const exitBotH = y0 + RH - WT - (exitDoorY + DH)
      if (exitTopH > 0) result.push(solid(x0 + RW - WT, y0 + WT, WT, exitTopH))
      if (exitBotH > 0) result.push(solid(x0 + RW - WT, exitDoorY + DH, WT, exitBotH))
      result.push({ x: x0 + RW - WT, y: exitDoorY, w: WT, h: DH, mode: "d", sw: w })
    }
  }

  return result
}

function makeInternalPlats(w: number, c: number, r: number): WPlat[] {
  const { x: x0, y: y0 } = ro(w, c, r)
  const d = computeDoors(w, c, r)

  const kr = KENNEL_ROOMS[w]
  if (kr.c === c && kr.r === r) return []

  const rng = makeRoomRng(w, c, r)
  const rndI = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))
  const rndF = () => rng()

  const iL = x0 + WT, iR = x0 + RW - WT, iT = y0 + WT, iB = y0 + RH - WT
  const iW = iR - iL, iH = iB - iT

  const lDoorY = d.L ? y0 + lrDoorY_rel(w, c - 1, r) : null
  const rDoorY = d.R ? y0 + lrDoorY_rel(w, c, r) : null
  const uDoorX = d.U ? x0 + udDoorX_rel(w, c, r - 1) : null
  const dDoorX = d.D ? x0 + udDoorX_rel(w, c, r) : null

  const spaces: TunRect[] = []
  const rocks: WPlat[] = []

  const addSp = (x: number, y: number, sw: number, sh: number) => {
    const x1 = Math.max(iL, x), y1 = Math.max(iT, y)
    const x2 = Math.min(iR, x + sw), y2 = Math.min(iB, y + sh)
    if (x2 - x1 > 4 && y2 - y1 > 4) spaces.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
  }
  const addStair = (x: number, y: number, sw: number) => {
    const x1 = Math.max(iL, x), x2 = Math.min(iR, x + sw)
    if (x2 - x1 < 36) return
    rocks.push({ x: x1, y, w: x2 - x1, h: STAIR_H, mode: "s" })
  }

  const MIN_PASS = PH + 32
  const MIN_CHAN = Math.max(DH + 90, MIN_PASS + 40)
  const PAD = 54

  let chanTop: number
  let chanBot: number

  const hasH = d.L || d.R
  const hasV = d.U || d.D

  if (hasH) {
    const doorYs = [lDoorY, rDoorY].filter(v => v !== null) as number[]
    const dTop = Math.min(...doorYs)
    const dBot = Math.max(...doorYs) + DH
    chanTop = Math.max(iT + 4, dTop - PAD)
    chanBot = Math.min(iB - 4, dBot + PAD)
    if (chanBot - chanTop < MIN_CHAN) {
      const mid = (chanTop + chanBot) / 2
      chanTop = Math.max(iT + 4, Math.round(mid - MIN_CHAN / 2))
      chanBot = Math.min(iB - 4, Math.round(mid + MIN_CHAN / 2))
    }
  } else if (d.U && d.D) {
    chanTop = iT + Math.floor(iH * 0.38)
    chanBot = iT + Math.floor(iH * 0.62)
  } else if (d.U) {
    chanTop = iT + Math.floor(iH * 0.55)
    chanBot = Math.min(iB - 4, iT + Math.floor(iH * 0.82))
  } else if (d.D) {
    chanTop = Math.max(iT + 4, iT + Math.floor(iH * 0.18))
    chanBot = iT + Math.floor(iH * 0.45)
  } else {
    chanTop = iT + Math.floor(iH * 0.25)
    chanBot = iT + Math.floor(iH * 0.72)
  }

  if (hasH) {
    addSp(iL, chanTop, iW, chanBot - chanTop)

    if (lDoorY !== null && rDoorY !== null && Math.abs(lDoorY - rDoorY) > MIN_PASS + 30) {
      const midY = Math.round(((lDoorY + DH / 2) + (rDoorY + DH / 2)) / 2) - STAIR_H
      const minY = chanTop + MIN_PASS + 8, maxY = chanBot - STAIR_H - MIN_PASS - 8
      if (midY >= minY && midY <= maxY) {
        const sw2 = Math.floor(iW * 0.30)
        addStair(iL + Math.floor((iW - sw2) / 2), midY, sw2)
      }
    }

    if (lDoorY !== null) {
      const ly = lDoorY, lBot = ly + DH
      if (ly < chanTop || lBot > chanBot) {
        const connTop = Math.min(ly, chanTop)
        const connBot = Math.max(lBot, chanBot)
        addSp(iL, connTop, Math.min(200, iW), connBot - connTop)
      }
    }
    if (rDoorY !== null) {
      const ry = rDoorY, rBot = ry + DH
      if (ry < chanTop || rBot > chanBot) {
        const connTop = Math.min(ry, chanTop)
        const connBot = Math.max(rBot, chanBot)
        addSp(Math.max(iL, iR - 200), connTop, Math.min(200, iW), connBot - connTop)
      }
    }
  } else if (hasV) {
    const uMid = uDoorX !== null ? uDoorX + DW / 2 : iL + iW / 2
    const dMid = dDoorX !== null ? dDoorX + DW / 2 : iL + iW / 2
    const shaftW = TUN_V_WIDTH[w]
    const cLeft = Math.max(iL, Math.min(uMid, dMid) - shaftW / 2 - 30)
    const cRight = Math.min(iR, Math.max(uMid, dMid) + shaftW / 2 + 30)
    const cW = cRight - cLeft
    addSp(cLeft, chanTop, cW, chanBot - chanTop)
  } else {
    const cW = Math.min(500, iW - 20), cH = Math.min(260, iH - 20)
    addSp(iL + iW / 2 - cW / 2, iT + iH / 2 - cH / 2, cW, cH)
  }

  const OVERLAP = 20

  const buildShaft = (midX: number, shTop: number, shBot: number) => {
    const shaftW = TUN_V_WIDTH[w]
    const sx = Math.max(iL + 2, midX - shaftW / 2)
    const se = Math.min(iR - 2, midX + shaftW / 2)
    const rw = se - sx
    if (rw < 80 || shBot - shTop < 30) return

    addSp(sx, shTop, rw, shBot - shTop)

    const totalH = shBot - shTop
    if (totalH < JUMP_H * 0.55) return

    const passW = Math.max(PW + 44, Math.floor(rw * 0.45))
    const stepW2 = rw - passW
    if (stepW2 < 36) return

    const maxGap = Math.floor(JUMP_H * 0.75)
    const nSteps = Math.max(1, Math.ceil(totalH / maxGap) - 1)
    for (let i = 1; i <= nSteps; i++) {
      const t = i / (nSteps + 1)
      const stepY = Math.round(shTop + totalH * t - STAIR_H / 2)
      if (stepY - shTop < 30 || shBot - stepY < 30 + STAIR_H) continue
      const goLeft = (i % 2 === 1)
      addStair(goLeft ? sx : sx + passW, stepY, stepW2)
    }

    // FIX: plataforma de apoyo al pie del shaft cuando no conecta con el suelo
    // Sin ella, el jugador no tiene desde dónde saltar para entrar al shaft
    const footGap = iB - shBot
    if (footGap > PH + 16) {
      // Hay hueco entre el fin del shaft y el suelo: agregar plataforma de apoyo
      const footW = Math.max(PW * 2 + 20, Math.floor(rw * 0.55))
      const footX = sx + Math.floor((rw - footW) / 2)
      const footY = Math.min(iB - STAIR_H - 4, shBot + Math.floor(footGap * 0.45))
      addStair(footX, footY, footW)
      addSp(sx, shBot, rw, footY + STAIR_H - shBot)
    }
    // FIX: plataforma de techo del shaft cuando no conecta con el techo de sala
    const headGap = shTop - iT
    if (headGap > PH + 16) {
      const headW = Math.max(PW * 2 + 20, Math.floor(rw * 0.55))
      const headX = sx + Math.floor((rw - headW) / 2)
      const headY = Math.max(iT + 4, shTop - Math.floor(headGap * 0.45) - STAIR_H)
      addStair(headX, headY, headW)
      addSp(sx, headY, rw, shTop - headY)
    }
  }

  if (d.U && uDoorX !== null) {
    // En salas sin puertas L/R el shaft debe cubrir hasta el suelo del canal
    const shBotU = Math.min(chanBot + STAIR_H, iB - 40)
    buildShaft(uDoorX + DW / 2, iT, shBotU)
  }
  if (d.D && dDoorX !== null) {
    // Ídem hacia arriba para salas solo-verticales
    const shTopD = hasH ? Math.max(chanBot - OVERLAP, iT + 40) : Math.max(chanTop, iT + 40)
    buildShaft(dDoorX + DW / 2, shTopD, iB)
  }

  const SLICE_H = 8
  const outputPlats: WPlat[] = []

  const getRockSegsAtY = (sliceY: number, sliceH: number): { x1: number; x2: number }[] => {
    const gaps: { x1: number; x2: number }[] = []
    for (const sp of spaces) {
      if (sp.y + sp.h <= sliceY || sp.y >= sliceY + sliceH) continue
      const gx1 = Math.max(iL, sp.x), gx2 = Math.min(iR, sp.x + sp.w)
      if (gx2 > gx1) gaps.push({ x1: gx1, x2: gx2 })
    }
    gaps.sort((a, b) => a.x1 - b.x1)
    const merged: { x1: number; x2: number }[] = []
    for (const g of gaps) {
      if (merged.length && g.x1 <= merged[merged.length - 1].x2)
        merged[merged.length - 1].x2 = Math.max(merged[merged.length - 1].x2, g.x2)
      else merged.push({ ...g })
    }
    const segs: { x1: number; x2: number }[] = []
    let cur = iL
    for (const g of merged) { if (g.x1 > cur) segs.push({ x1: cur, x2: g.x1 }); cur = g.x2 }
    if (cur < iR) segs.push({ x1: cur, x2: iR })
    return segs
  }

  type SliceRow = { segs: { x1: number; x2: number }[]; y: number; h: number }
  const sliceRows: SliceRow[] = []
  for (let sy = iT; sy < iB; sy += SLICE_H) {
    const sh = Math.min(SLICE_H, iB - sy)
    const segs = getRockSegsAtY(sy, sh)
    const prev = sliceRows[sliceRows.length - 1]
    const same = prev && prev.segs.length === segs.length &&
      prev.segs.every((s, i) => s.x1 === segs[i].x1 && s.x2 === segs[i].x2)
    if (same) { prev.h += sh } else { sliceRows.push({ segs, y: sy, h: sh }) }
  }
  for (const row of sliceRows) {
    for (const seg of row.segs) {
      const pw = seg.x2 - seg.x1
      if (pw > 2 && row.h > 2) outputPlats.push({ x: seg.x1, y: row.y, w: pw, h: row.h, mode: "s" })
    }
  }

  return [...outputPlats, ...rocks]
}

// ══════════════════════════════════════════════════════════════
//  BASE_PLATS (BUILD)
// ══════════════════════════════════════════════════════════════
const _WORLD_PLATS: (WPlat[] | null)[] = [null, null, null, null]

function getWorldPlats(w: number): WPlat[] {
  if (_WORLD_PLATS[w]) return _WORLD_PLATS[w]!
  const plats: WPlat[] = []
  for (let c = 0; c < NC; c++)
    for (let r = 0; r < NR; r++)
      plats.push(...makeRoomWalls(w, c, r), ...makeInternalPlats(w, c, r))
  _WORLD_PLATS[w] = plats
  return plats
}

// ALL_CPS — validados para que no queden dentro de plataformas sólidas
const ALL_CPS: CPDef[] = (() => {
  const out: CPDef[] = []
  for (let w = 0; w < NW; w++)
    for (let i = 0; i < 5; i++) {
      const [c, r] = CP_LOCS[i]
      const { x: x0, y: y0 } = ro(w, c, r)
      const cpX = x0 + RW / 2 - PW / 2
      let cpY = y0 + RH - WT - PH  // posición base: suelo de la sala
      // Validar contra todas las plataformas sólidas de la sala
      const roomPlats = [...makeRoomWalls(w, c, r), ...makeInternalPlats(w, c, r)]
        .filter(p => p.mode === "s")
      for (let attempt = 0; attempt < 20; attempt++) {
        const hit = roomPlats.find(p =>
          cpX < p.x + p.w && cpX + PW > p.x &&
          cpY < p.y + p.h && cpY + PH > p.y
        )
        if (!hit) break
        cpY = hit.y - PH - 1  // subir por encima de la plataforma
      }
      // Nunca salirse del interior de la sala
      cpY = Math.max(y0 + WT + 4, Math.min(cpY, y0 + RH - WT - PH))
      out.push({ id: `${w}_${c}_${r}`, w, c, r,
        x: cpX, y: cpY,
        label: `W${w + 1} ${WORLD_NAMES[w].slice(0, 10)} — ${CP_COMPASS[i]}`,
        icon: CP_ICON[i] })
    }
  return out
})()

// Función que reemplaza a BASE_PLATS en todas sus referencias.
// Devuelve únicamente los mundos que están activos/cargados.
function getActivePlatsForWorlds(loadedWorlds: Set<number>): WPlat[] {
  const result: WPlat[] = []
  for (const w of loadedWorlds) result.push(...getWorldPlats(w))
  return result
}

// ══════════════════════════════════════════════════════════════
//  CAJAS
// ══════════════════════════════════════════════════════════════
const _WORLD_CRATE_DEFS: (Array<{ id: number; x: number; y: number; w: number; h: number }> | null)[] = [null, null, null, null]
let _crateIdCounter = 0  // ID global, persistente entre mundos

// Encuentra todas las posiciones Y donde una caja puede reposar sobre una superficie sólida
function getCrateValidSurfaces(roomPlats: WPlat[], cx: number, cW: number, cH: number, roomTop: number, roomBot: number): number[] {
  // Plataformas sólidas que se solapan horizontalmente con la caja
  const hOv = roomPlats.filter(p =>
    p.mode === "s" && cx < p.x + p.w && cx + cW > p.x
  ).sort((a, b) => a.y - b.y)

  const surfaces: number[] = []
  for (const plat of hOv) {
    const cy = plat.y - cH  // la caja reposa sobre el tope de esta plataforma
    if (cy < roomTop || cy + cH > roomBot + 2) continue
    // Verificar que la caja en esa Y no colisione con otra plataforma
    const blocked = hOv.some(other =>
      other !== plat && cy < other.y + other.h && cy + cH > other.y
    )
    if (!blocked) surfaces.push(cy)
  }
  return surfaces
}

function getWorldCrateDefs(w: number) {
  if (_WORLD_CRATE_DEFS[w]) return _WORLD_CRATE_DEFS[w]!
  const xSlots = [0.12, 0.28, 0.44, 0.62, 0.80]
  const cr: Array<{ id: number; x: number; y: number; w: number; h: number }> = []
  const worldPlats = getWorldPlats(w)

  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const isKennel = KENNEL_ROOMS.some(k => k.w === w && k.c === c && k.r === r)
    const isBoss = WORLD_EXITS[w][0] === c && WORLD_EXITS[w][1] === r
    if (isKennel) continue
    const hash = (w * 37 + c * 13 + r * 7) % 10
    if (hash < 2 && !isBoss) continue
    const count = isBoss ? 2 : (hash >= 7 ? 2 : 1)
    const { x: x0, y: y0 } = ro(w, c, r)
    const roomPlats = worldPlats.filter(p =>
      p.mode === "s" && p.x < x0 + RW && p.x + p.w > x0 && p.y < y0 + RH && p.y + p.h > y0
    )
    const roomTop = y0 + WT + 4, roomBot = y0 + RH - WT

    for (let i = 0; i < count; i++) {
      const slotIdx = (hash + i * 3) % xSlots.length
      const rx = xSlots[slotIdx]
      const crateX = x0 + WT + Math.round((RW - 2 * WT - 44) * rx)

      // Encontrar todas las superficies válidas para esta X
      const surfaces = getCrateValidSurfaces(roomPlats, crateX, 44, 44, roomTop, roomBot)
      if (surfaces.length === 0) continue  // sin superficie válida → no colocar caja

      // Elegir surface de forma determinista usando el hash
      // Preferir alturas medias (no siempre el suelo)
      const sorted = [...surfaces].sort((a, b) => a - b)  // más alto (menor Y) primero
      const pickIdx = (hash + i * 5) % sorted.length
      const crateY = sorted[pickIdx]

      cr.push({ id: _crateIdCounter++, x: crateX, y: crateY, w: 44, h: 44 })
    }
  }
  // Kennels del mundo — cajas en el suelo
  const kr = KENNEL_ROOMS[w]
  const { x: kx0, y: ky0 } = ro(kr.w, kr.c, kr.r)
  const kfly = ky0 + RH - WT
  for (const xOff of [160, 240, 340]) {
    cr.push({ id: _crateIdCounter++, x: kx0 + WT + xOff, y: kfly - 44, w: 44, h: 44 })
  }

  _WORLD_CRATE_DEFS[w] = cr
  return cr
}

// ══════════════════════════════════════════════════════════════
//  ESTADO INICIAL
// ══════════════════════════════════════════════════════════════
function mkPlayer(): Player {
  const [sw, sc, sr] = PLAYER_START; const { x: x0, y: y0 } = ro(sw, sc, sr)
  return { x: x0 + 80, y: y0 + RH - WT - PH, w: PW, h: PH, vx: 0, vy: 0, onGround: false, facing: 1, hp: 3, maxHp: 3, inv: 0, ammo: 15, ls: 0, as2: 0, sh: false, jh: false, djump: false, djumpAvail: false, wh: false, wcd: 0, pf: 0, pft: 0, pa: "idle", crouching: false, stamina: 100, maxStamina: 100, staminaCooldown: 0, exhausted: false, runMode: false, tapLeft: 0, tapRight: 0, tapDown: 0, dropThruPlatform: false, dash: false, dashCd: 0, dashDir: 1 as (1 | -1), dashTimer: 0, wallSliding: false, wallDir: 0 as (0 | 1 | -1), wallJumpCd: 0 }
}

// Devuelve los rangos X que corresponden a shafts verticales en una sala
function getShaftRangesX(w: number, c: number, r: number): { x0: number; x1: number }[] {
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
function isInShaft(px: number, eW: number, shafts: { x0: number; x1: number }[]): boolean {
  for (const s of shafts) {
    if (px + eW > s.x0 && px < s.x1) return true
  }
  return false
}

// Retorna true si hay un hueco (shaft o vacío) justo al frente del enemigo
function voidAhead(e: Enemy, dir: number, g: G, shafts: { x0: number; x1: number }[]): boolean {
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
function getSafeSpawnRangesX(w: number, c: number, r: number, eW: number): { x0: number; x1: number }[] {
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

function mkEnemiesForWorld(w: number, dead: Set<string>): Enemy[] {
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
      const eW = boss ? BW : EW
      const eH = boss ? BH : EH

      const safeRanges = getSafeSpawnRangesX(w, c, r, eW)
      if (safeRanges.length === 0) return

      const totalW = safeRanges.reduce((acc, s) => acc + (s.x1 - s.x0), 0)
      if (totalW <= 0) return

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
          const testY = chanBot - eH + EN_HBT
          const testW = eW - 2 * EN_HBX
          const testH = eH - EN_HBT
          // Solo verifica colisión con plats del mundo actual
          const inside = worldPlats.some(p =>
            p.mode === "s" &&
            testX < p.x + p.w && testX + testW > p.x &&
            testY < p.y + p.h && testY + testH > p.y
          )
          if (!inside) { ex = candidate; break }
        }
        tries++
      }
      if (ex < 0) {
        dead.add(`${rid(w, c, r)}_${i}`)  // spawn fantasma: nunca existió, nunca puede morir
        return
      }

      usedX.push(ex)
      const safeFloor = chanBot - eH - 2
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
        state: "patrol", alert: false, alertT: 0, guardX: -1,
        idleT: Math.floor(rand() * 500), jumpCd: 0,
        dying: false, deathTimer: 0, deathDir: 1,
        hurtTimer: 0, isMoving: false, alertDelay: 0, phase: 1
      })
    })
  }
  return es
}

function mkCratesForWorld(w: number, dead: Set<string>): Crate[] {
  return getWorldCrateDefs(w)
    .filter(c => !dead.has(`crate_${c.id}`))
    .map(c => ({ ...c, active: true }))
}

const BG_IMGS: (HTMLImageElement | null)[] = [null, null, null, null]
const BG_PATHS = [
  asset("/assets/background/world_1.png"),
  asset("/assets/background/world_2.png"),
  asset("/assets/background/world_3.png"),
  asset("/assets/background/world_4.png"),
]

function mkG_lazy(): G {
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
    mobileZoom: "far",
  } as G
}

// ══════════════════════════════════════════════════════════════
//  FÍSICA
// ══════════════════════════════════════════════════════════════
let _apCache2: WPlat[] | null = null
let _apLoadedKey = ""  // string de mundos cargados para invalidar cache

function activePlats(g: G): WPlat[] {
  const key = [...g.loadedWorlds].sort().join(",") + "|" + g.cw.size + "|" + g.dead.size
  if (_apCache2 && _apLoadedKey === key) return _apCache2

  const allPlats: WPlat[] = []
  for (const w of g.loadedWorlds) allPlats.push(...getWorldPlats(w))

  _apCache2 = allPlats.filter(p => {
    if (p.mode !== "d") return true
    if (p.sw === undefined) return true
    if (p.sw >= 0) return !g.cw.has(p.sw)  // puerta salida: sólida hasta mundo completado
    // puerta entrada boss (sw = -(w+1)): sólida hasta matar todos los enemigos normales
    const bossW = -(p.sw + 1)
    return !areRegularEnemiesDead(g, bossW)
  })
  _apLoadedKey = key
  return _apCache2
}

function worldBoundsX(w: number): { minX: number; maxX: number } {
  return { minX: w * NC * RW, maxX: (w + 1) * NC * RW }
}

function resolve(ex: number, ey: number, ew: number, eh: number, vx: number, vy: number, g: G) {
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
  x = Math.max(0, Math.min(x, TOT_W - ew))
  if (y + eh > TOT_H) { y = TOT_H - eh; vy = 0; og = true }
  return { x, y, vx, vy, og }
}

function getDir(g: G) {
  const k = g.keys, p = g.pl; let dx = 0, dy = 0
  if (k["w"] || k["arrowup"]) dy -= 1; if (k["s"] || k["arrowdown"]) dy += 1
  if (!(k["a"] || k["arrowleft"] || k["d"] || k["arrowright"])) dx = p.facing
  else { if (k["d"] || k["arrowright"]) dx += 1; if (k["a"] || k["arrowleft"]) dx -= 1 }
  const len = Math.sqrt(dx * dx + dy * dy) || 1; return { x: dx / len, y: dy / len }
}

function dmgPlayer(g: G, dmg: number) {
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
    // Reaparece en el último checkpoint con animación de teletransporte
    g.tpAnim = { timer: 0, phase: 0, destX: g.checkpoint.x, destY: g.checkpoint.y }
  }
}

function dmgEnemy(g: G, e: Enemy, dmg: number) {
  if (e.dying) return
  const finalDmg = g.ohko ? e.hp : dmg
  e.hp -= finalDmg
  if (e.hp > 0) {
    e.hurtTimer = 0.32; e.ef = 0; e.eft = 0
    return
  }
  e.dying = true; e.deathTimer = 0; e.deathDir = e.dir; e.ef = 0; e.eft = 0
  e.vx = 0; e.alert = false; e.sa = 0

  // FIX: extraer el ID spawn original del originalId antes de registrar
  // El originalId tiene formato "w_c_r_i" o puede haber sido corrompido.
  // Normalizar: tomar solo los primeros 4 segmentos del originalId.
  const parts = e.originalId.split("_")
  const normalizedOriginal = parts.slice(0, 4).join("_")  // "w_c_r_i"
  // En dmgEnemy, antes del g.dead.add:
  console.log("murió:", e.id, "| original:", e.originalId, "| world:", e.world)
  e.dying = true; e.deathTimer = 0; e.deathDir = e.dir; e.ef = 0; e.eft = 0
  e.vx = 0; e.alert = false; e.sa = 0

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
  // ── Desbloqueo de habilidades al matar boss ─────────────────────────
  if (e.boss) {
    if (originalWorld === 0 && !g.abilities.has("dash")) {
      g.abilities.add("dash")
      g.abilityNotif = { text: "DASH  [SHIFT / LT]", timer: 4.0 }
    } else if (originalWorld === 1 && !g.abilities.has("walljump")) {
      g.abilities.add("walljump")
      g.abilityNotif = { text: "SALTO EN PARED  [← / → + SALTO]", timer: 4.0 }
    } else if (originalWorld === 2 && !g.abilities.has("hpup")) {
      g.abilities.add("hpup")
      g.pl.maxHp = Math.min(g.pl.maxHp + 1, 6)
      g.pl.hp = Math.min(g.pl.hp + 1, g.pl.maxHp)
      g.abilityNotif = { text: "VIDA MÁXIMA +1  ❤", timer: 4.0 }
    }
  }
  checkWorldClear(g, originalWorld)
}

// Helper global para saber si un spawn está muerto (tolerante a adopciones)
function isSpawnDead(dead: Set<string>, w: number, c: number, r: number, i: number): boolean {
  const eid = `${rid(w, c, r)}_${i}`
  if (dead.has(eid)) return true
  for (const id of dead) {
    if (id === eid || id.startsWith(eid + "_") || id.includes(`_adopted_${eid}`)) return true
  }
  return false
}

function checkWorldClear(g: G, w: number) {
  if (g.cw.has(w)) return
  let allDead = true
  outer: for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const sp = getEnemySpawns(w, c, r)
    for (let i = 0; i < sp.length; i++) {
      if (!isSpawnDead(g.dead, w, c, r, i)) { allDead = false; break outer }
    }
  }
  if (allDead) { g.cw.add(w); saveGame(g); if (g.cw.size >= NW) setTimeout(() => { g.won = true }, 1200) }
}

// Helper: todos los enemigos normales (no boss) del mundo w están muertos
function areRegularEnemiesDead(g: G, w: number): boolean {
  const [bc, br] = WORLD_EXITS[w]
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    if (c === bc && r === br) continue  // ignorar sala del boss
    const sp = getEnemySpawns(w, c, r)
    for (let i = 0; i < sp.length; i++) {
      if (!isSpawnDead(g.dead, w, c, r, i)) return false
    }
  }
  return true
}

function breakCrate(g: G, c: Crate) {
  c.active = false; g.dead.add(`crate_${c.id}`)
  const cx2 = c.x + c.w / 2, cy2 = c.y

  // Fragmentos: siempre salen
  for (let i = 0; i < 8; i++) {
    const a = (Math.random() - .5) * Math.PI * 1.4, spd = 3 + Math.random() * 2
    g.bones.push({ x: cx2 + (Math.random() - .5) * 20, y: cy2, w: 11, h: 11, vx: Math.cos(a) * spd, vy: -Math.abs(Math.sin(a) * spd) - 1, active: true, life: 12 })
  }

  const drop = (k: "h" | "a") =>
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
}

// ══════════════════════════════════════════════════════════════
//  TICKS
// ══════════════════════════════════════════════════════════════
function tickPlayer(g: G) {
  const k = g.keys, p = g.pl, now = performance.now()
  const STA_RED = 8, STA_DRAIN = 17, STA_RCH_WALK = 12, STA_RCH_IDLE = 22
  const moving = (k["a"] || k["arrowleft"] || k["d"] || k["arrowright"]) && !p.crouching
  const canRun = !p.exhausted  // drena hasta 0; STA_RED solo se usa para reinicio tras agotamiento
  if (!moving || !canRun) p.runMode = false
  const wantsRun = p.runMode, actuallyRunning = wantsRun && canRun && moving
  if (p.exhausted) {
    p.staminaCooldown = Math.max(0, p.staminaCooldown - STEP)
    if (p.staminaCooldown <= 0) { p.exhausted = false; p.stamina = STA_RED }
  } else if (actuallyRunning) {
    p.stamina = Math.max(0, p.stamina - STA_DRAIN * STEP)
    if (p.stamina <= 0) { p.exhausted = true; p.staminaCooldown = 4.5 }
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
  if (left && !right) { p.vx = -spd; p.facing = -1; p.pa = run ? "run" : "walk" }
  else if (right && !left) { p.vx = spd; p.facing = 1; p.pa = run ? "run" : "walk" }
  else { p.vx = 0; if (p.onGround) p.pa = "idle" }

  // ── DASH ────────────────────────────────────────────────────────────
  p.dashCd = Math.max(0, p.dashCd - STEP)
  const shiftKey = k["shift"] || false
  const canDash = g.abilities.has("dash") && !p.crouching && p.dashCd <= 0 && !p.dash
  if (shiftKey && canDash) {
    p.dash = true; p.dashDir = p.facing; p.dashTimer = 0.13
    p.dashCd = 0.70; p.inv = Math.max(p.inv, 0.14)
    p.pa = p.dashDir === 1 ? "dash_right" : "dash_left"
    spawnExplosion(g, p.x + p.w / 2, p.y + p.h / 2, ["#FFFFFF", "#CCCCFF", "#8888FF"], 10, 3.5, false)
  }
  if (p.dash) {
    p.vx = p.dashDir * 16
    if (p.vy > 0) p.vy *= 0.12
    p.pa = p.dashDir === 1 ? "dash_right" : "dash_left"
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
    if (p.onGround) {
      p.vy = JV; p.onGround = false; p.jh = true; p.djump = true; p.djumpAvail = true; p.pa = "jump"
    } else if (!p.djump) {
      p.vy = JV; p.jh = true; p.djump = true; p.pa = "jump"
    } else if (p.djumpAvail) {
      p.vy = JV * 0.88; p.jh = true; p.djumpAvail = false; p.pa = "jump"
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
  if (p.wallSliding) p.pa = "jump"
  // Wall jump
  if (p.wallSliding && jk && !p.jh && g.abilities.has("walljump")) {
    p.vy = JV * 0.92; p.vx = -p.wallDir * (RUN + 2)
    p.facing = (-p.wallDir) as 1 | -1
    p.jh = true; p.djumpAvail = true
    p.wallSliding = false; p.wallDir = 0; p.wallJumpCd = 0.22
    p.pa = "jump"
    spawnExplosion(g, p.x + p.w / 2, p.y + p.h / 2, ["#FFFFFF", "#88AAFF", "#4466FF"], 8, 3, false)
  }

  if (p.onGround && !standingOnOneWay_plat) p.dropThruPlatform = false

  if (k["n"] && p.ammo > 0) {
    const mkP = () => { const d = getDir(g); const px = p.x + (p.facing === 1 ? p.w : 0), py = p.y + p.h / 2; g.projs.push({ x: px, y: py, vx: d.x * PSPD, vy: d.y * PSPD - 1, active: true, pl: true, star: false, rot: Math.atan2(d.y, d.x) * 180 / Math.PI, life: 3.5, dist: 0, ox: px, oy: py }); p.ammo-- }
    if (!p.sh) { mkP(); p.ls = now; p.as2 = now; p.sh = true; p.pa = "attack" }
    else if (now - p.as2 > 2500) { mkP(); p.as2 = now; p.pa = "attack" }
  } else p.sh = false
  p.wcd = Math.max(0, p.wcd - STEP * 1000)
  if (k["m"] && !p.wh && p.wcd <= 0 && !g.whip && !p.exhausted) {
    const d = getDir(g); const cx = p.x + p.w / 2, cy = p.y + p.h / 2
    g.whip = { x: cx, y: cy, ex: cx + d.x * WLEN, ey: cy + d.y * WLEN, life: 0.2, dealt: false }
    p.stamina = Math.max(0, p.stamina - 18)
    if (p.stamina <= 0) { p.exhausted = true; p.staminaCooldown = 4.5 }
    p.wcd = 500; p.wh = true; p.pa = "attack"
  }
  if (!k["m"]) p.wh = false
  if (p.inv > 0) p.inv -= STEP
  if (g.infiniteAmmo) { p.ammo = 15; p.stamina = p.maxStamina; p.exhausted = false; p.staminaCooldown = 0 }
}

function tickEnemies(g: G, now: number) {
  if (g.noEnemies) return

  const p = g.pl
  const phx = p.x + PL_HBX + 4, phy = p.y + PL_HBT + 4, phw = p.w - 2 * PL_HBX - 8, phh = p.h - PL_HBT - 8
  const dt = STEP * 1000
  const pWorld = Math.floor(p.x / (NC * RW))
  const pCol = Math.floor((p.x % (NC * RW)) / RW)
  const pRow = Math.floor(p.y / RH)
  const plFloor = p.onGround ? p.y + p.h : null

  // Helper: sala actual de un enemigo
  const eRoom = (e: Enemy) => ({
    w: e.world,
    c: Math.max(0, Math.min(Math.floor((e.x % (NC * RW)) / RW), NC - 1)),
    r: Math.max(0, Math.min(Math.floor(e.y / RH), NR - 1))
  })

  // Helper: sala "home" de un enemigo (extraída del id "w_c_r_i")
  const homeRoom = (e: Enemy) => {
    const parts = e.id.split("_")
    // IDs adoptados tienen formato "w_c_r_adopted_..."
    // IDs originales tienen formato "w_c_r_i"
    return { w: parseInt(parts[0]), c: parseInt(parts[1]), r: parseInt(parts[2]) }
  }
  // Helper: ¿el jugador está en la misma sala que el enemigo?
  const playerInSameRoom = (e: Enemy) => {
    const hr = homeRoom(e)
    return pWorld === hr.w && pCol === hr.c && pRow === hr.r
  }

  // Helper: bordes de sala home (en píxeles)
  const homeBounds = (e: Enemy) => {
    const hr = homeRoom(e)
    const { x: x0, y: y0 } = ro(hr.w, hr.c, hr.r)
    return { x0: x0 + WT + 6, x1: x0 + RW - WT - e.w - 6, y0: y0 + WT, y1: y0 + RH - WT }
  }

  for (const e of g.enemies) {
    if (!e.active) continue

    // ── Animación de muerte ──────────────────────────────────────────
    if (e.dying) {
      e.eft += dt
      if (e.eft > 75) { e.ef = Math.min(e.ef + 1, 15); e.eft = 0 }
      e.deathTimer += STEP
      e.vy += GDN * 0.4; if (e.vy > GMAX) e.vy = GMAX
      e.y += e.vy
      if (e.ef >= 15 && e.deathTimer > 1.35) e.active = false
      continue
    }

    if (e.world !== pWorld) continue
    const eCol = Math.floor((e.x % (NC * RW)) / RW), eRow = Math.floor(e.y / RH)
    if (Math.abs(eCol - pCol) > 4 || Math.abs(eRow - pRow) > 3) continue

    // ── Animación de frame ───────────────────────────────────────────
    const frameSp = e.hurtTimer > 0 ? 55 : 90
    e.eft += dt; if (e.eft > frameSp) { e.ef = (e.ef + 1) % 16; e.eft = 0 }
    if (e.hurtTimer > 0) e.hurtTimer = Math.max(0, e.hurtTimer - STEP)
    e.jumpCd = Math.max(0, e.jumpCd - dt)
    if (e.alertT > 0) e.alertT -= dt

    const eOnGround = (e as any).onGround === true
    const hr = homeRoom(e)
    const hb = { x0: e.p0, x1: e.p1, y0: hr.r * RH + WT, y1: hr.r * RH + RH - WT }
    const cur = eRoom(e)

    // ── Reagrupamiento: si el enemigo salió de su sala home, vuelve ──
    // REEMPLAZAR el bloque completo "Reagrupamiento" POR:

    const outOfHome = cur.c !== hr.c || cur.r !== hr.r
    if (outOfHome && !e.boss) {
      const curDoors = computeDoors(cur.w, cur.c, cur.r)
      const curHasH = curDoors.L || curDoors.R
      const curHasV = curDoors.U || curDoors.D
      const { chanTop: curChanTop, chanBot: curChanBot } = getRoomChannelBounds(cur.w, cur.c, cur.r)

      if (curHasH) {
        // ADOPCIÓN: integrar al nuevo cubiculo horizontal
        const { x: cx0 } = ro(cur.w, cur.c, cur.r)
        const newRanges = getSafeSpawnRangesX(cur.w, cur.c, cur.r, e.w)
        if (newRanges.length > 0) {
          e.p0 = newRanges[0].x0
          e.p1 = newRanges[newRanges.length - 1].x1
        } else {
          e.p0 = cx0 + WT + 6
          e.p1 = cx0 + RW - WT - e.w - 6
        }
        // Reasignar id al nuevo cubiculo para que lo "adopte"
        const newRid = `${cur.w}_${cur.c}_${cur.r}`
        const oldSuffix = e.id.split("_").slice(3).join("_")
        e.id = `${newRid}_adopted_${oldSuffix}_${Date.now()}`
        e.world = cur.w
        e.alert = false; e.alertT = 0
        e.state = "patrol"
        e.idleT = 300 + Math.floor(Math.random() * 800)
        // Ajustar Y al canal horizontal del nuevo cubiculo
        const targetFloor = curChanBot - e.h - 2
        if (Math.abs(e.y - targetFloor) > 8) e.vy = Math.max(e.vy, 1)
        else e.y = targetFloor

      } else if (curHasV) {
        // NAVEGACIÓN VERTICAL: subir o bajar por el shaft para salir
        const { x: cx0, y: cy0 } = ro(cur.w, cur.c, cur.r)
        const eFootY = e.y + e.h
        const distToTop = Math.abs(e.y - curChanTop)
        const distToBot = Math.abs(eFootY - curChanBot)
        const eOnGround2 = (e as any).onGround === true

        // Determinar si hay plataformas escalonadas arriba o abajo
        const platsAbove = activePlats(g).filter(pl =>
          pl.mode === "s" &&
          pl.x < e.x + e.w && pl.x + pl.w > e.x &&
          pl.y < e.y && pl.y > cy0 + WT
        ).sort((a, b) => b.y - a.y) // la más cercana primero

        const platsBelow = activePlats(g).filter(pl =>
          pl.mode === "s" &&
          pl.x < e.x + e.w && pl.x + pl.w > e.x &&
          pl.y > eFootY && pl.y < cy0 + RH - WT
        ).sort((a, b) => a.y - b.y)

        // Si tiene sala home con túnel horizontal, intentar volver
        const homeDoors = computeDoors(hr.w, hr.c, hr.r)
        const homeHasH = homeDoors.L || homeDoors.R

        if (homeHasH) {
          // Intentar volver a casa: ir hacia la dirección de la sala home
          const { x: hx0, y: hy0 } = ro(hr.w, hr.c, hr.r)
          const homeIsAbove = hr.r < cur.r
          const homeIsBelow = hr.r > cur.r

          if (homeIsAbove) {
            // Subir: usar plataformas si las hay, saltar si está en suelo
            if (eOnGround2 && e.jumpCd <= 0) {
              // Moverse hacia el centro del shaft para subir
              const shafts = getShaftRangesX(cur.w, cur.c, cur.r)
              if (shafts.length > 0) {
                const targetX = (shafts[0].x0 + shafts[0].x1) / 2 - e.w / 2
                e.dir = targetX > e.x ? 1 : -1
                e.vx = e.dir * e.spd
              }
              // Saltar hacia plataforma superior más cercana
              const nearPlat = platsAbove[0]
              if (nearPlat) {
                const jumpNeeded = e.y - nearPlat.y
                if (jumpNeeded < JUMP_H * 0.9 && jumpNeeded > 4) {
                  e.vy = JV * 0.88; e.jumpCd = 900
                }
              } else {
                e.vy = JV * 0.88; e.jumpCd = 900
              }
            } else if (!eOnGround2) {
              // En el aire: centrarse en el shaft
              const shafts = getShaftRangesX(cur.w, cur.c, cur.r)
              if (shafts.length > 0) {
                const midX = (shafts[0].x0 + shafts[0].x1) / 2
                e.vx = midX > e.x + e.w / 2 ? e.spd * 0.5 : -e.spd * 0.5
              }
            }
          } else if (homeIsBelow) {
            // Bajar: moverse hacia el shaft descendente
            const shafts = getShaftRangesX(cur.w, cur.c, cur.r)
            if (shafts.length > 0) {
              const targetX = (shafts[0].x0 + shafts[0].x1) / 2 - e.w / 2
              e.dir = targetX > e.x ? 1 : -1
              e.vx = e.dir * e.spd
            }
            // Dejarse caer sobre plataformas inferiores
            if (eOnGround2 && platsBelow.length > 0) {
              const nearPlat = platsBelow[0]
              // Moverse hacia el borde de la plataforma actual para caer
              const curStandingPlat = activePlats(g).find(pl =>
                pl.mode === "s" &&
                e.x + e.w > pl.x + 4 && e.x < pl.x + pl.w - 4 &&
                Math.abs((e.y + e.h) - pl.y) <= 4
              )
              if (curStandingPlat) {
                // Ir al borde más cercano al shaft
                const shaftMid = (shafts[0].x0 + shafts[0].x1) / 2
                e.dir = shaftMid > e.x + e.w / 2 ? 1 : -1
                e.vx = e.dir * e.spd
              }
            }
          } else {
            // Misma fila pero sala diferente (columna distinta) — ir horizontal
            const { x: hx0 } = ro(hr.w, hr.c, hr.r)
            const homeCenterX = hx0 + RW / 2
            e.dir = homeCenterX > e.x + e.w / 2 ? 1 : -1
            e.vx = e.dir * e.spd * 1.4
          }
        } else {
          // Casa también es vertical o sin puertas: adoptar cubiculo actual si tiene V
          if (curHasV) {
            const newRid = `${cur.w}_${cur.c}_${cur.r}`
            const oldSuffix = e.id.split("_").slice(3).join("_")
            e.id = `${newRid}_adopted_${oldSuffix}_${Date.now()}`
            e.world = cur.w
            // Patrullar dentro del shaft
            const shafts = getShaftRangesX(cur.w, cur.c, cur.r)
            if (shafts.length > 0) {
              e.p0 = shafts[0].x0
              e.p1 = shafts[0].x1 - e.w
            }
            e.alert = false; e.alertT = 0
            e.state = "patrol"
            e.idleT = 200 + Math.floor(Math.random() * 600)
          }
        }

        // Aplicar física y continuar
        e.vy += e.vy < 0 ? GUP : GDN; if (e.vy > GMAX) e.vy = GMAX
        const ehx = e.x + EN_HBX, ehy = e.y + EN_HBT, ehw = e.w - 2 * EN_HBX, ehh = e.h - EN_HBT
        const res = resolve(ehx, ehy, ehw, ehh, e.vx, e.vy, g)
          ; (e as any).onGround = res.og
        e.x = res.x - EN_HBX; e.y = res.y - EN_HBT; e.vx = res.vx; e.vy = res.vy
        e.isMoving = true
        continue

      } else {
        // Sin puertas: adoptar directamente
        const newRid = `${cur.w}_${cur.c}_${cur.r}`
        const oldSuffix = e.id.split("_").slice(3).join("_")
        e.id = `${newRid}_adopted_${oldSuffix}_${Date.now()}`
        e.world = cur.w
        const { x: cx0 } = ro(cur.w, cur.c, cur.r)
        e.p0 = cx0 + WT + 6
        e.p1 = cx0 + RW - WT - e.w - 6
        e.alert = false; e.alertT = 0
        e.state = "patrol"
        e.idleT = 300 + Math.floor(Math.random() * 800)
        e.vy += e.vy < 0 ? GUP : GDN; if (e.vy > GMAX) e.vy = GMAX
        const ehx = e.x + EN_HBX, ehy = e.y + EN_HBT, ehw = e.w - 2 * EN_HBX, ehh = e.h - EN_HBT
        const res = resolve(ehx, ehy, ehw, ehh, e.vx, e.vy, g)
          ; (e as any).onGround = res.og
        e.x = res.x - EN_HBX; e.y = res.y - EN_HBT; e.vx = res.vx; e.vy = res.vy
        e.isMoving = true
        continue
      }
    }

    // ── Detección del jugador ────────────────────────────────────────
    const dx = p.x + p.w / 2 - (e.x + e.w / 2), dy = p.y + p.h / 2 - (e.y + e.h / 2)
    const dist = Math.sqrt(dx * dx + dy * dy)
    const sight = e.boss ? 440 : 260

    // El enemigo solo persigue si el jugador está en la MISMA sala
    const plSameRoom = playerInSameRoom(e)
    const canSee = plSameRoom && dist < sight && Math.abs(dy) < 200

    if (canSee && !e.alert) {
      e.alert = true; e.alertT = 4000
      e.state = "chase"
      e.alertDelay = 0.5
      // ── Alerta grupal: notifica a enemigos cercanos de la misma sala ──
      if (!e.boss) {
        for (const o of g.enemies) {
          if (o === e || !o.active || o.dying || o.boss || o.alert) continue
          const ohr = homeRoom(o)
          if (ohr.w !== hr.w || ohr.c !== hr.c || ohr.r !== hr.r) continue
          const od = Math.sqrt((o.x - e.x) ** 2 + (o.y - e.y) ** 2)
          if (od < 400) { o.alert = true; o.alertT = 3500; o.state = "chase"; o.alertDelay = 0.8 + Math.random() * 0.5 }
        }
      }
    }
    if (e.alertDelay > 0) e.alertDelay = Math.max(0, e.alertDelay - STEP)
    // Pierde al jugador si sale de la sala o se pierde de vista
    if ((!canSee || !plSameRoom) && e.alertT <= 0) {
      e.alert = false; e.state = "patrol"
    }
    // Si el jugador salió de la sala, parar la persecución inmediatamente
    if (!plSameRoom && e.state === "chase") {
      e.alert = false; e.alertT = 0; e.state = "patrol"
    }

    // ── Lógica de movimiento ─────────────────────────────────────────
    let targetVx = 0
    const eOnGround2 = (e as any).onGround === true

    // ── Shafts de la sala home ───────────────────────────────────────────
    const homeShafts = getShaftRangesX(hr.w, hr.c, hr.r)

    // ── ¿El enemigo está dentro de un shaft ahora mismo? ────────────────
    const inShaftNow = isInShaft(e.x, e.w, homeShafts)

    // ── Decisión cuando está en shaft y no persigue ──────────────────────
    const chaseBlocking = e.state === "chase" && playerInSameRoom(e) && canSee
    if (inShaftNow && !chaseBlocking && !e.dying && !e.boss) {
      // Encontrar el borde horizontal libre más cercano
      const { chanTop, chanBot } = getRoomChannelBounds(hr.w, hr.c, hr.r)
      const eFootY = e.y + e.h

      // Decidir si subir o bajar según cuál borde del canal está más cerca
      const distToTop = Math.abs(e.y - chanTop)
      const distToBot = Math.abs(eFootY - chanBot)

      if (eOnGround2) {
        // Está parado dentro del shaft — buscar salida horizontal
        // Calcular hacia qué lado del shaft hay espacio libre
        let exitDir = 0
        for (const s of homeShafts) {
          if (e.x + e.w > s.x0 && e.x < s.x1) {
            const toLeft = e.x - s.x0
            const toRight = s.x1 - (e.x + e.w)
            exitDir = toLeft < toRight ? -1 : 1
            break
          }
        }
        if (exitDir === 0) exitDir = e.dir
        e.dir = exitDir
        targetVx = exitDir * e.spd * 1.6
        // Saltar para salir si hay pared baja bloqueando
        if (e.jumpCd <= 0) { e.vy = JV * 0.75; e.jumpCd = 600 }
      } else {
        // Está cayendo/volando en shaft — decidir subir o bajar
        if (distToBot < distToTop) {
          // Más cerca del suelo del canal: dejarse caer (no hacer nada)
          targetVx = 0
        } else {
          // Más cerca del techo: intentar salir por arriba si tiene impulso
          targetVx = 0
        }
        // Moverse horizontalmente hacia afuera del shaft durante la caída
        let exitDir = 0
        for (const s of homeShafts) {
          if (e.x + e.w > s.x0 && e.x < s.x1) {
            const toLeft = e.x - s.x0
            const toRight = s.x1 - (e.x + e.w)
            exitDir = toLeft < toRight ? -1 : 1
            break
          }
        }
        if (exitDir !== 0) { targetVx = exitDir * e.spd * 0.8; e.dir = exitDir }
      }

      // Aplicar física y continuar al siguiente enemigo
      e.vx = targetVx
      e.vy += e.vy < 0 ? GUP : GDN; if (e.vy > GMAX) e.vy = GMAX
      const ehx = e.x + EN_HBX, ehy = e.y + EN_HBT, ehw = e.w - 2 * EN_HBX, ehh = e.h - EN_HBT
      const res = resolve(ehx, ehy, ehw, ehh, e.vx, e.vy, g)
        ; (e as any).onGround = res.og
      e.x = res.x - EN_HBX; e.y = res.y - EN_HBT; e.vx = res.vx; e.vy = res.vy
      e.isMoving = true
      continue
    }

    // ── Detector de atasco ───────────────────────────────────────────────
    if (!e.dying) {
      const prevX = (e as any)._prevX ?? e.x
      const stuckCount = ((e as any)._stuckCount ?? 0)
      const isChasing = e.state === "chase"
      // En shaft o persiguiendo: el umbral de atasco es más alto para no sobre-reaccionar
      const stuckThresh = (inShaftNow || isChasing) ? 18 : 8
      if (Math.abs(e.vx) > 0.1 && Math.abs(e.x - prevX) < 0.5) {
        (e as any)._stuckCount = stuckCount + 1
      } else {
        (e as any)._stuckCount = 0
      }
      ; (e as any)._prevX = e.x

      if ((e as any)._stuckCount > stuckThresh) {
        // En shaft: no cambiar dirección aleatoriamente, intentar saltar hacia salida
        if (inShaftNow) {
          if ((e as any).onGround === true && e.jumpCd <= 0) {
            e.vy = JV * 0.80
            e.jumpCd = 1200
          }
        } else {
          e.dir *= -1
          e.idleT = 200 + Math.random() * 400
          if ((e as any).onGround === true && e.jumpCd <= 0) {
            e.vy = JV * 0.78
            e.jumpCd = 900
          }
        }
        ; (e as any)._stuckCount = 0
      }
    }

    // ── Detector de mini-plataforma ──────────────────────────────────────
    if (eOnGround2 && !e.dying && e.jumpCd <= 0) {
      const footY = e.y + e.h
      const standingPlat = activePlats(g).find(pl =>
        pl.mode === "s" &&
        e.x + e.w > pl.x + 4 && e.x < pl.x + pl.w - 4 &&
        Math.abs(footY - pl.y) <= 4
      )
      if (standingPlat && standingPlat.w < e.w * 3) {
        const floorBelow = activePlats(g).some(pl =>
          pl.mode === "s" &&
          e.x + e.w / 2 > pl.x && e.x + e.w / 2 < pl.x + pl.w &&
          pl.y > footY && pl.y < footY + JUMP_H
        )
        if (floorBelow) {
          const midPlat = standingPlat.x + standingPlat.w / 2
          e.dir = e.x + e.w / 2 < midPlat ? -1 : 1
          e.vy = JV * 0.55; e.jumpCd = 700
        }
      }
    }

    if (e.boss) {
      if (dist > 40) targetVx = (dx > 0 ? 1 : -1) * (e.spd * (dist < sight * 0.4 ? 1.8 : 1.35))
      e.dir = dx > 0 ? 1 : -1
      const playerAbove = plFloor !== null && plFloor < e.y + e.h - 60 && p.onGround
      const playerBelow = p.onGround && p.y + p.h > e.y + e.h + 40
      if (playerAbove && eOnGround2 && e.jumpCd <= 0) { e.vy = JV * 0.9; e.jumpCd = 1400 }
      if (playerBelow && eOnGround2) { e.y += 4; (e as any).onGround = false }

    } else if (e.state === "chase" && plSameRoom) {
      // ── Flanqueo: si hay otro enemigo persiguiendo desde el mismo lado, rodear ──
      const otherChasers = g.enemies.filter(o =>
        o !== e && o.active && !o.dying && !o.boss && o.state === "chase" &&
        homeRoom(o).c === hr.c && homeRoom(o).r === hr.r
      )
      let chaseDir = dx > 0 ? 1 : -1
      if (otherChasers.length > 0) {
        const avgOtherX = otherChasers.reduce((s, o) => s + o.x, 0) / otherChasers.length
        const otherSide = avgOtherX < p.x + p.w / 2 ? 1 : -1  // los demás están a la izquierda → este va a la derecha
        chaseDir = otherSide
      }
      if (dist > 36) {
        const rawVx = chaseDir * e.spd * 1.4
        const nextX = e.x + rawVx
        if (nextX >= hb.x0 && nextX <= hb.x1) targetVx = rawVx
        else targetVx = 0
      }
      e.dir = chaseDir

      // Evasión de paredes en chase
      if (eOnGround2 && e.jumpCd <= 0 && Math.abs(targetVx) > 0) {
        const probeX = e.dir > 0 ? (e.x + e.w + 8) : (e.x - 8)
        const probeYTop = e.y + 4, probeYBot = e.y + e.h - 4
        const wallAhead = activePlats(g).some(pl =>
          pl.mode === "s" && probeX > pl.x && probeX < pl.x + pl.w &&
          probeYBot > pl.y && probeYTop < pl.y + pl.h
        )
        if (wallAhead) {
          const blockPlat = activePlats(g).find(pl =>
            pl.mode === "s" && probeX > pl.x && probeX < pl.x + pl.w &&
            probeYBot > pl.y && probeYTop < pl.y + pl.h
          )
          const platTop = blockPlat ? blockPlat.y : e.y
          const jumpNeeded = e.y + e.h - platTop
          if (jumpNeeded < JUMP_H * 0.75 && jumpNeeded > 4) { e.vy = JV * 0.92; e.jumpCd = 900 }
        }
      }

      // Salto agresivo para alcanzar al jugador arriba
      if (eOnGround2 && e.jumpCd <= 0) {
        if (dy < -55 && Math.abs(dx) < 200) {
          // Jugador arriba: saltar con fuerza proporcional a la distancia vertical
          const jPow = Math.min(1, Math.abs(dy) / 200)
          e.vy = JV * (0.82 + 0.18 * jPow); e.jumpCd = 1100
        } else if (dy > 60 && Math.abs(dx) < 100 && !e.boss) {
          // Jugador abajo y cerca: pequeño salto para caer encima (ataque aéreo)
          e.vy = JV * 0.45; e.jumpCd = 1400
        }
      }

      // Esquivar proyectiles del jugador
      if (eOnGround2 && e.jumpCd <= 0 && !e.boss && Math.random() < 0.25) {
        for (const pr of g.projs) {
          if (!pr.active || !pr.pl) continue
          const toPrX = (pr.x + pr.vx * 25) - (e.x + e.w / 2)
          const toPrY = (pr.y + pr.vy * 25) - (e.y + e.h / 2)
          if (Math.abs(toPrX) < 44 && Math.abs(toPrY) < 60) {
            e.vy = JV * 0.65; e.jumpCd = 700
            e.vx += (toPrX > 0 ? -1 : 1) * e.spd * 0.8
            break
          }
        }
      }

    } else {
      // ── PATRULLA ────────────────────────────────────────────────────
      if (e.idleT > 0) {
        e.idleT = Math.max(0, e.idleT - dt)
        targetVx = 0
      } else {
        targetVx = e.dir * e.spd
        const atLeft = e.x <= hb.x0 + 4
        const atRight = e.x >= hb.x1 - 4
        if (atLeft && e.dir < 0) { e.dir = 1; e.idleT = 400 + Math.random() * 900; targetVx = 0 }
        else if (atRight && e.dir > 0) { e.dir = -1; e.idleT = 400 + Math.random() * 900; targetVx = 0 }
        if (targetVx !== 0 && Math.random() < 0.002) { e.idleT = 700 + Math.random() * 1800; targetVx = 0 }

        // ── Evitar huecos y shafts en patrulla ──────────────────────
        if (targetVx !== 0 && eOnGround2) {
          const hasVoid = voidAhead(e, e.dir, g, homeShafts)
          if (hasVoid) {
            e.dir *= -1
            e.idleT = 300 + Math.random() * 600
            targetVx = 0
          }
        }

        // Evasión de paredes en patrulla
        if (targetVx !== 0 && eOnGround2) {
          const probeX = e.dir > 0 ? (e.x + e.w + 6) : (e.x - 6)
          const probeYTop = e.y + 4
          const probeYBot = e.y + e.h - 4
          const frontInRoom = probeX > hb.x0 && probeX < hb.x1 + e.w
          const wallAhead = frontInRoom && activePlats(g).some(pl =>
            pl.mode === "s" &&
            probeX > pl.x && probeX < pl.x + pl.w &&
            probeYBot > pl.y && probeYTop < pl.y + pl.h
          )
          if (wallAhead) {
            const blockPlat = activePlats(g).find(pl =>
              pl.mode === "s" &&
              probeX > pl.x && probeX < pl.x + pl.w &&
              probeYBot > pl.y && probeYTop < pl.y + pl.h
            )
            const platTop = blockPlat ? blockPlat.y : e.y
            const jumpNeeded = e.y + e.h - platTop
            if (e.jumpCd <= 0 && jumpNeeded < JUMP_H * 0.72 && jumpNeeded > 4) {
              e.vy = JV * 0.84; e.jumpCd = 1100
            } else if (e.jumpCd > 800) {
              e.dir *= -1; e.idleT = 300 + Math.random() * 500; targetVx = 0
            } else if (e.jumpCd <= 0) {
              e.dir *= -1; e.idleT = 300 + Math.random() * 500; targetVx = 0
            }
          }
        }

        // Colisión entre enemigos
        if (targetVx !== 0) {
          for (const o of g.enemies) {
            if (o === e || !o.active || o.dying || o.world !== e.world) continue
            const ohr = homeRoom(o)
            if (ohr.c !== hr.c || ohr.r !== hr.r) continue
            const gap = e.dir > 0 ? (o.x - (e.x + e.w)) : (e.x - (o.x + o.w))
            if (gap > 0 && gap < 14) {
              e.dir *= -1; e.idleT = 200 + Math.random() * 400; targetVx = 0
              if (o.state !== "chase" && o.idleT <= 0) { o.dir *= -1; o.idleT = 200 + Math.random() * 400 }
              break
            }
          }
        }
      }
    }
    e.isMoving = Math.abs(targetVx) > 0.5
    e.vx = targetVx

    // ── Física ──────────────────────────────────────────────────────
    e.vy += e.vy < 0 ? GUP : GDN; if (e.vy > GMAX) e.vy = GMAX
    const ehx = e.x + EN_HBX, ehy = e.y + EN_HBT, ehw = e.w - 2 * EN_HBX, ehh = e.h - EN_HBT
    const res = resolve(ehx, ehy, ehw, ehh, e.vx, e.vy, g)
      ; (e as any).onGround = res.og
    e.x = res.x - EN_HBX; e.y = res.y - EN_HBT; e.vx = res.vx; e.vy = res.vy

    // ── Separación entre enemigos (dentro de la misma sala) ──────────
    // Solo separarlos horizontalmente, sin empujarlos fuera de su sala
    for (const o of g.enemies) {
      if (o === e || !o.active || o.dying || o.world !== e.world) continue
      const ohr = homeRoom(o)
      if (ohr.c !== hr.c || ohr.r !== hr.r) continue  // solo enemigos de la misma sala
      const odx = e.x - o.x
      const sep = Math.abs(odx)
      const minSep = (e.w + o.w) * 0.55
      if (sep < minSep && sep > 0) {
        const push = (minSep - sep) / minSep * 0.4
        // Verificar que el push no saque de los bordes de sala
        const newEX = e.x + odx * push
        const newOX = o.x - odx * push
        if (newEX >= hb.x0 && newEX <= hb.x1) e.x = newEX
        if (newOX >= hb.x0 && newOX <= hb.x1) o.x = newOX
      }
    }

    // ── Transición de fase del boss ──────────────────────────────────
    if (e.boss && e.phase === 1 && e.hp <= Math.ceil(e.mhp * 0.5) && !e.dying) {
      e.phase = 2
      e.spd *= 1.5; e.cd = Math.floor(e.cd * 0.55)
      triggerShake(g, 12, 0.55)
      spawnExplosion(g, e.x + e.w / 2, e.y + e.h / 2, ["#FF0000", "#FF8800", "#FFFF00", "#FFFFFF", "#FF4400"], 24, 6, true)
    }

    // ── Disparo ──────────────────────────────────────────────────────
    const canShoot = e.boss
      ? (dist < sight)
      : (plSameRoom && canSee && e.state === "chase" && e.alertDelay <= 0)
    if (now - e.ls > e.cd && canShoot) {
      const sp = e.boss ? (e.phase === 2 ? 4.2 : 3.2) : 2.8
      const ex2 = e.x + e.w / 2, ey2 = e.y + e.h / 2
      // Puntería predictiva: apunta al punto donde estará el jugador ~0.4s después
      const LEAD = e.boss ? 0.5 : 0.38
      const pdx = (p.x + p.w / 2 + p.vx * LEAD) - ex2
      const pdy = (p.y + p.h / 2 + p.vy * LEAD) - ey2
      const plen = Math.sqrt(pdx * pdx + pdy * pdy) || 1
      // Proyectil dirigido principal
      g.projs.push({ x: ex2, y: ey2, vx: (pdx / plen) * sp, vy: (pdy / plen) * sp, active: true, pl: false, star: false, rot: Math.atan2(pdy, pdx) * 180 / Math.PI, life: 3.5, dist: 0, ox: ex2, oy: ey2 })
      if (e.boss) {
        // Salva radial: 8 en fase 1, 12 en fase 2
        const numRadial = e.phase === 2 ? 12 : 8
        for (let a = 0; a < numRadial; a++) {
          const rad = a * Math.PI * 2 / numRadial, bx = ex2, by = ey2
          const rsp = e.phase === 2 ? 3.0 : 2.2
          g.projs.push({ x: bx, y: by, vx: Math.cos(rad) * rsp, vy: Math.sin(rad) * rsp, active: true, pl: false, star: true, rot: a * (360 / numRadial), life: 4, dist: 0, ox: bx, oy: by })
        }
        // Fase 2: ráfaga triple dirigida al jugador
        if (e.phase === 2) {
          const ang = Math.atan2(dy, dx)
          for (let a = -1; a <= 1; a++) {
            const aOff = ang + a * 0.32
            g.projs.push({ x: ex2, y: ey2, vx: Math.cos(aOff) * sp * 1.2, vy: Math.sin(aOff) * sp * 1.2, active: true, pl: false, star: true, rot: aOff * 180 / Math.PI, life: 3.5, dist: 0, ox: ex2, oy: ey2 })
          }
        }
        triggerShake(g, e.phase === 2 ? 5 : 3, 0.18)
      }
      e.ls = now; e.sa = 300
    }
    if (e.sa > 0) e.sa -= dt

    // ── Daño por contacto ────────────────────────────────────────────
    if (e.hurtTimer <= 0) {
      const ecx = e.x + EN_HBX, ecy = e.y + EN_HBT, ecw = e.w - 2 * EN_HBX, ech = e.h - EN_HBT
      if (p.inv <= 0 && phx < ecx + ecw && phx + phw > ecx && phy < ecy + ech && phy + phh > ecy) dmgPlayer(g, 1)
    }
  }

  g.enemies = g.enemies.filter(e => e.active)
}

function spawnExplosion(g: G, x: number, y: number, cols: string[], count = 8, speed = 3.5, big = false) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, spd = speed * (0.4 + Math.random() * 0.8)
    g.sparks.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - (big ? 1.5 : 0.5), life: big ? 0.55 : 0.38, maxLife: big ? 0.55 : 0.38, r: big ? (3 + Math.random() * 4) : (1.5 + Math.random() * 2.5), col: cols[Math.floor(Math.random() * cols.length)] })
  }
}

function triggerShake(g: G, mag: number, dur = 0.3) {
  g.shakeMag = Math.max(g.shakeMag, mag)
  g.shakeTimer = Math.max(g.shakeTimer, dur)
}

function tickSparks(g: G) {
  for (const s of g.sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.18; s.vx *= 0.88; s.life -= STEP }
  g.sparks = g.sparks.filter(s => s.life > 0)
}

function tickShake(g: G) {
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
  if (g.comboTimer > 0) {
    g.comboTimer -= STEP
    if (g.comboTimer <= 0) g.combo = 0
  }
}

const PROJ_GRAV = 0.22, PROJ_MAXD = 440
function tickProjs(g: G) {
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
        dmgPlayer(g, 1); continue
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

function segAABB(ax: number, ay: number, bx: number, by: number, rx: number, ry: number, rw: number, rh: number): number {
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

function tickWhip(g: G) {
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

function tickBones(g: G) {
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

function tickDrops(g: G) {
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
      if (d.kind === "h") p.hp = Math.min(p.maxHp, p.hp + 1); else p.ammo = Math.min(15, p.ammo + 10)
      d.active = false
    }
  }
  g.drops = g.drops.filter(d => d.active)
}

function loadWorld(g: G, w: number) {
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
  _apCache2 = null
  _apLoadedKey = ""
}

function suspendWorld(g: G, w: number) {
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
  _apCache2 = null
  _apLoadedKey = ""
}

function applyLoad(g: G, s: LulySave): void {
  g.score = s.score; g.lives = s.lives; g.kills = s.kills || 0
  g.pl.hp = s.hp; g.pl.maxHp = s.maxHp; g.pl.ammo = s.ammo
  g.checkpoint = { ...s.checkpoint }
  g.pl.x = s.checkpoint.x; g.pl.y = s.checkpoint.y
  g.dead = new Set(s.dead); g.explored = new Set(s.explored)
  g.discoveredCPs = new Set(s.discoveredCPs)
  g.cw = new Set(s.cw as number[]); g.abilities = new Set(s.abilities)
  // Reload worlds with the restored dead set
  g.loadedWorlds.clear(); g.enemies = []; g.crates = []
  loadWorld(g, 0)
  const tw = s.checkpoint.w; if (tw !== 0) loadWorld(g, tw)
  // Center camera on checkpoint
  g.cx = s.checkpoint.x - CW / 2; g.cy = s.checkpoint.y - CH / 2
}

// Activa un mundo y pone en stand-by el actual (si es diferente).
// Llama esto al cruzar una puerta o al teletransportar con dev map.
function activateWorld(g: G, newWorld: number) {
  const currentWorlds = [...g.loadedWorlds]
  for (const w of currentWorlds) {
    if (w !== newWorld) suspendWorld(g, w)
  }
  loadWorld(g, newWorld)
}

function tickCamera(g: G) {
  const p = g.pl
  const sc = g.mobileZoom === "close" ? 1.6 : 1.0
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
  if (curW !== g.lastWorld) {
    activateWorld(g, curW)
    g.lastWorld = curW
    const westCP = ALL_CPS.find(cp => cp.w === curW && cp.c === 0 && cp.r === 4)
    if (westCP) { g.checkpoint = { w: curW, x: westCP.x, y: westCP.y }; g.discoveredCPs.add(westCP.id) }
    g.worldAnim = { name: WORLD_NAMES[curW], sub: WORLD_SUBS[curW], alpha: 0, phase: "in", timer: 0 }
  }
}

function tickWorldAnim(g: G) {
  if (g.kennelMsg > 0) g.kennelMsg = Math.max(0, g.kennelMsg - STEP)
  if (!g.worldAnim) return
  const a = g.worldAnim; a.timer += STEP
  if (a.phase === "in") { a.alpha = Math.min(1, a.timer / 0.55); if (a.timer >= 0.55) { a.phase = "hold"; a.timer = 0 } }
  else if (a.phase === "hold") { if (a.timer >= 1.9) { a.phase = "out"; a.timer = 0 } }
  else { a.alpha = Math.max(0, 1 - a.timer / 0.65); if (a.timer >= 0.65) g.worldAnim = null }
}

function tickCheckpoints(g: G) {
  const p = g.pl
  // Descubrir checkpoints cercanos automáticamente
  for (const cp of ALL_CPS) {
    if (g.discoveredCPs.has(cp.id)) continue
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
      g.tpAnim = null
    }
  }
}

function tick(g: G) {
  if (g.tpAnim && g.tpAnim.phase === 0) { tickCheckpoints(g); return }  // congelar juego durante fade-out
  const now = performance.now()
  tickPlayer(g); tickEnemies(g, now); tickProjs(g); tickWhip(g); tickBones(g); tickDrops(g); tickCamera(g); tickWorldAnim(g); tickSparks(g); tickShake(g); tickCheckpoints(g)
}

// ══════════════════════════════════════════════════════════════
//  RENDERIZADO
// ══════════════════════════════════════════════════════════════
type SprBank = Record<string, HTMLImageElement | null>
function getWorldAtX(cx: number) { return Math.max(0, Math.min(Math.floor((cx + CW / 2) / (NC * RW)), NW - 1)) }

function drawBg(ctx: CanvasRenderingContext2D, g: G) {
  const wi = getWorldAtX(g.cx), th = THEMES[wi]
  ctx.fillStyle = th.bg0
  ctx.fillRect(0, 0, CW, CH)

  const bgImg = BG_IMGS[wi]
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    const parallaxX = (g.cx * 0.25) % bgImg.width
    const parallaxY = (g.cy * 0.12) % bgImg.height
    const iw = bgImg.width, ih = bgImg.height
    for (let tx = -Math.ceil(parallaxX / iw) * iw; tx < CW + iw; tx += iw) {
      for (let ty = -Math.ceil(parallaxY / ih) * ih; ty < CH + ih; ty += ih) {
        ctx.drawImage(bgImg, tx - (parallaxX % iw), ty - (parallaxY % ih), iw, ih)
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, CW, CH)
    ctx.fillStyle = th.fog + "55"; ctx.fillRect(0, 0, CW, CH)
    return
  }

  const px = g.cx * 0.12 | 0, py = g.cy * 0.08 | 0

  if (wi === 0) {
    // ── W0 PERRERAS: jaulas de alambre, rejas, luz de kennel amarilla ──
    ctx.save()
    // Barras verticales de jaula (hierro oxidado)
    ctx.globalAlpha = 0.08; ctx.fillStyle = "#2A1E0E"
    for (let x = ((130 - (px % 130)) % 130); x < CW + 20; x += 130) {
      ctx.fillRect(x - 5, 0, 10, CH); ctx.fillRect(x - 2, 0, 4, CH)
    }
    // Barras horizontales de kennel (hormigón)
    ctx.globalAlpha = 0.06; ctx.fillStyle = "#221808"
    for (let y = ((90 - (py % 90)) % 90); y < CH + 10; y += 90) {
      ctx.fillRect(0, y - 3, CW, 6)
    }
    // Malla diagonal (alambre oxidado, tonos cálidos)
    ctx.globalAlpha = 0.04; ctx.strokeStyle = "#C8A000"; ctx.lineWidth = 1
    for (let x = -CH + ((60 - (px % 60)) % 60); x < CW + CH; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + CH, CH); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - CH, CH); ctx.stroke()
    }
    // Luz de kennel amarilla en el suelo (fluorescente sucio)
    ctx.globalAlpha = 0.07; ctx.fillStyle = "#D4C400"
    ctx.fillRect(0, CH - 6, CW, 3)
    ctx.restore()
  } else if (wi === 1) {
    // ── W1 FÁBRICA: tuberías industriales, columnas, engranajes candentes ──
    ctx.save()
    // Tuberías horizontales gruesas (acero azul-gris)
    ctx.globalAlpha = 0.09; ctx.fillStyle = "#141C30"
    for (let y = ((160 - (py % 160)) % 160); y < CH; y += 160) {
      ctx.fillRect(0, y, CW, 16)
      ctx.fillStyle = "#1C2440"; ctx.fillRect(0, y + 4, CW, 5)
      ctx.fillStyle = "#141C30"
    }
    // Columnas de soporte verticales (metal oscuro)
    ctx.globalAlpha = 0.07; ctx.fillStyle = "#10182C"
    for (let x = ((200 - (px % 200)) % 200); x < CW; x += 200) {
      ctx.fillRect(x - 10, 0, 20, CH)
      ctx.fillStyle = "#18243E"; ctx.fillRect(x - 3, 0, 6, CH)
      ctx.fillStyle = "#10182C"
    }
    // Engranajes (círculos) — naranja horno fundido
    ctx.globalAlpha = 0.06; ctx.strokeStyle = "#FF5500"; ctx.lineWidth = 3
    const gears = [{ x: 160, y: 200, r: 55 }, { x: 820, y: 360, r: 70 }, { x: 460, y: 110, r: 40 }, { x: 970, y: 480, r: 60 }]
    for (const gp of gears) {
      const gx = ((gp.x - (px * 0.3 | 0) % (CW + 200) + CW * 3) % (CW + 200)) - 100
      ctx.beginPath(); ctx.arc(gx, gp.y, gp.r, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(gx, gp.y, gp.r * 0.55, 0, Math.PI * 2); ctx.stroke()
    }
    // Franjas de advertencia naranja en suelo
    ctx.globalAlpha = 0.06; ctx.lineWidth = 1
    for (let x = ((20 - (px % 20)) % 20); x < CW; x += 20) {
      ctx.fillStyle = x % 40 < 20 ? "#FF550022" : "#00000022"
      ctx.fillRect(x, CH - 8, 20, 8)
    }
    ctx.restore()
  } else if (wi === 2) {
    // ── W2 TUBOS: arcos de alcantarilla, tuberías verdes, goteo tóxico ──
    ctx.save()
    // Arcos de alcantarilla al fondo (cemento húmedo)
    ctx.globalAlpha = 0.10; ctx.strokeStyle = "#0C1E10"; ctx.lineWidth = 14
    for (let x = ((450 - (px % 450)) % 450) - 80; x < CW + 120; x += 450) {
      ctx.beginPath(); ctx.arc(x, CH + 40, 340, Math.PI, 0); ctx.stroke()
    }
    // Tuberías verticales (metal verde-musgo)
    ctx.globalAlpha = 0.08; ctx.strokeStyle = "#142818"; ctx.lineWidth = 20
    for (let x = ((270 - (px % 270)) % 270); x < CW + 30; x += 270) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke()
      ctx.lineWidth = 6; ctx.strokeStyle = "#0A1C10"
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke()
      ctx.lineWidth = 20; ctx.strokeStyle = "#142818"
    }
    // Goteo animado de líquido tóxico cian
    ctx.globalAlpha = 0.20; ctx.fillStyle = "#00AA55"
    const t2 = Date.now() * 0.0015
    for (let i = 0; i < 7; i++) {
      const dx = ((i * 151 + (px * 0.5 | 0)) % CW)
      const dy = ((t2 * 60 + i * 88) % (CH + 40)) - 20
      ctx.beginPath(); ctx.ellipse(dx, dy, 2, 4, 0, 0, Math.PI * 2); ctx.fill()
    }
    // Musgo en las paredes (verde oscuro)
    ctx.globalAlpha = 0.09; ctx.fillStyle = "#082A10"
    for (let y = 80; y < CH - 80; y += 140) {
      ctx.fillRect(0, y, 12, 60)
      ctx.fillRect(CW - 12, y + 20, 12, 60)
    }
    ctx.restore()
  } else {
    // ── W3 CTRL CENTRAL: rascacielos de neón magenta, grid digital ──
    ctx.save()
    // Silueta de edificios distópicos (concreto negro-violeta)
    ctx.globalAlpha = 0.14; ctx.fillStyle = "#0E0C22"
    const blds = [
      {x:0,w:75,h:380},{x:85,w:55,h:290},{x:150,w:95,h:440},{x:255,w:45,h:300},
      {x:310,w:85,h:490},{x:405,w:38,h:270},{x:455,w:105,h:410},{x:570,w:65,h:370},
      {x:645,w:55,h:330},{x:710,w:115,h:470},{x:835,w:50,h:300},{x:895,w:90,h:430},
      {x:995,w:60,h:350}
    ]
    for (const b of blds) {
      const bx = ((b.x - (px * 0.35 | 0) % (CW + 250) + CW * 4) % (CW + 250)) - 120
      ctx.fillRect(bx, CH - b.h, b.w, b.h)
    }
    // Ventanas iluminadas (neón magenta)
    ctx.globalAlpha = 0.10
    for (let i = 0; i < 36; i++) {
      const wx = ((i * 97 + (px * 0.35 | 0)) % CW)
      const wy = ((i * 53 + 60) % (CH - 80)) + 40
      ctx.fillStyle = i % 4 === 0 ? "#CC00FF" : i % 4 === 1 ? "#880099" : "#550066"
      ctx.fillRect(wx, wy, 4, 3)
    }
    // Grid digital de fondo (violeta oscuro)
    ctx.globalAlpha = 0.05; ctx.strokeStyle = "#200A3C"; ctx.lineWidth = 1
    for (let x = ((70 - (px % 70)) % 70); x < CW; x += 70) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke()
    }
    for (let y = ((50 - (py % 50)) % 50); y < CH; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
    }
    // Línea de neón en el horizonte (magenta eléctrico)
    ctx.globalAlpha = 0.07; ctx.fillStyle = "#CC00FF"
    ctx.fillRect(0, CH - 2, CW, 2)
    ctx.restore()
  }

  ctx.fillStyle = th.fog + "88"; ctx.fillRect(0, 0, CW, CH)

  if (g.gfx >= 2) {
    ctx.strokeStyle = "rgba(0,0,0,0.05)"; ctx.lineWidth = 1
    for (let y = 0; y < CH; y += 3) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
    }
  }
}

// ── Tile sólido: textura por mundo ──────────────────────────────────────────
function drawSolidTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, wi: number, hash: number, gfx: number, wx: number, wy: number) {
  ctx.save()
  ctx.beginPath(); ctx.rect(sx, sy, w, h); ctx.clip()

  if (wi === 0) {
    // ══ W0 LAS PERRERAS ══ Hormigón sucio y cálido, hierro oxidado
    ctx.fillStyle = "#221C14"; ctx.fillRect(sx, sy, w, h)
    if (gfx >= 1) {
      const BH = 28, BW = 44
      ctx.strokeStyle = "#140E08"; ctx.lineWidth = 1.5
      // Hiladas horizontales (world-aligned)
      const yOff = ((wy % BH) + BH) % BH
      for (let ly = BH - yOff; ly < h + BH; ly += BH) {
        ctx.beginPath(); ctx.moveTo(sx, sy + ly); ctx.lineTo(sx + w, sy + ly); ctx.stroke()
      }
      // Juntas verticales con offset alternado (patrón ladrillo, world-aligned)
      const xOff = ((wx % BW) + BW) % BW
      for (let ly = -yOff; ly <= h; ly += BH) {
        const row = Math.floor((wy + ly) / BH)
        const xShift = (row % 2) ? BW / 2 : 0
        const firstLx = ((BW - ((xOff + xShift) % BW)) % BW)
        for (let lx = firstLx - BW; lx < w + BW; lx += BW) {
          ctx.beginPath()
          ctx.moveTo(sx + lx, sy + Math.max(-1, ly))
          ctx.lineTo(sx + lx, sy + Math.min(h + 1, ly + BH))
          ctx.stroke()
        }
      }
      // Borde: luz arriba-izquierda, sombra abajo-derecha (cálido)
      ctx.fillStyle = "#3C2E2099"; ctx.fillRect(sx, sy, w, 2); ctx.fillRect(sx, sy, 2, h)
      ctx.fillStyle = "#0A080699"; ctx.fillRect(sx + w - 2, sy, 2, h); ctx.fillRect(sx, sy + h - 2, w, 2)
      if (gfx >= 2) {
        // Manchas de mugre / óxido cálido
        const rx = sx + (hash * 17 % Math.max(1, w - 20))
        const ry = sy + (hash * 11 % Math.max(1, h - 14))
        ctx.fillStyle = hash < 5 ? "#3A280A33" : hash < 9 ? "#2A1E0833" : "#1A120433"
        ctx.fillRect(rx, ry, 16 + (hash % 10), 10 + (hash % 7))
        // Malla metálica en el borde superior (reja de kennel oxidada)
        if (h > 50) {
          ctx.strokeStyle = "#503C20BB"; ctx.lineWidth = 1
          for (let mx = sx; mx < sx + w; mx += 8) {
            ctx.beginPath(); ctx.moveTo(mx, sy); ctx.lineTo(mx, sy + 10); ctx.stroke()
          }
          ctx.beginPath(); ctx.moveTo(sx, sy + 5); ctx.lineTo(sx + w, sy + 5); ctx.stroke()
        }
        // Barra de hierro horizontal ocasional
        if (hash === 3 || hash === 7 || hash === 11) {
          ctx.fillStyle = "#503C20BB"; ctx.fillRect(sx + w * 0.06, sy + h * 0.47, w * 0.88, 3)
          ctx.fillStyle = "#3A2A1055"; ctx.fillRect(sx + w * 0.06, sy + h * 0.47, w * 0.88, 1)
        }
      }
      // Halo luz kennel amarilla (1 px en el tope)
      ctx.fillStyle = "#D4C40022"; ctx.fillRect(sx, sy, w, 1)
    }

  } else if (wi === 1) {
    // ══ W1 FÁBRICA CANINA ══ Paneles de acero frío, metal industrial
    ctx.fillStyle = "#0E1626"; ctx.fillRect(sx, sy, w, h)
    if (gfx >= 1) {
      const PH = 36, PW = 52
      ctx.strokeStyle = "#080C14"; ctx.lineWidth = 1
      const yOff = ((wy % PH) + PH) % PH
      // Divisiones horizontales de panel
      for (let ly = PH - yOff; ly < h + PH; ly += PH) {
        ctx.beginPath(); ctx.moveTo(sx, sy + ly); ctx.lineTo(sx + w, sy + ly); ctx.stroke()
        // Reflejo metálico en la parte superior de cada panel
        ctx.fillStyle = "#182236"; ctx.fillRect(sx, sy + ly - PH + 1, w, 3)
        ctx.fillStyle = "#142034"; ctx.fillRect(sx, sy + ly - PH + 4, w, 2)
      }
      // Divisiones verticales de panel
      const xOff = ((wx % PW) + PW) % PW
      for (let lx = PW - xOff; lx < w + PW; lx += PW) {
        ctx.beginPath(); ctx.moveTo(sx + lx, sy); ctx.lineTo(sx + lx, sy + h); ctx.stroke()
      }
      // Bordes biselados metálicos (azul-gris frío)
      ctx.fillStyle = "#263A5499"; ctx.fillRect(sx, sy, w, 3); ctx.fillRect(sx, sy, 3, h)
      ctx.fillStyle = "#04060A99"; ctx.fillRect(sx + w - 2, sy, 2, h); ctx.fillRect(sx, sy + h - 2, w, 2)
      if (gfx >= 2) {
        // Remaches en intersecciones de paneles (metal oscuro)
        ctx.fillStyle = "#2A3650"
        for (let ly = PH - yOff; ly < h + PH; ly += PH) {
          for (let lx = PW - xOff; lx < w + PW; lx += PW) {
            ctx.beginPath(); ctx.arc(sx + lx - 5, sy + ly - 5, 2.5, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(sx + lx + 5, sy + ly - 5, 2.5, 0, Math.PI * 2); ctx.fill()
          }
        }
        // Franjas de advertencia naranja en borde inferior
        const strW = 8
        const xOff2 = ((wx % (strW * 2)) + strW * 2) % (strW * 2)
        for (let lx = -xOff2; lx < w; lx += strW * 2) {
          ctx.fillStyle = "#FF550028"; ctx.fillRect(sx + lx, sy + h - 5, strW, 5)
        }
        // Etiqueta de panel (ocasional)
        if (hash < 3 && w > 50) {
          ctx.strokeStyle = "#FF550033"; ctx.lineWidth = 1
          ctx.strokeRect(sx + 6, sy + 8, 22, 10)
          ctx.fillStyle = "#FF550022"; ctx.fillRect(sx + 7, sy + 9, 20, 8)
        }
      }
      // Borde naranja industrial en el tope
      ctx.fillStyle = "#FF550028"; ctx.fillRect(sx, sy, w, 1)
    }

  } else if (wi === 2) {
    // ══ W2 LOS TUBOS ══ Ladrillo húmedo de alcantarilla, musgo, filtraciones tóxicas
    ctx.fillStyle = "#0C1610"; ctx.fillRect(sx, sy, w, h)
    if (gfx >= 1) {
      const BH = 20, BW = 34
      ctx.strokeStyle = "#080E08"; ctx.lineWidth = 1
      // Hiladas de ladrillo (world-aligned)
      const yOff = ((wy % BH) + BH) % BH
      for (let ly = BH - yOff; ly < h + BH; ly += BH) {
        ctx.beginPath(); ctx.moveTo(sx, sy + ly); ctx.lineTo(sx + w, sy + ly); ctx.stroke()
      }
      // Verticales con offset alternado
      const xOff = ((wx % BW) + BW) % BW
      for (let ly = -yOff; ly <= h; ly += BH) {
        const row = Math.floor((wy + ly) / BH)
        const xShift = (row % 2) ? BW / 2 : 0
        const firstLx = ((BW - ((xOff + xShift) % BW)) % BW)
        for (let lx = firstLx - BW; lx < w + BW; lx += BW) {
          ctx.beginPath()
          ctx.moveTo(sx + lx, sy + Math.max(-1, ly))
          ctx.lineTo(sx + lx, sy + Math.min(h + 1, ly + BH))
          ctx.stroke()
        }
      }
      // Bordes: tonos húmedos pantanosos
      ctx.fillStyle = "#182A1C99"; ctx.fillRect(sx, sy, w, 2); ctx.fillRect(sx, sy, 2, h)
      ctx.fillStyle = "#06080699"; ctx.fillRect(sx + w - 2, sy, 2, h); ctx.fillRect(sx, sy + h - 2, w, 2)
      if (gfx >= 2) {
        // Manchas de humedad / eflorescencia (verde musgo)
        const rx = sx + (hash * 13 % Math.max(1, w - 16))
        const ry = sy + (hash * 9 % Math.max(1, h - 10))
        ctx.fillStyle = "#082A1433"; ctx.fillRect(rx, ry, 14 + (hash % 12), 9 + (hash % 6))
        // Musgo en el borde inferior
        if (h > 30) {
          const nMoss = Math.floor(w / 14)
          for (let i = 0; i < nMoss; i++) {
            const mh = 3 + ((hash + i * 3) % 5)
            ctx.fillStyle = `rgba(0,${44 + (hash + i) % 36},${16 + i % 14},0.3)`
            ctx.fillRect(sx + i * 14 + ((hash * 3) % 7), sy + h - mh, 8, mh)
          }
        }
        // Filtración de agua (línea fina vertical)
        if (hash % 4 === 0) {
          ctx.strokeStyle = "#00441822"; ctx.lineWidth = 1
          const dripX = sx + (hash * 11 % Math.max(1, w - 4))
          ctx.beginPath()
          ctx.moveTo(dripX, sy)
          ctx.lineTo(dripX, sy + Math.min(h, 18 + hash % 14))
          ctx.stroke()
        }
        // Conector de tubería en extremo (hash par)
        if (hash % 5 === 0 && w > 60) {
          ctx.fillStyle = "#183020"; ctx.fillRect(sx + w - 10, sy + h * 0.25, 10, h * 0.5)
          ctx.strokeStyle = "#081A0C"; ctx.lineWidth = 1
          ctx.strokeRect(sx + w - 10, sy + h * 0.25, 10, h * 0.5)
        }
      }
      // Borde cian tóxico en el tope (filtración química)
      ctx.fillStyle = "#00DD8820"; ctx.fillRect(sx, sy, w, 1)
    }

  } else {
    // ══ W3 CTRL. CENTRAL ══ Concreto digital distópico, neón magenta
    ctx.fillStyle = "#100E28"; ctx.fillRect(sx, sy, w, h)
    if (gfx >= 1) {
      const PH = 32, PW = 60
      ctx.strokeStyle = "#090810"; ctx.lineWidth = 1
      const yOff = ((wy % PH) + PH) % PH
      // Bloques de hormigón urbano (pisos de fachada)
      for (let ly = PH - yOff; ly < h + PH; ly += PH) {
        ctx.beginPath(); ctx.moveTo(sx, sy + ly); ctx.lineTo(sx + w, sy + ly); ctx.stroke()
        ctx.fillStyle = "#1A183A22"; ctx.fillRect(sx, sy + ly - 2, w, 2)
      }
      // Divisiones verticales
      const xOff = ((wx % PW) + PW) % PW
      for (let lx = PW - xOff; lx < w + PW; lx += PW) {
        ctx.beginPath(); ctx.moveTo(sx + lx, sy); ctx.lineTo(sx + lx, sy + h); ctx.stroke()
      }
      // Bordes: luz arriba (violeta), sombra abajo
      ctx.fillStyle = "#28224499"; ctx.fillRect(sx, sy, w, 3); ctx.fillRect(sx, sy, 2, h)
      ctx.fillStyle = "#05030A99"; ctx.fillRect(sx + w - 2, sy, 2, h); ctx.fillRect(sx, sy + h - 2, w, 2)
      if (gfx >= 2) {
        // Ventanas oscuras en bloques grandes (fachada de edificio)
        if (h > 58 && w > 70) {
          const numW = Math.floor((w - 16) / 28)
          for (let i = 0; i < numW; i++) {
            const winX = sx + 8 + i * 28, winY = sy + 10
            const lit = ((hash + i * 5) % 7) === 0
            ctx.fillStyle = lit ? "#BB00EE20" : "#07050E"
            ctx.fillRect(winX, winY, 18, 13)
            if (lit) {
              ctx.strokeStyle = "#CC00FF44"; ctx.lineWidth = 0.5
              ctx.strokeRect(winX, winY, 18, 13)
            }
          }
        }
        // Grafiti (marcas de spray diagonales)
        if (hash < 4 && w > 40 && h > 20) {
          ctx.strokeStyle = `rgba(${155 + hash * 15},0,${195 + hash * 10},0.2)`
          ctx.lineWidth = 1
          const gx0 = sx + 10 + (hash * 7 % Math.max(1, w - 40))
          const gy0 = sy + h * 0.42
          ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx0 + 22 + hash * 3, gy0 + 8); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(gx0 + 4, gy0 - 4); ctx.lineTo(gx0 + 18, gy0 + 12); ctx.stroke()
        }
        // Marco de neón en algunos bloques
        if (hash % 5 === 1 && w > 60 && h > 40) {
          ctx.strokeStyle = "#9900CC22"; ctx.lineWidth = 1
          ctx.strokeRect(sx + 3, sy + 3, w - 6, h - 6)
        }
      }
      // Brillo de neón magenta en el tope (2 px)
      ctx.fillStyle = "#CC00FF30"; ctx.fillRect(sx, sy, w, 1)
      ctx.fillStyle = "#CC00FF18"; ctx.fillRect(sx, sy + 1, w, 1)
    }
  }
  ctx.restore()
}

// ── Plataforma atravesable: estilo por mundo ─────────────────────────────────
function drawTraversableTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, wi: number, gfx: number) {
  if (wi === 0) {
    // Perrera: barra de reja herrumbrada, tono óxido cálido
    ctx.fillStyle = "#3A2C18BB"; ctx.fillRect(sx, sy, w, 5)
    ctx.fillStyle = "#4A3820"; ctx.fillRect(sx, sy, w, 2)
    if (gfx >= 1) {
      ctx.fillStyle = "#D4C4001A"; ctx.fillRect(sx, sy, w, h)
      for (let bx = sx; bx < sx + w; bx += 7) {
        ctx.fillStyle = "#60501855"; ctx.fillRect(bx, sy, 2, 5)
      }
    }
  } else if (wi === 1) {
    // Fábrica: pasarela metálica azul-gris, bordes naranja advertencia
    ctx.fillStyle = "#1A2A40BB"; ctx.fillRect(sx, sy, w, 5)
    ctx.fillStyle = "#263A58"; ctx.fillRect(sx, sy, w, 2)
    if (gfx >= 1) {
      ctx.fillStyle = "#FF55001A"; ctx.fillRect(sx, sy, w, h)
      for (let bx = sx; bx < sx + w; bx += 10) {
        ctx.fillStyle = "#2A3C5C44"; ctx.fillRect(bx, sy, 1, 5)
      }
      ctx.fillStyle = "#FF550055"; ctx.fillRect(sx, sy, 5, 2)
      ctx.fillStyle = "#FF550055"; ctx.fillRect(sx + w - 5, sy, 5, 2)
    }
  } else if (wi === 2) {
    // Tubos: tubería horizontal oxidada con borde cian tóxico
    ctx.fillStyle = "#142818BB"; ctx.fillRect(sx, sy, w, 5)
    ctx.fillStyle = "#1E3820"; ctx.fillRect(sx, sy, w, 2)
    if (gfx >= 1) {
      ctx.fillStyle = "#00DD8818"; ctx.fillRect(sx, sy, w, h)
      ctx.fillStyle = "#00DD8840"; ctx.fillRect(sx, sy, w, 1)
    }
  } else {
    // Ctrl Central: repisa de concreto digital, brillo magenta
    ctx.fillStyle = "#18163ABB"; ctx.fillRect(sx, sy, w, 5)
    ctx.fillStyle = "#201E48"; ctx.fillRect(sx, sy, w, 2)
    if (gfx >= 1) {
      ctx.fillStyle = "#CC00FF18"; ctx.fillRect(sx, sy, w, h)
      ctx.fillStyle = "#CC00FF44"; ctx.fillRect(sx, sy, w, 1)
    }
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, g: G) {
  const { cx, cy } = g, ap = activePlats(g)
  const wi = getWorldAtX(g.cx)
  const th = THEMES[wi]
  const now = Date.now()

  for (const p of ap) {
    const sx = p.x - cx, sy = p.y - cy
    if (sx + p.w < -4 || sx > CW + 4 || sy + p.h < -4 || sy > CH + 4) continue

    // Puerta sellada
    if (p.mode === "d") {
      const t = now * 0.003
      const isBossEntrance = p.sw !== undefined && p.sw < 0
      if (isBossEntrance) {
        // Puerta roja intensa — bloqueada hasta matar enemigos normales
        ctx.fillStyle = "#3A0000BB"; ctx.fillRect(sx, sy, p.w, p.h)
        ctx.fillStyle = `rgba(200,0,0,${0.5 + 0.4 * Math.sin(t * 1.8)})`; ctx.fillRect(sx + 2, sy + 2, p.w - 4, p.h - 4)
        ctx.strokeStyle = "#FF2200"; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, p.w, p.h)
        ctx.fillStyle = "#FF4400"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚠BOSS⚠", sx + p.w / 2, sy + p.h / 2 + 3); ctx.textAlign = "left"
      } else {
        ctx.fillStyle = th.doorC + "BB"; ctx.fillRect(sx, sy, p.w, p.h)
        ctx.fillStyle = `rgba(255,80,0,${0.3 + 0.3 * Math.sin(t)})`; ctx.fillRect(sx + 2, sy + 2, p.w - 4, p.h - 4)
        ctx.strokeStyle = th.doorC; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, p.w, p.h)
        ctx.fillStyle = "#FFF"; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("██SELLADO██", sx + p.w / 2, sy + p.h / 2 + 4); ctx.textAlign = "left"
      }
      continue
    }

    const pWi = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))

    // Plataforma atravesable
    if (p.mode === "t") {
      drawTraversableTile(ctx, sx, sy, p.w, p.h, pWi, g.gfx)
      continue
    }

    // Tile sólido con textura por mundo
    const hash = ((p.x * 7 + p.y * 13) >>> 0) % 16
    drawSolidTile(ctx, sx, sy, p.w, p.h, pWi, hash, g.gfx, p.x, p.y)
  }
}

function drawCheckpoints(ctx: CanvasRenderingContext2D, g: G) {
  const p = g.pl, t = Date.now() * 0.001
  for (const cp of ALL_CPS) {
    const bedCX = cp.x + PW / 2, bedCY = cp.y + PH
    const sx = bedCX - g.cx, sy = bedCY - g.cy
    if (sx + 90 < 0 || sx - 90 > CW || sy + 10 < 0 || sy - 80 > CH) continue

    const th = THEMES[cp.w]
    const discovered = g.discoveredCPs.has(cp.id)
    const isSpawn = g.checkpoint.w === cp.w && Math.abs(g.checkpoint.x - cp.x) < 40
    const isKennel = KENNEL_ROOMS[cp.w].c === cp.c && KENNEL_ROOMS[cp.w].r === cp.r
    const dx = p.x + p.w / 2 - bedCX, dy = p.y + p.h / 2 - (bedCY - PH / 2)
    const near = Math.sqrt(dx * dx + dy * dy) < CP_RADIUS
    const pulse = 0.65 + 0.35 * Math.sin(t * 2.8)

    // ── Halo de radio cuando el jugador está cerca ──
    if (near) {
      ctx.save(); ctx.strokeStyle = th.accent + "33"; ctx.lineWidth = 1; ctx.setLineDash([4, 6])
      ctx.beginPath(); ctx.arc(sx, sy - 18, CP_RADIUS, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([]); ctx.restore()
    }

    // ── Resplandor de punto activo ──
    if (isSpawn) {
      const grad = ctx.createRadialGradient(sx, sy - 20, 6, sx, sy - 20, 55)
      grad.addColorStop(0, th.accent + "40"); grad.addColorStop(1, th.accent + "00")
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sx, sy - 20, 55, 0, Math.PI * 2); ctx.fill()
    }

    if (isKennel) {
      // ── Casa/kennel original para los puntos Oeste (home base) ──────
      const kw = 78, kh = 58
      ctx.fillStyle = isSpawn ? th.wall + "EE" : discovered ? "#1E2420" : "#181818"
      ctx.fillRect(sx - kw / 2, sy - kh, kw, kh)
      ctx.fillStyle = isSpawn ? th.accent : discovered ? th.rockHi : "#2A2A2A"
      ctx.beginPath(); ctx.moveTo(sx - kw / 2 - 8, sy - kh); ctx.lineTo(sx, sy - kh - 30)
      ctx.lineTo(sx + kw / 2 + 8, sy - kh); ctx.closePath(); ctx.fill()
      if (isSpawn) {
        ctx.strokeStyle = th.accent + "AA"; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(sx - kw / 2 - 8, sy - kh); ctx.lineTo(sx, sy - kh - 30)
        ctx.lineTo(sx + kw / 2 + 8, sy - kh); ctx.closePath(); ctx.stroke()
      }
      // Entrada
      ctx.fillStyle = "#0A0A0A"
      ctx.beginPath(); ctx.arc(sx, sy - 16, 16, Math.PI, 0); ctx.rect(sx - 16, sy - 16, 32, 16); ctx.fill()
      ctx.strokeStyle = isSpawn ? th.accent + "CC" : discovered ? "#3A3A3A" : "#222"
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy - 16, 16, Math.PI, 0); ctx.stroke()
    } else {
      // ── Colchoncito de perro (nuevos checkpoints) ──────────────────
      const bw = 56, bh = 22
      // Sombra del colchón
      ctx.fillStyle = "rgba(0,0,0,0.45)"
      ctx.beginPath(); ctx.ellipse(sx, sy - 4, bw / 2 + 4, 7, 0, 0, Math.PI * 2); ctx.fill()
      // Base del colchón (oval)
      ctx.fillStyle = discovered ? (isSpawn ? th.wall : th.rock) : "#1A1A1A"
      ctx.beginPath(); ctx.ellipse(sx, sy - 10, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.fill()
      // Borde del colchón
      ctx.strokeStyle = discovered ? (isSpawn ? th.accent + "CC" : th.rockHi) : "#2A2A2A"
      ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy - 10, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.stroke()
      // Relleno interno (cojín)
      ctx.fillStyle = discovered ? (isSpawn ? th.wallHi : th.wall) : "#141414"
      ctx.beginPath(); ctx.ellipse(sx, sy - 10, bw / 2 - 5, bh / 2 - 4, 0, 0, Math.PI * 2); ctx.fill()
      // Costuras decorativas del colchón
      if (discovered) {
        ctx.strokeStyle = th.rock + "AA"; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.ellipse(sx - 8, sy - 10, 6, bh / 2 - 6, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.ellipse(sx + 8, sy - 10, 6, bh / 2 - 6, 0, 0, Math.PI * 2); ctx.stroke()
      }
      // Hueso decorativo encima (si descubierto y no activo)
      if (discovered && !isSpawn) {
        ctx.fillStyle = th.rockHi + "99"; ctx.font = "10px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("🦴", sx, sy - 7); ctx.textAlign = "left"
      }
    }

    // ── Estrella flotante + nombre cuando es spawn activo ──
    if (isSpawn) {
      const bounce = Math.sin(t * 2) * 3
      ctx.fillStyle = th.accent; ctx.font = "bold 16px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText("★", sx, sy - (isKennel ? 68 : 38) + bounce)
      ctx.font = "9px 'Courier New',monospace"; ctx.fillStyle = th.accent + "BB"
      ctx.fillText(cp.icon + " RESPAWN", sx, sy - (isKennel ? 78 : 48) + bounce)
      ctx.textAlign = "left"
    }

    // ── Indicador de descubrimiento (primera vez) ──
    if (!discovered && near) {
      ctx.globalAlpha = pulse; ctx.fillStyle = "rgba(0,0,0,0.85)"
      ctx.beginPath(); ctx.roundRect(sx - 60, sy - 56, 120, 22, 4); ctx.fill()
      ctx.fillStyle = "#FFDD88"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText("¡ NUEVO CHECKPOINT !", sx, sy - 40)
      ctx.textAlign = "left"; ctx.globalAlpha = 1
    }

    // ── Prompt de interacción ──
    if (near && discovered) {
      const canTP = g.discoveredCPs.size >= 2
      ctx.globalAlpha = pulse
      ctx.fillStyle = "rgba(0,0,0,0.82)"; ctx.beginPath()
      ctx.roundRect(sx - 76, sy - 68, 152, canTP ? 42 : 26, 5); ctx.fill()
      ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText(!isSpawn ? "[E]  GUARDAR AQUÍ" : "★  PUNTO ACTIVO", sx, sy - 50)
      if (canTP) {
        ctx.fillStyle = th.accent; ctx.font = "9px 'Courier New',monospace"
        ctx.fillText("[T]  TELETRANSPORTAR", sx, sy - 36)
      }
      ctx.textAlign = "left"; ctx.globalAlpha = 1
    }
  }
}

// ── Menú de teletransportación ───────────────────────────────────────────────
function drawTPMenu(ctx: CanvasRenderingContext2D, g: G) {
  if (!g.tpMenu || !g.tpMenu.open) return
  const th = THEMES[getWorldAtX(g.cx)]
  const discovered = ALL_CPS.filter(cp => g.discoveredCPs.has(cp.id))
  const mW = 320, mH = Math.min(discovered.length * 28 + 64, CH - 80)
  const mX = (CW - mW) / 2, mY = (CH - mH) / 2

  // Fondo del menú
  ctx.fillStyle = "rgba(0,0,0,0.92)"; ctx.beginPath(); ctx.roundRect(mX, mY, mW, mH, 10); ctx.fill()
  ctx.strokeStyle = th.accent + "AA"; ctx.lineWidth = 1.5; ctx.strokeRect(mX, mY, mW, mH)
  // Título
  ctx.fillStyle = th.accent; ctx.font = "bold 12px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText("⚡  TELETRANSPORTACIÓN", mX + mW / 2, mY + 20)
  ctx.fillStyle = "#3A5A3A"; ctx.font = "9px 'Courier New',monospace"
  ctx.fillText("↑↓ navegar  ·  ENTER confirmar  ·  ESC cerrar", mX + mW / 2, mY + 34)
  ctx.textAlign = "left"

  const listY = mY + 50, itemH = 28
  const maxVisible = Math.floor((mH - 60) / itemH)
  const startIdx = Math.max(0, Math.min(g.tpMenu.idx - Math.floor(maxVisible / 2), discovered.length - maxVisible))
  for (let i = 0; i < Math.min(maxVisible, discovered.length); i++) {
    const cp = discovered[startIdx + i]
    if (!cp) continue
    const th = THEMES[cp.w]
    const iy = listY + i * itemH
    const isSelected = startIdx + i === g.tpMenu.idx
    if (isSelected) {
      ctx.fillStyle = th.accent + "22"; ctx.beginPath(); ctx.roundRect(mX + 6, iy, mW - 12, itemH - 2, 4); ctx.fill()
      ctx.strokeStyle = th.accent + "88"; ctx.lineWidth = 1; ctx.strokeRect(mX + 6, iy, mW - 12, itemH - 2)
    }
    ctx.fillStyle = isSelected ? th.accent : "#666666"; ctx.font = "bold 9px 'Courier New',monospace"
    ctx.fillText(`${cp.icon}  ${cp.label}`, mX + 16, iy + 17)
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const p = g.pl; if (p.inv > 0 && Math.floor(Date.now() / 80) % 2 === 0) return
  const sx = p.x - g.cx, sy = p.y - g.cy
  const spr = sprs["player_" + p.pa] || sprs["player_idle"]
  if (spr && spr.complete && spr.naturalWidth > 0) {
    const fw = spr.width / 4, fh = spr.height / 4, col = p.pf % 4, row = Math.floor(p.pf / 4)
    if (p.facing === -1) { ctx.save(); ctx.translate(sx + p.w, sy); ctx.scale(-1, 1); ctx.drawImage(spr, col * fw, row * fh, fw, fh, 0, 0, p.w, p.h); ctx.restore() }
    else ctx.drawImage(spr, col * fw, row * fh, fw, fh, sx, sy, p.w, p.h); return
  }
  ctx.save(); if (p.facing === -1) { ctx.translate(sx + p.w, sy); ctx.scale(-1, 1) } else ctx.translate(sx, sy)
  const hp = p.hp / p.maxHp; ctx.fillStyle = hp > 0.66 ? "#D2B48C" : hp > 0.33 ? "#C19A6B" : "#A0785A"
  ctx.fillRect(4, 16, 22, 26); ctx.fillRect(6, 2, 20, 18); ctx.fillStyle = "#555"; ctx.fillRect(3, 0, 26, 12); ctx.fillRect(2, 4, 28, 10)
  ctx.fillStyle = "#888"; ctx.fillRect(8, 2, 16, 8); ctx.fillStyle = "#00BFFF44"; ctx.fillRect(8, 4, 16, 7)
  ctx.fillStyle = "#FFF"; ctx.fillRect(9, 6, 4, 3); ctx.fillRect(19, 6, 4, 3); ctx.fillStyle = "#111"; ctx.fillRect(10, 7, 2, 2); ctx.fillRect(20, 7, 2, 2)
  ctx.fillStyle = "#FFD700"; ctx.fillRect(13, 23, 6, 2); ctx.restore()
}

function pickEnemySprite(e: Enemy): string {
  const dir = e.dying ? e.deathDir : e.dir
  const side = dir >= 0 ? "right" : "left"
  if (e.boss) {
    if (e.dying) return `boos_defeat_${side}`
    if (e.hurtTimer > 0) return `boos_hurt_${side}`
    if (e.sa > 0) return `boos_atack_${side}`
    if (e.isMoving) return `boos_flight_${side}`
    return "enemy_idle"
  } else {
    if (e.dying) return `enemy_death_${side}`
    if (e.hurtTimer > 0) return `enemy_hurt_${side}`
    if (e.sa > 0) return `enemy_atack_${side}`
    if (e.isMoving) return `enemy_walk_${side}`
    return "enemy_idle"
  }
}

function drawSpriteFrame(ctx: CanvasRenderingContext2D, spr: HTMLImageElement, frame: number, dx: number, dy: number, dw: number, dh: number) {
  const cols = 4, rows = 4, fw = spr.width / cols, fh = spr.height / rows
  const col = frame % cols, row = Math.floor(frame / cols)
  ctx.drawImage(spr, col * fw, row * fh, fw, fh, dx, dy, dw, dh)
}

function drawEnemies(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  if (g.noEnemies) return

  for (const e of g.enemies) {
    if (!e.active) continue
    const sx = e.x - g.cx, sy = e.y - g.cy
    if (sx + e.w < -10 || sx > CW + 10 || sy + e.h < -10 || sy > CH + 10) continue
    const wi = Math.max(0, Math.min(e.world, NW - 1)), th = THEMES[wi]
    if (e.dying) { const fade = Math.max(0, 1 - (e.deathTimer - 0.9) / 0.45); ctx.globalAlpha = Math.min(1, fade) }
    if (e.hurtTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) { ctx.globalAlpha = 0.45 }
    const key = pickEnemySprite(e)
    const spr = sprs[key]
    if (spr && spr.complete && spr.naturalWidth > 0) {
      drawSpriteFrame(ctx, spr, e.ef, sx, sy, e.w, e.h)
    } else {
      ctx.fillStyle = e.boss ? th.doorC : th.wallHi
      if (e.boss) {
        ctx.shadowColor = th.accent; ctx.shadowBlur = 14; ctx.fillRect(sx, sy, e.w, e.h); ctx.shadowBlur = 0
        ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.strokeRect(sx + 2, sy + 2, e.w - 4, e.h - 4)
        ctx.fillStyle = th.accent + "55"; ctx.fillRect(sx + 10, sy + 10, e.w - 20, e.h - 20)
        ctx.fillStyle = "#FF0000"
        ctx.beginPath(); ctx.arc(sx + e.w * .32, sy + e.h * .35, 7, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(sx + e.w * .68, sy + e.h * .35, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = "#FF8800"
        ctx.beginPath(); ctx.arc(sx + e.w * .32, sy + e.h * .35, 3, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(sx + e.w * .68, sy + e.h * .35, 3, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.fillRect(sx, sy, e.w, e.h)
        ctx.fillStyle = "#FF0000"
        ctx.beginPath(); ctx.arc(sx + e.w * .3, sy + e.h * .3, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(sx + e.w * .7, sy + e.h * .3, 4, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = "#111"; ctx.fillRect(sx + e.w * .2, sy + e.h * .55, e.w * 0.6, 3)
      }
    }
    ctx.globalAlpha = 1
    // Barra de HP sobre la cabeza — solo enemigos normales (el boss usa la barra del HUD)
    if (!e.dying && !e.boss) {
      const hpR = Math.max(0, e.hp) / e.mhp
      ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(sx, sy - 11, e.w, 8)
      ctx.fillStyle = hpR > 0.5 ? "#00CC44" : hpR > 0.25 ? "#FFAA00" : "#FF2222"
      ctx.fillRect(sx + 1, sy - 10, Math.max(0, (e.w - 2) * hpR), 6)
    }
    if (e.alert && e.state === "chase" && !e.dying) {
      ctx.fillStyle = "#FFD700"; ctx.font = `bold ${e.boss ? 20 : 15}px 'Courier New',monospace`; ctx.textAlign = "center"
      ctx.fillText("!", sx + e.w / 2, sy - (e.boss ? 18 : 13)); ctx.textAlign = "left"
    }
  }
}

function drawWhip(ctx: CanvasRenderingContext2D, g: G) {
  const w = g.whip; if (!w) return
  const sx1 = w.x - g.cx, sy1 = w.y - g.cy, sx2 = w.ex - g.cx, sy2 = w.ey - g.cy
  const len = Math.sqrt((sx2 - sx1) ** 2 + (sy2 - sy1) ** 2)
  const wi = getWorldAtX(g.cx), cols = ["#8B4513", "#A0A0A0", "#4682B4", "#9400D3"]
  ctx.save(); ctx.translate(sx1, sy1); ctx.rotate(Math.atan2(sy2 - sy1, sx2 - sx1))
  ctx.fillStyle = "#5A2D0F"; ctx.fillRect(-5, -3, 10, 6); ctx.fillStyle = cols[wi]; ctx.fillRect(5, -2, len - 10, 4)
  ctx.fillStyle = "#FFF"; ctx.fillRect(len - 6, -1, 6, 2); ctx.restore()
}

function drawProjs(ctx: CanvasRenderingContext2D, g: G) {
  const wi = getWorldAtX(g.cx), th = THEMES[wi]
  for (const pr of g.projs) {
    if (!pr.active) continue
    const sx = pr.x - g.cx, sy = pr.y - g.cy
    if (sx < -20 || sx > CW + 20 || sy < -20 || sy > CH + 20) continue
    ctx.save(); ctx.translate(sx, sy)
    if (pr.pl) {
      ctx.rotate(pr.rot * Math.PI / 180)
      const col = pr.parried ? "#44FFFF" : "#F4E4C4"
      if (pr.parried) {
        // Aura de parry: brillo cian
        ctx.shadowColor = "#00FFFF"; ctx.shadowBlur = 10
      }
      ctx.fillStyle = col; ctx.fillRect(-9, -3, 18, 6)
      ctx.beginPath(); ctx.arc(-9, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(9, 0, 5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(-9, -4, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(-9, 4, 3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(9, -4, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(9, 4, 3, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    } else if (pr.star) { ctx.rotate(pr.rot * Math.PI / 180); ctx.fillStyle = th.doorC; ctx.fillRect(-6, -1.5, 12, 3); ctx.fillRect(-1.5, -6, 3, 12) }
    else { ctx.fillStyle = th.doorC + "DD"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = th.doorC; ctx.lineWidth = 2; ctx.stroke() }
    ctx.restore()
  }
}

function drawBones(ctx: CanvasRenderingContext2D, g: G) {
  for (const b of g.bones) {
    if (!b.active) continue
    const sx = b.x - g.cx, sy = b.y - g.cy
    if (sx < -20 || sx > CW + 20) continue
    ctx.fillStyle = "#F4A460"; ctx.beginPath(); ctx.roundRect(sx, sy, b.w, b.h, 3); ctx.fill()
  }
}

function drawCrates(ctx: CanvasRenderingContext2D, g: G) {
  for (const c of g.crates) {
    if (!c.active) continue
    const sx = c.x - g.cx, sy = c.y - g.cy
    if (sx + c.w < -20 || sx > CW + 20 || sy + c.h < -20 || sy > CH + 20) continue
    const wi = Math.max(0, Math.min(Math.floor(c.x / (NC * RW)), NW - 1)), th = THEMES[wi]
    ctx.fillStyle = th.accent; ctx.fillRect(sx, sy, c.w, c.h); ctx.fillStyle = th.wallHi; ctx.fillRect(sx + 2, sy + 2, c.w - 4, c.h - 4)
    ctx.fillStyle = th.wall; ctx.fillRect(sx + c.w / 2 - 1, sy + 3, 3, c.h - 6); ctx.fillRect(sx + 3, sy + c.h / 2 - 1, c.w - 6, 3)
    ctx.strokeStyle = th.accent + "66"; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, c.w, c.h)
  }
}

function drawDrops(ctx: CanvasRenderingContext2D, g: G) {
  for (const d of g.drops) {
    if (!d.active) continue
    const sx = d.x - g.cx, sy = d.y - g.cy
    if (d.kind === "h") {
      const t = Date.now() * 0.004; ctx.save(); ctx.translate(sx + 9, sy + 9); ctx.scale(.9 + Math.sin(t) * .1, .9 + Math.sin(t) * .1)
      ctx.fillStyle = "#FF1744"; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(0, 5, -9, -2, -9, 1); ctx.bezierCurveTo(-9, -4, 0, -8, 0, -3); ctx.bezierCurveTo(0, -8, 9, -4, 9, 1); ctx.bezierCurveTo(9, -2, 0, 5, 0, 8); ctx.fill(); ctx.restore()
    } else {
      const t = Date.now() * .003; ctx.save(); ctx.translate(sx + 10, sy + 10); ctx.rotate(t)
      ctx.fillStyle = "#F5DEB3"; ctx.fillRect(-10, -2, 20, 4); ctx.fillRect(-2, -10, 4, 20); ctx.restore()
      ctx.fillStyle = "#FFF"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"; ctx.fillText("+10", sx + 10, sy - 2); ctx.textAlign = "left"
    }
  }
}

function getRoomState(w: number, c: number, r: number, dead: Set<string>): "clear" | "half" | "full" {
  const sp = getEnemySpawns(w, c, r); if (sp.length === 0) return "clear"
  const killed = sp.filter((_, i) => isSpawnDead(dead, w, c, r, i)).length
  if (killed >= sp.length) return "clear"; if (killed >= sp.length / 2) return "half"; return "full"
}

function getCratesInRoom(w: number, c: number, r: number, g: G): number {
  const { x: x0, y: y0 } = ro(w, c, r)
  return g.crates.filter(cr => cr.active && cr.x >= x0 && cr.x < x0 + RW && cr.y >= y0 && cr.y < y0 + RH).length
}

function drawMinimap(ctx: CanvasRenderingContext2D, g: G) {
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  const th = THEMES[curW]
  const large = !!g.keys["z"]
  const rw = large ? 16 : 9, rh = large ? 11 : 6, gap = large ? 2 : 1
  const gridW = NC * (rw + gap) - gap, gridH = NR * (rh + gap) - gap
  const pad = 8, mw = gridW + pad * 2, mh = gridH + pad * 2 + 14
  const mx = CW - mw - 6, my = CH - mh - 6
  ctx.fillStyle = "rgba(0,0,0,0.88)"; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 7); ctx.fill()
  ctx.strokeStyle = th.accent + "66"; ctx.lineWidth = 1.5; ctx.strokeRect(mx, my, mw, mh)
  const gx = mx + pad, gy = my + pad
  const doorCol = th.accent + "CC"

  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const rx = gx + c * (rw + gap), ry = gy + r * (rh + gap)
    const roomKey = `${curW}_${c}_${r}`
    const explored = g.explored.has(roomKey)
    const isCur = c === curC && r === curR
    const doors = computeDoors(curW, c, r)
    if (!explored && !isCur) {
      ctx.fillStyle = "#0E0E0E"; ctx.fillRect(rx, ry, rw, rh)
      const nbL = c > 0 && g.explored.has(`${curW}_${c - 1}_${r}`) && computeDoors(curW, c - 1, r).R
      const nbR2 = c < NC - 1 && g.explored.has(`${curW}_${c + 1}_${r}`) && computeDoors(curW, c + 1, r).L
      const nbU = r > 0 && g.explored.has(`${curW}_${c}_${r - 1}`) && computeDoors(curW, c, r - 1).D
      const nbD2 = r < NR - 1 && g.explored.has(`${curW}_${c}_${r + 1}`) && computeDoors(curW, c, r + 1).U
      if (nbL || nbR2 || nbU || nbD2) { ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(rx, ry, rw, rh) }
      continue
    }
    const state = getRoomState(curW, c, r, g.dead)
    ctx.fillStyle = state === "clear" ? "rgba(0,210,80,0.65)" : state === "half" ? "rgba(255,185,0,0.65)" : "rgba(220,35,35,0.65)"
    ctx.fillRect(rx, ry, rw, rh)
    const kr = KENNEL_ROOMS[curW]
    if (kr.c === c && kr.r === r) { ctx.fillStyle = g.checkpoint.w === curW ? "#FFD700" : "#AAAAAA"; ctx.fillRect(rx + rw / 2 - 1, ry + 1, 2, rh - 2) }
    if (large) {
      const nCr = getCratesInRoom(curW, c, r, g)
      if (nCr > 0) { ctx.fillStyle = "#FFEE55CC"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "right"; ctx.fillText(`■${nCr}`, rx + rw - 1, ry + rh - 1); ctx.textAlign = "left" }
    }
    const dSz = Math.max(2, Math.round(Math.min(rw, rh) * 0.55))
    if (doors.R && c < NC - 1) { ctx.fillStyle = g.explored.has(`${curW}_${c + 1}_${r}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx + rw - 2, ry + Math.round((rh - dSz) / 2), 2, dSz) }
    if (doors.D && r < NR - 1) { ctx.fillStyle = g.explored.has(`${curW}_${c}_${r + 1}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx + Math.round((rw - dSz) / 2), ry + rh - 2, dSz, 2) }
    if (doors.L && c > 0) { ctx.fillStyle = g.explored.has(`${curW}_${c - 1}_${r}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx, ry + Math.round((rh - dSz) / 2), 2, dSz) }
    if (doors.U && r > 0) { ctx.fillStyle = g.explored.has(`${curW}_${c}_${r - 1}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx + Math.round((rw - dSz) / 2), ry, dSz, 2) }
  }
  // ── Iconos de checkpoints descubiertos en el minimap ──────────────────
  for (const cp of ALL_CPS) {
    if (cp.w !== curW) continue
    if (!g.discoveredCPs.has(cp.id)) continue
    const cpRx = gx + cp.c * (rw + gap) + Math.round(rw / 2)
    const cpRy = gy + cp.r * (rh + gap) + Math.round(rh / 2)
    const isActive = g.checkpoint.w === cp.w && Math.abs(g.checkpoint.x - cp.x) < 40
    // Fondo del icono
    ctx.fillStyle = isActive ? th.accent : (large ? "#FFD700AA" : "#FFD70088")
    ctx.beginPath(); ctx.arc(cpRx, cpRy, large ? 3.5 : 2.2, 0, Math.PI * 2); ctx.fill()
    if (isActive) {
      ctx.strokeStyle = "#FFF"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cpRx, cpRy, large ? 5 : 3.5, 0, Math.PI * 2); ctx.stroke()
    }
  }
  const plRx = gx + curC * (rw + gap) + Math.round(rw / 2), plRy = gy + curR * (rh + gap) + Math.round(rh / 2)
  ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(plRx, plRy, large ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = th.accent + "DD"; ctx.font = `bold ${large ? 8 : 7}px 'Courier New',monospace`; ctx.textAlign = "center"
  ctx.fillText(WORLD_NAMES[curW].slice(0, 16), mx + mw / 2, my + mh - 3)
  if (!large) { ctx.fillStyle = "#444"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText("[Z] zoom", mx + mw / 2, my + mh + 7) }
  ctx.textAlign = "left"
}

// ══════════════════════════════════════════════════════════════
//  drawFullMap — sin scroll, posición fija
// ══════════════════════════════════════════════════════════════
function drawFullMap(ctx: CanvasRenderingContext2D, g: G) {
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  ctx.fillStyle = "rgba(0,0,0,0.95)"; ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = "#2A2A2A"; ctx.lineWidth = 2; ctx.strokeRect(2, 2, CW - 4, CH - 4)
  ctx.fillStyle = "#CCC"; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText("// MAPA DEL COMPLEJO CANINO //", CW / 2, 22)
  ctx.fillStyle = "#444"; ctx.font = "9px 'Courier New',monospace"
  ctx.fillText("[TAB] cerrar   ★ = perrera/checkpoint   negro = sin explorar", CW / 2, 36)
  ctx.textAlign = "left"
  const rW = 34, rH = 22, gap = 2
  const wGridW = NC * (rW + gap) - gap, wGridH = NR * (rH + gap) - gap
  const wPadX = 10, wPadY = 8
  const panW = wGridW + wPadX * 2, panH = 18 + wGridH + 14 + wPadY * 2
  const panGap = 14, totalW = 2 * panW + panGap

  // FIX: posición fija — sin scroll
  const mLeft = Math.floor((CW - totalW) / 2)
  const mTop = 42

  for (let w = 0; w < NW; w++) {
    const mc = w % 2, mr = Math.floor(w / 2)
    const bx = mLeft + mc * (panW + panGap), by = mTop + mr * (panH + panGap)
    const th = THEMES[w], wCleared = g.cw.has(w)
    ctx.fillStyle = "#0A0A0A"; ctx.fillRect(bx, by, panW, panH)
    ctx.strokeStyle = wCleared ? th.accent : w === curW ? th.wallHi : "#2A2A2A"
    ctx.lineWidth = wCleared ? 2 : 1; ctx.strokeRect(bx, by, panW, panH)
    ctx.fillStyle = w === curW ? th.accent : wCleared ? "#888" : "#444"
    ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "left"
    ctx.fillText(`W${w + 1}  ${WORLD_NAMES[w]}`, bx + 5, by + 14)
    const gx = bx + wPadX, gy = by + wPadY + 14, kr = KENNEL_ROOMS[w]
    for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
      const rx = gx + c * (rW + gap), ry = gy + r * (rH + gap)
      const roomKey = `${w}_${c}_${r}`, explored = g.explored.has(roomKey)
      const isCur = w === curW && c === curC && r === curR
      if (!explored) {
        ctx.fillStyle = "#050505"; ctx.fillRect(rx, ry, rW, rH)
        const nbL = c > 0 && g.explored.has(`${w}_${c - 1}_${r}`) && computeDoors(w, c - 1, r).R
        const nbR2 = c < NC - 1 && g.explored.has(`${w}_${c + 1}_${r}`) && computeDoors(w, c + 1, r).L
        const nbU = r > 0 && g.explored.has(`${w}_${c}_${r - 1}`) && computeDoors(w, c, r - 1).D
        const nbD2 = r < NR - 1 && g.explored.has(`${w}_${c}_${r + 1}`) && computeDoors(w, c, r + 1).U
        if (nbL || nbR2 || nbU || nbD2) { ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(rx, ry, rW, rH); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 0.5; ctx.strokeRect(rx, ry, rW, rH) }
      } else {
        const state = getRoomState(w, c, r, g.dead)
        ctx.fillStyle = state === "clear" ? "rgba(0,160,55,0.4)" : state === "half" ? "rgba(185,145,0,0.4)" : "rgba(165,18,18,0.4)"
        ctx.fillRect(rx, ry, rW, rH)
        const ex2 = WORLD_EXITS[w]
        if (ex2[0] === c && ex2[1] === r) { ctx.fillStyle = wCleared ? "rgba(0,200,80,0.3)" : "rgba(255,60,0,0.3)"; ctx.fillRect(rx, ry, rW, rH) }
        if (kr.c === c && kr.r === r) { ctx.fillStyle = g.checkpoint.w === w ? "#FFD700" : "#555"; ctx.font = "10px 'Courier New',monospace"; ctx.textAlign = "center"; ctx.fillText("★", rx + rW / 2, ry + rH / 2 + 4); ctx.textAlign = "left" }
        const nCr = getCratesInRoom(w, c, r, g)
        if (nCr > 0) { ctx.fillStyle = "#FFEE44EE"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "right"; ctx.fillText(`■${nCr}`, rx + rW - 2, ry + rH - 2); ctx.textAlign = "left" }
        if (isCur) { ctx.strokeStyle = th.accent + "CC"; ctx.lineWidth = 1.5; ctx.strokeRect(rx, ry, rW, rH) }
        else { ctx.strokeStyle = wCleared ? th.accent + "55" : "rgba(255,255,255,0.08)"; ctx.lineWidth = 0.5; ctx.strokeRect(rx, ry, rW, rH) }
      }
      const doors = computeDoors(w, c, r)
      const nbR = `${w}_${c + 1}_${r}`, nbD = `${w}_${c}_${r + 1}`, nbL = `${w}_${c - 1}_${r}`, nbU2 = `${w}_${c}_${r - 1}`
      if (explored) {
        const dh = Math.round(rH * 0.40), dw2 = Math.round(rW * 0.40), doorW = 3
        const knownCol = th.accent + "FF", unknownCol = "rgba(255,255,255,0.85)"
        if (doors.R && c < NC - 1) { ctx.fillStyle = g.explored.has(nbR) ? knownCol : unknownCol; ctx.fillRect(rx + rW - doorW, ry + Math.round((rH - dh) / 2), doorW, dh) }
        if (doors.D && r < NR - 1) { ctx.fillStyle = g.explored.has(nbD) ? knownCol : unknownCol; ctx.fillRect(rx + Math.round((rW - dw2) / 2), ry + rH - doorW, dw2, doorW) }
        if (doors.L && c > 0) { ctx.fillStyle = g.explored.has(nbL) ? knownCol : unknownCol; ctx.fillRect(rx, ry + Math.round((rH - dh) / 2), doorW, dh) }
        if (doors.U && r > 0) { ctx.fillStyle = g.explored.has(nbU2) ? knownCol : unknownCol; ctx.fillRect(rx + Math.round((rW - dw2) / 2), ry, dw2, doorW) }
      }
    }
    // ── Iconos de checkpoints en este panel de mundo ───────────────────
    for (const cp of ALL_CPS) {
      if (cp.w !== w) continue
      if (!g.discoveredCPs.has(cp.id)) continue
      const cpRx = gx + cp.c * (rW + gap) + Math.round(rW / 2)
      const cpRy = gy + cp.r * (rH + gap) + Math.round(rH / 2)
      const isActive = g.checkpoint.w === cp.w && Math.abs(g.checkpoint.x - cp.x) < 40
      ctx.fillStyle = isActive ? THEMES[w].accent : "#FFD700"
      ctx.beginPath(); ctx.arc(cpRx, cpRy, isActive ? 5 : 3.5, 0, Math.PI * 2); ctx.fill()
      if (isActive) {
        ctx.strokeStyle = "#FFF"; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(cpRx, cpRy, 7, 0, Math.PI * 2); ctx.stroke()
      }
      if (rW >= 26) {
        ctx.fillStyle = isActive ? "#FFF" : "#AA8800"
        ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText(cp.icon, cpRx + 7, cpRy + 3); ctx.textAlign = "left"
      }
    }
    ctx.font = "9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillStyle = wCleared ? "#00FF88" : w === curW ? "#AAAAFF" : w < curW ? "#666" : "#333"
    ctx.fillText(wCleared ? "✓ LIBERADO" : w === curW ? "⟶ ACTIVO" : w < curW ? "⚔ VISITADO" : "[ BLOQUEADO ]", bx + panW / 2, by + panH - 4)
    ctx.textAlign = "left"
  }
  const ly = CH - 14, items: [string, string][] = [["#050505", "sin explorar"], ["#b22", "enemigos"], ["#aa8800", "a medias"], ["#0a5", "limpia"], ["rgba(255,60,0,0.8)", "boss"], ["#FFD700", "perrera"], ["#FFD700", "checkpoint"]]
  let lx = mLeft; ctx.font = "9px 'Courier New',monospace"
  for (const [col, lbl] of items) {
    if (lbl === "checkpoint") {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx + 4, ly + 4, 4, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = col; ctx.fillRect(lx, ly, 9, 9)
    }
    ctx.fillStyle = "#555"; ctx.fillText(" " + lbl, lx + 11, ly + 8); lx += lbl.length * 5 + 26
  }
}


function devTeleport(g: G, targetWorld: number, targetC: number, targetR: number) {
  const { x: rx, y: ry } = ro(targetWorld, targetC, targetR)

  // Activar el mundo destino (suspende el actual si es diferente)
  activateWorld(g, targetWorld)

  g.pl.x = rx + RW / 2 - PW / 2
  g.pl.y = ry + RH - WT - PH
  g.pl.vx = 0; g.pl.vy = 0
  g.pl.crouching = false; g.pl.h = PH

  g.explored.add(`${targetWorld}_${targetC}_${targetR}`)
  g.lastWorld = targetWorld
  g.showDevMap = false
  g.paused = false
}

// ══════════════════════════════════════════════════════════════
//  drawDevMap — cursor celda a celda, sin scroll
//  La grilla 9×9 con rW=80,gap=4 → gridW=752 cabe en CW=1050
// ══════════════════════════════════════════════════════════════
function drawDevMap(ctx: CanvasRenderingContext2D, g: G, hover: { w: number; c: number; r: number } | null) {
  ctx.fillStyle = "#000D00"; ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = "#00FF44"; ctx.lineWidth = 2; ctx.strokeRect(2, 2, CW - 4, CH - 4)
  ctx.fillStyle = "#00FF44"; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText("// MODO DESARROLLADOR — MAPA TELEPORT //", CW / 2, 20)
  ctx.fillStyle = "#1A6622"; ctx.font = "9px 'Courier New',monospace"
  ctx.fillText(
    `GOD: ${g.godMode ? "■ ON" : "□ OFF"} [I]    AMMO∞: ${g.infiniteAmmo ? "■ ON" : "□ OFF"} [O]    NOENM: ${g.noEnemies ? "■ ON" : "□ OFF"} [K]    OHKO: ${g.ohko ? "■ ON" : "□ OFF"} [U]    STA: ${g.staDisplay === "circle" ? "● CIRC" : "▬ BAR"} [J]    ZOOM: ${g.mobileZoom === "close" ? "🔍 CLOSE" : "🌍 FAR"} [P]    [ESC/\`] cerrar    CLICK/A = teleport    LB/RB = mundo`,
    CW / 2, 36
  )
  ctx.textAlign = "left"

  // ── Tabs de mundos — posición fija, NO se ven afectadas por nada ──
  const tabW = 120, tabH = 22, tabY = 44
  const tabsStartX = Math.floor((CW - NW * tabW) / 2)
  for (let w = 0; w < NW; w++) {
    const tx = tabsStartX + w * tabW
    const active = g.devMapWorld === w, th = THEMES[w]
    ctx.fillStyle = active ? th.accent + "33" : "#111"; ctx.fillRect(tx, tabY, tabW - 2, tabH)
    ctx.strokeStyle = active ? th.accent : "#333"; ctx.lineWidth = active ? 2 : 1; ctx.strokeRect(tx, tabY, tabW - 2, tabH)
    ctx.fillStyle = active ? th.accent : "#555"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(`W${w + 1} ${WORLD_NAMES[w].slice(0, 12)}`, tx + tabW / 2 - 1, tabY + 14); ctx.textAlign = "left"
  }

  // ── Grid de salas — posición fija centrada, sin scroll ──
  const w = g.devMapWorld, th = THEMES[w]
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  const rW = 80, rH = 48, gap = 4
  const gridW = NC * (rW + gap) - gap   // 9*84-4 = 752, cabe en CW=1050
  const gx = Math.floor((CW - gridW) / 2)  // fijo, centrado
  const gy = 72                          // fijo

  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const rx = gx + c * (rW + gap), ry = gy + r * (rH + gap)
    if (rx + rW < 0 || rx > CW || ry + rH < 44 || ry > CH) continue
    const isCur = w === curW && c === curC && r === curR
    const isHov = hover && hover.w === w && hover.c === c && hover.r === r
    const state = getRoomState(w, c, r, g.dead)
    const isKennel = KENNEL_ROOMS[w].c === c && KENNEL_ROOMS[w].r === r
    const isBoss = WORLD_EXITS[w][0] === c && WORLD_EXITS[w][1] === r
    const nCr = getCratesInRoom(w, c, r, g)
    let fill = "rgba(0,80,0,0.5)"
    if (isBoss) fill = "rgba(180,0,0,0.55)"
    else if (isKennel) fill = "rgba(60,50,0,0.7)"
    else if (state === "clear") fill = "rgba(0,120,40,0.5)"
    else if (state === "half") fill = "rgba(120,90,0,0.5)"
    ctx.fillStyle = fill; ctx.fillRect(rx, ry, rW, rH)
    if (isHov) { ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(rx, ry, rW, rH); ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rW, rH) }
    else if (isCur) { ctx.strokeStyle = th.accent; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rW, rH) }
    else { ctx.strokeStyle = th.accent + "44"; ctx.lineWidth = 1; ctx.strokeRect(rx, ry, rW, rH) }
    ctx.fillStyle = isHov ? "#FFF" : isCur ? th.accent : "#AAFFAA"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(`[${c},${r}]`, rx + rW / 2, ry + 13)
    const stateLbl = state === "clear" ? "✓ LIMPIA" : state === "half" ? "◑ MEDIA" : "⚠ ACTIVA"
    ctx.fillStyle = state === "clear" ? "#00FF88" : state === "half" ? "#FFCC00" : "#FF4444"; ctx.font = "9px 'Courier New',monospace"
    ctx.fillText(stateLbl, rx + rW / 2, ry + 25)
    const sp = getEnemySpawns(w, c, r)
    const alive = sp.filter((_, i) => !isSpawnDead(g.dead, w, c, r, i)).length
    if (alive > 0) { ctx.fillStyle = "#FF8888"; ctx.fillText(`${alive} enemigo${alive > 1 ? "s" : ""}`, rx + rW / 2, ry + 35) }
    else if (isKennel) { ctx.fillStyle = "#FFD700"; ctx.fillText("★ PERRERA", rx + rW / 2, ry + 35) }
    else if (isBoss) { ctx.fillStyle = "#FF6600"; ctx.fillText("BOSS", rx + rW / 2, ry + 35) }
    if (nCr > 0) { ctx.fillStyle = "#FFEE44"; ctx.fillText(`■${nCr} cajas`, rx + rW / 2, ry + 43) }
    ctx.textAlign = "left"
    const doors = computeDoors(w, c, r), dSz = 8
    ctx.fillStyle = th.accent + "CC"
    if (doors.R && c < NC - 1) ctx.fillRect(rx + rW - 2, ry + rH / 2 - dSz / 2, 2, dSz)
    if (doors.D && r < NR - 1) ctx.fillRect(rx + rW / 2 - dSz / 2, ry + rH - 2, dSz, 2)
    if (doors.L && c > 0) ctx.fillRect(rx, ry + rH / 2 - dSz / 2, 2, dSz)
    if (doors.U && r > 0) ctx.fillRect(rx + rW / 2 - dSz / 2, ry, dSz, 2)
  }

  // ── Cursor pulsante cyan sobre la celda seleccionada ──
  const cur = g.devMapCursor
  if (cur.c >= 0 && cur.c < NC && cur.r >= 0 && cur.r < NR) {
    const crx = gx + cur.c * (rW + gap)
    const cry = gy + cur.r * (rH + gap)
    const alpha = 0.55 + 0.45 * Math.sin(Date.now() * 0.006)
    ctx.strokeStyle = `rgba(0,255,255,${alpha})`
    ctx.lineWidth = 3
    ctx.strokeRect(crx - 1, cry - 1, rW + 2, rH + 2)
    // Mini label "SELEC" sobre el cursor
    ctx.fillStyle = `rgba(0,255,255,${alpha * 0.8})`
    ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText("► SELEC", crx + rW / 2, cry - 3)
    ctx.textAlign = "left"
  }

  const ly = CH - 16
  ctx.font = "9px 'Courier New',monospace"
  const leg: [string, string][] = [["rgba(0,120,40,0.8)", "limpia"], ["rgba(120,90,0,0.8)", "media"], ["rgba(0,80,0,0.5)", "activa"], ["rgba(180,0,0,0.8)", "boss"], ["rgba(60,50,0,0.9)", "perrera"]]
  let lx = 24
  for (const [col, lbl] of leg) { ctx.fillStyle = col; ctx.fillRect(lx, ly, 10, 10); ctx.fillStyle = "#888"; ctx.fillText(" " + lbl, lx + 12, ly + 9); lx += lbl.length * 6 + 28 }

  // Hint de controles gamepad
  ctx.fillStyle = "rgba(0,255,68,0.35)"; ctx.font = "9px 'Courier New',monospace"; ctx.textAlign = "right"
  ctx.fillText("🎮 stick/↑↓←→=cursor  LB/RB=mundo  A/Enter=teleport  B/ESC=cerrar", CW - 10, CH - 4)
  ctx.textAlign = "left"
}

// ══════════════════════════════════════════════════════════════
//  devMapHitTest — coordenadas canvas escaladas, sin scroll
//  Usa las mismas constantes que drawDevMap para coherencia exacta
// ══════════════════════════════════════════════════════════════
function devMapHitTest(mouseX: number, mouseY: number, w: number): { w: number; c: number; r: number } | null {
  // Tabs — misma posición fija que en drawDevMap
  const tabW = 120, tabH = 22, tabY = 44
  const tabsStartX = Math.floor((CW - NW * tabW) / 2)
  for (let wt = 0; wt < NW; wt++) {
    const tx = tabsStartX + wt * tabW
    if (mouseX >= tx && mouseX < tx + tabW - 2 && mouseY >= tabY && mouseY < tabY + tabH) return { w: wt, c: -1, r: -1 }
  }
  // Grid — misma posición fija que en drawDevMap
  const rW = 80, rH = 48, gap = 4
  const gridW = NC * (rW + gap) - gap
  const gx = Math.floor((CW - gridW) / 2)
  const gy = 72
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const rx = gx + c * (rW + gap), ry = gy + r * (rH + gap)
    if (mouseX >= rx && mouseX < rx + rW && mouseY >= ry && mouseY < ry + rH) return { w, c, r }
  }
  return null
}

function drawSparks(ctx: CanvasRenderingContext2D, g: G) {
  for (const s of g.sparks) {
    const t = s.life / s.maxLife
    ctx.globalAlpha = Math.min(1, t * 2); ctx.fillStyle = s.col
    ctx.beginPath(); ctx.arc(s.x - g.cx, s.y - g.cy, s.r * t, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

// Niebla oscura sobre la sala del boss cuando está bloqueada y visible en pantalla
function drawBossRoomFog(ctx: CanvasRenderingContext2D, g: G) {
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  if (!areRegularEnemiesDead(g, curW)) {
    const [bc, br] = WORLD_EXITS[curW]
    const { x: brX, y: brY } = ro(curW, bc, br)
    const sx = brX - g.cx, sy = brY - g.cy
    // Solo dibujar si el boss room es visible en pantalla
    if (sx < CW && sx + RW > 0 && sy < CH && sy + RH > 0) {
      // Overlay muy oscuro sobre la sala completa
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,0.91)"
      ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      // Neblina roja tenue en los bordes de la puerta bloqueada
      const t = Date.now() * 0.002
      ctx.fillStyle = `rgba(120,0,0,${0.15 + 0.08 * Math.sin(t)})`
      ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      // Texto ominoso si la sala está centrada en pantalla
      const roomCenterX = sx + RW / 2, roomCenterY = sy + RH / 2
      if (roomCenterX > 100 && roomCenterX < CW - 100) {
        ctx.fillStyle = `rgba(180,0,0,${0.5 + 0.3 * Math.sin(t * 1.4)})`
        ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚠  SALA DEL JEFE  ⚠", roomCenterX, roomCenterY)
        ctx.fillStyle = "rgba(120,0,0,0.7)"; ctx.font = "9px 'Courier New',monospace"
        ctx.fillText("Derrota a todos los enemigos primero", roomCenterX, roomCenterY + 18)
        ctx.textAlign = "left"
      }
      ctx.restore()
    }
  }
}

function draw(g: G, ctx: CanvasRenderingContext2D, sprs: SprBank, devHover: { w: number; c: number; r: number } | null = null) {
  ctx.clearRect(0, 0, CW, CH)
  if (g.showDevMap) { drawDevMap(ctx, g, devHover); return }
  if (g.showMap) { drawFullMap(ctx, g); return }
  // ── Zoom móvil + screen shake (solo afectan al mundo, no al HUD) ────
  const sc = g.mobileZoom === "close" ? 1.6 : 1.0
  const hasShake = g.shakeX !== 0 || g.shakeY !== 0
  ctx.save()
  if (sc !== 1) ctx.scale(sc, sc)
  if (hasShake) ctx.translate(g.shakeX / sc, g.shakeY / sc)
  drawBg(ctx, g); drawWalls(ctx, g); drawBones(ctx, g); drawCrates(ctx, g); drawCheckpoints(ctx, g)
  drawDrops(ctx, g); drawEnemies(ctx, g, sprs); drawPlayer(ctx, g, sprs); drawProjs(ctx, g); drawWhip(ctx, g)
  drawSparks(ctx, g); drawBossRoomFog(ctx, g)
  ctx.restore()
  // ── Efecto de teletransportación (pantalla completa, fuera de escala) ──
  if (g.tpAnim) {
    const prog = g.tpAnim.timer / 0.42
    const alpha = g.tpAnim.phase === 0 ? Math.min(1, prog * 1.2) : Math.max(0, 1 - prog)
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.92})`; ctx.fillRect(0, 0, CW, CH)
    if (g.tpAnim.phase === 0 && alpha > 0.3) {
      ctx.fillStyle = `rgba(150,255,150,${(alpha - 0.3) * 0.5})`; ctx.fillRect(0, 0, CW, CH)
    }
  }
  drawMinimap(ctx, g); drawHUD(ctx, g); drawTPMenu(ctx, g); drawWorldTransition(ctx, g)
}

// ══════════════════════════════════════════════════════════════
//  HUD
// ══════════════════════════════════════════════════════════════
function drawHUD(ctx: CanvasRenderingContext2D, g: G) {
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  const th = THEMES[curW], panW = 130, panX = 8
  ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.beginPath(); ctx.roundRect(panX, 8, panW, 148, 8); ctx.fill()
  ctx.strokeStyle = th.accent + "33"; ctx.lineWidth = 1; ctx.strokeRect(panX, 8, panW, 148)
  const hs = 18, hsp = 22, hy = 20
  for (let i = 0; i < p.maxHp; i++) {
    const hx = panX + 10 + i * hsp; ctx.fillStyle = i < p.hp ? "#FF1744" : "#333"
    ctx.beginPath(); ctx.moveTo(hx + hs / 2, hy + hs * .8); ctx.bezierCurveTo(hx + hs / 2, hy + hs * .6, hx, hy + hs * .3, hx, hy + hs * .5); ctx.bezierCurveTo(hx, hy + hs * .2, hx + hs * .3, hy, hx + hs / 2, hy + hs * .3); ctx.bezierCurveTo(hx + hs * .7, hy, hx + hs, hy + hs * .2, hx + hs, hy + hs * .5); ctx.bezierCurveTo(hx + hs, hy + hs * .3, hx + hs / 2, hy + hs * .6, hx + hs / 2, hy + hs * .8); ctx.fill()
  }
  ctx.fillStyle = th.accent + "99"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText("ENEMIGOS SALA", panX + 10, hy + hs + 16)
  const roomSpawns = getEnemySpawns(curW, curC, curR)
  const eCy = hy + hs + 26, eR = 6, eSp = 16
  for (let i = 0; i < Math.min(roomSpawns.length, 7); i++) {
    const ex = panX + 10 + i * eSp + eR, dead2 = g.dead.has(`${rid(curW, curC, curR)}_${i}`)
    ctx.fillStyle = dead2 ? "#1A1A1A" : "#CC2222"; ctx.beginPath(); ctx.arc(ex, eCy, eR, 0, Math.PI * 2); ctx.fill()
    if (dead2) { ctx.strokeStyle = "#FF4444"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ex - 3, eCy - 3); ctx.lineTo(ex + 3, eCy + 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex + 3, eCy - 3); ctx.lineTo(ex - 3, eCy + 3); ctx.stroke() }
  }
  if (roomSpawns.length > 7) { ctx.fillStyle = "#888"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText(`+${roomSpawns.length - 7}`, panX + 10 + 7 * eSp + eR + 2, eCy + 4) }
  if (roomSpawns.length === 0) { ctx.fillStyle = "#00FF88"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.fillText("✓ LIMPIA", panX + 10, eCy + 4) }
  const ammoY = eCy + eR + 14
  ctx.fillStyle = th.accent + "99"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText("MUNICIÓN", panX + 10, ammoY)
  const bW = 7, bH = 7, bSp = 8, bY = ammoY + 8
  for (let i = 0; i < 15; i++) {
    const bx = panX + 10 + i * bSp, has = i < p.ammo; ctx.fillStyle = has ? th.accent : "#222"
    ctx.beginPath(); ctx.arc(bx + 1, bY + 1, 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(bx + bW - 1, bY + bH - 1, 2, 0, Math.PI * 2); ctx.fill()
    if (has) { ctx.fillStyle = th.accent; ctx.fillRect(bx + 1, bY + 2, bW - 2, bH - 4); ctx.fillRect(bx + 2, bY + 1, bW - 4, bH - 2) }
  }
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(CW - 92, 8, 84, 22, 4); ctx.fill()
  ctx.fillStyle = th.accent; ctx.font = "bold 11px 'Courier New',monospace"; ctx.textAlign = "right"; ctx.fillText(`${g.score}`, CW - 12, 23); ctx.textAlign = "left"
  ctx.fillStyle = "#888"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText("PTS", CW - 86, 23)
  // ── STAMINA: BAR (legacy) o CIRCLE (junto al personaje) ──────────────────
  const stRatio = p.stamina / p.maxStamina
  if (g.staDisplay === "bar") {
    const stW = 84, stH = 10, stX = CW - 92, stY = 34
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(stX, stY, stW, stH, 3); ctx.fill()
    if (p.exhausted) {
      if (Math.floor(Date.now() / 250) % 2 === 0) { ctx.fillStyle = "#FF220044"; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, stW - 2, stH - 2, 2); ctx.fill() }
      ctx.strokeStyle = "#FF3300BB"; ctx.lineWidth = 1.5; ctx.strokeRect(stX, stY, stW, stH)
      const cdRatio = p.staminaCooldown / 5.0
      ctx.fillStyle = "#FF330055"; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, Math.max(0, (stW - 2) * cdRatio), stH - 2, 2); ctx.fill()
      ctx.fillStyle = "#FF6600DD"; ctx.font = "9px 'Courier New',monospace"; ctx.textAlign = "center"; ctx.fillText(`${Math.ceil(p.staminaCooldown)}s`, stX + stW / 2, stY + 8); ctx.textAlign = "left"
    } else {
      const stCol = stRatio > 0.55 ? "#44EE44" : stRatio > 0.25 ? "#EEcc00" : "#FF4400"
      ctx.fillStyle = stCol; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, Math.max(0, (stW - 2) * stRatio), stH - 2, 2); ctx.fill()
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, Math.max(0, (stW - 2) * stRatio), Math.round(stH / 2) - 1, 1); ctx.fill()
    }
    ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "9px 'Courier New',monospace"
    ctx.textAlign = "right"; ctx.fillText(p.exhausted ? "AGOTADO" : "STA", stX - 2, stY + 8); ctx.textAlign = "left"
  } else if (g.staCircleAlpha > 0.01) {
    // Círculo de stamina junto al personaje (screen-space)
    ctx.save()
    ctx.globalAlpha = g.staCircleAlpha
    const _sc = g.mobileZoom === "close" ? 1.6 : 1.0
    const scx = (p.x - g.cx + PW / 2) * _sc      // centro X en pantalla (ajustado al zoom)
    const scy = (p.y - g.cy - 20) * _sc           // justo encima del personaje
    const rad = 13, lw = 3.5
    // Fondo del círculo
    ctx.beginPath(); ctx.arc(scx, scy, rad, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill()
    // Arco de relleno (de arriba = -π/2, sentido horario)
    const startA = -Math.PI / 2
    if (p.exhausted) {
      // Parpadeo rojo + countdown
      const blink = Math.floor(Date.now() / 280) % 2 === 0
      ctx.strokeStyle = blink ? "#FF2200" : "#FF6600"
      ctx.lineWidth = lw
      const cdRatio = Math.max(0, p.staminaCooldown / 4.5)
      ctx.beginPath(); ctx.arc(scx, scy, rad, startA, startA + cdRatio * Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = blink ? "#FF4400DD" : "#FF6600BB"
      ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(`${Math.ceil(p.staminaCooldown)}s`, scx, scy)
      ctx.textBaseline = "alphabetic"
    } else {
      const arcCol = stRatio > 0.55 ? "#44EE44" : stRatio > 0.25 ? "#EECC00" : "#FF4400"
      ctx.strokeStyle = arcCol; ctx.lineWidth = lw; ctx.lineCap = "round"
      ctx.beginPath(); ctx.arc(scx, scy, rad, startA, startA + stRatio * Math.PI * 2)
      ctx.stroke()
    }
    // Borde exterior sutil
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(scx, scy, rad, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
    ctx.textAlign = "left"
  }
  // ── JUMP / PLAT indicators (siempre visibles) ─────────────────────────────
  {
    const _stX = CW - 92, _stY = 34, _stW = 84
    const djY = _stY + 14, sq = 8, sqGap = 5, totalSq = 2 * (sq + sqGap) - sqGap
    const djLabelX = _stX - 2, djStartX = _stX + (_stW - totalSq) / 2
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "9px 'Courier New',monospace"
    ctx.textAlign = "right"; ctx.fillText("JUMP", djLabelX, djY + 7); ctx.textAlign = "left"
    const j1 = p.onGround || (!p.jh)
    ctx.fillStyle = j1 ? th.accent : th.accent + "44"
    ctx.beginPath(); ctx.roundRect(djStartX, djY, sq, sq, 2); ctx.fill()
    ctx.fillStyle = p.djumpAvail ? "#00DDFF" : "#FFFFFF22"
    ctx.beginPath(); ctx.roundRect(djStartX + sq + sqGap, djY, sq, sq, 2); ctx.fill()
    const pfY = _stY + 14 + 12, pfLabelX = _stX - 2
    const onPlat = p.onGround && activePlats(g).some(pl =>
      pl.mode === "t" && p.x + p.w > pl.x && p.x < pl.x + pl.w && Math.abs((p.y + p.h) - pl.y) <= 8
    )
    if (onPlat) {
      ctx.fillStyle = th.accent + "BB"; ctx.font = "9px 'Courier New',monospace"; ctx.textAlign = "right"
      ctx.fillText("S+S↓ bajar", pfLabelX, pfY + 6); ctx.textAlign = "left"
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(panX, 184, panW, 20, 4); ctx.fill()
  ctx.fillStyle = th.accent + "99"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText(`★ W${g.checkpoint.w + 1} ${WORLD_NAMES[g.checkpoint.w].slice(0, 12)}`, panX + 6, 197)
  if (g.kennelMsg > 0) {
    const alpha = Math.min(1, g.kennelMsg) * Math.min(1, g.kennelMsg / 0.5)
    const isGfxMsg = !g.explored.has("__gfxmsg__") // distinguir tipo de mensaje
    // Detectar si el mensaje es de GFX o checkpoint usando un flag en el estado
    const msgText = (g as any)._gfxMsg
      ? `◈  GRÁFICOS: ${["BAJA", "MEDIA", "ALTA"][g.gfx]}  ◈`
      : "★  CHECKPOINT  GUARDADO  ★"
    const msgColor = (g as any)._gfxMsg ? th.accent : "#00FF88"
    ctx.save(); ctx.globalAlpha = alpha
    ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.beginPath(); ctx.roundRect(CW / 2 - 136, CH - 72, 272, 40, 8); ctx.fill()
    ctx.strokeStyle = th.accent + "88"; ctx.lineWidth = 1.5; ctx.strokeRect(CW / 2 - 136, CH - 72, 272, 40)
    ctx.fillStyle = msgColor; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(msgText, CW / 2, CH - 46); ctx.textAlign = "left"; ctx.restore()
  }
  if (g.devMode) {
    ctx.fillStyle = "rgba(0,80,0,0.85)"; ctx.beginPath(); ctx.roundRect(CW - 90, 46, 84, 16, 3); ctx.fill()
    ctx.strokeStyle = "#00FF44"; ctx.lineWidth = 1; ctx.strokeRect(CW - 90, 46, 84, 16)
    ctx.fillStyle = "#00FF44"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    const devFlags = (g.godMode ? "GOD " : "") + (g.infiniteAmmo ? "AMM " : "") + (g.noEnemies ? "NOENM " : "") + (g.ohko ? "OHKO" : "")
    ctx.fillText(`DEV${devFlags ? " | " + devFlags.trim() : ""}`, CW - 48, 57)
    ctx.textAlign = "left"
  }
  if (g.info) {
    ctx.fillStyle = "rgba(0,0,0,.85)"; ctx.beginPath(); ctx.roundRect(panX, 210, 200, 138, 8); ctx.fill()
    ctx.fillStyle = "#FFF"; ctx.font = "11px 'Courier New',monospace"
    const lines = [`FPS: ${g.lfps.toFixed(0)}`, `GFX: ${["BAJA", "MEDIA", "ALTA"][g.gfx]} [Q ciclar]`, `POS: ${Math.floor(p.x)},${Math.floor(p.y)}`, `SAL: W${curW}.${curC}.${curR}`, `ENEMIGOS: ${g.enemies.length}`, `MUERTOS: ${g.dead.size}`, `CP: W${g.checkpoint.w}`]
    lines.forEach((l, i) => ctx.fillText(l, panX + 8, 226 + i * 18))
  }

  // ── Barra de boss — solo visible cuando el jugador está EN la sala del boss ──
  const inBossRoom = curC === WORLD_EXITS[curW][0] && curR === WORLD_EXITS[curW][1]
  const boss = inBossRoom ? g.enemies.find(e => e.active && !e.dying && e.boss && e.world === curW) : null
  if (boss) {
    const barW = 420, barH = 14, barX = (CW - barW) / 2, barY = CH - 34
    ctx.fillStyle = "rgba(0,0,0,0.85)"
    ctx.beginPath(); ctx.roundRect(barX - 8, barY - 22, barW + 16, barH + 30, 7); ctx.fill()
    ctx.strokeStyle = th.doorC + "88"; ctx.lineWidth = 1.5; ctx.strokeRect(barX - 8, barY - 22, barW + 16, barH + 30)
    // Nombre del boss y fase
    ctx.fillStyle = th.doorC; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(`⚠ JEFE — ${WORLD_NAMES[boss.world]}`, CW / 2 - 50, barY - 8)
    if ((boss as any).phase === 2) {
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.008)
      ctx.fillStyle = `rgba(255,80,0,${pulse})`; ctx.font = "bold 9px 'Courier New',monospace"
      ctx.fillText("◈ FASE CRÍTICA ◈", CW / 2 + 80, barY - 8)
    }
    // Fondo de barra
    ctx.fillStyle = "#2A0000"; ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill()
    // Barra de HP con color dinámico
    const hpR = Math.max(0, boss.hp) / boss.mhp
    const bossCol = (boss as any).phase === 2 ? "#FF6600" : "#DD2222"
    ctx.shadowColor = bossCol; ctx.shadowBlur = 10
    ctx.fillStyle = bossCol; ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(0, barW * hpR), barH, 4); ctx.fill()
    ctx.shadowBlur = 0
    // Marca de fase al 50%
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(barX + barW * 0.5, barY - 1); ctx.lineTo(barX + barW * 0.5, barY + barH + 1); ctx.stroke()
    // Brillo superior
    ctx.fillStyle = "rgba(255,255,255,0.15)"
    ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(0, barW * hpR), Math.floor(barH / 2), 4); ctx.fill()
    ctx.textAlign = "left"
  }

  // ── Indicadores de habilidades desbloqueadas ─────────────────────────
  {
    const aY = 206, aX = panX + 8, aGap = 36
    ctx.fillStyle = th.accent + "55"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText("HABILIDADES", aX, aY)
    const icons: [string, string, boolean][] = [
      ["DASH", "⚡", g.abilities.has("dash")],
      ["W.JUMP", "↑↑", g.abilities.has("walljump")],
      ["HP+1", "❤+", g.abilities.has("hpup")],
    ]
    icons.forEach(([label, icon, unlocked], i) => {
      const ix = aX + i * aGap
      ctx.fillStyle = unlocked ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)"
      ctx.beginPath(); ctx.roundRect(ix, aY + 4, 30, 22, 3); ctx.fill()
      ctx.strokeStyle = unlocked ? th.accent : "#333"; ctx.lineWidth = 1; ctx.strokeRect(ix, aY + 4, 30, 22)
      ctx.fillStyle = unlocked ? th.accent : "#444"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText(icon, ix + 15, aY + 14)
      ctx.fillStyle = unlocked ? "#FFFFFF99" : "#33333399"; ctx.font = "9px 'Courier New',monospace"
      ctx.fillText(label, ix + 15, aY + 23); ctx.textAlign = "left"
    })
  }

  // ── Contador de combo ─────────────────────────────────────────────────
  if (g.combo >= 2 && g.comboTimer > 0) {
    const alpha = Math.min(1, g.comboTimer * 1.5) * Math.min(1, (3.0 - g.comboTimer) * 3 + 0.2)
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha)
    const cx2 = CW / 2, cy2 = 56
    ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.beginPath(); ctx.roundRect(cx2 - 90, cy2 - 18, 180, 32, 6); ctx.fill()
    const hue = Math.max(0, 55 - g.combo * 4)
    ctx.fillStyle = `hsl(${hue}, 100%, 65%)`
    ctx.font = `bold ${11 + Math.min(g.combo, 8)}px 'Courier New',monospace`; ctx.textAlign = "center"
    ctx.fillText(`× ${g.combo}  COMBO`, cx2, cy2)
    ctx.restore()
  }

  // ── Notificación de habilidad desbloqueada ────────────────────────────
  if (g.abilityNotif && g.abilityNotif.timer > 0) {
    const t = g.abilityNotif.timer
    const alpha = Math.min(1, t * 2) * Math.min(1, (4.0 - t) * 1.5)
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha)
    ctx.fillStyle = "rgba(0,0,0,0.92)"
    ctx.beginPath(); ctx.roundRect(CW / 2 - 175, CH / 2 - 48, 350, 88, 12); ctx.fill()
    ctx.strokeStyle = th.accent; ctx.lineWidth = 2; ctx.strokeRect(CW / 2 - 175, CH / 2 - 48, 350, 88)
    ctx.fillStyle = th.accent; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText("✦  NUEVA HABILIDAD DESBLOQUEADA  ✦", CW / 2, CH / 2 - 24)
    ctx.fillStyle = "#FFFFFF"; ctx.font = `bold 16px 'Courier New',monospace`
    ctx.fillText(g.abilityNotif.text, CW / 2, CH / 2 + 12)
    ctx.fillStyle = th.accent + "99"; ctx.font = "9px 'Courier New',monospace"
    ctx.fillText("Elimina al siguiente jefe para la próxima habilidad", CW / 2, CH / 2 + 32)
    ctx.textAlign = "left"; ctx.restore()
  }
}

function drawWorldTransition(ctx: CanvasRenderingContext2D, g: G) {
  if (!g.worldAnim) return
  const a = g.worldAnim, wi = Math.max(0, Math.min(g.lastWorld, NW - 1)), th = THEMES[wi]
  ctx.save()
  ctx.globalAlpha = a.alpha * 0.80; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CW, CH)
  ctx.globalAlpha = a.alpha
  ctx.strokeStyle = th.accent + "88"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(CW * 0.08, CH / 2 - 60); ctx.lineTo(CW * 0.92, CH / 2 - 60); ctx.stroke()
  ctx.fillStyle = th.accent; ctx.font = "bold 11px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText(`// SECTOR ${wi + 1} DE ${NW} //`, CW / 2, CH / 2 - 68)
  ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 58px 'Courier New',monospace"
  ctx.shadowColor = th.accent; ctx.shadowBlur = 24 * a.alpha
  ctx.fillText(a.name, CW / 2, CH / 2 + 8); ctx.shadowBlur = 0
  ctx.fillStyle = th.accent + "CC"; ctx.font = "italic 15px 'Courier New',monospace"
  ctx.fillText(a.sub, CW / 2, CH / 2 + 38)
  ctx.strokeStyle = th.accent + "88"; ctx.beginPath(); ctx.moveTo(CW * 0.08, CH / 2 + 54); ctx.lineTo(CW * 0.92, CH / 2 + 54); ctx.stroke()
  ctx.textAlign = "left"; ctx.restore()
}

// ══════════════════════════════════════════════════════════════
//  GAMEPAD
//  FIX 1: devmap → cursor celda a celda + A=teleport + LB/RB=tab
//  FIX 2: mapa normal → solo cierre, sin scroll
// ══════════════════════════════════════════════════════════════
const GP = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 }
const GP_DEAD = 0.20
const _gpPrev: Record<number, boolean> = {}
let _gpBPrev = false, _gpTapL = 0, _gpTapR = 0, _gpPrevL = false, _gpPrevR = false
// Debounce para navegación celda a celda con stick (ms restantes)
let _gpStickNavCd = 0

function pollGamepad(g: G, onMapToggle: () => void, onReset: () => void, onCheckpoint: () => void, onFullscreen: () => void) {
  const pads = navigator.getGamepads?.()
  if (!pads) return
  let pad: Gamepad | null = null
  if (g.gpadIdx >= 0 && pads[g.gpadIdx]) pad = pads[g.gpadIdx]
  else { for (let i = 0; i < pads.length; i++) { if (pads[i]) { g.gpadIdx = i; pad = pads[i]; break } } }
  if (!pad) { g.gpadIdx = -1; return }
  const btn = (i: number) => pad!.buttons[i]?.pressed ?? false
  const ax = (i: number) => pad!.axes[i] ?? 0
  const edgeDown = (i: number) => { const now = btn(i); const prev = _gpPrev[i] ?? false; _gpPrev[i] = now; return now && !prev }

  // ── FIX: Dev Map — cursor celda a celda, sin scroll ──────────────
  if (g.showDevMap) {
    // Debounce: ~16ms por frame, cooldown de 180ms
    _gpStickNavCd = Math.max(0, _gpStickNavCd - 16)
    const THRESH = 0.55
    if (_gpStickNavCd <= 0) {
      const lx = ax(0), ly = ax(1)
      let moved = false
      if (lx < -THRESH || btn(GP.LEFT)) { g.devMapCursor.c = Math.max(0, g.devMapCursor.c - 1); moved = true }
      else if (lx > THRESH || btn(GP.RIGHT)) { g.devMapCursor.c = Math.min(NC - 1, g.devMapCursor.c + 1); moved = true }
      if (!moved) {
        if (ly < -THRESH || btn(GP.UP)) { g.devMapCursor.r = Math.max(0, g.devMapCursor.r - 1); moved = true }
        else if (ly > THRESH || btn(GP.DOWN)) { g.devMapCursor.r = Math.min(NR - 1, g.devMapCursor.r + 1); moved = true }
      }
      if (moved) _gpStickNavCd = 180
    }
    // LB/RB cambia de tab de mundo
    if (edgeDown(GP.LB)) g.devMapWorld = Math.max(0, g.devMapWorld - 1)
    if (edgeDown(GP.RB)) g.devMapWorld = Math.min(NW - 1, g.devMapWorld + 1)
    // A = teletransportar a la celda del cursor
    if (edgeDown(GP.A)) {
      devTeleport(g, g.devMapWorld, g.devMapCursor.c, g.devMapCursor.r)
    }
    // B/START/BACK cierran el dev map
    if (edgeDown(GP.B) || edgeDown(GP.START) || edgeDown(GP.BACK)) {
      g.showDevMap = false; g.paused = false
    }
    _gpBPrev = btn(GP.B)
    return  // no procesar movimiento de jugador
  }

  // ── FIX: Mapa normal — solo cierre, sin scroll ───────────────────
  if (g.showMap) {
    if (edgeDown(GP.START) || edgeDown(GP.BACK) || edgeDown(GP.B)) {
      g.showMap = false; g.paused = false
    }
    _gpBPrev = btn(GP.B)
    return  // no procesar movimiento de jugador
  }

  // ── Juego normal ──────────────────────────────────────────────────
  const GP_WALK = 0.22, DOWN_CONE = Math.PI * 20 / 180
  const dLeft = btn(GP.LEFT) || (ax(0) < -GP_WALK)
  const dRight = btn(GP.RIGHT) || (ax(0) > GP_WALK)
  const dUp = btn(GP.UP) || (ax(1) < -GP_DEAD)
  const lyRaw = ax(1), lxRaw = ax(0)
  const stickMag = Math.sqrt(lxRaw * lxRaw + lyRaw * lyRaw)
  const stickAng = Math.atan2(lyRaw, lxRaw)
  const dDownStick = stickMag > 0.72 && Math.abs(stickAng - Math.PI / 2) < DOWN_CONE
  const dDownPad = btn(GP.DOWN) && !btn(GP.LEFT) && !btn(GP.RIGHT)
  const dDown = dDownStick || dDownPad
  g.keys["a"] = dLeft; g.keys["d"] = dRight; g.keys["w"] = dUp; g.keys["s"] = dDown
  g.keys["arrowleft"] = false; g.keys["arrowright"] = false; g.keys["arrowup"] = false; g.keys["arrowdown"] = false
  g.keys[" "] = btn(GP.A); g.keys["n"] = btn(GP.X) || btn(GP.RB); g.keys["m"] = btn(GP.Y) || btn(GP.LB)
  g.keys["shift"] = btn(GP.LT) || ax(2) > 0.4 || ax(4) > 0.4
  if (btn(GP.RT) || ax(5) > GP_DEAD) g.pl.runMode = true
  const gNow2 = performance.now(), TAP_W = 280
  const stL = ax(0) < -0.70, stR = ax(0) > 0.70
  if (stL && !_gpPrevL) { if (gNow2 - _gpTapL < TAP_W && _gpTapL > 0) g.pl.runMode = true; _gpTapL = gNow2 }
  if (stR && !_gpPrevR) { if (gNow2 - _gpTapR < TAP_W && _gpTapR > 0) g.pl.runMode = true; _gpTapR = gNow2 }
  _gpPrevL = stL; _gpPrevR = stR
  g.keys["z"] = Math.abs(ax(2)) > GP_DEAD || Math.abs(ax(3)) > GP_DEAD
  if (edgeDown(GP.START)) g.paused = !g.paused
  if (edgeDown(GP.BACK)) { g.showMap = !g.showMap; g.paused = g.showMap; onMapToggle() }
  const bNow = btn(GP.B)
  if (bNow && !_gpBPrev) { if (g.showMap) { g.showMap = false; g.paused = false } else { onCheckpoint() } }
  _gpBPrev = bNow
  g.keys["e"] = !g.showMap && bNow && _gpBPrev
  if (btn(GP.L3) && btn(GP.R3)) { onFullscreen() }
}

// ══════════════════════════════════════════════════════════════
//  COMPONENTE REACT
// ══════════════════════════════════════════════════════════════
export default function ProyectoLuly() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const G = useRef<G>(mkG_lazy())
  const sprs = useRef<SprBank>({})
  // FIX: showDevMap en el estado UI para controlar el overlay de pausa
  const [ui, setUi] = useState({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false, showMap: false })
  const [hasSave, setHasSave] = useState(() => loadSaveData() !== null)
  // "start" = menú inicio  |  "playing" = partida activa
  const [screen, setScreen] = useState<"start" | "playing">("start")
  const gameActiveRef = useRef(false)

  useEffect(() => {
    const L = (k: string, s: string) => { const img = new Image(); img.src = asset(s); img.onload = () => { sprs.current[k] = img }; img.onerror = () => { sprs.current[k] = null } }
    L("player_idle", "/assets/player/player_idle.png")
    L("player_walk", "/assets/player/player_walk.png")
    L("player_run", "/assets/player/player_run.png")
    L("player_jump", "/assets/player/player_jump.png")
    L("player_attack", "/assets/player/player_attack.png")
    L("player_dash_right", "/assets/player/player_dash_right.png")
    L("player_dash_left", "/assets/player/player_dash_left.png")
    L("enemy_idle", "/assets/enemy/enemy_idle.png")
    L("enemy_walkR", "/assets/enemy/enemy_walk_right.png")
    L("enemy_walkL", "/assets/enemy/enemy_walk_left.png")
    L("enemy_walk_right", "/assets/enemy/enemy_walk_right.png")
    L("enemy_walk_left", "/assets/enemy/enemy_walk_left.png")
    L("enemy_atackR", "/assets/enemy/enemy_atack_right.png")
    L("enemy_atackL", "/assets/enemy/enemy_atack_left.png")
    L("enemy_atack_right", "/assets/enemy/enemy_atack_right.png")
    L("enemy_atack_left", "/assets/enemy/enemy_atack_left.png")
    L("enemy_hurt_right", "/assets/enemy/enemy_hurt_right.png")
    L("enemy_hurt_left", "/assets/enemy/enemy_hurt_left.png")
    L("enemy_death_right", "/assets/enemy/enemy_death_right.png")
    L("enemy_death_left", "/assets/enemy/enemy_death_left.png")
    L("boos_flight_right", "/assets/boos/boos_flight_right.png")
    L("boos_flight_left", "/assets/boos/boos_flight_left.png")
    L("boos_atack_right", "/assets/boos/boos_atack_right.png")
    L("boos_atack_left", "/assets/boos/boos_atack_left.png")
    L("boos_atackR", "/assets/boos/boos_atack_right.png")
    L("boos_atackL", "/assets/boos/boos_atack_left.png")
    L("boos_hurt_right", "/assets/boos/boos_hurt_right.png")
    L("boos_hurt_left", "/assets/boos/boos_hurt_left.png")
    L("boos_defeat_right", "/assets/boos/boos_defeat_right.png")
    L("boos_defeat_left", "/assets/boos/boos_defeat_left.png")
    BG_PATHS.forEach((path, wi) => { if (!path) return; const img = new Image(); img.src = path; img.onload = () => { BG_IMGS[wi] = img }; img.onerror = () => { BG_IMGS[wi] = null } })
  }, [])

  useEffect(() => {
    const sp: Record<string, number> = { idle: 120, walk: 90, run: 70, jump: 130, attack: 80, dash_right: 55, dash_left: 55 }
    let raf: number, el = 0, last = performance.now()
    const fn = (now: number) => { el += now - last; last = now; const g = G.current, s = sp[g.pl.pa] ?? 120; if (el > s) { el = 0; g.pl.pf = (g.pl.pf + 1) % 16 }; raf = requestAnimationFrame(fn) }
    raf = requestAnimationFrame(fn); return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext("2d")!
    let raf: number, accum = 0, last = performance.now(), ut = 0
    const gpCheckpoint = () => {
      const g = G.current, p = g.pl
      for (const cp of ALL_CPS) {
        const bdx = p.x + p.w / 2 - (cp.x + PW / 2), bdy = p.y + p.h / 2 - (cp.y + PH)
        if (Math.sqrt(bdx * bdx + bdy * bdy) < CP_RADIUS) {
          g.discoveredCPs.add(cp.id)
          const changed = g.checkpoint.w !== cp.w || Math.abs(g.checkpoint.x - cp.x) > 40
          if (changed) { g.checkpoint = { w: cp.w, x: cp.x, y: cp.y }; g.kennelMsg = 3 }
          break
        }
      }
    }
    const gpFullscreen = () => handleToggleFS()
    const loop = (now: number) => {
      const g = G.current, dt = Math.min((now - last) / 1000, .05); last = now
      g.fps.push(1 / Math.max(dt, .001)); if (g.fps.length > 60) g.fps.shift()
      g.lfps = g.fps.reduce((a, b) => a + b, 0) / g.fps.length
      pollGamepad(g, () => { }, () => G.current = mkG_lazy(), gpCheckpoint, gpFullscreen)
      if (gameActiveRef.current && !g.paused && !g.over && !g.won) {
        accum += dt; let st = 0
        while (accum >= STEP && st < 4) { tick(g); accum -= STEP; st++ }
        if (accum > STEP * 2) accum = 0
      } else accum = 0
      if (gameActiveRef.current) draw(g, ctx, sprs.current, devHoverRef.current)
      ut += dt; if (ut > .25) {
        ut = 0
        // if (g.autoGfx) {
        //   if (g.lfps < 28 && g.gfx > 1) g.gfx = (g.gfx - 1) as 0 | 1 | 2  // mínimo = 1
        //   else if (g.lfps > 58 && g.gfx < 2) g.gfx = (g.gfx + 1) as 0 | 1 | 2
        // }
        // // Garantía absoluta: gfx=0 nunca debería ocurrir via autoGfx
        // if (g.gfx < 1) g.gfx = 1
        // FIX: incluir showDevMap en el estado UI para controlar el overlay de pausa
        setUi({ paused: g.paused, over: g.over, won: g.won, fps: Math.round(g.lfps), score: g.score, showDevMap: g.showDevMap, showMap: g.showMap })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const pv = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "t", "tab", "z", "f", "enter", "shift"]
    const dn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); if (pv.includes(k)) e.preventDefault()
      const g = G.current

      // ── FIX: Navegación cursor dev map con teclado ──────────────────
      if (g.showDevMap) {
        if (k === "arrowleft") { g.devMapCursor.c = Math.max(0, g.devMapCursor.c - 1); return }
        if (k === "arrowright") { g.devMapCursor.c = Math.min(NC - 1, g.devMapCursor.c + 1); return }
        if (k === "arrowup") { g.devMapCursor.r = Math.max(0, g.devMapCursor.r - 1); return }
        if (k === "arrowdown") { g.devMapCursor.r = Math.min(NR - 1, g.devMapCursor.r + 1); return }
        if (k === "enter") {
          devTeleport(g, g.devMapWorld, g.devMapCursor.c, g.devMapCursor.r)
          return
        }
      }

      G.current.keys[k] = true; if (e.repeat) return
      const TAP_WIN = 280
      if (k === "a" || k === "arrowleft") { if (performance.now() - g.pl.tapLeft < TAP_WIN && g.pl.tapLeft > 0) g.pl.runMode = true; g.pl.tapLeft = performance.now() }
      if (k === "d" || k === "arrowright") { if (performance.now() - g.pl.tapRight < TAP_WIN && g.pl.tapRight > 0) g.pl.runMode = true; g.pl.tapRight = performance.now() }
      if (k === "p") g.paused = !g.paused; if (k === "j") g.info = !g.info
      if (k === "q") {
        g.gfx = ((g.gfx + 1) % 3) as 0 | 1 | 2
          ; (g as any)._gfxMsg = true
        g.kennelMsg = 1.8
      }
      if (k === "r") G.current = mkG_lazy()
      if (k === "`") { g.devMode = !g.devMode; if (!g.devMode) { g.showDevMap = false; g.godMode = false; g.infiniteAmmo = false; g.noEnemies = false } }
      if (g.devMode && k === "i") g.godMode = !g.godMode
      if (g.devMode && k === "o") g.infiniteAmmo = !g.infiniteAmmo
      if (g.devMode && k === "k") g.noEnemies = !g.noEnemies
      if (g.devMode && k === "u") g.ohko = !g.ohko
      if (g.devMode && k === "j") g.staDisplay = g.staDisplay === "circle" ? "bar" : "circle"
      if (g.devMode && k === "p") g.mobileZoom = g.mobileZoom === "far" ? "close" : "far"
      if (g.devMode && k === "h") {
        g.showDevMap = !g.showDevMap
        g.paused = g.showDevMap
        if (g.showDevMap) {
          // Al abrir, centrar cursor en la sala actual
          const curW = Math.max(0, Math.min(Math.floor(g.pl.x / (NC * RW)), NW - 1))
          const curC = Math.max(0, Math.min(Math.floor((g.pl.x % (NC * RW)) / RW), NC - 1))
          const curR = Math.max(0, Math.min(Math.floor(g.pl.y / RH), NR - 1))
          g.devMapWorld = curW
          g.devMapCursor = { c: curC, r: curR }
        }
      }
      if (k === "tab") { g.showMap = !g.showMap; g.paused = g.showMap }
      if (k === "f") handleToggleFS()
      if (k === "escape") {
        if (g.tpMenu?.open) { g.tpMenu = null; return }
        if (g.showMap) { g.showMap = false; g.paused = false }
        if (g.showDevMap) { g.showDevMap = false; g.paused = false }
      }
      if (k === "e" && !g.tpAnim) {
        ; (g as any)._gfxMsg = false
        const p = g.pl
        for (const cp of ALL_CPS) {
          const bdx = p.x + p.w / 2 - (cp.x + PW / 2), bdy = p.y + p.h / 2 - (cp.y + PH)
          if (Math.sqrt(bdx * bdx + bdy * bdy) < CP_RADIUS) {
            g.discoveredCPs.add(cp.id)
            const changed = g.checkpoint.w !== cp.w || Math.abs(g.checkpoint.x - cp.x) > 40
            if (changed) { g.checkpoint = { w: cp.w, x: cp.x, y: cp.y }; g.kennelMsg = 3; saveGame(g) }
            break
          }
        }
      }
      if (k === "t" && !g.tpAnim) {
        if (g.tpMenu?.open) { g.tpMenu = null; return }
        if (g.discoveredCPs.size >= 2) { g.tpMenu = { open: true, idx: 0 } }
      }
      // Navegación menú de teleporte
      if (g.tpMenu?.open) {
        const discovered = ALL_CPS.filter(cp => g.discoveredCPs.has(cp.id))
        if (k === "arrowup" || k === "w") { g.tpMenu.idx = (g.tpMenu.idx - 1 + discovered.length) % discovered.length; return }
        if (k === "arrowdown" || k === "s") { g.tpMenu.idx = (g.tpMenu.idx + 1) % discovered.length; return }
        if (k === "enter" || k === " ") {
          const dest = discovered[g.tpMenu.idx]
          if (dest) {
            g.tpMenu = null
            g.tpAnim = { timer: 0, phase: 0, destX: dest.x, destY: dest.y }
            spawnExplosion(g, g.pl.x + PW / 2, g.pl.y + PH / 2, ["#FFFFFF", "#AAFFAA", "#FFFF88"], 12, 3.5)
          }
          return
        }
      }
    }
    const up = (e: KeyboardEvent) => { G.current.keys[e.key.toLowerCase()] = false }
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up)
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    // FIX: getCanvasXY escala correctamente las coordenadas al espacio
    // lógico del canvas (CW×CH), incluso en fullscreen
    const getCanvasXY = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = CW / rect.width
      const scaleY = CH / rect.height
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    }
    const onMove = (e: MouseEvent) => {
      const g = G.current
      if (!g.showDevMap) { devHoverRef.current = null; return }
      const { x, y } = getCanvasXY(e)
      // FIX: sin parámetros de scroll
      devHoverRef.current = devMapHitTest(x, y, g.devMapWorld)
    }
    const onClick = (e: MouseEvent) => {
      const g = G.current; if (!g.showDevMap) return
      const { x, y } = getCanvasXY(e)
      // FIX: sin parámetros de scroll
      const hit = devMapHitTest(x, y, g.devMapWorld)
      if (!hit) return
      if (hit.c === -1) { g.devMapWorld = hit.w; return }
      devTeleport(g, hit.w, hit.c, hit.r)
    }
    canvas.addEventListener("mousemove", onMove); canvas.addEventListener("click", onClick)
    return () => { canvas.removeEventListener("mousemove", onMove); canvas.removeEventListener("click", onClick) }
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPseudoFS, setIsPseudoFS] = useState(false)   // iOS pseudo-fullscreen via CSS
  const [isPortrait, setIsPortrait] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [gpadConnected, setGpadConnected] = useState(false)
  // Dimensiones reales de la ventana visible (sin barra del navegador iOS)
  const [winDims, setWinDims] = useState({ w: typeof window !== "undefined" ? window.innerWidth : CW, h: typeof window !== "undefined" ? window.innerHeight : CH })
  const dpadTapRef = useRef({ left: 0, right: 0 })      // para doble-tap → run
  const devHoverRef = useRef<{ w: number; c: number; r: number } | null>(null)

  // ── Helpers cross-browser para fullscreen ──────────────────────────────
  const isIOS = typeof window !== "undefined" && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
  const getFSElement = () =>
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement

  const tryFullscreen = (_el: HTMLElement) => {
    if (isIOS) {
      // iOS Safari no soporta la API Fullscreen — usamos pseudo-fullscreen CSS
      setIsPseudoFS(true)
      return
    }
    const target = document.documentElement
    if (target.requestFullscreen) target.requestFullscreen().catch(() => {})
    else if ((target as any).webkitRequestFullscreen) (target as any).webkitRequestFullscreen()
    else if ((target as any).mozRequestFullScreen) (target as any).mozRequestFullScreen()
    else if ((target as any).msRequestFullscreen) (target as any).msRequestFullscreen()
  }

  const exitFS = () => {
    if (isPseudoFS) { setIsPseudoFS(false); return }
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
    else if ((document as any).mozCancelFullScreen)  (document as any).mozCancelFullScreen()
    else if ((document as any).msExitFullscreen)     (document as any).msExitFullscreen()
  }

  const isFullscreenEffective = isFullscreen || isPseudoFS

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!getFSElement())
    document.addEventListener("fullscreenchange", onChange)
    document.addEventListener("webkitfullscreenchange", onChange)
    document.addEventListener("mozfullscreenchange", onChange)
    document.addEventListener("MSFullscreenChange", onChange)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      document.removeEventListener("webkitfullscreenchange", onChange)
      document.removeEventListener("mozfullscreenchange", onChange)
      document.removeEventListener("MSFullscreenChange", onChange)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detección de dispositivo táctil y orientación (iOS + Android + escritorio)
  useEffect(() => {
    const checkOrientation = () => {
      const iw = window.innerWidth, ih = window.innerHeight
      const portrait = ih > iw
      setIsPortrait(portrait)
      // Actualizar dimensiones reales de la ventana (excluye barra del nav en iOS)
      setWinDims({ w: iw, h: ih })
      // Auto-fullscreen al girar a landscape en dispositivos táctiles
      if (!portrait && isTouchDevice && !getFSElement() && !isPseudoFS) {
        tryFullscreen(containerRef.current || document.documentElement)
      }
    }
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouchDevice(touch)
    // Zoom móvil automático: pantallas pequeñas → vista cercana por defecto
    if (touch || window.innerWidth < 900) G.current.mobileZoom = "close"
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    // screen.orientation API (Android moderno)
    if (window.screen.orientation) window.screen.orientation.addEventListener('change', checkOrientation)
    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
      if (window.screen.orientation) window.screen.orientation.removeEventListener('change', checkOrientation)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouchDevice, isPseudoFS])

  useEffect(() => {
    const onConnect = (e: GamepadEvent) => { G.current.gpadIdx = e.gamepad.index; setGpadConnected(true) }
    const onDisconnect = (e: GamepadEvent) => { if (G.current.gpadIdx === e.gamepad.index) { G.current.gpadIdx = -1; setGpadConnected(false) } }
    window.addEventListener("gamepadconnected", onConnect); window.addEventListener("gamepaddisconnected", onDisconnect)
    const existing = navigator.getGamepads?.()
    if (existing) for (let i = 0; i < existing.length; i++) { if (existing[i]) { G.current.gpadIdx = i; setGpadConnected(true); break } }
    return () => { window.removeEventListener("gamepadconnected", onConnect); window.removeEventListener("gamepaddisconnected", onDisconnect) }
  }, [])

  const reset = () => { G.current = mkG_lazy(); setUi({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false, showMap: false }) }

  const handlePlay = () => {
    gameActiveRef.current = true
    setScreen("playing")
    if (!getFSElement() && !isPseudoFS) {
      tryFullscreen(containerRef.current || document.documentElement)
    }
  }
  const handleToggleFS = () => {
    if (getFSElement() || isPseudoFS) exitFS()
    else tryFullscreen(containerRef.current || document.documentElement)
  }
  const handleExit = () => { try { window.close() } catch (_e) { } }
  const handleRestart = () => { reset(); setScreen("start"); gameActiveRef.current = false }
  const handlePlayAgain = () => { reset(); handlePlay() }
  const handleContinueFromSave = () => {
    const save = loadSaveData()
    reset()
    if (save) {
      applyLoad(G.current, save)
      setHasSave(true)
    }
    setUi({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false, showMap: false })
    setScreen("playing")
    gameActiveRef.current = true
    if (!getFSElement() && !isPseudoFS) tryFullscreen(containerRef.current || document.documentElement)
  }

  // Componente de retrato animado de Luly — usa rAF con timestamp exacto (igual al juego: 120 ms/frame idle)
  const PausePortrait = ({ thAccent, thBg0 }: { thAccent: string; thBg0: string }) => {
    const portraitRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef(0)
    const frameRef = useRef(0)
    const lastRef = useRef(0)
    useEffect(() => {
      const FRAME_MS = 120  // igual que sp.idle en el juego
      const fn = (now: number) => {
        if (now - lastRef.current >= FRAME_MS) {
          lastRef.current = now
          frameRef.current = (frameRef.current + 1) % 16
          const canvas = portraitRef.current; if (!canvas) return
          const ctx2d = canvas.getContext("2d"); if (!ctx2d) return
          ctx2d.clearRect(0, 0, 96, 144)
          const spr = sprs.current["player_idle"]
          const f = frameRef.current
          if (spr && spr.complete && spr.naturalWidth > 0) {
            const fw = spr.width / 4, fh = spr.height / 4
            ctx2d.drawImage(spr, (f % 4) * fw, Math.floor(f / 4) * fh, fw, fh, 0, 0, 96, 144)
          } else {
            ctx2d.save(); const sc = 96 / 48; ctx2d.scale(sc, sc)
            ctx2d.fillStyle = "#D2B48C"; ctx2d.fillRect(4, 16, 22, 26); ctx2d.fillRect(6, 2, 20, 18)
            ctx2d.fillStyle = "#555"; ctx2d.fillRect(3, 0, 26, 12); ctx2d.fillRect(2, 4, 28, 10)
            ctx2d.fillStyle = "#888"; ctx2d.fillRect(8, 2, 16, 8)
            ctx2d.fillStyle = "#FFF"; ctx2d.fillRect(9, 6, 4, 3); ctx2d.fillRect(19, 6, 4, 3)
            ctx2d.fillStyle = "#111"; ctx2d.fillRect(10, 7, 2, 2); ctx2d.fillRect(20, 7, 2, 2)
            ctx2d.fillStyle = "#FFD700"; ctx2d.fillRect(13, 23, 6, 2)
            ctx2d.restore()
          }
        }
        rafRef.current = requestAnimationFrame(fn)
      }
      rafRef.current = requestAnimationFrame(fn)
      return () => cancelAnimationFrame(rafRef.current)
    }, [])
    return (
      <div style={{ width: 96, height: 144, borderRadius: 12, border: `2px solid ${thAccent}88`, background: `radial-gradient(circle at 50% 40%, ${thAccent}18, ${thBg0})`, overflow: "hidden", boxShadow: `0 0 24px ${thAccent}33` }}>
        <canvas ref={portraitRef} width={96} height={144} style={{ imageRendering: "pixelated" as const, width: "100%", height: "100%" }} />
      </div>
    )
  }

  const canvasStyle = isFullscreenEffective
    ? { display: "block", imageRendering: "pixelated" as const, width: "100%", height: "100%", objectFit: "contain" as const, border: "none", borderRadius: 0 }
    : { display: "block", imageRendering: "pixelated" as const, border: "2px solid #1A1A1A", borderRadius: 4 }

  // Estilo común de botón para la pantalla de inicio
  const menuBtn = (accent: string): CSSProperties => ({
    fontFamily: "monospace", fontWeight: "bold", fontSize: 15,
    padding: "12px 48px", border: `2px solid ${accent}`,
    color: accent, background: "rgba(0,0,0,0.55)",
    cursor: "pointer", letterSpacing: "0.12em",
    transition: "background 0.2s, box-shadow 0.2s",
    borderRadius: 3, outline: "none",
  })

  // ── Gamepad virtual táctil ───────────────────────────────────────────
  const pressKey = (key: string) => { G.current.keys[key] = true }
  const releaseKey = (key: string) => { G.current.keys[key] = false }

  const vBtnStyle = (size: number, extra: CSSProperties = {}): CSSProperties => ({
    position: "absolute",
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.07)",
    border: "1.5px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.55)",
    fontSize: Math.round(size * 0.38),
    fontFamily: "'Courier New',monospace",
    fontWeight: "bold",
    cursor: "pointer",
    userSelect: "none",
    touchAction: "none",
    transition: "background 0.08s",
    zIndex: 20,
    ...extra,
  })

  const vBtnRect = (w: number, h: number, extra: CSSProperties = {}): CSSProperties => ({
    position: "absolute",
    width: w,
    height: h,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.07)",
    border: "1.5px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.55)",
    fontSize: 9,
    fontFamily: "'Courier New',monospace",
    fontWeight: "bold",
    cursor: "pointer",
    userSelect: "none",
    touchAction: "none",
    zIndex: 20,
    ...extra,
  })

  const makeTouch = (
    downFn: () => void,
    upFn: () => void,
  ) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); downFn() },
    onPointerUp:   (e: React.PointerEvent) => { e.preventDefault(); upFn() },
    onPointerLeave: () => upFn(),
    onPointerCancel: () => upFn(),
  })

  const VirtualGamepad = () => {
    if (!isTouchDevice || screen !== "playing" || isPortrait) return null
    const g = G.current
    const accent = "#D4C400"
    const pct = (x: number, y: number): CSSProperties => ({
      left: `${x}%`, bottom: `${y}%`, transform: "translate(-50%, 50%)",
    })

    // Doble-tap en D-pad activa correr
    const dpadPress = (dir: "left" | "right", key: string) => {
      const now = Date.now()
      if (now - dpadTapRef.current[dir] < 300) G.current.pl.runMode = true
      dpadTapRef.current[dir] = now
      pressKey(key)
    }

    // Activar checkpoint táctil — replica exactamente la lógica del keydown "e"
    const activateCheckpoint = () => {
      if (g.tpAnim) return
      ;(g as any)._gfxMsg = false
      const p = g.pl
      for (const cp of ALL_CPS) {
        const bdx = p.x + p.w / 2 - (cp.x + PW / 2), bdy = p.y + p.h / 2 - (cp.y + PH)
        if (Math.sqrt(bdx * bdx + bdy * bdy) < CP_RADIUS) {
          g.discoveredCPs.add(cp.id)
          const changed = g.checkpoint.w !== cp.w || Math.abs(g.checkpoint.x - cp.x) > 40
          if (changed) { g.checkpoint = { w: cp.w, x: cp.x, y: cp.y }; g.kennelMsg = 3; saveGame(g) }
          break
        }
      }
    }

    return (
      <>
        {/* ── TOP: sistema ─────────────────────────────────────────── */}
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 20 }}>
          <div style={vBtnRect(62, 32, { borderRadius: 8, fontSize: 11 })}
            {...makeTouch(() => { g.showMap = !g.showMap; g.paused = g.showMap }, () => {})}>
            🗺 MAPA
          </div>
          <div style={vBtnRect(62, 32, { borderRadius: 8, fontSize: 11, borderColor: accent + "88" })}
            {...makeTouch(() => {
              if (g.tpMenu?.open) g.tpMenu = null
              else if (g.discoveredCPs.size >= 2) g.tpMenu = { open: true, idx: 0 }
            }, () => {})}>
            ⟳ TELE
          </div>
          <div style={vBtnRect(52, 32, { borderRadius: 8, fontSize: 14 })}
            {...makeTouch(() => { g.paused = !g.paused }, () => {})}>
            ⏸
          </div>
        </div>

        {/* ── CHECKPOINT: botón derecho, encima del DASH ──────────── */}
        <div style={{ ...vBtnStyle(60, { borderColor: "#FFD700CC", background: "rgba(255,215,0,0.11)" }), ...pct(70, 28) }}
          {...makeTouch(activateCheckpoint, () => {})}>
          <span style={{ fontSize: 9, lineHeight: 1.2, textAlign: "center" }}>
            <span style={{ fontSize: 18, display: "block" }}>★</span>CP
          </span>
        </div>

        {/* ── IZQUIERDA: D-pad (doble-tap = correr) ────────────────── */}
        {/* ← */}
        <div style={{ ...vBtnStyle(74), ...pct(7, 13) }}
          {...makeTouch(() => dpadPress("left", "arrowleft"), () => { releaseKey("arrowleft"); G.current.pl.runMode = false })}>
          ◀
        </div>
        {/* → */}
        <div style={{ ...vBtnStyle(74), ...pct(18.5, 13) }}
          {...makeTouch(() => dpadPress("right", "arrowright"), () => { releaseKey("arrowright"); G.current.pl.runMode = false })}>
          ▶
        </div>
        {/* ↓ agachar */}
        <div style={{ ...vBtnStyle(58, { borderRadius: 12 }), ...pct(12.8, 3) }}
          {...makeTouch(() => pressKey("arrowdown"), () => releaseKey("arrowdown"))}>
          ▼
        </div>
        {/* Indicador doble-tap */}
        <div style={{ ...pct(12.8, 26), position: "absolute", fontSize: 9, color: "rgba(124,252,0,0.35)", fontFamily: "'Courier New',monospace", whiteSpace: "nowrap", transform: "translate(-50%, 50%)" }}>
          2× = RUN
        </div>

        {/* ── DERECHA: Acciones ────────────────────────────────────── */}
        {/* SALTAR — grande, verde */}
        <div style={{ ...vBtnStyle(84, { background: "rgba(124,252,0,0.13)", borderColor: accent + "AA", fontSize: 28 }), ...pct(87, 14) }}
          {...makeTouch(() => pressKey(" "), () => releaseKey(" "))}>
          ▲
        </div>
        {/* LÁTIGO — icono de latigazo "〰W" */}
        <div style={{ ...vBtnStyle(66, { borderColor: "#FF8C00AA", background: "rgba(255,140,0,0.09)" }), ...pct(76, 7) }}
          {...makeTouch(() => pressKey("m"), () => releaseKey("m"))}>
          <span style={{ fontSize: 10, lineHeight: 1, textAlign: "center" }}>
            <span style={{ fontSize: 16, display: "block" }}>〰</span>WHP
          </span>
        </div>
        {/* DISPARAR HUESO — icono de hueso */}
        <div style={{ ...vBtnStyle(66, { borderColor: "#00BFFFAA", background: "rgba(0,191,255,0.09)" }), ...pct(93, 7) }}
          {...makeTouch(() => pressKey("n"), () => releaseKey("n"))}>
          <span style={{ fontSize: 10, lineHeight: 1, textAlign: "center" }}>
            <span style={{ fontSize: 16, display: "block" }}>🦴</span>TIRO
          </span>
        </div>
        {/* DASH */}
        <div style={{ ...vBtnStyle(56, { borderColor: "#FFD700AA", background: "rgba(255,215,0,0.08)", fontSize: 22 }), ...pct(84, 28) }}
          {...makeTouch(() => pressKey("shift"), () => releaseKey("shift"))}>
          ⚡
        </div>
      </>
    )
  }

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden select-none">
      <div ref={containerRef} className="relative" style={isFullscreenEffective ? { position: "fixed", top: 0, left: 0, width: winDims.w, height: winDims.h, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", zIndex: 9999 } : { boxShadow: "0 0 60px rgba(0,0,0,.95)" }}>

        {/* ── Canvas del juego ── */}
        <canvas ref={canvasRef} width={CW} height={CH} style={{ ...canvasStyle, display: screen === "playing" ? "block" : "none" }} />

        {/* ══════════════════════════════════════════════════
            PANTALLA DE INICIO
        ══════════════════════════════════════════════════ */}
        {screen === "start" && (
          <div
            style={{
              width: isFullscreenEffective ? winDims.w : CW,
              height: isFullscreenEffective ? winDims.h : CH,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
              backgroundImage: `url(${asset("/assets/menu_bg.png")}), linear-gradient(180deg,#040804 0%,#091409 55%,#020502 100%)`,
              backgroundSize: "cover", backgroundPosition: "center",
              border: isFullscreenEffective ? "none" : "2px solid #1A1A1A",
              borderRadius: isFullscreenEffective ? 0 : 4,
              fontFamily: "'Courier New',monospace",
            }}
            onClick={() => { if (!getFSElement() && !isPseudoFS) tryFullscreen(containerRef.current || document.documentElement) }}
            onTouchStart={() => { if (!getFSElement() && !isPseudoFS) tryFullscreen(containerRef.current || document.documentElement) }}
          >
            {/* Capa oscura sobre el fondo */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.58)", zIndex: 0 }} />

            {/* Línea decorativa superior */}
            <div style={{ position: "absolute", top: 38, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg,transparent,#D4C40055,#D4C400AA,#D4C40055,transparent)", zIndex: 1 }} />
            <div style={{ position: "absolute", bottom: 38, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg,transparent,#D4C40055,#D4C400AA,#D4C40055,transparent)", zIndex: 1 }} />

            {/* Contenido centrado */}
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

              {/* Etiqueta superior */}
              <p style={{ color: "#3A5A3A", fontSize: 11, letterSpacing: "0.35em", marginBottom: 12 }}>
                // COMPLEJO CANINO — SECTOR 0 //
              </p>

              {/* Título principal */}
              <h1 style={{
                fontSize: 58, fontWeight: "900", letterSpacing: "0.08em", margin: 0,
                color: "#EEFFEE",
                textShadow: "0 0 28px #D4C400CC, 0 0 60px #3A8A0066, 0 2px 0 #000",
                lineHeight: 1.05,
              }}>
                PROYECTO LULY
              </h1>

              {/* Subtítulo */}
              <p style={{ color: "#4A7A4A", fontSize: 13, letterSpacing: "0.22em", margin: "10px 0 44px", fontStyle: "italic" }}>
                liberación canina — metroidvania
              </p>

              {/* Botones */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 260, alignItems: "stretch" }}>
                {hasSave && (() => {
                  const sv = loadSaveData()!
                  const d = new Date(sv.savedAt)
                  const timeStr = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`
                  return (
                    <button
                      style={{ ...menuBtn("#D4C400"), marginBottom: 6 }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(212,196,0,0.18)"; (e.target as HTMLElement).style.boxShadow = "0 0 18px #D4C40066" }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(0,0,0,0.55)"; (e.target as HTMLElement).style.boxShadow = "none" }}
                      onClick={() => {
                        const sv2 = loadSaveData()
                        if (!sv2) { handlePlay(); return }
                        const g = G.current
                        gameActiveRef.current = true
                        applyLoad(g, sv2)
                        setScreen("playing")
                        if (!getFSElement() && !isPseudoFS) tryFullscreen(document.documentElement)
                      }}
                      onTouchEnd={e => { e.preventDefault(); const sv2 = loadSaveData(); if (!sv2) { handlePlay(); return }; const g = G.current; gameActiveRef.current = true; applyLoad(g, sv2); setScreen("playing"); if (!getFSElement() && !isPseudoFS) tryFullscreen(document.documentElement) }}
                    >
                      ★  CONTINUAR  <span style={{ fontSize: 9, opacity: 0.6 }}>· {timeStr}</span>
                    </button>
                  )
                })()}
                <button
                  style={menuBtn("#D4C400")}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(124,252,0,0.15)"; (e.target as HTMLElement).style.boxShadow = "0 0 18px #D4C40066" }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(0,0,0,0.55)"; (e.target as HTMLElement).style.boxShadow = "none" }}
                  onClick={handlePlay}
                  onTouchEnd={e => { e.preventDefault(); handlePlay() }}
                >
                  ▶  JUGAR
                </button>
                {!isTouchDevice && !isFullscreenEffective && (
                  <button
                    style={menuBtn("#556655")}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(85,102,85,0.18)"; (e.target as HTMLElement).style.color = "#88AA88" }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(0,0,0,0.55)"; (e.target as HTMLElement).style.color = "#556655" }}
                    onClick={() => tryFullscreen(document.documentElement)}
                  >
                    ⛶  PANTALLA COMPLETA
                  </button>
                )}
                <button
                  style={menuBtn("#556655")}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(85,102,85,0.18)"; (e.target as HTMLElement).style.color = "#88AA88" }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(0,0,0,0.55)"; (e.target as HTMLElement).style.color = "#556655" }}
                  onClick={handleExit}
                >
                  ✕  SALIR
                </button>
              </div>

              {/* Controles resumidos */}
              <div style={{ marginTop: 38, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 28px", fontSize: 10, color: "#3A5A3A", textAlign: "center" }}>
                <span><span style={{ color: "#D4C40088" }}>WASD</span> mover</span>
                <span><span style={{ color: "#D4C40088" }}>ESPACIO</span> saltar</span>
                <span><span style={{ color: "#D4C40088" }}>N</span> disparar</span>
                <span><span style={{ color: "#D4C40088" }}>M</span> látigo</span>
                <span><span style={{ color: "#D4C40088" }}>SHIFT</span> dash*</span>
                <span><span style={{ color: "#D4C40088" }}>TAB</span> mapa</span>
              </div>
              <p style={{ marginTop: 8, fontSize: 9, color: "#2A3A2A" }}>* se desbloquea derrotando al primer jefe</p>
            </div>

            {/* Versión */}
            <p style={{ position: "absolute", bottom: 14, right: 18, fontSize: 9, color: "#1E2E1E", zIndex: 2, fontFamily: "monospace" }}>
              v2.0 — 4 mundos × 9×9 salas
            </p>
          </div>
        )}

        {/* ── Overlay: girar dispositivo ── */}
        {isTouchDevice && isPortrait && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#000",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 20,
          }}>
            <div style={{ fontSize: 72, animation: "spin 2s linear infinite" }}>↻</div>
            <p style={{ color: "#D4C400", fontFamily: "'Courier New',monospace", fontSize: 18, fontWeight: "bold", letterSpacing: "0.15em" }}>
              GIRA TU DISPOSITIVO
            </p>
            <p style={{ color: "#3A5A3A", fontFamily: "'Courier New',monospace", fontSize: 12 }}>
              El juego requiere modo horizontal
            </p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── FPS y gamepad (solo en juego) ── */}
        {screen === "playing" && (
          <div className="absolute top-1 left-2 text-xs font-mono opacity-40 flex items-center gap-2" style={{ color: "#888" }}>
            <span>{ui.fps}fps</span>
            {gpadConnected && <span style={{ color: "#D4C400", opacity: 0.9 }} title="Control Xbox detectado">🎮</span>}
          </div>
        )}

        {/* ── Gamepad táctil ── */}
        <VirtualGamepad />

        {/* ── Pausa ── (solo cuando no está el mapa ni el devmap abiertos) */}
        {screen === "playing" && ui.paused && !ui.over && !ui.won && !ui.showDevMap && !ui.showMap && (() => {
          const g = G.current; const p = g.pl
          const curW = getWorldAtX(g.cx); const th = THEMES[curW]
          const MAX_POSSIBLE_HP = 4  // 3 base + 1 por hpup (boss W2)
          const abilities = [
            { key: "dash", icon: "⚡", name: "DASH", desc: "Esquiva instantánea" },
            { key: "walljump", icon: "↑↑", name: "WALL JUMP", desc: "Salta en las paredes" },
            { key: "hpup", icon: "❤+", name: "HP MÁXIMO", desc: "+2 corazones extra" },
          ]
          return (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
              {/* Fondo con gradiente y overlay */}
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, #08060E 0%, ${th.bg0} 100%)`, opacity: 0.88 }} />
              {/* Panel principal */}
              <div style={{
                position: "relative", width: "min(740px, 96vw)", maxHeight: "92%", overflowY: "auto",
                border: `1px solid ${th.accent}44`, borderRadius: 12,
                boxShadow: `0 0 60px ${th.accent}22`,
                fontFamily: "'Courier New', monospace",
                background: "rgba(0,0,0,0.72)",
              }}>
                {/* ── Header ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${th.accent}33` }}>
                  <span style={{ fontSize: 10, color: th.accent + "88", letterSpacing: "0.15em" }}>// PROYECTO LULY</span>
                  <span style={{ fontSize: 13, color: th.accent, letterSpacing: "0.35em", fontWeight: "bold" }}>— PAUSA —</span>
                  <span style={{ fontSize: 10, color: th.accent + "88", letterSpacing: "0.1em" }}>{WORLD_NAMES[curW]}</span>
                </div>

                {/* ── 3 columnas ── */}
                <div style={{ display: "flex", minHeight: 220 }}>
                  {/* LEFT: ESTADO */}
                  <div style={{ flex: 1, padding: 16, borderRight: `1px solid ${th.accent}22` }}>
                    <div style={{ fontSize: 9, color: th.accent + "8C", letterSpacing: "0.3em", marginBottom: 12 }}>ESTADO</div>

                    {/* HP: llenos | vacíos | bloqueados */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.2em", marginBottom: 4 }}>HP  <span style={{ color: "#444" }}>{p.hp}/{p.maxHp}</span></div>
                      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        {Array.from({ length: MAX_POSSIBLE_HP }, (_, i) => {
                          if (i < p.hp) return <span key={i} style={{ fontSize: 16 }}>❤️</span>                 // lleno
                          if (i < p.maxHp) return <span key={i} style={{ fontSize: 16, opacity: 0.25 }}>❤️</span>  // vacío
                          return <span key={i} style={{ fontSize: 14, opacity: 0.3, filter: "grayscale(1)" }} title="Se desbloquea al derrotar al jefe W2">🔒</span>  // bloqueado
                        })}
                      </div>
                    </div>

                    {/* STAMINA */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.2em", marginBottom: 4 }}>STAMINA</div>
                      <div style={{ height: 5, background: "#222", borderRadius: 3, overflow: "hidden", width: "100%" }}>
                        <div style={{ height: "100%", width: `${Math.round((p.stamina / p.maxStamina) * 100)}%`, background: th.accent, borderRadius: 3, transition: "width 0.2s" }} />
                      </div>
                    </div>

                    {/* VIDAS */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.2em", marginBottom: 4 }}>VIDAS</div>
                      <div style={{ fontSize: 14 }}>
                        {Array.from({ length: Math.max(0, g.lives) }, (_, i) => <span key={i}>⭐</span>)}
                        {g.lives <= 0 && <span style={{ color: "#444", fontSize: 11 }}>—</span>}
                      </div>
                    </div>

                    {/* PUNTOS */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.2em", marginBottom: 4 }}>PUNTOS</div>
                      <div style={{ fontSize: 15, color: "#FFD700", fontWeight: "bold", letterSpacing: "0.1em" }}>{g.score.toString().padStart(6, "0")}</div>
                    </div>

                    {/* MUNICIÓN */}
                    <div>
                      <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.2em", marginBottom: 4 }}>MUNICIÓN</div>
                      <div style={{ fontSize: 14, color: "#00BFFF", fontWeight: "bold" }}>{p.ammo}</div>
                    </div>
                  </div>

                  {/* CENTER: PERSONAJE */}
                  <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRight: `1px solid ${th.accent}22` }}>
                    {/* Retrato — sprite idle animado del personaje */}
                    <PausePortrait thAccent={th.accent} thBg0={th.bg0} />
                    <div style={{ fontSize: 16, color: "#EEE", letterSpacing: "0.4em", fontWeight: "bold", marginTop: 4 }}>L U L Y</div>
                    <div style={{ fontSize: 10, color: th.accent, letterSpacing: "0.25em" }}>AGENTE CANINO</div>
                    <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.15em" }}>W{curW + 1} — {WORLD_NAMES[curW]}</div>

                    {/* Dots de mundos */}
                    <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                      {THEMES.map((t, i) => (
                        <div key={i} style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: g.cw.has(i) ? t.accent : "#333",
                          outline: i === curW ? "2px solid #FFF" : "none",
                          outlineOffset: 2,
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.15em" }}>MUNDOS: {g.cw.size}/4</div>
                  </div>

                  {/* RIGHT: HABILIDADES */}
                  <div style={{ flex: 1, padding: 16 }}>
                    <div style={{ fontSize: 9, color: th.accent + "8C", letterSpacing: "0.3em", marginBottom: 12 }}>HABILIDADES</div>

                    {abilities.map(ab => {
                      const unlocked = g.abilities.has(ab.key)
                      return (
                        <div key={ab.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, opacity: unlocked ? 1 : 0.35 }}>
                          <span style={{ fontSize: 18, minWidth: 22, textAlign: "center" }}>{ab.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: unlocked ? th.accent : "#666", letterSpacing: "0.15em" }}>{ab.name}</div>
                            <div style={{ fontSize: 8, color: "#555", marginTop: 1 }}>{ab.desc}</div>
                          </div>
                          <span style={{ fontSize: 13, color: unlocked ? th.accent : "#444" }}>{unlocked ? "✓" : "✗"}</span>
                        </div>
                      )
                    })}

                    {/* PODERES BASE */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${th.accent}22` }}>
                      <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.2em", marginBottom: 8 }}>PODERES BASE</div>
                      <div style={{ display: "flex", gap: 6, fontSize: 9, color: "#555" }}>
                        <span>🦴 TIRO</span>
                        <span style={{ color: "#333" }}>|</span>
                        <span>〰 LÁTIGO</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Barra inferior info ── */}
                <div style={{ display: "flex", gap: 20, padding: "8px 18px", borderTop: `1px solid ${th.accent}22`, borderBottom: `1px solid ${th.accent}22`, fontSize: 9, color: "#555", letterSpacing: "0.15em" }}>
                  <span>★ W{g.checkpoint.w + 1} {WORLD_NAMES[g.checkpoint.w].slice(0, 12)}</span>
                  <span>☠ ABATIDOS: {g.kills}</span>
                  <span>🗺 SALAS: {g.explored.size}</span>
                </div>

                {/* ── Botones ── */}
                <div style={{ display: "flex", gap: 12, padding: "14px 18px", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => { G.current.paused = false; setUi(u => ({ ...u, paused: false })) }}
                    style={{ padding: "8px 20px", background: th.accent + "22", border: `1px solid ${th.accent}88`, color: th.accent, fontFamily: "'Courier New', monospace", fontSize: 12, letterSpacing: "0.2em", cursor: "pointer", borderRadius: 6 }}
                  >▶ CONTINUAR</button>
                  <button
                    onClick={handleRestart}
                    style={{ padding: "8px 20px", background: "transparent", border: "1px solid #444", color: "#888", fontFamily: "'Courier New', monospace", fontSize: 12, letterSpacing: "0.2em", cursor: "pointer", borderRadius: 6 }}
                  >↩ MENÚ PRINCIPAL</button>
                  <button
                    onClick={() => { try { localStorage.removeItem(SAVE_KEY) } catch(_){} setHasSave(false) }}
                    style={{ padding: "8px 16px", background: "transparent", border: "1px solid #330000", color: "#553333", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.15em", cursor: "pointer", borderRadius: 6 }}
                  >
                    ✕ borrar guardado
                  </button>
                  {isTouchDevice && (
                    <span style={{ fontSize: 9, color: "#444", letterSpacing: "0.15em" }}>[ P ] continuar</span>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Game Over ── */}
        {screen === "playing" && ui.over && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(2px)" }}>
            <div className="text-center p-8 rounded-xl" style={{ background: "#0D0000", border: "1px solid #4A0000", boxShadow: "0 0 60px #FF000033, 0 0 120px #80000022", maxWidth: 340 }}>
              <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>☠</div>
              <h2 style={{ fontFamily: "monospace", fontSize: 26, fontWeight: "bold", color: "#FF3333", letterSpacing: "0.15em", marginBottom: 6 }}>GAME OVER</h2>
              <p style={{ fontFamily: "monospace", fontSize: 12, color: "#AA7700", marginBottom: 4 }}>Luly ha caído… pero no está sola.</p>
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "#664400", marginBottom: 20 }}>puntuación: {ui.score}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {hasSave && (
                  <button onClick={handleContinueFromSave}
                    style={{ padding: "10px 20px", border: "1px solid #AA5500", color: "#FFAA44", background: "#1A0800", fontFamily: "monospace", fontSize: 13, letterSpacing: "0.1em", borderRadius: 6, cursor: "pointer" }}>
                    ★ CONTINUAR desde guardado
                  </button>
                )}
                <button onClick={handlePlayAgain}
                  style={{ padding: "8px 20px", border: "1px solid #550000", color: "#FF4444", background: "#0D0000", fontFamily: "monospace", fontSize: 12, letterSpacing: "0.1em", borderRadius: 6, cursor: "pointer" }}>
                  [ REINTENTAR desde el inicio ]
                </button>
                <button onClick={handleRestart}
                  style={{ padding: "8px 20px", border: "1px solid #333", color: "#666", background: "transparent", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", borderRadius: 6, cursor: "pointer" }}>
                  [ MENÚ PRINCIPAL ]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Victoria ── */}
        {screen === "playing" && ui.won && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
            <div className="text-center p-8 border border-yellow-700 rounded-xl" style={{ background: "#0D0A00" }}>
              <div className="text-4xl mb-3">⭐</div>
              <h2 className="text-2xl font-bold text-yellow-400 mb-1" style={{ fontFamily: "monospace" }}>LIBERTAD_CANINA</h2>
              <p className="text-gray-400 font-mono text-sm mb-3">La resistencia perrina ha triunfado.</p>
              <p className="text-yellow-500 font-mono font-bold mb-5">score_final: {ui.score}</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={handlePlayAgain} className="px-5 py-2 border border-yellow-700 text-yellow-400 font-mono hover:bg-yellow-900 transition-colors">[ JUGAR DE NUEVO ]</button>
                <button onClick={handleRestart} className="px-5 py-2 border border-gray-700 text-gray-400 font-mono hover:bg-gray-800 transition-colors">[ MENÚ ]</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Controles detallados (solo fuera de fullscreen y en juego) ── */}
      {!isFullscreenEffective && screen === "playing" && (
        <>
          <div className="mt-3 grid grid-cols-5 gap-4 text-xs font-mono max-w-3xl w-full px-4" style={{ color: "#666" }}>
            <div><span className="text-gray-300 block mb-1">// mover</span>WASD | Flechas<br /><span style={{ color: "#D4C400" }}>2×</span> izq/der: correr</div>
            <div><span className="text-gray-300 block mb-1">// combate</span>Espacio: saltar | N: disparar<br />M: látigo | <span style={{ color: "#D4C400" }}>SHIFT</span>: dash*</div>
            <div><span className="text-gray-300 block mb-1">// checkpoint</span><span style={{ color: "#D4C400" }}>E</span>: guardar perrera<br />★ reapareces ahí</div>
            <div><span className="text-gray-300 block mb-1">// sistema</span>P: pausa | Tab: mapa<br /><span style={{ color: "#D4C400" }}>Z</span>: zoom | <span style={{ color: "#D4C400" }}>F</span>: fullscreen</div>
            <div><span className="text-gray-300 block mb-1">// plataformas</span><span style={{ color: "#D4C400" }}>S</span> agachado+S: bajar<br />Espacio+S: caer</div>
          </div>
          <div className="mt-1 text-xs font-mono" style={{ color: "#2A2A2A" }}>
            * dash se desbloquea al matar el primer jefe
          </div>
      </>)}
    </div>
  )
}