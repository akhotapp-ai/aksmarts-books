/* =====================================================================
   AK Smarts PDF: easier text editing in the Reader & Editor.
   - Text you added can be changed any time: double-click it, click it again once it is selected,
     press Enter, or use the small "Edit text" button above it.
   - Edit text picks up whole words and phrases (not single letters) on any PDF.
   - Scanned pages (pictures of text) and PDFs whose text is stored in a hidden code can be made
     editable with OCR: the words are read from the page picture.
   - Hindi (Devanagari) and Kannada text can be written into the PDF.
   Uses the main app's functions; wire() runs once the app is unlocked.
   ===================================================================== */
window.PTTextEdit = (() => {
'use strict';
const editing = () => !!document.querySelector('textarea.inedit');

// joins the pieces of one line of text (often single letters) into words and phrases
function mergeRuns(items) {
  const list = items.filter(it => it && it.str != null).slice().sort((a, b) => a.base - b.base || a.x - b.x);
  const lines = [];
  for (const it of list) {
    const l = lines.find(L => Math.abs(L.base - it.base) < Math.max(1, Math.min(L.fh, it.fh) * .28) && Math.abs(L.fh - it.fh) < Math.max(L.fh, it.fh) * .2);
    if (l) l.items.push(it); else lines.push({ base: it.base, fh: it.fh, items: [it] });
  }
  const out = [];
  for (const L of lines) {
    L.items.sort((a, b) => a.x - b.x);
    let run = null;
    for (const it of L.items) {
      const gap = run ? it.x - (run.x + run.w) : 0;
      if (run && it.font === run.font && gap > -run.fh * .3 && gap < run.fh * .45) {
        const sep = gap > run.fh * .12 && !/\s$/.test(run.str) && !/^\s/.test(it.str) ? ' ' : '';
        run.str += sep + it.str; run.w = Math.max(run.w, it.x + it.w - run.x);
        run.top = Math.min(run.top, it.top); run.h = Math.max(run.h, it.top + it.h - run.top); run.fh = Math.max(run.fh, it.fh); run.parts.push(it.idx);
      } else {
        if (run) out.push(run);
        run = { ...it, parts: [it.idx] };
      }
    }
    if (run) out.push(run);
  }
  return out.filter(r => r.str.trim());
}

// is this page's text missing (a scan) or stored in a hidden code (letters can't be read)?
function textState(tc) {
  const s = (tc && tc.items || []).map(i => i.str || '').join('');
  const t = s.replace(/\s+/g, '');
  if (t.length < 4) return 'none';
  const bad = (t.match(/[-�\u0000-\u001F]/g) || []).length;
  return bad / t.length > .25 ? 'coded' : 'ok';
}

async function ocrPage(k) {
  const p = D.pages[k], src = D.sources[p.s];
  if (!src || !src.pdf) { toast('This page has no text to read.', true); return }
  const b = busy('Reading the words on this page…');
  try {
    const r = await renderPage(src.pdf, p.i + 1, OCR_SCALE);
    const blob = await toBlob(r.cv, 'image/png'); r.cv.width = r.cv.height = 1;
    const res = await ocrLines(blob, 1 / OCR_SCALE, f => b.set(`Reading the words on this page… ${Math.round(f * 100)}%`));
    const words = res.words.map((w, i) => {
      const base = w.lineBot != null && w.lineBot > w.top && w.lineBot <= w.bot + w.h * .3 ? w.lineBot : w.bot;
      const fh = Math.max(4, (base - w.top) / .72);
      return { idx: 900000 + i, str: w.s, x: w.x, base, fh, w: w.w, top: base - fh * .95, h: fh * 1.2, font: 'ocr', style: null };
    });
    const items = mergeRuns(words);
    Object.defineProperty(p, '_ocr', { value: { items }, configurable: true, writable: true, enumerable: false });
    drawOv(k);
    toast(items.length ? `Found ${items.length} lines of text. Click any of them to change it.` : 'No readable text was found on this page.', !items.length);
  } catch (e) { console.error(e); toast(errText(e), true) }
  finally { b.done() }
}

// small bar above the selected item: Edit text / Delete
function keptLook(k) {
  const el = D.els[k], p = D.pages[k]; if (!el || !p) return;
  for (const o of p.objs) {
    if (!o.kept) continue;
    const g = el.querySelector(`g[data-oid="${o.id}"]`); if (!g) continue;
    g.classList.add('kept');
  }
}
function selBar(k) {
  const el = D.els[k]; if (!el) return;
  el.querySelectorAll('.selbar').forEach(x => x.remove());
  const o = WS.sel && WS.sel.k === k ? selObj() : null;
  if (!o || editing() || WS.rtab === 'pages') return;
  const p = D.pages[k], s = D.scale * PX, [x, y, w, h] = bbox(o);
  let X = x * s, Y = y * s;
  if (p.rot === 90) { X = (p.bh - y - h) * s; Y = x * s } else if (p.rot === 180) { X = (p.bw - x - w) * s; Y = (p.bh - y - h) * s } else if (p.rot === 270) { X = y * s; Y = (p.bw - x - w) * s }
  const bar = document.createElement('div'); bar.className = 'selbar';
  bar.innerHTML = (o.t === 'text' ? '<button type="button" data-sb="edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>Edit text</button>' : '') +
    '<button type="button" data-sb="del" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>Delete</button>';
  bar.style.left = Math.max(0, Math.min(el.clientWidth - 190, X)) + 'px';
  bar.style.top = (Y > 40 ? Y - 38 : Y + (p.rot % 180 ? w : h) * s + 8) + 'px';
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-sb]'); if (!b) return;
    e.stopPropagation();
    const cur = selObj(); if (!cur) return;
    if (b.dataset.sb === 'edit') editText(WS.sel.k, cur); else delSel();
  });
  el.appendChild(bar);
}

function wire() {
  wireKeep();
  const pages = $('pages');
  // 1. double-click a text box to type in it
  pages.addEventListener('dblclick', e => {
    if (!D || e.target.closest('.inedit,.notepop,.selbar')) return;
    const og = e.target.closest('[data-oid]'), pg = e.target.closest('.pg'); if (!og || !pg) return;
    const k = +pg.dataset.k, o = D.pages[k] && D.pages[k].objs.find(x => x.id === og.dataset.oid);
    if (o && o.t === 'text' && !editing()) { e.preventDefault(); if (!(WS.sel && WS.sel.id === o.id)) selectObj(k, o.id); editText(k, o) }
  });
  // 2. click once more on a text box that is already selected (like other editors)
  let pd = null;
  pages.addEventListener('pointerdown', e => {
    pd = null;
    if (!D || e.button > 0 || e.target.closest('.inedit,.notepop,.selbar')) return;
    const og = e.target.closest('[data-oid]'), hd = e.target.closest('.hdl'), pg = e.target.closest('.pg'); if (!(og || hd) || !pg) return;
    const k = +pg.dataset.k, id = og ? og.dataset.oid : WS.sel && WS.sel.id;
    if (WS.sel && WS.sel.k === k && WS.sel.id === id) pd = { k, id, x: e.clientX, y: e.clientY, t: Date.now() };
  }, true);
  window.addEventListener('pointerup', e => {
    const d = pd; pd = null; if (!d || !D) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || Date.now() - d.t > 700) return;
    setTimeout(() => {
      const o = D && D.pages[d.k] && D.pages[d.k].objs.find(x => x.id === d.id);
      if (o && o.t === 'text' && !editing()) editText(d.k, o);
    }, 0);
  });
  // 3. Enter or F2 edits the selected text box
  document.addEventListener('keydown', e => {
    if ($('ws').hidden || !D || document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (e.key !== 'Enter' && e.key !== 'F2') return;
    const o = selObj(); if (o && o.t === 'text') { e.preventDefault(); editText(WS.sel.k, o) }
  });
  // 4. the small Edit / Delete bar, drawn with the page's objects
  const _drawOv = drawOv;
  drawOv = function (k) { const r = _drawOv.apply(this, arguments); try { if (D && D.els) { selBar(k); keptLook(k) } } catch (e) { console.warn(e) } return r };
  // saved text (opened again): not a box to pick in the normal view, but editable with Edit text
  pages.addEventListener('pointerdown', e => {
    if (!D || WS.tool !== 'edittext' || editing()) return;
    const g = e.target.closest('g.kept'), pg = e.target.closest('.pg'); if (!g || !pg) return;
    const k = +pg.dataset.k, o = D.pages[k] && D.pages[k].objs.find(x => x.id === g.dataset.oid); if (!o) return;
    e.preventDefault(); e.stopPropagation();
    setTimeout(() => { selectObj(k, o.id); editText(k, o) }, 0);
  }, true);
  const _editText = editText;
  editText = function (k) { const r = _editText.apply(this, arguments); try { D.els[k] && D.els[k].querySelectorAll('.selbar').forEach(x => x.remove()) } catch (e) {} return r };
  // 5. Edit text: whole words and phrases, or the words read by OCR
  const _editItems = editItems;
  editItems = function (p, tc) {
    if (p._ocr) return p._ocr.items;
    if (p._runs && p._runs.tc === tc) return p._runs.items;
    const items = mergeRuns(_editItems(p, tc));
    Object.defineProperty(p, '_runs', { value: { tc, items }, configurable: true, writable: true, enumerable: false });
    return items;
  };
  // 6. scanned pages: offer OCR in Edit text mode
  const _hitBoxes = hitBoxes;
  hitBoxes = function (k, s) {
    let h = _hitBoxes.apply(this, arguments);
    const p = D.pages[k], tc = D.tc[p.s + ':' + p.i];
    if (!tc || p._ocr) return h;
    const st = textState(tc);
    const msg = st === 'none' ? 'This page is a scanned picture, so its words can’t be clicked yet.' : st === 'coded' ? 'This page’s text is stored in a hidden code and can’t be read directly.' : '';
    h += `<div class="ocrchip${msg ? ' big' : ''}">${msg ? `<span>${esc(msg)}</span>` : ''}<button type="button" data-ocr="${k}">${msg ? 'Make the text editable (OCR)' : 'Text looks wrong? Read it with OCR'}</button></div>`;
    return h;
  };
  pages.addEventListener('pointerdown', e => { if (e.target.closest('.ocrchip')) e.stopPropagation() }, true);
  pages.addEventListener('click', e => { const b = e.target.closest('[data-ocr]'); if (b) { e.stopPropagation(); ocrPage(+b.dataset.ocr) } });
  // 7. Hindi and Kannada text can be written into the PDF
  const _fontFor = fontFor;
  fontFor = async function (doc, texts) {
    try { return await _fontFor.apply(this, arguments) }
    catch (e) {
      const all = texts.join('');
      const id = /[ಀ-೿]/.test(all) ? 'bin-knda' : /[ऀ-ॿ]/.test(all) ? 'bin-deva' : null;
      if (!id || !$(id) || !(e instanceof UserError)) throw e;
      need('regen', 'fontkit'); doc.registerFontkit(fontkit);
      doc._fc = doc._fc || {};
      const f = doc._fc[id] || (doc._fc[id] = await doc.embedFont(bin(id), { subset: true }));
      const set = new Set(f.getCharacterSet());
      if ([...new Set(all)].some(c => c.trim() && !/[​-‍]/.test(c) && !set.has(c.codePointAt(0)))) throw e;
      return f;
    }
  };
}

/* ---------- added text stays editable after saving and opening the PDF again ----------
   When a PDF is saved, everything added in the editor is still drawn into the page as normal PDF content
   (so every PDF reader shows it), inside a marked block. A copy of the editable items is kept on the page.
   When the PDF is opened here again, that block is taken out and the items come back as editable boxes. */
const KEY = 'AKSEdits', MARK = '/AKSEdit BMC';
let KEEP = null, BUILD = null;
function wireKeep() {
  const PN = n => PDFLib.PDFName.of(n);
  const _buildDoc = buildDoc;
  buildDoc = async function (doc, opt = {}) {
    const outer = !BUILD;
    if (outer) BUILD = { doc, clean: new Set() };
    try { return await keepBuild.apply(this, arguments) } finally { if (outer) BUILD = null }
  };
  // changed words: the old letters are taken out of the page (see textremove.js), so no cover is needed
  const _srcLib = srcLib;
  srcLib = async function (src) {
    const lib = await _srcLib.apply(this, arguments);
    const B = BUILD; if (!B || !window.PTTextRemove) return lib;
    try {
      const si = B.doc.sources.indexOf(src); if (si < 0) return lib;
      const byPage = new Map();
      B.doc.pages.forEach(p => { if (p.s === si) byPage.set(p.i, byPage.has(p.i) ? null : p) });
      const pages = lib.getPages();
      for (const [i, p] of byPage) {
        if (!p || !pages[i] || p.objs.some(o => o.t === 'redact')) continue;
        const ed = p.objs.filter(o => o.t === 'text' && o.cover && !o.comment && !o.textGone);
        if (!ed.length) continue;
        const hit = PTTextRemove.cleanPage(lib, pages[i], ed.map(o => o.cover), p.vt);
        if (hit) hit.forEach(r => { B.clean.add(ed[r].id); const f = hit.info[r]; if (f && f.map && f.name) ed[r].pf = { name: f.name, size: f.size, Tz: f.Tz, Tc: f.Tc, bytes: f.bytes, map: f.map } });
      }
    } catch (e) { console.warn('remove old words', e) }
    return lib;
  };
  const _objOps = objOps;
  objOps = function (ops, o, R) {
    if (o && o.t === 'text' && o.cover && (o.textGone || (BUILD && BUILD.clean.has(o.id)))) {
      o = { ...o, cover: null, bgImg: null };
      // write the new words in the page's own font when it has every letter needed
      const pf = o.pf, txt = String(o.text || '');
      if (pf && pf.map && txt && !txt.includes('\n') && !o.bold && !o.italic && [...txt].every(ch => ch in pf.map)) {
        const k = Math.abs(o.size - pf.size) / pf.size < .12 ? 1 : o.size / pf.size, sz = pf.size * k;
        const codes = [...txt].map(ch => pf.map[ch].toString(16).padStart(pf.bytes * 2, '0')).join('');
        const c = (typeof rgbs === 'function' ? rgbs(o.color || '#000') : '0 0 0');
        return `${c} rg BT /${pf.name} ${N(sz)} Tf ${N(pf.Tz || 100)} Tz ${N((pf.Tc || 0) * k)} Tc 1 0 0 -1 ${N(o.x)} ${N(o.y + o.size * .9)} Tm <${codes}> Tj ET 0 Tc 100 Tz`;
      }
    }
    return _objOps.call(this, ops, o, R);
  };
  const _objSvg = objSvg;
  objSvg = function (o) { if (o && o.t === 'text' && o.cover && o.textGone) o = { ...o, cover: null, bgImg: null }; return _objSvg.apply(this, [o].concat([].slice.call(arguments, 1))) };
  const keepBuild = async function (doc, opt = {}) {
    if (opt.flatten || KEEP) return _buildDoc.apply(this, arguments);
    const K = KEEP = { doc, n: 0 };
    const o2 = { ...opt, meta: out => { if (opt.meta) opt.meta(out); try { if (K.n) out.getInfoDict().set(PN(KEY), PDFLib.PDFBool.True) } catch (e) { console.warn(e) } } };
    try { return await _buildDoc.call(this, doc, o2) } finally { KEEP = null }
  };
  void keepBuild;
  const _appendOps = appendOps;
  appendOps = function (out, page, ops, M) {
    const K = KEEP;
    if (!K) return _appendOps.apply(this, arguments);
    try {
      const k = out.getPages().findIndex(x => x.node === page.node), p = K.doc.pages[k];
      const keep = p && !p.objs.some(o => o.t === 'redact') ? p.objs.filter(o => o.t !== 'redact') : [];
      if (!keep.length) return _appendOps.apply(this, arguments);
      const ctx = out.context;
      if (ops.s.length) {
        wrapPage(out, page);
        const body = MARK + '\n' + (M ? `q ${M.map(N).join(' ')} cm\n` : 'q\n') + ops.toString() + '\nQ\nEMC';
        page.node.addContentStream(ctx.register(ctx.flateStream(body)));
        ops.applyToPage(page);
      }
      const imgs = {};
      keep.forEach(o => { if (o.t === 'img' && IMGS[o.img]) imgs[o.img] = IMGS[o.img] });
      const objs = keep.map(o => BUILD && BUILD.clean.has(o.id) ? { ...o, textGone: true } : o);
      page.node.set(PN(KEY), ctx.register(ctx.flateStream(new TextEncoder().encode(JSON.stringify({ v: 1, vt: p.vt, objs, imgs })))));
      K.n++;
    } catch (e) { console.warn('keep edits', e); return _appendOps.apply(this, arguments) }
  };
  const _addSource = addSource;
  addSource = async function (doc, bytes, name) {
    const r = await _addSource.apply(this, arguments);
    try {
      if (r.src.pw) return r;
      const meta = await r.src.pdf.getMetadata().catch(() => null);
      if (!(meta && meta.info && meta.info.Custom && meta.info.Custom[KEY])) return r;
      need('pdflib');
      const lib = await PDFLib.PDFDocument.load(r.src.bytes, { updateMetadata: false });
      const ctx = lib.context, back = {};
      const pages = lib.getPages();
      for (let k = 0; k < pages.length; k++) {
        const node = pages[k].node, ref = node.get(PN(KEY));
        if (!ref) continue;
        let data;
        try { data = JSON.parse(new TextDecoder().decode(PDFLib.decodePDFRawStream(ctx.lookup(ref)).decode())) } catch (e) { continue }
        const inf = await pageInfo(r.src.pdf, k);
        const same = data && data.vt && data.vt.every((v, i) => Math.abs(v - inf.vt[i]) < .01);
        node.delete(PN(KEY));
        if (!same || !Array.isArray(data.objs)) continue;
        // take out the drawn block and the comments that will come back as editable items
        const C = node.get(PN('Contents')), arr = ctx.lookup(C);
        if (arr instanceof PDFLib.PDFArray) {
          for (let i = arr.size() - 1; i >= 0; i--) {
            const st = ctx.lookup(arr.get(i));
            try { const txt = new TextDecoder('latin1').decode(PDFLib.decodePDFRawStream(st).decode().subarray(0, 20)); if (txt.startsWith(MARK)) arr.remove(i) } catch (e) {}
          }
        }
        const ids = new Set(data.objs.map(o => o.id));
        const an = node.lookup(PN('Annots'));
        if (an instanceof PDFLib.PDFArray) {
          for (let i = an.size() - 1; i >= 0; i--) {
            const a = ctx.lookup(an.get(i)), nm = a && a.get && a.get(PN('NM'));
            if (nm && ids.has(nm.decodeText ? nm.decodeText() : String(nm))) an.remove(i);
          }
        }
        back[k] = { data, inf };
      }
      lib.getInfoDict().delete(PN(KEY));
      if (!Object.keys(back).length) return r;
      const clean = await lib.save({ useObjectStreams: true, updateFieldAppearances: false });
      try { r.src.pdf.destroy() } catch (e) {}
      doc.sources.pop();
      const r2 = await _addSource.call(this, doc, clean, name);
      for (const [k, { data, inf }] of Object.entries(back)) {
        const d = r2.descs[k]; if (!d) continue;
        Object.assign(d, inf, { pending: false });
        for (const [id, im] of Object.entries(data.imgs || {})) if (!IMGS[id] && im && /^data:image\//.test(im.url || '')) IMGS[id] = im;
        // text added earlier now behaves like the page's own text: it's changed with Edit text
        d.objs = data.objs.filter(o => o && typeof o === 'object' && typeof o.t === 'string').map(o => o.t === 'text' && !o.comment ? { ...o, kept: true } : o);
      }
      return r2;
    } catch (e) { console.warn('restore edits', e); return r }
  };
}
return { wire, mergeRuns, ocrPage };
})();
