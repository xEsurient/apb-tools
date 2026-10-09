const $ = (s) => document.querySelector(s);
const PAGE = 300;
const store = (k, v) => (v === undefined ? JSON.parse(localStorage.getItem('apbimg.' + k) ?? 'null') : localStorage.setItem('apbimg.' + k, JSON.stringify(v)));

const cat = await (await fetch('data/catalog.json')).json();
const IMGIDX = fetch('data/img_index.json').then((r) => r.json()), IMGBUF = {}, IMGURL = new Map();
async function imgUrl(pkg, i) {
  const key = pkg + '/' + i;
  if (!IMGURL.has(key)) IMGURL.set(key, (async () => {
    const e = (await IMGIDX)[key]; if (!e) return '';
    const [k, off, len] = e;
    if (!IMGBUF[k]) IMGBUF[k] = fetch(`data/img_${k}.bin`).then((r) => r.arrayBuffer());
    return URL.createObjectURL(new Blob([(await IMGBUF[k]).slice(off, off + len)], { type: 'image/webp' }));
  })());
  return IMGURL.get(key);
}
const A = cat.atlas;

const images = [];
for (const [pkg, rows] of Object.entries(cat.packages))
  rows.forEach((r, i) => images.push({ kind: 'img', pkg, i, path: pkg + '.' + r[0], cls: r[1], w: r[2], h: r[3], has: r[4], from: r[5] }));
const imgAt = (pkg, i) => images.find((x) => x.pkg === pkg && x.i === i);
const hudtex = cat.hudtex.map(([name, src, ref, how]) => ({ kind: 'tex', name, src, img: ref ? imgAt(ref[0], ref[1]) : null, how, group: name.split('_')[0] }));
const hudicon = cat.hudicon.map(([name, cells, changed]) => ({ kind: 'icon', name, cells, changed }));
const cells = cat.cells.map(([r, c, names, changed]) => ({ kind: 'cell', name: `r${r} c${c}`, cells: [[r, c]], names, changed }));
const PICTURE_GUESSES = [
  ['Tagger_Valentines', 4, 1], ['Tagger_Duck', 4, 2], ['Tagger_Rapid99', 4, 4], ['Tagger_Sluttles', 4, 5], ['Tagger_Reaper', 4, 6],
  ['Tagger_PurpleCat', 4, 7], ['Tagger_Cat', 4, 8], ['Tagger_Suit_Spades', 5, 1], ['Tagger_Suit_Hearts', 5, 2], ['Tagger_Suit_Diamond', 5, 3],
  ['Tagger_Suit_Clubs', 5, 4], ['Tagger_Suit_Joker', 5, 5], ['Minigame_SnowballFight', 5, 15], ['Faction_Criminal_OpenConflict', 24, 1],
  ['Faction_Enforcer_OpenConflict', 24, 2], ['Minigame_Infection_Pumpkin', 24, 4], ['Mugging_Easter2015_Bunny', 24, 6],
  ['Mugging_Easter2015_Chicken', 24, 7], ['Minigame_Anarchy', 24, 11], ['Minigame_Anarchy_Provocateur', 24, 12],
];
for (const [name, r, c] of PICTURE_GUESSES) {
  const ic = hudicon.find((x) => x.name === name), cell = cells.find((x) => x.cells[0][0] === r && x.cells[0][1] === c);
  if (ic && !ic.cells.length) { ic.cells = [[r, c]]; ic.guessed = true; }
  if (cell && !cell.names.length) { cell.names = [name]; cell.guessed = true; }
}
let tintEl = null;
function applyTint() {
  if (!tintEl) {
    tintEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tintEl.setAttribute('width', 0); tintEl.setAttribute('height', 0); tintEl.style.position = 'absolute';
    tintEl.innerHTML = '<filter id="apbtint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter>';
    document.body.append(tintEl);
    const css = document.createElement('style');
    css.textContent = 'body.tinted .pic img, body.tinted .pic .sprite, body.tinted #dprev img, body.tinted #dprev .sprite { filter: url(#apbtint); }';
    document.head.append(css);
  }
  const h = opt.colour, [r, g, b] = [1, 3, 5].map((o) => parseInt(h.substr(o, 2), 16) / 255), a = Math.max(0, Math.min(1, +opt.alpha || 0));
  tintEl.querySelector('feColorMatrix').setAttribute('values', `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 ${a} 0`);
  const ui = !st.sel || st.sel.kind === 'img' || opt.target === 'ui';
  document.body.classList.toggle('tinted', !!opt.tint && ui);
}
for (const x of images) x.group = x.pkg, x.name = x.path;

const TABS = {
  images: { list: images, groups: true, info: 'Textures and materials of the UI packages, used as <Images:Package.Group.Name>. Works in UI text files (APBUserInterface, item types, HudGroupStates…), not in HUD message files.' },
  hudtex: { list: hudtex, groups: true, info: 'Named HUD textures (short names for UI package textures). Use <APB_Images:…;HUDTexture=TRUE> in UI text files or <hudtexture:…> in HUD message files (HUDMessages, TaskObjectives, PopupDialogs…). Names marked "guessed" or without a picture come from newer name lists; check them in game.' },
  hudicon: { list: hudicon, groups: false, info: 'Named HUD icons, drawn from layers of the icon atlas. Use <APB_Images:…;HUDIcon=TRUE> in UI text files or <hudicon:…> in HUD message files. Icons marked "changed" use atlas art that changed since the names were recorded; the picture may not match the name.' },
  cells: { list: cells, groups: false, info: 'Every 32×32 cell of the HUD icon atlas (APBMenus_Art_HUDIcons.Generic_Icons_Master). Cells with a name can be used as <hudicon:Name>; cells without one have no known name.' },
};

const st = { tab: 'images', group: null, q: '', shown: PAGE, sel: null, name: null };
const opt = Object.assign({ resize: true, xl: 16, yl: 16, lock: true, target: 'ui', tint: false, colour: '#ffffff', alpha: 1, bg: 'dark' }, store('opt') || {});
const save = () => store('opt', opt);

function sprite(cs, size) {
  const k = size / A.cell, el = document.createElement('div');
  el.className = 'sprite';
  el.style.width = el.style.height = size + 'px';
  const layers = cs.slice().reverse();
  el.style.backgroundImage = layers.map(() => `url(${A.file})`).join(',');
  el.style.backgroundSize = layers.map(() => `${A.w * k}px ${A.h * k}px`).join(',');
  el.style.backgroundPosition = layers.map(([r, c]) => `${-(c - 1) * size}px ${-(r - 1) * size}px`).join(',');
  return el;
}
function imgEl(x) {
  if (!x || !x.has) { const d = document.createElement('div'); d.className = 'noimg'; d.textContent = 'no picture'; return d; }
  const im = new Image(); im.loading = 'lazy'; im.decoding = 'async'; im.alt = x.path;
  imgUrl(x.pkg, x.i).then((u) => { if (u) im.src = u; });
  return im;
}
function preview(x, size) {
  if (x.kind === 'img') return imgEl(x);
  if (x.kind === 'tex') return imgEl(x.img);
  if (!x.cells.length) { const d = document.createElement('div'); d.className = 'noimg'; d.textContent = 'atlas cell unknown'; return d; }
  return sprite(x.cells, size);
}

const num = (v) => String(+(+v).toFixed(3));
function lineFor(x) {
  const ui = x.kind === 'img' || opt.target === 'ui';
  const size = opt.resize ? `Resize=TRUE XL=${num(opt.xl)} YL=${num(opt.yl)}` : '';
  let tag;
  if (x.kind === 'img') tag = `<Images:${x.path}${size ? ';' + size : ''}>`;
  else {
    const name = x.kind === 'cell' ? st.name : x.name;
    if (!name) return '';
    const flag = x.kind === 'tex' ? 'HUDTexture' : 'HUDIcon';
    tag = ui ? `<APB_Images:${name};${opt.resize ? `XL=${num(opt.xl)} YL=${num(opt.yl)} Resize=TRUE ` : ''}${flag}=TRUE>`
      : `<${flag.toLowerCase()}:${name}${size ? ';' + size : ''}>`;
  }
  if (ui && opt.tint) {
    const h = opt.colour, c = [1, 3, 5].map((o) => num(parseInt(h.substr(o, 2), 16) / 255));
    tag = `<ImageColour:R=${c[0]} G=${c[1]} B=${c[2]} A=${num(opt.alpha)}>` + tag;
  }
  return tag;
}
function nativeSize(x) {
  if (x.kind === 'img') return [x.w, x.h];
  if (x.kind === 'tex') return x.img ? [x.img.w, x.img.h] : [16, 16];
  return [32, 32];
}

async function copy(text) {
  if (!text) return false;
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}
function flash(msg) { $('#copied').textContent = msg; clearTimeout(flash.t); flash.t = setTimeout(() => ($('#copied').textContent = ''), 1800); }

function filtered() {
  const T = TABS[st.tab], words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
  let l = T.list;
  if (words.length) l = l.filter((x) => { const s = (x.name + ' ' + (x.names || []).join(' ') + ' ' + (x.src || '')).toLowerCase(); return words.every((w) => s.includes(w)); });
  else if (T.groups && st.group) l = l.filter((x) => x.group === st.group);
  return l;
}
function renderSide() {
  const T = TABS[st.tab];
  $('#side').classList.toggle('hidden', !T.groups);
  if (!T.groups) return;
  const counts = new Map();
  for (const x of T.list) counts.set(x.group, (counts.get(x.group) || 0) + 1);
  const f = $('#pkgfilter').value.toLowerCase(), ul = $('#pkgs');
  ul.replaceChildren();
  for (const [g, n] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (f && !g.toLowerCase().includes(f)) continue;
    const li = document.createElement('li');
    li.innerHTML = `<span></span><small>${n}</small>`; li.firstChild.textContent = g;
    li.classList.toggle('on', g === st.group);
    li.onclick = () => { st.group = g; st.q = ''; $('#search').value = ''; st.shown = PAGE; render(); };
    ul.append(li);
  }
}
function renderGrid() {
  const T = TABS[st.tab], l = filtered(), grid = $('#grid');
  $('#info').textContent = T.info + ` — ${l.length} shown` + (st.q ? ' (search covers all groups)' : '') + '.';
  grid.replaceChildren();
  for (const x of l.slice(0, st.shown)) {
    const c = document.createElement('div'); c.className = 'card' + (x === st.sel ? ' sel' : '');
    const pic = document.createElement('div'); pic.className = 'pic bg-' + opt.bg; pic.append(preview(x, 64));
    const nm = document.createElement('div'); nm.className = 'name';
    nm.textContent = x.kind === 'img' ? x.path.slice(x.pkg.length + 1) : x.kind === 'cell' ? (x.names[0] || x.name) : x.name;
    c.title = x.kind === 'cell' ? `${x.name}: ${x.names.join(', ') || 'no known name'}` : x.name;
    c.append(pic, nm);
    const badge = x.kind === 'img' && x.cls.startsWith('Material') ? 'material' : x.how === 'guessed' || x.guessed ? 'guessed' : x.changed ? 'changed' : '';
    if (badge) { const b = document.createElement('span'); b.className = 'badge'; b.textContent = badge; c.append(b); }
    c.onclick = () => select(x);
    c.ondblclick = async () => { select(x); if (await copy(lineFor(x))) flash('Copied'); };
    grid.append(c);
  }
  $('#more').hidden = l.length <= st.shown;
}
function render() { renderSide(); renderGrid(); writeHash(); }

function select(x) {
  st.sel = x; st.name = x.kind === 'cell' ? x.names[0] || null : null;
  document.querySelectorAll('.card.sel').forEach((e) => e.classList.remove('sel'));
  $('#detail').hidden = false;
  const p = $('#dprev'); p.className = 'bg-' + opt.bg; p.replaceChildren(preview(x, 128));
  $('#dname').textContent = x.kind === 'img' ? x.path : x.name;
  const meta = [];
  if (x.kind === 'img') {
    meta.push(['Class', x.cls], ['Size', x.has ? `${x.w}×${x.h}` : '—']);
    if (x.from) meta.push(['Preview', `texture ${x.from} (the material may animate or tint differently in game)`]);
  } else if (x.kind === 'tex') {
    meta.push(['Texture', x.src || 'unknown'], ['Source', x.how === 'sdd' ? 'game design data' : x.how === 'guessed' ? 'matched by name (guessed)' : 'name list only, no texture known']);
  } else {
    meta.push(['Atlas cells', x.cells.map(([r, c]) => `row ${r} col ${c}`).join(', ') || 'unknown']);
    if (x.changed) meta.push(['Note', 'atlas art changed since the name was recorded']);
    if (x.guessed) meta.push(['Note', 'name matched to this cell by its picture (newer icon, not in the old name lists): check in game']);
  }
  const dl = $('#dmeta'); dl.replaceChildren();
  for (const [k, v] of meta) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); }
  if (x.kind === 'cell') {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = 'Names';
    if (!x.names.length) dd.textContent = 'no known name';
    for (const n of x.names) {
      const b = document.createElement('button'); b.textContent = n; b.className = n === st.name ? 'on' : '';
      b.onclick = () => { st.name = n; dd.querySelectorAll('button').forEach((e) => (e.className = e === b ? 'on' : '')); update(); };
      dd.append(b, ' ');
    }
    dl.append(dt, dd);
  }
  $('#targetrow').hidden = x.kind === 'img';
  renderGrid();
  update();
}
function update() {
  applyTint();
  const x = st.sel; if (!x) return;
  const ui = x.kind === 'img' || opt.target === 'ui';
  $('#colourrow').hidden = !ui;
  $('#line').value = lineFor(x);
  const notes = [];
  if (x.kind === 'img') notes.push('<Images:> only works in UI text files, not in HUD message files.');
  if (ui && opt.tint) notes.push('ImageColour stays set for the images after it; custom configs reset it with <ImageColour:R=1 G=1 B=1 A=1>. It has no effect on some materials.');
  if (opt.resize) notes.push('Negative XL shifts what follows to the left (draw two images on top of each other); XL=0 stacks the image above the next one.');
  if (x.kind === 'cell' && !st.name) notes.push('No name is known for this cell. HUD icons can only be used by name (<hudicon:Name> / <APB_Images:Name;HUDIcon=TRUE>), and the markup has no way to pick one cell out of the atlas, so there is no line to copy for it.');
  if (x.kind === 'icon' && !x.cells.length) notes.push('The name is known but its picture is not: it comes from a newer name list and its atlas cell could not be matched. The line works if the name exists in the game.');
  $('#dnote').textContent = notes.join(' ');
}

function writeHash() { history.replaceState(null, '', '#' + [st.tab, TABS[st.tab].groups && !st.q ? st.group || '' : ''].map(encodeURIComponent).join('/').replace(/\/$/, '')); }
function readHash() {
  const [t, g] = location.hash.slice(1).split('/').map(decodeURIComponent);
  if (TABS[t]) st.tab = t;
  st.group = g || (st.tab === 'images' ? 'APBMenus_Art_HUDIcons' : st.tab === 'hudtex' ? hudtex[0]?.group : null);
}

function setTab(t) {
  st.tab = t; st.group = null; st.shown = PAGE; st.q = ''; $('#search').value = ''; $('#pkgfilter').value = '';
  if (TABS[t].groups) st.group = t === 'images' ? 'APBMenus_Art_HUDIcons' : TABS[t].list[0]?.group;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  render();
}
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
let qt; $('#search').oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); st.shown = PAGE; render(); }, 150); };
$('#pkgfilter').oninput = renderSide;
$('#more').onclick = () => { st.shown += PAGE; renderGrid(); };
$('#close').onclick = () => { $('#detail').hidden = true; st.sel = null; renderGrid(); };
$('#bg').value = opt.bg;
$('#bg').onchange = (e) => { opt.bg = e.target.value; save(); renderGrid(); if (st.sel) $('#dprev').className = 'bg-' + opt.bg; };

$('#resize').checked = opt.resize; $('#xl').value = opt.xl; $('#yl').value = opt.yl; $('#lock').checked = opt.lock;
$('#tint').checked = opt.tint; $('#colour').value = opt.colour; $('#alpha').value = opt.alpha;
document.querySelector(`input[name=target][value=${opt.target}]`).checked = true;
const changed = () => { save(); update(); };
$('#resize').onchange = (e) => { opt.resize = e.target.checked; changed(); };
$('#lock').onchange = (e) => { opt.lock = e.target.checked; if (opt.lock) $('#yl').value = opt.yl = opt.xl; changed(); };
$('#xl').oninput = (e) => { opt.xl = +e.target.value || 0; if (opt.lock) $('#yl').value = opt.yl = opt.xl; changed(); };
$('#yl').oninput = (e) => { opt.yl = +e.target.value || 0; if (opt.lock) $('#xl').value = opt.xl = opt.yl; changed(); };
$('#tint').onchange = (e) => { opt.tint = e.target.checked; changed(); };
$('#colour').oninput = (e) => { opt.colour = e.target.value; opt.tint = $('#tint').checked = true; changed(); };
$('#alpha').oninput = (e) => { opt.alpha = +e.target.value; changed(); };
document.querySelectorAll('input[name=target]').forEach((r) => (r.onchange = () => { opt.target = r.value; changed(); }));
document.querySelectorAll('.presets button').forEach((b) => (b.onclick = () => {
  let [w, h] = b.dataset.s === 'native' ? nativeSize(st.sel) : [+b.dataset.s, +b.dataset.s];
  if (b.dataset.s === 'native') { opt.lock = $('#lock').checked = w === h; }
  opt.xl = $('#xl').value = w; opt.yl = $('#yl').value = h; opt.resize = $('#resize').checked = true; changed();
}));
$('#copy').onclick = async () => flash((await copy($('#line').value)) ? 'Copied' : 'Copy failed: select the text and copy it');

applyTint();
readHash();
document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
render();
