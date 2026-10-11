import { $, $$, h, esc, data, setNamed, named, render, seg, toggle, colourPick, FONTS, buildFile, saveFile, readFile, store, hex2rgb, rgb2hex, apbTag, nearestNamed, colourText, fl, hsl } from './core.js';
import { GENS, stripTags } from './gen.js';
import { weaponStats, vehicleStats } from './stats.js';
import { initEditor } from './editor.js';
import { initCategories } from './categories.js';
import { initPresets } from './presets.js';
import { folderBar, findLoc, readLoc, onFolder, inGame, hasConfig } from './folder.js';
import { watch, refUrl, iconSpan } from './assets.js';

let D;
const TABS = { presets: 'Presets', gen: 'Generators', categories: 'Categories', colours: 'Colours', editor: 'Editor', tables: 'Stat tables' };

async function main() {
  try { D = await data(); } catch (e) { $('#main').textContent = 'Could not load the game data: ' + e.message; return; }
  setNamed(D.colours);
  $('#folderbar').append(folderBar());
  watch();
  for (const [v, ref] of [['--hudbg', 'APBMenus_Art_GameFlowScenes.NewBackgroundImage'], ['--mapbg', 'APBMenus_Art_MiniMap.MiniMap_Default']])
    refUrl(ref).then(u => { if (u) document.documentElement.style.setProperty(v, `url(${u})`); });
  onFolder(() => { if (current && /^#?gen/.test(location.hash || '#gen')) openGen(current); });
  $('.headrow h1').append(h('span', { class: 'dbver' }, `DB Version ${D.apbdb ? D.apbdb.version : D.build || 'game data'}`));
  const tabs = $('#tabs');
  Object.entries(TABS).forEach(([id, label]) => tabs.append(h('button', { 'data-tab': id, onclick: () => go(id) }, label)));
  window.addEventListener('hashchange', route); route();
}
function go(id, sub) { location.hash = sub ? `${id}/${sub}` : id; }
const built = {};
function route() {
  const [tab, sub] = (location.hash.slice(1) || 'presets').split('/');
  const t = TABS[tab] ? tab : 'presets';
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.tab').forEach(x => x.hidden = x.id !== 'tab-' + t);
  if (!built[t]) { built[t] = true; ({ presets: () => initPresets($('#tab-presets'), D), gen: buildGen, categories: () => initCategories($('#tab-categories'), D), colours: buildColours, editor: () => initEditor($('#tab-editor')), tables: buildTables })[t](); }
  if (t === 'gen') showGen(sub);
}

function showGen(id) {
  const g = GENS.find(x => x.id === id) || GENS[0];
  $$('#genlist button').forEach(b => b.classList.toggle('on', b.dataset.id === g.id));
  openGen(g);
}
function buildGen() {
  const list = $('#genlist'); let grp = '';
  GENS.forEach(g => {
    if (g.group !== grp) { grp = g.group; list.append(h('div', { class: 'grp' }, grp)); }
    list.append(h('button', { 'data-id': g.id, onclick: () => go('gen', g.id) }, g.title, h('small', {}, g.file)));
  });
}

const S = {};
let current = null, baseFile = {}, limit = 60;
function openGen(g) {
  current = g; limit = 60;
  S[g.id] = store.get('gen-' + g.id, structuredClone(g.defaults));
  const s = S[g.id], box = $('#genbox'); box.innerHTML = '';
  const save = () => { store.set('gen-' + g.id, s); refresh(); };
  const ctl = $('#genctl'); ctl.innerHTML = '';
  ctl.append(h('h2', {}, g.title), h('p', { class: 'hint' }, g.help), h('p', { class: 'hint' }, 'File: ', h('code', {}, g.file), g.kind === 'hud' ? ' · HUD text (named colours)' : ' · UI text (any colour)'));
  for (const c of g.controls) ctl.append(control(g, s, c, save));
  ctl.append(h('div', { class: 'row' }, h('button', { onclick: () => { S[g.id] = structuredClone(g.defaults); store.set('gen-' + g.id, S[g.id]); openGen(g); } }, 'Reset settings')));
  const fileIn = h('input', { type: 'file', accept: '.int,.ger,.INT,.GER,.txt,.ini,.fra,.rus,.pol,.esn,.ita,.ini' });
  const fname = h('input', { type: 'text', value: (baseFile[g.id] && baseFile[g.id].name) || `${g.file}.GER`, class: 'fname' });
  const fromDir = !baseFile[g.id] && findLoc(g.file);
  if (fromDir && !baseFile[g.id]) fname.value = g.file + '.GER';
  const info = h('span', { class: 'hint' }, baseFile[g.id] ? `Merging into ${baseFile[g.id].name}` : fromDir ? `Merging into ${fromDir.path} from your game folder${fromDir.lang === 'INT' ? ' (no GER copy yet: the English file is the base, saved as GER)' : ''}.` : 'No file: download a new file with only these lines.');
  fileIn.onchange = async () => { const f = fileIn.files[0]; if (!f) return; baseFile[g.id] = await readFile(f); fname.value = f.name; info.textContent = `Merging into ${f.name} (${baseFile[g.id].enc}${baseFile[g.id].fixed ? ', ' + baseFile[g.id].fixed + ' broken line ends repaired' : ''})`; };
  box.append(h('div', { class: 'card glass out' }, h('h3', {}, 'Output'),
    h('label', { class: 'drop' }, fileIn, '📄 ', h('span', {}, 'Optional: your ', h('b', {}, g.file), ' file to merge into (changed lines are replaced, missing ones added)')),
    h('div', { class: 'row' }, fname, h('button', { class: 'primary', onclick: () => out(g, fname.value) }, 'Download'),
      h('button', { onclick: e => copyLines(g, e.target) }, 'Copy lines'), h('button', { onclick: () => { delete baseFile[g.id]; openGen(g); } }, 'Clear file')), info, h('div', { id: 'outinfo', class: 'hint' })));
  const q = h('input', { type: 'search', placeholder: 'Search name or key…', id: 'genq', oninput: () => { limit = 60; preview(); } });
  const orig = h('label', { class: 'opt' }, h('input', { type: 'checkbox', id: 'genorig', onchange: preview }), 'Show the game\'s text');
  const mine = h('label', { class: 'opt', id: 'genmine-l', hidden: !hasConfig(), title: 'Your current line from your config / game folder, as it shows in game' }, h('input', { type: 'checkbox', id: 'genmine', checked: hasConfig(), onchange: preview }), 'Show your in-game text');
  box.append(h('div', { class: 'row prevbar' }, q, orig, mine, h('span', { id: 'gencount', class: 'hint' })), h('div', { id: 'prev' }));
  refresh();
}
let ITEMS = [];
function refresh() { const s = S[current.id]; ITEMS = current.items(D, s); preview(); const ch = ITEMS.filter(x => x.value !== undefined).length; $('#outinfo').textContent = `${ch} line${ch === 1 ? '' : 's'} to write.`; }
let MINE = null;
onFolder(() => { const l = $('#genmine-l'); if (l) { l.hidden = !hasConfig(); $('#genmine').checked = hasConfig(); } if (current) { MINE = null; preview(); } });
function preview() {
  if (MINE && MINE.file !== current.file) MINE = null;
  const q = ($('#genq').value || '').toLowerCase(), showOrig = $('#genorig').checked, showMine = $('#genmine') && $('#genmine').checked && hasConfig(), box = $('#prev');
  if (showMine && !MINE) { if (hasConfig()) inGame(current.file).then(m => { if (m.has) { MINE = { ...m, file: current.file }; preview(); } }); }
  const list = ITEMS.filter(x => !x.test && (!q || (x.name + ' ' + x.key + ' ' + x.sub).toLowerCase().includes(q)));
  $('#gencount').textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
  box.innerHTML = '';
  for (const x of list.slice(0, limit)) {
    const changed = x.value !== undefined;
    box.append(h('div', { class: 'tip' + (x.child ? ' child' : '') + (current.kind === 'hud' ? ' hud' : '') },
      x.child ? null : h('div', { class: 'tiphead' + (x.icon ? ' withicon' : '') }, x.icon ? h('span', { html: iconSpan(x.icon, 40, 'tipicon') }) : null, h('div', {}, h('b', { html: render(x.name) }), h('span', { class: 'hint' }, x.sub))),
      x.child ? h('div', { class: 'hint' }, x.sub) : null,
      h('div', { class: 'tipbody' + (changed ? '' : ' same'), html: render(changed ? x.value : x.orig) || '<span class="hint">(empty)</span>' }),
      showMine && MINE ? (v => h('div', { class: 'tipbody mine' + (v === undefined ? ' none' : ''), title: 'Your in-game text', html: v === undefined ? '<span class="hint">(not in your files: the game shows its default)</span>' : render(v) || '<span class="hint">(empty)</span>' }))(MINE.value(x.key)) : null,
      showOrig && changed ? h('div', { class: 'tipbody orig', html: render(x.orig) }) : null,
      h('code', { class: 'key', title: changed ? x.value : 'unchanged' }, x.key, changed ? '' : '  · unchanged')));
  }
  if (list.length > limit) box.append(h('button', { class: 'more', onclick: () => { limit += 120; preview(); } }, `Show more (${list.length - limit} left)`));
}
function linesOf(g) { return ITEMS.filter(x => x.value !== undefined).map(x => [x.key, x.value, x.section]); }
async function out(g, name) {
  const lines = linesOf(g);
  if (!lines.length) { $('#outinfo').textContent = 'Nothing to write: every line is set to Vanilla.'; return; }
  const dir = !baseFile[g.id] && findLoc(g.file);
  let file = baseFile[g.id] || (dir ? await readLoc(dir) : null), rep = 0, add = 0;
  const bySec = new Map(); lines.forEach(([k, v, sct]) => { const s = sct || g.file; if (!bySec.has(s)) bySec.set(s, []); bySec.get(s).push([k, v]); });
  for (const [sct, ls] of bySec) { const r = buildFile(sct, ls, file); file = { name: name, text: r.text, enc: r.enc, bom: r.bom }; rep += r.replaced; add += r.added; }
  saveFile(file, name || g.file + '.GER');
  $('#outinfo').textContent = baseFile[g.id] || dir ? `Saved ${name}: ${rep} lines replaced, ${add} added.` : `Saved ${name}: ${add} lines.`;
}
function copyLines(g, btn) {
  const t = linesOf(g).map(([k, v]) => `${k}=${v}`).join('\r\n');
  navigator.clipboard.writeText(t).then(() => { btn.textContent = 'Copied'; setTimeout(() => btn.textContent = 'Copy lines', 1200); });
}

function field(label, ...el) { return h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'fv' }, ...el)); }
function control(g, s, c, save) {
  const [type, key, label, opts] = c;
  if (type === 'seg') return field(label, seg(opts.map(o => [String(o[0]), o[1], o[2]]), String(s[key]), v => { s[key] = typeof opts[0][0] === 'number' ? +v : v; save(); }));
  if (type === 'toggle') return toggle(label, s[key], v => { s[key] = v; save(); });
  if (type === 'colour') return field(label, colourPick(g.kind, s[key], v => { s[key] = v; save(); }));
  if (type === 'font') return field(label, h('select', { onchange: e => { s[key] = e.target.value; save(); } }, h('option', { value: '' }, 'Game default'), FONTS.map(f => h('option', { value: f, selected: s[key] === f }, f.split('.').pop().replace(/_/g, ' ')))));
  if (type === 'checks') return field(label, h('div', { class: 'checks' }, opts.map(([k, l]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s[key][k], onchange: e => { s[key][k] = e.target.checked; save(); } }), l))));
  if (type === 'texts') return h('div', {}, opts.map(([k, l]) => field(l, h('input', { type: 'text', value: s[key][k], oninput: e => { s[key][k] = e.target.value; save(); } }))));
  if (type === 'grad') return gradCtl(s, key, label, save);
  if (type === 'groups') return groupsCtl(g, s, save);
  return h('div');
}
function gradCtl(s, p, label, save) {
  const wrap = h('div', { class: 'grad' });
  const draw = () => {
    wrap.innerHTML = '';
    wrap.append(field(label, seg([['solid', 'Solid'], ['stepped', 'Stepped'], ['smooth', 'Smooth'], ['triple', 'Triple'], ['rainbow', 'Rainbow']], s[p + 'mode'], v => { s[p + 'mode'] = v; save(); draw(); })));
    const m = s[p + 'mode'], cols = m === 'rainbow' ? 0 : m === 'solid' ? 1 : m === 'triple' ? 3 : 2;
    const cs = []; for (let i = 1; i <= cols; i++) cs.push(colourPick('ui', s[p + i], v => { s[p + i] = v; save(); }));
    if (cs.length) wrap.append(field(cols === 1 ? 'Colour' : 'Colours', ...cs));
    if (m === 'stepped') wrap.append(field('Steps', h('input', { type: 'number', min: 2, max: 12, value: s[p + 'steps'], oninput: e => { s[p + 'steps'] = +e.target.value; save(); } })));
  };
  draw(); return wrap;
}
function groupsCtl(g, s, save) {
  const groups = g.groups(D), wrap = h('div', { class: 'groups' });
  const ed = h('div', { class: 'grpedit card glass' });
  const pick = name => {
    s.sel = name; const gs = s.groups[name] = s.groups[name] || { on: false, gmode: 'solid', g1: '#ffb000', g2: '#ff3d3d', g3: '#7a5cff', gsteps: 3 };
    ed.innerHTML = ''; ed.append(h('h3', {}, name), toggle('Colour this group', gs.on, v => { gs.on = v; save(); list(); }), gradCtl(gs, 'g', 'Style', () => { gs.on = true; save(); list(); }));
    list();
  };
  const ul = h('div', { class: 'grplist' });
  const list = () => {
    ul.innerHTML = '';
    groups.forEach(([name, cnt]) => {
      const gs = s.groups[name], sw = gs && gs.on ? (gs.gmode === 'rainbow' ? 'linear-gradient(90deg,red,orange,yellow,lime,cyan,blue,magenta)' : `linear-gradient(90deg,${gs.g1},${gs.gmode === 'solid' ? gs.g1 : gs.g2}${gs.gmode === 'triple' ? ',' + gs.g3 : ''})`) : 'transparent';
      ul.append(h('button', { class: s.sel === name ? 'on' : '', onclick: () => pick(name) }, h('span', { class: 'gsw', style: `background:${sw}` }), name, h('small', {}, cnt)));
    });
  };
  wrap.append(h('div', { class: 'row' }, h('button', { onclick: () => { groups.forEach(([n]) => { const gs = s.groups[n] = s.groups[n] || { on: false, gmode: 'solid', g1: '#ffb000', g2: '#ff3d3d', g3: '#7a5cff', gsteps: 3 }; gs.on = true; }); save(); pick(s.sel); } }, 'Enable all'),
    h('button', { onclick: () => { Object.values(s.groups).forEach(gs => gs.on = false); save(); pick(s.sel); } }, 'Disable all')), ul, ed);
  pick(s.sel || groups[0][0]);
  return wrap;
}

function buildColours() {
  const root = $('#tab-colours');
  const st = store.get('colours', { hex: '#ff9900', a: 1, text: 'APB Reloaded', mode: 'smooth', 1: '#ffb000', 2: '#ff3d3d', 3: '#7a5cff', steps: 3, kind: 'ui', font: '' });
  const save = () => store.set('colours', st);
  const picker = h('input', { type: 'color', value: st.hex }), txt = h('input', { type: 'text', value: st.hex, placeholder: '#FF9900, 255 153 0, 1 0.6 0, <Color:R=1 G=0.6 B=0>' });
  const alpha = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: st.a }), outs = h('div', { class: 'outs' });
  const parse = v => {
    v = v.trim(); let m;
    if (hex2rgb(v)) return hex2rgb(v);
    if ((m = /R\s*=\s*([\d.]+)\s*G\s*=\s*([\d.]+)\s*B\s*=\s*([\d.]+)/i.exec(v))) return [m[1], m[2], m[3]].map(x => +x * 255);
    const nums = v.match(/-?[\d.]+/g); if (!nums || nums.length < 3) return null;
    const c = nums.slice(0, 3).map(Number); return c.every(x => x <= 1) ? c.map(x => x * 255) : c.every(x => x <= 255) ? c : null;
  };
  const show = c => {
    st.hex = rgb2hex(c); picker.value = st.hex; save();
    const near = nearestNamed(c), a = +alpha.value;
    const rows = [['UI text tag', apbTag(c, a < 1 ? a : null)], ['UI text tag + close', apbTag(c, a < 1 ? a : null) + 'Text<Color:/>'], ['Image tint', `<ImageColour:R=${fl(c[0] / 255)} G=${fl(c[1] / 255)} B=${fl(c[2] / 255)}${a < 1 ? ' A=' + fl(a) : ''}>`],
      ['HEX', st.hex.toUpperCase()], ['RGB', c.map(Math.round).join(', ')], ['HUD text (nearest name)', `<col:${near.name}>Text</col>`]];
    outs.innerHTML = '';
    rows.forEach(([l, v]) => outs.append(h('div', { class: 'orow' }, h('span', { class: 'hint' }, l), h('code', {}, v), h('button', { onclick: e => copy(v, e.target) }, 'Copy'))));
    outs.append(h('div', { class: 'orow' }, h('span', { class: 'hint' }, 'Nearest game colour'), h('span', { class: 'cswatch big', style: `background:${rgb2hex(near.rgba)}` }), h('span', {}, near.name, ' ', h('span', { class: 'hint' }, near.rgba.slice(0, 3).join(', ')))));
  };
  picker.oninput = () => { txt.value = picker.value; show(hex2rgb(picker.value)); };
  txt.oninput = () => { const c = parse(txt.value); if (c) show(c); };
  alpha.oninput = () => { st.a = +alpha.value; save(); show(hex2rgb(st.hex)); };
  const conv = h('section', { class: 'card glass' }, h('h3', {}, 'Colour converter'), h('div', { class: 'row' }, picker, txt), field('Alpha', alpha), outs,
    h('p', { class: 'hint' }, 'UI text files (item, weapon, role, interface text) take any colour with <Color:R G B A> (0–1 values). HUD text files (HUDMessages, TaskObjectives, DailyActivityContacts, PopupDialogs…) only take the game\'s colour names with <col:Name>.'));
  show(hex2rgb(st.hex));

  const input = h('textarea', { rows: 3 }, st.text), output = h('textarea', { rows: 5, readonly: true }), pv = h('div', { class: 'gamebox' }), info = h('div', { class: 'hint' });
  const ctl = h('div');
  const gen = () => {
    st.text = input.value; save();
    const stops = [st[1], st[2]].concat(st.mode === 'triple' ? [st[3]] : []).map(hex2rgb);
    const o = colourText(input.value.replace(/\r?\n/g, '↵'), { mode: st.mode === 'triple' ? 'smooth' : st.mode, stops, steps: st.steps, kind: st.kind, font: st.font });
    output.value = o; pv.innerHTML = render(o); info.textContent = `${o.length} characters`;
  };
  const drawCtl = () => {
    ctl.innerHTML = '';
    ctl.append(field('For', seg([['ui', 'UI text <Color:>'], ['hud', 'HUD text <col:>']], st.kind, v => { st.kind = v; save(); drawCtl(); gen(); })),
      gradCtl(st, '', 'Style', () => { save(); gen(); }));
    if (st.kind === 'ui') ctl.append(field('Font', h('select', { onchange: e => { st.font = e.target.value; save(); gen(); } }, h('option', { value: '' }, 'Game default'), FONTS.map(f => h('option', { value: f, selected: st.font === f }, f.split('.').pop().replace(/_/g, ' '))))));
    else ctl.append(h('p', { class: 'hint' }, 'HUD text can only use named colours, so each colour is replaced by the nearest game colour name; smooth gradients get coarse.'));
  };
  drawCtl(); input.oninput = gen;
  const grad = h('section', { class: 'card glass' }, h('h3', {}, 'Gradient maker'), field('Text', input), ctl, h('div', { class: 'row' }, h('button', { class: 'primary', onclick: e => copy(output.value, e.target) }, 'Copy output'), info), output, h('label', { class: 'hint' }, 'Preview'), pv,
    h('p', { class: 'hint' }, 'Line breaks become ↵ (the game\'s line break). Spaces stay uncoloured, runs of the same colour share one tag. Existing tags in the text are kept.'));
  gen();

  const q = h('input', { type: 'search', placeholder: 'Search colour names…' }), grid = h('div', { class: 'cgrid' });
  const draw = () => {
    grid.innerHTML = ''; const t = q.value.toLowerCase();
    named().filter(n => !t || n.name.toLowerCase().includes(t)).forEach(n => {
      const v = `<col:${n.name}>`;
      grid.append(h('button', { class: 'cell', title: `${n.kind === 'profile' ? 'Colour profile' : 'HUD colour'} · RGBA ${n.rgba.join(', ')} · click to copy ${v}`, onclick: e => copy(v, e.currentTarget.querySelector('b')) },
        h('span', { class: 'cswatch big', style: `background:rgba(${n.rgba.slice(0, 3).join(',')},${n.rgba[3] / 255})` }), h('b', {}, n.name), h('small', {}, n.kind === 'profile' ? 'profile' : rgb2hex(n.rgba).toUpperCase())));
    });
  };
  q.oninput = draw; draw();
  const names = h('section', { class: 'card glass wide' }, h('h3', {}, 'Game colour names for <col:…>'), h('p', { class: 'hint' }, 'From the game\'s HUDColour and HUDColourProfiles tables (current client). Names are not case-sensitive; the game\'s own files also write them with a space, e.g. <col: Yellow>. Close with </col>.'), q, grid);
  root.append(h('div', { class: 'cols2' }, conv, grad), names);
}
function copy(text, el) { navigator.clipboard.writeText(text).then(() => { if (!el) return; const o = el.textContent; el.textContent = 'Copied'; setTimeout(() => el.textContent = o, 1000); }); }

function buildTables() {
  const root = $('#tab-tables'); const st = store.get('tables', { kind: 'weapons', mods: true, test: false, sort: 'ttk', dir: 1, q: '' });
  const save = () => store.set('tables', st);
  const q = h('input', { type: 'search', placeholder: 'Filter by name, category or row…', value: st.q, oninput: () => { st.q = q.value; save(); draw(); } });
  const table = h('div', { class: 'tbl' });
  const W = [['name', 'Weapon'], ['cat', 'Category'], ['ttk', 'TTK s'], ['stk', 'STK'], ['far', 'STK far'], ['dmg', 'Damage'], ['hard', 'Hard'], ['rpm', 'RPM'], ['mag', 'Mag'], ['ammo', 'Ammo'], ['reload', 'Reload s'], ['equip', 'Equip s'], ['range', 'Range m'], ['mods', 'Built-in mods']];
  const V = [['name', 'Vehicle'], ['model', 'Model'], ['health', 'Max Health'], ['speed', 'Max Speed m/s'], ['rev', 'Max Reverse Speed m/s'], ['cargo', 'Cargo Capacity'], ['exp', 'Explosion Max Damage'], ['expr', 'Explosion Radius m'], ['emp', 'EMP Vulnerability %'], ['mods', 'Built-in mods']];
  const rowsW = () => D.weapons.filter(w => w.types[0] && (st.test || !w.test)).map(w => {
    const s = weaponStats(w.types[0], w.mods, st.mods, D.const), x = s.w;
    return { name: w.name, cat: w.cat, row: w.row, ttk: s.kind === 'explosive' ? null : +s.ttk.toFixed(3), stk: s.stk, far: s.farStk || null, dmg: +(s.dmg || 0).toFixed(1) + (s.rays > 1 ? ' x' + s.rays : ''), _dmg: (s.dmg || 0) * (s.rays || 1),
      hard: +(s.hard || 0).toFixed(1), rpm: s.rpm ? Math.round(s.rpm) : null, mag: x.mag, ammo: x.ammo, reload: +x.reload.toFixed(2), equip: +x.equip.toFixed(2), range: x.ramp ? +(x.ramp / 100).toFixed(1) : null, mods: (st.mods ? x.modNames : w.mods.map(m => m.name)).join(', '), lt: w.types[0].ltl && s.kind !== 'explosive' };
  });
  const rowsV = () => D.vehicles.filter(v => st.test || !v.test).map(v0 => { const v = vehicleStats(v0, st.mods); return { name: v.name, model: v.model, row: v.row, health: v.health, speed: v.speed, rev: v.rev, cargo: v.cargo, exp: v.exp ? v.exp.dmg : null, expr: v.exp ? +(v.exp.r / 100).toFixed(1) : null, emp: v.emp !== undefined ? Math.round(v.emp * 100) : null, mods: v.modNames.join(', ') }; });
  const draw = () => {
    const cols = st.kind === 'weapons' ? W : V, t = st.q.toLowerCase();
    let rows = (st.kind === 'weapons' ? rowsW() : rowsV()).filter(r => !t || `${r.name} ${r.cat || r.model} ${r.row}`.toLowerCase().includes(t));
    const sk = st.sort === 'dmg' ? '_dmg' : st.sort;
    rows.sort((a, b) => { const x = a[sk], y = b[sk]; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir; });
    table.innerHTML = '';
    const head = h('tr', {}, cols.map(([k, l]) => h('th', { class: st.sort === k ? 'sorted' : '', onclick: () => { st.dir = st.sort === k ? -st.dir : 1; st.sort = k; save(); draw(); } }, l, st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : '')));
    const body = rows.slice(0, 1500).map(r => h('tr', { title: r.row }, cols.map(([k]) => h('td', { class: k === 'name' ? 'nm' : '' }, r[k] === null || r[k] === undefined ? '–' : r[k], k === 'ttk' && r.lt ? h('small', { class: 'hint' }, ' stun') : null))));
    table.append(h('table', { class: 'grid' }, h('thead', {}, head), h('tbody', {}, body)), h('p', { class: 'hint' }, `${rows.length} rows`));
  };
  root.append(h('div', { class: 'card glass' }, h('div', { class: 'row' }, seg([['weapons', 'Weapons'], ['vehicles', 'Vehicles']], st.kind, v => { st.kind = v; st.sort = v === 'weapons' ? 'ttk' : 'health'; save(); draw(); }), q,
    toggle('Built-in modifications', st.mods, v => { st.mods = v; save(); draw(); }), toggle('Gun Game / event items', st.test, v => { st.test = v; save(); draw(); })),
    h('p', { class: 'hint' }, 'TTK = time from the first to the last shot needed (all pellets hit, no misses, 1000 health / 1000 stamina for less-than-lethal). Burst weapons wait their burst interval after each burst. "STK far" = shots needed at the weapon\'s minimum damage (past its falloff). Hover a row for its design-data row name.'), table));
  draw();
}

main();
