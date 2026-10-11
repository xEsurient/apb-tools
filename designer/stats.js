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
  return w.burst > 1 && w.burstInt > 0 && k % w.burst === 0 ? w.burstInt : w.fire;
}
export function timeFor(w, shots) {
  let t = w.windUp || 0;
  for (let k = 1; k < shots; k++) t += shotGap(w, k);
  return t;
}

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

export function vehicleStats(v, useMods) {
  let cargo = v.cargo; const names = [];
  for (const m of useMods ? v.mods : []) { names.push(m.name); for (const [k, mul, add] of m.eff) if (k === 'cargo') cargo = cargo * mul + add; }
  return { ...v, cargo: Math.round(cargo), modNames: names };
}
