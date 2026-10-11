import { decodeText, encodeText, download } from '../config/lib.js';
export { download };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let DATA = null;
export async function data() {
  if (!DATA) { const r = await fetch('data.json'); if (!r.ok) throw new Error('data.json ' + r.status); DATA = await r.json(); }
  return DATA;
}

export const hex2rgb = hx => { const m = /^#?([0-9a-f]{6})$/i.exec(hx.trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgb2hex = c => '#' + c.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const fl = (v, d = 3) => { let s = (+v).toFixed(d); if (s.includes('.')) s = s.replace(/\.?0+$/, ''); return s === '-0' || s === '' ? '0' : s; };
export const apbTag = (c, a = null) => `<Color:R=${fl(c[0] / 255)} G=${fl(c[1] / 255)} B=${fl(c[2] / 255)}${a === null ? '' : ' A=' + fl(a)}>`;
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function hsl(hh, s, l) {
  s /= 100; l /= 100; const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}
export function sample(stops, t) {
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

let NAMED = [];
export function setNamed(list) { NAMED = list; }
export const named = () => NAMED;
const BASIC = /^(Black|Blue|Bronze|Cyan|Green|Grey|Hot_Pink|Orange|Pink|Purple|Red|Valentine_Pink|White|Yellow|Halloween_|Chat_)/;
export function nearestNamed(c, pool = NAMED.filter(n => n.kind === 'colour' && n.rgba[3] > 200 && BASIC.test(n.name))) {
  let best = null, bd = 1e9;
  for (const n of pool) { const d = (n.rgba[0] - c[0]) ** 2 * 0.3 + (n.rgba[1] - c[1]) ** 2 * 0.59 + (n.rgba[2] - c[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = n; } }
  return best;
}
export const namedRgb = name => { const n = NAMED.find(x => x.name.toLowerCase() === String(name).trim().toLowerCase()); return n ? n.rgba : null; };

const TOKEN = /(<[^<>]*>|↵|\\n)/g;
export function tokens(s) { return String(s).split(TOKEN).filter(x => x !== ''); }

export function colourText(text, opt) {
  const { mode = 'solid', stops = [[255, 255, 255]], steps = 3, kind = 'ui', font = '' } = opt;
  if (!text) return '';
  const parts = tokens(text), chars = [];
  parts.forEach((p, pi) => { if (!/^(<[^<>]*>|↵|\\n)$/.test(p)) [...p].forEach((ch, ci) => chars.push({ pi, ci, ch })); });
  const vis = chars.filter(c => c.ch.trim()), n = vis.length;
  const colOf = idx => {
    if (mode === 'solid' || n < 2) return stops[0];
    const t = idx / (n - 1);
    if (mode === 'rainbow') return hsl(t * 300, 100, 55);
    if (mode === 'stepped') { const k = Math.min(steps - 1, Math.floor(idx / n * steps)); return sample(stops, steps < 2 ? 0 : k / (steps - 1)); }
    return sample(stops, t);
  };
  const tag = c => kind === 'hud' ? (nearestNamed(c) || { name: 'White' }).name : apbTag(c);
  const colours = new Map(); vis.forEach((c, i) => colours.set(c, tag(colOf(i))));
  let out = '', cur = null;
  const open = t => kind === 'hud' ? `<col:${t}>` : t, close = () => kind === 'hud' ? '</col>' : '<Color:/>';
  parts.forEach((p, pi) => {
    if (/^(<[^<>]*>|↵|\\n)$/.test(p)) { if (cur && p !== '↵' && p !== '\\n') { out += close(); cur = null; } out += p; return; }
    [...p].forEach((ch, ci) => {
      const c = chars.find(x => x.pi === pi && x.ci === ci), t = colours.get(c);
      if (t && t !== cur) { if (cur) out += close(); out += open(t); cur = t; }
      out += ch;
    });
  });
  if (cur) out += close();
  if (font && kind !== 'hud') out = `<Fonts:${font}>${out}<Fonts:/>`;
  return out;
}

export const FONTS = ['APBMenus_Font.APB_Helvetica_Regular_11', 'APBMenus_Font.APB_Helvetica_Regular_12', 'APBMenus_Font.APB_Helvetica_Regular_14',
  'APBMenus_Font.APB_Helvetica_Regular_16', 'APBMenus_Font.APB_Helvetica_Regular_28', 'APBMenus_Font.APB_Helvetica_Bold_11', 'APBMenus_Font.APB_Helvetica_Bold_13',
  'APBMenus_Font.APB_Helvetica_Bold_14', 'APBMenus_Font.APB_Helvetica_Bold_24', 'APBMenus_Font.APB_Helvetica_Bold_32', 'APBMenus_Font.APB_HUD_AmmoCounter',
  'EngineFonts.TinyFont', 'EngineFonts.SmallFont', 'EngineFonts.MediumFont', 'EngineFonts.LargeFont'];
const fontCss = f => {
  const m = /Helvetica_(Bold|Regular)_(\d+)/.exec(f);
  if (m) return `font-weight:${m[1] === 'Bold' ? 700 : 400};font-size:${m[2]}px`;
  return { TinyFont: 'font-size:9px', SmallFont: 'font-size:11px', MediumFont: 'font-size:14px', LargeFont: 'font-size:18px', APB_HUD_AmmoCounter: 'font-size:20px;font-weight:700' }[f.split('.').pop()] || '';
};

export function render(value, base = [235, 235, 235]) {
  const stack = [{ c: base, a: 1 }], fonts = []; let html = '', tint = null;
  const top = () => stack[stack.length - 1];
  const span = s => { const t = top(); return `<span style="color:rgba(${t.c.map(Math.round).join(',')},${t.a})${fonts.length ? ';' + fonts[fonts.length - 1] : ''}">${esc(s)}</span>`; };
  let v = String(value);
  if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  for (const p of tokens(v)) {
    let m;
    if (p === '↵' || p === '\\n') { html += '<br>'; continue; }
    if ((m = /^<Color:(.*)>$/i.exec(p))) {
      if (m[1].trim() === '/') { if (stack.length > 1) stack.pop(); continue; }
      const g = k => { const x = new RegExp('\\b' + k + '\\s*=\\s*(-?[\\d.]+)', 'i').exec(m[1]); return x ? +x[1] : null; };
      const t = top(), c = [g('R'), g('G'), g('B')].map((x, i) => x === null ? t.c[i] : Math.max(0, Math.min(1, x)) * 255);
      const a = g('A'); stack.push({ c, a: a === null ? t.a : Math.max(0, Math.min(1, a)) }); continue;
    }
    if ((m = /^<col:\s*(.*?)\s*>$/i.exec(p))) {
      if (m[1] === '/') { if (stack.length > 1) stack.pop(); continue; }
      const c = namedRgb(m[1]); stack.push(c ? { c: c.slice(0, 3), a: (c[3] || 255) / 255 } : { c: [255, 80, 200], a: 1, bad: true }); continue;
    }
    if (/^<\/(col|color)>$/i.test(p)) { if (stack.length > 1) stack.pop(); continue; }
    if ((m = /^<Fonts:(.*)>$/i.exec(p))) { if (m[1].trim() === '/') fonts.pop(); else fonts.push(fontCss(m[1].trim())); continue; }
    if ((m = /^<ImageColour:(.*)>$/i.exec(p))) {
      if (m[1].trim() === '/') { tint = null; continue; }
      const g = k => { const x = new RegExp('\\b' + k + '\\s*=\\s*(-?[\\d.]+)', 'i').exec(m[1]); return x ? Math.max(0, Math.min(1, +x[1])) : 1; };
      tint = `rgba(${Math.round(g('R') * 255)},${Math.round(g('G') * 255)},${Math.round(g('B') * 255)},${g('A')})`; continue;
    }
    if ((m = /^<(Images|APB_Images|hudicon|hudtexture):([^;>]*)(?:;([^>]*))?>$/i.exec(p))) {
      const opt = m[3] || '', xl = /XL=\s*(-?[\d.]+)/i.exec(opt), yl = /YL=\s*(-?[\d.]+)/i.exec(opt);
      const k = /^Images$/i.test(m[1]) ? 'img' : /^hudtexture$/i.test(m[1]) || /HUDTexture\s*=\s*TRUE/i.test(opt) ? 'tex' : 'icon';
      const w = Math.abs(xl ? +xl[1] : 16), hh = Math.abs(yl ? +yl[1] : 16);
      html += `<span class="mk-img" data-k="${k}" data-ref="${esc(m[2].trim())}"${tint ? ` data-tint="${tint}"` : ''} title="${esc(m[1] + ':' + m[2])}" style="width:${Math.max(2, w)}px;height:${Math.max(2, hh)}px"></span>`;
      tint = null; continue;
    }
    if (/^<(Styles|key|Strings|ButtonCallouts)[:][^>]*>$/i.test(p)) { if (/^<key:/i.test(p)) html += `<span class="mk-key">${esc(p.slice(5, -1))}</span>`; continue; }
    html += span(p);
  }
  return html;
}

export function intValue(v) { return v.startsWith('"') || v.endsWith('"') ? `"${v}"` : v; }

export async function readFile(file) {
  const d = decodeText(new Uint8Array(await file.arrayBuffer()));
  return { name: file.name, ...d };
}

export function buildFile(section, lines, base) {
  const eol = '\r\n';
  if (!base) {
    const head = [';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', `; Generated with the APB Reloaded text designer`, ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', '', `[${section}]`];
    return { text: head.concat(lines.map(([k, v]) => `${k}=${intValue(v)}`)).join(eol) + eol, enc: 'utf-16le', bom: true, replaced: 0, added: lines.length };
  }
  const src = base.text.split(/\r\n|\n|\r/), want = new Map(lines.map(([k, v]) => [k.toLowerCase(), [k, v]])), done = new Set();
  let sec = '', replaced = 0, secEnd = -1, secStart = -1;
  const out = src.map((l, i) => {
    const s = l.trim();
    if (s.startsWith('[') && s.endsWith(']')) { if (sec.toLowerCase() === section.toLowerCase()) secEnd = i; sec = s.slice(1, -1); if (sec.toLowerCase() === section.toLowerCase()) secStart = i; return l; }
    const eq = l.indexOf('=');
    if (eq > 0 && !s.startsWith(';') && sec.toLowerCase() === section.toLowerCase()) {
      const k = l.slice(0, eq).trim().toLowerCase(), w = want.get(k);
      if (w && !done.has(k)) { done.add(k); replaced++; return `${l.slice(0, eq)}=${intValue(w[1])}`; }
    }
    return l;
  });
  const rest = lines.filter(([k]) => !done.has(k.toLowerCase())).map(([k, v]) => `${k}=${intValue(v)}`);
  if (rest.length) {
    if (secStart < 0) { while (out.length && !out[out.length - 1].trim()) out.pop(); out.push('', `[${section}]`, ...rest); }
    else { let at = secEnd < 0 ? out.length : secEnd; while (at > secStart + 1 && !out[at - 1].trim()) at--; out.splice(at, 0, ...rest); }
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return { text: out.join(base.text.includes('\r\n') || !base.text.includes('\n') ? eol : '\n') + eol, enc: base.enc, bom: base.bom, replaced, added: rest.length };
}
export function saveFile(f, name) { download(new Blob([encodeText(f.text, f.enc, f.bom)], { type: 'text/plain' }), name); }

export function seg(options, value, onChange) {
  const box = h('div', { class: 'seg glass' });
  const set = v => { value = v; $$('button', box).forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
  options.forEach(([v, label, title]) => box.append(h('button', { 'data-v': v, title, onclick: () => { set(v); onChange(v); } }, label)));
  set(value); box.set = set; return box;
}
export function toggle(label, value, onChange, title) {
  const sw = h('span', { class: 'switch' + (value ? ' on' : '') });
  return h('label', { class: 'opt', title, onclick: e => { e.preventDefault(); value = !value; sw.classList.toggle('on', value); onChange(value); } }, sw, label);
}
const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const namedRow = (n, label) => {
  const c = n ? n.rgba.slice(0, 3) : null, hex = c ? rgb2hex(c) : '';
  return [h('span', { class: 'cswatch', style: c ? `background:${hex}` : 'background:repeating-linear-gradient(45deg,#666 0 3px,#333 3px 6px)' }),
    h('span', { class: 'nsname' + (c && lum(c) < 0.12 ? ' dark' : ''), style: c ? `color:${hex}` : '' }, label)];
};
export function namedSelect({ value, list, onChange, extra = [] }) {
  const find = v => list.find(n => n.name === v);
  const wrap = h('span', { class: 'nsel' }), btn = h('button', { type: 'button', class: 'nsbtn' }), pop = h('div', { class: 'nspop', hidden: true });
  const q = h('input', { type: 'search', placeholder: 'Search colours…' }), ul = h('div', { class: 'nslist' });
  const label = v => { const e = extra.find(x => x[0] === v); return e ? namedRow(null, e[1]) : namedRow(find(v), v); };
  const setBtn = () => btn.replaceChildren(...label(value), h('span', { class: 'nscaret' }, '▾'));
  const pick = v => { value = v; setBtn(); close(); onChange(v); };
  const fill = () => {
    const t = q.value.toLowerCase().trim();
    const seen = new Set();
    ul.replaceChildren(...extra.filter(([, l]) => !t || l.toLowerCase().includes(t)).map(([v, l]) => h('button', { type: 'button', class: 'nsopt' + (v === value ? ' on' : ''), onclick: () => pick(v) }, ...namedRow(null, l))),
      ...list.filter(n => (!t || n.name.toLowerCase().includes(t)) && !seen.has(n.name) && seen.add(n.name)).map(n => h('button', { type: 'button', class: 'nsopt' + (n.name === value ? ' on' : ''), title: n.name, onclick: () => pick(n.name) }, ...namedRow(n, n.name))));
  };
  const outside = e => { if (!wrap.contains(e.target) && !pop.contains(e.target)) close(); };
  const onScroll = e => { if (!pop.contains(e.target)) close(); };
  const close = () => { pop.hidden = true; pop.remove(); document.removeEventListener('mousedown', outside); window.removeEventListener('scroll', onScroll, true); };
  btn.onclick = () => {
    if (!pop.hidden) return close();
    const r = btn.getBoundingClientRect(), below = window.innerHeight - r.bottom;
    pop.style.left = `${Math.min(r.left, window.innerWidth - 290)}px`;
    if (below < 360 && r.top > below) { pop.style.top = ''; pop.style.bottom = `${window.innerHeight - r.top + 4}px`; } else { pop.style.bottom = ''; pop.style.top = `${r.bottom + 4}px`; }
    document.body.append(pop); pop.hidden = false; q.value = ''; fill(); q.focus(); const on = ul.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' });
    document.addEventListener('mousedown', outside); window.addEventListener('scroll', onScroll, true);
  };
  q.oninput = fill;
  q.onkeydown = e => { if (e.key === 'Escape') close(); if (e.key === 'Enter') { const f = ul.querySelector('.nsopt'); if (f) f.click(); } };
  pop.append(q, ul); wrap.append(btn); setBtn();
  return wrap;
}
export function colourPick(kind, value, onChange) {
  if (kind === 'hud') return namedSelect({ value, list: NAMED.filter(n => n.rgba[3] > 0), onChange });
  const inp = h('input', { type: 'color', value, oninput: () => { t.value = inp.value; onChange(inp.value); } });
  const t = h('input', { type: 'text', value, class: 'hex', oninput: () => { const c = hex2rgb(t.value); if (c) { inp.value = rgb2hex(c); onChange(inp.value); } } });
  return h('span', { class: 'cpickwrap' }, inp, t);
}
export const wrapColour = (text, colour, kind) => !colour ? text : kind === 'hud' ? `<col:${colour}>${text}</col>` : `${apbTag(hex2rgb(colour))}${text}<Color:/>`;
export const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('apbdesigner-' + k)); return v === null ? d : { ...d, ...v }; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('apbdesigner-' + k, JSON.stringify(v)); } catch { } }
};
