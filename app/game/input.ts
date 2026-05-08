// ══════════════════════════════════════════════════════════════
//  INPUT — game/input.ts
//  Gamepad polling, control icon helpers
// ══════════════════════════════════════════════════════════════
import type { G, GpadType } from "./types"
import { NC, NW, NR, RW, GP, GP_DEAD, GPAD_BTN, XB_COL, PS_COL } from "./constants"
import { devTeleport, tpOpenMenu, tpNavCP, tpNavWorld, tpDoConfirm, _tpClearMvKeys } from "./render"
import { bolkhaDoInteract } from "./npc_bolkha"

// ── Iconos de controles (teclado / Xbox / PlayStation) ───────────────────────

/** Detecta el tipo de mando a partir del string de id del Gamepad API */
export function detectGpadType(id: string): GpadType {
  const s = id.toLowerCase()
  if (s.includes("054c") || s.includes("playstation") || s.includes("dualshock") ||
      s.includes("dualsense") || s.includes("sony") || s.includes("wireless controller"))
    return "ps"
  return "xbox"  // cualquier otro gamepad → iconos Xbox por defecto
}

// GPAD_BTN, XB_COL, PS_COL are defined in constants.ts and re-exported here for convenience
export { GPAD_BTN, XB_COL, PS_COL } from "./constants"

// ── Gamepad ───────────────────────────────────────────────────────────────────
const _gpPrev: Record<number, boolean> = {}
let _gpBPrev = false, _gpTapL = 0, _gpTapR = 0, _gpPrevL = false, _gpPrevR = false
// Debounce para navegación celda a celda con stick (ms restantes)
let _gpStickNavCd = 0

export function pollGamepad(g: G, onMapToggle: () => void, onReset: () => void, onCheckpoint: () => void, onFullscreen: () => void) {
  const pads = navigator.getGamepads?.()
  if (!pads) return
  let pad: Gamepad | null = null
  if (g.gpadIdx >= 0 && pads[g.gpadIdx]) pad = pads[g.gpadIdx]
  else { for (let i = 0; i < pads.length; i++) { if (pads[i]) { g.gpadIdx = i; pad = pads[i]; break } } }
  if (!pad) { g.gpadIdx = -1; return }
  const btn = (i: number) => pad!.buttons[i]?.pressed ?? false
  const ax = (i: number) => pad!.axes[i] ?? 0
  const edgeDown = (i: number) => { const now = btn(i); const prev = _gpPrev[i] ?? false; _gpPrev[i] = now; return now && !prev }

  // ── Real Map DEV: stick derecho cambia sección/mundo ────────────
  if (g.showRealMap && g.devMode) {
    _gpStickNavCd = Math.max(0, _gpStickNavCd - 16)
    const THRESH = 0.55
    if (_gpStickNavCd <= 0) {
      const ry = ax(3)   // stick derecho Y (up=sección superior, down=inferior)
      const rx = ax(2)   // stick derecho X (izquierda/derecha = mundo)
      if      (ry < -THRESH) { g.realMapSection = 0; _gpStickNavCd = 400 }
      else if (ry >  THRESH) { g.realMapSection = 1; _gpStickNavCd = 400 }
      if      (rx < -THRESH) { g.realMapWorld = (g.realMapWorld - 1 + NW) % NW; _gpStickNavCd = 300 }
      else if (rx >  THRESH) { g.realMapWorld = (g.realMapWorld + 1) % NW;       _gpStickNavCd = 300 }
    }
    if (edgeDown(GP.B) || edgeDown(GP.START) || edgeDown(GP.BACK)) g.showRealMap = false
    _gpBPrev = btn(GP.B)
    return  // no procesar movimiento de jugador
  }

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

  // ── Tienda Bolkha abierta O animación de entrega ─────────────────
  if (g.bolkhaState === "giving") {
    _gpBPrev = btn(GP.B)
    return  // no procesar movimiento de jugador durante animación de entrega
  }
  if (g.bolkhaShopOpen) {
    _gpStickNavCd = Math.max(0, _gpStickNavCd - 16)
    if (_gpStickNavCd <= 0) {
      const ly = ax(1)
      const THRESH = 0.55
      if (ly < -THRESH || btn(GP.UP))    { g.bolkhaShopCursor = Math.max(0, g.bolkhaShopCursor - 1); _gpStickNavCd = 220 }
      else if (ly > THRESH || btn(GP.DOWN))  { g.bolkhaShopCursor = Math.min(2, g.bolkhaShopCursor + 1); _gpStickNavCd = 220 }
    }
    if (edgeDown(GP.A)) bolkhaDoInteract(g)
    if (edgeDown(GP.B) || edgeDown(GP.START)) { g.bolkhaShopOpen = false; g.bolkhaState = "idle" }
    _gpBPrev = btn(GP.B)
    return  // no procesar movimiento de jugador
  }

  // ── Menú de teletransporte abierto ───────────────────────────────
  if (g.tpMenu?.open) {
    _gpStickNavCd = Math.max(0, _gpStickNavCd - 16)
    const THRESH = 0.55
    if (_gpStickNavCd <= 0) {
      const ly = ax(1), lx = ax(0)
      if (ly < -THRESH || btn(GP.UP))    { tpNavCP(g, -1);    _gpStickNavCd = 160 }
      else if (ly > THRESH || btn(GP.DOWN))  { tpNavCP(g, 1);     _gpStickNavCd = 160 }
      else if (lx < -THRESH || btn(GP.LEFT)) { tpNavWorld(g, -1); _gpStickNavCd = 200 }
      else if (lx > THRESH || btn(GP.RIGHT)) { tpNavWorld(g, 1);  _gpStickNavCd = 200 }
    }
    if (edgeDown(GP.A)) tpDoConfirm(g)
    if (edgeDown(GP.B) || edgeDown(GP.START)) { g.tpMenu = null; g.paused = false; _tpClearMvKeys(g) }
    return
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
  g.keys[" "] = btn(GP.A); g.keys["n"] = btn(GP.X) || btn(GP.RB); g.keys["m"] = btn(GP.Y)
  g.keys["shift"] = btn(GP.LT) || ax(2) > 0.4 || ax(4) > 0.4
  if (btn(GP.RT) || ax(5) > GP_DEAD) g.pl.runMode = true
  const gNow2 = performance.now(), TAP_W = 280
  const stL = ax(0) < -0.70, stR = ax(0) > 0.70
  if (stL && !_gpPrevL) { if (gNow2 - _gpTapL < TAP_W && _gpTapL > 0) g.pl.runMode = true; _gpTapL = gNow2 }
  if (stR && !_gpPrevR) { if (gNow2 - _gpTapR < TAP_W && _gpTapR > 0) g.pl.runMode = true; _gpTapR = gNow2 }
  _gpPrevL = stL; _gpPrevR = stR
  g.keys["z"] = Math.abs(ax(2)) > GP_DEAD || Math.abs(ax(3)) > GP_DEAD
  if (edgeDown(GP.START)) g.paused = !g.paused
  if (edgeDown(GP.BACK)) { g.showMap = !g.showMap; g.paused = g.showMap; onMapToggle(); if (g.showMap) { g.mapViewWorld = Math.max(0, Math.min(NW - 1, Math.floor(g.pl.x / (NC * RW)))); g.mapView = "single" } }
  // LB = teletransporte (menú de CPs)
  if (edgeDown(GP.LB) && !g.tpAnim) tpOpenMenu(g)
  const bNow = btn(GP.B)
  const bEdge = bNow && !_gpBPrev   // solo el primer frame del press (edge detector)
  if (bEdge) {
    if (g.showMap)                      { g.showMap = false; g.paused = false }
    else if (g.bolkhaState === "talking") bolkhaDoInteract(g)  // abre la tienda
    else onCheckpoint()
  }
  _gpBPrev = bNow
  // E solo se activa en el primer frame del press — evita auto-avance de páginas en diálogos
  g.keys["e"] = !g.showMap && !g.bolkhaShopOpen && bEdge
  if (btn(GP.L3) && btn(GP.R3)) { onFullscreen() }
}
