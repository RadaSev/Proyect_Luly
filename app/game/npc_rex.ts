// ══════════════════════════════════════════════════════════════
//  NPC REX — game/npc_rex.ts
//  El Viejo Dog: tickViejoDog, estado de diálogo (module-level)
// ══════════════════════════════════════════════════════════════
import type { G } from "./types"
import {
  STEP, PW, PH, NC, NW, RW,
  VIEJO_DOG_POS, VIEJO_DOG_TALK_R,
  TB_AMMO_MAX,
} from "./constants"
import { countP1KillsW0, spawnExplosion, triggerShake } from "./utils"
import { isPart1BossDead, isPart2BossDead, areRegularP2EnemiesDead } from "./physics"
import { saveGame } from "./save"

// ── Estado de módulo de tipografía Rex (exportado para render.ts) ────────────
export let _rexNameAlpha = 1.0
export let _rexDlgKey    = ""
export let _rexDlgMs     = 0
export let _rexDlgPage    = 0
export let _rexPageWaiting  = false
export let _rexTypingActive = false
export let _rexYesNoActive  = false   // true cuando el selector Sí/No está listo para input
export let _rexWasInRange   = false
export const _rexReadPages: Record<string, number> = {}

// Setters (necesarios porque los let exports no son asignables desde fuera del módulo en TS)
export function setRexNameAlpha(v: number)     { _rexNameAlpha = v }
export function setRexDlgKey(v: string)        { _rexDlgKey = v }
export function setRexDlgMs(v: number)         { _rexDlgMs = v }
export function setRexDlgPage(v: number)       { _rexDlgPage = v }
export function setRexPageWaiting(v: boolean)  { _rexPageWaiting = v }
export function setRexTypingActive(v: boolean) { _rexTypingActive = v }
export function setRexYesNoActive(v: boolean)  { _rexYesNoActive = v }
export function setRexWasInRange(v: boolean)   { _rexWasInRange = v }

// Corazones de recompensa diferidos: se spawnean cuando el diálogo llega a la página 0
let _rexPendingHearts = 0        // cuántos corazones quedan por soltar
let _rexHeartsDropped = false    // flag: ya se soltaron en esta visita

export function tickViejoDog(g: G) {
  // ── Soltar corazones diferidos en la página 0 del diálogo reward_lives ───────
  if (!_rexHeartsDropped && _rexPendingHearts > 0 &&
      _rexTypingActive && _rexDlgPage === 1 &&
      (g.viejoDogState === "reward_lives")) {
    for (let i = 0; i < _rexPendingHearts; i++) {
      // Spawnear a la derecha de Rex para no taparle el sprite
      g.drops.push({ x: VIEJO_DOG_POS.x + 80 + Math.random() * 60, y: VIEJO_DOG_POS.y - 10, vx: 0.5 + Math.random() * 1.5, vy: -3.5 - Math.random() * 1.2, active: true, life: 120, kind: "h" })
    }
    spawnExplosion(g, VIEJO_DOG_POS.x, VIEJO_DOG_POS.y - 30, ["#FF4444", "#FF8888", "#FFD700", "#FFFFFF"], 18, 4, false)
    _rexHeartsDropped = true
    _rexPendingHearts = 0
  }

  // Solo aplica en World 0
  const curW = Math.max(0, Math.min(Math.floor(g.pl.x / (NC * RW)), NW - 1))
  if (curW !== 0) return
  const p = g.pl
  const dx = p.x + PW / 2 - VIEJO_DOG_POS.x
  const dy = p.y + PH / 2 - VIEJO_DOG_POS.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // ── Temporizador de animación llave (corre siempre, dentro o fuera del rango) ─
  if (g.rexKeyAnimTimer > 0) {
    g.rexKeyAnimTimer = Math.max(0, g.rexKeyAnimTimer - STEP)
    if (g.rexKeyAnimTimer <= 0 && g.viejoDogState === "key_held" && !g.tballKeyHeld) {
      // Fase 3 terminada → explotar y abrir la jaula
      g.viejoDogState = "cage_opened"
      g.rexMitadAnimStart = 0   // limpiar para futuros usos
      spawnExplosion(g, VIEJO_DOG_POS.x, VIEJO_DOG_POS.y - 30, ["#FFD700", "#FFA500", "#FFFFFF", "#FFEE88"], 28, 5, true)
      triggerShake(g, 9, 0.55)
      g.abilityNotif = { text: "¡Rex tiene la otra mitad! La jaula de su pelota está abierta", timer: 6.0 }
      saveGame(g)
    }
  }

  // Detectar cuando el jugador sale del rango de diálogo
  if (dist > VIEJO_DOG_TALK_R) {
    if (g.viejoDogState === "intro") g.rexIntroLeft = true
    // baton_delivered → salir después de verlo → siguiente fase
    if (g.viejoDogState === "baton_delivered" && g.rexBatonDeliveredSeen) {
      g.viejoDogState = g.cw.has(0) ? "ultra_done" : "ultra_hint"
      saveGame(g)
    }
    // ultra_done → salir después de verlo → world2_ready
    if (g.viejoDogState === "ultra_done" && g.rexUltraDoneSeen) {
      g.viejoDogState = "world2_ready"
      saveGame(g)
    }
    // ultra_ready: si la jugadora dijo No y se aleja, re-analizar si le faltan recursos
    if (g.viejoDogState === "ultra_ready" && g.rexUltraReadyDeclined) {
      g.rexUltraReadyDeclined = false
      const _fullCheck = g.pl.hp >= g.pl.maxHp && g.pl.ammo >= 15
        && (!g.abilities.has("tball") || g.tballAmmo > 0)
      if (!_fullCheck) {
        // No está completa → volver al análisis de recursos
        g.viejoDogState = "ultra_hint"
        g.rexUltraGaveItems = false  // Rex puede prestar de nuevo si hace falta
        saveGame(g)
      }
    }
    return
  }


  if (g.viejoDogState === "waiting") {
    // Primera vez que el jugador se acerca → mostrar introducción
    if (g.abilities.has("tball")) {
      g.viejoDogState = "surprised"
    } else {
      g.viejoDogState = "intro"
      g.rexIntroLeft = false
      saveGame(g)
    }
  } else if (g.viejoDogState === "intro" && g.rexIntroLeft) {
    // Volvió después de leer la intro → arrancar la quest
    g.viejoDogState = "quest_active"
    g.questKillBaseline = countP1KillsW0(g.dead)
    saveGame(g)
  } else if ((g.viejoDogState === "cage_opened" || g.viejoDogState === "surprised" || g.viejoDogState === "quest_done") && g.abilities.has("tball")) {
    // Jugadora llega con la pelota → primer mensaje especial
    g.viejoDogState = "ball_held"
    g.rexBallFirstSeen = false
    saveGame(g)
  } else if (g.viejoDogState === "ball_held") {
    if (!g.rexBallFirstSeen) {
      // Primera visita con pelota: marcar vista y quedarse en "ball_held"
      g.rexBallFirstSeen = true
      saveGame(g)
    } else if (isPart1BossDead(g, 0)) {
      // Jefe P1 muerto → corazones diferidos: se soltarán cuando aparezca el diálogo
      const needed = g.pl.maxHp - g.pl.hp
      if (needed > 0) {
        _rexPendingHearts = needed
        _rexHeartsDropped = false
        g.viejoDogState = "reward_lives"
      } else {
        g.viejoDogState = "reward_full"
      }
      saveGame(g)
    } else {
      // Segunda+ visita, jefe P1 sigue vivo → guía hacia el jefe
      g.viejoDogState = "ball_guide"
      saveGame(g)
    }
  } else if (g.viejoDogState === "ball_guide" && isPart1BossDead(g, 0) && !g.rexBatonHeld) {
    // Castigador muerto, jugadora vuelve a Rex → corazones diferidos
    const needed = g.pl.maxHp - g.pl.hp
    if (needed > 0) {
      _rexPendingHearts = needed
      _rexHeartsDropped = false
      g.viejoDogState = "reward_lives"
    } else {
      g.viejoDogState = "reward_full"
    }
    saveGame(g)
  } else if ((g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full") && areRegularP2EnemiesDead(g, 0) && !isPart2BossDead(g, 0)) {
    // Todos los enemigos P2 muertos pero El Herrero sigue vivo → aviso especial
    g.viejoDogState = "p2_warning"
    saveGame(g)
  } else if (g.viejoDogState === "baton_delivered") {
    // Primera vez que vuelve después de entregar el bastón: marcar vista
    if (!g.rexBatonDeliveredSeen) { g.rexBatonDeliveredSeen = true; saveGame(g) }
  } else if (g.viejoDogState === "ultra_hint") {
    // Cuando la jugadora está completa (vida, munición, pelotas) → pasar al ready-check
    const _isFullForBoss = g.pl.hp >= g.pl.maxHp && g.pl.ammo >= 15
      && (!g.abilities.has("tball") || g.tballAmmo > 0)
    if (_isFullForBoss) { g.viejoDogState = "ultra_ready"; saveGame(g) }
    else if (g.cw.has(0)) { g.viejoDogState = "ultra_done"; saveGame(g) }
  } else if (g.viejoDogState === "ultra_ready" && g.cw.has(0)) {
    g.viejoDogState = "ultra_done"; saveGame(g)
  } else if (g.viejoDogState === "ultra_done") {
    if (!g.rexUltraDoneSeen) { g.rexUltraDoneSeen = true; saveGame(g) }
  } else if ((g.viejoDogState === "ball_guide" || g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full" || g.viejoDogState === "p2_warning") && g.rexBatonHeld && !g.tballUpgraded) {
    // Jugadora trae el bastón → mejora la pelota
    g.rexBatonHeld = false
    g.tballUpgraded = true
    g.tballAmmo = Math.min(TB_AMMO_MAX, g.tballAmmo + 2)  // sube a 5 si tenía 3
    g.viejoDogState = "baton_delivered"
    spawnExplosion(g, VIEJO_DOG_POS.x, VIEJO_DOG_POS.y - 30, ["#8B4513", "#D2691E", "#FFD700", "#CCFF00", "#FFFFFF"], 30, 5, true)
    triggerShake(g, 7, 0.4)
    g.abilityNotif = { text: "¡PELOTA MEJORADA! +2 balas • +4 rebotes  🎾", timer: 6.0 }
    saveGame(g)
  } else if (g.viejoDogState === "key_held" && g.tballKeyHeld && g.rexMitadAnimStart === 0) {
    // Llave entregada: consumir y arrancar animación del sprite rex_mitad_llave
    // Fase 1 (render): frames 0→20 a 100ms/frame, luego congelado en 20 durante el diálogo
    // Fase 3 (render): render.ts setea rexKeyAnimTimer=0.5 al terminar el diálogo → frames 20→24 → explosión
    g.tballKeyHeld = false
    g.rexMitadAnimStart = Date.now()
    saveGame(g)
  }
}

