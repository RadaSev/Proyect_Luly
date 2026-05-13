// ══════════════════════════════════════════════════════════════
//  TIPOS — game/types.ts
//  Todas las interfaces/types del juego. Sin imports de otros módulos del juego.
// ══════════════════════════════════════════════════════════════

export type WPlat = { x: number; y: number; w: number; h: number; mode: "s" | "t" | "d"; sw?: number }

// Plataforma móvil del arena del jefe (sube/baja + ciclo visible/oculta)
export type MovingPlat = {
  baseX: number; baseY: number   // posición base (Y en el centro del recorrido)
  w: number; h: number
  // movimiento vertical
  ampY: number                   // amplitud (px arriba/abajo desde baseY)
  phase: number                  // fase actual (rad, 0-2π)
  speed: number                  // rad/s
  // ciclo visible/oculto
  visible: boolean
  hiddenTimer: number            // tiempo restante oculta (s)
  showTimer: number              // tiempo restante visible (s)
  // posición actual (calculada en tick)
  x: number; y: number
}

export type Player = {
  x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean; facing: 1 | -1; hp: number; maxHp: number; inv: number; ammo: number; ls: number; as2: number; sh: boolean; jh: boolean; djump: boolean; djumpAvail: boolean; wh: boolean; wcd: number; pf: number; pft: number; pa: string; crouching: boolean; stamina: number; maxStamina: number; staminaCooldown: number; exhausted: boolean; runMode: boolean; tapLeft: number; tapRight: number;
  usingPhone: boolean       // animación del celular activa (bloquea inputs)
  tapDown: number; dropThruPlatform: boolean
  // Dash
  dash: boolean; dashCd: number; dashDir: 1 | -1; dashTimer: number
  // Wall slide / wall jump
  wallSliding: boolean; wallDir: 0 | 1 | -1; wallJumpCd: number
  // Attack lock: countdown (segundos) que impide disparar hasta que la animación progrese
  atkLock: number
}

export type Enemy = {
  id: string; x: number; originalId: string; y: number; w: number; h: number; vx: number; vy: number; hp: number; mhp: number; dir: number; p0: number; p1: number; spd: number; cd: number; ls: number; sa: number; active: boolean; boss: boolean; ef: number; eft: number; world: number; state: "patrol" | "guard" | "chase"; alert: boolean; alertT: number; guardX: number; idleT: number; jumpCd: number;
  dying: boolean; deathTimer: number; deathDir: number; deathFalling: boolean
  hurtTimer: number
  isMoving: boolean
  alertDelay: number
  phase: number
  ls2: number                                                   // timestamp último ataque-2
  chainHit: { dir: number; life: number; dealt: boolean } | null // ataque melee de cadena
  spinTimer: number     // segundos restantes de giro del Blacksmith
  stunTimer: number     // segundos restantes de parálisis post-giro
  spinHitMound: boolean // ya golpeó un montículo en esta iteración de giro
  atkPending: boolean   // ataque decidido, esperando el windup para lanzar el proyectil
}

export type Proj = { x: number; y: number; vx: number; vy: number; active: boolean; pl: boolean; star: boolean; rot: number; life: number; dist: number; ox: number; oy: number; parried?: boolean; lightning?: boolean }
export type Bone = { x: number; y: number; w: number; h: number; vx: number; vy: number; active: boolean; life: number }
export type Whip = { x: number; y: number; ex: number; ey: number; life: number; dealt: boolean }
export type Drop   = { x: number; y: number; vx: number; vy: number; active: boolean; life: number; kind: "h" | "a" | "tba" | "c" }
export type TBall  = { x: number; y: number; vx: number; vy: number; active: boolean; bounces: number; life: number }
export type Pickup = { id: string; kind: "tball" | "tball_key" | "baton"; x: number; y: number; active: boolean; floatPhase: number; spawnTimer?: number }
export type Crate = { id: number; x: number; y: number; w: number; h: number; active: boolean }
export type WorldAnim = { name: string; sub: string; alpha: number; phase: "in" | "hold" | "out"; timer: number }
export type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; col: string }
export type ToolMound  = { id: number; x: number; y: number; w: number; h: number; active: boolean }
export type FlyingTool = { x: number; y: number; vx: number; vy: number; life: number; active: boolean; dealt: boolean; rot: number; rotSpd: number }
export type WorldSnapshot = {
  enemies: Enemy[]
  crates: Crate[]
  dead: Set<string>
  explored: Set<string>
}

export type G = {
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
  tpMenu: { open: boolean; world: number; cpIdx: number } | null
  tpAnim: { timer: number; phase: 0 | 1; destX: number; destY: number } | null
  // Stamina display mode: "bar" = classic top-right bar, "circle" = circle near player
  staDisplay: "bar" | "circle"
  staCircleAlpha: number
  // Mobile zoom: "far" = full world (default), "close" = zoom-in (personaje más grande)
  mobileZoom: "far" | "close"
  // Fade-to-black al morir (0=transparente → 1=negro)
  overFade: number
  // Habilidades de combate y proyectiles especiales
  tBalls: TBall[]
  tballAmmo: number                   // munición de pelota rebotante
  pickups: Pickup[]
  activePower: string | null          // poder seleccionado actualmente
  bossRewardedCPs: Set<string>        // CPs de boss que ya dieron recompensa
  // Quest del perrito viejo (NPC en TROW [1,4] de W0)
  viejoDogState: "waiting" | "intro" | "quest_active" | "key_dropped" | "key_held" | "cage_opened" | "quest_done" | "surprised" | "ball_held" | "ball_guide" | "reward_lives" | "reward_full" | "baton_delivered" | "p2_warning" | "ultra_hint" | "ultra_done" | "world2_ready"
  tballKeyHeld: boolean
  questKillBaseline: number
  rexBallFirstSeen: boolean
  rexIntroLeft: boolean           // jugadora salió del rango después de ver la intro
  rexBatonHeld: boolean           // jugadora lleva el bastón del Herrero
  tballUpgraded: boolean          // bastón entregado → rebote y munición mejorados
  rexBatonDeliveredSeen: boolean  // jugadora vio el diálogo post-bastón al menos una vez
  rexUltraDoneSeen: boolean       // jugadora vio el diálogo de ultra_done al menos una vez
  // Boss-unlock: puerta de cada jefe se abre solo tras escuchar a Rex
  p1BossRexSeen: boolean          // Rex explicó El Castigador → puerta P1 abierta
  p2BossRexSeen: boolean          // Rex explicó El Herrero → puerta P2 abierta
  ultraBossRexSeen: boolean       // Rex explicó El Torturado → puerta ultra abierta
  rexPhoneNotif: { kind: "p1" | "p2" | "ultra"; timer: number; setAt: number } | null  // burbuja celular Luly
  // Tipo de mando conectado (para iconos dinámicos en HUD/canvas)
  gpadType: "xbox" | "ps" | "keyboard"
  // Indica si el juego está en un dispositivo táctil (oculta minimap, ajusta HUD)
  isMobile: boolean
  // Vista del mapa: "single" = mundo actual ampliado, "all" = los 4 mundos
  mapView: "single" | "all"
  mapViewWorld: number   // índice del mundo mostrado en modo "single"
  // ── DEV: mapa realista miniaturizado (solo dev/PC) ──
  showRealMap: boolean
  realMapWorld: number   // mundo actualmente visible en el real map dev
  realMapScale: number   // multiplicador de tamaño para personajes/enemigos/cajas
  realMapIconMode: number // 0=sprites juego, 1=iconos v1 (pixel), 2=iconos v2 (minimalist)
  realMapSection: number  // 0=sección superior (r0-TROW), 1=sección inferior (TROW-NR-1)
  // Arena del jefe P1: Set<worldIndex> — la entrada se cierra al entrar, abre al morir el boss
  bossArenaLocked: Set<number>
  // Plataformas móviles del arena: aparecen al entrar al cubículo del jefe P1
  bossArenaPlats: MovingPlat[]
  toolMounds: ToolMound[]
  flyingTools: FlyingTool[]
  // ── Bolkha the Merchant (NPC flea, aparece tras matar P1 boss W0) ──────────
  croquetas: number            // moneda de cambio
  bolkhaState: "hidden" | "appearing" | "idle" | "talking" | "giving" | "shop"
  bolkhaFacing: 1 | -1
  bolkhaEf: number             // frame de animación actual (0-24)
  bolkhaEft: number            // acumulador de tiempo para animación
  bolkhaGivingTimer: number    // cuenta regresiva del sprite de entrega
  bolkhaGivingItem: "hearts" | "bones" | "tball" | null
  bolkhaShopOpen: boolean      // menú de compra visible
  bolkhaShopCursor: number     // item seleccionado (0-2)
  bolkhaAppearedOnce: boolean  // efecto de aparición ya ocurrió
  bolkhaTalkText: string       // texto de burbuja de diálogo
  bolkhaTalkTimer: number      // tiempo restante para mostrar burbuja
  bolkhaGreetedThisVisit: boolean  // ya saludó en esta aproximación
  bolkhaAffordTimer: number        // flash "sin croquetas" al intentar comprar sin fondos
  bolkhaShopDescCursor: number     // cursor del último ítem cuya desc se mostró
  bolkhaRexTold: boolean           // Rex mencionó a Bolkha en su diálogo → puede aparecer
  bolkhaMetDialogSeen: boolean     // jugadora ya vio el diálogo "entonces ya lo conociste..."
  rexKeyAnimTimer: number          // segundos de la fase 3 (frames 20→24); al llegar a 0 → explosión
  rexMitadAnimStart: number        // timestamp ms de cuando empezó la anim rex_mitad_llave (0 = sin iniciar)
  sessionStart: number             // timestamp al iniciar sesión o al último guardado (para aviso de salida)
}

// SprBank: mapa de sprites cargados
export type SprBank = Record<string, HTMLImageElement | null>

// Paleta de colores por mundo
export type Theme = { bg0: string; bg1: string; wall: string; wallHi: string; platC: string; platHi: string; accent: string; doorC: string; fog: string; rock: string; rockHi: string; rockShadow: string }

// CPDef: definición de checkpoint
export type CPDef = { id: string; w: number; c: number; r: number; x: number; y: number; label: string; icon: string; bossKind?: "p1" | "ultra" | "p2" }

// TunRect: rectángulo de túnel
export interface TunRect { x: number; y: number; w: number; h: number }

// ES: spawn de enemigo [fracX, fracY, hp, spd, cd, isBoss]
export type ES = [number, number, number, number, number, boolean]

// GpadType
export type GpadType = "xbox" | "ps" | "keyboard"
