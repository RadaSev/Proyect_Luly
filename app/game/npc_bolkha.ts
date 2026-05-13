// ══════════════════════════════════════════════════════════════
//  NPC BOLKHA — game/npc_bolkha.ts
//  Mercader: tickBolkha, bolkhaDoInteract
// ══════════════════════════════════════════════════════════════
import type { G } from "./types"
import {
  STEP, PW, PH, NC, NW,
  BOLKHA_POS, BOLKHA_W, BOLKHA_H, BOLKHA_TALK_R, BOLKHA_CALLOUT_R, BOLKHA_DISCOVER_R, BOLKHA_APPEAR_DUR,
  BOLKHA_PRICE_HEART, BOLKHA_PRICE_BONES, BOLKHA_PRICE_TBALL,
  TB_AMMO_INIT, TB_AMMO_MAX
} from "./constants"
import { isPart1BossDead } from "./physics"
import { spawnExplosion } from "./utils"
import { saveGame } from "./save"

export function tickBolkha(g: G) {
  const p = g.pl
  // Solo aparece tras matar al P1 boss de W0 Y que Rex haya mencionado a Bolkha
  if (!isPart1BossDead(g, 0) || !g.bolkhaRexTold) return

  // Distancia al jugador (necesaria también para el gate de descubrimiento)
  const _bdx = p.x + BOLKHA_W / 2 - BOLKHA_POS.x
  const _bdy = p.y + BOLKHA_H / 2 - BOLKHA_POS.y
  const _bdist = Math.sqrt(_bdx * _bdx + _bdy * _bdy)

  if (g.bolkhaState === "hidden") {
    // Solo aparece cuando el jugador camina hasta su posición (descubrimiento por proximidad)
    if (_bdist > BOLKHA_DISCOVER_R) return
    // El jugador llegó hasta Bolkha → iniciar animación de aparición
    g.bolkhaState = "appearing"
    g.bolkhaGivingTimer = BOLKHA_APPEAR_DUR
    if (!g.bolkhaAppearedOnce) {
      spawnExplosion(g, BOLKHA_POS.x, BOLKHA_POS.y, ["#88DDFF","#00FFCC","#FFFFFF","#AAFFEE"], 22, 5, true)
    }
    return
  }

  if (g.bolkhaState === "appearing") {
    g.bolkhaGivingTimer -= 1 / 60
    if (g.bolkhaGivingTimer <= 0) {
      g.bolkhaState = "idle"
      g.bolkhaAppearedOnce = true
      g.bolkhaGivingTimer = 0
    }
    return
  }

  // Talk timer + afford-error timer
  if (g.bolkhaTalkTimer > 0) g.bolkhaTalkTimer = Math.max(0, g.bolkhaTalkTimer - STEP)
  if (g.bolkhaAffordTimer > 0) g.bolkhaAffordTimer = Math.max(0, g.bolkhaAffordTimer - STEP)

  // ── Animación de entrega (reemplaza ciclo continuo durante "giving") ────────
  if (g.bolkhaState === "giving") {
    const item = g.bolkhaGivingItem

    if (g.bolkhaGivingPhase === 0) {
      // Avanzar frames a 10 fps hasta el punto de congelación
      g.bolkhaEft += STEP
      if (g.bolkhaEft >= 0.10) {
        g.bolkhaEft = 0
        g.bolkhaEf++
        const freezeAt = item === "tball" ? 17 : 24
        if (g.bolkhaEf >= freezeAt) {
          g.bolkhaEf = freezeAt
          g.bolkhaGivingPhase = 1
          // tball: 3 s de freeze; corazones/huesos: 0.4 s antes de la explosión
          g.bolkhaGivingTimer = item === "tball" ? 1.0 : 0.4
        }
      }
    } else if (g.bolkhaGivingPhase === 1) {
      // Freeze: esperar el timer
      g.bolkhaGivingTimer = Math.max(0, g.bolkhaGivingTimer - STEP)
      if (g.bolkhaGivingTimer <= 0) {
        if (item === "tball") {
          // Pasar a fase 2: últimos 7 frames (18→24)
          g.bolkhaGivingPhase = 2
          g.bolkhaEft = 0
        } else {
          // Corazones / huesos: explotar y cerrar entrega
          spawnExplosion(g, BOLKHA_POS.x, BOLKHA_POS.y - 20,
            ["#AAFFEE", "#88DDFF", "#FFD700", "#FFFFFF", "#AAFFAA"], 10, 3.0, false)
          g.bolkhaGivingItem = null
          g.bolkhaGivingPhase = 0
          g.bolkhaState = "shop"
          g.bolkhaShopOpen = true
        }
      }
    } else {
      // Fase 2 (tball): avanzar frames 18→24 y explotar al llegar a 24
      g.bolkhaEft += STEP
      if (g.bolkhaEft >= 0.10) {
        g.bolkhaEft = 0
        g.bolkhaEf++
        if (g.bolkhaEf >= 24) {
          g.bolkhaEf = 24
          spawnExplosion(g, BOLKHA_POS.x, BOLKHA_POS.y - 20,
            ["#CCFF00", "#88FF44", "#FFD700", "#FFFFFF", "#AAFFEE"], 14, 3.5, false)
          g.bolkhaGivingItem = null
          g.bolkhaGivingPhase = 0
          g.bolkhaState = "shop"
          g.bolkhaShopOpen = true
        }
      }
    }
    return
  }

  // Animación continua (10 fps) — solo fuera del estado "giving"
  g.bolkhaEft += STEP
  if (g.bolkhaEft >= 0.10) {
    g.bolkhaEft = 0
    g.bolkhaEf = (g.bolkhaEf + 1) % 25
  }

  // Reusar la distancia calculada al inicio de la función
  const dist = _bdist
  // Bolkha siempre mira hacia el jugador
  g.bolkhaFacing = _bdx >= 0 ? 1 : -1

  if (g.bolkhaShopOpen) {
    g.bolkhaState = "talking"
    return
  }

  // ── Saludo de bienvenida al entrar en rango ──────────────────────────────
  if (dist < BOLKHA_TALK_R) {
    g.bolkhaState = "talking"
    if (!g.bolkhaGreetedThisVisit) {
      g.bolkhaGreetedThisVisit = true
      const needsSomething =
        g.pl.hp < g.pl.maxHp ||
        g.pl.ammo < 15 ||
        (g.abilities.has("tball") && g.tballAmmo === 0)
      if (needsSomething) {
        g.bolkhaTalkText = "Ahora sí te puedo vender.\nEntra y compra,\n¡págame con tus puntos!"
        g.bolkhaTalkTimer = 4.5
      } else {
        g.bolkhaTalkText = "Luly, no puedo venderte nada,\ntienes de todo… aunque\npuedes entrar a ver qué vendo."
        g.bolkhaTalkTimer = 4.5
      }
    }
  } else {
    if (g.bolkhaState === "talking") g.bolkhaState = "idle"
    // Resetear saludo al alejarse del rango de callout
    if (dist >= BOLKHA_CALLOUT_R) g.bolkhaGreetedThisVisit = false
  }
}

/** Lógica unificada de interacción con Bolkha (abrir tienda / comprar).
 *  Llamada desde keydown "E", botón A móvil y botón A gamepad. */
export function bolkhaDoInteract(g: G) {
  if (g.bolkhaState === "talking" && !g.bolkhaShopOpen) {
    g.bolkhaShopOpen = true; g.paused = false
    return
  }
  if (!g.bolkhaShopOpen) return
  const cur2 = Math.max(0, Math.min(g.bolkhaShopCursor, 2))
  const bItems = [
    { price: BOLKHA_PRICE_HEART, canBuy: g.pl.hp < g.pl.maxHp,
      buy: () => { g.pl.hp = Math.min(g.pl.maxHp, g.pl.hp + 2) },
      givingItem: "hearts" as const,
      talkText: "Estos… los extraigo de\nlos caídos. Enemigos\ny amigos. Son muy\nimportantes. Pero\nveo que los necesitas." },
    { price: BOLKHA_PRICE_BONES, canBuy: g.pl.ammo < 15,
      buy: () => { g.pl.ammo = Math.min(15, g.pl.ammo + 10) },
      givingItem: "bones" as const,
      talkText: "Estos son especiales.\nLos consigo en lugares\nque no nombraré.\nNo son tan baratos." },
    { price: BOLKHA_PRICE_TBALL,
      canBuy: g.abilities.has("tball") && g.tballAmmo === 0,
      buy: () => { g.tballAmmo = Math.min(g.tballUpgraded ? TB_AMMO_MAX : TB_AMMO_INIT, g.tballAmmo + 3) },
      givingItem: "tball" as const,
      talkText: "Estas son muy buenas.\nLas extraigo de las\ntiendas de los altos.\nNo puedo revelar quiénes." },
  ]
  const sel = bItems[cur2]
  if (sel && sel.canBuy) {
    if (g.score >= sel.price) {
      g.score -= sel.price
      sel.buy()
      g.bolkhaGivingItem = sel.givingItem
      g.bolkhaGivingPhase = 0
      g.bolkhaGivingTimer = 0
      g.bolkhaEf = 0
      g.bolkhaEft = 0
      g.bolkhaState = "giving"
      g.bolkhaShopOpen = false
      g.bolkhaTalkText = sel.talkText
      g.bolkhaTalkTimer = 4.0
    } else {
      // No alcanza: feedback de error
      g.bolkhaAffordTimer = 1.5
      g.bolkhaTalkText = `¡No tienes suficientes\npuntos! Necesitas ${sel.price},\ntú tienes ${g.score}.`
      g.bolkhaTalkTimer = 3.0
    }
  }
}

