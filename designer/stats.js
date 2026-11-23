const MOD_STATS = { fire: 'fire', dmg: 'dmg', hard: 'hard', mag: 'mag', ammo: 'ammo', reload: 'reload', equip: 'equip', range: 'ramp', resupply: 'resupply' };

export function effective(t, mods, useMods) {
  const w = { ...t, playerMul: 1, modNames: [] };
  if (!useMods) return w;
  for (const m of mods) {
    w.modNames.push(m.name);
    for (const [stat, mul, add] of m.eff) {
      if (stat === 'dmgPlayer') { w.playerMul *= mul; continue; }
      const k = MOD_STATS[stat]; if (!k) continue;
      w[k] = w[k] * mul + add;
      if (stat === 'dmg') w.stam = w.stam * mul + add;
    }
  }
  w.mag = Math.max(1, Math.round(w.mag)); w.ammo = Math.max(0, Math.round(w.ammo));
  return w;
}

export function shotGap(w, k) {
  const p = w.mag > 0 ? k % w.mag || w.mag : k;
  return w.burst > 1 && w.burstInt > 0 && p % w.burst === 0 ? w.burstInt : w.fire;
}
export function timeFor(w, shots) {
  let t = w.windUp || 0;
  const mag = w.mag > 0 ? w.mag : Infinity;
  for (let k = 1; k < shots; k++) t += k % mag === 0 ? Math.max(w.reload || 0, shotGap(w, k)) : shotGap(w, k);
  return t;
}
export const reloadsFor = (w, shots) => w.mag > 0 ? Math.floor((shots - 1) / w.mag) : 0;

export function weaponStats(t, mods, useMods, C) {
  const w = effective(t, mods, useMods), hp = C.PlayerHealth || 1000, st = C.PlayerStamina || 1000;
  const s = { w, kind: t.exp && (t.cls === 0 || t.cls === 1) ? 'explosive' : t.ltl ? 'ltl' : 'lethal' };
  if (s.kind === 'explosive') {
    const e = t.exp, rays = t.cls === 1 && t.rays > 1 ? t.rays : 1;
    s.dmg = e.dmg; s.stun = e.stun; s.hard = e.dmg * e.hard; s.radius = e.r / 100; s.r0 = e.r0 / 100; s.rays = rays;
    s.stk = e.dmg > 0 ? Math.ceil(hp / (e.dmg * rays) - 1e-9) : 0;
  } else {
    const perShot = (s.kind === 'ltl' ? w.stam : w.dmg * w.playerMul) * w.rays;
    const pool = s.kind === 'ltl' ? st : hp;
    s.dmg = w.dmg * w.playerMul; s.stam = w.stam; s.hard = w.dmg * w.hard; s.rays = w.rays; s.perShot = perShot;
    s.stk = perShot > 0 ? Math.ceil(pool / perShot - 1e-9) : 0;
    s.ttk = s.stk ? timeFor(w, s.stk) : 0;
    if (w.minPct > 0 && w.minPct < 100 && perShot > 0) {
      s.farStk = Math.ceil(pool / (perShot * w.minPct / 100) - 1e-9); s.farTtk = timeFor(w, s.farStk);
    }
    s.rpm = w.burst > 1 && w.burstInt > 0 ? 60 * w.burst / ((w.burst - 1) * w.fire + w.burstInt) : w.fire > 0 ? 60 / w.fire : 0;
  }
  return s;
}

export function falloffOf(t, mods, useMods, C) {
  const s = weaponStats(t, mods, useMods, C); if (s.kind === 'explosive' || !(s.perShot > 0)) return null;
  const w = s.w, pool = s.kind === 'ltl' ? C.PlayerStamina || 1000 : C.PlayerHealth || 1000;
  const start = (w.ramp || 0) / 100, len = (w.minRange || 0) / 100, end = w.maxRange > 0 ? w.maxRange / 100 : Infinity, pct = w.minPct > 0 && w.minPct < 100 ? w.minPct / 100 : 1;
  const mul = d => pct === 1 || d <= start ? 1 : len > 0 && d < start + len ? 1 - (1 - pct) * (d - start) / len : pct;
  const at = d => { if (!(d >= 0) || d > end) return null; const m = mul(d), stk = Math.ceil(pool / (s.perShot * m) - 1e-9); return { stk, ttk: timeFor(w, stk), m }; };
  return { s, w, start, len, end, pct, mul, at };
}

const plainDesc = s => String(s || '').replace(/<[^<>]*>/g, '');
export function vehAdd(t, mul, add, desc) { if (t !== 121 || mul !== 1 || !add) return add; const m = /([+-]?\d+(?:\.\d+)?)\s*m\/s/i.exec(plainDesc(desc)); return m ? +m[1] : add; }
export function applyVehMod(a, eff) {
  for (const [t, mul, add, desc] of eff) {
    if (t === 118) a.health = a.health * mul + add; else if (t === 121 && mul > 2 && /maximum/i.test(plainDesc(desc))) a.speedMax = true; else if (t === 121) a.speed = a.speed * mul + vehAdd(t, mul, add, desc); else if (t === 114) a.cargo = a.cargo * mul + add;
    else if (t === 16) a.gun *= mul; else if (t === 14) a.col *= mul; else if (t === 44 && a.er !== null) a.er *= mul; else if (t === 109 && a.emp !== null) a.emp *= mul;
  }
  return a;
}
export function vehicleStats(v, useMods, defs) {
  const a = { health: v.health, speed: v.speed, cargo: v.cargo, gun: 1, col: 1, er: v.exp ? v.exp.r : null, emp: v.emp === undefined ? null : v.emp }, names = [];
  const by = defs ? new Map(defs.map(d => [d.row, d])) : null;
  for (const m of useMods ? v.mods : []) {
    names.push(m.name);
    const d = by && (by.get(m.row) || by.get(m.row.replace(/_Joker$/, '')));
    if (d) applyVehMod(a, d.eff); else for (const [k, mul, add] of m.eff) if (k === 'cargo') a.cargo = a.cargo * mul + add;
  }
  return { ...v, speedMax: !!a.speedMax, health: Math.round(a.health), speed: +a.speed.toFixed(2), cargo: Math.round(a.cargo), exp: v.exp ? { ...v.exp, r: a.er } : v.exp, emp: a.emp === null ? undefined : a.emp, gun: a.gun, col: a.col, modNames: names };
}
