import { decodeText, encodeText, fitEnc, readInputs, writeZip, download } from './lib.js';
import { compare, reportMd, STATUS, stem, isLoc, isIni, pairs, byStem, okey, keyMap, withSdd, csvCell, mdCell, contextBlocks } from './locmerge.js';
import { apbdbInventoryItemTypes } from './apbdb.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const status = t => $('#status').textContent = t;

let REF = [], CUS = [], PREV = [], RESULT = null, SDD = null;
const PICK = { ref: 0, cus: 0, prev: 0 }, BUSY = { ref: 0, cus: 0, prev: 0 }; let RUN = 0;
async function sddLines() { if (!SDD) SDD = await (await fetch('sddlines.json')).json(); return SDD; }
const BOX = { ref: '#refinfo', cus: '#cusinfo', prev: '#previnfo' }, INFO0 = {}, BIG = 5 << 20;
Object.entries(BOX).forEach(([k, b]) => { INFO0[k] = $(b).innerHTML; });
const isZip = f => !f.webkitRelativePath && /\.zip$/i.test(f.name);
const KEEP = { ref: f => isLoc(f.name) || isZip(f), prev: f => isLoc(f.name) || isZip(f), cus: f => isLoc(f.name) || isZip(f) || f.size <= BIG };
const setStep = (which, files) => { if (which === 'prev') PREV = files; else if (which === 'ref') REF = files; else CUS = files; $(`button[data-clear="${which}"]`).hidden = !files.length; };
function resetRun() { RUN++; RESULT = null; $('#dlzip').disabled = $('#dlsum').disabled = $('#dlcsv').disabled = true; $('#out').innerHTML = ''; $('#detail').innerHTML = ''; status(''); }
async function pick(input, which) {
  let files;
  const tok = ++PICK[which], box = BOX[which];
  resetRun(); BUSY[which]++;
  try { files = await readInputs(input.files, KEEP[which]); } catch (e) { if (tok !== PICK[which]) return; setStep(which, []); $(box).textContent = 'Could not read that: ' + e.message; return; } finally { BUSY[which]--; }
  if (tok !== PICK[which]) return;
  const sk = files.skipped ? which === 'cus' ? ` ${files.skipped} big non-localisation file(s) over 5 MB were left out (they are not in the merged zip).` : ` ${files.skipped} other file(s) skipped.` : '';
  if (which === 'prev') { setStep('prev', files.filter(f => isLoc(f.name))); $('#previnfo').textContent = `${PREV.length} file(s) of the previous version loaded.${sk}`; return; }
  if (which === 'ref') { setStep('ref', files.filter(f => isLoc(f.name))); $('#refinfo').textContent = `${REF.length} reference file(s) loaded.${sk}`; }
  else {
    const seen = new Set(), uniq = files.filter(f => { const k = f.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }), dups = files.length - uniq.length;
    setStep('cus', uniq); $('#cusinfo').textContent = `${uniq.length} file(s) in your config, ${uniq.filter(f => isLoc(f.name)).length} localisation/ini.${sk}${dups ? ` ${dups} file(s) with the same path in another picked zip were left out (the first copy is used).` : ''}`;
  }
}
document.querySelectorAll('button[data-clear]').forEach(b => b.onclick = () => {
  const w = b.dataset.clear; PICK[w]++; setStep(w, []); resetRun();
  b.closest('.pick').querySelectorAll('input[type=file]').forEach(i => { i.value = ''; });
  $(BOX[w]).innerHTML = INFO0[w];
});
$('#prevdir').onchange = e => pick(e.target, 'prev'); $('#prevfiles').onchange = e => pick(e.target, 'prev');
$('#refdir').onchange = e => pick(e.target, 'ref'); $('#reffiles').onchange = e => pick(e.target, 'ref');
$('#cuszip').onchange = e => pick(e.target, 'cus'); $('#cusdir').onchange = e => pick(e.target, 'cus');

$('#run').onclick = async () => {
  try {
    if (BUSY.ref || BUSY.cus || BUSY.prev) return status('Still reading the files you picked: try again in a moment.');
    if (!CUS.length) return status('Choose your config first.');
    const tok = ++RUN;
    const rb = byStem(REF, f => f.name), refs = new Map([...rb.m].map(([k, f]) => [k, { name: f.name.split('/').pop(), ...decodeText(f.data), src: 'game' }])), early = [];
    if (rb.dup.length) early.push(`Several reference files share a name (${rb.dup.slice(0, 6).join(', ')}${rb.dup.length > 6 ? ' …' : ''}): the .int one is used; pick only the INT folder to avoid this.`);
    if ($('#useapbdb').checked && !refs.has('inventoryitemtypes') && CUS.some(f => stem(f.name) === 'inventoryitemtypes')) {
      try { const a = await apbdbInventoryItemTypes(status); refs.set('inventoryitemtypes', { name: `APBDB (${a.items} items)`, text: a.text, enc: 'utf-16le', bom: true, fixed: 0, src: 'apbdb' }); }
      catch (e) { early.push('APBDB item names could not be loaded (' + e.message + '): InventoryItemTypes was not compared.'); }
    }
    if (!refs.size) return status('No reference: pick the game\'s INT folder (or enable APBDB for InventoryItemTypes).');
    if ($('#usesdd').checked) {
      const sdd = await sddLines();
      for (const [s, d] of Object.entries(sdd)) {
        const r = refs.get(s.toLowerCase()); if (!r || r.src !== 'game') continue;
        const x = withSdd(r.text, d); if (x.n) refs.set(s.toLowerCase(), { ...r, text: x.text, sdd: x.n, sddKeys: x.keys });
      }
    }
    status('comparing…');
    const results = [], merged = new Map(), pb = byStem(PREV, f => f.name), prevs = pb.m;
    if (pb.dup.length) early.push(`Several previous-version files share a name (${pb.dup.slice(0, 6).join(', ')}): the .int one is used.`);
    for (const f of CUS) {
      if (!isLoc(f.name)) continue; const r = refs.get(stem(f.name)); if (!r || !pairs(f.name, r.name)) continue;
      const notes = [];
      const c = decodeText(f.data), pf = r.src === 'game' && prevs.get(stem(f.name)), old = pf ? keyMap(decodeText(pf.data).text) : null;
      const res = compare(r.text, c.text, r.name, $('#mark').checked, {
        removeDup: $('#rmdup').checked, removeOnly: $('#rmonly').checked && r.src === 'game' && !isIni(f.name),
        update: old ? (sec, key, yv, rv) => old.has(okey(sec, key)) && old.get(okey(sec, key)) === yv && rv !== yv ? rv : null : null, applyUpdate: $('#updold').checked });
      if (r.src === 'apbdb') res.rows = res.rows.filter(x => x[0] !== 'only-in-custom');
      if (r.sddKeys) { res.sdd = 0; res.rows.forEach(x => { if (x[0] === 'added' && r.sddKeys.has(okey(x[1], x[2]))) { x[7] = 'sdd'; res.sdd++; } }); }
      if (res.updated && res.updated.length) notes.push(`${res.updated.length} line(s) that were still the previous version's English were updated to the new English`);
      else if (res.canUpdate && res.canUpdate.length) notes.push(`${res.canUpdate.length} line(s) are still the previous version's English (untranslated): turn on "Update lines that are still the old English" to refresh them`);
      if (res.removed && res.removed.length) notes.push(`${res.removed.length} line(s) removed (${[['duplicate', 'repeated keys'], ['only in yours', 'keys the game does not have']].map(([w, t]) => [res.removed.filter(x => x[0] === w).length, t]).filter(x => x[0]).map(([n, t]) => `${n} ${t}`).join(', ')})`);
      if (r.fixed) notes.push(`the reference had ${r.fixed} damaged line end(s) (CR-CRLF in UTF-16), read repaired`);
      if (c.oddByte) notes.push('your file ended with a stray half character (odd byte count in UTF-16): it is left out of the merged copy');
      if (c.fixed) notes.push(`your file had ${c.fixed} damaged line end(s), repaired in the merged copy`);
      if (r.src === 'apbdb') notes.push('reference built from APBDB item names (DisplayName/CreatorName only)');
      if (r.sdd) notes.push(`${r.sdd} reference line(s) come from the game's design data: keys the game defines but its INT files leave out`);
      let outdated = null;
      if (old) {
        const done = new Set((res.updated || []).map(u => okey(u[0], u[1])));
        outdated = res.rows.filter(x => !done.has(okey(x[1], x[2]))).filter(x => x[0] === 'changed' && old.has(okey(x[1], x[2])) && old.get(okey(x[1], x[2])) !== x[5])
          .map(x => ({ sec: x[1], key: x[2], was: old.get(okey(x[1], x[2])), now: x[5], yours: x[6] }));
        if (outdated.length) notes.push(`${outdated.length} of your line(s) override English text that changed since the previous version: check them (listed first below and in SUMMARY.md)`);
      }
      results.push({ path: f.name, ref: r.name, res, notes, outdated });
      if (res.merged !== null && (res.touched || c.fixed)) {
        const e = fitEnc(res.merged, c.enc, c.bom, c.text);
        if (e.bad.length) notes.push(`saved as UTF-16: the added lines use characters an 8-bit file cannot hold (${e.bad.slice(0, 8).join(' ')})`);
        merged.set(f.name, encodeText(res.merged, e.enc, e.bom));
      }
    }
    const unmatched = CUS.filter(f => isLoc(f.name) && !(refs.has(stem(f.name)) && pairs(f.name, refs.get(stem(f.name)).name))).map(f => f.name);
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
    if (tok !== RUN) return;
    RESULT = { results, merged, unmatched, missing, addedFiles, early };
    draw(); status(`${results.length} file(s) compared, ${results.reduce((a, r) => a + r.res.added, 0).toLocaleString()} line(s) added to ${results.filter(r => r.res.added > 0).length} file(s)${addedFiles.length ? `, ${addedFiles.length} file(s) added` : ''}.`);
    $('#dlzip').disabled = $('#dlsum').disabled = false; $('#dlcsv').disabled = !results.some(r => r.outdated && r.outdated.length);
  } catch (e) { status('Error: ' + e.message); console.error(e); }
};

function counts(res) { const c = {}; res.rows.forEach(r => c[r[0]] = (c[r[0]] || 0) + 1); return c; }
const nUpd = r => (r.res.updated || []).length, nCan = r => (r.res.canUpdate || []).length, nRm = r => (r.res.removed || []).length;
function draw() {
  const { results, unmatched, missing } = RESULT, showUpd = results.some(r => r.outdated), showRm = results.some(r => nRm(r)), cand = results.reduce((a, r) => a + (nUpd(r) ? 0 : nCan(r)), 0), sdd = results.reduce((a, r) => a + (r.res.sdd || 0), 0);
  $('#out').innerHTML = `<div class="glass card"><h3>Summary</h3>${(RESULT.early || []).map(n => `<p class="hint warn">${esc(n)}</p>`).join('')}<table class="grid" id="files"><tr><th>File</th><th>Reference</th><th>Added</th><th>Sections added</th><th>Duplicates</th><th>Only in yours</th><th>Changed</th><th>Same text</th>${RESULT.results.some(r => r.outdated) ? '<th>English changed</th>' : ''}${showUpd ? '<th title="Lines that were still the previous version\'s English">Updated</th>' : ''}${showRm ? '<th>Removed</th>' : ''}</tr>
    ${results.map((r, i) => { const c = counts(r.res); return `<tr class="click" data-i="${i}"><td>${esc(r.path)}</td><td>${esc(r.ref)}</td><td class="${r.res.added ? 'ok' : ''}">${r.res.added}</td><td>${esc(r.res.sectionsAdded.join(', '))}</td>
      <td>${c['duplicate-in-custom'] || 0}</td><td>${c['only-in-custom'] || 0}</td><td>${c.changed || 0}</td><td>${c['same-text'] || 0}</td>${results.some(x => x.outdated) ? `<td class="${r.outdated && r.outdated.length ? 'warn' : ''}">${r.outdated ? r.outdated.length : '-'}</td>` : ''}${showUpd ? `<td class="${nUpd(r) ? 'ok' : ''}">${nUpd(r) || (nCan(r) ? `<span class="dim" title="not updated: the switch is off">${nCan(r)} (off)</span>` : 0)}</td>` : ''}${showRm ? `<td>${nRm(r)}</td>` : ''}</tr>`; }).join('')}</table>
    ${cand ? `<p class="hint warn">${cand} line(s) in your files are still the previous version's English while the game's English changed. Turn on "Update lines that are still the old English" (step 3) and press Compare again to refresh them.</p>` : ''}
    ${sdd ? `<p class="hint">${sdd} of the added lines come from the game's design data (marked in the file lists).</p>` : ''}
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
    ${detailExtra(r)}
    <table class="grid"><tr><th>Status</th><th>Section</th><th>Key</th><th>Ref line</th><th>Your line</th><th>Reference text</th><th>Your text</th></tr>
    ${rows.slice(0, 5000).map(x => `<tr><td class="st-${x[0]}">${x[0]}${x[7] === 'sdd' ? ' <span class="tag dd">design data</span>' : ''}</td><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${x[3]}</td><td>${x[4]}</td><td class="v" title="${esc(x[5])}">${esc(x[5])}</td><td class="v" title="${esc(x[6])}">${esc(x[6])}</td></tr>`).join('')}</table>
    ${rows.length > 5000 ? `<p class="hint">first 5,000 of ${rows.length} rows</p>` : ''}</div>`;
  $('#detail').scrollIntoView({ behavior: 'smooth' });
}
function detailExtra(r) {
  const res = r.res, h = [], row = cells => `<tr>${cells.map(c => `<td class="v" title="${esc(c)}">${esc(c)}</td>`).join('')}</tr>`;
  if (res.updated && res.updated.length) h.push(`<h3>Updated to the new English (${res.updated.length})</h3><table class="grid"><tr><th>Section</th><th>Key</th><th>Old English (was yours)</th><th>New English</th></tr>${res.updated.slice(0, 2000).map(u => row([u[0], u[1], u[3], u[4]])).join('')}</table>`);
  else if (res.canUpdate && res.canUpdate.length) h.push(`<h3>Still the old English (${res.canUpdate.length}, not updated)</h3><table class="grid"><tr><th>Section</th><th>Key</th><th>Old English (yours)</th><th>New English</th></tr>${res.canUpdate.slice(0, 2000).map(u => row([u[0], u[1], u[3], u[4]])).join('')}</table>`);
  if (res.removed && res.removed.length) h.push(`<h3>Will be removed (${res.removed.length})</h3><table class="grid"><tr><th>Reason</th><th>Section</th><th>Key</th><th>Your line</th><th>Value</th></tr>${res.removed.slice(0, 2000).map(u => row([u[0], u[1], u[2], String(u[3]), u[4]])).join('')}</table>`);
  if (res.view && res.view.flag.includes('ins')) {
    const { blocks, more } = contextBlocks(res.view);
    h.push(`<h3>Inserted lines in context (${res.added})</h3><div class="ctx">${blocks.map(([a, b]) => `<pre>${res.view.lines.slice(a, b).map((l, k) => `<span class="${res.view.flag[a + k] === 'ins' ? 'ins' : res.view.flag[a + k] === 'upd' ? 'upd' : ''}"><i>${a + k + 1}</i>${esc(l) || ' '}</span>`).join('\n')}</pre>`).join('')}</div>${more || blocks.length >= 300 ? '<p class="hint">First 300 places shown.</p>' : ''}`);
  }
  return h.join('');
}
function summaryMd() {
  const { results, unmatched, missing } = RESULT, oc = results.some(r => r.outdated), md = ['# Merge summary', '', `${results.length} file(s) compared, ${results.filter(r => r.res.added > 0).length} with lines added.`, ...(RESULT.early || []).map(n => '> ' + n), '',
    `| file | reference | added lines | added sections | duplicates | only in yours | changed | same text |${oc ? ' English changed |' : ''}`, `|---|---|---|---|---|---|---|---|${oc ? '---|' : ''}`];
  results.forEach(r => { const c = counts(r.res); md.push(`| ${mdCell(r.path)} | ${mdCell(r.ref)} | ${r.res.added} | ${mdCell(r.res.sectionsAdded.join(', '))} | ${c['duplicate-in-custom'] || 0} | ${c['only-in-custom'] || 0} | ${c.changed || 0} | ${c['same-text'] || 0} |${oc ? ` ${r.outdated ? r.outdated.length : '-'} |` : ''}`); });
  md.push('', '## Lines added per file', '');
  results.filter(r => r.res.added).forEach(r => {
    const secs = {}; r.res.rows.filter(x => x[0] === 'added').forEach(x => secs[x[1]] = (secs[x[1]] || 0) + 1);
    md.push(`- **${r.path}**: ${r.res.added} line(s) - ${Object.entries(secs).map(([s, n]) => `[${s}] ${n}`).join(', ')}`);
  });
  if (RESULT.addedFiles.length) md.push('', `## Files added from the reference, untranslated (${RESULT.addedFiles.length})`, '', ...RESULT.addedFiles.map(m => '- ' + m));
  else if (missing.length) md.push('', `## Reference files your config doesn't have (${missing.length})`, '', ...missing.map(m => '- ' + m));
  if (unmatched.length) md.push('', `## Your files without a reference (${unmatched.length})`, '', ...unmatched.map(m => '- ' + m));
  const od = results.filter(r => r.outdated && r.outdated.length);
  const up = results.filter(r => nUpd(r)), rm = results.filter(r => nRm(r)), sd = results.reduce((a, r) => a + (r.res.sdd || 0), 0), cn = results.reduce((a, r) => a + (nUpd(r) ? 0 : nCan(r)), 0);
  if (sd) md.push('', `${sd} of the added lines come from the game's design data (marked in each file's report).`);
  if (up.length) { md.push('', '## Lines updated to the new English (they were still the previous version\'s English)', ''); up.forEach(r => { md.push(`### ${r.path} (${nUpd(r)})`, ''); r.res.updated.forEach(u => md.push(`- [${u[0]}] \`${u[1]}\`: "${u[3]}" -> "${u[4]}"`)); md.push(''); }); }
  else if (cn) md.push('', `${cn} line(s) are still the previous version's English (not updated: the option was off).`);
  if (rm.length) { md.push('', '## Removed lines', ''); rm.forEach(r => { md.push(`### ${r.path} (${nRm(r)})`, ''); r.res.removed.forEach(u => md.push(`- ${u[0]}: [${u[1]}] \`${u[2]}\` (your line ${u[3]})`)); md.push(''); }); }
  if (od.length) { md.push('', '## Your lines whose English original changed since the previous version', ''); od.forEach(r => { md.push(`### ${r.path} (${r.outdated.length})`, ''); r.outdated.forEach(o => md.push(`- \`${o.key}\`: was "${o.was}", now "${o.now}"; yours: "${o.yours}"`)); md.push(''); }); }
  return md.join('\n') + '\n';
}
$('#dlcsv').onclick = () => {
  const out = [['file', 'section', 'key', 'old English', 'new English', 'yours']];
  RESULT.results.forEach(r => (r.outdated || []).forEach(o => out.push([r.path, o.sec, o.key, o.was, o.now, o.yours])));
  download(new Blob(['\ufeff' + out.map(l => l.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' }), 'english-changed.csv');
};
$('#dlsum').onclick = () => download(new Blob([summaryMd()], { type: 'text/markdown' }), 'SUMMARY.md');
$('#dlzip').onclick = async () => {
  status('building zip…'); const enc = s => new TextEncoder().encode(s);
  const files = CUS.map(f => ({ name: f.name, data: RESULT.merged.get(f.name) || f.data }));
  RESULT.addedFiles.forEach(n => files.push({ name: n, data: RESULT.merged.get(n) }));
  files.push({ name: '_merge_report/SUMMARY.md', data: enc(summaryMd()) });
  RESULT.results.forEach(r => files.push({ name: `_merge_report/${r.path.replace(/[\\/:]/g, '__')}.diff.md`, data: enc(reportMd(r.path, r.ref, r.res, r.notes)) }));
  download(await writeZip(files), 'config-merged.zip'); status('zip ready: merged files keep their folders; reports are in _merge_report/.');
};
