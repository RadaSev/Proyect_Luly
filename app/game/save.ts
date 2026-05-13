// ══════════════════════════════════════════════════════════════
//  SISTEMA DE GUARDADO — game/save.ts
// ══════════════════════════════════════════════════════════════
import type { G } from "./types"
import { SAVE_KEY } from "./constants"

export interface LulySave {
  version: 2; savedAt: number; score: number; lives: number; kills: number
  hp: number; maxHp: number; ammo: number; tballAmmo: number
  checkpoint: { w: number; x: number; y: number }
  dead: string[]; explored: string[]; discoveredCPs: string[]
  cw: number[]; abilities: string[]
  pickedUpItems: string[]             // IDs de pickups recogidos
  bossRewardedCPs: string[]           // IDs de boss-CPs que ya dieron recompensa
  viejoDogState?: string
  tballKeyHeld?: boolean
  questKillBaseline?: number
  rexBallFirstSeen?: boolean
  rexIntroLeft?: boolean
  rexBatonHeld?: boolean
  tballUpgraded?: boolean
  rexBatonDeliveredSeen?: boolean
  rexUltraDoneSeen?: boolean
  p1BossRexSeen?: boolean
  p2BossRexSeen?: boolean
  ultraBossRexSeen?: boolean
  rexSection2Notified?: boolean
  rexUltraGaveItems?: boolean
  croquetas?: number
  bolkhaAppearedOnce?: boolean
  bolkhaRexTold?: boolean
  bolkhaMetDialogSeen?: boolean
  rexKeyAnimTimer?: number
}

export function saveGame(g: G): void {
  try {
    const s: LulySave = {
      version: 2, savedAt: Date.now(), score: g.score, lives: g.lives, kills: g.kills,
      hp: g.pl.hp, maxHp: g.pl.maxHp, ammo: g.pl.ammo, tballAmmo: g.tballAmmo,
      checkpoint: { ...g.checkpoint },
      dead: [...g.dead], explored: [...g.explored],
      discoveredCPs: [...g.discoveredCPs], cw: [...g.cw], abilities: [...g.abilities],
      pickedUpItems: g.pickups.filter(p => !p.active).map(p => p.id),
      bossRewardedCPs: [...g.bossRewardedCPs],
      viejoDogState: g.viejoDogState,
      tballKeyHeld: g.tballKeyHeld,
      questKillBaseline: g.questKillBaseline,
      rexBallFirstSeen: g.rexBallFirstSeen,
      rexIntroLeft: g.rexIntroLeft,
      rexBatonHeld: g.rexBatonHeld,
      tballUpgraded: g.tballUpgraded,
      rexBatonDeliveredSeen: g.rexBatonDeliveredSeen,
      rexUltraDoneSeen: g.rexUltraDoneSeen,
      p1BossRexSeen: g.p1BossRexSeen,
      p2BossRexSeen: g.p2BossRexSeen,
      ultraBossRexSeen: g.ultraBossRexSeen,
      rexSection2Notified: g.rexSection2Notified,
      rexUltraGaveItems: g.rexUltraGaveItems,
      croquetas: g.croquetas,
      bolkhaAppearedOnce: g.bolkhaAppearedOnce,
      bolkhaRexTold: g.bolkhaRexTold,
      bolkhaMetDialogSeen: g.bolkhaMetDialogSeen,
      rexKeyAnimTimer: g.rexKeyAnimTimer,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch (_) {}
}

export function loadSaveData(): LulySave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as LulySave
    return s.version === 2 ? s : null
  } catch (_) { return null }
}
