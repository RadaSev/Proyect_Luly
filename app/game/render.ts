// ══════════════════════════════════════════════════════════════
//  RENDERIZADO — game/render.ts
//  Todas las funciones de dibujo: drawBg, drawWalls, drawCheckpoints,
//  drawPlayer, drawEnemies, drawHUD, draw, etc.
// ══════════════════════════════════════════════════════════════
import type { G, Enemy, SprBank, CPDef, GpadType } from "./types"
import {
  CW, CH, RW, RH, NW, NC, NR, WT, DW, DH, PW, PH, PH_CROUCH,
  TROW, BW, BH, EW, EH, W1P1_BW, W1P1_BH, W1P2_BW, W1P2_BH,
  UB_W, UB_H, UB_PLAT_W, UB_PLAT_OX, UB_PLAT_BOT_FR, UB_PLAT_TOP_FR,
  THEMES, WORLD_NAMES, WORLD_SUBS,
  WORLD_P1_BOSS, WORLD_P2_BOSS, TRANSIT_BOSS_COL,
  CP_RADIUS,
  TBALL_WALL, TBALL_SECRET_C, TBALL_SECRET_R,
  VIEJO_DOG_POS, VIEJO_DOG_TALK_R, VIEJO_DOG_CALLOUT_R, VIEJO_DOG_C, VIEJO_DOG_R,
  BOLKHA_POS, BOLKHA_W, BOLKHA_H, BOLKHA_RENDER_W, BOLKHA_RENDER_H,
  BOLKHA_FEET_OFF, BOLKHA_TALK_R, BOLKHA_CALLOUT_R,
  BOLKHA_APPEAR_DUR, BOLKHA_PRICE_HEART, BOLKHA_PRICE_BONES, BOLKHA_PRICE_TBALL,
  KENNEL_ROOMS, TB_AMMO_INIT, TB_AMMO_MAX, TB_AMMO_DROP, TB_R, TB_MAX_BOUNCES,
  ARENA_PLAT_W, ARENA_PLAT_H,
  MOUND_W, MOUND_H,
  CHAIN_REACH, STAIR_H,
  BG_IMGS,
  REX_TYPING_MS,
  GPAD_BTN, XB_COL, PS_COL,
  ro, rid,
} from "./constants"
import { isBossRoom, computeDoors, ALL_CPS, getWorldPlats, getEnemySpawns } from "./world_gen"
import { activePlats, areRegularP1EnemiesDead, areRegularP2EnemiesDead, isPart1BossDead, isPart2BossDead, isSpawnDead, isW1P1Boss, isW1P2Boss, isUltraBoss, enemySection, getBossSection } from "./physics"
import { activateWorld } from "./init"
import { isBossCPUnlocked } from "./checkpoints"
import {
  _rexNameAlpha, _rexDlgKey, _rexDlgMs, _rexDlgPage,
  _rexPageWaiting, _rexTypingActive, _rexWasInRange, _rexReadPages,
  setRexNameAlpha, setRexDlgKey, setRexDlgMs, setRexDlgPage,
  setRexPageWaiting, setRexTypingActive, setRexYesNoActive, setRexWasInRange,
} from "./npc_rex"
import { spawnExplosion, triggerShake, countP1KillsW0 } from "./utils"
import { saveGame } from "./save"

// Cooldown entre avances de página de Rex — evita doble-salto por tap rápido o lag de frame
let _rexLastAdvanceMs = 0

// ══════════════════════════════════════════════════════════════
//  RENDERIZADO
// ══════════════════════════════════════════════════════════════
export function getWorldAtX(cx: number) { return Math.max(0, Math.min(Math.floor((cx + CW / 2) / (NC * RW)), NW - 1)) }

// Ilumina SOLO el área de la sala del jefe en pantalla — sin tinte de color,
// sólo quita el negro aumentando el brillo del rectángulo de esa sala.
export function _drawBossAmbient(ctx: CanvasRenderingContext2D, g: G) {
  const bCurW = Math.max(0, Math.min(Math.floor(g.pl.x / (NC * RW)), NW - 1))
  const bCurC = Math.max(0, Math.min(Math.floor((g.pl.x % (NC * RW)) / RW), NC - 1))
  const bCurR = Math.max(0, Math.min(Math.floor(g.pl.y / RH), NR - 1))
  if (!isBossRoom(bCurW, bCurC, bCurR)) return
  // Rectángulo de la sala en coordenadas de pantalla
  const { x: rx, y: ry } = ro(bCurW, bCurC, bCurR)
  const srx = Math.floor(rx - g.cx), sry = Math.floor(ry - g.cy)
  // Capa de aclarado neutral (blanco semitransparente) SOLO sobre esa sala
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.0012)
  ctx.fillStyle = `rgba(255,255,255,${(0.10 + 0.04 * pulse).toFixed(3)})`
  ctx.fillRect(srx, sry, RW, RH)
}

export function drawBg(ctx: CanvasRenderingContext2D, g: G) {
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
    _drawBossAmbient(ctx, g)
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
  _drawBossAmbient(ctx, g)

  if (g.gfx >= 2) {
    ctx.strokeStyle = "rgba(0,0,0,0.05)"; ctx.lineWidth = 1
    for (let y = 0; y < CH; y += 3) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
    }
  }
}

// ── Tile sólido: textura por mundo ──────────────────────────────────────────
export function drawSolidTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, wi: number, hash: number, gfx: number, wx: number, wy: number, zone: "p1" | "trow" | "p2" = "p1") {
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
  // ── Tinte de zona (modifica el color percibido de la roca según la sección del mundo) ──
  if (zone === "trow") {
    // Fila de transición: roca más fría/azulada (corredor neutral)
    ctx.fillStyle = "rgba(30,60,100,0.22)"; ctx.fillRect(sx, sy, w, h)
  } else if (zone === "p2") {
    // Parte 2: roca más oscura y rojiza (zona peligrosa)
    ctx.fillStyle = "rgba(80,5,5,0.38)"; ctx.fillRect(sx, sy, w, h)
    // Sutil vena roja en el tope
    ctx.fillStyle = "rgba(160,20,0,0.18)"; ctx.fillRect(sx, sy, w, 2)
  }
  ctx.restore()
}

// ── Plataforma atravesable: estilo por mundo ─────────────────────────────────
export function drawTraversableTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, wi: number, gfx: number, zone: "p1" | "trow" | "p2" = "p1") {
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
  // Tinte de zona sobre plataforma atravesable
  if (zone === "trow") {
    ctx.fillStyle = "rgba(30,60,100,0.22)"; ctx.fillRect(sx, sy, w, h)
  } else if (zone === "p2") {
    ctx.fillStyle = "rgba(80,5,5,0.38)"; ctx.fillRect(sx, sy, w, h)
  }
}

// ── Pickup: MEDIA llave (dibujado antes de paredes) ─────────────────────────
// Es solo la mitad derecha de una llave: varilla + dientes sin el arco/mango.
// Rex tiene la otra mitad (el mango/arco) — juntas abren la jaula.
export function drawPickups(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const { cx, cy } = g, t = Date.now() * 0.001
  for (const pk of g.pickups) {
    if (!pk.active) continue
    const floatY0 = Math.sin(pk.floatPhase) * 6
    const sx0 = pk.x - cx, sy0 = pk.y - cy + floatY0
    if (pk.kind === "baton") {
      if (sx0 < -80 || sx0 > CW + 80 || sy0 < -80 || sy0 > CH + 80) continue
      ctx.save()
      // Halo marrón
      const haloB = ctx.createRadialGradient(sx0, sy0, 2, sx0, sy0, 28)
      haloB.addColorStop(0, "rgba(180,100,30,0.55)"); haloB.addColorStop(1, "rgba(120,60,10,0)")
      ctx.fillStyle = haloB; ctx.beginPath(); ctx.arc(sx0, sy0, 28, 0, Math.PI * 2); ctx.fill()
      // Bastón diagonal (↗ → ↙)
      ctx.save()
      ctx.translate(sx0, sy0); ctx.rotate(-0.45)
      ctx.strokeStyle = "#8B4513"; ctx.lineWidth = 5; ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(10, -10); ctx.stroke()
      // Mango curvo (parte superior)
      ctx.strokeStyle = "#A0522D"; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(10, -10); ctx.bezierCurveTo(14, -14, 18, -12, 16, -7); ctx.stroke()
      // Brillo
      ctx.strokeStyle = "#D2A060"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(8, -8); ctx.stroke()
      ctx.restore()
      // Etiqueta
      const pulseB = 0.65 + 0.35 * Math.sin(t * 4)
      ctx.globalAlpha = pulseB
      ctx.fillStyle = "#D2691E"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText("BASTÓN", sx0, sy0 - 22)
      ctx.fillStyle = "#C8A060"; ctx.font = "7px 'Courier New',monospace"
      ctx.fillText("lleva a Rex", sx0, sy0 - 12)
      ctx.textAlign = "left"; ctx.restore()
      continue
    }
    if (pk.kind !== "tball_key") continue
    const floatY = Math.sin(pk.floatPhase) * 6
    const sx = pk.x - cx, sy = pk.y - cy + floatY
    if (sx < -80 || sx > CW + 80 || sy < -80 || sy > CH + 80) continue
    ctx.save()

    // Halo dorado
    const haloK = ctx.createRadialGradient(sx, sy, 2, sx, sy, 30)
    haloK.addColorStop(0, "rgba(255,220,0,0.65)"); haloK.addColorStop(1, "rgba(255,140,0,0)")
    ctx.fillStyle = haloK; ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill()

    // ── MEDIA LLAVE: sprite único 768×768, contenido recortado 315×567 ──────────
    // Recortamos directamente al contenido (padL=284, padT=116) para evitar
    // escalar el espacio vacío. Mostramos a 38×50px centrado en (sx,sy).
    const keySpr = sprs["mitad_key"]
    const _kW = 20, _kH = 30
    const _kDx = sx - Math.round(_kW / 2)
    const _kDy = sy - Math.round(_kH / 2)
    if (keySpr && keySpr.complete && keySpr.naturalWidth > 0) {
      ctx.drawImage(keySpr, 284, 116, 315, 567, _kDx, _kDy, _kW, _kH)
    } else {
      // Fallback geométrico si el sprite no cargó
      ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 3.5; ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(sx - 10, sy); ctx.lineTo(sx + 12, sy); ctx.stroke()
    }

    // Etiqueta pulsante
    const pulseK = 0.65 + 0.35 * Math.sin(t * 4)
    ctx.globalAlpha = pulseK
    ctx.fillStyle = "#FFE066"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText("½ LLAVE", sx, sy - 32)
    ctx.fillStyle = "#FFA050"; ctx.font = "7px 'Courier New',monospace"
    ctx.fillText("lleva a Rex", sx, sy - 22)
    ctx.textAlign = "left"
    ctx.restore()
  }
}

// ── Jaula + pelota — sprite Cell_Close / Cell_Open + pelota flotante ─────────
// Truco de profundidad: cerrada → pelota DETRÁS del sprite (las barras tapan la pelota).
//                       abierta → pelota DELANTE del sprite (flota libremente).
export function drawCage(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const tbPickup = g.pickups.find(p => p.id === "tball_w0")
  if (!tbPickup?.active) return

  const { cx, cy } = g, t = Date.now() * 0.001
  const cageOpen = g.viejoDogState === "cage_opened"

  const cw2 = TBALL_WALL.w, ch2 = TBALL_WALL.h
  const sx = TBALL_WALL.x - cx
  const sy = TBALL_WALL.y - cy

  if (sx + cw2 < -100 || sx > CW + 100 || sy + ch2 < -100 || sy > CH + 100) return

  const cx2 = sx + cw2 / 2   // centro X del sprite en pantalla

  // La pelota flota en el tercio superior del interior del sprite
  // (el interior de la celda ocupa aprox. 5%–82% vertical del sprite)
  const ballRadius = 14
  const ballCenterY = sy + ch2 * 0.38   // 38% desde arriba = mitad superior del interior
  const floatAmp = cageOpen ? 7 : 5
  const ballY = ballCenterY + Math.sin(tbPickup.floatPhase) * floatAmp

  ctx.save()

  // ── Helper: dibuja la pelota de tenis ───────────────────────────────────
  const drawBall = (alpha = 1) => {
    ctx.globalAlpha = alpha
    // Halo verde-amarillo
    const haloR = cageOpen ? 34 : 22
    const haloA = cageOpen ? 0.55 : 0.40
    const halo = ctx.createRadialGradient(cx2, ballY, 2, cx2, ballY, haloR)
    halo.addColorStop(0, `rgba(190,255,60,${haloA})`); halo.addColorStop(1, "rgba(100,220,0,0)")
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx2, ballY, haloR, 0, Math.PI * 2); ctx.fill()
    // Cuerpo de la pelota
    const bg = ctx.createRadialGradient(cx2 - 4, ballY - 4, 1, cx2, ballY, ballRadius)
    bg.addColorStop(0, "#EEFF66"); bg.addColorStop(0.55, "#88CC00"); bg.addColorStop(1, "#3A5800")
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx2, ballY, ballRadius, 0, Math.PI * 2); ctx.fill()
    // Líneas de tenis (rotando suavemente)
    const rot = t * (cageOpen ? 1.8 : 0.7)
    ctx.save(); ctx.translate(cx2, ballY); ctx.rotate(rot)
    ctx.strokeStyle = "rgba(200,240,0,0.75)"; ctx.lineWidth = 1.8; ctx.lineCap = "round"
    ctx.beginPath(); ctx.arc(0, 0, ballRadius, -0.7, 0.7); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, ballRadius, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // ── Helper: dibuja el sprite (con fallback de sombra) ───────────────────
  const drawSprite = (key: string) => {
    const spr = sprs[key]
    if (spr?.complete && spr.naturalWidth) {
      ctx.drawImage(spr, sx, sy, cw2, ch2)
    }
  }

  if (cageOpen) {
    // ABIERTA: sprite primero, pelota encima (flota libremente)
    drawSprite("cell_open")
    drawBall()

    // Etiqueta animada
    const lp = 0.8 + 0.2 * Math.sin(t * 3.5)
    ctx.globalAlpha = lp
    ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillStyle = "#CCFF88"; ctx.fillText("¡RECÓGELA!", cx2, sy - 12)
    ctx.font = "7px 'Courier New',monospace"
    ctx.fillStyle = "#88FF88"; ctx.fillText("¡celda abierta!", cx2, sy - 2)
    ctx.globalAlpha = 1

  } else {
    // CERRADA: pelota primero (detrás), sprite encima → barras tapan la pelota
    drawBall()
    drawSprite("cell_close")

    // Glow de estado encima del sprite (tinte sutil de color)
    const questActive = g.viejoDogState === "quest_active" || g.viejoDogState === "key_dropped"
    const keyHeld     = g.viejoDogState === "key_held"
    const waitState   = g.viejoDogState === "waiting"
    if (keyHeld) {
      const glow = 0.15 + 0.08 * Math.sin(t * 5)
      ctx.fillStyle   = `rgba(255,210,0,${glow})`
      ctx.fillRect(sx, sy, cw2, ch2)
      ctx.strokeStyle = `rgba(255,230,0,${glow * 2})`; ctx.lineWidth = 2
      ctx.strokeRect(sx + 1, sy + 1, cw2 - 2, ch2 - 2)
    } else if (questActive) {
      const glow = 0.05 + 0.03 * Math.sin(t * 2.2)
      ctx.fillStyle = `rgba(255,110,0,${glow})`; ctx.fillRect(sx, sy, cw2, ch2)
    } else if (!waitState) {
      const glow = 0.04 + 0.02 * Math.sin(t * 1.6)
      ctx.fillStyle = `rgba(0,255,100,${glow})`; ctx.fillRect(sx, sy, cw2, ch2)
    }

    // Sombra proyectada hacia abajo
    ctx.fillStyle = "rgba(0,0,0,0.28)"
    ctx.beginPath(); ctx.ellipse(cx2, sy + ch2 + 5, cw2 * 0.42, 5, 0, 0, Math.PI * 2); ctx.fill()

    // Etiqueta flotante encima
    const lp = 0.45 + 0.15 * Math.sin(t * 1.8)
    ctx.globalAlpha = lp
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"
    ctx.fillStyle = "#AACCAA"; ctx.fillText("🎾", cx2, sy - 5)
    ctx.globalAlpha = 1
  }

  ctx.textAlign = "left"
  ctx.restore()
}

// ── Pelotas rebotantes en vuelo ───────────────────────────────────────────────
export function drawTBalls(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const { cx, cy } = g
  const tbSpr = sprs["tennis_ball"]
  for (const b of g.tBalls) {
    if (!b.active) continue
    const sx = b.x - cx, sy = b.y - cy
    if (sx < -20 || sx > CW + 20 || sy < -20 || sy > CH + 20) continue
    const d = TB_R * 2
    // Estela semi-transparente
    ctx.save()
    ctx.globalAlpha = 0.30 * (b.bounces / TB_MAX_BOUNCES)
    if (tbSpr && tbSpr.complete) {
      ctx.drawImage(tbSpr, sx - b.vx * 2 - TB_R - 1, sy - b.vy * 2 - TB_R - 1, d + 2, d + 2)
    } else {
      ctx.fillStyle = "rgba(180,255,60,1)"
      ctx.beginPath(); ctx.arc(sx - b.vx * 2, sy - b.vy * 2, TB_R + 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    // Pelota — sprite o fallback
    if (tbSpr && tbSpr.complete) {
      ctx.drawImage(tbSpr, sx - TB_R, sy - TB_R, d, d)
    } else {
      const bGrad = ctx.createRadialGradient(sx - 2, sy - 2, 1, sx, sy, TB_R)
      bGrad.addColorStop(0, "#EEFF66"); bGrad.addColorStop(0.6, "#88CC00"); bGrad.addColorStop(1, "#336600")
      ctx.fillStyle = bGrad; ctx.beginPath(); ctx.arc(sx, sy, TB_R, 0, Math.PI * 2); ctx.fill()
    }
    // Contador de rebotes restantes
    if (g.gfx >= 1 && b.bounces < TB_MAX_BOUNCES) {
      ctx.fillStyle = b.bounces <= 1 ? "#FF4444" : "#AAFFAA"
      ctx.font = "bold 7px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText(`${b.bounces}`, sx, sy - TB_R - 2); ctx.textAlign = "left"
    }
  }
}

export function drawBolkha(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  if (g.bolkhaState === "hidden") return
  const CW = ctx.canvas.width, CH = ctx.canvas.height

  // ── Aparición: sprite animado de teletransporte (25 frames, grid 5×5) ────────
  if (g.bolkhaState === "appearing") {
    const prog = 1 - g.bolkhaGivingTimer / BOLKHA_APPEAR_DUR  // 0→1
    const tpSpr = sprs["bolkha_teleport"]
    const bx = Math.round(BOLKHA_POS.x - g.cx)
    const by = Math.round(BOLKHA_POS.y - g.cy)
    if (tpSpr && tpSpr.complete && tpSpr.naturalWidth > 0) {
      // frame 396×484, contenido 221×383, padTop=50, padBottom=51, padL=87, padR=88
      // target content height 120px → scale=0.3133 → rw=124 rh=152 rxOff=-38 ryOff=-72
      const fw = tpSpr.naturalWidth  / 5
      const fh = tpSpr.naturalHeight / 5
      const frame  = Math.min(24, Math.floor(prog * 25))
      const col    = frame % 5, row2 = Math.floor(frame / 5)
      const rw = 124, rh = 152, rxOff = -38, ryOff = -72
      ctx.save()
      ctx.globalAlpha = Math.min(1, 0.3 + prog * 0.7)   // fade-in suave
      ctx.drawImage(tpSpr, col * fw, row2 * fh, fw, fh, bx + rxOff, by + ryOff, rw, rh)
      ctx.restore()
    } else {
      // Fallback geométrico si el sprite no cargó
      ctx.save()
      ctx.globalAlpha = 0.5 + prog * 0.5
      ctx.fillStyle = "#00FFCC"
      ctx.fillRect(bx - 8, by - 8, BOLKHA_W + 16, BOLKHA_H + 16)
      ctx.restore()
    }
    return
  }

  const dir = g.bolkhaFacing >= 0 ? "right" : "left"
  const opp = dir === "right" ? "left" : "right"
  const ok  = (k: string) => { const s = sprs[k]; return s?.complete && s.naturalWidth > 0 ? s : null }

  // Seleccionar sprite
  let sprKey: string
  if (g.bolkhaState === "giving" && g.bolkhaGivingItem) {
    sprKey = `bolkha_giving_${g.bolkhaGivingItem}_${dir}`
  } else if (g.bolkhaState === "talking" || g.bolkhaState === "shop") {
    sprKey = `bolkha_talk_${dir}`
  } else {
    sprKey = `bolkha_idle_${dir}`
  }
  const spr = ok(sprKey) ?? ok(sprKey.replace(`_${dir}`, `_${opp}`))

  // Renderizar sprite (5×5, 25 frames)
  const sx = Math.round(BOLKHA_POS.x - g.cx)
  const sy = Math.round(BOLKHA_POS.y - g.cy)
  // floorY = sy + BOLKHA_H; drawY anchors feet (BOLKHA_FEET_OFF from render top) to floor
  const floorY = sy + BOLKHA_H
  const drawX = sx + Math.round((BOLKHA_W - BOLKHA_RENDER_W) / 2)
  const drawY = floorY - BOLKHA_FEET_OFF

  if (spr) {
    const fw = spr.naturalWidth / 5, fh = spr.naturalHeight / 5
    const col = g.bolkhaEf % 5, row2 = Math.floor(g.bolkhaEf / 5)
    ctx.drawImage(spr, col * fw, row2 * fh, fw, fh, drawX, drawY, BOLKHA_RENDER_W, BOLKHA_RENDER_H)
  } else {
    // Fallback: rectángulo azul
    ctx.fillStyle = "#00AACC"
    ctx.fillRect(sx, sy, BOLKHA_W, BOLKHA_H)
  }

  // ── Sombra (al nivel del piso) ───────────────────────────────────────────────
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.fillStyle = "#000"
  ctx.beginPath()
  ctx.ellipse(sx + BOLKHA_W / 2, floorY, BOLKHA_W * 0.42, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── Nombre/callout (solo si el shop no está abierto) ────────────────────────
  const dx2 = g.pl.x + 20 - BOLKHA_POS.x
  const dy2 = g.pl.y + 36 - BOLKHA_POS.y
  const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2)

  // sprTopY = drawY (top of rendered sprite)
  const sprTopY = drawY

  if (!g.bolkhaShopOpen && g.bolkhaState !== "giving") {
    if (dist < BOLKHA_CALLOUT_R) {
      const bx2 = sx + BOLKHA_W / 2
      const bubY = sprTopY - 12
      ctx.save()
      const alpha = Math.min(1, (BOLKHA_CALLOUT_R - dist) / 60)
      ctx.globalAlpha = alpha
      ctx.font = "bold 11px 'Courier New',monospace"
      ctx.textAlign = "center"

      if (dist < BOLKHA_TALK_R) {
        // Instrucción de interacción
        const isKB = !g.isMobile && g.gpadType === "keyboard"
        const openKey = isKB ? "[E]" : "[B]"
        const txt = g.bolkhaState === "talking" ? `${openKey} Ver tienda` : "BOLKHA"
        const tw2 = ctx.measureText(txt).width + 16
        ctx.fillStyle = "rgba(0,20,30,0.88)"
        ctx.beginPath(); ctx.roundRect(bx2 - tw2 / 2, bubY - 18, tw2, 22, 5); ctx.fill()
        ctx.strokeStyle = "#00DDCC44"; ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(bx2 - tw2 / 2, bubY - 18, tw2, 22, 5); ctx.stroke()
        ctx.fillStyle = "#88FFEE"; ctx.fillText(txt, bx2, bubY - 2)
      } else {
        // Nombre flotante
        ctx.fillStyle = "#88DDFF"; ctx.fillText("Bolkha", bx2, bubY)
      }
      ctx.restore()
    }
  }

  // ── Burbuja de diálogo (saludo / post-compra / afford-error) ────────────────
  // Solo se muestra cuando la tienda NO está abierta (dentro de la tienda usa el globo desc)
  if (g.bolkhaTalkTimer > 0 && g.bolkhaTalkText && !g.bolkhaShopOpen) {
    const bx2 = sx + BOLKHA_W / 2
    const bubY2 = sprTopY - 36
    ctx.save()
    ctx.globalAlpha = Math.min(1, g.bolkhaTalkTimer / 0.5)
    ctx.font = "9px 'Courier New',monospace"
    ctx.textAlign = "center"
    const lines2 = g.bolkhaTalkText.split("\n")
    const maxW2 = Math.max(...lines2.map(l => ctx.measureText(l).width)) + 20
    const bubH2 = lines2.length * 13 + 14
    ctx.fillStyle = "rgba(0,20,30,0.92)"
    ctx.beginPath(); ctx.roundRect(bx2 - maxW2 / 2, bubY2 - bubH2, maxW2, bubH2, 7); ctx.fill()
    ctx.strokeStyle = "#00DDCC"
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(bx2 - maxW2 / 2, bubY2 - bubH2, maxW2, bubH2, 7); ctx.stroke()
    ctx.fillStyle = "#CCFFEE"
    lines2.forEach((l, li) => ctx.fillText(l, bx2, bubY2 - bubH2 + 13 + li * 13))
    ctx.restore()
  }

  // ── Shop: panel flotante (sin oscurecer pantalla) ────────────────────────────
  if (g.bolkhaShopOpen) {
    drawBolkhaShop(ctx, g, sprs, sx, sprTopY)
  }
}

export function drawBolkhaShop(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank, bsx: number, bsprTopY: number) {
  const CW = ctx.canvas.width, CH = ctx.canvas.height
  const ok2  = (k: string) => { const s = sprs[k]; return s?.complete && s.naturalWidth > 0 ? s : null }

  // ── Items disponibles ─────────────────────────────────────────────────────
  type ShopItem = {
    id: string; label: string; subLabel: string
    price: number; sprKey: string
    canBuy: boolean; reason: string
    desc: string   // descripción de Bolkha (globo lateral)
  }
  const items: ShopItem[] = [
    {
      id: "heart",
      label: "Vida",
      subLabel: `+1 corazón  (${g.pl.hp / 2}/${g.pl.maxHp / 2})`,
      price: BOLKHA_PRICE_HEART,
      sprKey: "hud_heart",
      canBuy: g.pl.hp < g.pl.maxHp,
      reason: g.pl.hp >= g.pl.maxHp ? "VIDA LLENA" : "",
      desc: "Estos… los extraigo de\nlos caídos. Enemigos\ny amigos. Son muy\nimportantes.",
    },
    {
      id: "bones",
      label: "Munición (huesos)",
      subLabel: `+10 balas  (${g.pl.ammo}/15)`,
      price: BOLKHA_PRICE_BONES,
      sprKey: "hud_bone",
      canBuy: g.pl.ammo < 15,
      reason: g.pl.ammo >= 15 ? "MUNICIÓN LLENA" : "",
      desc: "Especiales. Los consigo\nen lugares que no\nnombraré. No son\ntan baratos.",
    },
    {
      id: "tball",
      label: "Pelotas de tenis",
      subLabel: g.abilities.has("tball")
        ? `+3 pelotas  (${g.tballAmmo}/${g.tballUpgraded ? TB_AMMO_MAX : TB_AMMO_INIT})`
        : "— BLOQUEADO —",
      price: BOLKHA_PRICE_TBALL,
      sprKey: "tennis_ball",
      canBuy: g.abilities.has("tball") && g.tballAmmo === 0,
      reason: !g.abilities.has("tball") ? "BLOQUEADO"
            : g.tballAmmo > 0           ? "YA TIENES"
            : "",
      desc: "Muy buenas. Las extraigo\nde tiendas de los altos.\nNo puedo revelar\nquiénes me las dan.",
    },
  ]

  // ── Panel flotante anclado sobre Bolkha (sin oscurecer la pantalla) ───────
  const PNW = 230, ITEM_H = 54, HEADER_H = 52, FOOTER_H = 28
  const PNH = HEADER_H + items.length * ITEM_H + FOOTER_H

  // Anclar: bottom del panel = 12px sobre el sprite top de Bolkha
  // Left del panel: centrado horizontalmente respecto al sprite
  const bCenterX = bsx + BOLKHA_W / 2
  let PNX = Math.round(bCenterX - PNW / 2)
  let PNY = Math.round(bsprTopY - PNH - 12)
  // Clamp dentro del canvas con margen de 6px
  PNX = Math.max(6, Math.min(CW - PNW - 6, PNX))
  PNY = Math.max(6, Math.min(CH - PNH - 6, PNY))

  // ── Triángulo apuntador al sprite ─────────────────────────────────────────
  const tipX = Math.round(bCenterX)
  const tipY = Math.round(bsprTopY - 4)
  const tailY = PNY + PNH
  if (tipY > tailY) {
    ctx.fillStyle = "rgba(4,16,22,0.97)"
    ctx.beginPath()
    ctx.moveTo(tipX - 6, tailY); ctx.lineTo(tipX + 6, tailY); ctx.lineTo(tipX, tipY)
    ctx.closePath(); ctx.fill()
  }

  // Panel background
  ctx.fillStyle = "rgba(4,16,22,0.97)"
  ctx.beginPath(); ctx.roundRect(PNX, PNY, PNW, PNH, 10); ctx.fill()
  ctx.strokeStyle = "#00BBAA"
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(PNX, PNY, PNW, PNH, 10); ctx.stroke()
  // Inner glow line
  ctx.strokeStyle = "#00DDCC22"
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(PNX + 3, PNY + 3, PNW - 6, PNH - 6, 8); ctx.stroke()

  // ── Header ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#007766"
  ctx.beginPath(); ctx.roundRect(PNX, PNY, PNW, HEADER_H, [10, 10, 0, 0]); ctx.fill()

  ctx.font = "bold 13px 'Courier New',monospace"
  ctx.textAlign = "center"
  ctx.fillStyle = "#EEFFEE"
  ctx.fillText("◈ BOLKHA ◈", PNX + PNW / 2, PNY + 17)
  ctx.font = "8px 'Courier New',monospace"
  ctx.fillStyle = "#AAFFEE"
  ctx.fillText("El Mercader Insecto", PNX + PNW / 2, PNY + 30)

  // Croquetas disponibles
  const croquetaSpr = ok2("hud_croqueta")
  const cqTxt = `${g.score} pts`
  ctx.font = "bold 10px 'Courier New',monospace"
  const cqW2 = ctx.measureText(cqTxt).width
  const cqX2 = PNX + PNW / 2 - (cqW2 + (croquetaSpr ? 17 : 0)) / 2
  if (croquetaSpr) ctx.drawImage(croquetaSpr, cqX2 - 1, PNY + 37, 13, 13)
  ctx.fillStyle = "#FFE066"
  ctx.textAlign = "left"
  ctx.fillText(cqTxt, cqX2 + (croquetaSpr ? 15 : 0), PNY + 48)

  // ── Items ─────────────────────────────────────────────────────────────────
  const cur = Math.max(0, Math.min(g.bolkhaShopCursor, items.length - 1))
  g.bolkhaShopCursor = cur
  const croquetaSpr2 = croquetaSpr
  const affordFlash = g.bolkhaAffordTimer > 0  // flash de error de fondos

  items.forEach((item, idx) => {
    const iy = PNY + HEADER_H + idx * ITEM_H
    const selected = idx === cur
    const canBuy  = item.canBuy && g.score >= item.price
    const isAffordError = selected && affordFlash

    // Divider
    if (idx > 0) {
      ctx.strokeStyle = "#00BBAA22"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PNX + 10, iy); ctx.lineTo(PNX + PNW - 10, iy); ctx.stroke()
    }

    // Row highlight / afford-error flash
    if (selected) {
      if (isAffordError) {
        const pulse = Math.sin(g.bolkhaAffordTimer * 18) * 0.5 + 0.5
        ctx.fillStyle = `rgba(200,60,30,${0.10 + pulse * 0.18})`
        ctx.fillRect(PNX + 2, iy + 1, PNW - 4, ITEM_H - 2)
        ctx.strokeStyle = `rgba(255,80,40,${0.5 + pulse * 0.5})`; ctx.lineWidth = 1.5
        ctx.strokeRect(PNX + 3, iy + 2, PNW - 6, ITEM_H - 4)
      } else {
        ctx.fillStyle = "rgba(0,180,160,0.15)"
        ctx.fillRect(PNX + 2, iy + 1, PNW - 4, ITEM_H - 2)
        ctx.strokeStyle = "#00DDCC88"; ctx.lineWidth = 1
        ctx.strokeRect(PNX + 3, iy + 2, PNW - 6, ITEM_H - 4)
      }
    }

    // Selector arrow
    if (selected) {
      ctx.fillStyle = isAffordError ? "#FF6644" : "#00DDCC"
      ctx.font = "bold 11px monospace"; ctx.textAlign = "left"
      ctx.fillText("▶", PNX + 5, iy + ITEM_H / 2 + 4)
    }

    // Item icon
    const iconSpr = ok2(item.sprKey)
    const iconX = PNX + 18, iconY = iy + Math.round((ITEM_H - 22) / 2)
    if (iconSpr) {
      ctx.save()
      if (!canBuy) ctx.globalAlpha = 0.35
      ctx.drawImage(iconSpr, iconX, iconY, 22, 22)
      ctx.restore()
    } else {
      ctx.fillStyle = canBuy ? "#00AACC" : "#334"; ctx.fillRect(iconX, iconY, 22, 22)
    }

    // Item label + sublabel
    ctx.textAlign = "left"
    ctx.font = `bold 10px 'Courier New',monospace`
    ctx.fillStyle = canBuy ? "#EEFFEE" : (!item.canBuy ? "#445" : "#887744")
    ctx.fillText(item.label, PNX + 46, iy + 19)
    ctx.font = "8px 'Courier New',monospace"
    ctx.fillStyle = canBuy ? "#88CCBB" : "#445566"
    ctx.fillText(item.subLabel, PNX + 46, iy + 31)

    // Price / reason
    if (item.reason) {
      ctx.font = "bold 8px 'Courier New',monospace"; ctx.fillStyle = "#336655"
      ctx.textAlign = "right"; ctx.fillText(item.reason, PNX + PNW - 8, iy + 26)
    } else {
      ctx.font = "bold 11px 'Courier New',monospace"; ctx.textAlign = "right"
      const priceColor = isAffordError ? "#FF6644"
                       : canBuy ? (selected ? "#FFE066" : "#CCAA33")
                       : "#664422"
      ctx.fillStyle = priceColor
      ctx.fillText(`${item.price}`, PNX + PNW - 8, iy + 33)
      if (croquetaSpr2) ctx.drawImage(croquetaSpr2, PNX + PNW - 8 - ctx.measureText(`${item.price}`).width - 15, iy + 20, 12, 12)
    }

    // "¡SIN FONDOS!" overlay cuando intenta comprar sin croquetas
    if (isAffordError) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, g.bolkhaAffordTimer / 0.3)
      ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillStyle = "#FF8855"
      ctx.fillText("¡SIN CROQUETAS!", PNX + PNW / 2, iy + ITEM_H / 2 + 3)
      ctx.restore()
    }
  })

  // ── Footer / instrucciones ─────────────────────────────────────────────────
  const footY = PNY + HEADER_H + items.length * ITEM_H + 2
  ctx.strokeStyle = "#00BBAA33"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PNX + 10, footY); ctx.lineTo(PNX + PNW - 10, footY); ctx.stroke()
  ctx.font = "7px 'Courier New',monospace"; ctx.fillStyle = "#447766"
  ctx.textAlign = "center"
  const _isKB2 = !g.isMobile && g.gpadType === "keyboard"
  const _buyKey = _isKB2 ? "E" : "A"
  const _closeKey = _isKB2 ? "X" : "B"
  ctx.fillText(`[↑↓] navegar  [${_buyKey}] comprar  [${_closeKey}] salir`, PNX + PNW / 2, footY + 14)

  // ── Burbuja de descripción del ítem seleccionado (sale de Bolkha) ──────────
  const selItem = items[cur]
  if (selItem?.desc) {
    const descLines = selItem.desc.split("\n")
    ctx.save()
    ctx.font = "9px 'Courier New',monospace"
    const descLW = Math.max(...descLines.map(l => ctx.measureText(l).width))
    const DBW = descLW + 22, DBH = descLines.length * 13 + 18
    // El globo va al lado desde donde el jugador se acercó:
    //   bolkhaFacing=1  → jugador viene de la derecha → globo va a la DERECHA del panel
    //   bolkhaFacing=-1 → jugador viene de la izquierda → globo va a la IZQUIERDA del panel
    // Con fallback si no hay espacio suficiente en el lado preferido.
    const preferRight = g.bolkhaFacing === 1
    let DBX: number, tailOnRight: boolean
    const rightX = PNX + PNW + 12
    const leftX  = PNX - DBW - 12
    if (preferRight) {
      if (rightX + DBW + 4 <= CW) { DBX = rightX; tailOnRight = false }
      else                         { DBX = leftX;  tailOnRight = true  }
    } else {
      if (leftX >= 4)              { DBX = leftX;  tailOnRight = true  }
      else                         { DBX = rightX; tailOnRight = false }
    }
    // Centrar verticalmente respecto al ítem seleccionado
    const selIY = PNY + HEADER_H + cur * ITEM_H
    let DBY = selIY + Math.round((ITEM_H - DBH) / 2)
    DBY = Math.max(6, Math.min(CH - DBH - 6, DBY))

    // Fondo del globo
    ctx.fillStyle = "rgba(2,18,24,0.97)"
    ctx.beginPath(); ctx.roundRect(DBX, DBY, DBW, DBH, 8); ctx.fill()
    ctx.strokeStyle = "#00BBAA"
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(DBX, DBY, DBW, DBH, 8); ctx.stroke()

    // Cola horizontal hacia el panel de la tienda
    const tailMidY = Math.round(DBY + DBH / 2)
    const tailTipX = tailOnRight ? DBX + DBW + 10 : DBX - 10
    const tailBaseX = tailOnRight ? DBX + DBW : DBX
    ctx.fillStyle = "rgba(2,18,24,0.97)"
    ctx.beginPath()
    ctx.moveTo(tailBaseX, tailMidY - 5)
    ctx.lineTo(tailBaseX, tailMidY + 5)
    ctx.lineTo(tailTipX, tailMidY)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = "#00BBAA"; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(tailBaseX, tailMidY - 5)
    ctx.lineTo(tailTipX, tailMidY)
    ctx.lineTo(tailBaseX, tailMidY + 5)
    ctx.stroke()

    // Texto de la descripción
    ctx.fillStyle = "#CCFFEE"
    ctx.textAlign = "left"
    descLines.forEach((l, li) => ctx.fillText(l, DBX + 10, DBY + 13 + li * 13))
    ctx.restore()
  }
}

// ── Perrito Viejo NPC — placeholder gráfico + sistema de misiones/diálogo ──────
// El NPC está diseñado para múltiples quests futuras.
// Por ahora solo tiene la quest "tball". El sistema de slots permite añadir más.
export function drawViejoDog(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const curW = Math.max(0, Math.min(Math.floor(g.pl.x / (NC * RW)), NW - 1))
  if (curW !== 0) { setRexTypingActive(false); setRexYesNoActive(false); setRexWasInRange(false); return }

  const { cx, cy } = g
  const nx = VIEJO_DOG_POS.x - cx
  const ny = VIEJO_DOG_POS.y - cy
  // Culling basado en la casa (HRX=bx-151, HRW=552, HRH=368, HRY=by-326)
  // Solo salir si la casa entera queda fuera de pantalla
  if (nx + 401 < 0 || nx - 151 > CW || ny + 42 < 0 || ny - 326 > CH) { setRexTypingActive(false); setRexYesNoActive(false); setRexWasInRange(false); return }

  // bx/by = centro X / pies del NPC en pantalla
  const bx = nx, by = ny

  // ── Distancia y dirección jugador → NPC ──────────────────────────────────
  const p = g.pl
  const dx = p.x + PW / 2 - VIEJO_DOG_POS.x
  const dy2 = p.y + PH / 2 - VIEJO_DOG_POS.y
  const dist = Math.sqrt(dx * dx + dy2 * dy2)
  // dx > 0 → jugadora a la derecha → Rex mira a la derecha
  const dir = dx >= 0 ? "right" : "left"

  // ── Selección de sprite según distancia y estado ──────────────────────────
  // idle   : fuera del rango de callout
  // saludo : en rango callout ("¡Psst! ¡Acércate!")
  // mitad_llave : en rango diálogo Y estado key_held (muestra la media llave)
  // talk   : en rango diálogo, cualquier otro estado
  let sprKey: string
  if (dist >= VIEJO_DOG_CALLOUT_R) {
    sprKey = "rex_idle"
  } else if (dist > VIEJO_DOG_TALK_R) {
    // En rango callout: siempre saludo/impresionado — mitad_llave solo en talk range
    sprKey = `rex_saludo_${dir}`
  } else if (g.viejoDogState === "key_held" || g.rexKeyAnimTimer > 0) {
    // En rango diálogo: estado key_held (llave aún no entregada) O durante la animación post-entrega
    sprKey = `rex_mitad_llave_${dir}`
  } else {
    sprKey = `rex_talk_${dir}`
  }

  // ── Dimensiones de render calculadas por sprite ───────────────────────────
  // Objetivo: personaje de 62 px de alto en pantalla (consistente entre estados).
  // Cada sprite tiene distinto frame size y distinto padding → hay que normalizar.
  // Datos medidos con PIL sobre frame 0 de cada sheet (frame = sheet/4 cols/4 rows).
  //   rw, rh   = píxeles de render del frame completo (preserva aspect ratio)
  //   ryOff    = ry = by - ryOff  → pies del personaje sobre el suelo real
  //              (VIEJO_DOG_POS.y está 10 px sobre el suelo, ryOff lo compensa)
  const REX_DIM: Record<string, { rw: number; rh: number; ryOff: number }> = {
    rex_idle:              { rw: 43, rh: 65, ryOff: 53 },
    rex_saludo_left:       { rw: 52, rh: 81, ryOff: 62 },
    rex_saludo_right:      { rw: 50, rh: 78, ryOff: 60 },
    rex_talk_left:         { rw: 54, rh: 65, ryOff: 54 },
    rex_talk_right:        { rw: 53, rh: 65, ryOff: 53 },
    rex_mitad_llave_left:  { rw: 43, rh: 65, ryOff: 54 },
    rex_mitad_llave_right: { rw: 42, rh: 63, ryOff: 53 },
  }
  const dim = REX_DIM[sprKey] ?? { rw: 43, rh: 65, ryOff: 53 }
  const rw = dim.rw
  const rh = dim.rh
  const rx = bx - rw / 2
  const ry = by - dim.ryOff   // pies del personaje exactamente sobre el suelo

  // ── Frame animation (5×5 spritesheet = 25 frames) ──
  // Rex a ~10fps = 100ms/frame (animaciones de perro viejo, lentas y pausadas)
  const REX_FPF = 100
  const REX_SPD: Record<string, number> = {
    rex_idle:              REX_FPF,
    rex_saludo_left:       REX_FPF,
    rex_saludo_right:      REX_FPF,
    rex_talk_left:         REX_FPF,
    rex_talk_right:        REX_FPF,
    rex_mitad_llave_left:  REX_FPF,
    rex_mitad_llave_right: REX_FPF,
  }
  // 5×5 spritesheet (25fps) = 25 frames totales
  // rex_mitad_llave tiene 3 fases controladas:
  //   Fase 1+2: frames 0→20 (100ms/frame) luego congelado en 20 mientras dura el diálogo
  //   Fase 3:   frames 20→24 cuando rexKeyAnimTimer > 0 (activado por render al terminar diálogo)
  const isMitadLlave = sprKey === "rex_mitad_llave_left" || sprKey === "rex_mitad_llave_right"
  let rexFrame: number
  if (isMitadLlave && g.rexMitadAnimStart > 0) {
    if (g.rexKeyAnimTimer > 0) {
      // Fase 3: 5 frames en 500 ms (100 ms/frame)
      const elapsed3s = 0.5 - g.rexKeyAnimTimer
      rexFrame = Math.min(24, 20 + Math.floor(elapsed3s * 10))
    } else {
      // Fase 1+2: avanzar hasta frame 20, quedarse ahí
      const elapsedMs = Date.now() - g.rexMitadAnimStart
      rexFrame = Math.min(20, Math.floor(elapsedMs / REX_FPF))
    }
  } else {
    rexFrame = Math.floor(Date.now() / (REX_SPD[sprKey] ?? REX_FPF)) % 25
  }
  const rfCol = rexFrame % 5
  const rfRow = Math.floor(rexFrame / 5)

  // ── Fade del nombre: desaparece al entrar en diálogo, reaparece al alejarse ─
  // Se desvanece al entrar en cualquier zona de interacción (callout o diálogo)
  const nameTarget = dist < VIEJO_DOG_CALLOUT_R ? 0 : 1
  setRexNameAlpha(nameTarget > _rexNameAlpha
    ? Math.min(1, _rexNameAlpha + 0.045)
    : Math.max(0, _rexNameAlpha - 0.045))

  // ── Casa de Rex (fondo — se dibuja ANTES que Rex para quedar detrás) ─────────
  // PIL: 1536×1024, content(12,44,1528,934) → W=1516 H=890, pad=12/8/44/90
  // Scale 0.3596 → render 552×368, content 545×320
  // HRX: Rex al 27% del ancho del contenido → bx - 151
  // HRY: base del contenido pegada al suelo (by+2) → by - 334
  //   Cálculo: content-bot = 334px de offset → base queda 2px dentro del tile de suelo
  //   (antes: by-326 = by+10; ahora: by-302 = by+2 → base casi exactamente a ras)
  {
    const RH_house = sprs["rex_house"]
    const HRW = 552, HRH = 368
    const HRX = bx - 151
    const HRY = by - 302  // base del contenido a ras de suelo (by + 2)
    if (RH_house && RH_house.complete && RH_house.naturalWidth > 0) {
      // Animación 12fps — spritesheet 6×6 = 36 frames, frame=384×384px
      const RH_FPF   = 1000 / 12           // ≈83 ms/frame — velocidad natural
      const rhFrame  = Math.floor(Date.now() / RH_FPF) % 36
      const rhFW     = RH_house.naturalWidth  / 6
      const rhFH     = RH_house.naturalHeight / 6
      const rhCol    = rhFrame % 6
      const rhRow    = Math.floor(rhFrame / 6)
      ctx.drawImage(RH_house, rhCol * rhFW, rhRow * rhFH, rhFW, rhFH, HRX, HRY, HRW, HRH)
    } else {
      // Fallback: silueta simple de casa mientras carga
      ctx.fillStyle = "rgba(60,45,30,0.85)"
      ctx.fillRect(bx + 10, by - 300, 340, 290)
      ctx.fillStyle = "rgba(40,28,18,0.9)"
      ctx.beginPath()
      ctx.moveTo(bx + 0, by - 300)
      ctx.lineTo(bx + 180, by - 370)
      ctx.lineTo(bx + 360, by - 300)
      ctx.closePath(); ctx.fill()
    }
  }

  // ── Sombra de Rex ─────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.22)"
  ctx.beginPath(); ctx.ellipse(bx, by, rw * 0.48, 4, 0, 0, Math.PI * 2); ctx.fill()

  // ── Sprite animado ────────────────────────────────────────────────────────
  const spr = sprs[sprKey]
  if (spr) {
    const fw = spr.width / 5          // 5×5 spritesheet (25fps)
    const fh = spr.height / 5
    ctx.drawImage(spr, rfCol * fw, rfRow * fh, fw, fh, rx, ry, rw, rh)
  } else {
    // Fallback procedural mínimo mientras el sprite carga
    ctx.fillStyle = "#8B5E3C"
    ctx.beginPath(); ctx.roundRect(bx - 13, by - 40, 26, 32, 8); ctx.fill()
    ctx.fillStyle = "#9B6E4C"
    ctx.beginPath(); ctx.arc(bx, by - 54, 15, 0, Math.PI * 2); ctx.fill()
  }

  // ── Etiqueta de nombre con fade suave ─────────────────────────────────────
  if (_rexNameAlpha > 0.01) {
    ctx.save()
    ctx.globalAlpha = _rexNameAlpha
    ctx.fillStyle = "#C8A060"; ctx.font = "bold 8px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText("Rex el Viejo", bx, ry - 4)
    ctx.textAlign = "left"
    ctx.restore()
  }

  // ── Callout "¡Psst!" cuando el jugador está lejos pero en rango ──────────
  if (dist > VIEJO_DOG_TALK_R && dist < VIEJO_DOG_CALLOUT_R) {
    const t = Date.now() * 0.001
    const bobY = Math.sin(t * 2.8) * 4
    // Burbuja pequeña de llamado
    const p1Dead = isPart1BossDead(g, 0)
    const p2Dead = isPart2BossDead(g, 0)
    const allP1Clear = areRegularP1EnemiesDead(g, 0)
    // Para el callout de ultra_hint / ultra_ready (necesita _ultraReady antes del bloque de análisis)
    const _ultraReadyCallout = g.pl.hp >= g.pl.maxHp && g.pl.ammo >= 15
      && (!g.abilities.has("tball") || g.tballAmmo > 0)
    const callText = g.viejoDogState === "intro"
      ? (g.rexIntroLeft ? "¡Ve por ellos, búscala! 🗝" : "¡Hola! ¡Acércate, Luly!")
      : (g.viejoDogState === "cage_opened" || g.viejoDogState === "quest_done")
      ? (g.abilities.has("tball") ? "¡Ya la huelo, la tienes! 🎾" : "¡Ve por la pelota!")
      : g.viejoDogState === "surprised"
      ? "¡Qué sorpresa!"
      : g.viejoDogState === "key_held"
      ? "¡Tengo la otra mitad! 🗝"
      : g.viejoDogState === "key_dropped"
      ? "¡Recoge la media llave!"
      : g.viejoDogState === "ball_held"
      ? (p1Dead ? "¡Lo venciste!!" : allP1Clear ? "¡Ve por ese Castigador!" : !g.rexBallFirstSeen ? "¡Veo que la traes! Es antigua, pero es la mejor 🎾" : "¡Sigue adelante!")
      : g.viejoDogState === "ball_guide"
      ? (g.rexBatonHeld ? "¡Si, ahí está mi bastón! 🪄" : p1Dead ? "¡Lo venciste!!" : allP1Clear ? "¡Ve por ese Castigador!" : "¡Aún falta el jefe!")
      : (g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full")
      ? (g.rexBatonHeld ? "¡Si, ahí está mi bastón! 🪄" : p2Dead ? "¿Y mi bastón? ¡Búscalo!" : "¡Muy bien hecho!")
      : g.viejoDogState === "baton_delivered"
      ? "¡Puedo caminar mejor!"
      : g.viejoDogState === "p2_warning"
      ? (g.rexBatonHeld ? "¡Si, ahí está mi bastón! 🪄" : p2Dead ? "¿Y mi bastón? ¡Búscalo!" : "¡Ese Herrero caerá en tus brasas!")
      : g.viejoDogState === "ultra_hint"
      ? (_ultraReadyCallout ? "¡Estás lista! ¡Ven!" : "¡Recarga antes de enfrentarlo!")
      : g.viejoDogState === "ultra_ready"
      ? (g.ultraBossRexSeen ? "¡Ve, Luly! ¡Tú puedes! 🐾" : _ultraReadyCallout ? "¡Ven, te hago una pregunta!" : "¡Recarga antes de enfrentarlo!")
      : g.viejoDogState === "ultra_done"
      ? "¡Luly, lo hiciste! 🎉"
      : g.viejoDogState === "world2_ready"
      ? "¿Tienes todo listo? ¡Te vemos allá!"
      : g.viejoDogState === "quest_active"
      ? "¡Ve por ellos, derrótalo!"
      : "¡Psst! ¡Acércate!"
    const cw2 = ctx.measureText(callText).width + 14
    const cbx = bx - cw2 / 2, cby = by - 88 + bobY
    ctx.save()
    ctx.fillStyle = "rgba(255,235,160,0.92)"
    ctx.beginPath(); ctx.roundRect(cbx, cby, cw2, 16, 5); ctx.fill()
    ctx.strokeStyle = "#AA8800"; ctx.lineWidth = 1; ctx.stroke()
    // Cola mini
    ctx.fillStyle = "rgba(255,235,160,0.92)"
    ctx.beginPath(); ctx.moveTo(bx - 4, cby + 16); ctx.lineTo(bx + 4, cby + 16); ctx.lineTo(bx, cby + 22); ctx.closePath(); ctx.fill()
    ctx.fillStyle = "#3A2800"; ctx.font = "bold 8px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(callText, bx, cby + 11)
    ctx.textAlign = "left"; ctx.restore()
    setRexTypingActive(false); setRexYesNoActive(false); setRexWasInRange(false)   // fuera del rango de diálogo
    return
  }
  if (dist >= VIEJO_DOG_CALLOUT_R) { setRexTypingActive(false); setRexYesNoActive(false); setRexWasInRange(false); return }

  // ── Sistema de quests / diálogo con tipografía animada ───────────────────
  const TOTAL_QUEST_SLOTS = 3
  const kills = Math.max(0, countP1KillsW0(g.dead) - g.questKillBaseline)
  const allP1Clear_dlg = areRegularP1EnemiesDead(g, 0)
  const p1Dead_dlg = isPart1BossDead(g, 0)
  const p2Dead_dlg = isPart2BossDead(g, 0)

  // ── Análisis de recursos pre-Torturado (usado en ultra_hint / ultra_ready) ──
  const _ultraReady = g.pl.hp >= g.pl.maxHp && g.pl.ammo >= 15
    && (!g.abilities.has("tball") || g.tballAmmo > 0)
  // "Bolsas": cajas sin romper (persistentes) + drops útiles aún flotando (transitorios)
  const _ultraCrates = g.crates.filter(c => c.active).length
  const _ultraFloatDrops = g.drops.filter(d => d.active
    && (d.kind === "h" || d.kind === "a" || d.kind === "tba")).length
  const _ultraBolsas = _ultraCrates + _ultraFloatDrops   // total de "bolsas" disponibles
  const _ultraNeededScore = (g.pl.hp < g.pl.maxHp ? BOLKHA_PRICE_HEART : 0)
    + (g.pl.ammo < 15 ? BOLKHA_PRICE_BONES : 0)
    + (g.abilities.has("tball") && g.tballAmmo === 0 ? BOLKHA_PRICE_TBALL : 0)
  const _ultraCanAfford = _ultraNeededScore > 0 && g.score >= _ultraNeededScore
  // Sufijo para dlgKey: encapsula el sub-estado del análisis
  // Umbrales: >= 6 bolsas = mucho, 1-5 = poco, 0 = nada
  let _ultraSuffix = ""
  if (g.viejoDogState === "ultra_hint") {
    if (_ultraBolsas >= 6)        _ultraSuffix = "_drops"
    else if (_ultraBolsas >= 2)   _ultraSuffix = "_fewdrops"
    else if (_ultraCanAfford)     _ultraSuffix = "_bolkha"
    else                          _ultraSuffix = "_rexhelp"
  } else if (g.viejoDogState === "ultra_ready") {
    _ultraSuffix = g.rexUltraReadyDeclined ? "_no" : (g.ultraBossRexSeen ? "_open" : "_check")
  }

  // Cada estado devuelve { pages, colors, headers } — pages = array de páginas (array de líneas)
  type DlgDef = { pages: string[][]; colors: string[]; headers: string[] }
  let dlg: DlgDef

  if (g.viejoDogState === "intro") {
    dlg = {
      headers: ["◈ ¡BIENVENIDO, LULY! ◈", "◈ MI PROBLEMA ◈", `◈ MISIÓN 1/${TOTAL_QUEST_SLOTS}: ASIGNADA ◈`,""],
      colors:  ["#E8D8C0",                "#FFCC88",          "#FFCC66"],
      pages: [
        [
          "Hola, soy Rex. Veo que",
          "eres Luly, ya me hablaron",
          "de ti. Estas son las",
          "Perreras: 3 Jefes y",
          "muchos enemigos. Primero",
          "haz la sección de arriba.",
        ],
        [
          "Mi pelota está encerrada,",
          "me la quitaron y rompieron",
          "mi llave. Yo tengo la",
          "primera parte, pero algún",
          "perro malo tiene la otra.",
          "¡Necesito que me ayudes! 🗝",
        ],
        [
          "Recuerda: alguno de ellos",
          "la lleva... no sé cuál.",
          "¡Encuéntrala, Luly,",
          "y tráemela! 🗝",
        ],
        [
          
        ],
      ]
    }
  } else if (g.viejoDogState === "surprised") {
    dlg = { headers: ["◈ MISIÓN: COMPLETADA ◈"], colors: ["#CCFF88"], pages: [[
      "¡Caray! ¡La encontraste",
      "tú solo! Eres más listo",
      "de lo que pensaba, Luly.",
      "Quizás pronto tenga",
      "otro secreto para ti. 🎾",
    ]]}
  } else if (g.viejoDogState === "cage_opened" || g.viejoDogState === "quest_done") {
    dlg = { headers: ["◈ MISIÓN: COMPLETADA ◈"], colors: ["#AAFFAA"], pages: [[
      "¡Sigue el pasillo al",
      "este! Mi pelota está en",
      "una jaula al fondo.",
      "¡Ve por ella, es tuya,",
      "te la ganaste! 🎾",
    ]]}
  } else if (g.viejoDogState === "key_held") {
    dlg = { headers: [`◈ MISIÓN 1/${TOTAL_QUEST_SLOTS}: ¡LA TIENES! ◈`,""], colors: ["#FFE088"], pages: 
    [
      [
      "¡La otra mitad de la",
      "llave de mi antiguo amo!",
      "Aquí tengo la mía...",
      "¡Tómala, Luly! Las dos",
      "juntas abren la jaula.",
    ],
    [
          
        ],
  ]}
  } else if (g.viejoDogState === "key_dropped") {
    dlg = { headers: [`◈ MISIÓN 1/${TOTAL_QUEST_SLOTS}: EN CURSO ◈`], colors: ["#FFCC66"], pages: [[
      "¡Uno de ellos tenía",
      "mi media llave! ¡Brilla",
      "en el suelo, cógela y",
      "tráemela pronto, Luly!",
      "¡Yo tengo la otra mitad!",
    ]]}
  } else if (g.viejoDogState === "quest_active") {
    dlg = { headers: [`◈ MISIÓN 1/${TOTAL_QUEST_SLOTS}: EN CURSO ◈`], colors: ["#FFCC66"], pages: [[
      "Uno de esos perros lleva",
      "mi media llave. ¡Búscala!",
      kills === 0 ? "" :
        `Eliminados: ${kills} — ${kills < 3 ? "¡Sigue buscando!" : kills < 8 ? "¡Puede estar cerca!" : "¡Alguno debe tenerla!"}`,
      "Yo tengo la otra mitad.",
    ]]}
  } else if (g.viejoDogState === "ball_held" && !g.rexBallFirstSeen) {
    dlg = { headers: ["◈ ¡LA TIENES! ◈"], colors: ["#CCFFAA"], pages: [[
      "¡La tienes! Es la mejor",
      "de todas, su sabor es",
      "indiscutible. Pero su",
      "fuerza de rebote es mayor",
      "de lo normal... luego",
      "la mejoraremos juntos. 🎾",
    ]]}
  } else if (g.viejoDogState === "ball_held" || g.viejoDogState === "ball_guide") {
    if (allP1Clear_dlg && !p1Dead_dlg) {
      // Todos los enemigos regulares muertos, El Castigador sigue vivo
      dlg = { headers: ["◈ ¡ES LA HORA! ◈"], colors: ["#FFAA44"], pages: [[
        "¡Luly, derrotaste a todos!",
        "Es hora de enfrentar al",
        "Castigador. Tiene un látigo",
        "y es muy rápido. Debes",
        "ser fuerte, Luly.",
        "La pelota te ayudará.",
      ]]}
    } else if (!p1Dead_dlg) {
      // Enemigos regulares aún vivos, El Castigador vivo → solo página 1
      dlg = { headers: ["◈ SIGUE ADELANTE ◈"], colors: ["#FFDD88"], pages: [[
        "Bien, tienes que seguir",
        "derrotando enemigos para",
        "poder enfrentarte al jefe",
        "de esta sección...",
        "Le llaman El Castigador.",
      ]]}
    } else {
      // El Castigador cayó — en tick esto transiciona a reward, pero fallback por si acaso
      dlg = {
        headers: ["◈ ¡LO VENCISTE! ◈", "◈ NUEVA MISIÓN ◈"],
        colors:  ["#CCFF88",           "#C8A0FF"],
        pages: [
          [
            "¡Venciste al Castigador!",
            "Eres muy fuerte, Luly.",
            "Regresa a mí para que",
            "te dé tu recompensa.",
          ],
          [
            "Ahora mejoraremos tu",
            "pelota. Luego:",
            "vence al Herrero. Él",
            "tiene mi bastón.",
            "Derrótalo y tráemelo,",
            "así podré caminar mejor.",
          ],
        ]
      }
    }
  } else if ((g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full" || g.viejoDogState === "p2_warning") && p2Dead_dlg && !g.rexBatonHeld) {
    // El Herrero cayó pero Luly no trae el bastón → Rex pregunta por él
    dlg = { headers: ["◈ ¡MI BASTÓN! ◈"], colors: ["#FFAA44"], pages: [[
      "¡Oye! ¡Derrotaste al Herrero",
      "y no traes mi bastón?",
      "Lo soltó al caer, Luly.",
      "¡Vuelve y búscalo!",
      "¡No te vayas sin él! 🪄",
    ]]}
  } else if (g.bolkhaRexTold && !g.bolkhaAppearedOnce &&
      (g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full")) {
    // Recordatorio: Rex mencionó a Bolkha pero el jugador aún no lo ha descubierto
    dlg = { headers: ["◈ ¡BÚSCALO! ◈"], colors: ["#88DDFF"], pages: [[
      "Aún no descubriste",
      "a Bolkha. Búscalo,",
      "está ahí cerca del",
      "cartel de mi casa.",
      "¡Ve a buscarlo, Luly!",
    ]]}
  } else if (g.bolkhaRexTold && g.bolkhaAppearedOnce &&
      (g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full")) {
    // Confirmación permanente: ya encontró a Bolkha. Este mensaje se queda hasta que
    // la progresión del juego lo reemplace (p2_warning / baton_delivered / etc.)
    dlg = { headers: ["◈ ¡BIEN HECHO! ◈"], colors: ["#88DDFF"], pages: [[
      "Bien, lo descubriste.",
      "Es uno de nuestros",
      "mejores aliados. Vende",
      "de todo. Luego seguro",
      "tendrás más cosas que",
      "comprar. Ahora... sigue abajo.",
    ]]}
  } else if (g.viejoDogState === "reward_lives") {
    dlg = {
      headers: ["◈ ¡LO VENCISTE! ◈", "◈ NUEVA MISIÓN ◈", "◈ BOLKHA ◈",""],
      colors:  ["#FF8888",          "#C8A0FF",           "#88DDFF"],
      pages: [
        [
          "¡Muy bien hecho, Luly!",
          "Veo que estás débil...",
          "Toma esto y recupérate.",
          "Eres increíble. ❤",
        ],
        [
          "Ahora mejoraremos tu",
          "pelota, pero primero:",
          "vence al Herrero. Él",
          "tiene mi bastón.",
          "Derrótalo y tráemelo,",
          "así podré caminar mejor.",
        ],
        [
          "Ah... y hay alguien en",
          "mi casa. Un amigo.",
          "Bolkha. Pocos saben",
          "de él. Es... especial.",
          "Cambia croquetas por",
          "cosas útiles. Búscalo.",
        ],
        [
         
        ],
      ]
    }
  } else if (g.viejoDogState === "reward_full") {
    dlg = {
      headers: ["◈ ¡IMPRESIONANTE! ◈", "◈ NUEVA MISIÓN ◈", "◈ BOLKHA ◈",""],
      colors:  ["#88FFCC",            "#C8A0FF",           "#88DDFF"],
      pages: [
        [
          "¡Luly, eres más fuerte",
          "de lo que pensé! No",
          "perdiste ninguna vida.",
          "¡Increíble, Luly! ✨",
        ],
        [
          "Ahora debes ir abajo,",
          "te espera El Herrero.",
          "Él tiene mi bastón.",
          "Derrótalo y tráemelo,",
          "así podré caminar mejor.",
        ],
        [
          "Ah... y hay alguien en",
          "mi casa. Un amigo.",
          "Bolkha. Pocos saben",
          "de él. Es... especial.",
          "Cambia croquetas por",
          "cosas útiles. Búscalo.",
        ],
        [
          
        ],
      ]
    }
  } else if (g.viejoDogState === "baton_delivered") {
    dlg = {
      headers: ["◈ ¡GRACIAS, LULY! ◈", "◈ EL ÚLTIMO JEFE ◈", "◈ ÁNIMO, LULY ◈", "◈ TRÁELO A MIS PATAS ◈"],
      colors:  ["#C8A0FF",             "#FF8844",            "#88AAFF",         "#CCDDFF"],
      pages: [
        [
          "¡Mi bastón! Ahora puedo",
          "caminar mucho mejor.",
          "Tu pelota ya tiene más",
          "rebote y más cantidad.",
          "¡Sigue adelante, Luly! 🪄",
        ],
        [
          "Luly, ahora el reto",
          "más difícil: el jefe",
          "de jefes. Le llaman",
          "El Torturado. Era un",
          "prisionero, lo conocí.",
          "Era bueno, lo destruyeron",
          "hasta colapsar su mente.",
          "Ahora es parte de HUDOG.",
          "Tendrás el Dash. 💨",
        ],
        [
          "No temas, recarga",
          "todo antes de",
          "enfrentarlo. Luly,",
          "descansa si es",
          "necesario. ¡Tú",
          "puedes con él! 💪",
        ],
        [
          "Has llegado hasta aquí.",
          "Eso no es poco, Luly.",
          "Todo lo que aprendiste",
          "te trajo hasta este",
          "momento. ¡Yo creo en",
          "ti, ve y derrótalo! 🐾",
        ],
      ]
    }
  } else if (g.viejoDogState === "p2_warning") {
    dlg = { headers: ["◈ ¡CUIDADO, LULY! ◈"], colors: ["#FFAA44"], pages: [[
      "Luly, lo has hecho",
      "de nuevo... ahora te",
      "falta derrotarlo.",
      "El Herrero es muy",
      "fuerte, su martillo",
      "golpea con todo.",
      "Ten cuidado Luly,",
      "¡sé que lo lograrás!",
    ]]}
  } else if (g.viejoDogState === "ultra_hint") {
    if (_ultraSuffix === "_drops") {
      dlg = { headers: ["◈ AÚN HAY RECURSOS ◈"], colors: ["#88FFAA"], pages: [[
        `Luly, hay ${_ultraBolsas} cajas`,
        "sin romper por el mapa.",
        "Rómpelas antes de",
        "entrar, así no gastas",
        "croquetas en lo que",
        "puedes conseguir",
        "rompiendo cajas. 🐾",
      ]]}
    } else if (_ultraSuffix === "_fewdrops") {
      dlg = { headers: ["◈ POCAS CAJAS ◈"], colors: ["#FFCC66"], pages: [[
        `Solo quedan ${_ultraBolsas} cajas.`,
        "Creo que no te",
        "alcanzarán para todo.",
        "Rompe lo que puedas",
        "y pásate con Bolkha",
        "a completar lo que",
        "te falte. 🐾",
      ]]}
    } else if (_ultraSuffix === "_bolkha") {
      dlg = { headers: ["◈ VE A BOLKHA ◈"], colors: ["#88DDFF"], pages: [[
        "No quedan cajas que",
        "romper, pero tienes",
        "croquetas suficientes.",
        "Ve con Bolkha a",
        "comprar lo que falta.",
        "¡No entres sin estar",
        "completa! 🐾",
      ]]}
    } else {
      // _rexhelp: sin cajas, sin croquetas → Rex da los recursos
      dlg = { headers: ["◈ UN PRÉSTAMO... ◈"], colors: ["#FFAACC"], pages: [[
        "Luly... no hay cajas",
        "ni croquetas para ti.",
        "No puedo dejarte ir",
        "así al Torturado...",
        "oye, ¡esto es un",
        "PRÉSTAMO, eh? ¡Yo",
        "también como, Luly! 🐾",
      ]]}
    }
  } else if (g.viejoDogState === "ultra_ready") {
    if (g.rexUltraReadyDeclined) {
      dlg = { headers: ["◈ CUANDO ESTÉS LISTA ◈"], colors: ["#AABBFF"], pages: [[
        "Está bien, Luly.",
        "Vuelve cuando quieras.",
        "Aquí estaré. El",
        "Torturado puede",
        "esperar un poco. 🐾",
      ]]}
    } else if (g.ultraBossRexSeen) {
      dlg = { headers: ["◈ ¡MUCHA SUERTE! ◈"], colors: ["#88FF88"], pages: [[
        "¡Ve, Luly! El Torturado",
        "te espera ahí dentro.",
        "Usa todo lo que",
        "aprendiste. ¡Tú",
        "puedes con él!",
        "¡Yo creo en ti! 🐾",
      ]]}
    } else {
      dlg = { headers: ["◈ ¿LISTA PARA EL FINAL? ◈"], colors: ["#CCBBFF"], pages: [[
        "Veo que estás completa.",
        "El Torturado es el",
        "más poderoso de todos.",
        "Usa todo lo que tienes.",
        "¿Estás lista para",
        "enfrentarte a él?",
      ]]}
    }
  } else if (g.viejoDogState === "ultra_done") {
    dlg = { headers: ["◈ ¡LO HICISTE, LULY! ◈"], colors: ["#FFDD44"], pages: [[
      "Ahora debemos seguir,",
      "nos esperan más jefes.",
      "Iremos a la Fábrica",
      "Canina... hacen cosas",
      "muy malas allí, pero",
      "tenemos a alguien",
      "dentro. Nos ayudará",
      "cuando estemos allá.",
    ]]}
  } else if (g.viejoDogState === "world2_ready") {
    dlg = { headers: ["◈ NOS VEMOS ALLÁ ◈"], colors: ["#AADDFF"], pages: [[
      "Ya lo tienes todo.",
      "Yo y mi casa nos",
      "moveremos pronto.",
      "¡Te vemos en la",
      "Fábrica Canina, Luly!",
      "¡Ten cuidado! 🐾",
    ]]}
  } else {
    dlg = { headers: [`◈ MISIONES: ${TOTAL_QUEST_SLOTS} en total ◈`], colors: ["#E8D8C0"], pages: [[
      "¡Hola, Luly! Soy Rex,",
      "el guardián de secretos.",
      "Por ahora solo tengo",
      "una misión para ti...",
      "¡Cuando seas más fuerte",
      "te daré las demás! 🐾",
    ]]}
  }

  // ── Clave de estado para el typewriter ───────────────────────────────────
  // Sufijos para los diálogos de intercepción de Bolkha — evitan heredar el puntero
  // de página del diálogo base (que ya fue leído) y mostrarse instantáneamente.
  const _bolkhaInReward = g.bolkhaRexTold &&
    (g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full")
  const _bolkhaSuffix = _bolkhaInReward
    ? (g.bolkhaAppearedOnce ? "_bm" : "_bs")   // _bm = bien descubierto · _bs = búscalo
    : ""
  const dlgKey = g.viejoDogState
    + (g.rexBallFirstSeen ? "_s" : "")
    + (p1Dead_dlg ? "_p1d" : allP1Clear_dlg ? "_clr" : "")
    + (p2Dead_dlg ? "_p2d" : "")
    + _bolkhaSuffix
    + _ultraSuffix

  // ── Re-entrada al rango: mostrar instantáneo si ya fue leído, sino reiniciar ──
  const nowInRange = dist < VIEJO_DOG_TALK_R
  if (nowInRange && !_rexWasInRange) {
    const lastRead = _rexReadPages[dlgKey] ?? -1
    if (lastRead >= 0) {
      // Página ya leída → mostrar la última página leída completa (sin typewriter)
      setRexDlgKey(dlgKey); setRexDlgPage(lastRead); setRexDlgMs(Date.now() - 999999)
    } else {
      // Nunca leído o incompleto → reiniciar desde el principio
      setRexDlgKey(""); setRexDlgPage(0)
    }
  }
  setRexWasInRange(nowInRange)

  // ── Tipografía animada (typewriter) — N páginas ──────────────────────────
  // _rexDlgMs siempre mide el inicio de la PÁGINA ACTUAL (se resetea al avanzar)
  if (dlgKey !== _rexDlgKey) {
    setRexDlgKey(dlgKey); setRexDlgMs(Date.now()); setRexDlgPage(0)
  }
  const numPages = dlg.pages.length
  // Página actual antes del posible avance
  let curPage = Math.min(_rexDlgPage, numPages - 1)
  const elapsed = Date.now() - _rexDlgMs
  // ¿Página actual terminada de tipear Y existe página siguiente?
  const curPageTotalChars = dlg.pages[curPage].join("").length
  const curPageDone = elapsed >= curPageTotalChars * REX_TYPING_MS && curPage < numPages - 1
  setRexPageWaiting(curPageDone)
  // _showYesNo: true cuando el ready-check está activo (charsShown resuelto más abajo)
  const _showYesNo = g.viejoDogState === "ultra_ready" && !g.ultraBossRexSeen
    && !g.rexUltraReadyDeclined && curPage === numPages - 1

  // Avance de página con E/B/○ — cooldown 400 ms evita doble-salto por tap rápido o lag
  if (curPageDone && g.keys["e"] && Date.now() - _rexLastAdvanceMs > 400) {
    _rexLastAdvanceMs = Date.now()
    _rexReadPages[dlgKey] = curPage   // página actual ya vista → no retipear
    curPage++
    setRexDlgPage(curPage)
    setRexDlgMs(Date.now())
    g.keys["e"] = false
  }
  // Caracteres a mostrar (recalcula elapsed tras posible avance)
  const elapsedCur = Date.now() - _rexDlgMs
  const charsShown = Math.min(
    dlg.pages[curPage].join("").length,
    Math.floor(elapsedCur / REX_TYPING_MS)
  )
  const dialogLines = dlg.pages[curPage]

  // ── Confirmación del selector Sí/No con E (cursor ya actualizado por tick.ts) ─
  const _yesNoDone = _showYesNo && charsShown >= dlg.pages[curPage].join("").length
  if (_yesNoDone && g.keys["e"] && Date.now() - _rexLastAdvanceMs > 400) {
    _rexLastAdvanceMs = Date.now()
    g.keys["e"] = false
    if (g.rexReadyCursor === 0) {
      // Sí → abrir sala del Torturado
      g.ultraBossRexSeen = true
      triggerShake(g, 18, 2.2)
      g.abilityNotif = { text: "¡La sala del Torturado ha sido desbloqueada! ⚡", timer: 5.0 }
      saveGame(g)
    } else {
      // No → mostrar mensaje "vuelve cuando quieras"
      g.rexUltraReadyDeclined = true
    }
  }

  // ── Actualizar flag de tipografía activa (leído por tickViejoDog siguiente tick) ─
  // Se calcula aquí porque 'dialogLines' ya está disponible; 'totalPageChars' se redeclara abajo
  const _curPageChars = dialogLines.join("").length
  // Marcar página como leída si el typewriter llegó al final
  if (charsShown >= _curPageChars) {
    const prevRead = _rexReadPages[dlgKey] ?? -1
    if (curPage > prevRead) _rexReadPages[dlgKey] = curPage
    // ── Boss-unlock: última página leída por primera vez → abrir puerta + shake ──
    const isLastPage = curPage === numPages - 1
    if (isLastPage) {
      const isP1Unlock = !g.p1BossRexSeen
        && (g.viejoDogState === "ball_held" || g.viejoDogState === "ball_guide")
        && allP1Clear_dlg && !p1Dead_dlg
      const isP2Unlock = !g.p2BossRexSeen && g.viejoDogState === "p2_warning"
      if (isP1Unlock) {
        g.p1BossRexSeen = true
        triggerShake(g, 14, 1.8)
        g.abilityNotif = { text: "¡El cubículo del Castigador se ha abierto! 🟢", timer: 5.0 }
        saveGame(g)
      } else if (isP2Unlock) {
        g.p2BossRexSeen = true
        triggerShake(g, 14, 1.8)
        g.abilityNotif = { text: "¡El cubículo del Herrero se ha abierto! 🔴", timer: 5.0 }
        saveGame(g)
      }
      // ── Rex da recursos prestados (último diálogo _rexhelp) ────────────────
      if (!g.rexUltraGaveItems && g.viejoDogState === "ultra_hint"
          && _ultraSuffix === "_rexhelp") {
        g.rexUltraGaveItems = true
        g.pl.hp  = g.pl.maxHp
        g.pl.ammo = 15
        if (g.abilities.has("tball"))
          g.tballAmmo = g.tballUpgraded ? TB_AMMO_MAX : TB_AMMO_INIT
        spawnExplosion(g, VIEJO_DOG_POS.x, VIEJO_DOG_POS.y - 30,
          ["#FF4444", "#FFD700", "#88FF44", "#88DDFF", "#FFAACC", "#FFFFFF"], 35, 5, true)
        triggerShake(g, 8, 0.5)
        g.abilityNotif = { text: "¡Rex te prestó recursos! ❤ 🦴 🎾", timer: 4.5 }
        saveGame(g)
      }
      // ── Tarea 2: intro leída completa → activar quest sin salir del rango ──
      if (g.viejoDogState === "intro" && !g.rexIntroLeft) {
        g.rexIntroLeft = true
        saveGame(g)
      }
      // ── Tarea 5: Rex mencionó a Bolkha (última página de reward_lives/full) ─
      // El sufijo _bs/_bm en dlgKey hace que esta página sólo dispare cuando el diálogo
      // base (3 páginas de reward) está activo — el sufijo cambia la clave cuando hay
      // intercepción, por lo que "reward_lives" sin sufijo = diálogo base todavía en curso.
      if (!g.bolkhaRexTold &&
          (g.viejoDogState === "reward_lives" || g.viejoDogState === "reward_full") &&
          !_bolkhaInReward) {
        // Solo se activa al leer la última página del diálogo BASE (con la página BOLKHA)
        g.bolkhaRexTold = true
        saveGame(g)
      }
      // ── Llave: diálogo terminado → disparar fase 3 del sprite rex_mitad_llave ──
      // rexMitadAnimStart > 0: la animación ya empezó (Luly entregó la llave al acercarse)
      // rexKeyAnimTimer === 0: la fase 3 no ha sido disparada todavía
      if (g.viejoDogState === "key_held" && g.rexMitadAnimStart > 0 && g.rexKeyAnimTimer === 0) {
        g.rexKeyAnimTimer = 0.5   // 500 ms → 5 frames a 100 ms/frame, luego explosión en npc_rex.ts
      }
    }
  }
  // Solo bloquear movimiento en diálogos de 2 páginas (los que requieren pulsar E)
  // Paralizar a Luly: diálogos multi-página O cuando el selector Sí/No está activo
  setRexTypingActive(nowInRange && (
    (numPages > 1 && !(curPage === numPages - 1 && charsShown >= _curPageChars))
    || _showYesNo
  ))
  // Habilitar lectura de cursor en tick.ts solo cuando el texto terminó de tipear
  setRexYesNoActive(nowInRange && _yesNoDone)
  const dialogColor = dlg.colors[curPage] ?? dlg.colors[0]
  const headerLine  = dlg.headers[curPage] ?? dlg.headers[0]

  // ── Renderizar burbuja de diálogo ─────────────────────────────────────────
  // En mobile el texto del diálogo es más grande para mejor legibilidad
  const dlgMob = g.isMobile
  const bub_fontSize = dlgMob ? 13 : 9
  const bub_lh  = dlgMob ? 18 : 13
  const bub_pad = dlgMob ? 13 : 9
  const bub_w   = dlgMob ? 300 : 210
  const totalLines = (headerLine ? 1 : 0) + dialogLines.length
  const _yesNoExtraH = _showYesNo ? bub_lh + 8 : 0
  const bub_h = bub_pad * 2 + totalLines * bub_lh + (headerLine ? 4 : 0) + _yesNoExtraH
  const bub_x = Math.max(4, Math.min(CW - bub_w - 4, bx - bub_w / 2))
  const bub_y = by - bub_h - 78

  ctx.save()
  ctx.fillStyle = "rgba(14,10,6,0.92)"
  ctx.beginPath(); ctx.roundRect(bub_x, bub_y, bub_w, bub_h, 9); ctx.fill()
  const borderCol = (g.viejoDogState === "cage_opened" || g.viejoDogState === "quest_done" || g.viejoDogState === "surprised")
    ? "#44BB44"
    : (g.viejoDogState === "key_held") ? "#FFD700"
    : (g.viejoDogState === "key_dropped" || g.viejoDogState === "quest_active") ? "#DDAA44"
    : (g.viejoDogState === "ball_held" || g.viejoDogState === "ball_guide") ? (curPage === 1 ? "#C8A0FF" : allP1Clear_dlg && !p1Dead_dlg ? "#FFAA44" : "#88CC44")
    : (g.viejoDogState === "reward_lives") ? (curPage === 1 ? "#C8A0FF" : "#FF6666")
    : (g.viejoDogState === "reward_full") ? (curPage === 1 ? "#C8A0FF" : "#44FFCC")
    : (g.viejoDogState === "baton_delivered") ? (curPage === 1 ? "#FF8844" : "#C8A0FF")
    : (g.viejoDogState === "intro") ? (curPage === 1 ? "#FFDD88" : "#E8D8C0")
    : (g.viejoDogState === "p2_warning") ? "#FFAA44"
    : (g.viejoDogState === "ultra_hint") ? (
        _ultraSuffix === "_drops" ? "#88FFAA"
        : _ultraSuffix === "_fewdrops" ? "#FFCC66"
        : _ultraSuffix === "_bolkha" ? "#88DDFF"
        : "#FFAACC")
    : (g.viejoDogState === "ultra_ready") ? (
        g.rexUltraReadyDeclined ? "#AABBFF"
        : g.ultraBossRexSeen ? "#88FF88"
        : "#CCBBFF")
    : (g.viejoDogState === "ultra_done") ? "#FFDD44"
    : (g.viejoDogState === "world2_ready") ? "#AADDFF"
    : "#A08060"
  ctx.strokeStyle = borderCol; ctx.lineWidth = 1.4; ctx.stroke()

  const tailX = Math.max(bub_x + 20, Math.min(bub_x + bub_w - 20, bx))
  ctx.fillStyle = "rgba(14,10,6,0.92)"
  ctx.beginPath()
  ctx.moveTo(tailX - 7, bub_y + bub_h)
  ctx.lineTo(tailX + 7, bub_y + bub_h)
  ctx.lineTo(tailX, bub_y + bub_h + 10)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = borderCol; ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(tailX - 7, bub_y + bub_h + 0.5)
  ctx.lineTo(tailX, bub_y + bub_h + 10)
  ctx.lineTo(tailX + 7, bub_y + bub_h + 0.5)
  ctx.stroke()

  let textY = bub_y + bub_pad
  if (headerLine) {
    ctx.fillStyle = borderCol; ctx.font = "bold 8px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(headerLine, bub_x + bub_w / 2, textY + bub_lh - 2)
    textY += bub_lh + 4
    ctx.strokeStyle = borderCol + "55"; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(bub_x + 8, textY); ctx.lineTo(bub_x + bub_w - 8, textY); ctx.stroke()
    textY += 3
  }
  // Tipografía animada: revelar carácter a carácter
  ctx.fillStyle = dialogColor; ctx.font = `${bub_fontSize}px 'Courier New',monospace`; ctx.textAlign = "center"
  let charsLeft = charsShown
  for (let li = 0; li < dialogLines.length; li++) {
    const line = dialogLines[li]
    if (charsLeft <= 0) break
    const shown = line.slice(0, charsLeft)
    ctx.fillText(shown, bub_x + bub_w / 2, textY + bub_lh - 2)
    charsLeft -= line.length
    textY += bub_lh
  }
  const totalPageChars = dialogLines.join("").length
  if (numPages > 1 && charsShown >= totalPageChars && curPage < numPages - 1) {
    const gt = g.gpadType ?? "keyboard"
    const egt = (g.isMobile && gt === "keyboard") ? "xbox" : gt   // móvil siempre usa botones de gamepad
    const btnLabel = egt === "xbox" ? "B ▶" : egt === "ps" ? "○ ▶" : "E ▶"
    const btnColor = egt === "xbox" ? "#E03030" : egt === "ps" ? "#C8A0FF" : "#88FF88"
    const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.006)
    ctx.globalAlpha = pulse
    ctx.fillStyle = btnColor; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "right"
    ctx.fillText(btnLabel, bub_x + bub_w - 6, bub_y + bub_h - 4)
    ctx.globalAlpha = 1
  }
  // ── Selector Sí/No (ultra_ready ready-check) ────────────────────────────────
  if (_showYesNo && _yesNoDone) {
    const btnY  = bub_y + bub_h - bub_pad - 2
    const siX   = bub_x + bub_w * 0.30
    const noX   = bub_x + bub_w * 0.70
    const btnW  = 44, btnH = 16
    ctx.font = `bold ${bub_fontSize + 1}px 'Courier New',monospace`
    ctx.textAlign = "center"
    // Sí
    const siSel = g.rexReadyCursor === 0
    ctx.fillStyle = siSel ? "rgba(100,255,100,0.25)" : "rgba(80,80,80,0.18)"
    ctx.beginPath(); ctx.roundRect(siX - btnW / 2, btnY - btnH + 3, btnW, btnH, 4); ctx.fill()
    if (siSel) {
      ctx.strokeStyle = "#AAFFAA"; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.roundRect(siX - btnW / 2, btnY - btnH + 3, btnW, btnH, 4); ctx.stroke()
    }
    ctx.fillStyle = siSel ? "#CCFFAA" : "#777777"
    ctx.fillText("[ Sí ]", siX, btnY)
    // No
    const noSel = g.rexReadyCursor === 1
    ctx.fillStyle = noSel ? "rgba(255,100,100,0.25)" : "rgba(80,80,80,0.18)"
    ctx.beginPath(); ctx.roundRect(noX - btnW / 2, btnY - btnH + 3, btnW, btnH, 4); ctx.fill()
    if (noSel) {
      ctx.strokeStyle = "#FFAAAA"; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.roundRect(noX - btnW / 2, btnY - btnH + 3, btnW, btnH, 4); ctx.stroke()
    }
    ctx.fillStyle = noSel ? "#FFAAAA" : "#777777"
    ctx.fillText("[ No ]", noX, btnY)
    // Indicador de controles (flechas)
    const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.005)
    ctx.globalAlpha = pulse
    ctx.fillStyle = "#AAAAFF"
    ctx.font = `bold 8px 'Courier New',monospace`
    ctx.fillText("◄ ► para elegir  •  E para confirmar", bub_x + bub_w / 2, btnY + 10)
    ctx.globalAlpha = 1
  }
  ctx.textAlign = "left"
  ctx.restore()
}

// ── Pared lateral sprite ──────────────────────────────────────────────────────
// W-3.png: 153×744, sin padding. Scale a ancho=WT=24 → rW=24 rH=117, tile vertical.
// Pared izquierda: normal. Pared derecha: flip horizontal (ctx.scale(-1,1)).
export function drawWallSprite(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  w: number, h: number, wy: number, sprs: SprBank, rightWall: boolean
) {
  const spr = sprs["wall_sprite"]
  if (!spr || !spr.complete || !spr.naturalWidth) return

  const rw = 24, rh = 117   // 153×744 @ scale 24/153, sin padding

  ctx.save()
  ctx.beginPath(); ctx.rect(sx, sy, w, h); ctx.clip()

  const slotStart = Math.floor(wy / rh)
  const slotEnd   = Math.ceil((wy + h) / rh)

  if (rightWall) {
    // Flip horizontal: translate al borde derecho del tile + scale(-1,1)
    // → drawImage en x=0 queda en pantalla sx, x=rw queda en sx+rw
    ctx.translate(sx + rw, 0)
    ctx.scale(-1, 1)
    for (let si = slotStart; si <= slotEnd; si++) {
      const sprY = sy + (si * rh - wy)
      ctx.drawImage(spr, 0, sprY, rw, rh)
    }
  } else {
    for (let si = slotStart; si <= slotEnd; si++) {
      const sprY = sy + (si * rh - wy)
      ctx.drawImage(spr, sx, sprY, rw, rh)
    }
  }
  ctx.restore()
}

// ── Pared interna sprite (bloque sólido interior) ────────────────────────────
// W-2.png: 1088×512, content(125,102,965,410) → cW=840 cH=308, pad=26/26/21/21
// Scale a content-h=64 px → rW=226 rH=106, stepX=174 stepY=64
// Tileado 2D alineado al mundo para que los bloques adyacentes empalmen sin costuras.
export function drawInternalWallSprite(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  w: number, h: number, wx: number, wy: number, sprs: SprBank
) {
  const spr = sprs["internal_wall_sprite"]
  if (!spr || !spr.complete || !spr.naturalWidth) return

  const rw = 226, rh = 106, pL = 26, pT = 21, cW = 174, cH = 64

  ctx.save()
  ctx.beginPath(); ctx.rect(sx, sy, w, h); ctx.clip()

  const sxStart = Math.floor(wx / cW)
  const sxEnd   = Math.ceil((wx + w) / cW)
  const syStart = Math.floor(wy / cH)
  const syEnd   = Math.ceil((wy + h) / cH)

  for (let sj = syStart; sj <= syEnd; sj++) {
    for (let si = sxStart; si <= sxEnd; si++) {
      const sprX = sx + (si * cW - wx) - pL
      const sprY = sy + (sj * cH - wy) - pT
      ctx.drawImage(spr, sprX, sprY, rw, rh)
    }
  }
  ctx.restore()
}

// ── Plataforma interior sprite ────────────────────────────────────────────────
// P-2.png: 796×228, sin padding. Scale a h=STAIR_H=24 px → rW=84 rH=24 step=84
export function drawPlatformSprite(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  w: number, h: number, wx: number, sprs: SprBank
) {
  const spr = sprs["platform_sprite"]
  if (!spr || !spr.complete || !spr.naturalWidth) {
    // Fallback: estilo procedural mientras carga
    ctx.fillStyle = "#1A2A40BB"; ctx.fillRect(sx, sy, w, h)
    ctx.fillStyle = "#263A58";   ctx.fillRect(sx, sy, w, 2)
    return
  }
  // Estirar el sprite para cubrir exactamente toda la plataforma (w×h)
  ctx.drawImage(spr, sx, sy, w, h)
}

// ── Piso / Techo sprite ───────────────────────────────────────────────────────
// F-1.png: PIL 1088×512, scale a content-h = WT = 24 px exactos:
//   rW=76 rH=36  pL=8 pR=8 pT=6 pB=6  cW=60 cH=24
// El contenido (60×24) encaja perfecto en el tile (h=WT=24) sin desbordamiento.
// floor (flip=false): contenido top en sy   (superficie superior, donde pisa el jugador)
// ceil  (flip=true) : flip vertical, contenido near-edge en sy+h (superficie inferior techo)
export function drawFloorSprite(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  w: number, h: number, wx: number, sprs: SprBank, flip: boolean
) {
  const spr = sprs["floor_w1_base"]
  if (!spr || !spr.complete || !spr.naturalWidth) return

  // Dimensiones a content-h=24 (= WT)
  const rw = 76, rh = 36, pL = 8, pT = 6, cW = 60

  ctx.save()
  ctx.beginPath(); ctx.rect(sx, sy, w, h); ctx.clip()

  // Índice de slot alineado al mundo (determinista)
  const slotStart = Math.floor(wx / cW)
  const slotEnd   = Math.ceil((wx + w) / cW)

  if (flip) {
    // Techo: flip vertical alrededor de sy+h
    // transform: translate(0, sy+h) + scale(1,-1)
    // → drawImage en sprY_t=-pT coloca contenido-top en pantalla sy+h ✓
    ctx.save()
    ctx.translate(0, sy + h)
    ctx.scale(1, -1)
    for (let si = slotStart; si <= slotEnd; si++) {
      const sprX = sx + (si * cW - wx) - pL
      ctx.drawImage(spr, sprX, -pT, rw, rh)
    }
    ctx.restore()
  } else {
    // Piso: normal, contenido-top en sy
    for (let si = slotStart; si <= slotEnd; si++) {
      const sprX = sx + (si * cW - wx) - pL
      ctx.drawImage(spr, sprX, sy - pT, rw, rh)
    }
  }
  ctx.restore()
}

export function drawWalls(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank = {}) {
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
      const isCyanGate    = p.sw !== undefined && p.sw >= 100 && p.sw < 200
      const isUltraGate   = p.sw !== undefined && p.sw >= 200 && p.sw < 300
      const isP1BossGate  = p.sw !== undefined && p.sw >= 300 && p.sw < 400
      const isP2BossGate  = p.sw !== undefined && p.sw >= 400 && p.sw < 500
      // ★ SELLADO VISUAL COMPLETO: expandir 1px en cada borde para cubrir cualquier
      //   seam sub-pixel entre el panel de puerta y las paredes adyacentes.
      const vx = sx - 1, vy = sy - 1, vw = p.w + 2, vh = p.h + 2
      if (isP2BossGate) {
        // Puerta roja Jefe P2 — sellada hasta matar enemigos normales de Part2
        ctx.fillStyle = "#280000CC"; ctx.fillRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(180,0,0,${0.45 + 0.35 * Math.sin(t * 1.6)})`; ctx.fillRect(vx + 2, vy + 2, vw - 4, vh - 4)
        ctx.strokeStyle = "#CC0000"; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(255,60,0,${0.8 + 0.2 * Math.sin(t * 2.2)})`
        ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚠", sx + p.w / 2, sy + p.h / 2 + 4); ctx.textAlign = "left"
      } else if (isP1BossGate) {
        // Puerta verde Jefe P1 — sellada hasta matar enemigos normales de Part1
        ctx.fillStyle = "#002800CC"; ctx.fillRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(0,160,60,${0.4 + 0.3 * Math.sin(t * 1.5)})`; ctx.fillRect(vx + 2, vy + 2, vw - 4, vh - 4)
        ctx.strokeStyle = "#00AA44"; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(0,220,90,${0.8 + 0.2 * Math.sin(t * 2)})`
        ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚔", sx + p.w / 2, sy + p.h / 2 + 4); ctx.textAlign = "left"
      } else if (isUltraGate) {
        // Puerta ultra-boss — oscura/dorada, sellada hasta matar AMBOS jefes
        ctx.fillStyle = "#1A1000CC"; ctx.fillRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(200,140,0,${0.4 + 0.3 * Math.sin(t * 1.2)})`; ctx.fillRect(vx + 2, vy + 2, vw - 4, vh - 4)
        ctx.strokeStyle = "#FFB300"; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vw, vh)
        const cx2 = sx + p.w / 2, cy2 = sy + p.h / 2
        ctx.fillStyle = `rgba(255,200,0,${0.8 + 0.2 * Math.sin(t * 2.5)})`
        ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚡", cx2, cy2 + 4); ctx.textAlign = "left"
      } else if (isCyanGate) {
        // Puerta cian — bloqueada hasta matar el boss de la Part1
        ctx.fillStyle = "#003A3ABB"; ctx.fillRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(0,210,200,${0.35 + 0.3 * Math.sin(t * 1.4)})`; ctx.fillRect(vx + 2, vy + 2, vw - 4, vh - 4)
        ctx.strokeStyle = "#00FFEE"; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vw, vh)
        const cx2 = sx + p.w / 2, cy2 = sy + p.h / 2
        ctx.fillStyle = `rgba(0,255,238,${0.7 + 0.3 * Math.sin(t * 2)})`
        ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("🔒", cx2, cy2 + 4); ctx.textAlign = "left"
      } else if (isBossEntrance) {
        // Puerta roja intensa — bloqueada hasta matar enemigos normales
        ctx.fillStyle = "#3A0000BB"; ctx.fillRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(200,0,0,${0.5 + 0.4 * Math.sin(t * 1.8)})`; ctx.fillRect(vx + 2, vy + 2, vw - 4, vh - 4)
        ctx.strokeStyle = "#FF2200"; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vw, vh)
        ctx.fillStyle = "#FF4400"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚠BOSS⚠", sx + p.w / 2, sy + p.h / 2 + 3); ctx.textAlign = "left"
      } else {
        ctx.fillStyle = th.doorC + "BB"; ctx.fillRect(vx, vy, vw, vh)
        ctx.fillStyle = `rgba(255,80,0,${0.3 + 0.3 * Math.sin(t)})`; ctx.fillRect(vx + 2, vy + 2, vw - 4, vh - 4)
        ctx.strokeStyle = th.doorC; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vw, vh)
        ctx.fillStyle = "#FFF"; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("██SELLADO██", sx + p.w / 2, sy + p.h / 2 + 4); ctx.textAlign = "left"
      }
      continue
    }

    const pWi = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
    // Zona según la fila del tile (p.y es coordenada absoluta del mundo)
    const tileRow = Math.floor(p.y / RH)
    const zone: "p1" | "trow" | "p2" = tileRow < TROW ? "p1" : tileRow === TROW ? "trow" : "p2"

    // Plataforma atravesable
    if (p.mode === "t") {
      drawTraversableTile(ctx, sx, sy, p.w, p.h, pWi, g.gfx, zone)
      continue
    }

    // ── Piso / Techo sprite ──────────────────────────────────────────────────
    // floor: solid h=WT, p.y%RH ≈ RH-WT (656)
    // ceil : solid h=WT, p.y%RH ≈ 0
    const yInRoom = p.y % RH
    const isFloorTile = p.h === WT && Math.abs(yInRoom - (RH - WT)) < 4
    const isCeilTile  = p.h === WT && yInRoom < 4
    if (isFloorTile || isCeilTile) {
      drawFloorSprite(ctx, sx, sy, p.w, p.h, p.x, sprs, isCeilTile)
      continue
    }

    // ── Plataforma interior (stair): h=STAIR_H, no es piso ni techo ──
    // Condición: misma h que WT (=STAIR_H=24), yInRoom fuera de los bordes del cuarto
    const isPlatTile = p.h === STAIR_H && yInRoom >= WT + 4 && yInRoom <= RH - WT - STAIR_H - 4 && p.w >= 36
    if (isPlatTile) {
      drawPlatformSprite(ctx, sx, sy, p.w, p.h, p.x, sprs)
      continue
    }

    // ── Pared lateral sprite ─────────────────────────────────────────────────
    // Pared = p.w === WT, altura > STAIR_H (las paredes son altas, no delgadas)
    // Izquierda: p.x % RW === 0 | Derecha: (p.x + p.w) % RW === 0
    if (p.w === WT && p.h > STAIR_H) {
      const isRightWall = (p.x + p.w) % RW === 0
      drawWallSprite(ctx, sx, sy, p.w, p.h, p.y, sprs, isRightWall)
      continue
    }

    // ── Bloque sólido interior: sprite W-2 con fallback procedural ───────────
    const hash = ((p.x * 7 + p.y * 13) >>> 0) % 16
    drawSolidTile(ctx, sx, sy, p.w, p.h, pWi, hash, g.gfx, p.x, p.y, zone)
    drawInternalWallSprite(ctx, sx, sy, p.w, p.h, p.x, p.y, sprs)
  }
}

export function drawCheckpoints(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank = {}) {
  const p = g.pl, t = Date.now() * 0.001
  for (const cp of ALL_CPS) {
    const bedCX = cp.x + PW / 2, bedCY = cp.y + PH
    const sx = bedCX - g.cx, sy = bedCY - g.cy
    if (sx + 90 < 0 || sx - 90 > CW || sy + 10 < 0 || sy - 80 > CH) continue

    const th = THEMES[cp.w]
    const discovered = g.discoveredCPs.has(cp.id)
    const isSpawn = g.checkpoint.w === cp.w && Math.abs(g.checkpoint.x - cp.x) < 40
    const isKennel = KENNEL_ROOMS[cp.w].c === cp.c && KENNEL_ROOMS[cp.w].r === cp.r
    const isBossCP = !!cp.bossKind
    const bossUnlocked = isBossCP ? isBossCPUnlocked(g, cp) : true
    const dx = p.x + p.w / 2 - bedCX, dy = p.y + p.h / 2 - (bedCY - PH / 2)
    const near = Math.sqrt(dx * dx + dy * dy) < CP_RADIUS
    const pulse = 0.65 + 0.35 * Math.sin(t * 2.8)

    // Boss CP aún bloqueado: solo dibujar un indicador oscuro con cerradura
    if (isBossCP && !bossUnlocked) {
      const lockCol = cp.bossKind === "p1" ? "#00AA44" : cp.bossKind === "p2" ? "#CC0000" : "#FFB300"
      ctx.fillStyle = `rgba(0,0,0,0.5)`; ctx.beginPath(); ctx.roundRect(sx - 14, sy - 32, 28, 28, 4); ctx.fill()
      ctx.strokeStyle = lockCol + "88"; ctx.lineWidth = 1; ctx.strokeRect(sx - 14, sy - 32, 28, 28)
      ctx.fillStyle = lockCol + "AA"; ctx.font = "16px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText("🔒", sx, sy - 11); ctx.textAlign = "left"
      continue
    }

    // Boss CP desbloqueado pero no recompensado aún: brillo especial dorado
    if (isBossCP && !g.bossRewardedCPs.has(cp.id)) {
      const gld = `rgba(255,215,0,${0.5 + 0.4 * Math.sin(t * 3)})`
      const grad2 = ctx.createRadialGradient(sx, sy - 20, 4, sx, sy - 20, 48)
      grad2.addColorStop(0, gld); grad2.addColorStop(1, "rgba(255,200,0,0)")
      ctx.fillStyle = grad2; ctx.beginPath(); ctx.arc(sx, sy - 20, 48, 0, Math.PI * 2); ctx.fill()
    }

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
      // ── Sprite de kennel por mundo ─────────────────────────────────────
      // W0→ambar  W1→red  W2→blue  W3→violet
      const KENNEL_KEYS = ["kennel_ambar", "kennel_red", "kennel_blue", "kennel_violet"]
      // rw, rh: tamaño de render. feet: píxeles desde arriba hasta el suelo del sprite.
      // Calculados con PIL para que el contenido mida ~88 px y las bases toquen sy.
      const KENNEL_DIM: { rw: number; rh: number; feet: number }[] = [
        { rw: 130, rh: 130, feet: 117 },  // ambar (1254×1254)
        { rw: 158, rh: 130, feet: 114 },  // red   (1386×1135)
        { rw: 130, rh: 130, feet: 116 },  // blue  (1254×1254)
        { rw: 158, rh: 130, feet: 112 },  // violet(1386×1135)
      ]
      const wi = Math.max(0, Math.min(cp.w, 3))
      const kspr = sprs[KENNEL_KEYS[wi]]
      const { rw: krw, rh: krh, feet } = KENNEL_DIM[wi]
      const krx = sx - krw / 2
      const kry = sy - feet

      if (kspr && kspr.complete && kspr.naturalWidth > 0) {
        // Tint de color cuando es el punto activo (resplandor leve)
        if (isSpawn) {
          ctx.save()
          ctx.shadowColor = th.accent
          ctx.shadowBlur = 18
          ctx.drawImage(kspr, krx, kry, krw, krh)
          ctx.restore()
        } else {
          // Sin descubrir: mostrar a menor opacidad
          ctx.save()
          ctx.globalAlpha = discovered ? 1 : 0.45
          ctx.drawImage(kspr, krx, kry, krw, krh)
          ctx.restore()
        }
      } else {
        // Fallback procedural mientras carga el sprite
        const kw = 78, kh = 58
        ctx.fillStyle = isSpawn ? th.wall + "EE" : discovered ? "#1E2420" : "#181818"
        ctx.fillRect(sx - kw / 2, sy - kh, kw, kh)
        ctx.fillStyle = isSpawn ? th.accent : discovered ? th.rockHi : "#2A2A2A"
        ctx.beginPath(); ctx.moveTo(sx - kw / 2 - 8, sy - kh); ctx.lineTo(sx, sy - kh - 30)
        ctx.lineTo(sx + kw / 2 + 8, sy - kh); ctx.closePath(); ctx.fill()
        ctx.fillStyle = "#0A0A0A"
        ctx.beginPath(); ctx.arc(sx, sy - 16, 16, Math.PI, 0); ctx.rect(sx - 16, sy - 16, 32, 16); ctx.fill()
      }
    } else {
      // ── Cucha de teletransporte (sprite) ───────────────────────────
      // PIL real: sheet 2544×1506, frame 6×6=424×251
      // Frame0: cW=385 cH=161, padL=19 padT=62 padR=20 padB=28
      // Target content-h≈90px (más grande que Luly): scale=90/161=0.559
      // rW=424*0.559=237 rH=251*0.559=140
      // ryOff: content bottom = rH*(1-28/251)=140*0.888=124.4 → CT_RY=sy-124
      // rxOff: content centered in frame → CT_RX=sx-CT_RW/2=sx-118
      const CT_RW = 237, CT_RH = 140
      const CT_RX = sx - 118  // centra contenido sobre sx
      const CT_RY = sy - 124  // contenido asentado en el suelo (sy=nivel de suelo)
      const ctSpr = sprs["cucha_teleport"]
      if (ctSpr && ctSpr.complete && ctSpr.naturalWidth > 0) {
        // Animación 12fps — spritesheet 6×6 = 36 frames, frame=384×384px
        const CT_FPF  = 1000 / 12           // ≈83 ms/frame — velocidad natural
        const ctFrame = Math.floor(Date.now() / CT_FPF) % 36
        const ctFW    = ctSpr.naturalWidth  / 6
        const ctFH    = ctSpr.naturalHeight / 6
        const ctCol   = ctFrame % 6
        const ctRow   = Math.floor(ctFrame / 6)
        ctx.save()
        if (isSpawn) {
          ctx.shadowColor = th.accent; ctx.shadowBlur = 20
        } else {
          ctx.globalAlpha = discovered ? 1 : 0.40
        }
        ctx.drawImage(ctSpr, ctCol * ctFW, ctRow * ctFH, ctFW, ctFH, CT_RX, CT_RY, CT_RW, CT_RH)
        ctx.restore()
      } else {
        // Fallback procedural mientras carga
        const bw = 56, bh = 22
        ctx.fillStyle = "rgba(0,0,0,0.45)"
        ctx.beginPath(); ctx.ellipse(sx, sy - 4, bw / 2 + 4, 7, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = discovered ? (isSpawn ? th.wall : th.rock) : "#1A1A1A"
        ctx.beginPath(); ctx.ellipse(sx, sy - 10, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = discovered ? (isSpawn ? th.accent + "CC" : th.rockHi) : "#2A2A2A"
        ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy - 10, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.stroke()
      }
    }

    // ── Estrella flotante + nombre cuando es spawn activo ──
    if (isSpawn) {
      const bounce = Math.sin(t * 2) * 3
      ctx.fillStyle = th.accent; ctx.font = "bold 16px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText("★", sx, sy - (isKennel ? 68 : 65) + bounce)
      ctx.font = "9px 'Courier New',monospace"; ctx.fillStyle = th.accent + "BB"
      ctx.fillText(cp.icon + " RESPAWN", sx, sy - (isKennel ? 78 : 75) + bounce)
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
      const gt: GpadType = g.gpadType ?? "keyboard"
      const egt: GpadType = (g.isMobile && gt === "keyboard") ? "xbox" : gt
      const saveKey  = GPAD_BTN.interact[egt]
      const tpKey    = GPAD_BTN.teleport[egt]
      ctx.globalAlpha = pulse
      ctx.fillStyle = "rgba(0,0,0,0.82)"; ctx.beginPath()
      ctx.roundRect(sx - 80, sy - 68, 160, canTP ? 42 : 26, 5); ctx.fill()
      ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText(!isSpawn ? `[${saveKey}]  GUARDAR AQUÍ` : "★  PUNTO ACTIVO", sx, sy - 50)
      if (canTP) {
        ctx.fillStyle = th.accent; ctx.font = "9px 'Courier New',monospace"
        ctx.fillText(`[${tpKey}]  TELETRANSPORTAR`, sx, sy - 36)
      }
      ctx.textAlign = "left"; ctx.globalAlpha = 1
    }
  }
}

// ── Menú de teletransportación ───────────────────────────────────────────────
// ── Helpers del menú de TP ──────────────────────────────────────────────────
export function tpAvailWorlds(g: G): number[] {
  const ws = new Set<number>()
  for (const cp of ALL_CPS) { if (g.discoveredCPs.has(cp.id)) ws.add(cp.w) }
  return [...ws].sort((a, b) => a - b)
}
export function tpCPsInWorld(g: G, w: number): CPDef[] {
  return ALL_CPS.filter(cp => cp.w === w && g.discoveredCPs.has(cp.id))
}
export function _tpClearMvKeys(g: G) {
  g.keys["arrowleft"] = false; g.keys["a"] = false
  g.keys["arrowright"] = false; g.keys["d"] = false
  g.keys["arrowup"] = false; g.keys["w"] = false
  g.keys["arrowdown"] = false; g.keys["s"] = false
  g.pl.runMode = false
}

export function tpOpenMenu(g: G) {
  // Solo puede abrirse si el jugador está junto a una perrera/checkpoint descubierto
  const p = g.pl
  const nearCP = ALL_CPS.some(cp => {
    if (!g.discoveredCPs.has(cp.id)) return false
    const dx = p.x + p.w / 2 - (cp.x + PW / 2)
    const dy = p.y + p.h / 2 - (cp.y + PH)
    return Math.sqrt(dx * dx + dy * dy) < CP_RADIUS
  })
  if (!nearCP) return
  const worlds = tpAvailWorlds(g)
  if (worlds.length === 0) return
  const curW = Math.max(0, Math.min(NW - 1, Math.floor(g.pl.x / (NC * RW))))
  const world = worlds.includes(curW) ? curW : worlds[0]
  g.tpMenu = { open: true, world, cpIdx: 0 }
  g.paused = true
  _tpClearMvKeys(g)
}
export function tpNavWorld(g: G, dir: 1 | -1) {
  if (!g.tpMenu) return
  const worlds = tpAvailWorlds(g)
  if (worlds.length <= 1) return
  const wi = worlds.indexOf(g.tpMenu.world)
  g.tpMenu.world = worlds[(wi + dir + worlds.length) % worlds.length]
  g.tpMenu.cpIdx = 0
}
export function tpNavCP(g: G, dir: 1 | -1) {
  if (!g.tpMenu) return
  const cps = tpCPsInWorld(g, g.tpMenu.world)
  if (cps.length === 0) return
  g.tpMenu.cpIdx = (g.tpMenu.cpIdx + dir + cps.length) % cps.length
}
export function tpDoConfirm(g: G) {
  if (!g.tpMenu?.open) return
  const cps = tpCPsInWorld(g, g.tpMenu.world)
  const dest = cps[g.tpMenu.cpIdx]
  if (!dest) return
  g.tpMenu = null
  g.paused = false
  _tpClearMvKeys(g)
  g.tpAnim = { timer: 0, phase: 0, destX: dest.x, destY: dest.y }
  spawnExplosion(g, g.pl.x + PW / 2, g.pl.y + PH / 2, ["#FFFFFF", "#AAFFAA", "#FFFF88"], 12, 3.5)
}

export function drawTPMenu(ctx: CanvasRenderingContext2D, g: G) {
  if (!g.tpMenu?.open) return
  const gt: GpadType = g.gpadType ?? "keyboard"
  const egt: GpadType = (g.isMobile && gt === "keyboard") ? "xbox" : gt
  const worlds = tpAvailWorlds(g)
  const curW  = g.tpMenu.world
  const th     = THEMES[curW]
  const cps    = tpCPsInWorld(g, curW)
  const selCP  = cps[g.tpMenu.cpIdx] ?? null
  const playerW = Math.max(0, Math.min(NW - 1, Math.floor(g.pl.x / (NC * RW))))

  // ── Panel dimensions ───────────────────────────────────────────────────────
  const mW = 430, mH = 370
  const mX = Math.round((CW - mW) / 2), mY = Math.round((CH - mH) / 2)
  const ARROW_W = 44   // ancho de las flechas laterales
  const HDR_H   = 48   // altura del header
  const FTR_H   = 52   // altura del footer (CP info + world dots)
  const mapX = mX + ARROW_W, mapW = mW - ARROW_W * 2
  const mapY = mY + HDR_H, mapH = mH - HDR_H - FTR_H

  // ── Fondo ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(4,4,8,0.96)"
  ctx.beginPath(); ctx.roundRect(mX, mY, mW, mH, 12); ctx.fill()
  ctx.strokeStyle = th.accent + "CC"; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(mX, mY, mW, mH, 12); ctx.stroke()

  // ── Título + controles ─────────────────────────────────────────────────────
  ctx.fillStyle = th.accent; ctx.font = "bold 13px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText("⚡  TELETRANSPORTACIÓN", mX + mW / 2, mY + 20)
  const navUD = egt === "keyboard" ? "↑↓" : "D↕"
  const navLR = egt === "keyboard" ? "←→" : "D←→"
  const cfm   = GPAD_BTN.confirm[egt], cnl = GPAD_BTN.cancel[egt]
  ctx.fillStyle = "#445544"; ctx.font = "8px 'Courier New',monospace"
  ctx.fillText(`[${navUD}] punto  [${navLR}] mundo  [${cfm}] ir  [${cnl}] cerrar`, mX + mW / 2, mY + 36)
  ctx.textAlign = "left"

  // ── Nombre del mundo actual ────────────────────────────────────────────────
  ctx.fillStyle = th.accent + "DD"; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText(`W${curW + 1} — ${WORLD_NAMES[curW]}`, mX + mW / 2, mapY - 6)
  ctx.textAlign = "left"

  // ── Mini-mapa del mundo actual ─────────────────────────────────────────────
  const gap = 1
  const rW  = Math.floor((mapW - (NC - 1) * gap) / NC)
  const rH  = Math.floor((mapH - (NR - 1) * gap) / NR)
  const gx  = mapX + Math.round((mapW - (rW * NC + gap * (NC - 1))) / 2)
  const gy  = mapY + Math.round((mapH - (rH * NR + gap * (NR - 1))) / 2)

  // Fondo del área de mapa
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(mapX, mapY, mapW, mapH)

  // Celdas
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const rx = gx + c * (rW + gap), ry2 = gy + r * (rH + gap)
    const explored = g.explored.has(`${curW}_${c}_${r}`)
    const zBg = r < TROW ? "rgba(0,22,8,1)" : r === TROW ? "rgba(0,8,22,1)" : "rgba(22,0,0,1)"
    ctx.fillStyle = explored ? zBg : "rgba(0,0,0,0.80)"; ctx.fillRect(rx, ry2, rW, rH)
    if (explored) { ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 0.5; ctx.strokeRect(rx, ry2, rW, rH) }
  }

  // Puertas (solo entre celdas exploradas, muy sutiles)
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    if (!g.explored.has(`${curW}_${c}_${r}`)) continue
    const rx = gx + c * (rW + gap), ry2 = gy + r * (rH + gap)
    const doors = computeDoors(curW, c, r)
    const dh = Math.max(2, Math.round(rH * 0.35)), dw2 = Math.max(2, Math.round(rW * 0.35))
    const dc = th.accent + "55"
    if (doors.R && c < NC - 1 && g.explored.has(`${curW}_${c+1}_${r}`)) { ctx.fillStyle=dc; ctx.fillRect(rx+rW,ry2+Math.round((rH-dh)/2),gap+1,dh) }
    if (doors.D && r < NR - 1 && g.explored.has(`${curW}_${c}_${r+1}`)) { ctx.fillStyle=dc; ctx.fillRect(rx+Math.round((rW-dw2)/2),ry2+rH,dw2,gap+1) }
  }

  // Posición del jugador (si está en este mundo)
  if (curW === playerW) {
    const plC = Math.max(0, Math.min(NC - 1, Math.floor((g.pl.x % (NC * RW)) / RW)))
    const plR = Math.max(0, Math.min(NR - 1, Math.floor(g.pl.y / RH)))
    const prx = gx + plC * (rW + gap) + rW / 2, pry = gy + plR * (rH + gap) + rH / 2
    ctx.fillStyle = "#FFFFFF88"
    ctx.beginPath(); ctx.arc(prx, pry, Math.max(2, rW * 0.14), 0, Math.PI * 2); ctx.fill()
  }

  // CP dots
  const t = Date.now() * 0.003
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i]
    const cx2 = gx + cp.c * (rW + gap) + rW / 2
    const cy2 = gy + cp.r * (rH + gap) + rH / 2
    const isSel = i === g.tpMenu.cpIdx
    const isActive = g.checkpoint.w === cp.w && Math.abs(g.checkpoint.x - cp.x) < 40
    const r2 = Math.max(3.5, rW * 0.22)

    if (isSel) {
      // Anillo pulsante exterior
      const pulse = 0.55 + 0.45 * Math.sin(t * 2.5)
      ctx.strokeStyle = th.accent + Math.round(pulse * 255).toString(16).padStart(2, "0")
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx2, cy2, r2 + 4 + pulse * 3, 0, Math.PI * 2); ctx.stroke()
      // Glow fill
      ctx.fillStyle = th.accent + "44"; ctx.beginPath(); ctx.arc(cx2, cy2, r2 + 6, 0, Math.PI * 2); ctx.fill()
    }
    // Círculo del CP
    ctx.fillStyle = isSel ? th.accent : (isActive ? "#FFD700" : "#888888")
    ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2); ctx.fill()
    // Ícono centrado
    ctx.fillStyle = isSel ? "#000" : (isActive ? "#000" : "#CCC")
    ctx.font = `bold ${Math.max(7, Math.round(r2 * 1.4))}px 'Courier New',monospace`
    ctx.textAlign = "center"
    ctx.fillText(String(i + 1), cx2, cy2 + Math.round(r2 * 0.42))
    ctx.textAlign = "left"
  }

  // ── Flechas de mundo izquierda / derecha ──────────────────────────────────
  const hasPrev = worlds.length > 1
  const arrowAlpha = hasPrev ? 0.80 : 0.18
  const arrowY = mY + mH / 2
  // Izquierda
  ctx.save(); ctx.globalAlpha = arrowAlpha
  ctx.fillStyle = hasPrev ? th.accent : "#333"
  ctx.beginPath(); ctx.moveTo(mX + ARROW_W - 8, arrowY); ctx.lineTo(mX + 10, arrowY - 14); ctx.lineTo(mX + 10, arrowY + 14); ctx.closePath(); ctx.fill()
  // Derecha
  ctx.beginPath(); ctx.moveTo(mX + mW - ARROW_W + 8, arrowY); ctx.lineTo(mX + mW - 10, arrowY - 14); ctx.lineTo(mX + mW - 10, arrowY + 14); ctx.closePath(); ctx.fill()
  ctx.restore()

  // ── Footer: info del CP seleccionado + puntos de mundo ────────────────────
  const ftY = mY + mH - FTR_H
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(mX + 1, ftY, mW - 2, FTR_H - 1)

  if (selCP) {
    const isActive = g.checkpoint.w === selCP.w && Math.abs(g.checkpoint.x - selCP.x) < 40
    ctx.fillStyle = th.accent; ctx.font = "bold 11px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(`${selCP.icon}  ${selCP.label}`, mX + mW / 2, ftY + 16)
    ctx.fillStyle = "#556655"; ctx.font = "8px 'Courier New',monospace"
    ctx.fillText(isActive ? "★ spawn activo" : `${WORLD_NAMES[selCP.w]} · W${selCP.w + 1}`, mX + mW / 2, ftY + 28)
  }

  // Indicadores de mundo (dots)
  const dotSpacing = 16, dotsW = worlds.length * dotSpacing - 4
  let dx = mX + Math.round((mW - dotsW) / 2)
  for (const w of worlds) {
    const isCur = w === curW
    ctx.fillStyle = isCur ? THEMES[w].accent : "#444"
    ctx.beginPath(); ctx.arc(dx + 4, ftY + 42, isCur ? 5 : 3, 0, Math.PI * 2); ctx.fill()
    if (isCur) { ctx.strokeStyle = THEMES[w].accent + "66"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dx + 4, ftY + 42, 8, 0, Math.PI * 2); ctx.stroke() }
    dx += dotSpacing
  }
  ctx.textAlign = "left"
}

export function drawPlayer(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const p = g.pl; if (p.inv > 0 && Math.floor(Date.now() / 80) % 2 === 0) return
  const sx = p.x - g.cx, sy = p.y - g.cy
  const spr = sprs["player_" + p.pa] || sprs["player_idle"]
  if (spr && spr.complete && spr.naturalWidth > 0) {
    // 5×5 spritesheet (25fps)
    const fw = spr.width / 5, fh = spr.height / 5
    const col = p.pf % 5, row = Math.floor(p.pf / 5)

    // ── Dimensiones normalizadas por animación ────────────────────────────
    // Objetivo: personaje de 68 px de alto consistente entre estados.
    // Medidas con PIL sobre frame 0 de cada sheet (charH, padBot, padLeft).
    //   rw, rh  = tamaño de render del frame completo (mantiene aspect ratio)
    //   ryOff   = ry = sy + ryOff  → pies del personaje en sy+PH (suelo del hitbox)
    //   rxOff   = rx = sx + rxOff  → sprite centrado sobre el centro del hitbox
    // dash_* se mantienen en PW×PH (animación muy breve, frame inusual).
    type LulyDim = { rw: number; rh: number; ryOff: number; rxOff: number }
    // Dimensiones calculadas a partir de PIL sobre cada spritesheet 5×5 (256px/frame)
    // Objetivo: contenido del personaje = 68px en pantalla, pies anclados a sy+PH=sy+72
    const LULY_DIM: Record<string, LulyDim> = {
      idle:           { rw:  50, rh:  69, ryOff:   4, rxOff:  -1 },
      idle_left:      { rw:  50, rh:  69, ryOff:   4, rxOff:  -1 },
      walk:           { rw:  84, rh:  71, ryOff:   3, rxOff: -18 },
      walk_left:      { rw:  84, rh:  71, ryOff:   3, rxOff: -18 },
      slow_walk:      { rw:  66, rh:  76, ryOff:  -3, rxOff: -11 },
      slow_walk_left: { rw:  66, rh:  76, ryOff:  -3, rxOff:  -7 },
      run:            { rw:  69, rh:  70, ryOff:   3, rxOff: -10 },
      run_left:       { rw:  69, rh:  70, ryOff:   3, rxOff: -10 },
      jump:           { rw:  59, rh: 105, ryOff: -17, rxOff:  -9 },
      jump_left:      { rw:  59, rh: 105, ryOff: -17, rxOff:  -3 },
      attack:            { rw:  50, rh:  69, ryOff:   4, rxOff:  -1 },  // fallback=idle
      fall:              { rw:  62, rh:  78, ryOff:  -1, rxOff:   0 },  // frame0: 233x295, cH=257
      fall_left:         { rw:  62, rh:  78, ryOff:  -1, rxOff:   0 },
      atack_bone:        { rw:  66, rh:  69, ryOff:   3, rxOff:   0 },  // frame0: 251x261, cH=257
      atack_bone_left:   { rw:  66, rh:  69, ryOff:   3, rxOff:   0 },
      atack_correa:      { rw: 127, rh:  76, ryOff:  -1, rxOff:  -1 },  // frame0: 335x201, Luly izq, correa dcha
      atack_correa_left: { rw: 126, rh:  76, ryOff:   0, rxOff: -79 },  // Luly dcha, correa extiende izq
      dash_right:        { rw:  PW, rh:  PH, ryOff:   0, rxOff:   0 },
      dash_left:         { rw:  PW, rh:  PH, ryOff:   0, rxOff:   0 },
      // Celular: frame 170×262, contenido 9-161 × 4-260, target charH=68px
      // scale = 69/262 ≈ 0.263 → rw=45 rh=69; charCenterX=22px → rxOff=-7
      celular_right:     { rw:  45, rh:  69, ryOff:   3, rxOff:  -7 },
      celular_left:      { rw:  45, rh:  69, ryOff:   3, rxOff:  -7 },
    }
    const dim: LulyDim = LULY_DIM[p.pa] ?? LULY_DIM.idle
    const rw = dim.rw, rh = dim.rh
    const rx = sx + dim.rxOff
    const ry = sy + dim.ryOff

    // Los sprites *_left ya están en la dirección correcta: NO reflejar
    const ownLeftSprite = p.pa.endsWith("_left")

    if (p.facing === -1 && !ownLeftSprite) {
      ctx.save(); ctx.translate(rx + rw, ry); ctx.scale(-1, 1)
      ctx.drawImage(spr, col * fw, row * fh, fw, fh, 0, 0, rw, rh)
      ctx.restore()
    } else {
      ctx.drawImage(spr, col * fw, row * fh, fw, fh, rx, ry, rw, rh)
    }
    return
  }
  ctx.save(); if (p.facing === -1) { ctx.translate(sx + p.w, sy); ctx.scale(-1, 1) } else ctx.translate(sx, sy)
  const hp = p.hp / p.maxHp; ctx.fillStyle = hp > 0.66 ? "#D2B48C" : hp > 0.33 ? "#C19A6B" : "#A0785A"
  ctx.fillRect(4, 16, 22, 26); ctx.fillRect(6, 2, 20, 18); ctx.fillStyle = "#555"; ctx.fillRect(3, 0, 26, 12); ctx.fillRect(2, 4, 28, 10)
  ctx.fillStyle = "#888"; ctx.fillRect(8, 2, 16, 8); ctx.fillStyle = "#00BFFF44"; ctx.fillRect(8, 4, 16, 7)
  ctx.fillStyle = "#FFF"; ctx.fillRect(9, 6, 4, 3); ctx.fillRect(19, 6, 4, 3); ctx.fillStyle = "#111"; ctx.fillRect(10, 7, 2, 2); ctx.fillRect(20, 7, 2, 2)
  ctx.fillStyle = "#FFD700"; ctx.fillRect(13, 23, 6, 2); ctx.restore()
}

// enemySection, getBossSection, isW1P1Boss, isW1P2Boss are imported from physics.ts

// Resuelve el sprite correcto con cadena de fallbacks:
//   1. Sprite específico del mundo+sección+animación+dirección
//   2. Variante sin dirección (ej: idle único para esa sección)
//   3. Variante de la dirección opuesta (si solo existe un lado)
// Los jefes usan el nuevo sistema: boss_w{N}_{fs|ss|fb}_{anim}_{right|left}
export function resolveEnemySpr(e: Enemy, sprs: SprBank): HTMLImageElement | null {
  const dir = (e.dying || e.deathFalling ? e.deathDir : e.dir) >= 0 ? "right" : "left"
  const opp = dir === "right" ? "left" : "right"
  const ok  = (k: string) => { const s = sprs[k]; return s?.complete && s.naturalWidth > 0 ? s : null }

  if (e.boss) {
    const wn = Math.max(1, Math.min(e.world + 1, NW))  // 1-indexed
    const bsec = getBossSection(e)
    const bpk = `boss_w${wn}_${bsec}_`
    let banim: string
    if (e.dying) {
      banim = "death"
    } else if (isW1P2Boss(e) && e.spinTimer > 0) {
      // Giro del Blacksmith → Atack_2
      banim = "atack2"
    } else if (isW1P2Boss(e) && e.stunTimer > 0) {
      // Parálisis post-giro → sprite mareado (cansado/aturdido)
      banim = "mareado"
    } else if (e.sa > 0) {
      banim = e.phase >= 2 ? "atack2" : "atack1"
    } else if (e.phase >= 2) {
      banim = "rage_walk"
    } else {
      banim = "walk"
    }
    return ok(`${bpk}${banim}_${dir}`) ?? ok(`${bpk}${banim}_${opp}`) ?? null
  }

  const w   = Math.max(1, Math.min(e.world + 1, NW))  // 1-indexed (1-4)
  const sec = enemySection(e)                          // "f" | "s"
  const pk  = `e_w${w}_${sec}_`

  let keys: string[]
  if (e.dying) {
    keys = [`${pk}death_${dir}`, `${pk}death_${opp}`, `${pk}idle_${dir}`, `${pk}idle`]
  } else if (e.deathFalling) {
    // Cayendo tras recibir golpe mortal — usar hurt como transición
    keys = [`${pk}hurt_${dir}`, `${pk}hurt_${opp}`, `${pk}idle_${dir}`, `${pk}idle`]
  } else if (e.hurtTimer > 0) {
    keys = [`${pk}hurt_${dir}`, `${pk}hurt_${opp}`, `${pk}idle_${dir}`, `${pk}idle`]
  } else if (e.sa > 0) {
    // W1S2: atack1 si hay chainHit, atack2 si disparó rayo; resto: phase
    const isW1S2spr = e.world === 0 && sec === "s"
    let pn: number
    if (isW1S2spr) {
      pn = e.chainHit ? 1 : 2
    } else {
      pn = (e.phase || 0) % 2 + 1
    }
    keys = [`${pk}atack${pn}_${dir}`, `${pk}atack${pn}`, `${pk}atack_${dir}`, `${pk}atack`, `${pk}idle_${dir}`, `${pk}idle`]
  } else if (e.isMoving) {
    keys = [`${pk}walk_${dir}`, `${pk}walk_${opp}`, `${pk}idle_${dir}`, `${pk}idle`]
  } else {
    keys = [`${pk}idle_${dir}`, `${pk}idle_${opp}`, `${pk}idle`]
  }

  for (const k of keys) { const s = ok(k); if (s) return s }
  return null
}

export function drawSpriteFrame(ctx: CanvasRenderingContext2D, spr: HTMLImageElement, frame: number, dx: number, dy: number, dw: number, dh: number, gridCols = 4, gridRows = 4) {
  const fw = spr.width / gridCols, fh = spr.height / gridRows
  const col = frame % gridCols, row = Math.floor(frame / gridCols)
  ctx.drawImage(spr, col * fw, row * fh, fw, fh, dx, dy, dw, dh)
}

// Dimensiones de render por tipo y animación (desacopla visual del hitbox)
// Escala objetivo W1S2: content-h=68px (scale≈0.2646 sobre cH=257px constante)
// Cálculos: rw=fw*scale, rh=fh*scale, ryOff=eH-rh*(1-padB/fh), rxOff=eW/2-rw/2
export function getEnemyRenderDim(e: Enemy): { rw: number; rh: number; rxOff: number; ryOff: number } {
  const eW = e.w, eH = e.h

  // ── W1 Second Section (eW=60, eH=72) ── solo enemigos normales, NO el boss ─
  if (e.world === 0 && enemySection(e) === "s" && !e.boss) {
    // Determinar animación actual (misma lógica que resolveEnemySpr)
    if (e.dying) {
      // death: sheet 1112×1112, frame 278×278, cH=257, padB=11
      // rh=278*0.265=73.7→74, rw=278*0.265=74, ryOff=72-74*(1-11/278)=72-71.1=1, rxOff=30-37=-7
      return { rw: 74, rh: 74, rxOff: -7, ryOff: 1 }
    }
    if (e.hurtTimer > 0) {
      // hurt: sheet 1032×1120, frame 258×280, cH=257, padB=12
      // rh=280*0.265=74.2→74, rw=258*0.265=68.4→68, ryOff=72-74*(1-12/280)=72-70.8=1, rxOff=30-34=-4
      return { rw: 68, rh: 74, rxOff: -4, ryOff: 1 }
    }
    if (e.chainHit || e.sa > 0) {
      // atack1: frame 258×264; atack2: frame 258×262 — similares
      // rh≈70, rw=68, rxOff=-4, ryOff=3-4 → usar atack1 como referencia
      return { rw: 68, rh: 70, rxOff: -4, ryOff: 3 }
    }
    if (e.isMoving) {
      // walk: sheet 780×1052, frame 195×263, cH=257, padB=3
      // rh=263*0.265=69.7→70, rw=195*0.265=51.7→52, ryOff=72-70*(1-3/263)=72-69.2=3, rxOff=30-26=4
      return { rw: 52, rh: 70, rxOff: 4, ryOff: 3 }
    }
    // idle: sheet 968×1056, frame 242×264, cH=257, padB=4
    // rh=264*0.265=70, rw=242*0.265=64.1→64, ryOff=3, rxOff=30-32=-2
    return { rw: 64, rh: 70, rxOff: -2, ryOff: 3 }
  }

  // ── W1 Second Section Boss (eW=140, eH=220) — Blacksmith (~3× Luly) ─────
  // Valores PIL: scale = 220 / cH(frame0), eW/2 = 70
  // Walk_right:      fw=303,fh=411, cW=263,cH=387,padL=10, padB=14  scale=0.5685
  // Walk_left:       fw=303,fh=411, cW=247,cH=385,padL=28, padB=13  scale=0.5714
  // Atack_1_(both):  fw=494,fh=571, cW=247,cH=385,padL=124,padB=93  scale=0.5714
  // Atack_2 (sprite actualizado 533×441):  min_padB=26, ref_frame cH=384 → scale=0.5729
  //   rw=305  rh=253  rxOff=-83  ryOff=-18  (simétrico: mismo valor para right y left)
  // Death_right:     fw=478,fh=463, cW=247,cH=386,padL=115,padB=39  scale=0.5699
  // Death_left:      fw=478,fh=463, cW=247,cH=385,padL=116,padB=39  scale=0.5714
  // Rage_Walk (354×440): min_padB=25, cH=385 → scale=0.5714  rw=202 rh=251 ryOff=-17
  //   right: rxOff=-32   left: rxOff=-31
  // Mareado (374×424): min_padB=20, cH=385 → scale=0.5714  rw=214 rh=242 rxOff=-37 ryOff=-11
  if (isW1P2Boss(e)) {
    const dir3 = (e.dying ? e.deathDir : e.dir) >= 0
    if (e.dying) {
      return dir3
        ? { rw: 272, rh: 264, rxOff: -66, ryOff: -22 }  // Death_right
        : { rw: 273, rh: 265, rxOff: -67, ryOff: -23 }  // Death_left
    }
    if (e.stunTimer > 0) {
      // Mareado: aturdido post-giro (simétrico)
      return { rw: 214, rh: 242, rxOff: -37, ryOff: -11 }
    }
    if (e.spinTimer > 0 || (e.sa > 0 && e.phase >= 2)) {
      // Atack_2: giro del martillo — sprite recalculado (533×441, min_padB=26)
      return { rw: 305, rh: 253, rxOff: -83, ryOff: -18 }
    }
    if (e.sa > 0 && e.spinTimer <= 0) {
      // Atack_1: golpe de piso
      return dir3
        ? { rw: 282, rh: 326, rxOff: -71, ryOff: -53 }  // right
        : { rw: 282, rh: 326, rxOff: -71, ryOff: -53 }  // left (simétrico)
    }
    if (e.phase >= 2) {
      // Rage_Walk — corregido con min_padB=25
      return dir3
        ? { rw: 202, rh: 251, rxOff: -32, ryOff: -17 }  // right
        : { rw: 202, rh: 251, rxOff: -31, ryOff: -17 }  // left
    }
    // Walk normal
    return dir3
      ? { rw: 172, rh: 234, rxOff: -10, ryOff:  -6 }  // right
      : { rw: 173, rh: 235, rxOff: -17, ryOff:  -8 }  // left
  }

  // ── W1 First Section Boss (eW=64, eH=84) ─────────────────────────
  // Valores PIL sobre frame 0 de cada spritesheet 5×5.
  // Scale = 84 / contentH  →  rw=fw*scale, rh=fh*scale
  // ryOff = eH − rh*(1−padB/fh)  →  pies del personaje en sy+eH
  // rxOff = eW/2 − (padL+cW/2)*scale  →  centro del contenido sobre centro del hitbox
  // ── W1 First Section Boss — El Castigador (eW=64, eH=84) ─────────────────
  // Escala fija desde Walk_right (cH=374, TARGET_CH=100) → scale=0.2674
  // ryOff = eH - rh*(1 - minPadB/fh)   rxOff = eW/2 - midC_contenido*scale
  // Sprites analizados sobre los 25 frames de cada spritesheet.
  if (isW1P1Boss(e)) {
    const dir2 = (e.dying ? e.deathDir : e.dir) >= 0   // true=right
    if (e.dying) {
      // Death_right: fw=484 fh=424 minPadB=0   → rw=129 rh=113 ryOff=-29 rxOff=-35
      // Death_left:  fw=484 fh=415 minPadB=2   → rw=129 rh=111 ryOff=-26 rxOff=-23
      return dir2
        ? { rw: 129, rh: 113, rxOff: -35, ryOff: -29 }  // right
        : { rw: 129, rh: 111, rxOff: -23, ryOff: -26 }  // left
    }
    if (e.chainHit || e.sa > 0) {
      if (e.phase >= 2) {
        // Atack_2_right: fw=505 fh=500 minPadB=0  → rw=135 rh=134 ryOff=-50 rxOff=-34
        // Atack_2_left:  fw=505 fh=511 minPadB=30 → rw=135 rh=137 ryOff=-45 rxOff=-30
        return dir2
          ? { rw: 135, rh: 134, rxOff: -34, ryOff: -50 }  // right
          : { rw: 135, rh: 137, rxOff: -30, ryOff: -45 }  // left
      }
      // Atack_1_right: fw=505 fh=485 minPadB=0  → rw=135 rh=130 ryOff=-46 rxOff=-43
      // Atack_1_left:  fw=505 fh=501 minPadB=56 → rw=135 rh=134 ryOff=-35 rxOff=-34
      return dir2
        ? { rw: 135, rh: 130, rxOff: -43, ryOff: -46 }  // right
        : { rw: 135, rh: 134, rxOff: -34, ryOff: -35 }  // left
    }
    if (e.phase >= 2) {
      // Rage_Walk_right: fw=462 fh=442 minPadB=0  → rw=124 rh=118 ryOff=-34 rxOff=-31
      // Rage_Walk_left:  fw=463 fh=440 minPadB=17 → rw=124 rh=118 ryOff=-29 rxOff=-23
      return dir2
        ? { rw: 124, rh: 118, rxOff: -31, ryOff: -34 }  // right
        : { rw: 124, rh: 118, rxOff: -23, ryOff: -29 }  // left
    }
    // Walk_right: fw=464 fh=400 minPadB=0  → rw=124 rh=107 ryOff=-23 rxOff=-30
    // Walk_left:  fw=464 fh=400 minPadB=0  → rw=124 rh=107 ryOff=-23 rxOff=-30
    return { rw: 124, rh: 107, rxOff: -30, ryOff: -23 }  // simétrico
  }

  // ── W1 First Section (eW=96, eH=96) — solo ajuste de muerte ───────
  if (e.world === 0 && enemySection(e) === "f" && e.dying) {
    // death_left/right: frame 458×382, cH≈255(L)/189(R)
    // Target cH≈80px para quedar similar al idle (cH=359 a rh=96 → 94px)
    // death_left: scale=80/255=0.314, rh=382*0.314=120, rw=458*0.314=144
    //   ryOff: content_bot=322*0.314=101.1 → ryOff=96-101=−5 ; rxOff: center=247.5*(144/458)=77.9 → rxOff=48−78=−30
    // death_right: scale=80/189=0.423, rh=382*0.423=162, rw=458*0.423=194
    //   ryOff: content_bot=337*0.423=142.5 → ryOff=96−142=−46 ; rxOff: center=123*(194/458)=52.1 → rxOff=48−52=−4
    const facingLeft = e.deathDir < 0
    if (facingLeft) {
      return { rw: 144, rh: 120, rxOff: -30, ryOff: -5 }
    } else {
      return { rw: 194, rh: 162, rxOff: -4, ryOff: -46 }
    }
  }

  // ── El Torturado — Ultra Boss (eW=70, eH=100) — target char height 130px ─────
  // Sprites 384×384 (5×5 grid), valores PIL por animación.
  if (isUltraBoss(e)) {
    const dir4 = (e.dying ? e.deathDir : e.dir) >= 0   // true=right
    if (e.dying) {
      return dir4
        ? { rw: 127, rh: 229, rxOff: -30, ryOff: -75 }  // Death_right
        : { rw: 127, rh: 229, rxOff: -28, ryOff: -75 }  // Death_left
    }
    if (e.sa > 0) {
      if (e.phase >= 2) {
        return { rw: 136, rh: 210, rxOff: -33, ryOff: -70 }  // Atack_2 (simétrico)
      }
      return dir4
        ? { rw: 119, rh: 218, rxOff: -21, ryOff: -68 }  // Atack_1_right
        : { rw: 119, rh: 218, rxOff: -24, ryOff: -68 }  // Atack_1_left
    }
    if (e.phase >= 2) {
      return dir4
        ? { rw: 102, rh: 223, rxOff: -14, ryOff: -78 }  // Rage_Walk_right
        : { rw: 102, rh: 223, rxOff: -16, ryOff: -78 }  // Rage_Walk_left
    }
    // Walk fase 1 (simétrico)
    return { rw: 69, rh: 167, rxOff: 0, ryOff: -43 }
  }

  // Default: el sprite ocupa exactamente el hitbox
  return { rw: eW, rh: eH, rxOff: 0, ryOff: 0 }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  for (const e of g.enemies) {
    if (g.noEnemies && !e.boss) continue  // noEnemies: oculta enemigos normales pero muestra bosses
    if (!e.active) continue
    const sx = e.x - g.cx, sy = e.y - g.cy
    if (sx + e.w < -10 || sx > CW + 10 || sy + e.h < -10 || sy > CH + 10) continue
    const wi = Math.max(0, Math.min(e.world, NW - 1)), th = THEMES[wi]
    if (e.dying) {
      // Fade sólo DESPUÉS de completar la animación de muerte
      const deathFrameMax2 = e.boss ? 24 : 15
      const deathAnimEnd2  = deathFrameMax2 * 0.075   // misma constante que el tick
      if (e.ef >= deathFrameMax2) {
        // e.deathTimer en este punto es ≥ deathAnimEnd2; fade de 0.6s
        const t = e.deathTimer - deathAnimEnd2
        ctx.globalAlpha = Math.max(0, 1 - t / 0.6)
      }
      // Si la animación aún no terminó: alpha=1 (opacidad completa)
    }
    if (e.hurtTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) { ctx.globalAlpha = 0.45 }
    const spr = resolveEnemySpr(e, sprs)
    if (spr) {
      const { rw, rh, rxOff, ryOff } = getEnemyRenderDim(e)
      const gc = e.boss ? 5 : 4, gr = e.boss ? 5 : 4
      drawSpriteFrame(ctx, spr, e.ef, sx + rxOff, sy + ryOff, rw, rh, gc, gr)
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

    // ── Chain hit visual (W1S2 únicamente — el W1P2 usa hitbox invisible) ──
    if (e.chainHit && !e.dying && !isW1P2Boss(e)) {
      const ch = e.chainHit
      const lifeRatio = ch.life / 0.22           // 1→0 durante el ataque
      const originX = sx + e.w / 2
      const originY = sy + e.h * 0.4
      const tipX = ch.dir > 0 ? sx + e.w + CHAIN_REACH : sx - CHAIN_REACH
      const tipY = originY
      ctx.save()
      ctx.globalAlpha = Math.max(0, lifeRatio) * 0.92
      // Eslabones de cadena: círculos a lo largo de la línea
      const NUM_LINKS = 6
      for (let li = 0; li <= NUM_LINKS; li++) {
        const t   = li / NUM_LINKS
        const lx  = originX + (tipX - originX) * t
        const ly  = originY + Math.sin(t * Math.PI * 2 + Date.now() / 60) * 3  // leve ondulación
        const r   = li === 0 || li === NUM_LINKS ? 4.5 : 3
        ctx.fillStyle = li % 2 === 0 ? "#AAAAAA" : "#666666"
        ctx.shadowColor = "#CCCCCC"; ctx.shadowBlur = 4
        ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill()
      }
      // Línea principal de la cadena
      ctx.strokeStyle = "#888888"
      ctx.lineWidth   = 2
      ctx.shadowBlur  = 6; ctx.shadowColor = "#AAAAFF"
      ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(tipX, tipY); ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }

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

export function drawWhip(ctx: CanvasRenderingContext2D, g: G) {
  // Visual reemplazado por el sprite atack_correa/atack_correa_left en drawPlayer.
  // La lógica de hitbox/daño sigue en tickWhip (g.whip objeto intacto).
  void ctx; void g
}

export function drawProjs(ctx: CanvasRenderingContext2D, g: G) {
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
    } else if (pr.lightning) {
      // Rayo amarillo del enemigo W1S2
      ctx.rotate(pr.rot * Math.PI / 180)
      ctx.shadowColor = "#FFFF44"; ctx.shadowBlur = 10
      // Cuerpo del rayo: zigzag
      ctx.strokeStyle = "#FFEE00"; ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(-14, 0)
      ctx.lineTo(-6,  -5)
      ctx.lineTo( -1,  1)
      ctx.lineTo(  5, -5)
      ctx.lineTo( 14,  0)
      ctx.stroke()
      // Núcleo brillante
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1
      ctx.stroke()
      // Chispa central
      ctx.fillStyle = "#FFFF88"
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    } else if (pr.star) { ctx.rotate(pr.rot * Math.PI / 180); ctx.fillStyle = th.doorC; ctx.fillRect(-6, -1.5, 12, 3); ctx.fillRect(-1.5, -6, 3, 12) }
    else { ctx.fillStyle = th.doorC + "DD"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = th.doorC; ctx.lineWidth = 2; ctx.stroke() }
    ctx.restore()
  }
}

export function drawBones(ctx: CanvasRenderingContext2D, g: G) {
  for (const b of g.bones) {
    if (!b.active) continue
    const sx = b.x - g.cx, sy = b.y - g.cy
    if (sx < -20 || sx > CW + 20) continue
    ctx.fillStyle = "#F4A460"; ctx.beginPath(); ctx.roundRect(sx, sy, b.w, b.h, 3); ctx.fill()
  }
}

export function drawCrates(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank = {}) {
  // Sprite: sheet 1950×2395, frame 390×479
  // PIL frame0: cW=389 cH=368, padT=56, padB=55
  // 80% de Luly (cH target=55px): scale=55/368=0.149 → rw=58, rh=71
  // ryOff: content bottom = rh*(1-padB/fh)=71*(1-55/479)=62.8 → ryOff=44-62.8≈-19
  // rxOff: content casi llena frame ancho → centrar sobre hitbox (crate.w=44): rxOff=(44-58)/2=-7
  const BOX_RW = 58, BOX_RH = 71
  const BOX_RX_OFF = -7
  const BOX_RY_OFF = -19
  const boxSpr = sprs["box"]

  for (const c of g.crates) {
    if (!c.active) continue
    const sx = c.x - g.cx, sy = c.y - g.cy
    if (sx + c.w < -40 || sx > CW + 40 || sy + c.h < -40 || sy > CH + 40) continue

    if (boxSpr && boxSpr.complete && boxSpr.naturalWidth > 0) {
      // Animación 25fps — spritesheet 5×5 = 25 frames, frame=256×256px
      const BOX_FPF  = 40   // ms/frame = 1000/25
      const boxFrame = Math.floor(Date.now() / BOX_FPF) % 25
      const bFW      = boxSpr.naturalWidth  / 5
      const bFH      = boxSpr.naturalHeight / 5
      const bCol     = boxFrame % 5
      const bRow     = Math.floor(boxFrame / 5)
      ctx.drawImage(boxSpr, bCol * bFW, bRow * bFH, bFW, bFH, sx + BOX_RX_OFF, sy + BOX_RY_OFF, BOX_RW, BOX_RH)
    } else {
      // Fallback procedural mientras carga el sprite
      const wi = Math.max(0, Math.min(Math.floor(c.x / (NC * RW)), NW - 1)), th = THEMES[wi]
      ctx.fillStyle = th.accent; ctx.fillRect(sx, sy, c.w, c.h)
      ctx.fillStyle = th.wallHi;  ctx.fillRect(sx + 2, sy + 2, c.w - 4, c.h - 4)
      ctx.fillStyle = th.wall
      ctx.fillRect(sx + c.w / 2 - 1, sy + 3,       3,      c.h - 6)
      ctx.fillRect(sx + 3,            sy + c.h/2-1, c.w-6,  3)
      ctx.strokeStyle = th.accent + "66"; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, c.w, c.h)
    }
  }
}

export function drawDrops(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank = {}) {
  const heartSpr    = sprs["hud_heart"]
  const boneSpr     = sprs["drop_bone"]
  const tballSpr    = sprs["tennis_ball"]
  const croquetaSpr = sprs["hud_croqueta"]
  const t = Date.now() * 0.004
  const bob = Math.sin(t) * 0.08

  for (const d of g.drops) {
    if (!d.active) continue
    const sx = d.x - g.cx, sy = d.y - g.cy
    const sc = 0.92 + bob  // suave flotación

    if (d.kind === "h") {
      const SZ = 28
      ctx.save(); ctx.translate(sx + SZ/2, sy + SZ/2); ctx.scale(sc, sc)
      if (heartSpr && heartSpr.complete && heartSpr.naturalWidth > 0) {
        ctx.drawImage(heartSpr, -SZ/2, -SZ/2, SZ, SZ)
      } else {
        ctx.fillStyle = "#FF1744"
        ctx.beginPath(); ctx.moveTo(0,8); ctx.bezierCurveTo(0,5,-9,-2,-9,1); ctx.bezierCurveTo(-9,-4,0,-8,0,-3); ctx.bezierCurveTo(0,-8,9,-4,9,1); ctx.bezierCurveTo(9,-2,0,5,0,8); ctx.fill()
      }
      ctx.restore()
    } else if (d.kind === "a") {
      const SZ = 20
      ctx.save(); ctx.translate(sx + SZ/2, sy + SZ/2); ctx.scale(sc, sc)
      if (boneSpr && boneSpr.complete && boneSpr.naturalWidth > 0) {
        ctx.drawImage(boneSpr, -SZ/2, -SZ/2, SZ, SZ)
      } else {
        ctx.fillStyle = "#F5DEB3"; ctx.fillRect(-9,-2,18,4); ctx.fillRect(-2,-9,4,18)
      }
      ctx.restore()
      ctx.fillStyle = "#FFF"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText("+10", sx + SZ/2, sy - 2); ctx.textAlign = "left"
    } else if (d.kind === "tba") {
      const SZ = 22
      ctx.save(); ctx.translate(sx + SZ/2, sy + SZ/2); ctx.scale(sc, sc)
      if (tballSpr && tballSpr.complete && tballSpr.naturalWidth > 0) {
        ctx.drawImage(tballSpr, -SZ/2, -SZ/2, SZ, SZ)
      } else {
        const bg = ctx.createRadialGradient(-2,-2,1,0,0,10); bg.addColorStop(0,"#DDFF44"); bg.addColorStop(0.6,"#88CC00"); bg.addColorStop(1,"#446600")
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill()
      }
      ctx.restore()
      ctx.fillStyle = "#CCFF44"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText(`+${TB_AMMO_DROP}`, sx + SZ/2, sy - 2); ctx.textAlign = "left"
    } else if (d.kind === "c") {
      const SZ = 20
      ctx.save(); ctx.translate(sx + SZ/2, sy + SZ/2); ctx.scale(sc, sc)
      if (croquetaSpr && croquetaSpr.complete && croquetaSpr.naturalWidth > 0) {
        ctx.drawImage(croquetaSpr, -SZ/2, -SZ/2, SZ, SZ)
      } else {
        ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill()
      }
      ctx.restore()
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText("+50", sx + SZ/2, sy - 2); ctx.textAlign = "left"
    }
  }
}

export function getRoomState(w: number, c: number, r: number, dead: Set<string>): "clear" | "half" | "full" {
  const sp = getEnemySpawns(w, c, r); if (sp.length === 0) return "clear"
  const killed = sp.filter((_, i) => isSpawnDead(dead, w, c, r, i)).length
  if (killed >= sp.length) return "clear"; if (killed >= sp.length / 2) return "half"; return "full"
}

export function getCratesInRoom(w: number, c: number, r: number, g: G): number {
  const { x: x0, y: y0 } = ro(w, c, r)
  return g.crates.filter(cr => cr.active && cr.x >= x0 && cr.x < x0 + RW && cr.y >= y0 && cr.y < y0 + RH).length
}

// ══════════════════════════════════════════════════════════════
//  Panel DEV — canvas interno, debajo del minimap
// ══════════════════════════════════════════════════════════════
export function drawDevPanel(ctx: CanvasRenderingContext2D, g: G) {
  if (!g.devMode) return
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))

  // Misma geometría que el minimap para alinearse perfectamente
  const large = !!g.keys["z"]
  const rw = large ? 20 : 12, rh = large ? 14 : 8, gap = large ? 2 : 1
  const gridW = NC * (rw + gap) - gap, gridH = NR * (rh + gap) - gap
  const mpad = 8, mw = gridW + mpad * 2, mh = gridH + mpad * 2 + 14
  const mx = CW - mw - 6, my = CH - mh - 6

  const panX = 4, panY = my
  const panW = mx - panX - 4
  const panH = mh

  // Fondo del panel
  ctx.fillStyle = "rgba(0,10,0,0.92)"
  ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 6); ctx.fill()
  ctx.strokeStyle = "#22AA4488"; ctx.lineWidth = 1
  ctx.strokeRect(panX, panY, panW, panH)

  const font9 = "10px 'Courier New',monospace"
  const font9b = "bold 10px 'Courier New',monospace"
  const LH = 11   // line height
  const TOP = panY + 24  // primera línea de datos (header separado arriba)
  const nCols = 5
  const colW = Math.floor(panW / nCols)

  // Helper: dibuja un header de sección
  const hdr = (label: string, col: number) => {
    ctx.fillStyle = "#22AA44"; ctx.font = font9b; ctx.textAlign = "left"
    ctx.fillText(label, panX + col * colW + 6, panY + 10)
    ctx.fillStyle = "#22AA4455"; ctx.fillRect(panX + col * colW + 5, panY + 12, colW - 10, 1)
  }
  // Helper: dibuja una fila col=índice, row=fila(0-based), key=amarillo, val=verde claro
  const row = (col: number, r: number, key: string, val: string, valColor = "#AAFFAA") => {
    const x = panX + col * colW + 6
    const y = TOP + r * LH
    ctx.font = font9b; ctx.fillStyle = "#FFDD44"; ctx.textAlign = "left"
    ctx.fillText(key, x, y)
    ctx.font = font9; ctx.fillStyle = valColor
    ctx.fillText(val, x + ctx.measureText(key).width + 3, y)
  }
  // Helper: fila de toggle ON/OFF
  const tog = (col: number, r: number, keyLabel: string, name: string, on: boolean) => {
    const x = panX + col * colW + 6
    const y = TOP + r * LH
    ctx.font = font9b; ctx.fillStyle = "#FFDD44"; ctx.textAlign = "left"
    ctx.fillText(`[${keyLabel}]`, x, y)
    const kw = ctx.measureText(`[${keyLabel}]`).width + 3
    ctx.font = font9b
    ctx.fillStyle = on ? "#FF4444" : "#555555"
    ctx.fillText(`${name}:`, x + kw, y)
    const nw = ctx.measureText(`${name}:`).width + 3
    ctx.fillStyle = on ? "#FF8888" : "#444444"
    ctx.fillText(on ? "■ON" : "□OFF", x + kw + nw, y)
  }

  // ── Col 0: ESTADO ──────────────────────────────────────────
  hdr("ESTADO", 0)
  row(0, 0, "FPS:", `${g.lfps.toFixed(0)}`, g.lfps < 45 ? "#FF6644" : "#AAFFAA")
  row(0, 1, "HP:", `${p.hp}/${p.maxHp}`)
  row(0, 2, "STA:", `${Math.floor(p.stamina)}/${p.maxStamina}${p.exhausted ? " !EX" : ""}`, p.exhausted ? "#FF6644" : "#AAFFAA")
  row(0, 3, "POS:", `${Math.floor(p.x)},${Math.floor(p.y)}`)
  row(0, 4, "SALA:", `W${curW}.${curC}.${curR}`)
  row(0, 5, "KILLS:", `${g.dead.size}`)
  row(0, 6, "CP:", `W${g.checkpoint.w} ${Math.floor(g.checkpoint.x)},${Math.floor(g.checkpoint.y)}`)

  // ── Col 1: MOVER ────────────────────────────────────────────
  hdr("MOVER", 1)
  row(1, 0, "W/A/D", "→ caminar/saltar")
  row(1, 1, "S", "→ caída rápida")
  row(1, 2, "SHIFT", "→ dash")
  row(1, 3, "SPACE", "→ saltar")
  row(1, 4, "Z", "→ minimap zoom")
  row(1, 5, "ESC", "→ pausa/menú")
  row(1, 6, "TAB", "→ mapa completo")

  // ── Col 2: COMBATE ──────────────────────────────────────────
  hdr("COMBATE", 2)
  row(2, 0, "N", "→ disparar (AMMO)")
  row(2, 1, "M", "→ látigo/parry")
  row(2, 2, "F", "→ interactuar")
  row(2, 3, "↑+N", "→ disparo arriba")
  row(2, 4, "↓+N", "→ disparo abajo")
  row(2, 5, "GND+↓", "→ caer plataforma")
  row(2, 6, "AMMO:", `${p.ammo}/15`)

  // ── Col 3: DEV TOGGLES ──────────────────────────────────────
  hdr("DEV MODE", 3)
  tog(3, 0, "I", "GOD", g.godMode)
  tog(3, 1, "O", "AMM∞", g.infiniteAmmo)
  tog(3, 2, "K", "NOENM", g.noEnemies)
  tog(3, 3, "U", "OHKO", g.ohko)
  tog(3, 4, "J", g.staDisplay === "circle" ? "STA●" : "STA▬", g.staDisplay === "circle")
  tog(3, 5, "P", g.mobileZoom === "close" ? "ZOOM×" : "ZOOM○", g.mobileZoom === "close")
  // Selector de tipo de input (G = ciclar gpadType, V = toggle mobile)
  const gpadIcon = g.gpadType === "xbox" ? "XBOX" : g.gpadType === "ps" ? "PS" : "PC"
  const gpadColor = g.gpadType === "keyboard" ? "#88FF88" : g.gpadType === "xbox" ? "#6699FF" : "#CC88FF"
  row(3, 6, "[G]", `${gpadIcon}  [V] MOB:${g.isMobile ? "■ON" : "□OFF"}`, gpadColor)

  // ── Col 4: FLAGS / ESTADÍSTICAS ─────────────────────────────
  hdr("ESTADÍSTICAS", 4)
  const activeFlags = [
    g.godMode && "GOD",
    g.infiniteAmmo && "AMM∞",
    g.noEnemies && "NOENM",
    g.ohko && "OHKO",
  ].filter(Boolean) as string[]
  row(4, 0, "FLAGS:", activeFlags.length ? activeFlags.join(" ") : "ninguno", activeFlags.length ? "#FF8888" : "#555555")
  row(4, 1, "ENEMS:", `${g.enemies.filter(e => e.active && !e.dying).length} vivos / ${g.enemies.length} total`)
  row(4, 2, "SCORE:", `${g.score}`)
  row(4, 3, "LIVES:", `${g.lives}`)
  row(4, 4, "GFX:", `${["BAJA", "MEDIA", "ALTA"][g.gfx]} [Q] ciclar`)
  row(4, 5, "PROJS:", `${g.projs.filter(pr => pr.active).length}`)
  row(4, 6, "SPARKS:", `${g.sparks.filter(s => s.life > 0).length}`)

  ctx.textAlign = "left"

  // ── UI PREVIEW: strip de botones según input mode actual ──────────────────
  const gt = g.gpadType
  // Tablas inline (no dependen de GPAD_BTN / XB_COL que se definen más abajo en el archivo)
  const _KB:  Record<string, string> = { jump:"ESPACIO", dash:"SHIFT", shoot:"N", whip:"M", interact:"E", pause:"P", map:"TAB", teleport:"T" }
  const _XB:  Record<string, string> = { jump:"A", dash:"LT", shoot:"X", whip:"Y", interact:"B", pause:"START", map:"SEL", teleport:"LB" }
  const _PS:  Record<string, string> = { jump:"✕", dash:"L2", shoot:"□", whip:"△", interact:"○", pause:"OPT", map:"SHARE", teleport:"L1" }
  const _MOB: Record<string, string> = { jump:"A", dash:"LT", shoot:"X", whip:"Y", interact:"B", pause:"START", map:"SEL", teleport:"LB" }
  const _XBC: Record<string, string> = { A:"#1DB954", B:"#E03030", X:"#1565C0", Y:"#F9A825" }
  const btnMap = g.isMobile ? _MOB : gt === "xbox" ? _XB : gt === "ps" ? _PS : _KB
  const previewActions: { label: string; key: string; col: string }[] = [
    { label: "SALTAR",   key: btnMap.jump,     col: gt === "xbox" ? (_XBC[_XB.jump]  ?? "#AAFFAA") : gt === "ps" ? "#AAAAFF" : "#FFDD44" },
    { label: "DASH",     key: btnMap.dash,     col: gt === "xbox" ? "#FF8800" : gt === "ps" ? "#AAAAFF" : "#FFDD44" },
    { label: "DISPARO",  key: btnMap.shoot,    col: gt === "xbox" ? (_XBC[_XB.shoot] ?? "#AAFFAA") : gt === "ps" ? "#8888FF" : "#FFDD44" },
    { label: "LÁTIGO",   key: btnMap.whip,     col: gt === "xbox" ? (_XBC[_XB.whip]  ?? "#AAFFAA") : gt === "ps" ? "#AAAAFF" : "#FFDD44" },
    { label: "INTERACT", key: btnMap.interact, col: gt === "xbox" ? (_XBC[_XB.interact] ?? "#AAFFAA") : gt === "ps" ? "#AAAAFF" : "#88FF88" },
    { label: "PAUSA",    key: btnMap.pause,    col: "#AAFFAA" },
    { label: "MAPA",     key: btnMap.map,      col: "#AAFFAA" },
    { label: "TELEP",    key: btnMap.teleport, col: "#AAFFFF" },
  ]
  // Strip anclado ENCIMA del panel dev (panY), mismo ancho que el panel → no se solapa nunca
  const stripH = 26
  const stripY = panY - stripH - 3   // justo encima del panel
  const n = previewActions.length
  const gap2 = 3
  const btnW = Math.floor((panW - (n - 1) * gap2) / n)  // se estira para cubrir todo panW
  const borderColor = g.isMobile ? "#FFDD88" : gt === "xbox" ? "#6699FF" : gt === "ps" ? "#CC88FF" : "#22AA44"
  // Fondo
  ctx.fillStyle = "rgba(0,8,0,0.88)"
  ctx.beginPath(); ctx.roundRect(panX, stripY, panW, stripH, 4); ctx.fill()
  ctx.strokeStyle = borderColor; ctx.lineWidth = 1
  ctx.strokeRect(panX, stripY, panW, stripH)
  // Etiqueta de modo (esquina izquierda)
  const modeStr = g.isMobile ? "MÓVIL" : gt === "xbox" ? "XBOX" : gt === "ps" ? "PS" : "TECLADO"
  ctx.fillStyle = "#FFDD44"; ctx.font = "bold 8px 'Courier New',monospace"; ctx.textAlign = "left"
  ctx.fillText(`◈ ${modeStr}  [G] ciclar  [V] móvil`, panX + 4, stripY + 9)
  // Botones
  for (let i = 0; i < n; i++) {
    const { label, key, col } = previewActions[i]
    const bx2 = panX + i * (btnW + gap2)
    const by2 = stripY + 11
    const bh2 = stripH - 13
    ctx.fillStyle = col + "28"
    ctx.beginPath(); ctx.roundRect(bx2, by2, btnW, bh2, 3); ctx.fill()
    ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.strokeRect(bx2, by2, btnW, bh2)
    ctx.fillStyle = col; ctx.font = "bold 8px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(key, bx2 + btnW / 2, by2 + bh2 - 3)
    ctx.fillStyle = "#777777"; ctx.font = "6px 'Courier New',monospace"
    ctx.fillText(label, bx2 + btnW / 2, by2 - 1)
  }
  ctx.textAlign = "left"
}

export function drawMinimap(ctx: CanvasRenderingContext2D, g: G) {
  if (g.isMobile) return
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  const th = THEMES[curW]
  const large = !!g.keys["z"]
  const rw = large ? 20 : 12, rh = large ? 14 : 8, gap = large ? 2 : 1
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
  // Paw indicator: anillo pulsante + punto central
  const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.006)
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.45 * pulse})`; ctx.lineWidth = large ? 1.4 : 1
  ctx.beginPath(); ctx.arc(plRx, plRy, large ? 5.5 : 3.8, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(plRx, plRy, large ? 3 : 2, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = "#000"; ctx.lineWidth = 0.8; ctx.stroke()
  ctx.fillStyle = th.accent + "DD"; ctx.font = `bold ${large ? 8 : 7}px 'Courier New',monospace`; ctx.textAlign = "center"
  ctx.fillText(WORLD_NAMES[curW].slice(0, 16), mx + mw / 2, my + mh - 3)
  if (!large) { ctx.fillStyle = "#444"; ctx.font = "9px 'Courier New',monospace"; ctx.fillText("[Z] zoom", mx + mw / 2, my + mh + 7) }
  ctx.textAlign = "left"
}

// ══════════════════════════════════════════════════════════════
//  drawFullMap — modo "single" (mundo actual ampliado) o "all" (4 mundos)
// ══════════════════════════════════════════════════════════════
// Helper: ¿tiene al menos un cuarto explorado en el mundo w?
export function _mapWorldExplored(w: number, g: G): boolean {
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    if (g.explored.has(`${w}_${c}_${r}`)) return true
  }
  return false
}

// Dibuja el grid de una sala para drawFullMap
export function _drawMapWorldGrid(
  ctx: CanvasRenderingContext2D, g: G,
  w: number, curW: number, curC: number, curR: number,
  gx: number, gy: number, rW: number, rH: number, gap: number,
  sprs: SprBank = {}
) {
  const th = THEMES[w], wCleared = g.cw.has(w)
  const kr = KENNEL_ROOMS[w]
  const [p1c_m, p1r_m] = WORLD_P1_BOSS[w], [p2c_m, p2r_m] = WORLD_P2_BOSS[w]
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const rx = gx + c * (rW + gap), ry = gy + r * (rH + gap)
    const roomKey = `${w}_${c}_${r}`, explored = g.explored.has(roomKey)
    const isCur = w === curW && c === curC && r === curR
    const zBg = r < TROW ? "rgba(0,30,10,1)" : r === TROW ? "rgba(0,18,52,1)" : "rgba(30,0,0,1)"
    ctx.fillStyle = zBg; ctx.fillRect(rx, ry, rW, rH)
    // TROW: diagonal stripe "SAFE ZONE" pattern (excepto ultra-boss que ya tiene su color)
    if (r === TROW && !(c === TRANSIT_BOSS_COL)) {
      ctx.save()
      ctx.beginPath(); ctx.rect(rx, ry, rW, rH); ctx.clip()
      ctx.strokeStyle = "rgba(60,120,255,0.09)"; ctx.lineWidth = 1
      const step = Math.max(5, Math.round(rW * 0.28))
      for (let d2 = -rH; d2 < rW + rH; d2 += step) {
        ctx.beginPath(); ctx.moveTo(rx + d2, ry); ctx.lineTo(rx + d2 + rH, ry + rH); ctx.stroke()
      }
      ctx.restore()
    }
    if (!explored) {
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(rx, ry, rW, rH)
      const nbL2 = c > 0 && g.explored.has(`${w}_${c-1}_${r}`) && computeDoors(w,c-1,r).R
      const nbR3 = c < NC-1 && g.explored.has(`${w}_${c+1}_${r}`) && computeDoors(w,c+1,r).L
      const nbU3 = r > 0 && g.explored.has(`${w}_${c}_${r-1}`) && computeDoors(w,c,r-1).D
      const nbD3 = r < NR-1 && g.explored.has(`${w}_${c}_${r+1}`) && computeDoors(w,c,r+1).U
      if (nbL2||nbR3||nbU3||nbD3) { ctx.fillStyle="rgba(255,255,255,0.10)"; ctx.fillRect(rx,ry,rW,rH); ctx.strokeStyle="rgba(255,255,255,0.35)"; ctx.lineWidth=0.5; ctx.strokeRect(rx,ry,rW,rH) }
    } else {
      const state = getRoomState(w,c,r,g.dead)
      ctx.fillStyle = state==="clear" ? "rgba(0,160,55,0.4)" : state==="half" ? "rgba(185,145,0,0.4)" : "rgba(165,18,18,0.4)"
      ctx.fillRect(rx,ry,rW,rH)
      if (c===TRANSIT_BOSS_COL && r===TROW) { ctx.fillStyle="rgba(255,180,0,0.4)"; ctx.fillRect(rx,ry,rW,rH) }
      else if (c===p1c_m && r===p1r_m) { ctx.fillStyle="rgba(0,200,80,0.3)"; ctx.fillRect(rx,ry,rW,rH) }
      else if (c===p2c_m && r===p2r_m) { ctx.fillStyle=wCleared?"rgba(0,200,80,0.3)":"rgba(255,60,0,0.3)"; ctx.fillRect(rx,ry,rW,rH) }
      // TROW non-boss explored: "SAFE ZONE" label
      if (r===TROW && c!==TRANSIT_BOSS_COL && rW>=20) {
        ctx.save(); ctx.beginPath(); ctx.rect(rx,ry,rW,rH); ctx.clip()
        const szFnt = Math.max(6, Math.round(rW * 0.095))
        ctx.font = `bold ${szFnt}px 'Courier New',monospace`; ctx.fillStyle = "rgba(80,160,255,0.30)"; ctx.textAlign="center"
        ctx.fillText("SAFE", rx+rW/2, ry+rH/2+szFnt*0.36); ctx.restore(); ctx.textAlign="left"
      }
      // Skull sprites for unlocked boss rooms
      const skullSz = Math.round(Math.min(rW, rH) * 0.70)
      const skullX = rx + Math.round((rW - skullSz) / 2), skullY = ry + Math.round((rH - skullSz) / 2)
      if (c===p1c_m && r===p1r_m && g.p1BossRexSeen) {
        const sk = sprs["skull_p1"]; if (sk && sk.complete) ctx.drawImage(sk, skullX, skullY, skullSz, skullSz)
      } else if (c===p2c_m && r===p2r_m && g.p2BossRexSeen) {
        const sk = sprs["skull_p2"]; if (sk && sk.complete) ctx.drawImage(sk, skullX, skullY, skullSz, skullSz)
      } else if (c===TRANSIT_BOSS_COL && r===TROW && g.ultraBossRexSeen) {
        const sk = sprs["skull_ultra"]; if (sk && sk.complete) ctx.drawImage(sk, skullX, skullY, skullSz, skullSz)
      }
      if (kr.c===c && kr.r===r) { ctx.fillStyle=g.checkpoint.w===w?"#FFD700":"#555"; ctx.font="10px 'Courier New',monospace"; ctx.textAlign="center"; ctx.fillText("★",rx+rW/2,ry+rH/2+4); ctx.textAlign="left" }
      const nCr = getCratesInRoom(w,c,r,g)
      if (nCr>0) { ctx.fillStyle="#FFEE44EE"; ctx.font="bold 9px 'Courier New',monospace"; ctx.textAlign="right"; ctx.fillText(`■${nCr}`,rx+rW-2,ry+rH-2); ctx.textAlign="left" }
      if (isCur) {
        ctx.strokeStyle=th.accent+"CC"; ctx.lineWidth=2; ctx.strokeRect(rx,ry,rW,rH)
        // Ícono de Luly — esquina superior-izquierda, dentro del borde
        const iconSz = Math.max(10, Math.min(Math.round(rH * 0.58), Math.round(rW * 0.22), 18))
        const iconImg = sprs["luly_map_icon"]
        if (iconImg) {
          ctx.drawImage(iconImg, rx + 3, ry + 3, iconSz, iconSz)
        } else {
          // Fallback: punto blanco si aún no cargó
          ctx.fillStyle = "rgba(255,255,255,0.85)"
          ctx.beginPath(); ctx.arc(rx + 3 + iconSz / 2, ry + 3 + iconSz / 2, iconSz / 2, 0, Math.PI * 2); ctx.fill()
        }
      } else { ctx.strokeStyle=wCleared?th.accent+"55":"rgba(255,255,255,0.08)"; ctx.lineWidth=0.5; ctx.strokeRect(rx,ry,rW,rH) }
    }
    const doors = computeDoors(w,c,r)
    const nbR4=`${w}_${c+1}_${r}`, nbD4=`${w}_${c}_${r+1}`, nbL4=`${w}_${c-1}_${r}`, nbU4=`${w}_${c}_${r-1}`
    if (explored) {
      const dh=Math.round(rH*0.40), dw2=Math.round(rW*0.40), doorW=Math.max(3,Math.round(rW*0.06))
      const knownCol=th.accent+"FF", unknownCol="rgba(255,255,255,0.85)"
      if (doors.R && c<NC-1) { ctx.fillStyle=g.explored.has(nbR4)?knownCol:unknownCol; ctx.fillRect(rx+rW-doorW,ry+Math.round((rH-dh)/2),doorW,dh) }
      if (doors.D && r<NR-1) { ctx.fillStyle=g.explored.has(nbD4)?knownCol:unknownCol; ctx.fillRect(rx+Math.round((rW-dw2)/2),ry+rH-doorW,dw2,doorW) }
      if (doors.L && c>0)    { ctx.fillStyle=g.explored.has(nbL4)?knownCol:unknownCol; ctx.fillRect(rx,ry+Math.round((rH-dh)/2),doorW,dh) }
      if (doors.U && r>0)    { ctx.fillStyle=g.explored.has(nbU4)?knownCol:unknownCol; ctx.fillRect(rx+Math.round((rW-dw2)/2),ry,dw2,doorW) }
    }
  }
  // Ícono tball / media llave (W0)
  if (w===0) {
    const tbPk=g.pickups.find(pk=>pk.id==="tball_w0"), tbc=TBALL_SECRET_C, tbr2=TBALL_SECRET_R
    const tbRx=gx+tbc*(rW+gap), tbRy=gy+tbr2*(rH+gap)
    const questRevealed=g.viejoDogState==="cage_opened"||g.viejoDogState==="quest_done"||g.viejoDogState==="surprised"
    const cageHinted=false  // no revelar ubicación hasta que Rex entregue la otra mitad
    if (!tbPk?.active) {
      // Pelota ya recogida
      ctx.fillStyle="#556655"; ctx.font="9px 'Courier New',monospace"; ctx.textAlign="center"; ctx.fillText("🎾✓",tbRx+rW/2,tbRy+rH/2+4); ctx.textAlign="left"
    } else if (cageHinted) {
      // Mostrar llave en la sala donde está el pickup real (no en la jaula)
      const keyPk = g.pickups.find(pk=>pk.id==="tball_key"&&pk.active)
      const keyC = keyPk ? Math.floor((keyPk.x % (NC * RW)) / RW) : tbc
      const keyR = keyPk ? Math.floor(keyPk.y / RH) : tbr2
      const kRx=gx+keyC*(rW+gap), kRy=gy+keyR*(rH+gap)
      const pulse=0.55+0.45*Math.sin(Date.now()*0.005)
      ctx.fillStyle=`rgba(255,200,0,${pulse*0.35})`; ctx.fillRect(kRx,kRy,rW,rH)
      ctx.strokeStyle=`rgba(255,220,0,${pulse*0.9})`; ctx.lineWidth=1.2; ctx.strokeRect(kRx+1,kRy+1,rW-2,rH-2)
      ctx.fillStyle="#FFE066"; ctx.font="bold 9px 'Courier New',monospace"; ctx.textAlign="center"
      ctx.fillText("🗝?",kRx+rW/2,kRy+rH/2+4); ctx.textAlign="left"
    } else if (questRevealed) {
      // Jaula revelada → mostrar en sala de la jaula
      const pulse=0.55+0.45*Math.sin(Date.now()*0.005)
      ctx.fillStyle=`rgba(0,220,80,${pulse*0.35})`; ctx.fillRect(tbRx,tbRy,rW,rH)
      ctx.strokeStyle=`rgba(0,255,80,${pulse*0.9})`; ctx.lineWidth=1.2; ctx.strokeRect(tbRx+1,tbRy+1,rW-2,rH-2)
      ctx.fillStyle="#AAFFAA"; ctx.font="bold 9px 'Courier New',monospace"; ctx.textAlign="center"
      ctx.fillText("🎾?",tbRx+rW/2,tbRy+rH/2+4); ctx.textAlign="left"
    }
  }
  // Checkpoints (ocultar si la celda muestra un skull de jefe desbloqueado)
  for (const cp of ALL_CPS) {
    if (cp.w!==w || !g.discoveredCPs.has(cp.id)) continue
    const isP1Boss   = cp.c===p1c_m && cp.r===p1r_m && g.p1BossRexSeen
    const isP2Boss   = cp.c===p2c_m && cp.r===p2r_m && g.p2BossRexSeen
    const isUltraBoss = cp.c===TRANSIT_BOSS_COL && cp.r===TROW && g.ultraBossRexSeen
    if (isP1Boss || isP2Boss || isUltraBoss) continue
    const cpRx=gx+cp.c*(rW+gap)+Math.round(rW/2), cpRy=gy+cp.r*(rH+gap)+Math.round(rH/2)
    const isActive=g.checkpoint.w===cp.w && Math.abs(g.checkpoint.x-cp.x)<40
    ctx.fillStyle=isActive?THEMES[w].accent:"#FFD700"
    ctx.beginPath(); ctx.arc(cpRx,cpRy,isActive?Math.max(5,rW*0.08):Math.max(3,rW*0.06),0,Math.PI*2); ctx.fill()
    if (isActive) { ctx.strokeStyle="#FFF"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(cpRx,cpRy,Math.max(7,rW*0.12),0,Math.PI*2); ctx.stroke() }
    if (rW>=26) { ctx.fillStyle=isActive?"#FFF":"#AA8800"; ctx.font=`bold ${Math.max(9,Math.round(rW*0.14))}px 'Courier New',monospace`; ctx.textAlign="center"; ctx.fillText(cp.icon,cpRx+rW*0.12,cpRy+rH*0.22); ctx.textAlign="left" }
  }
}

export function drawFullMap(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank = {}) {
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))

  // Fondo + borde
  ctx.fillStyle = "rgba(0,0,0,0.95)"; ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = "#2A2A2A"; ctx.lineWidth = 2; ctx.strokeRect(2, 2, CW - 4, CH - 4)
  ctx.fillStyle = "#CCC"; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText("// MAPA DEL COMPLEJO CANINO //", CW / 2, 22)
  const _mapGT: GpadType = g.gpadType ?? "keyboard"
  const mapCloseKey = GPAD_BTN.map[(g.isMobile && _mapGT === "keyboard") ? "xbox" : _mapGT]
  ctx.fillStyle = "#444"; ctx.font = "9px 'Courier New',monospace"
  ctx.fillText(`[${mapCloseKey}] cerrar   ★ = checkpoint   negro = sin explorar`, CW / 2, 36)
  ctx.textAlign = "left"

  const LEGEND_ITEMS: [string, string][] = [
    ["#050505","sin explorar"],["#b22","enemigos"],["#aa8800","a medias"],
    ["#0a5","limpia"],["rgba(255,60,0,0.8)","boss"],["#FFD700","checkpoint"]
  ]
  const drawLegend = (startX: number) => {
    const ly = CH - 14; let lx = startX; ctx.font = "9px 'Courier New',monospace"
    for (const [col, lbl] of LEGEND_ITEMS) {
      if (lbl === "checkpoint") { ctx.fillStyle=col; ctx.beginPath(); ctx.arc(lx+4,ly+4,4,0,Math.PI*2); ctx.fill() }
      else { ctx.fillStyle=col; ctx.fillRect(lx,ly,9,9) }
      ctx.fillStyle="#555"; ctx.fillText(" "+lbl,lx+11,ly+8); lx+=lbl.length*5+26
    }
  }

  if (g.mapView === "single") {
    // ── Vista de un solo mundo, ampliada ────────────────────────────────
    const w = g.mapViewWorld
    const th = THEMES[w], wCleared = g.cw.has(w)
    const HEADER_H = 44, FOOTER_H = 22, LEFT_LBL = 22, MARG_L = 14, MARG_R = 12
    const gridW = CW - MARG_L - LEFT_LBL - MARG_R
    const gridH = CH - HEADER_H - FOOTER_H - 8
    const gap = 2
    const rW = Math.floor((gridW - (NC - 1) * gap) / NC)
    const rH = Math.floor((gridH - (NR - 1) * gap) / NR)
    const gx = MARG_L + LEFT_LBL, gy = HEADER_H + 6

    // Título del mundo
    ctx.fillStyle = w === curW ? th.accent : wCleared ? "#AAA" : "#555"
    ctx.font = "bold 11px 'Courier New',monospace"; ctx.textAlign = "left"
    ctx.fillText(`W${w+1} — ${WORLD_NAMES[w]}  ·  ${WORLD_SUBS[w]}`, gx, HEADER_H - 4)

    // Etiquetas de zona (izquierda)
    ctx.font = "bold 7px 'Courier New',monospace"; ctx.textAlign = "right"
    const lblX = gx - 4
    for (let r = 0; r < NR; r++) {
      const ry0 = gy + r * (rH + gap) + rH / 2 + 3
      if (r < TROW) { ctx.fillStyle = "#00AA44"; ctx.fillText("P1", lblX, ry0) }
      else if (r === TROW) { ctx.fillStyle = "#4499FF"; ctx.fillText("T", lblX, ry0) }
      else { ctx.fillStyle = "#FF3333"; ctx.fillText("P2", lblX, ry0) }
    }
    ctx.textAlign = "left"

    // Grid del mundo
    _drawMapWorldGrid(ctx, g, w, curW, curC, curR, gx, gy, rW, rH, gap, sprs)

    // Estado del mundo (bottom-left del grid)
    ctx.font = "9px 'Courier New',monospace"; ctx.textAlign = "left"
    ctx.fillStyle = wCleared ? "#00FF88" : w === curW ? "#AAAAFF" : w < curW ? "#666" : "#333"
    ctx.fillText(wCleared ? "✓ LIBERADO" : w === curW ? "⟶ ACTIVO" : w < curW ? "⚔ VISITADO" : "[ BLOQUEADO ]", gx, CH - FOOTER_H + 8)

    // Botón "VER TODOS LOS MUNDOS ▶" (top-right)
    const btnW = 142, btnH = 26, btnX = CW - btnW - 6, btnY = 6
    ctx.fillStyle = "#111"; ctx.fillRect(btnX, btnY, btnW, btnH)
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(btnX, btnY, btnW, btnH)
    ctx.fillStyle = "#AAA"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText("VER TODOS LOS MUNDOS ▶", btnX + btnW / 2, btnY + 17)
    ctx.textAlign = "left"

    drawLegend(gx)

  } else {
    // ── Vista de los 4 mundos ────────────────────────────────────────────
    const rW = 34, rH = 22, gap = 2
    const wGridW = NC * (rW + gap) - gap, wGridH = NR * (rH + gap) - gap
    const wPadX = 10, wPadY = 8
    const panW = wGridW + wPadX * 2, panH = 18 + wGridH + 14 + wPadY * 2
    const panGap = 14, totalW = 2 * panW + panGap
    const mLeft = Math.floor((CW - totalW) / 2), mTop = 42

    // Botón "◀ MAPA ACTUAL" (top-left)
    const backW = 130, backH = 26, backX = mLeft, backY = 6
    ctx.fillStyle = "#111"; ctx.fillRect(backX, backY, backW, backH)
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(backX, backY, backW, backH)
    ctx.fillStyle = "#AAA"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText("◀ MAPA ACTUAL", backX + backW / 2, backY + 17)
    ctx.textAlign = "left"

    for (let w = 0; w < NW; w++) {
      const mc = w % 2, mr = Math.floor(w / 2)
      const bx = mLeft + mc * (panW + panGap), by = mTop + mr * (panH + panGap)
      const th = THEMES[w], wCleared = g.cw.has(w)
      const hasExp = _mapWorldExplored(w, g)

      ctx.fillStyle = "#0A0A0A"; ctx.fillRect(bx, by, panW, panH)
      ctx.strokeStyle = wCleared ? th.accent : w === curW ? th.wallHi : "#2A2A2A"
      ctx.lineWidth = wCleared ? 2 : 1; ctx.strokeRect(bx, by, panW, panH)
      ctx.fillStyle = w === curW ? th.accent : wCleared ? "#888" : "#444"
      ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "left"
      ctx.fillText(`W${w+1}  ${WORLD_NAMES[w]}`, bx + 5, by + 14)

      if (!hasExp && w !== curW) {
        // Mundo no explorado — overlay bloqueado
        ctx.fillStyle = "rgba(0,0,0,0.76)"; ctx.fillRect(bx, by, panW, panH)
        ctx.fillStyle = "#555"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("NO DESCUBIERTO", bx + panW / 2, by + panH / 2 - 5)
        ctx.fillStyle = "#333"; ctx.font = "8px 'Courier New',monospace"
        ctx.fillText("explora para revelar", bx + panW / 2, by + panH / 2 + 8)
        ctx.textAlign = "left"
        continue
      }

      const gx = bx + wPadX, gy = by + wPadY + 14
      // Etiquetas de zona
      ctx.font = "bold 7px 'Courier New',monospace"; ctx.textAlign = "right"
      const lblX = gx - 4
      for (let r = 0; r < NR; r++) {
        const ry0 = gy + r * (rH + gap) + rH / 2 + 3
        if (r < TROW) { ctx.fillStyle = "#00AA44"; ctx.fillText("P1", lblX, ry0) }
        else if (r === TROW) { ctx.fillStyle = "#4499FF"; ctx.fillText("T", lblX, ry0) }
        else { ctx.fillStyle = "#FF3333"; ctx.fillText("P2", lblX, ry0) }
      }
      ctx.textAlign = "left"

      // Grid
      _drawMapWorldGrid(ctx, g, w, curW, curC, curR, gx, gy, rW, rH, gap, sprs)

      // Estado + hint de clic
      ctx.font = "9px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillStyle = wCleared ? "#00FF88" : w === curW ? "#AAAAFF" : w < curW ? "#666" : "#333"
      ctx.fillText(wCleared ? "✓ LIBERADO" : w === curW ? "⟶ ACTIVO" : w < curW ? "⚔ VISITADO" : "[ BLOQUEADO ]", bx + panW / 2, by + panH - 12)
      ctx.fillStyle = th.accent + "99"; ctx.font = "7px 'Courier New',monospace"
      ctx.fillText("[ VER DETALLE ]", bx + panW / 2, by + panH - 3)
      ctx.textAlign = "left"
    }
    drawLegend(mLeft)
  }
}


export function devTeleport(g: G, targetWorld: number, targetC: number, targetR: number) {
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
//  drawRealMapDev — mapa realista miniaturizado (solo devMode/PC)
//  Renderiza las plataformas reales de cada cubículo a escala y
//  muestra el sprite frame-0 de Luly en su posición exacta.
// ══════════════════════════════════════════════════════════════
export function drawRealMapDev(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const p   = g.pl
  const w   = Math.max(0, Math.min(NW - 1, g.realMapWorld))
  const th  = THEMES[w]
  const curW = Math.max(0, Math.min(NW - 1, Math.floor(p.x / (NC * RW))))
  const plC  = Math.max(0, Math.min(NC - 1, Math.floor((p.x - curW * NC * RW) / RW)))
  const plR  = Math.max(0, Math.min(NR - 1, Math.floor(p.y / RH)))

  // ── Sección visible ───────────────────────────────────────────
  // Cada sección muestra 5 filas (la mitad + TROW compartido)
  const section = g.realMapSection ?? 0  // 0=superior(r0-TROW), 1=inferior(TROW-NR-1)
  const NVIS    = 5                       // filas visibles a la vez
  const rStart  = section === 0 ? 0 : TROW
  const rEnd    = rStart + NVIS - 1       // incl: 0→4 ó 4→8

  // ── Layout ────────────────────────────────────────────────────
  const HDR = 28, MARG = 6, GAP = 2
  const availW = CW - MARG * 2
  const availH = CH - HDR - MARG * 2 - 14   // -14 para el footer
  const cellW  = Math.floor((availW - (NC - 1) * GAP) / NC)
  const cellH  = Math.floor((availH - (NVIS - 1) * GAP) / NVIS)
  const gridX  = MARG
  const gridY  = HDR + MARG / 2
  const scX    = cellW / RW
  const scY    = cellH / RH
  // scSpr: escala uniforme para sprites (preserva aspect ratio del sprite original)
  // Usando scX como base porque el cuarto es más ancho que alto; scY sobre-estira verticalmente
  const scSpr  = scX

  // ── Fondo ─────────────────────────────────────────────────────
  ctx.fillStyle = "#060606"; ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1.5; ctx.strokeRect(1, 1, CW - 2, CH - 2)

  // ── Antialiasing global para todos los sprites ────────────────
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality  = "high"

  // ── Helper: dibuja con antialiasing suave + alpha opcional ─────
  const drawSmooth = (spr: HTMLImageElement, x: number, y: number, dw: number, dh: number, alpha = 1) => {
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality  = "high"
    if (alpha < 1) ctx.globalAlpha = alpha
    ctx.drawImage(spr, x, y, dw, dh)
    ctx.restore()
  }
  // Helper: dibuja frame 0 de spritesheet (siempre row=0, col=0)
  // cols/rows = grid del spritesheet (ej: 5 para 5×5, 4 para 4×4, 6 para 6×6)
  const drawFrame = (spr: HTMLImageElement, x: number, y: number, dw: number, dh: number, cols = 4, rows = 4, flipX = false, alpha = 1) => {
    const fw = Math.floor(spr.naturalWidth  / cols)
    const fh = Math.floor(spr.naturalHeight / rows)
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality  = "high"
    if (alpha < 1) ctx.globalAlpha = alpha
    if (flipX) { ctx.translate(x + dw, y); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, fw, fh, 0, 0, dw, dh) }
    else        ctx.drawImage(spr, 0, 0, fw, fh, x, y, dw, dh)
    ctx.restore()
  }
  const iconMode = g.realMapIconMode  // 0=sprites, 1=v1 pixel, 2=v2 minimalist

  // ── Header ────────────────────────────────────────────────────
  const SCALE_STEPS = [1.0, 1.5, 2.0, 3.0]
  const scaleLabel   = `${g.realMapScale}x`
  const iconLabel    = iconMode === 0 ? "SPRITES" : iconMode === 1 ? "ICONOS-v1" : "ICONOS-v2"
  const sectionLabel = section === 0 ? "SUP(r0-4)" : "INF(r4-8)"
  ctx.fillStyle = "#111"; ctx.fillRect(0, 0, CW, HDR - 2)
  ctx.fillStyle = "#00FF44"; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText(
    `⚙ REAL MAP DEV  ·  W${w+1}: ${WORLD_NAMES[w]}  ·  [←→/AD] mundo  [W/S] sección:${sectionLabel}  [Z] escala:${scaleLabel}  [V] gfx:${iconLabel}  [Y/Esc] cerrar`,
    CW / 2, 17
  )
  ctx.textAlign = "left"

  // ── Precargar plataformas del mundo ───────────────────────────
  const allPlats = getWorldPlats(w)

  for (let c = 0; c < NC; c++) {
    for (let r = rStart; r <= rEnd; r++) {
      const ri   = r - rStart                    // fila de display 0-4
      const cx   = gridX + c * (cellW + GAP)
      const cy   = gridY + ri * (cellH + GAP)
      const x0   = w * NC * RW + c * RW
      const y0   = r * RH
      const isPlayerRoom = w === curW && c === plC && r === plR
      const explored     = g.explored.has(`${w}_${c}_${r}`) || isPlayerRoom

      // ── Fondo de zona ───────────────────────────────────────────
      const zoneBg = r < TROW
        ? (explored ? "rgba(0,22,7,1)"  : "#030903")
        : r === TROW
          ? (explored ? "rgba(0,12,36,1)" : "#03050E")
          : (explored ? "rgba(22,4,0,1)"  : "#090302")
      ctx.fillStyle = zoneBg; ctx.fillRect(cx, cy, cellW, cellH)

      if (!explored) {
        ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(cx, cy, cellW, cellH)
        // Borde sutil si hay sala explorada adyacente
        const nb = (c > 0 && g.explored.has(`${w}_${c-1}_${r}`))
                || (c < NC-1 && g.explored.has(`${w}_${c+1}_${r}`))
                || (r > 0 && g.explored.has(`${w}_${c}_${r-1}`))
                || (r < NR-1 && g.explored.has(`${w}_${c}_${r+1}`))
        if (nb) { ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 0.5; ctx.strokeRect(cx, cy, cellW, cellH) }
        continue
      }

      // ── Plataformas del cubículo — sprites 1:1 ──────────────────
      // Transform mundo→celda: permite reutilizar exactamente las
      // funciones de sprite del juego real (drawFloorSprite, etc.)
      // con coordenadas de mundo como si fueran de pantalla.
      // Las tiles "t" (atravesables) se dibujan con coords de pantalla
      // directamente porque drawTraversableTile usa tamaños fijos en px.
      for (const pl of allPlats) {
        if (pl.mode === "d") continue
        if (pl.x + pl.w <= x0 || pl.x >= x0 + RW) continue
        if (pl.y + pl.h <= y0 || pl.y >= y0 + RH) continue

        const tRow = Math.floor(pl.y / RH)
        const zone: "p1" | "trow" | "p2" = tRow < TROW ? "p1" : tRow === TROW ? "trow" : "p2"

        if (pl.mode === "t") {
          // Traversable: drawTraversableTile funciona bien con px de pantalla
          const rx = cx + (pl.x - x0) * scX
          const ry = cy + (pl.y - y0) * scY
          const rw = pl.w * scX
          const rh = Math.max(1, pl.h * scY)
          drawTraversableTile(ctx, rx, ry, rw, rh, w, g.gfx, zone)
          continue
        }

        // Sólido: transform mundo→celda, luego reusar funciones reales de sprite
        ctx.save()
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality  = "high"
        ctx.beginPath(); ctx.rect(cx, cy, cellW, cellH); ctx.clip()
        ctx.translate(cx - x0 * scX, cy - y0 * scY)
        ctx.scale(scX, scY)

        const yIR  = pl.y % RH
        const hash = ((pl.x * 7 + pl.y * 13) >>> 0) % 16
        const isFloor = pl.h === WT  && Math.abs(yIR - (RH - WT)) < 4
        const isCeil  = pl.h === WT  && yIR < 4
        const isPlat  = pl.h === STAIR_H && yIR >= WT + 4 && yIR <= RH - WT - STAIR_H - 4 && pl.w >= 36
        const isWall  = pl.w === WT  && pl.h > STAIR_H

        if (isFloor || isCeil) {
          drawFloorSprite(ctx, pl.x, pl.y, pl.w, pl.h, pl.x, sprs, isCeil)
        } else if (isPlat) {
          drawPlatformSprite(ctx, pl.x, pl.y, pl.w, pl.h, pl.x, sprs)
        } else if (isWall) {
          drawWallSprite(ctx, pl.x, pl.y, pl.w, pl.h, pl.y, sprs, (pl.x + pl.w) % RW === 0)
        } else {
          drawSolidTile(ctx, pl.x, pl.y, pl.w, pl.h, w, hash, g.gfx, pl.x, pl.y, zone)
          drawInternalWallSprite(ctx, pl.x, pl.y, pl.w, pl.h, pl.x, pl.y, sprs)
        }
        ctx.restore()
      }

      // ── Casa de Rex (solo W0, sala [VIEJO_DOG_C, VIEJO_DOG_R]) ──────────────
      if (w === 0 && c === VIEJO_DOG_C && r === VIEJO_DOG_R) {
        const houseSprGame = sprs["rex_house"]
        const houseSprV2   = sprs["icon_rex_house"]
        const hWX    = VIEJO_DOG_POS.x - 151
        const hWY    = VIEJO_DOG_POS.y - 326
        const hScMul = Math.sqrt(g.realMapScale)
        const hMapX  = cx + (hWX - x0) * scX
        const hMapY  = cy + (hWY - y0) * scY
        const hMapW  = Math.max(4, Math.round(552 * scSpr * hScMul))
        const hMapH  = Math.max(4, Math.round(368 * scSpr * hScMul))
        // v1 no tiene icono de casa → usa game sprite; v2 usa minimalist
        const hSpr   = iconMode === 2 ? (houseSprV2 || houseSprGame) : houseSprGame
        if (hSpr && hSpr.complete && hSpr.naturalWidth > 0) {
          drawSmooth(hSpr, hMapX, hMapY, hMapW, hMapH)
        } else {
          ctx.fillStyle = "rgba(120,80,40,0.5)"; ctx.fillRect(hMapX, hMapY, hMapW, hMapH)
          ctx.strokeStyle = "#A06020AA"; ctx.lineWidth = 1; ctx.strokeRect(hMapX, hMapY, hMapW, hMapH)
        }
      }

      // ── Checkpoints y Kennels del cubículo ─────────────────────
      {
        const KENNEL_KEYS = ["kennel_ambar", "kennel_red", "kennel_blue", "kennel_violet"]
        const KENNEL_DIM: { rw: number; rh: number; feet: number }[] = [
          { rw: 130, rh: 130, feet: 117 },
          { rw: 158, rh: 130, feet: 114 },
          { rw: 130, rh: 130, feet: 116 },
          { rw: 158, rh: 130, feet: 112 },
        ]
        const ctSpr = sprs["cucha_teleport"]

        for (const cp of ALL_CPS) {
          if (cp.w !== w || cp.c !== c || cp.r !== r) continue

          const discovered = g.discoveredCPs.has(cp.id)
          const isSpawn    = g.checkpoint.w === cp.w && Math.abs(g.checkpoint.x - cp.x) < 40
          const isKennel   = KENNEL_ROOMS[cp.w].c === cp.c && KENNEL_ROOMS[cp.w].r === cp.r
          const th2        = THEMES[cp.w]

          // Anchor: sx_map = centro-X en el piso, sy_map = posición de los pies
          const sx_map = cx + (cp.x + PW / 2 - x0) * scX
          const sy_map = cy + (cp.y + PH      - y0) * scY

          if (isKennel) {
            const wi       = Math.max(0, Math.min(cp.w, 3))
            const ksprGame = sprs[KENNEL_KEYS[wi]]
            const ksprV2   = sprs["icon_kennel"]
            // v1 no tiene icono kennel → usa game sprite; v2 usa minimalist
            const kspr     = iconMode === 2 ? (ksprV2 || ksprGame) : ksprGame
            const { rw: krw, rh: krh, feet } = KENNEL_DIM[wi]
            const krw_m  = Math.round(krw  * scSpr * g.realMapScale)
            const krh_m  = Math.round(krh  * scSpr * g.realMapScale)
            const feet_m = Math.round(feet * scSpr * g.realMapScale)
            const ksX    = sx_map - krw_m / 2
            const ksY    = sy_map - feet_m
            const kAlpha = discovered ? (isSpawn ? 1 : 0.85) : 0.35
            if (kspr && kspr.complete && kspr.naturalWidth > 0) {
              if (isSpawn) { ctx.save(); ctx.shadowColor = th2.accent; ctx.shadowBlur = 7 }
              drawSmooth(kspr, ksX, ksY, krw_m, krh_m, kAlpha)
              if (isSpawn) ctx.restore()
            } else {
              ctx.save(); ctx.globalAlpha = kAlpha
              ctx.fillStyle = isSpawn ? th2.accent + "CC" : "#443300CC"
              ctx.fillRect(ksX, ksY, krw_m, krh_m); ctx.restore()
            }
          } else {
            const ctSprV2   = sprs["icon_cucha"]
            // v1 no tiene icono cucha → usa game sprite; v2 usa minimalist
            const ctDraw    = iconMode === 2 ? (ctSprV2 || ctSpr) : ctSpr
            const ct_rw     = Math.round(237 * scSpr * g.realMapScale)
            const ct_rh     = Math.round(140 * scSpr * g.realMapScale)
            const ct_sx     = sx_map - ct_rw / 2
            const ct_sy     = sy_map - ct_rh
            const ctAlpha   = discovered ? (isSpawn ? 1 : 0.80) : 0.30
            if (ctDraw && ctDraw.complete && ctDraw.naturalWidth > 0) {
              if (isSpawn) { ctx.save(); ctx.shadowColor = th2.accent; ctx.shadowBlur = 5 }
              drawSmooth(ctDraw, ct_sx, ct_sy, ct_rw, ct_rh, ctAlpha)
              if (isSpawn) ctx.restore()
            } else {
              ctx.save(); ctx.globalAlpha = ctAlpha
              ctx.fillStyle = isSpawn ? th2.accent + "AA" : "#002244AA"
              ctx.fillRect(ct_sx, ct_sy, ct_rw, ct_rh); ctx.restore()
            }
          }

          // ★ pequeño sobre el checkpoint activo
          if (isSpawn) {
            ctx.fillStyle = th2.accent
            ctx.font = `bold ${Math.max(6, Math.round(8 * g.realMapScale))}px 'Courier New',monospace`
            ctx.textAlign = "center"
            ctx.fillText("★", sx_map, sy_map - Math.round(8 * g.realMapScale))
            ctx.textAlign = "left"
          }
        }
      }

      // ── Cajas de suministros activas en este cubículo ───────────
      {
        const boxSprGame = sprs["box"]
        const boxSprV2   = sprs["icon_box"]
        for (const cr of g.crates) {
          if (!cr.active) continue
          const crWorld = Math.max(0, Math.min(NW - 1, Math.floor(cr.x / (NC * RW))))
          if (crWorld !== w) continue
          if (cr.x < x0 || cr.x >= x0 + RW) continue
          if (cr.y < y0 || cr.y >= y0 + RH) continue
          const crW    = Math.max(4, Math.round(cr.w * scSpr * g.realMapScale))
          const crH    = Math.max(4, Math.round(cr.h * scSpr * g.realMapScale))
          const crCX   = cx + (cr.x + cr.w / 2 - x0) * scX
          const crBotY = cy + (cr.y + cr.h      - y0) * scY
          const crMapX = crCX   - crW / 2
          const crMapY = crBotY - crH
          // todos los modos usan drawSmooth para mejor calidad
          const bSpr   = iconMode === 2 ? (boxSprV2 || boxSprGame) : boxSprGame
          if (bSpr && bSpr.complete && bSpr.naturalWidth > 0) {
            drawSmooth(bSpr, crMapX, crMapY, crW, crH)
          } else {
            ctx.fillStyle = th.accent + "CC"; ctx.fillRect(crMapX, crMapY, crW, crH)
            ctx.fillStyle = th.wall; ctx.fillRect(crMapX + 1, crMapY + 1, crW - 2, crH - 2)
          }
        }
      }

      // ── Enemigos activos en este cubículo ────────────────────────
      {
        const enSprV1 = sprs["icon_enemy_v1"]
        const enSprV2 = sprs["icon_enemy_v2"]
        for (const e of g.enemies) {
          if (!e.active || e.dying) continue
          if (e.world !== w) continue
          if (e.x + e.w <= x0 || e.x >= x0 + RW) continue
          if (e.y + e.h <= y0 || e.y >= y0 + RH) continue
          const eDW   = Math.max(2, Math.round(e.w * scSpr * g.realMapScale))
          const eDH   = Math.max(3, Math.round(e.h * scSpr * g.realMapScale))
          // Anclar al bottom-center
          const eCX   = cx + (e.x + e.w / 2 - x0) * scX
          const eBotY = cy + (e.y + e.h      - y0) * scY
          const eMapX = eCX   - eDW / 2
          const eMapY = eBotY - eDH
          // iconMode=0: sprite de juego resuelto por mundo/sección del enemigo
          const enSprGame = resolveEnemySpr(e, sprs)
          const enSpr = iconMode === 1 ? (enSprV1 || enSprGame)
                      : iconMode === 2 ? (enSprV2 || enSprGame)
                      : enSprGame
          if (enSpr && enSpr.complete && enSpr.naturalWidth > 0) {
            if (iconMode === 0) {
              drawFrame(enSpr, eMapX, eMapY, eDW, eDH, 4, 4, e.dir < 0)  // 4×4 spritesheet
            } else {
              drawSmooth(enSpr, eMapX, eMapY, eDW, eDH)
            }
          } else {
            ctx.fillStyle = e.boss ? "#FF4444CC" : "#FF8800CC"
            ctx.fillRect(eMapX, eMapY, eDW, eDH)
          }
        }
      }

      // ── Rex NPC (solo W0, sala [VIEJO_DOG_C, VIEJO_DOG_R]) ───────────────────
      if (w === 0 && c === VIEJO_DOG_C && r === VIEJO_DOG_R) {
        const rexSprGame = sprs["rex_idle"]
        const rexSprV1   = sprs["icon_rex_v1"]
        const rexSprV2   = sprs["icon_rex_v2"]
        const rexSpr     = iconMode === 1 ? (rexSprV1 || rexSprGame)
                         : iconMode === 2 ? (rexSprV2 || rexSprGame)
                         : rexSprGame
        const rDW    = Math.max(2, Math.round(43 * scSpr * g.realMapScale))
        const rDH    = Math.max(3, Math.round(65 * scSpr * g.realMapScale))
        // Anclar al bottom-center: VIEJO_DOG_POS.y es la posición de los pies
        const rexCX  = cx + (VIEJO_DOG_POS.x - x0) * scX
        const rBotY  = cy + (VIEJO_DOG_POS.y - y0) * scY
        const rMapX  = rexCX - rDW / 2
        const rMapY  = rBotY - rDH
        if (rexSpr && rexSpr.complete && rexSpr.naturalWidth > 0) {
          if (iconMode === 0) drawFrame(rexSpr, rMapX, rMapY, rDW, rDH, 5, 5, false)  // Rex: 5×5
          else                drawSmooth(rexSpr, rMapX, rMapY, rDW, rDH)
        } else {
          ctx.fillStyle = "#D4A04ACC"
          ctx.fillRect(rMapX, rMapY, rDW, rDH)
        }
      }

      // ── Sprite de Luly frame-0 en la sala actual ────────────────
      if (isPlayerRoom) {
        const sprGame  = sprs["player_idle"]
        const sprV1    = sprs["icon_luly_v1"]
        const sprV2    = sprs["icon_luly_v2"]
        const sprIdle  = iconMode === 1 ? (sprV1 || sprGame)
                       : iconMode === 2 ? (sprV2 || sprGame)
                       : sprGame
        const dw = Math.max(2, Math.round(PW * scSpr * g.realMapScale))
        const dh = Math.max(3, Math.round(PH * scSpr * g.realMapScale))
        // Anclar al bottom-center: los pies de Luly están en p.y + PH
        const plCX   = cx + (p.x + PW / 2 - x0) * scX
        const plBotY = cy + (p.y + PH      - y0) * scY
        const plMapX = plCX   - dw / 2
        const plMapY = plBotY - dh
        if (sprIdle && sprIdle.complete && sprIdle.naturalWidth > 0) {
          if (iconMode === 0) drawFrame(sprIdle, plMapX, plMapY, dw, dh, 5, 5, p.facing === -1)  // Luly: 5×5
          else                drawSmooth(sprIdle, plMapX, plMapY, dw, dh)
        } else {
          ctx.fillStyle = "#FF66FF"
          ctx.fillRect(plMapX, plMapY, Math.max(2, Math.round(PW * scSpr)), Math.max(3, Math.round(PH * scSpr)))
        }
        // Borde sala activa
        ctx.strokeStyle = "#00FF4499"; ctx.lineWidth = 1.5
        ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2)
      }

      // ── Borde de celda ──────────────────────────────────────────
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 0.5
      ctx.strokeRect(cx, cy, cellW, cellH)
    }
  }

  // ── Labels de zona (izquierda del grid) ────────────────────────
  // (no caben con MARG=6, se omiten; zona es legible por colores)

  // ── Footer ────────────────────────────────────────────────────
  ctx.fillStyle = "#111"; ctx.fillRect(0, CH - 14, CW, 14)
  ctx.fillStyle = "#444"; ctx.font = "7px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText(
    `Player (${Math.round(p.x)}, ${Math.round(p.y)})  ·  Room [${plC}, ${plR}]  ·  W${curW+1} ${WORLD_NAMES[curW]}  ·  sección:${sectionLabel}  escala:${scaleLabel}  gfx:${iconLabel}  ·  [Y] cerrar`,
    CW / 2, CH - 3
  )
  ctx.textAlign = "left"
}

// ══════════════════════════════════════════════════════════════
//  drawDevMap — cursor celda a celda, sin scroll
//  La grilla 9×9 con rW=80,gap=4 → gridW=752 cabe en CW=1050
// ══════════════════════════════════════════════════════════════
export function drawDevMap(ctx: CanvasRenderingContext2D, g: G, hover: { w: number; c: number; r: number } | null) {
  ctx.fillStyle = "#000D00"; ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = "#00FF44"; ctx.lineWidth = 2; ctx.strokeRect(2, 2, CW - 4, CH - 4)
  ctx.fillStyle = "#00FF44"; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
  ctx.fillText("// MODO DESARROLLADOR — MAPA TELEPORT //", CW / 2, 20)
  ctx.fillStyle = "#1A6622"; ctx.font = "9px 'Courier New',monospace"
  ctx.fillText(
    `GOD: ${g.godMode ? "■ ON" : "□ OFF"} [I]    AMMO∞: ${g.infiniteAmmo ? "■ ON" : "□ OFF"} [O]    NOENM: ${g.noEnemies ? "■ ON" : "□ OFF"} [K]    OHKO: ${g.ohko ? "■ ON" : "□ OFF"} [U]    KILLENM: [L]    STA: ${g.staDisplay === "circle" ? "● CIRC" : "▬ BAR"} [J]    ZOOM: ${g.mobileZoom === "close" ? "🔍 CLOSE" : "🌍 FAR"} [P]    [ESC/\`] cerrar    CLICK/A = teleport    LB/RB = mundo`,
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

  const [devP1c, devP1r] = WORLD_P1_BOSS[w], [devP2c, devP2r] = WORLD_P2_BOSS[w]
  // Etiquetas de zona (izquierda del grid)
  ctx.font = "bold 8px 'Courier New',monospace"; ctx.textAlign = "right"
  for (let r = 0; r < NR; r++) {
    const ry0 = gy + r * (rH + gap) + rH / 2 + 3
    if (r < TROW) { ctx.fillStyle = "#00CC55"; ctx.fillText("P1", gx - 6, ry0) }
    else if (r === TROW) { ctx.fillStyle = "#55AAFF"; ctx.fillText("TROW", gx - 6, ry0) }
    else { ctx.fillStyle = "#FF4444"; ctx.fillText("P2", gx - 6, ry0) }
  }
  ctx.textAlign = "left"

  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const rx = gx + c * (rW + gap), ry = gy + r * (rH + gap)
    if (rx + rW < 0 || rx > CW || ry + rH < 44 || ry > CH) continue
    const isCur = w === curW && c === curC && r === curR
    const isHov = hover && hover.w === w && hover.c === c && hover.r === r
    const state = getRoomState(w, c, r, g.dead)
    const isKennel = KENNEL_ROOMS[w].c === c && KENNEL_ROOMS[w].r === r
    const isBossP1 = c === devP1c && r === devP1r
    const isBossP2 = c === devP2c && r === devP2r
    const isUltraBoss = c === TRANSIT_BOSS_COL && r === TROW
    const nCr = getCratesInRoom(w, c, r, g)
    // Fondo de zona
    const zoneBg = r < TROW ? "rgba(0,40,15,1)" : r === TROW ? "rgba(0,15,40,1)" : "rgba(40,5,5,1)"
    ctx.fillStyle = zoneBg; ctx.fillRect(rx, ry, rW, rH)
    // Overlay de estado
    let fill: string | null = null
    if (isUltraBoss) fill = "rgba(255,160,0,0.55)"
    else if (isBossP1) fill = "rgba(0,180,80,0.55)"
    else if (isBossP2) fill = "rgba(180,0,0,0.55)"
    else if (isKennel) fill = "rgba(80,65,0,0.7)"
    else if (state === "clear") fill = "rgba(0,120,40,0.45)"
    else if (state === "half") fill = "rgba(120,90,0,0.45)"
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(rx, ry, rW, rH) }
    if (isHov) { ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(rx, ry, rW, rH); ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rW, rH) }
    else if (isCur) { ctx.strokeStyle = th.accent; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rW, rH) }
    else { ctx.strokeStyle = r < TROW ? "#00884455" : r === TROW ? "#4488FF55" : "#FF222255"; ctx.lineWidth = 1; ctx.strokeRect(rx, ry, rW, rH) }
    ctx.fillStyle = isHov ? "#FFF" : isCur ? th.accent : "#AAFFAA"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(`[${c},${r}]`, rx + rW / 2, ry + 13)
    const stateLbl = state === "clear" ? "✓ LIMPIA" : state === "half" ? "◑ MEDIA" : "⚠ ACTIVA"
    ctx.fillStyle = state === "clear" ? "#00FF88" : state === "half" ? "#FFCC00" : "#FF4444"; ctx.font = "9px 'Courier New',monospace"
    ctx.fillText(stateLbl, rx + rW / 2, ry + 25)
    const sp = getEnemySpawns(w, c, r)
    const alive = sp.filter((_, i) => !isSpawnDead(g.dead, w, c, r, i)).length
    if (alive > 0) { ctx.fillStyle = "#FF8888"; ctx.fillText(`${alive} enemigo${alive > 1 ? "s" : ""}`, rx + rW / 2, ry + 35) }
    else if (isKennel) { ctx.fillStyle = "#FFD700"; ctx.fillText("★ PERRERA", rx + rW / 2, ry + 35) }
    else if (isUltraBoss) { ctx.fillStyle = "#FFB300"; ctx.fillText("⚡ ULTRA", rx + rW / 2, ry + 35) }
    else if (isBossP1) { ctx.fillStyle = "#00FF88"; ctx.fillText("JEFE P1", rx + rW / 2, ry + 35) }
    else if (isBossP2) { ctx.fillStyle = "#FF6600"; ctx.fillText("JEFE P2", rx + rW / 2, ry + 35) }
    if (nCr > 0) { ctx.fillStyle = "#FFEE44"; ctx.fillText(`■${nCr} cajas`, rx + rW / 2, ry + 43) }
    // Ícono poder oculto tball — solo W0, sala [TBALL_SECRET_C, TBALL_SECRET_R]
    if (w === 0 && c === TBALL_SECRET_C && r === TBALL_SECRET_R) {
      const tbPk = g.pickups.find(pk => pk.id === "tball_w0")
      const questRev = g.viejoDogState === "cage_opened" || g.viejoDogState === "quest_done" || g.viejoDogState === "surprised"
      const cageActive = g.viejoDogState === "key_dropped" || g.viejoDogState === "key_held"
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.005)
      if (!tbPk?.active) {
        ctx.fillStyle = "#446644"; ctx.fillText("🎾 YA RECOGIDO", rx + rW / 2, ry + 43)
      } else if (questRev) {
        ctx.fillStyle = `rgba(0,200,80,${pulse * 0.45})`; ctx.fillRect(rx, ry, rW, rH)
        ctx.strokeStyle = `rgba(0,255,80,${pulse})`; ctx.lineWidth = 2.5; ctx.strokeRect(rx + 1, ry + 1, rW - 2, rH - 2)
        ctx.fillStyle = "#CCFF88"; ctx.fillText("🎾 PODER OCULTO", rx + rW / 2, ry + 43)
      } else if (cageActive) {
        // Solo muestra la jaula (la llave se dibuja en su sala real abajo)
        ctx.fillStyle = `rgba(255,200,0,${pulse * 0.2})`; ctx.fillRect(rx, ry, rW, rH)
        ctx.fillStyle = "#AA9944"; ctx.fillText("⛓ JAULA", rx + rW / 2, ry + 43)
      }
      // Sin marker si quest no revelada
      if (g.devMode && tbPk?.active && !questRev && !cageActive) {
        ctx.fillStyle = "rgba(0,100,50,0.35)"; ctx.fillRect(rx, ry, rW, rH)
        ctx.fillStyle = "#336633"; ctx.fillText("🎾 [JAULA]", rx + rW / 2, ry + 43)
      }
    }
    // Ícono llave caída — muestra en el cubículo REAL donde está el pickup
    if (w === 0 && (g.viejoDogState === "key_dropped" || g.viejoDogState === "key_held")) {
      const keyPk = g.pickups.find(pk => pk.id === "tball_key" && pk.active)
      if (keyPk) {
        const kC = Math.floor((keyPk.x % (NC * RW)) / RW)
        const kR = Math.floor(keyPk.y / RH)
        if (c === kC && r === kR) {
          const pulse2 = 0.55 + 0.45 * Math.sin(Date.now() * 0.005)
          ctx.fillStyle = `rgba(255,200,0,${pulse2 * 0.45})`; ctx.fillRect(rx, ry, rW, rH)
          ctx.strokeStyle = `rgba(255,220,0,${pulse2})`; ctx.lineWidth = 2.5; ctx.strokeRect(rx + 1, ry + 1, rW - 2, rH - 2)
          ctx.fillStyle = "#FFE066"; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
          ctx.fillText("🗝 MEDIA LLAVE", rx + rW / 2, ry + 43)
        }
      }
    }
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
export function devMapHitTest(mouseX: number, mouseY: number, w: number): { w: number; c: number; r: number } | null {
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

export function drawSparks(ctx: CanvasRenderingContext2D, g: G) {
  for (const s of g.sparks) {
    const t = s.life / s.maxLife
    ctx.globalAlpha = Math.min(1, t * 2); ctx.fillStyle = s.col
    ctx.beginPath(); ctx.arc(s.x - g.cx, s.y - g.cy, s.r * t, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

// Niebla oscura sobre la sala del boss cuando está bloqueada y visible en pantalla
export function drawBossRoomFog(ctx: CanvasRenderingContext2D, g: G) {
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const t = Date.now() * 0.002

  // Niebla sobre sala Jefe P1 (hasta que Rex explique al Castigador)
  if (!g.p1BossRexSeen) {
    const [bc, br] = WORLD_P1_BOSS[curW]
    const { x: brX, y: brY } = ro(curW, bc, br)
    const sx = brX - g.cx, sy = brY - g.cy
    if (sx < CW && sx + RW > 0 && sy < CH && sy + RH > 0) {
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,0.88)"; ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      ctx.fillStyle = `rgba(0,80,40,${0.12 + 0.08 * Math.sin(t)})`; ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      const rcX = sx + RW / 2, rcY = sy + RH / 2
      if (rcX > 80 && rcX < CW - 80) {
        ctx.fillStyle = `rgba(0,200,100,${0.5 + 0.3 * Math.sin(t * 1.4)})`; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚠  JEFE GUARDIÁN  ⚠", rcX, rcY)
        ctx.fillStyle = "rgba(0,160,70,0.7)"; ctx.font = "9px 'Courier New',monospace"
        const p1Sub = areRegularP1EnemiesDead(g, curW) ? "Ve a hablar con Rex primero" : "Derrota a todos los enemigos"
        ctx.fillText(p1Sub, rcX, rcY + 18); ctx.textAlign = "left"
      }
      ctx.restore()
    }
  }
  // Niebla sobre Ultra-Boss TROW (hasta que Rex explique al Torturado)
  if (!g.ultraBossRexSeen) {
    const { x: brX, y: brY } = ro(curW, TRANSIT_BOSS_COL, TROW)
    const sx = brX - g.cx, sy = brY - g.cy
    if (sx < CW && sx + RW > 0 && sy < CH && sy + RH > 0) {
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,0.92)"; ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      ctx.fillStyle = `rgba(140,90,0,${0.12 + 0.08 * Math.sin(t * 0.9)})`; ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      const rcX = sx + RW / 2, rcY = sy + RH / 2
      if (rcX > 80 && rcX < CW - 80) {
        ctx.fillStyle = `rgba(255,180,0,${0.5 + 0.3 * Math.sin(t * 1.2)})`; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚡  ULTRA JEFE  ⚡", rcX, rcY)
        ctx.fillStyle = "rgba(200,140,0,0.7)"; ctx.font = "9px 'Courier New',monospace"
        const uSub = (isPart1BossDead(g, curW) && isPart2BossDead(g, curW)) ? "Ve a hablar con Rex primero" : "Derrota a los dos jefes primero"
        ctx.fillText(uSub, rcX, rcY + 18); ctx.textAlign = "left"
      }
      ctx.restore()
    }
  }
  // Niebla sobre sala Jefe P2 (hasta que Rex explique al Herrero)
  if (!g.p2BossRexSeen) {
    const [bc, br] = WORLD_P2_BOSS[curW]
    const { x: brX, y: brY } = ro(curW, bc, br)
    const sx = brX - g.cx, sy = brY - g.cy
    if (sx < CW && sx + RW > 0 && sy < CH && sy + RH > 0) {
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,0.91)"; ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      ctx.fillStyle = `rgba(120,0,0,${0.15 + 0.08 * Math.sin(t)})`; ctx.fillRect(Math.max(0, sx), Math.max(0, sy), Math.min(CW, sx + RW) - Math.max(0, sx), Math.min(CH, sy + RH) - Math.max(0, sy))
      const rcX = sx + RW / 2, rcY = sy + RH / 2
      if (rcX > 80 && rcX < CW - 80) {
        ctx.fillStyle = `rgba(180,0,0,${0.5 + 0.3 * Math.sin(t * 1.4)})`; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
        ctx.fillText("⚠  JEFE FINAL  ⚠", rcX, rcY)
        ctx.fillStyle = "rgba(120,0,0,0.7)"; ctx.font = "9px 'Courier New',monospace"
        const p2Sub = areRegularP2EnemiesDead(g, curW) ? "Ve a hablar con Rex primero" : "Derrota a todos los enemigos"
        ctx.fillText(p2Sub, rcX, rcY + 18); ctx.textAlign = "left"
      }
      ctx.restore()
    }
  }
}


export function drawToolMounds(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const spr = sprs["monticulo_herramientas"]
  for (const m of g.toolMounds) {
    if (!m.active) continue
    const sx = m.x - g.cx, sy = m.y - g.cy
    if (spr && spr.complete && spr.naturalWidth > 0) {
      ctx.drawImage(spr, sx, sy, m.w, m.h)
    } else {
      ctx.fillStyle = "#5A4020"
      ctx.fillRect(sx, sy, m.w, m.h)
      ctx.fillStyle = "#8A6030"
      ctx.fillRect(sx + 4, sy + 4, m.w - 8, m.h - 8)
    }
  }
  // Herramientas voladoras con rotación propia
  for (const ft of g.flyingTools) {
    if (!ft.active) continue
    const sx = ft.x - g.cx, sy = ft.y - g.cy
    if (sx < -60 || sx > CW + 60 || sy < -60 || sy > CH + 60) continue
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(ft.rot)
    // Cuerpo de la herramienta (llave/martillo)
    ctx.fillStyle = "#C8C8C8"
    ctx.fillRect(-10, -3, 20, 6)
    ctx.fillStyle = "#8B6914"
    ctx.fillRect(-10, -3, 6, 6)
    // Cabeza de la herramienta
    ctx.fillStyle = "#B0B0B0"
    ctx.fillRect(7, -5, 7, 10)
    // Brillo metálico
    ctx.fillStyle = "#E8E8E8"
    ctx.fillRect(-9, -2, 3, 2)
    ctx.restore()
  }
}

export function drawBossArenaPlats(ctx: CanvasRenderingContext2D, g: G) {
  if (g.bossArenaPlats.length === 0) return
  const curW = Math.max(0, Math.min(Math.floor(g.pl.x / (NC * RW)), NW - 1))
  const th = THEMES[curW]
  // Dibuja exactamente igual que las plataformas traversables generales del mundo:
  // cuerpo sólido en platC (color de plataforma del tema) + overlay de drawTraversableTile
  const drawArenaPlatform = (sx: number, sy: number, w: number, h: number, alpha: number) => {
    ctx.globalAlpha = alpha
    // 1. Cuerpo sólido visible (platC = color base de plataforma del tema)
    ctx.fillStyle = th.platC; ctx.fillRect(sx, sy, w, h)
    // 2. Mismo overlay decorativo que usan las plataformas generales del juego
    drawTraversableTile(ctx, sx, sy, w, h, curW, g.gfx, "p1")
    ctx.globalAlpha = 1
  }
  for (const mp of g.bossArenaPlats) {
    const sx = mp.x - g.cx, sy = mp.y - g.cy
    if (!mp.visible) {
      // Destello los últimos 0.6s antes de reaparecer — aviso visual
      if (mp.hiddenTimer < 0.6) {
        const fadeFrac = (0.6 - mp.hiddenTimer) / 0.6
        drawArenaPlatform(sx, sy, mp.w, mp.h, fadeFrac * 0.45)
      }
      continue
    }
    drawArenaPlatform(sx, sy, mp.w, mp.h, 1)
  }
}

// ── Llamas del Torturado (Ultra Boss) ─────────────────────────────────────
export function drawUltraFlames(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const uf = g.ultraFlames
  if (!uf || uf.phase === "startup" || uf.phase === "vuln") return

  // Buscar el ultra boss para conocer su mundo
  const uboss = g.enemies.find(e => isUltraBoss(e) && e.active && !e.dying)
  if (!uboss) return

  const { x: x0, y: y0 } = ro(uboss.world, TRANSIT_BOSS_COL, TROW)
  const lX  = x0 + WT + UB_PLAT_OX
  const rX  = x0 + RW - WT - UB_PLAT_OX - UB_PLAT_W
  const bY  = y0 + WT + Math.floor((RH - 2 * WT) * UB_PLAT_BOT_FR)
  const tY  = y0 + WT + Math.floor((RH - 2 * WT) * UB_PLAT_TOP_FR)
  const platPos = [
    { x: lX, y: bY }, { x: lX, y: tY },
    { x: rX, y: bY }, { x: rX, y: tY },
  ]

  const isWarn  = uf.phase === "warn"
  const alpha   = isWarn ? (0.55 + 0.25 * Math.sin(Date.now() / 140)) : 1.0
  // Frame de animación a ~10fps (25 frames en grid 5×5)
  const fireFrame = Math.floor(Date.now() / 100) % 25

  const pisoSpr = sprs["violet_fire_piso"]
  const platSpr = sprs["violet_fire_plat"]

  // Helper: dibuja un sprite 5×5 tileado horizontalmente dentro de un rect.
  // clipH: si se pasa, la región de clip es dh=clipH (útil para compensar padding del sprite).
  const drawTiled = (spr: HTMLImageElement, dx: number, dy: number, dw: number, dh: number, clipH?: number) => {
    const fW  = spr.width  / 5
    const fH  = spr.height / 5
    const col = fireFrame % 5, row = Math.floor(fireFrame / 5)
    const sx  = col * fW,  sy = row * fH
    // Ancho de cada tile manteniendo la proporción del frame
    const tileW = Math.round(fW * (dh / fH))
    ctx.save()
    ctx.beginPath(); ctx.rect(dx, dy, dw, clipH ?? dh); ctx.clip()
    for (let tx = dx; tx < dx + dw + tileW; tx += tileW) {
      ctx.drawImage(spr, sx, sy, fW, fH, tx, dy, tileW, dh)
    }
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = alpha

  // ── Zona del suelo ──────────────────────────────────────────────────────
  const floorFlameH = 72  // altura de las llamas del suelo (px en pantalla)
  const floorY = y0 + RH - WT - floorFlameH
  const sx0    = x0 + WT - g.cx
  const sy0    = floorY  - g.cy
  if (pisoSpr) {
    // padBottom=21: extender dh para que la base del contenido quede al ras del suelo
    // dh_full = floorFlameH * fH / (fH - padB), clip al rect visible original
    const _fHp = pisoSpr.height / 5
    const _dhP = Math.round(floorFlameH * _fHp / (_fHp - 21))
    drawTiled(pisoSpr, sx0, sy0, RW - 2 * WT, _dhP, floorFlameH)
  } else {
    // fallback geométrico si el sprite no cargó
    const r2 = isWarn ? 130 : 170, b2 = isWarn ? 220 : 255
    ctx.fillStyle = `rgba(${r2},0,${b2},${alpha})`
    ctx.fillRect(sx0, sy0, RW - 2 * WT, floorFlameH)
    ctx.fillStyle = `rgba(210,140,255,${alpha * 0.9})`
    ctx.fillRect(sx0, sy0, RW - 2 * WT, 3)
  }

  // ── Zonas de plataformas seleccionadas ─────────────────────────────────
  const platFlameH = 58  // altura de las llamas sobre cada plataforma
  for (const idx of uf.platIdxs) {
    const pp  = platPos[idx]
    const psx = pp.x - g.cx
    const psy = pp.y - g.cy
    if (platSpr) {
      // padBottom=25: extender dh para que la base quede al ras de la plataforma
      const _fHpl = platSpr.height / 5
      const _dhPl = Math.round(platFlameH * _fHpl / (_fHpl - 25))
      drawTiled(platSpr, psx, psy - platFlameH, UB_PLAT_W, _dhPl, platFlameH)
    } else {
      const r2 = isWarn ? 130 : 170, b2 = isWarn ? 220 : 255
      ctx.fillStyle = `rgba(${r2},0,${b2},${alpha})`
      ctx.fillRect(psx, psy - platFlameH, UB_PLAT_W, platFlameH + 4)
      ctx.fillStyle = `rgba(210,140,255,${alpha * 0.9})`
      ctx.fillRect(psx, psy - platFlameH, UB_PLAT_W, 3)
    }
  }

  // ── Texto de advertencia ────────────────────────────────────────────────
  if (isWarn) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 180)
    ctx.fillStyle = "#CC88FF"
    ctx.font = "bold 15px monospace"
    ctx.textAlign = "center"
    ctx.fillText("⚠ LLAMAS ⚠", x0 + RW / 2 - g.cx, y0 + WT + 30 - g.cy)
    ctx.textAlign = "left"
  }

  ctx.restore()
}

export function draw(g: G, ctx: CanvasRenderingContext2D, sprs: SprBank, devHover: { w: number; c: number; r: number } | null = null) {
  ctx.clearRect(0, 0, CW, CH)
  if (g.showDevMap) { drawDevMap(ctx, g, devHover); return }
  if (g.showMap) { drawFullMap(ctx, g, sprs); return }
  // ── Zoom móvil + screen shake (solo afectan al mundo, no al HUD) ────
  const sc = g.mobileZoom === "close" ? 1.35 : 1.0
  const hasShake = g.shakeX !== 0 || g.shakeY !== 0
  ctx.save()
  if (sc !== 1) ctx.scale(sc, sc)
  if (hasShake) ctx.translate(g.shakeX / sc, g.shakeY / sc)
  drawBg(ctx, g); drawPickups(ctx, g, sprs); drawWalls(ctx, g, sprs); drawCage(ctx, g, sprs); drawBossArenaPlats(ctx, g); drawToolMounds(ctx, g, sprs); drawBones(ctx, g); drawCrates(ctx, g, sprs); drawCheckpoints(ctx, g, sprs)
  drawUltraFlames(ctx, g, sprs)
  drawEnemies(ctx, g, sprs); drawViejoDog(ctx, g, sprs); drawBolkha(ctx, g, sprs); drawPlayer(ctx, g, sprs); drawDrops(ctx, g, sprs); drawProjs(ctx, g); drawTBalls(ctx, g, sprs); drawWhip(ctx, g)
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
  // ── Fade-to-black al morir ──────────────────────────────────────────────
  if (g.over && g.overFade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${g.overFade * 0.82})`
    ctx.fillRect(0, 0, CW, CH)
  }
  drawMinimap(ctx, g); drawDevPanel(ctx, g); drawHUD(ctx, g, sprs); drawTPMenu(ctx, g); drawWorldTransition(ctx, g)
}

// ══════════════════════════════════════════════════════════════
//  HUD
// ══════════════════════════════════════════════════════════════
export function drawHUD(ctx: CanvasRenderingContext2D, g: G, sprs: SprBank) {
  const p = g.pl
  const curW = Math.max(0, Math.min(Math.floor(p.x / (NC * RW)), NW - 1))
  const curC = Math.max(0, Math.min(Math.floor((p.x % (NC * RW)) / RW), NC - 1))
  const curR = Math.max(0, Math.min(Math.floor(p.y / RH), NR - 1))
  const th = THEMES[curW]

  // ── Panel izquierdo ───────────────────────────────────────────────────────
  const panX = 6, panY = 6, panW = 192
  // Dimensiones de cada fila
  const HS = 24, HSP = 28, HY0 = panY + 16          // corazones (6 slots: 5 activos + 1 bloqueado)
  const EY0 = HY0 + HS + 12, ESIZE = 22, ESTP = 26  // enemigos
  const BY0 = EY0 + ESIZE + 12, BSIZE = 18, BSTP = 11 // huesos
  const BONES_PER_ROW = 11                            // cuántos caben en la 1ª fila
  const hasTballHUD = g.abilities.has("tball")        // ¿mostrar fila de pelota?
  const TBALL_ROW_H = 33                              // altura de la fila de pelota (2 filas: 14+3+14+2)
  const TBY0 = BY0 + BSIZE * 2 + 6 + 8               // Y de la fila tball (si existe)
  const CPLBL_Y = (hasTballHUD ? TBY0 + TBALL_ROW_H + 4 : BY0 + BSIZE * 2 + 6) + 14
  const panH = CPLBL_Y + 16 + 8
  ctx.fillStyle = "rgba(0,0,0,0.72)"
  ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 10); ctx.fill()
  ctx.strokeStyle = th.accent + "44"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 10); ctx.stroke()

  // ── Corazones ─────────────────────────────────────────────────────────────
  // Escala ×2: 1 corazón = 2 hp, medio corazón = 1 hp
  // 6 slots: 5 activos iniciales + 1 bloqueado (se desbloquea con hpup del último jefe)
  const HX0 = panX + 12
  const heartSpr = sprs["hud_heart"]
  const hpupUnlocked = g.abilities.has("hpup")
  // Dibuja el sprite/forma de corazón (sin alpha — el llamador lo gestiona)
  const drawHeartAt = (hx: number, hy: number, s: number) => {
    if (heartSpr && heartSpr.complete && heartSpr.naturalWidth > 0) {
      ctx.drawImage(heartSpr, hx, hy, s, s)
    } else {
      ctx.fillStyle = "#FF1744"
      ctx.beginPath()
      ctx.moveTo(hx+s/2,hy+s*.8); ctx.bezierCurveTo(hx+s/2,hy+s*.6,hx,hy+s*.3,hx,hy+s*.5)
      ctx.bezierCurveTo(hx,hy+s*.2,hx+s*.3,hy,hx+s/2,hy+s*.3)
      ctx.bezierCurveTo(hx+s*.7,hy,hx+s,hy+s*.2,hx+s,hy+s*.5)
      ctx.bezierCurveTo(hx+s,hy+s*.3,hx+s/2,hy+s*.6,hx+s/2,hy+s*.8); ctx.fill()
    }
  }
  for (let i = 0; i < 6; i++) {
    const hx = HX0 + i * HSP
    const isLocked  = i >= 5 && !hpupUnlocked   // 6º slot bloqueado hasta hpup
    const hpLeft    = p.hp - i * 2              // hp restante en este slot (0..2)
    const isFull    = !isLocked && hpLeft >= 2
    const isHalf    = !isLocked && hpLeft === 1
    if (isLocked) {
      // Corazón bloqueado: muy tenue + candado encima
      ctx.save(); ctx.globalAlpha = 0.12; drawHeartAt(hx, HY0, HS); ctx.restore()
      const cx2 = hx + HS * 0.5, arcY = HY0 + HS * 0.38
      ctx.save()
      ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx2, arcY, HS * 0.16, Math.PI, 0); ctx.stroke()
      ctx.fillStyle = "#555"
      ctx.fillRect(cx2 - HS * 0.20, arcY, HS * 0.40, HS * 0.32)
      ctx.restore()
    } else if (isFull) {
      drawHeartAt(hx, HY0, HS)
    } else if (isHalf) {
      // Fondo vacío
      ctx.save(); ctx.globalAlpha = 0.18; drawHeartAt(hx, HY0, HS); ctx.restore()
      // Mitad izquierda llena con clip
      ctx.save()
      ctx.beginPath(); ctx.rect(hx, HY0, HS / 2, HS); ctx.clip()
      drawHeartAt(hx, HY0, HS)
      ctx.restore()
    } else {
      // Vacío
      ctx.save(); ctx.globalAlpha = 0.18; drawHeartAt(hx, HY0, HS); ctx.restore()
    }
  }

  // ── Enemigos en sala ──────────────────────────────────────────────────────
  const ELBL_W = 26
  ctx.fillStyle = th.accent + "88"; ctx.font = "bold 8px 'Courier New',monospace"
  ctx.fillText("SALA", HX0, EY0 + 10)
  const roomSpawns = getEnemySpawns(curW, curC, curR)
  const eliveSpr = sprs["hud_enemy_live"], edeadSpr = sprs["hud_enemy_dead"]
  if (roomSpawns.length === 0) {
    ctx.fillStyle = "#00FF88"; ctx.font = "bold 9px 'Courier New',monospace"
    ctx.fillText("✓ LIMPIA", HX0 + ELBL_W, EY0 + 16)
  } else {
    for (let i = 0; i < Math.min(roomSpawns.length, 6); i++) {
      const ex = HX0 + ELBL_W + i * ESTP
      const dead2 = g.dead.has(`${rid(curW, curC, curR)}_${i}`)
      const spr = dead2 ? edeadSpr : eliveSpr
      if (spr && spr.complete && spr.naturalWidth > 0) {
        if (dead2) { ctx.save(); ctx.globalAlpha = 0.42 }
        ctx.drawImage(spr, ex, EY0, ESIZE, ESIZE)
        if (dead2) ctx.restore()
      } else {
        const ecx = ex + ESIZE/2, ecy = EY0 + ESIZE/2, er = ESIZE/2 - 2
        ctx.fillStyle = dead2 ? "#1A1A1A" : "#CC2222"
        ctx.beginPath(); ctx.arc(ecx, ecy, er, 0, Math.PI*2); ctx.fill()
        if (dead2) {
          ctx.strokeStyle = "#FF4444"; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(ecx-3,ecy-3); ctx.lineTo(ecx+3,ecy+3); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(ecx+3,ecy-3); ctx.lineTo(ecx-3,ecy+3); ctx.stroke()
        }
      }
    }
    if (roomSpawns.length > 6) {
      ctx.fillStyle = "#888"; ctx.font = "bold 8px 'Courier New',monospace"
      ctx.fillText(`+${roomSpawns.length-6}`, HX0 + ELBL_W + 6*ESTP + 2, EY0 + 15)
    }
  }

  // ── Huesos / Munición ─────────────────────────────────────────────────────
  const BLBL_W = 44
  ctx.fillStyle = th.accent + "88"; ctx.font = "bold 8px 'Courier New',monospace"
  ctx.fillText("HUESOS", HX0, BY0 + 10)
  const boneSpr = sprs["hud_bone"]
  for (let i = 0; i < 15; i++) {
    const row = i < BONES_PER_ROW ? 0 : 1
    const col = i < BONES_PER_ROW ? i : i - BONES_PER_ROW
    const bx  = HX0 + BLBL_W + col * BSTP
    const by  = BY0 + row * (BSIZE + 3)
    const has = i < p.ammo
    if (boneSpr && boneSpr.complete && boneSpr.naturalWidth > 0) {
      if (!has) { ctx.save(); ctx.globalAlpha = 0.14 }
      ctx.drawImage(boneSpr, bx, by, BSIZE, BSIZE)
      if (!has) ctx.restore()
    } else {
      ctx.fillStyle = has ? th.accent : "#222"
      ctx.beginPath(); ctx.arc(bx + BSIZE/2, by + BSIZE/2, 3, 0, Math.PI*2); ctx.fill()
    }
  }

  // ── Pelota rebotante (solo si desbloqueada) ──────────────────────────────
  if (hasTballHUD) {
    const tbSpr = sprs["tennis_ball"]
    const tbMax = g.tballUpgraded ? TB_AMMO_MAX : TB_AMMO_INIT
    const tbAmmo = g.tballAmmo
    const tbY = TBY0
    const TBLBL_W = 44, TBSIZE = 14, TBSTP = 17
    const TB_PER_ROW = 8                              // máx iconos por fila (igual que huesos)
    ctx.fillStyle = th.accent + "88"; ctx.font = "bold 8px 'Courier New',monospace"
    ctx.fillText("PELOTA", HX0, tbY + 11)
    // Íconos individuales en 2 filas — mismo comportamiento que los huesos
    for (let i = 0; i < tbMax; i++) {
      const row = i < TB_PER_ROW ? 0 : 1
      const col = i < TB_PER_ROW ? i : i - TB_PER_ROW
      const tx  = HX0 + TBLBL_W + col * TBSTP
      const ty  = tbY + row * (TBSIZE + 3)
      const has = i < tbAmmo
      if (tbSpr && tbSpr.complete && tbSpr.naturalWidth > 0) {
        if (!has) { ctx.save(); ctx.globalAlpha = 0.14 }
        ctx.drawImage(tbSpr, tx, ty, TBSIZE, TBSIZE)
        if (!has) ctx.restore()
      } else {
        ctx.fillStyle = has ? "#CCFF00" : "#2A2A1A"
        ctx.beginPath(); ctx.arc(tx + TBSIZE / 2, ty + TBSIZE / 2, TBSIZE / 2 - 1, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  // ── Checkpoint mini-label ─────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.beginPath(); ctx.roundRect(panX + 6, CPLBL_Y - 2, panW - 12, 16, 3); ctx.fill()
  ctx.fillStyle = th.accent + "88"; ctx.font = "8px 'Courier New',monospace"
  ctx.fillText(`★ W${g.checkpoint.w+1} ${WORLD_NAMES[g.checkpoint.w].slice(0,16)}`, panX + 10, CPLBL_Y + 10)

  // ── Score (esquina top-right) con icono Croqueta ──────────────────────────
  const scBoxX = CW - 112, scBoxY = panY, scBoxW = 106, scBoxH = 36
  ctx.fillStyle = "rgba(0,0,0,0.72)"
  ctx.beginPath(); ctx.roundRect(scBoxX, scBoxY, scBoxW, scBoxH, 8); ctx.fill()
  ctx.strokeStyle = th.accent + "44"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(scBoxX, scBoxY, scBoxW, scBoxH, 8); ctx.stroke()
  const croquetaSpr = sprs["hud_croqueta"]
  if (croquetaSpr && croquetaSpr.complete && croquetaSpr.naturalWidth > 0) {
    ctx.drawImage(croquetaSpr, scBoxX + 7, scBoxY + 6, 24, 24)
  } else {
    ctx.fillStyle = th.accent + "88"; ctx.font = "bold 9px 'Courier New',monospace"
    ctx.fillText("PTS", scBoxX + 7, scBoxY + 22)
  }
  ctx.fillStyle = th.accent; ctx.font = "bold 14px 'Courier New',monospace"
  ctx.textAlign = "right"; ctx.fillText(`${g.score}`, scBoxX + scBoxW - 8, scBoxY + 25); ctx.textAlign = "left"

  // ── Stamina: barra clásica o círculo junto al personaje ───────────────────
  const stRatio = p.stamina / p.maxStamina
  if (g.staDisplay === "bar") {
    const stW = 84, stH = 10, stX = CW - 112, stY = scBoxY + scBoxH + 4
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(stX, stY, stW, stH, 3); ctx.fill()
    if (p.exhausted) {
      if (Math.floor(Date.now()/250)%2===0) { ctx.fillStyle="#FF220044"; ctx.beginPath(); ctx.roundRect(stX+1,stY+1,stW-2,stH-2,2); ctx.fill() }
      ctx.strokeStyle="#FF3300BB"; ctx.lineWidth=1.5; ctx.strokeRect(stX,stY,stW,stH)
      const cdRatio = p.staminaCooldown/5.0
      ctx.fillStyle="#FF330055"; ctx.beginPath(); ctx.roundRect(stX+1,stY+1,Math.max(0,(stW-2)*cdRatio),stH-2,2); ctx.fill()
      ctx.fillStyle="#FF6600DD"; ctx.font="9px 'Courier New',monospace"; ctx.textAlign="center"
      ctx.fillText(`${Math.ceil(p.staminaCooldown)}s`,stX+stW/2,stY+8); ctx.textAlign="left"
    } else {
      const stCol=stRatio>0.55?"#44EE44":stRatio>0.25?"#EEcc00":"#FF4400"
      ctx.fillStyle=stCol; ctx.beginPath(); ctx.roundRect(stX+1,stY+1,Math.max(0,(stW-2)*stRatio),stH-2,2); ctx.fill()
      ctx.fillStyle="rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(stX+1,stY+1,Math.max(0,(stW-2)*stRatio),Math.round(stH/2)-1,1); ctx.fill()
    }
    ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="9px 'Courier New',monospace"
    ctx.textAlign="right"; ctx.fillText(p.exhausted?"AGOTADO":"STA",stX-2,stY+8); ctx.textAlign="left"
  } else if (g.staCircleAlpha > 0.01) {
    ctx.save(); ctx.globalAlpha = g.staCircleAlpha
    const _sc = g.mobileZoom==="close"?1.35:1.0
    const scx=(p.x-g.cx+PW/2)*_sc, scy=(p.y-g.cy-20)*_sc, rad=13, lw=3.5
    ctx.beginPath(); ctx.arc(scx,scy,rad,0,Math.PI*2); ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fill()
    const startA=-Math.PI/2
    if (p.exhausted) {
      const blink=Math.floor(Date.now()/280)%2===0
      ctx.strokeStyle=blink?"#FF2200":"#FF6600"; ctx.lineWidth=lw
      ctx.beginPath(); ctx.arc(scx,scy,rad,startA,startA+Math.max(0,p.staminaCooldown/4.5)*Math.PI*2); ctx.stroke()
      ctx.fillStyle=blink?"#FF4400DD":"#FF6600BB"; ctx.font="bold 9px 'Courier New',monospace"
      ctx.textAlign="center"; ctx.textBaseline="middle"
      ctx.fillText(`${Math.ceil(p.staminaCooldown)}s`,scx,scy); ctx.textBaseline="alphabetic"
    } else {
      const arcCol=stRatio>0.55?"#44EE44":stRatio>0.25?"#EECC00":"#FF4400"
      ctx.strokeStyle=arcCol; ctx.lineWidth=lw; ctx.lineCap="round"
      ctx.beginPath(); ctx.arc(scx,scy,rad,startA,startA+stRatio*Math.PI*2); ctx.stroke()
    }
    ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1
    ctx.beginPath(); ctx.arc(scx,scy,rad,0,Math.PI*2); ctx.stroke()
    ctx.restore(); ctx.textAlign="left"
  }

  // ── Dev badge ─────────────────────────────────────────────────────────────
  if (g.devMode) {
    ctx.fillStyle="rgba(0,80,0,0.85)"; ctx.beginPath(); ctx.roundRect(CW-90,46,84,16,3); ctx.fill()
    ctx.strokeStyle="#00FF44"; ctx.lineWidth=1; ctx.strokeRect(CW-90,46,84,16)
    ctx.fillStyle="#00FF44"; ctx.font="bold 9px 'Courier New',monospace"; ctx.textAlign="center"
    const devFlags=(g.godMode?"GOD ":"")+(g.infiniteAmmo?"AMM ":"")+(g.noEnemies?"NOENM ":"")+(g.ohko?"OHKO":"")
    ctx.fillText(`DEV${devFlags.trim()?"|"+devFlags.trim():""}`,CW-48,57); ctx.textAlign="left"
  }

  // ── kennelMsg: ícono de save animado (checkpoint) o toast de texto (GFX) ─────
  if (g.kennelMsg > 0) {
    const isGfxMsg = !!(g as any)._gfxMsg
    if (isGfxMsg) {
      // Toast de texto para cambio de calidad gráfica (no checkpoint) — igual que antes
      const alpha = Math.min(1, g.kennelMsg) * Math.min(1, g.kennelMsg / 0.5)
      ctx.save(); ctx.globalAlpha = alpha
      const cpY = g.isMobile ? CH - 88 : CH - 72
      ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.beginPath(); ctx.roundRect(CW / 2 - 136, cpY, 272, 40, 8); ctx.fill()
      ctx.strokeStyle = th.accent + "88"; ctx.lineWidth = 1.5; ctx.strokeRect(CW / 2 - 136, cpY, 272, 40)
      ctx.fillStyle = th.accent; ctx.font = "bold 14px 'Courier New',monospace"; ctx.textAlign = "center"
      ctx.fillText(`◈  GRÁFICOS: ${["BAJA", "MEDIA", "ALTA"][g.gfx]}  ◈`, CW / 2, cpY + 26)
      ctx.textAlign = "left"; ctx.restore()
    } else {
      // ── Ícono de save animado (sprite 1105×1955, 5×5 grid, 25 frames) ──────────
      // Duración total: 3s (kennelMsg 3→0). Una secuencia: 25 frames a ~10fps = 2.5s.
      // Fade out en el último 0.5s (kennelMsg < 0.5).
      const saveIconSpr = sprs["save_icon"]
      const TOTAL = 3.0
      const elapsed = Math.max(0, TOTAL - g.kennelMsg)
      const frame   = Math.floor(elapsed * 10) % 25   // ~10fps
      const fw = saveIconSpr ? saveIconSpr.naturalWidth  / 5 : 0
      const fh = saveIconSpr ? saveIconSpr.naturalHeight / 5 : 0
      const col = frame % 5, row2 = Math.floor(frame / 5)
      const SW = 44, SH = 78   // 221×391 → proporción ×0.199
      const px = panX                                     // alineado al borde del panel HUD
      // Desktop: máximo inferior izquierdo (4px del borde)
      // Mobile:  debajo de la fila de corazones, sin solaparse con el panel HUD ni el d-pad
      const py = g.isMobile ? (HY0 + HS + 6) : (CH - SH - 4)
      const alpha = Math.min(1, g.kennelMsg * 2)   // fade en último 0.5s
      ctx.save(); ctx.globalAlpha = alpha
      if (saveIconSpr && saveIconSpr.complete && saveIconSpr.naturalWidth > 0) {
        ctx.drawImage(saveIconSpr, col * fw, row2 * fh, fw, fh, px, py, SW, SH)
      } else {
        // Fallback: texto simple si el sprite no cargó
        ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.beginPath(); ctx.roundRect(px, py, 120, 30, 6); ctx.fill()
        ctx.fillStyle = "#00FF88"; ctx.font = "bold 11px 'Courier New',monospace"
        ctx.fillText("✦ GUARDADO", px + 8, py + 20)
      }
      ctx.restore()
    }
  }
  // ── Barra de boss — solo visible cuando el jugador está EN la sala del boss ──
  const bossRoomType = isBossRoom(curW, curC, curR)
  const inBossRoom = bossRoomType !== null
  // Buscar SOLO el boss de la sala actual (por ID de sala) para evitar mostrar el boss equivocado
  const roomPrefix = `${curW}_${curC}_${curR}_`
  const boss = inBossRoom ? g.enemies.find(e => e.active && !e.dying && e.boss && e.originalId.startsWith(roomPrefix)) : null
  if (boss) {
    const BOSS_NAMES: Record<string, string> = { p1: "El Castigador", p2: "El Herrero", ultra: "El Torturado" }
    const bossName = (bossRoomType && BOSS_NAMES[bossRoomType]) || WORLD_NAMES[boss.world]
    const barW = 420, barH = 14, barX = (CW - barW) / 2
    // En mobile: barra boss sobre los botones MAP/PAUSA (contenedor barY-22 a barY+22 → bottom ~CH-46)
    const barY = g.isMobile ? CH - 68 : CH - 34
    ctx.fillStyle = "rgba(0,0,0,0.85)"
    ctx.beginPath(); ctx.roundRect(barX - 8, barY - 22, barW + 16, barH + 30, 7); ctx.fill()
    ctx.strokeStyle = th.doorC + "88"; ctx.lineWidth = 1.5; ctx.strokeRect(barX - 8, barY - 22, barW + 16, barH + 30)
    // Nombre del boss y fase
    ctx.fillStyle = th.doorC; ctx.font = "bold 9px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText(`⚠ ${bossName} ⚠`, CW / 2 - 50, barY - 8)
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

  // (Habilidades y poder activo eliminados del HUD — ver menú de pausa)

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

  // ── Burbuja de celular de Luly (mensaje de Rex) — tipeo animado ─────────
  if (g.rexPhoneNotif && g.rexPhoneNotif.setAt) {
    const pn = g.rexPhoneNotif
    const line1 = "📱 Rex: ¡Luly, ven a verme!"
    const line2 =
      pn.kind === "p1"       ? "Necesitas saber del Castigador" :
      pn.kind === "section2" ? "¡Hay más por explorar, ven!" :
      pn.kind === "p2"       ? "Necesitas saber del Herrero" :
      /* ultra */              "El último jefe... debo decírtelo en persona"
    const totalChars = line1.length + line2.length

    // Mismas constantes que page.tsx
    const PHONE_FPF        = 40
    const PHONE_PHASE0_DUR = 20 * PHONE_FPF   // 800ms
    const PHONE_CHAR_DELAY = 62                // ms/carácter
    const PHONE_WAIT_DUR   = 4200              // ms espera
    const PHONE_PHASE3_DUR = 3 * PHONE_FPF    // 200ms

    const typingStart = pn.setAt + PHONE_PHASE0_DUR
    const typingEnd   = typingStart + totalChars * PHONE_CHAR_DELAY
    const waitEnd     = typingEnd   + PHONE_WAIT_DUR
    const phase3End   = waitEnd     + PHONE_PHASE3_DUR
    const nowMs       = Date.now()

    // Calcular qué mostrar y con qué alpha
    let line1Shown = "", line2Shown = ""
    let bubbleAlpha = 0

    if (nowMs < typingStart) {
      // Fase 0: sin texto aún, pero la burbuja aparece ya (fade-in rápido)
      const fadeIn = Math.min(1, (nowMs - pn.setAt) / 300)
      bubbleAlpha = fadeIn * 0.55   // tenue en fase 0
    } else if (nowMs < typingEnd) {
      // Fase 1: tipeo carácter a carácter
      const elapsed     = nowMs - typingStart
      const charsShown  = Math.floor(elapsed / PHONE_CHAR_DELAY)
      line1Shown = line1.slice(0, Math.min(charsShown, line1.length))
      line2Shown = charsShown > line1.length
        ? line2.slice(0, charsShown - line1.length)
        : ""
      bubbleAlpha = 1
    } else if (nowMs < waitEnd) {
      // Fase 2: texto completo, espera
      line1Shown = line1; line2Shown = line2
      bubbleAlpha = 1
    } else if (nowMs < phase3End) {
      // Fase 3: fade-out suave
      line1Shown = line1; line2Shown = line2
      bubbleAlpha = 1 - (nowMs - waitEnd) / PHONE_PHASE3_DUR
    } else {
      bubbleAlpha = 0
    }

    if (bubbleAlpha > 0.01) {
      ctx.save(); ctx.globalAlpha = Math.max(0, bubbleAlpha)
      ctx.font = "bold 10px 'Courier New',monospace"

      // Ancho fijo del cuadro (usa las líneas completas para calcular tamaño estable)
      const w1full = ctx.measureText(line1).width
      const w2full = ctx.measureText(line2).width
      const bw = Math.max(w1full, w2full) + 22
      const bh = 40   // altura fija con dos líneas

      const plSx = g.pl.x - g.cx + PW / 2
      const plSy = g.pl.y - g.cy
      const sc   = g.mobileZoom === "close" ? 1.35 : 1.0
      const bx2  = Math.max(4, Math.min(CW - bw - 4, plSx * sc - bw / 2))
      const by2  = Math.max(4, plSy * sc - bh - 32)

      // Fondo
      ctx.fillStyle = "rgba(0,25,35,0.96)"
      ctx.beginPath(); ctx.roundRect(bx2, by2, bw, bh, 7); ctx.fill()
      ctx.strokeStyle = "#00CCDDAA"; ctx.lineWidth = 1.3
      ctx.beginPath(); ctx.roundRect(bx2, by2, bw, bh, 7); ctx.stroke()

      // Cola
      const tailX = Math.max(bx2 + 14, Math.min(bx2 + bw - 14, plSx * sc))
      ctx.fillStyle = "rgba(0,25,35,0.96)"
      ctx.beginPath(); ctx.moveTo(tailX - 5, by2 + bh); ctx.lineTo(tailX + 5, by2 + bh); ctx.lineTo(tailX, by2 + bh + 9); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = "#00CCDDAA"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(tailX - 5, by2 + bh); ctx.lineTo(tailX, by2 + bh + 9); ctx.lineTo(tailX + 5, by2 + bh); ctx.stroke()

      ctx.textAlign = "center"

      // Línea 1
      if (line1Shown.length > 0) {
        ctx.fillStyle = "#AAEEFF"
        ctx.fillText(line1Shown, bx2 + bw / 2, by2 + 15)
      }

      // Línea 2
      if (line2Shown.length > 0) {
        ctx.fillStyle = "#66DDCC"
        ctx.fillText(line2Shown, bx2 + bw / 2, by2 + 30)
      }

      // Cursor parpadeante durante el tipeo
      const isTyping = nowMs >= typingStart && nowMs < typingEnd
      if (isTyping && Math.floor(nowMs / 420) % 2 === 0) {
        const cursorLine = line2Shown.length > 0 ? line2Shown : line1Shown
        const cursorY    = line2Shown.length > 0 ? by2 + 30 : by2 + 15
        const cursorX    = bx2 + bw / 2 + ctx.measureText(cursorLine).width / 2 + 2
        ctx.fillStyle = "#00FFEE"
        ctx.fillRect(cursorX, cursorY - 8, 2, 10)
      }

      ctx.textAlign = "left"; ctx.restore()
    }
  }

  // ── Notificación de habilidad desbloqueada ────────────────────────────
  if (g.abilityNotif && g.abilityNotif.timer > 0) {
    const t = g.abilityNotif.timer
    const alpha = Math.min(1, t * 2) * Math.min(1, (4.0 - t) * 1.5)
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha)
    // Word-wrap del texto principal para que quepa en el cuadro
    ctx.font = `bold 13px 'Courier New',monospace`
    const maxLineW = 360
    const notifLines: string[] = []
    let notifCur = ''
    for (const word of g.abilityNotif.text.split(' ')) {
      const test = notifCur ? `${notifCur} ${word}` : word
      if (ctx.measureText(test).width <= maxLineW) { notifCur = test }
      else { if (notifCur) notifLines.push(notifCur); notifCur = word }
    }
    if (notifCur) notifLines.push(notifCur)
    const lineH = 19
    const boxW = 420, boxH = Math.max(90, 50 + notifLines.length * lineH + 22)
    const bx = CW / 2 - boxW / 2
    // Posición vertical: en PC bien abajo; en móvil también abajo, encima del mensaje de checkpoint
    const by = g.isMobile ? CH - boxH - 106 : CH - boxH - 32
    ctx.fillStyle = "rgba(0,0,0,0.92)"
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 12); ctx.fill()
    ctx.strokeStyle = th.accent; ctx.lineWidth = 2; ctx.strokeRect(bx, by, boxW, boxH)
    ctx.fillStyle = th.accent; ctx.font = "bold 10px 'Courier New',monospace"; ctx.textAlign = "center"
    ctx.fillText("✦  NUEVA HABILIDAD DESBLOQUEADA  ✦", CW / 2, by + 22)
    ctx.fillStyle = "#FFFFFF"; ctx.font = `bold 13px 'Courier New',monospace`
    notifLines.forEach((line, i) => ctx.fillText(line, CW / 2, by + 44 + i * lineH))
    ctx.fillStyle = th.accent + "99"; ctx.font = "9px 'Courier New',monospace"
    ctx.fillText("Elimina al siguiente jefe para la próxima habilidad", CW / 2, by + boxH - 10)
    ctx.textAlign = "left"; ctx.restore()
  }
}

export function drawWorldTransition(ctx: CanvasRenderingContext2D, g: G) {
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

