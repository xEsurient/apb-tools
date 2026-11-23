import { h, render, readFile, saveFile, colourPick, seg, colourText, hex2rgb, intValue, store, FONTS } from './core.js';
import { fitEnc } from '../config/lib.js';
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
const fnv = s => { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); } return (x >>> 0).toString(36) + '.' + s.length; };
const SESS = 'apbdesigner-editor-sessions';
const sessAll = () => { try { const x = JSON.parse(localStorage.getItem(SESS)); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; } catch { return {}; } };
const sessPut = all => { try { const ks = Object.keys(all).sort((a, b) => all[b].at - all[a].at); for (const k of ks.slice(10)) delete all[k]; if (Object.keys(all).length) localStorage.setItem(SESS, JSON.stringify(all)); else localStorage.removeItem(SESS); } catch { } };
export function markupIssues(v, kind) {
  const out = [], n = re => (v.match(re) || []).length;
  if (kind === 'hud') {
    const o = n(/<col:[^<>\/][^<>]*>/gi), c = n(/<\/col>/gi);
    if (c > o) out.push(`${c} </col> but only ${o} <col:…>: a closing tag without its opening tag`);
    if (/<(Color|Fonts):/i.test(v)) out.push('<Color:>/<Fonts:> do not work in HUD text (use <col:Name>)');
  } else {
    const o = n(/<Color:(?!\/)[^<>]*>/gi), c = n(/<Color:\/>/gi), fo = n(/<Fonts:(?!\/)[^<>]*>/gi), fc = n(/<Fonts:\/>/gi);
    if (c > o) out.push(`${c} <Color:/> but only ${o} <Color:…>: a closing tag without its opening tag`);
    if (fc > fo) out.push(`${fc} <Fonts:/> but only ${fo} <Fonts:…>: a closing tag without its opening tag`);
    if (/<\/?col[:>]/i.test(v)) out.push('<col:> is HUD markup and shows as text here (use <Color:>)');
  }
  if (n(/</g) !== n(/>/g)) out.push('a < or > without its partner');
  return out;
}
const CTX_NAME = { map: 'map labels', hud: 'HUD', tip: 'tooltip', list: 'filter list', chat: 'chat', plain: 'plain text' };

export function initEditor(root) {
  let F = null, rows = [], view = [], page = 0, undo = [], redo = [], GAME = null;
  const st = store.get('editor', { colour: '#ffb000', hud: 'Yellow', mode: 'solid', 1: '#ffb000', 2: '#ff3d3d', 3: '#7a5cff', steps: 3, font: '', scope: 'page', matchCase: false, word: false, textOnly: true });
  const save = () => store.set('editor', st);
  const fileIn = h('input', { type: 'file', accept: '.int,.ger,.INT,.GER,.txt,.ini,.fra,.rus,.pol,.esn,.ita' });
  const q = h('input', { type: 'search', placeholder: 'Search keys and text ([Section] text, or /regex/ for a pattern)…' });
  const secSel = h('select', {}, h('option', { value: '' }, 'All sections'));
  const showGame = h('input', { type: 'checkbox', onchange: () => updaters.forEach(u => u()) }), onlyCh = h('input', { type: 'checkbox' }), diffG = h('input', { type: 'checkbox', disabled: true }), diffL = h('label', { class: 'opt', title: 'Set the game folder (or your config with INT files) at the top to compare with the game' }, diffG, 'Differs from game'), status = h('span', { class: 'hint' }), table = h('div', { id: 'edtable' }), pager = h('div', { class: 'row' });
  const qCase = h('input', { type: 'checkbox' });
  const findIn = h('input', { type: 'text', placeholder: 'Find (text or /regex/)' }), repIn = h('input', { type: 'text', placeholder: 'Replace with ($1 for groups)' });
  const kind = () => F && HUD.test(F.name.replace(/\.[^.]+$/, '')) ? 'hud' : 'ui';
  const tools = h('div', { class: 'card glass', hidden: true }), review = h('div', { class: 'card glass edreview', hidden: true }), note = h('div', { class: 'hint' });
  const unsaved = () => rows.filter(r => r.val !== r.saved).length;
  const dirty = () => F && unsaved() > 0;
  const discard = () => { if (!dirty()) return true; if (!confirm(`${F.name} has ${unsaved()} unsaved change(s). Discard them?`)) return false; dropSess(); return true; };
  window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  let loadSeq = 0;
  const load = async src => {
    F = src; F.sig = fnv(F.text); undo = []; redo = []; drawHist(); const tok = ++loadSeq; review.hidden = true; note.textContent = '';
    const parts = F.text.split(/(\r\n|\n|\r)/), lines = parts.filter((x, k) => k % 2 === 0); let sec = ''; rows = [];
    F.eols = parts.filter((x, k) => k % 2 === 1);
    lines.forEach((l, i) => {
      const s = l.trim();
      if (s.startsWith('[') && s.endsWith(']')) { sec = s.slice(1, -1); return; }
      const eq = l.indexOf('=');
      if (eq > 0 && !s.startsWith(';')) { let v = l.slice(eq + 1); const quoted = v.length > 1 && v.startsWith('"') && v.endsWith('"'); if (quoted) v = v.slice(1, -1); rows.push({ i, sec, key: l.slice(0, eq), val: v, orig: v, saved: v, quoted }); }
    });
    F.lines = lines;
    secSel.innerHTML = ''; secSel.append(h('option', { value: '' }, 'All sections'), ...[...new Set(rows.map(r => r.sec))].map(s => h('option', { value: s }, s || '(no section)')));
    GAME = null; loadGame(tok);
    tools.hidden = false; drawTools(); filter();
    const old = sessFor(F);
    if (old) {
      review.hidden = false;
      review.replaceChildren(h('h3', {}, 'Unsaved edits found'), h('p', { class: 'hint' }, `You had ${old.edits.length} unsaved change${old.edits.length === 1 ? '' : 's'} in this file (${new Date(old.at).toLocaleString()}).`),
        h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { const done = []; old.edits.forEach(([k, v]) => { const r = rows[k]; if (r && typeof v === 'string' && r.val !== v) { done.push([r, r.val, v]); r.val = v; } }); record(done, 'Restore'); review.hidden = true; draw(); keep(); note.textContent = `Restored ${done.length} edit${done.length === 1 ? '' : 's'}.`; } }, 'Restore them'),
          h('button', { onclick: () => { dropSess(); review.hidden = true; } }, 'Discard them')));
      review.dataset.kind = 'restore';
    }
  };
  let pickSeq = 0;
  fileIn.onchange = async () => {
    const f = fileIn.files[0]; fileIn.value = ''; if (!f || !discard()) return; const tok = ++pickSeq;
    try { const r = await readFile(f); if (tok === pickSeq) await load(r); } catch (e) { status.textContent = 'Could not read that file: ' + e.message; }
  };
  const dirSel = h('select', { onchange: async () => {
    const x = LOC.files[+dirSel.value]; dirSel.value = ''; if (!x || !discard()) return; const tok = ++pickSeq;
    try { const r = await readLoc(x); if (tok === pickSeq) await load({ ...r, name: x.name }); } catch (e) { status.textContent = 'Could not read that file: ' + e.message; }
  } });
  const fillDir = () => {
    dirSel.innerHTML = '';
    const groups = [['zip', 'GER', 'Your config · GER'], ['zip', 'INT', 'Your config · INT'], ['folder', 'GER', 'Game folder · GER (in game)'], ['folder', 'INT', 'Game folder · INT (game default)']];
    dirSel.append(h('option', { value: '' }, LOC.files.length ? `Open from your config / game folder (${LOC.files.length} files)…` : 'Set the game folder or your config at the top to list its files'),
      ...groups.map(([src, lang, label]) => { const xs = LOC.files.map((x, i) => [x, i]).filter(([x]) => x.src === src && x.lang === lang).sort((a, b) => a[0].name.localeCompare(b[0].name));
        return xs.length ? h('optgroup', { label }, xs.map(([x, i]) => h('option', { value: i }, x.name))) : null; }).filter(Boolean));
    dirSel.disabled = !LOC.files.length;
  };
  fillDir(); onFolder(() => { fillDir(); GAME = null; gameUi(); updaters.forEach(u => u()); loadGame(); });
  const matcher = t => { const m = /^\/(.+)\/([gimsuy]*)$/.exec(t); if (m) { try { return new RegExp(m[1], m[2].replace('g', '') + 'g'); } catch { return null; } } return t ? new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), qCase.checked ? 'g' : 'gi') : null; };
  const filter = () => {
    let qt = q.value, sx = null; const sm = /^\s*\[([^\]]*)\]\s*/.exec(qt); if (sm) { sx = sm[1].trim().toLowerCase(); qt = qt.slice(sm[0].length); }
    const re = matcher(qt), sc = secSel.value, exact = sx !== null && rows.some(r => r.sec.toLowerCase() === sx);
    const secOk = r => sx === null || (exact ? r.sec.toLowerCase() === sx : r.sec.toLowerCase().includes(sx));
    const dg = diffG.checked && GAME;
    view = rows.filter(r => (!sc || r.sec === sc) && secOk(r) && (!onlyCh.checked || r.val !== r.orig) && (!dg || (g => g && g.v !== r.val)(gameOf(r))) && (!re || (re.lastIndex = 0, re.test(r.key + '=' + r.val))));
    page = 0; draw();
  };
  const changed = () => rows.filter(r => r.val !== r.orig).length;
  const draw = () => {
    table.innerHTML = '';
    const part = view.slice(page * PAGE, (page + 1) * PAGE);
    const t = h('table', { class: 'grid ed' }, h('thead', {}, h('tr', {}, h('th', {}, 'Key'), h('th', {}, 'Text'), h('th', {}, 'Preview'))));
    const tb = h('tbody');
    updaters = [];
    part.forEach(r => {
      const ctx = ctxOf(F && F.name), pv = h('div', { class: 'edprev' }, ctxView(ctx, r.key, r.val)), gcell = h('td', {});
      const gv = () => { const g = showGame.checked ? gameOf(r) : null; return g && g.v !== r.val ? h('div', { class: 'edgame' }, h('small', { class: 'hint' }, 'Game default'), ctxView(ctx, r.key, g.v)) : null; };
      const ta = h('textarea', { rows: Math.min(6, 1 + Math.floor(r.val.length / 70)), oninput: () => { r.val = ta.value.replace(/\r?\n/g, '↵'); pv.replaceChildren(ctxView(ctx, r.key, r.val)); tr.classList.toggle('chg', r.val !== r.orig); flag(); status.textContent = summary(); keep(); }, onfocus: () => { last = ta; ta.before = r.val; }, onchange: () => { if (ta.before !== undefined && ta.before !== r.val) record([[r, ta.before, r.val]], 'Typed: ' + r.key); ta.before = r.val; } }, r.val);
      ta.row = r;
      const marks = h('small', { class: 'edmark' }), flag = () => { const p = problems(r); marks.textContent = p.join(' · '); marks.title = p.join('\n'); };
      const upd = () => { flag(); const g = gv(), g0 = gameOf(r);
        const rb = g0 && g0.v !== r.val ? h('button', { class: 'edreset', title: 'Replace this line with the game\'s own text', onclick: () => { const b = r.val; ta.value = g0.v; ta.dispatchEvent(new Event('input')); record([[r, b, r.val]], 'Reset: ' + r.key); resetBefore(ta); upd(); } }, 'Reset to game default') : null;
        gcell.replaceChildren(pv, ...(g ? [g] : []), ...(rb ? [rb] : [])); };
      const tr = h('tr', { class: r.val !== r.orig ? 'chg' : '' }, h('td', { class: 'k' }, h('div', {}, r.key), h('small', { class: 'hint' }, r.sec), marks), h('td', {}, ta), gcell);
      upd(); updaters.push(upd);
      tb.append(tr);
    });
    t.append(tb); table.append(view.length ? t : h('p', { class: 'hint' }, rows.length ? 'No matching lines.' : 'Open a localisation file to start.'));
    pager.innerHTML = '';
    const pages = Math.ceil(view.length / PAGE);
    if (pages > 1) pager.append(h('button', { disabled: page === 0, onclick: () => { page--; draw(); } }, '‹ Prev'), h('span', { class: 'hint' }, `Page ${page + 1} of ${pages}`), h('button', { disabled: page >= pages - 1, onclick: () => { page++; draw(); } }, 'Next ›'));
    status.textContent = summary(); scopeInfo();
  };
  const summary = () => F ? `${F.name} · preview: ${CTX_NAME[ctxOf(F.name)]} · ${F.enc === 'cp1252' || (F.enc === 'utf-8' && !F.bom && !/[^\x00-\x7f]/.test(F.text)) ? '8-bit' : F.enc}${F.fixed ? ' (' + F.fixed + ' broken line ends repaired)' : ''} · ${rows.length} lines · ${view.length} shown · ${changed()} changed${F && unsaved() ? `, ${unsaved()} not saved yet` : ''} · ${kind() === 'hud' ? 'HUD text: use <col:Name>' : 'UI text: <Color:> and <Fonts:> work'}` : '';
  let last = null;
  const gameOf = r => GAME ? GAME.lookup(r.key, r.sec) : null;
  const unknown = r => !!(GAME && !gameOf(r));
  let updaters = [];
  const loadGame = tok => {
    if (!F) return; const stem = F.name.replace(/\.[^.]+$/, ''), t = tok ?? loadSeq;
    inGame(stem).then(g => { if (t !== loadSeq) return; GAME = g.base.size ? g.base : null; gameUi(); updaters.forEach(u => u()); if (diffG.checked) filter(); }).catch(() => {});
  };
  const gameUi = () => { diffG.disabled = !GAME; diffL.title = GAME ? 'Only lines whose text differs from the game\'s English (INT) line' : 'Set the game folder (or your config with INT files) at the top to compare with the game'; };
  const problems = r => { const p = []; if (unknown(r)) p.push('key not in the game\'s English file: the game ignores this line'); if (r.val !== r.orig) p.push(...markupIssues(r.val, kind())); return p; };
  let keepT = 0;
  const sid = f => f.name + '|' + f.sig;
  const keep = () => { if (!review.hidden && review.dataset.kind === 'save') { review.hidden = true; note.textContent = 'Changed after opening the save review: press Save file again to see the current changes.'; }
    clearTimeout(keepT); keepT = setTimeout(() => {
    if (!F) return; const all = sessAll(), edits = rows.map((r, k) => r.val !== r.orig ? [k, r.val] : null).filter(Boolean);
    if (edits.length && unsaved()) all[sid(F)] = { name: F.name, sig: F.sig, at: Date.now(), edits }; else delete all[sid(F)];
    sessPut(all);
  }, 300); };
  const sessFor = f => { const x = sessAll()[sid(f)]; return x && Array.isArray(x.edits) && x.edits.length ? x : null; };
  const dropSess = () => { if (!F) return; const all = sessAll(); delete all[sid(F)]; sessPut(all); };
  const histList = h('div', { class: 'edhistlist' }), hist = h('details', { class: 'edhist' }, h('summary', {}, 'History'), histList);
  const record = (list, label = 'Edit') => { if (!list.length) return; undo.push({ label, list }); if (undo.length > 30) undo.shift(); redo = []; drawHist(); };
  const plural = n => `${n} line${n === 1 ? '' : 's'}`;
  const drawHist = () => {
    const item = (u, cls, on, t) => h('button', { class: 'edhitem ' + cls, title: t, onclick: on }, h('span', {}, u.label), h('small', { class: 'hint' }, plural(u.list.length)));
    histList.replaceChildren(...(undo.length || redo.length ? [] : [h('p', { class: 'hint' }, 'No changes yet.')]),
      ...redo.map((u, i) => [u, i]).reverse().map(([u, i]) => item(u, 'undone', () => { const tgt = redo.length - i - 1; stepTo(() => redo.length > tgt, redoLast); }, 'Undone: click to redo up to here')),
      ...undo.map((u, i) => [u, i]).reverse().map(([u, i]) => item(u, '', () => stepTo(() => undo.length > i, undoLast), 'Click to undo back to just before this change')));
  };
  const stepTo = (more, fn) => { let n = 0, kept = 0, k = 0; while (more()) { const x = fn(true); if (!x) break; n += x[0]; kept += x[1]; k++; } draw(); keep(); drawHist(); note.textContent = `${fn === undoLast ? 'Undone' : 'Redone'}: ${k} change${k === 1 ? '' : 's'}, ${plural(n)}${kept ? `, ${kept} kept because you edited them afterwards` : ''}.`; };
  const onPage = () => view.slice(page * PAGE, (page + 1) * PAGE);
  const targets = () => st.scope === 'all' ? view : onPage();
  const bulk = (fn, label) => {
    const t = targets(); if (!t.length) { note.textContent = 'No lines to change.'; return; }
    const off = t.length - onPage().length;
    if (st.scope === 'all' && off > 0 && !confirm(`${label}: this can change up to ${t.length} lines, ${off} of them not on this page. Continue?`)) return;
    const done = [];
    t.forEach(r => { const v = fn(r.val, r); if (v !== r.val) { done.push([r, r.val, v]); r.val = v; } });
    record(done, label); const n = done.length;
    draw(); keep(); note.textContent = `${label}: ${n} line${n === 1 ? '' : 's'} changed${st.scope === 'all' ? ' (all matching lines)' : ' (this page)'}.`;
  };
  const grad = t => colourText(t, { mode: st.mode === 'triple' ? 'smooth' : st.mode, stops: [st[1], st[2]].concat(st.mode === 'triple' ? [st[3]] : []).map(hex2rgb), steps: st.steps, kind: kind(), font: kind() === 'ui' ? st.font : '' });
  const strip = t => t.replace(/<(Color|col|Fonts|\/col)[^<>]*>/gi, '');
  const stripCol = t => t.replace(/<(Color|col|\/col)[^<>]*>/gi, '');
  const recolour = v => { const t = st.font && kind() === 'ui' ? strip(v) : stripCol(v); return t.trim() ? grad(t) : v; };
  const findRe = () => {
    const t = findIn.value; if (!t) return null;
    const m = /^\/(.+)\/([gimsuy]*)$/.exec(t);
    if (m) { try { return { re: new RegExp(m[1], m[2].replace('g', '') + 'g'), regex: true }; } catch { return null; } }
    let src = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (st.word) src = `(?<![\\p{L}\\p{N}_])${src}(?![\\p{L}\\p{N}_])`;
    return { re: new RegExp(src, (st.matchCase ? 'g' : 'gi') + 'u'), regex: false };
  };
  const replaceIn = (v, f) => {
    const by = f.regex ? repIn.value : () => repIn.value;
    if (!st.textOnly) return v.replace(f.re, by);
    return v.split(/(<[^<>]*>)/).map((p, i) => i % 2 ? p : p.replace(f.re, by)).join('');
  };
  const wrapSel = () => {
    if (!last || !document.body.contains(last)) return;
    const a = last.selectionStart, b = last.selectionEnd, v = last.value;
    if (a === b) return;
    const r = last.row, before = r.val; last.value = v.slice(0, a) + grad(v.slice(a, b)) + v.slice(b); last.dispatchEvent(new Event('input')); record([[r, before, r.val]], 'Colour selected text'); resetBefore(last);
  };
  const resetBefore = t => { if (t) t.before = t.row.val; };
  const fontOnly = v => { if (!st.font) return v; const t = v.replace(/<Fonts:[^<>]*>/gi, ''); return t.trim() ? `<Fonts:${st.font}>${t}<Fonts:/>` : v; };
  const undoLast = quiet => {
    const u = undo.pop(); if (!u) { if (!quiet) note.textContent = 'Nothing to undo.'; return null; }
    let n = 0, kept = 0; u.list.forEach(([r, before, after]) => { if (r.val === after) { r.val = before; n++; } else kept++; }); redo.unshift(u);
    if (!quiet) { draw(); keep(); drawHist(); note.textContent = `Undone: ${plural(n)}${kept ? `, ${kept} kept because you edited them afterwards` : ''}.`; }
    return [n, kept];
  };
  const redoLast = quiet => {
    const u = redo.shift(); if (!u) { if (!quiet) note.textContent = 'Nothing to redo.'; return null; }
    let n = 0, kept = 0; u.list.forEach(([r, before, after]) => { if (r.val === before) { r.val = after; n++; } else kept++; }); undo.push(u);
    if (!quiet) { draw(); keep(); drawHist(); note.textContent = `Redone: ${plural(n)}${kept ? `, ${kept} kept because you edited them afterwards` : ''}.`; }
    return [n, kept];
  };
  const lineOf = r => `${r.key}=${r.quoted ? `"${r.val}"` : intValue(r.val)}`;
  const smallText = (ch, title) => { const bar = ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', out = [bar, ...title.map(t => '; ' + t), bar]; let sec = null;
    ch.forEach(r => { if (r.sec !== sec) { sec = r.sec; out.push(''); if (sec) out.push(`[${sec}]`); } out.push(lineOf(r)); }); return out.join('\r\n') + '\r\n'; };
  const exportPatch = () => {
    if (!F) return; const ch = rows.filter(r => r.val !== r.orig);
    if (!ch.length) { note.textContent = 'No changed lines to export.'; return; }
    const name = F.name.replace(/\.[^.]+$/, '') + '.patch.GER';
    saveFile({ text: smallText(ch, [`Text patch for ${F.name.replace(/[\r\n]/g, '')}: ${plural(ch.length)}, made with the APB Reloaded text designer`, 'Open the same file in the Editor and use Import patch, or use it as a small GER file']), enc: 'utf-16le', bom: true }, name);
    note.textContent = `Exported ${name} (${plural(ch.length)}).`;
  };
  const patchIn = h('input', { type: 'file', accept: '.int,.ger,.INT,.GER,.txt,.ini', hidden: true });
  patchIn.onchange = async () => {
    const f = patchIn.files[0]; patchIn.value = ''; if (!f || !F) return;
    let txt; try { txt = (await readFile(f)).text; } catch (e) { note.textContent = 'Could not read that patch: ' + e.message; return; }
    const low = x => String(x).trim().toLowerCase(), bySec = new Map(), byKey = new Map(), secs = new Set(rows.map(r => low(r.sec)));
    rows.forEach(r => { const k = low(r.sec) + '\u0000' + low(r.key); if (!bySec.has(k)) bySec.set(k, r); (byKey.get(low(r.key)) || byKey.set(low(r.key), []).get(low(r.key))).push(r); });
    const set = new Map(), unknown = []; let sec = '', n = 0;
    for (const l of txt.split(/\r\n|\n|\r/)) {
      const t = l.trim(); if (!t || t.startsWith(';')) continue;
      if (t.startsWith('[') && t.endsWith(']')) { sec = t.slice(1, -1); continue; }
      const eq = l.indexOf('='); if (eq <= 0) continue;
      let v = l.slice(eq + 1); if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      const key = l.slice(0, eq).trim(); n++;
      let r = bySec.get(low(sec) + '\u0000' + low(key));
      if (!r && !secs.has(low(sec))) { const c = byKey.get(low(key)); if (c && c.length === 1) r = c[0]; }
      if (r) set.set(r, v); else unknown.push(sec ? `[${sec}] ${key}` : key);
    }
    const done = [];
    for (const [r, v] of set) if (r.val !== v) { done.push([r, r.val, v]); r.val = v; }
    record(done, 'Import patch'); draw(); keep();
    note.textContent = `Import patch: applied ${plural(done.length)}${set.size - done.length ? ` (${set.size - done.length} already had that text)` : ''}${unknown.length ? `, ${unknown.length} unknown key${unknown.length === 1 ? '' : 's'}: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? ' …' : ''}` : ''}.${n ? '' : ' The file has no Key=Value lines.'}`;
  };
  const goTo = r => {
    const k = view.indexOf(r); if (k < 0) return;
    if (Math.floor(k / PAGE) !== page) { page = Math.floor(k / PAGE); draw(); }
    const ta = [...table.querySelectorAll('textarea')].find(t => t.row === r);
    if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus({ preventScroll: true }); }
  };
  const seek = (pred, dir, what) => {
    const n = view.length; if (!n) { note.textContent = 'No lines shown.'; return; }
    const c = last && document.body.contains(last) && view.includes(last.row) ? view.indexOf(last.row) : dir > 0 ? page * PAGE - 1 : page * PAGE;
    for (let s = 1; s <= n; s++) {
      const k = ((c + dir * s) % n + n) % n;
      if (pred(view[k])) { goTo(view[k]); let a = 0, all = 0; view.forEach((r, j) => { if (pred(r)) { all++; if (j <= k) a++; } }); note.textContent = `${what} ${a} of ${all}.`; return; }
    }
    note.textContent = `No ${what.toLowerCase()} in the shown lines.`;
  };
  const nextWarn = (dir = 1) => seek(r => problems(r).length > 0, dir, 'Warning');
  const nextFind = dir => {
    const f = findRe();
    if (!f) { if (findIn.value) { note.textContent = 'That pattern is not valid.'; return; } seek(() => true, dir, 'Line'); return; }
    seek(r => (st.textOnly ? r.val.split(/(<[^<>]*>)/).filter((x, i) => i % 2 === 0) : [r.val]).some(x => { f.re.lastIndex = 0; return f.re.test(x); }), dir, 'Match');
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
    const opt = (key, label, title) => h('label', { class: 'opt', title }, h('input', { type: 'checkbox', checked: !!st[key], onchange: e => { st[key] = e.target.checked; save(); } }), label);
    tools.append(h('h3', {}, 'Bulk tools'),
      h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Apply to'), seg([['page', 'This page'], ['all', 'All matching lines']], st.scope, v => { st.scope = v; save(); scopeInfo(); }), scopeHint),
      h('div', { class: 'row' }, g),
      h('div', { class: 'row' }, h('button', { onclick: () => bulk(recolour, 'Colour lines'), title: 'Replaces the colour tags of each line; font tags stay unless you pick a font' }, 'Colour lines'), h('button', { onclick: wrapSel, title: 'Select text in a line first' }, 'Colour selected text'),
        kind() === 'ui' ? h('button', { title: 'Wraps each line in the font picked above, keeping its colours', onclick: () => { if (!st.font) { note.textContent = 'Pick a font first.'; return; } bulk(fontOnly, 'Font only'); } }, 'Font only') : null,
        h('button', { onclick: () => bulk(strip, 'Remove colour/font tags') }, 'Remove colour/font tags'), h('button', { onclick: () => bulk((v, r) => r.orig, 'Revert') }, 'Revert lines'),
        h('button', { title: 'Sets each line to the game\'s English (INT) text; lines the game does not have stay as they are', onclick: () => { if (!GAME) { note.textContent = 'Set the game folder (or your config with INT files) at the top first.'; return; } bulk((v, r) => { const g = gameOf(r); return g ? g.v : v; }, 'Reset to game default'); } }, 'Reset to game default'),
        h('button', { title: 'Undoes the last change (Ctrl+Z outside a text box): a bulk action, or the last line you typed in (counted when you leave the line). Lines you edited since keep your typing', onclick: () => undoLast() }, 'Undo'), h('button', { title: 'Redoes what Undo took back (Ctrl+Y or Ctrl+Shift+Z outside a text box)', onclick: () => redoLast() }, 'Redo')),
      h('div', { class: 'row' }, findIn, h('button', { title: 'Next line with a match (F3; Shift+F3 goes back)', onclick: () => nextFind(1) }, 'Find next'), repIn, h('button', { onclick: () => { const f = findRe(); if (!f) { note.textContent = findIn.value ? 'That pattern is not valid.' : 'Type what to find first.'; return; } bulk(v => replaceIn(v, f), 'Replace'); } }, 'Replace')),
      h('div', { class: 'row' }, opt('matchCase', 'Match case'), opt('word', 'Whole words only'), opt('textOnly', 'Leave <tags> alone', 'Only replace in the visible text, never inside markup tags such as <Color:…> or <Images:…>')),
      note, hist,
      h('p', { class: 'hint' }, kind() === 'hud' ? 'This is a HUD text file: colours are turned into the nearest game colour name (<col:Name>…</col>); fonts do not work here.' : 'Colours are written as <Color:R G B> … <Color:/>.'));
  };
  const isInt = () => F && (F.lang ? F.lang === 'INT' : /\.int$/i.test(F.name));
  const outName = () => isInt() ? F.name.replace(/\.[^.]+$/, '') + '.GER' : F.name;
  const saveIt = () => {
    if (!F) return;
    const ch = rows.filter(r => r.val !== r.orig);
    review.dataset.kind = 'save';
    if (!ch.length) { review.hidden = false; review.replaceChildren(h('h3', {}, 'Nothing to save'), h('p', { class: 'hint' }, 'No line differs from the file you opened.')); return; }
    const lines = F.lines.slice(); ch.forEach(r => { lines[r.i] = lineOf(r); });
    const full = lines.map((l, i) => l + (F.eols[i] || '')).join('');
    const small = () => smallText(ch, ['Changed lines only, saved with the APB Reloaded text designer']);
    const smallWarn = h('p', { class: 'warn', hidden: true }, 'You opened your own GER file: the small file holds only the lines changed here. Using it in place of this file drops your other custom lines, so give it to someone as a patch or use the full file.');
    const onlyCh2 = h('input', { type: 'checkbox', onchange: () => { smallWarn.hidden = !onlyCh2.checked || isInt(); } });
    const pick = () => onlyCh2.checked ? { text: small(), enc: 'utf-16le', bom: true, bad: [] } : { text: full, ...fitEnc(full, F.enc, F.bom, F.text) };
    let e = pick();
    const name = h('input', { type: 'text', class: 'fname', value: outName() });
    const warn = [];
    const unk = ch.filter(unknown), bad = ch.map(r => [r, markupIssues(r.val, kind())]).filter(x => x[1].length);
    if (unk.length) warn.push(`${unk.length} changed line${unk.length === 1 ? '' : 's'} use${unk.length === 1 ? 's' : ''} a key the game's English file does not have, so the game ignores ${unk.length === 1 ? 'it' : 'them'} (keys must match exactly, typos included): ${unk.slice(0, 6).map(r => r.key).join(', ')}${unk.length > 6 ? ' …' : ''}`);
    if (bad.length) warn.push(`${bad.length} changed line${bad.length === 1 ? ' has' : 's have'} markup problems: ${bad.slice(0, 4).map(([r, p]) => `${r.key} (${p.join('; ')})`).join(', ')}${bad.length > 4 ? ' …' : ''}`);
    if (e.bad.length) warn.push(`This is an 8-bit file and the changed lines use characters it cannot hold (${e.bad.slice(0, 12).join(' ')}). It will be saved as UTF-16 instead (the game reads both; the text of the other lines stays the same).`);
    if (isInt()) warn.push(F.lang ? 'This is an English (INT) file: the game\'s default text. The name ends in .GER so you can put it in the GER folder, where it overrides the INT file without replacing it.' : 'The file name ends in .INT, so it is saved as .GER (put it in the GER folder: it overrides the game\'s English file without replacing it). If this file is already your GER copy, change the name back.');
    if (F.oddByte) warn.push('The original file ended with a stray half character (odd byte count in UTF-16): it is left out of the saved copy.');
    if (F.fixed) warn.push(`${F.fixed} broken line end(s) of the original file are repaired in the saved copy.`);
    const MAX = 200;
    const list = h('table', { class: 'grid ed edchanges' }, h('thead', {}, h('tr', {}, h('th', {}, 'Key'), h('th', {}, 'Before'), h('th', {}, 'After'))),
      h('tbody', {}, ch.slice(0, MAX).map(r => h('tr', {}, h('td', { class: 'k' }, r.key), h('td', {}, h('code', {}, r.orig)), h('td', {}, h('code', {}, r.val))))));
    review.hidden = false;
    review.replaceChildren(h('h3', {}, `Save: ${ch.length} changed line${ch.length === 1 ? '' : 's'}`),
      ...warn.map(w => h('p', { class: 'warn' }, w)),
      h('label', { class: 'opt', title: 'A small GER file with just your changed lines: every other line keeps following the game\'s English text, also after game updates' }, onlyCh2, 'Only the changed lines (new small file)'), smallWarn,
      h('div', { class: 'row' }, name, h('button', { class: 'primary', onclick: () => { e = pick(); saveFile({ text: e.text, enc: e.enc, bom: e.bom }, name.value.trim() || outName()); rows.forEach(r => { r.saved = r.val; }); dropSess(); review.hidden = true; status.textContent = summary(); note.textContent = `Saved ${name.value.trim() || outName()} (${ch.length} changed line${ch.length === 1 ? '' : 's'}${onlyCh2.checked ? ', changed lines only' : ''}).`; } }, 'Download'),
        h('button', { onclick: () => { review.hidden = true; } }, 'Cancel')),
      h('p', { class: 'hint' }, `Every other line stays as it was. ${ch.length > MAX ? `First ${MAX} changes:` : 'Changes:'}`), h('div', { class: 'edchwrap' }, list));
    review.scrollIntoView({ block: 'nearest' });
  };
  const scopeHint = h('span', { class: 'hint' });
  const scopeInfo = () => { scopeHint.textContent = `This page: ${onPage().length} line${onPage().length === 1 ? '' : 's'} · all matching: ${view.length}`; };
  [q, secSel].forEach(e => e.addEventListener('input', filter)); onlyCh.onchange = filter; qCase.onchange = filter; diffG.onchange = filter;
  document.addEventListener('keydown', e => {
    if (!F || !root.isConnected || !root.getClientRects().length) return;
    const mod = e.ctrlKey || e.metaKey, typing = /^(TEXTAREA|INPUT|SELECT)$/.test((document.activeElement || {}).tagName || '');
    if (mod && !e.altKey && e.code === 'KeyS') { e.preventDefault(); saveIt(); }
    else if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyZ' && !typing) { e.preventDefault(); undoLast(); }
    else if (mod && !e.altKey && ((e.shiftKey && e.code === 'KeyZ') || (!e.shiftKey && e.code === 'KeyY')) && !typing) { e.preventDefault(); redoLast(); }
    else if (e.key === 'F3') { e.preventDefault(); nextFind(e.shiftKey ? -1 : 1); }
    else if (e.altKey && !mod && e.code === 'KeyN') { e.preventDefault(); nextWarn(e.shiftKey ? -1 : 1); }
  });
  root.append(h('div', { class: 'card glass' }, h('h3', {}, 'Localisation editor'),
    h('p', { class: 'hint' }, 'Open any APB localisation file (INT, GER, …; UTF-16 and 8-bit files are both read). Edit lines with a live preview, recolour many lines at once, then save: you see every changed line before the download, and every line you did not change stays the same. An 8-bit file is only saved as UTF-16 when your new text needs it. Unsaved edits are kept in this browser until you save or discard them. With the game folder set, lines whose key the game does not know are marked. ↵ is the game\'s line break. Keys: Ctrl+S save, Ctrl+Z undo and Ctrl+Y redo (outside a text box), F3 next Find match, Alt+N next warning.'),
    h('div', { class: 'row' }, h('label', { class: 'drop' }, fileIn, '📄 ', h('span', {}, 'Open a ', h('b', {}, 'localisation file'))), dirSel, h('button', { class: 'primary', onclick: saveIt, title: 'Ctrl+S' }, 'Save file…'), h('button', { onclick: () => nextWarn(1), title: 'Next line with a warning (Alt+N; Alt+Shift+N goes back)' }, 'Next warning'),
      h('button', { onclick: exportPatch, title: 'A small GER file with only your changed lines and their sections, to share or to import into the same file later' }, 'Export patch'), h('button', { onclick: () => { if (!F) { status.textContent = 'Open the file the patch is for first.'; return; } patchIn.click(); }, title: 'Applies the lines of a patch (or any small GER file) to the open file: matched by section and key; one Undo takes it back' }, 'Import patch…'), patchIn),
    h('div', { class: 'row' }, q, secSel, h('label', { class: 'opt' }, qCase, 'Match case'), h('label', { class: 'opt' }, onlyCh, 'Changed only'), diffL, h('label', { class: 'opt', title: 'Shows the game\'s own line (INT from your game folder or config) under lines you or your config changed' }, showGame, 'Show game default')), status), review, tools, table, pager);
  draw();
}
