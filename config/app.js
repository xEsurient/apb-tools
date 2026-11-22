import { decodeText, encodeText, fitEnc, readInputs, writeZip, download } from './lib.js';
import { compare, reportMd, STATUS } from './locmerge.js';
import { apbdbInventoryItemTypes } from './apbdb.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stem = n => n.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
const isLoc = n => /\.(int|ger|fra|ita|esn|spa|rus|bra|pol|jpn|cze|hun|ini|txt)$/i.test(n);
const status = t => $('#status').textContent = t;

let REF = [], CUS = [], PREV = [], RESULT = null, SDD = null;
function keyMap(text) {
  const m = new Map(); let sec = '';
  for (const l of text.split(/\r\n|\n|\r/)) {
    const t = l.trim(); if (!t || t.startsWith(';')) continue;
    if (t.startsWith('[') && t.endsWith(']')) { sec = t.slice(1, -1).toLowerCase(); continue; }
    const eq = l.indexOf('='); if (eq <= 0) continue;
    let v = l.slice(eq + 1); if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    const k = sec + '\u0000' + l.slice(0, eq).trim().toLowerCase(); if (!m.has(k)) m.set(k, v);
  }
  return m;
}
async function sddLines() { if (!SDD) SDD = await (await fetch('sddlines.json')).json(); return SDD; }
function withSdd(text, d) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n', lines = text.split(/\r?\n/), want = d.section.toLowerCase();
  const pos = new Map(); let sec = '', last = -1;
  lines.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('[') && t.endsWith(']')) { sec = t.slice(1, -1).toLowerCase(); if (sec === want && last < 0) last = i; return; }
    const m = /^([^;=][^=]*?)\s*=/.exec(t);
    if (sec === want && m) { pos.set(m[1].toLowerCase(), i); last = i; }
  });
  const after = new Map(), tail = []; let n = 0;
  for (const [anchor, key, val] of d.lines) {
    if (pos.has(key.toLowerCase())) continue;
    const i = pos.get(anchor.toLowerCase()) ?? last, line = `${key}=${val}`; n++;
    if (i < 0) tail.push(line); else (after.get(i) || after.set(i, []).get(i)).push(line);
  }
  if (!n) return { text, n };
  const out = [];
  lines.forEach((l, i) => { out.push(l); if (after.has(i)) out.push(...after.get(i)); });
  if (tail.length) { if (out.length && out[out.length - 1] === '') out.pop(); out.push(`[${d.section}]`, ...tail, ''); }
  return { text: out.join(eol), n };
}
async function pick(input, which) {
  let files;
  try { files = await readInputs(input.files); } catch (e) { $(which === 'ref' ? '#refinfo' : '#cusinfo').textContent = 'Could not read that: ' + e.message; return; }
  if (which === 'prev') { PREV = files.filter(f => isLoc(f.name)); $('#previnfo').textContent = `${PREV.length} file(s) of the previous version loaded.`; return; }
  if (which === 'ref') { REF = files.filter(f => isLoc(f.name)); $('#refinfo').textContent = `${REF.length} reference file(s) loaded.`; }
  else { CUS = files; $('#cusinfo').textContent = `${files.length} file(s) in your config, ${files.filter(f => isLoc(f.name)).length} localisation/ini.`; }
}
$('#prevdir').onchange = e => pick(e.target, 'prev'); $('#prevfiles').onchange = e => pick(e.target, 'prev');
$('#refdir').onchange = e => pick(e.target, 'ref'); $('#reffiles').onchange = e => pick(e.target, 'ref');
$('#cuszip').onchange = e => pick(e.target, 'cus'); $('#cusdir').onchange = e => pick(e.target, 'cus');

$('#run').onclick = async () => {
  try {
    if (!CUS.length) return status('Choose your config first.');
    const refs = new Map(REF.map(f => [stem(f.name), { name: f.name.split('/').pop(), ...decodeText(f.data), src: 'game' }]));
    if ($('#useapbdb').checked && !refs.has('inventoryitemtypes') && CUS.some(f => stem(f.name) === 'inventoryitemtypes')) {
      const a = await apbdbInventoryItemTypes(status);
      refs.set('inventoryitemtypes', { name: `APBDB (${a.items} items)`, text: a.text, enc: 'utf-16le', bom: true, fixed: 0, src: 'apbdb' });
    }
    if (!refs.size) return status('No reference: pick the game\'s INT folder (or enable APBDB for InventoryItemTypes).');
    if ($('#usesdd').checked) {
      const sdd = await sddLines();
      for (const [s, d] of Object.entries(sdd)) {
        const r = refs.get(s.toLowerCase()); if (!r || r.src !== 'game') continue;
        const x = withSdd(r.text, d); if (x.n) refs.set(s.toLowerCase(), { ...r, text: x.text, sdd: x.n });
      }
    }
    status('comparing…');
    const results = [], merged = new Map(), prevs = new Map(PREV.map(f => [stem(f.name), f]));
    for (const f of CUS) {
      if (!isLoc(f.name)) continue; const r = refs.get(stem(f.name)); if (!r) continue;
      const c = decodeText(f.data), res = compare(r.text, c.text, r.name, $('#mark').checked);
      if (r.src === 'apbdb') res.rows = res.rows.filter(x => x[0] !== 'only-in-custom');
      const notes = [];
      if (r.fixed) notes.push(`the reference had ${r.fixed} damaged line end(s) (CR-CRLF in UTF-16), read repaired`);
      if (c.fixed) notes.push(`your file had ${c.fixed} damaged line end(s), repaired in the merged copy`);
      if (r.src === 'apbdb') notes.push('reference built from APBDB item names (DisplayName/CreatorName only)');
      if (r.sdd) notes.push(`${r.sdd} reference line(s) come from the game's design data: keys the game defines but its INT files leave out`);
      let outdated = null;
      const pf = r.src === 'game' && prevs.get(stem(f.name));
      if (pf) {
        const old = keyMap(decodeText(pf.data).text);
        outdated = res.rows.filter(x => (x[0] === 'changed' || x[0] === 'same-text') && old.has(x[1].toLowerCase() + '\u0000' + x[2].trim().toLowerCase()) && old.get(x[1].toLowerCase() + '\u0000' + x[2].trim().toLowerCase()) !== x[5])
          .map(x => ({ sec: x[1], key: x[2], was: old.get(x[1].toLowerCase() + '\u0000' + x[2].trim().toLowerCase()), now: x[5], yours: x[6] }));
        if (outdated.length) notes.push(`${outdated.length} of your line(s) override English text that changed since the previous version: check them (listed first below and in the report)`);
      }
      results.push({ path: f.name, ref: r.name, res, notes, outdated });
      if (res.merged !== null && (res.added || c.fixed)) {
        const e = fitEnc(res.merged, c.enc, c.bom, c.text);
        if (e.bad.length) notes.push(`saved as UTF-16: the added lines use characters an 8-bit file cannot hold (${e.bad.slice(0, 8).join(' ')})`);
        merged.set(f.name, encodeText(res.merged, e.enc, e.bom));
      }
    }
    const unmatched = CUS.filter(f => isLoc(f.name) && !refs.has(stem(f.name))).map(f => f.name);
    const missingKeys = [...refs.keys()].filter(s => !CUS.some(f => stem(f.name) === s) && refs.get(s).src === 'game');
    const missing = missingKeys.map(s => refs.get(s).name), addedFiles = [];
    if ($('#addmissing').checked && missingKeys.length) {
      const locs = CUS.filter(f => refs.has(stem(f.name))), top = arr => Object.entries(arr.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0]?.[0];
      const dir = top(locs.map(f => f.name.split('/').slice(0, -1).join('/'))) ?? '', ext = top(locs.map(f => f.name.split('.').pop())) ?? 'INT';
      for (const s of missingKeys) {
        const r = refs.get(s), name = (dir ? dir + '/' : '') + r.name.replace(/\.[^.]+$/, '') + '.' + ext;
        merged.set(name, encodeText(r.text, r.enc, r.bom)); addedFiles.push(name);
      }
    }
    RESULT = { results, merged, unmatched, missing, addedFiles };
    draw(); status(`${results.length} file(s) compared, ${results.reduce((a, r) => a + r.res.added, 0).toLocaleString()} line(s) added to ${merged.size - addedFiles.length} file(s)${addedFiles.length ? `, ${addedFiles.length} file(s) added` : ''}.`);
    $('#dlzip').disabled = $('#dlsum').disabled = false;
  } catch (e) { status('Error: ' + e.message); console.error(e); }
};

function counts(res) { const c = {}; res.rows.forEach(r => c[r[0]] = (c[r[0]] || 0) + 1); return c; }
function draw() {
  const { results, unmatched, missing } = RESULT;
  $('#out').innerHTML = `<div class="glass card"><h3>Summary</h3><table class="grid" id="files"><tr><th>File</th><th>Reference</th><th>Added</th><th>Sections added</th><th>Duplicates</th><th>Only in yours</th><th>Changed</th><th>Same text</th>${RESULT.results.some(r => r.outdated) ? '<th>English changed</th>' : ''}</tr>
    ${results.map((r, i) => { const c = counts(r.res); return `<tr class="click" data-i="${i}"><td>${esc(r.path)}</td><td>${esc(r.ref)}</td><td class="${r.res.added ? 'ok' : ''}">${r.res.added}</td><td>${esc(r.res.sectionsAdded.join(', '))}</td>
      <td>${c['duplicate-in-custom'] || 0}</td><td>${c['only-in-custom'] || 0}</td><td>${c.changed || 0}</td><td>${c['same-text'] || 0}</td>${results.some(x => x.outdated) ? `<td class="${r.outdated && r.outdated.length ? 'warn' : ''}">${r.outdated ? r.outdated.length : '-'}</td>` : ''}</tr>`; }).join('')}</table>
    ${RESULT.addedFiles.length ? `<p class="hint ok">Added ${RESULT.addedFiles.length} whole file(s) from the reference (untranslated): ${RESULT.addedFiles.map(esc).join(', ')}</p>`
      : missing.length ? `<p class="hint">Reference files your config doesn't have (${missing.length}): ${missing.map(esc).join(', ')} - turn on "Also add whole files" to include them.</p>` : ''}
    ${unmatched.length ? `<p class="hint">Your files without a reference (${unmatched.length}): ${unmatched.map(esc).join(', ')}</p>` : ''}
    <p class="hint">Click a file for its line-by-line list.</p></div>`;
  $('#files').querySelectorAll('tr.click').forEach(tr => tr.onclick = () => detail(+tr.dataset.i));
}
function detail(i) {
  const r = RESULT.results[i], rows = r.res.rows.slice().sort((a, b) => STATUS.indexOf(a[0]) - STATUS.indexOf(b[0]));
  $("#detail").innerHTML = `<div class="glass card"><h3>${esc(r.path)}</h3>${r.notes.map(n => `<p class="hint">${esc(n)}</p>`).join('')}
    ${r.outdated && r.outdated.length ? `<h3>English changed since the previous version (${r.outdated.length})</h3><table class="grid"><tr><th>Key</th><th>Old English</th><th>New English</th><th>Your text</th></tr>
    ${r.outdated.slice(0, 2000).map(o => `<tr><td>${esc(o.key)}</td><td class="v" title="${esc(o.was)}">${esc(o.was)}</td><td class="v" title="${esc(o.now)}">${esc(o.now)}</td><td class="v" title="${esc(o.yours)}">${esc(o.yours)}</td></tr>`).join('')}</table>` : ''}
    <table class="grid"><tr><th>Status</th><th>Section</th><th>Key</th><th>Ref line</th><th>Your line</th><th>Reference text</th><th>Your text</th></tr>
    ${rows.slice(0, 5000).map(x => `<tr><td class="st-${x[0]}">${x[0]}</td><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${x[3]}</td><td>${x[4]}</td><td class="v" title="${esc(x[5])}">${esc(x[5])}</td><td class="v" title="${esc(x[6])}">${esc(x[6])}</td></tr>`).join('')}</table>
    ${rows.length > 5000 ? `<p class="hint">first 5,000 of ${rows.length} rows</p>` : ''}</div>`;
  $('#detail').scrollIntoView({ behavior: 'smooth' });
}
function summaryMd() {
  const { results, unmatched, missing } = RESULT, md = ['# Merge summary', '', `${results.length} file(s) compared, ${RESULT.merged.size - RESULT.addedFiles.length} changed.`, '',
    '| file | reference | added lines | added sections | duplicates | only in yours | changed | same text |', '|---|---|---|---|---|---|---|---|'];
  results.forEach(r => { const c = counts(r.res); md.push(`| ${r.path} | ${r.ref} | ${r.res.added} | ${r.res.sectionsAdded.join(', ')} | ${c['duplicate-in-custom'] || 0} | ${c['only-in-custom'] || 0} | ${c.changed || 0} | ${c['same-text'] || 0} |`); });
  md.push('', '## Lines added per file', '');
  results.filter(r => r.res.added).forEach(r => {
    const secs = {}; r.res.rows.filter(x => x[0] === 'added').forEach(x => secs[x[1]] = (secs[x[1]] || 0) + 1);
    md.push(`- **${r.path}**: ${r.res.added} line(s) - ${Object.entries(secs).map(([s, n]) => `[${s}] ${n}`).join(', ')}`);
  });
  if (RESULT.addedFiles.length) md.push('', `## Files added from the reference, untranslated (${RESULT.addedFiles.length})`, '', ...RESULT.addedFiles.map(m => '- ' + m));
  else if (missing.length) md.push('', `## Reference files your config doesn't have (${missing.length})`, '', ...missing.map(m => '- ' + m));
  if (unmatched.length) md.push('', `## Your files without a reference (${unmatched.length})`, '', ...unmatched.map(m => '- ' + m));
  const od = results.filter(r => r.outdated && r.outdated.length);
  if (od.length) { md.push('', '## Your lines whose English original changed since the previous version', ''); od.forEach(r => { md.push(`### ${r.path} (${r.outdated.length})`, ''); r.outdated.forEach(o => md.push(`- \`${o.key}\`: was "${o.was}", now "${o.now}"; yours: "${o.yours}"`)); md.push(''); }); }
  return md.join('\n') + '\n';
}
$('#dlsum').onclick = () => download(new Blob([summaryMd()], { type: 'text/markdown' }), 'SUMMARY.md');
$('#dlzip').onclick = async () => {
  status('building zip…'); const enc = s => new TextEncoder().encode(s);
  const files = CUS.map(f => ({ name: f.name, data: RESULT.merged.get(f.name) || f.data }));
  RESULT.addedFiles.forEach(n => files.push({ name: n, data: RESULT.merged.get(n) }));
  files.push({ name: '_merge_report/SUMMARY.md', data: enc(summaryMd()) });
  RESULT.results.forEach(r => files.push({ name: `_merge_report/${r.path.split('/').pop()}.diff.md`, data: enc(reportMd(r.path, r.ref, r.res, r.notes)) }));
  download(await writeZip(files), 'config-merged.zip'); status('zip ready: merged files keep their folders; reports are in _merge_report/.');
};
