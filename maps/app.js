import * as THREE from 'three';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); };

const S = { index: null, meshes: null, d: null, name: '', on: [], mode: '2d', hits: new Set(), sel: -1, chunks: {} };

async function init() {
  S.index = await getJSON('data/index.json');
  const sel = $('#district');
  S.index.districts.filter(d => d.placements > 0).forEach(d => sel.add(new Option(`${d.name} (${d.placements.toLocaleString()})`, d.name)));
  const want = new URLSearchParams(location.hash.slice(1)).get('district');
  sel.value = S.index.districts.some(d => d.name === want) ? want : (S.index.districts.find(d => d.name.startsWith('Waterfront')) || S.index.districts[0]).name;
  sel.onchange = () => loadDistrict(sel.value);
  document.querySelectorAll('.modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $('#search').onkeydown = e => { if (e.key === 'Enter') search($('#search').value); };
  await loadDistrict(sel.value);
}

async function loadDistrict(name) {
  status('loading ' + name + '…');
  S.d = await getJSON('data/' + S.index.districts.find(d => d.name === name).file); S.name = name; S.hits = new Set(); S.sel = -1;
  history.replaceState(null, '', '#district=' + encodeURIComponent(name));
  const n = S.d.x.length, counts = S.index.kinds.map(() => 0); S.d.kind.forEach(k => counts[k]++);
  S.on = S.index.kinds.map(() => true);
  $('#kinds').innerHTML = S.index.kinds.map((k, i) => counts[i] ? `<label><input type="checkbox" data-k="${i}" checked><span class="swatch" style="background:${S.index.colours[i]}"></span>${esc(k)} <span class="dim">${counts[i].toLocaleString()}</span></label>` : '').join('<br>');
  $('#kinds').querySelectorAll('input').forEach(c => c.onchange = () => { S.on[+c.dataset.k] = c.checked; draw2d(); if (V3.ready) V3.applyKinds(); });
  $('#detail').innerHTML = '<span class="dim">Click an object for its details.</span>';
  fit2d(); draw2d(); status(`${n.toLocaleString()} placements`);
  if (S.mode === '3d') { await V3.build(); V3.builtFor = name; }
}

function status(t) { $('#status').textContent = t; }
function progress(t) { const p = $('#progress'); p.style.display = t ? 'block' : 'none'; p.textContent = t || ''; }

const C2 = { cx: 0, cy: 0, sc: 1, W: 0, H: 0 };
const cv2 = $('#c2d');
function resize2d() { const r = $('#stage').getBoundingClientRect(); C2.W = cv2.width = r.width; C2.H = cv2.height = r.height; }
function fit2d() {
  resize2d(); const [x0, y0, x1, y1] = S.index.districts.find(d => d.name === S.name).bounds;
  C2.cx = (x0 + x1) / 2; C2.cy = (y0 + y1) / 2; C2.sc = Math.min(C2.W / Math.max(x1 - x0, 1), C2.H / Math.max(y1 - y0, 1)) * 0.92;
}
const sxy = i => [(S.d.x[i] - C2.cx) * C2.sc + C2.W / 2, (S.d.y[i] - C2.cy) * C2.sc + C2.H / 2];
function drawPoints(g, W, H, tr, small) {
  const d = S.d, n = d.x.length, beacon = S.index.kinds.indexOf('Beacon');
  g.fillStyle = '#111318'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    const k = d.kind[i]; if (!S.on[k] || k === beacon) continue;
    const [x, y] = tr(i); if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
    g.fillStyle = S.index.colours[k]; g.fillRect(x - 1, y - 1, small ? 1 : 2, small ? 1 : 2);
  }
  g.font = '12px sans-serif';
  for (let i = 0; i < n; i++) {
    if (d.kind[i] !== beacon || !S.on[beacon]) continue; const [x, y] = tr(i);
    g.fillStyle = S.index.colours[beacon]; g.beginPath(); g.arc(x, y, small ? 2 : 4, 0, 7); g.fill();
    if (!small && d.labels[i]) { g.fillStyle = '#ffd0d0'; g.fillText(d.labels[i], x + 6, y - 6); }
  }
}
function draw2d() {
  if (S.mode !== '2d' || !S.d) return;
  const g = cv2.getContext('2d'); drawPoints(g, C2.W, C2.H, sxy, false);
  for (const i of S.hits) { const [x, y] = sxy(i); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x - 5, y - 5, 10, 10); }
  if (S.sel >= 0) { const [x, y] = sxy(S.sel); g.strokeStyle = '#f2a33a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); }
  g.fillStyle = '#888'; g.fillText(`1 px = ${(1 / C2.sc).toFixed(1)} units`, 8, C2.H - 8);
}
function nearest(mx, my, r = 7) {
  let best = -1, bd = r * r; const d = S.d;
  for (let i = 0; i < d.x.length; i++) { if (!S.on[d.kind[i]]) continue; const [x, y] = sxy(i), dd = (x - mx) ** 2 + (y - my) ** 2; if (dd < bd) { bd = dd; best = i; } }
  return best;
}
let drag = null, moved = false;
cv2.onmousedown = e => { drag = [e.offsetX, e.offsetY, C2.cx, C2.cy]; moved = false; };
window.addEventListener('mouseup', () => drag = null);
cv2.onmousemove = e => {
  const tip = $('#tip');
  if (drag) { const dx = e.offsetX - drag[0], dy = e.offsetY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; C2.cx = drag[2] - dx / C2.sc; C2.cy = drag[3] - dy / C2.sc; draw2d(); return; }
  const i = nearest(e.offsetX, e.offsetY); if (i < 0) { tip.style.display = 'none'; return; }
  tip.style.display = 'block'; tip.style.left = e.offsetX + 12 + 'px'; tip.style.top = e.offsetY + 12 + 'px';
  tip.textContent = `${S.d.classes[S.d.cls[i]]}${S.d.labels[i] ? ' · ' + S.d.labels[i] : ''}`;
};
cv2.onmouseleave = () => $('#tip').style.display = 'none';
cv2.onwheel = e => { e.preventDefault(); const f = e.deltaY < 0 ? 1.25 : 0.8, wx = (e.offsetX - C2.W / 2) / C2.sc + C2.cx, wy = (e.offsetY - C2.H / 2) / C2.sc + C2.cy; C2.sc *= f; C2.cx = wx - (e.offsetX - C2.W / 2) / C2.sc; C2.cy = wy - (e.offsetY - C2.H / 2) / C2.sc; draw2d(); };
cv2.onclick = e => { if (moved) return; const i = nearest(e.offsetX, e.offsetY); if (i >= 0) select(i); };
cv2.ondblclick = e => { const i = nearest(e.offsetX, e.offsetY); if (i >= 0) { select(i); setMode('3d', i); } };

function select(i) {
  S.sel = i; draw2d(); const d = S.d; if (V3.ready) V3.mark(i);
  const mesh = d.mesh[i] >= 0 ? S.meshes?.[d.mesh[i]]?.name || '#' + d.mesh[i] : '';
  const rows = [['class', d.classes[d.cls[i]]], ['name', d.name[i]], ['label', d.labels[i] || ''], ['map', d.maps[d.map[i]]],
    ['x / y / z', `${d.x[i]} / ${d.y[i]} / ${d.z[i]}`], ['pitch / yaw / roll', `${d.pitch[i]} / ${d.yaw[i]} / ${d.roll[i]}`],
    ['scale', `${d.sx[i]} / ${d.sy[i]} / ${d.sz[i]}`], ['mesh', mesh]].filter(r => r[1] !== '');
  $('#detail').innerHTML = `<h3>${esc(d.classes[d.cls[i]])}</h3><table class="grid">${rows.map(r => `<tr><td class="dim">${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>
    <div style="margin-top:6px"><button id="go3d">View in 3D</button></div>`;
  $('#go3d').onclick = () => setMode('3d', i);
}
function search(q) {
  q = q.toLowerCase(); const d = S.d; S.hits = new Set();
  if (q) for (let i = 0; i < d.x.length && S.hits.size < 500; i++)
    if (d.name[i].toLowerCase().includes(q) || (d.labels[i] || '').toLowerCase().includes(q) || d.classes[d.cls[i]].toLowerCase().includes(q)) S.hits.add(i);
  const first = S.hits.values().next().value;
  if (first !== undefined) { C2.cx = d.x[first]; C2.cy = d.y[first]; C2.sc = Math.max(C2.sc, 0.05); select(first); if (S.mode === '3d') V3.flyTo(first); }
  status(`${S.hits.size}${S.hits.size >= 500 ? '+' : ''} match(es)`); draw2d();
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
const V3 = {
  ready: false, renderer: null, scene: null, cam: null, groups: [], byPlacement: new Map(), marker: null,
  yaw: 0, pitch: -0.3, speed: 2000, keys: new Set(),
  init() {
    if (this.renderer) return;
    const host = $('#c3d'); this.renderer = new THREE.WebGLRenderer({ antialias: true }); host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x9fb4c8); this.scene.fog = new THREE.Fog(0x9fb4c8, 20000, 120000);
    this.cam = new THREE.PerspectiveCamera(60, 1, 20, 400000);
    this.scene.add(new THREE.HemisphereLight(0xdde6f0, 0x4a4438, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(0.4, 1, 0.3); this.scene.add(sun);
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(150, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf2a33a, wireframe: true })); this.marker.visible = false; this.scene.add(this.marker);
    const el = this.renderer.domElement; let dragging = null, mv = false;
    el.addEventListener('mousedown', e => { dragging = [e.clientX, e.clientY]; mv = false; });
    window.addEventListener('mouseup', () => dragging = null);
    el.addEventListener('mousemove', e => {
      if (!dragging) return; const dx = e.clientX - dragging[0], dy = e.clientY - dragging[1]; if (Math.abs(dx) + Math.abs(dy) > 2) mv = true;
      dragging = [e.clientX, e.clientY]; this.yaw -= dx * 0.004; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.004));
    });
    el.addEventListener('click', e => { if (!mv) this.pick(e); });
    el.addEventListener('wheel', e => { e.preventDefault(); this.speed = Math.max(100, Math.min(50000, this.speed * (e.deltaY < 0 ? 1.25 : 0.8))); this.help(); });
    window.addEventListener('keydown', e => { if (S.mode === '3d' && document.activeElement.tagName !== 'INPUT') { this.keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    $('#mini').onclick = e => { const [x, y] = this.miniToWorld(e.offsetX, e.offsetY); this.cam.position.x = x; this.cam.position.z = y; };
    let last = performance.now();
    const loop = t => { const dt = Math.min(0.1, (t - last) / 1000); last = t; if (S.mode === '3d') this.frame(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  help() { const h = $('#help'); h.style.display = S.mode === '3d' ? 'block' : 'none'; h.textContent = `speed ${Math.round(this.speed)} units/s · WASD/arrows move · Q/E down/up · Shift ×4 · drag to look`; },
  resize() { const r = $('#stage').getBoundingClientRect(); this.renderer.setSize(r.width, r.height); this.cam.aspect = r.width / r.height; this.cam.updateProjectionMatrix(); },
  async chunk(n) {
    if (!S.chunks[n]) S.chunks[n] = fetch(`data/meshes_${n}.bin`).then(r => { if (!r.ok) throw new Error('meshes_' + n + '.bin ' + r.status); return r.arrayBuffer(); });
    return S.chunks[n];
  },
  geometry(id, buf) {
    const m = S.meshes[id]; if (!m.v) return null;
    const q = new Uint16Array(buf, m.off, m.v * 3), pos = new Float32Array(m.v * 3);
    for (let i = 0; i < m.v; i++) for (let k = 0; k < 3; k++) pos[3 * i + k] = m.lo[k] + q[3 * i + k] / 65535 * (m.hi[k] - m.lo[k]);
    const ioff = m.off + ((m.v * 6 + 3) & ~3), idx = m.i32 ? new Uint32Array(buf, ioff, m.i) : new Uint16Array(buf, ioff, m.i);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
    m.groups.forEach(([s, c], k) => g.addGroup(s, c, k)); return g;
  },
  async build() {
    this.init(); this.clear();
    if (!S.meshes) { progress('loading mesh index…'); S.meshes = await getJSON('data/meshes.json'); }
    const dist = S.index.districts.find(d => d.name === S.name), d = S.d, by = new Map();
    for (let i = 0; i < d.x.length; i++) if (d.mesh[i] >= 0) { if (!by.has(d.mesh[i])) by.set(d.mesh[i], []); by.get(d.mesh[i]).push(i); }
    let done = 0;
    for (const n of dist.chunks) { progress(`downloading 3D data ${++done}/${dist.chunks.length}…`); await this.chunk(n); }
    progress('building scene…'); const mats = new Map();
    const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0, flatShading: true, side: THREE.DoubleSide })); return mats.get(c); };
    for (const [id, list] of by) {
      const m = S.meshes[id], g = this.geometry(id, await this.chunk(m.chunk)); if (!g) continue;
      const im = new THREE.InstancedMesh(g, m.groups.map(x => mat(x[2])), list.length);
      list.forEach((pi, k) => { im.setMatrixAt(k, ueMatrix(pi)); this.byPlacement.set(pi, [im, k]); });
      im.userData.placements = list; im.computeBoundingSphere(); this.scene.add(im); this.groups.push(im);
    }
    const zs = Array.from(d.z).sort((a, b) => a - b), z0 = zs[Math.floor(zs.length * 0.05)] || 0, [x0, y0, x1, y1] = dist.bounds;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 40000, y1 - y0 + 40000), new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set((x0 + x1) / 2, z0 - 50, (y0 + y1) / 2); this.scene.add(ground); this.groups.push(ground);
    this.ready = true; this.applyKinds();
    this.z0 = z0;
    if (S.sel >= 0) this.flyTo(S.sel); else this.overview();
    progress(''); status(`${d.x.length.toLocaleString()} placements · ${this.byPlacement.size.toLocaleString()} meshes in 3D`); this.help();
  },
  clear() { for (const o of this.groups) { this.scene.remove(o); o.geometry?.dispose(); } this.groups = []; this.byPlacement.clear(); this.ready = false; },
  applyKinds() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const im of this.groups) {
      if (!im.isInstancedMesh) continue;
      im.userData.placements.forEach((pi, k) => im.setMatrixAt(k, S.on[S.d.kind[pi]] ? ueMatrix(pi) : zero)); im.instanceMatrix.needsUpdate = true;
    }
  },
  flyTo(i) { const d = S.d; this.cam.position.set(d.x[i] - 5000, d.z[i] + 6000, d.y[i] + 5000); this.lookAt(d.x[i], d.z[i], d.y[i]); this.mark(i); },
  overview() {
    const [x0, y0, x1, y1] = S.index.districts.find(d => d.name === S.name).bounds, s = Math.max(x1 - x0, y1 - y0);
    this.cam.position.set((x0 + x1) / 2, (this.z0 || 0) + s * 0.35, (y0 + y1) / 2 + s * 0.45); this.yaw = 0; this.pitch = -0.6;
  },
  top() {
    const [x0, y0, x1, y1] = S.index.districts.find(d => d.name === S.name).bounds, s = Math.max(x1 - x0, y1 - y0), p = this.cam.position, z0 = this.z0 || 0;
    let tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
    const fy = Math.sin(this.pitch);
    if (fy < -0.05) { const t = (p.y - z0) / -fy; tx = p.x - Math.sin(this.yaw) * Math.cos(this.pitch) * t; ty = p.z - Math.cos(this.yaw) * Math.cos(this.pitch) * t; }
    p.set(Math.min(x1, Math.max(x0, tx)), z0 + Math.min(s * 0.35, Math.max(8000, p.y - z0)), Math.min(y1, Math.max(y0, ty)));
    this.yaw = 0; this.pitch = -Math.PI / 2 + 1e-4;
  },
  lookAt(x, y, z) { const p = this.cam.position, dx = x - p.x, dy = y - p.y, dz = z - p.z; this.yaw = Math.atan2(-dx, -dz); this.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  mark(i) { if (!this.marker) return; const d = S.d; this.marker.position.set(d.x[i], d.z[i], d.y[i]); this.marker.visible = true; },
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.cam);
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
  miniBox() { const [x0, y0, x1, y1] = S.index.districts.find(d => d.name === S.name).bounds, s = Math.max(x1 - x0, y1 - y0); return [(x0 + x1) / 2 - s / 2, (y0 + y1) / 2 - s / 2, s]; },
  miniToWorld(mx, my) { const [bx, by, s] = this.miniBox(); return [bx + mx / 260 * s, by + my / 260 * s]; },
  drawMini() {
    const cv = $('#mini'), g = cv.getContext('2d'), [bx, by, s] = this.miniBox(), sc = 260 / s;
    if (!this._miniImg || this._miniKey !== S.name + S.on.join()) {
      drawPoints(g, 260, 260, i => [(S.d.x[i] - bx) * sc, (S.d.y[i] - by) * sc], true); this._miniImg = g.getImageData(0, 0, 260, 260); this._miniKey = S.name + S.on.join();
    } else g.putImageData(this._miniImg, 0, 0);
    const p = this.cam.position, x = (p.x - bx) * sc, y = (p.z - by) * sc;
    const a = Math.atan2(-Math.cos(this.yaw), -Math.sin(this.yaw)), h = 0.45;
    g.fillStyle = '#f2a33a55'; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 34, a - h, a + h); g.closePath(); g.fill();
    g.fillStyle = '#f2a33a'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.stroke();
  },
};

async function setMode(m, focus) {
  S.mode = m; document.querySelectorAll('.modes button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  $('#c2d').style.display = m === '2d' ? 'block' : 'none'; $('#c3d').style.display = m === '3d' ? 'block' : 'none'; $('#mini').style.display = m === '3d' ? 'block' : 'none';
  $('#tip').style.display = 'none'; $('#v3btns').style.display = m === '3d' ? 'inline' : 'none'; V3.help?.();
  if (m === '2d') { resize2d(); draw2d(); return; }
  V3.init(); V3.resize();
  try { if (!V3.ready || V3.builtFor !== S.name) { await V3.build(); V3.builtFor = S.name; } } catch (e) { progress(''); status('3D failed: ' + e.message); return; }
  if (focus !== undefined) V3.flyTo(focus);
}
window.addEventListener('resize', () => { if (S.mode === '2d') { resize2d(); draw2d(); } else V3.resize(); });
$('#btop').onclick = () => V3.top(); $('#bover').onclick = () => V3.overview();
window.APB = { S, V3 };
init().catch(e => status("failed: " + e.message));
