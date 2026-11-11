/* =====================================================================
   AK Smarts PDF: strong compression for PDFs and pictures.
   Everything runs on the user's device. Uses the main app's helpers
   (pdf-lib, PDF.js, qpdf), so it is only called after the app is unlocked.

   PDFs, in order:
   1. identical pictures and fonts stored many times (common after merging) are stored once
   2. every picture is made smaller: any kind PDF.js can show (JPEG, PNG-style, CMYK, palette,
      16-bit, JPEG 2000, ...), resized for the level and saved as JPEG; near-grey scans become grey
   3. hidden extras are removed (thumbnails, editing data from other apps, XMP at strong levels)
   4. the file is rewritten compactly (qpdf: object streams, best Flate)
   5. at the strong levels, if that still isn't enough (e.g. a text PDF with big embedded fonts),
      each page is saved as a picture with an invisible text layer, so text stays searchable.
   A target size ("under 1 MB") tries stronger steps until the file fits.
   ===================================================================== */
window.PTCompress = (() => {
'use strict';
const L = () => PDFLib;
const PNm = n => PDFLib.PDFName.of(n);

// longest side in pixels, JPEG quality, turn near-grey scans grey, wanted saving, page-picture fallback
const PDF_LV = {
  '90': { px: 2400, q: .8, gray: false, want: 0, raster: null },
  '75': { px: 1800, q: .66, gray: false, want: .2, raster: null },
  '50': { px: 1400, q: .5, gray: true, want: .4, raster: { dpi: 110, q: .5 } },
  '25': { px: 1050, q: .36, gray: true, want: .6, raster: { dpi: 84, q: .38 } }
};
// steps used when a target size is given: first keep text, then page pictures, smaller and smaller
const LADDER = [
  { k: 's', lv: '75' }, { k: 's', lv: '50' }, { k: 's', lv: '25' },
  { k: 'r', dpi: 120, q: .55 }, { k: 'r', dpi: 100, q: .48 }, { k: 'r', dpi: 84, q: .4 },
  { k: 'r', dpi: 72, q: .34 }, { k: 'r', dpi: 60, q: .3 }, { k: 'r', dpi: 50, q: .26 }, { k: 'r', dpi: 40, q: .22 }
];
const IMG_LV = {
  '90': { px: 3200, q: .86, want: 0, gray: false },
  '75': { px: 2200, q: .72, want: .2, gray: false },
  '50': { px: 1600, q: .55, want: .45, gray: true },
  '25': { px: 1200, q: .4, want: .65, gray: true }
};

const sleep0 = () => new Promise(r => setTimeout(r, 0));
async function sha1(u) { const h = new Uint8Array(await crypto.subtle.digest('SHA-1', u)); let s = ''; for (const b of h) s += b.toString(16).padStart(2, '0'); return s }

/* ---------- pixels ---------- */
// how colourful a picture is (0 = grey). Samples about 40 000 pixels.
function colourfulness(cv) {
  const c = cv.getContext('2d', { willReadFrequently: true }), d = c.getImageData(0, 0, cv.width, cv.height).data;
  const step = Math.max(1, Math.floor(d.length / 4 / 40000)) * 4;
  let sum = 0, n = 0, strong = 0;
  for (let i = 0; i < d.length; i += step) { const r = d[i], g = d[i + 1], b = d[i + 2], m = Math.max(r, g, b) - Math.min(r, g, b); sum += m; if (m > 60) strong++; n++ }
  return { mean: n ? sum / n : 0, strong: n ? strong / n : 0 };
}
function makeGrey(cv) {
  const c = cv.getContext('2d', { willReadFrequently: true }), im = c.getImageData(0, 0, cv.width, cv.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; d[i] = d[i + 1] = d[i + 2] = y }
  c.putImageData(im, 0, 0);
}
// a scan of a paper document is mostly grey even when photographed in colour (slightly yellow paper etc.)
const looksGrey = cv => { const c = colourfulness(cv); return c.mean < 14 && c.strong < .004 };
function scaled(src, w, h) {
  const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h);
  const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.imageSmoothingQuality = 'high';
  // big reductions look better done in halves
  let s = src, sw = src.width, sh = src.height;
  while (sw / 2 > w * 1.2 && sh / 2 > h * 1.2) {
    const t = document.createElement('canvas'); t.width = Math.round(sw / 2); t.height = Math.round(sh / 2);
    const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(s, 0, 0, t.width, t.height);
    if (s !== src && s.close) s.close(); s = t; sw = t.width; sh = t.height;
  }
  c.drawImage(s, 0, 0, cv.width, cv.height);
  return cv;
}
async function deflate(u) {
  const out = await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
  return new Uint8Array(out);
}

/* ---------- PDF helpers ---------- */
const isImageStream = s => s instanceof L().PDFRawStream && s.dict.get(PNm('Subtype')) === PNm('Image');
const num = (d, k) => { const v = d.lookup(PNm(k)); return v && v.asNumber ? v.asNumber() : 0 };
const filters = d => { const f = d.lookup(PNm('Filter')); return f instanceof L().PDFArray ? f.asArray().map(x => x.asString ? x.asString() : String(x)) : f ? [f.asString ? f.asString() : String(f)] : [] };
function walkFix(o, remap, seen) {
  const { PDFDict, PDFArray, PDFRef, PDFStream } = L();
  if (o instanceof PDFStream) o = o.dict;
  if (!o || seen.has(o)) return; seen.add(o);
  if (o instanceof PDFDict) { for (const [k, v] of o.entries()) { if (v instanceof PDFRef) { const n = remap.get(v.tag); if (n) o.set(k, n) } else walkFix(v, remap, seen) } }
  else if (o instanceof PDFArray) { for (let i = 0; i < o.size(); i++) { const v = o.get(i); if (v instanceof PDFRef) { const n = remap.get(v.tag); if (n) o.set(i, n) } else walkFix(v, remap, seen) } }
}
// the same picture or font stored several times (e.g. a logo on every merged page) is kept once
async function dedupe(doc) {
  const ctx = doc.context, seen = new Map(), remap = new Map();
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof L().PDFRawStream) || obj.contents.length < 1024) continue;
    const key = obj.dict.toString().replace(/\/Length\s+\d+(\s+\d+\s+R)?/, '') + '#' + obj.contents.length + '#' + await sha1(obj.contents);
    const first = seen.get(key);
    if (first) remap.set(ref.tag, first); else seen.set(key, ref);
  }
  if (!remap.size) return 0;
  const vis = new Set();
  for (const [, obj] of ctx.enumerateIndirectObjects()) walkFix(obj, remap, vis);
  for (const tag of remap.keys()) { const [n, g] = tag.split(' '); ctx.delete(L().PDFRef.of(+n, +g)) }
  return remap.size;
}
// thumbnails, other apps' private editing data, and (at strong levels) XMP metadata
function stripExtras(doc, strong) {
  const ctx = doc.context;
  for (const p of doc.getPages()) { p.node.delete(PNm('Thumb')); p.node.delete(PNm('PieceInfo')) }
  doc.catalog.delete(PNm('PieceInfo'));
  if (strong) {
    doc.catalog.delete(PNm('Metadata'));
    for (const [, o] of ctx.enumerateIndirectObjects()) if (isImageStream(o)) { o.dict.delete(PNm('Metadata')); o.dict.delete(PNm('Alternates')) }
  }
}

/* ---------- decoding one picture from a PDF ---------- */
// Fast path for ordinary JPEG pictures; anything else is drawn by PDF.js from a tiny one-picture PDF,
// which handles every picture type PDF.js understands (CMYK, palette, 16-bit, JPEG 2000, PNG predictors...).
async function drawPicture(doc, ref, s, w, h, nw, nh) {
  const d = s.dict, fl = filters(d), last = fl[fl.length - 1] || '';
  const cs = d.lookup(PNm('ColorSpace'));
  const simpleCs = cs === PNm('DeviceRGB') || cs === PNm('DeviceGray') || cs === PNm('CalRGB') || cs === PNm('CalGray') ||
    (cs instanceof L().PDFArray && cs.lookup(0) === PNm('ICCBased') && [1, 3].includes(num(cs.lookup(1).dict || cs.lookup(1), 'N')));
  if (last === '/DCTDecode' && simpleCs && !d.has(PNm('Decode'))) {
    try {
      let jpg = s.contents;
      if (fl.length > 1) jpg = L().decodePDFRawStream(L().PDFRawStream.of(doc.context.obj({ Filter: fl.slice(0, -1).map(x => x.slice(1)) }), s.contents)).decode();
      const bm = await createImageBitmap(new Blob([jpg], { type: 'image/jpeg' }));
      const cv = scaled(bm, nw, nh); bm.close && bm.close(); return cv;
    } catch (e) { /* fall through to PDF.js */ }
  }
  const nd = await L().PDFDocument.create();
  const copy = L().PDFObjectCopier.for(doc.context, nd.context).copy(s);
  copy.dict.delete(PNm('SMask')); copy.dict.delete(PNm('Mask')); copy.dict.delete(PNm('Metadata'));
  const iref = nd.context.register(copy);
  const pg = nd.addPage([nw, nh]);
  pg.node.set(PNm('Resources'), nd.context.obj({ XObject: { Im0: iref } }));
  pg.node.set(PNm('Contents'), nd.context.register(nd.context.stream(`q ${nw} 0 0 ${nh} 0 0 cm /Im0 Do Q`)));
  const bytes = await nd.save({ useObjectStreams: false });
  need('pdfjs');
  const pdf = await pdfjsLib.getDocument({ data: bytes, isEvalSupported: false, useWorkerFetch: false, enableXfa: false }).promise;
  try { const r = await renderPage(pdf, 1, 1); return r.cv } finally { pdf.destroy() }
}

/* ---------- step 2: smaller pictures ---------- */
async function shrinkPictures(doc, cfg, P, stats) {
  const ctx = doc.context, list = ctx.enumerateIndirectObjects().filter(([, s]) => isImageStream(s));
  // soft masks (transparency) are pictures too, but must stay grey and lossless
  const maskOf = new Map();
  for (const [ref, s] of list) for (const k of ['SMask', 'Mask']) { const m = s.dict.get(PNm(k)); if (m instanceof L().PDFRef) maskOf.set(m.tag, ref) }
  const scaleOf = new Map();
  for (let i = 0; i < list.length; i++) {
    const [ref, s] = list[i], d = s.dict;
    P && P(i / list.length, `Making pictures smaller: ${i + 1} of ${list.length}`);
    if (i % 3 === 0) await sleep0();
    if (maskOf.has(ref.tag)) continue;
    try {
      const im = d.lookup(PNm('ImageMask')); if (im && im.asBoolean && im.asBoolean()) continue;
      const w = num(d, 'Width'), h = num(d, 'Height'), bpc = num(d, 'BitsPerComponent') || 8, fl = filters(d);
      if (!w || !h || w * h < 16000) continue;
      // black-and-white scans (fax / JBIG2) are already tiny; JPEG would make them bigger
      if (bpc === 1 || fl.includes('/CCITTFaxDecode') || fl.includes('/JBIG2Decode')) continue;
      const k = Math.min(1, cfg.px / Math.max(w, h)), nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k));
      const cv = await drawPicture(doc, ref, s, w, h, nw, nh);
      if (cfg.gray && looksGrey(cv)) makeGrey(cv);
      const jpg = await blobU8(await toBlob(cv, 'image/jpeg', cfg.q));
      cv.width = cv.height = 1;
      if (jpg.length > s.contents.length * .93) continue;
      const nd = ctx.obj({ Type: 'XObject', Subtype: 'Image', Width: nw, Height: nh, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode', Length: jpg.length });
      for (const key of ['SMask', 'Mask', 'Interpolate', 'Intent', 'OC', 'StructParent', 'ID']) { const v = d.get(PNm(key)); if (v && !(key === 'Mask' && !(v instanceof L().PDFRef))) nd.set(PNm(key), v) }
      ctx.assign(ref, L().PDFRawStream.of(nd, jpg));
      stats.pics++; stats.saved += s.contents.length - jpg.length;
      if (k < 1) scaleOf.set(ref.tag, k);
    } catch (e) { console.warn('picture skipped', e) }
  }
  // transparency masks of pictures that were resized: resize them too (stay grey, lossless Flate)
  for (const [mtag, pref] of maskOf) {
    try {
      if (!scaleOf.has(pref.tag)) continue;
      const [n, g] = mtag.split(' '), mref = L().PDFRef.of(+n, +g), m = ctx.lookup(mref);
      if (!isImageStream(m) || m.dict.has(PNm('Matte')) || num(m.dict, 'BitsPerComponent') !== 8) continue;
      const w = num(m.dict, 'Width'), h = num(m.dict, 'Height'), k = scaleOf.get(pref.tag);
      const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k)); if (w * h < 16000) continue;
      const cv = await drawPicture(doc, mref, m, w, h, nw, nh);
      const px = cv.getContext('2d').getImageData(0, 0, nw, nh).data, grey = new Uint8Array(nw * nh);
      for (let j = 0; j < grey.length; j++) grey[j] = px[j * 4];
      const z = await deflate(grey);
      if (z.length >= m.contents.length) continue;
      ctx.assign(mref, L().PDFRawStream.of(ctx.obj({ Type: 'XObject', Subtype: 'Image', Width: nw, Height: nh, ColorSpace: 'DeviceGray', BitsPerComponent: 8, Filter: 'FlateDecode', Length: z.length }), z));
    } catch (e) { console.warn('mask skipped', e) }
  }
}

/* ---------- PDF: keep text, shrink everything else ---------- */
async function structural(bytes, lv, P) {
  const cfg = PDF_LV[lv], stats = { pics: 0, saved: 0, dups: 0 };
  P && P(null, 'Reading the PDF…');
  const doc = await ldoc(bytes);
  try { stats.dups = await dedupe(doc) } catch (e) { console.warn('dedupe', e) }
  try { stripExtras(doc, lv === '50' || lv === '25') } catch (e) { console.warn('strip', e) }
  await shrinkPictures(doc, cfg, P, stats);
  P && P(null, 'Saving…');
  const b = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
  P && P(null, 'Packing the file tightly…');
  const o = await qpdfOptimize(b);
  return { bytes: o && o.length < b.length ? o : b, stats };
}

/* ---------- PDF: every page as a picture, with invisible searchable text ---------- */
async function asPictures(bytes, dpi, q, P) {
  need('pdfjs', 'pdflib');
  const pdf = await pdfjsDoc(bytes, { noPrompt: true, name: 'document.pdf' });
  const out = await L().PDFDocument.create();
  const font = await out.embedFont(L().StandardFonts.Helvetica);
  const { pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setTextRenderingMode, TextRenderingMode, setCharacterSqueeze, setTextMatrix, showText } = L();
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      P && P((p - 1) / pdf.numPages, `Page ${p} of ${pdf.numPages}`);
      const r = await renderPage(pdf, p, dpi / 72);
      if (looksGrey(r.cv)) makeGrey(r.cv);
      const jpg = await blobU8(await toBlob(r.cv, 'image/jpeg', q)); r.cv.width = r.cv.height = 1;
      const im = await out.embedJpg(jpg), pg = out.addPage([r.w, r.h]);
      pg.drawImage(im, { x: 0, y: 0, width: r.w, height: r.h });
      // invisible text in the same places, so the page can still be searched and copied
      try {
        const page = await pdf.getPage(p), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
        const fk = pg.node.newFontDictionary(font.name, font.ref), ops = [pushGraphicsState(), beginText(), setTextRenderingMode(TextRenderingMode.Invisible)];
        let n = 0;
        for (const it of tc.items) {
          const str = (it.str || '').replace(/[^\x20-\x7e -ÿ]/g, ''); if (!str.trim() || str.length < (it.str || '').trim().length * .6) continue;
          const m = pdfjsLib.Util.transform(vp.transform, it.transform);
          if (Math.abs(m[1]) > .01 || Math.abs(m[2]) > .01 || m[0] <= 0) continue;
          const fh = Math.abs(m[3]); if (fh < 1) continue;
          let enc; try { enc = font.encodeText(str) } catch (e) { continue }
          const nat = font.widthOfTextAtSize(str, fh), wv = it.width || nat;
          ops.push(setFontAndSize(fk, fh), setCharacterSqueeze(Math.max(10, Math.min(400, nat ? wv / nat * 100 : 100))), setTextMatrix(1, 0, 0, 1, m[4], r.h - m[5]), showText(enc));
          n++;
        }
        ops.push(endText(), popGraphicsState());
        if (n) pg.pushOperators(...ops);
        page.cleanup();
      } catch (e) { console.warn('text layer', e) }
      if (p % 2 === 0) await sleep0();
    }
  } finally { pdf.destroy() }
  const b = await out.save({ useObjectStreams: true });
  return b;
}

const pct = (a, b) => Math.round(100 - b / a * 100);
const fmt = n => fmtSize(n);

/* ---------- PDF: the tool ---------- */
// opts: { lv: '90'|'75'|'50'|'25'|'x'|'l', keepText: bool, target: bytes|0 }
async function pdf(file, opts, P) {
  const orig = await u8(file), size = orig.length, lv = opts.lv in PDF_LV || opts.lv === 'x' || opts.lv === 'l' ? opts.lv : '75';
  let best = null, how = '';
  const consider = (bytes, label) => { if (bytes && bytes.length && (!best || bytes.length < best.length)) { best = bytes; how = label } };
  const fits = b => opts.target ? b && b.length <= opts.target : false;

  if (lv === 'l') {
    P && P(null, 'Removing unused data…');
    let b = orig; if (looksEncrypted(orig)) b = await (await ldoc(file)).save({ useObjectStreams: true });
    consider(await qpdfOptimize(b) || b, 'lossless');
  } else if (lv === 'x') {
    consider(await asPictures(orig, 100, .5, P), 'pictures');
  } else if (!opts.target) {
    const cfg = PDF_LV[lv];
    let s = null;
    try { s = await structural(orig, lv, P); consider(s.bytes, 'keep') }
    catch (e) { if (e instanceof UserError && !cfg.raster) throw e; console.warn('structural failed', e) }
    const gain = best ? 1 - best.length / size : 0;
    if (cfg.raster && !opts.keepText && gain < cfg.want) {
      try { consider(await asPictures(orig, cfg.raster.dpi, cfg.raster.q, P), 'pictures') } catch (e) { console.warn('pictures failed', e) }
    }
  } else {
    // aim for a size: stronger steps until it fits
    let lastR = null;
    for (const st of LADDER) {
      if (st.k === 'r' && opts.keepText) break;
      // far too big still: skip the gentler steps (a picture's size grows with the square of its resolution)
      if (st.k === 's' && st.lv !== '75' && best && best.length > opts.target * 2.5 && !opts.keepText) continue;
      if (st.k === 'r' && lastR && lastR.dpi * Math.sqrt(opts.target / lastR.size) * 1.05 < st.dpi && st.dpi > 40) continue;
      try {
        if (st.k === 's') consider((await structural(orig, st.lv, P)).bytes, 'keep');
        else { const b = await asPictures(orig, st.dpi, st.q, P); lastR = { dpi: st.dpi, size: b.length }; consider(b, 'pictures') }
      } catch (e) { console.warn('step failed', st, e); if (st.k === 's' && st.lv === '75' && e instanceof UserError && opts.keepText) throw e }
      if (fits(best)) break;
    }
  }
  if (!best || best.length >= size) {
    return { name: file.name, data: orig, same: true,
      note: lv === 'l' ? 'This PDF is already stored as compactly as possible without changing how it looks, so your original is kept.'
        : opts.keepText ? 'This PDF is already as small as it can be while keeping text selectable. Choose “Allow pages to become pictures” to make it smaller.'
        : 'This PDF is already as small as it can get, so your original is kept.' };
  }
  let note = `${pct(size, best.length)}% smaller: ${fmt(size)} → ${fmt(best.length)}.`;
  if (how === 'pictures' && lv !== 'x') note += ' To get this small, pages were saved as pictures; the text can still be searched.';
  if (!opts.target && (lv === '90' || lv === '75') && best.length > size * .85) note += ' For a much smaller file choose 50% or a size limit.';
  if (opts.target && best.length > opts.target) note += ` It couldn’t go under ${fmt(opts.target)} without becoming unreadable; this is the smallest readable version.`;
  return { name: base(file) + '-compressed.pdf', data: best, note };
}

/* ---------- pictures ---------- */
const IMG_TYPES_OK = /^image\/(jpeg|png|webp|gif|bmp|avif)$/;
async function image(file, opts, P) {
  const cfg = IMG_LV[opts.lv] || IMG_LV['75'], size = file.size;
  let bm; try { bm = await createImageBitmap(file) } catch (e) { throw new UserError(`“${file.name || 'This picture'}” is not a picture this browser can open. Use JPG, PNG or WebP.`) }
  const W = bm.width, H = bm.height;
  const goal = opts.target || Math.floor(size * (1 - cfg.want));
  let px = Math.min(Math.max(W, H), cfg.px), q = cfg.q, out = null, grey = null, tries = 0;
  for (;;) {
    const k = px / Math.max(W, H), cv = scaled(bm, Math.round(W * k), Math.round(H * k));
    if (grey === null) grey = cfg.gray && looksGrey(cv);
    if (grey || opts.target && tries > 2 && looksGrey(cv)) makeGrey(cv);
    const b = await blobU8(await toBlob(cv, 'image/jpeg', q)); cv.width = cv.height = 1;
    if (!out || b.length < out.length) out = b;
    tries++;
    P && P(null, `Trying ${Math.round(px)} px at quality ${Math.round(q * 100)}…`);
    if (out.length <= goal || tries > 14) break;
    // quality first (down to 0.3), then size
    if (q > .32) q = Math.max(.3, q - .1); else { px = Math.max(320, Math.round(px * .82)); if (px === 320 && q <= .2) break; if (px <= 480) q = Math.max(.18, q - .04) }
    if (!opts.target && cfg.want === 0) break;
  }
  bm.close && bm.close();
  if (out.length >= size) return { name: file.name, data: await u8(file), same: true, note: 'This picture is already as small as this level allows, so the original is kept. Try a stronger level or a target size.' };
  let note = `${pct(size, out.length)}% smaller: ${fmt(size)} → ${fmt(out.length)}.`;
  if (opts.target && out.length > opts.target) note += ` It couldn’t go under ${fmt(opts.target)} without becoming unreadable.`;
  return { name: base(file) + '-compressed.jpg', data: out, note };
}

return { pdf, image, PDF_LV, IMG_LV };
})();
