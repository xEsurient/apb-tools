const API = 'https://api.apbdb.com/beacon/items';
const CACHE = 'apbdb-items-v3';

export async function apbdbInventoryItemTypes(progress = () => {}) {
  try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && Date.now() - c.time < 864e5) return c; } catch { }
  const items = []; let page = 1, pages = 1;
  do {
    progress(`APBDB: page ${page}${pages > 1 ? ' of ' + pages : ''}…`);
    const r = await fetch(`${API}?limit=1000&page=${page}`); if (!r.ok) throw new Error('APBDB ' + r.status);
    const j = await r.json(); pages = j.totalPages || 1;
    for (const it of j.items || []) items.push([it.sAPBDB, it.sDisplayName ?? '', it.sCreatorName ?? '']);
    page++;
  } while (page <= pages);
  const q = s => (s.startsWith('"') || s.endsWith('"') ? `"${s}"` : s);
  const lines = ['[InventoryItemTypes]'];
  for (const [row, name, creator] of items) {
    if (!row) continue;
    lines.push(`InventoryItemTypes_${row}_DisplayName=${name === 'None' ? '' : q(name)}`, `InventoryItemTypes_${row}_CreatorName=${creator === 'None' ? '' : q(creator)}`);
  }
  const res = { time: Date.now(), items: items.length, text: lines.join('\r\n') + '\r\n' };
  try { localStorage.setItem(CACHE, JSON.stringify(res)); } catch { }
  return res;
}
