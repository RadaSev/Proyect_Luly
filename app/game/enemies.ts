// ══════════════════════════════════════════════════════════════
//  ENEMIGOS — game/enemies.ts
//  tickEnemies: IA, patrones de combate, jefes
// ══════════════════════════════════════════════════════════════
import type { G, Enemy } from "./types"
import {
  STEP, EW, EH, EN_HBX, EN_HBT, NC, NR, RW, RH, WT, DW, DH, NW, TOT_W, TOT_H,
  WALK, JV, GDN, GUP, GMAX,
  W1P1_BW, W1P1_BH, WHIP1_REACH, WHIP2_REACH, WHIP1_DMG, WHIP2_DMG, WHIP1_CD, WHIP2_CD,
  WHIP_KB_VX, WHIP_KB_VY,
  W1P2_BW, W1P2_BH, SLAM_REACH, SLAM_KB_VY, SLAM_DMG, SLAM_CD, SLAM_CD_CLOSE, SLAM_CLOSE_DIST,
  SPIN_DURATION, SPIN_STUN, SPIN_DMG, SPIN_RADIUS, SPIN_CD,
  CHAIN_REACH, MOUND_W, MOUND_H, KENNEL_R, KENNEL_ROOMS,
  TRANSIT_BOSS_COL, TROW, WORLD_P1_BOSS, WORLD_P2_BOSS, PW, PH, PL_HBX, PL_HBT,
  JUMP_H, ro, PLAYER_START
} from "./constants"
import { computeDoors, getEnemySpawns, isBossRoom, getRoomChannelBounds } from "./world_gen"
import {
  activePlats, resolve, dmgPlayer, dmgEnemy, spawnBossArenaPlats, spawnToolMounds, launchToolsFromMound, isSpawnDead,
  getShaftRangesX, isInShaft, voidAhead, getSafeSpawnRangesX,
  isW1P1Boss, isW1P2Boss, enemySection,
} from "./physics"
import { spawnExplosion, triggerShake } from "./utils"

export function tickEnemies(g: G, now: number) {
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
    if (g.noEnemies && !e.boss) continue  // noEnemies: solo tickean bosses

    // ── Caída pre-muerte (murió en el aire → toca suelo primero) ────
    if (e.deathFalling) {
      e.vy += e.vy < 0 ? GUP : GDN; if (e.vy > GMAX) e.vy = GMAX
      const ehx = e.x + EN_HBX, ehy = e.y + EN_HBT, ehw = e.w - 2 * EN_HBX, ehh = e.h - EN_HBT
      const res = resolve(ehx, ehy, ehw, ehh, 0, e.vy, g)
      e.x = res.x - EN_HBX; e.y = res.y - EN_HBT; e.vy = res.vy
      if (res.og) {
        // Tocó el suelo → pequeño impacto y empezar animación de muerte real
        spawnExplosion(g, e.x + e.w / 2, e.y + e.h / 2, ["#CC4400", "#FF6600", "#FFAA44", "#FFFFFF"], 7, 2.5, false)
        e.deathFalling = false
        e.dying = true; e.deathTimer = 0
      }
      continue
    }

    // ── Animación de muerte ──────────────────────────────────────────
    if (e.dying) {
      e.eft += dt
      const deathFrameMax = e.boss ? 24 : 15
      if (e.eft > 75) { e.ef = Math.min(e.ef + 1, deathFrameMax); e.eft = 0 }
      e.deathTimer += STEP
      // Sin gravedad: el sprite de muerte ya los muestra caídos en el piso.
      // Primero debe completar la animación (ef=max), LUEGO esperar 0.6s de fade.
      const deathAnimEnd = deathFrameMax * 0.075  // segundos para completar animación (75ms/frame)
      if (e.ef >= deathFrameMax && e.deathTimer > deathAnimEnd + 0.6) e.active = false
      continue
    }

    if (e.world !== pWorld) continue
    const eCol = Math.floor((e.x % (NC * RW)) / RW), eRow = Math.floor(e.y / RH)
    if (Math.abs(eCol - pCol) > 4 || Math.abs(eRow - pRow) > 3) continue

    // ── Animación de frame ───────────────────────────────────────────
    const frameSp = e.hurtTimer > 0 ? 55 : 90
    const frameMax = e.boss ? 25 : 16
    e.eft += dt; if (e.eft > frameSp) { e.ef = (e.ef + 1) % frameMax; e.eft = 0 }
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
      // Adoptar rango de la sala actual como nuevo cubículo de patrulla
      const _cr = eRoom(e); const _crR = getSafeSpawnRangesX(_cr.w, _cr.c, _cr.r, e.w)
      if (_crR.length > 0) { e.p0 = _crR[0].x0; e.p1 = _crR[_crR.length - 1].x1 }
    }
    // Si el jugador salió de la sala, parar la persecución inmediatamente
    if (!plSameRoom && e.state === "chase") {
      e.alert = false; e.alertT = 0; e.state = "patrol"
      // Adoptar rango de la sala actual como nuevo cubículo de patrulla
      const _cr2 = eRoom(e); const _crR2 = getSafeSpawnRangesX(_cr2.w, _cr2.c, _cr2.r, e.w)
      if (_crR2.length > 0) { e.p0 = _crR2[0].x0; e.p1 = _crR2[_crR2.length - 1].x1 }
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
      // W1P2: una vez cerrada la arena el boss NO resetea a patrol aunque el jugador
      // suba fuera de la fila del cuarto (las plataformas laterales cruzan la fila de arriba).
      const w1p2ArenaLocked = isW1P2Boss(e) && g.bossArenaLocked.has(e.world + 10)
      if (!plSameRoom && !w1p2ArenaLocked) {
        // ── Boss inactivo: snap al centro de la sala (no caminar → las paredes flotantes bloquean) ──
        const hr2 = homeRoom(e)
        const { x: bx0, y: by0 } = ro(hr2.w, hr2.c, hr2.r)
        const centerX = bx0 + Math.floor(RW / 2) - Math.floor(e.w / 2)
        e.x = centerX   // snap directo, sin física
        e.vx = 0
        targetVx = 0
        e.dir = 1
        e.state = "patrol"

        // ── Reset completo cuando el jugador no está en la sala ──────────────
        // Es seguro aquí: no hay ataque en curso (playerNotInRoom → sin chainHit activo)
        // Así el jefe vuelve a HP completo y estados limpios para la próxima entrada.
        if (e.hp < e.mhp) {
          e.hp = e.mhp
          e.phase = 1   // fase 1 de inicio (no rage)
          e.sa = 0; e.hurtTimer = 0
          e.spinTimer = 0; e.stunTimer = 0; e.chainHit = null
          e.ls = 0; e.ls2 = 0; e.ef = 0; e.eft = 0
          e.y = by0 + RH - WT - e.h   // reposicionar en el suelo de su sala
        }
      } else {
        // ── Boss activo (mismo cuarto, o arena W1P2 ya cerrada): perseguir al jugador ─
        if (e.state !== "chase") {
          e.state = "chase"
          // W1P1 shake de entrada; W1P2 shake solo la primera vez (antes del cierre de arena)
          if (!isW1P1Boss(e) && !isW1P2Boss(e)) triggerShake(g, 10, 0.45)
          // Cerrar la arena del jefe P1 al entrar en combate
          if (isW1P1Boss(e) && !g.bossArenaLocked.has(e.world)) {
            g.bossArenaLocked.add(e.world)
            triggerShake(g, 6, 0.4)
            const hr3 = homeRoom(e)
            spawnBossArenaPlats(g, hr3.w, hr3.c, hr3.r)
          }
          if (isW1P2Boss(e) && !g.bossArenaLocked.has(e.world + 10)) {
            g.bossArenaLocked.add(e.world + 10)
            triggerShake(g, 8, 0.5)
            spawnToolMounds(g, e)
            e.ls2 = now   // iniciar timer de rage-walk desde que empieza el combate
          }
        }
        if (dist > 40) targetVx = (dx > 0 ? 1 : -1) * (e.spd * (dist < sight * 0.4 ? 1.8 : 1.35))
        e.dir = dx > 0 ? 1 : -1
        // W1P1 y W1P2 no saltan; W1P2 tampoco se mueve durante spin/stun
        if (!isW1P1Boss(e) && !isW1P2Boss(e)) {
          const playerAbove = plFloor !== null && plFloor < e.y + e.h - 60 && p.onGround
          const playerBelow = p.onGround && p.y + p.h > e.y + e.h + 40
          if (playerAbove && eOnGround2 && e.jumpCd <= 0) { e.vy = JV * 0.9; e.jumpCd = 1400 }
          if (playerBelow && eOnGround2) { e.y += 4; (e as any).onGround = false }
        }
        // W1P2: parar durante stun y durante slam (atack_1 no tiene frames de caminata)
        if (isW1P2Boss(e) && (e.stunTimer > 0 || (e.sa > 0 && e.spinTimer <= 0))) {
          targetVx = 0
          e.vx = 0
        }
        // W1P2 giro: movimiento sólo en frames 6-15 del ciclo de 25
        //   frames  0-5  → quieto (preparación)
        //   frames  6-15 → avanza (giro visible)
        //   frames 16-24 → quieto (espera segundo movimiento)
        if (isW1P2Boss(e) && e.spinTimer > 0 && (e.ef < 6 || e.ef >= 16)) {
          targetVx = 0
          e.vx = 0
        }
      }

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
        // En persecución: ignorar límites del cubículo original (e.p0/e.p1)
        targetVx = chaseDir * e.spd * 1.4
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

    // ── Transición de fase del boss (50% HP → fase 2: Rage_Walk + Atack_2) ──
    if (e.boss && e.phase === 1 && e.state === "chase" && e.hp <= Math.ceil(e.mhp * 0.5) && !e.dying) {
      e.phase = 2
      e.spd *= 1.5; e.cd = Math.floor(e.cd * 0.55)
      if (!isW1P2Boss(e)) triggerShake(g, 12, 0.55)  // W1P2: sin shake dentro de la arena
      spawnExplosion(g, e.x + e.w / 2, e.y + e.h / 2, ["#FF0000", "#FF8800", "#FFFF00", "#FFFFFF", "#FF4400"], 24, 6, true)
      if (isW1P2Boss(e)) e.ls2 = now  // reiniciar rage-walk al entrar en fase 2
    }

    // ── Disparo / Ataques ────────────────────────────────────────────
    const canShoot = e.boss
      ? (e.state === "chase" && dist < sight)   // boss solo ataca cuando está activo (jugador en sala)
      : (plSameRoom && canSee && e.state === "chase" && e.alertDelay <= 0)

    // ── W1 Second Section: ataques específicos de cadena y rayo ─────
    const isW1S2 = e.world === 0 && enemySection(e) === "s"
    if (isW1S2 && !e.boss) {
      const damagePct = (e.mhp - e.hp) / e.mhp   // 0=lleno, 1=muerto
      const useAtk2   = damagePct >= 0.60          // ≥60% daño recibido → rayo

      if (!useAtk2) {
        // ── Ataque 1: Golpe de cadena (melee) — cada 500ms ───────────
        const ATK1_CD = 500
        if (now - e.ls > ATK1_CD && canShoot && dist < CHAIN_REACH + 30) {
          e.chainHit = { dir: e.dir, life: 0.22, dealt: false }
          e.ls = now; e.sa = 220
        }
      } else {
        // ── Ataque 2: Rayo — cada 2000ms ─────────────────────────────
        const ATK2_CD = 2000
        if (now - e.ls2 > ATK2_CD && canShoot) {
          const ex2 = e.x + e.w / 2, ey2 = e.y + e.h * 0.4
          const pdx  = (p.x + p.w / 2 + p.vx * 0.3) - ex2
          const pdy  = (p.y + p.h / 2 + p.vy * 0.3) - ey2
          const plen = Math.sqrt(pdx * pdx + pdy * pdy) || 1
          g.projs.push({
            x: ex2, y: ey2,
            vx: (pdx / plen) * 3.8, vy: (pdy / plen) * 3.8,
            active: true, pl: false, star: false,
            rot: Math.atan2(pdy, pdx) * 180 / Math.PI,
            life: 3.5, dist: 0, ox: ex2, oy: ey2,
            lightning: true
          })
          triggerShake(g, 3, 0.14)
          e.ls2 = now; e.sa = 400
        }
      }

      // ── Tick del chain hit (W1S2): daño y vida ───────────────────
      if (e.chainHit) {
        e.chainHit.life -= STEP
        if (!e.chainHit.dealt) {
          const cDir  = e.chainHit.dir
          const cX    = cDir > 0 ? (e.x + e.w) : (e.x - CHAIN_REACH)
          const cY    = e.y + e.h * 0.25
          const cW2   = CHAIN_REACH, cH2 = e.h * 0.55
          const phx2  = p.x + PL_HBX, phy2 = p.y + PL_HBT
          const phw2  = p.w - 2 * PL_HBX, phh2 = p.h - PL_HBT
          if (phx2 < cX + cW2 && phx2 + phw2 > cX && phy2 < cY + cH2 && phy2 + phh2 > cY) {
            if (p.inv <= 0) { dmgPlayer(g, 1); e.chainHit.dealt = true }
          }
        }
        if (e.chainHit.life <= 0) e.chainHit = null
      }

    } else if (isW1P1Boss(e)) {
      // ── Jefe W1 Primera Sección: ataque de látigo (sin proyectiles) ─
      const whipCD    = e.phase >= 2 ? WHIP2_CD   : WHIP1_CD
      const whipReach = e.phase >= 2 ? WHIP2_REACH : WHIP1_REACH
      const whipDmg   = e.phase >= 2 ? WHIP2_DMG  : WHIP1_DMG
      const whipLife  = 0.45  // segundos que dura el hitbox del látigo
      const whipSa    = 500   // ms de animación de ataque visible

      // Lanzar ataque si está en cooldown, el jugador está al alcance y no hay uno activo
      if (!e.chainHit && now - e.ls > whipCD && canShoot && dist < whipReach + e.w + 20) {
        e.chainHit = { dir: e.dir, life: whipLife, dealt: false }
        e.ls = now; e.sa = whipSa
        // Sin shake periódico — solo el impacto en el jugador produce efecto visual
      }

      // Tick del látigo: ventana de daño y knockback
      if (e.chainHit) {
        e.chainHit.life -= STEP
        if (!e.chainHit.dealt) {
          // Hitbox: desde el frente del hitbox del boss, extiende 'whipReach' hacia adelante
          const wDir = e.chainHit.dir
          const wX   = wDir > 0 ? (e.x + e.w) : (e.x - whipReach)
          const wY   = e.y + e.h * 0.05
          const wW   = whipReach, wH = e.h * 0.9
          const phx2 = p.x + PL_HBX, phy2 = p.y + PL_HBT
          const phw2 = p.w - 2 * PL_HBX, phh2 = p.h - PL_HBT
          if (phx2 < wX + wW && phx2 + phw2 > wX && phy2 < wY + wH && phy2 + phh2 > wY) {
            if (p.inv <= 0) {
              dmgPlayer(g, whipDmg)
              // Repulsar al jugador en dirección opuesta al látigo
              const kbDir = wDir  // el látigo viene de este lado, el jugador sale por el mismo lado
              p.vx = kbDir * WHIP_KB_VX
              p.vy = WHIP_KB_VY
              e.chainHit.dealt = true
            }
          }
        }
        if (e.chainHit.life <= 0) e.chainHit = null
      }

    } else if (isW1P2Boss(e)) {
      // ── Jefe W1 Segunda Sección: golpe de piso + giro de martillo ──

      // ── 1. Tick del giro (spinTimer) ──────────────────────────────────
      if (e.spinTimer > 0) {
        e.spinTimer -= STEP
        // Daño al jugador en radio de giro
        const scx = e.x + e.w / 2, scy = e.y + e.h / 2
        const sdx = (p.x + p.w / 2) - scx, sdy = (p.y + p.h / 2) - scy
        if (Math.sqrt(sdx * sdx + sdy * sdy) < SPIN_RADIUS + e.w / 2 && p.inv <= 0) {
          dmgPlayer(g, SPIN_DMG)
          p.vx = sdx > 0 ? 4 : -4   // empujar hacia fuera
        }
        // Golpear montículos durante el giro (solo uno por iteración)
        if (!e.spinHitMound) {
          const nearMound = g.toolMounds.find(m => m.active &&
            Math.abs((m.x + m.w / 2) - (e.x + e.w / 2)) < SPIN_RADIUS + e.w / 2 + m.w / 2 &&
            Math.abs((m.y + m.h / 2) - (e.y + e.h / 2)) < e.h * 0.8
          )
          if (nearMound) {
            nearMound.active = false
            e.spinHitMound = true
            launchToolsFromMound(g, nearMound, e.dir)
            spawnExplosion(g, nearMound.x + nearMound.w / 2, nearMound.y, ["#FF6600", "#FFAA00", "#CC8800", "#FF4400", "#DDDDDD"], 24, 6.0)
            // sin shake — después de cerrar la arena ya no vibra nada
          }
        }
        if (e.spinTimer <= 0) {
          // Fin del giro → parálisis 3 s (vulnerable)
          e.stunTimer = SPIN_STUN
          e.spinTimer = 0
          e.sa = 0
          spawnExplosion(g, e.x + e.w / 2, e.y + e.h / 2, ["#FF6600", "#FFAA00", "#FF0000"], 10, 3.5)
          // sin shake post-giro
        }

      // ── 2. Tick del stun post-giro ─────────────────────────────────────
      } else if (e.stunTimer > 0) {
        e.stunTimer -= STEP
        if (e.stunTimer <= 0) {
          // Stun terminó → comenzar caminata de rage (resetear timer de rage walk)
          e.stunTimer = 0
          e.ls2 = now
        }

      // ── 3. Decisión de ataque (solo si puede disparar y no está en stun/giro) ──
      } else if (canShoot) {
        // Cooldown del slam: más corto cuando está cerca
        const activeSlamCD = dist < SLAM_CLOSE_DIST ? SLAM_CD_CLOSE : SLAM_CD
        const canSlam = now - e.ls > activeSlamCD && dist < SLAM_REACH + e.w + 30
        // El giro siempre sigue a la caminata de rage (fase 2): tras SPIN_CD ms caminando, girar
        const canSpin = e.phase >= 2 && now - e.ls2 > SPIN_CD

        if (canSpin) {
          // Siempre después de caminata rage: iniciar 2 ciclos completos (25 fr × 2 × 90 ms = 4500 ms)
          e.spinTimer = SPIN_DURATION
          e.spinHitMound = false
          e.ef = 0; e.eft = 0
          e.sa = Math.ceil(SPIN_DURATION * 1000)
        } else if (canSlam) {
          // Slam de piso: hitbox activado a mitad de animación
          e.chainHit = null
          e.ls = now; e.sa = 2500; e.ef = 0; e.eft = 0
        }
      }

      // ── 4. Activar hitbox del slam a mitad de animación (~1200 ms restantes) ──
      if (e.sa > 0 && e.sa <= 1200 && e.spinTimer <= 0 && e.stunTimer <= 0 && e.chainHit === null && !e.dying) {
        e.chainHit = { dir: e.dir, life: 0.40, dealt: false }
        spawnExplosion(g, e.x + (e.dir >= 0 ? e.w + SLAM_REACH * 0.5 : -SLAM_REACH * 0.5), e.y + e.h, ["#FF6600", "#FFAA00", "#FFFFFF"], 12, 3.5)
        // sin shake — ya no vibra nada después de cerrarse la arena
      }

      // ── 5. Tick del hitbox del slam ────────────────────────────────────
      if (e.chainHit && e.spinTimer <= 0) {
        e.chainHit.life -= STEP
        if (!e.chainHit.dealt) {
          const sDir  = e.chainHit.dir
          const sX    = sDir > 0 ? (e.x + e.w) : (e.x - SLAM_REACH)
          const sY    = e.y + e.h * 0.6   // zona baja (golpe al suelo)
          const sW2   = SLAM_REACH, sH2 = e.h * 0.45
          const phx2  = p.x + PL_HBX, phy2 = p.y + PL_HBT
          const phw2  = p.w - 2 * PL_HBX, phh2 = p.h - PL_HBT
          if (phx2 < sX + sW2 && phx2 + phw2 > sX && phy2 < sY + sH2 && phy2 + phh2 > sY) {
            if (p.inv <= 0) {
              dmgPlayer(g, SLAM_DMG)
              p.vy = SLAM_KB_VY
              p.onGround = false
              e.chainHit.dealt = true
            }
          }
        }
        if (e.chainHit.life <= 0) e.chainHit = null
      }

    } else {
      // ── Ataque genérico (resto de enemigos + otros bosses) ────────
      if (now - e.ls > e.cd && canShoot) {
        const sp = e.boss ? (e.phase === 2 ? 4.2 : 3.2) : 2.8
        const ex2 = e.x + e.w / 2, ey2 = e.y + e.h / 2
        const LEAD = e.boss ? 0.5 : 0.38
        const pdx = (p.x + p.w / 2 + p.vx * LEAD) - ex2
        const pdy = (p.y + p.h / 2 + p.vy * LEAD) - ey2
        const plen = Math.sqrt(pdx * pdx + pdy * pdy) || 1
        g.projs.push({ x: ex2, y: ey2, vx: (pdx / plen) * sp, vy: (pdy / plen) * sp, active: true, pl: false, star: false, rot: Math.atan2(pdy, pdx) * 180 / Math.PI, life: 3.5, dist: 0, ox: ex2, oy: ey2 })
        if (e.boss) {
          const numRadial = e.phase === 2 ? 12 : 8
          for (let a = 0; a < numRadial; a++) {
            const rad = a * Math.PI * 2 / numRadial, bx = ex2, by = ey2
            const rsp = e.phase === 2 ? 3.0 : 2.2
            g.projs.push({ x: bx, y: by, vx: Math.cos(rad) * rsp, vy: Math.sin(rad) * rsp, active: true, pl: false, star: true, rot: a * (360 / numRadial), life: 4, dist: 0, ox: bx, oy: by })
          }
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
    }
    if (e.sa > 0) e.sa -= dt

    // ── Daño por contacto ─────────────────────────────────────────────
    // El jefe W1P1 no inflige daño por contacto — sólo a través del látigo
    if (e.hurtTimer <= 0 && !isW1P1Boss(e) && !isW1P2Boss(e)) {
      const ecx = e.x + EN_HBX, ecy = e.y + EN_HBT, ecw = e.w - 2 * EN_HBX, ech = e.h - EN_HBT
      if (p.inv <= 0 && phx < ecx + ecw && phx + phw > ecx && phy < ecy + ech && phy + phh > ecy) dmgPlayer(g, 1)
    }
  }

  g.enemies = g.enemies.filter(e => e.active)
}

