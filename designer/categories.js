import { $, $$, h, render, seg, toggle, colourPick, colourText, hex2rgb, apbTag, FONTS, buildFile, saveFile, readFile, store } from './core.js';

const LISTS = {
  deploy: { label: 'Deploy · primary weapons', head: 'SELECT PRIMARY WEAPON', help: 'The category tabs of the primary weapon slot when you deploy.' },
  inventory: { label: 'Inventory · weapons', head: 'INVENTORY · WEAPONS', help: 'The weapon sub-categories of the inventory / storage filter list.' },
  joker: { label: 'Joker store · weapons', head: 'JOKER DISTRIBUTION · WEAPONS', help: 'The weapon sub-categories of the Joker store reward list.' }
};
const CAT_OF = [[/AssaultRifle/, ['Assault Rifles']], [/SubMachineGun/, ['Sub-Machine Guns']], [/SniperRifle/, ['High Velocity Rifles']], [/SemiAutoRifle|_Rifle$/, ['Rifles']],
  [/Shotgun/, ['Shotguns']], [/HeavyMachineGun|LightMachineGun/, ['Light Machine Guns']], [/Explosives/, ['Grenade Launchers', 'Rocket Launchers']],
  [/CrowdControl/, ['Primary Less Than Lethal Weapons']], [/Secondary/, ['Secondary Weapons']], [/Grenade$/, ['Grenades']], [/Christmas/, ['Snowball Launcher', 'Snowball']]];
const plain = s => String(s).replace(/<[^<>]*>/g, '').trim();
const pad = n => String(n).padStart(2, '0');

let CAT = null, IDX = null; const BUF = {}, URLS = new Map();
async function catalog() {
  if (!CAT) {
    const c = await (await fetch('../images/data/catalog.json')).json(), out = [];
    for (const [pkg, list] of Object.entries(c.packages)) {
      if (pkg !== 'APBMenus_Art_Weapons' && pkg !== 'APBMenus_Art_UpgradeIcons') continue;
      list.forEach((x, n) => { if (pkg === 'APBMenus_Art_Weapons' || /^Weapons\./.test(x[0])) out.push({ pkg, n, name: x[0], w: x[2], h: x[3], ref: `${pkg}.${x[0]}` }); });
    }
    CAT = out;
  }
  return CAT;
}
async function iconUrl(ic) {
  const k = `img/${ic.pkg}/${ic.n}`;
  if (!URLS.has(k)) URLS.set(k, (async () => {
    if (!IDX) IDX = fetch('../images/data/img_index.json').then(r => r.json());
    const e = (await IDX)[k]; if (!e) return '';
    const [f, off, len] = e;
    let bytes;
    try {
      const r = await fetch('../images/data/' + f, { headers: { Range: `bytes=${off}-${off + len - 1}` } });
      if (r.status === 206) bytes = await r.arrayBuffer();
      else { BUF[f] = BUF[f] || Promise.resolve(r.arrayBuffer()); bytes = (await BUF[f]).slice(off, off + len); }
    } catch { return ''; }
    return URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  })());
  return URLS.get(k);
}
const iconMarkup = (ic, yl, tint) => ic ? `${tint ? (c => `<ImageColour:R=${(c[0] / 255).toFixed(3).replace(/\.?0+$/, '') || 0} G=${(c[1] / 255).toFixed(3).replace(/\.?0+$/, '') || 0} B=${(c[2] / 255).toFixed(3).replace(/\.?0+$/, '') || 0}>`)(hex2rgb(tint)) : ''}<Images:${ic.ref};Resize=TRUE XL=${Math.round(ic.w / ic.h * yl)} YL=${yl}>` : '';

const DEFAULT_ST = { list: 'deploy', key: 'F', yl: 16, font: '', lists: {} };
function listRows(D, st, id) {
  const base = D.shopFilters[id] || [], saved = st.lists[id] || {};
  const order = saved.order || base.map(r => r.row);
  const known = new Map(base.map(r => [r.row, r]));
  const rows = order.filter(r => known.has(r)).concat(base.map(r => r.row).filter(r => !order.includes(r)));
  saved.order = rows; saved.items = saved.items || {}; st.lists[id] = saved;
  rows.forEach(r => { saved.items[r] = saved.items[r] || { text: plain(known.get(r).name) || r, mode: 'none', 1: '#ffb000', 2: '#ff3d3d', 3: '#7a5cff', icon: null }; });
  return { rows, items: saved.items, known };
}
function catValue(D, st, id, row, idx) {
  const R = listRows(D, st, id), it = R.items[row], text = it.text || plain(R.known.get(row).name);
  const stops = [it[1], it[2]].concat(it.mode === 'triple' ? [it[3]] : []).map(hex2rgb);
  const shown = (st.key === 'number' ? `${idx + 1}. ` : '') + text;
  const coloured = it.mode === 'none' ? shown : colourText(shown, { mode: it.mode === 'triple' ? 'smooth' : it.mode, stops, kind: 'ui' });
  const icon = iconMarkup(it.icon, st.yl, it.tint);
  let v = `${icon}${icon ? ' ' : ''}${coloured}`;
  if (st.key === 'F') v = `<Color:F=${pad(idx)} A=1>${v}<Color:/>`;
  if (st.font) v = `<Fonts:${st.font}>${v}<Fonts:/>`;
  return v;
}
function catLines(D, st, id) { return listRows(D, st, id).rows.map((r, i) => [`ShopUIFilters_${r}_Name`, catValue(D, st, id, r, i)]); }
export function categoryLines(D) {
  const st = store.get('categories', DEFAULT_ST);
  return Object.keys(LISTS).filter(k => st.lists && st.lists[k]).flatMap(k => catLines(D, st, k));
}

export function initCategories(root, D) {
  const st = store.get('categories', DEFAULT_ST);
  const save = () => store.set('categories', st);
  const rowsOf = id => listRows(D, st, id);
  let selected = null, baseFile = null;
  const panel = h('div', { class: 'invpanel' }), editor = h('div', { class: 'card glass' }), out = h('div', { class: 'card glass' });

  const valueOf = (id, row, idx) => catValue(D, st, id, row, idx);
  const lines = id => catLines(D, st, id);

  const draw = () => {
    const id = st.list, L = LISTS[id], { rows, known } = rowsOf(id);
    if (!selected || !rows.includes(selected)) selected = rows[0];
    panel.innerHTML = '';
    const tabs = h('div', { class: 'invtabs' });
    rows.forEach((r, i) => {
      const k = known.get(r);
      const el = h('div', { class: 'invtab' + (r === selected ? ' on' : ''), draggable: 'true', 'data-row': r, title: r,
        onclick: () => { selected = r; draw(); },
        ondragstart: e => { e.dataTransfer.setData('text/plain', r); el.classList.add('drag'); },
        ondragend: () => el.classList.remove('drag'),
        ondragover: e => { e.preventDefault(); el.classList.add('over'); }, ondragleave: () => el.classList.remove('over'),
        ondrop: e => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); move(from, rows.indexOf(r)); } },
      h('span', { class: 'grip' }, '⋮⋮'), h('span', { class: 'invlabel', html: render(valueOf(id, r, i).replace(/(<ImageColour:[^>]*>)?<Images:[^>]*>/g, '§')) }),
      k.hidden ? h('span', { class: 'badge', title: 'This category has no shop assigned in the game data, so the game normally does not list it.' }, 'hidden') : null,
      h('span', { class: 'arrows' }, h('button', { title: 'Move up', onclick: e => { e.stopPropagation(); move(r, i - 1); } }, '▲'), h('button', { title: 'Move down', onclick: e => { e.stopPropagation(); move(r, i + 1); } }, '▼')));
      const img = rowsOf(id).items[r].icon;
      const tint = rowsOf(id).items[r].tint;
      if (img) iconUrl(img).then(u => { const sp = el.querySelector('.invlabel'); if (sp && u) sp.innerHTML = sp.innerHTML.replace('§', `<span class="tinted" style="height:${st.yl}px;width:${Math.round(img.w / img.h * st.yl)}px"><img src="${u}">${tint ? `<i style="background:${tint};-webkit-mask-image:url(${u});mask-image:url(${u})"></i>` : ''}</span>`); });
      else { const sp = el.querySelector('.invlabel'); sp.innerHTML = sp.innerHTML.replace('§', ''); }
      tabs.append(el);
    });
    const cats = (CAT_OF.find(([re]) => re.test(selected)) || [0, []])[1];
    const items = D.weapons.filter(w => /Valentine/.test(selected) ? /valentine/i.test(w.row + ' ' + w.name) : cats.includes(w.cat)).slice(0, 12);
    const grid = h('div', { class: 'invgrid' }, items.length ? items.map(w => h('div', { class: 'invitem', html: render(w.name) })) : h('div', { class: 'hint' }, /Primary$/.test(selected) ? 'Every primary weapon.' : 'No sample weapons for this category.'));
    panel.append(h('div', { class: 'invhead' }, L.head), h('div', { class: 'invbody' }, tabs, grid));
    drawEditor(); drawOut();
  };
  const move = (row, to) => {
    const { rows } = rowsOf(st.list), from = rows.indexOf(row);
    if (from < 0 || to < 0 || to >= rows.length || from === to) return;
    rows.splice(to, 0, rows.splice(from, 1)[0]); selected = row; save(); draw();
  };
  const drawEditor = () => {
    const { items, known } = rowsOf(st.list), it = items[selected], k = known.get(selected);
    editor.innerHTML = '';
    const picker = h('div', { class: 'iconpick', hidden: true });
    const pick = { src: 'cat', type: 'kill', q: '' };
    const showPicker = async () => {
      picker.hidden = !picker.hidden; if (picker.hidden) return;
      picker.innerHTML = 'Loading icons…';
      const list = await catalog(), byRef = new Map(list.map(x => [x.ref, x]));
      const q = h('input', { type: 'search', placeholder: 'Search weapons or icon names…', oninput: () => { pick.q = q.value; fill(); } }), grid = h('div', { class: 'icongrid' });
      const cats = (CAT_OF.find(([re]) => re.test(selected)) || [0, []])[1], inCat = w => /Valentine/.test(selected) ? /valentine/i.test(w.row + ' ' + w.name) : cats.includes(w.cat);
      const choose = x => { it.icon = { pkg: x.pkg, n: x.n, w: x.w, h: x.h, ref: x.ref }; save(); picker.hidden = true; draw(); };
      const fill = () => {
        grid.innerHTML = ''; const t = pick.q.toLowerCase(); let cells = [];
        if (pick.src === 'tex') cells = list.filter(x => !t || x.name.toLowerCase().includes(t)).map(x => ({ x, label: x.name.replace(/^Weapons\./, '') }));
        else {
          const seen = new Map();
          for (const w of D.weapons) {
            if (pick.src === 'cat' && !inCat(w)) continue;
            const x = byRef.get(pick.type === 'kill' ? w.kill : w.icon); if (!x) continue;
            const nm = plain(w.name); if (t && !(nm + ' ' + x.name).toLowerCase().includes(t)) continue;
            if (seen.has(x.ref)) seen.get(x.ref).more++; else seen.set(x.ref, { x, label: nm, more: 0 });
          }
          cells = [...seen.values()].map(c => ({ x: c.x, label: c.label + (c.more ? ` +${c.more}` : '') }));
        }
        cells.slice(0, 200).forEach(({ x, label }) => {
          const im = h('img', { alt: label }); iconUrl(x).then(u => { if (u) im.src = u; });
          grid.append(h('button', { class: 'iconcell' + (it.icon && it.icon.ref === x.ref ? ' on' : ''), title: x.ref, onclick: () => choose(x) }, im, h('small', {}, label)));
        });
        if (!cells.length) grid.append(h('div', { class: 'hint' }, pick.src === 'cat' ? 'No weapons with icons in this category: try "All weapons".' : 'Nothing found.'));
        else if (cells.length > 200) grid.append(h('div', { class: 'hint' }, `${cells.length - 200} more: narrow the search.`));
      };
      const typeSeg = seg([['kill', 'Kill icon'], ['icon', 'Inventory icon']], pick.type, v => { pick.type = v; fill(); });
      picker.innerHTML = '';
      picker.append(h('div', { class: 'row' }, seg([['cat', 'Weapons in this category'], ['all', 'All weapons'], ['tex', 'All icon textures']], pick.src, v => { pick.src = v; typeSeg.style.display = v === 'tex' ? 'none' : ''; fill(); }), typeSeg),
        h('div', { class: 'row' }, q, h('button', { onclick: () => { it.icon = null; save(); picker.hidden = true; draw(); } }, 'No icon')), grid);
      fill();
    };
    const cols = h('div', { class: 'fv' });
    const drawCols = () => {
      cols.innerHTML = '';
      const n = it.mode === 'none' || it.mode === 'rainbow' ? 0 : it.mode === 'solid' ? 1 : it.mode === 'triple' ? 3 : 2;
      for (let i = 1; i <= n; i++) cols.append(colourPick('ui', it[i], v => { it[i] = v; save(); draw(); }));
    };
    drawCols();
    editor.append(h('h3', {}, 'Category'), h('div', { class: 'hint' }, h('code', {}, `ShopUIFilters_${selected}_Name`), k.hidden ? ' · not listed by the game by default' : ''),
      h('div', { class: 'field' }, h('label', {}, 'Name'), h('input', { type: 'text', value: it.text, oninput: e => { it.text = e.target.value; save(); draw(); } })),
      h('div', { class: 'field' }, h('label', {}, 'Colour'), seg([['none', 'Game default'], ['solid', 'Solid'], ['smooth', 'Smooth'], ['triple', 'Triple'], ['rainbow', 'Rainbow']], it.mode, v => { it.mode = v; save(); drawCols(); draw(); }), cols),
      h('div', { class: 'field' }, h('label', {}, 'Icon (shown before the name)'), h('div', { class: 'row' }, h('button', { onclick: showPicker }, it.icon ? 'Change icon' : 'Choose icon'), it.icon ? h('code', {}, it.icon.ref) : h('span', { class: 'hint' }, 'none'))), picker,
      it.icon ? h('div', { class: 'row' }, toggle('Tint the icon', !!it.tint, v => { it.tint = v ? '#ffb000' : null; save(); draw(); }), it.tint ? colourPick('ui', it.tint, v => { it.tint = v; save(); draw(); }) : null,
        h('span', { class: 'hint' }, 'Tints multiply the picture (<ImageColour:>), so dark icons stay dark.')) : null,
      h('div', { class: 'row' }, h('button', { title: 'Give every category without an icon the kill icon of one of its weapons', onclick: () => autoIcons() }, 'Default icons for empty categories'),
        h('button', { onclick: () => { delete st.lists[st.list].items[selected]; save(); draw(); } }, 'Reset this category'),
        h('button', { onclick: () => { delete st.lists[st.list]; save(); draw(); } }, 'Reset this list')));
  };
  const autoIcons = async () => {
    const list = await catalog(), byRef = new Map(list.map(x => [x.ref, x])), { rows, items } = rowsOf(st.list);
    for (const r of rows) {
      const cats = (CAT_OF.find(([re]) => re.test(r)) || [0, []])[1];
      const w = D.weapons.find(w => !w.event && (/Valentine/.test(r) ? /valentine/i.test(w.row + ' ' + w.name) : cats.includes(w.cat)) && byRef.has(w.kill))
        || D.weapons.find(w => (/Christmas/.test(r) ? cats.includes(w.cat) : false) && byRef.has(w.kill));
      if (w && !items[r].icon) { const x = byRef.get(w.kill); items[r].icon = { pkg: x.pkg, n: x.n, w: x.w, h: x.h, ref: x.ref }; }
    }
    save(); draw();
  };
  const drawOut = () => {
    out.innerHTML = '';
    const fileIn = h('input', { type: 'file', accept: '.int,.ger,.INT,.GER,.txt' });
    fileIn.onchange = async () => { const f = fileIn.files[0]; if (f) { baseFile = await readFile(f); drawOut(); } };
    const ls = lines(st.list);
    out.append(...[h('h3', {}, 'Output · ShopUIFilters'),
      h('label', { class: 'drop' }, fileIn, '📄 ', h('span', {}, 'Optional: your ', h('b', {}, 'ShopUIFilters'), ' file to merge into')),
      baseFile ? h('div', { class: 'hint' }, `Merging into ${baseFile.name}`) : null,
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => {
        const all = Object.keys(LISTS).filter(k => st.lists[k]).flatMap(lines);
        const r = buildFile('ShopUIFilters', all, baseFile); saveFile(r, baseFile ? baseFile.name : 'ShopUIFilters.GER');
        msg.textContent = baseFile ? `Saved: ${r.replaced} replaced, ${r.added} added (all lists you edited).` : `Saved ${r.added} lines (all lists you edited).`;
      } }, 'Download'), h('button', { onclick: e => navigator.clipboard.writeText(ls.map(([k, v]) => `${k}=${v}`).join('\r\n')).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy this list', 1200); }) }, 'Copy this list')),
      h('textarea', { rows: 6, readonly: true }, ls.map(([k, v]) => `${k}=${v}`).join('\n'))].filter(Boolean));
    const msg = h('div', { class: 'hint' }); out.append(msg);
  };

  const top = h('div', { class: 'card glass' },
    h('h3', {}, 'Weapon categories'),
    h('p', { class: 'hint' }, 'Drag the categories (or use ▲ ▼) into the order you want, rename them, colour them and give them an icon. The lists sort categories by their name text, so each name starts with an invisible sort key (', h('code', {}, '<Color:F=00 A=1>'), ', ', h('code', {}, 'F=01'), ' …), the method the community configs use. Valentines and Christmas are included: the game data gives them no shop, so they normally do not show up; their names and order still apply if the game lists them.'),
    h('div', { class: 'field' }, h('label', {}, 'List'), seg(Object.entries(LISTS).map(([k, v]) => [k, v.label]), st.list, v => { st.list = v; selected = null; save(); draw(); })),
    h('div', { class: 'field' }, h('label', {}, 'Sort key'), seg([['F', 'Hidden (F=00…)'], ['number', 'Visible numbers (1. 2. …)'], ['none', 'None (game order)']], st.key, v => { st.key = v; save(); draw(); })),
    h('div', { class: 'row' }, h('label', { class: 'hint' }, 'Icon height'), h('input', { type: 'number', min: 8, max: 32, value: st.yl, style: 'width:70px', oninput: e => { st.yl = +e.target.value || 16; save(); draw(); } }),
      h('label', { class: 'hint' }, 'Font'), h('select', { onchange: e => { st.font = e.target.value; save(); draw(); } }, h('option', { value: '' }, 'Game default'), FONTS.map(f => h('option', { value: f, selected: st.font === f }, f.split('.').pop().replace(/_/g, ' '))))));
  root.append(top, h('div', { class: 'catlayout' }, panel, h('div', {}, editor, out)));
  draw();
}
