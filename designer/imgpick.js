import { h, hex2rgb, fl } from './core.js';
import { catalog } from './assets.js';

let LISTS = null;
async function lists() {
  if (!LISTS) LISTS = (async () => {
    const c = await catalog(), img = [], byRef = new Map();
    for (const [pkg, list] of Object.entries(c.packages)) list.forEach((x, n) => { const e = { k: 'img', pkg, n, ref: `${pkg}.${x[0]}`, name: x[0], w: x[2], h: x[3] }; img.push(e); byRef.set(e.ref.toLowerCase(), e); });
    const icon = c.hudicon.filter(([, cells]) => cells.length).map(([name]) => ({ k: 'icon', ref: name, name, w: 32, h: 32 }));
    const tex = c.hudtex.map(([name, path]) => { const x = byRef.get(String(path).toLowerCase()); return { k: 'tex', ref: name, name, w: x ? x.w : 32, h: x ? x.h : 32, group: name.split('_')[0] }; });
    const pkgs = Object.keys(c.packages).sort((a, b) => a.localeCompare(b));
    return { img, icon, tex, byRef, pkgs };
  })();
  return LISTS;
}
export async function imageByRef(ref) { return (await lists()).byRef.get(String(ref).toLowerCase()) || null; }

export const asSel = x => !x ? null : x.k ? x : { k: 'img', ref: x.ref, w: x.w, h: x.h };
const tintTag = hex => { const c = hex2rgb(hex); return c ? `<ImageColour:R=${fl(c[0] / 255)} G=${fl(c[1] / 255)} B=${fl(c[2] / 255)}>` : ''; };
export function imageTag(sel, yl = 16, tint = null) {
  sel = asSel(sel); if (!sel) return '';
  const xl = Math.max(1, Math.round((sel.w || yl) / (sel.h || yl) * yl));
  const tag = sel.k === 'img' ? `<Images:${sel.ref};Resize=TRUE XL=${xl} YL=${yl}>`
    : `<APB_Images:${sel.ref};XL=${sel.k === 'icon' ? yl : xl} YL=${yl} Resize=True ${sel.k === 'icon' ? 'HUDIcon' : 'HUDTexture'}=TRUE>`;
  return (tint ? tintTag(tint) : '') + tag;
}
export const imageSpan = (sel, size = 28) => { sel = asSel(sel); if (!sel) return ''; const w = Math.max(8, Math.round((sel.w || 32) / (sel.h || 32) * size));
  return `<span class="mk-img" data-k="${sel.k}" data-ref="${sel.ref.replace(/"/g, '')}" style="width:${Math.min(w, 110)}px;height:${size}px"></span>`; };

const KINDS = [['icon', 'HUD icons'], ['tex', 'HUD textures'], ['img', 'Package images']];
export function imagePicker({ value, onPick, suggest, pkg, note }) {
  value = asSel(value);
  const st = { src: suggest ? 'suggest' : value ? value.k : pkg ? 'img' : 'icon', q: '', pkg: pkg || (value && value.k === 'img' ? value.ref.split('.')[0] : 'APBMenus_Art_HUDIcons') };
  const root = h('div', { class: 'iconpick' }), grid = h('div', { class: 'icongrid' }), bar = h('div', { class: 'row' });
  const q = h('input', { type: 'search', placeholder: 'Search names…', oninput: () => { st.q = q.value; fill(); } });
  let L = null, sugg = null;
  const fill = async () => {
    L = L || await lists();
    if (st.src === 'suggest' && !sugg) sugg = await suggest();
    const t = st.q.toLowerCase().trim();
    let cells = st.src === 'suggest' ? sugg : st.src === 'img' ? L.img.filter(x => t ? x.ref.toLowerCase().includes(t) : x.pkg === st.pkg) : L[st.src];
    if (t && st.src !== 'img') cells = cells.filter(x => (x.ref + ' ' + (x.label || '')).toLowerCase().includes(t));
    grid.innerHTML = '';
    cells.slice(0, 240).forEach(x => grid.append(h('button', { class: 'iconcell' + (value && value.k === x.k && value.ref === x.ref ? ' on' : ''), title: `${x.ref} (${KINDS.find(k => k[0] === x.k)[1]})`, onclick: () => onPick(x), html: imageSpan(x, 28) }, h('small', {}, x.label || x.name))));
    if (!cells.length) grid.append(h('div', { class: 'hint' }, 'Nothing found.'));
    else if (cells.length > 240) grid.append(h('div', { class: 'hint' }, `${cells.length - 240} more: narrow the search.`));
  };
  const drawBar = async () => {
    L = L || await lists();
    bar.innerHTML = '';
    const opts = (suggest ? [['suggest', 'Suggested']] : []).concat(KINDS);
    bar.append(...opts.map(([k, l]) => h('button', { class: 'mini' + (st.src === k ? ' on' : ''), onclick: () => { st.src = k; drawBar(); fill(); } }, l)));
    if (st.src === 'img') bar.append(h('select', { title: 'Package (ignored while searching)', onchange: e => { st.pkg = e.target.value; fill(); } }, L.pkgs.map(p => h('option', { value: p, selected: p === st.pkg }, p))));
  };
  root.append(bar, h('div', { class: 'row' }, q, h('button', { onclick: () => onPick(null) }, 'No image')),
    h('div', { class: 'hint' }, note || 'HUD icons and HUD textures are written as <APB_Images:…>, package images as <Images:…>.'), grid);
  drawBar(); fill();
  return root;
}
