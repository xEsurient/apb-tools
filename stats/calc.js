import { weaponStats, vehicleStats, applyVehMod, vehAdd } from '../designer/stats.js';

export const WEFF = { 165: 'ammo', 173: 'equip', 174: 'fire', 175: 'fireMM', 176: 'burstMM', 179: 'hard', 180: 'dmg', 185: 'mag', 190: 'reload', 191: 'resupply', 194: 'dmgPlayer', 72: 'range' };
export const plain = s => String(s || '').replace(/<[^<>]*>/g, '').replace(/↵/g, ' ').replace(/\s+/g, ' ').trim();
export const csvCell = v => { let t = v === null || v === undefined || Number.isNaN(v) ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
export const PIN_DIR = { weapons: { ttk: -1, stk: -1, far: -1, dmg: 1, hard: 1, rpm: 1, mag: 1, ammo: 1, reload: -1, equip: -1, range: 1 }, vehicles: { health: 1, speed: 1, rev: 1, cargo: 1, emp: -1 } };
export const SLOTNAME = c => c.replace(/^(Weapon|Vehicle|Character)_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
export function clashes(defs) {
  const out = [], seen = new Map();
  defs.forEach(d => {
    const o = seen.get(d.cat);
    if (!o) { seen.set(d.cat, d); return; }
    out.push(o.row === d.row ? `${d.name} is picked twice: a mod can be fitted only once.` : `${o.name} and ${d.name} are both ${SLOTNAME(d.cat)} mods: the game fits one mod of each type (${defs[0].cat.startsWith('Vehicle') ? 'chassis, engine, generic, trunk, activated' : 'barrel, magazine, receiver, upper rail'}), so this build can't be made. The cards still show them combined.`);
  });
  return out;
}
export const fx = (v, d = 2) => v === null || v === undefined || Number.isNaN(v) ? null : +(+v).toFixed(d);
export const effInfo = desc => {
  const m = /^\s*<Color:([^>]*)>(.*?)<Color:[^>]*>(.*)$/is.exec(desc || '');
  if (!m) return { value: '', label: plain(desc), tone: '' };
  const c = ['R', 'G', 'B'].map(k => { const x = new RegExp('\\b' + k + '\\s*=\\s*([\\d.]+)', 'i').exec(m[1]); return x ? +x[1] : 0; });
  const value = plain(m[2]), label = plain(m[3]), text = !label && !/\d/.test(value);
  return { value: text ? '' : value, label: text ? value : label, tone: c[0] === 0 && c[1] === 1 && c[2] === 0 ? 'pos' : c[0] === 1 && c[1] === 0 && c[2] === 0 ? 'neg' : '' };
};
export const pct = mul => Math.round(Math.abs(mul - 1) * 100);
export const descPct = desc => { const m = /([+-]?\d+(?:\.\d+)?)\s*%/.exec(plain(desc)); return m ? Math.abs(+m[1]) : null; };
export function fixDescs(eff) {
  const e = eff.map(x => x.slice()), num = x => x[1] !== 1 && x[1] !== 0;
  e.forEach((x, i) => {
    const p = descPct(x[3]); if (p === null || !num(x) || pct(x[1]) === p) return;
    const j = e.findIndex((y, k) => k !== i && num(y) && pct(y[1]) === p && (!plain(y[3]) || descPct(y[3]) !== pct(y[1])));
    if (j >= 0) [x[3], e[j][3]] = [e[j][3], x[3]];
  });
  return e;
}
export const effKey = (t, mul, add, desc) => t === 0 ? '0:' + plain(desc) : `${t}${mul === 1 && add !== 0 ? 'a' : 'm'}`;
export const effsOf = d => d._fx || (d._fx = fixDescs(d.eff));
export function combine(defs) {
  const by = new Map();
  for (const d of defs) for (const [t0, mul, add, desc] of effsOf(d)) {
    const t = effKey(t0, mul, add, desc), e = by.get(t) || { t, mul: 1, add: 0, n: 0, info: null, first: null }, a = vehAdd(t0, mul, add, desc);
    e.mul *= mul; e.add += a; e.n++;
    if (!e.info && plain(desc)) { e.info = effInfo(desc); e.first = [mul, a]; }
    by.set(t, e);
  }
  return by;
}
export function effRatio(e, first) {
  if (first[0] !== 1 && first[0] !== 0) return e.mul === 0 ? null : (e.mul - 1) / (first[0] - 1);
  if (first[0] === 1 && first[1]) return e.add / first[1];
  return null;
}
export function effText(e, src) {
  if (!e) return '';
  const info = e.info || (src && src.info); if (!info) return e.n > 1 ? `✓ ×${e.n}` : '✓';
  const first = e.info ? e.first : src.first, ratio = effRatio(e, first);
  const m = /^([+-]?)(\d+(?:\.\d+)?)(.*)$/.exec(info.value.trim());
  if (!m || ratio === null) return e.n > 1 ? `${info.value || '✓'} ×${e.n}` : info.value || '✓';
  if (ratio === 1) return info.value;
  const v = fx(+(m[1] + m[2]) * ratio, (m[2].split('.')[1] || '').length), unit = m[3];
  return (m[1] ? (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v) : String(Math.abs(v))) + unit;
}
export const effTone = (e, src) => { if (!src || !src.info) return ''; const info = src.info, r = e ? effRatio(e, e.info ? e.first : src.first) : null; return r !== null && r < 0 ? ({ pos: 'neg', neg: 'pos' })[info.tone] || '' : info.tone; };

export const VSTAT = [['health', 'Max Health', 1, 0], ['gun', 'Health vs gunfire', 1, 0], ['col', 'Health vs collisions', 1, 0], ['speed', 'Max Speed m/s', 1, 1], ['cargo', 'Cargo Capacity', 1, 0], ['expr', 'Explosion Radius m', 1, 1], ['emp', 'EMP Vulnerability %', -1, 0]];
export const WSTAT = [['ttk', 'TTK s', -1, 3], ['stk', 'STK', -1, 0], ['far', 'STK far', -1, 0], ['dmg', 'Damage', 1, 1], ['hard', 'Hard damage', 1, 1], ['rpm', 'RPM', 1, 0], ['mag', 'Magazine', 1, 0], ['ammo', 'Ammo', 1, 0], ['reload', 'Reload s', -1, 2], ['equip', 'Equip s', -1, 2], ['range', 'Range m', 1, 1]];
export const toWMod = d => ({ name: d.name, eff: d.eff.filter(e => WEFF[e[0]]).map(e => [WEFF[e[0]], e[1], e[2]]) });
export function weaponAt(w, defs, builtIn, C) {
  const s = weaponStats(w.types[0], (builtIn ? w.mods : []).concat(defs.map(toWMod)), true, C), x = s.w;
  return { ttk: s.kind === 'explosive' ? null : s.ttk, stk: s.stk || null, far: s.farStk || null, dmg: (s.dmg || 0) * (s.rays || 1), hard: s.hard || 0, rpm: s.rpm || null, mag: x.mag, ammo: x.ammo, reload: x.reload, equip: x.equip, range: x.ramp ? x.ramp / 100 : null };
}
export function vehicleAt(v0, defs, builtIn, vdefs) {
  const v = vehicleStats(v0, builtIn, vdefs);
  const a = applyVehMod({ health: v.health, speed: v.speed, cargo: v.cargo, gun: v.gun, col: v.col, er: v.exp ? v.exp.r / 100 : null, emp: v.emp === undefined ? null : v.emp }, defs.flatMap(d => d.eff));
  return { speedMax: !!(v.speedMax || a.speedMax), health: a.health, gun: a.gun > 0 ? a.health / a.gun : null, col: a.col > 0 ? a.health / a.col : null, speed: a.speed, cargo: Math.round(a.cargo), expr: a.er, emp: a.emp === null ? null : a.emp * 100 };
}

