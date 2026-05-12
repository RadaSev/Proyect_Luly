# Backup — Lógica de Combate Original (pre-sync)

> Guardado antes de implementar "frames activos" y "attack lock por animación".
> Restaurar estos bloques si se necesita volver al comportamiento original para pruebas.

---

## 1. Ataque con hueso del jugador — `app/game/player.ts`

Buscar la sección `// ── Ataque con hueso (N)` y reemplazar el bloque completo con:

```typescript
if (k["n"] && p.ammo > 0 && !inRexPeaceZone) {
  const mkP = () => { const d = getDir(g); const px = p.x + (p.facing === 1 ? p.w : 0), py = p.y + p.h / 2; g.projs.push({ x: px, y: py, vx: d.x * PSPD, vy: d.y * PSPD - 1, active: true, pl: true, star: false, rot: Math.atan2(d.y, d.x) * 180 / Math.PI, life: 3.5, dist: 0, ox: px, oy: py }); p.ammo-- }
  if (!p.sh) { mkP(); p.ls = now; p.as2 = now; p.sh = true; p.pa = p.facing === 1 ? "atack_bone" : "atack_bone_left" }
  else if (now - p.as2 > 2500) { mkP(); p.as2 = now; p.pa = p.facing === 1 ? "atack_bone" : "atack_bone_left" }
  else { p.pa = p.facing === 1 ? "atack_bone" : "atack_bone_left" }  // mantiene mientras se sostiene N
} else if (!inRexPeaceZone && !k["n"]) p.sh = false
else if (inRexPeaceZone) p.sh = false
```

---

## 2. Ataque con látigo del jugador — `app/game/player.ts`

```typescript
p.wcd = Math.max(0, p.wcd - STEP * 1000)
if (k["m"] && !p.wh && p.wcd <= 0 && !g.whip && !p.exhausted && !inRexPeaceZone) {
  const d = getDir(g); const cx = p.x + p.w / 2, cy = p.y + p.h / 2
  g.whip = { x: cx, y: cy, ex: cx + d.x * WLEN, ey: cy + d.y * WLEN, life: 0.2, dealt: false }
  p.stamina = Math.max(0, p.stamina - 18)
  if (p.stamina <= 0) { p.exhausted = true; p.staminaCooldown = 4.5 }
  p.wcd = 500; p.wh = true; p.pa = p.facing === 1 ? "atack_correa" : "atack_correa_left"
}
if (!k["m"]) p.wh = false
// Mantiene la animación de correa mientras el látigo sigue activo (life=0.2s)
if (g.whip) p.pa = p.facing === 1 ? "atack_correa" : "atack_correa_left"
```

> Para restaurar: quitar la línea `p.atkLock = Math.max(p.atkLock, 0.45)` del bloque del látigo.

---

## 3. Ataque genérico de enemigos — `app/game/enemies.ts`

Buscar el bloque `} else {` que está después del bloque `isW1P2Boss(e)` y contiene el "Ataque genérico":

```typescript
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
```

---

## Notas de diseño

| Campo nuevo | Tipo | Dónde | Descripción |
|---|---|---|---|
| `p.atkLock` | `number` (seg) | Player | Countdown que impide disparar hasta que la animación avanza lo suficiente |
| `e.atkPending` | `boolean` | Enemy | El ataque se decidió pero el proyectil no se lanzó aún (windup activo) |

### Timing de referencia
- Animación de ataque jugador: ~25 frames × ~36ms/frame ≈ 900ms total
- `ATK_LOCK_S = 0.45` → lock de 450ms ≈ mitad de animación
- Windup enemigo: `WINDUP_MS = 300` → projectil sale 300ms después de que el enemigo decide atacar
- `e.sa = WINDUP_MS + 300 = 600ms` total → 300ms windup + 300ms post-ataque visble
