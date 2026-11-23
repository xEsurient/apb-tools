import * as THREE from 'three';
const A = window.APB, S = A.S, V3 = A.V3;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'apbmap-geo-v1', LIMIT = 4000, MAXP = 5000;
const DLIST = ['WaterfrontDistrict', 'FinancialDistrict', 'AsylumDistrict', 'RWorldSocialDistrict', 'PGBeaconDistrict', 'PGCrateDistrict'];
const DNAME = { WaterfrontDistrict: 'Waterfront', FinancialDistrict: 'Financial', AsylumDistrict: 'Asylum', RWorldSocialDistrict: 'Social', PGBeaconDistrict: 'Beacon', PGCrateDistrict: 'Crate' };
const TNAME = { street: 'Streets', alley: 'Alleys', open: 'Open areas', roof: 'Rooftops', indoor: 'Indoors' };
const DEF = { d: 'all', r: 5, m: 1, h: 0, t: 0, ty: ['street', 'alley', 'open', 'indoor'] };
const dname = n => n === 'all' ? 'Mixed maps' : DNAME[n] || n;
const mapsOf = t => t.st.d === 'all' ? [...new Set(t.spots.map(s => DNAME[s.d]))].join(' + ') : dname(t.st.d);
const nf = n => Math.round(n).toLocaleString('en-US');
const dist = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
const today = () => new Date().toISOString().slice(0, 10);
const untilNext = () => { const n = new Date(), t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime(), hh = Math.floor(t / 3.6e6), mm = Math.floor(t % 3.6e6 / 6e4); return `Next daily in ${hh ? `${hh} h ` : ''}${mm} min (00:00 UTC)`; };
const dayAdd = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const played = v => !!v && (Array.isArray(v.res) ? v.res.length > 0 : (v.n || 0) > 0);
function streaks(daily, now) {
  const has = d => played(daily[d]);
  let cur = 0, d = has(now) ? now : dayAdd(now, -1);
  while (has(d)) { cur++; d = dayAdd(d, -1); }
  let best = 0, run = 0, last = null;
  for (const k of Object.keys(daily).filter(has).sort()) { run = last && dayAdd(last, 1) === k ? run + 1 : 1; best = Math.max(best, run); last = k; }
  return { cur, best: Math.max(best, cur), days: Object.keys(daily).filter(has).length };
}
function calendar(daily, now) {
  const wd = (new Date(now + 'T00:00:00Z').getUTCDay() + 6) % 7, first = dayAdd(now, -(9 * 7 + wd)), cells = [];
  for (let i = 0; i < 70; i++) {
    const d = dayAdd(first, i), v = daily[d];
    if (d > now) { cells.push('<i class="f"></i>'); continue; }
    const p = played(v), avg = p ? v.total / Math.max(1, Array.isArray(v.res) ? v.res.length : v.n || 5) : null;
    const c = !p ? '' : avg >= 4000 ? 'g' : avg >= 2000 ? 'y' : avg >= 500 ? 'o' : avg > 0 ? 'r' : 'n';
    cells.push(`<i class="${c}${d === now ? ' t' : ''}" title="${d}${p ? `: ${nf(v.total)} / 25,000${v.open ? ' (unfinished)' : ''}` : ''}"></i>`);
  }
  return `<div class="cal" aria-label="Your daily results, last 10 weeks">${cells.join('')}</div>`;
}
const DKEEP = 400, DFULL = 60;
const STYPES = {};
function typeOf(sp) {
  const v = GEO && GEO.ok[sp.d]; if (!v) return null;
  let m = STYPES[sp.d];
  if (!m) { m = STYPES[sp.d] = new Map(); for (let k = 0; k < v.s.length; k += 5) m.set(v.s[k] + ',' + v.s[k + 1], GEO.tags[v.s[k + 4]]); }
  return m.get(Math.round(sp.x / 10) + ',' + Math.round(sp.y / 10)) || null;
}
function recordRound(sp, r) {
  const add = (o, k) => { const a = o[k] || [0, 0, 0, 0, 0]; a[0]++; a[1] += r.pts; if (r.m != null) { a[2] += Math.round(r.m); a[3]++; } a[4] = Math.max(a[4], r.pts); o[k] = a; };
  const ty = typeOf(sp);
  upd(o => { const s = o.stats = o.stats && typeof o.stats === 'object' ? o.stats : {}; s.m = s.m || {}; s.t = s.t || {}; add(s.m, sp.d); if (ty) add(s.t, ty); });
}
function statsHtml() {
  const s = store.get().stats || {}, rows = (o, name) => Object.entries(o || {}).filter(([, a]) => Array.isArray(a) && a[0] > 0).sort((a, b) => b[1][0] - a[1][0])
    .map(([k, a]) => `<tr><td>${esc(name(k))}</td><td class="r">${nf(a[0])}</td><td class="r">${nf(a[1] / a[0])}</td><td class="r">${a[3] ? dist(a[2] / a[3]) : '–'}</td><td class="r">${nf(a[4])}</td></tr>`).join('');
  const head = l => `<tr><th>${l}</th><th class="r">Rounds</th><th class="r">Avg pts</th><th class="r">Avg dist.</th><th class="r">Best</th></tr>`;
  const m = rows(s.m, n => DNAME[n] || n), t = rows(s.t, k => TNAME[k] || k);
  return m ? `<h4>Per map</h4><table>${head('Map')}${m}</table>${t ? `<h4>Per spot type</h4><table>${head('Type')}${t}</table>` : ''}<p class="hint">Every round you play counts (free play, daily, challenges), except replays of spots you already played.</p>` : '<p class="dim">No rounds yet: your averages per map and spot type show up here after your first game.</p>';
}
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }, set(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { } } };
const upd = f => { const o = store.get(); f(o); store.set(o); };
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const rng = seed => { let a = fnv(String(seed)); return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const square = p => p == null ? '⬛' : p >= 4000 ? '🟩' : p >= 2000 ? '🟨' : p >= 500 ? '🟧' : '🟥';
const fp = e => `${e.placements}|${e.bounds.map(Math.round).join('|')}`;
const diag = n => { const e = S.index && S.index.districts.find(d => d.name === n); return e ? Math.hypot(e.bounds[2] - e.bounds[0], e.bounds[3] - e.bounds[1]) : 200000; };
const RCAP = 2500;
const capOf = moved => moved > 0 ? Math.max(MAXP - 1000, Math.round(MAXP - 25 * moved / 100)) : MAXP;
const away = (sp, g) => Math.hypot(g[0] - sp.x, g[1] - sp.y);
const points = (sp, g, cap) => { if (!g) return 0; const d = away(sp, g); return Math.min(cap, d <= 300 ? MAXP : Math.round(MAXP * Math.exp(-10 * d / diag(sp.d)))); };
const baseUrl = () => location.href.split('#')[0];

let GEO = null, T = null, prev = null, timer = 0, toastT = 0, askCancel = null, starting = false;
const spotHash = spots => fnv(spots.map(p => [DLIST.indexOf(p.d), Math.round(p.x / 10), Math.round(p.y / 10)].join(',')).join(';')).toString(36);
const bnd = n => { const e = S.index && S.index.districts.find(d => d.name === n); return e ? e.bounds : null; };
const inside = (n, x, y, m) => { const b = bnd(n); return !b || (x >= b[0] - m && x <= b[2] + m && y >= b[1] - m && y <= b[3] + m); };
const clampTo = (n, x, y, m) => { const b = bnd(n); return b ? [Math.min(b[2] + m, Math.max(b[0] - m, x)), Math.min(b[3] + m, Math.max(b[1] - m, y))] : [x, y]; };
const firstHash = location.hash;

async function geoData() {
  if (GEO) return GEO;
  const r = await fetch('data/geo.json'); if (!r.ok) throw new Error('data/geo.json: ' + r.status);
  const g = await r.json(); g.ok = {};
  for (const n of DLIST) { const e = S.index.districts.find(d => d.name === n), v = g.districts[n]; if (e && v && v.fp === fp(e) && v.n) g.ok[n] = v; }
  return GEO = g;
}
function pools(st) {
  const types = new Set(st.ty.map(t => GEO.tags.indexOf(t))), out = {};
  for (const n of st.d === 'all' ? DLIST : [st.d]) {
    const v = GEO.ok[n]; if (!v) continue; const p = [];
    for (let k = 0; k < v.s.length; k += 5) if (types.has(v.s[k + 4])) p.push(k);
    if (p.length) out[n] = p;
  }
  return out;
}
function makeSpots(seed, st) {
  const R = rng(seed), P = pools(st), out = [], used = new Set();
  let names = Object.keys(P);
  if (!names.length) return out;
  while (names.length > 2) names.splice(Math.floor(R() * names.length), 1);
  for (let r = 0; r < st.r; r++) {
    const n = r < names.length ? names[r] : names[Math.floor(R() * names.length)], p = P[n], v = GEO.ok[n].s;
    let k = p[0]; for (let t = 0; t < 30; t++) { k = p[Math.floor(R() * p.length)]; if (!used.has(n + k)) break; }
    used.add(n + k);
    const open = []; for (let b = 0; b < 16; b++) if (v[k + 3] >> b & 1) open.push(b);
    const h = open.length ? open[Math.floor(R() * open.length)] : 0;
    out.push({ d: n, x: v[k] * 10, y: v[k + 1] * 10, z: v[k + 2] * 10, yaw: (h + 0.25 + (R() - 0.5) * 0.7) * Math.PI / 8 });
  }
  const order = [...new Set(out.map(o => o.d))];
  return out.sort((a, b) => order.indexOf(a.d) - order.indexOf(b.d));
}

async function pack(o) {
  const raw = new TextEncoder().encode(JSON.stringify(o));
  if (typeof CompressionStream === 'undefined') return 'j' + b64(raw);
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  return 'c' + b64(z);
}
async function unpack(s) {
  const k = s[0], u = unb64(s.slice(1));
  let raw = k === 'j' ? u : null;
  if (k === 'c') {
    const rd = new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > 200000) { rd.cancel(); throw new Error('link too large'); } parts.push(value); }
    raw = new Uint8Array(n); let o = 0; for (const p of parts) { raw.set(p, o); o += p.length; }
  }
  if (!raw || raw.length > 200000) throw new Error(raw ? 'link too large' : 'unknown link format');
  return JSON.parse(new TextDecoder().decode(raw));
}
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
function checkChallenge(o) {
  if (!o || o.v !== 1 || typeof o.id !== 'string' || !/^[a-z0-9]{4,12}$/.test(o.id)) throw new Error('not a GeoGuesser challenge');
  const st = o.st || {}, r = st.r;
  if (!int(r, 1, 10) || !Array.isArray(o.sp) || o.sp.length !== r) throw new Error('broken challenge');
  const s = { d: int(st.d, 0, DLIST.length - 1) ? DLIST[st.d] : 'all', r, m: st.m ? 1 : 0, h: st.h ? 1 : 0, t: int(st.t, 0, 600) ? st.t : 0, ty: Array.isArray(st.ty) ? st.ty.filter(t => Object.hasOwn(TNAME, t)) : DEF.ty };
  const spots = o.sp.map(a => {
    if (!Array.isArray(a) || a.length < 5 || !int(a[0], 0, DLIST.length - 1) || !a.slice(1, 5).every(Number.isFinite)) throw new Error('broken challenge');
    const sp = { d: DLIST[a[0]], x: a[1] * 10, y: a[2] * 10, z: a[3] * 10, yaw: a[4] / 1000 };
    if (!bnd(sp.d) || !inside(sp.d, sp.x, sp.y, 20000) || Math.abs(sp.z) > 1e7 || Math.abs(sp.yaw) > 100) throw new Error('broken challenge');
    return sp;
  });
  const guess = (g, k) => {
    if (!Array.isArray(g) || g.length < 3 || !g.slice(0, 3).every(Number.isFinite)) return 0;
    const [x, y] = clampTo(spots[k].d, Math.round(g[0]) * 10, Math.round(g[1]) * 10, 20000);
    return [Math.round(x / 10), Math.round(y / 10), Math.max(MAXP - 1000, Math.min(MAXP, Math.round(g[2]))), Number.isFinite(g[3]) ? Math.max(0, Math.min(3600, Math.round(g[3]))) : 0];
  };
  const players = (Array.isArray(o.p) ? o.p : []).slice(0, 60).filter(p => Array.isArray(p) && typeof p[0] === 'string' && Array.isArray(p[1]) && p[1].length === r)
    .map(p => [p[0].slice(0, 16), p[1].map(guess)]);
  return { id: o.id, st: s, spots, players };
}
function challengeObj(id, st, spots, players) {
  return { v: 1, id, st: { d: st.d === 'all' ? 'all' : DLIST.indexOf(st.d), r: st.r, m: st.m, h: st.h, t: st.t, ty: st.ty },
    sp: spots.map(p => [DLIST.indexOf(p.d), Math.round(p.x / 10), Math.round(p.y / 10), Math.round(p.z / 10), Math.round(p.yaw * 1000)]), p: players };
}
const PMAX = 60;
function capPlayers(spots, list, me) {
  if (list.length <= PMAX) return list;
  const keep = bestPerName(spots, list).map(([p]) => p);
  if (me && !keep.some(p => p === me || JSON.stringify(p) === JSON.stringify(me))) keep.unshift(me);
  const mk = me ? JSON.stringify(me) : null, isMe = p => p === me || (mk !== null && JSON.stringify(p) === mk);
  const out = keep.filter((p, k) => !isMe(p) || keep.findIndex(isMe) === k).slice(0, PMAX);
  if (me && !out.some(isMe)) out[out.length < PMAX ? out.length : PMAX - 1] = me;
  return out;
}
function mergePlayers(id, list, spots, me) {
  let all = [];
  upd(o => {
    o.ch = o.ch && typeof o.ch === 'object' ? o.ch : {}; const c = o.ch[id] && Array.isArray(o.ch[id].p) ? o.ch[id] : { p: [] }, seen = new Set(c.p.map(p => JSON.stringify(p)));
    for (const p of list) { const k = JSON.stringify(p); if (!seen.has(k)) { seen.add(k); c.p.push(p); } }
    if (spots) { const mk = me ? JSON.stringify(me) : null; c.p = capPlayers(spots, c.p, mk ? c.p.find(p => JSON.stringify(p) === mk) : null); }
    c.ts = Date.now(); o.ch[id] = c; all = c.p;
    const ids = Object.keys(o.ch).sort((a, b) => o.ch[b].ts - o.ch[a].ts); for (const k of ids.slice(30)) delete o.ch[k];
  });
  return all;
}
const bestPerName = (spots, list) => { const m = new Map(); for (const p of list) { const t = playerTotal(spots, p), k = p[0].toLowerCase(); if (!m.has(k) || t > m.get(k)[1]) m.set(k, [p, t]); } return [...m.values()].sort((a, b) => b[1] - a[1]); };
const playerTotal = (spots, p) => p[1].reduce((a, g, k) => a + (g ? points(spots[k], [g[0] * 10, g[1] * 10], g[2]) : 0), 0);

function toast(t) { const el = $('#geotoast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => el.style.display = 'none', 2600); }
function hint(t) { const el = $('#geohint'), rv = $('#georeveal'); el.style.display = t ? 'block' : 'none'; el.textContent = t || ''; el.style.bottom = t && rv.style.display === 'block' ? `${rv.offsetHeight + 26}px` : ''; }
function ask(html, yes, no) {
  closeAsk();
  return new Promise(res => {
    const box = $('#geoconfirm'), c = box.firstElementChild;
    c.innerHTML = `${html}<div class="btns" style="display:flex;gap:8px;margin-top:14px"><button class="primary" id="gyes">${esc(yes)}</button><button id="gno">${esc(no)}</button></div>`;
    box.style.display = 'block'; const done = v => { box.style.display = 'none'; askCancel = null; document.removeEventListener('keydown', key, true); res(v); }; askCancel = () => done(false);
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(document.activeElement?.id !== 'gno'); } };
    document.addEventListener('keydown', key, true);
    $('#gyes').onclick = () => done(true); $('#gno').onclick = () => done(false); $('#gyes').focus();
  });
}
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = t, 1600); } }
  catch { prompt('Copy this:', text); }
}
const closeAsk = () => { if (askCancel) askCancel(); };
function card(html) { const c = $('#geocard'); c.innerHTML = html; c.style.display = html ? 'block' : 'none'; c.scrollTop = 0; }
function oops(t) { card(`<h2>GeoGuesser</h2><p>${esc(t)}</p><div class="btns"><button id="gcancel">Close</button></div>`); $('#gcancel').onclick = () => { card(''); if (/^#geo=/.test(location.hash)) A.setHash(); }; }

const hooks = {
  hard: false,
  click(x, y) { if (!T || T.view !== 'map') return; T.pin = [Math.round(x / 10) * 10, Math.round(y / 10) * 10]; $('#tip').style.display = 'none'; A.draw2d(); bar(); },
  walk(k, dt, fwd, right, p) {
    if (!T || T.view !== 'street' || T.asking) return;
    const kf = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0), ks = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const f = kf || -JOY.y, s = ks || JOY.x, mag = kf || ks ? 1 : Math.min(1, Math.hypot(JOY.x, JOY.y));
    if ((!f && !s) || mag < 0.15) return;
    if (!T.st.m) { k.clear(); joyReset(); toast('Moving is off in this game: look around with the mouse'); return; }
    if (!T.moveOk) { k.clear(); joyReset(); askMove(); return; }
    let dx = -Math.sin(V3.yaw) * f + Math.cos(V3.yaw) * s, dz = -Math.cos(V3.yaw) * f - Math.sin(V3.yaw) * s;
    const l = Math.hypot(dx, dz), sp = 450 * (k.has('shift') || JOY.run ? 2 : 1) * mag * dt; dx *= sp / l; dz *= sp / l;
    let step = tryStep(p, dx, dz) || tryStep(p, dx, 0) || tryStep(p, 0, dz);
    if (!step) return;
    let [nx, nz, ny] = step; const ox = nx - T.sp.x, oz = nz - T.sp.y, r = Math.hypot(ox, oz);
    if (r > LIMIT) { if (!T.edge) { T.edge = true; toast('You can walk up to 40 m from the start'); } const cx = T.sp.x + ox * LIMIT / r - p.x, cz = T.sp.y + oz * LIMIT / r - p.z; if (Math.hypot(cx, cz) < 1) return; const c = tryStep(p, cx, cz); if (!c) return; [nx, nz, ny] = c; }
    p.x = nx; p.z = nz; p.y = ny;
    const m = Math.hypot(nx - T.sp.x, nz - T.sp.y); if (m > T.moved) { T.moved = m; capText(); }
  },
  draw2d(g) {
    if (!T || !T.sp || S.name !== T.sp.d) return;
    const sp = T.sp, pin = (x, y, col, txt) => {
      const [sx, sy] = A.w2s(x, y); g.save(); g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(sx - 4, sy - 9, sx - 11, sy - 13, sx - 11, sy - 21); g.arc(sx, sy - 21, 11, Math.PI, 0); g.bezierCurveTo(sx + 11, sy - 13, sx + 4, sy - 9, sx, sy); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(sx, sy - 21, 4, 0, 7); g.fill();
      if (txt) { g.font = '600 11.5px Inter,system-ui,sans-serif'; g.textBaseline = 'middle'; const w = g.measureText(txt).width + 10; g.fillStyle = 'rgba(15,17,21,.88)'; g.beginPath(); g.roundRect(sx + 13, sy - 31, w, 19, 6); g.fill(); g.fillStyle = '#e9e9ec'; g.fillText(txt, sx + 18, sy - 21); }
      g.restore();
    };
    if (T.view === 'reveal' || T.view === 'look') {
      const k = T.round, line = (gx, gy, col, w) => { const [a, b] = A.w2s(gx, gy), [c, d] = A.w2s(sp.x, sp.y); g.save(); g.setLineDash([7, 6]); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.restore(); };
      for (const p of T.others || []) { const q = p[1][k]; if (q) { line(q[0] * 10, q[1] * 10, 'rgba(154,208,255,.55)', 2); pin(q[0] * 10, q[1] * 10, '#9ad0ff', p[0]); } }
      const [sx, sy] = A.w2s(sp.x, sp.y), r = T.res[k];
      if (r && r.g) {
        const [gx, gy] = A.w2s(r.g[0], r.g[1]), rad = Math.hypot(gx - sx, gy - sy);
        if (rad > 14) { g.save(); g.strokeStyle = 'rgba(242,163,58,.35)'; g.fillStyle = 'rgba(242,163,58,.06)'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx, sy, rad, 0, 7); g.fill(); g.stroke(); g.restore(); }
        line(r.g[0], r.g[1], '#f2a33a', 3); pin(r.g[0], r.g[1], '#f2a33a', 'You');
        if (r.m != null && rad > 60) { const t = dist(r.m), mx = (sx + gx) / 2, my = (sy + gy) / 2; g.save(); g.font = '600 12px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = g.measureText(t).width + 12; g.fillStyle = 'rgba(15,17,21,.88)'; g.beginPath(); g.roundRect(mx - w / 2, my - 10, w, 20, 6); g.fill(); g.fillStyle = '#f2a33a'; g.fillText(t, mx, my); g.restore(); }
      }
      const hd = heading2d(sp); if (hd) { const [ux, uy] = hd, ax = sx + ux * 34, ay = sy + uy * 34; g.save(); g.strokeStyle = '#2bb673'; g.fillStyle = '#2bb673'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx + ux * 10, sy + uy * 10); g.lineTo(ax, ay); g.stroke(); g.beginPath(); g.moveTo(ax + ux * 9, ay + uy * 9); g.lineTo(ax - uy * 6, ay + ux * 6); g.lineTo(ax + uy * 6, ay - ux * 6); g.closePath(); g.fill(); g.restore(); } g.save(); g.fillStyle = '#2bb673'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(sx, sy, 9, 0, 7); g.fill(); g.stroke(); g.restore();
      return;
    }
    if (T.pin) pin(T.pin[0], T.pin[1], '#f2a33a');
  },
};

function heading2d(sp) {
  if (!Number.isFinite(sp.yaw)) return null;
  const [a, b] = A.w2s(sp.x, sp.y), [c, d] = A.w2s(sp.x - Math.sin(sp.yaw) * 1000, sp.y - Math.cos(sp.yaw) * 1000), l = Math.hypot(c - a, d - b);
  return l > 1e-6 ? [(c - a) / l, (d - b) / l] : null;
}
const facing = sp => Number.isFinite(sp.yaw) ? COMPASS[((Math.round(-sp.yaw / (Math.PI / 4)) % 8) + 8) % 8] : '';
const JOY = { x: 0, y: 0, run: false, id: null };
const pad = () => matchMedia('(any-pointer: coarse)').matches;
function joyReset() { JOY.x = 0; JOY.y = 0; JOY.id = null; const k = $('#geojoy i'); if (k) k.style.transform = ''; }
function joyShow() { const on = !!(T && T.view === 'street' && T.st.m && pad()); document.body.classList.toggle('walkpad', on); if (!on) joyReset(); }
(() => {
  const j = $('#geojoy'), knob = j.querySelector('i'), run = $('#georun');
  const move = e => { const r = j.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } JOY.x = x; JOY.y = y; knob.style.transform = `translate(${x * R * 0.6}px,${y * R * 0.6}px)`; V3.dirty = true; };
  j.addEventListener('pointerdown', e => { e.preventDefault(); JOY.id = e.pointerId; try { j.setPointerCapture(e.pointerId); } catch { } move(e); });
  j.addEventListener('pointermove', e => { if (e.pointerId === JOY.id) move(e); });
  const end = e => { if (e.pointerId === JOY.id) joyReset(); };
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end); j.addEventListener('lostpointercapture', end);
  run.onclick = () => { JOY.run = !JOY.run; run.classList.toggle('on', JOY.run); run.setAttribute('aria-pressed', String(JOY.run)); };
})();
const EYE = 170, ray = new THREE.Raycaster(), rv = new THREE.Vector3(), rd = new THREE.Vector3();
const solids = () => V3.groups.filter(g => g.isInstancedMesh);
function tryStep(p, dx, dz) {
  const len = Math.hypot(dx, dz); if (len < 1e-6) return null;
  const objs = solids(), eye = p.y;
  rv.set(p.x, eye - 90, p.z); rd.set(dx / len, 0, dz / len); ray.set(rv, rd); ray.far = len + 50;
  if (ray.intersectObjects(objs, false).length) return null;
  const nx = p.x + dx, nz = p.z + dz;
  rv.set(nx, eye - 110, nz); rd.set(0, -1, 0); ray.set(rv, rd); ray.far = 360;
  const hit = ray.intersectObjects(objs, false)[0]; if (!hit) return null;
  return [nx, nz, eye - 110 - hit.distance + EYE];
}
async function askMove() {
  const t = T, k = T.round; t.asking = true;
  const ok = await ask(`<b>Walk around?</b><p class="dim" style="margin:8px 0 0">Every metre you walk takes 25 points off this round's 5,000 maximum (4,000 at the 40 m limit). Walking back does not raise it again.</p>`, 'Walk', 'Stay here');
  t.asking = false; if (ok && T === t && t.round === k && t.view === 'street') { t.moveOk = true; toast(pad() && touchOnly() ? 'Walking: use the joystick, Run to go faster' : 'Walking: WASD or arrow keys, Shift to run'); }
}
const capNow = () => Math.min(capOf(T.moved), T.rcap || MAXP);
function capText() { const el = $('#gcap'); if (el) el.textContent = capNow() < MAXP ? `Max ${nf(capNow())}` : ''; }
function total() { return T.res.reduce((a, r) => a + (r ? r.pts : 0), 0); }
function bar() {
  if (!T) return;
  const k = T.round, inMap = T.view === 'map';
  $('#geobar').innerHTML = `<span class="gi"><span>Round <b>${k + 1}/${T.st.r}</b></span><span class="hide-s">${esc(DNAME[T.sp.d])}</span><span>Score <b>${nf(total())}</b></span><span class="cap" id="gcap"></span><span class="tm" id="gtm"></span></span>
    ${T.view === 'street' ? `<button class="primary" id="gmap">Guess on the map</button>` : ''}${inMap ? `<button id="gstreet">Back to the street</button><button class="primary" id="gok" ${T.pin ? '' : 'disabled'}>Guess</button>` : ''}
    <button id="gquit" aria-label="Quit game" title="Quit">✕</button>`;
  capText(); tick(); joyShow();
  if ($('#gmap')) $('#gmap').onclick = toMap; if ($('#gstreet')) $('#gstreet').onclick = toStreet; if ($('#gok')) $('#gok').onclick = confirmGuess;
  $('#gquit').onclick = quit;
}
function tick() {
  const el = $('#gtm'); if (!T || !T.st.t || !el) return;
  const left = Math.max(0, T.deadline - performance.now()) / 1000; el.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; el.classList.toggle('low', left < 10);
}
function startTimer() {
  clearInterval(timer); if (!T.st.t) return;
  T.deadline = performance.now() + T.st.t * 1000;
  timer = setInterval(() => { if (!T || (T.view !== 'street' && T.view !== 'map')) { clearInterval(timer); return; } tick(); if (performance.now() >= T.deadline) { clearInterval(timer); timeUp(); } }, 250);
}
async function timeUp() { const t = T; if (!t) return; closeAsk(); if (t.view === 'street') await toMap(); if (T !== t) return; toast(T.pin ? 'Time is up: your pin counts' : 'Time is up'); confirmGuess(true); }

function enter() {
  prev = { opt: { ...S.opt }, season: S.season, on: [...S.on], mode: S.mode };
  S.opt.regions = false; S.opt.imagery = true; S.season = false; S.on = S.on.map(() => true);
  if (!S.opt.textures) { S.opt.textures = true; if (V3.renderer) V3.applyTextures(); }
  if (V3.ready) V3.applyKinds();
  S.geo = hooks; S.sel = -1; S.hits = new Set(); hooks.hard = !!T.st.h; $('#hitchip').style.display = 'none';
  document.body.classList.add('geo'); document.body.classList.remove('mopen'); $('#detail').style.display = 'none';
  A.applySeason(); A.seasonPanel(); V3.applyMarkers(); V3.hitSprites(); V3.missionSprites(); V3.unmark();
  history.replaceState(null, '', '#geo');
}
async function leave() {
  if (A.cancelLoad) A.cancelLoad(); closeAsk(); clearInterval(timer); unpins3d(); joyReset(); T = null; S.geo = null; card(''); hint(''); $('#georeveal').style.display = 'none'; document.body.classList.remove('walkpad');
  document.body.classList.remove('geo');
  const pm = prev && prev.mode;
  if (prev) {
    const tex = S.opt.textures !== prev.opt.textures; Object.assign(S.opt, prev.opt); S.season = prev.season;
    if (prev.on.length === S.on.length) S.on = prev.on;
    document.querySelectorAll('#kinds .row').forEach(r => r.querySelector('.switch').classList.toggle('on', !!S.on[+r.dataset.k]));
    if (tex && V3.renderer) V3.applyTextures(); prev = null;
    const rs = document.querySelector('#layers .row[data-reg] .switch'); if (rs) rs.classList.toggle('on', !!S.opt.regions);
  }
  if (V3.cam) { V3.cam.fov = 60; V3.cam.updateProjectionMatrix(); }
  A.applySeason(); A.seasonPanel(); V3.applyMarkers(); V3.missionSprites(); V3.dirty = true;
  if (pm && S.mode !== pm) await A.setMode(pm);
  A.setHash(); A.draw2d();
}
async function quit() {
  const kept = T && T.kind === 'daily' && !T.replay;
  if (T && T.view !== 'done' && T.res.length && !(await ask(kept ? '<b>Leave today\'s challenge?</b><p class="dim" style="margin:8px 0 0">Your guesses so far already count as today\'s result. You can finish the other rounds later from the GeoGuesser menu.</p>' : '<b>Leave this game?</b><p class="dim" style="margin:8px 0 0">Your score so far is not saved.</p>', 'Leave', 'Keep playing'))) return;
  await leave(); if (S.mode === '3d') V3.overview();
}

async function start(def) {
  if (T || starting) return;
  starting = true;
  try { await geoData(); } catch (e) { A.fail('GeoGuesser data could not load: ' + e.message); return; } finally { starting = false; }
  if (T) return;
  if (!def.spots.length) { A.fail('No spots match these settings.'); return; }
  T = { ...def, round: 0, res: [], view: 'load', seen: [] };
  if (T.kind === 'daily') {
    T.sh = spotHash(T.spots);
    const dr = store.get().daily?.[T.date];
    if (dr && !dr.open) T.replay = true;
    else if (dr && dr.open && Array.isArray(dr.res)) {
      if (dr.sh && dr.sh !== T.sh) {
        upd(o => { if (o.daily?.[T.date]) delete o.daily[T.date].open; });
        T = null; card('');
        oops('Today\'s spots were updated after you started, so your saved rounds can\'t be continued: they stay as today\'s result.');
        return;
      }
      T.st = { ...T.st, h: dr.h ? 1 : 0 };
      T.res = dr.res.slice(0, T.st.r).map(a => ({ g: Number.isFinite(a[3]) && Number.isFinite(a[4]) ? [a[3] * 10, a[4] * 10] : null, cap: Number.isFinite(a[5]) ? a[5] : MAXP, pts: +a[0] || 0, m: a[1], moved: !!a[2], secs: 0 }));
      T.seen = Array.isArray(dr.seen) ? dr.seen.filter(k => int(k, 0, 9)) : [];
    }
  }
  card(''); enter();
  if (T.res.length >= T.st.r) { T.round = T.st.r - 1; T.sp = T.spots[T.round]; T.view = 'done'; await finish(); return; }
  await round(T.res.length);
}
async function round(k) {
  const t = T; closeAsk(); unpins3d(); T.round = k; T.sp = T.spots[k]; T.pin = null; T.moved = 0; T.moveOk = false; T.edge = false; T.fitted = false; T.view = 'load';
  T.rcap = T.kind === 'daily' && !T.replay && T.seen.includes(k) ? RCAP : MAXP;
  T.others = T.kind === 'challenge' ? T.players : [];
  $('#georeveal').style.display = 'none'; hint(''); bar();
  const sp = T.sp;
  try {
    if (S.name !== sp.d) { $('#district').value = sp.d; await A.loadDistrict(sp.d); }
    await A.setMode('3d');
    if (!V3.ready || V3.builtFor !== sp.d) throw new Error('3D view did not load');
  } catch (e) { if (T !== t) return; A.fail('Could not load the round: ' + e.message); leave(); return; }
  if (T !== t || t.round !== k) return;
  V3.cam.position.set(sp.x, sp.z, sp.y); V3.yaw = sp.yaw; V3.pitch = 0; V3.cam.fov = 60; V3.cam.updateProjectionMatrix(); V3.unmark(); V3.keys.clear(); V3.dirty = true;
  T.view = 'street'; bar(); streetHint(); startTimer();
  if (T.kind === 'daily' && !T.replay) { if (!T.seen.includes(k)) T.seen.push(k); saveDaily(true); if (T.rcap < MAXP) toast(`You left during this round earlier: its maximum is ${nf(T.rcap)}`); }
}
const touchOnly = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
function streetHint() { hint(touchOnly() ? `Drag to look around · pinch to zoom${T.st.m ? ' · joystick to walk' : ''}` : `Drag to look around · wheel to zoom${T.st.m ? ' · WASD to walk (lowers the maximum)' : ''} · G for the map`); }
async function toMap() {
  if (!T || T.view !== 'street') return;
  const t = T; T.view = 'map'; bar(); await A.setMode('2d'); if (T !== t || t.view !== 'map') return;
  if (!T.fitted) { A.fit2d(); T.fitted = true; } A.draw2d();
  hint(touchOnly() ? 'Tap the map to place your guess, then Guess' : `Click the map to place your guess · ${T.pin ? 'Enter to confirm · ' : ''}G back to the street`);
}
async function toStreet() {
  if (!T || T.view !== 'map') return;
  const t = T; T.view = 'street'; bar(); await A.setMode('3d'); if (T === t && t.view === 'street') streetHint();
}
async function confirmGuess(force) {
  if (!T || T.view !== 'map' || (!T.pin && force !== true)) return;
  closeAsk(); clearInterval(timer);
  const sp = T.sp, cap = capNow(), g = T.pin, pts = points(sp, g, cap), m = g ? away(sp, g) / 100 : null;
  T.res[T.round] = { g, cap, pts, m, moved: T.moved > 0, secs: T.st.t ? Math.round(T.st.t - Math.max(0, T.deadline - performance.now()) / 1000) : 0 };
  if (!T.replay && !T.noBest) recordRound(sp, T.res[T.round]);
  if (T.kind === 'daily' && !T.replay) saveDaily(true);
  T.view = 'reveal'; hint(''); bar();
  const xs = [sp.x], ys = [sp.y]; if (g) { xs.push(g[0]); ys.push(g[1]); }
  for (const p of T.others) { const q = p[1][T.round]; if (q) { xs.push(q[0] * 10); ys.push(q[1] * 10); } }
  A.fitBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 3000, 0.62); A.draw2d();
  reveal();
}
function reveal() {
  const r = T.res[T.round], sp = T.sp, last = T.round === T.st.r - 1;
  const ra = A.regionAt(sp.x, sp.y), rg = r.g ? A.regionAt(r.g[0], r.g[1]) : null;
  const others = T.others.map(p => { const q = p[1][T.round]; return q ? [p[0], away(sp, [q[0] * 10, q[1] * 10]) / 100, points(sp, [q[0] * 10, q[1] * 10], q[2])] : [p[0], null, 0]; });
  const el = $('#georeveal'); el.style.display = 'block';
  el.innerHTML = `<div class="big">${r.g ? `${dist(r.m)} away` : 'No guess'} · ${nf(r.pts)} points</div>
    <div class="bar"><i style="width:${(r.pts / MAXP * 100).toFixed(1)}%"></i></div>
    <div class="dim" style="font-size:12.5px">${esc(DNAME[sp.d])}${ra ? ` · the spot is in <b style="color:var(--text)">${esc(ra.name)}</b>` : ''}${r.g && ra && rg ? (rg === ra ? ' · ✓ right area' : ` · you picked ${esc(rg.name)}`) : ''}${r.cap < MAXP ? ` · maximum ${nf(r.cap)}${T.moved > 0 ? ` (walked ${T.moved < 1000 ? (T.moved / 100).toFixed(1) : Math.round(T.moved / 100)} m)` : ' (you left during this round earlier)'}` : ''}</div>
    ${facing(sp) ? `<div class="dim" style="font-size:12.5px">The view started facing ${facing(sp)} (green arrow).</div>` : ''}
    ${others.length ? `<div class="others">${others.map(([n, d, p]) => `${esc(n)}: ${d == null ? 'no guess' : dist(d)} · ${nf(p)}`).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    <div class="row2"><button id="glook">View the spot</button><button class="primary" id="gnext">${last ? 'See results' : 'Next round'}</button></div>`;
  $('#gnext').onclick = next; $('#glook').onclick = look;
}
let P3 = null;
function pinSprite(label, col) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), f = '600 26px Inter,system-ui,sans-serif'; g.font = f;
  const w = Math.ceil(g.measureText(label).width) + 28; c.width = Math.max(64, w); c.height = 110; g.font = f;
  const cx = c.width / 2; g.fillStyle = 'rgba(15,17,21,.88)'; g.beginPath(); g.roundRect((c.width - w) / 2, 0, w, 40, 10); g.fill();
  g.fillStyle = '#e9e9ec'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, cx, 21);
  g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, 66, 15, Math.PI, 0); g.lineTo(cx, 106); g.closePath(); g.fill(); g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, sizeAttenuation: false, fog: false }));
  s.center.set(0.5, 0); s.scale.set(0.09 * c.width / c.height, 0.09, 1); s.renderOrder = 10; return s;
}
function groundAt(x, y, z0) {
  rv.set(x, z0 + 60000, y); rd.set(0, -1, 0); ray.set(rv, rd); ray.far = 200000;
  const hit = ray.intersectObjects(solids(), false)[0]; return hit ? hit.point.y : z0;
}
function unpins3d() {
  if (!P3) return;
  P3.traverse(o => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  if (P3.parent) P3.parent.remove(P3); P3 = null; V3.dirty = true;
}
function pins3d() {
  unpins3d(); if (!T || !V3.scene) return;
  const sp = T.sp, k = T.round, list = [], r = T.res[k];
  if (r && r.g) list.push([r.g[0], r.g[1], 'You', '#f2a33a']);
  for (const p of T.others || []) { const q = p[1][k]; if (q) list.push([q[0] * 10, q[1] * 10, p[0], '#9ad0ff']); }
  if (!list.length) return;
  P3 = new THREE.Group(); P3.name = 'geopins';
  for (const [x, y, label, col] of list) { const s = pinSprite(label, col); s.position.set(x, groundAt(x, y, sp.z) + 60, y); s.userData.label = label; P3.add(s); }
  V3.scene.add(P3);
  const [tx, ty] = list[0], dx = tx - sp.x, dy = ty - sp.y; if (Math.hypot(dx, dy) > 50) { V3.yaw = Math.atan2(-dx, -dy); V3.pitch = 0; }
  V3.dirty = true;
}
async function look() {
  if (!T) return; const b = $('#glook');
  const t = T;
  if (T.view === 'reveal') { T.view = 'look'; b.textContent = 'Show the map'; await A.setMode('3d'); if (T !== t || t.view !== 'look') return; const sp = T.sp; V3.cam.position.set(sp.x, sp.z, sp.y); pins3d(); V3.dirty = true; hint(P3 && P3.children.length ? 'Drag to look around · pins show where everyone guessed' : 'Drag to look around'); }
  else if (T.view === 'look') { T.view = 'reveal'; b.textContent = 'View the spot'; hint(''); unpins3d(); await A.setMode('2d'); if (T === t) A.draw2d(); }
}
async function next() {
  if (!T || (T.view !== 'reveal' && T.view !== 'look')) return;
  unpins3d();
  if (T.round + 1 < T.st.r) { await round(T.round + 1); return; }
  T.view = 'done'; $('#georeveal').style.display = 'none'; hint(''); await finish();
}

function saveDaily(open) {
  let kept = null;
  upd(o => {
    o.daily = o.daily || {};
    const old = o.daily[T.date];
    if (old && !old.open) { kept = old; return; }
    const mine = T.res.map(r => r ? [r.pts, r.m == null ? null : Math.round(r.m), r.moved ? 1 : 0, r.g ? Math.round(r.g[0] / 10) : null, r.g ? Math.round(r.g[1] / 10) : null, r.cap] : null);
    const was = old && Array.isArray(old.res) ? old.res : [], res = [];
    for (let k = 0; k < Math.max(was.length, mine.length); k++) { const v = k < was.length ? was[k] : mine[k]; if (!v) break; res.push(v); }
    const seen = [...new Set([...(old && Array.isArray(old.seen) ? old.seen : []), ...T.seen])].filter(k => k >= res.length).sort((a, b) => a - b);
    o.daily[T.date] = { h: old ? old.h : T.st.h, maps: mapsOf(T), total: res.reduce((a, v) => a + (+v[0] || 0), 0), res, sh: T.sh };
    if (seen.length) o.daily[T.date].seen = seen;
    if (open && res.length < T.st.r) o.daily[T.date].open = 1;
    kept = o.daily[T.date];
    const ks = Object.keys(o.daily).sort(); for (const k of ks.slice(0, -DKEEP)) delete o.daily[k];
    for (const k of ks.slice(0, -DFULL)) { const v = o.daily[k]; if (v && Array.isArray(v.res)) o.daily[k] = { total: v.total, h: v.h ? 1 : 0, n: v.res.length }; }
  });
  return kept;
}
const setKey = st => `${st.d}|${st.r}|m${st.m}|h${st.h}|t${st.t}|${[...st.ty].sort().join(',')}`;
async function finish() {
  const tot = total(), max = T.st.r * MAXP, key = setKey(T.st); let best = 0, firstDaily = false;
  upd(o => {
    o.best = o.best || {};
    if (T.kind === 'free' && !T.noBest) { best = o.best[key] || 0; if (tot > best) o.best[key] = tot; }
  });
  if (T.kind === 'daily' && !T.replay) { firstDaily = true; const kept = saveDaily(false); if (kept && kept.total !== tot) T.savedTotal = kept.total; }
  let board = null;
  if (T.kind === 'challenge') {
    const me = [T.name, T.res.map(r => r.g ? [Math.round(r.g[0] / 10), Math.round(r.g[1] / 10), r.cap, r.secs] : 0)];
    T.me = me; const all = mergePlayers(T.id, [...T.players, me], T.spots, me);
    board = bestPerName(T.spots, all); if (!board.some(([p]) => p === me)) board.extra = [me, playerTotal(T.spots, me)];
  }
  if (S.mode === '3d') await A.setMode('2d');
  A.fit2d(); A.draw2d();
  const rows = T.res.map((r, k) => `<tr><td>${k + 1}</td><td>${esc(DNAME[T.spots[k].d])}</td><td class="r">${r.m == null ? '–' : dist(r.m)}</td><td class="r">${r.moved ? '🚶 ' : ''}${nf(r.pts)}</td></tr>`).join('');
  const title = T.kind === 'daily' ? `Daily · ${T.date}` : T.kind === 'challenge' ? 'Challenge' : T.noBest ? `Daily · ${T.date} (replay)` : 'Game over';
  card(`<h2>${esc(title)}</h2><div class="dim">${esc(mapsOf(T))} · ${T.st.r} rounds${T.st.h ? ' · hard mode' : ''}</div>
    <div class="big">${nf(tot)} <span class="dim" style="font-size:16px;font-weight:500">/ ${nf(max)}</span></div><div class="sq">${T.res.map(r => square(r.g ? r.pts : null)).join('')}</div>
    <table><tr><th>#</th><th>Map</th><th class="r">Distance</th><th class="r">Points</th></tr>${rows}</table>
    ${T.kind === 'daily' ? `<p class="hint">${firstDaily ? (T.savedTotal != null ? `Your saved result for today is ${nf(T.savedTotal)}: rounds you had already played elsewhere count.` : 'Saved as your result for today.') : 'You already played today\'s challenge: this replay is not saved.'} A new challenge starts at 00:00 UTC. <span class="gcd">${untilNext()}</span>.</p>` : ''}
    ${T.kind === 'free' && T.noBest ? '<p class="hint">An earlier day\'s challenge, played for fun: not saved.</p>' : ''}
    ${T.kind === 'free' && !T.noBest ? `<p class="hint">${tot > best ? (best ? `New best for these settings (was ${nf(best)}).` : 'First score for these settings.') : `Best for these settings: ${nf(best)}.`}</p>` : ''}
    ${board ? `<h4>Scoreboard</h4><table>${board.map(([p, t], i) => `<tr class="${p === T.me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(p[0])}</td><td class="r">${nf(t)}</td></tr>`).join('')}${board.extra ? `<tr class="me"><td>–</td><td>${esc(board.extra[0][0])} <span class="dim">(this game, your best counts)</span></td><td class="r">${nf(board.extra[1])}</td></tr>` : ''}</table><p class="hint">Players who opened other copies of the link show up here once you open their links too.</p>` : ''}
    ${T.kind !== 'daily' ? `<div class="opt" style="margin-top:10px"><span>Your name on the scoreboard</span><input type="text" id="gname" maxlength="16" value="${esc(T.name || store.get().name || '')}" placeholder="Name"></div>` : ''}
    <div class="btns"><button class="primary" id="gshare">Copy result</button>${T.kind !== 'daily' ? `<button id="gch">${T.kind === 'challenge' ? 'Pass it on' : 'Challenge friends'}</button>` : ''}</div>
    <div class="btns" style="margin-top:8px"><button id="gagain">${T.kind === 'free' && !T.noBest ? 'Play again' : 'New game'}</button>${T.kind === 'challenge' ? '<button id="grematch" title="Same settings as this challenge, new spots: share the new link with the others">Rematch with new spots</button>' : ''}<button id="gclose">Close</button></div>
    <p class="hint">Copy result copies a line with your score and a link. Challenge links carry every player's guesses, so friends take turns: each one plays and passes the new link on.</p>`);
  const nameIn = $('#gname');
  if (nameIn) nameIn.oninput = () => { const v = nameIn.value.trim().slice(0, 16); upd(o => { o.name = v; }); };
  $('#gshare').onclick = async () => copy(await shareLine(), $('#gshare'));
  if ($('#gch')) $('#gch').onclick = async () => copy(await challengeLink(), $('#gch'));
  $('#gagain').onclick = () => { const own = T.kind === 'free' && !T.noBest, st = T.st; leave(); if (T === null) setup('free', own ? st : undefined); };
  $('#gclose').onclick = () => leave();
  if ($('#grematch')) $('#grematch').onclick = async () => { const st = { ...T.st, ty: T.st.ty && T.st.ty.length ? [...T.st.ty] : [...DEF.ty] }, name = T.name; if (st.d !== 'all' && !GEO.ok[st.d]) st.d = 'all'; await leave(); if (T === null) start({ kind: 'free', st, spots: makeSpots(Math.random().toString(36).slice(2), st), name }); };
}
async function challengeLink() {
  const name = (($('#gname') && $('#gname').value.trim()) || store.get().name || 'Player').slice(0, 16);
  if (T.kind !== 'challenge' && !T.id) {
    T.id = Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, '').padEnd(4, '0');
    T.me = [name, T.res.map(r => r.g ? [Math.round(r.g[0] / 10), Math.round(r.g[1] / 10), r.cap, r.secs] : 0)];
    mergePlayers(T.id, [T.me], T.spots, T.me);
  }
  if (T.me && T.me[0] !== name) { const old = T.me; T.me = [name, old[1]]; upd(o => { const c = o.ch?.[T.id]; if (c) { const k = c.p.findIndex(p => JSON.stringify(p) === JSON.stringify(old)); if (k >= 0) c.p[k] = T.me; } }); }
  const all = capPlayers(T.spots, store.get().ch?.[T.id]?.p || [...(T.players || []), T.me], T.me);
  return baseUrl() + '#geo=' + await pack(challengeObj(T.id, T.st, T.spots, all));
}
async function shareLine() {
  const tot = total(), max = T.st.r * MAXP, sq = T.res.map(r => square(r.g ? r.pts : null) + (r.moved ? '🚶' : '')).join('');
  const label = T.kind === 'daily' ? (T.replay ? `Daily ${T.date} (replay, not my result)` : `Daily ${T.date}`) : T.kind === 'challenge' ? 'Challenge' : T.noBest ? `Daily ${T.date} (replay)` : 'Free play';
  const link = T.kind === 'daily' ? baseUrl() + '#geo=daily-' + T.date : await challengeLink();
  return `APB GeoGuesser · ${label} · ${mapsOf(T)} · ${nf(tot)} / ${nf(max)} ${sq}${T.st.h ? ' 🔒' : ''} ${link}`;
}

let DAILY = null;
async function dailyList() {
  if (DAILY) return DAILY;
  try { const r = await fetch('data/daily.json', { cache: 'no-cache' }); const o = r.ok ? await r.json() : null; if (o && o.v === 1 && o.days && typeof o.days === 'object') DAILY = o.days; } catch { }
  return DAILY;
}
async function dailyDef(date, hard) {
  const st = { ...DEF, h: hard ? 1 : 0 }, days = await dailyList();
  if (!days) throw new Error('the daily schedule could not load. Check your connection and try again');
  const list = days[date];
  let spots = null;
  if (Array.isArray(list) && list.length === st.r && list.every(a => Array.isArray(a) && int(a[0], 0, DLIST.length - 1) && a.slice(1, 5).every(Number.isFinite)))
    spots = list.map(a => ({ d: DLIST[a[0]], x: a[1] * 10, y: a[2] * 10, z: a[3] * 10, yaw: a[4] / 1000 }));
  return { kind: 'daily', date, st, spots: spots || makeSpots('daily-' + date, st) };
}
async function setup(tab, keep) {
  try { await geoData(); } catch (e) { A.fail('GeoGuesser data could not load: ' + e.message); return; }
  upd(x => { const t = today(); for (const [k, v] of Object.entries(x.daily || {})) if (v && v.open && (k < t || (Array.isArray(v.res) && v.res.length >= DEF.r))) delete v.open; });
  const o = store.get(), st = { ...DEF, ...(o.set || {}), ...(keep || {}) }; st.ty = (Array.isArray(st.ty) ? st.ty : DEF.ty).filter(t => Object.hasOwn(TNAME, t)); if (st.d !== 'all' && !GEO.ok[st.d]) st.d = 'all';
  const avail = DLIST.filter(n => GEO.ok[n]), date = today(), d0 = o.daily?.[date], dres = d0 && typeof d0 === 'object' ? { ...d0, res: Array.isArray(d0.res) ? d0.res : [], total: +d0.total || 0 } : undefined, dopen = !!(dres && dres.open); let dh = dopen ? (dres.h ? 1 : 0) : o.dailyHard ? 1 : 0;
  const sw = (id, on) => `<span class="switch ${on ? 'on' : ''}" id="${id}" role="switch" tabindex="0" aria-checked="${on}"></span>`;
  const counts = () => { const P = pools(st); return Object.values(P).reduce((a, p) => a + p.length, 0); };
  card(`<h2>GeoGuesser</h2><div class="dim">You are dropped somewhere in San Paro. Look around, then find the spot on the map.</div>
    <div class="seg tabs glass" style="padding:4px"><button data-tab="daily" class="${tab === 'daily' ? 'on' : ''}">Daily challenge</button><button data-tab="free" class="${tab !== 'daily' && tab !== 'stats' ? 'on' : ''}">Free play</button><button data-tab="stats" class="${tab === 'stats' ? 'on' : ''}">Your stats</button></div>
    <div id="gtab"></div>`);
  const draw = () => {
    const el = $('#gtab');
    if (tab === 'stats') {
      el.innerHTML = `${statsHtml()}<div class="btns"><button id="greset">Reset stats</button><button id="gcancel">Close</button></div>`;
      $('#gcancel').onclick = () => card('');
      $('#greset').onclick = async () => { if (!store.get().stats || !(await ask('<b>Reset your stats?</b><p class="dim" style="margin:8px 0 0">Your averages per map and spot type are cleared. Daily results and bests stay.</p>', 'Reset', 'Keep'))) return; upd(x => { delete x.stats; }); draw(); };
      return;
    }
    if (tab === 'daily') {
      const sk = streaks(o.daily || {}, date);
      el.innerHTML = `<h4>${esc(date)} (UTC)</h4><div class="dim">5 rounds on two of the six maps, the same spots for everyone today. Walking allowed. <span class="gcd">${untilNext()}</span>.</div>
        ${dres ? `<p>${dopen ? `In progress, round ${dres.res.length + 1} of 5 next:` : 'Your result:'} <b>${nf(dres.total)}</b> / 25,000 ${dres.res.map(r => square(r[1] == null ? null : r[0]) + (r[2] ? '🚶' : '')).join('')}${dres.h ? ' 🔒' : ''}</p>` : ''}
        ${dopen ? `<p class="hint">Your first guesses count, so this continues where you left off${dres.h ? ' (in hard mode)' : ''}.${Array.isArray(dres.seen) && dres.seen.includes(dres.res.length) ? ` You left during round ${dres.res.length + 1}: its maximum is now ${nf(RCAP)}.` : ''}</p>` : `<div class="opt"><span>Hard mode<br><span class="hint">no labels or icons on the guessing map</span></span>${sw('ghard', dh)}</div>`}
        <div class="streak"><span>Streak <b>${sk.cur}</b> day${sk.cur === 1 ? '' : 's'}</span><span>Best <b>${sk.best}</b></span><span>Played <b>${sk.days}</b></span></div>${calendar(o.daily || {}, date)}
        <div class="btns"><button class="primary" id="gstart">${dopen ? 'Continue today\'s challenge' : dres ? 'Play again (not saved)' : 'Play today\'s challenge'}</button>${dres && !dopen ? '<button id="gdshare">Copy result</button>' : ''}<button id="gcancel">Close</button></div>`;
    } else {
      el.innerHTML = `<h4>Settings</h4>
        <div class="opt"><span>Map</span><select id="gd"><option value="all">Mixed (2 maps per game)</option>${avail.map(n => `<option value="${n}" ${st.d === n ? 'selected' : ''}>${DNAME[n]}</option>`).join('')}</select></div>
        <div class="opt"><span>Rounds</span><select id="gr">${[3, 5, 10].map(n => `<option ${st.r === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="opt"><span>Time per round</span><select id="gt">${[[0, 'No limit'], [30, '30 s'], [60, '1 min'], [120, '2 min']].map(([v, t]) => `<option value="${v}" ${st.t === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="opt"><span>Walking (up to 40 m, lowers the maximum)</span>${sw('gm', st.m)}</div>
        <div class="opt"><span>Hard mode<br><span class="hint">no labels or icons on the guessing map</span></span>${sw('ghard', st.h)}</div>
        <h4>Spot types</h4><div class="types">${GEO.tags.map(t => `<label><input type="checkbox" value="${t}" ${st.ty.includes(t) ? 'checked' : ''}>${TNAME[t]}</label>`).join('')}</div>
        <p class="hint" id="gcount"></p>
        <div class="btns"><button class="primary" id="gstart">Start</button><button id="gcancel">Close</button></div>`;
      $('#gd').value = st.d; $('#gd').onchange = e => { st.d = e.target.value; save(); };
      $('#gr').onchange = e => { st.r = +e.target.value; save(); }; $('#gt').onchange = e => { st.t = +e.target.value; save(); };
      const tg = $('#gm'); tg.onclick = () => { st.m = st.m ? 0 : 1; tg.classList.toggle('on', !!st.m); save(); };
      el.querySelectorAll('.types input').forEach(c => c.onchange = () => { st.ty = [...el.querySelectorAll('.types input:checked')].map(x => x.value); save(); });
    }
    const hd = $('#ghard'); if (hd) hd.onclick = () => { if (tab === 'daily') { dh = dh ? 0 : 1; hd.classList.toggle('on', !!dh); upd(x => { x.dailyHard = dh; }); } else { st.h = st.h ? 0 : 1; hd.classList.toggle('on', !!st.h); save(); } };
    el.querySelectorAll('.switch').forEach(x => x.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); x.click(); } });
    $('#gcancel').onclick = () => card('');
    if ($('#gdshare')) $('#gdshare').onclick = () => copy(`APB GeoGuesser · Daily ${date} · ${dres.maps || 'Mixed maps'} · ${nf(dres.total)} / 25,000 ${dres.res.map(r => square(r[1] == null ? null : r[0]) + (r[2] ? '🚶' : '')).join('')}${dres.h ? ' 🔒' : ''} ${baseUrl()}#geo=daily-${date}`, $('#gdshare'));
    $('#gstart').onclick = async () => {
      if (tab === 'daily') {
        if (today() !== date) { toast('A new day has started: here is today\'s challenge'); setup('daily'); return; }
        const b = $('#gstart'); b.disabled = true;
        try { await start(await dailyDef(date, dh)); } catch (e) { oops('Today\'s challenge could not start: ' + e.message + '.'); } finally { if (b.isConnected) b.disabled = false; }
        return;
      }
      if (!st.ty.length) { toast('Pick at least one spot type'); return; }
      const seed = Math.random().toString(36).slice(2);
      start({ kind: 'free', st: { ...st }, spots: makeSpots(seed, st), name: store.get().name || '' });
    };
    save(true);
  };
  const save = quiet => { upd(x => { x.set = { d: st.d, r: st.r, m: st.m, h: st.h, t: st.t, ty: st.ty }; }); const c = $('#gcount'); if (c) { const n = counts(); c.textContent = n ? `${nf(n)} spots match.` : 'No spots match: pick other types or another map.'; $('#gstart').disabled = !n; } };
  document.querySelectorAll('#geocard [data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll('#geocard [data-tab]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}
async function openChallenge(code) {
  let c; try { await geoData(); c = checkChallenge(await unpack(code)); } catch (e) { oops('This GeoGuesser link does not work: ' + e.message); return; }
  const all = mergePlayers(c.id, c.players), board = bestPerName(c.spots, all);
  const name = store.get().name || '';
  card(`<h2>GeoGuesser challenge</h2><div class="dim">${c.st.r} rounds · ${esc([...new Set(c.spots.map(s => DNAME[s.d]))].join(', '))}${c.st.m ? ' · walking allowed' : ' · no walking'}${c.st.h ? ' · hard mode' : ''}${c.st.t ? ` · ${c.st.t} s per round` : ''}</div>
    ${board.length ? `<h4>Scoreboard so far</h4><table>${board.map(([p, t], i) => `<tr><td>${i + 1}</td><td>${esc(p[0])}</td><td class="r">${nf(t)}</td></tr>`).join('')}</table><p class="hint">Their guesses stay hidden until you have made yours in each round.</p>` : ''}
    <div class="opt" style="margin-top:12px"><span>Your name</span><input type="text" id="gname" maxlength="16" value="${esc(name)}" placeholder="Name"></div>
    <div class="btns"><button class="primary" id="gstart">Play</button><button id="gcancel">Close</button></div>`);
  $('#gcancel').onclick = () => { card(''); A.setHash(); };
  $('#gstart').onclick = () => {
    const n = $('#gname').value.trim().slice(0, 16); if (!n) { $('#gname').focus(); toast('Enter a name for the scoreboard'); return; }
    upd(o => { o.name = n; });
    start({ kind: 'challenge', id: c.id, st: c.st, spots: c.spots, players: all, name: n });
  };
  $('#gname').onkeydown = e => { if (e.key === 'Enter') $('#gstart').click(); };
}
setInterval(() => document.querySelectorAll('#geocard .gcd').forEach(e => { e.textContent = untilNext(); }), 30000);
async function fromHash(h) {
  const hs = typeof h === 'string' ? h : location.hash;
  if (hs === '#geo' && !T) { if ($('#geocard').style.display !== 'block') { const d = store.get().daily?.[today()]; setup(d && !d.open ? 'free' : 'daily'); } return; }
  const m = /^#geo=(.+)$/.exec(typeof h === 'string' ? h : location.hash); if (!m || T) return;
  let v; try { v = decodeURIComponent(m[1]); } catch { oops('This GeoGuesser link does not work: it is cut off or damaged.'); return; }
  if (v === 'daily' || /^daily-\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = v === 'daily' ? today() : v.slice(6);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d + 'T00:00:00Z')) || dayAdd(d, 0) !== d) { oops('This GeoGuesser link does not work: that date does not exist.'); return; }
    if (d >= today()) { setup('daily'); return; }
    try { await geoData(); } catch (e) { A.fail('GeoGuesser data could not load: ' + e.message); return; }
    card(`<h2>Daily challenge · ${esc(d)}</h2><div class="dim">This link is for an earlier day. You can play that day's spots for fun (not saved), or today's challenge.</div>
      <div class="btns"><button class="primary" id="gold">Play ${esc(d)}</button><button id="gnow">Today's challenge</button><button id="gcancel">Close</button></div>`);
    $('#gold').onclick = async () => { let def; try { def = await dailyDef(d, 0); } catch (e) { oops('That day could not load: ' + e.message + '.'); return; } def.kind = 'free'; def.noBest = true; def.name = store.get().name || ''; start(def); };
    $('#gnow').onclick = () => setup('daily'); $('#gcancel').onclick = () => card('');
    return;
  }
  if (v[0] === 'c' || v[0] === 'j') openChallenge(v); else oops('This GeoGuesser link does not work: it is cut off or damaged.');
}

document.addEventListener('keydown', e => {
  if (!T || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) || $('#geoconfirm').style.display === 'block' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'g' || k === ' ') { e.preventDefault(); if (T.view === 'street') toMap(); else if (T.view === 'map') toStreet(); }
  else if (k === 'enter') { if (T.view === 'map' && T.pin) { e.preventDefault(); confirmGuess(); } else if (T.view === 'reveal' || T.view === 'look') { e.preventDefault(); next(); } }
  else if (k === 'escape' && T.view === 'map') toStreet();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('#geocard').style.display !== 'block' || $('#geoconfirm').style.display === 'block' || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (!T) { card(''); if (/^#geo=/.test(location.hash)) A.setHash(); } else if (T.view === 'done') leave();
});
$('#geobtn').onclick = () => { const d = store.get().daily?.[today()]; setup(d && !d.open ? 'free' : 'daily'); };
window.addEventListener('hashchange', fromHash);
A.ready.then(() => { if (S.index) fromHash(firstHash); });
window.APB.geo = { get T() { return T; }, makeSpots, dailyDef, points, capOf, pack, unpack, checkChallenge, capPlayers, spotHash, geoData, setup, start };
