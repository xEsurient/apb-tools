import { $, $$, h, esc, seg, toggle, store } from '../designer/core.js';
import { weaponStats, vehicleStats, falloffOf } from '../designer/stats.js';
import { plain, csvCell, PIN_DIR, clashes, fx, effKey, effsOf, combine, effText, effTone, VSTAT, WSTAT, weaponAt as wAt, vehicleAt as vAt } from './calc.js';
import { watch, iconSpan } from '../designer/assets.js';

let D = null;
const TABS = { tables: 'Tables', compare: 'Mod comparison', ttk: 'TTK by distance' };
const DIRS = k => k === 'name' || k === 'cat' || k === 'cls' || k === 'model' || k === 'mods' ? ['A → Z', 'Z → A'] : k === 'speed' || k === 'rev' ? ['Slowest first', 'Fastest first'] : ['Lowest first', 'Highest first'];
const sortCtl = (cols, key, dir, set) => h('span', { class: 'sortctl' }, h('span', { class: 'hint' }, 'Sort'),
  h('select', { 'aria-label': 'Sort by', onchange: e => set(e.target.value, dir) }, cols.map(([k, l]) => h('option', { value: k, selected: k === key }, l))),
  seg([['1', DIRS(key)[0]], ['-1', DIRS(key)[1]]], String(dir), v => set(key, +v)));
const TDEF = { kind: 'weapons', mods: true, test: false, sort: 'ttk', dir: 1, q: '' };
const CDEF = { kind: 'weapons', scope: 'cat', cat: 'Sub-Machine Guns', item: '', mods: { weapons: ['', '', ''], vehicles: ['', '', ''] }, base: true, changed: false };
const W = [['name', 'Weapon'], ['cat', 'Category'], ['ttk', 'TTK s'], ['stk', 'STK'], ['far', 'STK far'], ['dmg', 'Damage'], ['hard', 'Hard'], ['rpm', 'RPM'], ['mag', 'Mag'], ['ammo', 'Ammo'], ['reload', 'Reload s'], ['equip', 'Equip s'], ['range', 'Range m'], ['mods', 'Built-in mods']];
const V = [['name', 'Vehicle'], ['cls', 'Category'], ['model', 'Model'], ['health', 'Max Health'], ['speed', 'Max Speed m/s'], ['rev', 'Max Reverse Speed m/s'], ['cargo', 'Cargo Capacity'], ['exp', 'Explosion Max Damage'], ['expr', 'Explosion Radius m'], ['emp', 'EMP %', 'EMP Vulnerability (%)'], ['mods', 'Built-in mods']];
function saveCsv(lines, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.map(l => l.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' }));
  a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1600); } }
  catch { prompt('Copy this link:', text); }
}
const here = () => location.href.split('#')[0];
const flag = v => v === '1' ? true : v === '0' ? false : undefined;
function fromLink(t, p) {
  if (t === 'ttk') {
    const st = store.get('ttk', { w: [], mods: true }), ok = new Set(ttkPool().map(w => w.row));
    if (p.has('w')) st.w = [...new Set(p.get('w').split(','))].filter(r => ok.has(r)).slice(0, 4);
    const b = flag(p.get('mods')); if (b !== undefined) st.mods = b;
    store.set('ttk', st); return;
  }
  const kind = ['weapons', 'vehicles'].includes(p.get('kind')) ? p.get('kind') : null, dir = p.get('dir') === '-1' ? -1 : p.get('dir') === '1' ? 1 : null;
  const setB = (st, k) => { const b = flag(p.get(k)); if (b !== undefined) st[k] = b; };
  if (t === 'tables') {
    const st = store.get('tables', structuredClone(TDEF));
    if (kind && kind !== st.kind) { st.kind = kind; st.sort = kind === 'weapons' ? 'ttk' : 'speed'; st.dir = kind === 'weapons' ? 1 : -1; }
    setB(st, 'mods'); setB(st, 'test');
    if (p.has('q')) st.q = p.get('q').slice(0, 100);
    if ((st.kind === 'weapons' ? W : V).some(([k]) => k === p.get('sort'))) st.sort = p.get('sort');
    if (dir) st.dir = dir;
    store.set('tables', st); return;
  }
  const st = store.get('compare', structuredClone(CDEF));
  if (!st.sort) st.sort = { weapons: ['name', 1], vehicles: ['name', 1] };
  if (kind) st.kind = kind;
  if (['all', 'cat', 'item'].includes(p.get('scope'))) st.scope = p.get('scope');
  if (p.has('cat')) st.cat = p.get('cat').slice(0, 80);
  if (p.has('item')) st.item = p.get('item').slice(0, 120);
  if (p.has('mods')) { const defs = D.modDefs[st.kind === 'weapons' ? 'weapon' : 'vehicle'], ok = new Set(defs.map(d => d.row)); const m = p.get('mods').split(',').slice(0, 3).map(r => ok.has(r) ? r : ''); while (m.length < 3) m.push(''); st.mods[st.kind] = m; }
  setB(st, 'base'); setB(st, 'changed');
  const sk = p.get('sort'); if (sk === 'name' || (st.kind === 'weapons' ? WSTAT : VSTAT).some(([k]) => k === sk)) st.sort[st.kind] = [sk, dir || 1];
  store.set('compare', st);
}
const ttkPool = () => D.weapons.filter(w => w.types[0] && !w.test && !w.event && falloff(w.types[0], w.mods, false));
const falloff = (t, mods, useMods) => falloffOf(t, mods, useMods, D.const);
const weaponAt = (w, defs, builtIn) => wAt(w, defs, builtIn, D.const), vehicleAt = (v0, defs, builtIn) => vAt(v0, defs, builtIn, D.modDefs.vehicle);
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'];
const SVG = (tag, a = {}, ...kids) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(a)) if (v !== null && v !== undefined) e.setAttribute(k, v); kids.flat().forEach(k => k !== null && k !== undefined && e.append(k)); return e; };
const niceStep = (span, n) => { const r = span / n, p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; };
function buildTtk() {
  const root = $('#tab-ttk'), st = store.get('ttk', { w: [], mods: true }), save = () => store.set('ttk', st);
  if (!Array.isArray(st.w)) st.w = [];
  const all0 = ttkPool().sort((a, b) => plain(a.name).localeCompare(plain(b.name)) || a.row.length - b.row.length), sig = w => plain(w.name) + '|' + w.mods.map(m => m.row).join() + '|' + JSON.stringify({ ...w.types[0], row: 0 }), seenSig = new Map();
  const pool = all0.filter(w => { const k = sig(w); if (seenSig.has(k)) return false; seenSig.set(k, w); return true; });
  const dupOf = f => new Set(pool.map(f).filter((n, i, a) => a.indexOf(n) !== i)), dup = dupOf(w => plain(w.name));
  const mid = w => plain(w.name) + (dup.has(plain(w.name)) ? ` (${w.mods.length ? w.mods.map(m => m.name).join(', ') : 'no mods'})` : ''), dup2 = dupOf(mid);
  const label = w => mid(w) + (dup2.has(mid(w)) ? ` [${w.row.replace(/^Weapon_/, '')}]` : '');
  const byRow = new Map(all0.map(w => [w.row, seenSig.get(sig(w))])), byLabel = new Map(pool.map(w => [label(w).toLowerCase(), w]));
  st.w = [...new Set((st.w || []).filter(r => byRow.has(r)).map(r => byRow.get(r).row))].slice(0, 4);
  if (!st.w.length) { st.w = ['Weapon_AssaultRifle_NTEC', 'Weapon_AssaultRifle_STAR'].filter(r => byRow.has(r)); if (st.w.length < 2) st.w = pool.filter(w => w.cat === 'Assault Rifles' && !w.mods.length).slice(0, 2).map(w => w.row); }
  const chips = h('div', { class: 'row chips' }), chart = h('div', { class: 'ttkchart' }), tbl = h('div', { class: 'tbl', hidden: true }), legend = h('div', { class: 'ttklegend' });
  const tbBtn = h('button', { 'aria-expanded': 'false', onclick: () => { tbl.hidden = !tbl.hidden; tbBtn.setAttribute('aria-expanded', String(!tbl.hidden)); tbBtn.textContent = tbl.hidden ? 'Show as table' : 'Hide table'; } }, 'Show as table');
  const find = t => { t = t.trim().toLowerCase(); if (!t) return null; return byLabel.get(t) || pool.find(w => plain(w.name).toLowerCase() === t && !w.mods.length) || pool.find(w => plain(w.name).toLowerCase() === t) || pool.find(w => label(w).toLowerCase().startsWith(t)) || pool.find(w => label(w).toLowerCase().includes(t)); };
  const add = h('input', { type: 'search', placeholder: 'Add a weapon (up to 4): type a name or category…', 'aria-label': 'Add a weapon', role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list', 'aria-controls': 'ttkpop', autocomplete: 'off' });
  const pop = h('div', { class: 'modpop ttkpop', id: 'ttkpop', role: 'listbox' }); let hits = [], cur = 0;
  const hay = new Map(pool.map(w => [w, `${label(w)} ${w.cat}`.toLowerCase()]));
  const search = t => {
    const words = t.trim().toLowerCase().split(/\s+/).filter(Boolean), nm = w => plain(w.name).toLowerCase();
    const list = words.length ? pool.filter(w => words.every(x => hay.get(w).includes(x))) : pool.slice();
    const q = words.join(' '), rank = w => !q ? 0 : nm(w).startsWith(q) ? 0 : nm(w).includes(q) ? 1 : label(w).toLowerCase().includes(q) ? 2 : 3;
    return list.map((w, i) => [rank(w), i, w]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]).slice(0, 80);
  };
  const place = () => { const r = add.getBoundingClientRect(), below = window.innerHeight - r.bottom; pop.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - 330))}px`; if (below < 300 && r.top > below) { pop.style.top = ''; pop.style.bottom = `${window.innerHeight - r.top + 4}px`; } else { pop.style.bottom = ''; pop.style.top = `${r.bottom + 4}px`; } };
  const outside = e => { if (e.target !== add && !pop.contains(e.target)) close(); };
  const onScroll = e => { if (!pop.contains(e.target)) close(); };
  const close = () => { if (!pop.isConnected) return; pop.remove(); add.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', outside); window.removeEventListener('scroll', onScroll, true); };
  const show = () => {
    hits = search(add.value); cur = 0;
    pop.replaceChildren(...(hits.length ? hits.map((w, i) => h('button', { type: 'button', role: 'option', class: 'modopt ttkopt' + (i === cur ? ' on' : '') + (st.w.includes(w.row) ? ' added' : ''), 'aria-selected': String(i === cur), onmousedown: e => e.preventDefault(), onclick: () => pickW(w) },
      h('span', { class: 'nm' }, label(w)), h('small', { class: 'hint' }, w.cat + (st.w.includes(w.row) ? ' · shown' : '')))) : [h('p', { class: 'hint', style: 'margin:6px' }, 'No weapon matches.')]));
    if (!pop.isConnected) { document.body.append(pop); document.addEventListener('mousedown', outside); window.addEventListener('scroll', onScroll, true); add.setAttribute('aria-expanded', 'true'); }
    place();
  };
  const mark = () => { [...pop.querySelectorAll('.ttkopt')].forEach((b, i) => { b.classList.toggle('on', i === cur); b.setAttribute('aria-selected', String(i === cur)); if (i === cur) b.scrollIntoView({ block: 'nearest' }); }); };
  const pickW = w => { add.value = ''; close(); if (!st.w.includes(w.row)) { st.w.push(w.row); if (st.w.length > 4) st.w.shift(); save(); draw(); } };
  add.addEventListener('input', show); add.addEventListener('focus', show); add.addEventListener('click', () => { if (!pop.isConnected) show(); });
  add.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!pop.isConnected) { show(); return; } if (hits.length) { cur = (cur + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); const w = pop.isConnected && hits[cur] ? hits[cur] : find(add.value); if (w) pickW(w); }
    else if (e.key === 'Escape' && pop.isConnected) { e.preventDefault(); close(); }
  });
  const link = () => here() + '#ttk?' + new URLSearchParams({ w: st.w.join(','), mods: st.mods ? 1 : 0 });
  const draw = () => {
    const ws = st.w.map(r => byRow.get(r)).filter(Boolean), fs = ws.map(w => ({ w, f: falloff(w.types[0], w.mods, st.mods) })).filter(x => x.f);
    chips.replaceChildren(...fs.map(({ w }, i) => h('span', { class: 'chip' }, h('i', { class: 'sw', style: `background:${SERIES[i]}` }), label(w), h('button', { title: 'Remove', 'aria-label': 'Remove ' + label(w), onclick: () => { st.w = st.w.filter(r => r !== w.row); save(); draw(); } }, '×'))));
    add.disabled = false;
    if (!fs.length) { chart.replaceChildren(h('p', { class: 'hint' }, 'Add a weapon above.')); legend.replaceChildren(); tbl.replaceChildren(); return; }
    const maxD = Math.min(150, Math.max(...fs.map(({ f }) => Number.isFinite(f.end) ? f.end : f.start + f.len + 20)) * 1.05), STEP = 0.25;
    const series = fs.map(({ w, f }, i) => { const pts = []; for (let d = 0; d <= maxD + 1e-9; d += STEP) { const a = f.at(d); if (!a) break; pts.push([d, a.ttk, a.stk]); } return { w, f, i, pts }; });
    const maxT = Math.max(0.1, ...series.flatMap(x => x.pts.map(p => p[1])));
    const W0 = 860, H0 = 380, m = { l: 52, r: 150, t: 14, b: 40 }, pw = W0 - m.l - m.r, ph = H0 - m.t - m.b;
    const ys = niceStep(maxT, 5), yMax = Math.ceil(maxT * 1.08 / ys) * ys, xs = niceStep(maxD, 8);
    const X = d => m.l + d / maxD * pw, Y = t => m.t + ph - t / yMax * ph;
    const svg = SVG('svg', { viewBox: `0 0 ${W0} ${H0}`, class: 'ttksvg', role: 'img', 'aria-label': `Time to kill by distance for ${fs.map(x => label(x.w)).join(', ')}` });
    for (let t = 0; t <= yMax + 1e-9; t += ys) svg.append(SVG('line', { x1: m.l, x2: m.l + pw, y1: Y(t), y2: Y(t), class: 'grid' }), SVG('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' }, `${+t.toFixed(2)}`));
    for (let d = 0; d <= maxD + 1e-9; d += xs) svg.append(SVG('line', { x1: X(d), x2: X(d), y1: m.t + ph, y2: m.t + ph + 5, class: 'axis' }), SVG('text', { x: X(d), y: m.t + ph + 18, 'text-anchor': 'middle', class: 'tick' }, `${+d.toFixed(1)}`));
    svg.append(SVG('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'axis' }), SVG('text', { x: m.l + pw / 2, y: H0 - 4, 'text-anchor': 'middle', class: 'axt' }, 'Distance (m)'),
      SVG('text', { x: 12, y: m.t + ph / 2, 'text-anchor': 'middle', class: 'axt', transform: `rotate(-90 12 ${m.t + ph / 2})` }, 'TTK (s)'));
    const ends = [];
    series.forEach(({ pts, i, w }) => {
      if (!pts.length) return; let dd = `M${X(pts[0][0]).toFixed(1)},${Y(pts[0][1]).toFixed(1)}`;
      for (let k = 1; k < pts.length; k++) { if (pts[k][1] !== pts[k - 1][1]) dd += `H${X(pts[k][0]).toFixed(1)}V${Y(pts[k][1]).toFixed(1)}`; }
      const last = pts[pts.length - 1]; dd += `H${X(last[0]).toFixed(1)}`;
      svg.append(SVG('path', { d: dd, fill: 'none', stroke: SERIES[i], 'stroke-width': 2, 'stroke-linejoin': 'round', class: 'ser' }));
      ends.push({ y: Y(last[1]), x: X(last[0]), i, t: label(w) });
    });
    ends.sort((a, b) => a.y - b.y); for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;
    ends.forEach(e => svg.append(SVG('line', { x1: e.x + 4, x2: e.x + 14, y1: e.y, y2: e.y, stroke: SERIES[e.i], 'stroke-width': 2 }), SVG('text', { x: e.x + 18, y: e.y + 4, class: 'dl' }, e.t.length > 20 ? e.t.slice(0, 19) + '…' : e.t)));
    const cross = SVG('line', { y1: m.t, y2: m.t + ph, class: 'cross', visibility: 'hidden' }), dots = series.map(({ i }) => SVG('circle', { r: 4.5, fill: SERIES[i], stroke: '#171a20', 'stroke-width': 2, visibility: 'hidden' }));
    const hit = SVG('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent', class: 'hit' });
    svg.append(cross, ...dots, hit);
    const tip = h('div', { class: 'ttktip', hidden: true });
    const show = ev => {
      const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) / r.width * W0, d = Math.max(0, Math.min(maxD, (sx - m.l) / pw * maxD)), k = Math.round(d / STEP);
      cross.setAttribute('x1', X(k * STEP)); cross.setAttribute('x2', X(k * STEP)); cross.setAttribute('visibility', 'visible');
      const lines = series.map(({ pts, i, w, f }) => { const p = pts[k]; dots[i].setAttribute('visibility', p ? 'visible' : 'hidden'); if (p) { dots[i].setAttribute('cx', X(p[0])); dots[i].setAttribute('cy', Y(p[1])); }
        return h('div', {}, h('i', { class: 'sw', style: `background:${SERIES[i]}` }), h('b', {}, label(w)), p ? ` ${p[1].toFixed(3)} s · ${p[2]} shot${p[2] === 1 ? '' : 's'} · ${Math.round(f.at(p[0]).m * 100)}% damage` : ' out of range'); });
      tip.replaceChildren(h('div', { class: 'hint' }, `${(k * STEP).toFixed(2)} m`), ...lines); tip.hidden = false;
      const cw = chart.clientWidth, left = ev.clientX - chart.getBoundingClientRect().left;
      tip.style.left = `${Math.min(Math.max(8, left + 14), cw - 270)}px`; tip.style.top = `${Math.max(4, ev.clientY - chart.getBoundingClientRect().top - 20)}px`;
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach(c => c.setAttribute('visibility', 'hidden')); };
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', hide);
    chart.replaceChildren(svg, tip);
    legend.replaceChildren(...series.map(({ w, f, i }) => h('div', { class: 'lg' }, h('i', { class: 'sw', style: `background:${SERIES[i]}` }), h('b', {}, label(w)), h('span', { class: 'hint' },
      f.pct === 1 ? ' · no damage falloff' : ` · full damage to ${+f.start.toFixed(1)} m, ${f.len > 0 ? `falling to ${Math.round(f.pct * 100)}% at ${+(f.start + f.len).toFixed(1)} m` : `then ${Math.round(f.pct * 100)}%`}${Number.isFinite(f.end) ? ` · max range ${+f.end.toFixed(0)} m` : ''}`))));
    const rowsD = []; for (let d = 0; d <= maxD + 1e-9; d += Math.max(1, xs / 2)) rowsD.push(+d.toFixed(2));
    tbl.replaceChildren(h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, h('th', {}, 'Distance m'), series.map(x => h('th', {}, label(x.w))))),
      h('tbody', {}, rowsD.map(d => h('tr', {}, h('td', {}, String(d)), series.map(({ f }) => { const a = f.at(d); return h('td', {}, a ? `${a.ttk.toFixed(3)} s (${a.stk})` : '–'); }))))));
  };
  root.append(h('div', { class: 'card glass' }, h('h3', {}, 'TTK by distance'),
    h('p', { class: 'hint' }, 'Time to kill (or stun) against distance, from the weapon\'s damage falloff: full damage up to its effective range, then falling in a straight line to its minimum damage percentage over the falloff length the game data gives (a sudden drop when that length is 0), and no hits past the maximum range. The falloff length is our reading of the design data (m_fMinDamageRange), not confirmed in game. Same TTK rules as the tables (all pellets hit, reloads counted).'),
    h('div', { class: 'row' }, add, toggle('Built-in modifications', st.mods, v => { st.mods = v; save(); draw(); }), tbBtn, h('button', { title: 'A link that opens this chart with the same weapons', onclick: e => copy(link(), e.currentTarget) }, 'Copy link')),
    chips, legend, chart, tbl));
  draw();
}

async function main() {
  try { const r = await fetch('../designer/data.json'); if (!r.ok) throw new Error('data.json ' + r.status); D = await r.json(); }
  catch (e) { $('#main').textContent = 'Could not load the game data: ' + e.message; return; }
  watch();
  $('.headrow h1').append(h('span', { class: 'dbver' }, D.apbdb ? `DB Version ${D.apbdb.version}` : `Game build ${D.build || '?'}`));
  const tabs = $('#tabs');
  Object.entries(TABS).forEach(([id, label]) => tabs.append(h('button', { 'data-tab': id, onclick: () => { location.hash = id; } }, label)));
  window.addEventListener('hashchange', route); route();
}
const built = {};
function route() {
  const [t0, qs] = location.hash.slice(1).split('?'), t = TABS[t0] ? t0 : 'tables';
  if (qs !== undefined) { fromLink(t, new URLSearchParams(qs)); history.replaceState(null, '', '#' + t); if (built[t]) { $('#tab-' + t).innerHTML = ''; built[t] = false; } }
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.tab').forEach(x => x.hidden = x.id !== 'tab-' + t);
  if (!built[t]) { built[t] = true; ({ tables: buildTables, compare: buildCompare, ttk: buildTtk })[t](); }
}

function buildTables() {
  const root = $('#tab-tables'); const st = store.get('tables', structuredClone(TDEF));
  if (!st.pins || typeof st.pins !== 'object') st.pins = { weapons: [], vehicles: [] };
  if (typeof st.q !== 'string') st.q = ''; if (st.kind !== 'vehicles') st.kind = 'weapons'; if (st.dir !== -1) st.dir = 1;
  ['weapons', 'vehicles'].forEach(k => { if (!Array.isArray(st.pins[k])) st.pins[k] = []; });
  const save = () => store.set('tables', st);
  const pinBox = h('div');
  const togglePin = row => { const l = st.pins[st.kind], i = l.indexOf(row); if (i >= 0) l.splice(i, 1); else { l.push(row); if (l.length > 2) l.shift(); } save(); draw(); };
  const q = h('input', { type: 'search', placeholder: 'Filter by name, category or row…', value: st.q, oninput: () => { st.q = q.value; save(); draw(); } });
  const table = h('div', { class: 'tbl' }), sortBox = h('span');
  const rowsW = all => D.weapons.filter(w => w.types[0] && (all || st.test || (!w.test && !w.event))).map(w => {
    const s = weaponStats(w.types[0], w.mods, st.mods, D.const), x = s.w;
    return { name: plain(w.name), cat: w.cat, row: w.row, ttk: s.kind === 'explosive' ? null : +s.ttk.toFixed(3), stk: s.stk, far: s.farStk || null, dmg: +(s.dmg || 0).toFixed(1) + (s.rays > 1 ? ' x' + s.rays : ''), _dmg: (s.dmg || 0) * (s.rays || 1),
      hard: +(s.hard || 0).toFixed(1), rpm: s.rpm ? Math.round(s.rpm) : null, mag: x.mag, ammo: x.ammo, reload: +x.reload.toFixed(2), equip: +x.equip.toFixed(2), range: x.ramp ? +(x.ramp / 100).toFixed(1) : null, mods: (st.mods ? x.modNames : w.mods.map(m => m.name)).join(', '), lt: w.types[0].ltl && s.kind !== 'explosive' };
  });
  const rowsV = all => D.vehicles.filter(v => all || st.test || (!v.test && !v.event)).map(v0 => { const v = vehicleStats(v0, st.mods, D.modDefs.vehicle); return { name: plain(v.name), cls: v0.cls || '', model: v.model, row: v.row, health: v.health, speed: v.speed, rev: v.rev, cargo: v.cargo, exp: v.exp ? v.exp.dmg : null, expr: v.exp ? +(v.exp.r / 100).toFixed(1) : null, emp: v.emp !== undefined ? Math.round(v.emp * 100) : null, mods: v.modNames.join(', ') + (v.speedMax ? ' (top speed raised to the game\'s maximum: base speed shown)' : '') }; });
  const current = () => {
    const cols = st.kind === 'weapons' ? W : V, t = st.q.toLowerCase();
    let rows = (st.kind === 'weapons' ? rowsW() : rowsV()).filter(r => !t || `${r.name} ${r.cat || ''} ${r.cls || ''} ${r.model || ''} ${r.row}`.toLowerCase().includes(t));
    const sk = st.sort === 'dmg' ? '_dmg' : st.sort;
    const nil = v => v === null || v === undefined || v === '' || Number.isNaN(v);
    rows.sort((a, b) => { const x = a[sk], y = b[sk]; if (nil(x) || nil(y)) return nil(x) - nil(y) || a.name.localeCompare(b.name); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir || a.name.localeCompare(b.name); });
    return { cols, rows };
  };
  const link = () => here() + '#tables?' + new URLSearchParams({ kind: st.kind, mods: st.mods ? 1 : 0, test: st.test ? 1 : 0, ...(st.q ? { q: st.q } : {}), sort: st.sort, dir: st.dir });
  const csv = () => { const { cols, rows } = current(); saveCsv([cols.map(c => c[1]), ...rows.map(r => cols.map(([k]) => r[k]))], `apb-${st.kind}.csv`); };
  const drawPins = () => {
    const pins = st.pins[st.kind], all = st.kind === 'weapons' ? rowsW(true) : rowsV(true), pr = pins.map(r => all.find(x => x.row === r)).filter(Boolean);
    if (!pr.length) { pinBox.replaceChildren(); return; }
    const cols = (st.kind === 'weapons' ? W : V).filter(([k]) => k !== 'name'), better = PIN_DIR[st.kind];
    const val = (r, k) => k === 'dmg' ? r._dmg : r[k], num = v => typeof v === 'number' && !Number.isNaN(v);
    pinBox.replaceChildren(h('div', { class: 'card glass pincard' },
      h('h3', {}, pr.length === 2 ? 'Side by side' : 'Pinned'),
      h('table', { class: 'grid cmp pins' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Stat'), pr.map(r => h('th', {}, r.name, ' ', h('button', { class: 'unpin', title: 'Unpin', 'aria-label': 'Unpin ' + r.name, onclick: () => togglePin(r.row) }, '×'))))),
        h('tbody', {}, cols.map(([k, l, tt]) => {
          const vs = pr.map(r => val(r, k)), d = better[k] || 0, ok = pr.length === 2 && d && vs.every(num) && vs[0] !== vs[1];
          const best = ok ? ((vs[0] - vs[1]) * d > 0 ? 0 : 1) : -1;
          return h('tr', {}, h('td', { class: 'nm', title: tt || null }, l), pr.map((r, i) => h('td', { class: i === best ? 'up' : '' }, r[k] === null || r[k] === undefined || r[k] === '' ? '–' : r[k], i === best ? h('small', {}, ' better') : null)));
        }))),
      pr.length < 2 ? h('p', { class: 'hint' }, 'Pin one more row (☆ in the table) to compare the two side by side.') : h('p', { class: 'hint' }, 'Green = the better value of the two (lower TTK, shots, reload and equip time, EMP vulnerability; higher for the rest). Pinning a third row replaces the oldest.')));
  };
  const draw = () => {
    const { cols, rows } = current();
    drawPins();
    sortBox.replaceChildren(sortCtl(cols.map(([k, l]) => [k, l]), st.sort, st.dir, (k, d) => { st.sort = k; st.dir = d; save(); draw(); }));
    table.innerHTML = '';
    const pins = st.pins[st.kind];
    const head = h('tr', {}, h('th', { class: 'pincol', 'aria-label': 'Pin' }, ''), cols.map(([k, l, tt]) => h('th', { class: st.sort === k ? 'sorted' : '', title: tt || null, tabindex: '0', 'aria-sort': st.sort === k ? (st.dir > 0 ? 'ascending' : 'descending') : 'none', onclick: () => { st.dir = st.sort === k ? -st.dir : 1; st.sort = k; save(); draw(); }, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } } }, l, st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : '')));
    const body = rows.slice(0, 1500).map(r => h('tr', { title: r.row, class: pins.includes(r.row) ? 'pinned' : '' }, h('td', { class: 'pincol' }, h('button', { class: 'pin', 'aria-pressed': String(pins.includes(r.row)), title: pins.includes(r.row) ? 'Unpin' : 'Pin to compare side by side (two at most)', 'aria-label': (pins.includes(r.row) ? 'Unpin ' : 'Pin ') + r.name, onclick: () => togglePin(r.row) }, pins.includes(r.row) ? '★' : '☆')), cols.map(([k]) => h('td', { class: k === 'name' ? 'nm' : '' }, r[k] === null || r[k] === undefined ? '–' : r[k], k === 'ttk' && r.lt ? h('small', { class: 'hint' }, ' stun') : null))));
    table.append(h('table', { class: 'grid' }, h('thead', {}, head), h('tbody', {}, body)), h('p', { class: 'hint' }, `${rows.length} rows`));
  };
  root.append(h('div', { class: 'card glass' }, h('div', { class: 'row' }, seg([['weapons', 'Weapons'], ['vehicles', 'Vehicles']], st.kind, v => { st.kind = v; st.sort = v === 'weapons' ? 'ttk' : 'speed'; st.dir = v === 'weapons' ? 1 : -1; save(); draw(); }), q,
    toggle('Built-in modifications', st.mods, v => { st.mods = v; save(); draw(); }), toggle('Gun Game / event items', st.test, v => { st.test = v; save(); draw(); }), sortBox,
    h('button', { title: 'Every row shown (filter and sort as now) as a spreadsheet file', onclick: csv }, 'CSV'), h('button', { title: 'A link that opens this table with the same settings', onclick: e => copy(link(), e.currentTarget) }, 'Copy link')),
    h('p', { class: 'hint' }, 'TTK = time from the first to the last shot needed (all pellets hit, no misses, 1000 health / 1000 stamina for less-than-lethal). Burst weapons wait their burst interval after each burst. "STK far" = shots needed at the weapon\'s minimum damage (past its falloff). Damage on shotguns is per pellet × pellets. Marksmanship-only fire-rate mods (e.g. Mechanical Choke, Controlled Aim) are not counted in TTK/RPM. Hover a row for its design-data row. ☆ pins a row: two pinned rows are compared side by side above the table.'), pinBox, table));
  draw();
}

function buildCompare() {
  const root = $('#tab-compare');
  const st = store.get('compare', structuredClone(CDEF));
  if (!st.sort || typeof st.sort !== 'object') st.sort = { weapons: ['name', 1], vehicles: ['name', 1] };
  if (st.kind !== 'vehicles') st.kind = 'weapons'; if (!['all', 'cat', 'item'].includes(st.scope)) st.scope = 'cat'; if (!st.mods || typeof st.mods !== 'object' || Array.isArray(st.mods)) st.mods = {};
  ['weapons', 'vehicles'].forEach(k => { if (!Array.isArray(st.sort[k]) || st.sort[k].length !== 2) st.sort[k] = ['name', 1]; if (!Array.isArray(st.mods[k])) st.mods[k] = ['', '', '']; while (st.mods[k].length < 3) st.mods[k].push(''); });
  const save = () => store.set('compare', st);
  const ctl = h('div', { class: 'card glass' }), effBox = h('div'), out = h('div', { class: 'cmpgrid' });
  let limit = 30;
  const defsOf = () => D.modDefs[st.kind === 'weapons' ? 'weapon' : 'vehicle'];
  const items = () => (st.kind === 'weapons' ? D.weapons.filter(w => w.types[0] && !w.test && !w.event) : D.vehicles.filter(v => !v.test && !v.event)).filter(x => !st.base || !x.mods.length);
  const catOf = x => (st.kind === 'weapons' ? x.cat : x.cls) || 'Other', grpOf = x => st.kind === 'weapons' ? catOf(x) : x.model || 'Other';
  const chosen = () => st.mods[st.kind].map(r => defsOf().find(d => d.row === r)).filter(Boolean);
  const modSelect = i => {
    const defs = defsOf(), dup = new Set(defs.map(d => d.name).filter((n, k, a) => a.indexOf(n) !== k));
    const label = d => esc(d.name) + (dup.has(d.name) ? ` (${d.row.replace(/^FnMod_(Weapon|Vehicle)_/, '')})` : '');
    const grp = d => d.cat.replace(/^(Weapon|Vehicle|Character)_/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'Other';
    const cur = defs.find(d => d.row === st.mods[st.kind][i]);
    const btn = h('button', { type: 'button', class: 'modbtn', html: cur ? `${iconSpan(cur.icon, 28)}<span>${label(cur)}</span><i>▾</i>` : '<span class="hint">— none —</span><i>▾</i>' });
    const pop = h('div', { class: 'modpop' }), q = h('input', { type: 'search', placeholder: 'Search modifications…' }), ul = h('div', { class: 'modlist' });
    const pick = row => { st.mods[st.kind][i] = row; limit = 30; save(); close(); drawCtl(); draw(); };
    const fill = () => {
      const t = q.value.toLowerCase().trim(), groups = new Map();
      defs.filter(d => !t || (label(d) + ' ' + grp(d)).toLowerCase().includes(t)).forEach(d => { const g = grp(d); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(d); });
      ul.replaceChildren(h('button', { type: 'button', class: 'modopt' + (!cur ? ' on' : ''), onclick: () => pick('') }, h('span', { class: 'hint' }, '— none —')),
        ...[...groups].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([g, ds]) => [h('div', { class: 'modgrp' }, g),
          ...ds.map(d => h('button', { type: 'button', class: 'modopt' + (cur && cur.row === d.row ? ' on' : ''), title: d.eff.map(e => plain(e[3])).filter(Boolean).join(' · '), onclick: () => pick(d.row), html: `${iconSpan(d.icon, 28)}<span>${label(d)}</span>` }))]));
    };
    const outside = e => { if (!btn.contains(e.target) && !pop.contains(e.target)) close(); };
    const onScroll = e => { if (!pop.contains(e.target)) close(); };
    const close = () => { pop.remove(); document.removeEventListener('mousedown', outside); window.removeEventListener('scroll', onScroll, true); };
    btn.onclick = () => {
      if (pop.isConnected) return close();
      const r = btn.getBoundingClientRect(), below = window.innerHeight - r.bottom;
      pop.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - 330))}px`;
      if (below < 420 && r.top > below) { pop.style.top = ''; pop.style.bottom = `${window.innerHeight - r.top + 4}px`; } else { pop.style.bottom = ''; pop.style.top = `${r.bottom + 4}px`; }
      document.body.append(pop); q.value = ''; fill(); q.focus(); const on = ul.querySelector('.modopt.on'); if (on) on.scrollIntoView({ block: 'center' });
      document.addEventListener('mousedown', outside); window.addEventListener('scroll', onScroll, true);
    };
    q.oninput = fill;
    q.onkeydown = e => { if (e.key === 'Escape') close(); if (e.key === 'Enter') { const f = ul.querySelectorAll('.modopt')[1]; if (f) f.click(); } };
    pop.append(q, ul);
    return btn;
  };
  const drawCtl = () => {
    const list = items(), cats = [...new Set(list.map(catOf))].sort();
    if (st.scope === 'cat' && !cats.includes(st.cat)) st.cat = cats[0] || '';
    const pool = st.scope === 'cat' ? list.filter(x => catOf(x) === st.cat) : list;
    if (st.scope === 'item' && !list.some(x => x.row === st.item)) st.item = (list[0] || {}).row || '';
    ctl.replaceChildren(h('h3', {}, 'Mod comparison'),
      h('p', { class: 'hint' }, 'Pick up to three modifications in slot order. Every item is shown with no mods, then with the first, the first two and all three, so you see what each extra slot adds (e.g. Cooling Jacket 3 → + Reflex Sight 3 → + 3-Point Sling 3). Values come from the game\'s modification effects; effects the tables cannot compute (accuracy, handling…) are listed with their combined size. Sorting uses the values with all picked mods.'),
      h('div', { class: 'row' }, seg([['weapons', 'Weapons'], ['vehicles', 'Vehicles']], st.kind, v => { st.kind = v; st.cat = ''; limit = 30; save(); drawCtl(); draw(); }),
        seg([['all', st.kind === 'weapons' ? 'All weapons' : 'All vehicles'], ['cat', 'Category'], ['item', st.kind === 'weapons' ? 'One weapon' : 'One vehicle']], st.scope, v => { st.scope = v; limit = 30; save(); drawCtl(); draw(); }),
        st.scope === 'cat' ? h('select', { onchange: e => { st.cat = e.target.value; limit = 30; save(); draw(); } }, cats.map(c => h('option', { value: c, selected: c === st.cat }, `${c} (${list.filter(x => catOf(x) === c).length})`))) : null,
        st.scope === 'item' ? h('select', { onchange: e => { st.item = e.target.value; limit = 30; save(); draw(); } }, [...new Set(list.map(grpOf))].sort().map(c => h('optgroup', { label: c }, list.filter(x => grpOf(x) === c).sort((a, b) => plain(a.name).localeCompare(plain(b.name))).map(x => h('option', { value: x.row, selected: x.row === st.item }, plain(x.name)))))) : null),
      h('div', { class: 'row modslots' }, [0, 1, 2].map(i => h('label', { class: 'slot' }, h('span', { class: 'hint' }, `Slot ${i + 1}`), modSelect(i)))),
      ...clashes(chosen()).map(t => h('p', { class: 'warn', role: 'status' }, '⚠ ' + t)),
      h('div', { class: 'row' }, toggle(st.kind === 'weapons' ? 'Base weapons only (no built-in mods)' : 'Base vehicles only (no built-in mods)', st.base, v => { st.base = v; limit = 30; save(); drawCtl(); draw(); }),
        toggle('Only stats that change', st.changed, v => { st.changed = v; save(); draw(); }),
        st.scope !== 'item' ? sortCtl([['name', 'Name']].concat((st.kind === 'weapons' ? WSTAT : VSTAT).map(([k, l]) => [k, l])), ...st.sort[st.kind], (k, d) => { st.sort[st.kind] = [k, d]; limit = 30; save(); drawCtl(); draw(); }) : null,
        h('span', { class: 'hint' }, `${pool.length} ${st.kind}`),
        h('button', { title: 'Every item in this selection with its values per slot, as a spreadsheet file', onclick: csv }, 'CSV'), h('button', { title: 'A link that opens this comparison with the same mods', onclick: e => copy(link(), e.currentTarget) }, 'Copy link')));
  };
  const link = () => here() + '#compare?' + new URLSearchParams({ kind: st.kind, scope: st.scope, ...(st.scope === 'cat' ? { cat: st.cat } : {}), ...(st.scope === 'item' ? { item: st.item } : {}), mods: st.mods[st.kind].join(','), base: st.base ? 1 : 0, changed: st.changed ? 1 : 0, sort: st.sort[st.kind][0], dir: st.sort[st.kind][1] });
  const csv = () => {
    const { heads, all, STAT } = calc(), out = [['Item', 'Category', 'Stat', ...heads]];
    all.forEach(({ x, vals }) => STAT.forEach(([k, label, , dec]) => { if (vals.some(v => v[k] !== null && v[k] !== undefined)) out.push([plain(x.name), catOf(x), label, ...vals.map(v => k === 'speed' && v.speedMax ? 'game maximum' : fx(v[k], dec))]); }));
    saveCsv(out, `apb-${st.kind}-mods.csv`);
  };
  const cell = (val, prev, dir, dec) => {
    if (val === null || val === undefined) return h('td', {}, '–');
    const v = fx(val, dec), p = prev === null || prev === undefined ? null : fx(prev, dec);
    const cls = p === null || v === p || !dir ? '' : (v - p) * dir > 0 ? 'up' : 'down';
    return h('td', { class: cls }, String(v), cls ? h('small', {}, ` ${v > p ? '▲' : '▼'}`) : null);
  };
  const calc = () => {
    const defs = chosen(), steps = [[]].concat(defs.map((d, k) => defs.slice(0, k + 1)));
    const heads = ['No mods'].concat(defs.map((d, k) => `${k + 1} slot${k ? 's' : ''}: ${k ? '+ ' : ''}${d.name}`));
    const list = items(), pool = (st.scope === 'cat' ? list.filter(x => catOf(x) === st.cat) : st.scope === 'item' ? list.filter(x => x.row === st.item) : list)
      .sort((a, b) => plain(a.name).localeCompare(plain(b.name)));
    const STAT = st.kind === 'weapons' ? WSTAT : VSTAT, at = st.kind === 'weapons' ? weaponAt : vehicleAt, [sk, sd] = st.sort[st.kind];
    const all = pool.map(x => ({ x, vals: steps.map(s => at(x, s, !st.base)) }));
    if (sk !== 'name') { const val = r => r.vals[r.vals.length - 1][sk], ok = v => v !== null && v !== undefined && !Number.isNaN(v); all.sort((a, b) => !ok(val(a)) ? (ok(val(b)) ? 1 : 0) : !ok(val(b)) ? -1 : (val(a) - val(b)) * sd); }
    else if (sd < 0) all.reverse();
    return { defs, steps, heads, pool, STAT, all };
  };
  const draw = () => {
    const { defs, steps, heads, pool, STAT, all } = calc();
    const eff = steps.map(combine), types = [...new Set(defs.flatMap(d => effsOf(d).filter(e => plain(e[3])).map(e => effKey(e[0], e[1], e[2], e[3]))))];
    effBox.replaceChildren(defs.length ? h('div', { class: 'card glass' }, h('h3', {}, 'Combined effects'),
      h('table', { class: 'grid cmp' }, h('thead', {}, h('tr', {}, h('th', {}, 'Effect'), heads.map(x => h('th', {}, x)))),
        h('tbody', {}, types.map(t => { const src = eff.map(m => m.get(t)).find(e => e && e.info), info = src.info;
          return h('tr', {}, h('td', { class: 'nm' }, info.label || info.value), eff.map(m => h('td', { class: m.get(t) ? effTone(m.get(t), src) : '' }, m.get(t) ? effText(m.get(t), src) : '–'))); }))),
      h('p', { class: 'hint' }, 'Green = an improvement, red = a drawback, as the game colours them. Values of the same effect multiply (e.g. two fire-rate mods); words such as "Substantially" are the game\'s own wording.')) : h('p', { class: 'hint' }, 'Pick at least one modification above.'));
    out.innerHTML = '';
    for (const { x, vals } of all.slice(0, limit)) {
      const rows = STAT.filter(([k]) => vals.some(v => v[k] !== null && v[k] !== undefined)).filter(([k, , , dec]) => !st.changed || new Set(vals.map(v => fx(v[k], dec))).size > 1);
      out.append(h('div', { class: 'card glass cmpcard' },
        h('div', { class: 'cmphead', html: `${x.icon ? iconSpan(x.icon, 32) : ''}<div><b>${esc(plain(x.name))}</b><small class="hint">${esc(catOf(x))}${x.mods.length ? ' · built-in: ' + esc(x.mods.map(m => m.name).join(', ')) : ''}</small></div>` }),
        rows.length ? h('table', { class: 'grid cmp' }, h('thead', {}, h('tr', {}, h('th', {}, 'Stat'), heads.map((t, k) => h('th', { title: t }, k ? `${k} slot${k > 1 ? 's' : ''}` : 'No mods')))),
          h('tbody', {}, rows.map(([k, label, dir, dec]) => h('tr', {}, h('td', { class: 'nm' }, label), vals.map((v, i) => k === 'speed' && v.speedMax ? h('td', { class: 'up', title: 'Top speed raised to the game\'s maximum' }, 'Game max') : cell(v[k], i ? vals[i - 1][k] : null, dir, dec))))))
          : h('p', { class: 'hint' }, 'None of the computed stats change; see the combined effects above.')));
    }
    if (pool.length > limit) out.append(h('button', { class: 'more', onclick: () => { limit += 30; draw(); } }, `Show more (${pool.length - limit} left)`));
    if (!pool.length) out.append(h('p', { class: 'hint' }, 'Nothing in this selection.'));
  };
  root.append(ctl, effBox, out);
  drawCtl(); draw();
}

main();
