import { h, render, seg, toggle, colourPick, colourText, hex2rgb, FONTS, buildFile, saveFile, readFile, store } from './core.js';
import { imagePicker, imageTag, imageByRef, asSel } from './imgpick.js';

const HEADS = { deploy: 'SELECT PRIMARY WEAPON', inventory: 'INVENTORY · WEAPONS', joker: 'JOKER DISTRIBUTION · WEAPONS' };
const CAT_OF = [[/AssaultRifle/, ['Assault Rifles']], [/SubMachineGun/, ['Sub-Machine Guns']], [/SniperRifle/, ['High Velocity Rifles']], [/SemiAutoRifle|_Rifle$/, ['Rifles']],
  [/Shotgun/, ['Shotguns']], [/HeavyMachineGun|LightMachineGun/, ['Light Machine Guns']], [/Explosives/, ['Grenade Launchers', 'Rocket Launchers']],
  [/CrowdControl/, ['Primary Less Than Lethal Weapons']], [/Secondary/, ['Secondary Weapons']], [/Grenade$/, ['Grenades']], [/Christmas/, ['Snowball Launcher', 'Snowball']]];
const PKG_OF = [[/Cloth|Wardrobe|Armou?r|Belt|Bottom|Eyewear|Footwear|Handwear|Headwear|Jewel|Mask|Overall|Skirt|Top|Underwear|Webbing|Outfit/i, 'APBMenus_Art_ClothingIcons'],
  [/Vehicle|Car|Truck|Van/i, 'APBMenus_Art_VehicleIcons'], [/FnMod|Modif|Usable|Consum/i, 'APBMenus_Art_UpgradeIcons'], [/Equipment/i, 'APBMenus_Art_EquipmentIcons'], [/Weapon|Ammo|Grenade/i, 'APBMenus_Art_Weapons']];
const plain = s => String(s).replace(/<[^<>]*>/g, '').trim();
const pad = n => String(n).padStart(2, '0');
const weaponsOf = (D, row) => { const cats = (CAT_OF.find(([re]) => re.test(row)) || [0, []])[1]; return D.weapons.filter(w => /Valentine/.test(row) ? /valentine/i.test(w.row + ' ' + w.name) : cats.includes(w.cat)); };

const allLists = D => D.catLists || Object.entries(D.shopFilters).map(([id, rows]) => ({ id, group: 'Weapons', label: id, file: 'ShopUIFilters', col: 'Name', weapons: 1, rows }));
const listOf = (D, id) => allLists(D).find(l => l.id === id) || allLists(D)[0];
const DEFAULT_ST = { list: 'deploy', key: 'F', yl: 16, font: '', lists: {} };
const keyOf = (st, L) => (st.lists[L.id] && st.lists[L.id].key) || (L.file === 'ShopUIFilters' ? st.key : 'none');
function listRows(D, st, id) {
  const L = listOf(D, id), base = L.rows, saved = st.lists[L.id] || {};
  const order = saved.order || base.map(r => r.row);
  const known = new Map(base.map(r => [r.row, r]));
  const rows = order.filter(r => known.has(r)).concat(base.map(r => r.row).filter(r => !order.includes(r)));
  saved.order = rows; saved.items = saved.items || {}; st.lists[L.id] = saved;
  rows.forEach(r => { saved.items[r] = saved.items[r] || { text: plain(known.get(r).name) || r, mode: 'none', 1: '#ffb000', 2: '#ff3d3d', 3: '#7a5cff', icon: null }; });
  return { L, rows, items: saved.items, known };
}
function catValue(D, st, id, row, idx) {
  const R = listRows(D, st, id), it = R.items[row], text = it.text || plain(R.known.get(row).name), key = keyOf(st, R.L);
  const stops = [it[1], it[2]].concat(it.mode === 'triple' ? [it[3]] : []).map(hex2rgb);
  const shown = (key === 'number' ? `${idx + 1}. ` : '') + text;
  const coloured = it.mode === 'none' ? shown : colourText(shown, { mode: it.mode === 'triple' ? 'smooth' : it.mode, stops, kind: 'ui' });
  const icon = imageTag(it.icon, st.yl, it.tint);
  let v = it.iconOnly && icon ? icon : `${icon}${icon ? ' ' : ''}${coloured}`;
  if (key === 'F') v = `<Color:F=${pad(idx)} A=1>${v}<Color:/>`;
  if (st.font) v = `<Fonts:${st.font}>${v}<Fonts:/>`;
  return v;
}
function catLines(D, st, id) { const R = listRows(D, st, id); return R.rows.map((r, i) => [`${R.L.file}_${r}_${R.L.col}`, catValue(D, st, id, r, i)]); }
function changed(D, st, id) {
  const s = st.lists && st.lists[id]; if (!s) return false;
  const L = listOf(D, id), base = L.rows.map(r => r.row);
  if (s.key || (s.order && s.order.some((r, i) => r !== base[i]))) return true;
  return L.rows.some(r => { const it = (s.items || {})[r.row]; return it && (it.icon || it.iconOnly || it.mode !== 'none' || (it.text && it.text !== plain(r.name))); });
}
export function categoryFiles(D) {
  const st = store.get('categories', DEFAULT_ST), out = {};
  for (const L of allLists(D)) if (changed(D, st, L.id)) out[L.file] = (out[L.file] || []).concat(catLines(D, st, L.id));
  return out;
}

export function initCategories(root, D) {
  const st = store.get('categories', DEFAULT_ST);
  const save = () => store.set('categories', st);
  const rowsOf = id => listRows(D, st, id);
  let selected = null; const baseFiles = {};
  const panel = h('div', { class: 'invpanel' }), editor = h('div', { class: 'card glass' }), out = h('div', { class: 'card glass' }), opts = h('div');

  const draw = () => {
    const { L, rows, known, items } = rowsOf(st.list);
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
      h('span', { class: 'grip' }, '⋮⋮'), h('span', { class: 'invlabel', html: render(catValue(D, st, L.id, r, i)) }),
      k.hidden ? h('span', { class: 'badge', title: 'This category has no shop assigned in the game data, so the game normally does not list it.' }, 'hidden') : null,
      h('span', { class: 'arrows' }, h('button', { title: 'Move up', onclick: e => { e.stopPropagation(); move(r, i - 1); } }, '▲'), h('button', { title: 'Move down', onclick: e => { e.stopPropagation(); move(r, i + 1); } }, '▼')));
      tabs.append(el);
    });
    let grid;
    if (L.weapons) {
      const ws = weaponsOf(D, selected).slice(0, 12);
      grid = h('div', { class: 'invgrid' }, ws.length ? ws.map(w => h('div', { class: 'invitem', html: render(w.name) })) : h('div', { class: 'hint' }, /Primary$/.test(selected) ? 'Every primary weapon.' : 'No sample weapons for this category.'));
    } else grid = h('div', { class: 'invgrid' }, h('div', { class: 'hint' }, L.group === 'Marketplace' ? 'Marketplace category names. The same names also show where the game names an item\'s category.' : `${L.group} · ${L.label}`));
    panel.append(h('div', { class: 'invhead' }, HEADS[L.id] || `${L.group} · ${L.label}`.toUpperCase()), h('div', { class: 'invbody' }, tabs, grid));
    drawOpts(); drawEditor(); drawOut();
  };
  const move = (row, to) => {
    const { rows } = rowsOf(st.list), from = rows.indexOf(row);
    if (from < 0 || to < 0 || to >= rows.length || from === to) return;
    rows.splice(to, 0, rows.splice(from, 1)[0]); selected = row; save(); draw();
  };
  const weaponSuggest = async () => {
    const out = [], seen = new Set();
    for (const w of weaponsOf(D, selected).concat(D.weapons)) for (const [ref, kind] of [[w.kill, 'kill'], [w.icon, 'icon']]) {
      if (!ref || seen.has(ref)) continue; seen.add(ref);
      const x = await imageByRef(ref); if (x) out.push({ ...x, label: `${plain(w.name)} · ${kind}` });
      if (out.length >= 240) return out;
    }
    return out;
  };
  const drawEditor = () => {
    const { L, items, known } = rowsOf(st.list), it = items[selected], k = known.get(selected);
    editor.innerHTML = '';
    const picker = h('div', { hidden: true });
    const showPicker = () => {
      picker.hidden = !picker.hidden; if (picker.hidden) return;
      const pkg = (PKG_OF.find(([re]) => re.test(selected + ' ' + L.label + ' ' + L.group)) || [0, 'APBMenus_Art_Icons'])[1];
      picker.replaceChildren(imagePicker({ value: it.icon, pkg, suggest: L.weapons ? weaponSuggest : null,
        onPick: x => { it.icon = x ? { k: x.k, ref: x.ref, w: x.w, h: x.h } : null; save(); picker.hidden = true; draw(); } }));
    };
    const cols = h('div', { class: 'fv' });
    const drawCols = () => {
      cols.innerHTML = '';
      const n = it.mode === 'none' || it.mode === 'rainbow' ? 0 : it.mode === 'solid' ? 1 : it.mode === 'triple' ? 3 : 2;
      for (let i = 1; i <= n; i++) cols.append(colourPick('ui', it[i], v => { it[i] = v; save(); draw(); }));
    };
    drawCols();
    const icon = asSel(it.icon);
    editor.append(...[h('h3', {}, 'Category'), h('div', { class: 'hint' }, h('code', {}, `${L.file}_${selected}_${L.col}`), k.hidden ? ' · not listed by the game by default' : ''),
      h('div', { class: 'field' }, h('label', {}, 'Name'), h('input', { type: 'text', value: it.text, oninput: e => { it.text = e.target.value; save(); draw(); } })),
      h('div', { class: 'field' }, h('label', {}, 'Colour'), seg([['none', 'Game default'], ['solid', 'Solid'], ['smooth', 'Smooth'], ['triple', 'Triple'], ['rainbow', 'Rainbow']], it.mode, v => { it.mode = v; save(); drawCols(); draw(); }), cols),
      h('div', { class: 'field' }, h('label', {}, 'Image (shown before the name)'), h('div', { class: 'row' }, h('button', { onclick: showPicker }, icon ? 'Change image' : 'Choose image'), icon ? h('code', {}, icon.ref) : h('span', { class: 'hint' }, 'none'))), picker,
      icon ? h('div', { class: 'row' }, toggle('Image only (no name)', !!it.iconOnly, v => { it.iconOnly = v; save(); draw(); }), toggle('Tint the image', !!it.tint, v => { it.tint = v ? '#ffb000' : null; save(); draw(); }), it.tint ? colourPick('ui', it.tint, v => { it.tint = v; save(); draw(); }) : null,
        h('span', { class: 'hint' }, 'Tints multiply the picture (<ImageColour:>), so dark images stay dark.')) : null,
      h('div', { class: 'row' }, L.weapons ? h('button', { title: 'Give every category without an image the kill icon of one of its weapons', onclick: () => autoIcons() }, 'Default icons for empty categories') : null,
        h('button', { onclick: () => { delete st.lists[L.id].items[selected]; save(); draw(); } }, 'Reset this category'),
        h('button', { onclick: () => { delete st.lists[L.id]; save(); draw(); } }, 'Reset this list'))].filter(Boolean));
  };
  const autoIcons = async () => {
    const { rows, items } = rowsOf(st.list);
    for (const r of rows) {
      if (items[r].icon) continue;
      for (const w of weaponsOf(D, r).filter(w => !w.event).concat(/Christmas/.test(r) ? weaponsOf(D, r) : [])) {
        const x = await imageByRef(w.kill); if (x) { items[r].icon = { k: 'img', ref: x.ref, w: x.w, h: x.h }; break; }
      }
    }
    save(); draw();
  };
  const drawOut = () => {
    const { L } = rowsOf(st.list), file = L.file;
    out.innerHTML = '';
    const fileIn = h('input', { type: 'file', accept: '.int,.ger,.INT,.GER,.txt' });
    fileIn.onchange = async () => { const f = fileIn.files[0]; if (f) { baseFiles[file] = await readFile(f); drawOut(); } };
    const ls = catLines(D, st, L.id), base = baseFiles[file];
    const msg = h('div', { class: 'hint' });
    out.append(...[h('h3', {}, `Output · ${file}`),
      h('label', { class: 'drop' }, fileIn, '📄 ', h('span', {}, 'Optional: your ', h('b', {}, file), ' file to merge into')),
      base ? h('div', { class: 'hint' }, `Merging into ${base.name}`) : null,
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => {
        const all = categoryFiles(D)[file] || ls;
        const r = buildFile(file, all, base); saveFile(r, base ? base.name : `${file}.GER`);
        msg.textContent = base ? `Saved: ${r.replaced} replaced, ${r.added} added (all ${file} lists you edited).` : `Saved ${r.added} lines (all ${file} lists you edited).`;
      } }, `Download ${file}`), h('button', { onclick: e => navigator.clipboard.writeText(ls.map(([k, v]) => `${k}=${v}`).join('\r\n')).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy this list', 1200); }) }, 'Copy this list')),
      h('textarea', { rows: 6, readonly: true }, ls.map(([k, v]) => `${k}=${v}`).join('\n')), msg].filter(Boolean));
  };
  const drawOpts = () => {
    const { L } = rowsOf(st.list), groups = [];
    for (const l of allLists(D)) { let g = groups.find(x => x[0] === l.group); if (!g) groups.push(g = [l.group, []]); g[1].push(l); }
    const edited = id => changed(D, st, id);
    const setKey = v => { if (L.file === 'ShopUIFilters' && !st.lists[L.id].key) st.key = v; st.lists[L.id].key = v; save(); draw(); };
    opts.replaceChildren(
      h('div', { class: 'field' }, h('label', {}, 'List'), h('select', { onchange: e => { st.list = e.target.value; selected = null; save(); draw(); } },
        groups.map(([g, ls]) => h('optgroup', { label: g }, ls.map(l => h('option', { value: l.id, selected: l.id === L.id }, `${l.label} (${l.rows.length})${edited(l.id) ? ' ✎' : ''}`)))))),
      h('div', { class: 'field' }, h('label', {}, 'Sort key'), seg([['F', 'Hidden (F=00…)'], ['number', 'Visible numbers (1. 2. …)'], ['none', 'None (game order)']], keyOf(st, L), setKey)),
      L.file !== 'ShopUIFilters' ? h('p', { class: 'hint' }, 'Marketplace names come from InventoryItemInfraCategories. Whether the marketplace sorts them by name is untested, so the sort key is off by default.') : null);
  };

  const top = h('div', { class: 'card glass' },
    h('h3', {}, 'Categories'),
    h('p', { class: 'hint' }, 'Every category list of the game: weapon tabs, wardrobe clothing types, inventory, Fixer, deploy, armory and Joker store filters, and the marketplace names. Drag the categories (or use ▲ ▼) into the order you want, rename them, colour them and put an image in front (or use the image alone). Filter lists sort categories by their name text, so each name starts with an invisible sort key (', h('code', {}, '<Color:F=00 A=1>'), ', ', h('code', {}, 'F=01'), ' …), the method the community configs use. Lists marked ✎ have changes; Download writes every list you changed in that file.'),
    opts,
    h('div', { class: 'row' }, h('label', { class: 'hint' }, 'Image height'), h('input', { type: 'number', min: 8, max: 32, value: st.yl, style: 'width:70px', oninput: e => { st.yl = +e.target.value || 16; save(); draw(); } }),
      h('label', { class: 'hint' }, 'Font'), h('select', { onchange: e => { st.font = e.target.value; save(); draw(); } }, h('option', { value: '' }, 'Game default'), FONTS.map(f => h('option', { value: f, selected: st.font === f }, f.split('.').pop().replace(/_/g, ' '))))));
  root.append(top, h('div', { class: 'catlayout' }, panel, h('div', {}, editor, out)));
  draw();
}
