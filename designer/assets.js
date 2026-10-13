const BASE = '../images/data/';
let CAT = null, IDX = null, MAPS = null;
const BUF = {}, URLS = new Map();
let NORANGE = false;

export async function catalog() {
  if (!CAT) CAT = fetch(BASE + 'catalog.json').then(r => { if (!r.ok) throw new Error('catalog.json ' + r.status); return r.json(); }).catch(e => { CAT = null; throw e; });
  return CAT;
}
async function maps() {
  if (!MAPS) MAPS = (async () => {
    const c = await catalog(), img = new Map();
    for (const [pkg, list] of Object.entries(c.packages)) list.forEach((x, n) => img.set(`${pkg}.${x[0]}`.toLowerCase(), { pkg, n, w: x[2], h: x[3], ref: `${pkg}.${x[0]}` }));
    const tex = new Map(c.hudtex.map(([name, path, at]) => [name.toLowerCase(), at ? { pkg: at[0], n: at[1], ...(img.get(path.toLowerCase()) || {}) } : null]));
    const icon = new Map(c.hudicon.map(([name, cells]) => [name.toLowerCase(), cells]));
    return { img, tex, icon, atlas: c.atlas };
  })().catch(e => { MAPS = null; throw e; });
  return MAPS;
}
export async function imgUrl(pkg, n) {
  const k = `img/${pkg}/${n}`;
  if (!URLS.has(k)) URLS.set(k, (async () => {
    let bytes;
    try {
      if (!IDX) IDX = fetch(BASE + 'img_index.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { IDX = null; throw e; });
      const e = (await IDX)[k]; if (!e) return '';
      const [f, off, len] = e;
      const r = NORANGE ? null : await fetch(BASE + f, { headers: { Range: `bytes=${off}-${off + len - 1}` } });
      if (r && r.status === 206) bytes = await r.arrayBuffer();
      else {
        if (r && !r.ok) throw new Error(r.status);
        if (r) NORANGE = true;
        if (!BUF[f]) BUF[f] = (r ? r.arrayBuffer() : fetch(BASE + f).then(x => { if (!x.ok) throw new Error(x.status); return x.arrayBuffer(); })).catch(x => { delete BUF[f]; throw x; });
        bytes = (await BUF[f]).slice(off, off + len);
      }
    } catch { URLS.delete(k); return ''; }
    return URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  })());
  return URLS.get(k);
}
export async function refUrl(ref) {
  const m = await maps(), x = m.img.get(String(ref).toLowerCase());
  return x ? imgUrl(x.pkg, x.n) : '';
}

function tintLayer(el, url, tint) {
  if (!tint) return;
  const i = document.createElement('i');
  i.style.cssText = `position:absolute;inset:0;background:${tint};mix-blend-mode:multiply;-webkit-mask:url(${url}) 0 0/100% 100%;mask:url(${url}) 0 0/100% 100%`;
  el.append(i);
}
async function fill(el) {
  el.dataset.done = '1';
  const k = el.dataset.k, ref = el.dataset.ref, tint = el.dataset.tint, m = await maps();
  if (k === 'icon') {
    const cells = m.icon.get(ref.toLowerCase()); if (!cells || !cells.length) return;
    const w = el.offsetWidth || 16, hgt = el.offsetHeight || 16, A = m.atlas, kx = w / A.cell, ky = hgt / A.cell, layers = cells.slice().reverse();
    el.style.backgroundImage = layers.map(() => `url(${BASE}atlas.png)`).join(',');
    el.style.backgroundSize = layers.map(() => `${A.w * kx}px ${A.h * ky}px`).join(',');
    el.style.backgroundPosition = layers.map(([r, c]) => `${-(c - 1) * w}px ${-(r - 1) * hgt}px`).join(',');
    el.classList.add('real'); return;
  }
  const x = k === 'tex' ? m.tex.get(ref.toLowerCase()) : m.img.get(ref.toLowerCase());
  if (!x || x.n === undefined) return;
  const url = await imgUrl(x.pkg, x.n); if (!url) return;
  el.style.backgroundImage = `url(${url})`; el.classList.add('real');
  if (el.dataset.auto && x.w && x.h) el.style.width = `${Math.round(el.offsetHeight * x.w / x.h)}px`;
  tintLayer(el, url, tint);
}
export function hydrate(root = document) {
  root.querySelectorAll('.mk-img[data-ref]:not([data-done])').forEach(el => { fill(el).catch(() => { }); });
}
export function watch() {
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => hydrate(), 30); }).observe(document.body, { childList: true, subtree: true });
  hydrate();
}
export const iconSpan = (ref, size = 40, cls = '') => ref ? `<span class="mk-img ${cls}" data-k="img" data-ref="${ref.replace(/"/g, '')}" data-auto="1" style="height:${size}px;width:${size}px"></span>` : '';
