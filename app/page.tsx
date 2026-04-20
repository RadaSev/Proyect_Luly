"use client"
import { useEffect, useRef, useState } from "react"

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
}

type Enemy = {
  id: string; x: number; originalId: string; y: number; w: number; h: number; vx: number; vy: number; hp: number; mhp: number; dir: number; p0: number; p1: number; spd: number; cd: number; ls: number; sa: number; active: boolean; boss: boolean; ef: number; eft: number; world: number; state: "patrol" | "guard" | "chase"; alert: boolean; alertT: number; guardX: number; idleT: number; jumpCd: number;
  dying: boolean; deathTimer: number; deathDir: number
  hurtTimer: number
  isMoving: boolean
  alertDelay: number
}
type Proj = { x: number; y: number; vx: number; vy: number; active: boolean; pl: boolean; star: boolean; rot: number; life: number; dist: number; ox: number; oy: number }
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
  pl: Player; enemies: Enemy[]; projs: Proj[]; bones: Bone[]; whip: Whip | null; drops: Drop[]; crates: Crate[]; cx: number; cy: number; keys: Record<string, boolean>; lives: number; score: number; dead: Set<string>; cw: Set<number>; paused: boolean; over: boolean; won: boolean; info: boolean; gfx: 0 | 1 | 2; autoGfx: boolean; fps: number[]; lfps: number; dropThru: boolean; showMap: boolean; explored: Set<string>; checkpoint: { w: number; x: number; y: number }; lastWorld: number; worldAnim: WorldAnim | null; kennelMsg: number; minimapLarge: boolean; sparks: Spark[]; gpadIdx: number; devMode: boolean; godMode: boolean; infiniteAmmo: boolean;
  noEnemies: boolean;
  showDevMap: boolean; devMapWorld: number;
  // FIX: cursor celda a celda en dev map (reemplaza mapScrollX/Y)
  devMapCursor: { c: number; r: number };
  loadedWorlds: Set<number>
  worldSnapshots: Map<number, WorldSnapshot>
  ohko: boolean;
}

// ══════════════════════════════════════════════════════════════
//  PALETA
// ══════════════════════════════════════════════════════════════
type Theme = { bg0: string; bg1: string; wall: string; wallHi: string; platC: string; platHi: string; accent: string; doorC: string; fog: string; rock: string; rockHi: string; rockShadow: string }
const THEMES: Theme[] = [
  { bg0: "#0A0D0A", bg1: "#050805", wall: "#2C3A2C", wallHi: "#3D5C3D", platC: "#4A6B3A", platHi: "#5A8040", accent: "#7CFC00", doorC: "#FF4500", fog: "#1A2A1A", rock: "#1E2A1E", rockHi: "#2A3D2A", rockShadow: "#0A100A" },
  { bg0: "#0F0804", bg1: "#070400", wall: "#4A2810", wallHi: "#6B3B18", platC: "#8B4513", platHi: "#A0522D", accent: "#FF8C00", doorC: "#FF2200", fog: "#2A1A08", rock: "#2A1808", rockHi: "#3D2410", rockShadow: "#100800" },
  { bg0: "#04080F", bg1: "#020407", wall: "#1A2B3D", wallHi: "#243B55", platC: "#2E5073", platHi: "#3B6B8A", accent: "#00BFFF", doorC: "#FF6347", fog: "#0A1020", rock: "#0E1828", rockHi: "#18263A", rockShadow: "#04080F" },
  { bg0: "#07000B", bg1: "#030005", wall: "#2A0A3D", wallHi: "#3D1055", platC: "#4B0082", platHi: "#6A0DAD", accent: "#CC00FF", doorC: "#FF0080", fog: "#18002A", rock: "#180824", rockHi: "#280A38", rockShadow: "#070010" },
]
const WORLD_NAMES = ["LAS PERRERAS", "FÁBRICA CANINA", "LOS TUBOS", "CTRL. CENTRAL"]
const WORLD_SUBS = ["Libertad o destino", "Engranajes de opresión", "Las venas del sistema", "El corazón del control"]

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
    RH - WT - DH - 8,
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
  }
  const floorY = y0 + RH - WT
  if (!d.D) {
    result.push(solid(x0, floorY, RW, WT))
  } else {
    const gx = x0 + udDoorX_rel(w, c, r)
    if (gx - x0 > 0) result.push(solid(x0, floorY, gx - x0, WT))
    if (x0 + RW - (gx + DW) > 0) result.push(solid(gx + DW, floorY, x0 + RW - (gx + DW), WT))
  }
  if (!d.L) {
    result.push(solid(x0, y0 + WT, WT, RH - 2 * WT))
  } else {
    const dy = lrDoorY_rel(w, c - 1, r)
    const topH = dy - WT
    const botH = RH - WT - dy - DH
    if (topH > 0) result.push(solid(x0, y0 + WT, WT, topH))
    if (botH > 0) result.push(solid(x0, y0 + dy + DH, WT, botH))
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
    // Dentro de buildShaft(), al final:
    // FIX: siempre agregar plataforma de aterrizaje si el shaft no llega al suelo de sala
    const bottomOfRoom = iT + iH  // = iB
    const shaftReachesFloor = shBot >= bottomOfRoom - WT - 8
    if (!shaftReachesFloor) {
      const footW = Math.max(PW * 2 + 20, Math.floor(rw * 0.6))
      const footX = sx + Math.floor((rw - footW) / 2)
      // Plataforma justo debajo del shaft
      const footY = Math.min(iB - STAIR_H - 4, shBot + 24)
      addStair(footX, footY, footW)
      addSp(sx, shBot, rw, footY + STAIR_H - shBot + 4)
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

function getWorldCrateDefs(w: number) {
  if (_WORLD_CRATE_DEFS[w]) return _WORLD_CRATE_DEFS[w]!
  const xSlots = [0.12, 0.28, 0.50, 0.68, 0.84]
  const cr: Array<{ id: number; x: number; y: number; w: number; h: number }> = []

  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const isKennel = KENNEL_ROOMS.some(k => k.w === w && k.c === c && k.r === r)
    const isBoss = WORLD_EXITS[w][0] === c && WORLD_EXITS[w][1] === r
    if (isKennel) continue
    const hash = (w * 37 + c * 13 + r * 7) % 10
    if (hash < 2 && !isBoss) continue
    const count = isBoss ? 2 : (hash >= 7 ? 2 : 1)
    for (let i = 0; i < count; i++) {
      const slotIdx = (hash + i * 3) % xSlots.length
      const rx = xSlots[slotIdx]
      const { x: x0, y: y0 } = ro(w, c, r)
      const floorY = y0 + RH - WT
      const platOffs = [0, 110, 240, 370]
      const rYf = platOffs[(hash + i * 2) % platOffs.length]
      const crateY = floorY - rYf - 44
      cr.push({ id: _crateIdCounter++, x: x0 + WT + Math.round((RW - 2 * WT - 44) * rx), y: crateY, w: 44, h: 44 })
    }
  }
  // Kennels del mundo
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
  return { x: x0 + 80, y: y0 + RH - WT - PH, w: PW, h: PH, vx: 0, vy: 0, onGround: false, facing: 1, hp: 3, maxHp: 3, inv: 0, ammo: 15, ls: 0, as2: 0, sh: false, jh: false, djump: false, djumpAvail: false, wh: false, wcd: 0, pf: 0, pft: 0, pa: "idle", crouching: false, stamina: 100, maxStamina: 100, staminaCooldown: 0, exhausted: false, runMode: false, tapLeft: 0, tapRight: 0, tapDown: 0, dropThruPlatform: false }
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
        hurtTimer: 0, isMoving: false, alertDelay: 0
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
  "/assets/background/world_1.png",
  "/assets/background/world_2.png",
  "/assets/background/world_3.png",
  "/assets/background/world_4.png",
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
    cx: 0, cy: 0, keys: {}, lives: 3, score: 0,
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
  } as G
}

// ══════════════════════════════════════════════════════════════
//  FÍSICA
// ══════════════════════════════════════════════════════════════
let _apCache2: WPlat[] | null = null
let _apLoadedKey = ""  // string de mundos cargados para invalidar cache

function activePlats(g: G): WPlat[] {
  const key = [...g.loadedWorlds].sort().join(",") + "|" + g.cw.size
  if (_apCache2 && _apLoadedKey === key) return _apCache2

  const allPlats: WPlat[] = []
  for (const w of g.loadedWorlds) allPlats.push(...getWorldPlats(w))

  _apCache2 = allPlats.filter(p => p.mode !== "d" || (p.sw !== undefined && !g.cw.has(p.sw)))
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
  if (g.pl.hp <= 0) {
    g.lives--; if (g.lives <= 0) { g.over = true; return }
    g.pl.hp = g.pl.maxHp
    const kp = KENNEL_WORLD_POS[g.checkpoint.w]
    g.pl.x = kp.x; g.pl.y = kp.y; g.pl.vx = 0; g.pl.vy = 0; g.pl.crouching = false; g.pl.h = PH
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

  const originalWorld = parseInt(e.originalId.split("_")[0]) || e.world
  g.pl.ammo = Math.min(15, g.pl.ammo + 1)
  g.score += (e.boss ? 2000 : 100) * (originalWorld + 1)
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
  if (allDead) { g.cw.add(w); if (g.cw.size >= NW) setTimeout(() => { g.won = true }, 1200) }
}

function breakCrate(g: G, c: Crate) {
  c.active = false; g.dead.add(`crate_${c.id}`)
  const p = g.pl, cx2 = c.x + c.w / 2, cy2 = c.y
  const scatter = () => {
    for (let i = 0; i < 8; i++) {
      const a = (Math.random() - .5) * Math.PI * 1.4, spd = 3 + Math.random() * 2
      g.bones.push({ x: cx2 + (Math.random() - .5) * 20, y: cy2, w: 11, h: 11, vx: Math.cos(a) * spd, vy: -Math.abs(Math.sin(a) * spd) - 1, active: true, life: 12 })
    }
  }
  const drop = (k: "h" | "a", n = 1) => {
    for (let i = 0; i < n; i++) g.drops.push({ x: cx2 + (Math.random() - .5) * 24, y: cy2 - 4, vx: (Math.random() - .5) * 2, vy: -3.5 - Math.random() * 1.2, active: true, life: 20, kind: k })
  }
  if (p.ammo <= 2) { scatter(); p.ammo = Math.min(15, p.ammo + 10) }
  else if (p.hp < p.maxHp) { const missing = p.maxHp - p.hp; drop("h", missing >= 2 ? 2 : 1) }
  else { drop("a", 1) }
}

// ══════════════════════════════════════════════════════════════
//  TICKS
// ══════════════════════════════════════════════════════════════
function tickPlayer(g: G) {
  const k = g.keys, p = g.pl, now = performance.now()
  const STA_RED = 15, STA_DRAIN = 28, STA_RCH_WALK = 12, STA_RCH_IDLE = 22
  const moving = (k["a"] || k["arrowleft"] || k["d"] || k["arrowright"]) && !p.crouching
  const canRun = !p.exhausted && p.stamina > STA_RED
  if (!moving || !canRun) p.runMode = false
  const wantsRun = p.runMode, actuallyRunning = wantsRun && canRun && moving
  if (p.exhausted) {
    p.staminaCooldown = Math.max(0, p.staminaCooldown - STEP)
    if (p.staminaCooldown <= 0) { p.exhausted = false; p.stamina = STA_RED }
  } else if (actuallyRunning) {
    p.stamina = Math.max(0, p.stamina - STA_DRAIN * STEP)
    if (p.stamina <= STA_RED) { p.stamina = 0; p.exhausted = true; p.staminaCooldown = 5.0 }
  } else {
    p.stamina = Math.min(p.maxStamina, p.stamina + (moving ? STA_RCH_WALK : STA_RCH_IDLE) * STEP)
  }
  const exhaustedMult = p.exhausted ? 0.65 : 1
  const run = actuallyRunning, spd = run ? RUN : Math.round(WALK * exhaustedMult)
  const left = k["a"] || k["arrowleft"], right = k["d"] || k["arrowright"]
  const downKey = k["s"] || k["arrowdown"], jk = k[" "] || k["arrowup"]
  const wantCrouch = downKey && p.onGround && !jk
  if (wantCrouch && !p.crouching) { p.y += (PH - PH_CROUCH); p.h = PH_CROUCH; p.crouching = true; p.pa = "jump"; p.vx = 0 }
  else if (!wantCrouch && p.crouching) {
    const headRoom = p.y - (PH - PH_CROUCH)
    if (!activePlats(g).some(pl => pl.mode === "s" && pl.y + pl.h <= p.y + 2 && pl.y + pl.h > headRoom && pl.x < p.x + p.w && pl.x + pl.w > p.x)) { p.y -= (PH - PH_CROUCH); p.h = PH; p.crouching = false }
  }
  if (p.crouching) { p.vx = 0 }
  else if (left && !right) { p.vx = -spd; p.facing = -1; p.pa = run ? "run" : "walk" }
  else if (right && !left) { p.vx = spd; p.facing = 1; p.pa = run ? "run" : "walk" }
  else { p.vx = 0; if (p.onGround) p.pa = "idle" }

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
  const res = resolve(hx, hy, hw, hh, p.vx, p.vy, g)
  p.x = res.x - PL_HBX; p.y = res.y - PL_HBT; p.vx = res.vx; p.vy = res.vy; p.onGround = res.og

  if (p.onGround && !standingOnOneWay_plat) p.dropThruPlatform = false

  if (k["n"] && p.ammo > 0 && !p.crouching) {
    const mkP = () => { const d = getDir(g); const px = p.x + (p.facing === 1 ? p.w : 0), py = p.y + p.h / 2; g.projs.push({ x: px, y: py, vx: d.x * PSPD, vy: d.y * PSPD - 1, active: true, pl: true, star: false, rot: Math.atan2(d.y, d.x) * 180 / Math.PI, life: 3.5, dist: 0, ox: px, oy: py }); p.ammo-- }
    if (!p.sh) { mkP(); p.ls = now; p.as2 = now; p.sh = true; p.pa = "attack" }
    else if (now - p.as2 > 2500) { mkP(); p.as2 = now; p.pa = "attack" }
  } else p.sh = false
  p.wcd = Math.max(0, p.wcd - STEP * 1000)
  if (k["m"] && !p.wh && p.wcd <= 0 && !g.whip && !p.exhausted) {
    const d = getDir(g); const cx = p.x + p.w / 2, cy = p.y + p.h / 2
    g.whip = { x: cx, y: cy, ex: cx + d.x * WLEN, ey: cy + d.y * WLEN, life: 0.2, dealt: false }
    p.stamina = Math.max(0, p.stamina - 18)
    if (p.stamina < STA_RED) { p.exhausted = true; p.staminaCooldown = 5.0 }
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
      e.alertDelay = 0.5  // 1 segundo antes de poder atacar
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
      if (dist > 36) {
        const rawVx = (dx > 0 ? 1 : -1) * e.spd * 1.4
        const nextX = e.x + rawVx
        if (nextX >= hb.x0 && nextX <= hb.x1) targetVx = rawVx
        else targetVx = 0
      }
      e.dir = dx > 0 ? 1 : -1

      // Evasión de obstáculos en chase
      if (eOnGround2 && e.jumpCd <= 0 && Math.abs(targetVx) > 0) {
        const probeX = e.dir > 0 ? (e.x + e.w + 8) : (e.x - 8)
        const probeYTop = e.y + 4
        const probeYBot = e.y + e.h - 4
        const wallAhead = activePlats(g).some(pl =>
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
          if (jumpNeeded < JUMP_H * 0.75 && jumpNeeded > 4) {
            e.vy = JV * 0.88; e.jumpCd = 1000
          }
        }
      }

      // Salto para alcanzar jugador en plataforma superior
      if (eOnGround2 && e.jumpCd <= 0 && Math.abs(dy) > 55 && Math.abs(dx) < 180) {
        const destY = e.y + dy
        const destInRoom = destY > hr.r * RH + WT && destY < hr.r * RH + RH - WT
        if (destInRoom && plFloor !== null && plFloor < e.y) {
          e.vy = JV * 0.88; e.jumpCd = 1200
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

    // ── Disparo ──────────────────────────────────────────────────────
    const canShoot = e.boss
      ? (dist < sight)
      : (plSameRoom && canSee && e.state === "chase" && e.alertDelay <= 0)
    if (now - e.ls > e.cd && canShoot) {
      const len = dist || 1, sp = e.boss ? 3.2 : 2.4
      const ex2 = e.x + e.w / 2, ey2 = e.y + e.h / 2
      g.projs.push({ x: ex2, y: ey2, vx: (dx / len) * sp, vy: (dy / len) * sp, active: true, pl: false, star: false, rot: Math.atan2(dy, dx) * 180 / Math.PI, life: 3.5, dist: 0, ox: ex2, oy: ey2 })
      if (e.boss) {
        for (let a = 0; a < 8; a++) {
          const rad = a * Math.PI / 4, bx = e.x + e.w / 2, by = e.y + e.h / 2
          g.projs.push({ x: bx, y: by, vx: Math.cos(rad) * 2.2, vy: Math.sin(rad) * 2.2, active: true, pl: false, star: true, rot: a * 45, life: 4, dist: 0, ox: bx, oy: by })
        }
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

function tickSparks(g: G) {
  for (const s of g.sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.18; s.vx *= 0.88; s.life -= STEP }
  g.sparks = g.sparks.filter(s => s.life > 0)
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
      for (const e of g.enemies) {
        if (!e.active || e.dying) continue
        const ecx = e.x + EN_HBX, ecy = e.y + EN_HBT, ecw = e.w - 2 * EN_HBX, ech = e.h - EN_HBT
        const nearX = Math.max(ecx, Math.min(pr.x, ecx + ecw)), nearY = Math.max(ecy, Math.min(pr.y, ecy + ech))
        if ((pr.x - nearX) ** 2 + (pr.y - nearY) ** 2 < PR * PR) { pr.active = false; dmgEnemy(g, e, 1); break }
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
  if (!w.dealt) {
    const mg = 22, wx = Math.min(w.x, w.ex) - mg, wy = Math.min(w.y, w.ey) - mg, ww = Math.abs(w.ex - w.x) + mg * 2, wh = Math.abs(w.ey - w.y) + mg * 2
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
  const activeW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const minCX = activeW * NC * RW
  const maxCX = (activeW + 1) * NC * RW - CW
  g.cx = Math.max(minCX, Math.min(g.cx, maxCX))
  g.cx += (p.x + p.w / 2 - CW / 2 - g.cx) * 0.10
  g.cy += (p.y + p.h / 2 - CH / 2 - g.cy) * 0.10
  g.cx = Math.max(0, Math.min(g.cx, TOT_W - CW))
  g.cy = Math.max(0, Math.min(g.cy, TOT_H - CH))
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  g.explored.add(`${curW}_${curC}_${curR}`)
  if (curW !== g.lastWorld) {
    activateWorld(g, curW)
    g.lastWorld = curW
    g.checkpoint = { w: curW, x: KENNEL_WORLD_POS[curW].x, y: KENNEL_WORLD_POS[curW].y }
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

function tick(g: G) {
  const now = performance.now()
  tickPlayer(g); tickEnemies(g, now); tickProjs(g); tickWhip(g); tickBones(g); tickDrops(g); tickCamera(g); tickWorldAnim(g); tickSparks(g)
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

  const px = g.cx * 0.12 | 0
  ctx.save(); ctx.globalAlpha = 0.12

  if (wi === 0) {
    ctx.strokeStyle = th.rock; ctx.lineWidth = 2
    for (let x = ((150 - (px % 150)) % 150); x < CW + 10; x += 150) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, CH); ctx.stroke()
    }
    for (let y = 0; y < CH; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y + 30); ctx.stroke()
    }
  } else if (wi === 1) {
    ctx.fillStyle = th.rock
    for (let y = 60; y < CH; y += 120) ctx.fillRect(0, y - (px % 30), CW, 18)
    for (let x = ((180 - (px % 180 + 180) % 180)); x < CW + 30; x += 180) {
      ctx.fillStyle = th.rock; ctx.fillRect(x - 10, 0, 20, CH)
      ctx.fillStyle = th.rockHi; ctx.fillRect(x - 3, 0, 6, CH)
    }
  } else if (wi === 2) {
    ctx.strokeStyle = th.rock; ctx.lineWidth = 10
    for (let i = 0; i < 4; i++) {
      const ox = ((i * 280 - ((px * 0.5) | 0) + CW * 5) % CW)
      ctx.beginPath(); ctx.moveTo(ox, 0); ctx.bezierCurveTo(ox + 60, CH * 0.3, ox - 40, CH * 0.6, ox + 30, CH); ctx.stroke()
    }
  } else {
    ctx.strokeStyle = th.rock; ctx.lineWidth = 1.5
    for (let i = 0; i < 16; i++) {
      const ox = ((i * 70 - ((px * 0.7) | 0) + CW * 10) % CW)
      ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, CH); ctx.stroke()
    }
    for (let y = 0; y < CH; y += 70) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
    }
  }

  ctx.restore()
  ctx.fillStyle = th.fog + "88"; ctx.fillRect(0, 0, CW, CH)

  if (g.gfx >= 2) {
    ctx.strokeStyle = "rgba(0,0,0,0.05)"; ctx.lineWidth = 1
    for (let y = 0; y < CH; y += 3) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
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

    if (p.mode === "d") {
      const t = now * 0.003
      ctx.fillStyle = th.doorC + "BB"; ctx.fillRect(sx, sy, p.w, p.h)
      ctx.fillStyle = `rgba(255,80,0,${0.3 + 0.3 * Math.sin(t)})`; ctx.fillRect(sx + 2, sy + 2, p.w - 4, p.h - 4)
      ctx.strokeStyle = th.doorC; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, p.w, p.h)
      ctx.fillStyle = "#FFF"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"
      ctx.fillText("██SELLADO██", sx + p.w / 2, sy + p.h / 2 + 4); ctx.textAlign = "left"
      continue
    }

    if (p.mode === "t") {
      const pWi = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
      const pTh = THEMES[pWi]
      ctx.fillStyle = pTh.rockHi + "88"
      ctx.fillRect(sx, sy, p.w, 5)
      if (g.gfx >= 1) {
        ctx.fillStyle = pTh.accent + "14"
        ctx.fillRect(sx, sy, p.w, p.h)
      }
      continue
    }

    const pWi = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
    const pTh = THEMES[pWi]

    ctx.fillStyle = pTh.rock
    ctx.fillRect(sx, sy, p.w, p.h)

    if (g.gfx >= 1) {
      ctx.fillStyle = pTh.rockHi + "88"
      ctx.fillRect(sx, sy, p.w, 3)
      ctx.fillRect(sx, sy, 3, p.h)

      ctx.fillStyle = pTh.rockShadow + "CC"
      ctx.fillRect(sx + p.w - 3, sy, 3, p.h)
      ctx.fillRect(sx, sy + p.h - 3, p.w, 3)

      if (g.gfx >= 2 && p.w > 40 && p.h > 40) {
        const hash = ((p.x * 7 + p.y * 13) >>> 0) % 7
        ctx.strokeStyle = pTh.rockShadow + "33"
        ctx.lineWidth = 1
        if (hash === 0) { ctx.beginPath(); ctx.moveTo(sx + p.w * 0.2, sy + p.h * 0.3); ctx.lineTo(sx + p.w * 0.45, sy + p.h * 0.7); ctx.stroke() }
        if (hash === 1) { ctx.beginPath(); ctx.moveTo(sx + p.w * 0.6, sy + p.h * 0.1); ctx.lineTo(sx + p.w * 0.8, sy + p.h * 0.5); ctx.stroke() }
        if (hash === 2) { ctx.beginPath(); ctx.moveTo(sx + p.w * 0.1, sy + p.h * 0.6); ctx.lineTo(sx + p.w * 0.4, sy + p.h * 0.9); ctx.stroke() }
        if (hash === 3) {
          ctx.strokeStyle = pTh.accent + "20"
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(sx + p.w * 0.3, sy + p.h * 0.4); ctx.lineTo(sx + p.w * 0.7, sy + p.h * 0.6); ctx.stroke()
        }
      }
    }
  }
}

function drawKennels(ctx: CanvasRenderingContext2D, g: G) {
  const p = g.pl, t = Date.now() * 0.003
  for (let w = 0; w < NW; w++) {
    const kp = KENNEL_WORLD_POS[w], floorY = kp.y + PH, centerX = kp.x + PW / 2 + 16
    const sx = centerX - g.cx, sy = floorY - g.cy
    if (sx + 110 < 0 || sx - 110 > CW || sy - 120 < 0 || sy > CH + 10) continue
    const th = THEMES[w], isActive = g.checkpoint.w === w
    const dx = p.x + p.w / 2 - centerX, dy = p.y + p.h / 2 - (floorY - PH / 2)
    const near = Math.sqrt(dx * dx + dy * dy) < KENNEL_R
    const kw = 82, kh = 62
    if (isActive) {
      const grad = ctx.createRadialGradient(sx, sy - kh / 2, 10, sx, sy - kh / 2, KENNEL_R * 0.9)
      grad.addColorStop(0, th.accent + "2A"); grad.addColorStop(1, th.accent + "00")
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sx, sy - kh / 2, KENNEL_R * 0.9, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = isActive ? th.wall + "EE" : "#252525"; ctx.fillRect(sx - kw / 2, sy - kh, kw, kh)
    ctx.fillStyle = isActive ? th.accent : "#3A3A3A"
    ctx.beginPath(); ctx.moveTo(sx - kw / 2 - 10, sy - kh); ctx.lineTo(sx, sy - kh - 34); ctx.lineTo(sx + kw / 2 + 10, sy - kh); ctx.closePath(); ctx.fill()
    if (isActive) { ctx.strokeStyle = th.accent + "AA"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - kw / 2 - 10, sy - kh); ctx.lineTo(sx, sy - kh - 34); ctx.lineTo(sx + kw / 2 + 10, sy - kh); ctx.closePath(); ctx.stroke() }
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(sx, sy - 18, 18, Math.PI, 0); ctx.rect(sx - 18, sy - 18, 36, 18); ctx.fill()
    ctx.strokeStyle = isActive ? th.accent + "CC" : "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - 18, 18, Math.PI, 0); ctx.stroke()
    if (isActive) {
      const bounce = Math.sin(t * 2) * 3
      ctx.fillStyle = th.accent; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"
      ctx.fillText("★", sx, sy - kh - 38 + bounce); ctx.font = "bold 8px monospace"
      ctx.fillStyle = th.accent + "BB"; ctx.fillText("CHECKPOINT", sx, sy - kh - 45 + bounce); ctx.textAlign = "left"
    }
    if (near && !isActive) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 4); ctx.globalAlpha = pulse
      ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.beginPath(); ctx.roundRect(sx - 78, sy - kh - 54, 156, 28, 5); ctx.fill()
      ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"
      ctx.fillText("[E]  GUARDAR PUNTO", sx, sy - kh - 36); ctx.textAlign = "left"; ctx.globalAlpha = 1
    }
    if (near) {
      ctx.save(); ctx.strokeStyle = th.accent + "44"; ctx.lineWidth = 1; ctx.setLineDash([5, 5])
      ctx.beginPath(); ctx.arc(sx, sy - kh / 2, KENNEL_R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore()
    }
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
    if (!e.dying) {
      const hpR = Math.max(0, e.hp) / e.mhp
      ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(sx, sy - 11, e.w, 8)
      ctx.fillStyle = hpR > 0.5 ? "#00CC44" : hpR > 0.25 ? "#FFAA00" : "#FF2222"
      ctx.fillRect(sx + 1, sy - 10, Math.max(0, (e.w - 2) * hpR), 6)
      if (e.boss) { ctx.strokeStyle = th.accent + "88"; ctx.lineWidth = 1; ctx.strokeRect(sx, sy - 11, e.w, 8) }
    }
    if (e.alert && e.state === "chase" && !e.dying) {
      ctx.fillStyle = "#FFD700"; ctx.font = `bold ${e.boss ? 20 : 15}px monospace`; ctx.textAlign = "center"
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
      ctx.rotate(pr.rot * Math.PI / 180); ctx.fillStyle = "#F4E4C4"; ctx.fillRect(-9, -3, 18, 6)
      ctx.beginPath(); ctx.arc(-9, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(9, 0, 5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(-9, -4, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(-9, 4, 3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(9, -4, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(9, 4, 3, 0, Math.PI * 2); ctx.fill()
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
      ctx.fillStyle = "#FFF"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("+10", sx + 10, sy - 2); ctx.textAlign = "left"
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
      if (nCr > 0) { ctx.fillStyle = "#FFEE55CC"; ctx.font = "bold 7px monospace"; ctx.textAlign = "right"; ctx.fillText(`■${nCr}`, rx + rw - 1, ry + rh - 1); ctx.textAlign = "left" }
    }
    const dSz = Math.max(2, Math.round(Math.min(rw, rh) * 0.55))
    if (doors.R && c < NC - 1) { ctx.fillStyle = g.explored.has(`${curW}_${c + 1}_${r}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx + rw - 2, ry + Math.round((rh - dSz) / 2), 2, dSz) }
    if (doors.D && r < NR - 1) { ctx.fillStyle = g.explored.has(`${curW}_${c}_${r + 1}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx + Math.round((rw - dSz) / 2), ry + rh - 2, dSz, 2) }
    if (doors.L && c > 0) { ctx.fillStyle = g.explored.has(`${curW}_${c - 1}_${r}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx, ry + Math.round((rh - dSz) / 2), 2, dSz) }
    if (doors.U && r > 0) { ctx.fillStyle = g.explored.has(`${curW}_${c}_${r - 1}`) ? doorCol : "rgba(255,255,255,0.9)"; ctx.fillRect(rx + Math.round((rw - dSz) / 2), ry, dSz, 2) }
  }
  const plRx = gx + curC * (rw + gap) + Math.round(rw / 2), plRy = gy + curR * (rh + gap) + Math.round(rh / 2)
  ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(plRx, plRy, large ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = th.accent + "DD"; ctx.font = `bold ${large ? 8 : 7}px monospace`; ctx.textAlign = "center"
  ctx.fillText(WORLD_NAMES[curW].slice(0, 16), mx + mw / 2, my + mh - 3)
  if (!large) { ctx.fillStyle = "#444"; ctx.font = "6px monospace"; ctx.fillText("[Z] zoom", mx + mw / 2, my + mh + 7) }
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
  ctx.fillStyle = "#CCC"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"
  ctx.fillText("// MAPA DEL COMPLEJO CANINO //", CW / 2, 22)
  ctx.fillStyle = "#444"; ctx.font = "9px monospace"
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
    ctx.font = "bold 9px monospace"; ctx.textAlign = "left"
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
        if (kr.c === c && kr.r === r) { ctx.fillStyle = g.checkpoint.w === w ? "#FFD700" : "#555"; ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.fillText("★", rx + rW / 2, ry + rH / 2 + 4); ctx.textAlign = "left" }
        const nCr = getCratesInRoom(w, c, r, g)
        if (nCr > 0) { ctx.fillStyle = "#FFEE44EE"; ctx.font = "bold 8px monospace"; ctx.textAlign = "right"; ctx.fillText(`■${nCr}`, rx + rW - 2, ry + rH - 2); ctx.textAlign = "left" }
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
    ctx.font = "7px monospace"; ctx.textAlign = "center"
    ctx.fillStyle = wCleared ? "#00FF88" : w === curW ? "#AAAAFF" : w < curW ? "#666" : "#333"
    ctx.fillText(wCleared ? "✓ LIBERADO" : w === curW ? "⟶ ACTIVO" : w < curW ? "⚔ VISITADO" : "[ BLOQUEADO ]", bx + panW / 2, by + panH - 4)
    ctx.textAlign = "left"
  }
  const ly = CH - 14, items: [string, string][] = [["#050505", "sin explorar"], ["#b22", "enemigos"], ["#aa8800", "a medias"], ["#0a5", "limpia"], ["rgba(255,60,0,0.8)", "boss"], ["#FFD700", "perrera"]]
  let lx = mLeft; ctx.font = "8px monospace"
  for (const [col, lbl] of items) { ctx.fillStyle = col; ctx.fillRect(lx, ly, 9, 9); ctx.fillStyle = "#555"; ctx.fillText(" " + lbl, lx + 11, ly + 8); lx += lbl.length * 5 + 26 }
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
  ctx.fillStyle = "#00FF44"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"
  ctx.fillText("// MODO DESARROLLADOR — MAPA TELEPORT //", CW / 2, 20)
  ctx.fillStyle = "#1A6622"; ctx.font = "9px monospace"
  ctx.fillText(
    `GOD: ${g.godMode ? "■ ON" : "□ OFF"} [I]    AMMO∞: ${g.infiniteAmmo ? "■ ON" : "□ OFF"} [O]    NOENM: ${g.noEnemies ? "■ ON" : "□ OFF"} [K]    OHKO: ${g.ohko ? "■ ON" : "□ OFF"} [U]    [ESC/\`] cerrar    CLICK/A = teleport    LB/RB = mundo`,
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
    ctx.fillStyle = active ? th.accent : "#555"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"
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
    ctx.fillStyle = isHov ? "#FFF" : isCur ? th.accent : "#AAFFAA"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"
    ctx.fillText(`[${c},${r}]`, rx + rW / 2, ry + 13)
    const stateLbl = state === "clear" ? "✓ LIMPIA" : state === "half" ? "◑ MEDIA" : "⚠ ACTIVA"
    ctx.fillStyle = state === "clear" ? "#00FF88" : state === "half" ? "#FFCC00" : "#FF4444"; ctx.font = "7px monospace"
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
    ctx.font = "bold 7px monospace"; ctx.textAlign = "center"
    ctx.fillText("► SELEC", crx + rW / 2, cry - 3)
    ctx.textAlign = "left"
  }

  const ly = CH - 16
  ctx.font = "9px monospace"
  const leg: [string, string][] = [["rgba(0,120,40,0.8)", "limpia"], ["rgba(120,90,0,0.8)", "media"], ["rgba(0,80,0,0.5)", "activa"], ["rgba(180,0,0,0.8)", "boss"], ["rgba(60,50,0,0.9)", "perrera"]]
  let lx = 24
  for (const [col, lbl] of leg) { ctx.fillStyle = col; ctx.fillRect(lx, ly, 10, 10); ctx.fillStyle = "#888"; ctx.fillText(" " + lbl, lx + 12, ly + 9); lx += lbl.length * 6 + 28 }

  // Hint de controles gamepad
  ctx.fillStyle = "rgba(0,255,68,0.35)"; ctx.font = "8px monospace"; ctx.textAlign = "right"
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

function draw(g: G, ctx: CanvasRenderingContext2D, sprs: SprBank, devHover: { w: number; c: number; r: number } | null = null) {
  ctx.clearRect(0, 0, CW, CH)
  if (g.showDevMap) { drawDevMap(ctx, g, devHover); return }
  if (g.showMap) { drawFullMap(ctx, g); return }
  drawBg(ctx, g); drawWalls(ctx, g); drawBones(ctx, g); drawCrates(ctx, g); drawKennels(ctx, g)
  drawDrops(ctx, g); drawEnemies(ctx, g, sprs); drawPlayer(ctx, g, sprs); drawProjs(ctx, g); drawWhip(ctx, g)
  drawSparks(ctx, g); drawMinimap(ctx, g); drawHUD(ctx, g); drawWorldTransition(ctx, g)
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
  ctx.fillStyle = th.accent + "99"; ctx.font = "9px monospace"; ctx.fillText("ENEMIGOS SALA", panX + 10, hy + hs + 16)
  const roomSpawns = getEnemySpawns(curW, curC, curR)
  const eCy = hy + hs + 26, eR = 6, eSp = 16
  for (let i = 0; i < Math.min(roomSpawns.length, 7); i++) {
    const ex = panX + 10 + i * eSp + eR, dead2 = g.dead.has(`${rid(curW, curC, curR)}_${i}`)
    ctx.fillStyle = dead2 ? "#1A1A1A" : "#CC2222"; ctx.beginPath(); ctx.arc(ex, eCy, eR, 0, Math.PI * 2); ctx.fill()
    if (dead2) { ctx.strokeStyle = "#FF4444"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ex - 3, eCy - 3); ctx.lineTo(ex + 3, eCy + 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex + 3, eCy - 3); ctx.lineTo(ex - 3, eCy + 3); ctx.stroke() }
  }
  if (roomSpawns.length > 7) { ctx.fillStyle = "#888"; ctx.font = "8px monospace"; ctx.fillText(`+${roomSpawns.length - 7}`, panX + 10 + 7 * eSp + eR + 2, eCy + 4) }
  if (roomSpawns.length === 0) { ctx.fillStyle = "#00FF88"; ctx.font = "bold 9px monospace"; ctx.fillText("✓ LIMPIA", panX + 10, eCy + 4) }
  const ammoY = eCy + eR + 14
  ctx.fillStyle = th.accent + "99"; ctx.font = "9px monospace"; ctx.fillText("MUNICIÓN", panX + 10, ammoY)
  const bW = 7, bH = 7, bSp = 8, bY = ammoY + 8
  for (let i = 0; i < 15; i++) {
    const bx = panX + 10 + i * bSp, has = i < p.ammo; ctx.fillStyle = has ? th.accent : "#222"
    ctx.beginPath(); ctx.arc(bx + 1, bY + 1, 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(bx + bW - 1, bY + bH - 1, 2, 0, Math.PI * 2); ctx.fill()
    if (has) { ctx.fillStyle = th.accent; ctx.fillRect(bx + 1, bY + 2, bW - 2, bH - 4); ctx.fillRect(bx + 2, bY + 1, bW - 4, bH - 2) }
  }
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(CW - 92, 8, 84, 22, 4); ctx.fill()
  ctx.fillStyle = th.accent; ctx.font = "bold 11px monospace"; ctx.textAlign = "right"; ctx.fillText(`${g.score}`, CW - 12, 23); ctx.textAlign = "left"
  ctx.fillStyle = "#888"; ctx.font = "9px monospace"; ctx.fillText("PTS", CW - 86, 23)
  const stRatio = p.stamina / p.maxStamina, stW = 84, stH = 10, stX = CW - 92, stY = 34
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(stX, stY, stW, stH, 3); ctx.fill()
  if (p.exhausted) {
    if (Math.floor(Date.now() / 250) % 2 === 0) { ctx.fillStyle = "#FF220044"; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, stW - 2, stH - 2, 2); ctx.fill() }
    ctx.strokeStyle = "#FF3300BB"; ctx.lineWidth = 1.5; ctx.strokeRect(stX, stY, stW, stH)
    const cdRatio = p.staminaCooldown / 5.0
    ctx.fillStyle = "#FF330055"; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, Math.max(0, (stW - 2) * cdRatio), stH - 2, 2); ctx.fill()
    ctx.fillStyle = "#FF6600DD"; ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillText(`${Math.ceil(p.staminaCooldown)}s`, stX + stW / 2, stY + 8); ctx.textAlign = "left"
  } else {
    const stCol = stRatio > 0.55 ? "#44EE44" : stRatio > 0.25 ? "#EEcc00" : "#FF4400"
    ctx.fillStyle = stCol; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, Math.max(0, (stW - 2) * stRatio), stH - 2, 2); ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(stX + 1, stY + 1, Math.max(0, (stW - 2) * stRatio), Math.round(stH / 2) - 1, 1); ctx.fill()
  }
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "7px monospace"
  ctx.textAlign = "right"; ctx.fillText(p.exhausted ? "AGOTADO" : "STA", stX - 2, stY + 8); ctx.textAlign = "left"
  {
    const djY = stY + 14, sq = 8, sqGap = 5, totalSq = 2 * (sq + sqGap) - sqGap
    const djLabelX = stX - 2, djStartX = stX + (stW - totalSq) / 2
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "6px monospace"
    ctx.textAlign = "right"; ctx.fillText("JUMP", djLabelX, djY + 7); ctx.textAlign = "left"
    const j1 = p.onGround || (!p.jh)
    ctx.fillStyle = j1 ? th.accent : th.accent + "44"
    ctx.beginPath(); ctx.roundRect(djStartX, djY, sq, sq, 2); ctx.fill()
    ctx.fillStyle = p.djumpAvail ? "#00DDFF" : "#FFFFFF22"
    ctx.beginPath(); ctx.roundRect(djStartX + sq + sqGap, djY, sq, sq, 2); ctx.fill()
  }
  {
    const pfY = stY + 14 + 12, pfLabelX = stX - 2
    const onPlat = p.onGround && activePlats(g).some(pl =>
      pl.mode === "t" && p.x + p.w > pl.x && p.x < pl.x + pl.w && Math.abs((p.y + p.h) - pl.y) <= 8
    )
    if (onPlat) {
      ctx.fillStyle = th.accent + "BB"; ctx.font = "6px monospace"; ctx.textAlign = "right"
      ctx.fillText("S+S↓ bajar", pfLabelX, pfY + 6); ctx.textAlign = "left"
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(panX, 184, panW, 20, 4); ctx.fill()
  ctx.fillStyle = th.accent + "99"; ctx.font = "8px monospace"; ctx.fillText(`★ W${g.checkpoint.w + 1} ${WORLD_NAMES[g.checkpoint.w].slice(0, 12)}`, panX + 6, 197)
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
    ctx.fillStyle = msgColor; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"
    ctx.fillText(msgText, CW / 2, CH - 46); ctx.textAlign = "left"; ctx.restore()
  }
  if (g.devMode) {
    ctx.fillStyle = "rgba(0,80,0,0.85)"; ctx.beginPath(); ctx.roundRect(CW - 90, 46, 84, 16, 3); ctx.fill()
    ctx.strokeStyle = "#00FF44"; ctx.lineWidth = 1; ctx.strokeRect(CW - 90, 46, 84, 16)
    ctx.fillStyle = "#00FF44"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"
    const devFlags = (g.godMode ? "GOD " : "") + (g.infiniteAmmo ? "AMM " : "") + (g.noEnemies ? "NOENM " : "") + (g.ohko ? "OHKO" : "")
    ctx.fillText(`DEV${devFlags ? " | " + devFlags.trim() : ""}`, CW - 48, 57)
    ctx.textAlign = "left"
  }
  if (g.info) {
    ctx.fillStyle = "rgba(0,0,0,.85)"; ctx.beginPath(); ctx.roundRect(panX, 210, 200, 138, 8); ctx.fill()
    ctx.fillStyle = "#FFF"; ctx.font = "11px monospace"
    const lines = [`FPS: ${g.lfps.toFixed(0)}`, `GFX: ${["BAJA", "MEDIA", "ALTA"][g.gfx]} [Q ciclar]`, `POS: ${Math.floor(p.x)},${Math.floor(p.y)}`, `SAL: W${curW}.${curC}.${curR}`, `ENEMIGOS: ${g.enemies.length}`, `MUERTOS: ${g.dead.size}`, `CP: W${g.checkpoint.w}`]
    lines.forEach((l, i) => ctx.fillText(l, panX + 8, 226 + i * 18))
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
  ctx.fillStyle = th.accent; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"
  ctx.fillText(`// SECTOR ${wi + 1} DE ${NW} //`, CW / 2, CH / 2 - 68)
  ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 58px monospace"
  ctx.shadowColor = th.accent; ctx.shadowBlur = 24 * a.alpha
  ctx.fillText(a.name, CW / 2, CH / 2 + 8); ctx.shadowBlur = 0
  ctx.fillStyle = th.accent + "CC"; ctx.font = "italic 15px monospace"
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
  const [ui, setUi] = useState({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false })

  useEffect(() => {
    const L = (k: string, s: string) => { const img = new Image(); img.src = s; img.onload = () => { sprs.current[k] = img }; img.onerror = () => { sprs.current[k] = null } }
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
      const g = G.current, kps = KENNEL_WORLD_POS, p = g.pl
      for (let w = 0; w < NW; w++) {
        const kp = kps[w], cx2 = kp.x + PW / 2 + 16, cy2 = kp.y + PH / 2
        const dx = p.x + p.w / 2 - cx2, dy = p.y + p.h / 2 - cy2
        if (Math.sqrt(dx * dx + dy * dy) < KENNEL_R && g.checkpoint.w !== w) { g.checkpoint = { w, x: kp.x, y: kp.y }; g.kennelMsg = 3; break }
      }
    }
    const gpFullscreen = () => { const el = document.fullscreenElement; if (!el) (containerRef.current || document.documentElement).requestFullscreen().catch(() => { }); else document.exitFullscreen().catch(() => { }) }
    const loop = (now: number) => {
      const g = G.current, dt = Math.min((now - last) / 1000, .05); last = now
      g.fps.push(1 / Math.max(dt, .001)); if (g.fps.length > 60) g.fps.shift()
      g.lfps = g.fps.reduce((a, b) => a + b, 0) / g.fps.length
      pollGamepad(g, () => { }, () => G.current = mkG_lazy(), gpCheckpoint, gpFullscreen)
      if (!g.paused && !g.over && !g.won) {
        accum += dt; let st = 0
        while (accum >= STEP && st < 4) { tick(g); accum -= STEP; st++ }
        if (accum > STEP * 2) accum = 0
      } else accum = 0
      draw(g, ctx, sprs.current, devHoverRef.current)
      ut += dt; if (ut > .25) {
        ut = 0
        // if (g.autoGfx) {
        //   if (g.lfps < 28 && g.gfx > 1) g.gfx = (g.gfx - 1) as 0 | 1 | 2  // mínimo = 1
        //   else if (g.lfps > 58 && g.gfx < 2) g.gfx = (g.gfx + 1) as 0 | 1 | 2
        // }
        // // Garantía absoluta: gfx=0 nunca debería ocurrir via autoGfx
        // if (g.gfx < 1) g.gfx = 1
        // FIX: incluir showDevMap en el estado UI para controlar el overlay de pausa
        setUi({ paused: g.paused, over: g.over, won: g.won, fps: Math.round(g.lfps), score: g.score, showDevMap: g.showDevMap })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const pv = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "tab", "z", "f", "enter"]
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
      if (k === "f") { const el = document.fullscreenElement; if (!el) (containerRef.current || document.documentElement).requestFullscreen().catch(() => { }); else document.exitFullscreen().catch(() => { }) }
      if (k === "escape") {
        if (g.showMap) { g.showMap = false; g.paused = false }
        if (g.showDevMap) { g.showDevMap = false; g.paused = false }
      }
      if (k === "e") {
        ; (g as any)._gfxMsg = false
        const kps = KENNEL_WORLD_POS, p = g.pl
        for (let w = 0; w < NW; w++) {
          const kp = kps[w], centerX = kp.x + PW / 2 + 16, centerY = kp.y + PH / 2
          const dx = p.x + p.w / 2 - centerX, dy = p.y + p.h / 2 - centerY
          if (Math.sqrt(dx * dx + dy * dy) < KENNEL_R && g.checkpoint.w !== w) { g.checkpoint = { w, x: kp.x, y: kp.y }; g.kennelMsg = 3; break }
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
  const [gpadConnected, setGpadConnected] = useState(false)
  const devHoverRef = useRef<{ w: number; c: number; r: number } | null>(null)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
    const onConnect = (e: GamepadEvent) => { G.current.gpadIdx = e.gamepad.index; setGpadConnected(true) }
    const onDisconnect = (e: GamepadEvent) => { if (G.current.gpadIdx === e.gamepad.index) { G.current.gpadIdx = -1; setGpadConnected(false) } }
    window.addEventListener("gamepadconnected", onConnect); window.addEventListener("gamepaddisconnected", onDisconnect)
    const existing = navigator.getGamepads?.()
    if (existing) for (let i = 0; i < existing.length; i++) { if (existing[i]) { G.current.gpadIdx = i; setGpadConnected(true); break } }
    return () => { window.removeEventListener("gamepadconnected", onConnect); window.removeEventListener("gamepaddisconnected", onDisconnect) }
  }, [])

  const reset = () => { G.current = mkG_lazy(); setUi({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false }) }

  const canvasStyle = isFullscreen
    ? { display: "block", imageRendering: "pixelated" as const, width: "100%", height: "100%", objectFit: "contain" as const, border: "none", borderRadius: 0 }
    : { display: "block", imageRendering: "pixelated" as const, border: "2px solid #1A1A1A", borderRadius: 4 }

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden select-none">
      <div ref={containerRef} className="relative" style={isFullscreen ? { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", zIndex: 9999 } : { boxShadow: "0 0 60px rgba(0,0,0,.95)" }}>
        <canvas ref={canvasRef} width={CW} height={CH} style={canvasStyle} />
        <div className="absolute top-1 left-2 text-xs font-mono opacity-40 flex items-center gap-2" style={{ color: "#888" }}>
          <span>{ui.fps}fps</span>
          {gpadConnected && <span style={{ color: "#7CFC00", opacity: 0.9 }} title="Control Xbox detectado">🎮</span>}
        </div>
        {/* FIX: el overlay de pausa NO se muestra cuando showDevMap está activo */}
        {ui.paused && !ui.over && !ui.won && !ui.showDevMap && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
            <div className="text-center p-8 border border-gray-700 rounded-xl" style={{ background: "#0D0D0D" }}>
              <div className="text-3xl mb-2">⏸</div>
              <h2 className="text-xl font-bold text-gray-200 mb-2" style={{ fontFamily: "monospace" }}>// PAUSADO</h2>
              <p className="text-gray-500 text-sm font-mono">P → continuar</p>
            </div>
          </div>
        )}
        {ui.over && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
            <div className="text-center p-8 border border-red-900 rounded-xl" style={{ background: "#0D0000" }}>
              <div className="text-4xl mb-3">☠</div>
              <h2 className="text-2xl font-bold text-red-500 mb-2" style={{ fontFamily: "monospace" }}>GAME_OVER</h2>
              <p className="text-yellow-600 font-mono mb-4">score: {ui.score}</p>
              <button onClick={reset} className="px-6 py-2 border border-red-700 text-red-400 font-mono hover:bg-red-900 transition-colors">[ REINICIAR ]</button>
            </div>
          </div>
        )}
        {ui.won && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
            <div className="text-center p-8 border border-yellow-700 rounded-xl" style={{ background: "#0D0A00" }}>
              <div className="text-4xl mb-3">⭐</div>
              <h2 className="text-2xl font-bold text-yellow-400 mb-1" style={{ fontFamily: "monospace" }}>LIBERTAD_CANINA</h2>
              <p className="text-gray-400 font-mono text-sm mb-3">La resistencia perrina ha triunfado.</p>
              <p className="text-yellow-500 font-mono font-bold mb-4">score_final: {ui.score}</p>
              <button onClick={reset} className="px-6 py-2 border border-yellow-700 text-yellow-400 font-mono hover:bg-yellow-900 transition-colors">[ JUGAR_DE_NUEVO ]</button>
            </div>
          </div>
        )}
      </div>
      {!isFullscreen && <>
        <div className="mt-3 grid grid-cols-5 gap-4 text-xs font-mono max-w-3xl w-full px-4" style={{ color: "#666" }}>
          <div><span className="text-gray-300 block mb-1">// mover</span>WASD | Flechas<br /><span style={{ color: "#7CFC00" }}>2×</span> izq/der: correr</div>
          <div><span className="text-gray-300 block mb-1">// combate</span>Espacio: saltar<br /><span style={{ color: "#7CFC00" }}>2×Espacio</span>: doble salto<br />N: disparar | M: látigo</div>
          <div><span className="text-gray-300 block mb-1">// checkpoint</span><span style={{ color: "#7CFC00" }}>E</span>: guardar perrera<br />★ reapareces ahí</div>
          <div><span className="text-gray-300 block mb-1">// sistema</span>P: pausa | R: reset<br />J: debug | Tab: mapa | <span style={{ color: "#7CFC00" }}>Z</span>: zoom | <span style={{ color: "#7CFC00" }}>F</span>: fullscreen<br /><span style={{ color: "#FF8C00" }}>`</span>: dev | <span style={{ color: "#FF8C00" }}>H</span>: teleport | <span style={{ color: "#FF8C00" }}>I</span>: god | <span style={{ color: "#FF8C00" }}>O</span>: ∞ammo | <span style={{ color: "#FF8C00" }}>K</span>: sin enemigos</div>
          <div><span className="text-gray-300 block mb-1">// plataformas</span><span style={{ color: "#7CFC00" }}>S+S</span> ó agachado+S:<br />bajar de plataforma<br />Espacio+S: caer</div>
        </div>
        <div className="mt-1 text-xs font-mono" style={{ color: "#2A2A2A" }}>
          4 mundos × 9×9 salas | túneles procedurales estilo hollow knight | ~600 enemigos
        </div>
      </>}
    </div>
  )
}