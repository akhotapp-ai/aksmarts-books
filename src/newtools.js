/* =====================================================================
   AK Smarts PDF v1.2: new tools
   1. Split by file size      2. Remove blank pages     3. Image to text (OCR)
   4. Scan to PDF            5. Stamps and QR code     6. Autosave and recover
   Uses the main app's tool screen (TOOLS, SEL, TXT, need, ldoc ...). add() runs once the app is unlocked.
   Everything runs on the user's device. Nothing is uploaded.
   ===================================================================== */
window.PTNew = (() => {
'use strict';
const T = o => o; // readability only

/* ---------- small helpers ---------- */
const kb = n => n < 1048576 ? Math.max(1, Math.round(n / 1024)).toLocaleString('en-US') + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
function parseSize(txt) {
  const m = /^\s*([0-9]+(?:\.[0-9]+)?)\s*(kb|k|mb|m)?\s*$/i.exec(String(txt || ''));
  if (!m) throw new UserError('Type the size like 800 KB or 1.5 MB.');
  const v = parseFloat(m[1]), mb = /^m/i.test(m[2] || '') || (!m[2] && v <= 50);
  const bytes = Math.round(v * (mb ? 1048576 : 1024));
  if (bytes < 20 * 1024) throw new UserError('That size is too small. Choose at least 20 KB.');
  return bytes;
}
const num = (n, w) => String(n).padStart(w, '0');

/* =====================================================================
   1. Split by file size
   ===================================================================== */
// Pages are grouped using each page's own size, then every part is checked by really saving it.
// A part that turns out too big is split again, so each file really is under the limit.
async function splitBySize(f, limit, P) {
  const src = await ldoc(f), n = src.getPageCount();
  const single = [];
  for (let i = 0; i < n; i++) {
    P(i / n * 0.35, `Measuring page ${i + 1} of ${n}`);
    single.push((await (await sub(src, [i])).save()).length);
  }
  const groups = []; let cur = [], sum = 0;
  for (let i = 0; i < n; i++) {
    if (cur.length && sum + single[i] > limit) { groups.push(cur); cur = []; sum = 0 }
    cur.push(i); sum += single[i];
  }
  if (cur.length) groups.push(cur);
  const parts = [], tooBig = [];
  async function make(idx, depth) {
    const bytes = await (await sub(src, idx)).save();
    if (bytes.length <= limit || idx.length === 1) {
      if (idx.length === 1 && bytes.length > limit) tooBig.push(idx[0] + 1);
      parts.push({ idx, bytes }); return;
    }
    const h = Math.ceil(idx.length / 2);
    await make(idx.slice(0, h), depth + 1); await make(idx.slice(h), depth + 1);
  }
  for (let g = 0; g < groups.length; g++) { P(0.35 + g / groups.length * 0.65, `Making file ${g + 1} of ${groups.length}`); await make(groups[g], 0) }
  // join neighbours that still fit together (the first pass can be cautious because shared fonts are counted twice)
  for (let i = 0; i < parts.length - 1;) {
    const a = parts[i], b = parts[i + 1];
    if (a.bytes.length + b.bytes.length < limit * 0.82) {
      const idx = a.idx.concat(b.idx), bytes = await (await sub(src, idx)).save();
      if (bytes.length <= limit) { parts.splice(i, 2, { idx, bytes }); continue }
    }
    i++;
  }
  return { parts, tooBig, pages: n };
}
function addSplitSize() {
  TOOLS.splitsize = {
    n: 'Split PDF by size', d: 'Cut a big PDF into parts under 1 MB, 2 MB or your own size', cat: 'org', h: 13, go: 'Split by size', isNew: 1,
    help: 'For upload limits on portals and email. Each part is checked after it is made, so every file is under the size you choose. Pages are never cut in half. The parts download together as a ZIP file.',
    opts: [SEL('max', 'Each file smaller than', [['512', '500 KB'], ['1024', '1 MB'], ['2048', '2 MB'], ['5120', '5 MB'], ['10240', '10 MB'], ['x', 'My own size']]),
      TXT('own', 'Size', 'e.g. 800 KB or 1.5 MB', { show: { max: 'x' }, hint: 'Type a number with KB or MB.' })],
    run: async ([f], o, P) => {
      const limit = o.max === 'x' ? parseSize(o.own) : (+o.max) * 1024 - 8 * 1024; // a little room under the round number
      if (f.size <= limit) throw new UserError(`This file is only ${kb(f.size)}, already under the limit. Nothing to split.`);
      const r = await splitBySize(f, limit, P), w = String(r.parts.length).length;
      if (r.parts.length === 1) throw new UserError('The file could not be split into smaller parts. Try Compress PDF first.');
      const out = r.parts.map((p, i) => ({ name: `${base(f)}-part${num(i + 1, w)}.pdf`, data: p.bytes }));
      const biggest = Math.max(...r.parts.map(p => p.bytes.length));
      let note = `Made ${out.length} files, the largest is ${kb(biggest)}.`;
      if (r.tooBig.length) note += ` Page ${r.tooBig.join(', ')} alone is bigger than the limit. Use Compress PDF on the result to make ${r.tooBig.length === 1 ? 'it' : 'them'} smaller.`;
      out[0].note = note; return out;
    }
  };
}

/* =====================================================================
   2. Remove blank pages
   ===================================================================== */
const BLANK = { careful: 0.000005, std: 0.00003, strict: 0.0006 }; // share of dark pixels (inside the edges) below which a page counts as blank
function inkShare(cv) {
  // share of "solid" dark pixels (a dark pixel with at least 3 dark neighbours: strokes of letters and lines,
  // not lone specks of dust) inside the page, leaving out the very edge where scanners leave shadows
  const w = cv.width, h = cv.height, mx = Math.round(w * 0.025), my = Math.round(h * 0.025);
  const iw = Math.max(1, w - 2 * mx), ih = Math.max(1, h - 2 * my);
  const a = cv.getContext('2d').getImageData(mx, my, iw, ih).data, dark = new Uint8Array(iw * ih);
  for (let i = 0, j = 0; j < dark.length; i += 4, j++) dark[j] = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114 < 170 ? 1 : 0;
  let solid = 0;
  for (let y = 1; y < ih - 1; y++) for (let x = 1; x < iw - 1; x++) {
    const i = y * iw + x; if (!dark[i]) continue;
    const n = dark[i - 1] + dark[i + 1] + dark[i - iw] + dark[i + iw] + dark[i - iw - 1] + dark[i - iw + 1] + dark[i + iw - 1] + dark[i + iw + 1];
    if (n >= 3) solid++;
  }
  return solid / (iw * ih);
}
async function findBlankPages(f, sens, P) {
  const pdf = await pdfjsDoc(f), n = pdf.numPages, blank = [], inks = [];
  for (let p = 1; p <= n; p++) {
    P((p - 1) / n, `Checking page ${p} of ${n}`);
    const pg = await pdf.getPage(p), w = pg.getViewport({ scale: 1 }).width;
    const r = await renderPage(pdf, p, Math.min(2, 520 / Math.max(50, w)));
    const ink = inkShare(r.cv); inks.push(ink);
    if (ink <= BLANK[sens]) blank.push(p - 1);
    r.cv.width = r.cv.height = 1;
  }
  pdf.destroy(); return { n, blank, inks };
}
function addBlankPages() {
  TOOLS.blankpages = {
    n: 'Remove blank pages', d: 'Find empty pages in a scan and delete them', cat: 'org', h: 351, go: 'Remove blank pages', isNew: 1,
    help: 'Looks at how each page really appears. Empty pages, and pages with only dust or scanner marks, are removed. Your original file is not changed. The result tells you which pages were removed, so you can check.',
    opts: [SEL('sens', 'How strict', [['std', 'Standard (ignores dust and tiny marks)'], ['careful', 'Careful (keeps a page with any small mark)'], ['strict', 'Strict (also removes pages with only a page number)']])],
    run: async ([f], o, P) => {
      const r = await findBlankPages(f, o.sens || 'std', P);
      if (!r.blank.length) return [{ name: f.name, data: new Uint8Array(await f.arrayBuffer()), note: 'No blank pages were found, so the file is unchanged. Try “Strict” if pages with only a page number should count as blank.' }];
      if (r.blank.length === r.n) throw new UserError('Every page looks blank. Try “Careful”, or check that the file isn’t a very light scan.');
      const src = await ldoc(f), skip = new Set(r.blank), keep = all(r.n).filter(i => !skip.has(i));
      const bytes = await (await sub(src, keep)).save();
      return [{ name: base(f) + '-no-blank.pdf', data: bytes, note: `Removed ${r.blank.length} blank page${r.blank.length === 1 ? '' : 's'} (page ${r.blank.map(i => i + 1).join(', ')}). ${keep.length} page${keep.length === 1 ? '' : 's'} left.` }];
    }
  };
}

/* =====================================================================
   3. Image to text (OCR)   and   4. Scan to PDF
   ===================================================================== */
function addImageText() {
  TOOLS.imgtext = {
    n: 'Image to text (OCR)', d: 'Read the text from photos and screenshots', cat: 'from', h: 251, multi: true, reorder: true, kinds: ['img'], go: 'Read the text', isNew: 1,
    help: 'Reads the words in photos, scans and screenshots (English). It runs on this device, so it takes a few seconds per picture. Clear, straight, well-lit pictures work best.',
    opts: [SEL('out', 'Save as', [['txt', 'Text file (.txt)'], ['docx', 'Word document (.docx)'], ['pdf', 'Searchable PDF']])],
    run: async (fs, o, P) => {
      const name = fs.length === 1 ? base(fs[0]) : 'pictures';
      if (o.out === 'txt') {
        const parts = [];
        for (let i = 0; i < fs.length; i++) {
          const cv = await imageCanvas(fs[i], 3500);
          const t = (await ocrLines(await toBlob(cv, 'image/png'), 1, x => P((i + x) / fs.length, `Reading picture ${i + 1} of ${fs.length}…`))).text.trim();
          parts.push(fs.length > 1 ? `----- Picture ${i + 1}: ${fs[i].name} -----\n${t}` : t);
        }
        const all = parts.join('\n\n');
        if (!all.replace(/-----[^\n]*-----/g, '').replace(/\s/g, '').length) throw new UserError('No text could be read. Try a clearer, straighter and brighter picture.');
        return [{ name: name + '-text.txt', data: new TextEncoder().encode(all + '\n'), note: 'Text copied from ' + fs.length + ' picture' + (fs.length === 1 ? '' : 's') + '. Check names and numbers before you rely on them.' }];
      }
      const d = await newDoc();
      for (let i = 0; i < fs.length; i++) { P(i / fs.length * 0.2, `Preparing picture ${i + 1}`); await addImagePage(d, fs[i], 'fit', 0) }
      const tmp = new File([await d.save()], name + '.pdf', { type: 'application/pdf' });
      if (o.out === 'docx') return [await pdfToDocx(tmp, { mode: 'text', ocr: 'auto' }, (x, t) => P(0.2 + (x || 0) * 0.8, t))];
      const r = await ocrPdf(tmp, { which: 'all' }, (x, t) => P(0.2 + (x || 0) * 0.8, t));
      return [{ name: name + '-searchable.pdf', ...r }];
    }
  };
}

// ----- picture clean-up used by Scan to PDF
function lumOf(a) { const n = a.length >> 2, L = new Uint8ClampedArray(n); for (let i = 0, j = 0; j < n; i += 4, j++) L[j] = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114; return L }
function percentile(L, p) { const h = new Uint32Array(256); for (let i = 0; i < L.length; i++) h[L[i]]++; let c = 0, t = L.length * p; for (let v = 0; v < 256; v++) { c += h[v]; if (c >= t) return v } return 255 }
function otsu(L) {
  const h = new Uint32Array(256); for (let i = 0; i < L.length; i++) h[L[i]]++;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * h[t];
  let wB = 0, sB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += h[t]; if (!wB) continue; const wF = L.length - wB; if (!wF) break; sB += t * h[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; thr = t } }
  return thr;
}
// cuts away the table or background around a paper (only when it is clearly a paper on a darker background)
function autoTrim(cv) {
  const k = Math.min(1, 420 / Math.max(cv.width, cv.height)), sw = Math.max(8, Math.round(cv.width * k)), sh = Math.max(8, Math.round(cv.height * k));
  const sm = document.createElement('canvas'); sm.width = sw; sm.height = sh; const sx = sm.getContext('2d'); sx.drawImage(cv, 0, 0, sw, sh);
  const L = lumOf(sx.getImageData(0, 0, sw, sh).data), t = otsu(L);
  let bright = 0; for (let i = 0; i < L.length; i++) if (L[i] > t) bright++;
  const frac = bright / L.length;
  if (frac > 0.93 || frac < 0.2) return cv; // no clear background: leave the picture as it is
  const rows = new Uint32Array(sh), cols = new Uint32Array(sw);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (L[y * sw + x] > t) { rows[y]++; cols[x]++ }
  const r0 = rows.findIndex(v => v > sw * 0.4), c0 = cols.findIndex(v => v > sh * 0.4);
  let r1 = -1, c1 = -1; for (let y = sh - 1; y >= 0; y--) if (rows[y] > sw * 0.4) { r1 = y; break } for (let x = sw - 1; x >= 0; x--) if (cols[x] > sh * 0.4) { c1 = x; break }
  if (r0 < 0 || c0 < 0 || r1 <= r0 || c1 <= c0) return cv;
  if ((r1 - r0) * (c1 - c0) < sw * sh * 0.35) return cv; // not sure: don't cut
  const ix = Math.round(sw * 0.012), iy = Math.round(sh * 0.012);
  const x0 = Math.round((c0 + ix) / k), y0 = Math.round((r0 + iy) / k), x1 = Math.round((c1 - ix) / k), y1 = Math.round((r1 - iy) / k);
  const out = document.createElement('canvas'); out.width = Math.max(1, x1 - x0); out.height = Math.max(1, y1 - y0);
  out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height); return out;
}
function enhance(cv, mode) {
  const w = cv.width, h = cv.height, ctx = cv.getContext('2d'), id = ctx.getImageData(0, 0, w, h), a = id.data, L = lumOf(a);
  if (mode === 'bw') {
    const W = w + 1, I = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += L[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row } }
    const r = Math.max(8, Math.round(Math.min(w, h) / 16));
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), cnt = (x1 - x0) * (y1 - y0);
        const m = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / cnt, v = L[y * w + x] < m * 0.9 && L[y * w + x] < 200 ? 0 : 255, i = (y * w + x) * 4;
        a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255;
      }
    }
  } else if (mode === 'gray') {
    const lo = percentile(L, 0.01), hi = Math.max(lo + 40, percentile(L, 0.97)), s = 255 / (hi - lo);
    for (let i = 0, j = 0; j < L.length; i += 4, j++) { const v = Math.max(0, Math.min(255, (L[j] - lo) * s)); a[i] = a[i + 1] = a[i + 2] = v }
  } else { // colour: whiten the paper a little and lift contrast
    const hi = Math.max(120, percentile(L, 0.97)), s = Math.max(1, Math.min(1.7, 238 / hi));
    for (let i = 0; i < a.length; i += 4) { a[i] = Math.min(255, a[i] * s); a[i + 1] = Math.min(255, a[i + 1] * s); a[i + 2] = Math.min(255, a[i + 2] * s) }
  }
  ctx.putImageData(id, 0, 0);
}
function addScan() {
  TOOLS.scan2pdf = {
    n: 'Scan to PDF', d: 'Photograph papers with your phone and make one clean PDF', cat: 'to', h: 51, multi: true, reorder: true, kinds: ['img'], go: 'Make PDF', isNew: 1,
    help: 'On a phone, press “Take a photo” for each page, then make the PDF. On a computer, add photos or scans. Each picture is straightened out to look like a scan: the table around the paper is trimmed away and the page is cleaned up. Put the pages in order with the arrows.',
    opts: [SEL('mode', 'Look of the pages', [['bw', 'Black and white (best for text and forms)'], ['gray', 'Grey'], ['color', 'Colour']]),
      SEL('trim', 'Trim the area around the paper', [['auto', 'Yes'], ['off', 'No']]),
      SEL('size', 'Page size', [['fit', 'Same shape as the photo'], ['a4', 'A4']])],
    run: async (fs, o, P) => {
      const d = await newDoc();
      for (let i = 0; i < fs.length; i++) {
        P(i / fs.length, `Cleaning page ${i + 1} of ${fs.length}`);
        let cv = await imageCanvas(fs[i], 2600);
        if (o.trim === 'auto') cv = autoTrim(cv);
        enhance(cv, o.mode);
        const png = o.mode === 'bw', im = png ? await d.embedPng(await blobU8(await toBlob(cv, 'image/png'))) : await d.embedJpg(await blobU8(await toBlob(cv, 'image/jpeg', .85)));
        let pw, ph, iw = 595.28, ih = 595.28 * cv.height / cv.width;
        if (o.size === 'a4') { pw = 595.28; ph = 841.89; const k = Math.min(pw / cv.width, ph / cv.height); iw = cv.width * k; ih = cv.height * k }
        else { pw = iw; ph = ih }
        d.addPage([pw, ph]).drawImage(im, { x: (pw - iw) / 2, y: (ph - ih) / 2, width: iw, height: ih });
        cv.width = cv.height = 1;
      }
      return [{ name: 'scan-' + new Date().toISOString().slice(0, 10) + '.pdf', data: await d.save(), note: `${fs.length} page${fs.length === 1 ? '' : 's'} made. Check the pages, then use Compress PDF if you need a smaller file.` }];
    }
  };
  // a “Take a photo” button on the Scan screen (opens the phone camera app)
  const _open = openGeneric;
  openGeneric = function (id) {
    const r = _open.apply(this, arguments);
    const old = document.getElementById('ptTakePhoto'); if (old) old.remove();
    if (id === 'scan2pdf') {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'ptTakePhoto'; b.className = 'btn pt-take'; b.textContent = 'Take a photo';
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); inp.hidden = true;
      b.onclick = () => inp.click();
      inp.onchange = () => {
        const got = [...inp.files].filter(isImg); inp.value = '';
        if (got.length) { gfiles = gfiles.concat(got); $('gres').hidden = true; setMsg('gmsg', ''); drawFiles() }
      };
      const z = $('gdrop'); z.parentNode.insertBefore(b, z.nextSibling); b.after(inp);
    }
    return r;
  };
}

/* =====================================================================
   5. Stamps and QR code
   ===================================================================== */
const QR = (() => {
  // QR code, byte mode, error correction M, versions 1 to 10 (up to 213 characters)
  const V = { 1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39], 9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44] };
  const AL = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] }
  const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  function rsGen(n) { let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]) } g = ng } return g }
  function rsRem(data, n) { const g = rsGen(n), r = new Array(n).fill(0); for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < n; i++) r[i] ^= mul(g[i + 1], f) } return r }
  const bit = (x, i) => (x >>> i) & 1;
  function encode(text) {
    const bytes = [...new TextEncoder().encode(String(text))];
    let ver = 0;
    for (let v = 1; v <= 10; v++) { const [, b1, d1, b2, d2] = V[v], cap = b1 * d1 + b2 * d2, need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8; if (need <= cap * 8) { ver = v; break } }
    if (!ver) throw new UserError('That is too long for a QR code here. Use up to about 200 characters.');
    const [ecc, b1, d1, b2, d2] = V[ver], cap = b1 * d1 + b2 * d2, bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push(bit(v, i)) };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v) }
    for (let p = 0xec; data.length < cap; p ^= 0xec ^ 0x11) data.push(p);
    const blocks = []; let pos = 0;
    for (let i = 0; i < b1 + b2; i++) { const len = i < b1 ? d1 : d2, d = data.slice(pos, pos + len); pos += len; blocks.push({ d, e: rsRem(d, ecc) }) }
    const all = []; for (let i = 0; i < Math.max(d1, d2); i++) blocks.forEach(b => { if (i < b.d.length) all.push(b.d[i]) });
    for (let i = 0; i < ecc; i++) blocks.forEach(b => all.push(b.e[i]));
    const size = ver * 4 + 17, mod = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (x, y, d) => { if (x >= 0 && y >= 0 && x < size && y < size) { mod[y][x] = d; fn[y][x] = true } };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0) }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); setF(cx + dx, cy + dy, d !== 2 && d !== 4) }
    const al = AL[ver];
    for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const fmt = mask => {
      let d = (0 << 3) | mask, r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const bits = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setF(8, i, !!bit(bits, i)); setF(8, 7, !!bit(bits, 6)); setF(8, 8, !!bit(bits, 7)); setF(7, 8, !!bit(bits, 8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, !!bit(bits, i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, !!bit(bits, i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, !!bit(bits, i));
      setF(8, size - 8, true);
    };
    fmt(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const bits = (ver << 12) | r; for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); setF(a, b, !!bit(bits, i)); setF(b, a, !!bit(bits, i)) } }
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x]) { mod[y][x] = k < all.length * 8 ? !!bit(all[k >>> 3], 7 - (k & 7)) : false; k++ }
      }
    }
    const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && masks[m](x, y)) mod[y][x] = !mod[y][x] };
    const penalty = () => {
      let p = 0;
      for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (mod[y][x] === mod[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++ } else run = 1 } }
      for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (mod[y][x] === mod[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++ } else run = 1 } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
      let dark = 0; for (const r of mod) for (const v of r) if (v) dark++;
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0, bp = Infinity;
    for (let m = 0; m < 8; m++) { apply(m); fmt(m); const p = penalty(); if (p < bp) { bp = p; best = m } apply(m) }
    apply(best); fmt(best);
    return mod;
  }
  return { encode };
})();

const STAMPS = [['PAID', 'PAID'], ['RECEIVED', 'RECEIVED'], ['APPROVED', 'APPROVED'], ['REJECTED', 'REJECTED'], ['CONFIDENTIAL', 'CONFIDENTIAL'], ['DRAFT', 'DRAFT'], ['COPY', 'COPY'], ['custom', 'My own text'], ['qr', 'QR code']];
const POS = [['br', 'Bottom right'], ['bl', 'Bottom left'], ['bc', 'Bottom centre'], ['tr', 'Top right'], ['tl', 'Top left'], ['tc', 'Top centre'], ['c', 'Centre'], ['mr', 'Middle right'], ['ml', 'Middle left']];
const COLS = { red: [0.78, 0.1, 0.1], green: [0.08, 0.5, 0.25], blue: [0.1, 0.3, 0.75], black: [0.1, 0.1, 0.1] };
function anchor(pos, pw, ph, w, h, m) {
  const x = pos.endsWith('l') ? m : pos.endsWith('r') ? pw - w - m : (pw - w) / 2;
  const y = pos.startsWith('t') ? ph - h - m : pos.startsWith('b') ? m : (ph - h) / 2;
  return [pos === 'c' ? (pw - w) / 2 : x, pos === 'c' ? (ph - h) / 2 : y];
}
function addStamps() {
  TOOLS.stamps = {
    n: 'Stamps and QR code', d: 'Add PAID, RECEIVED, APPROVED or a QR code to your pages', cat: 'opt', h: 321, go: 'Add stamp', isNew: 1,
    help: 'Put a stamp such as PAID or APPROVED, your own text, or a QR code (for a link or a number) on all pages, the first or last page, or the pages you choose.',
    opts: [SEL('kind', 'Stamp', STAMPS),
      TXT('text', 'Your text', 'e.g. Verified by Accounts', { show: { kind: 'custom' } }),
      TXT('qr', 'Text or link for the QR code', 'https://…', { show: { kind: 'qr' }, hint: 'Up to about 200 characters.' }),
      SEL('pos', 'Position', POS), SEL('size', 'Size', [['m', 'Medium'], ['s', 'Small'], ['l', 'Large']]),
      SEL('pages', 'On which pages', [['all', 'All pages'], ['first', 'First page only'], ['last', 'Last page only'], ['rng', 'Pages I choose']]),
      TXT('rng', 'Pages', '1, 3-5', { show: { pages: 'rng' }, hint: 'Example: 1, 3-5' }),
      SEL('col', 'Colour', [['red', 'Red'], ['green', 'Green'], ['blue', 'Blue'], ['black', 'Black']], { show: {} }),
      SEL('date', 'Add today’s date', [['no', 'No'], ['yes', 'Yes']])],
    run: async ([f], o, P) => {
      const doc = await ldoc(f), n = doc.getPageCount(), pgs = doc.getPages();
      let idx = o.pages === 'first' ? [0] : o.pages === 'last' ? [n - 1] : o.pages === 'rng' ? pr(o.rng, n) : all(n);
      if (o.pages === 'rng' && !String(o.rng || '').trim()) throw new UserError('Type the pages first, like 1, 3-5.');
      const isQr = o.kind === 'qr', label = o.kind === 'custom' ? String(o.text || '').trim() : o.kind;
      if (isQr && !String(o.qr || '').trim()) throw new UserError('Type the text or link for the QR code.');
      if (o.kind === 'custom' && !label) throw new UserError('Type the text for the stamp.');
      const col = COLS[o.col] || COLS.red, rgb = PDFLib.rgb(col[0], col[1], col[2]);
      const S = { s: 0.65, m: 1, l: 1.6 }[o.size] || 1;
      const date = o.date === 'yes' ? new Date().toLocaleDateString('en-GB').replace(/\//g, '-') : '';
      const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const modules = isQr ? QR.encode(String(o.qr).trim()) : null;
      for (let k = 0; k < idx.length; k++) {
        P(k / idx.length, `Stamping page ${idx[k] + 1}`);
        const page = pgs[idx[k]], { width: pw, height: ph } = page.getSize(), M = 28;
        if (isQr) {
          const cells = modules.length, box = 90 * S, q = box / (cells + 8), tot = box;
          const [x0, y0] = anchor(o.pos, pw, ph, tot, tot, M);
          page.drawRectangle({ x: x0, y: y0, width: tot, height: tot, color: PDFLib.rgb(1, 1, 1) });
          for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) if (modules[r][c]) page.drawRectangle({ x: x0 + (c + 4) * q, y: y0 + tot - (r + 5) * q, width: q + 0.05, height: q + 0.05, color: PDFLib.rgb(0, 0, 0) });
          if (date) page.drawText(date, { x: x0, y: y0 - 9 * S, size: 8 * S, font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
          continue;
        }
        const fs1 = 24 * S, fs2 = fs1 * 0.45, pad = fs1 * 0.4, w1 = font.widthOfTextAtSize(label, fs1), w2 = date ? font.widthOfTextAtSize(date, fs2) : 0;
        const w = Math.max(w1, w2) + pad * 2, h = fs1 + (date ? fs2 * 1.5 : 0) + pad * 2;
        const [bx, by] = anchor(o.pos, pw, ph, w, h, M), th = -8 * Math.PI / 180, cx = bx + w / 2, cy = by + h / 2;
        const at = (lx, ly) => [cx + (lx - w / 2) * Math.cos(th) - (ly - h / 2) * Math.sin(th), cy + (lx - w / 2) * Math.sin(th) + (ly - h / 2) * Math.cos(th)];
        const rot = PDFLib.degrees(-8), [rx, ry] = at(0, 0);
        page.drawRectangle({ x: rx, y: ry, width: w, height: h, borderColor: rgb, borderWidth: 2.2 * S, borderOpacity: 0.9, rotate: rot });
        const [tx, ty] = at((w - w1) / 2, pad + (date ? fs2 * 1.5 : 0) + fs1 * 0.12);
        page.drawText(label, { x: tx, y: ty, size: fs1, font, color: rgb, opacity: 0.9, rotate: rot });
        if (date) { const [dx, dy] = at((w - w2) / 2, pad * 0.9); page.drawText(date, { x: dx, y: dy, size: fs2, font, color: rgb, opacity: 0.9, rotate: rot }) }
      }
      return [{ name: base(f) + '-stamped.pdf', data: await doc.save(), note: `${isQr ? 'QR code' : 'Stamp'} added to ${idx.length} page${idx.length === 1 ? '' : 's'}.` }];
    }
  };
}

/* =====================================================================
   6. Autosave and recover
   Edits are saved on this device every 30 seconds while a document has unsaved changes, and are
   offered back after a crash or a closed tab. Removed when you save or close the document.
   ===================================================================== */
const AS = { db: null, ids: new Set(), keys: {}, busy: false, delay: 30000, warned: false };
const asOn = () => { try { return localStorage.getItem('pt-autosave') !== '0' } catch (e) { return true } };
function idb() {
  if (AS.db) return Promise.resolve(AS.db);
  return new Promise((res, rej) => {
    let r; try { r = indexedDB.open('aksmarts-recover', 1) } catch (e) { return rej(e) }
    r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id' });
    r.onsuccess = () => { AS.db = r.result; res(r.result) }; r.onerror = () => rej(r.error);
  });
}
const idbDo = (mode, fn) => idb().then(db => new Promise((res, rej) => { const tx = db.transaction('docs', mode), st = tx.objectStore('docs'), q = fn(st); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) }));
const asList = () => idbDo('readonly', s => s.getAll()).then(a => a || []);
const asPut = rec => idbDo('readwrite', s => s.put(rec));
const asDel = id => idbDo('readwrite', s => s.delete(id));
function asKey(d) { try { return d.undo.length + '/' + d.redo.length + '/' + d.pages.length + '/' + d.pages.reduce((a, p) => a + p.objs.length, 0) } catch (e) { return String(Math.random()) } }
async function asTick() {
  if (AS.busy || !asOn() || document.hidden) return;
  AS.busy = true;
  try {
    for (const d of DOCS) {
      if (!d.dirty) { if (AS.ids.has(d.id)) { AS.ids.delete(d.id); delete AS.keys[d.id]; await asDel(d.id) } continue }
      const k = asKey(d); if (AS.keys[d.id] === k) continue;
      const t0 = Date.now(), bytes = await buildDoc(d, { flatten: false, prog: () => {} });
      await asPut({ id: d.id, name: d.name, time: Date.now(), bytes });
      AS.ids.add(d.id); AS.keys[d.id] = k;
      if (Date.now() - t0 > 4000) AS.delay = Math.min(120000, AS.delay * 2); // big file: save less often
    }
    for (const id of [...AS.ids]) if (!DOCS.some(d => d.id === id)) { AS.ids.delete(id); await asDel(id) } // closed on purpose
  } catch (e) {
    if (!AS.warned) { AS.warned = true; console.warn('autosave', e); if (e && /quota/i.test(e.name + e.message)) toast('Autosave could not save: not enough space on this device.', true) }
  } finally { AS.busy = false }
}
function showRecover(recs) {
  if (document.getElementById('ptRec')) return;
  const box = document.createElement('div'); box.id = 'ptRec'; box.className = 'pt-rec'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-label', 'Restore unsaved work');
  const when = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  box.innerHTML = '<b>Restore your unsaved work?</b><p>The app was closed before these were saved. They were kept on this device only.</p><ul></ul><div class="pt-rec-row"><button type="button" class="btn pri" data-a="all">Restore</button><button type="button" class="btn" data-a="no">Delete them</button></div><button type="button" class="linkbtn" data-a="off">Turn off autosave on this device</button>';
  const ul = box.querySelector('ul');
  recs.forEach(r => { const li = document.createElement('li'); li.textContent = `${r.name} · saved ${when(r.time)} · ${kb(r.bytes.length)}`; ul.appendChild(li) });
  box.addEventListener('click', async e => {
    const a = e.target.closest('button') && e.target.closest('button').dataset.a; if (!a) return;
    try {
      if (a === 'all') { for (const r of recs) { await wsOpenBytes(r.bytes, r.name, { converted: true }); await asDel(r.id) } toast('Your work was restored. Save it to keep it.') }
      else if (a === 'no') { for (const r of recs) await asDel(r.id) }
      else if (a === 'off') { try { localStorage.setItem('pt-autosave', '0') } catch (er) {} for (const r of recs) await asDel(r.id); toast('Autosave is off on this device.') }
    } catch (er) { console.error(er); toast(errText(er), true) }
    box.remove();
  });
  document.body.appendChild(box);
}
async function asStart() {
  if (!window.indexedDB) return;
  try {
    const week = Date.now() - 7 * 864e5, recs = await asList();
    for (const r of recs.filter(r => r.time < week)) await asDel(r.id);
    const fresh = recs.filter(r => r.time >= week && !DOCS.some(d => d.id === r.id));
    if (fresh.length && asOn()) showRecover(fresh.sort((a, b) => b.time - a.time).slice(0, 5));
  } catch (e) { console.warn('recover', e) }
  const loop = () => setTimeout(async () => { await asTick(); loop() }, AS.delay);
  loop();
  window.addEventListener('pagehide', () => { asTick() });
}

/* =====================================================================
   7. Fit every screen: Automatic zoom fills the window on laptops and large monitors
   (it used to stop at 125%, so a Full HD screen showed the page in a narrow column).
   Small screens behave exactly as before. The home and tool pages widen in addon.css.
   ===================================================================== */
const AUTO_MAX = 2.4;
function addScreenFit() {
  if (typeof fitScale !== 'function' || fitScale._pt) return;
  const _fit = fitScale;
  fitScale = function (mode) {
    if (mode !== 'auto') return _fit.apply(this, arguments);
    return Math.max(0.1, Math.min(_fit('width'), AUTO_MAX)); // fit the width, up to 240%
  };
  fitScale._pt = 1;
}

/* ---------- register everything ---------- */
function add() {
  if (TOOLS.splitsize) return;
  addScreenFit();
  addSplitSize(); addBlankPages(); addImageText(); addScan(); addStamps();
  TI.splitsize = 'M4 4h16v6H4zM4 14h16v6H4zM8 12h8M12 10v4';
  TI.blankpages = 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h4M3 3l18 18';
  TI.imgtext = 'M4 5h16v14H4zM7 15l3-4 2 3 2-2 3 3M8 8h4M14 8h2';
  TI.scan2pdf = 'M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 8h8v8H8z';
  TI.stamps = 'M8 13V9a4 4 0 1 1 8 0v4M5 13h14v3H5zM6 20h12v-4H6z';
  ORDER.splice(ORDER.indexOf('split') + 1, 0, 'splitsize');
  ORDER.splice(ORDER.indexOf('remove') + 1, 0, 'blankpages');
  ORDER.splice(ORDER.indexOf('jpg2pdf') + 1, 0, 'scan2pdf');
  ORDER.splice(ORDER.indexOf('text') + 1, 0, 'imgtext');
  ORDER.splice(ORDER.indexOf('watermark') + 1, 0, 'stamps');
  asStart();
}
return { add, QR, findBlankPages, splitBySize, autoTrim, enhance, inkShare, asTick };
})();
