import { colourText, wrapColour, hex2rgb, fl, apbTag } from './core.js';
import { weaponStats, vehicleStats } from './stats.js';

const NL = '↵';
const n = (v, d = 2) => fl(v, d);
const sec = (v, d) => `${n(v, d)} s`;
const m = cm => `${n(cm / 100, 1)} m`;
export const stripTags = s => String(s).replace(/<[^<>]*>/g, '');
const unlockName = s => stripTags(s).replace(/^Unlock:\s*/i, '').trim();

export function gradOf(s, p, kind, font) {
  const stops = [s[p + '1'], s[p + '2']].concat(s[p + 'mode'] === 'triple' ? [s[p + '3']] : []).map(x => hex2rgb(x || s[p + '1'] || '#ffffff'));
  return t => colourText(t, { mode: s[p + 'mode'] === 'triple' ? 'smooth' : s[p + 'mode'], stops, steps: +s[p + 'steps'] || 3, kind, font: font || '' });
}
const GRAD = (p, label) => ['grad', p, label];
const gradDefaults = (p, a = '#ffb000', b = '#ff3d3d', c = '#7a5cff') => ({ [p + 'mode']: 'solid', [p + '1']: a, [p + '2']: b, [p + '3']: c, [p + 'steps']: 3 });

function lineMaker(s, kind) {
  const L = t => wrapColour(t, s.label, kind), V = t => wrapColour(t, s.value, kind), H = t => wrapColour(t, s.hi, kind);
  return (label, value, hi) => `${hi ? H(label + ':') : L(label + ':')} ${hi ? H(value) : V(value)}`;
}
function joinDesc(s, stats, orig) {
  if (s.mode === 'vanilla') return undefined;
  const parts = [];
  if (s.mode === 'desc+stats' && orig) parts.push(orig, '');
  parts.push(...stats);
  if (s.mode === 'stats+desc' && orig) parts.push('', orig);
  return parts.join(NL);
}
const MODE = ['seg', 'mode', 'Description', [['vanilla', 'Vanilla', 'Keep the game\'s description'], ['stats', 'Stats'], ['stats+desc', 'Stats + description'], ['desc+stats', 'Description + stats']]];

export const ACT_WORDS = [[/arrest/i, 'arrests'], [/stun/i, 'stuns'], [/kill|takeout/i, 'kills'], [/deliver/i, 'deliveries'], [/won|win/i, 'wins'],
  [/graffiti/i, 'tags'], [/hack/i, 'hacks'], [/score/i, 'points'], [/played|games/i, 'games'], [/mission/i, 'missions'], [/egg/i, 'eggs'],
  [/streak/i, 'streak'], [/protagonist/i, 'times'], [/daily/i, 'activities'], [/cash|money/i, '$']];
export const actWord = a => (ACT_WORDS.find(([re]) => re.test(a || '')) || [0, 'progress'])[1];

export function stageWord(D, st, words = 'standard') {
  const L = D.stageLabels || { standard: {}, iazer: {}, ops: [], short: {} };
  const rule = (L.ops || []).find(([re]) => new RegExp(re).test(st.op || ''));
  if (rule) return rule[1];
  return (words === 'iazer' && L.iazer[st.cat]) || L.standard[st.cat] || st.cat;
}
const shortWord = (D, w) => ((D.stageLabels || {}).short || {})[w] || w;
const mmss = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

export const GENS = [
  {
    id: 'weapons', group: 'Items', title: 'Weapon stats', file: 'WeaponItemTypes', kind: 'ui',
    help: 'Writes each weapon\'s description with stats computed from the game\'s own weapon tables, including the weapon\'s built-in modifications.',
    defaults: { mode: 'stats+desc', useMods: true, label: '#d0d0d0', value: '#ffffff', hi: '#ffb000', dec: 3, hideTest: false,
      show: { ttk: true, stk: true, far: true, dmg: true, stam: true, hard: true, rpm: true, fire: false, mag: true, reload: true, equip: true, range: true, mods: true } },
    controls: [MODE, ['toggle', 'useMods', 'Apply built-in mods'],
      ['colour', 'label', 'Label colour'], ['colour', 'value', 'Value colour'], ['colour', 'hi', 'Kill line colour'],
      ['seg', 'dec', 'Decimals', [[2, '0.00'], [3, '0.000']]],
      ['checks', 'show', 'Lines', [['ttk', 'Time to kill'], ['stk', 'Shots to kill'], ['far', 'At max falloff'], ['dmg', 'Damage'], ['stam', 'Stamina damage'], ['hard', 'Hard damage'],
        ['rpm', 'Rate of fire'], ['fire', 'Fire interval'], ['mag', 'Magazine / ammo'], ['reload', 'Reload'], ['equip', 'Equip'], ['range', 'Range'], ['mods', 'Built-in mods']]],
      ['toggle', 'hideTest', 'Hide Gun Game and event weapons in the preview']],
    items(D, s) {
      const L = lineMaker(s, 'ui'), d = +s.dec, sh = s.show;
      return D.weapons.map(w => {
        const t = w.types[0];
        if (!t) return { icon: w.icon, name: w.name, sub: w.cat, key: w.key, orig: w.desc, test: w.test };
        const st = weaponStats(t, w.mods, s.useMods, D.const), x = st.w, out = [];
        const kill = t.ltl ? 'stun' : 'kill';
        if (st.kind === 'explosive') {
          if (sh.stk) out.push(L('Hits to kill', `${st.stk}${st.rays > 1 ? ` (all ${st.rays} rockets)` : ''}`, true));
          if (sh.dmg) out.push(L('Max damage', `${st.dmg}${st.rays > 1 ? ' x ' + st.rays : ''}`));
          if (sh.stam) out.push(L('Max stamina damage', st.stun));
          if (sh.hard) out.push(L('Max hard damage', n(st.hard, 1)));
          if (sh.range) out.push(L('Blast radius', `${n(st.radius, 1)} m (full damage ${n(st.r0, 1)} m)`));
          if (sh.fire && t.fuse && !t.impact) out.push(L('Fuse', sec(t.fuse, 2)));
          if (sh.rpm && t.cls === 1) out.push(L('Fire interval', sec(x.fire, d)));
        } else {
          if (sh.ttk) out.push(L(`Time to ${kill}`, sec(st.ttk, d), true));
          if (sh.stk) out.push(L(`Shots to ${kill}`, st.stk, true));
          if (sh.far && st.farStk) out.push(L(`Past falloff (${n(x.minPct, 0)}%)`, `${st.farStk} shots, ${sec(st.farTtk, d)}`));
          if (sh.dmg) out.push(L('Damage', `${n(st.dmg, 1)}${st.rays > 1 ? ' x ' + st.rays : ''}`));
          if (sh.stam) out.push(L('Stamina damage', `${n(st.stam, 1)}${st.rays > 1 ? ' x ' + st.rays : ''}`));
          if (sh.hard) out.push(L('Hard damage', `${n(st.hard, 1)}${st.rays > 1 ? ' x ' + st.rays : ''}`));
          if (sh.rpm && st.rpm) out.push(L('Rate of fire', `${Math.round(st.rpm)} rpm${x.burst > 1 ? ` (${x.burst}-round burst)` : ''}`));
          if (sh.fire) out.push(L(x.burst > 1 ? 'Burst interval' : 'Fire interval', sec(x.burst > 1 ? x.burstInt : x.fire, d)));
          if (sh.range && x.ramp) out.push(L('Effective range', m(x.ramp)));
        }
        if (sh.mag) out.push(L('Magazine', `${x.mag} / ${x.ammo}`));
        if (sh.reload && x.reload) out.push(L('Reload', sec(x.reload, 2)));
        if (sh.equip && x.equip) out.push(L('Equip', sec(x.equip, 2)));
        if (sh.mods && x.modNames.length) out.push(L('Built-in', x.modNames.join(', ')));
        return { icon: w.icon, name: w.name, sub: `${w.cat}${w.event ? ' · Gun Game / event' : ''}${w.types.length > 1 ? ' · ' + w.types.length + ' fire modes (first shown)' : ''}`, key: w.key, orig: w.desc, test: w.test, value: joinDesc(s, out, w.desc) };
      });
    }
  },
  {
    id: 'vehicles', group: 'Items', title: 'Vehicle stats', file: 'VehicleItemTypes', kind: 'ui',
    help: 'Health, speed, cargo, explosion and EMP values from the game\'s vehicle setup table; cargo includes built-in cargo modifications.',
    defaults: { mode: 'stats+desc', useMods: true, label: '#d0d0d0', value: '#ffffff', hi: '#ffb000', kmh: true, hideTest: false,
      show: { health: true, speed: true, rev: true, cargo: true, exp: true, expr: true, emp: true, ram: false, mods: true } },
    controls: [MODE, ['toggle', 'useMods', 'Apply built-in mods'], ['toggle', 'kmh', 'Speeds also in km/h'],
      ['colour', 'label', 'Label colour'], ['colour', 'value', 'Value colour'], ['colour', 'hi', 'Health line colour'],
      ['checks', 'show', 'Lines', [['health', 'Max Health'], ['speed', 'Max Speed'], ['rev', 'Max Reverse Speed'], ['cargo', 'Cargo Capacity'], ['exp', 'Explosion Max Damage'], ['expr', 'Explosion Radius'], ['emp', 'EMP Vulnerability'], ['ram', 'Ram-raid multiplier'], ['mods', 'Built-in mods']]],
      ['toggle', 'hideTest', 'Hide event vehicles in the preview']],
    items(D, s) {
      const L = lineMaker(s, 'ui'), sp = v => `${n(v, 1)} m/s${s.kmh ? ` (${Math.round(v * 3.6)} km/h)` : ''}`;
      return D.vehicles.map(v0 => {
        const v = vehicleStats(v0, s.useMods), out = [];
        const sh = { ...this.defaults.show, ...s.show };
        if (sh.health) out.push(L('Max Health', v.health, true));
        if (sh.speed) out.push(L('Max Speed', sp(v.speed)));
        if (sh.rev) out.push(L('Max Reverse Speed', sp(v.rev)));
        if (sh.cargo) out.push(L('Cargo Capacity', v.cargo));
        if (sh.exp && v.exp) out.push(L('Explosion Max Damage', v.exp.dmg));
        if (sh.expr && v.exp) out.push(L('Explosion Radius', `${n(v.exp.r / 100, 1)} m`));
        if (sh.emp && v.emp !== undefined) out.push(L('EMP Vulnerability', v.emp ? `${Math.round(v.emp * 100)}%` : 'Immune'));
        if (sh.ram) out.push(L('Ram-raid multiplier', `x${n(v.ram, 2)}`));
        if (sh.mods && v.modNames.length) out.push(L('Built-in', v.modNames.join(', ')));
        return { icon: v.icon, name: v.name, sub: v.model, key: v.key, orig: v.desc, test: v.test, value: joinDesc(s, out, v.desc) };
      });
    }
  },
  {
    id: 'names', group: 'Items', title: 'Item name colours', file: 'InventoryItemTypes', kind: 'ui',
    help: 'Colours the names of weapons (by shop category) and modifications (by slot) in InventoryItemTypes. Pick a colour or gradient per group.',
    defaults: { groups: {}, font: '', ...gradDefaults('g'), sel: 'Assault Rifles' },
    controls: [['groups'], ['font', 'font', 'Font']],
    groups(D) {
      const g = new Map();
      D.weapons.forEach(w => { const k = 'Weapons: ' + (w.cat || 'Other'); g.set(k, (g.get(k) || 0) + 1); });
      D.mods.forEach(x => { const k = 'Mods: ' + x.cat.replace(/_/g, ' '); g.set(k, (g.get(k) || 0) + 1); });
      return [...g].sort((a, b) => a[0].localeCompare(b[0]));
    },
    items(D, s) {
      const list = D.weapons.map(w => ({ g: 'Weapons: ' + (w.cat || 'Other'), name: w.name, icon: w.icon, key: `InventoryItemTypes_${w.row}_DisplayName`, test: w.test }))
        .concat(D.mods.map(x => ({ g: 'Mods: ' + x.cat.replace(/_/g, ' '), name: x.name, icon: x.icon, key: x.nameKey })));
      const seen = new Set();
      return list.filter(x => !seen.has(x.key) && seen.add(x.key)).map(x => {
        const gs = s.groups[x.g];
        return { icon: x.icon, name: x.name, sub: x.g, key: x.key, orig: x.name, test: x.test, value: gs && gs.on ? gradOf(gs, 'g', 'ui', s.font)(stripTags(x.name)) : undefined };
      });
    }
  },
  {
    id: 'mods', group: 'Items', title: 'Modification descriptions', file: 'ModifierItemTypes', kind: 'ui',
    help: 'Adds the modification\'s effect lines (from ModifierEffects) under its description, optionally with a coloured slot heading. Effect values keep the game\'s meaning: green = positive, red = negative; pick your own colours for both and for the text.',
    defaults: { mode: 'desc+effects', head: true, ...gradDefaults('h', '#45ff16', '#0978ff'), pos: '#00ff00', neg: '#ff0000', txt: '#ffffff', keepHi: true, font: '' },
    controls: [['seg', 'mode', 'Description', [['vanilla', 'Vanilla'], ['desc+effects', 'Description + effects'], ['effects', 'Effects']]],
      ['toggle', 'head', 'Slot heading'], GRAD('h', 'Heading colour'),
      ['colour', 'pos', 'Positive effects'], ['colour', 'neg', 'Negative effects'], ['colour', 'txt', 'Effect text'],
      ['toggle', 'keepHi', 'Keep special highlights (e.g. Field Supplier)'], ['font', 'font', 'Font']],
    items(D, s) {
      s = { ...this.defaults, ...s };
      const H = gradOf(s, 'h', 'ui');
      const rgbOf = t => ['R', 'G', 'B'].map(k => { const m = new RegExp('\\b' + k + '\\s*=\\s*([\\d.]+)', 'i').exec(t); return m ? +m[1] : 0; });
      const tagFor = c => { const k = c.map(v => Math.round(v * 100) / 100).join(','); return k === '0,1,0' ? s.pos : k === '1,0,0' ? s.neg : k === '1,1,1' ? s.txt : null; };
      const recolour = l => l.replace(/<Color:([^>]*)>/gi, (m0, a) => { if (a.trim() === '/') return m0; const hx = tagFor(rgbOf(a)); return hx ? apbTag(hex2rgb(hx)) : s.keepHi ? m0 : apbTag(hex2rgb(s.txt)); });
      const fonted = v => s.font ? `<Fonts:${s.font}>${v}<Fonts:/>` : v;
      return D.mods.map(x => {
        if (s.mode === 'vanilla') return { icon: x.icon, name: x.name, sub: x.cat, key: x.key, orig: x.desc };
        const body = x.desc.replace(/^[^↵]*Modification\s*-\s*↵/i, '');
        const parts = [];
        if (s.head) parts.push(H(x.cat.replace(/_/g, ' ')));
        if (s.mode === 'desc+effects') parts.push(body);
        if (x.lines.length) parts.push((s.mode === 'desc+effects' ? NL : '') + x.lines.map(recolour).join(NL));
        return { icon: x.icon, name: x.name, sub: x.cat, key: x.key, orig: x.desc, value: fonted(parts.join(NL)) };
      });
    }
  },
  {
    id: 'roles', group: 'Progression', title: 'Player roles', file: 'PlayerRoles', kind: 'ui',
    help: 'Writes the rank list into each role\'s description: what each rank needs, the running total for the whole role, and the rewards.',
    defaults: { mode: 'desc+ranks', rank: '#ffb000', value: '#ffffff', total: '#a0a0a0', unlock: '#a0a0a0', showTotal: true, cash: true, hideAch: false },
    controls: [['seg', 'mode', 'Description', [['vanilla', 'Vanilla'], ['ranks', 'Ranks'], ['desc+ranks', 'Description + ranks']]],
      ['colour', 'rank', 'Rank colour'], ['colour', 'value', 'Value colour'], ['colour', 'unlock', 'Reward colour'],
      ['colour', 'total', 'Total colour'], ['toggle', 'showTotal', 'Running total [x // y total]'], ['toggle', 'cash', 'Show cash rewards'], ['toggle', 'hideAch', 'Hide achievements in the preview']],
    items(D, s) {
      return D.roles.map(r => {
        if (s.mode === 'vanilla') return { name: r.name, sub: r.row, key: r.key, orig: r.desc, test: s.hideAch && r.ach };
        const w = r.acts.map(actWord), lines = [], sum = r.acts.map(() => 0);
        const amt = (v, j) => w[j] === '$' ? `$${v}` : `${v} ${w[j]}`;
        r.ranks.forEach((k, i) => {
          r.acts.forEach((a, j) => sum[j] += k.pass[j]);
          const join = k.formula >= 3 ? ' or ' : ' and ';
          const need = r.acts.map((a, j) => amt(k.pass[j], j)).join(join), tot = r.acts.map((a, j) => amt(sum[j], j)).join(join);
          lines.push(`${wrapColour('Rank ' + (i + 1) + ':', s.rank, 'ui')} ${wrapColour(need || k.pass[0], s.value, 'ui')}${s.showTotal && tot ? ' ' + wrapColour('// ' + tot.replace(/(\d+) (\S+)/g, '$1 total $2'), s.total, 'ui') : ''}`);
          const rw = k.items.map(unlockName).filter(Boolean);
          if (s.cash && k.cash) rw.push('$' + k.cash);
          if (rw.length) lines.push(wrapColour('   ' + rw.join(', '), s.unlock, 'ui'));
        });
        const desc = s.mode === 'desc+ranks' ? r.desc.replace(/(↵)+$/, '') + NL + NL : '';
        return { name: r.name, sub: `${r.ranks.length} ranks · ${r.acts.join(', ')}`, key: r.key, orig: r.desc, test: s.hideAch && r.ach, value: desc + lines.join(NL) };
      });
    }
  },
  {
    id: 'ranktitles', group: 'Progression', title: 'Role rank titles', file: 'RoleMilestones', kind: 'ui',
    help: 'Adds what each rank needs to its title, e.g. "Rifleman - Rank 3 (50 kills)", optionally with the running total for the role.',
    defaults: { colour: '#a0a0a0', showTotal: false },
    controls: [['colour', 'colour', 'Requirement colour'], ['toggle', 'showTotal', 'Running total']],
    items(D, s) {
      return D.roles.flatMap(r => { const sum = r.acts.map(() => 0); return r.ranks.map(k => {
        r.acts.forEach((a, j) => sum[j] += k.pass[j]);
        const need = r.acts.map((a, j) => `${k.pass[j]} ${actWord(a)}${s.showTotal ? `, ${sum[j]} total` : ''}`).join(k.formula >= 3 ? ' or ' : ' and ');
        return { name: k.title, sub: r.name, key: k.key, orig: k.title, value: need ? `${k.title} ${wrapColour('(' + need + ')', s.colour, 'ui')}` : undefined };
      }); });
    }
  },
  {
    id: 'contacts', group: 'Progression', title: 'Contact descriptions', file: 'Contacts', kind: 'ui',
    help: 'Lists what each contact level unlocks (standing needed, items, cash) in the contact description.',
    defaults: { mode: 'desc+levels', lvl: '#ffb000', item: '#ffffff', cash: true, hideHidden: true },
    controls: [['seg', 'mode', 'Description', [['vanilla', 'Vanilla'], ['levels', 'Unlocks'], ['desc+levels', 'Description + unlocks'], ['levels+desc', 'Unlocks + description']]],
      ['colour', 'lvl', 'Level colour'], ['colour', 'item', 'Unlock colour'], ['toggle', 'cash', 'Show cash rewards'], ['toggle', 'hideHidden', 'Hide hidden / test contacts in the preview']],
    items(D, s) {
      return D.contacts.map(c => {
        if (s.mode === 'vanilla') return { name: c.name, sub: c.row, key: c.key, orig: c.desc, test: s.hideHidden && c.hidden };
        const lines = c.levels.filter(l => l.items.length || (s.cash && l.cash)).map(l => {
          const it = [...new Set(l.items.map(unlockName))]; if (s.cash && l.cash) it.push('$' + l.cash);
          return `${wrapColour(`Level ${l.lvl}${l.standing ? ' (' + l.standing + ')' : ''}:`, s.lvl, 'ui')} ${wrapColour(it.join(', '), s.item, 'ui')}`;
        });
        const body = lines.join(NL), d = c.desc;
        const value = s.mode === 'levels' ? body : s.mode === 'levels+desc' ? body + NL + NL + d : d + NL + NL + body;
        return { name: c.name, sub: `${c.levels.length} levels`, key: c.key, orig: c.desc, test: s.hideHidden && c.hidden, value: lines.length ? value : undefined };
      });
    }
  },
  {
    id: 'daily', group: 'Progression', title: 'Daily activities', file: 'DailyActivityContacts', kind: 'hud',
    help: 'HUD text file: colours must be named game colours (<col:Name>). Titles can show the reward (e.g. the weapon), descriptions can be shortened.',
    defaults: { title: 'vanilla', hud: 'colour', long: 'vanilla', base: 'White', value: 'Yellow', reward: 'Valentine_Pink', hideOff: true },
    controls: [['seg', 'title', 'Title', [['vanilla', 'Vanilla'], ['reward', '[Reward]', 'Rare activities: title = the reward item'], ['both', 'Title [Reward]']]],
      ['seg', 'hud', 'HUD description', [['vanilla', 'Vanilla'], ['colour', 'Recolour', 'Base + value colours'], ['short', 'Task: Count', 'e.g. "Kill streak: 15"']]],
      ['seg', 'long', 'Long description', [['vanilla', 'Vanilla'], ['hud', 'Same as HUD line']]],
      ['colour', 'base', 'Base colour'], ['colour', 'value', 'Value colour'], ['colour', 'reward', 'Reward colour'], ['toggle', 'hideOff', 'Hide disabled activities in the preview']],
    items(D, s) {
      const out = [];
      const recol = t => (`<col:${s.base}>` + t.replace(/<col:[^>]*>(.*?)<\/col>/gi, `</col><col:${s.value}>$1</col><col:${s.base}>`) + '</col>').replace(/<col:[^>]*>\s*<\/col>/gi, m => m.includes(' ') ? ' ' : '');
      const short = d => {
        const plain = stripTags(d.hud).replace(/\.$/, '').trim(), num = String(d.req);
        const label = plain.replace(new RegExp('\\s*\\b' + num + '\\b\\.?\\s*'), ' ').replace(/\s+(of|to)\s*$/i, '').replace(/\s+/g, ' ').trim();
        return `<col:${s.base}>${label.charAt(0).toUpperCase() + label.slice(1)}:</col> <col:${s.value}>${num}</col>`;
      };
      D.daily.forEach(d => {
        const k = f => `DailyActivityContacts_${d.row}_${f}${d.suf}`, test = s.hideOff && d.off;
        const reward = d.reward.map(stripTags).join(', ');
        let title;
        if (s.title !== 'vanilla' && reward) title = s.title === 'reward' ? `<col:${s.reward}>${reward}</col>` : `${d.title} <col:${s.reward}>(${reward})</col>`;
        const hud = s.hud === 'colour' ? recol(d.hud) : s.hud === 'short' ? short(d) : undefined;
        out.push({ name: d.title, sub: `${d.contact} lvl ${d.level} · ${d.row}${reward ? ' · reward: ' + reward : ''}`, key: k('Title'), orig: d.title, value: title, test });
        out.push({ name: d.title, sub: 'HUD description', key: k('HUDDescription'), orig: d.hud, value: hud, test, child: true });
        if (s.long === 'hud' && hud) out.push({ name: d.title, sub: 'Long description', key: k('LongDescription'), orig: d.long, value: hud, test, child: true });
      });
      return out;
    }
  },
  {
    id: 'missions', group: 'Missions', title: 'Mission stage briefs', file: 'TaskObjectives', kind: 'hud',
    help: 'Replaces each stage brief with a compact list of all stages (count, time limit), the current one highlighted. HUD text: named colours only, <Fonts:> has no effect here.',
    defaults: { mode: 'list', cur: 'Valentine_Pink', rest: 'White', time: true, sizes: false, stop: true, hideOff: true, sep: ' | ', words: 'standard' },
    controls: [['seg', 'mode', 'Brief', [['vanilla', 'Vanilla'], ['list', 'Stage list'], ['list+brief', 'Stage list + brief'], ['next', 'Current / Next']]],
      ['seg', 'words', 'Wording', [['standard', 'Drop Off · Point Hold · Invest'], ['iazer', 'Drop · Area · Investigate']]],
      ['colour', 'cur', 'Current stage'], ['colour', 'rest', 'Other stages'], ['toggle', 'time', 'Show time limits'], ['toggle', 'sizes', 'Show item sizes (S / M / L)'],
      ['toggle', 'stop', 'Opposition briefs say "Stop: …"'], ['toggle', 'hideOff', 'Hide disabled missions in the preview']],
    items(D, s) {
      const out = [], mode = s.mode === 'window' ? 'list' : s.mode;
      for (const mi of D.missions) {
        const ownerTime = st => { const o = st.opp ? mi.stages.find(x => !x.opp && x.stage === st.stage) : null; return (o || st).time || 300; };
        const label = (st, pair) => { const c = Math.max(st.n, st.items, st.veh), w = stageWord(D, st, s.words); return `${pair ? shortWord(D, w) : w}${c > 1 ? ' ' + c : ''}${s.sizes && st.size && st.size !== 'V' ? ` (${st.size})` : ''}${st.heavy && /Pickup|Delivery|Vehicle/.test(st.cat) ? ' [Heavy]' : ''}`; };
        const groupLabel = g => {
          const words = g.map(x => stageWord(D, x, s.words));
          if (g.length > 1 && words.every(w => w === words[0])) { const n = g.reduce((a, x) => a + Math.max(1, x.n, x.items, x.veh), 0); return label({ ...g[0], n, items: 0, veh: 0 }, false); }
          return g.map(x => label(x, g.length > 1)).join(' + ');
        };
        const timed = (txt, st) => s.time ? `${txt} [${st.bonus ? '+' : ''}${mmss(ownerTime(st))}]` : txt;
        const own = mi.stages.filter(st => !st.opp).sort((a, b) => a.stage - b.stage), groups = [];
        own.forEach(st => { if (st.conc && groups.length) groups[groups.length - 1].push(st); else groups.push([st]); });
        const gi = st => { const i = groups.findIndex(g => g.some(x => x.stage === st.stage)); return i < 0 ? groups.findIndex(g => g[0].stage >= st.stage) : i; };
        for (const st of mi.stages) {
          const at = Math.max(0, gi(st));
          const txtOf = i => i === at && st.opp ? timed(label(st), st) : timed(groupLabel(groups[i]), groups[i][0]);
          const W = t => `<col:White>${t}</col>`;
          const list = mode === 'next'
            ? (at + 1 < groups.length ? `${W('Current Stage:')} <col:${s.cur}>${txtOf(at)}</col>${NL}${W('Next Stage:')} <col:${s.rest}>${txtOf(at + 1)}</col>` : `${W('Final Stage:')} <col:${s.cur}>${txtOf(at)}</col>`)
            : groups.map((g, i) => i < at ? null : `<col:${i === at ? s.cur : s.rest}>${txtOf(i)}</col>`).filter(Boolean).join(s.sep);
          for (const f of ['OwnerBrief', 'DispatchBrief']) {
            const orig = f === 'OwnerBrief' ? st.owner : st.dispatch;
            const pre = s.stop && (f === 'DispatchBrief') !== !!st.opp ? `${W('Stop:')} ` : '';
            const v = mode === 'vanilla' ? undefined : pre + list + (mode === 'list+brief' && orig ? NL + orig : '');
            out.push({ name: `${mi.title} · stage ${st.stage + 1}${st.opp ? ' (opposition)' : ''}`, sub: f, key: `TaskObjectives_${st.row}_${f}${st.suf}`, orig, value: v, test: s.hideOff && mi.off, child: f === 'DispatchBrief' });
          }
        }
      }
      return out;
    }
  },
  {
    id: 'hudtext', group: 'HUD text', title: 'Reload, resupply & tutorial', file: 'APBUserInterface', kind: 'ui', sections: true,
    help: 'Styles single interface words. Merge into your APBUserInterface file (the lines go into their own sections).',
    defaults: { font: '', ...gradDefaults('g', '#ffb000', '#ff3d3d'), texts: { reload: 'RELOAD', resupply: 'RESUPPLY', tutwin: 'TUTORIAL', tuthud: 'Tutorial' } },
    controls: [['texts', 'texts', 'Text', [['reload', 'WeaponHUD · Reload'], ['resupply', 'WeaponHUD · Resupply'], ['tutwin', 'NewTutorialWindow · Title'], ['tuthud', 'NewTutorialHUD · Title']]],
      GRAD('g', 'Colour'), ['font', 'font', 'Font']],
    items(D, s) {
      const G = gradOf(s, 'g', 'ui', s.font);
      return [['reload', 'WeaponHUD', 'Reload'], ['resupply', 'WeaponHUD', 'Resupply'], ['tutwin', 'NewTutorialWindow', 'Title'], ['tuthud', 'NewTutorialHUD', 'Title']]
        .map(([id, sct, key]) => ({ name: `${sct} · ${key}`, sub: sct, section: sct, key, orig: { reload: 'RELOAD', resupply: 'RESUPPLY', tutwin: 'TUTORIAL', tuthud: 'Tutorial' }[id], value: s.texts[id] ? G(s.texts[id]) : undefined }));
    }
  }
];
