// ══════════════════════════════════════════════════════════════
//  CONSTANTES — game/constants.ts
// ══════════════════════════════════════════════════════════════
import type { Theme, CPDef } from "./types"

// Prefijo de ruta para GitHub Pages — vacío en local, "/Proyect_Luly" en producción
export const BASE_PATH = process.env.NODE_ENV === "production" ? "/Proyect_Luly" : ""
export const asset = (path: string) => `${BASE_PATH}${path}`

export const CW = 1050, CH = 600
export const RW = 1400, RH = 680
export const WT = 24, DW = 140, DH = 140
export const NW = 4, NC = 9, NR = 9
export const PW = 48, PH = 72, PH_CROUCH = 38
export const PL_HBX = 10, PL_HBT = 8
export const EN_HBX = 14, EN_HBT = 10
export const EW = 96, EH = 96, BW = 140, BH = 140
export const WALK = 3, RUN = 6, JV = -12, GUP = 0.38, GDN = 0.62, GMAX = 13
export const PSPD = 9, WLEN = 70, WDMG = 1, STEP = 1 / 60
export const CHAIN_REACH = 85    // alcance del ataque de cadena del enemigo W1S2 (px)
export const W1P1_BW = 64, W1P1_BH = 84   // Jefe W1 Sección 1: hitbox (un poco más grande que Luly)
export const WHIP1_REACH = 105   // alcance del látigo Ataque 1 del jefe W1P1 (px)
export const WHIP2_REACH = 148   // alcance del látigo Ataque 2 del jefe W1P1 (px, más fuerte)
export const WHIP1_DMG   = 2     // daño Ataque 1 (1 corazón completo en escala ×2)
export const WHIP2_DMG   = 3     // daño Ataque 2 (1.5 corazones en escala ×2)
export const WHIP1_CD    = 1800  // cooldown Ataque 1 (ms)
export const WHIP2_CD    = 1400  // cooldown Ataque 2 — fase 2 (ms)
export const WHIP_KB_VX  = 6.5   // velocidad de repulsión horizontal al recibir el latigazo
export const WHIP_KB_VY  = -3.5  // componente vertical del repulsión
export const W1P2_BW = 140, W1P2_BH = 220   // Boss W1 Segunda Sección: ~3× Luly (3×72=216)
export const UB_W = 70, UB_H = 100           // El Torturado (Ultra Boss): ligeramente mayor que Luly

// ── Ataques de llama del Torturado ──────────────────────────────────────────
export const UB_FLAME_WARN1    = 4.0   // s de advertencia ataque 1 (suelo + 2 plats)
export const UB_FLAME_WARN2    = 5.0   // s de advertencia ataque 2 (suelo + 3 plats)
export const UB_FLAME_DMG1     = 3     // daño ataque 1 (1.5 corazones = 3 unidades)
export const UB_FLAME_DMG2     = 4     // daño ataque 2 (2 corazones = 4 unidades)
export const UB_FLAME_CD       = 4.0   // s de espera entre ataques
export const UB_FLAME_DMG_DUR  = 1.2   // s de ventana de daño activo
export const UB_FREEZE_FRAME1  = 20    // frame en que el boss se congela (ataque 1)
export const UB_FREEZE_FRAME2  = 15    // frame en que el boss se congela (ataque 2)
export const UB_VULN_DUR       = 2.5   // s de ventana de vulnerabilidad (post ataque 2)
// Arena del Torturado: posición relativa de las 4 plataformas laterales
export const UB_PLAT_W         = 200   // ancho de cada plataforma
export const UB_PLAT_OX        = 40    // offset desde la pared interior (x0+WT+UB_PLAT_OX)
export const UB_PLAT_BOT_FR    = 0.62  // fracción Y interior para plataforma baja
export const UB_PLAT_TOP_FR    = 0.32  // fracción Y interior para plataforma alta
export const SLAM_REACH = 180    // alcance del golpe de piso (px) frente al boss
export const SLAM_KB_VY = -10    // impulso vertical al recibir el slam
export const SLAM_DMG   = 2      // daño del slam (1 corazón completo en escala ×2)
export const SPIN_DURATION = 4.5 // 2 ciclos × 25 frames × 90 ms = 4500 ms exactos
export const SPIN_STUN  = 3.0    // segundos de parálisis post-giro (vulnerable, esperar 3s)
export const SPIN_DMG   = 3      // daño del giro al jugador (1.5 corazones)
export const SPIN_RADIUS = 220   // radio de daño durante el giro
export const SLAM_CD    = 5000   // ms entre slams (base 5 s)
export const SLAM_CD_CLOSE = 3000 // ms entre slams cuando está cerca (<SLAM_CLOSE_DIST)
export const SLAM_CLOSE_DIST = 210 // px — umbral de "cerca" para el slam rápido
export const SPIN_CD    = 2500   // ms de caminata rage antes de iniciar el giro
export const MOUND_W    = 160    // ancho del montículo de herramientas
export const MOUND_H    = 112    // alto del montículo
export const KENNEL_R = 100
export const TOT_W = NW * NC * RW   // 50400
export const TOT_H = NR * RH      // 6120

export function ro(w: number, c: number, r: number) { return { x: w * NC * RW + c * RW, y: r * RH } }
export function rid(w: number, c: number, r: number) { return `${w}_${c}_${r}` }

// ══════════════════════════════════════════════════════════════
//  PALETA
// ══════════════════════════════════════════════════════════════
export const THEMES: Theme[] = [
  // ── W0 LAS PERRERAS ──
  { bg0:"#0E0C09",bg1:"#080604",wall:"#2A2218",wallHi:"#3C3025",platC:"#3E3220",platHi:"#524030",accent:"#D4C400",doorC:"#FF5500",fog:"#150E08",rock:"#1E1610",rockHi:"#2C2018",rockShadow:"#0A0806" },
  // ── W1 FÁBRICA CANINA ──
  { bg0:"#060810",bg1:"#030408",wall:"#101A2E",wallHi:"#182440",platC:"#1E2C44",platHi:"#283C5C",accent:"#FF5500",doorC:"#FF1500",fog:"#0C1020",rock:"#0E1828",rockHi:"#162240",rockShadow:"#04060C" },
  // ── W2 LOS TUBOS ──
  { bg0:"#050908",bg1:"#030604",wall:"#0E1C12",wallHi:"#162A1A",platC:"#1A2C18",platHi:"#223C22",accent:"#00DD88",doorC:"#FF4400",fog:"#080E08",rock:"#0A1810",rockHi:"#122418",rockShadow:"#030604" },
  // ── W3 CTRL. CENTRAL ──
  { bg0:"#06040E",bg1:"#030208",wall:"#12102A",wallHi:"#1A1840",platC:"#1E1A38",platHi:"#28224C",accent:"#CC00FF",doorC:"#FF0088",fog:"#0C0A1C",rock:"#10102A",rockHi:"#1A1A3C",rockShadow:"#050310" },
]

export const WORLD_NAMES = ["LAS PERRERAS", "FÁBRICA CANINA", "LOS TUBOS", "CTRL. CENTRAL"]
export const WORLD_SUBS = ["Libertad o destino", "Engranajes de opresión", "Las venas del sistema", "El corazón del control"]

// ══════════════════════════════════════════════════════════════
//  ESTRUCTURA DE MUNDO 9×9
// ══════════════════════════════════════════════════════════════
export const TROW = 4  // fila de transición (siempre corredor horizontal)

export const TRANSIT_VERT_UP: number[] = [0, 3, 6]
export const TRANSIT_VERT_DOWN: number[] = [3, 6]
export const TRANSIT_BOSS_COL = 4

export const WORLD_P1_BOSS: [number, number][] = [[8, 1], [8, 1], [8, 1], [8, 1]]
export const WORLD_P2_BOSS: [number, number][] = [[8, 7], [8, 7], [8, 7], [8, 7]]

export const THEMES_P2: Theme[] = [
  // W0 Parte2 — subterráneo rojo/sangre
  { bg0:"#0E0200",bg1:"#070100",wall:"#3A0808",wallHi:"#560E0E",platC:"#4A0808",platHi:"#660E0E",accent:"#FF2200",doorC:"#FF5500",fog:"#1A0402",rock:"#280404",rockHi:"#3C0606",rockShadow:"#040100" },
  // W1 Parte2 — forja industrial naranja oscuro
  { bg0:"#100500",bg1:"#080200",wall:"#2E1000",wallHi:"#3E1800",platC:"#381200",platHi:"#4C1800",accent:"#FF6600",doorC:"#FF2200",fog:"#180800",rock:"#240C00",rockHi:"#321200",rockShadow:"#050200" },
  // W2 Parte2 — pantano carmesí tóxico
  { bg0:"#0A0008",bg1:"#050004",wall:"#280014",wallHi:"#3C001E",platC:"#340018",platHi:"#4A0022",accent:"#FF0055",doorC:"#FF4400",fog:"#140010",rock:"#1E000E",rockHi:"#2C0016",rockShadow:"#030004" },
  // W3 Parte2 — vacío corrupto violeta negro
  { bg0:"#02000C",bg1:"#010006",wall:"#100020",wallHi:"#180030",platC:"#140028",platHi:"#1E0038",accent:"#8800FF",doorC:"#FF0088",fog:"#080012",rock:"#0C0020",rockHi:"#14002E",rockShadow:"#020008" },
]

// ══════════════════════════════════════════════════════════════
//  CONFIG DE MUNDOS
// ══════════════════════════════════════════════════════════════
export const WORLD_EXITS = [[8, 7], [8, 7], [8, 7], [8, 7]]  // puerta de salida = jefe P2
export const WORLD_ENTRIES = [null, [0, 4], [0, 4], [0, 4]]
export const PLAYER_START = [0, 0, 4]
export const KENNEL_ROOMS = [{ w: 0, c: 0, r: 4 }, { w: 1, c: 0, r: 4 }, { w: 2, c: 0, r: 4 }, { w: 3, c: 0, r: 4 }]
export const KENNEL_WORLD_POS = KENNEL_ROOMS.map(({ w, c, r }) => {
  const { x: x0, y: y0 } = ro(w, c, r)
  return { x: x0 + WT + 90, y: y0 + RH - WT - PH }
})

// ── Sistema de Checkpoints ────────────────────────────────────────────────────
export const CP_LOCS: [number, number][] = [[0, 4], [4, 0], [8, 4], [4, 8]]
export const CP_COMPASS = ["OESTE", "NORTE", "ESTE", "SUR"]
export const CP_ICON = ["◀", "▲", "▶", "▼"]
export const CP_LOCS_P1: [number, number][] = [[2, 0], [6, 0], [1, 2], [5, 2]]
export const CP_LOCS_P2: [number, number][] = [[2, 5], [6, 5], [1, 7], [5, 7]]
export const CP_LOCS_BOSS: [number, number, "p1" | "ultra" | "p2"][] = [
  [8, 1, "p1"], [4, 4, "ultra"], [8, 7, "p2"]
]
export const CP_RADIUS = 115  // radio de descubrimiento/uso

// ── Jaula de la pelota de tenis ─────────────────────────────────────────────
export const TBALL_SECRET_C = 6, TBALL_SECRET_R = TROW
const { x: _TBALL_RX, y: _TBALL_RY } = ro(0, TBALL_SECRET_C, TBALL_SECRET_R)
const _CAGE_H = 130
const _CAGE_W = Math.round(_CAGE_H * 581 / 454)   // ≈ 166
export const TBALL_WALL = {
  x: _TBALL_RX + Math.floor(RW * 0.50) - Math.floor(_CAGE_W / 2),
  y: _TBALL_RY + RH - WT - _CAGE_H,
  w: _CAGE_W,
  h: _CAGE_H,
}
export const TBALL_PICKUP_POS = {
  x: TBALL_WALL.x + Math.floor(TBALL_WALL.w / 2),
  y: TBALL_WALL.y + Math.floor(TBALL_WALL.h * 0.36),
}

// ── Viejo Dog NPC ───────────────────────────────────────────────────────────
export const VIEJO_DOG_C = 1, VIEJO_DOG_R = TROW
const { x: _VDX, y: _VDY } = ro(0, VIEJO_DOG_C, VIEJO_DOG_R)
export const VIEJO_DOG_POS = {
  x: _VDX + Math.floor(RW * 0.28),
  y: _VDY + RH - WT - 10,
}
export const VIEJO_DOG_TALK_R = 115
export const VIEJO_DOG_CALLOUT_R = 230

// ── Bolkha the Merchant ─────────────────────────────────────────────────────
export const BOLKHA_W = 48, BOLKHA_H = 64
export const BOLKHA_RENDER_W = 68, BOLKHA_RENDER_H = 82
export const BOLKHA_FEET_OFF = Math.round(BOLKHA_RENDER_H * 0.9741)
export const BOLKHA_POS = {
  x: _VDX + Math.floor(RW * 0.55),
  y: _VDY + RH - WT - BOLKHA_H,
}
export const BOLKHA_TALK_R     = 120
export const BOLKHA_CALLOUT_R  = 210
export const BOLKHA_DISCOVER_R = 180
export const BOLKHA_APPEAR_DUR = 2.0
export const BOLKHA_PRICE_HEART = 1000
export const BOLKHA_PRICE_BONES = 1500
export const BOLKHA_PRICE_TBALL = 2500

// ── Rex tipografía ──────────────────────────────────────────────────────────
export const REX_TYPING_MS   = 36

// ── Llave de la jaula ───────────────────────────────────────────────────────
export const TBALL_KEY_DROP_CHANCE = 0.20
export const TBALL_KEY_MIN_KILLS = 3
export const TBALL_KEY_FORCE_KILL = 20

// ── Túneles ─────────────────────────────────────────────────────────────────
export const TUN_H_INNER = [170, 155, 160, 148]
export const TUN_V_WIDTH = [270, 250, 260, 240]
export const STAIR_H = 24
export const JUMP_H = 190

// ── Plataformas arena boss ───────────────────────────────────────────────────
export const ARENA_PLAT_SHOW  = 5.0
export const ARENA_PLAT_HIDE  = 3.0
export const ARENA_PLAT_AMP   = 70
export const ARENA_PLAT_SPD   = 1.4
export const ARENA_PLAT_W     = 180
export const ARENA_PLAT_H     = 20

// ── Proyectiles ─────────────────────────────────────────────────────────────
export const PROJ_GRAV = 0.22, PROJ_MAXD = 440

// ── Pelotas rebotantes ───────────────────────────────────────────────────────
export const TB_R = 8
export const TB_SPD = 5.5
export const TB_GRAVITY = 0.12
export const TB_MAX_BOUNCES = 5
export const TB_MAX_LIFE = 8
export const TB_MAX_SIMULTANEOUS = 3
export const TB_AMMO_INIT = 3
export const TB_AMMO_MAX = 15
export const TB_AMMO_DROP = 3

// ── Gamepad ─────────────────────────────────────────────────────────────────
export const GP = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 }
export const GP_DEAD = 0.20

/** Mapea acción → etiqueta de botón por tipo de mando */
export const GPAD_BTN: Record<string, Record<string, string>> = {
  jump:      { xbox: "A",     ps: "✕",     keyboard: "ESPACIO" },
  confirm:   { xbox: "A",     ps: "✕",     keyboard: "ENTER" },
  cancel:    { xbox: "B",     ps: "○",     keyboard: "ESC" },
  shoot:     { xbox: "X",     ps: "□",     keyboard: "N" },
  whip:      { xbox: "Y",     ps: "△",     keyboard: "M" },
  interact:  { xbox: "B",     ps: "○",     keyboard: "E" },
  teleport:  { xbox: "LB",    ps: "L1",    keyboard: "T" },
  dash:      { xbox: "LT",    ps: "L2",    keyboard: "SHIFT" },
  run:       { xbox: "RT",    ps: "R2",    keyboard: "CTRL" },
  map:       { xbox: "SEL",   ps: "SHARE", keyboard: "TAB" },
  pause:     { xbox: "START", ps: "OPT",   keyboard: "P" },
  walljump:  { xbox: "←/→+A", ps: "←/→+✕", keyboard: "←/→+SPC" },
  move:      { xbox: "LS",    ps: "LS",    keyboard: "WASD" },
  nav:       { xbox: "LS/D↕", ps: "LS/D↕", keyboard: "↑↓" },
}
/** Colores de botones Xbox */
export const XB_COL: Record<string, string> = { A: "#1DB954", B: "#E03030", X: "#1565C0", Y: "#F9A825" }
/** Colores de botones PlayStation */
export const PS_COL: Record<string, string> = { "✕": "#5C8EF7", "○": "#E53935", "□": "#E91E8C", "△": "#2EB872" }

// ── Salvar ──────────────────────────────────────────────────────────────────
export const SAVE_KEY = "proyecto_luly_v2"
export const GAME_VERSION = "0.3.19"

// ── BG ──────────────────────────────────────────────────────────────────────
export const BG_IMGS: (HTMLImageElement | null)[] = [null, null, null, null]
export const BG_PATHS = [
  asset("/assets/background/world_1.png"),
  asset("/assets/background/world_2.png"),
  asset("/assets/background/world_3.png"),
  asset("/assets/background/world_4.png"),
]
