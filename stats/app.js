import { $, $$, h, seg, toggle, store } from '../designer/core.js';
import { weaponStats, vehicleStats } from '../designer/stats.js';
import { watch, iconSpan } from '../designer/assets.js';

let D = null;
const TABS = { tables: 'Tables', compare: 'Mod comparison' };
const WEFF = { 165: 'ammo', 173: 'equip', 174: 'fire', 175: 'fireMM', 176: 'burstMM', 179: 'hard', 180: 'dmg', 185: 'mag', 190: 'reload', 191: 'resupply', 194: 'dmgPlayer', 72: 'range' };
const plain = s => String(s || '').replace(/<[^<>]*>/g, '').replace(/↵/g, ' ').replace(/\s+/g, ' ').trim();
const DIRS = k => k === 'name' || k === 'cat' || k === 'cls' || k === 'model' ? ['A → Z', 'Z → A'] : k === 'speed' || k === 'rev' ? ['Slowest first', 'Fastest first'] : ['Lowest first', 'Highest first'];
const sortCtl = (cols, key, dir, set) => h('span', { class: 'sortctl' }, h('span', { class: 'hint' }, 'Sort'),
  h('select', { onchange: e => set(e.target.value, dir) }, cols.map(([k, l]) => h('option', { value: k, selected: k === key }, l))),
  seg([['1', DIRS(key)[0]], ['-1', DIRS(key)[1]]], String(dir), v => set(key, +v)));
const fx = (v, d = 2) => v === null || v === undefined || Number.isNaN(v) ? null : +(+v).toFixed(d);

async function main() {
  try { const r = await fetch('../designer/data.json'); if (!r.ok) throw new Error('data.json ' + r.status); D = await r.json(); }
  catch (e) { $('#main').textContent = 'Could not load the game data: ' + e.message; return; }
  watch();
  $('.headrow h1').append(h('span', { class: 'dbver' }, `DB Version ${D.apbdb ? D.apbdb.version : D.build || 'game data'}`));
  const tabs = $('#tabs');
  Object.entries(TABS).forEach(([id, label]) => tabs.append(h('button', { 'data-tab': id, onclick: () => { location.hash = id; } }, label)));
  window.addEventListener('hashchange', route); route();
}
const built = {};
function route() {
  const t = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'tables';
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.tab').forEach(x => x.hidden = x.id !== 'tab-' + t);
  if (!built[t]) { built[t] = true; ({ tables: buildTables, compare: buildCompare })[t](); }
}

function buildTables() {
  const root = $('#tab-tables'); const st = store.get('tables', { kind: 'weapons', mods: true, test: false, sort: 'ttk', dir: 1, q: '' });
  const save = () => store.set('tables', st);
  const q = h('input', { type: 'search', placeholder: 'Filter by name, category or row…', value: st.q, oninput: () => { st.q = q.value; save(); draw(); } });
  const table = h('div', { class: 'tbl' }), sortBox = h('span');
  const W = [['name', 'Weapon'], ['cat', 'Category'], ['ttk', 'TTK s'], ['stk', 'STK'], ['far', 'STK far'], ['dmg', 'Damage'], ['hard', 'Hard'], ['rpm', 'RPM'], ['mag', 'Mag'], ['ammo', 'Ammo'], ['reload', 'Reload s'], ['equip', 'Equip s'], ['range', 'Range m'], ['mods', 'Built-in mods']];
  const V = [['name', 'Vehicle'], ['cls', 'Category'], ['model', 'Model'], ['health', 'Max Health'], ['speed', 'Max Speed m/s'], ['rev', 'Max Reverse Speed m/s'], ['cargo', 'Cargo Capacity'], ['exp', 'Explosion Max Damage'], ['expr', 'Explosion Radius m'], ['emp', 'EMP %', 'EMP Vulnerability (%)'], ['mods', 'Built-in mods']];
  const rowsW = () => D.weapons.filter(w => w.types[0] && (st.test || !w.test)).map(w => {
    const s = weaponStats(w.types[0], w.mods, st.mods, D.const), x = s.w;
    return { name: w.name, cat: w.cat, row: w.row, ttk: s.kind === 'explosive' ? null : +s.ttk.toFixed(3), stk: s.stk, far: s.farStk || null, dmg: +(s.dmg || 0).toFixed(1) + (s.rays > 1 ? ' x' + s.rays : ''), _dmg: (s.dmg || 0) * (s.rays || 1),
      hard: +(s.hard || 0).toFixed(1), rpm: s.rpm ? Math.round(s.rpm) : null, mag: x.mag, ammo: x.ammo, reload: +x.reload.toFixed(2), equip: +x.equip.toFixed(2), range: x.ramp ? +(x.ramp / 100).toFixed(1) : null, mods: (st.mods ? x.modNames : w.mods.map(m => m.name)).join(', '), lt: w.types[0].ltl && s.kind !== 'explosive' };
  });
  const rowsV = () => D.vehicles.filter(v => st.test || !v.test).map(v0 => { const v = vehicleStats(v0, st.mods); return { name: v.name, cls: v0.cls || '', model: v.model, row: v.row, health: v.health, speed: v.speed, rev: v.rev, cargo: v.cargo, exp: v.exp ? v.exp.dmg : null, expr: v.exp ? +(v.exp.r / 100).toFixed(1) : null, emp: v.emp !== undefined ? Math.round(v.emp * 100) : null, mods: v.modNames.join(', ') }; });
  const draw = () => {
    const cols = st.kind === 'weapons' ? W : V, t = st.q.toLowerCase();
    let rows = (st.kind === 'weapons' ? rowsW() : rowsV()).filter(r => !t || `${r.name} ${r.cat || ''} ${r.cls || ''} ${r.model || ''} ${r.row}`.toLowerCase().includes(t));
    const sk = st.sort === 'dmg' ? '_dmg' : st.sort;
    rows.sort((a, b) => { const x = a[sk], y = b[sk]; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir; });
    sortBox.replaceChildren(sortCtl(cols.filter(([k]) => k !== 'mods').map(([k, l]) => [k, l]), st.sort, st.dir, (k, d) => { st.sort = k; st.dir = d; save(); draw(); }));
    table.innerHTML = '';
    const head = h('tr', {}, cols.map(([k, l, tt]) => h('th', { class: st.sort === k ? 'sorted' : '', title: tt || null, onclick: () => { st.dir = st.sort === k ? -st.dir : 1; st.sort = k; save(); draw(); } }, l, st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : '')));
    const body = rows.slice(0, 1500).map(r => h('tr', { title: r.row }, cols.map(([k]) => h('td', { class: k === 'name' ? 'nm' : '' }, r[k] === null || r[k] === undefined ? '–' : r[k], k === 'ttk' && r.lt ? h('small', { class: 'hint' }, ' stun') : null))));
    table.append(h('table', { class: 'grid' }, h('thead', {}, head), h('tbody', {}, body)), h('p', { class: 'hint' }, `${rows.length} rows`));
  };
  root.append(h('div', { class: 'card glass' }, h('div', { class: 'row' }, seg([['weapons', 'Weapons'], ['vehicles', 'Vehicles']], st.kind, v => { st.kind = v; st.sort = v === 'weapons' ? 'ttk' : 'speed'; st.dir = v === 'weapons' ? 1 : -1; save(); draw(); }), q,
    toggle('Built-in modifications', st.mods, v => { st.mods = v; save(); draw(); }), toggle('Gun Game / event items', st.test, v => { st.test = v; save(); draw(); }), sortBox),
    h('p', { class: 'hint' }, 'TTK = time from the first to the last shot needed (all pellets hit, no misses, 1000 health / 1000 stamina for less-than-lethal). Burst weapons wait their burst interval after each burst. "STK far" = shots needed at the weapon\'s minimum damage (past its falloff). Hover a row for its design-data row.'), table));
  draw();
}

const effInfo = desc => {
  const m = /^\s*<Color:([^>]*)>(.*?)<Color:[^>]*>(.*)$/is.exec(desc || '');
  if (!m) return { value: '', label: plain(desc), tone: '' };
  const c = ['R', 'G', 'B'].map(k => { const x = new RegExp('\\b' + k + '\\s*=\\s*([\\d.]+)', 'i').exec(m[1]); return x ? +x[1] : 0; });
  const value = plain(m[2]), label = plain(m[3]), text = !label && !/\d/.test(value);
  return { value: text ? '' : value, label: text ? value : label, tone: c[0] === 0 && c[1] === 1 && c[2] === 0 ? 'pos' : c[0] === 1 && c[1] === 0 && c[2] === 0 ? 'neg' : '' };
};
const textAdd = (t, mul, add, desc) => { if (t !== 121 || mul !== 1 || !add) return add; const m = /([+-]?\d+(?:\.\d+)?)\s*m\/s/i.exec(plain(desc)); return m ? +m[1] : add; };
const effKey = (t, mul, add) => `${t}${mul === 1 && add !== 0 ? 'a' : 'm'}`;
function combine(defs) {
  const by = new Map();
  for (const d of defs) for (const [t0, mul, add, desc] of d.eff) {
    const t = effKey(t0, mul, add), e = by.get(t) || { t, mul: 1, add: 0, n: 0, info: null, first: null };
    e.mul *= mul; e.add += textAdd(t0, mul, add, desc); e.n++;
    if (!e.info && plain(desc)) { e.info = effInfo(desc); e.first = [mul, add]; }
    by.set(t, e);
  }
  return by;
}
function effText(e, src) {
  if (!e) return '';
  const info = e.info || src.info, first = e.info ? e.first : src.first, num = /^([+-]?)(\d+(?:\.\d+)?)(%?)$/.exec(info.value.replace(/\s/g, ''));
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
  if (num && num[3] === '%' && first[0] !== 1) {
    const p = +(num[1] + num[2]), inv = num[1] && Math.sign(p) !== Math.sign(first[0] - 1);
    const v = inv ? Math.trunc((1 / e.mul - 1) * 100) : Math.round((e.mul - 1) * 100);
    return num[1] ? sgn(v) + '%' : Math.abs(v) + '%';
  }
  const unit = /^([+-]?)(\d+(?:\.\d+)?)\s*([^\d\s].*)$/.exec(info.value.replace(/\s/g, ''));
  if (!num && unit && first[0] === 1 && first[1] !== 0) return sgn(fx(e.add, 2)) + ' ' + unit[3];
  if (num && first[1] !== 0) { const p = +(num[1] + num[2]), inv = num[1] && Math.sign(p) !== Math.sign(first[1]); const v = fx(inv ? -e.add : e.add, 2); return (num[1] ? sgn(v) : String(Math.abs(v))) + num[3]; }
  return e.n > 1 ? `${info.value || '✓'} ×${e.n}` : info.value || '✓';
}

const VSTAT = [['health', 'Max Health', 1, 0], ['gun', 'Health vs gunfire', 1, 0], ['col', 'Health vs collisions', 1, 0], ['speed', 'Max Speed m/s', 1, 1], ['cargo', 'Cargo Capacity', 1, 0], ['expr', 'Explosion Radius m', 0, 1], ['emp', 'EMP Vulnerability %', -1, 0]];
const WSTAT = [['ttk', 'TTK s', -1, 3], ['stk', 'STK', -1, 0], ['far', 'STK far', -1, 0], ['dmg', 'Damage', 1, 1], ['hard', 'Hard damage', 1, 1], ['rpm', 'RPM', 1, 0], ['mag', 'Magazine', 1, 0], ['ammo', 'Ammo', 1, 0], ['reload', 'Reload s', -1, 2], ['equip', 'Equip s', -1, 2], ['range', 'Range m', 1, 1]];
const toWMod = d => ({ name: d.name, eff: d.eff.filter(e => WEFF[e[0]]).map(e => [WEFF[e[0]], e[1], e[2]]) });
function weaponAt(w, defs, builtIn) {
  const s = weaponStats(w.types[0], (builtIn ? w.mods : []).concat(defs.map(toWMod)), true, D.const), x = s.w;
  return { ttk: s.kind === 'explosive' ? null : s.ttk, stk: s.stk || null, far: s.farStk || null, dmg: (s.dmg || 0) * (s.rays || 1), hard: s.hard || 0, rpm: s.rpm || null, mag: x.mag, ammo: x.ammo, reload: x.reload, equip: x.equip, range: x.ramp ? x.ramp / 100 : null };
}
function vehicleAt(v0, defs, builtIn) {
  const v = vehicleStats(v0, builtIn);
  let health = v.health, speed = v.speed, cargo = v.cargo, gun = 1, col = 1, er = v.exp ? v.exp.r / 100 : null, emp = v.emp === undefined ? null : v.emp;
  for (const d of defs) for (const [t, mul, add, desc] of d.eff) {
    if (t === 118) health = health * mul + add; else if (t === 121) speed = speed * mul + textAdd(t, mul, add, desc); else if (t === 114) cargo = cargo * mul + add;
    else if (t === 16) gun *= mul; else if (t === 14) col *= mul; else if (t === 42 && er !== null) er *= mul; else if (t === 109 && emp !== null) emp *= mul;
  }
  return { health, gun: gun > 0 ? health / gun : null, col: col > 0 ? health / col : null, speed, cargo: Math.round(cargo), expr: er, emp: emp === null ? null : emp * 100 };
}

function buildCompare() {
  const root = $('#tab-compare');
  const st = store.get('compare', { kind: 'weapons', scope: 'cat', cat: 'Sub-Machine Guns', item: '', mods: { weapons: ['', '', ''], vehicles: ['', '', ''] }, base: true, changed: false });
  if (!st.sort) st.sort = { weapons: ['name', 1], vehicles: ['name', 1] };
  const save = () => store.set('compare', st);
  const ctl = h('div', { class: 'card glass' }), effBox = h('div'), out = h('div', { class: 'cmpgrid' });
  let limit = 30;
  const defsOf = () => D.modDefs[st.kind === 'weapons' ? 'weapon' : 'vehicle'];
  const items = () => (st.kind === 'weapons' ? D.weapons.filter(w => w.types[0] && !w.test && !w.event) : D.vehicles.filter(v => !v.test)).filter(x => !st.base || !x.mods.length);
  const catOf = x => (st.kind === 'weapons' ? x.cat : x.cls) || 'Other', grpOf = x => st.kind === 'weapons' ? catOf(x) : x.model || 'Other';
  const chosen = () => st.mods[st.kind].map(r => defsOf().find(d => d.row === r)).filter(Boolean);
  const modSelect = i => {
    const defs = defsOf(), dup = new Set(defs.map(d => d.name).filter((n, k, a) => a.indexOf(n) !== k));
    const label = d => d.name + (dup.has(d.name) ? ` (${d.row.replace(/^FnMod_(Weapon|Vehicle)_/, '')})` : '');
    const grp = d => d.cat.replace(/^(Weapon|Vehicle|Character)_/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'Other';
    const cur = defs.find(d => d.row === st.mods[st.kind][i]);
    const btn = h('button', { type: 'button', class: 'modbtn', html: cur ? `${iconSpan(cur.icon, 28)}<span>${label(cur)}</span><i>▾</i>` : '<span class="hint">— none —</span><i>▾</i>' });
    const pop = h('div', { class: 'modpop' }), q = h('input', { type: 'search', placeholder: 'Search modifications…' }), ul = h('div', { class: 'modlist' });
    const pick = row => { st.mods[st.kind][i] = row; save(); close(); drawCtl(); draw(); };
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
      pop.style.left = `${Math.min(r.left, window.innerWidth - 330)}px`;
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
      h('div', { class: 'row' }, seg([['weapons', 'Weapons'], ['vehicles', 'Vehicles']], st.kind, v => { st.kind = v; st.cat = ''; save(); drawCtl(); draw(); }),
        seg([['all', st.kind === 'weapons' ? 'All weapons' : 'All vehicles'], ['cat', 'Category'], ['item', st.kind === 'weapons' ? 'One weapon' : 'One vehicle']], st.scope, v => { st.scope = v; save(); drawCtl(); draw(); }),
        st.scope === 'cat' ? h('select', { onchange: e => { st.cat = e.target.value; save(); draw(); } }, cats.map(c => h('option', { value: c, selected: c === st.cat }, `${c} (${list.filter(x => catOf(x) === c).length})`))) : null,
        st.scope === 'item' ? h('select', { onchange: e => { st.item = e.target.value; save(); draw(); } }, [...new Set(list.map(grpOf))].sort().map(c => h('optgroup', { label: c }, list.filter(x => grpOf(x) === c).sort((a, b) => plain(a.name).localeCompare(plain(b.name))).map(x => h('option', { value: x.row, selected: x.row === st.item }, plain(x.name)))))) : null),
      h('div', { class: 'row modslots' }, [0, 1, 2].map(i => h('label', { class: 'slot' }, h('span', { class: 'hint' }, `Slot ${i + 1}`), modSelect(i)))),
      h('div', { class: 'row' }, toggle(st.kind === 'weapons' ? 'Base weapons only (no built-in mods)' : 'Base vehicles only (no built-in mods)', st.base, v => { st.base = v; save(); drawCtl(); draw(); }),
        toggle('Only stats that change', st.changed, v => { st.changed = v; save(); draw(); }),
        st.scope !== 'item' ? sortCtl([['name', 'Name']].concat((st.kind === 'weapons' ? WSTAT : VSTAT).map(([k, l]) => [k, l])), ...st.sort[st.kind], (k, d) => { st.sort[st.kind] = [k, d]; save(); drawCtl(); draw(); }) : null,
        h('span', { class: 'hint' }, `${pool.length} ${st.kind}`)));
  };
  const cell = (val, prev, dir, dec) => {
    if (val === null || val === undefined) return h('td', {}, '–');
    const v = fx(val, dec), p = prev === null || prev === undefined ? null : fx(prev, dec);
    const cls = p === null || v === p || !dir ? '' : (v - p) * dir > 0 ? 'up' : 'down';
    return h('td', { class: cls }, String(v), cls ? h('small', {}, ` ${v > p ? '▲' : '▼'}`) : null);
  };
  const draw = () => {
    const defs = chosen(), steps = [[]].concat(defs.map((d, k) => defs.slice(0, k + 1)));
    const heads = ['No mods'].concat(defs.map((d, k) => `${k + 1} slot${k ? 's' : ''}: ${k ? '+ ' : ''}${d.name}`));
    const eff = steps.map(combine), types = [...new Set(defs.flatMap(d => d.eff.filter(e => plain(e[3])).map(e => effKey(e[0], e[1], e[2]))))];
    effBox.replaceChildren(defs.length ? h('div', { class: 'card glass' }, h('h3', {}, 'Combined effects'),
      h('table', { class: 'grid cmp' }, h('thead', {}, h('tr', {}, h('th', {}, 'Effect'), heads.map(x => h('th', {}, x)))),
        h('tbody', {}, types.map(t => { const src = eff.map(m => m.get(t)).find(e => e && e.info), info = src.info;
          return h('tr', {}, h('td', { class: 'nm ' + info.tone }, info.label || info.value), eff.map(m => h('td', { class: m.get(t) ? info.tone : '' }, m.get(t) ? effText(m.get(t), src) : '–'))); }))),
      h('p', { class: 'hint' }, 'Green = an improvement, red = a drawback, as the game colours them. Values of the same effect multiply (e.g. two fire-rate mods); words such as "Substantially" are the game\'s own wording.')) : h('p', { class: 'hint' }, 'Pick at least one modification above.'));
    const list = items(), pool = (st.scope === 'cat' ? list.filter(x => catOf(x) === st.cat) : st.scope === 'item' ? list.filter(x => x.row === st.item) : list)
      .sort((a, b) => plain(a.name).localeCompare(plain(b.name)));
    const STAT = st.kind === 'weapons' ? WSTAT : VSTAT, at = st.kind === 'weapons' ? weaponAt : vehicleAt, [sk, sd] = st.sort[st.kind];
    const all = pool.map(x => ({ x, vals: steps.map(s => at(x, s, !st.base)) }));
    if (sk !== 'name') { const val = r => r.vals[r.vals.length - 1][sk], ok = v => v !== null && v !== undefined && !Number.isNaN(v); all.sort((a, b) => !ok(val(a)) ? (ok(val(b)) ? 1 : 0) : !ok(val(b)) ? -1 : (val(a) - val(b)) * sd); }
    else if (sd < 0) all.reverse();
    out.innerHTML = '';
    for (const { x, vals } of all.slice(0, limit)) {
      const rows = STAT.filter(([k]) => vals.some(v => v[k] !== null && v[k] !== undefined)).filter(([k, , , dec]) => !st.changed || new Set(vals.map(v => fx(v[k], dec))).size > 1);
      out.append(h('div', { class: 'card glass cmpcard' },
        h('div', { class: 'cmphead', html: `${x.icon ? iconSpan(x.icon, 32) : ''}<div><b>${plain(x.name)}</b><small class="hint">${catOf(x)}${x.mods.length ? ' · built-in: ' + x.mods.map(m => m.name).join(', ') : ''}</small></div>` }),
        rows.length ? h('table', { class: 'grid cmp' }, h('thead', {}, h('tr', {}, h('th', {}, 'Stat'), heads.map((t, k) => h('th', { title: t }, k ? `${k} slot${k > 1 ? 's' : ''}` : 'No mods')))),
          h('tbody', {}, rows.map(([k, label, dir, dec]) => h('tr', {}, h('td', { class: 'nm' }, label), vals.map((v, i) => cell(v[k], i ? vals[i - 1][k] : null, dir, dec))))))
          : h('p', { class: 'hint' }, 'None of the computed stats change; see the combined effects above.')));
    }
    if (pool.length > limit) out.append(h('button', { class: 'more', onclick: () => { limit += 30; draw(); } }, `Show more (${pool.length - limit} left)`));
    if (!pool.length) out.append(h('p', { class: 'hint' }, 'Nothing in this selection.'));
  };
  root.append(ctl, effBox, out);
  drawCtl(); draw();
}

main();
