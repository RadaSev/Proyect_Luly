// ══════════════════════════════════════════════════════════════
//  GAME LOOP — game/tick.ts
//  tick(): función principal del loop de juego
// ══════════════════════════════════════════════════════════════
import type { G } from "./types"
import { tickPlayer } from "./player"
import { tickEnemies } from "./enemies"
import { tickProjs, tickWhip, tickBones, tickDrops, tickBossArenaPlats, tickToolMounds } from "./physics"
import { tickTBalls, tickPickups } from "./player_tball"
import { tickViejoDog } from "./npc_rex"
import { tickBolkha } from "./npc_bolkha"
import { tickCamera, tickWorldAnim } from "./init"
import { tickSparks, tickShake } from "./utils"
import { tickCheckpoints } from "./checkpoints"
import { _rexTypingActive, _rexYesNoActive } from "./npc_rex"

export function tick(g: G) {
  if (g.tpAnim && g.tpAnim.phase === 0) { tickCheckpoints(g); return }  // congelar juego durante fade-out
  const now = performance.now()
  // Bloqueo TOTAL durante diálogos de 2 páginas de Rex — va ANTES de tickPlayer
  if (_rexTypingActive) {
    // Selector Sí/No: leer cursor ANTES de limpiar teclas de movimiento
    if (_rexYesNoActive) {
      if (g.keys["arrowleft"] || g.keys["a"])  g.rexReadyCursor = 0
      if (g.keys["arrowright"] || g.keys["d"]) g.rexReadyCursor = 1
    }
    // Movimiento
    g.keys["arrowleft"] = false;  g.keys["a"] = false
    g.keys["arrowright"] = false; g.keys["d"] = false
    g.keys["arrowup"] = false;    g.keys["w"] = false
    g.keys["arrowdown"] = false;  g.keys["s"] = false
    g.keys[" "] = false           // saltar
    g.keys["shift"] = false       // dash
    g.keys["control"] = false     // correr
    // Combate
    g.keys["n"] = false           // disparo T-ball
    g.keys["m"] = false           // látigo / parry
    g.keys["v"] = false           // hueso
    g.keys["t"] = false           // teleport
    // g.keys["e"] se preserva — es la tecla para avanzar la página del diálogo
    // Limpiar velocidad y estado de movimiento
    g.pl.vx = 0
    g.pl.crouching = false
  }
  tickPlayer(g); tickEnemies(g, now); tickProjs(g); tickTBalls(g); tickPickups(g); tickViejoDog(g); tickBolkha(g); tickWhip(g); tickBones(g)
  // Durante el diálogo de Rex los drops quedan congelados (no expiran ni se pueden recoger)
  if (!_rexTypingActive) tickDrops(g)
  tickCamera(g); tickWorldAnim(g); tickSparks(g); tickShake(g); tickCheckpoints(g); tickBossArenaPlats(g, 0); tickToolMounds(g)
}
