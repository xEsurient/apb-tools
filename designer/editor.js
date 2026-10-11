import { $, h, render, readFile, saveFile, colourPick, seg, colourText, hex2rgb, intValue, store, FONTS } from './core.js';
import { LOC, readLoc, onFolder, inGame } from './folder.js';

const HUD = /^(hudmessages|taskobjectives|dailyactivitycontacts|popupdialogs|hudconstantstring|taskoperationuiprofile)$/i;
const PAGE = 100;
const CTX = [[/^(streetname|districtblocks|locationbeaconinstances)$/, 'map'],
  [/^(hudmessages|hudcombatmessages|taskobjectives|dailyactivitycontacts|hudconstantstring|tasktargettypes|hudmarkervisual|hudmarkervisualtext|hudceremonymsg|popupdialogs)$/, 'hud'],
  [/^(weaponitemtypes|vehicleitemtypes|modifieritemtypes|inventoryitemtypes|playerroles|rolemilestones|contacts|contactlevels|clothingitemtypes|equipmenttypes|missiontemplates)$/, 'tip'],
  [/^(shopuifilters|inventoryiteminfracategories)$/, 'list'], [/^chatmessagecategories$/, 'chat']];
const ctxOf = name => { const st = String(name || '').replace(/\.[^.]+$/, '').toLowerCase(); return (CTX.find(([re]) => re.test(st)) || [0, 'plain'])[1]; };
function ctxView(ctx, key, val) {
  const html = render(val) || '<span class="hint">(empty)</span>';
  if (ctx === 'map') return h('div', { class: 'gamebox small map streetmap one' }, h('span', { class: 'lbl', style: 'left:50%;top:50%', html }));
  if (ctx === 'hud') return h('div', { class: 'gamebox small hud', html });
  if (ctx === 'tip') return h('div', { class: 'tip edtip' }, h('div', { class: 'tipbody', html }));
  if (ctx === 'list') return h('div', { class: 'invtabs edlist' }, h('div', { class: 'invtab on' }, h('span', { class: 'invlabel', html })));
  if (ctx === 'chat') return h('div', { class: 'gamebox small hud', html: /_Tag$/.test(key) ? `${render('[' + val + ']')} <span style="color:#ebebeb">Player: hello</span>` : html });
  return h('div', { class: 'gamebox small', html });
}
const CTX_NAME = { map: 'map labels', hud: 'HUD', tip: 'tooltip', list: 'filter list', chat: 'chat', plain: 'plain text' };

export function initEditor(root) {
  let F = null, rows = [], view = [], page = 0, undo = [], GAME = null;
  const st = store.get('editor', { colour: '#ffb000', hud: 'Yellow', mode: 'solid', 1: '#ffb000', 2: '#ff3d3d', 3: '#7a5cff', steps: 3, font: '' });
  const save = () => store.set('editor', st);
  const fileIn = h('input', { type: 'file', accept: '.int,.ger,.INT,.GER,.txt,.ini,.fra,.rus,.pol,.esn,.ita' });
  const q = h('input', { type: 'search', placeholder: 'Search keys and text (use /regex/ for a pattern)…' });
  const secSel = h('select', {}, h('option', { value: '' }, 'All sections'));
  const showGame = h('input', { type: 'checkbox', onchange: () => draw() }), onlyCh = h('input', { type: 'checkbox' }), status = h('span', { class: 'hint' }), table = h('div', { id: 'edtable' }), pager = h('div', { class: 'row' });
  const findIn = h('input', { type: 'text', placeholder: 'Find (text or /regex/)' }), repIn = h('input', { type: 'text', placeholder: 'Replace with ($1 for groups)' });
  const kind = () => F && HUD.test(F.name.replace(/\.[^.]+$/, '')) ? 'hud' : 'ui';
  const tools = h('div', { class: 'card glass', hidden: true });

  const load = async src => {
    F = src; undo = [];
    const lines = F.text.split(/\r\n|\n|\r/); let sec = ''; rows = [];
    lines.forEach((l, i) => {
      const s = l.trim();
      if (s.startsWith('[') && s.endsWith(']')) { sec = s.slice(1, -1); return; }
      const eq = l.indexOf('=');
      if (eq > 0 && !s.startsWith(';')) { let v = l.slice(eq + 1); if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); rows.push({ i, sec, key: l.slice(0, eq), val: v, orig: v }); }
    });
    F.lines = lines;
    secSel.innerHTML = ''; secSel.append(h('option', { value: '' }, 'All sections'), [...new Set(rows.map(r => r.sec))].map(s => h('option', { value: s }, s)));
    GAME = null; const stem = F.name.replace(/\.[^.]+$/, '');
    inGame(stem).then(g => { GAME = g.base.size ? g.base : null; if (showGame.checked) draw(); });
    tools.hidden = false; drawTools(); filter();
  };
  fileIn.onchange = async () => { const f = fileIn.files[0]; if (f) await load(await readFile(f)); };
  const dirSel = h('select', { onchange: async () => { const x = LOC.files[+dirSel.value]; if (x) { const r = await readLoc(x); await load({ ...r, name: x.name }); } } });
  const fillDir = () => {
    dirSel.innerHTML = '';
    const groups = [['zip', 'GER', 'Your config · GER'], ['zip', 'INT', 'Your config · INT'], ['folder', 'GER', 'Game folder · GER (in game)'], ['folder', 'INT', 'Game folder · INT (game default)']];
    dirSel.append(h('option', { value: '' }, LOC.files.length ? `Open from your config / game folder (${LOC.files.length} files)…` : 'Set the game folder or your config at the top to list its files'),
      ...groups.map(([src, lang, label]) => { const xs = LOC.files.map((x, i) => [x, i]).filter(([x]) => x.src === src && x.lang === lang).sort((a, b) => a[0].name.localeCompare(b[0].name));
        return xs.length ? h('optgroup', { label }, xs.map(([x, i]) => h('option', { value: i }, x.name))) : null; }).filter(Boolean));
    dirSel.disabled = !LOC.files.length;
  };
  fillDir(); onFolder(fillDir);
  const matcher = t => { const m = /^\/(.+)\/([gimsuy]*)$/.exec(t); if (m) { try { return new RegExp(m[1], m[2].replace('g', '') + 'g'); } catch { return null; } } return t ? new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null; };
  const filter = () => {
    const re = matcher(q.value), sc = secSel.value;
    view = rows.filter(r => (!sc || r.sec === sc) && (!onlyCh.checked || r.val !== r.orig) && (!re || (re.lastIndex = 0, re.test(r.key + '=' + r.val))));
    page = 0; draw();
  };
  const changed = () => rows.filter(r => r.val !== r.orig).length;
  const draw = () => {
    table.innerHTML = '';
    const part = view.slice(page * PAGE, (page + 1) * PAGE);
    const t = h('table', { class: 'grid ed' }, h('thead', {}, h('tr', {}, h('th', {}, 'Key'), h('th', {}, 'Text'), h('th', {}, 'Preview'))));
    const tb = h('tbody');
    part.forEach(r => {
      const ctx = ctxOf(F && F.name), pv = h('div', { class: 'edprev' }, ctxView(ctx, r.key, r.val));
      const gv = showGame.checked && GAME && GAME.has(r.key) && GAME.get(r.key) !== r.val ? h('div', { class: 'edgame' }, h('small', { class: 'hint' }, 'Game default'), ctxView(ctx, r.key, GAME.get(r.key))) : null;
      const ta = h('textarea', { rows: Math.min(6, 1 + Math.floor(r.val.length / 70)), oninput: () => { r.val = ta.value.replace(/\r?\n/g, '↵'); pv.replaceChildren(ctxView(ctx, r.key, r.val)); tr.classList.toggle('chg', r.val !== r.orig); status.textContent = summary(); }, onfocus: () => last = ta }, r.val);
      ta.row = r;
      const tr = h('tr', { class: r.val !== r.orig ? 'chg' : '' }, h('td', { class: 'k' }, h('div', {}, r.key), h('small', { class: 'hint' }, r.sec)), h('td', {}, ta), h('td', {}, pv, gv));
      tb.append(tr);
    });
    t.append(tb); table.append(view.length ? t : h('p', { class: 'hint' }, rows.length ? 'No matching lines.' : 'Open a localisation file to start.'));
    pager.innerHTML = '';
    const pages = Math.ceil(view.length / PAGE);
    if (pages > 1) pager.append(h('button', { disabled: page === 0, onclick: () => { page--; draw(); } }, '‹ Prev'), h('span', { class: 'hint' }, `Page ${page + 1} of ${pages}`), h('button', { disabled: page >= pages - 1, onclick: () => { page++; draw(); } }, 'Next ›'));
    status.textContent = summary();
  };
  const summary = () => F ? `${F.name} · preview: ${CTX_NAME[ctxOf(F.name)]} · ${F.enc}${F.fixed ? ' (' + F.fixed + ' broken line ends repaired)' : ''} · ${rows.length} lines · ${view.length} shown · ${changed()} changed · ${kind() === 'hud' ? 'HUD text: use <col:Name>' : 'UI text: <Color:> and <Fonts:> work'}` : '';
  let last = null;
  const snapshot = () => { undo.push(rows.map(r => r.val)); if (undo.length > 30) undo.shift(); };
  const bulk = fn => { snapshot(); view.forEach(r => { r.val = fn(r.val, r); }); draw(); };
  const grad = t => colourText(t, { mode: st.mode === 'triple' ? 'smooth' : st.mode, stops: [st[1], st[2]].concat(st.mode === 'triple' ? [st[3]] : []).map(hex2rgb), steps: st.steps, kind: kind(), font: kind() === 'ui' ? st.font : '' });
  const strip = t => t.replace(/<(Color|col|Fonts|\/col)[^<>]*>/gi, '');
  const wrapSel = () => {
    if (!last || !document.body.contains(last)) return;
    const a = last.selectionStart, b = last.selectionEnd, v = last.value;
    if (a === b) return;
    last.value = v.slice(0, a) + grad(v.slice(a, b)) + v.slice(b); last.dispatchEvent(new Event('input'));
  };
  const drawTools = () => {
    tools.innerHTML = '';
    const g = h('div', { class: 'grad' });
    const dg = () => {
      g.innerHTML = '';
      g.append(seg([['solid', 'Solid'], ['stepped', 'Stepped'], ['smooth', 'Smooth'], ['triple', 'Triple'], ['rainbow', 'Rainbow']], st.mode, v => { st.mode = v; save(); dg(); }));
      const n = st.mode === 'rainbow' ? 0 : st.mode === 'solid' ? 1 : st.mode === 'triple' ? 3 : 2;
      for (let i = 1; i <= n; i++) g.append(colourPick('ui', st[i], v => { st[i] = v; save(); }));
      if (st.mode === 'stepped') g.append(h('input', { type: 'number', min: 2, max: 12, value: st.steps, style: 'width:64px', oninput: e => { st.steps = +e.target.value; save(); } }));
      if (kind() === 'ui') g.append(h('select', { onchange: e => { st.font = e.target.value; save(); } }, h('option', { value: '' }, 'No font'), FONTS.map(f => h('option', { value: f, selected: st.font === f }, f.split('.').pop().replace(/_/g, ' ')))));
    };
    dg();
    tools.append(h('h3', {}, 'Bulk tools (apply to the lines shown)'), h('div', { class: 'row' }, g),
      h('div', { class: 'row' }, h('button', { onclick: () => bulk(v => grad(strip(v))) }, 'Colour shown lines'), h('button', { onclick: wrapSel, title: 'Select text in a line first' }, 'Colour selected text'),
        h('button', { onclick: () => bulk(strip) }, 'Remove colour/font tags'), h('button', { onclick: () => bulk((v, r) => r.orig) }, 'Revert shown lines'),
        h('button', { onclick: () => { const u = undo.pop(); if (u) { rows.forEach((r, i) => r.val = u[i]); draw(); } } }, 'Undo')),
      h('div', { class: 'row' }, findIn, repIn, h('button', { onclick: () => { const re = matcher(findIn.value); if (re) bulk(v => v.replace(re, repIn.value)); } }, 'Replace in shown lines')),
      h('p', { class: 'hint' }, kind() === 'hud' ? 'This is a HUD text file: colours are turned into the nearest game colour name (<col:Name>…</col>); fonts do not work here.' : 'Colours are written as <Color:R G B> … <Color:/>.'));
  };
  const saveIt = () => {
    if (!F) return;
    const lines = F.lines.slice(); rows.forEach(r => { if (r.val !== r.orig) lines[r.i] = `${r.key}=${intValue(r.val)}`; });
    const eol = F.text.includes('\r\n') ? '\r\n' : '\n';
    saveFile({ text: lines.join(eol), enc: F.enc, bom: F.bom }, F.name);
  };
  [q, secSel].forEach(e => e.addEventListener('input', filter)); onlyCh.onchange = filter;
  root.append(h('div', { class: 'card glass' }, h('h3', {}, 'Localisation editor'),
    h('p', { class: 'hint' }, 'Open any APB localisation file (INT, GER, …; UTF-16 and 8-bit files are both read). Edit lines with a live preview, recolour many lines at once, then save: the file keeps its encoding and every line you did not change stays byte-for-byte the same. ↵ is the game\'s line break.'),
    h('div', { class: 'row' }, h('label', { class: 'drop' }, fileIn, '📄 ', h('span', {}, 'Open a ', h('b', {}, 'localisation file'))), dirSel, h('button', { class: 'primary', onclick: saveIt }, 'Save file')),
    h('div', { class: 'row' }, q, secSel, h('label', { class: 'opt' }, onlyCh, 'Changed only'), h('label', { class: 'opt', title: 'Shows the game\'s own line (INT from your game folder or config) under lines you or your config changed' }, showGame, 'Show game default')), status), tools, table, pager);
  draw();
}
