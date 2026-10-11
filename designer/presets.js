import { $, $$, h, render, seg, toggle, colourPick, colourText, hex2rgb, rgb2hex, apbTag, FONTS, store, intValue, buildFile, setNamed, named, namedRgb, nearestNamed, namedSelect } from './core.js';
import { GENS, stripTags } from './gen.js';
import { categoryFiles } from './categories.js';
import { imagePicker, imageTag } from './imgpick.js';
import { LOC, findLoc, readLoc, onFolder, inGame, hasConfig } from './folder.js';
import { readInputs, writeZip, encodeText, decodeText, download } from '../config/lib.js';

const NL = '↵';
const gen = id => GENS.find(g => g.id === id);
let THEME = null, LASTGEN = null;
const themeFor = id => !THEME ? {} : ({ daily: { value: THEME.col }, missions: { cur: THEME.col }, weapons: { hi: THEME.hex }, vehicles: { hi: THEME.hex }, roles: { rank: THEME.hex }, contacts: { lvl: THEME.hex } }[id] || {});
const genLines = (D, id, over = {}, raw = false) => {
  const g = gen(id), s = { ...structuredClone(g.defaults), ...(raw ? {} : themeFor(id)), ...over }; LASTGEN = { id, s };
  return { [g.file]: g.items(D, s).filter(x => x.value !== undefined).map(x => [x.key, x.value, x.section]) };
};
const mine = id => ['mine', 'My generator settings', (D) => genLines(D, id, store.get('gen-' + id, structuredClone(gen(id).defaults)), true)];
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
const namedOf = c => (nearestNamed(c.map(v => v * 255)) || { name: 'White' }).name;
const recolHud = (v, base, hi, pal) => {
  if (!v.trim()) return undefined;
  const team = pal && pal.team ? namedOf(pal.team) : hi, enemy = pal && pal.enemy ? namedOf(pal.enemy) : hi;
  let x = v.replace(/<col:\s*([A-Za-z_]+)\s*>/gi, (m, n) => `<col:${/^Action_Team/i.test(n) ? team : /^Action_Enemy/i.test(n) ? enemy : hi}>`);
  if (!/^<col:/i.test(x.trim())) x = `<col:${base}>${x}</col>`;
  return x;
};

export const SLOTS = [
  { id: 'daily', label: 'Daily activities', files: 'DailyActivityContacts', variants: [
    ['stock', 'Game default'],
    ['designer', '', (D) => genLines(D, 'daily', { hud: 'colour' })],
    ['short', 'Task: Count', (D) => genLines(D, 'daily', { hud: 'short' })],
    ['reward', 'Title [Reward]', (D) => genLines(D, 'daily', { title: 'both', hud: 'colour' })],
    ['iazer', '', (D, P, c) => ({ DailyActivityContacts: D.daily.flatMap(d => [['HUDDescription', d.hud], ['LongDescription', d.long]].map(([f, t]) => [`DailyActivityContacts_${d.row}_${f}${d.suf}`, `<col:${c.pal.col}>${stripTags(t)}</col>`])) })],
    mine('daily'),
    ['writch', '', (D, P) => ({ DailyActivityContacts: D.daily.map(d => [`DailyActivityContacts_${d.row}_HUDDescription${d.suf}`,
      `<col:${P.writch.text}>${stripTags(d.title)} - ${d.hud.replace(/<col:[^>]*>(.*?)<\/col>/gi, `</col><col:${P.writch.value}>$1</col><col:${P.writch.text}>`).replace(/<col:[^>]*>\s*<\/col>/gi, '')}</col>`]) })]] },
  { id: 'missions', label: 'Mission briefs', files: 'TaskObjectives', variants: [
    ['stock', 'Game default'],
    ['designer', '', (D) => genLines(D, 'missions')],
    ['iazer', '', (D, P, c) => genLines(D, 'missions', { cur: c.pal.col, rest: 'White', sizes: true, stop: false, words: 'iazer' })],
    ['writch', '', (D, P) => genLines(D, 'missions', { cur: P.writch.cur, rest: P.writch.rest, sizes: true, stop: false, words: 'iazer' })],
    ['next', 'Current / Next', (D, P, c) => genLines(D, 'missions', { mode: 'next', cur: c.pal ? c.pal.col : 'Valentine_Pink', rest: 'Purple', stop: false })],
    mine('missions')] },
  { id: 'titles', label: 'Mission titles', files: 'MissionTemplates', variants: [
    ['stock', 'Game default'],
    ['icons', 'Title [Equipment Icons]', (D, P) => {
      const eq = equipOf(D);
      return mapStock(P, 'MissionTemplates', (k, v) => { const m = /^MissionTemplates_(.+)_MissionTitle$/.exec(k); const e = m && eq.get(m[1]); return e && e.length ? `${v} ${e.map(x => `<Images:APBMenus_Art_EquipmentIcons.Icon_Equipment_${EQUIP_ICON[x]};Resize=TRUE XL=16 YL=16>`).join('')}` : undefined; });
    }],
    ['equip', 'Title [Equipment]', (D, P, c) => {
      const eq = new Map([...equipOf(D)].map(([k, v]) => [k, v.join('/')]));
      const col = c.pal ? (c.pal.main || c.pal.enemy) : [1, 0.69, 0];
      return mapStock(P, 'MissionTemplates', (k, v) => { const m = /^MissionTemplates_(.+)_MissionTitle$/.exec(k); const e = m && eq.get(m[1]); return e ? `${v} <Color:R=1 G=1 B=1>[${tagRGB(col)}${e}<Color:R=1 G=1 B=1>]<Color:/>` : undefined; });
    }]] },
  { id: 'weapons', label: 'Weapon descriptions', files: 'WeaponItemTypes', variants: [
    ['stock', 'Game default'], ['designer', '', (D, P) => restyleStats(D, 'weapons', 'designer', P)],
    ['iazer', '', (D, P) => restyleStats(D, 'weapons', 'iazer', P)],
    ['writch', '', (D, P) => restyleStats(D, 'weapons', 'writch', P)], mine('weapons')] },
  { id: 'vehicles', label: 'Vehicle descriptions', files: 'VehicleItemTypes', variants: [
    ['stock', 'Game default'], ['designer', '', (D, P) => restyleStats(D, 'vehicles', 'designer', P)],
    ['iazer', '', (D, P) => restyleStats(D, 'vehicles', 'iazer', P)],
    ['writch', '', (D, P) => restyleStats(D, 'vehicles', 'writch', P)], mine('vehicles')] },
  { id: 'roles', label: 'Player roles', files: 'PlayerRoles', variants: [
    ['stock', 'Game default'], ['designer', '', (D) => genLines(D, 'roles')], mine('roles')] },
  { id: 'names', label: 'Item names', files: 'InventoryItemTypes', variants: [
    ['stock', 'Game default'],
    ['iazer', '', (D) => SLOT_FN.names.vivid(D)],
    ['vivid', 'Category colours', (D) => { const g = gen('names'), groups = {}; g.groups(D).forEach(([n], i) => groups[n] = { on: true, gmode: 'solid', g1: VIVID[i % VIVID.length] }); return genLines(D, 'names', { groups }); }],
    ['writch', '', (D, P) => { const g = gen('names'), groups = {}; g.groups(D).forEach(([n]) => groups[n] = { on: true, gmode: 'smooth', g1: hexOf(P.writch.grad[0]), g2: hexOf(P.writch.grad[1]) }); return genLines(D, 'names', { groups }); }], mine('names')] },
  { id: 'shop', label: 'Categories', files: 'ShopUIFilters, InventoryItemInfraCategories', variants: [
    ['stock', 'Game default'],
    ['tool', 'My Categories layout', (D) => categoryFiles(D)],
    ['fixed', 'Fixed order, coloured', (D, P) => {
      const rows = Object.values(D.shopFilters).flat(); let n = 0;
      return { ShopUIFilters: rows.map(r => [`ShopUIFilters_${r.row}_Name`, `<Color:F=${String(n++ % 100).padStart(2, '0')} ${apbTag(hex2rgb(VIVID[n % VIVID.length])).slice(7, -1)}>${stripTags(r.name)}<Color:/>`]) };
    }]] },
  { id: 'hud', label: 'HUD & combat messages', files: 'HUDMessages, HUDCombatMessages', variants: [
    ['stock', 'Game default'],
    ['iazer', '', (D, P, c) => ({
      ...mapStock(P, 'HUDMessages', (k, v) => recolHud(v, 'White', c.pal.col, c.pal)),
      ...mapStock(P, 'HUDCombatMessages', (k, v) => /_Line2$/.test(k) && v.trim() ? '' : /_Line0$/.test(k) && v.includes('<CharacterNameA>') ? `${tagRGB(/Enemy|Opponent/i.test(k) ? c.pal.enemy : c.pal.team)}${v}<Color:/>` : undefined) })],
    ['writch', '', (D, P, c) => ({ ...mapStock(P, 'HUDMessages', (k, v) => recolHud(v, 'Grey_Pale', P.writch.value, c.pal)) })]] },
  { id: 'chat', label: 'Chat tags', files: 'ChatMessageCategories', variants: [
    ['stock', 'Game default'],
    ['short', 'One letter', (D, P) => { const used = new Set(); return mapStock(P, 'ChatMessageCategories', (k, v) => {
      if (!/_Tag$/.test(k) || !v.trim()) return undefined; const w = stripTags(v).trim(); let t = w[0].toUpperCase(), i = 1;
      while (used.has(t) && i < w.length) t = (w[0] + w[i++]).toUpperCase(); used.add(t); return t; }); }]] },
  { id: 'targets', label: 'Objective names', files: 'TaskTargetTypes', variants: [
    ['stock', 'Game default'], ['hidden', 'Hidden', (D, P) => mapStock(P, 'TaskTargetTypes', (k, v) => /DisplayName/.test(k) ? ' ' : undefined)]] },
  { id: 'streets', label: 'Street, block & beacon names', files: 'StreetName, DistrictBlocks, LocationBeaconInstances', variants: [
    ['stock', 'Game default'],
    ['small', 'Small font', (D, P) => streetLines(P, { font: 'EngineFonts.SmallFont' })],
    ['icon', 'HUD icon', (D, P) => streetLines(P, { image: { k: 'icon', ref: 'Tagger_Reaper', w: 32, h: 32 }, yl: 16 })],
    ['image', 'Custom image', (D, P) => { const s = streetImg(); return streetLines(P, { image: s.sel, yl: s.yl, tint: s.tint, keep: s.keep }); }],
    ['hidden', 'Hidden', (D, P) => streetLines(P, { hide: true })]] }
];
const STYLES = ['designer', 'iazer', 'writch'];
const SAMPLE_KEYS = {
  hud: ['HUDMessages_AM_CombatKillTeam_DisplayText', 'HUDMessages_AM_FameYouContactGainLevel_DisplayText', 'HUDMessages_AM_Abandon_Match_Fail_DisplayText'],
  streets: ['StreetName_FinancialShianxi_DisplayedStreetName', 'StreetName_FinancialMain_DisplayedStreetName', 'DistrictBlocks_Financial_Block01_DisplayName', 'LocationBeaconInstances_FinancialBeacon47_LocalisedName']
};
const PH = { KillerCharacterName: 'You', CharacterNameA: 'You', KilledCharacterName: 'Rival', CharacterNameB: 'Rival', KillerAssistName: '', ContactName: 'Kenzie Trinh', ContactLevel: '5', WeaponIcon: '<hudtexture:KillIcon_Generic>' };
const fillPH = v => String(v).replace(/<([A-Za-z]+)>/g, (m, n) => n in PH ? PH[n] : /Name|Level|Length|Description/.test(n) ? n.replace(/([a-z])([A-Z])/g, '$1 $2') : m);
const STREET_SPOTS = [[24, 30], [70, 62], [36, 78], [78, 22]];
const SLOT_FN = {};
for (const slot of SLOTS) {
  SLOT_FN[slot.id] = Object.fromEntries(slot.variants.filter(v => v[2]).map(v => [v[0], v[2]]));
  slot.styles = Object.fromEntries(slot.variants.filter(v => STYLES.includes(v[0])).map(v => [v[0], v[2]]));
  if (!Object.keys(slot.styles).length) continue;
  const i = slot.variants.findIndex(v => STYLES.includes(v[0]));
  slot.variants = slot.variants.filter(v => !STYLES.includes(v[0]));
  slot.variants.splice(i, 0, ['preset', 'Preset', (D, P, c) => { const fn = slot.styles[(c.styleOf && c.styleOf[slot.id]) || c.family] || slot.styles.designer; return fn ? fn(D, P, c) : {}; }]);
}
const LEGACY = { designer: 'preset', iazer: 'preset', writch: 'preset' };
const legacyPick = (slot, v) => slot === 'missions' && v === 'window' ? 'next' : slot === 'shop' && v === 'iazer' ? 'fixed' : slot === 'streets' && v === 'writch' ? 'icon' : LEGACY[v] || v;
const STREET_FILES = ['StreetName', 'DistrictBlocks', 'LocationBeaconInstances'];
const STREET_IMG = { sel: { k: 'icon', ref: 'Tagger_Reaper', w: 32, h: 32 }, yl: 16, tint: null, keep: false };
const streetImg = () => { const p = store.get('presets', {}); return { ...STREET_IMG, ...(p.streetImg || {}) }; };
function streetLines(P, o) {
  const out = {};
  for (const f of STREET_FILES) {
    if (o.files && !o.files[f]) continue;
    out[f] = P.stock[f].lines.filter(([k, v]) => v.trim()).map(([k, v]) => {
      if (o.hide) return [k, ''];
      if (o.image !== undefined) { const img = imageTag(o.image, o.yl || 16, o.tint); return [k, img ? img + (o.keep ? ' ' + stripTags(v) : '') : stripTags(v)]; }
      let t = stripTags(v);
      if (o.colour) t = `<Color:R=${(o.colour[0] / 255).toFixed(3)} G=${(o.colour[1] / 255).toFixed(3)} B=${(o.colour[2] / 255).toFixed(3)} A=${o.alpha}>${t}<Color:/>`;
      if (o.font) t = `<Fonts:${o.font}>${t}<Fonts:/>`;
      return [k, t];
    });
  }
  return out;
}

const SETS = P => Object.entries(P.iazer).map(([id, p]) => ({ id: 'iazer:' + id, label: id === 'Green_Red' ? 'Game Default +' : 'iazer · ' + p.label, note: id === 'Green_Red' ? 'The game\'s own colours (green team, red enemy) plus stage chains, equipment in titles, stat sheets, compact combat lines and short chat tags.' : undefined, credit: 'iazer', pal: p,
  family: 'iazer', pick: { daily: 'preset', missions: 'preset', titles: 'equip', weapons: 'preset', vehicles: 'preset', roles: 'preset', names: 'preset', shop: 'fixed', hud: 'preset', chat: 'short', targets: 'hidden', streets: id === 'Grey_White' ? 'small' : 'stock' } }));
const BUNDLES = P => [
  { id: 'stock', label: 'Clean stock', note: 'Game text only (use it to reset files).', pick: {} },
  { id: 'designer', label: 'Designer default', note: 'Our generators: stats, ranks, stage lists, recoloured dailies.', family: 'designer', pick: { daily: 'preset', missions: 'preset', weapons: 'preset', vehicles: 'preset', roles: 'preset' } },
  ...SETS(P),
  { id: 'writch', label: 'writch', credit: 'writch', note: 'Purple / pink look, gradient stat sheets, an icon instead of street names.', pal: { col: 'Purple_Dark', team: [0.6, 0, 1], enemy: [1, 0, 0.2] },
    family: 'writch', styleOf: { roles: 'designer' }, pick: { daily: 'preset', missions: 'preset', weapons: 'preset', vehicles: 'preset', roles: 'preset', names: 'preset', hud: 'preset', targets: 'hidden', streets: 'icon' } }
];

export async function initPresets(root, D) {
  const P = await (await fetch('presets.json')).json();
  const base = BUNDLES(P);
  const resolve = v => v && v.startsWith('#') ? { name: (nearestNamed(hex2rgb(v)) || { name: 'White' }).name, rgb: hex2rgb(v).map(x => +(x / 255).toFixed(4)) }
    : { name: v || 'White', rgb: (namedRgb(v) || [255, 255, 255]).slice(0, 3).map(x => +(x / 255).toFixed(4)) };
  const custom = () => { const m = resolve(st.custom.main), f = resolve(st.custom.friend), e = resolve(st.custom.enemy);
    return { id: 'custom', label: 'Custom colours', note: 'Your main, friendly and enemy colours applied to every file; fine-tune any file afterwards.',
      pal: { col: m.name, main: m.rgb, team: f.rgb, enemy: e.rgb },
      family: 'designer', styleOf: { hud: 'iazer' }, pick: { daily: 'preset', missions: 'next', titles: 'equip', weapons: 'preset', vehicles: 'preset', roles: 'preset', hud: 'preset' } }; };
  const bundlesNow = () => [...base.slice(0, 2), custom(), ...base.slice(2)];
  const st = store.get('presets', { bundle: 'designer', pick: {}, custom: { main: 'Valentine_Pink', friend: '#45ff16', enemy: '#e10000' }, ext: 'GER', fromInt: true, street: { on: false, style: 'white', colour: '#ffffff', alpha: 1, font: 'EngineFonts.SmallFont', files: { StreetName: true, DistrictBlocks: true, LocationBeaconInstances: true } } });
  const save = () => store.set('presets', st);
  st.custom = st.custom || { main: 'Valentine_Pink', friend: '#45ff16', enemy: '#e10000' };
  const bundle = () => bundlesNow().find(b => b.id === st.bundle) || base[0];
  const setTheme = () => { const p = bundle().pal; THEME = p ? { col: p.col, hex: p.main ? hexOf(p.main) : rgb2hex(namedRgb(p.col) || [255, 255, 255]) } : null; };
  const choice = id => legacyPick(id, st.pick[id] || bundle().pick[id] || 'stock');
  const ctx = () => ({ pal: bundle().pal || P.iazer.Green_Red, family: bundle().family || 'designer', styleOf: bundle().styleOf || {} });
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
  const samples = slot => {
    const keys = SAMPLE_KEYS[slot.id]; if (!keys) return null;
    setTheme(); const v = slot.variants.find(x => x[0] === choice(slot.id)); let out = {};
    try { if (v && v[2]) out = v[2](D, P, ctx()); } catch { }
    const vals = new Map(Object.values(out).flat().map(([k, val]) => [k, val]));
    const stock = k => { for (const f of Object.values(P.stock)) { const l = f.lines && f.lines.find(x => x[0] === k); if (l) return l[1]; } return ''; };
    return keys.map(k => vals.has(k) ? fillPH(vals.get(k)) : { key: k, stock: stock(k) });
  };
  const fileOfKey = k => k.split('_')[0];
  const mineInto = (el, items, make) => {
    const pend = items.filter(x => typeof x === 'object'); if (!pend.length) return;
    if (!hasConfig()) { make(items.map(x => typeof x === 'object' ? fillPH(x.stock) : x), false); return; }
    Promise.all(items.map(x => typeof x === 'object' ? inGame(fileOfKey(x.key)).then(g => { const v = g.value(x.key); return fillPH(v === undefined ? x.stock : v); }) : x))
      .then(vals => make(vals, true));
  };
  const preview = slot => {
    const list = samples(slot);
    const hudCls = 'gamebox small' + (/^(daily|missions|hud|chat|targets)$/.test(slot.id) ? ' hud' : '');
    if (!list) {
      const smp = sample(slot); if (smp) return h('div', { class: hudCls, html: render(smp) });
      const el = h('div', { class: 'hint' }, 'No change: the game\'s own text is used.');
      if (hasConfig()) {
        const files = slot.files.split(', '), first = (P.stock[files[0]] && P.stock[files[0]].lines.find(([k, v]) => v.trim())) || null;
        const key = first ? first[0] : null;
        if (key) inGame(files[0]).then(g => { const v = g.value(key); if (v !== undefined && g.own.has(key)) el.replaceChildren(h('div', { class: hudCls + ' mineprev', html: render(fillPH(v)) }), h('small', { class: 'hint' }, 'No change: your in-game text stays (shown).')); });
      }
      return el;
    }
    const draw = (vals, mine) => slot.id === 'streets'
      ? h('div', { class: 'gamebox small map streetmap' + (mine ? ' mineprev' : '') }, vals.map((v, i) => h('span', { class: 'lbl', style: `left:${STREET_SPOTS[i][0]}%;top:${STREET_SPOTS[i][1]}%`, html: render(v) || '&nbsp;' })))
      : h('div', { class: 'gamebox small hud' + (mine ? ' mineprev' : '') }, vals.map(v => h('div', { html: render(v) })));
    const holder = h('div', {}, draw(list.map(x => typeof x === 'object' ? fillPH(x.stock) : x), false));
    mineInto(holder, list, (vals, mine) => holder.replaceChildren(draw(vals, mine), mine && list.some(x => typeof x === 'object') ? h('small', { class: 'hint' }, 'Unchanged lines show your in-game text.') : ''));
    return holder;
  };
  const sample = slot => {
    setTheme(); const v = slot.variants.find(x => x[0] === choice(slot.id));
    if (!v || !v[2]) return null;
    try { const out = v[2](D, P, ctx()); const f = Object.keys(out)[0], l = (out[f] || []).find(([k, val]) => val && val.trim()); return l ? l[1] : null; } catch { return null; }
  };

  const streetImgUI = () => {
    const si = st.streetImg = { ...STREET_IMG, ...(st.streetImg || {}) }, picker = h('div', { hidden: true });
    return h('div', {},
      h('div', { class: 'row' }, h('button', { class: 'mini', onclick: () => { picker.hidden = !picker.hidden; if (!picker.hidden && !picker.firstChild) picker.append(imagePicker({ value: si.sel, onPick: x => { si.sel = x ? { k: x.k, ref: x.ref, w: x.w, h: x.h } : null; save(); draw(); } })); } }, 'Choose image'),
        h('code', {}, si.sel ? si.sel.ref : 'none'),
        h('span', { class: 'hint' }, 'Height'), h('input', { type: 'number', min: 8, max: 48, value: si.yl, style: 'width:60px', onchange: e => { si.yl = +e.target.value || 16; save(); draw(); } })),
      h('div', { class: 'row' }, toggle('Keep the name after the image', si.keep, v => { si.keep = v; save(); draw(); }),
        toggle('Tint', !!si.tint, v => { si.tint = v ? '#ffffff' : null; save(); draw(); }), si.tint ? colourPick('ui', si.tint, v => { si.tint = v; save(); draw(); }) : null),
      picker);
  };
  const draw = () => {
    body.innerHTML = '';
    const bundles = bundlesNow();
    const bcards = h('div', { class: 'bundles' }, bundles.map(b => h('button', { class: 'bundle' + (b.id === st.bundle ? ' on' : ''), onclick: () => { st.bundle = b.id; st.pick = {}; save(); draw(); } },
      h('b', {}, b.label), b.pal ? h('span', { class: 'pal' }, (hexOf(b.pal.team) === hexOf(b.pal.enemy) ? [b.pal.team, [1, 1, 1]] : [b.pal.team, b.pal.enemy]).map(c => h('i', { style: `background:${hexOf(c)}` }))) : null, h('small', {}, b.note || 'Recreated colour set: dailies, stage chain with sizes, equipment titles, stat sheets, compact combat lines, short chat tags.'))));
    const colField = (label, key, hint) => {
      const v = st.custom[key], isHex = v.startsWith('#');
      const sel = namedSelect({ value: isHex ? '#' : v, extra: [['#', 'Custom hex…']], list: named().filter(n => n.kind === 'colour' && n.rgba[3] > 200),
        onChange: x => { st.custom[key] = x === '#' ? (isHex ? v : rgb2hex((namedRgb(v) || [255, 255, 255]).slice(0, 3))) : x; save(); draw(); } });
      const sw = h('span', { class: 'cswatch big', style: `background:${isHex ? v : rgb2hex((namedRgb(v) || [255, 255, 255]).slice(0, 3))}` });
      return h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'fv' }, sw, sel, isHex ? colourPick('ui', v, x => { st.custom[key] = x; save(); clearTimeout(colField.t); colField.t = setTimeout(draw, 250); }) : null), h('span', { class: 'hint' }, hint));
    };
    const quick = st.bundle === 'custom' ? h('div', { class: 'card glass quick' }, h('h3', {}, 'Quick colours'),
      h('div', { class: 'quickgrid' }, colField('Main colour', 'main', 'Accent of the whole config: current mission stage, daily values, kill / rank lines, equipment. A game colour name works in every file; a hex code is matched to the nearest game colour in HUD text.'),
        colField('Friendly colour', 'friend', 'Team / friendly names in combat messages (kill feed).'),
        colField('Enemy colour', 'enemy', 'Opponent names in combat messages (kill feed).')),
      h('p', { class: 'hint' }, 'Every file below follows these colours. Use "Fine-tune" on a file to open its generator with these settings for detailed changes; the file then uses your settings from the Generators tab.')) : null;
    const slots = h('div', { class: 'slots' }, SLOTS.map(slot => {
      const cur = choice(slot.id);
      const fine = () => { const v = slot.variants.find(x => x[0] === cur); if (!v || !v[2]) return; setTheme(); LASTGEN = null; v[2](D, P, ctx()); if (!LASTGEN) return;
        store.set('gen-' + LASTGEN.id, LASTGEN.s); st.pick[slot.id] = 'mine'; save(); location.hash = 'gen/' + LASTGEN.id; };
      const canFine = cur !== 'stock' && cur !== 'mine' && (() => { const v = slot.variants.find(x => x[0] === cur); if (!v || !v[2]) return false; LASTGEN = null; try { setTheme(); v[2](D, P, ctx()); } catch { } return !!LASTGEN; })();
      return h('div', { class: 'slot card glass' + (st.pick[slot.id] ? ' custom' : '') },
        h('div', { class: 'slothead' }, h('b', {}, slot.label), h('code', {}, slot.files), st.pick[slot.id] ? h('button', { class: 'mini', title: 'Back to the bundle choice', onclick: () => { delete st.pick[slot.id]; save(); draw(); } }, 'bundle') : null),
        h('div', { class: 'row' }, h('select', { onchange: e => { st.pick[slot.id] = e.target.value; save(); draw(); } }, slot.variants.map(([id, label]) => h('option', { value: id, selected: id === cur }, label))),
          canFine ? h('button', { class: 'mini', title: 'Open this file\'s generator with these settings', onclick: fine }, 'Fine-tune') : null,
          cur === 'mine' ? h('button', { class: 'mini', onclick: () => { location.hash = 'gen/' + ({ daily: 'daily', missions: 'missions', weapons: 'weapons', vehicles: 'vehicles', roles: 'roles', names: 'names' }[slot.id]); } }, 'Open generator') : null),
        preview(slot),
        slot.id === 'streets' && cur === 'image' ? streetImgUI() : null);
    }));
    const sw = st.street;
    const prev = h('div', { class: 'gamebox small map' });
    const showPrev = () => { prev.innerHTML = render(streetLines(P, { colour: sw.colour ? hex2rgb(sw.colour) : null, alpha: sw.alpha, font: sw.font, files: { StreetName: true } }).StreetName[0][1]); };
    const street = h('div', { class: 'card glass event' }, h('h3', {}, 'Event: show street names'),
      h('p', { class: 'hint' }, 'Turns street, block and beacon names back on over any preset, e.g. to find your way to the next pumpkin during the Halloween event. Overrides the "Street, block & beacon names" choice.'),
      toggle('Show street names', sw.on, v => { sw.on = v; save(); draw(); }),
      sw.on ? h('div', {}, h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Style'), seg([['white', 'White, small font'], ['iazer', 'Small font'], ['set', 'Bundle colour'], ['custom', 'Custom']], sw.style, v => {
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
