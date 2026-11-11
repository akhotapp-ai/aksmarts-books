/* =====================================================================
   AK Smarts PDF: when existing words are changed with "Edit text", the old letters are taken out of
   the page when the PDF is saved (instead of only being covered), so the old words can't be copied,
   searched or found under the new ones, and no cover patch is needed.
   Works on text written directly on the page with normal fonts. Anything it can't handle safely
   (text inside forms, unusual fonts) keeps the cover, as before.
   ===================================================================== */
window.PTTextRemove = (() => {
'use strict';
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const WS_ = c => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
const DELIM = c => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;

// splits a content stream into tokens: { t: 'num'|'name'|'str'|'arr['|']'|'dict'|'op', v, s, e }
function tokenize(b) {
  const out = []; let i = 0; const n = b.length;
  while (i < n) {
    const c = b[i];
    if (WS_(c)) { i++; continue }
    const s = i;
    if (c === 37) { while (i < n && b[i] !== 10 && b[i] !== 13) i++; continue }   // comment
    if (c === 40) {                                                                 // (literal string)
      const bytes = []; let depth = 1; i++;
      while (i < n && depth) {
        let ch = b[i++];
        if (ch === 92) {
          const e = b[i++];
          if (e === 110) bytes.push(10); else if (e === 114) bytes.push(13); else if (e === 116) bytes.push(9); else if (e === 98) bytes.push(8); else if (e === 102) bytes.push(12);
          else if (e >= 48 && e <= 55) { let v = e - 48; for (let k = 0; k < 2 && b[i] >= 48 && b[i] <= 55; k++) v = v * 8 + b[i++] - 48; bytes.push(v & 255) }
          else if (e === 13) { if (b[i] === 10) i++ } else if (e === 10) { } else bytes.push(e);
          continue;
        }
        if (ch === 40) depth++; else if (ch === 41 && !--depth) break;
        bytes.push(ch);
      }
      out.push({ t: 'str', v: bytes, s, e: i }); continue;
    }
    if (c === 60 && b[i + 1] === 60) { out.push({ t: 'dict', s, e: i += 2 }); continue }
    if (c === 62 && b[i + 1] === 62) { out.push({ t: 'dictend', s, e: i += 2 }); continue }
    if (c === 60) {                                                                 // <hex string>
      i++; let h = '';
      while (i < n && b[i] !== 62) { const ch = b[i++]; if (!WS_(ch)) h += String.fromCharCode(ch) }
      i++; if (h.length % 2) h += '0';
      const bytes = []; for (let k = 0; k < h.length; k += 2) bytes.push(parseInt(h.substr(k, 2), 16) || 0);
      out.push({ t: 'str', v: bytes, s, e: i }); continue;
    }
    if (c === 91) { out.push({ t: '[', s, e: ++i }); continue }
    if (c === 93) { out.push({ t: ']', s, e: ++i }); continue }
    if (c === 47) { i++; while (i < n && !WS_(b[i]) && !DELIM(b[i])) i++; out.push({ t: 'name', v: String.fromCharCode(...b.subarray(s + 1, i)), s, e: i }); continue }
    if (c === 123 || c === 125) { i++; continue }
    while (i < n && !WS_(b[i]) && !DELIM(b[i])) i++;
    if (i === s) { i++; continue }
    const w = String.fromCharCode(...b.subarray(s, i));
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) { out.push({ t: 'num', v: parseFloat(w), s, e: i }); continue }
    if (w === 'BI') {                                                               // inline image: skip to EI
      let j = i;
      while (j < n) { if (b[j] === 73 && b[j + 1] === 68 && WS_(b[j + 2]) && WS_(b[j - 1])) break; j++ }
      j += 3;
      while (j < n && !(b[j] === 69 && b[j + 1] === 73 && WS_(b[j - 1]) && (j + 2 >= n || WS_(b[j + 2]) || DELIM(b[j + 2])))) j++;
      i = Math.min(n, j + 2); out.push({ t: 'op', v: 'BI', s, e: i }); continue;
    }
    out.push({ t: 'op', v: w, s, e: i });
  }
  return out;
}

// glyph widths of a font (per code); null when the font isn't one we can measure safely
function fontInfo(ctx, fontDict) {
  const P = PDFLib.PDFName, get = (d, k) => d && ctx.lookup(d.get(P.of(k)));
  const num = v => v && v.asNumber ? v.asNumber() : v && v.numberValue != null ? v.numberValue : null;
  const sub = get(fontDict, 'Subtype'); const st = sub ? sub.toString() : '';
  if (st === '/Type0') {
    const enc = get(fontDict, 'Encoding'); if (!enc || enc.toString() !== '/Identity-H') return null;
    const dsc = get(fontDict, 'DescendantFonts'), cid = dsc && ctx.lookup(dsc.get(0)); if (!cid) return null;
    const dw = num(get(cid, 'DW')) ?? 1000, W = get(cid, 'W'), map = new Map();
    if (W) {
      const a = W.asArray().map(x => ctx.lookup(x));
      for (let i = 0; i < a.length;) {
        const f = num(a[i]), nx = a[i + 1];
        if (nx && nx.asArray) { nx.asArray().forEach((w, k) => map.set(f + k, num(ctx.lookup(w)))); i += 2 }
        else { const l = num(nx), w = num(a[i + 2]); for (let c = f; c <= l && c - f < 65536; c++) map.set(c, w); i += 3 }
      }
    }
    return { bytes: 2, w: c => map.has(c) ? map.get(c) : dw };
  }
  if (st === '/Type3') return null;
  const widths = get(fontDict, 'Widths');
  if (!widths) {
    // the 14 standard fonts (Helvetica, Times, Courier…) have known widths
    const base = String(get(fontDict, 'BaseFont') || '').replace(/^\//, '').replace(/^[A-Z]{6}\+/, '');
    const alias = { Arial: 'Helvetica', 'Arial,Bold': 'Helvetica-Bold', 'Arial-BoldMT': 'Helvetica-Bold', ArialMT: 'Helvetica', TimesNewRoman: 'Times-Roman', 'TimesNewRomanPSMT': 'Times-Roman', CourierNew: 'Courier' }[base] || base;
    const enc = get(fontDict, 'Encoding'), es = enc ? enc.toString() : '';
    if (!Object.values(PDFLib.StandardFonts).includes(alias) || alias === 'Symbol' || alias === 'ZapfDingbats' || (es && es !== '/WinAnsiEncoding' && es !== '/StandardEncoding')) return null;
    const em = PDFLib.StandardFontEmbedder.for(alias), cache = {};
    return { bytes: 1, w: c => c in cache ? cache[c] : (cache[c] = (() => { try { return em.widthOfTextAtSize(String.fromCharCode(c), 1000) } catch (e) { return 500 } })()) };
  }
  const first = num(get(fontDict, 'FirstChar')) ?? 0, arr = widths.asArray().map(x => num(ctx.lookup(x)));
  const fd = get(fontDict, 'FontDescriptor'), miss = num(fd && get(fd, 'MissingWidth')) ?? 0;
  return { bytes: 1, w: c => (c >= first && c - first < arr.length ? arr[c - first] : miss) ?? miss };
}

const hex = (codes, bytes) => '<' + codes.map(c => c.toString(16).padStart(bytes * 2, '0')).join('') + '>';
const fmt = v => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r) };

/* Takes the letters under the given rectangles out of one page.
   rects: [x, y, w, h] in the page's view coordinates; vt: user space → view coordinates.
   Returns the set of rectangle indexes whose letters were removed, or null when the page was left alone. */
function cleanPage(doc, page, rects, vt) {
  const ctx = doc.context, P = PDFLib.PDFName;
  page.node.normalize && page.node.normalize();
  const res = page.node.Resources(), fonts = res && ctx.lookup(res.get(P.of('Font')));
  const C = page.node.get(P.of('Contents')); if (!C) return null;
  const cArr = ctx.lookup(C);
  const refs = cArr instanceof PDFLib.PDFArray ? cArr.asArray() : [C];
  const parts = [];
  for (const r of refs) { const s = ctx.lookup(r); if (!s) continue; parts.push(s instanceof PDFLib.PDFRawStream ? PDFLib.decodePDFRawStream(s).decode() : s.getUnencodedContents ? s.getUnencodedContents() : s.getContents()) }
  let total = 0; parts.forEach(p => total += p.length + 1);
  const b = new Uint8Array(total); let off = 0; parts.forEach(p => { b.set(p, off); off += p.length; b[off++] = 10 });
  const T = tokenize(b);
  const fcache = {};
  const font = name => {
    if (name in fcache) return fcache[name];
    const fd = fonts && ctx.lookup(fonts.get(P.of(name)));
    return fcache[name] = fd ? fontInfo(ctx, fd) : null;
  };
  // where a glyph's middle lands (view coordinates) → index of the rectangle it is in, or -1
  const inRect = (x, y) => { for (let i = 0; i < rects.length; i++) { const r = rects[i]; if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return i } return -1 };
  let gs = { ctm: [1, 0, 0, 1, 0, 0], Tc: 0, Tw: 0, Th: 1, TL: 0, Tf: null, Tfs: 0, Ts: 0 };
  const stack = []; let Tm = [1, 0, 0, 1, 0, 0], Tlm = Tm, inText = false;
  const edits = [], hit = new Set(), info = {};
  hit.info = info;
  let ops = [];
  const nums = k => ops.slice(-k).map(o => o.v);
  // runs one show-text operation; returns replacement text for it when some letters must go
  function show(items, startTok, endTok, prefix) {
    const f = gs.Tf && font(gs.Tf);
    const touched = [];
    let unsafe = !f || !gs.Tfs || !gs.Th;
    const out = []; let changed = false, kern = 0, run = [];
    const flush = () => { if (run.length) { out.push(hex(run, f.bytes)); run = [] } };
    const pushKern = v => { if (v) { flush(); out.push(fmt(v)) } };
    for (const it of items) {
      if (typeof it === 'number') {
        if (!unsafe) { Tm = mul([1, 0, 0, 1, -it / 1000 * gs.Tfs * gs.Th, 0], Tm); kern += it }
        continue;
      }
      if (unsafe) { // can't measure: only check whether this text is under an edit at all
        const [x, y] = ap(vt, ...ap(mul(Tm, gs.ctm), 0, gs.Ts));
        if (inRect(x, y) >= 0) return { unsafe: true };
        continue;
      }
      const codes = [];
      for (let i = 0; i < it.length; i += f.bytes) codes.push(f.bytes === 2 ? (it[i] << 8) | (it[i + 1] || 0) : it[i]);
      for (const code of codes) {
        const w0 = f.w(code) / 1000;
        const tx = (w0 * gs.Tfs + gs.Tc + (f.bytes === 1 && code === 32 ? gs.Tw : 0)) * gs.Th;
        const m = mul(Tm, gs.ctm);
        const [ux, uy] = ap(m, w0 * gs.Tfs * gs.Th / 2, gs.Ts + gs.Tfs * .32);
        const [x, y] = ap(vt, ux, uy);
        const r = code === 32 ? -1 : inRect(x, y);
        if (kern) { pushKern(kern); kern = 0 }
        if (r >= 0) {
          pushKern(-tx * 1000 / (gs.Tfs * gs.Th)); changed = true; hit.add(r); touched.push(r);
          if (!info[r]) { const mv = mul(m, vt), sc = Math.sqrt(Math.abs(mv[0] * mv[3] - mv[1] * mv[2])) || 1; info[r] = { name: gs.Tf, size: gs.Tfs * sc, Tz: gs.Th * 100, Tc: gs.Tc * sc, bytes: f.bytes } }
        }
        else run.push(code);
        Tm = mul([1, 0, 0, 1, tx, 0], Tm);
      }
    }
    if (kern) pushKern(kern);
    flush();
    if (unsafe || !changed) return null;
    edits.push({ s: startTok.s, e: endTok.e, text: (prefix || '') + '[' + out.join(' ') + '] TJ' });
    return touched;
  }
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t.t !== 'op') { ops.push(t); if (t.t === '[') { const arr = []; let j = i + 1; for (; j < T.length && T[j].t !== ']'; j++) arr.push(T[j]); ops.push({ t: 'arr', v: arr, s: t.s, e: (T[j] || t).e }); i = j } continue }
    const op = t.v;
    switch (op) {
      case 'q': stack.push({ ...gs }); break;
      case 'Q': if (stack.length) gs = stack.pop(); break;
      case 'cm': { const a = nums(6); if (a.length === 6) gs.ctm = mul(a, gs.ctm); break }
      case 'BT': inText = true; Tm = Tlm = [1, 0, 0, 1, 0, 0]; break;
      case 'ET': inText = false; break;
      case 'Tc': gs.Tc = nums(1)[0] || 0; break;
      case 'Tw': gs.Tw = nums(1)[0] || 0; break;
      case 'Tz': gs.Th = (nums(1)[0] ?? 100) / 100; break;
      case 'TL': gs.TL = nums(1)[0] || 0; break;
      case 'Ts': gs.Ts = nums(1)[0] || 0; break;
      case 'Tf': { const a = ops.slice(-2); if (a[0] && a[0].t === 'name') { gs.Tf = a[0].v; gs.Tfs = a[1] ? a[1].v : 0 } break }
      case 'Td': case 'TD': { const [tx, ty] = nums(2); if (op === 'TD') gs.TL = -ty; Tm = Tlm = mul([1, 0, 0, 1, tx, ty], Tlm); break }
      case 'Tm': { const a = nums(6); if (a.length === 6) Tm = Tlm = a; break }
      case 'T*': Tm = Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); break;
      case 'Tj': case "'": case '"': {
        let prefix = '';
        if (op !== 'Tj') { Tm = Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); prefix = 'T* ' }
        if (op === '"') { const a = ops.slice(-3); gs.Tw = a[0] ? a[0].v : gs.Tw; gs.Tc = a[1] ? a[1].v : gs.Tc; prefix = `${fmt(gs.Tw)} Tw ${fmt(gs.Tc)} Tc T* ` }
        const st = ops[ops.length - 1];
        if (!st || st.t !== 'str') break;
        const first = op === '"' ? ops[ops.length - 3] : st;
        const r = show([st.v], first || st, t, prefix);
        if (r && r.unsafe) return null;
        break;
      }
      case 'TJ': {
        const a = ops[ops.length - 1];
        if (!a || a.t !== 'arr') break;
        const r = show(a.v.map(x => x.t === 'num' ? x.v : x.t === 'str' ? x.v : null).filter(x => x != null), a, t, '');
        if (r && r.unsafe) return null;
        break;
      }
      case 'Do': { // text inside a form under an edit can't be taken out here
        break;
      }
    }
    ops = [];
  }
  if (!edits.length) return hit;
  // letters each removed font can still write (to write the new words in the page's own font)
  for (const r of Object.values(info)) { const fd = fonts && ctx.lookup(fonts.get(P.of(r.name))); r.map = fd ? charMap(ctx, fd, r.bytes) : null }
  // write the page's text back with the edited parts replaced
  const enc = new TextEncoder(), pieces = []; let last = 0;
  edits.sort((a, b) => a.s - b.s);
  for (const e of edits) { pieces.push(b.subarray(last, e.s), enc.encode(e.text)); last = e.e }
  pieces.push(b.subarray(last));
  let len = 0; pieces.forEach(p => len += p.length);
  const nb = new Uint8Array(len); let o2 = 0; pieces.forEach(p => { nb.set(p, o2); o2 += p.length });
  const ref = ctx.register(ctx.flateStream(nb));
  page.node.set(P.of('Contents'), ctx.obj([ref]));
  return hit;
}
// which code writes each letter in a font (from its ToUnicode table, or the standard encoding for simple fonts)
function charMap(ctx, fd, bytes) {
  const P = PDFLib.PDFName, m = {};
  const tu = ctx.lookup(fd.get(P.of('ToUnicode')));
  const u16 = h => { let s = ''; for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16)); return s };
  if (tu) {
    let t;
    try { t = new TextDecoder('latin1').decode(tu instanceof PDFLib.PDFRawStream ? PDFLib.decodePDFRawStream(tu).decode() : tu.getContents()) } catch (e) { return null }
    for (const blk of t.split(/beginbfchar/).slice(1)) for (const x of blk.split('endbfchar')[0].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) { const ch = u16(x[2]); if (ch.length === 1 && !(ch in m)) m[ch] = parseInt(x[1], 16) }
    for (const blk of t.split(/beginbfrange/).slice(1)) {
      const body = blk.split('endbfrange')[0];
      for (const x of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]+>|\[[^\]]*\])/g)) {
        const lo = parseInt(x[1], 16), hi = parseInt(x[2], 16);
        if (hi - lo > 4096) continue;
        if (x[3][0] === '<') { const base = u16(x[3].slice(1, -1)); if (base.length !== 1) continue; for (let c = lo; c <= hi; c++) { const ch = String.fromCharCode(base.charCodeAt(0) + c - lo); if (!(ch in m)) m[ch] = c } }
        else [...x[3].matchAll(/<([0-9a-fA-F]+)>/g)].forEach((d, k) => { const ch = u16(d[1]); if (ch.length === 1 && !(ch in m)) m[ch] = lo + k });
      }
    }
    for (const ch of Object.keys(m)) if (/[\u0000-\u001f\ud800-\udfff\ufffd]/.test(ch)) delete m[ch];
    return Object.keys(m).length ? m : null;
  }
  if (bytes !== 1) return null;
  const enc = ctx.lookup(fd.get(P.of('Encoding')));
  if (enc && !['/WinAnsiEncoding', '/StandardEncoding'].includes(enc.toString())) return null;
  const fi = fontInfo(ctx, fd);
  for (let c = 32; c < 127; c++) if (!fi || fi.w(c) > 0) m[String.fromCharCode(c)] = c;
  return m;
}
return { cleanPage, tokenize, charMap };
})();
