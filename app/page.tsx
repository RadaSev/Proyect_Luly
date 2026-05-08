"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import RealMapDev from "./RealMapDev"

// ── Game modules ─────────────────────────────────────────────────────────────
import type { G, SprBank, GpadType } from "./game/types"
import {
  CW, CH, NW, NC, NR, TROW, STEP,
  PW, PH, RW, RH, GP,
  BG_IMGS, BG_PATHS,
  GAME_VERSION, WORLD_NAMES, THEMES,
  CP_RADIUS, SAVE_KEY,
  GPAD_BTN, XB_COL, PS_COL,
  asset, BASE_PATH,
} from "./game/constants"
import { ALL_CPS } from "./game/world_gen"
import { mkG_lazy, applyLoad, loadWorld, tickCamera, tickWorldAnim } from "./game/init"
import { loadSaveData, saveGame } from "./game/save"
import { tick } from "./game/tick"
import {
  draw, drawRealMapDev, devTeleport,
  tpOpenMenu, tpNavCP, tpNavWorld, tpDoConfirm, _tpClearMvKeys,
  getWorldAtX, _mapWorldExplored, devMapHitTest,
} from "./game/render"
import { fireTBall } from "./game/player_tball"
import { pollGamepad, detectGpadType } from "./game/input"
import { bolkhaDoInteract } from "./game/npc_bolkha"
import { isBossCPUnlocked, spawnBossCPReward } from "./game/checkpoints"
import { _rexTypingActive, _rexPageWaiting } from "./game/npc_rex"

// ══════════════════════════════════════════════════════════════
//  COMPONENTE REACT
// ══════════════════════════════════════════════════════════════
export default function ProyectoLuly() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const G = useRef<G>(mkG_lazy())
  const sprs = useRef<SprBank>({})
  // FIX: showDevMap en el estado UI para controlar el overlay de pausa
  const [ui, setUi] = useState({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false, showMap: false, devMode: false, tpMenuOpen: false, showRealMap: false })
  // Diferir la lectura de localStorage al cliente para evitar hydration mismatch
  const [hasSave, setHasSave] = useState(false)
  const [saveChecked, setSaveChecked] = useState(false)  // true tras primer check de localStorage
  // "start" = menú inicio  |  "playing" = partida activa
  const [screen, setScreen] = useState<"start" | "playing">("start")
  // Recheck localStorage whenever returning to start screen (catches newly-saved games)
  useEffect(() => { setHasSave(loadSaveData() !== null); setSaveChecked(true) }, [screen])
  const gameActiveRef = useRef(false)
  // ── UI adicional ────────────────────────────────────────────────
  const [menuSel, setMenuSel] = useState(0)          // ítem seleccionado en menú inicio
  const [pauseSel, setPauseSel] = useState(0)        // ítem seleccionado en menú pausa
  const [showSettings, setShowSettings] = useState(false)  // overlay de configuración
  const [deleteConfirm, setDeleteConfirm] = useState(false) // doble confirmación borrar partida
  // ── DEV-CELULAR: variante de D-PAD para pruebas en móvil ────────
  const [dpadMode, setDpadMode] = useState<"cross"|"joystick">("cross")
  useEffect(() => {
    try { const v = localStorage.getItem("luly_dev_dpad"); if (v === "joystick") setDpadMode("joystick") } catch(_) {}
  }, [])
  const [jstickThumb, setJstickThumb] = useState({ x: 0, y: 0 })
  const jstickBaseRef = useRef({ cx: 0, cy: 0 })  // centro del joystick en coords de pantalla
  // Detección de doble-flick lateral para correr (análogo al doble-tap de teclado)
  const joyTapRef    = useRef({ left: 0, right: 0, wasLeft: false, wasRight: false })
  // Debounce para navegación del menú TP con joystick (evita scroll muy rápido)
  const tpJoyNavRef  = useRef({ wasH: 0 as -1|0|1, wasV: 0 as -1|0|1, lastH: 0, lastV: 0 })
  const [gpadType, setGpadType] = useState<GpadType>("keyboard")  // tipo de mando detectado
  const menuSelRef = useRef(0)
  const pauseSelRef = useRef(0)

  useEffect(() => {
    const L = (k: string, s: string) => { const img = new Image(); img.src = asset(s); img.onload = () => { sprs.current[k] = img }; img.onerror = () => { sprs.current[k] = null } }
    // Sprites de Luly — cada dirección tiene su propio sprite (no mirror)
    L("player_idle",           "/assets/player/player_idle.png")
    L("player_idle_left",      "/assets/player/player_idle_left.png")
    L("player_walk",           "/assets/player/player_walk.png")
    L("player_walk_left",      "/assets/player/player_walk_left.png")
    L("player_run",            "/assets/player/player_run.png")
    L("player_run_left",       "/assets/player/player_run_left.png")
    L("player_jump",           "/assets/player/player_jump.png")
    L("player_jump_left",      "/assets/player/player_jump_left.png")
    L("player_attack",             "/assets/player/player_attack.png")
    L("player_slow_walk",          "/assets/player/player_slow_walk.png")
    L("player_slow_walk_left",     "/assets/player/player_slow_walk_left.png")
    L("player_fall",               "/assets/player/player_fall.png")
    L("player_fall_left",          "/assets/player/player_fall_left.png")
    L("player_atack_bone",         "/assets/player/player_atack_bone.png")
    L("player_atack_bone_left",    "/assets/player/player_atack_bone_left.png")
    L("player_atack_correa",       "/assets/player/luly_atack_correa.png")
    L("player_atack_correa_left",  "/assets/player/luly_atack_correa_left.png")
    // dash: cargados pero no usados hasta tener sprites 25fps
    L("player_dash_right", "/assets/player/player_dash_right.png")
    L("player_dash_left",  "/assets/player/player_dash_left.png")
    // Enemigos — sprites por Mundo (1-4) × Sección (f=First / s=Second)
    // Claves: e_w{W}_{sec}_{anim}_{dir}  ej: e_w1_f_idle_right
    // Sprites opcionales: si el archivo no existe, onerror → null (fallback graceful)
    for (const w of [1,2,3,4] as const) {
      for (const [si, secFolder] of (["First_Section","Second_Section"] as const).entries()) {
        const sk = si === 0 ? "f" : "s"
        const base = `/assets/enemy/World_${w}/${secFolder}/enemy_`
        const pk   = `e_w${w}_${sk}_`
        for (const dir of ["right","left"] as const) {
          L(`${pk}idle_${dir}`,   `${base}idle_${dir}.png`)
          L(`${pk}walk_${dir}`,   `${base}walk_${dir}.png`)
          L(`${pk}hurt_${dir}`,   `${base}hurt_${dir}.png`)
          L(`${pk}death_${dir}`,  `${base}death_${dir}.png`)
          L(`${pk}atack_${dir}`,  `${base}atack_${dir}.png`)
          L(`${pk}atack1_${dir}`, `${base}atack_1_${dir}.png`)
          L(`${pk}atack2_${dir}`, `${base}atack_2_${dir}.png`)
        }
        // Variantes sin dirección (ej: enemy_idle.png único)
        L(`${pk}idle`,   `${base}idle.png`)
        L(`${pk}atack`,  `${base}atack.png`)
        L(`${pk}atack1`, `${base}atack_1.png`)
        L(`${pk}atack2`, `${base}atack_2.png`)
      }
    }
    // ── Boss sprites — nuevo sistema por mundo/sección (5×5, 25 frames) ──
    const BOSS_SECTIONS: Array<{ key: string; folder: string }> = [
      { key: "fs", folder: "First_Section" },
      { key: "ss", folder: "Second_Section" },
      { key: "fb", folder: "Final_Boss" },
    ]
    // [sprite-key suffix, filename prefix]
    const BOSS_ANIMS: Array<[string, string]> = [
      ["walk",      "Walk"],
      ["death",     "Death"],
      ["atack1",    "Atack_1"],
      ["atack2",    "Atack_2"],
      ["rage_walk", "Rage_Walk"],
    ]
    const BOSS_DIRS: Array<"right" | "left"> = ["right", "left"]
    for (let wn = 1; wn <= 4; wn++) {
      for (const { key: bsec, folder: bfolder } of BOSS_SECTIONS) {
        for (const [animKey, animFile] of BOSS_ANIMS) {
          for (const bdir of BOSS_DIRS) {
            L(`boss_w${wn}_${bsec}_${animKey}_${bdir}`,
              `/assets/boos/World_${wn}/${bfolder}/${animFile}_${bdir}.png`)
          }
        }
      }
    }
    // Cajas de suministros
    L("box", "/assets/Enviroment/Boxes/box.png")
    // Kennels de entorno — uno por mundo
    L("kennel_ambar",  "/assets/Enviroment/Kennel/Kennel_ambar.png")   // W0 Las Perreras
    L("kennel_red",    "/assets/Enviroment/Kennel/Kennel_red.png")     // W1 Fábrica Canina
    L("kennel_blue",   "/assets/Enviroment/Kennel/Kennel_blue.png")    // W2 Los Tubos
    L("kennel_violet",    "/assets/Enviroment/Kennel/Kennel_Violet.png")  // W3 Ctrl. Central
    L("monticulo_herramientas", "/assets/Enviroment/monticulo_herramientas/monticulo_herramientas.png")
    // W1P2 Boss — sprites exclusivos (no comparten loop general de boss anims)
    L("boss_w1_ss_mareado_right", "/assets/boos/World_1/Second_Section/mareado_right.png")
    L("boss_w1_ss_mareado_left",  "/assets/boos/World_1/Second_Section/mareado_left.png")
    // Bolkha the Merchant sprites
    L("bolkha_idle_left",          "/assets/NPCs/Blokha_the_merchant/idle_left.png")
    L("bolkha_idle_right",         "/assets/NPCs/Blokha_the_merchant/idle_right.png")
    L("bolkha_talk_left",          "/assets/NPCs/Blokha_the_merchant/talk_left.png")
    L("bolkha_talk_right",         "/assets/NPCs/Blokha_the_merchant/talk_right.png")
    L("bolkha_giving_bones_left",  "/assets/NPCs/Blokha_the_merchant/Giving_Bones_left.png")
    L("bolkha_giving_bones_right", "/assets/NPCs/Blokha_the_merchant/Giving_Bones_right.png")
    L("bolkha_giving_hearts_left", "/assets/NPCs/Blokha_the_merchant/Giving_Hearts_left.png")
    L("bolkha_giving_hearts_right","/assets/NPCs/Blokha_the_merchant/Giving_Hearts_right.png")
    L("bolkha_giving_tball_left",  "/assets/NPCs/Blokha_the_merchant/Giving_Tennis_Ball_left.png")
    L("bolkha_giving_tball_right", "/assets/NPCs/Blokha_the_merchant/Giving_Tennis_Ball_right.png")
    L("cucha_teleport",   "/assets/Enviroment/Cucha_Teleport/cucha_teleport.png")
    // Rex el Viejo — sprites por estado
    L("floor_w1_base",          "/assets/Enviroment/World_1/Floor/F-1.png")
    L("platform_sprite",        "/assets/Enviroment/World_1/Platforms/P-2.png")
    L("wall_sprite",            "/assets/Enviroment/World_1/Walls/W-3.png")
    L("internal_wall_sprite",   "/assets/Enviroment/World_1/Walls/W-2.png")
    L("rex_house",              "/assets/Enviroment/Rex_House/Rex_House.png")
    L("cell_close",             "/assets/Enviroment/Cell/Cell_Close.png")
    L("cell_open",              "/assets/Enviroment/Cell/Cell_Open.png")
    L("rex_idle",               "/assets/NPCs/Rex_The_Old/idle.png")
    L("rex_saludo_left",        "/assets/NPCs/Rex_The_Old/saludo_left.png")
    L("rex_saludo_right",       "/assets/NPCs/Rex_The_Old/saludo_right.png")
    L("rex_talk_left",          "/assets/NPCs/Rex_The_Old/talk_left.png")
    L("rex_talk_right",         "/assets/NPCs/Rex_The_Old/talk_right.png")
    L("rex_mitad_llave_left",   "/assets/NPCs/Rex_The_Old/mitad_llave_left.png")
    L("rex_mitad_llave_right",  "/assets/NPCs/Rex_The_Old/mitad_llave_right.png")
    L("luly_map_icon",  "/assets/Enviroment/Icon_Face_Luly_Map/Icon_Face.png")
    L("tennis_ball",   "/assets/Enviroment/Tennis_Ball/Tennis_Ball.png")
    // Skulls para salas de jefes en el mapa
    L("skull_p1",    "/assets/Enviroment/Skull/Skull_First_Boss.png")
    L("skull_p2",    "/assets/Enviroment/Skull/Skull_Second_Boss.png")
    L("skull_ultra", "/assets/Enviroment/Skull/Skull_Final_Boss.png")
    // ── HUD interface sprites ──────────────────────────────────────────────────
    L("hud_heart",       "/assets/Enviroment/Interface/Heart/Heart.png")
    L("hud_bone",        "/assets/Enviroment/Interface/Bone/Bone.png")
    L("hud_enemy_live",  "/assets/Enviroment/Interface/Enemy/Enemy_Live.png")
    L("hud_enemy_dead",  "/assets/Enviroment/Interface/Enemy/Enemy_Death.png")
    L("hud_croqueta",    "/assets/Enviroment/Interface/Croqueta_ptos/Croqueta.png")
    L("drop_bone",       "/assets/Enviroment/Interface/Bone/Bone_X.png")
    // ── Real Map Dev — iconos UI alternativos ──────────────────────────────
    // ── Real Map Dev — iconos v1 (pixel art original) ─────────────────────────
    L("icon_luly_v1",   "/assets/Enviroment/Interface/Luly_icon/Luly_Icon.png")
    L("icon_rex_v1",    "/assets/Enviroment/Interface/World_1/Rex.png")
    L("icon_enemy_v1",  "/assets/Enviroment/Interface/World_1/First_Section/Enemy_icon.png")
    // ── Real Map Dev — iconos v2 minimalist alta resolución ───────────────────
    L("icon_luly_v2",   "/assets/Enviroment/Icon_Face_Luly_Map/Icon_Face.png")
    L("icon_rex_v2",    "/assets/Enviroment/Interface/Minimalist/World_1/Rex.png")
    L("icon_rex_house", "/assets/Enviroment/Interface/Minimalist/World_1/Rex_House.png")
    L("icon_enemy_v2",  "/assets/Enviroment/Interface/Minimalist/World_1/First_Section/Enemy.png")
    L("icon_box",       "/assets/Enviroment/Interface/Minimalist/Box.png")
    L("icon_kennel",    "/assets/Enviroment/Interface/Minimalist/Kennel.png")
    L("icon_cucha",     "/assets/Enviroment/Interface/Minimalist/Cucha_Teleport.png")
    BG_PATHS.forEach((path, wi) => { if (!path) return; const img = new Image(); img.src = path; img.onload = () => { BG_IMGS[wi] = img }; img.onerror = () => { BG_IMGS[wi] = null } })
  }, [])

  useEffect(() => {
    // 25fps = 40ms/frame para todos los sprites de Luly (spritesheet 5×5, 256×256/frame)
    const LULY_FPF = 40  // ms por frame
    const sp: Record<string, number> = {
      idle: LULY_FPF,  idle_left: LULY_FPF,
      walk: LULY_FPF,  walk_left: LULY_FPF,
      run:  LULY_FPF,  run_left:  LULY_FPF,
      jump: LULY_FPF,  jump_left: LULY_FPF,
      fall: LULY_FPF,  fall_left: LULY_FPF,
      attack: LULY_FPF,
      slow_walk: LULY_FPF, slow_walk_left: LULY_FPF,
      atack_bone: LULY_FPF, atack_bone_left: LULY_FPF,
      atack_correa: LULY_FPF, atack_correa_left: LULY_FPF,
      // dash: desactivado hasta tener sprites 25fps
    }
    let raf: number, el = 0, last = performance.now()
    // 5×5 spritesheet = 25 frames totales
    // jump: cicla hasta frame 24 y lo congela mientras el jugador está en el aire
    const fn = (now: number) => {
      el += now - last; last = now
      const g = G.current, p = g.pl
      const s = sp[p.pa] ?? LULY_FPF
      if (el > s) {
        el = 0
        const isJump = p.pa === "jump" || p.pa === "jump_left"
        if (isJump && !p.onGround && p.pf >= 24) {
          // Congela en el último frame mientras está en el aire
        } else {
          p.pf = (p.pf + 1) % 25
        }
      }
      raf = requestAnimationFrame(fn)
    }
    raf = requestAnimationFrame(fn); return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext("2d")!
    // ── DPR-aware canvas ────────────────────────────────────────────────────
    // Multiplicar las dimensiones reales del canvas por devicePixelRatio hace
    // que el texto y los gráficos se rendericen a resolución Retina/HiDPI.
    // El CSS sigue mostrándolo al tamaño correcto (min(100%, calc(1.75*100vh))).
    // Capamos en 2× para no ahogar dispositivos móviles con dpr=3.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = Math.round(CW * dpr)
    canvas.height = Math.round(CH * dpr)
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
      } else {
        accum = 0
        // Fade-to-black progresivo al morir
        if (g.over) g.overFade = Math.min(1, g.overFade + dt * 1.4)
      }
      if (gameActiveRef.current) {
        // Aplica DPR como transform base antes de cada frame.
        // ctx.save()/restore() internos del draw se apilan sobre este transform.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        draw(g, ctx, sprs.current, devHoverRef.current)
      }
      ut += dt; if (ut > .25) {
        ut = 0
        // if (g.autoGfx) {
        //   if (g.lfps < 28 && g.gfx > 1) g.gfx = (g.gfx - 1) as 0 | 1 | 2  // mínimo = 1
        //   else if (g.lfps > 58 && g.gfx < 2) g.gfx = (g.gfx + 1) as 0 | 1 | 2
        // }
        // // Garantía absoluta: gfx=0 nunca debería ocurrir via autoGfx
        // if (g.gfx < 1) g.gfx = 1
        // FIX: incluir showDevMap en el estado UI para controlar el overlay de pausa
        setUi({ paused: g.paused, over: g.over, won: g.won, fps: Math.round(g.lfps), score: g.score, showDevMap: g.showDevMap, showMap: g.showMap, devMode: g.devMode, tpMenuOpen: !!g.tpMenu?.open, showRealMap: g.showRealMap })
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

      // ── RealMap DEV abierto: navegación de mundo con ←→, cerrar con N/Esc ─
      if (g.showRealMap && g.devMode) {
        const SCALE_STEPS = [1.0, 1.5, 2.0, 3.0]
        if (k === "arrowleft"  || k === "a") { g.realMapWorld = (g.realMapWorld - 1 + NW) % NW; return }
        if (k === "arrowright" || k === "d") { g.realMapWorld = (g.realMapWorld + 1) % NW; return }
        if (k === "w" || k === "arrowup")    { g.realMapSection = 0; return }  // sección superior
        if (k === "s" || k === "arrowdown")  { g.realMapSection = 1; return }  // sección inferior
        if (k === "z") {
          const idx = SCALE_STEPS.indexOf(g.realMapScale)
          g.realMapScale = SCALE_STEPS[(idx + 1) % SCALE_STEPS.length]
          return
        }
        if (k === "v") { g.realMapIconMode = (g.realMapIconMode + 1) % 3; return }
        if (k === "y" || k === "escape")     { g.showRealMap = false; return }
        return  // bloquear resto de teclas mientras el mapa real está abierto
      }

      // ── Animación de entrega de Bolkha: bloquear todo movimiento ───────────
      if (g.bolkhaState === "giving") return

      // ── TP menu abierto: interceptar ANTES de g.keys para que no muevan al player ──
      if (g.bolkhaShopOpen) {
        if (k === "arrowup"   || k === "w") { g.bolkhaShopCursor = Math.max(0, g.bolkhaShopCursor - 1); return }
        if (k === "arrowdown" || k === "s") { g.bolkhaShopCursor = Math.min(2, g.bolkhaShopCursor + 1); return }
        // X cierra la tienda (no ESC — ESC sale del fullscreen del navegador)
        if (k === "x") { g.bolkhaShopOpen = false; g.bolkhaState = "idle"; return }
        // Solo permitir e (comprar); bloquear movimiento/salto/todo lo demás
        if (k !== "e") return
      }
      if (g.tpMenu?.open) {
        if (k === "arrowup"    || k === "w") { tpNavCP(g, -1);    return }
        if (k === "arrowdown"  || k === "s") { tpNavCP(g, 1);     return }
        if (k === "arrowleft"  || k === "a") { tpNavWorld(g, -1); return }
        if (k === "arrowright" || k === "d") { tpNavWorld(g, 1);  return }
        if (k === "enter" || k === " ")      { tpDoConfirm(g);    return }
        if (k === "escape" || k === "t")     { g.tpMenu = null; g.paused = false; _tpClearMvKeys(g); return }
        return  // bloquear cualquier otra tecla mientras el menú está abierto
      }

      if (e.repeat) return   // teclas repetidas no re-activan (preserva "just pressed" para diálogos)
      G.current.keys[k] = true
      const TAP_WIN = 280
      if (k === "a" || k === "arrowleft") { if (performance.now() - g.pl.tapLeft < TAP_WIN && g.pl.tapLeft > 0) g.pl.runMode = true; g.pl.tapLeft = performance.now() }
      if (k === "d" || k === "arrowright") { if (performance.now() - g.pl.tapRight < TAP_WIN && g.pl.tapRight > 0) g.pl.runMode = true; g.pl.tapRight = performance.now() }
      if (k === "p") g.paused = !g.paused; if (k === "j") g.info = !g.info
      if (k === "q") {
        g.gfx = ((g.gfx + 1) % 3) as 0 | 1 | 2
          ; (g as any)._gfxMsg = true
        g.kennelMsg = 1.8
      }
      if (k === "v" && !g.devMode) fireTBall(g)
      if (k === "r") G.current = mkG_lazy()
      if (k === "`") { g.devMode = !g.devMode; if (!g.devMode) { g.showDevMap = false; g.showRealMap = false; g.godMode = false; g.infiniteAmmo = false; g.noEnemies = false; g.ohko = false } }
      if (g.devMode && k === "i") g.godMode = !g.godMode
      if (g.devMode && k === "o") g.infiniteAmmo = !g.infiniteAmmo
      if (g.devMode && k === "k") g.noEnemies = !g.noEnemies
      if (g.devMode && k === "u") g.ohko = !g.ohko
      if (g.devMode && k === "l") {
        // Matar todos los enemigos no-boss de la sección actual (para testear jefes rápido)
        const pRow = Math.floor(g.pl.y / RH)
        const pSec = pRow < TROW ? "f" : "s"
        const pWld = Math.floor(g.pl.x / (NC * RW))
        for (const en of g.enemies) {
          if (!en.active || en.boss || en.dying || en.world !== pWld) continue
          const eRow = Math.floor(en.y / RH)
          const eSec = eRow < TROW ? "f" : "s"
          if (eSec !== pSec) continue
          en.active = false
          const parts = en.originalId.split("_")
          if (parts.length >= 4) g.dead.add(parts.slice(0, 4).join("_"))
          g.dead.add(en.originalId); g.dead.add(en.id)
        }
      }
      if (g.devMode && k === "j") g.staDisplay = g.staDisplay === "circle" ? "bar" : "circle"
      if (g.devMode && k === "p") g.mobileZoom = g.mobileZoom === "far" ? "close" : "far"
      if (g.devMode && k === "g") {
        const cycle: G["gpadType"][] = ["keyboard", "xbox", "ps"]
        g.gpadType = cycle[(cycle.indexOf(g.gpadType) + 1) % cycle.length]
      }
      if (g.devMode && k === "v") g.isMobile = !g.isMobile
      if (g.devMode && k === "y" && !g.isMobile) {
        // Abrir/cerrar mapa realista miniaturizado
        g.showRealMap = !g.showRealMap
        if (g.showRealMap) {
          // Al abrir, mostrar el mundo donde está el jugador
          g.realMapWorld = Math.max(0, Math.min(NW - 1, Math.floor(g.pl.x / (NC * RW))))
          // Auto-seleccionar la sección donde está Luly
          const _plRow = Math.max(0, Math.min(NR - 1, Math.floor(g.pl.y / RH)))
          g.realMapSection = _plRow <= TROW ? 0 : 1
        }
      }
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
      if (k === "tab") {
        g.showMap = !g.showMap; g.paused = g.showMap
        if (g.showMap) { g.mapViewWorld = Math.max(0, Math.min(NW - 1, Math.floor(g.pl.x / (NC * RW)))); g.mapView = "single" }
      }
      if (k === "f") handleToggleFS()
      if (k === "escape") {
        if (g.tpMenu?.open) { g.tpMenu = null; g.paused = false; _tpClearMvKeys(g); return }
        if (g.showMap) { g.showMap = false; g.paused = false }
        if (g.showDevMap) { g.showDevMap = false; g.paused = false }
      }
      if (k === "e" && !g.tpAnim) {
        // Bolkha shop: abrir o comprar
        if (g.bolkhaState === "talking" || g.bolkhaShopOpen) {
          bolkhaDoInteract(g)
          return
        }
        ; (g as any)._gfxMsg = false
        const p = g.pl
        for (const cp of ALL_CPS) {
          const bdx = p.x + p.w / 2 - (cp.x + PW / 2), bdy = p.y + p.h / 2 - (cp.y + PH)
          if (Math.sqrt(bdx * bdx + bdy * bdy) < CP_RADIUS) {
            // Boss CP bloqueado: no activar si el jefe sigue vivo
            if (cp.bossKind && !isBossCPUnlocked(g, cp)) break
            g.discoveredCPs.add(cp.id)
            // Recompensa por primera activación de CP de boss
            if (cp.bossKind && !g.bossRewardedCPs.has(cp.id)) {
              g.bossRewardedCPs.add(cp.id); spawnBossCPReward(g, cp)
            }
            const changed = g.checkpoint.w !== cp.w || Math.abs(g.checkpoint.x - cp.x) > 40
            if (changed) { g.checkpoint = { w: cp.w, x: cp.x, y: cp.y }; g.kennelMsg = 3; saveGame(g) }
            break
          }
        }
      }
      if (k === "t" && !g.tpAnim) {
        tpOpenMenu(g)
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
    const getTouchXY = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = CW / rect.width
      const scaleY = CH / rect.height
      const t = e.changedTouches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    // Lógica compartida de click en el mapa
    const handleMapClick = (g: G, x: number, y: number) => {
      const curW = Math.max(0, Math.min(Math.floor(g.pl.x / (NC * RW)), NW - 1))
      if (g.mapView === "single") {
        // Botón "VER TODOS"
        const btnW = 142, btnH = 26, btnX = CW - btnW - 6, btnY = 6
        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
          g.mapView = "all"
        }
      } else {
        // Botón "◀ MAPA ACTUAL"
        const rW2 = 34, rH2 = 22, gap2 = 2
        const wGridW2 = NC * (rW2 + gap2) - gap2, wGridH2 = NR * (rH2 + gap2) - gap2
        const wPadX2 = 10, wPadY2 = 8
        const panW2 = wGridW2 + wPadX2 * 2, panH2 = 18 + wGridH2 + 14 + wPadY2 * 2
        const panGap2 = 14, totalW2 = 2 * panW2 + panGap2
        const mLeft2 = Math.floor((CW - totalW2) / 2), mTop2 = 42
        const backW2 = 130, backH2 = 26, backX2 = mLeft2, backY2 = 6
        if (x >= backX2 && x <= backX2 + backW2 && y >= backY2 && y <= backY2 + backH2) {
          g.mapView = "single"; return
        }
        // Click en panel de mundo → ver detalle
        for (let w = 0; w < NW; w++) {
          const mc = w % 2, mr = Math.floor(w / 2)
          const bx = mLeft2 + mc * (panW2 + panGap2), by = mTop2 + mr * (panH2 + panGap2)
          if (x >= bx && x <= bx + panW2 && y >= by && y <= by + panH2) {
            if (_mapWorldExplored(w, g) || w === curW) { g.mapView = "single"; g.mapViewWorld = w }
            break
          }
        }
      }
    }
    const onMove = (e: MouseEvent) => {
      const g = G.current
      if (!g.showDevMap) { devHoverRef.current = null; return }
      const { x, y } = getCanvasXY(e)
      devHoverRef.current = devMapHitTest(x, y, g.devMapWorld)
    }
    const onClick = (e: MouseEvent) => {
      const g = G.current
      if (g.showMap && !g.showDevMap) { const { x, y } = getCanvasXY(e); handleMapClick(g, x, y); return }
      if (!g.showDevMap) return
      const { x, y } = getCanvasXY(e)
      const hit = devMapHitTest(x, y, g.devMapWorld)
      if (!hit) return
      if (hit.c === -1) { g.devMapWorld = hit.w; return }
      devTeleport(g, hit.w, hit.c, hit.r)
    }
    const onTouchEnd = (e: TouchEvent) => {
      const g = G.current
      if (g.showMap && !g.showDevMap) { const { x, y } = getTouchXY(e); handleMapClick(g, x, y) }
    }
    canvas.addEventListener("mousemove", onMove)
    canvas.addEventListener("click", onClick)
    canvas.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      canvas.removeEventListener("mousemove", onMove)
      canvas.removeEventListener("click", onClick)
      canvas.removeEventListener("touchend", onTouchEnd)
    }
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
  const pauseSwipeY = useRef(0)   // Y inicial del toque en el indicador de swipe (pausa)

  // ── Función de dibujo del RealMapDev (estable: lee G.current/sprs.current en cada frame) ──
  const realMapDrawFn = useCallback((ctx: CanvasRenderingContext2D) => {
    drawRealMapDev(ctx, G.current, sprs.current)
  }, [])

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
    const onChange = () => {
      const inFS = !!getFSElement()
      setIsFullscreen(inFS)
      // Trampa de fullscreen: si el juego está activo y el usuario salió con ESC,
      // volvemos a entrar automáticamente después de un breve instante.
      if (!inFS && gameActiveRef.current) {
        setTimeout(() => {
          if (!getFSElement() && gameActiveRef.current)
            tryFullscreen(containerRef.current || document.documentElement)
        }, 150)
      }
    }
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
    // touch=true en MacBooks con trackpad (maxTouchPoints=5) — no es "móvil"
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouchDevice(touch)
    // Zoom close solo en pantallas verdaderamente pequeñas (<900px)
    // NO activar solo por maxTouchPoints>0 — los MacBooks con trackpad tienen eso
    if (window.innerWidth < 900) G.current.mobileZoom = "close"
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

  // Sincronizar isTouchDevice → G.current.isMobile para que las funciones de canvas lo lean
  useEffect(() => { G.current.isMobile = isTouchDevice }, [isTouchDevice])

  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      G.current.gpadIdx = e.gamepad.index
      const t = detectGpadType(e.gamepad.id)
      G.current.gpadType = t
      setGpadConnected(true); setGpadType(t)
    }
    const onDisconnect = (e: GamepadEvent) => {
      if (G.current.gpadIdx === e.gamepad.index) {
        G.current.gpadIdx = -1; G.current.gpadType = "keyboard"
        setGpadConnected(false); setGpadType("keyboard")
      }
    }
    window.addEventListener("gamepadconnected", onConnect); window.addEventListener("gamepaddisconnected", onDisconnect)
    const existing = navigator.getGamepads?.()
    if (existing) for (let i = 0; i < existing.length; i++) {
      if (existing[i]) {
        G.current.gpadIdx = i
        const t = detectGpadType(existing[i]!.id)
        G.current.gpadType = t
        setGpadConnected(true); setGpadType(t); break
      }
    }
    return () => { window.removeEventListener("gamepadconnected", onConnect); window.removeEventListener("gamepaddisconnected", onDisconnect) }
  }, [])

  // ── Navegación de menús con joystick ─────────────────────────────────────
  useEffect(() => {
    const _prev: Record<number, boolean> = {}
    let navCd = 0, raf = 0
    const edgeDown = (pad: Gamepad, i: number) => {
      const now = pad.buttons[i]?.pressed ?? false
      const prev = _prev[i] ?? false; _prev[i] = now; return now && !prev
    }
    const poll = () => {
      raf = requestAnimationFrame(poll)
      const pads = navigator.getGamepads?.()
      let pad: Gamepad | null = null
      if (pads) for (let i = 0; i < pads.length; i++) { if (pads[i]) { pad = pads[i]; break } }
      if (!pad) { for (const k of Object.keys(_prev)) delete _prev[+k]; return }
      const ax = (i: number) => pad!.axes[i] ?? 0
      const btn = (i: number) => pad!.buttons[i]?.pressed ?? false
      navCd = Math.max(0, navCd - 16)
      const THRESH = 0.55, ly = ax(1)

      // ── Menú de inicio ────────────────────────────────────────────
      if (screen === "start" && !showSettings) {
        // Calcular número de ítems del menú de inicio
        const items: string[] = []
        if (hasSave) items.push("continuar")
        items.push("jugar")
        items.push("configuracion")
        if (typeof window !== "undefined" && !("ontouchstart" in window)) items.push("fullscreen")
        items.push("salir")
        const count = items.length
        if (navCd <= 0) {
          if (ly < -THRESH || btn(GP.UP)) {
            menuSelRef.current = (menuSelRef.current - 1 + count) % count
            setMenuSel(menuSelRef.current); navCd = 180
          } else if (ly > THRESH || btn(GP.DOWN)) {
            menuSelRef.current = (menuSelRef.current + 1) % count
            setMenuSel(menuSelRef.current); navCd = 180
          }
        }
        // A = confirmar (simula click en ítem seleccionado)
        if (edgeDown(pad, GP.A)) {
          const sel = items[menuSelRef.current]
          if (sel === "continuar") {
            const sv2 = loadSaveData()
            if (sv2) { applyLoad(G.current, sv2) }
            gameActiveRef.current = true; setScreen("playing")
            try { document.documentElement.requestFullscreen?.() } catch (_) {}
          } else if (sel === "jugar") {
            gameActiveRef.current = true; setScreen("playing")
            try { document.documentElement.requestFullscreen?.() } catch (_) {}
          } else if (sel === "configuracion") {
            setShowSettings(true)
          } else if (sel === "fullscreen") {
            try { document.documentElement.requestFullscreen?.() } catch (_) {}
          } else if (sel === "salir") {
            try { window.close() } catch (_) {}
          }
        }
        return
      }

      // ── Overlay de configuración ──────────────────────────────────
      if (showSettings) {
        if (edgeDown(pad, GP.B) || edgeDown(pad, GP.START)) setShowSettings(false)
        return
      }

      // ── Menú de pausa ─────────────────────────────────────────────
      if (screen === "playing" && ui.paused && !ui.tpMenuOpen && !ui.showDevMap && !ui.showMap) {
        const COUNT = 2  // CONTINUAR | MENÚ PRINCIPAL
        if (navCd <= 0) {
          if (ly < -THRESH || btn(GP.UP)) {
            pauseSelRef.current = (pauseSelRef.current - 1 + COUNT) % COUNT
            setPauseSel(pauseSelRef.current); navCd = 180
          } else if (ly > THRESH || btn(GP.DOWN)) {
            pauseSelRef.current = (pauseSelRef.current + 1) % COUNT
            setPauseSel(pauseSelRef.current); navCd = 180
          }
        }
        if (edgeDown(pad, GP.A)) {
          const sel = pauseSelRef.current
          if (sel === 0) { G.current.paused = false; setUi(u => ({ ...u, paused: false })) }
          else if (sel === 1) { G.current = mkG_lazy(); setUi({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false, showMap: false, devMode: false, tpMenuOpen: false, showRealMap: false }); setScreen("start"); gameActiveRef.current = false }
        }
        if (edgeDown(pad, GP.B)) { G.current.paused = false; setUi(u => ({ ...u, paused: false })) }
      }
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ui.paused, ui.showDevMap, ui.showMap, hasSave, showSettings])

  const reset = () => { G.current = mkG_lazy(); setUi({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false, showMap: false, devMode: false, tpMenuOpen: false, showRealMap: false }) }

  const handlePlay = () => {
    gameActiveRef.current = true
    setScreen("playing")
    // Forzar fullscreen siempre al iniciar
    tryFullscreen(containerRef.current || document.documentElement)
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
    setUi({ paused: false, over: false, won: false, fps: 60, score: 0, showDevMap: false, showMap: false, devMode: false, tpMenuOpen: false, showRealMap: false })
    setScreen("playing")
    gameActiveRef.current = true
    if (!getFSElement() && !isPseudoFS) tryFullscreen(containerRef.current || document.documentElement)
  }

  // Componente de retrato animado de Luly — usa rAF con timestamp exacto (LULY_FPF=40ms/frame = 25fps)
  const PausePortrait = ({ thAccent, thBg0 }: { thAccent: string; thBg0: string }) => {
    const portraitRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef(0)
    const frameRef = useRef(0)
    const lastRef = useRef(0)
    useEffect(() => {
      const FRAME_MS = 40  // igual que LULY_FPF en el juego (25fps)
      const fn = (now: number) => {
        if (now - lastRef.current >= FRAME_MS) {
          lastRef.current = now
          frameRef.current = (frameRef.current + 1) % 25  // 5×5 = 25 frames
          const canvas = portraitRef.current; if (!canvas) return
          const ctx2d = canvas.getContext("2d"); if (!ctx2d) return
          ctx2d.clearRect(0, 0, 96, 144)
          const spr = sprs.current["player_idle"]
          const f = frameRef.current
          if (spr && spr.complete && spr.naturalWidth > 0) {
            const fw = spr.width / 5, fh = spr.height / 5  // 5×5 spritesheet
            ctx2d.drawImage(spr, (f % 5) * fw, Math.floor(f / 5) * fh, fw, fh, 0, 0, 96, 144)
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

  // ── Canvas CSS: object-fit:contain via CSS min() ────────────────────────────
  // El canvas HTML interno es siempre CW×CH (1050×600) — esa es la resolución
  // lógica del juego. El CSS lo escala al mayor tamaño que cabe en la ventana
  // SIN deformar la relación 1050:600 (1.75:1).
  //
  // Técnica de escalado:
  //   Desktop  → mantiene aspect ratio: min(100vw, 1.75 × 100vh) — letterbox si es necesario
  //   Móvil    → llena TODO el viewport sin barras negras, estirando levemente si hace falta
  //              Se usa position:absolute+inset:0 para que el canvas ocupe exactamente la pantalla.
  const canvasStyle: React.CSSProperties = isTouchDevice ? {
    display: "block",
    imageRendering: "auto",
    position: "absolute",
    top: 0, left: 0,
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: 0,
  } : {
    display: "block",
    imageRendering: "auto",
    width:  `min(100%, calc(${CW / CH} * 100vh))`,
    height: "auto",
    border: "none",
    borderRadius: 0,
  }
  const mobileClose = G.current.mobileZoom === "close"

  // Estilo común de botón para la pantalla de inicio
  const menuBtn = (accent: string): CSSProperties => ({
    fontFamily: "monospace", fontWeight: "bold", fontSize: 15,
    padding: "12px 48px", border: `2px solid ${accent}`,
    color: accent, background: "rgba(0,0,0,0.55)",
    cursor: "pointer", letterSpacing: "0.12em",
    transition: "background 0.2s, box-shadow 0.2s",
    borderRadius: 3, outline: "none",
  })

  // ── Componente de ícono de botón (teclado / Xbox / PlayStation) ──────────
  const BtnIcon = ({ action, size = 18, style }: { action: string; size?: number; style?: CSSProperties }) => {
    const label = GPAD_BTN[action]?.[gpadType] ?? action
    const fs = Math.round(size * 0.52)
    const base: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, verticalAlign: "middle", flexShrink: 0, ...style }
    if (gpadType === "keyboard") {
      return <span style={{ ...base, minWidth: size + 4, height: size, padding: "0 4px", background: "#1A1A1A", border: "1px solid #666", borderBottom: "3px solid #333", borderRadius: 4, fontSize: fs, color: "#DDD", fontFamily: "'Courier New',monospace", fontWeight: "bold", whiteSpace: "nowrap" }}>{label}</span>
    }
    if (gpadType === "xbox") {
      const isRound = ["A", "B", "X", "Y"].includes(label)
      const col = XB_COL[label] ?? "#555"
      if (isRound) return <span style={{ ...base, width: size, height: size, borderRadius: "50%", background: col, fontSize: fs, color: "#FFF", fontWeight: "900" }}>{label}</span>
      return <span style={{ ...base, minWidth: size + 8, height: size - 2, padding: "0 4px", background: "#252530", border: "1px solid #666", borderRadius: 4, fontSize: fs - 1, color: "#CCC", fontFamily: "'Courier New',monospace", fontWeight: "bold", whiteSpace: "nowrap" }}>{label}</span>
    }
    // PlayStation
    const isSymbol = ["✕", "○", "□", "△"].includes(label)
    const col = PS_COL[label] ?? "#8888CC"
    if (isSymbol) return <span style={{ ...base, width: size, height: size, borderRadius: "50%", background: "#12122A", border: `2px solid ${col}`, fontSize: fs, color: col, fontWeight: "900" }}>{label}</span>
    return <span style={{ ...base, minWidth: size + 8, height: size - 2, padding: "0 4px", background: "#12122A", border: "1px solid #5555AA", borderRadius: 4, fontSize: fs - 1, color: "#AAB", fontFamily: "'Courier New',monospace", fontWeight: "bold", whiteSpace: "nowrap" }}>{label}</span>
  }

  /** Pequeña etiqueta de acción: [icono] texto */
  const CtrlHint = ({ action, label, size = 14 }: { action: string; label: string; size?: number }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6A8A6A", letterSpacing: "0.1em" }}>
      <BtnIcon action={action} size={size} />
      <span>{label}</span>
    </span>
  )

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
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      // Pointer capture: garantiza que pointerUp/Cancel lleguen aunque el dedo se mueva fuera
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
      downFn()
    },
    onPointerUp:     (e: React.PointerEvent) => { e.preventDefault(); upFn() },
    onPointerCancel: (_e: React.PointerEvent) => { upFn() },
    // onPointerLeave como último recurso en entornos sin capture
    onPointerLeave:  () => { upFn() },
  })

  const VirtualGamepad = () => {
    if (!isTouchDevice || screen !== "playing" || isPortrait) return null
    const g = G.current

    // ── Activar checkpoint táctil ────────────────────────────────────────
    const activateCheckpoint = () => {
      if (g.tpAnim) return
      ;(g as any)._gfxMsg = false
      const p = g.pl
      for (const cp of ALL_CPS) {
        const bdx = p.x + p.w / 2 - (cp.x + PW / 2), bdy = p.y + p.h / 2 - (cp.y + PH)
        if (Math.sqrt(bdx * bdx + bdy * bdy) < CP_RADIUS) {
          if (cp.bossKind && !isBossCPUnlocked(g, cp)) break
          g.discoveredCPs.add(cp.id)
          if (cp.bossKind && !g.bossRewardedCPs.has(cp.id)) {
            g.bossRewardedCPs.add(cp.id); spawnBossCPReward(g, cp)
          }
          const changed = g.checkpoint.w !== cp.w || Math.abs(g.checkpoint.x - cp.x) > 40
          if (changed) { g.checkpoint = { w: cp.w, x: cp.x, y: cp.y }; g.kennelMsg = 3; saveGame(g) }
          break
        }
      }
    }

    // ── Doble-tap D-pad → correr ─────────────────────────────────────────
    const dpadDown = (dir: "left" | "right", key: string) => {
      const now = Date.now()
      if (now - dpadTapRef.current[dir] < 300) G.current.pl.runMode = true
      dpadTapRef.current[dir] = now
      pressKey(key)
    }

    // ── Estilos base ─────────────────────────────────────────────────────
    const SYS_BTN: CSSProperties = {
      position: "absolute", display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(20,20,20,0.82)", border: "1.5px solid rgba(255,255,255,0.18)",
      color: "rgba(255,255,255,0.60)", fontFamily: "'Courier New',monospace", fontWeight: "bold",
      cursor: "pointer", userSelect: "none", touchAction: "none", borderRadius: 8, zIndex: 20,
    }
    // Botón circular estilo Xbox (con degradado radial + brillo superior)
    const xbCircle = (
      size: number, color: string, letter: string,
      label: string | null,
      onDown: () => void, onUp: () => void
    ) => {
      const fs = Math.round(size * 0.44)
      return (
        <div
          style={{
            width: size, height: size + (label ? 18 : 0),
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
            cursor: "pointer", userSelect: "none", touchAction: "none",
          }}
          {...makeTouch(onDown, onUp)}
        >
          <div style={{
            width: size, height: size, borderRadius: "50%", flexShrink: 0,
            background: `radial-gradient(circle at 38% 32%, ${color}EE 0%, ${color}88 55%, ${color}44 100%)`,
            border: `2px solid ${color}`,
            boxShadow: `0 3px 10px ${color}55, inset 0 1px 0 rgba(255,255,255,0.30)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFF", fontSize: fs, fontWeight: "900", fontFamily: "'Courier New',monospace",
          }}>
            {letter}
          </div>
          {label && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginTop: 2, lineHeight: 1 }}>{label}</span>}
        </div>
      )
    }

    // Botón de hombro/bumper estilo Xbox
    const xbBumper = (w: number, h: number, label: string, onDown: () => void, onUp: () => void, topRadius = true): JSX.Element => (
      <div
        style={{
          width: w, height: h,
          background: "linear-gradient(180deg, #3A3A3A 0%, #252525 100%)",
          border: "1.5px solid #555",
          borderRadius: topRadius ? "10px 10px 4px 4px" : "4px 4px 10px 10px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "'Courier New',monospace", fontWeight: "bold",
          cursor: "pointer", userSelect: "none", touchAction: "none",
        }}
        {...makeTouch(onDown, onUp)}
      >
        {label}
      </div>
    )

    // Brazo del D-cross (zona táctil + flecha SVG)
    const dArrow = (
      dir: "up" | "down" | "left" | "right",
      style: CSSProperties,
      onD: () => void, onU: () => void
    ) => {
      const arrows: Record<string, JSX.Element> = {
        up:    <svg width="18" height="14" viewBox="0 0 18 14"><path d="M9 2 L16 12 L2 12 Z" fill="rgba(255,255,255,0.65)"/></svg>,
        down:  <svg width="18" height="14" viewBox="0 0 18 14"><path d="M9 12 L16 2 L2 2 Z" fill="rgba(255,255,255,0.65)"/></svg>,
        left:  <svg width="14" height="18" viewBox="0 0 14 18"><path d="M2 9 L12 2 L12 16 Z" fill="rgba(255,255,255,0.65)"/></svg>,
        right: <svg width="14" height="18" viewBox="0 0 14 18"><path d="M12 9 L2 2 L2 16 Z" fill="rgba(255,255,255,0.65)"/></svg>,
      }
      return (
        <div
          style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center",
                   cursor: "pointer", userSelect: "none", touchAction: "none", ...style }}
          {...makeTouch(onD, onU)}
        >
          {arrows[dir]}
        </div>
      )
    }

    // ── Tamaños adaptativos según la altura real del viewport ────────────
    const vh = winDims.h                         // altura real de la ventana en px
    // D-cross: ARM escala con la pantalla (mín 48, máx 68), HUB un poco más ancho que el brazo
    const ARM   = Math.round(Math.max(48, Math.min(68, vh * 0.145)))
    const HUB   = Math.round(Math.max(50, Math.min(72, vh * 0.155)))
    const TOTAL = ARM + HUB + ARM                // ~146-208 px según pantalla
    const SAFE_B = Math.round(vh * 0.03)         // margen inferior ~3%
    // Shoulder buttons solo visibles cuando la habilidad está desbloqueada
    const hasDash  = g.abilities.has("dash")
    const hasTBall = g.abilities.has("tball")
    // Altura del grupo de hombros — solo dash ocupa shoulder bar; tball va arriba del diamante
    const SHOULDER_H = hasDash ? Math.round(vh * 0.10) : 0
    // Altura del bloque de botones de acción (diamante A/B/X/Y)
    const ACT_H = Math.round(vh * 0.44)   // 44% de la ventana
    // Posición inferior del diamante: por encima de los shoulders + margen
    const ACT_B  = SAFE_B + SHOULDER_H
    // Posición inferior del D-cross: igual que el diamante
    const DPAD_B = SAFE_B + SHOULDER_H

    // ── ¿Jugadora cerca de algún checkpoint descubierto? ─────────────────
    const nearAnyCP = ALL_CPS.some(cp => {
      if (!g.discoveredCPs.has(cp.id)) return false
      const dx = g.pl.x + g.pl.w / 2 - (cp.x + PW / 2)
      const dy = g.pl.y + g.pl.h / 2 - (cp.y + PH)
      return Math.sqrt(dx * dx + dy * dy) < CP_RADIUS
    })

    // ── Confirmar / navegar en menú de teletransporte (mobile) ──────────
    const confirmTP    = () => tpDoConfirm(g)
    const navTP        = (dir: 1 | -1) => tpNavCP(g, dir)
    const navTPWorld   = (dir: 1 | -1) => tpNavWorld(g, dir)

    // ══════════════════════════════════════════════════════════════════════
    //  MODO MAPA — solo botón B en inferior derecho para cerrar
    // ══════════════════════════════════════════════════════════════════════
    if (ui.showMap) {
      const btnSz = Math.round(ACT_H * 0.34)
      return (
        <div style={{
          position: "absolute", bottom: SAFE_B + 14, right: "4%",
          zIndex: 100,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", letterSpacing: "0.12em", fontFamily: "'Courier New',monospace" }}>CERRAR</span>
          <div style={{ pointerEvents: "auto", opacity: 0.72 }}>
            {xbCircle(btnSz, XB_COL.B, "B", null,
              () => { g.showMap = false; g.paused = false }, () => {})}
          </div>
        </div>
      )
    }

    // ══════════════════════════════════════════════════════════════════════
    //  MODO PAUSA — swipe ↑↓ para navegar + B para salir (sin D-pad ni A)
    // ══════════════════════════════════════════════════════════════════════
    if (ui.paused && !ui.tpMenuOpen && !ui.showDevMap) {
      const PAUSE_COUNT = 3
      const navPause = (dir: 1 | -1) => {
        const next = (pauseSelRef.current + dir + PAUSE_COUNT) % PAUSE_COUNT
        pauseSelRef.current = next; setPauseSel(next)
      }
      const swipeSz = Math.round(vh * 0.22)    // tamaño del indicador
      const BTN_SZ  = Math.round(ACT_H * 0.38)
      return (
        <>
          {/* Indicador táctil de deslizar — encima del botón B */}
          <div
            style={{
              position: "absolute",
              bottom: ACT_B + Math.round(ACT_H * 0.12) + BTN_SZ + 14,
              right: `calc(5% + ${Math.round((BTN_SZ - swipeSz) / 2)}px)`,
              width: swipeSz,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              zIndex: 100, opacity: 0.65,
              touchAction: "none", userSelect: "none",
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId)
              pauseSwipeY.current = e.clientY
            }}
            onPointerMove={(e) => {
              if (!pauseSwipeY.current) return
              const dy = pauseSwipeY.current - e.clientY
              if (Math.abs(dy) > 18) { navPause(dy > 0 ? -1 : 1); pauseSwipeY.current = e.clientY }
            }}
            onPointerUp={(e) => {
              e.preventDefault()
              const dy = pauseSwipeY.current - e.clientY
              if (Math.abs(dy) > 18) navPause(dy > 0 ? -1 : 1)
              pauseSwipeY.current = 0
            }}
            onPointerCancel={() => { pauseSwipeY.current = 0 }}
          >
            {/* Flecha arriba */}
            <svg width="32" height="22" viewBox="0 0 32 22">
              <path d="M16 2 L28 20 L4 20 Z" fill="rgba(255,255,255,0.75)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
            </svg>
            {/* Icono de dedo / toque */}
            <div style={{
              width: 28, height: 28,
              background: "rgba(255,255,255,0.10)",
              border: "1.5px solid rgba(255,255,255,0.30)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              ☝
            </div>
            {/* Flecha abajo */}
            <svg width="32" height="22" viewBox="0 0 32 22">
              <path d="M16 20 L28 2 L4 2 Z" fill="rgba(255,255,255,0.75)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
            </svg>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", letterSpacing: "0.10em", fontFamily: "'Courier New',monospace", textAlign: "center", lineHeight: 1.3 }}>
              DESLIZA
            </span>
          </div>

          {/* Botón B — salir de pausa (derecha) */}
          <div style={{
            position: "absolute", bottom: ACT_B + Math.round(ACT_H * 0.12),
            right: "5%", zIndex: 100, opacity: 0.82,
          }}>
            {xbCircle(BTN_SZ, XB_COL.B, "B", "SALIR",
              () => { G.current.paused = false; setUi(u => ({ ...u, paused: false })) }, () => {})}
          </div>
        </>
      )
    }

    return (
      <>
        {/* ══════════════════════════════════════════════════
            MAP — esquina superior derecha, icono solo
        ══════════════════════════════════════════════════ */}
        <div
          style={{ ...SYS_BTN, top: Math.round(44 * vh / 600) + 8, right: "3%", width: 40, height: 40, borderRadius: 10, zIndex: 25 }}
          {...makeTouch(() => {
            g.showMap = !g.showMap; g.paused = g.showMap
            if (g.showMap) { g.mapViewWorld = Math.max(0, Math.min(NW-1, Math.floor(g.pl.x/(NC*RW)))); g.mapView = "single" }
          }, () => {})}
        >
          <svg width="18" height="18" viewBox="0 0 14 14" style={{ opacity: 0.80 }}>
            <rect x="1" y="3" width="4" height="8" fill="none" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="5" y="1" width="4" height="10" fill="none" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="9" y="4" width="4" height="7" fill="none" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </div>

        {/* TELE — encima del joystick (izquierda), solo cuando hay ≥2 CPs y la jugadora está cerca */}
        {g.discoveredCPs.size >= 2 && nearAnyCP && (() => {
          // Calcular altura del joystick para posicionar TELE justo encima
          const jBase = Math.round(Math.max(52, Math.min(72, vh * 0.155)))
          const jDiam = jBase * 2
          return (
            <div
              style={{ ...SYS_BTN,
                       bottom: DPAD_B + jDiam + 8,
                       left: "15%", transform: "translateX(-50%)",
                       width: 66, height: 32, fontSize: 10, gap: 3,
                       borderColor: "#D4C40066", zIndex: 25 }}
              {...makeTouch(() => {
                if (g.tpMenu?.open) { g.tpMenu = null; g.paused = false; _tpClearMvKeys(g) }
                else tpOpenMenu(g)
              }, () => {})}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity: 0.85 }}>
                <circle cx="6" cy="6" r="4.5" fill="none" stroke="#D4C400" strokeWidth="1.2"/>
                <path d="M6 2 L8 6 L6 5 L6 10 L4 6 L6 7 Z" fill="#D4C400" opacity="0.9"/>
              </svg>
              <span style={{ color: "#D4C400CC" }}>TELE</span>
            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════
            HOMBROS — solo cuando la habilidad existe.
            Se colocan justo encima del diamante de acción.
        ══════════════════════════════════════════════════ */}
        {hasDash && (
          <div style={{
            position: "absolute",
            bottom: SAFE_B,
            right: "22%",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, zIndex: 20,
          }}>
            {xbBumper(66, 24, "LT", () => pressKey("shift"), () => releaseKey("shift"))}
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.32)", letterSpacing: "0.1em", fontFamily: "'Courier New',monospace" }}>DASH</span>
          </div>
        )}
        {/* ── T-BALL: botón cóncavo siempre visible arriba-derecha del diamante ── */}
        {(() => {
          const tballSz  = Math.round(ACT_H * 0.29)
          const unlocked = hasTBall
          const hasAmmo  = g.tballAmmo > 0 || g.infiniteAmmo
          const active   = unlocked && hasAmmo && !_rexTypingActive
          return (
            <div
              style={{
                position: "absolute",
                // Entre Y y B, en el área superior del diamante (como RUN está entre X y A)
                bottom: ACT_B + Math.round(ACT_H * 0.82),
                right: `calc(3% + ${Math.round(ACT_H * 0.04)}px)`,
                zIndex: 22,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                pointerEvents: active ? "auto" : "none",
              }}
              {...(active ? makeTouch(() => fireTBall(g), () => {}) : {})}
            >
              {/* Botón cóncavo */}
              <div style={{
                width: tballSz, height: tballSz,
                borderRadius: "50%",
                background: unlocked
                  ? `radial-gradient(ellipse at 45% 40%, #2a1a0a 0%, #120800 55%, #080400 100%)`
                  : "radial-gradient(ellipse at 45% 40%, #1a1a1a 0%, #0a0a0a 60%, #050505 100%)",
                border: `1.5px solid ${unlocked ? "rgba(255,160,30,0.28)" : "rgba(255,255,255,0.10)"}`,
                boxShadow: [
                  "inset 0 3px 8px rgba(0,0,0,0.92)",
                  "inset 0 0 10px rgba(0,0,0,0.70)",
                  unlocked && hasAmmo
                    ? "inset 0 -1px 0 rgba(255,140,20,0.18), 0 1px 0 rgba(255,255,255,0.06)"
                    : "0 1px 0 rgba(255,255,255,0.04)"
                ].filter(Boolean).join(", "),
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: active ? 1 : (unlocked ? 0.40 : 0.22),
                transition: "opacity 0.3s",
                flexShrink: 0,
              }}>
                {/* Ícono de pelota */}
                {/* Imagen real del asset */}
                <img
                  src={asset("/assets/Enviroment/Tennis_Ball/Tennis_Ball.png")}
                  width={Math.round(tballSz * 0.60)}
                  height={Math.round(tballSz * 0.60)}
                  style={{
                    imageRendering: "pixelated",
                    opacity: unlocked ? (hasAmmo ? 1 : 0.35) : 0.15,
                    display: "block",
                  }}
                  alt="T-Ball"
                />
                {!unlocked && (
                  <span style={{ position:"absolute", fontSize: Math.round(tballSz*0.30), lineHeight:1, opacity:0.5 }}>🔒</span>
                )}
              </div>
              {/* Etiqueta con munición o estado */}
              <span style={{
                fontSize: 7, letterSpacing: "0.08em",
                fontFamily: "'Courier New',monospace",
                color: unlocked
                  ? (hasAmmo ? "rgba(255,160,40,0.80)" : "rgba(255,80,40,0.55)")
                  : "rgba(255,255,255,0.22)",
                lineHeight: 1,
              }}>
                {unlocked ? (g.infiniteAmmo ? "∞" : `×${g.tballAmmo}`) : "T-BALL"}
              </span>
            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════
            IZQUIERDA — D-CROSS estilo Xbox
            bottom exacto, sin offset vertical falso
        ══════════════════════════════════════════════════ */}
        {/* ══ D-PAD IZQUIERDO — modo según dpadMode (DEV-CELULAR) ══ */}

        {/* ── MODO CROSS (default): joystick cuando TP abierto, D-PAD normal ── */}
        {dpadMode === "cross" && (ui.tpMenuOpen ? (() => {
          // Joystick de navegación TP (mismo visual que joystick normal, tono cian)
          const JBASE_C  = Math.round(Math.max(52, Math.min(72, vh * 0.155)))
          const JTHUMB_C = Math.round(JBASE_C * 0.40)
          const JDIAM_C  = JBASE_C * 2
          const DEAD_C   = JBASE_C * 0.18
          const applyTPJoy = (rawOx: number, rawOy: number) => {
            const dist = Math.sqrt(rawOx*rawOx + rawOy*rawOy)
            const scale = dist > JBASE_C ? JBASE_C/dist : 1
            const ox = rawOx*scale, oy = rawOy*scale
            setJstickThumb({ x: ox, y: oy })
            const NAV_CD = 320, nowMs = performance.now()
            const hZone = Math.abs(ox) > DEAD_C ? (ox > 0 ? 1 : -1) : 0
            const vZone = Math.abs(oy) > DEAD_C ? (oy > 0 ? 1 : -1) : 0
            if (hZone !== tpJoyNavRef.current.wasH) {
              tpJoyNavRef.current.wasH = hZone as -1|0|1
              if (hZone !== 0 && nowMs - tpJoyNavRef.current.lastH > NAV_CD) {
                navTPWorld(hZone as 1|-1); tpJoyNavRef.current.lastH = nowMs
              }
            }
            if (vZone !== tpJoyNavRef.current.wasV) {
              tpJoyNavRef.current.wasV = vZone as -1|0|1
              if (vZone !== 0 && nowMs - tpJoyNavRef.current.lastV > NAV_CD) {
                navTP(vZone as 1|-1); tpJoyNavRef.current.lastV = nowMs
              }
            }
          }
          const releaseTPJoy = () => {
            setJstickThumb({ x: 0, y: 0 })
            tpJoyNavRef.current.wasH = 0; tpJoyNavRef.current.wasV = 0
          }
          return (
            <div style={{ position:"absolute", bottom:DPAD_B, left:"15%", transform:"translateX(-50%)",
              width:JDIAM_C, height:JDIAM_C, touchAction:"none", zIndex:20 }}>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%",
                background:"linear-gradient(145deg,#1A3A3A 0%,#0C1C1C 100%)",
                border:"1.5px solid rgba(80,220,220,0.40)",
                boxShadow:"0 6px 20px rgba(0,0,0,0.75)" }}/>
              <svg style={{ position:"absolute",inset:0,pointerEvents:"none" }} width={JDIAM_C} height={JDIAM_C}>
                <circle cx={JBASE_C} cy={JBASE_C} r={JBASE_C*0.62}
                  fill="none" stroke="rgba(80,220,220,0.14)" strokeWidth="1" strokeDasharray="5 5"/>
                <line x1={JBASE_C} y1={JBASE_C*0.38} x2={JBASE_C} y2={JBASE_C*1.62}
                  stroke="rgba(80,220,220,0.12)" strokeWidth="1"/>
                <line x1={JBASE_C*0.38} y1={JBASE_C} x2={JBASE_C*1.62} y2={JBASE_C}
                  stroke="rgba(80,220,220,0.12)" strokeWidth="1"/>
                <text x={JBASE_C} y={JBASE_C*0.38} textAnchor="middle"
                  fill="rgba(80,220,220,0.45)" fontSize="9" fontFamily="Courier New,monospace">TP</text>
              </svg>
              <div style={{
                position:"absolute",
                left: JBASE_C - JTHUMB_C + jstickThumb.x,
                top:  JBASE_C - JTHUMB_C + jstickThumb.y,
                width:JTHUMB_C*2, height:JTHUMB_C*2, borderRadius:"50%",
                background:"radial-gradient(circle at 38% 32%, rgba(80,220,220,0.65), rgba(0,90,100,0.35))",
                border:"2px solid rgba(80,220,220,0.55)",
                boxShadow:"0 3px 10px rgba(0,0,0,0.55)", pointerEvents:"none",
                transition: jstickThumb.x===0&&jstickThumb.y===0 ? "left 0.12s,top 0.12s" : "none",
              }}/>
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",cursor:"pointer",touchAction:"none" }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  jstickBaseRef.current = { cx: rect.left+JBASE_C, cy: rect.top+JBASE_C }
                  applyTPJoy(e.clientX-jstickBaseRef.current.cx, e.clientY-jstickBaseRef.current.cy)
                  const pid = e.pointerId
                  const onMove = (ev: PointerEvent) => {
                    if (ev.pointerId!==pid) return
                    applyTPJoy(ev.clientX-jstickBaseRef.current.cx, ev.clientY-jstickBaseRef.current.cy)
                  }
                  const onEnd = (ev: PointerEvent) => {
                    if (ev.pointerId!==pid) return; releaseTPJoy()
                    window.removeEventListener("pointermove",onMove)
                    window.removeEventListener("pointerup",onEnd)
                    window.removeEventListener("pointercancel",onEnd)
                  }
                  window.addEventListener("pointermove",onMove)
                  window.addEventListener("pointerup",onEnd)
                  window.addEventListener("pointercancel",onEnd)
                }}
              />
            </div>
          )
        })() : (<>
        <div style={{
          position: "absolute",
          bottom: DPAD_B,
          left: "15%",
          transform: "translateX(-50%)",
          width: TOTAL, height: TOTAL,
          touchAction: "none", zIndex: 20,
        }}>
          {/* Fondo en forma de cruz */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(145deg,#333 0%,#1C1C1C 100%)",
            clipPath: `polygon(${ARM}px 0,${ARM+HUB}px 0,${ARM+HUB}px ${ARM}px,${TOTAL}px ${ARM}px,${TOTAL}px ${ARM+HUB}px,${ARM+HUB}px ${ARM+HUB}px,${ARM+HUB}px ${TOTAL}px,${ARM}px ${TOTAL}px,${ARM}px ${ARM+HUB}px,0 ${ARM+HUB}px,0 ${ARM}px,${ARM}px ${ARM}px)`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.75)",
          }}/>
          <svg style={{ position:"absolute",inset:0,overflow:"visible",pointerEvents:"none" }} width={TOTAL} height={TOTAL}>
            <path d={`M${ARM} 0 H${ARM+HUB} V${ARM} H${TOTAL} V${ARM+HUB} H${ARM+HUB} V${TOTAL} H${ARM} V${ARM+HUB} H0 V${ARM} H${ARM} Z`}
              fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5"/>
          </svg>
          <div style={{ position:"absolute",left:ARM,top:ARM,width:HUB,height:HUB,
            background:"#252525", border:"1px solid rgba(255,255,255,0.09)", pointerEvents:"none"}}/>
          {/* Overlay único TOTAL×TOTAL — sin pointer capture → onPointerLeave siempre dispara */}
          {(() => {
            const releaseAll = () => {
              releaseKey("arrowleft"); releaseKey("arrowright")
              releaseKey("arrowup");   releaseKey("arrowdown")
            }
            const getDir = (x: number, y: number): "left"|"right"|"up"|"down"|null => {
              const inH = y >= ARM && y <= ARM + HUB
              const inV = x >= ARM && x <= ARM + HUB
              if (!inH && !inV) return null
              if (inH) return x < TOTAL / 2 ? "left" : "right"
              return y < TOTAL / 2 ? "up" : "down"
            }
            const applyDir = (dir: "left"|"right"|"up"|"down", isInitialTap: boolean) => {
              const k = G.current.keys
              if (dir !== "left")  releaseKey("arrowleft")
              if (dir !== "right") releaseKey("arrowright")
              if (dir !== "up")    releaseKey("arrowup")
              if (dir !== "down")  releaseKey("arrowdown")
              if (dir === "left"  && !k["arrowleft"])  { if (isInitialTap) dpadDown("left","arrowleft");   else pressKey("arrowleft") }
              if (dir === "right" && !k["arrowright"]) { if (isInitialTap) dpadDown("right","arrowright"); else pressKey("arrowright") }
              if (dir === "up"    && !k["arrowup"]    && !g.tpMenu?.open) pressKey("arrowup")
              if (dir === "down"  && !k["arrowdown"]  && !g.tpMenu?.open) pressKey("arrowdown")
            }
            return (
              <div
                style={{ position:"absolute", left:0, top:0, width:TOTAL, height:TOTAL,
                  cursor:"pointer", userSelect:"none", touchAction:"none", zIndex:12 }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left, y = e.clientY - rect.top
                  const dir = getDir(x, y)
                  if (!dir) return
                  if (g.bolkhaShopOpen || g.bolkhaState === "giving") {
                    if (g.bolkhaShopOpen) {
                      if (dir === "up")   g.bolkhaShopCursor = Math.max(0, g.bolkhaShopCursor - 1)
                      if (dir === "down") g.bolkhaShopCursor = Math.min(2, g.bolkhaShopCursor + 1)
                    }
                    return  // no mover jugador
                  }
                  if (g.tpMenu?.open) {
                    if (dir === "left") navTPWorld(-1); else if (dir === "right") navTPWorld(1)
                    else if (dir === "up") navTP(-1);  else if (dir === "down")  navTP(1)
                    return
                  }
                  applyDir(dir, true)
                }}
                onPointerMove={(e) => {
                  if (!(e.buttons & 1)) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left, y = e.clientY - rect.top
                  const dir = getDir(x, y)
                  if (!dir) { releaseAll(); return }
                  if (g.bolkhaShopOpen || g.bolkhaState === "giving" || g.tpMenu?.open) return
                  applyDir(dir, false)
                }}
                onPointerUp={releaseAll}
                onPointerLeave={releaseAll}
                onPointerCancel={releaseAll}
              />
            )
          })()}
          {/* Flechas decorativas */}
          <div style={{ position:"absolute",left:ARM,top:0,width:HUB,height:ARM,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}>
            <svg width="18" height="14" viewBox="0 0 18 14"><path d="M9 2 L16 12 L2 12 Z" fill="rgba(255,255,255,0.65)"/></svg>
          </div>
          <div style={{ position:"absolute",left:ARM,top:ARM+HUB,width:HUB,height:ARM,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}>
            <svg width="18" height="14" viewBox="0 0 18 14"><path d="M9 12 L16 2 L2 2 Z" fill="rgba(255,255,255,0.65)"/></svg>
          </div>
          <div style={{ position:"absolute",left:0,top:ARM,width:ARM,height:HUB,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}>
            <svg width="14" height="18" viewBox="0 0 14 18"><path d="M2 9 L12 2 L12 16 Z" fill="rgba(255,255,255,0.65)"/></svg>
          </div>
          <div style={{ position:"absolute",left:ARM+HUB,top:ARM,width:ARM,height:HUB,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}>
            <svg width="14" height="18" viewBox="0 0 14 18"><path d="M12 9 L2 2 L2 16 Z" fill="rgba(255,255,255,0.65)"/></svg>
          </div>
        </div>
        {/* Hint doble-tap */}
        <div style={{ position:"absolute", bottom:Math.max(4,DPAD_B-14), left:"15%", transform:"translateX(-50%)",
          fontSize:7, color:"rgba(255,255,255,0.2)", letterSpacing:"0.15em",
          fontFamily:"'Courier New',monospace", pointerEvents:"none", zIndex:20 }}>2× ← / → = RUN</div>
        </>))}

        {/* ── MODO JOYSTICK (DEV) ── */}
        {dpadMode === "joystick" && (() => {
          const JBASE  = Math.round(Math.max(52, Math.min(72, vh * 0.155)))
          const JTHUMB = Math.round(JBASE * 0.40)
          const JDIAM  = JBASE * 2
          const DEAD   = JBASE * 0.18

          const releaseJoy = () => {
            releaseKey("arrowleft"); releaseKey("arrowright")
            releaseKey("arrowup");   releaseKey("arrowdown")
            setJstickThumb({ x: 0, y: 0 })
            joyTapRef.current.wasLeft  = false
            joyTapRef.current.wasRight = false
            tpJoyNavRef.current.wasH = 0; tpJoyNavRef.current.wasV = 0
          }
          const applyJoy = (rawOx: number, rawOy: number) => {
            const dist = Math.sqrt(rawOx * rawOx + rawOy * rawOy)
            const scale = dist > JBASE ? JBASE / dist : 1
            const ox = rawOx * scale, oy = rawOy * scale
            setJstickThumb({ x: ox, y: oy })

            // ── Modo Shop Bolkha / animación de entrega: bloquear movimiento ───
            if (g.bolkhaState === "giving") return  // freeze durante animación

            if (g.bolkhaShopOpen) {
              const NAV_CD = 300, nowMs = performance.now()
              const vZone = Math.abs(oy) > DEAD ? (oy > 0 ? 1 : -1) : 0
              if (vZone !== tpJoyNavRef.current.wasV) {
                tpJoyNavRef.current.wasV = vZone as -1|0|1
                if (vZone !== 0 && nowMs - tpJoyNavRef.current.lastV > NAV_CD) {
                  g.bolkhaShopCursor = Math.max(0, Math.min(2, g.bolkhaShopCursor + vZone))
                  tpJoyNavRef.current.lastV = nowMs
                }
              }
              return
            }

            // ── Modo TP: el joystick navega el menú, no mueve al personaje ──────
            if (ui.tpMenuOpen) {
              const NAV_CD = 320, nowMs = performance.now()
              const hZone = Math.abs(ox) > DEAD ? (ox > 0 ? 1 : -1) : 0
              const vZone = Math.abs(oy) > DEAD ? (oy > 0 ? 1 : -1) : 0
              if (hZone !== tpJoyNavRef.current.wasH) {
                tpJoyNavRef.current.wasH = hZone as -1|0|1
                if (hZone !== 0 && nowMs - tpJoyNavRef.current.lastH > NAV_CD) {
                  navTPWorld(hZone as 1|-1); tpJoyNavRef.current.lastH = nowMs
                }
              }
              if (vZone !== tpJoyNavRef.current.wasV) {
                tpJoyNavRef.current.wasV = vZone as -1|0|1
                if (vZone !== 0 && nowMs - tpJoyNavRef.current.lastV > NAV_CD) {
                  navTP(vZone as 1|-1); tpJoyNavRef.current.lastV = nowMs
                }
              }
              return
            }

            const TAP_WIN = 300
            if (Math.abs(ox) > DEAD) {
              if (ox < 0) {
                if (!joyTapRef.current.wasLeft) {
                  // Acaba de entrar en zona izquierda → registrar instante
                  const now = performance.now()
                  if (joyTapRef.current.left > 0 && now - joyTapRef.current.left < TAP_WIN)
                    G.current.pl.runMode = true   // doble-flick izquierda → correr
                  joyTapRef.current.left = now
                  joyTapRef.current.wasLeft  = true
                  joyTapRef.current.wasRight = false
                }
                releaseKey("arrowright"); if (!G.current.keys["arrowleft"])  pressKey("arrowleft")
              } else {
                if (!joyTapRef.current.wasRight) {
                  // Acaba de entrar en zona derecha → registrar instante
                  const now = performance.now()
                  if (joyTapRef.current.right > 0 && now - joyTapRef.current.right < TAP_WIN)
                    G.current.pl.runMode = true   // doble-flick derecha → correr
                  joyTapRef.current.right = now
                  joyTapRef.current.wasRight = true
                  joyTapRef.current.wasLeft  = false
                }
                releaseKey("arrowleft"); if (!G.current.keys["arrowright"]) pressKey("arrowright")
              }
            } else {
              releaseKey("arrowleft"); releaseKey("arrowright")
              joyTapRef.current.wasLeft  = false
              joyTapRef.current.wasRight = false
            }
          }

          // ── Joystick — normal o modo TP (tinte cian) ──────────────────────────
          return (
            <div style={{ position:"absolute", bottom:DPAD_B, left:"15%", transform:"translateX(-50%)",
              width:JDIAM, height:JDIAM, touchAction:"none", zIndex:20 }}>
              {/* Base */}
              <div style={{ position:"absolute", inset:0, borderRadius:"50%",
                background: ui.tpMenuOpen
                  ? "linear-gradient(145deg,#1A3A3A 0%,#0C2020 100%)"
                  : "linear-gradient(145deg,#333 0%,#1C1C1C 100%)",
                border: ui.tpMenuOpen ? "1.5px solid rgba(80,220,220,0.35)" : "1.5px solid rgba(255,255,255,0.16)",
                boxShadow:"0 6px 20px rgba(0,0,0,0.75)" }}/>
              {/* Anillo guía */}
              <svg style={{ position:"absolute",inset:0,pointerEvents:"none" }} width={JDIAM} height={JDIAM}>
                <circle cx={JBASE} cy={JBASE} r={JBASE*0.62}
                  fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="5 5"/>
                {/* Cruces de referencia */}
                <line x1={JBASE} y1={JBASE-JBASE*0.55} x2={JBASE} y2={JBASE+JBASE*0.55} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                <line x1={JBASE-JBASE*0.55} y1={JBASE} x2={JBASE+JBASE*0.55} y2={JBASE} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
              </svg>
              {/* Label TP cuando el menú está abierto */}
              {ui.tpMenuOpen && <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:9,color:"rgba(80,220,220,0.55)",
                fontFamily:"'Courier New',monospace",pointerEvents:"none",letterSpacing:"0.1em" }}>TP</div>}
              {/* Thumb — sigue el dedo (posición relativa al centro de la base) */}
              <div style={{
                position:"absolute",
                left: JBASE - JTHUMB + jstickThumb.x,
                top:  JBASE - JTHUMB + jstickThumb.y,
                width:JTHUMB*2, height:JTHUMB*2, borderRadius:"50%",
                background: ui.tpMenuOpen
                  ? "radial-gradient(circle at 38% 32%, rgba(80,220,220,0.70), rgba(0,100,100,0.30))"
                  : "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.55), rgba(200,200,200,0.18))",
                border: ui.tpMenuOpen ? "2px solid rgba(80,220,220,0.55)" : "2px solid rgba(255,255,255,0.40)",
                boxShadow:"0 3px 10px rgba(0,0,0,0.55)",
                pointerEvents:"none",
                transition: jstickThumb.x === 0 && jstickThumb.y === 0 ? "left 0.12s,top 0.12s" : "none",
              }}/>
              {/* Capa interactiva — con setPointerCapture para seguir el dedo a donde vaya */}
              {/* Capa interactiva — listeners nativos en window para garantizar release
                  aunque el dedo se levante fuera del joystick o de la pantalla */}
              <div
                style={{ position:"absolute", inset:0, borderRadius:"50%",
                  cursor:"pointer", touchAction:"none" }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  jstickBaseRef.current = { cx: rect.left + JBASE, cy: rect.top + JBASE }
                  applyJoy(e.clientX - jstickBaseRef.current.cx, e.clientY - jstickBaseRef.current.cy)
                  // Listeners nativos en window — no dependen de pointer capture ni de React
                  const pid = e.pointerId
                  const onMove = (ev: PointerEvent) => {
                    if (ev.pointerId !== pid) return
                    applyJoy(ev.clientX - jstickBaseRef.current.cx, ev.clientY - jstickBaseRef.current.cy)
                  }
                  const onEnd = (ev: PointerEvent) => {
                    if (ev.pointerId !== pid) return
                    releaseJoy()
                    window.removeEventListener("pointermove", onMove)
                    window.removeEventListener("pointerup",   onEnd)
                    window.removeEventListener("pointercancel", onEnd)
                  }
                  window.addEventListener("pointermove",   onMove)
                  window.addEventListener("pointerup",     onEnd)
                  window.addEventListener("pointercancel", onEnd)
                }}
              />
            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════
            DERECHA — DIAMANTE A / B / X / Y estilo Xbox
            Posición exacta: bottom=ACT_B, right fijo,
            SIN transform vertical
        ══════════════════════════════════════════════════ */}
        <div style={{
          position: "absolute",
          bottom: ACT_B,
          right: "3%",
          width: ACT_H,
          height: ACT_H,
          // ← NO hay transform vertical aquí
          zIndex: 20,
        }}>
          {/* Y — arriba (látigo) */}
          <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)" }}>
            {xbCircle(Math.round(ACT_H*0.33), XB_COL.Y, "Y", "LÁTIGO",
              ()=>pressKey("m"), ()=>releaseKey("m"))}
          </div>
          {/* X — izquierda (disparo) */}
          <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-55%)" }}>
            {xbCircle(Math.round(ACT_H*0.33), XB_COL.X, "X", "DISPARO",
              ()=>pressKey("n"), ()=>releaseKey("n"))}
          </div>
          {/* B — derecha (checkpoint / siguiente diálogo / cerrar tpMenu / cerrar shop) */}
          <div style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-55%)" }}>
            {xbCircle(Math.round(ACT_H*0.33), XB_COL.B, "B",
              g.tpMenu?.open       ? "CERRAR"
              : g.bolkhaShopOpen   ? "SALIR"
              : g.bolkhaState === "talking" ? "TIENDA"
              : _rexPageWaiting    ? "SIGUIENTE"
              : "GUARDAR",
              () => {
                if (g.tpMenu?.open)               { g.tpMenu = null; g.paused = false; _tpClearMvKeys(g) }
                else if (g.bolkhaShopOpen)         { g.bolkhaShopOpen = false; g.bolkhaState = "idle" }
                else if (g.bolkhaState === "talking") { bolkhaDoInteract(g) }
                else if (_rexPageWaiting)          { pressKey("e"); setTimeout(() => releaseKey("e"), 120) }
                else activateCheckpoint()
              }, () => {})}
          </div>
          {/* A — abajo (saltar / confirmar tpMenu / comprar en shop) — más grande */}
          <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)" }}>
            {xbCircle(Math.round(ACT_H*0.40), XB_COL.A, "A",
              g.tpMenu?.open     ? "CONFIRMAR"
              : g.bolkhaShopOpen ? "COMPRAR"
              : "SALTAR",
              () => {
                if (g.tpMenu?.open)     confirmTP()
                else if (g.bolkhaShopOpen) bolkhaDoInteract(g)
                else pressKey(" ")
              },
              () => { if (!g.tpMenu?.open && !g.bolkhaShopOpen) releaseKey(" ") })}
          </div>
          {/* PAUSA — esquina inferior-derecha del panel, icono solo */}
          <div
            style={{
              position: "absolute", right: 0, bottom: 0,
              width: Math.round(ACT_H * 0.20), height: Math.round(ACT_H * 0.20),
              borderRadius: "50%",
              background: "rgba(20,20,20,0.82)", border: "1.5px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", userSelect: "none", touchAction: "none", zIndex: 25,
            }}
            {...makeTouch(() => { g.paused = !g.paused }, () => {})}
          >
            <svg width="12" height="13" viewBox="0 0 13 14" style={{ opacity: 0.70 }}>
              <rect x="1" y="1" width="4" height="12" rx="1" fill="currentColor"/>
              <rect x="8" y="1" width="4" height="12" rx="1" fill="currentColor"/>
            </svg>
          </div>
        </div>

      </>
    )
  }

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden select-none">
      {/* El contenedor SIEMPRE llena el viewport — top/left/right/bottom:0 es más robusto
           que width/height numérico (inmune a winDims stale y a iOS safari address bar) */}
      <div ref={containerRef} className="relative" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", zIndex: 9999, overflow: "hidden" }}>

        {/* ── Canvas del juego ── */}
        <canvas ref={canvasRef} width={CW} height={CH} style={{ ...canvasStyle, display: screen === "playing" ? "block" : "none" }} />

        {/* ══════════════════════════════════════════════════
            PANTALLA DE INICIO
        ══════════════════════════════════════════════════ */}
        {screen === "start" && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
              backgroundImage: `url(${asset("/assets/menu_bg.png")}), linear-gradient(180deg,#040804 0%,#091409 55%,#020502 100%)`,
              backgroundSize: "cover", backgroundPosition: "center",
              border: "none",
              borderRadius: 0,
              fontFamily: "'Courier New',monospace",
            }}
            onClick={() => { if (!getFSElement() && !isPseudoFS) tryFullscreen(containerRef.current || document.documentElement) }}
            onTouchStart={() => { if (!getFSElement() && !isPseudoFS) tryFullscreen(containerRef.current || document.documentElement) }}
          >
            {/* Capa oscura sobre el fondo */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.58)", zIndex: 0 }} />

            {/* Línea decorativa superior */}
            {/* <div style={{ position: "absolute", top: 38, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg,transparent,#D4C40055,#D4C400AA,#D4C40055,transparent)", zIndex: 1 }} />
            <div style={{ position: "absolute", bottom: 38, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg,transparent,#D4C40055,#D4C400AA,#D4C40055,transparent)", zIndex: 1 }} /> */}

            {/* Contenido centrado */}
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

              {/* Etiqueta superior */}
              <p style={{ color: "#3A5A3A", fontSize: 11, letterSpacing: "0.35em", marginBottom: 12 }}>
                {/* // COMPLEJO CANINO — SECTOR 0 // */}
              </p>

              {/* Título principal */}
              <h1 style={{
                fontSize: 58, fontWeight: "900", letterSpacing: "0.08em", margin: 0,
                color: "#EEFFEE",
                textShadow: "0 0 28px #D4C400CC, 0 0 60px #3A8A0066, 0 2px 0 #000",
                lineHeight: 1.05,
              }}>
                {/* PROYECTO LULY */}
              </h1>

              {/* Subtítulo */}
              <p style={{ color: "#4A7A4A", fontSize: 13, letterSpacing: "0.22em", margin: "10px 0 44px", fontStyle: "italic" }}>
                {/* liberación canina — metroidvania */}
              </p>

              {/* Separador */}
              <h1 style={{
                fontSize: 58, fontWeight: "900", letterSpacing: "0.08em", margin: 0,
                color: "#EEFFEE",
                textShadow: "0 0 28px #D4C400CC, 0 0 60px #3A8A0066, 0 2px 0 #000",
                lineHeight: 1.05,
                height: 50
              }}>
                {/* PROYECTO LULY */}
              </h1>

              {/* Botones */}
              {(() => {
                let idx = 0
                const isSel = (n: number) => menuSel === n
                const selStyle = (accent: string, n: number): CSSProperties => isSel(n)
                  ? { background: `rgba(${accent === "#D4C400" ? "212,196,0" : "85,102,85"},0.22)`, boxShadow: `0 0 22px ${accent}55`, outline: `2px solid ${accent}88` }
                  : {}
                const sv = hasSave ? loadSaveData() : null
                const timeStr = sv ? (() => { const d = new Date(sv.savedAt); return `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}` })() : ""
                const contIdx = hasSave ? idx++ : -1
                const jugarIdx = idx++
                const cfgIdx = idx++
                const fsIdx = (!isTouchDevice && !isFullscreenEffective) ? idx++ : -1
                const salirIdx = idx++
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 280, alignItems: "stretch" }}>
                    {!saveChecked ? (
                      <div style={{ textAlign: "center", color: "#4A6A4A", fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: "0.15em", padding: "18px 0" }}>
                        cargando…
                      </div>
                    ) : (<>
                    {hasSave && (
                      <button
                        style={{ ...menuBtn("#D4C400"), marginBottom: 6, ...selStyle("#D4C400", contIdx), position: "relative" }}
                        onMouseEnter={() => { menuSelRef.current = contIdx; setMenuSel(contIdx) }}
                        onClick={() => { const sv2 = loadSaveData(); if (!sv2) { handlePlay(); return }; applyLoad(G.current, sv2); gameActiveRef.current = true; setScreen("playing"); if (!getFSElement() && !isPseudoFS) tryFullscreen(document.documentElement) }}
                        onTouchEnd={e => { e.preventDefault(); const sv2 = loadSaveData(); if (!sv2) { handlePlay(); return }; applyLoad(G.current, sv2); gameActiveRef.current = true; setScreen("playing"); if (!getFSElement() && !isPseudoFS) tryFullscreen(document.documentElement) }}
                      >
                        {isSel(contIdx) && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#D4C400" }}>▶</span>}
                        ★  CONTINUAR  <span style={{ fontSize: 9, opacity: 0.6 }}>· {timeStr}</span>
                      </button>
                    )}
                    <button
                      style={{ ...menuBtn("#D4C400"), position: "relative", ...selStyle("#D4C400", jugarIdx) }}
                      onMouseEnter={() => { menuSelRef.current = jugarIdx; setMenuSel(jugarIdx) }}
                      onClick={handlePlay}
                      onTouchEnd={e => { e.preventDefault(); handlePlay() }}
                    >
                      {isSel(jugarIdx) && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#D4C400" }}>▶</span>}
                      ▶  NUEVA PARTIDA
                    </button>
                    <button
                      style={{ ...menuBtn("#7A9A7A"), position: "relative", ...selStyle("#7A9A7A", cfgIdx) }}
                      onMouseEnter={() => { menuSelRef.current = cfgIdx; setMenuSel(cfgIdx) }}
                      onClick={() => setShowSettings(true)}
                      onTouchEnd={e => { e.preventDefault(); setShowSettings(true) }}
                    >
                      {isSel(cfgIdx) && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#7A9A7A" }}>▶</span>}
                      ⚙  CONFIGURACIÓN
                    </button>
                    {!isTouchDevice && !isFullscreenEffective && (
                      <button
                        style={{ ...menuBtn("#556655"), position: "relative", ...selStyle("#556655", fsIdx) }}
                        onMouseEnter={() => { menuSelRef.current = fsIdx; setMenuSel(fsIdx) }}
                        onClick={() => tryFullscreen(document.documentElement)}
                      >
                        {isSel(fsIdx) && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#88AA88" }}>▶</span>}
                        ⛶  PANTALLA COMPLETA
                      </button>
                    )}
                    <button
                      style={{ ...menuBtn("#556655"), position: "relative", ...selStyle("#556655", salirIdx) }}
                      onMouseEnter={() => { menuSelRef.current = salirIdx; setMenuSel(salirIdx) }}
                      onClick={handleExit}
                    >
                      {isSel(salirIdx) && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#88AA88" }}>▶</span>}
                      ✕  SALIR
                    </button>
                    </>)}
                  </div>
                )
              })()}

              {/* Controles resumidos — iconos dinámicos */}
              <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 20px", textAlign: "center" }}>
                <CtrlHint action="move"    label="mover" />
                <CtrlHint action="jump"    label="saltar" />
                <CtrlHint action="shoot"   label="disparar" />
                <CtrlHint action="whip"    label="látigo" />
                <CtrlHint action="dash"    label="dash*" />
                <CtrlHint action="map"     label="mapa" />
              </div>
              {gpadConnected && (
                <div style={{ marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
                  <CtrlHint action="nav"      label="navegar" size={13} />
                  <CtrlHint action="confirm"  label="confirmar" size={13} />
                  <CtrlHint action="cancel"   label="atrás" size={13} />
                </div>
              )}
              <p style={{ marginTop: 6, fontSize: 9, color: "#2A3A2A" }}>* dash se desbloquea derrotando al primer jefe</p>
            </div>

            {/* Versión */}
            <p style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#ffffff", letterSpacing: "0.2em", zIndex: 2, fontFamily: "'Courier New',monospace" }}>
              v{GAME_VERSION}
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

        {/* ── Ícono de gamepad (FPS ya está en el panel DEV canvas) ── */}
        {screen === "playing" && gpadConnected && (
          <div className="absolute top-1 left-2 text-xs opacity-80">
            <span style={{ color: "#D4C400" }} title="Control Xbox detectado">🎮</span>
          </div>
        )}

        {/* ── RealMap DEV — solo devMode/PC, toggle con N ── */}
        {screen === "playing" && ui.devMode && !G.current.isMobile && (
          <RealMapDev
            visible={ui.showRealMap}
            drawFn={realMapDrawFn}
            onSwipe={(dir) => { G.current.realMapSection = dir > 0 ? 1 : 0 }}
          />
        )}

        {/* ── Gamepad táctil ── */}
        <VirtualGamepad />

        {/* ── Pausa ── (solo cuando no está el mapa ni el devmap abiertos) */}
        {screen === "playing" && ui.paused && !ui.tpMenuOpen && !ui.over && !ui.won && !ui.showDevMap && !ui.showMap && (() => {
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

                {/* ── Botones de pausa con selección por joystick ── */}
                <div style={{ display: "flex", gap: 12, padding: "14px 18px", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                  {[
                    { label: "▶ CONTINUAR",     col: th.accent,   bg: th.accent + "22", border: `1px solid ${th.accent}88` },
                    { label: "↩ MENÚ PRINCIPAL", col: "#888",     bg: "transparent",    border: "1px solid #444" },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onMouseEnter={() => { pauseSelRef.current = i; setPauseSel(i) }}
                      onClick={() => {
                        if (i === 0) { G.current.paused = false; setUi(u => ({ ...u, paused: false })) }
                        else if (i === 1) handleRestart()
                      }}
                      style={{
                        padding: "8px 20px",
                        background: pauseSel === i ? (item.bg === "transparent" ? "rgba(255,255,255,0.06)" : item.bg) : item.bg,
                        border: pauseSel === i ? `1px solid ${item.col}` : item.border,
                        color: item.col, fontFamily: "'Courier New', monospace",
                        fontSize: 12, letterSpacing: "0.2em",
                        cursor: "pointer", borderRadius: 6,
                        boxShadow: pauseSel === i ? `0 0 12px ${item.col}44` : "none",
                        position: "relative",
                      }}
                    >
                      {pauseSel === i && <span style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", fontSize: 10 }}>▶</span>}
                      <span style={{ marginLeft: pauseSel === i ? 10 : 0 }}>{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* ── Referencia de controles en pausa ── */}
                <div style={{ display: "flex", gap: 16, padding: "8px 18px 12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <CtrlHint action="pause"     label="reanudar" size={13} />
                  <CtrlHint action="map"       label="mapa" size={13} />
                  <CtrlHint action="teleport"  label="teletransporte" size={13} />
                  <CtrlHint action="confirm"   label="confirmar" size={13} />
                  <CtrlHint action="cancel"    label="atrás" size={13} />
                </div>
              </div>
            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════
            OVERLAY DE CONFIGURACIÓN
        ══════════════════════════════════════════════════ */}
        {showSettings && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9998,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
            fontFamily: "'Courier New', monospace",
          }}>
            <div style={{
              width: "min(680px, 96vw)", maxHeight: "90vh", overflowY: "auto",
              background: "#080C08", border: "1px solid #3A5A3A88",
              borderRadius: 12, boxShadow: "0 0 60px #00441122",
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #2A3A2A" }}>
                <span style={{ color: "#3A5A3A", fontSize: 10, letterSpacing: "0.3em" }}>// PROYECTO LULY</span>
                <span style={{ color: "#D4C400", fontSize: 14, letterSpacing: "0.35em", fontWeight: "bold" }}>⚙  CONFIGURACIÓN</span>
                <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", color: "#3A5A3A", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
              </div>

              {/* Sección: CONTROLES */}
              <div style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 9, color: "#4A7A4A", letterSpacing: "0.35em", marginBottom: 14 }}>
                  CONTROLES
                  {gpadConnected && <span style={{ marginLeft: 10, color: gpadType === "ps" ? "#5C8EF7" : "#1DB954", fontSize: 9 }}>
                    {gpadType === "ps" ? "● PlayStation detectado" : "● Xbox detectado"}
                  </span>}
                </div>

                {/* Tabla de controles */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
                  {[
                    { action: "move",     label: "Mover" },
                    { action: "jump",     label: "Saltar" },
                    { action: "shoot",    label: "Disparar" },
                    { action: "whip",     label: "Látigo" },
                    { action: "dash",     label: "Dash  ★" },
                    { action: "walljump", label: "Salto en pared  ★" },
                    { action: "run",      label: "Correr" },
                    { action: "interact", label: "Guardar checkpoint" },
                    { action: "teleport", label: "Teletransporte" },
                    { action: "map",      label: "Mapa" },
                    { action: "pause",    label: "Pausa" },
                  ].map(({ action, label }) => (
                    <div key={action} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 8px", borderRadius: 5, background: "rgba(255,255,255,0.03)" }}>
                      <BtnIcon action={action} size={20} />
                      <span style={{ fontSize: 11, color: "#7A9A7A", letterSpacing: "0.1em" }}>{label}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 8, color: "#2A4A2A", marginTop: 10 }}>★ = se desbloquea al derrotar al jefe correspondiente</p>
              </div>

              {/* Separador */}
              <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#2A4A2A,transparent)", margin: "0 20px" }} />

              {/* Sección: PANTALLA */}
              <div style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 9, color: "#4A7A4A", letterSpacing: "0.35em", marginBottom: 14 }}>PANTALLA</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Calidad gráfica */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "#7A9A7A", flex: 1 }}>Calidad gráfica</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["BAJA", "MEDIA", "ALTA"] as const).map((lbl, i) => (
                        <button
                          key={lbl}
                          onClick={() => { G.current.gfx = i as 0|1|2; (G.current as any)._gfxMsg = true; G.current.kennelMsg = 1.8 }}
                          style={{
                            padding: "4px 10px", fontFamily: "'Courier New',monospace", fontSize: 10,
                            background: G.current.gfx === i ? "#1A3A1A" : "transparent",
                            border: `1px solid ${G.current.gfx === i ? "#D4C400" : "#2A4A2A"}`,
                            color: G.current.gfx === i ? "#D4C400" : "#4A6A4A", cursor: "pointer", borderRadius: 4,
                          }}
                        >{lbl}</button>
                      ))}
                    </div>
                  </div>
                  {/* Pantalla completa */}
                  {!isTouchDevice && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "#7A9A7A", flex: 1 }}>Pantalla completa</span>
                      <button
                        onClick={() => { if (getFSElement() || isPseudoFS) exitFS(); else tryFullscreen(document.documentElement) }}
                        style={{
                          padding: "4px 14px", fontFamily: "'Courier New',monospace", fontSize: 10,
                          background: (getFSElement() || isPseudoFS) ? "#1A3A1A" : "transparent",
                          border: `1px solid ${(getFSElement() || isPseudoFS) ? "#D4C400" : "#2A4A2A"}`,
                          color: (getFSElement() || isPseudoFS) ? "#D4C400" : "#4A6A4A", cursor: "pointer", borderRadius: 4,
                        }}
                      >{(getFSElement() || isPseudoFS) ? "■ ACTIVA" : "□ INACTIVA"}</button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── DATOS GUARDADOS ── */}
              <div style={{ padding: "14px 20px 10px", borderTop: "1px solid #1A2A1A" }}>
                <div style={{ fontSize: 10, color: "#4A6A4A", letterSpacing: "0.2em", marginBottom: 10 }}>DATOS GUARDADOS</div>
                {!hasSave ? (
                  <div style={{ fontSize: 11, color: "#3A5A3A", fontStyle: "italic" }}>Sin datos guardados.</div>
                ) : !deleteConfirm ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "#7A9A7A", flex: 1 }}>Partida guardada activa</span>
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      style={{
                        padding: "4px 14px", fontFamily: "'Courier New',monospace", fontSize: 10,
                        background: "transparent", border: "1px solid #553333",
                        color: "#AA5555", cursor: "pointer", borderRadius: 4,
                      }}
                    >✕ BORRAR PARTIDA</button>
                  </div>
                ) : (
                  <div style={{ background: "#1A0A0A", border: "1px solid #553333", borderRadius: 6, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#FF7777", marginBottom: 8, letterSpacing: "0.05em" }}>
                      ⚠ ¿Borrar la partida guardada? Esta acción no se puede deshacer.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => { try { localStorage.removeItem(SAVE_KEY) } catch(_){} setHasSave(false); setDeleteConfirm(false) }}
                        style={{
                          padding: "5px 16px", fontFamily: "'Courier New',monospace", fontSize: 10,
                          background: "#3A0A0A", border: "1px solid #AA3333",
                          color: "#FF5555", cursor: "pointer", borderRadius: 4,
                        }}
                      >SÍ, BORRAR</button>
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        style={{
                          padding: "5px 16px", fontFamily: "'Courier New',monospace", fontSize: 10,
                          background: "transparent", border: "1px solid #2A4A2A",
                          color: "#7A9A7A", cursor: "pointer", borderRadius: 4,
                        }}
                      >CANCELAR</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── DEV — CELULAR (solo en dispositivos táctiles) ── */}
              {isTouchDevice && (
                <div style={{ padding: "14px 20px 10px", borderTop: "1px solid #1A2A1A" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                    <span style={{ fontSize:9, color:"#AA8800", letterSpacing:"0.3em" }}>DEV — CELULAR</span>
                    <span style={{ fontSize:8, color:"#554400", letterSpacing:"0.1em" }}>(solo para pruebas)</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:11, color:"#7A9A7A", flex:1 }}>Tipo de D-PAD</span>
                    <div style={{ display:"flex", gap:6 }}>
                      {(["cross","joystick"] as const).map(mode => (
                        <button key={mode}
                          onClick={() => {
                            setDpadMode(mode)
                            try { localStorage.setItem("luly_dev_dpad", mode) } catch(_) {}
                          }}
                          style={{
                            padding:"4px 12px", fontFamily:"'Courier New',monospace", fontSize:10,
                            background: dpadMode === mode ? "#1A2800" : "transparent",
                            border:`1px solid ${dpadMode === mode ? "#AA8800" : "#2A4A2A"}`,
                            color: dpadMode === mode ? "#D4C400" : "#4A6A4A",
                            cursor:"pointer", borderRadius:4,
                          }}
                        >{mode === "cross" ? "D-CROSS" : "JOYSTICK"}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ padding: "10px 20px 16px", display: "flex", justifyContent: "center", gap: 12, borderTop: "1px solid #1A2A1A" }}>
                <CtrlHint action="cancel" label="cerrar" size={14} />
                <button onClick={() => { setShowSettings(false); setDeleteConfirm(false) }} style={{ padding: "8px 24px", background: "#1A3A1A", border: "1px solid #3A6A3A", color: "#D4C400", fontFamily: "'Courier New',monospace", fontSize: 12, letterSpacing: "0.2em", cursor: "pointer", borderRadius: 6 }}>
                  ✓  LISTO
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Game Over ── aparece una vez que el fade llega a ~70% ── */}
        {screen === "playing" && ui.over && G.current.overFade > 0.6 && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)"
          }}>
            <div style={{
              textAlign: "center", padding: "36px 40px", borderRadius: 14,
              background: "#0A0000", border: "1px solid #5A0000",
              boxShadow: "0 0 80px #FF000044, 0 0 200px #60000033",
              maxWidth: 360, width: "90vw", fontFamily: "'Courier New', monospace"
            }}>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>☠</div>
              <h2 style={{ fontSize: 28, fontWeight: "bold", color: "#FF3333", letterSpacing: "0.15em", margin: "0 0 8px" }}>GAME OVER</h2>
              <p style={{ fontSize: 12, color: "#AA7700", margin: "0 0 4px" }}>Luly ha caído… pero él no se rinde.</p>
              <p style={{ fontSize: 11, color: "#553300", margin: "0 0 24px" }}>puntuación: {ui.score}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {hasSave && (
                  <button onClick={handleContinueFromSave} style={{
                    padding: "12px 20px", border: "1px solid #AA5500", color: "#FFAA44",
                    background: "#1A0800", fontFamily: "inherit", fontSize: 13,
                    letterSpacing: "0.1em", borderRadius: 6, cursor: "pointer"
                  }}>★ CONTINUAR desde guardado</button>
                )}
                <button onClick={handlePlayAgain} style={{
                  padding: "9px 20px", border: "1px solid #550000", color: "#FF4444",
                  background: "#0D0000", fontFamily: "inherit", fontSize: 12,
                  letterSpacing: "0.1em", borderRadius: 6, cursor: "pointer"
                }}>[ REINTENTAR desde el inicio ]</button>
                <button onClick={handleRestart} style={{
                  padding: "9px 20px", border: "1px solid #333", color: "#666",
                  background: "transparent", fontFamily: "inherit", fontSize: 11,
                  letterSpacing: "0.1em", borderRadius: 6, cursor: "pointer"
                }}>[ MENÚ PRINCIPAL ]</button>
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
              <p className="text-gray-400 font-mono text-sm mb-3">La resistencia perruna ha triunfado.</p>
              <p className="text-yellow-500 font-mono font-bold mb-5">score_final: {ui.score}</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={handlePlayAgain} className="px-5 py-2 border border-yellow-700 text-yellow-400 font-mono hover:bg-yellow-900 transition-colors">[ JUGAR DE NUEVO ]</button>
                <button onClick={handleRestart} className="px-5 py-2 border border-gray-700 text-gray-400 font-mono hover:bg-gray-800 transition-colors">[ MENÚ ]</button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
