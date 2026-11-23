const API = 'https://api.apbdb.com/beacon/items';
const CACHE = 'apbdb-items-v3', MAXPAGES = 200;
const one = s => String(s ?? '').replace(/\r\n|\r|\n/g, '↵');
const q = s => (s.startsWith('"') || s.endsWith('"') ? `"${s}"` : s);
export function itemsText(items) {
  const lines = ['[InventoryItemTypes]'], seen = new Set();
  for (const [row0, name, creator] of items) {
    const row = one(row0).trim(); if (!row || /[=\s]/.test(row) || seen.has(row.toLowerCase())) continue; seen.add(row.toLowerCase());
    const n = one(name), c = one(creator);
    lines.push(`InventoryItemTypes_${row}_DisplayName=${n === 'None' ? '' : q(n)}`, `InventoryItemTypes_${row}_CreatorName=${c === 'None' ? '' : q(c)}`);
  }
  return lines.join('\r\n') + '\r\n';
}

export async function apbdbInventoryItemTypes(progress = () => {}) {
  try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && typeof c.text === 'string' && Number.isFinite(c.time) && Date.now() - c.time < 864e5 && Date.now() >= c.time) return c; } catch { }
  const items = []; let page = 1, pages = 1;
  do {
    progress(`APBDB: page ${page}${pages > 1 ? ' of ' + pages : ''}…`);
    const r = await fetch(`${API}?limit=1000&page=${page}`); if (!r.ok) throw new Error('APBDB ' + r.status);
    const j = await r.json(); pages = Math.min(Math.max(1, Math.floor(+j.totalPages) || 1), MAXPAGES);
    for (const it of Array.isArray(j.items) ? j.items : []) items.push([it.sAPBDB, it.sDisplayName ?? '', it.sCreatorName ?? '']);
    page++;
  } while (page <= pages);
  const res = { time: Date.now(), items: items.length, text: itemsText(items) };
  try { localStorage.setItem(CACHE, JSON.stringify(res)); } catch { }
  return res;
}
