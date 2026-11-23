import { h } from './core.js';
import { decodeText, readInputs } from '../config/lib.js';

const RE = /(^|\/)(?:(?:APBGame\/)?Localization\/)?(INT|GER)\/([^/]+\.(?:int|ger))$/i, RE_FULL = /(^|\/)APBGame\/Localization\/(INT|GER)\/([^/]+)$/i, LOOSE = /(^|\/)([^/]+)\.(int|ger)$/i;
export const LOC = { files: [], root: '', zip: '', listeners: [] };
let DIR = [], ZIP = [];
const CACHE = new Map();

const entry = (path, lang, name, extra) => ({ lang: lang.toUpperCase(), name, stem: name.replace(/\.[^.]+$/, '').toLowerCase(), path: path.slice(Math.max(0, path.search(/APBGame\//i))), ...extra });
export function locFrom(list) {
  const out = [];
  for (const f of list) {
    const path = (f.webkitRelativePath || f.name).replace(/\\/g, '/'), m = RE_FULL.exec(path) || RE.exec(path);
    if (m) out.push(entry(path, m[2], m[3], { file: f, src: 'folder' }));
  }
  return out;
}
const rebuild = () => {
  const zipStems = new Set(ZIP.map(x => x.lang + x.stem));
  LOC.files = ZIP.concat(DIR.filter(x => !zipStems.has(x.lang + x.stem)));
  CACHE.clear(); LOC.listeners.forEach(fn => fn());
};
export function setFolder(list) {
  const all = [...list];
  DIR = locFrom(all);
  LOC.root = all.length ? (all[0].webkitRelativePath || '').split('/')[0] : '';
  rebuild();
  return LOC.files;
}
export async function setZip(list) {
  const files = await readInputs(list);
  ZIP = files.map(x => {
    const p = x.name.replace(/\\/g, '/'); let m = RE.exec(p);
    if (m) return entry(p, m[2], m[3], { data: x.data, src: 'zip' });
    m = LOOSE.exec(p);
    return m ? entry(p, m[3], `${m[2]}.${m[3]}`, { data: x.data, src: 'zip' }) : null;
  }).filter(Boolean);
  LOC.zip = list.length ? [...list].map(f => f.name).join(', ') : '';
  rebuild();
  return ZIP;
}
export const onFolder = fn => LOC.listeners.push(fn);
export const count = (lang, src) => LOC.files.filter(x => x.lang === lang && (!src || x.src === src)).length;
export function findLoc(stem, langs = ['GER', 'INT']) {
  for (const l of langs) { const x = LOC.files.find(f => f.lang === l && f.stem === stem.toLowerCase()); if (x) return x; }
  return null;
}
export async function readLoc(x) { return { name: x.name, lang: x.lang, path: x.path, ...decodeText(x.data || new Uint8Array(await x.file.arrayBuffer())) }; }
export const secKey = (sec, key) => String(sec || '').trim().toLowerCase() + '\u0000' + String(key).trim().toLowerCase();
export function parseLoc(text) {
  const out = new Map(), bySec = new Map(), secs = new Set(); let sec = '';
  for (const l of text.split(/\r\n|\n|\r/)) {
    const s = l.trim(); if (!s || s.startsWith(';')) continue;
    if (s.startsWith('[') && s.endsWith(']')) { sec = s.slice(1, -1); secs.add(sec.trim().toLowerCase()); continue; }
    const eq = l.indexOf('='); if (eq <= 0) continue;
    let v = l.slice(eq + 1); if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out.set(l.slice(0, eq).trim(), v); bySec.set(secKey(sec, l.slice(0, eq)), v);
  }
  out.bySec = bySec; out.secs = secs;
  out.lookup = (key, sec) => { if (sec !== undefined && secs.has(String(sec).trim().toLowerCase())) { const k = secKey(sec, key); return bySec.has(k) ? { v: bySec.get(k) } : null; } const k = String(key).trim(); return out.has(k) ? { v: out.get(k) } : null; };
  return out;
}
export const hasConfig = () => LOC.files.length > 0;
export function inGame(stem) {
  const k = String(stem).toLowerCase();
  if (!CACHE.has(k)) CACHE.set(k, (async () => {
    const int = findLoc(k, ['INT']), ger = findLoc(k, ['GER']);
    const base = int ? parseLoc((await readLoc(int)).text) : new Map(), own = ger ? parseLoc((await readLoc(ger)).text) : new Map();
    return { base, own, value: (key, sec) => { const a = own.lookup(key, sec); if (a) return a.v; const b = base.lookup(key, sec); return b ? b.v : undefined; }, has: !!(int || ger), own_: !!ger };
  })());
  return CACHE.get(k);
}

export function folderBar() {
  const info = h('span', { class: 'hint' });
  const input = h('input', { type: 'file', webkitdirectory: true, multiple: true });
  const zip = h('input', { type: 'file', accept: '.zip,.int,.ger,.INT,.GER', multiple: true });
  const show = () => {
    const parts = [];
    if (count('GER', 'zip') + count('INT', 'zip')) parts.push(`your config (${LOC.zip}): ${count('GER', 'zip')} GER and ${count('INT', 'zip')} INT files`);
    if (count('GER', 'folder') + count('INT', 'folder')) parts.push(`${LOC.root || 'game folder'}: ${count('INT', 'folder')} INT and ${count('GER', 'folder')} GER files`);
    info.textContent = parts.length ? `Using ${parts.join(' · ')}. Previews show your text as it looks in game; your config wins over the game folder.`
      : 'Pick the game folder (or its APBGame/Localization folder) and / or your config zip: only the INT and GER localisation files inside are used; nothing is uploaded.';
  };
  input.onchange = () => { setFolder(input.files); };
  zip.onchange = async () => { try { await setZip(zip.files); } catch (e) { info.textContent = 'Could not read that config: ' + e.message; } };
  onFolder(show); show();
  return h('div', { class: 'folderbar glass' }, h('label', { class: 'drop' }, input, '📁 ', h('span', {}, h('b', {}, 'Game folder'))),
    h('label', { class: 'drop' }, zip, '🗜 ', h('span', {}, h('b', {}, 'Your config'), ' (zip or INT/GER files)')), info);
}
