export const STATUS = ['added', 'duplicate-in-custom', 'only-in-custom', 'changed', 'same-text'];

function splitLines(text) { const out = []; const re = /[^\r\n]*(\r\n|\n|\r|$)/g; let m; while ((m = re.exec(text)) && m[0] !== '') out.push(m[0]); return out; }
const body = l => l.replace(/[\r\n]+$/, '');

export function parseIni(text) {
  const lines = splitLines(text), entries = []; let sec = '';
  lines.forEach((line, i) => {
    const s = line.trim(); if (!s || s.startsWith(';') || s.startsWith('//')) return;
    if (s.startsWith('[') && s.endsWith(']')) { sec = s.slice(1, -1); return; }
    const eq = s.indexOf('='); if (eq >= 0) entries.push({ sec, key: s.slice(0, eq).trim(), val: s.slice(eq + 1), line: i });
  });
  return { lines, entries, eol: text.includes('\r\n') ? '\r\n' : '\n' };
}
function ids(entries) { const seen = new Map(); return entries.map(e => { const k = e.sec.toLowerCase() + '\u0000' + e.key.toLowerCase(), n = seen.get(k) || 0; seen.set(k, n + 1); return k + '\u0000' + n; }); }
function sectionRanges(lines) {
  const out = new Map(); let sec = '', start = -1;
  lines.forEach((line, i) => { const s = line.trim(); if (s.startsWith('[') && s.endsWith(']')) { if (!out.has(sec.toLowerCase())) out.set(sec.toLowerCase(), [start, i - 1]); sec = s.slice(1, -1); start = i; } });
  if (!out.has(sec.toLowerCase())) out.set(sec.toLowerCase(), [start, lines.length - 1]);
  return out;
}
function lastContent(lines, a, b) { for (let i = b; i > a; i--) if (lines[i].trim()) return i; return a; }

export function compare(refText, cusText, refName = 'reference', mark = false) {
  const R = parseIni(refText), C = parseIni(cusText);
  if (!R.entries.length && !C.entries.length) return { kind: 'text', rows: [], merged: null, added: 0, sectionsAdded: [] };
  const rid = ids(R.entries), cid = ids(C.entries), cpos = new Map(cid.map((k, i) => [k, C.entries[i]])), rpos = new Map(rid.map((k, i) => [k, R.entries[i]]));
  const rows = [], addedRows = [], sectionsAdded = [], rkeys = new Set(rid.map(k => k.split('\u0000').slice(0, 2).join('\u0000')));
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
        const a = prev !== null ? prev : cr.has(s) ? cr.get(s)[0] : -1, blk = ins.get(a);
        if (mark && !(blk && blk[blk.length - 1][1] === 'entry')) put(a, ['; added from ' + refName, 'mark']);
        put(a, [body(R.lines[e.line]), 'entry']); addedRows.push(['added', e.sec, e.key, e.line + 1, '', e.val, '']);
      }
    } else {
      const prevSec = order.slice(0, si).reverse().find(p => cr.has(p));
      let a;
      if (prevSec !== undefined) a = lastContent(C.lines, ...cr.get(prevSec));
      else { const nxt = order.slice(si + 1).find(p => cr.has(p) && cr.get(p)[0] >= 0); a = nxt !== undefined ? cr.get(nxt)[0] - 1 : C.lines.length - 1; }
      const [h, end] = rr.get(s);
      if (a >= 0) put(a, ['', 'blank']);
      if (mark) put(a, ['; section added from ' + refName, 'mark']);
      for (let i = h; i <= lastContent(R.lines, h, end); i++) put(a, [body(R.lines[i]), 'section']);
      if (a < 0 && C.lines.length) put(a, ['', 'blank']);
      sectionsAdded.push(h >= 0 ? R.lines[h].trim().slice(1, -1) : '');
      for (const [, e] of ents) addedRows.push(['added', e.sec, e.key, e.line + 1, '', e.val, '']);
    }
  });
  let cl = C.lines.slice(); const eol = C.eol;
  if (cl.length && !/[\r\n]$/.test(cl[cl.length - 1]) && ins.has(cl.length - 1)) cl[cl.length - 1] += eol;
  const out = []; (ins.get(-1) || []).forEach(([t]) => out.push(t + eol));
  cl.forEach((line, i) => { out.push(line); (ins.get(i) || []).forEach(([t]) => out.push(t + eol)); });
  return { kind: 'ini', rows: addedRows.concat(rows), merged: out.join(''), added: addedRows.length, sectionsAdded };
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
  for (const st of ['added', 'duplicate-in-custom', 'only-in-custom']) {
    const rows = res.rows.filter(r => r[0] === st); if (!rows.length) continue;
    md.push(`## ${st} (${rows.length})`, '', '| section | key | ref line | your line | value |', '|---|---|---|---|---|');
    rows.forEach(r => { const v = String(st === 'added' ? r[5] : r[6]).replace(/\|/g, '\\|'); md.push(`| ${r[1]} | \`${r[2].replace(/\|/g, '\\|')}\` | ${r[3]} | ${r[4]} | ${v.length > 120 ? v.slice(0, 120) + '…' : v} |`); });
    md.push('');
  }
  return md.join('\n');
}
