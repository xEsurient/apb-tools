import { h } from './core.js';
import { decodeText } from '../config/lib.js';

const RE = /(^|\/)APBGame\/Localization\/(INT|GER)\/([^/]+)$/i;
export const LOC = { files: [], root: '', listeners: [] };

export function locFrom(list) {
  const out = [];
  for (const f of list) {
    const path = (f.webkitRelativePath || f.name).replace(/\\/g, '/'), m = RE.exec(path);
    if (m) out.push({ lang: m[2].toUpperCase(), name: m[3], stem: m[3].replace(/\.[^.]+$/, '').toLowerCase(), path: path.slice(path.search(/APBGame\//i)), file: f });
  }
  return out;
}
export function setFolder(list) {
  const all = [...list];
  LOC.files = locFrom(all);
  LOC.root = all.length ? (all[0].webkitRelativePath || '').split('/')[0] : '';
  LOC.listeners.forEach(fn => fn());
  return LOC.files;
}
export const onFolder = fn => LOC.listeners.push(fn);
export const count = lang => LOC.files.filter(x => x.lang === lang).length;
export function findLoc(stem, langs = ['GER', 'INT']) {
  for (const l of langs) { const x = LOC.files.find(f => f.lang === l && f.stem === stem.toLowerCase()); if (x) return x; }
  return null;
}
export async function readLoc(x) { return { name: x.name, lang: x.lang, path: x.path, ...decodeText(new Uint8Array(await x.file.arrayBuffer())) }; }

export function folderBar() {
  const info = h('span', { class: 'hint' });
  const input = h('input', { type: 'file', webkitdirectory: true, multiple: true });
  const show = () => {
    info.textContent = LOC.files.length ? `${LOC.root || 'Folder'}: ${count('INT')} INT and ${count('GER')} GER files found (only these are read).`
      : 'Pick the game folder (or its APBGame/Localization folder): only the INT and GER localisation files inside are used; nothing is uploaded.';
  };
  input.onchange = () => { setFolder(input.files); show(); };
  onFolder(show); show();
  return h('div', { class: 'folderbar glass' }, h('label', { class: 'drop' }, input, '📁 ', h('span', {}, h('b', {}, 'Game folder'))), info);
}
