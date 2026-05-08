// ══════════════════════════════════════════════════════════════
//  GENERACIÓN DE MUNDO — game/world_gen.ts
//  Laberinto, puertas, paredes, plataformas interiores, CPs, cajas
// ══════════════════════════════════════════════════════════════
import type { WPlat, CPDef, TunRect, ES } from "./types"
import {
  NW, NC, NR, RW, RH, WT, DW, DH, PW, PH, EW,
  STAIR_H, TUN_H_INNER, TUN_V_WIDTH, JUMP_H,
  TROW, TRANSIT_VERT_UP, TRANSIT_VERT_DOWN, TRANSIT_BOSS_COL,
  WORLD_P1_BOSS, WORLD_P2_BOSS, WORLD_ENTRIES, KENNEL_ROOMS,
  CP_LOCS, CP_COMPASS, CP_ICON, CP_LOCS_P1, CP_LOCS_P2, CP_LOCS_BOSS,
  TBALL_WALL, TBALL_PICKUP_POS, TBALL_SECRET_C, TBALL_SECRET_R,
  ro, PLAYER_START, WORLD_NAMES
} from "./constants"


// ── isBossRoom — depende solo de constantes, definida aquí para que world_gen sea
// el punto central de lógica de sala (sin circular deps)
export function isBossRoom(w: number, c: number, r: number): "p1" | "ultra" | "p2" | null {
  const [p1c, p1r] = WORLD_P1_BOSS[w], [p2c, p2r] = WORLD_P2_BOSS[w]
  if (c === p1c && r === p1r) return "p1"
  if (c === TRANSIT_BOSS_COL && r === TROW) return "ultra"
  if (c === p2c && r === p2r) return "p2"
  return null
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
export function getTemplate(w: number, c: number, r: number): number {
  return (w * 31 + c * 17 + r * 11 + w * c % 7 + c * r % 5) % 10
}

// ══════════════════════════════════════════════════════════════
//  SPAWNS DE ENEMIGOS
// ══════════════════════════════════════════════════════════════
// ES type is imported from ./types
export function getEnemySpawns(w: number, c: number, r: number): ES[] {
  const kr = KENNEL_ROOMS[w]
  if (kr.c === c && kr.r === r) return []

  const spdB = [1, 1.15, 1.35, 1.55][w]
  const cdB  = [9000, 8000, 7000, 6200][w]

  // ── FILA DE TRANSICIÓN ───────────────────────────────────────────────────
  if (r === TROW) {
    // Ultra-Boss en el centro del corredor (col 4)
    if (c === TRANSIT_BOSS_COL) {
      const bHp = [22, 36, 54, 78][w]
      return [[0.5, 0, bHp, spdB * 0.75, cdB * 0.5, true]]
    }
    // Perros guardianes de la jaula (solo World 0, sala de la jaula)
    if (w === 0 && c === TBALL_SECRET_C) {
      const gHp = [3, 4, 5, 6][w]  // perros débiles pero son guardianes
      return [[0.25, 0, gHp, spdB * 1.1, cdB * 0.9, false], [0.75, 0, gHp, spdB * 1.1, cdB * 0.9, false]]
    }
    return []  // resto del corredor vacío
  }

  // ── JEFE 1 (Parte 1) ────────────────────────────────────────────────────
  const [p1c, p1r] = WORLD_P1_BOSS[w]
  if (c === p1c && r === p1r) {
    const bHp = [12, 18, 28, 42][w]
    return [[0.5, 0, bHp, spdB * 0.85, cdB * 0.65, true]]
  }

  // ── JEFE 2 (Parte 2) ────────────────────────────────────────────────────
  const [p2c, p2r] = WORLD_P2_BOSS[w]
  if (c === p2c && r === p2r) {
    const bHp = [16, 26, 38, 56][w]
    return [[0.5, 0, bHp, spdB * 0.8, cdB * 0.6, true]]
  }

  // ── ENEMIGOS NORMALES ────────────────────────────────────────────────────
  const doors = computeDoors(w, c, r)
  if (!doors.L && !doors.R) return []

  const { x: x0 } = ro(w, c, r)
  const iL = x0 + WT, iR = x0 + RW - WT
  if (iR - iL < EW * 1.5) return []

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
export function roomHash(w: number, c: number, r: number): number {
  return ((w * 2971 + c * 1193 + r * 7919) ^ (w * c * r * 137 + c * r * 41)) >>> 0
}

// ══════════════════════════════════════════════════════════════
//  POSICIÓN DE PUERTAS
// ══════════════════════════════════════════════════════════════
export function lrDoorY_rel(w: number, leftC: number, r: number): number {
  // Corredor de transición: puerta siempre centrada (corredor horizontal limpio)
  if (r === TROW) return Math.floor((RH - DH) / 2)
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

export function udDoorX_rel(w: number, c: number, topR: number): number {
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
export function computeDoors(w: number, c: number, r: number): { L: boolean; R: boolean; U: boolean; D: boolean; Rx?: boolean } {
  const d = { L: false, R: false, U: false, D: false, Rx: false }

  // ── FILA DE TRANSICIÓN: siempre corredor horizontal completo ─────────────
  if (r === TROW) {
    d.L = c > 0
    d.R = c < NC - 1
    d.U = TRANSIT_VERT_UP.includes(c)    // conexiones hacia Parte 1
    d.D = TRANSIT_VERT_DOWN.includes(c)  // conexiones hacia Parte 2
    if (c === NC - 1) { d.R = true; d.Rx = true }  // salida al siguiente mundo
    // Entrada desde el mundo anterior (mundos no-primeros)
    const en = WORLD_ENTRIES[w]
    if (en && en[0] === c && en[1] === r) d.L = true
    return d
  }

  // ── LABERINTO NORMAL (filas 0-3 y 5-8) ─────────────────────────────────
  const hc = H_CONN[w], vc = V_CONN[w]
  for (const [hc1, hr1] of hc) {
    if (hr1 === TROW) continue  // ignorar conexiones del laberinto en TROW (se sobreescribe)
    if (hc1 === c && hr1 === r) d.R = true
    if (hc1 === c - 1 && hr1 === r) d.L = true
  }
  for (const [vc1, vr1] of vc) {
    // Ignorar conexiones que cruzan la frontera con TROW (se reemplazan con puntos fijos)
    if (vr1 === TROW - 1 || vr1 === TROW) continue
    if (vc1 === c && vr1 === r) d.D = true
    if (vc1 === c && vr1 === r - 1) d.U = true
  }
  // Conexiones verticales FIJAS en las fronteras con TROW
  if (r === TROW - 1 && TRANSIT_VERT_UP.includes(c))   d.D = true  // row3 → TROW
  if (r === TROW + 1 && TRANSIT_VERT_DOWN.includes(c)) d.U = true  // row5 ← TROW

  // Entrada desde mundo anterior (solo si está en TROW, ya manejado arriba)
  const en = WORLD_ENTRIES[w]
  if (en && en[0] === c && en[1] === r) d.L = true

  // ★ Garantizar acceso directo para salas cercanas al boss, evitando deadlocks de conectividad.
  //   La fila TROW corta el laberinto en P1/P2; algunos clusters de col6-col8 quedan aislados
  //   (solo accesibles desde la sala del jefe sellada). Se garantizan puertas explícitas:
  //   col8↔col7↔col6 para toda fila no-boss en P1 y P2.
  const [p1c_d, p1r_d] = WORLD_P1_BOSS[w]
  const [p2c_d, p2r_d] = WORLD_P2_BOSS[w]
  if (r < TROW) {
    if (c === p1c_d     && r !== p1r_d) d.L = true  // col8 P1 no-boss → izquierda
    if (c === p1c_d - 1 && r !== p1r_d) d.R = true  // col7 P1 no-boss → derecha
    if (c === p1c_d - 1 && r !== p1r_d) d.L = true  // col7 P1 no-boss → también izquierda (←col6)
    if (c === p1c_d - 2 && r !== p1r_d) d.R = true  // col6 P1 no-boss → derecha (→col7)
  }
  if (r > TROW) {
    if (c === p2c_d     && r !== p2r_d) d.L = true  // col8 P2 no-boss → izquierda
    if (c === p2c_d - 1 && r !== p2r_d) d.R = true  // col7 P2 no-boss → derecha
    if (c === p2c_d - 1 && r !== p2r_d) d.L = true  // col7 P2 no-boss → también izquierda (←col6)
    if (c === p2c_d - 2 && r !== p2r_d) d.R = true  // col6 P2 no-boss → derecha (→col7)
  }

  // ★ Garantizar conectividad total: fila de entrada (TROW±1) y fila límite (0 / NR-1)
  //   se conectan horizontalmente en su totalidad, eliminando cualquier cluster aislado.
  if (r < TROW) {
    if (r === TROW - 1) { if (c > 0) d.L = true; if (c < NC - 1) d.R = true }  // fila 3 — completa
    if (r === 0)        { if (c > 0) d.L = true; if (c < NC - 1) d.R = true }  // fila 0 — completa
  }
  if (r > TROW) {
    if (r === TROW + 1) { if (c > 0) d.L = true; if (c < NC - 1) d.R = true }  // fila 5 — completa
    if (r === NR - 1)   { if (c > 0) d.L = true; if (c < NC - 1) d.R = true }  // fila 8 — completa
  }

  // ★ Sala del jefe P1: sellada arriba y abajo — el boss no salta, arena completamente cerrada.
  const [bp1c, bp1r] = WORLD_P1_BOSS[w]
  if (c === bp1c && r === bp1r) { d.U = false; d.D = false }

  // ★ Sala del jefe P2: solo entrada superior (el jugador cae desde arriba)
  const [bp2c_d, bp2r_d] = WORLD_P2_BOSS[w]
  if (c === bp2c_d && r === bp2r_d) { d.L = false; d.R = false; d.D = false; d.U = true }
  // El cuarto encima del boss P2 siempre tiene salida hacia abajo
  if (c === bp2c_d && r === bp2r_d - 1) d.D = true

  return d
}

// ══════════════════════════════════════════════════════════════
//  RNG DETERMINISTA POR SALA
// ══════════════════════════════════════════════════════════════
export function makeRoomRng(w: number, c: number, r: number) {
  let seed = roomHash(w, c, r) * 1000003 + 7
  return () => { seed = (seed * 48271 + 0) % 2147483647; return (seed - 1) / 2147483646 }
}

// ── helper: devuelve chanTop/chanBot igual que makeInternalPlats ──────────
export function getRoomChannelBounds(w: number, c: number, r: number): { chanTop: number; chanBot: number } {
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
// ══════════════════════════════════════════════════════════════
export function makeRoomWalls(w: number, c: number, r: number): WPlat[] {
  const { x: x0, y: y0 } = ro(w, c, r)
  const d = computeDoors(w, c, r)
  const result: WPlat[] = []
  const solid = (x: number, y: number, pw: number, ph: number): WPlat => ({ x, y, w: pw, h: ph, mode: "s" })

  // ── TECHO ───────────────────────────────────────────────────────────────
  if (!d.U) {
    result.push(solid(x0, y0, RW, WT))
  } else {
    const gx = x0 + udDoorX_rel(w, c, r - 1)
    if (gx - x0 > 0) result.push(solid(x0, y0, gx - x0, WT))
    if (x0 + RW - (gx + DW) > 0) result.push(solid(gx + DW, y0, x0 + RW - (gx + DW), WT))
    // El techo de TROW siempre libre → Part1 ↔ TROW sin bloqueo
  }
  // ── SUELO ────────────────────────────────────────────────────────────────
  const floorY = y0 + RH - WT
  if (!d.D) {
    result.push(solid(x0, floorY, RW, WT))
  } else {
    const gx = x0 + udDoorX_rel(w, c, r)
    if (gx - x0 > 0) result.push(solid(x0, floorY, gx - x0, WT))
    if (x0 + RW - (gx + DW) > 0) result.push(solid(gx + DW, floorY, x0 + RW - (gx + DW), WT))
    // ★ PUERTA CIAN: suelo de TROW en cols 3 y 6 → bloquea descenso a Part2 hasta matar Jefe 1
    if (r === TROW && (c === 3 || c === 6)) {
      result.push({ x: gx, y: floorY, w: DW, h: WT, mode: "d", sw: 100 + w })
    }
  }
  // ── PARED IZQUIERDA ──────────────────────────────────────────────────────
  if (!d.L) {
    result.push(solid(x0, y0 + WT, WT, RH - 2 * WT))
  } else {
    const dy = lrDoorY_rel(w, c - 1, r)
    const topH = dy - WT
    const botH = RH - WT - dy - DH
    if (topH > 0) result.push(solid(x0, y0 + WT, WT, topH))
    if (botH > 0) result.push(solid(x0, y0 + dy + DH, WT, botH))
    // ★ PUERTA ULTRA-BOSS: pared izquierda de [4,TROW] sellada hasta matar ambos jefes
    if (r === TROW && c === TRANSIT_BOSS_COL) {
      result.push({ x: x0, y: y0 + dy, w: WT, h: DH, mode: "d", sw: 200 + w })
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
    // ★ PUERTA ULTRA-BOSS: pared derecha de [4,TROW] sellada hasta matar ambos jefes
    if (r === TROW && c === TRANSIT_BOSS_COL) {
      result.push({ x: x0 + RW - WT, y: y0 + dy, w: WT, h: DH, mode: "d", sw: 200 + w })
    }
  }

  // ★ Sellar TODAS las entradas de las salas de los jefes seccionales
  //   sw 300+w → jefe P1 (bloqueado hasta matar enemigos normales de Part1)
  //   sw 400+w → jefe P2 (bloqueado hasta matar enemigos normales de Part2)
  //   sw 500+w → jefe P1 arena: se cierra al entrar, se abre al matar al boss
  const bossType = isBossRoom(w, c, r)
  if (bossType === "p1" || bossType === "p2") {
    const sw = bossType === "p1" ? 300 + w : 400 + w
    if (d.L) result.push({ x: x0, y: y0 + lrDoorY_rel(w, c - 1, r), w: WT, h: DH, mode: "d", sw })
    if (d.R && !d.Rx) result.push({ x: x0 + RW - WT, y: y0 + lrDoorY_rel(w, c, r), w: WT, h: DH, mode: "d", sw })
    if (d.U) result.push({ x: x0 + udDoorX_rel(w, c, r - 1), y: y0, w: DW, h: WT, mode: "d", sw })
    if (d.D) result.push({ x: x0 + udDoorX_rel(w, c, r), y: y0 + RH - WT, w: DW, h: WT, mode: "d", sw })
    // Puerta de cierre de arena P1 (sw 500+w): sella entrada lateral
    if (bossType === "p1") {
      const swArena = 500 + w
      if (d.L) result.push({ x: x0, y: y0 + lrDoorY_rel(w, c - 1, r), w: WT, h: DH, mode: "d", sw: swArena })
      if (d.R && !d.Rx) result.push({ x: x0 + RW - WT, y: y0 + lrDoorY_rel(w, c, r), w: WT, h: DH, mode: "d", sw: swArena })
    }
    // Puerta de cierre de arena P2 (sw 510+w): sella entrada superior al entrar en batalla
    if (bossType === "p2") {
      const swArena2 = 510 + w
      if (d.U) result.push({ x: x0 + udDoorX_rel(w, c, r - 1), y: y0, w: DW, h: WT, mode: "d", sw: swArena2 })
    }
  }

  return result
}

export function makeInternalPlats(w: number, c: number, r: number): WPlat[] {
  const { x: x0, y: y0 } = ro(w, c, r)
  const d = computeDoors(w, c, r)

  const kr = KENNEL_ROOMS[w]
  if (kr.c === c && kr.r === r) return []

  // Sala del jefe P1: arena limpia sin plataformas (boss no salta)
  const [bp1c2, bp1r2] = WORLD_P1_BOSS[w]
  if (c === bp1c2 && r === bp1r2) return []

  // Sala del jefe P2: paredes flotantes más anchas + plataformas entre pared exterior y flotante
  const [bp2c2, bp2r2] = WORLD_P2_BOSS[w]
  if (c === bp2c2 && r === bp2r2) {
    const iL2 = x0 + WT, iR2 = x0 + RW - WT
    const iT2 = y0 + WT, iB2 = y0 + RH - WT, iH2 = iB2 - iT2
    const wallThk = 52       // grosor de la pared flotante (más gruesa)
    const wallGap = 140      // ancho del pasillo entre pared real y pared flotante
    const wallH   = Math.floor(iH2 * 0.60)   // cubre 60% de la altura interior
    const wallTop = iT2 + Math.floor(iH2 * 0.18)   // empieza al 18% desde el techo
    // Pared flotante izquierda: arranca en iL2 + wallGap
    const lwX = iL2 + wallGap
    // Pared flotante derecha: termina en iR2 - wallGap
    const rwX = iR2 - wallGap - wallThk
    // Plataformas en el pasillo entre pared real y pared flotante
    const plW2 = wallGap     // ancho exacto del pasillo
    // Paredes sólidas flotantes
    const solid2 = (px2: number, py2: number, pw2: number, ph2: number): WPlat => ({ x: px2, y: py2, w: pw2, h: ph2, mode: "s" })
    const trav2  = (px2: number, py2: number, pw2: number, ph2: number): WPlat => ({ x: px2, y: py2, w: pw2, h: ph2, mode: "t" })
    const result2: WPlat[] = [
      // Pared flotante izquierda
      solid2(lwX, wallTop, wallThk, wallH),
      // Plataformas atravesables izquierda (entre pared real y pared flotante)
      trav2(iL2, wallTop + Math.floor(wallH * 0.28), plW2, STAIR_H),
      trav2(iL2, wallTop + Math.floor(wallH * 0.58), plW2, STAIR_H),
      // Pared flotante derecha
      solid2(rwX, wallTop, wallThk, wallH),
      // Plataformas atravesables derecha (entre pared flotante y pared real)
      trav2(rwX + wallThk, wallTop + Math.floor(wallH * 0.28), plW2, STAIR_H),
      trav2(rwX + wallThk, wallTop + Math.floor(wallH * 0.58), plW2, STAIR_H),
    ]
    return result2
  }

  // Corredor de transición: pasillo limpio; solo añadir plataformas de escalada
  // donde haya una conexión vertical hacia arriba (Part1) o hacia abajo (Part2)
  if (r === TROW) {
    if (!d.U && !d.D) return []
    const { x: x0, y: y0 } = ro(w, c, r)
    const climb: WPlat[] = []
    const platW = DW + 40  // un poco más ancho que la apertura de puerta
    // La apertura vertical (U y D usan la misma posición X centrada en el cuarto)
    const gx = x0 + (d.U ? udDoorX_rel(w, c, r - 1) : udDoorX_rel(w, c, r))
    const platX = gx - 20  // centrar la plataforma sobre la apertura
    // Plataforma inferior: a ~55% de altura → escalón de partida
    climb.push({ x: platX, y: y0 + Math.floor(RH * 0.55), w: platW, h: WT, mode: "s" })
    // Plataforma superior: a ~25% de altura → escalón final antes del techo
    climb.push({ x: platX + 10, y: y0 + Math.floor(RH * 0.24), w: platW - 20, h: WT, mode: "s" })
    return climb
  }

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

export function getWorldPlats(w: number): WPlat[] {
  if (_WORLD_PLATS[w]) return _WORLD_PLATS[w]!
  const plats: WPlat[] = []
  for (let c = 0; c < NC; c++)
    for (let r = 0; r < NR; r++)
      plats.push(...makeRoomWalls(w, c, r), ...makeInternalPlats(w, c, r))
  _WORLD_PLATS[w] = plats
  return plats
}

// ALL_CPS — validados para que no queden dentro de plataformas sólidas
export const ALL_CPS: CPDef[] = (() => {
  const out: CPDef[] = []

  const addCP = (w: number, c: number, r: number, label: string, icon: string, bossKind?: "p1" | "ultra" | "p2") => {
    const { x: x0, y: y0 } = ro(w, c, r)
    const cpX = x0 + RW / 2 - PW / 2
    let cpY = y0 + RH - WT - PH
    const roomPlats = [...makeRoomWalls(w, c, r), ...makeInternalPlats(w, c, r)].filter(p => p.mode === "s")
    for (let attempt = 0; attempt < 20; attempt++) {
      const hit = roomPlats.find(p => cpX < p.x + p.w && cpX + PW > p.x && cpY < p.y + p.h && cpY + PH > p.y)
      if (!hit) break
      cpY = hit.y - PH - 1
    }
    cpY = Math.max(y0 + WT + 4, Math.min(cpY, y0 + RH - WT - PH))
    const def: CPDef = { id: `${w}_${c}_${r}`, w, c, r, x: cpX, y: cpY, label, icon }
    if (bossKind) def.bossKind = bossKind
    out.push(def)
  }

  for (let w = 0; w < NW; w++) {
    // CPs originales (kennel + compás)
    for (let i = 0; i < 5; i++) {
      const [c, r] = CP_LOCS[i]
      addCP(w, c, r, `W${w + 1} ${WORLD_NAMES[w].slice(0, 10)} — ${CP_COMPASS[i]}`, CP_ICON[i])
    }
    // CPs de Parte 1 (rows 0–3)
    for (const [c, r] of CP_LOCS_P1)
      addCP(w, c, r, `W${w + 1} P1 [${c},${r}]`, "●")
    // CPs de Parte 2 (rows 5–8)
    for (const [c, r] of CP_LOCS_P2)
      addCP(w, c, r, `W${w + 1} P2 [${c},${r}]`, "●")
    // CPs de bosses (inactivos hasta que muere el jefe)
    for (const [c, r, bk] of CP_LOCS_BOSS)
      addCP(w, c, r, `W${w + 1} JEFE ${bk.toUpperCase()}`, "★", bk)
  }

  return out
})()

// Función que reemplaza a BASE_PLATS en todas sus referencias.
// Devuelve únicamente los mundos que están activos/cargados.
export function getActivePlatsForWorlds(loadedWorlds: Set<number>): WPlat[] {
  const result: WPlat[] = []
  for (const w of loadedWorlds) result.push(...getWorldPlats(w))
  return result
}
const _WORLD_CRATE_DEFS: (Array<{ id: number; x: number; y: number; w: number; h: number }> | null)[] = [null, null, null, null]
let _crateIdCounter = 0  // ID global, persistente entre mundos

// Encuentra todas las posiciones Y donde una caja puede reposar sobre una superficie sólida
export function getCrateValidSurfaces(roomPlats: WPlat[], cx: number, cW: number, cH: number, roomTop: number, roomBot: number): number[] {
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

export function getWorldCrateDefs(w: number) {
  if (_WORLD_CRATE_DEFS[w]) return _WORLD_CRATE_DEFS[w]!
  const xSlots = [0.12, 0.28, 0.44, 0.62, 0.80]
  const cr: Array<{ id: number; x: number; y: number; w: number; h: number }> = []
  const worldPlats = getWorldPlats(w)

  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const isKennel = KENNEL_ROOMS.some(k => k.w === w && k.c === c && k.r === r)
    const bossType = isBossRoom(w, c, r)
    if (isKennel || bossType !== null) continue  // sin cajas en salas de boss o kennel
    const hash = (w * 37 + c * 13 + r * 7) % 10
    if (hash < 2) continue
    const count = hash >= 7 ? 2 : 1
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

