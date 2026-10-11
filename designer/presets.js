import { $, $$, h, render, seg, toggle, colourPick, colourText, hex2rgb, rgb2hex, apbTag, FONTS, store, intValue, buildFile, setNamed, named, namedRgb, nearestNamed } from './core.js';
import { GENS, stripTags } from './gen.js';
import { categoryLines } from './categories.js';
import { LOC, findLoc, readLoc, onFolder } from './folder.js';
import { readInputs, writeZip, encodeText, decodeText, download } from '../config/lib.js';

const NL = '↵';
const gen = id => GENS.find(g => g.id === id);
let THEME = null, LASTGEN = null;
const themeFor = id => !THEME ? {} : ({ daily: { value: THEME.col }, missions: { cur: THEME.col }, weapons: { hi: THEME.hex }, vehicles: { hi: THEME.hex }, roles: { rank: THEME.hex }, contacts: { lvl: THEME.hex } }[id] || {});
const genLines = (D, id, over = {}, raw = false) => {
  const g = gen(id), s = { ...structuredClone(g.defaults), ...(raw ? {} : themeFor(id)), ...over }; LASTGEN = { id, s };
  return { [g.file]: g.items(D, s).filter(x => x.value !== undefined).map(x => [x.key, x.value, x.section]) };
};
const mine = id => ['mine', 'My settings from the Generators tab', (D) => genLines(D, id, store.get('gen-' + id, structuredClone(gen(id).defaults)), true)];
const tagRGB = c => `<Color:R=${c[0]} G=${c[1]} B=${c[2]}>`;
const hexOf = c => rgb2hex(c.map(v => v * 255));
const EQUIP_ICON = { 'Spray Can': 'SprayCanLV0', Crowbar: 'CrowBarLV0', 'Battering Ram': 'BatteringRamLV0', 'Slim Jim': 'SlimJimLV0', 'Wire Cutters': 'WireCuttersLV0',
  Bomb: 'ExplosivesLV0', 'Gas Can': 'PetrolCanLV0', Camera: 'CameraV0', Netbook: 'ScannerLV0' };
const equipOf = D => new Map(D.missions.map(m => [m.row, [...new Set(m.stages.filter(s => !s.opp).map(s => EQUIP[s.cat]).filter(Boolean))]]));
const EQUIP = { Graffiti: 'Spray Can', AntiGraffiti: 'Spray Can', Burglary: 'Crowbar', ForcedEntry: 'Battering Ram', VehicleTheft: 'Slim Jim', VehicleLooting: 'Slim Jim',
  VehicleCargo: 'Slim Jim', Sabotage: 'Wire Cutters', BombDisposal: 'Wire Cutters', Bombing: 'Bomb', Arson: 'Gas Can', CrimeSceneInvestigation: 'Camera', Hacking: 'Netbook' };
const VIVID = ['#ff4d4d', '#ffb000', '#ffe14d', '#45ff16', '#16e0ff', '#0978ff', '#a64dff', '#ff4dc4', '#ff7a1a', '#7dffb0', '#c0c0c0', '#ffffff'];

function restyleStats(D, id, style, P) {
  const base = { mode: 'stats', label: '#ffffff', value: '#ffffff', hi: '#ffffff' };
  if (style === 'designer') return genLines(D, id);
  if (style === 'iazer') return genLines(D, id, { ...base, value: '' });
  const out = genLines(D, id, { ...base, label: '', value: '', hi: '' }), g = gen(id), stops = P.writch.grad.map(c => c.map(v => v * 255));
  for (const f in out) out[f] = out[f].map(([k, v, s]) => [k, v.split(NL).map(l => { const i = l.indexOf(':'); return i < 0 ? l : colourText(l.slice(0, i + 1), { mode: 'smooth', stops, kind: 'ui' }) + l.slice(i + 1); }).join(NL), s]);
  return out;
}
function stockOf(P, file) { return P.stock[file]; }
function mapStock(P, file, fn) {
  const st = stockOf(P, file); return { [file]: st.lines.map(([k, v]) => { const n = fn(k, v); return n === undefined ? null : [k, n]; }).filter(Boolean) };
}
const recolHud = (v, base, hi, err) => {
  if (!v.trim()) return undefined;
  let x = v.replace(/<col:\s*([A-Za-z_]+)\s*>/gi, (m, n) => `<col:${/^HUDMessage_Error$/i.test(n) ? err : hi}>`);
  if (!/^<col:/i.test(x.trim())) x = `<col:${base}>${x}</col>`;
  return x;
};

export const SLOTS = [
  { id: 'daily', label: 'Daily activities', files: 'DailyActivityContacts', variants: [
    ['stock', 'Game default'],
    ['designer', 'Recoloured values (designer)', (D) => genLines(D, 'daily', { hud: 'colour' })],
    ['short', 'Short lines, e.g. "Kill streak: 15"', (D) => genLines(D, 'daily', { hud: 'short' })],
    ['reward', 'Reward in the title (designer)', (D) => genLines(D, 'daily', { title: 'both', hud: 'colour' })],
    ['iazer', 'iazer style (set colour)', (D, P, c) => ({ DailyActivityContacts: D.daily.flatMap(d => [['HUDDescription', d.hud], ['LongDescription', d.long]].map(([f, t]) => [`DailyActivityContacts_${d.row}_${f}${d.suf}`, `<col:${c.pal.col}>${stripTags(t)}</col>`])) })],
    mine('daily'),
    ['writch', 'writch style ("Title - task")', (D, P) => ({ DailyActivityContacts: D.daily.map(d => [`DailyActivityContacts_${d.row}_HUDDescription${d.suf}`,
      `<col:${P.writch.text}>${stripTags(d.title)} - ${d.hud.replace(/<col:[^>]*>(.*?)<\/col>/gi, `</col><col:${P.writch.value}>$1</col><col:${P.writch.text}>`).replace(/<col:[^>]*>\s*<\/col>/gi, '')}</col>`]) })]] },
  { id: 'missions', label: 'Mission briefs', files: 'TaskObjectives', variants: [
    ['stock', 'Game default (story briefs)'],
    ['designer', 'Stage list (designer)', (D) => genLines(D, 'missions')],
    ['iazer', 'Stage chain with item sizes (iazer style)', (D, P, c) => genLines(D, 'missions', { cur: c.pal.col, rest: 'White', sizes: true, stop: false, words: 'iazer' })],
    ['writch', 'Stage chain purple / pink (writch style)', (D, P) => genLines(D, 'missions', { cur: P.writch.cur, rest: P.writch.rest, sizes: true, stop: false, words: 'iazer' })],
    ['next', 'Current Stage / Next Stage', (D, P, c) => genLines(D, 'missions', { mode: 'next', cur: c.pal ? c.pal.col : 'Valentine_Pink', rest: 'Purple', stop: false })],
    ['window', 'Current | Next | … until the last stage', (D, P, c) => genLines(D, 'missions', { mode: 'window', cur: c.pal ? c.pal.col : 'Valentine_Pink', rest: 'White', stop: false })], mine('missions')] },
  { id: 'titles', label: 'Mission titles', files: 'MissionTemplates', variants: [
    ['stock', 'Game default'],
    ['icons', 'Equipment icons after the title', (D, P) => {
      const eq = equipOf(D);
      return mapStock(P, 'MissionTemplates', (k, v) => { const m = /^MissionTemplates_(.+)_MissionTitle$/.exec(k); const e = m && eq.get(m[1]); return e && e.length ? `${v} ${e.map(x => `<Images:APBMenus_Art_EquipmentIcons.Icon_Equipment_${EQUIP_ICON[x]};Resize=TRUE XL=16 YL=16>`).join('')}` : undefined; });
    }],
    ['equip', 'Equipment in the title, e.g. [Spray Can] (iazer style)', (D, P, c) => {
      const eq = new Map([...equipOf(D)].map(([k, v]) => [k, v.join('/')]));
      const col = c.pal ? (c.pal.main || c.pal.enemy) : [1, 0.69, 0];
      return mapStock(P, 'MissionTemplates', (k, v) => { const m = /^MissionTemplates_(.+)_MissionTitle$/.exec(k); const e = m && eq.get(m[1]); return e ? `${v} <Color:R=1 G=1 B=1>[${tagRGB(col)}${e}<Color:R=1 G=1 B=1>]<Color:/>` : undefined; });
    }]] },
  { id: 'weapons', label: 'Weapon descriptions', files: 'WeaponItemTypes', variants: [
    ['stock', 'Game default'], ['designer', 'Stats + description (designer)', (D, P) => restyleStats(D, 'weapons', 'designer', P)],
    ['iazer', 'Stat sheet, white labels (iazer style)', (D, P) => restyleStats(D, 'weapons', 'iazer', P)],
    ['writch', 'Stat sheet, gradient labels (writch style)', (D, P) => restyleStats(D, 'weapons', 'writch', P)], mine('weapons')] },
  { id: 'vehicles', label: 'Vehicle descriptions', files: 'VehicleItemTypes', variants: [
    ['stock', 'Game default'], ['designer', 'Stats + description (designer)', (D, P) => restyleStats(D, 'vehicles', 'designer', P)],
    ['iazer', 'Stat sheet, white labels (iazer style)', (D, P) => restyleStats(D, 'vehicles', 'iazer', P)],
    ['writch', 'Stat sheet, gradient labels (writch style)', (D, P) => restyleStats(D, 'vehicles', 'writch', P)], mine('vehicles')] },
  { id: 'roles', label: 'Player roles', files: 'PlayerRoles', variants: [
    ['stock', 'Game default'], ['designer', 'Rank list with totals (designer)', (D) => genLines(D, 'roles')], mine('roles')] },
  { id: 'names', label: 'Item names', files: 'InventoryItemTypes', variants: [
    ['stock', 'Game default'],
    ['vivid', 'Coloured by category', (D) => { const g = gen('names'), groups = {}; g.groups(D).forEach(([n], i) => groups[n] = { on: true, gmode: 'solid', g1: VIVID[i % VIVID.length] }); return genLines(D, 'names', { groups }); }],
    ['writch', 'Purple to red gradient (writch style)', (D, P) => { const g = gen('names'), groups = {}; g.groups(D).forEach(([n]) => groups[n] = { on: true, gmode: 'smooth', g1: hexOf(P.writch.grad[0]), g2: hexOf(P.writch.grad[1]) }); return genLines(D, 'names', { groups }); }], mine('names')] },
  { id: 'shop', label: 'Weapon categories', files: 'ShopUIFilters', variants: [
    ['stock', 'Game default'],
    ['tool', 'My layout from the Weapon categories tab', (D) => ({ ShopUIFilters: categoryLines(D) })],
    ['iazer', 'Coloured categories in a fixed order (iazer style)', (D, P) => {
      const rows = Object.values(D.shopFilters).flat(); let n = 0;
      return { ShopUIFilters: rows.map(r => [`ShopUIFilters_${r.row}_Name`, `<Color:F=${String(n++ % 100).padStart(2, '0')} ${apbTag(hex2rgb(VIVID[n % VIVID.length])).slice(7, -1)}>${stripTags(r.name)}<Color:/>`]) };
    }]] },
  { id: 'hud', label: 'HUD & combat messages', files: 'HUDMessages, HUDCombatMessages', variants: [
    ['stock', 'Game default'],
    ['iazer', 'Set colours, compact combat lines (iazer style)', (D, P, c) => ({
      ...mapStock(P, 'HUDMessages', (k, v) => recolHud(v, 'White', c.pal.col, 'Red')),
      ...mapStock(P, 'HUDCombatMessages', (k, v) => /_Line2$/.test(k) && v.trim() ? '' : /_Line0$/.test(k) && v.includes('<CharacterNameA>') ? `${tagRGB(/Enemy|Opponent/i.test(k) ? c.pal.enemy : c.pal.team)}${v}<Color:/>` : undefined) })],
    ['writch', 'Pale grey with purple highlights (writch style)', (D, P) => ({ ...mapStock(P, 'HUDMessages', (k, v) => recolHud(v, 'Grey_Pale', P.writch.value, 'Red')) })]] },
  { id: 'chat', label: 'Chat tags', files: 'ChatMessageCategories', variants: [
    ['stock', 'Game default'],
    ['short', 'One-letter tags (iazer style)', (D, P) => { const used = new Set(); return mapStock(P, 'ChatMessageCategories', (k, v) => {
      if (!/_Tag$/.test(k) || !v.trim()) return undefined; const w = stripTags(v).trim(); let t = w[0].toUpperCase(), i = 1;
      while (used.has(t) && i < w.length) t = (w[0] + w[i++]).toUpperCase(); used.add(t); return t; }); }]] },
  { id: 'targets', label: 'Objective names', files: 'TaskTargetTypes', variants: [
    ['stock', 'Game default'], ['hidden', 'Hidden (iazer / writch style)', (D, P) => mapStock(P, 'TaskTargetTypes', (k, v) => /DisplayName/.test(k) ? ' ' : undefined)]] },
  { id: 'streets', label: 'Street, block & beacon names', files: 'StreetName, DistrictBlocks, LocationBeaconInstances', variants: [
    ['stock', 'Game default'],
    ['small', 'Small engine font (iazer Grey / White engine style)', (D, P) => streetLines(P, { font: 'EngineFonts.SmallFont' })],
    ['hidden', 'Hidden (writch style)', (D, P) => streetLines(P, { hide: true })]] }
];
const STREET_FILES = ['StreetName', 'DistrictBlocks', 'LocationBeaconInstances'];
function streetLines(P, o) {
  const out = {};
  for (const f of STREET_FILES) {
    if (o.files && !o.files[f]) continue;
    out[f] = P.stock[f].lines.filter(([k, v]) => v.trim()).map(([k, v]) => {
      if (o.hide) return [k, ''];
      let t = stripTags(v);
      if (o.colour) t = `<Color:R=${(o.colour[0] / 255).toFixed(3)} G=${(o.colour[1] / 255).toFixed(3)} B=${(o.colour[2] / 255).toFixed(3)} A=${o.alpha}>${t}<Color:/>`;
      if (o.font) t = `<Fonts:${o.font}>${t}<Fonts:/>`;
      return [k, t];
    });
  }
  return out;
}

const SETS = P => Object.entries(P.iazer).map(([id, p]) => ({ id: 'iazer:' + id, label: id === 'Green_Red' ? 'Game Default +' : 'iazer · ' + p.label, note: id === 'Green_Red' ? 'The game\'s own colours (green team, red enemy) plus stage chains, equipment in titles, stat sheets, compact combat lines and short chat tags.' : undefined, credit: 'iazer', pal: p,
  pick: { daily: 'iazer', missions: 'iazer', titles: 'equip', weapons: 'iazer', vehicles: 'iazer', roles: 'designer', names: 'vivid', shop: 'iazer', hud: 'iazer', chat: 'short', targets: 'hidden', streets: id === 'Grey_White' ? 'small' : 'stock' } }));
const BUNDLES = P => [
  { id: 'stock', label: 'Clean stock', note: 'Game text only (use it to reset files).', pick: {} },
  { id: 'designer', label: 'Designer default', note: 'Our generators: stats, ranks, stage lists, recoloured dailies.', pick: { daily: 'designer', missions: 'designer', weapons: 'designer', vehicles: 'designer', roles: 'designer' } },
  ...SETS(P),
  { id: 'writch', label: 'writch', credit: 'writch', note: 'Purple / pink look, gradient stat sheets, hidden street names.', pal: { col: 'Purple_Dark', team: [0.6, 0, 1], enemy: [1, 0, 0.2] },
    pick: { daily: 'writch', missions: 'writch', weapons: 'writch', vehicles: 'writch', roles: 'designer', names: 'writch', hud: 'writch', targets: 'hidden', streets: 'hidden' } }
];

export async function initPresets(root, D) {
  const P = await (await fetch('presets.json')).json();
  const base = BUNDLES(P);
  const resolve = v => v && v.startsWith('#') ? { name: (nearestNamed(hex2rgb(v)) || { name: 'White' }).name, rgb: hex2rgb(v).map(x => +(x / 255).toFixed(4)) }
    : { name: v || 'White', rgb: (namedRgb(v) || [255, 255, 255]).slice(0, 3).map(x => +(x / 255).toFixed(4)) };
  const custom = () => { const m = resolve(st.custom.main), f = resolve(st.custom.friend), e = resolve(st.custom.enemy);
    return { id: 'custom', label: 'Custom colours', note: 'Your main, friendly and enemy colours applied to every file; fine-tune any file afterwards.',
      pal: { col: m.name, main: m.rgb, team: f.rgb, enemy: e.rgb },
      pick: { daily: 'designer', missions: 'window', titles: 'equip', weapons: 'designer', vehicles: 'designer', roles: 'designer', hud: 'iazer' } }; };
  const bundlesNow = () => [...base.slice(0, 2), custom(), ...base.slice(2)];
  const st = store.get('presets', { bundle: 'designer', pick: {}, custom: { main: 'Valentine_Pink', friend: '#45ff16', enemy: '#e10000' }, ext: 'GER', fromInt: true, street: { on: false, style: 'white', colour: '#ffffff', alpha: 1, font: 'EngineFonts.SmallFont', files: { StreetName: true, DistrictBlocks: true, LocationBeaconInstances: true } } });
  const save = () => store.set('presets', st);
  st.custom = st.custom || { main: 'Valentine_Pink', friend: '#45ff16', enemy: '#e10000' };
  const bundle = () => bundlesNow().find(b => b.id === st.bundle) || base[0];
  const setTheme = () => { const p = bundle().pal; THEME = p ? { col: p.col, hex: p.main ? hexOf(p.main) : rgb2hex(namedRgb(p.col) || [255, 255, 255]) } : null; };
  const choice = id => st.pick[id] || bundle().pick[id] || 'stock';
  const ctx = () => ({ pal: bundle().pal || P.iazer.Green_Red });
  let userFiles = null;
  const body = h('div');

  const build = () => {
    setTheme(); const files = {};
    for (const slot of SLOTS) {
      const v = slot.variants.find(x => x[0] === choice(slot.id));
      if (!v || !v[2]) continue;
      const out = v[2](D, P, ctx());
      for (const [f, ls] of Object.entries(out)) files[f] = (files[f] || []).concat(ls);
    }
    if (st.street.on) Object.assign(files, streetLines(P, { colour: st.street.colour ? hex2rgb(st.street.colour) : null, alpha: st.street.alpha, font: st.street.font, files: st.street.files }));
    return files;
  };
  const sample = slot => {
    setTheme(); const v = slot.variants.find(x => x[0] === choice(slot.id));
    if (!v || !v[2]) return null;
    try { const out = v[2](D, P, ctx()); const f = Object.keys(out)[0], l = (out[f] || []).find(([k, val]) => val && val.trim()); return l ? l[1] : null; } catch { return null; }
  };

  const draw = () => {
    body.innerHTML = '';
    const bundles = bundlesNow();
    const bcards = h('div', { class: 'bundles' }, bundles.map(b => h('button', { class: 'bundle' + (b.id === st.bundle ? ' on' : ''), onclick: () => { st.bundle = b.id; st.pick = {}; save(); draw(); } },
      h('b', {}, b.label), b.pal ? h('span', { class: 'pal' }, [b.pal.team, b.pal.enemy].map(c => h('i', { style: `background:${hexOf(c)}` }))) : null, h('small', {}, b.note || 'Recreated colour set: dailies, stage chain with sizes, equipment titles, stat sheets, compact combat lines, short chat tags.'))));
    const colField = (label, key, hint) => {
      const v = st.custom[key], isHex = v.startsWith('#');
      const sel = h('select', { onchange: e => { st.custom[key] = e.target.value === '#' ? (isHex ? v : rgb2hex((namedRgb(v) || [255, 255, 255]).slice(0, 3))) : e.target.value; save(); draw(); } },
        h('option', { value: '#', selected: isHex }, 'Custom hex…'), named().filter(n => n.kind === 'colour' && n.rgba[3] > 200).map(n => h('option', { value: n.name, selected: n.name === v }, n.name)));
      const sw = h('span', { class: 'cswatch big', style: `background:${isHex ? v : rgb2hex((namedRgb(v) || [255, 255, 255]).slice(0, 3))}` });
      return h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'fv' }, sw, sel, isHex ? colourPick('ui', v, x => { st.custom[key] = x; save(); clearTimeout(colField.t); colField.t = setTimeout(draw, 250); }) : null), h('span', { class: 'hint' }, hint));
    };
    const quick = st.bundle === 'custom' ? h('div', { class: 'card glass quick' }, h('h3', {}, 'Quick colours'),
      h('div', { class: 'quickgrid' }, colField('Main colour', 'main', 'Accent of the whole config: current mission stage, daily values, kill / rank lines, equipment. A game colour name works in every file; a hex code is matched to the nearest game colour in HUD text.'),
        colField('Friendly colour', 'friend', 'Team / friendly names in combat messages (kill feed).'),
        colField('Enemy colour', 'enemy', 'Opponent names in combat messages (kill feed).')),
      h('p', { class: 'hint' }, 'Every file below follows these colours. Use "Fine-tune" on a file to open its generator with these settings for detailed changes; the file then uses your settings from the Generators tab.')) : null;
    const slots = h('div', { class: 'slots' }, SLOTS.map(slot => {
      const cur = choice(slot.id), smp = sample(slot);
      const fine = () => { const v = slot.variants.find(x => x[0] === cur); if (!v || !v[2]) return; setTheme(); LASTGEN = null; v[2](D, P, ctx()); if (!LASTGEN) return;
        store.set('gen-' + LASTGEN.id, LASTGEN.s); st.pick[slot.id] = 'mine'; save(); location.hash = 'gen/' + LASTGEN.id; };
      const canFine = cur !== 'stock' && cur !== 'mine' && (() => { const v = slot.variants.find(x => x[0] === cur); if (!v || !v[2]) return false; LASTGEN = null; try { setTheme(); v[2](D, P, ctx()); } catch { } return !!LASTGEN; })();
      return h('div', { class: 'slot card glass' + (st.pick[slot.id] ? ' custom' : '') },
        h('div', { class: 'slothead' }, h('b', {}, slot.label), h('code', {}, slot.files), st.pick[slot.id] ? h('button', { class: 'mini', title: 'Back to the bundle choice', onclick: () => { delete st.pick[slot.id]; save(); draw(); } }, 'bundle') : null),
        h('div', { class: 'row' }, h('select', { onchange: e => { st.pick[slot.id] = e.target.value; save(); draw(); } }, slot.variants.map(([id, label]) => h('option', { value: id, selected: id === cur }, label))),
          canFine ? h('button', { class: 'mini', title: 'Open this file\'s generator with these settings', onclick: fine }, 'Fine-tune') : null,
          cur === 'mine' ? h('button', { class: 'mini', onclick: () => { location.hash = 'gen/' + ({ daily: 'daily', missions: 'missions', weapons: 'weapons', vehicles: 'vehicles', roles: 'roles', names: 'names' }[slot.id]); } }, 'Open generator') : null),
        smp ? h('div', { class: 'gamebox small' + (slot.id === 'streets' ? ' map' : /^(daily|missions|hud|chat|targets)$/.test(slot.id) ? ' hud' : ''), html: render(smp) }) : h('div', { class: 'hint' }, 'No change: the game\'s own text is used.'));
    }));
    const sw = st.street;
    const prev = h('div', { class: 'gamebox small map' });
    const showPrev = () => { prev.innerHTML = render(streetLines(P, { colour: sw.colour ? hex2rgb(sw.colour) : null, alpha: sw.alpha, font: sw.font, files: { StreetName: true } }).StreetName[0][1]); };
    const street = h('div', { class: 'card glass event' }, h('h3', {}, 'Event: show street names'),
      h('p', { class: 'hint' }, 'Turns street, block and beacon names back on over any preset, e.g. to find your way to the next pumpkin during the Halloween event. Overrides the "Street, block & beacon names" choice.'),
      toggle('Show street names', sw.on, v => { sw.on = v; save(); draw(); }),
      sw.on ? h('div', {}, h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Style'), seg([['white', 'White, small (designer)'], ['iazer', 'Small engine font (iazer)'], ['set', 'Bundle colour'], ['custom', 'Custom']], sw.style, v => {
          sw.style = v; if (v === 'white') Object.assign(sw, { colour: '#ffffff', alpha: 1, font: 'EngineFonts.SmallFont' }); if (v === 'iazer') Object.assign(sw, { colour: '', alpha: 1, font: 'EngineFonts.SmallFont' });
          if (v === 'set') Object.assign(sw, { colour: hexOf(ctx().pal.team), alpha: 1, font: 'EngineFonts.SmallFont' }); save(); draw(); })),
        sw.style === 'custom' ? h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Colour'), colourPick('ui', sw.colour || '#ffffff', v => { sw.colour = v; save(); showPrev(); }),
          h('span', { class: 'hint' }, 'Opacity'), h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: sw.alpha, oninput: e => { sw.alpha = +e.target.value; save(); showPrev(); } }),
          h('span', { class: 'hint' }, 'Font'), h('select', { onchange: e => { sw.font = e.target.value; save(); showPrev(); } }, [['', 'Game default'], ['EngineFonts.SmallFont', 'Small'], ['EngineFonts.TinyFont', 'Tiny']].concat(FONTS.filter(f => f.startsWith('APB')).map(f => [f, f.split('.').pop().replace(/_/g, ' ')])).map(([v, l]) => h('option', { value: v, selected: sw.font === v }, l)))) : null,
        h('div', { class: 'row' }, STREET_FILES.map(f => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: sw.files[f], onchange: e => { sw.files[f] = e.target.checked; save(); } }), f))), prev) : null);
    if (sw.on) showPrev();

    const userIn = h('input', { type: 'file', accept: '.zip', multiple: true });
    userIn.onchange = async () => { userFiles = await readInputs(userIn.files); draw(); };
    const msg = h('div', { class: 'hint' });
    const out = h('div', { class: 'card glass' }, h('h3', {}, 'Download'),
      h('label', { class: 'drop' }, userIn, '🗜 ', h('span', {}, userFiles ? `${userFiles.length} files from your config: changed files are merged into them` : h('span', {}, 'Optional: your config ', h('b', {}, 'zip'), ' to merge into'))),
      LOC.files.length ? h('div', { class: 'hint' }, `Game folder set: files are merged into its GER files${userFiles ? ' (the zip wins where both have a file)' : ''}.`) : h('div', { class: 'hint' }, 'Or set your game folder at the top of the page: its GER files are used as the base.'),
      LOC.files.length ? toggle('Files without a GER copy start from the game\'s full English (INT) file', st.fromInt, v => { st.fromInt = v; save(); }) : null,
      h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Extension'), seg([['GER', '.GER'], ['INT', '.INT']], st.ext, v => { st.ext = v; save(); }),
        h('button', { class: 'primary', onclick: async () => {
          const files = build(), zip = [], report = [];
          for (const [f, ls] of Object.entries(files)) {
            const mine = userFiles && userFiles.find(x => x.name.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase() === f.toLowerCase());
            const dir = !mine && findLoc(f, st.fromInt ? ['GER', 'INT'] : ['GER']);
            const base = mine ? { ...decodeText(mine.data), name: mine.name } : dir ? await readLoc(dir) : null;
            const bySec = new Map(); ls.forEach(([k, v, s]) => { const sc = s || f; if (!bySec.has(sc)) bySec.set(sc, []); bySec.get(sc).push([k, v]); });
            let cur = base, r;
            for (const [sc, l] of bySec) { r = buildFile(sc, l, cur); cur = { text: r.text, enc: r.enc, bom: r.bom }; }
            const path = mine ? mine.name : dir && dir.lang === 'GER' ? dir.path : `APBGame/Localization/GER/${f}.${st.ext}`;
            zip.push({ name: path, data: encodeText(cur.text, cur.enc || 'utf-16le', cur.bom !== false) }); report.push(`${f}: ${ls.length} lines`);
          }
          if (!zip.length) { msg.textContent = 'Nothing to write: every choice is the game default.'; return; }
          download(await writeZip(zip), 'APB-preset-config.zip'); msg.textContent = 'Saved: ' + report.join(' · ');
        } }, 'Download zip')), msg);

    const credits = h('p', { class: 'hint' }, 'Styles recreated from: ', P.credits.map((c, i) => h('span', {}, i ? ' · ' : '', h('b', {}, c.name), ` (${c.what}${c.with ? '; with ' + c.with : ''})`)), '. No files from these packs are included; every line is built from the game\'s own text and data.');
    body.append(h('div', { class: 'card glass' }, h('h3', {}, 'Presets'), h('p', { class: 'hint' }, 'Pick a bundle, then change any file on its own. Everything is built from the game\'s own data in your browser.'), bcards, credits),
      quick || '', slots, street, out);
  };
  root.append(body); draw(); onFolder(draw);
  window.addEventListener('hashchange', () => { if (/^#?presets/.test(location.hash) || !location.hash) draw(); });
}
