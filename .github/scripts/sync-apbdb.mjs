import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'designer', 'data.json');
const API = 'https://api.apbdb.com/beacon';
const FORCE = process.argv.includes('--force') || process.env.FORCE_SYNC === 'true';
const LIMIT = +(process.env.SYNC_LIMIT || 0);

const vcls = c => ({ Car: 'Cars', Truck: 'Trucks', Van: 'Vans' })[(/^Vehicle(Car|Truck|Van)/.exec(c || '') || [])[1]] || '';
const EVENT = /_GG\d*($|_)|_GunGame|Minigame|Snowball|Physical_Brick/;
const skipTest = d => +d.bIsTestItem && !EVENT.test(d.sAPBDB);
const WEFF = { 165: 'ammo', 173: 'equip', 174: 'fire', 175: 'fireMM', 176: 'burstMM', 179: 'hard', 180: 'dmg', 185: 'mag', 190: 'reload', 191: 'resupply', 194: 'dmgPlayer', 72: 'range' };
const VEFF = { 114: 'cargo' };

const vnum = v => String(v || '').split(/\D+/).filter(Boolean).map(Number);
const newer = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let requests = 0, failures = 0;
async function get(url, tries = 4) {
  for (let t = 1; ; t++) {
    try {
      requests++;
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      if (t >= tries) { failures++; console.warn('failed:', e.message); return null; }
      await sleep(1000 * t * t);
    }
  }
}
async function pool(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k], k); } }));
  return out;
}
async function items(cat) {
  const out = []; let page = 1, pages = 1;
  do { const j = await get(`${API}/items?cat=${cat}&limit=1000&page=${page}`); if (!j) break; out.push(...(j.items || [])); pages = j.totalPages || 1; page++; } while (page <= pages);
  return LIMIT ? out.slice(0, LIMIT) : out;
}
async function missionList() {
  const out = [];
  for (let page = 1; page < 50; page++) { const j = await get(`${API}/missions?limit=100&page=${page}`); const m = (j && j.missions) || []; out.push(...m); if (m.length < 100) break; }
  return LIMIT ? out.slice(0, LIMIT) : out;
}
const detail = (kind, row) => get(`${API}/${kind}/${encodeURIComponent(row)}`);

const text = v => v === undefined || v === null || v === 'None' ? '' : String(v).replace(/\r\n|\r|\n/g, '↵');
const num = v => { const x = Math.round((+v || 0) * 1e4) / 1e4; return x; };
const obj = v => v && typeof v === 'object' ? v : null;
const u32 = v => (+v) >>> 0;
const guid = g => { const p = String(g).toLowerCase().split('-'); const rev = s => s.match(/../g).reverse().join(''); return p.length === 5 ? [rev(p[0]), rev(p[1]), rev(p[2]), p[3], p[4]].join('-') : String(g).toLowerCase(); };
const humanise = s => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();

function explosion(e) {
  e = obj(e); if (!e || !e.id || e.sAPBDB === 'None') return null;
  return { dmg: num(e.nDamage), stun: num(e.nStunDamage), r: num(e.fExplosionRadius), r0: num(e.fGroundZeroRadius), hard: num(e.fHardDamageModifier), minPct: num(e.fMinimumDamagePercentage) };
}
function wtype(t) {
  t = obj(t); if (!t || !t.id || !t.sAPBDB || t.sAPBDB === 'None') return null;
  const r = obj(t.eRangedWeaponType) || {}, g = obj(t.GrenadeWeaponType), p = obj(t.eWeaponProjectile), cls = obj(t.eClass);
  const o = { row: t.sAPBDB, cls: cls ? +cls.eWeaponClass : +t.eClass || 0, ltl: +t.bLessLethal || 0, dmg: num(t.fHealthDamage), stam: num(t.fStaminaDamage), hard: num(t.fHardDamageModifier),
    fire: num(t.fFireInterval), burstInt: num(t.fBurstInterval), burst: +t.nBurstShots || 1, reload: num(t.fReloadTime), equip: num(t.fEquipTime), mag: +t.nMagazineCapacity || 0,
    ammo: +t.nAmmoPoolCapacity || 0, windUp: num(t.fWindUpTime), resupply: num(t.fResupplyDelaySecs), rays: +r.nRaysPerShot || 1, ramp: num(r.fRampDistance), minRange: num(r.fMinDamageRange),
    minPct: num(r.fMinimumDamagePercentage), maxRange: num(r.fMaxRange), pierce: +r.nMaxPierceCount || 0 };
  let ex = explosion(r.eExplosionType);
  if (p && p.id) { ex = explosion(p.eExplosion) || ex; o.fuse = num(p.fFuseDelay); o.impact = +p.bImpactDetonated || 0; }
  if (g) o.speed = num(g.fFiringSpeed);
  if (ex) o.exp = ex;
  return o;
}
function fnmod(m, wanted) {
  m = obj(m); if (!m) return null;
  const it = obj(m.eInventoryItemType); if (!it || !it.sAPBDB || /^Mod_(None|Vacant)$/.test(it.sAPBDB)) return null;
  const mi = obj(m.eModifierItem) || {};
  const eff = (mi.aModifierEffects || []).filter(e => wanted[e.eEffectType]).map(e => [wanted[e.eEffectType], num(e.fEffectMultiplier), num(e.fAddToResult)]);
  return { name: text(it.sDisplayName), row: it.sAPBDB, eff };
}
function reward(p) {
  p = obj(p); if (!p || !p.id) return { items: [], cash: 0 };
  const names = (p.eItems || []).map(x => text(obj(x) ? x.sDisplayName : '')).filter(Boolean);
  const c = obj(p.eChildPackage); if (c && c.eItems) names.push(...c.eItems.map(x => text(obj(x) ? x.sDisplayName : '')).filter(Boolean));
  return { items: names, cash: +p.nCash || 0 };
}

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.replace(/[↵\s]+$|^\s+/g, '') === b.replace(/[↵\s]+$|^\s+/g, '');
function keepText(old, f) {
  for (const k of Object.keys(f)) {
    if (same(old[k], f[k])) f[k] = old[k];
    else if (Array.isArray(f[k]) && Array.isArray(old[k]) && f[k].length === old[k].length) f[k] = f[k].map((v, i) => same(old[k][i], v) ? old[k][i] : v);
  }
  return f;
}
function mergeStages(old, f) {
  const fresh = new Map(f.stages.map(s => [s.id, s])), out = [];
  for (const s of old.stages) {
    const n = fresh.get(s.id); fresh.delete(s.id);
    if (!n) { out.push(s); continue; }
    const hasOpp = old.stages.some(o => o.opp && o.stage === s.stage && o.id !== s.id);
    out.push(keepText(s, hasOpp ? { ...s, ...n, dispatch: s.dispatch } : { ...s, ...n }));
  }
  out.push(...fresh.values());
  out.sort((a, b) => a.stage - b.stage || a.opp - b.opp || a.id - b.id);
  return { ...f, stages: out };
}
function merge(held, fresh, idOf = x => x.id) {
  const at = new Map(held.map((x, i) => [idOf(x), i])), out = held.slice(); let updated = 0, added = 0;
  for (const f of fresh) {
    if (!f) continue; const i = at.get(idOf(f));
    if (i === undefined) { out.push(f); added++; continue; }
    out[i] = f.stages && held[i].stages ? mergeStages(held[i], f) : keepText(held[i], { ...held[i], ...f }); updated++;
  }
  return { list: out, updated, added };
}
function suffixer(held, rowOf) {
  const count = new Map(); held.forEach(x => count.set(rowOf(x).toLowerCase(), (count.get(rowOf(x).toLowerCase()) || 0) + 1));
  return row => { const n = (count.get(row.toLowerCase()) || 0) + 1; count.set(row.toLowerCase(), n); return n === 1 ? '' : '_' + n; };
}

async function main() {
  const held = JSON.parse(await fs.readFile(DATA, 'utf8'));
  const ver = await get(`${API}/version`);
  const version = ver && ((ver.db && ver.db.version) || (ver.live && ver.live.version) || ver.version);
  if (!version) throw new Error('APBDB version not available');
  const base = [held.build, held.apbdb && held.apbdb.version].filter(Boolean).reduce((a, b) => newer(b, a) ? b : a, '');
  if (!FORCE && base && !newer(version, base)) { console.log(`APBDB ${version} is not newer than held data ${base}; nothing to do.`); return; }
  console.log(`Syncing APBDB ${version} (held: ${held.apbdb ? held.apbdb.version : 'game data only'})`);
  const infra = held.infra || {}, stats = {};

  const byId = (list, f) => new Map(list.map(x => [f(x), x]));
  const hw = byId(held.weapons, x => x.id), hv = byId(held.vehicles, x => x.id), hm = byId(held.mods, x => x.id);
  const sw = suffixer(held.weapons, x => x.row), sv = suffixer(held.vehicles, x => x.row);

  const wl = await items('Weapon'); console.log(`weapons: ${wl.length}`);
  const weapons = await pool(wl, 8, async it => {
    const d = await detail('items', it.sAPBDB); if (!d || !d.detail || skipTest(d)) return null;
    const dt = d.detail, link = obj(dt.eWeaponTypeLink) || {}, old = hw.get(+d.id);
    const types = [0, 1, 2, 3].map(k => wtype(link['eWeaponType_' + k])).filter(Boolean);
    return { id: +d.id, key: old ? old.key : `WeaponItemTypes_${d.sAPBDB}_Description${sw(d.sAPBDB)}`, row: d.sAPBDB, name: text(d.sDisplayName),
      cat: infra[d.infracategory] || humanise(d.infracategory), side: d.bEnforcer && !d.bCriminal ? 'E' : d.bCriminal && !d.bEnforcer ? 'C' : '', test: +d.bIsTestItem || 0, event: EVENT.test(d.sAPBDB) ? 1 : 0,
      desc: text(dt.sDescription), types, mods: [0, 1, 2].map(k => fnmod(dt['eFnMod_' + k], WEFF)).filter(Boolean) };
  });

  const vl = await items('Vehicle'); console.log(`vehicles: ${vl.length}`);
  const vehicles = await pool(vl, 8, async it => {
    const d = await detail('items', it.sAPBDB); if (!d || !d.detail || !obj(d.detail.eVehicle) || skipTest(d)) return null;
    const dt = d.detail, v = dt.eVehicle, old = hv.get(+d.id);
    return { id: +d.id, key: old ? old.key : `VehicleItemTypes_${d.sAPBDB}_Description${sv(d.sAPBDB)}`, row: d.sAPBDB, name: text(d.sDisplayName), model: text(v.sDisplayName), cls: vcls(d.infracategory),
      desc: text(dt.sDescription), test: +d.bIsTestItem || 0, health: +v.nMaxHealth || 0, speed: num(v.fMaxSpeed), rev: num(v.fMaxReverseSpeed),
      cargo: (+v.nMainCargoPipCapacity || 0) + (+v.nCabinCargoPipCapacity || 0), exp: explosion(v.eExplosionType), ram: num(v.fRamraidDamageMultiplier), collide: num(v.fCollisionDamage), emp: num(v.fEMPSusceptability),
      mods: [0, 1, 2, 3].map(k => fnmod(dt['eFnMod_' + k], VEFF)).filter(Boolean) };
  });

  const ml = await items('FnMod'); console.log(`modifications: ${ml.length}`);
  const sm = suffixer(held.mods, x => x.key.replace(/^ModifierItemTypes_|_Description(_\d+)?$/g, ''));
  const mods = await pool(ml, 8, async it => {
    const d = await detail('items', it.sAPBDB); if (!d || !obj(d.detail) || skipTest(d) || /TestMod|Devlar|DevPackage|_Test[A-Z]?$/.test(d.sAPBDB)) return null;
    const dt = d.detail, mi = obj(dt.eModifierItem); if (!mi || !mi.id) return null;
    const id = u32(dt.nSecondaryKey), old = hm.get(id), cat = obj(mi.eModifierCategory);
    return { id, key: old ? old.key : `ModifierItemTypes_${dt.sAPBDB}_Description${sm(dt.sAPBDB)}`, nameKey: `InventoryItemTypes_${d.sAPBDB}_DisplayName`, name: text(d.sDisplayName),
      cat: cat ? cat.sAPBDB : '', desc: text(dt.sDescription), lines: (mi.aModifierEffects || []).map(e => text(e.sDescription)).filter(Boolean) };
  });

  const rl0 = (await get(`${API}/roles`)) || [], rl = LIMIT ? rl0.slice(0, LIMIT) : rl0; console.log(`roles: ${rl.length}`);
  const hr = byId(held.roles, x => x.id), hk = new Map(held.roles.flatMap(r => r.ranks).map(k => [k.id, k.key]));
  const sr = suffixer(held.roles, x => x.row);
  const roles = await pool(rl, 6, async it => {
    const d = await detail('roles', it.sAPBDB); if (!d || !d.aMilestones) return null;
    const id = u32(d.nSecondaryKey), old = hr.get(id), suf = old ? old.key.match(/_Description(_\d+)?$/)[1] || '' : sr(d.sAPBDB);
    const acts = [0, 1, 2].map(k => obj(d['eActivities_' + k])).filter(Boolean).map(a => a.sAPBDB);
    const ranks = d.aMilestones.map(m => ({ id: u32(m.nSecondaryKey), key: hk.get(u32(m.nSecondaryKey)) || `RoleMilestones_${m.sAPBDB}_Title`, title: text(m.sTitle),
      pass: [num(m.fPassMark_0), num(m.fPassMark_1), num(m.fPassMark_2)], formula: +m.eFormula || 0, ...reward(m.eReward) }));
    return { id, key: `PlayerRoles_${d.sAPBDB}_Description${suf}`, nameKey: `PlayerRoles_${d.sAPBDB}_DisplayName${suf}`, row: d.sAPBDB, name: text(d.sDisplayName), desc: text(d.sDescription),
      faction: obj(d.eFaction) ? +d.eFaction.eFaction : +d.eFaction || 0, ach: +d.bAchievement || 0, acts, ranks };
  });

  const cl0 = (await get(`${API}/contacts`)) || [], cl = LIMIT ? cl0.slice(0, LIMIT) : cl0; console.log(`contacts: ${cl.length}`);
  const hc = byId(held.contacts, x => x.id), hd = byId(held.daily, x => x.id), sc = suffixer(held.contacts, x => x.row), sd = suffixer(held.daily, x => x.row);
  const daily = [];
  const contacts = await pool(cl, 6, async it => {
    const d = await detail('contacts', it.sAPBDB); if (!d || +d.bTest) return null;
    const id = guid(d.nSecondaryKey), old = hc.get(id), name = text(d.sTitle);
    const levels = (d.aContactLevels || []).slice().sort((a, b) => a.nLevel - b.nLevel);
    for (const l of levels) for (const a of l.aDailyActivities || []) {
      const da = obj(a.eDailyActivity) || {}, rr = obj(da.eRedeemableReward), aid = u32(a.nSecondaryKey), prev = hd.get(aid);
      daily.push({ id: aid, row: a.sAPBDB, suf: prev ? prev.suf : sd(a.sAPBDB), title: text(a.sTitle), hud: text(a.sHUDDescription), long: text(a.sLongDescription),
        req: +da.nRequirement || 0, act: prev ? prev.act : '', reward: rr ? reward(rr.eReward).items : [], rewardRow: rr ? rr.sAPBDB : '', contact: name, level: +l.nLevel || 0, off: +a.bDisabled || 0 });
    }
    return { id, key: old ? old.key : `Contacts_${d.sAPBDB}_Description${sc(d.sAPBDB)}`, row: d.sAPBDB, name, desc: text(d.sDescription),
      org: obj(d.eOrganisation) ? +d.eOrganisation.eOrganisation : +d.eOrganisation || 0, hidden: +d.bHidden || 0,
      levels: levels.map(l => ({ lvl: +l.nLevel || 0, standing: +l.nStandingThreshold || 0, ...reward(l.eRewardPackage) })) };
  });

  const msl = await missionList(); console.log(`missions: ${msl.length}`);
  const hmi = byId(held.missions, x => x.id), hs = new Map(held.missions.flatMap(m => m.stages).map(s => [s.id, s.suf]));
  const ss = suffixer(held.missions.flatMap(m => m.stages), x => x.row);
  const missions = await pool(msl, 6, async it => {
    const d = await detail('missions', it.sAPBDB); if (!d || !d.aStages || +d.bTest) return null;
    const stages = d.aStages.map(s => {
      const op = obj(s.eOperation) || {}, cat = obj(op.eTaskOperationCategory), v = obj(s.eTaskItemVariety) || {};
      return { id: +s.eTaskObjective || +s.id, row: s.sAPBDB, suf: hs.has(+s.eTaskObjective) ? hs.get(+s.eTaskObjective) : ss(s.sAPBDB), stage: +s.eStage || 0, op: op.sAPBDB || '', cat: cat ? cat.sAPBDB : '',
        n: +s.nTargetsRequired || 0, items: +s.nTaskItemsRequired || 0, veh: +s.nVehiclesRequired || 0, time: +s.nTimeLimit || 0, bonus: +s.bBonusTime || 0, conc: +s.bIsConcurrent || 0,
        opp: +s.bIsOpposition || 0, heavy: num(v.fVehicleTorqueReductionFactor) >= 0.5 ? 1 : 0, owner: text(s.sOwnerBrief), dispatch: text(s.sDispatchBrief) };
    });
    return { id: +d.eMissionTemplate || +d.id, row: d.sAPBDB, title: text(d.sMissionTitle), off: +d.bDisabled || 0, stages };
  });

  const sections = { weapons, vehicles, mods, roles, contacts, daily, missions }, out = { ...held };
  for (const [k, list] of Object.entries(sections)) {
    const got = list.filter(Boolean);
    if (!got.length) { console.warn(`${k}: nothing from APBDB, keeping the held copy`); stats[k] = { apbdb: 0, updated: 0, added: 0 }; continue; }
    const m = merge(held[k], got); out[k] = m.list; stats[k] = { apbdb: got.length, updated: m.updated, added: m.added, held: held[k].length };
    console.log(`${k}: ${got.length} from APBDB, ${m.updated} updated, ${m.added} new, ${m.list.length} total`);
  }
  if (failures > requests * 0.05) throw new Error(`${failures} of ${requests} requests failed; not writing`);
  out.apbdb = { version, synced: new Date().toISOString(), requests, failures, stats };
  await fs.writeFile(DATA, JSON.stringify(out));
  console.log(`Wrote ${path.relative(ROOT, DATA)} (${requests} requests, ${failures} failed)`);
}

main().catch(e => { console.error(e); process.exit(1); });
