export const STATUS = ['added', 'duplicate-in-custom', 'only-in-custom', 'changed', 'same-text'];

function splitLines(text) { const out = []; const re = /[^\r\n]*(\r\n|\n|\r|$)/g; let m; while ((m = re.exec(text)) && m[0] !== '') out.push(m[0]); return out; }
const body = l => l.replace(/[\r\n]+$/, '');
const HDR = /^\[([^\]]*)\]$/;

export function parseIni(text) {
  const lines = splitLines(text), entries = []; let sec = '';
  lines.forEach((line, i) => {
    const s = line.trim(); if (!s || s.startsWith(';') || s.startsWith('//')) return;
    const hm = HDR.exec(s); if (hm) { sec = hm[1]; return; }
    const eq = s.indexOf('='); if (eq >= 0) entries.push({ sec, key: s.slice(0, eq).trim(), val: s.slice(eq + 1), line: i });
  });
  return { lines, entries, eol: eolOf(text) };
}
export const eolOf = t => /\r\n/.test(t) ? '\r\n' : /\r/.test(t) && !/\n/.test(t) ? '\r' : '\n';
export const stem = n => n.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
export const isLoc = n => /\.(int|ger|fra|ita|esn|spa|rus|bra|pol|jpn|cze|hun|ini|txt)$/i.test(n) && !/^\._/.test(n.split('/').pop());
export const isIni = n => /\.(ini|txt)$/i.test(n);
export const pairs = (c, r) => isIni(c) === isIni(r);
export function byStem(files, name) {
  const m = new Map(), dup = new Set();
  for (const f of files) { const k = stem(name(f)), o = m.get(k); if (o) { dup.add(name(f).split('/').pop()); dup.add(name(o).split('/').pop()); if (/\.int$/i.test(name(o)) && !/\.int$/i.test(name(f))) continue; } m.set(k, f); }
  return { m, dup: [...dup] };
}
export const okey = (sec, key) => String(sec).toLowerCase() + '\u0000' + String(key).trim().toLowerCase();
export function keyMap(text) {
  const m = new Map();
  for (const e of parseIni(text).entries) { const k = okey(e.sec, e.key); if (!m.has(k)) m.set(k, e.val); }
  return m;
}
export function withSdd(text, d) {
  const P = parseIni(text), want = d.section.toLowerCase(), eol = P.eol, pos = new Map(); let last = -1;
  P.lines.forEach((l, i) => { const hm = HDR.exec(l.trim()); if (hm && hm[1].toLowerCase() === want && last < 0) last = i; });
  for (const e of P.entries) if (e.sec.toLowerCase() === want) { pos.set(e.key.toLowerCase(), e.line); last = e.line; }
  const after = new Map(), tail = [], keys = new Set(); let n = 0;
  for (const [anchor, key, val] of d.lines) {
    if (pos.has(key.toLowerCase())) continue;
    const i = pos.get(anchor.toLowerCase()) ?? last, line = `${key}=${val}`; n++; keys.add(okey(d.section, key)); pos.set(key.toLowerCase(), i);
    if (i < 0) tail.push(line); else (after.get(i) || after.set(i, []).get(i)).push(line);
  }
  if (!n) return { text, n, keys };
  let out = P.lines.map((l, i) => after.has(i) ? (/[\r\n]$/.test(l) ? l : l + eol) + after.get(i).map(x => x + eol).join('') : l).join('');
  if (tail.length) { if (out && !/[\r\n]$/.test(out)) out += eol; out += `[${d.section}]${eol}${tail.join(eol)}${eol}`; }
  return { text: out, n, keys };
}
export const csvCell = v => { const t = String(v ?? ''); return /[",\r\n]/.test(t) || /^[=+\-@]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
export const mdCell = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, ' ');
export function contextBlocks(v, max = 300) {
  const out = [], n = v.flag.length; let i = 0;
  while (i < n && out.length < max) {
    if (v.flag[i] !== 'ins') { i++; continue; }
    let j = i; while (j < n && v.flag[j] === 'ins') j++;
    const a = Math.max(0, i - 2), b = Math.min(n, j + 2), last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = b; else out.push([a, b]);
    i = j;
  }
  return { blocks: out, more: i < n && v.flag.slice(i).includes('ins') };
}
function ids(entries) { const seen = new Map(); return entries.map(e => { const k = e.sec.toLowerCase() + '\u0000' + e.key.toLowerCase(), n = seen.get(k) || 0; seen.set(k, n + 1); return k + '\u0000' + n; }); }
function sectionRanges(lines) {
  const out = new Map(), all = new Map(); let sec = '', start = -1;
  const add = (end) => { const k = sec.toLowerCase(); if (!out.has(k)) out.set(k, [start, end]); if (!all.has(k)) all.set(k, []); all.get(k).push([start, end]); };
  lines.forEach((line, i) => { const hm = HDR.exec(line.trim()); if (hm) { add(i - 1); sec = hm[1]; start = i; } });
  add(lines.length - 1);
  out.all = all;
  return out;
}
function lastContent(lines, a, b) { for (let i = b; i > a; i--) if (lines[i].trim()) return i; return a; }

export function compare(refText, cusText, refName = 'reference', mark = false, opts = {}) {
  const R = parseIni(refText), C = parseIni(cusText);
  if (!R.entries.length && !C.entries.length) return { kind: 'text', rows: [], merged: null, added: 0, sectionsAdded: [] };
  const rid = ids(R.entries), cid = ids(C.entries), cpos = new Map(cid.map((k, i) => [k, C.entries[i]])), rpos = new Map(rid.map((k, i) => [k, R.entries[i]]));
  const rows = [], addedRows = [], sectionsAdded = [], baseOf = k => k.split('\u0000').slice(0, 2).join('\u0000'), rkeys = new Set(rid.map(baseOf)), ckeys = new Set(cid.map(baseOf));
  rid.forEach((k, i) => { const e = R.entries[i], c = cpos.get(k); if (c) rows.push([c.val === e.val ? 'same-text' : 'changed', e.sec, e.key, e.line + 1, c.line + 1, e.val, c.val]); });
  cid.forEach((k, i) => { if (!rpos.has(k)) { const e = C.entries[i]; rows.push([rkeys.has(k.split('\u0000').slice(0, 2).join('\u0000')) ? 'duplicate-in-custom' : 'only-in-custom', e.sec, e.key, '', e.line + 1, '', e.val]); } });
  const ins = new Map(), put = (a, x) => { if (!ins.has(a)) ins.set(a, []); ins.get(a).push(x); };
  const cr = sectionRanges(C.lines), rr = sectionRanges(R.lines), bySec = new Map();
  rid.forEach((k, i) => { const s = k.split('\u0000')[0]; if (!bySec.has(s)) bySec.set(s, []); bySec.get(s).push([k, R.entries[i]]); });
  for (const s of rr.keys()) if (!bySec.has(s)) bySec.set(s, []);
  const order = [...bySec.keys()].sort((a, b) => (rr.get(a) || [-1])[0] - (rr.get(b) || [-1])[0]);
  order.forEach((s, si) => {
    const ents = bySec.get(s);
    if (cr.has(s) || (s === '' && !ents.length)) {
      let prev = null;
      for (const [k, e] of ents) {
        if (cpos.has(k)) { prev = cpos.get(k).line; continue; }
        if (ckeys.has(baseOf(k))) continue;
        const a = prev !== null ? prev : cr.has(s) ? cr.get(s)[0] : -1, blk = ins.get(a);
        if (mark && !(blk && blk[blk.length - 1][1] === 'entry')) put(a, ['; added from ' + refName, 'mark']);
        put(a, [body(R.lines[e.line]), 'entry']); addedRows.push(['added', e.sec, e.key, e.line + 1, '', e.val, '']);
      }
    } else {
      const prevSec = order.slice(0, si).reverse().find(p => cr.has(p));
      let a;
      if (prevSec !== undefined) a = lastContent(C.lines, ...cr.get(prevSec));
      else { const nxt = order.slice(si + 1).find(p => cr.has(p) && cr.get(p)[0] >= 0); a = nxt !== undefined ? cr.get(nxt)[0] - 1 : C.lines.length - 1; }
      const [h] = rr.get(s);
      if (a >= 0) put(a, ['', 'blank']);
      if (mark) put(a, ['; section added from ' + refName, 'mark']);
      (rr.all.get(s) || [rr.get(s)]).forEach(([h2, end2], j) => { if (j) put(a, ['', 'blank']); for (let i = h2; i <= lastContent(R.lines, h2, end2); i++) put(a, [body(R.lines[i]), 'section']); });
      if (a < 0 && C.lines.length) put(a, ['', 'blank']);
      sectionsAdded.push(h >= 0 ? (HDR.exec(R.lines[h].trim()) || [, ''])[1] : '');
      for (const [, e] of ents) addedRows.push(['added', e.sec, e.key, e.line + 1, '', e.val, '']);
    }
  });
  const drop = new Map(), upd = new Map(), canUpdate = [], canRemove = { dup: 0, only: 0 };
  C.entries.forEach((e, i) => {
    const k = cid[i], n = +k.split('\u0000')[2], only = R.entries.length > 0 && !rkeys.has(baseOf(k));
    if (n > 0) canRemove.dup++; if (only) canRemove.only++;
    if (opts.removeDup && n > 0) drop.set(e.line, ['duplicate', e]);
    else if (opts.removeOnly && only) drop.set(e.line, ['only in yours', e]);
    else if (opts.update && n === 0 && !only) {
      const r = rpos.get(k), nv = r ? opts.update(e.sec, e.key, e.val, r.val) : null;
      if (nv !== null && nv !== undefined && nv !== e.val) { canUpdate.push([e.sec, e.key, e.line + 1, e.val, nv]); if (opts.applyUpdate) upd.set(e.line, nv); }
    }
  });
  let cl = C.lines.slice(); const eol = C.lines.some(l => /[\r\n]$/.test(l)) ? C.eol : R.eol;
  if (cl.length && !/[\r\n]$/.test(cl[cl.length - 1]) && ins.has(cl.length - 1)) cl[cl.length - 1] += eol;
  const out = [], flag = [], push = (t, f) => { out.push(t); flag.push(f); };
  (ins.get(-1) || []).forEach(([t]) => push(t + eol, 'ins'));
  cl.forEach((line, i) => {
    if (!drop.has(i)) {
      if (upd.has(i)) { const q = line.indexOf('='), end = (/[\r\n]+$/.exec(line) || [''])[0]; push(line.slice(0, q + 1) + upd.get(i) + end, 'upd'); }
      else push(line, '');
    }
    (ins.get(i) || []).forEach(([t]) => push(t + eol, 'ins'));
  });
  const removed = [...drop.values()].map(([why, e]) => [why, e.sec, e.key, e.line + 1, e.val]), updated = canUpdate.filter(u => upd.has(u[2] - 1));
  return { kind: 'ini', rows: addedRows.concat(rows), merged: out.join(''), added: addedRows.length, sectionsAdded, removed, updated, canUpdate, canRemove,
    view: { lines: out.map(body), flag }, touched: addedRows.length + removed.length + updated.length > 0 };
}

export function reportMd(name, refName, res, notes = []) {
  if (res.kind === 'text') return `# ${name}\n\nNot an ini/localisation file; no lines merged.\n`;
  const c = {}; res.rows.forEach(r => c[r[0]] = (c[r[0]] || 0) + 1);
  const md = [`# ${name}`, '', `reference: \`${refName}\``, ...notes.map(n => '> ' + n), '', '| status | lines | meaning |', '|---|---|---|',
    `| added | ${c.added || 0} | missing in your file, inserted from the reference (untranslated) |`,
    `| duplicate-in-custom | ${c['duplicate-in-custom'] || 0} | key repeated in your file (often a copy-paste slip) |`,
    `| only-in-custom | ${c['only-in-custom'] || 0} | key not in the reference (custom key or typo: the game ignores it) |`,
    `| changed | ${c.changed || 0} | translated / edited |`, `| same-text | ${c['same-text'] || 0} | same as the reference (maybe untranslated) |`, ''];
  if (res.sectionsAdded.length) md.push('Sections added: ' + res.sectionsAdded.map(s => '`[' + s + ']`').join(', '), '');
  const cell = v => { v = mdCell(v); return v.length > 120 ? v.slice(0, 120) + '…' : v; };
  if (res.sdd) md.push(`${res.sdd} of the added lines come from the game's design data (marked *design data* below).`, '');
  if (res.updated && res.updated.length) {
    md.push(`## updated to the new English (${res.updated.length})`, '', 'These lines were still the English text of the previous game version.', '', '| section | key | your line | old English | new English |', '|---|---|---|---|---|');
    res.updated.forEach(u => md.push(`| ${cell(u[0])} | \`${cell(u[1])}\` | ${u[2]} | ${cell(u[3])} | ${cell(u[4])} |`)); md.push('');
  }
  if (res.removed && res.removed.length) {
    md.push(`## removed (${res.removed.length})`, '', '| reason | section | key | your line | value |', '|---|---|---|---|---|');
    res.removed.forEach(u => md.push(`| ${u[0]} | ${cell(u[1])} | \`${cell(u[2])}\` | ${u[3]} | ${cell(u[4])} |`)); md.push('');
  }
  for (const st of ['added', 'duplicate-in-custom', 'only-in-custom']) {
    const rows = res.rows.filter(r => r[0] === st); if (!rows.length) continue;
    md.push(`## ${st} (${rows.length})`, '', '| section | key | ref line | your line | value |', '|---|---|---|---|---|');
    rows.forEach(r => { md.push(`| ${cell(r[1])} | \`${mdCell(r[2])}\`${r[7] === 'sdd' ? ' *design data*' : ''} | ${r[3]} | ${r[4]} | ${cell(st === 'added' ? r[5] : r[6])} |`); });
    md.push('');
  }
  return md.join('\n');
}
