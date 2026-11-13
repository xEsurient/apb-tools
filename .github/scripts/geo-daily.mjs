import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'maps', 'data');
const OUT = path.join(DATA, 'daily.json');
const FIRST = '2026-11-12';
const AHEAD = +(process.env.GEO_DAYS_AHEAD || 365);
const REFILL = +(process.env.GEO_REFILL_BELOW || 330);
const FORCE = process.argv.includes('--force') || process.env.FORCE_FILL === 'true';
const REBUILD = (process.argv.find(a => a.startsWith('--rebuild-from=')) || '').slice(15) || process.env.REBUILD_FROM || '';

const DLIST = ['WaterfrontDistrict', 'FinancialDistrict', 'AsylumDistrict', 'RWorldSocialDistrict', 'PGBeaconDistrict', 'PGCrateDistrict'];
const TYPES = ['street', 'alley', 'open', 'indoor'];
const ROUNDS = 5;
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const rng = seed => { let a = fnv(String(seed)); return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const fp = e => `${e.placements}|${e.bounds.map(Math.round).join('|')}`;
const day = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

function pick(geo, ok, seed) {
  const types = new Set(TYPES.map(t => geo.tags.indexOf(t))), P = {};
  for (const n of DLIST) {
    const v = ok[n]; if (!v) continue; const p = [];
    for (let k = 0; k < v.s.length; k += 5) if (types.has(v.s[k + 4])) p.push(k);
    if (p.length) P[n] = p;
  }
  const R = rng(seed), out = [], used = new Set();
  const names = Object.keys(P); if (!names.length) throw new Error('no playable district in geo.json');
  while (names.length > 2) names.splice(Math.floor(R() * names.length), 1);
  for (let r = 0; r < ROUNDS; r++) {
    const n = r < names.length ? names[r] : names[Math.floor(R() * names.length)], p = P[n], v = ok[n].s;
    let k = p[0]; for (let t = 0; t < 30; t++) { k = p[Math.floor(R() * p.length)]; if (!used.has(n + k)) break; }
    used.add(n + k);
    const open = []; for (let b = 0; b < 16; b++) if (v[k + 3] >> b & 1) open.push(b);
    const h = open.length ? open[Math.floor(R() * open.length)] : 0;
    out.push({ d: n, x: v[k], y: v[k + 1], z: v[k + 2], yaw: (h + 0.25 + (R() - 0.5) * 0.7) * Math.PI / 8 });
  }
  const order = [...new Set(out.map(o => o.d))];
  return out.sort((a, b) => order.indexOf(a.d) - order.indexOf(b.d)).map(o => [DLIST.indexOf(o.d), o.x, o.y, o.z, Math.round(o.yaw * 1000)]);
}

async function main() {
  const geo = JSON.parse(await fs.readFile(path.join(DATA, 'geo.json'), 'utf8'));
  const index = JSON.parse(await fs.readFile(path.join(DATA, 'index.json'), 'utf8'));
  const ok = {};
  for (const n of DLIST) { const e = index.districts.find(d => d.name === n), v = geo.districts[n]; if (e && v && v.fp === fp(e) && v.n) ok[n] = v; }
  let cur = { v: 1, days: {} };
  try { cur = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (cur.v !== 1 || typeof cur.days !== 'object') throw new Error('daily.json has an unknown format');
  const today = new Date().toISOString().slice(0, 10);
  if (REBUILD) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(REBUILD) || REBUILD <= today) throw new Error('--rebuild-from needs a date after today (UTC), so nobody\'s current day changes');
    for (const k of Object.keys(cur.days)) if (k >= REBUILD) delete cur.days[k];
    console.log(`Dropped every day from ${REBUILD} on.`);
  }
  const have = Object.keys(cur.days).sort(), last = have.at(-1) || day(FIRST, -1);
  console.log(`Playable: ${Object.keys(ok).join(', ')}. Scheduled up to ${have.length ? last : 'nothing'}.`);
  if (!FORCE && !REBUILD && last >= day(today, REFILL)) { console.log(`Still ${REFILL}+ days ahead, nothing to add.`); return; }
  let added = 0;
  for (let d = have.length ? day(last, 1) : FIRST; d <= day(today, AHEAD); d = day(d, 1)) {
    if (cur.days[d]) continue;
    cur.days[d] = pick(geo, ok, 'daily-' + d); added++;
  }
  const days = Object.fromEntries(Object.keys(cur.days).sort().map(k => [k, cur.days[k]]));
  await fs.writeFile(OUT, JSON.stringify({ v: 1, days }).replace(/\],"/g, '],\n"') + '\n');
  console.log(`Added ${added} days, scheduled up to ${day(today, AHEAD)}.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
