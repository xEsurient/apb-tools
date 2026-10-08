import * as THREE from 'three';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); };

const ICON = {
  contact: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0z" fill="currentColor"/>',
  dropoff: '<path d="M4 7h16v12H4zM8 7V5h8v2M12 10v6M9.5 12.5h5" fill="none" stroke="currentColor" stroke-width="2"/>',
  mail: '<path d="M3 6h18v12H3z M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="2"/>',
  vehicle: '<path d="M5 11l2-5h10l2 5v6h-2v-2H7v2H5zM7.5 13.5h.01M16.5 13.5h.01" fill="none" stroke="currentColor" stroke-width="2"/>',
  repair: '<path d="M14 6a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 0-2-2z" fill="none" stroke="currentColor" stroke-width="2"/>',
  ammo: '<path d="M8 20V9l2-5 2 5v11zM14 20V9l2-5 2 5v11z" fill="currentColor"/>',
  beacon: '<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor"/>',
  graffiti: '<path d="M9 3h4v4H9zM8 7h6v14H8zM16 4l3-1M16 7h3M16 10l3 1" fill="none" stroke="currentColor" stroke-width="2"/>',
  task: '<circle cx="12" cy="12" r="5" fill="currentColor"/>',
};
const LAYERS = [
  { id: 'contact', one: 'Contact', name: 'Contacts', cls: ['cContact'], col: '#f2a33a', on: true },
  { id: 'dropoff', one: 'Drop-off point', name: 'Drop-off points', cls: ['cOpenWorldDropOff'], col: '#7bd389', on: true },
  { id: 'mail', one: 'Mailbox', name: 'Mailboxes', cls: ['cMailBox'], col: '#5aa9e6', on: true },
  { id: 'vehicle', one: 'Vehicle spawner', name: 'Vehicle spawners', cls: ['cPlayerVehicleSpawnInteractionPoint'], col: '#c38fff', on: true },
  { id: 'repair', one: 'Vehicle repair', name: 'Vehicle repair', cls: ['cVehicleRepairTrigger'], col: '#4fd1c5', on: true },
  { id: 'ammo', one: 'Ammo vending machine', name: 'Ammo vending', cls: ['cAmmoVendingMachine'], col: '#e66a6a', on: false },
  { id: 'beacon', one: 'Location beacon', name: 'Location beacons', cls: ['cLocationBeaconActor'], col: '#ff8fc7', on: true },
  { id: 'graffiti', one: 'Graffiti point', name: 'Graffiti points', cls: ['cPlayerGraffitiDisplayPoint'], col: '#f7e26b', on: false },
  { id: 'task', one: 'Mission / task spawn', name: 'Mission / task spawns', cls: ['cTaskItemSpawnZone', 'cPlayerCharacterMissionSpawnZone'], col: '#9aa0aa', on: false, dot: true },
];
const svg = (k, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}">${ICON[k]}</svg>`;
const FACTION = { kFACTION_Both: 'Both factions', kFACTION_Criminal: 'Criminal', kFACTION_Enforcer: 'Enforcer' };
const DROPOFF = { DropOff_Enf: 'Enforcer drop-off', DropOff_Crim: 'Criminal drop-off', SmallItemDropOff_Crim: 'Small item drop-off (Criminal)',
  MediumLargeItemDropOff_Crim: 'Medium/large item drop-off (Criminal)', VehicleDropOff_Crim: 'Vehicle drop-off (Criminal)', VehicleDropOff_Enf: 'Vehicle drop-off (Enforcer)' };

const S = { index: null, meshes: null, d: null, name: '', on: [], layerOn: LAYERS.map(l => l.on), layerOf: null, counts: [], hits: new Set(), sel: -1, chunks: {},
  mode: '2d', opt: { textures: true, labels: true }, icons: {} };

function status(t) { $('#dname').textContent = t; }
function progress(t) { const p = $('#progress'); p.style.display = t ? 'block' : 'none'; p.textContent = t || ''; }
function info(i) { const s = S.d.info[i]; const o = {}; if (s) s.split(' ').forEach(kv => { const [k, v] = kv.split('='); o[k] = v; }); return o; }
function title(i) {
  const d = S.d, inf = info(i), L = S.layerOf[i];
  if (inf.eContact) return d.contactTitles[inf.eContact] || inf.eContact;
  if (inf.eDropOffType) return DROPOFF[inf.eDropOffType] || inf.eDropOffType;
  if (L >= 0 && LAYERS[L].id === 'beacon' && d.labels[i]) return d.labels[i];
  if (L >= 0) return LAYERS[L].one;
  return d.labels[i] || d.classes[d.cls[i]];
}

function makeIcons() {
  const px = Math.round(28 * devicePixelRatio);
  for (const l of LAYERS) {
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36" width="${px}" height="${px}"><circle cx="12" cy="12" r="16" fill="${l.col}" stroke="rgba(0,0,0,.55)" stroke-width="3"/><g color="#14161b">${ICON[l.id]}</g></svg>`;
    const img = new Image(); img.onload = () => draw2d(); img.src = 'data:image/svg+xml,' + encodeURIComponent(s); S.icons[l.id] = img;
  }
}

async function init() {
  makeIcons();
  S.index = await getJSON('data/index.json');
  const sel = $('#district');
  S.index.districts.filter(d => d.placements > 100).forEach(d => sel.add(new Option(d.name.replace(/District$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'), d.name)));
  const h = new URLSearchParams(location.hash.slice(1)), want = h.get('district');
  sel.value = S.index.districts.some(d => d.name === want) ? want : (S.index.districts.find(d => d.name.startsWith('Waterfront')) || S.index.districts[0]).name;
  sel.onchange = () => loadDistrict(sel.value);
  document.querySelectorAll('#modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  document.querySelectorAll('[data-opt]').forEach(r => r.onclick = () => { const k = r.dataset.opt; S.opt[k] = !S.opt[k]; r.querySelector('.switch').classList.toggle('on', S.opt[k]); draw2d(); if (k === 'textures') V3.applyTextures(); });
  $('#paneltoggle').onclick = () => $('#panel').classList.toggle('open');
  $('#zin').onclick = () => zoomBy(1.4); $('#zout').onclick = () => zoomBy(1 / 1.4);
  $('#btop').onclick = () => V3.top(); $('#bover').onclick = () => V3.overview();
  setupSearch();
  await loadDistrict(sel.value);
  const s = +h.get('sel'); if (h.has('sel') && s >= 0 && s < S.d.x.length) { select(s); centerOn(s); }
  if (h.get('mode') === '3d') setMode('3d', h.has('sel') ? s : undefined);
}

async function loadDistrict(name) {
  progress('Loading ' + name + '…');
  S.d = await getJSON('data/' + S.index.districts.find(d => d.name === name).file); S.name = name; S.hits = new Set(); S.sel = -1;
  const d = S.d, n = d.x.length, byCls = new Map();
  LAYERS.forEach((l, k) => l.cls.forEach(c => { const i = d.classes.indexOf(c); if (i >= 0) byCls.set(i, k); }));
  S.layerOf = new Int8Array(n).fill(-1); S.counts = LAYERS.map(() => 0);
  for (let i = 0; i < n; i++) { const k = byCls.get(d.cls[i]); if (k !== undefined) { S.layerOf[i] = k; S.counts[k]++; } }
  status($('#district').selectedOptions[0]?.text || name);
  const kc = S.index.kinds.map(() => 0); d.kind.forEach(k => kc[k]++); S.on = S.index.kinds.map(() => true);
  $('#layers').innerHTML = LAYERS.map((l, k) => S.counts[k] ? `<div class="row" data-l="${k}" style="--c:${l.col}"><div class="ic">${svg(l.id)}</div>${l.name}<span class="n">${S.counts[k].toLocaleString()}</span><span class="switch ${S.layerOn[k] ? 'on' : ''}"></span></div>` : '').join('');
  $('#layers').querySelectorAll('.row').forEach(r => r.onclick = () => { const k = +r.dataset.l; S.layerOn[k] = !S.layerOn[k]; r.querySelector('.switch').classList.toggle('on', S.layerOn[k]); draw2d(); V3.applyMarkers(); });
  $('#kinds').innerHTML = S.index.kinds.map((k, i) => kc[i] ? `<div class="row" data-k="${i}"><span class="swatch" style="background:${S.index.colours[i]}"></span>${esc(k)}<span class="n">${kc[i].toLocaleString()}</span><span class="switch on"></span></div>` : '').join('');
  $('#kinds').querySelectorAll('.row').forEach(r => r.onclick = () => { const k = +r.dataset.k; S.on[k] = !S.on[k]; r.querySelector('.switch').classList.toggle('on', S.on[k]); draw2d(); if (V3.ready) V3.applyKinds(); });
  $('#detail').style.display = 'none'; fit2d(); draw2d(); progress('');
  history.replaceState(null, '', '#district=' + encodeURIComponent(name));
  if (S.mode === '3d') { await V3.build(); V3.builtFor = name; }
}

const C2 = { cx: 0, cy: 0, sc: 1, W: 0, H: 0 };
const cv2 = $('#c2d');
function resize2d() { const dpr = devicePixelRatio; C2.W = innerWidth; C2.H = innerHeight; cv2.width = C2.W * dpr; cv2.height = C2.H * dpr; cv2.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
function bounds() { return S.index.districts.find(d => d.name === S.name).bounds; }
function fit2d() { resize2d(); const [x0, y0, x1, y1] = bounds(); C2.cx = (x0 + x1) / 2; C2.cy = (y0 + y1) / 2; C2.sc = Math.min(C2.W / Math.max(x1 - x0, 1), C2.H / Math.max(y1 - y0, 1)) * 0.86; }
const sxy = i => [(S.d.x[i] - C2.cx) * C2.sc + C2.W / 2, (S.d.y[i] - C2.cy) * C2.sc + C2.H / 2];
function zoomBy(f, mx = C2.W / 2, my = C2.H / 2) { const wx = (mx - C2.W / 2) / C2.sc + C2.cx, wy = (my - C2.H / 2) / C2.sc + C2.cy; C2.sc *= f; C2.cx = wx - (mx - C2.W / 2) / C2.sc; C2.cy = wy - (my - C2.H / 2) / C2.sc; draw2d(); }
function centerOn(i) { C2.cx = S.d.x[i]; C2.cy = S.d.y[i]; C2.sc = Math.max(C2.sc, 0.06); draw2d(); }
function visibleMarkers(W, H, tr, pad = 14) {
  const out = [], d = S.d;
  for (let i = 0; i < d.x.length; i++) { const L = S.layerOf[i]; if (L < 0 || !S.layerOn[L]) continue; const [x, y] = tr(i); if (x > -pad && y > -pad && x < W + pad && y < H + pad) out.push([i, x, y, L]); }
  return out;
}
function drawScenery(g, W, H, tr, small) {
  const d = S.d, n = d.x.length;
  g.fillStyle = '#0d0f13'; g.fillRect(0, 0, W, H);
  const order = [7, 8, 9, 1, 0, 6, 4, 5, 3, 2];
  for (const k of order) {
    if (!S.on[k]) continue; g.fillStyle = S.index.colours[k]; g.globalAlpha = k === 3 ? 0.85 : 0.55; const s = small ? 1 : k === 3 ? 3 : 2;
    for (let i = 0; i < n; i++) { if (d.kind[i] !== k || S.layerOf[i] >= 0) continue; const [x, y] = tr(i); if (x < -3 || y < -3 || x > W + 3 || y > H + 3) continue; g.fillRect(x - s / 2, y - s / 2, s, s); }
  }
  g.globalAlpha = 1;
}
function draw2d() {
  if (S.mode !== '2d' || !S.d) return;
  const g = cv2.getContext('2d'), W = C2.W, H = C2.H; drawScenery(g, W, H, sxy, false);
  const ms = visibleMarkers(W, H, sxy), sz = C2.sc > 0.03 ? 24 : 18, placed = [];
  g.font = '600 11.5px Inter,system-ui,sans-serif'; g.textBaseline = 'middle';
  for (const [i, x0, y0, L] of ms) {
    let x = x0, y = y0;
    if (LAYERS[L].dot) { g.fillStyle = LAYERS[L].col; g.globalAlpha = .7; g.fillRect(x - 2, y - 2, 4, 4); g.globalAlpha = 1; continue; }
    for (let k = 0; k < 6 && placed.some(p => Math.abs(p[0] - x) < sz * 0.8 && Math.abs(p[1] - y) < sz * 0.8); k++) { x = x0 + Math.cos(k * 1.3) * sz * 0.9; y = y0 + Math.sin(k * 1.3) * sz * 0.9; }
    placed.push([x, y, i, L]); const img = S.icons[LAYERS[L].id]; if (img.complete) g.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
  }
  const boxes = [], prio = id => ({ contact: 0, beacon: 1, dropoff: 2 }[id] ?? 9);
  const cand = placed.filter(([, , i, L]) => i === S.sel || (S.opt.labels && prio(LAYERS[L].id) < 9 && (C2.sc > 0.025 || LAYERS[L].id === 'contact')))
    .sort((a, b) => (b[2] === S.sel) - (a[2] === S.sel) || prio(LAYERS[a[3]].id) - prio(LAYERS[b[3]].id));
  for (const [x, y, i] of cand) {
    const t = title(i), w = g.measureText(t).width + 12, bx = x + sz / 2 + 4, box = [bx, y - 10, bx + w, y + 10];
    if (i !== S.sel && boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    boxes.push(box); g.fillStyle = 'rgba(15,17,21,.85)'; g.beginPath(); g.roundRect(bx, y - 10, w, 20, 6); g.fill(); g.fillStyle = '#e9e9ec'; g.fillText(t, bx + 6, y + 1);
  }
  S.placed = placed;
  for (const i of S.hits) { const [x, y] = sxy(i); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x - 7, y - 7, 14, 14); }
  if (S.sel >= 0) { const [x, y] = sxy(S.sel); g.strokeStyle = '#f2a33a'; g.lineWidth = 2.5; g.shadowColor = '#f2a33a'; g.shadowBlur = 14; g.beginPath(); g.arc(x, y, 18, 0, 7); g.stroke(); g.shadowBlur = 0; }
  g.fillStyle = 'rgba(233,233,236,.45)'; g.font = '11px Inter,system-ui,sans-serif'; g.fillText(`1 px ≈ ${(1 / C2.sc / 100).toFixed(1)} m`, 16, H - 16);
}
function pick2d(mx, my) {
  for (const [x, y, i] of (S.placed || []).slice().reverse()) if ((x - mx) ** 2 + (y - my) ** 2 < 14 ** 2) return i;
  let best = -1, bd = 7 * 7; const d = S.d;
  for (let i = 0; i < d.x.length; i++) { if (!S.on[d.kind[i]] || S.layerOf[i] >= 0) continue; const [x, y] = sxy(i), dd = (x - mx) ** 2 + (y - my) ** 2; if (dd < bd) { bd = dd; best = i; } }
  return best;
}
let drag = null, moved = false;
cv2.onmousedown = e => { drag = [e.clientX, e.clientY, C2.cx, C2.cy]; moved = false; cv2.classList.add('drag'); };
window.addEventListener('mouseup', () => { drag = null; cv2.classList.remove('drag'); });
cv2.onmousemove = e => {
  const tip = $('#tip');
  if (drag) { const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; C2.cx = drag[2] - dx / C2.sc; C2.cy = drag[3] - dy / C2.sc; tip.style.display = 'none'; draw2d(); return; }
  const i = pick2d(e.clientX, e.clientY); if (i < 0) { tip.style.display = 'none'; return; }
  tip.style.display = 'block'; tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; tip.textContent = title(i);
};
cv2.onmouseleave = () => $('#tip').style.display = 'none';
cv2.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY); }, { passive: false });
cv2.onclick = e => { if (moved) return; const i = pick2d(e.clientX, e.clientY); if (i >= 0) select(i); else { S.sel = -1; $('#detail').style.display = 'none'; draw2d(); } };
cv2.ondblclick = e => { const i = pick2d(e.clientX, e.clientY); if (i >= 0) { select(i); setMode('3d', i); } };
let touch = null;
cv2.addEventListener('touchstart', e => { const t = e.touches; touch = t.length === 2 ? { d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), sc: C2.sc } : { x: t[0].clientX, y: t[0].clientY, cx: C2.cx, cy: C2.cy }; }, { passive: true });
cv2.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches; if (t.length === 2 && touch.d) { C2.sc = touch.sc * Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) / touch.d; } else if (t.length === 1 && touch.x !== undefined) { C2.cx = touch.cx - (t[0].clientX - touch.x) / C2.sc; C2.cy = touch.cy - (t[0].clientY - touch.y) / C2.sc; } draw2d(); }, { passive: false });

function select(i) {
  S.sel = i; draw2d(); V3.mark(i);
  const d = S.d, inf = info(i), L = S.layerOf[i], rows = [];
  if (inf.eFaction) rows.push(['Faction', FACTION[inf.eFaction] || inf.eFaction]);
  if (inf.eContact) rows.push(['Contact ID', inf.eContact]);
  rows.push(['District', $('#district').selectedOptions[0]?.text || S.name], ['Map', d.maps[d.map[i]]], ['Position', `X ${Math.round(d.x[i]).toLocaleString()} · Y ${Math.round(d.y[i]).toLocaleString()} · Z ${Math.round(d.z[i]).toLocaleString()}`]);
  if (d.mesh[i] >= 0 && S.meshes) rows.push(['Model', S.meshes[d.mesh[i]].name]);
  rows.push(['Object', `${d.classes[d.cls[i]]} · ${d.name[i]}`]);
  const near = nearby(i); if (near) rows.push(['Nearby', near]);
  const el = $('#detail'); el.style.display = 'block';
  el.innerHTML = `<button class="x" id="dx">✕</button><div class="t">${esc(title(i))}</div><div class="s">${L >= 0 ? LAYERS[L].one : esc(S.index.kinds[d.kind[i]])}</div>
    <div class="kv">${rows.map(r => `<span>${r[0]}</span><span>${esc(r[1])}</span>`).join('')}</div>
    <div class="acts"><button class="primary" id="d3">${S.mode === '3d' ? 'Fly here' : 'View in 3D'}</button><button id="dl">Copy link</button></div>`;
  $('#dx').onclick = () => { el.style.display = 'none'; S.sel = -1; draw2d(); };
  $('#d3').onclick = () => S.mode === '3d' ? V3.flyTo(i) : setMode('3d', i);
  $('#dl').onclick = () => { const u = location.href.split('#')[0] + '#' + new URLSearchParams({ district: S.name, sel: i, mode: S.mode }); navigator.clipboard?.writeText(u); $('#dl').textContent = 'Copied'; };
  history.replaceState(null, '', '#' + new URLSearchParams({ district: S.name, sel: i }));
}
function nearby(i) {
  const d = S.d, c = {};
  for (let j = 0; j < d.x.length; j++) { const L = S.layerOf[j]; if (L < 0 || j === i || LAYERS[L].dot) continue; if ((d.x[j] - d.x[i]) ** 2 + (d.y[j] - d.y[i]) ** 2 < 3000 ** 2) c[L] = (c[L] || 0) + 1; }
  return Object.entries(c).map(([L, n]) => `${n} ${(n === 1 ? LAYERS[L].one : LAYERS[L].name).toLowerCase()}`).join(', ');
}

function setupSearch() {
  const inp = $('#search'), box = $('#results'); let res = [], cur = 0;
  const run = () => {
    const q = inp.value.trim().toLowerCase(); res = [];
    if (q.length >= 2) {
      const d = S.d;
      for (let i = 0; i < d.x.length && res.length < 40; i++) {
        const L = S.layerOf[i], t = (L >= 0 || d.labels[i]) ? title(i) : '';
        if ((t && t.toLowerCase().includes(q)) || d.name[i].toLowerCase().includes(q) || d.classes[d.cls[i]].toLowerCase() === q) res.push(i);
      }
      res.sort((a, b) => (S.layerOf[b] >= 0) - (S.layerOf[a] >= 0));
    }
    cur = 0; S.hits = new Set(res); draw2d();
    box.style.display = res.length || q.length >= 2 ? 'block' : 'none';
    box.innerHTML = res.length ? res.slice(0, 12).map((i, k) => { const L = S.layerOf[i]; return `<div data-i="${i}" class="${k === cur ? 'on' : ''}">${L >= 0 ? `<span class="ic" style="--c:${LAYERS[L].col}">${svg(LAYERS[L].id, 13)}</span>` : ''}${esc(title(i))}<small>${esc(L >= 0 ? LAYERS[L].one : S.d.classes[S.d.cls[i]])}</small></div>`; }).join('')
      : '<div class="dim">No matches</div>';
    box.querySelectorAll('[data-i]').forEach(el => el.onmousedown = () => go(+el.dataset.i));
  };
  const go = i => { box.style.display = 'none'; select(i); if (S.mode === '3d') V3.flyTo(i); else centerOn(i); };
  inp.oninput = run; inp.onfocus = run; inp.onblur = () => setTimeout(() => box.style.display = 'none', 150);
  inp.onkeydown = e => {
    if (e.key === 'Enter' && res.length) go(res[cur]);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { cur = Math.max(0, Math.min(Math.min(res.length, 12) - 1, cur + (e.key === 'ArrowDown' ? 1 : -1))); box.querySelectorAll('[data-i]').forEach((el, k) => el.classList.toggle('on', k === cur)); e.preventDefault(); }
    if (e.key === 'Escape') { inp.value = ''; run(); inp.blur(); }
  };
}

const P = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
function ueMatrix(i) {
  const d = S.d, r = Math.PI / 180, p = d.pitch[i] * r, y = d.yaw[i] * r, ro = d.roll[i] * r;
  const SP = Math.sin(p), CP = Math.cos(p), SY = Math.sin(y), CY = Math.cos(y), SR = Math.sin(ro), CR = Math.cos(ro);
  const m = new THREE.Matrix4().set(
    CP * CY, SR * SP * CY - CR * SY, -(CR * SP * CY + SR * SY), d.x[i],
    CP * SY, SR * SP * SY + CR * CY, CY * SR - CR * SP * SY, d.y[i],
    SP, -SR * CP, CR * CP, d.z[i],
    0, 0, 0, 1);
  return new THREE.Matrix4().multiplyMatrices(P, m).multiply(new THREE.Matrix4().makeScale(d.sx[i] || 1, d.sy[i] || 1, d.sz[i] || 1));
}
const TEX = new Map(), TEXCHUNK = {};
function texture(id, r) {
  if (!TEX.has(id)) TEX.set(id, (async () => {
    S.texIndex = S.texIndex || await (S.texIndexP = S.texIndexP || getJSON('data/textures.json'));
    const [c, off, len] = S.texIndex[id];
    if (!TEXCHUNK[c]) TEXCHUNK[c] = fetch(`data/tex_${c}.bin`).then(x => x.arrayBuffer());
    const bmp = await createImageBitmap(new Blob([(await TEXCHUNK[c]).slice(off, off + len)], { type: 'image/webp' }));
    const t = new THREE.Texture(bmp); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = r.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
    return t;
  })());
  return TEX.get(id);
}
function useTexture(m, r) {
  const tid = m.userData.tid;
  if (tid < 0 || !S.opt.textures) { m.map = null; m.color.set(m.userData.col); m.needsUpdate = true; return; }
  texture(tid, r).then(t => { if (!S.opt.textures) return; m.map = t; m.color.set(0xffffff); m.needsUpdate = true; }).catch(() => {});
}
const V3 = {
  ready: false, renderer: null, scene: null, cam: null, groups: [], markers: [], marker: null, mats: new Map(),
  yaw: 0, pitch: -0.3, speed: 2000, keys: new Set(),
  init() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); $('#c3d').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xa9bccd); this.scene.fog = new THREE.Fog(0xa9bccd, 20000, 120000);
    this.cam = new THREE.PerspectiveCamera(60, 1, 20, 400000);
    this.scene.add(new THREE.HemisphereLight(0xe8eef5, 0x4a4438, 2.0));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.8); sun.position.set(0.4, 1, 0.3); this.scene.add(sun);
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(260, 30, 8, 40), new THREE.MeshBasicMaterial({ color: 0xf2a33a, fog: false })); this.marker.rotation.x = Math.PI / 2; this.marker.visible = false; this.scene.add(this.marker);
    const el = this.renderer.domElement; let dragging = null, mv = false;
    el.addEventListener('mousedown', e => { dragging = [e.clientX, e.clientY]; mv = false; });
    window.addEventListener('mouseup', () => dragging = null);
    el.addEventListener('mousemove', e => {
      if (!dragging) return; const dx = e.clientX - dragging[0], dy = e.clientY - dragging[1]; if (Math.abs(dx) + Math.abs(dy) > 2) mv = true;
      dragging = [e.clientX, e.clientY]; this.yaw -= dx * 0.004; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.004));
    });
    el.addEventListener('click', e => { if (!mv) this.pick(e); });
    el.addEventListener('wheel', e => { e.preventDefault(); this.speed = Math.max(100, Math.min(50000, this.speed * (e.deltaY < 0 ? 1.25 : 0.8))); this.help(); }, { passive: false });
    window.addEventListener('keydown', e => { if (S.mode === '3d' && !['INPUT', 'SELECT'].includes(document.activeElement.tagName)) { this.keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    $('#mini canvas').onclick = e => { const r = e.target.getBoundingClientRect(), [x, y] = this.miniToWorld((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); this.cam.position.x = x; this.cam.position.z = y; };
    let last = performance.now();
    const loop = t => { const dt = Math.min(0.1, (t - last) / 1000); last = t; if (S.mode === '3d') this.frame(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  help() { const h = $('#help'); h.style.display = S.mode === '3d' ? 'block' : 'none'; h.textContent = `WASD / arrows move · Q / E down / up · Shift faster · drag to look · wheel: speed ${Math.round(this.speed)}`; },
  resize() { this.renderer.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); },
  async chunk(n) {
    if (!S.chunks[n]) S.chunks[n] = fetch(`data/meshes_${n}.bin`).then(r => { if (!r.ok) throw new Error('meshes_' + n + '.bin ' + r.status); return r.arrayBuffer(); });
    return S.chunks[n];
  },
  geometry(id, buf) {
    const m = S.meshes[id]; if (!m.v) return null;
    const q = new Uint16Array(buf, m.off, m.v * 3), pos = new Float32Array(m.v * 3);
    for (let i = 0; i < m.v; i++) for (let k = 0; k < 3; k++) pos[3 * i + k] = m.lo[k] + q[3 * i + k] / 65535 * (m.hi[k] - m.lo[k]);
    const uoff = m.off + ((m.v * 6 + 3) & ~3), qu = new Uint16Array(buf, uoff, m.v * 2), uv = new Float32Array(m.v * 2);
    for (let i = 0; i < m.v; i++) for (let k = 0; k < 2; k++) uv[2 * i + k] = m.ulo[k] + qu[2 * i + k] / 65535 * (m.uhi[k] - m.ulo[k]);
    const ioff = uoff + m.v * 4, idx = m.i32 ? new Uint32Array(buf.slice(ioff, ioff + m.i * 4)) : new Uint16Array(buf.slice(ioff, ioff + m.i * 2));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    m.groups.forEach(([s, c], k) => g.addGroup(s, c, k)); return g;
  },
  material(col, tid) {
    const key = col + '|' + tid;
    if (!this.mats.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.92, metalness: 0, flatShading: true, side: THREE.DoubleSide });
      m.userData = { col, tid }; useTexture(m, this.renderer); this.mats.set(key, m);
    }
    return this.mats.get(key);
  },
  applyTextures() { for (const m of this.mats.values()) useTexture(m, this.renderer); },
  async build() {
    this.init(); this.clear();
    if (!S.meshes) { progress('Loading model index…'); S.meshes = await getJSON('data/meshes.json'); }
    const dist = S.index.districts.find(d => d.name === S.name), d = S.d, by = new Map();
    const add = (m, i) => { if (!by.has(m)) by.set(m, []); by.get(m).push(i); };
    for (let i = 0; i < d.x.length; i++) if (d.mesh[i] >= 0) add(d.mesh[i], i);
    for (const [i, m] of d.extra || []) add(m, i);
    let done = 0;
    for (const n of dist.chunks) { progress(`Downloading 3D data ${++done} / ${dist.chunks.length}…`); await this.chunk(n); }
    progress('Building the scene…');
    for (const [id, list] of by) {
      const m = S.meshes[id], g = this.geometry(id, await this.chunk(m.chunk)); if (!g) continue;
      const im = new THREE.InstancedMesh(g, m.groups.map(x => this.material(x[2], x[3])), list.length);
      list.forEach((pi, k) => im.setMatrixAt(k, ueMatrix(pi)));
      im.userData.placements = list; im.computeBoundingSphere(); this.scene.add(im); this.groups.push(im);
    }
    const zs = Array.from(d.z).sort((a, b) => a - b), z0 = zs[Math.floor(zs.length * 0.05)] || 0, [x0, y0, x1, y1] = dist.bounds;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 40000, y1 - y0 + 40000), new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set((x0 + x1) / 2, z0 - 60, (y0 + y1) / 2); this.scene.add(ground); this.groups.push(ground);
    this.z0 = z0; this.ready = true; this.applyKinds(); this.buildMarkers();
    if (S.sel >= 0) this.flyTo(S.sel); else this.overview();
    progress(''); this.help();
  },
  buildMarkers() {
    for (const s of this.markers) this.scene.remove(s); this.markers = [];
    const mats = LAYERS.map(l => { const img = S.icons[l.id], c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').drawImage(img, 0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false, sizeAttenuation: false }); });
    const d = S.d;
    for (let i = 0; i < d.x.length; i++) {
      const L = S.layerOf[i]; if (L < 0 || LAYERS[L].dot) continue;
      const s = new THREE.Sprite(mats[L]); s.position.set(d.x[i], d.z[i] + 250, d.y[i]); s.scale.set(0.035, 0.035, 1); s.renderOrder = 10; s.userData.placement = i; s.userData.layer = L;
      this.scene.add(s); this.markers.push(s);
    }
    this.applyMarkers();
  },
  applyMarkers() { for (const s of this.markers) s.visible = S.layerOn[s.userData.layer]; },
  clear() { for (const o of this.groups.concat(this.markers)) { this.scene.remove(o); o.geometry?.dispose(); } this.groups = []; this.markers = []; this.ready = false; },
  applyKinds() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const im of this.groups) { if (!im.isInstancedMesh) continue; im.userData.placements.forEach((pi, k) => im.setMatrixAt(k, S.on[S.d.kind[pi]] ? ueMatrix(pi) : zero)); im.instanceMatrix.needsUpdate = true; }
  },
  flyTo(i) { const d = S.d; this.cam.position.set(d.x[i] - 4000, d.z[i] + 4500, d.y[i] + 4000); this.lookAt(d.x[i], d.z[i], d.y[i]); this.mark(i); },
  overview() { const [x0, y0, x1, y1] = bounds(), s = Math.max(x1 - x0, y1 - y0); this.cam.position.set((x0 + x1) / 2, (this.z0 || 0) + s * 0.35, (y0 + y1) / 2 + s * 0.45); this.yaw = 0; this.pitch = -0.6; },
  top() {
    const [x0, y0, x1, y1] = bounds(), s = Math.max(x1 - x0, y1 - y0), p = this.cam.position, z0 = this.z0 || 0;
    let tx = (x0 + x1) / 2, ty = (y0 + y1) / 2; const fy = Math.sin(this.pitch);
    if (fy < -0.05) { const t = (p.y - z0) / -fy; tx = p.x - Math.sin(this.yaw) * Math.cos(this.pitch) * t; ty = p.z - Math.cos(this.yaw) * Math.cos(this.pitch) * t; }
    p.set(Math.min(x1, Math.max(x0, tx)), z0 + Math.min(s * 0.35, Math.max(8000, p.y - z0)), Math.min(y1, Math.max(y0, ty))); this.yaw = 0; this.pitch = -Math.PI / 2 + 1e-4;
  },
  lookAt(x, y, z) { const p = this.cam.position, dx = x - p.x, dy = y - p.y, dz = z - p.z; this.yaw = Math.atan2(-dx, -dz); this.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  mark(i) { if (!this.marker) return; const d = S.d; this.marker.position.set(d.x[i], d.z[i] + 40, d.y[i]); this.marker.visible = true; },
  pick(e) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1), this.cam);
    const sp = ray.intersectObjects(this.markers.filter(s => s.visible), false)[0]; if (sp) return select(sp.object.userData.placement);
    const hit = ray.intersectObjects(this.groups.filter(g => g.isInstancedMesh), false)[0];
    if (hit && hit.instanceId !== undefined) select(hit.object.userData.placements[hit.instanceId]);
  },
  frame(dt) {
    const k = this.keys, sp = this.speed * (k.has('shift') ? 4 : 1) * dt;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), p = this.cam.position;
    if (k.has('w') || k.has('arrowup')) p.addScaledVector(fwd, sp); if (k.has('s') || k.has('arrowdown')) p.addScaledVector(fwd, -sp);
    if (k.has('d') || k.has('arrowright')) p.addScaledVector(right, sp); if (k.has('a') || k.has('arrowleft')) p.addScaledVector(right, -sp);
    if (k.has('e')) p.y += sp; if (k.has('q')) p.y -= sp;
    const h = Math.max(0, p.y - (this.z0 || 0)); this.scene.fog.near = 20000 + h; this.scene.fog.far = 120000 + 2.5 * h;
    const near = Math.max(20, h * 0.02); if (Math.abs(near - this.cam.near) > 1) { this.cam.near = near; this.cam.updateProjectionMatrix(); }
    this.cam.lookAt(p.clone().add(fwd)); this.renderer.render(this.scene, this.cam); this.drawMini();
  },
  miniBox() { const [x0, y0, x1, y1] = bounds(), s = Math.max(x1 - x0, y1 - y0); return [(x0 + x1) / 2 - s / 2, (y0 + y1) / 2 - s / 2, s]; },
  miniToWorld(fx, fy) { const [bx, by, s] = this.miniBox(); return [bx + fx * s, by + fy * s]; },
  drawMini() {
    const cv = $('#mini canvas'), g = cv.getContext('2d'), W = cv.width, [bx, by, s] = this.miniBox(), sc = W / s, key = S.name + S.on.join() + S.layerOn.join();
    if (this._miniKey !== key) {
      const tr = i => [(S.d.x[i] - bx) * sc, (S.d.y[i] - by) * sc]; drawScenery(g, W, W, tr, true);
      for (const [, x, y, L] of visibleMarkers(W, W, tr)) { g.fillStyle = LAYERS[L].col; g.beginPath(); g.arc(x, y, LAYERS[L].dot ? 1.5 : 4, 0, 7); g.fill(); }
      this._miniImg = g.getImageData(0, 0, W, W); this._miniKey = key;
    } else g.putImageData(this._miniImg, 0, 0);
    const p = this.cam.position, x = (p.x - bx) * sc, y = (p.z - by) * sc, a = Math.atan2(-Math.cos(this.yaw), -Math.sin(this.yaw)), h = 0.45;
    g.fillStyle = 'rgba(242,163,58,.3)'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 60, a - h, a + h); g.closePath(); g.fill();
    g.fillStyle = '#f2a33a'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.stroke();
  },
};

async function setMode(m, focus) {
  S.mode = m; document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#c2d').style.display = m === '2d' ? 'block' : 'none'; $('#c3d').style.display = m === '3d' ? 'block' : 'none';
  $('#mini').style.display = m === '3d' ? 'block' : 'none'; $('#zoom').style.display = m === '2d' ? 'flex' : 'none';
  $('#v3btns').style.display = m === '3d' ? 'flex' : 'none'; $('#tip').style.display = 'none'; V3.help();
  const b3 = $('#d3'); if (b3) b3.textContent = m === '3d' ? 'Fly here' : 'View in 3D';
  if (m === '2d') { resize2d(); draw2d(); return; }
  V3.init(); V3.resize();
  try { if (!V3.ready || V3.builtFor !== S.name) { await V3.build(); V3.builtFor = S.name; } } catch (e) { progress(''); status('3D failed: ' + e.message); return; }
  if (focus !== undefined) V3.flyTo(focus);
}
window.addEventListener('resize', () => { if (S.mode === '2d') { resize2d(); draw2d(); } else V3.resize(); });
window.APB = { S, V3 };
init().catch(e => { progress(''); status('failed: ' + e.message); });
