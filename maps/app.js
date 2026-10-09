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
  spawn: '<path d="M12 2v5M9.5 4.5L12 7l2.5-2.5M5 21a7 7 0 0 1 14 0M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="none" stroke="currentColor" stroke-width="2"/>',
  mission: '<path d="M6 21V3h11l-2.5 4.5L17 12H6" fill="currentColor"/>',
  pumpkin: '<path d="M12 7c-1.2-.9-3-1.2-4.6-.6C4.6 7.4 3.5 10 3.8 13c.3 3.4 2.7 6 5.4 6 1 0 1.9-.3 2.8-.8.9.5 1.8.8 2.8.8 2.7 0 5.1-2.6 5.4-6 .3-3-.8-5.6-3.6-6.6-1.6-.6-3.4-.3-4.6.6z" fill="currentColor"/><path d="M12 7c0-1.6.6-3 2-4" fill="none" stroke="currentColor" stroke-width="2"/>',
  task: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
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
  { id: 'spawn', one: 'Player spawn point', name: 'Player spawn points', cls: ['cPlayerCharacterSpawnZone', 'PlayerStart'], col: '#58d6ff', on: false },
  { id: 'mission', one: 'Mission spawn', name: 'Mission spawns', cls: ['cPlayerCharacterMissionSpawnZone'], col: '#ff7a45', on: false, small: true },
  { id: 'task', one: 'Task item spawn', name: 'Task item spawns', cls: ['cTaskItemSpawnZone', 'cTaskTargetTaskItemSpawner'], col: '#d9dee6', on: false, small: true },
  { id: 'pumpkinG', icon: 'pumpkin', one: 'Green pumpkin', name: 'Green pumpkins', cls: [], tt: 'PumpkinGreen', col: '#7ee05f', on: true, season: true, small: true },
  { id: 'pumpkinP', icon: 'pumpkin', one: 'Purple pumpkin', name: 'Purple pumpkins', cls: [], tt: 'PumpkinPurple', col: '#b98cff', on: true, season: true, small: true },
  { id: 'pumpkinR', icon: 'pumpkin', one: 'Red pumpkin', name: 'Red pumpkins', cls: [], tt: 'PumpkinRed', col: '#ff5a4f', on: true, season: true },
];
const SEASON = [[/Halloween_GreenPumpkin/i, 'Halloween: green pumpkin set'], [/Halloween_PurplePumpkin/i, 'Halloween: purple pumpkin set'], [/Halloween/i, 'Halloween'],
  [/Christmas/i, 'Christmas'], [/Minigame_Epidemic/i, 'Epidemic minigame'], [/Minigame_ItemSpawn/i, 'Minigame item spawns'], [/Minigame/i, 'Minigames']];
const svg = (k, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}">${ICON[k] || ICON[LAYERS.find(l => l.id === k)?.icon]}</svg>`;
const FACTION = { kFACTION_Both: 'Both factions', kFACTION_Criminal: 'Criminal', kFACTION_Enforcer: 'Enforcer' };
const DROPOFF = { DropOff_Enf: 'Enforcer drop-off', DropOff_Crim: 'Criminal drop-off', SmallItemDropOff_Crim: 'Small item drop-off (Criminal)',
  MediumLargeItemDropOff_Crim: 'Medium/large item drop-off (Criminal)', VehicleDropOff_Crim: 'Vehicle drop-off (Criminal)', VehicleDropOff_Enf: 'Vehicle drop-off (Enforcer)' };

const S = { season: false, index: null, meshes: null, d: null, name: '', on: [], layerOn: LAYERS.map(l => l.on), layerOf: null, counts: [], hits: new Set(), sel: -1, 
  mode: '2d', opt: { textures: true, labels: true, imagery: true }, icons: {} };

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
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36" width="${px}" height="${px}"><circle cx="12" cy="12" r="16" fill="${l.col}" stroke="rgba(0,0,0,.55)" stroke-width="3"/><g color="#14161b">${ICON[l.icon || l.id]}</g></svg>`;
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
  document.querySelectorAll('[data-opt]').forEach(r => r.onclick = () => { const k = r.dataset.opt; S.opt[k] = !S.opt[k]; r.querySelector('.switch').classList.toggle('on', S.opt[k]); if (k === 'textures') V3.applyTextures(); if (k === 'imagery') imagery(); else draw2d(); });
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
  const byTT = new Map(LAYERS.map((l, k) => [l.tt, k]).filter(x => x[0]));
  for (const [i, v] of Object.entries(d.info)) { const m = /eTaskTargetType=(\S+)/.exec(v), k = m ? byTT.get(m[1]) : undefined; if (k !== undefined) { if (S.layerOf[i] >= 0) S.counts[S.layerOf[i]]--; S.layerOf[i] = k; S.counts[k]++; } }
  S.sgroup = d.maps.map(m => { const g = SEASON.find(([re]) => re.test(m)); return g ? g[1] : ''; });
  S.groups = [...new Set(S.sgroup.filter(Boolean))].map(g => [g, 0]); const gi = new Map(S.groups.map(([g], k) => [g, k]));
  S.gidx = new Int8Array(n).fill(-1); for (let i = 0; i < n; i++) { const g = S.sgroup[d.map[i]]; if (g) { S.gidx[i] = gi.get(g); S.groups[S.gidx[i]][1]++; } }
  S.groupOn = S.groups.map(([g]) => S.groupWant?.[g] ?? !/purple/i.test(g)); S.hid = new Uint8Array(n); applySeason(false); seasonPanel();
  status($('#district').selectedOptions[0]?.text || name);
  const kc = S.index.kinds.map(() => 0); d.kind.forEach(k => kc[k]++); S.on = S.index.kinds.map(() => true);
  $('#layers').innerHTML = LAYERS.map((l, k) => S.counts[k] && !l.season ? `<div class="row" data-l="${k}" style="--c:${l.col}"><div class="ic">${svg(l.id)}</div>${l.name}<span class="n">${S.counts[k].toLocaleString()}</span><span class="switch ${S.layerOn[k] ? 'on' : ''}"></span></div>` : '').join('');
  $('#layers').querySelectorAll('.row').forEach(r => r.onclick = () => { const k = +r.dataset.l; S.layerOn[k] = !S.layerOn[k]; r.querySelector('.switch').classList.toggle('on', S.layerOn[k]); draw2d(); V3.applyMarkers(); });
  $('#kinds').innerHTML = S.index.kinds.map((k, i) => kc[i] ? `<div class="row" data-k="${i}"><span class="swatch" style="background:${S.index.colours[i]}"></span>${esc(k)}<span class="n">${kc[i].toLocaleString()}</span><span class="switch on"></span></div>` : '').join('');
  $('#kinds').querySelectorAll('.row').forEach(r => r.onclick = () => { const k = +r.dataset.k; S.on[k] = !S.on[k]; r.querySelector('.switch').classList.toggle('on', S.on[k]); draw2d(); if (V3.ready) V3.applyKinds(); });
  targetTypes(); missionMatches(); if (M.cur) drawMission(); S.hits = new Set(); $('#hitchip').style.display = 'none'; computeProps();
  $('#detail').style.display = 'none'; fit2d(); draw2d(); progress('');
  if (S.mode === '2d' && S.opt.imagery) imagery();
  history.replaceState(null, '', '#district=' + encodeURIComponent(name));
  if (S.mode === '3d') { await V3.build(); V3.builtFor = name; }
}

function applySeason(redraw = true) {
  const d = S.d; for (let i = 0; i < d.x.length; i++) S.hid[i] = S.gidx[i] >= 0 && !(S.season && S.groupOn[S.gidx[i]]) ? 1 : 0;
  if (!redraw) return; draw2d(); if (V3.ready) { V3.applyKinds(); V3.buildMarkers(); }
}
function seasonPanel() {
  const el = $('#seasonal'); el.style.display = S.groups.length ? '' : 'none'; if (!S.groups.length) return;
  const row = (attr, on, body, n) => `<div class="row" ${attr}>${body}<span class="n">${n.toLocaleString()}</span><span class="switch ${on ? 'on' : ''}"></span></div>`;
  $('#season').innerHTML = row('data-s="all"', S.season, '<b>Show seasonal content</b>', S.groups.reduce((a, g) => a + g[1], 0))
    + `<div class="${S.season ? '' : 'off'}" id="sgroups">` + S.groups.map(([g, n], k) => row(`data-s="${k}"`, S.groupOn[k], `<span class="swatch" style="background:#f2a33a"></span>${esc(g)}`, n)).join('')
    + LAYERS.map((l, k) => l.season && S.counts[k] ? row(`data-l="${k}"`, S.layerOn[k], `<div class="ic" style="--c:${l.col}">${svg(l.id)}</div>${l.name}`, S.counts[k]) : '').join('') + '</div>';
  $('#season').querySelectorAll('.row').forEach(r => r.onclick = () => {
    if (r.dataset.l !== undefined) { const k = +r.dataset.l; S.layerOn[k] = !S.layerOn[k]; seasonPanel(); draw2d(); V3.applyMarkers(); return; }
    if (r.dataset.s === 'all') S.season = !S.season; else { const k = +r.dataset.s; S.groupOn[k] = !S.groupOn[k]; S.groupWant = { ...S.groupWant, [S.groups[k][0]]: S.groupOn[k] }; }
    seasonPanel(); applySeason();
  });
}
function reveal(list) {
  const arr = [...list], shown = i => S.gidx[i] < 0 || (S.season && S.groupOn[S.gidx[i]]);
  if (!arr.length || arr.some(shown)) return;
  S.season = true;
  if (!arr.some(shown)) { const gs = [...new Set(arr.map(i => S.gidx[i]))]; S.groupOn[gs.find(g => !/purple/i.test(S.groups[g][0])) ?? gs[0]] = true; }
  seasonPanel(); applySeason();
}

const C2 = { cx: 0, cy: 0, sc: 1, W: 0, H: 0 };
const cv2 = $('#c2d');
function resize2d() { const dpr = devicePixelRatio; C2.W = innerWidth; C2.H = innerHeight; cv2.width = C2.W * dpr; cv2.height = C2.H * dpr; cv2.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
function bounds() { return S.index.districts.find(d => d.name === S.name).bounds; }
function fit2d() { resize2d(); const [x0, y0, x1, y1] = bounds(); C2.cx = (x0 + x1) / 2; C2.cy = (y0 + y1) / 2; C2.sc = Math.min(C2.W / Math.max(x1 - x0, 1), C2.H / Math.max(y1 - y0, 1)) * 0.86; C2.min = C2.sc / 4; }
const sxy = i => [(S.d.x[i] - C2.cx) * C2.sc + C2.W / 2, (S.d.y[i] - C2.cy) * C2.sc + C2.H / 2];
function zoomBy(f, mx = C2.W / 2, my = C2.H / 2) { const wx = (mx - C2.W / 2) / C2.sc + C2.cx, wy = (my - C2.H / 2) / C2.sc + C2.cy; C2.sc = Math.min(2, Math.max(C2.min || 0, C2.sc * f)); C2.cx = wx - (mx - C2.W / 2) / C2.sc; C2.cy = wy - (my - C2.H / 2) / C2.sc; draw2d(); }
function centerOn(i) { C2.cx = S.d.x[i]; C2.cy = S.d.y[i]; C2.sc = Math.max(C2.sc, 0.06); draw2d(); }
function visibleMarkers(W, H, tr, pad = 14) {
  const out = [], d = S.d;
  for (let i = 0; i < d.x.length; i++) { const L = S.layerOf[i]; if (L < 0 || !S.layerOn[L] || S.hid[i]) continue; const [x, y] = tr(i); if (x > -pad && y > -pad && x < W + pad && y < H + pad) out.push([i, x, y, L]); }
  return out;
}
function drawScenery(g, W, H, tr, small) {
  const d = S.d, n = d.x.length;
  g.fillStyle = '#0d0f13'; g.fillRect(0, 0, W, H);
  const order = [7, 8, 9, 1, 0, 6, 4, 5, 3, 2];
  for (const k of order) {
    if (!S.on[k]) continue; g.fillStyle = S.index.colours[k]; g.globalAlpha = k === 3 ? 0.85 : 0.55; const s = small ? 1 : k === 3 ? 3 : 2;
    for (let i = 0; i < n; i++) { if (d.kind[i] !== k || S.layerOf[i] >= 0 || S.hid[i]) continue; const [x, y] = tr(i); if (x < -3 || y < -3 || x > W + 3 || y > H + 3) continue; g.fillRect(x - s / 2, y - s / 2, s, s); }
  }
  g.globalAlpha = 1;
}
async function imagery() {
  const on = S.mode === '2d' && S.opt.imagery;
  $('#c3d').style.display = S.mode === '3d' || on ? 'block' : 'none';
  if (on) { V3.init(); V3.resize(); if (!V3.ready || V3.builtFor !== S.name) { try { await V3.build(); V3.builtFor = S.name; } catch (e) { progress(''); } } }
  draw2d();
}
let raf2d = 0;
function draw2d() { if (!raf2d) raf2d = requestAnimationFrame(() => { raf2d = 0; draw2dNow(); }); }
function draw2dNow() {
  if (S.mode !== '2d' || !S.d) return;
  const g = cv2.getContext('2d'), W = C2.W, H = C2.H, img = S.opt.imagery && V3.ready && V3.builtFor === S.name;
  if (img) { g.clearRect(0, 0, W, H); V3.renderTop(); } else drawScenery(g, W, H, sxy, false);
  const ms = visibleMarkers(W, H, sxy), sz = C2.sc > 0.03 ? 24 : 18, placed = [];
  g.font = '600 11.5px Inter,system-ui,sans-serif'; g.textBaseline = 'middle';
  for (const [i, x0, y0, L] of ms) {
    let x = x0, y = y0;
    if (LAYERS[L].small) { const img = S.icons[LAYERS[L].id], z = Math.max(12, sz * 0.62); if (img.complete) g.drawImage(img, x - z / 2, y - z / 2, z, z); continue; }
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
  S.placed = placed; drawMission2d(g, sxy, W, H);
  for (const i of S.hits) { const [x, y] = sxy(i); g.fillStyle = 'rgba(154,208,255,.25)'; g.strokeStyle = '#9ad0ff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
  if (S.sel >= 0) { const [x, y] = sxy(S.sel); g.strokeStyle = '#f2a33a'; g.lineWidth = 2.5; g.shadowColor = '#f2a33a'; g.shadowBlur = 14; g.beginPath(); g.arc(x, y, 18, 0, 7); g.stroke(); g.shadowBlur = 0; }
  g.fillStyle = 'rgba(233,233,236,.45)'; g.font = '11px Inter,system-ui,sans-serif'; g.fillText(`1 px ≈ ${(1 / C2.sc / 100).toFixed(1)} m`, 16, H - 16);
}
function pick2d(mx, my) {
  for (const [x, y, i] of (S.placed || []).slice().reverse()) if ((x - mx) ** 2 + (y - my) ** 2 < 14 ** 2) return i;
  let best = -1, bd = 7 * 7; const d = S.d;
  for (let i = 0; i < d.x.length; i++) { if (!S.on[d.kind[i]] || S.layerOf[i] >= 0 || S.hid[i]) continue; const [x, y] = sxy(i), dd = (x - mx) ** 2 + (y - my) ** 2; if (dd < bd) { bd = dd; best = i; } }
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
  for (let j = 0; j < d.x.length; j++) { const L = S.layerOf[j]; if (L < 0 || j === i || LAYERS[L].small || S.hid[j]) continue; if ((d.x[j] - d.x[i]) ** 2 + (d.y[j] - d.y[i]) ** 2 < 3000 ** 2) c[L] = (c[L] || 0) + 1; }
  return Object.entries(c).map(([L, n]) => `${n} ${(n === 1 ? LAYERS[L].one : LAYERS[L].name).toLowerCase()}`).join(', ');
}

const pretty = k => k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
function propKey(i) {
  const d = S.d, a = info(i).arch, L = S.layerOf[i];
  if (L >= 0 && LAYERS[L].tt) return LAYERS[L].one;
  if (d.mesh[i] < 0 && d.classes[d.cls[i]] !== 'cProp') return '';
  if (a) { const k = a.replace(/_?\d*Arc\d+$/, '').replace(/_+$/, '').replace(/_Prop$/i, ''); if (k) return k; }
  const m = d.mesh[i] >= 0 && S.meshes ? S.meshes[d.mesh[i]].name : '';
  return m.replace(/_LOD(_\d+)?$/i, '').replace(/_\d+$/, '');
}
async function computeProps() {
  if (!S.meshes) { try { S.meshes = await getJSON('data/meshes.json'); } catch { } }
  S.props = S.d.x.map((_, i) => propKey(i));
}
function hitBounds() {
  const d = S.d; let x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12;
  for (const i of S.hits) { x0 = Math.min(x0, d.x[i]); x1 = Math.max(x1, d.x[i]); y0 = Math.min(y0, d.y[i]); y1 = Math.max(y1, d.y[i]); }
  return [x0, y0, x1, y1];
}
function showHits(set, label) {
  reveal(set); if (S.hid && [...set].some(i => !S.hid[i])) set = new Set([...set].filter(i => !S.hid[i])); S.hits = set; S.hitLabel = label; const chip = $('#hitchip');
  chip.style.display = set.size && label ? 'flex' : 'none';
  if (set.size && label) chip.innerHTML = `<b>${esc(label)}</b><span class="dim">${set.size.toLocaleString()} shown</span><button id="hitx">✕</button>`;
  const hx = $('#hitx'); if (hx) hx.onclick = () => { $('#search').value = ''; showHits(new Set(), ''); };
  if (set.size && label) {
    const [x0, y0, x1, y1] = hitBounds();
    if (S.mode === '3d') { V3.cam.position.set((x0 + x1) / 2, (V3.z0 || 0) + Math.max(x1 - x0, y1 - y0, 3000) * 0.8 + 3000, (y0 + y1) / 2 + 2000); V3.yaw = 0; V3.pitch = -1.2; }
    else { C2.cx = (x0 + x1) / 2; C2.cy = (y0 + y1) / 2; C2.sc = Math.min(C2.W / Math.max(x1 - x0, 2500), C2.H / Math.max(y1 - y0, 2500)) * 0.8; }
  }
  draw2d(); V3.hitSprites();
}
function setupSearch() {
  const inp = $('#search'), box = $('#results'); let res = [], groups = [], models = [], cur = 0;
  const rows = () => box.querySelectorAll('[data-i],[data-g],[data-m]');
  const usesOf = m => { const set = new Set(); S.d.mesh.forEach((v, i) => { if (v === m) set.add(i); }); for (const [i, v] of S.d.extra || []) if (v === m) set.add(i); return set; };
  const run = () => {
    const q = inp.value.trim().toLowerCase(); res = []; groups = []; models = [];
    if (q.length >= 2) {
      const d = S.d, count = new Map();
      if (S.props) for (let i = 0; i < d.x.length; i++) { const k = S.props[i]; if (k && (k.toLowerCase().includes(q) || pretty(k).toLowerCase().includes(q))) count.set(k, (count.get(k) || 0) + 1); }
      groups = [...count].sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (S.meshes) {
        const mc = new Map(), add = m => { if (m >= 0 && S.meshes[m].name.toLowerCase().includes(q)) mc.set(m, (mc.get(m) || 0) + 1); };
        d.mesh.forEach(add); for (const [, m] of d.extra || []) add(m);
        models = [...mc].sort((a, b) => b[1] - a[1]).slice(0, 8);
      }
      for (let i = 0; i < d.x.length && res.length < 40; i++) {
        const L = S.layerOf[i], t = (L >= 0 || d.labels[i]) ? title(i) : '';
        if ((t && t.toLowerCase().includes(q)) || d.name[i].toLowerCase().includes(q) || d.classes[d.cls[i]].toLowerCase() === q) res.push(i);
      }
      res.sort((a, b) => (S.layerOf[b] >= 0) - (S.layerOf[a] >= 0));
    }
    cur = 0; box.style.display = q.length >= 2 ? 'block' : 'none';
    const cube = '<span class="ic" style="--c:#9ad0ff"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg></span>';
    box.innerHTML = (groups.length ? `<div class="rh">Props</div>` + groups.map(([k, n]) => `<div data-g="${esc(k)}">${cube}${esc(pretty(k))}<small>${n.toLocaleString()} on this map</small></div>`).join('') : '')
      + (models.length ? `<div class="rh">Models</div>` + models.map(([m, n]) => `<div data-m="${m}">${cube}<span class="mn">${esc(S.meshes[m].name)}</span><small>${n.toLocaleString()} placed</small></div>`).join('') : '')
      + (res.length ? `<div class="rh">Places & objects</div>` + res.slice(0, 12).map(i => { const L = S.layerOf[i]; return `<div data-i="${i}">${L >= 0 ? `<span class="ic" style="--c:${LAYERS[L].col}">${svg(LAYERS[L].id, 13)}</span>` : ''}${esc(title(i))}<small>${esc(L >= 0 ? LAYERS[L].one : S.d.classes[S.d.cls[i]])}</small></div>`; }).join('') : '')
      || '<div class="dim">No matches</div>';
    rows().forEach((el, k) => { el.classList.toggle('on', k === cur); el.onmousedown = () => pick(el); });
  };
  const pick = el => {
    box.style.display = 'none';
    if (el.dataset.m !== undefined) { const m = +el.dataset.m; inp.value = S.meshes[m].name; showHits(usesOf(m), S.meshes[m].name); return; }
    if (el.dataset.g !== undefined) { const k = el.dataset.g, set = new Set(); S.props.forEach((v, i) => { if (v === k) set.add(i); }); inp.value = pretty(k); showHits(set, pretty(k)); return; }
    const i = +el.dataset.i; showHits(new Set(), ''); reveal([i]); select(i); if (S.mode === '3d') V3.flyTo(i); else centerOn(i);
  };
  inp.oninput = run; inp.onfocus = run; inp.onblur = () => setTimeout(() => box.style.display = 'none', 150);
  inp.onkeydown = e => {
    const r = rows();
    if (e.key === 'Enter' && r.length) pick(r[cur]);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { cur = Math.max(0, Math.min(r.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1))); r.forEach((el, k) => el.classList.toggle('on', k === cur)); e.preventDefault(); }
    if (e.key === 'Escape') { inp.value = ''; showHits(new Set(), ''); run(); inp.blur(); }
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
const TEX = new Map(), FILES = new Map(), DL = { got: 0, total: 0, on: 0 };
function dlShow() { if (DL.on) progress(`Downloading 3D data ${(DL.got / 1e6).toFixed(1)} / ${(DL.total / 1e6).toFixed(1)} MB…`); }
function fetchFile(name, size) {
  if (!FILES.has(name)) FILES.set(name, (async () => {
    const r = await fetch('data/' + name); if (!r.ok) throw new Error(name + ' ' + r.status);
    DL.total += size; const parts = [], rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); DL.got += value.length; dlShow(); }
    const blob = new Blob(parts);
    return name.endsWith('.gz') ? new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : blob.arrayBuffer();
  })());
  return FILES.get(name);
}
function texture(id, r) {
  if (!TEX.has(id)) TEX.set(id, (async () => {
    const d = S.d, [c, off, len] = d.texLoc[id], [fn, size] = d.texFiles[c];
    const bmp = await createImageBitmap(new Blob([(await fetchFile(fn, size)).slice(off, off + len)], { type: 'image/webp' }));
    const t = new THREE.Texture(bmp); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = r.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
    return t;
  })());
  return TEX.get(id);
}
function useTexture(m, r) {
  const tid = m.userData.tid;
  V3.dirty = true; if (tid < 0 || !S.opt.textures) { m.map = null; m.color.set(m.userData.col); m.needsUpdate = true; return; }
  texture(tid, r).then(t => { if (!S.opt.textures) return; m.map = t; m.color.set(0xffffff); m.needsUpdate = true; V3.dirty = true; if (S.mode === '2d') draw2d(); }).catch(() => {});
}
const V3 = {
  ready: false, renderer: null, scene: null, cam: null, groups: [], markers: [], marker: null, mats: new Map(),
  yaw: 0, pitch: -0.3, speed: 2000, keys: new Set(),
  init() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); $('#c3d').appendChild(this.renderer.domElement);
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
  geometry(id, buf, off) {
    const m = S.meshes[id]; if (!m.v) return null;
    const q = new Uint16Array(buf, off, m.v * 3), pos = new Float32Array(m.v * 3);
    for (let i = 0; i < m.v; i++) for (let k = 0; k < 3; k++) pos[3 * i + k] = m.lo[k] + q[3 * i + k] / 65535 * (m.hi[k] - m.lo[k]);
    const uoff = off + ((m.v * 6 + 3) & ~3), qu = new Uint16Array(buf, uoff, m.v * 2), uv = new Float32Array(m.v * 2);
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
    DL.on++; dlShow();
    let bufs; try { bufs = await Promise.all(d.meshFiles.map(([fn, size]) => fetchFile(fn, size))); } finally { DL.on--; }
    for (const [fn, size] of d.texFiles) fetchFile(fn, size).catch(() => {});
    progress('Building the scene…');
    for (const [id, list] of by) {
      const m = S.meshes[id], loc = d.meshLoc[id]; if (!loc) continue; const g = this.geometry(id, bufs[loc[0]], loc[1]); if (!g) continue;
      const im = new THREE.InstancedMesh(g, m.groups.map(x => this.material(x[2], x[3])), list.length);
      list.forEach((pi, k) => im.setMatrixAt(k, ueMatrix(pi)));
      im.userData.placements = list; im.userData.r = Math.hypot(...m.hi.map((h, k) => (h - m.lo[k]) / 2)) * list.reduce((a, i) => Math.max(a, Math.abs(d.sx[i] || 1), Math.abs(d.sy[i] || 1), Math.abs(d.sz[i] || 1)), 0); im.computeBoundingSphere(); this.scene.add(im); this.groups.push(im);
    }
    const zs = Array.from(d.z).sort((a, b) => a - b), z0 = zs[Math.floor(zs.length * 0.05)] || 0, [x0, y0, x1, y1] = dist.bounds;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 40000, y1 - y0 + 40000), new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set((x0 + x1) / 2, z0 - 60, (y0 + y1) / 2); this.scene.add(ground); this.groups.push(ground);
    this.z0 = z0; this.ready = true; this.applyKinds(); this.buildMarkers(); this.missionSprites(); this.hitSprites();
    if (S.sel >= 0) this.flyTo(S.sel); else this.overview();
    progress(''); this.help();
  },
  icon(draw) { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; },
  points(list, h, tex, size, order) {
    const d = S.d, pos = new Float32Array(list.length * 3);
    list.forEach((i, k) => { pos[3 * k] = d.x[i]; pos[3 * k + 1] = d.z[i] + h; pos[3 * k + 2] = d.y[i]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, size, sizeAttenuation: false, transparent: true, alphaTest: 0.05, depthTest: false, depthWrite: false, fog: false }));
    p.renderOrder = order; p.frustumCulled = false; p.userData.list = list; p.userData.size = size; this.scene.add(p); return p;
  },
  drop(arr) { for (const p of arr || []) { this.scene.remove(p); p.geometry.dispose(); p.material.dispose(); } return []; },
  buildMarkers() {
    this.markers = this.drop(this.markers);
    if (!this.layerTex) this.layerTex = LAYERS.map(l => this.icon(g => g.drawImage(S.icons[l.id], 0, 0, 64, 64)));
    const per = LAYERS.map(() => []), d = S.d;
    for (let i = 0; i < d.x.length; i++) { const L = S.layerOf[i]; if (L >= 0 && !S.hid[i]) per[L].push(i); }
    per.forEach((list, L) => { if (!list.length) return; const p = this.points(list, LAYERS[L].small ? 120 : 250, this.layerTex[L], LAYERS[L].small ? 20 : 30, 10); p.userData.layer = L; this.markers.push(p); });
    this.applyMarkers();
  },
  applyMarkers() { for (const p of this.markers) p.visible = S.layerOn[p.userData.layer]; },
  hitSprites() {
    if (!this.scene) return;
    this.hsprites = this.drop(this.hsprites);
    if (!this.ready || !S.hits.size) return;
    if (!this.hitTex) this.hitTex = this.icon(g => { g.fillStyle = 'rgba(154,208,255,.35)'; g.strokeStyle = '#9ad0ff'; g.lineWidth = 7; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 7, 0, 7); g.fill(); });
    this.hsprites.push(this.points([...S.hits], 150, this.hitTex, 22, 11));
  },
  missionSprites() {
    if (!this.scene) return;
    this.msprites = this.drop(this.msprites);
    if (!this.ready || !M.cur) return;
    this.stageTex = this.stageTex || {}; const per = new Map();
    for (const [i, k] of missionPoints()) { if (!per.has(k)) per.set(k, []); per.get(k).push(i); }
    for (const [k, list] of per) {
      if (!this.stageTex[k]) this.stageTex[k] = this.icon(g => { g.fillStyle = STAGE_COLS[k % STAGE_COLS.length]; g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#111'; g.font = '800 30px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k + 1), 32, 34); });
      this.msprites.push(this.points(list, 180, this.stageTex[k], 26, 12));
    }
  },
  clear() { for (const o of this.groups) { this.scene.remove(o); o.geometry?.dispose(); } this.groups = []; this.markers = this.drop(this.markers); this.hsprites = this.drop(this.hsprites); this.msprites = this.drop(this.msprites); this.ready = false; },
  applyKinds() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const im of this.groups) { if (!im.isInstancedMesh) continue; im.userData.placements.forEach((pi, k) => im.setMatrixAt(k, S.on[S.d.kind[pi]] && !S.hid[pi] ? ueMatrix(pi) : zero)); im.instanceMatrix.needsUpdate = true; }
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
    const v = new THREE.Vector3(), d = S.d; let best = -1, bd = Infinity;
    for (const p of (this.msprites || []).concat(this.hsprites || [], this.markers)) {
      if (!p.visible) continue; const r2 = (p.userData.size / 2 + 3) ** 2;
      for (const i of p.userData.list) {
        v.set(d.x[i], d.z[i], d.y[i]).project(this.cam); if (v.z > 1) continue;
        const dd = ((v.x + 1) / 2 * innerWidth - e.clientX) ** 2 + ((1 - v.y) / 2 * innerHeight - e.clientY) ** 2; if (dd < r2 && dd < bd) { bd = dd; best = i; }
      }
    }
    if (best >= 0) return select(best);
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
    this.cam.lookAt(p.clone().add(fwd));
    const sig = [p.x, p.y, p.z, this.yaw, this.pitch].join();
    if (sig === this.sig && !this.dirty) return; this.sig = sig; this.dirty = false;
    this.cull(h / (innerHeight / 2 / Math.tan(Math.PI / 6))); this.renderer.render(this.scene, this.cam); this.drawMini();
  },
  cull(unitsPerPx) { for (const g of this.groups) if (g.isInstancedMesh) g.visible = g.userData.r > unitsPerPx * 4; },
  renderTop() {
    if (!this.ortho) { this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600000); this.ortho.up.set(0, 0, -1); }
    const o = this.ortho, hw = C2.W / 2 / C2.sc, hh = C2.H / 2 / C2.sc;
    o.left = -hw; o.right = hw; o.top = hh; o.bottom = -hh; o.updateProjectionMatrix();
    o.position.set(C2.cx, (this.z0 || 0) + 300000, C2.cy); o.lookAt(C2.cx, this.z0 || 0, C2.cy);
    const fog = this.scene.fog, vis = this.markers.concat(this.msprites || [], this.hsprites || [], [this.marker]).map(s => [s, s.visible]);
    this.scene.fog = null; vis.forEach(([s]) => s.visible = false);
    this.cull(1 / C2.sc / Math.min(devicePixelRatio, 1.5)); this.renderer.render(this.scene, o); this.dirty = true;
    this.scene.fog = fog; vis.forEach(([s, v]) => s.visible = v);
  },
  miniBox() { const [x0, y0, x1, y1] = bounds(), s = Math.max(x1 - x0, y1 - y0); return [(x0 + x1) / 2 - s / 2, (y0 + y1) / 2 - s / 2, s]; },
  miniToWorld(fx, fy) { const [bx, by, s] = this.miniBox(); return [bx + fx * s, by + fy * s]; },
  drawMini() {
    const cv = $('#mini canvas'), g = cv.getContext('2d'), W = cv.width, [bx, by, s] = this.miniBox(), sc = W / s, key = S.name + S.on.join() + S.layerOn.join() + S.season + S.groupOn.join() + M.ver + '|' + S.hits.size + (S.hitLabel || '');
    if (this._miniKey !== key) {
      const tr = i => [(S.d.x[i] - bx) * sc, (S.d.y[i] - by) * sc]; drawScenery(g, W, W, tr, true);
      for (const [, x, y, L] of visibleMarkers(W, W, tr)) { g.fillStyle = LAYERS[L].col; g.beginPath(); g.arc(x, y, LAYERS[L].small ? 2 : 4, 0, 7); g.fill(); }
      for (const [i, k] of missionPoints()) { const [x, y] = tr(i); g.fillStyle = STAGE_COLS[k % STAGE_COLS.length]; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
      for (const i of S.hits) { const [x, y] = tr(i); g.fillStyle = '#9ad0ff'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
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
  if (m === '2d') { resize2d(); imagery(); return; }
  V3.init(); V3.resize();
  try { if (!V3.ready || V3.builtFor !== S.name) { await V3.build(); V3.builtFor = S.name; } } catch (e) { progress(''); status('3D failed: ' + e.message); return; }
  if (focus !== undefined) V3.flyTo(focus);
}
for (const k of ['applyKinds', 'applyMarkers', 'hitSprites', 'missionSprites', 'mark', 'resize', 'build', 'applyTextures', 'flyTo', 'overview', 'top']) { const f = V3[k]; V3[k] = function (...a) { const r = f.apply(this, a); this.dirty = true; if (r && r.then) r.then(() => this.dirty = true); return r; }; }
window.addEventListener('resize', () => { if (V3.renderer) V3.resize(); if (S.mode === '2d') { resize2d(); draw2d(); } });
const API = 'https://api.apbdb.com/beacon/';
const FACTION_ID = { 1: 'Enforcer', 2: 'Criminal', 3: 'Both' };
const STAGE_COLS = ['#f2a33a', '#5aa9e6', '#7bd389', '#ff6f91', '#c38fff', '#4fd1c5', '#f7e26b', '#ff8a5c', '#9ad0ff', '#d4a5ff'];
const M = { list: null, districts: null, cur: null, on: [], match: [], contacts: [], ver: 0, filter: '' };
async function cachedJSON(url, key) {
  try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c) return c; } catch { }
  const j = await getJSON(url); try { sessionStorage.setItem(key, JSON.stringify(j)); } catch { } return j;
}
function targetTypes() { S.tt = S.d.x.map((_, i) => info(i).eTaskTargetType || ''); }
function briefHTML(t) { return esc(t || '').replace(/&lt;Col:[^&]*&gt;(.*?)&lt;\/Col&gt;/g, '<b>$1</b>').replace(/\r?\n/g, '<br>'); }
function districtOf(eDistrict) {
  const d = (M.districts || []).find(x => +x.id === +eDistrict); if (!d) return null;
  const dm = String(d.sDistrictMap || '').toLowerCase().replace(/_master$/, ''), names = S.index.districts.map(x => x.name);
  return names.find(n => n.toLowerCase() === dm) || names.find(n => dm.includes(n.toLowerCase().replace(/district$/, ''))) || null;
}
function stageMatches(st) {
  const t = st.eTargetAllocation && st.eTargetAllocation.eTaskTargetType; if (!t || typeof t !== 'object') return [];
  const row = t.sAPBDB || '', id = '#' + t.id, out = [];
  for (let i = 0; i < S.tt.length; i++) { const v = S.tt[i]; if (v && (v === row || v === id || (v[0] !== '#' && row.startsWith(v + '_')))) out.push(i); }
  return out;
}
function missionMatches() {
  if (!M.cur) { M.match = []; M.contacts = []; return; }
  M.match = M.cur.aStages.map(stageMatches);
  const rows = new Set((M.cur.aContacts || []).map(c => c.eContact && c.eContact.sAPBDB).filter(Boolean));
  M.contacts = []; for (let i = 0; i < S.d.x.length; i++) if (rows.has(info(i).eContact)) M.contacts.push(i);
  M.ver++;
}
async function openMissions() {
  document.body.classList.add('mopen');
  if (M.list) return;
  $('#mitems').innerHTML = '<p class="dim">Loading missions from APBDB…</p>';
  try {
    const [list, dists] = await Promise.all([cachedJSON(API + 'missions', 'apbdb-missions'), cachedJSON(API + 'districts', 'apbdb-districts')]);
    M.list = list.missions.filter(m => m.bTest !== '1' && m.bDisabled !== '1').sort((a, b) => a.sMissionTitle.localeCompare(b.sMissionTitle)); M.districts = dists; drawMissionList();
  } catch (e) { $('#mitems').innerHTML = `<p class="bad">Could not reach APBDB: ${esc(e.message)}</p>`; }
}
function drawMissionList() {
  const q = $('#mq').value.trim().toLowerCase(), f = M.filter;
  const items = M.list.filter(m => (!f || String(m.eFaction) === f) && (!q || m.sMissionTitle.toLowerCase().includes(q) || m.sAPBDB.toLowerCase().includes(q)));
  $('#mcount').textContent = `${items.length} / ${M.list.length}`;
  $('#mitems').innerHTML = items.map(m => `<div class="mi" data-k="${esc(m.sAPBDB)}"><span class="fac f${m.eFaction}">${FACTION_ID[m.eFaction] || '?'}</span><span class="t">${esc(m.sMissionTitle)}</span><small>${m.nStages} stages</small></div>`).join('') || '<p class="dim">No missions match.</p>';
  $('#mitems').querySelectorAll('.mi').forEach(el => el.onclick = () => selectMission(el.dataset.k));
}
async function selectMission(key) {
  $('#mlist').style.display = 'none'; const v = $('#mview'); v.style.display = 'block'; v.innerHTML = '<p class="dim">Loading mission…</p>';
  try { M.cur = await cachedJSON(API + 'missions/' + encodeURIComponent(key), 'apbdb-mission-' + key); } catch (e) { v.innerHTML = `<p class="bad">${esc(e.message)}</p>`; return; }
  M.on = M.cur.aStages.map((_, k) => k === 0); missionMatches(); drawMission(); refreshMission();
}
function drawMission() {
  const m = M.cur, v = $('#mview'), r = m.eRewardPackage || {};
  const contacts = (m.aContacts || []).map(c => c.eContact).filter(c => c && typeof c === 'object');
  const homes = [...new Set(contacts.map(c => districtOf(c.eDistrict)).filter(Boolean))];
  const here = homes.includes(S.name);
  v.innerHTML = `<div class="mhead"><a href="#" id="mback" class="hint">← All missions</a><div class="t">${esc(m.sMissionTitle)}</div>
    <div class="meta"><span class="fac f${m.eFaction}">${FACTION_ID[m.eFaction] || '?'}</span><span class="tag">Group ${m.nGroupSizeMin}–${m.nGroupSizeMax}</span>
      ${+m.nTakeoutCount ? `<span class="tag">${m.nTakeoutCount} takeouts to win</span>` : ''}${r.nBaseCash_0 ? `<span class="tag">$${(+r.nBaseCash_0).toLocaleString()}–${(+r.nBaseCash_1).toLocaleString()}</span>` : ''}
      ${r.nBaseContactStanding_0 ? `<span class="tag">Standing ${r.nBaseContactStanding_0}–${r.nBaseContactStanding_1}</span>` : ''}</div>
    <div class="kv" style="font-size:12.5px">Contacts: ${contacts.map(c => esc(c.sTitle)).join(', ') || '–'}${M.contacts.length ? ` · <a href="#" id="mcontact">show on map</a>` : ''}</div>
    ${homes.length && !here ? `<p class="hint">Plays in ${homes.map(h => `<a href="#" data-go="${h}">${h.replace(/District$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')}</a>`).join(', ')}: switch district to see its target spots.</p>` : ''}</div>
    ${m.aStages.map((st, k) => { const op = st.eOperation || {}, t = st.eTargetAllocation && st.eTargetAllocation.eTaskTargetType, c = STAGE_COLS[k % STAGE_COLS.length];
      const reqs = [st.nTargetsRequired > 0 && `${st.nTargetsRequired} target(s)`, st.nTaskItemsRequired > 0 && `${st.nTaskItemsRequired} item(s)`, st.nVehiclesRequired > 0 && `${st.nVehiclesRequired} vehicle(s)`, st.nTimeLimit > 0 && `${Math.round(st.nTimeLimit / 60)} min limit`, +st.bIsOpposition && 'opposition stage', +st.bIsConcurrent && 'concurrent'].filter(Boolean);
      return `<div class="stage" style="--sc:${c}"><div class="sh"><span class="num">${k + 1}</span>${esc(op.sUIDescription || 'Stage')}<span class="switch ${M.on[k] ? 'on' : ''}" data-s="${k}"></span></div>
        <p>${briefHTML(st.sOwnerBrief !== 'None' ? st.sOwnerBrief : '') || '<span class="dim">No brief</span>'}</p>
        ${st.sDispatchBrief && st.sDispatchBrief !== 'None' ? `<p class="dim" style="font-size:12px">Opposition: ${briefHTML(st.sDispatchBrief)}</p>` : ''}
        <div class="kv">${t && typeof t === 'object' ? `Target: <b style="color:var(--text)">${esc(t.sDisplayName && t.sDisplayName !== 'None' ? t.sDisplayName : t.sAPBDB)}</b> · ` : ''}${M.match[k].length} possible spot(s) here${reqs.length ? ' · ' + reqs.join(' · ') : ''}</div></div>`; }).join('')}
    <div style="display:flex;gap:8px;margin-top:10px"><button id="mfit">Show all spots</button><button id="mclear">Clear mission</button></div>`;
  $('#mback').onclick = e => { e.preventDefault(); $('#mview').style.display = 'none'; $('#mlist').style.display = 'block'; };
  v.querySelectorAll('[data-s]').forEach(sw => sw.onclick = () => { const k = +sw.dataset.s; M.on[k] = !M.on[k]; sw.classList.toggle('on', M.on[k]); M.ver++; refreshMission(); });
  v.querySelectorAll('[data-go]').forEach(a => a.onclick = async e => { e.preventDefault(); $('#district').value = a.dataset.go; await loadDistrict(a.dataset.go); });
  const mc = $('#mcontact'); if (mc) mc.onclick = e => { e.preventDefault(); const i = M.contacts[0]; select(i); if (S.mode === '3d') V3.flyTo(i); else centerOn(i); };
  $('#mfit').onclick = () => fitMission(); $('#mclear').onclick = () => { M.cur = null; missionMatches(); refreshMission(); $('#mview').style.display = 'none'; $('#mlist').style.display = 'block'; };
}
function missionPoints() { const out = []; if (!M.cur) return out; M.match.forEach((list, k) => { if (M.on[k]) for (const i of list) out.push([i, k]); }); return out; }
function fitMission() {
  const pts = missionPoints(); if (!pts.length) return; const d = S.d;
  let x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12; for (const [i] of pts) { x0 = Math.min(x0, d.x[i]); x1 = Math.max(x1, d.x[i]); y0 = Math.min(y0, d.y[i]); y1 = Math.max(y1, d.y[i]); }
  if (S.mode === '3d') { V3.cam.position.set((x0 + x1) / 2, (V3.z0 || 0) + Math.max(x1 - x0, y1 - y0) * 0.8 + 4000, (y0 + y1) / 2 + 2000); V3.yaw = 0; V3.pitch = -1.2; return; }
  C2.cx = (x0 + x1) / 2; C2.cy = (y0 + y1) / 2; C2.sc = Math.min(C2.W / Math.max(x1 - x0, 1000), C2.H / Math.max(y1 - y0, 1000)) * 0.8; draw2d();
}
function refreshMission() { draw2d(); V3.missionSprites(); }
function drawMission2d(g, tr, W, H) {
  if (!M.cur) return;
  g.lineWidth = 3; g.font = '800 10px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [i, k] of missionPoints()) {
    const [x, y] = tr(i); if (x < -12 || y < -12 || x > W + 12 || y > H + 12) continue; const c = STAGE_COLS[k % STAGE_COLS.length];
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#111'; g.fillText(String(k + 1), x, y + 0.5);
  }
  for (const i of M.contacts) { const [x, y] = tr(i); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 16, 0, 7); g.stroke(); }
  g.textAlign = 'start';
}
$('#mbtn').onclick = () => document.body.classList.contains('mopen') ? document.body.classList.remove('mopen') : openMissions();
$('#mx').onclick = () => document.body.classList.remove('mopen');
$('#mq').oninput = () => M.list && drawMissionList();
document.querySelectorAll('#mfac button').forEach(b => b.onclick = () => { M.filter = b.dataset.f; document.querySelectorAll('#mfac button').forEach(x => x.classList.toggle('on', x === b)); if (M.list) drawMissionList(); });
window.APB = { S, V3, C2 };
init().catch(e => { progress(''); status('failed: ' + e.message); });
