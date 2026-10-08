export function repairCrCrLf(bytes) {
  if (!(bytes[0] === 0xff && bytes[1] === 0xfe)) return { bytes, fixed: 0 };
  const out = new Uint8Array(bytes.length); let o = 0, fixed = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x00 && bytes[i + 2] === 0x0d && bytes[i + 3] === 0x0a && bytes[i + 4] === 0x00) {
      out.set([0x0d, 0x00, 0x0a, 0x00], o); o += 4; i += 4; fixed++;
    } else out[o++] = bytes[i];
  }
  return { bytes: fixed ? out.slice(0, o) : bytes, fixed };
}

const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
export function decodeText(bytes) {
  const r = repairCrCrLf(bytes); bytes = r.bytes;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), enc: 'utf-16le', bom: true, fixed: r.fixed };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), enc: 'utf-16be', bom: true, fixed: r.fixed };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), enc: 'utf-8', bom: true, fixed: r.fixed };
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), enc: 'utf-8', bom: false, fixed: r.fixed }; }
  catch { return { text: new TextDecoder('windows-1252').decode(bytes), enc: 'cp1252', bom: false, fixed: r.fixed }; }
}
export function encodeText(text, enc, bom) {
  if (enc === 'utf-16le' || enc === 'utf-16be') {
    const out = new Uint8Array((bom ? 2 : 0) + text.length * 2); let o = 0;
    if (bom) { out.set(enc === 'utf-16le' ? [0xff, 0xfe] : [0xfe, 0xff]); o = 2; }
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (enc === 'utf-16le') { out[o++] = c & 255; out[o++] = c >> 8; } else { out[o++] = c >> 8; out[o++] = c & 255; }
    }
    return out;
  }
  if (enc === 'cp1252') {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i), k = CP1252.indexOf(text[i]); out[i] = k >= 0 ? 0x80 + k : c < 256 ? c : 0x3f; }
    return out;
  }
  const u = new TextEncoder().encode(text);
  if (!bom) return u;
  const out = new Uint8Array(u.length + 3); out.set([0xef, 0xbb, 0xbf]); out.set(u, 3); return out;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }

export async function readZip(buf) {
  const b = new Uint8Array(buf), dv = new DataView(buf); let e = b.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip file');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const flags = dv.getUint16(p + 8, true), lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'windows-1252').decode(b.subarray(p + 46, p + 46 + nl)).replace(/\\/g, '/');
    p += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = b.subarray(ds, ds + csize);
    if (method === 0) out.push({ name, data: raw.slice() });
    else if (method === 8) out.push({ name, data: await pipe(raw, new DecompressionStream('deflate-raw')) });
    else throw new Error(`${name}: unsupported compression method ${method}`);
  }
  return out;
}

export async function writeZip(files) {
  const parts = [], dir = []; let off = 0;
  const u16 = v => [v & 255, v >> 8], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = new TextEncoder().encode(f.name), crc = crc32(f.data), comp = await pipe(f.data, new CompressionStream('deflate-raw'));
    const use = comp.length < f.data.length, body = use ? comp : f.data, method = use ? 8 : 0;
    const head = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x800), ...u16(method), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(body.length), ...u32(f.data.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, body);
    dir.push(new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x800), ...u16(method), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(body.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + body.length;
  }
  const dsize = dir.reduce((a, x) => a + x.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(dsize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...dir, end], { type: 'application/zip' });
}

export async function readInputs(fileList) {
  const out = [];
  for (const f of fileList) {
    const buf = await f.arrayBuffer(), path = (f.webkitRelativePath || f.name).replace(/\\/g, '/');
    if (/\.zip$/i.test(f.name)) (await readZip(buf)).forEach(x => out.push(x));
    else out.push({ name: path, data: new Uint8Array(buf) });
  }
  return out;
}
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
