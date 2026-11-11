/* =====================================================================
   AK Smarts PDF: Bulk rename PDFs from an Excel or CSV list.
   Column A = the series number (or old name) found in the PDF's file name, column B = the new name.
   001.pdf, Scan_001.pdf and 1.pdf all match row 001 (numbers are compared without leading zeros).
   A preview shows old name → new name with warnings; the result is a ZIP (plus a log file),
   or the renamed copies saved straight into a folder on computers.
   Uses the main app's tool screen; add() runs once the app is unlocked.
   ===================================================================== */
window.PTRename = (() => {
'use strict';
const MAXLEN_DEF = 35;
const RN = { rows: null, sheet: null, plan: null, key: '' };
const isRename = () => typeof cur !== 'undefined' && cur === 'renamepdf';
const normKey = v => { const s = String(v == null ? '' : v).trim(); if (/^\d+(\.0+)?$/.test(s)) return String(parseInt(s, 10)); return s.toLowerCase().replace(/\.pdf$/i, '') };
const digitGroups = n => (n.replace(/\.[^.]+$/, '').match(/\d+/g) || []).map(d => String(parseInt(d, 10)));
const BAD = /[\/\\:*?"<>|\u0000-\u001f]+/g;

function cleanName(v, max) {
  let s = String(v == null ? '' : v).replace(/\.pdf\s*$/i, '');
  const had = BAD.test(s); BAD.lastIndex = 0;
  s = s.replace(BAD, ' ').replace(/\s+/g, ' ').trim().replace(/^[.\s]+|[.\s]+$/g, '');
  let cut = false;
  if (s.length > max) { s = s.slice(0, max).replace(/[\s._-]+$/, ''); cut = true }
  return { name: s, had, cut };
}

async function readSheet(f) {
  let rows;
  if (/\.csv$/i.test(f.name) || /csv/.test(f.type)) rows = parseCSV(await f.text());
  else {
    need('exceljs'); const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(await f.arrayBuffer()) } catch (e) { throw new UserError(`“${f.name}” couldn’t be read. Save it as .xlsx or .csv and try again.`) }
    const ws = wb.worksheets.find(w => !w.state || w.state === 'visible') || wb.worksheets[0];
    rows = [];
    if (ws) ws.eachRow({ includeEmpty: true }, (r, rn) => { const a = []; for (const cn of [1, 2]) { const c = r.getCell(cn); let v = ''; try { v = c.text } catch (e) { v = c.value == null ? '' : String(c.value) } a.push(v == null ? '' : String(v)) } rows[rn - 1] = a });
    rows = rows.map(r => r || ['', '']);
  }
  rows = rows.map((r, i) => ({ line: i + 1, a: String(r[0] ?? '').trim(), b: String(r[1] ?? '').trim() })).filter(r => r.a || r.b);
  // a heading row such as "Old name | New name" is skipped
  if (rows.length && !/\d/.test(rows[0].a) && /name|new|old|series|no\.?|number|file/i.test(rows[0].a + ' ' + rows[0].b)) rows.shift();
  return rows;
}

// works out old name → new name for every PDF
function makePlan(pdfs, rows, o) {
  const max = Math.max(5, Math.min(120, +o.max || MAXLEN_DEF));
  const items = pdfs.map((f, i) => ({ f, i, row: null, warn: [], name: null }));
  const used = new Map(); // row → items
  if (o.by === 'order') items.forEach((it, i) => { it.row = rows[i] || null });
  else {
    const byKey = new Map(); rows.forEach(r => { const k = normKey(r.a); if (k && !byKey.has(k)) byKey.set(k, r) });
    const dupKeys = new Set(); { const seen = new Set(); rows.forEach(r => { const k = normKey(r.a); if (k && seen.has(k)) dupKeys.add(k); seen.add(k) }) }
    for (const it of items) {
      const bn = it.f.name.replace(/\.[^.]+$/, '').trim().toLowerCase();
      let r = byKey.get(bn) || byKey.get(normKey(bn));
      if (!r) {
        const groups = digitGroups(it.f.name), hits = [...new Set(groups)].filter(g => byKey.has(g));
        if (hits.length === 1) r = byKey.get(hits[0]);
        else if (hits.length > 1) { r = byKey.get(groups.filter(g => byKey.has(g)).pop()); it.warn.push(`Matches several rows (${hits.join(', ')}); used ${normKey(r.a)}`) }
      }
      if (!r) { const textKeys = [...byKey.keys()].filter(k => !/^\d+$/.test(k) && k.length >= 3 && bn.includes(k)); if (textKeys.length === 1) r = byKey.get(textKeys[0]) }
      it.row = r || null;
    }
    if (dupKeys.size) items.forEach(it => { if (it.row && dupKeys.has(normKey(it.row.a))) it.warn.push(`Row ${it.row.a} appears more than once in the list; the first one is used`) });
  }
  items.forEach(it => { if (it.row) { if (!used.has(it.row)) used.set(it.row, []); used.get(it.row).push(it) } });
  used.forEach(list => { if (list.length > 1) list.forEach(it => it.warn.push(`${list.length} PDFs match row ${it.row.a}`)) });
  for (const it of items) {
    if (!it.row) { it.status = 'nomatch'; continue }
    if (!it.row.b) { it.status = 'blank'; continue }
    const c = cleanName(it.row.b, max);
    if (!c.name) { it.status = 'blank'; continue }
    if (c.had) it.warn.push('Characters not allowed in file names were removed');
    if (c.cut) it.warn.push(`Shortened to ${max} letters`);
    it.name = c.name; it.status = 'ok';
  }
  // the same new name twice: add _1, _2 … (or stop)
  const groups = new Map();
  items.filter(it => it.name).forEach(it => { const k = it.name.toLowerCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it) });
  let dupStop = false;
  groups.forEach(list => {
    if (list.length < 2) return;
    if (o.dup === 'stop') { dupStop = true; list.forEach(it => { it.status = 'dup'; it.warn.push('Another PDF gets the same new name') }); return }
    list.forEach((it, n) => { const sfx = '_' + (n + 1); it.name = it.name.slice(0, Math.max(1, max - sfx.length)) + sfx; it.warn.push('Same new name as another PDF, so a number was added') });
  });
  const taken = new Set(items.filter(it => it.name).map(it => it.name.toLowerCase()));
  // PDFs without a new name keep their own name (never clashing with a new one)
  for (const it of items) {
    if (it.name) continue;
    let nm = it.f.name.replace(/\.pdf$/i, ''), n = 2; const b0 = nm;
    while (taken.has(nm.toLowerCase())) nm = `${b0} (${n++})`;
    taken.add(nm.toLowerCase()); it.keep = nm;
  }
  const rowsNoPdf = o.by === 'order' ? rows.slice(items.length) : rows.filter(r => !used.has(r) && normKey(r.a));
  return { items, rowsNoPdf, dupStop, max };
}

function opts() { const g = k => { const e = $('o_' + k); return e ? e.value : '' }; return { by: g('by') || 'num', dup: g('dup') || 'suffix', max: g('max') || MAXLEN_DEF } }

async function refresh() {
  if (!isRename()) return;
  const sheets = gfiles.filter(f => isXls(f)), pdfs = gfiles.filter(f => isPdf(f));
  const sheet = sheets[0] || null;
  const key = sheet ? sheet.name + '|' + sheet.size + '|' + sheet.lastModified : '';
  if (key !== RN.key) {
    RN.key = key; RN.rows = null; RN.err = null;
    if (sheet) { try { RN.rows = await readSheet(sheet) } catch (e) { RN.err = errText(e) } }
  }
  RN.plan = RN.rows && pdfs.length ? makePlan(pdfs, RN.rows, opts()) : null;
  draw(sheets.length, pdfs.length);
}

function draw(nSheets, nPdfs) {
  let box = $('rnPrev');
  if (!isRename()) { if (box) box.hidden = true; return }
  if (!box) { box = document.createElement('div'); box.id = 'rnPrev'; box.className = 'rn-prev'; $('gopts').after(box); box.addEventListener('click', onBox) }
  box.hidden = false;
  const steps = `<ol class="rn-steps"><li class="${nPdfs ? 'ok' : ''}">Add the PDFs (001.pdf, Scan_002.pdf …)</li><li class="${nSheets ? 'ok' : ''}">Add your Excel or CSV list: column A = number in the file name (001), column B = new name. <span class="lbl">No list yet? Press <b>Get PDF names as Excel</b>, type the new names in column B, save, and add that file here.</span></li><li>Check the preview, then press <b>Rename PDFs</b></li></ol>` +
    (nPdfs ? `<div class="rn-dir"><button type="button" class="btn2" id="rnXls">Get PDF names as Excel</button><span class="lbl">${nPdfs} file name${nPdfs === 1 ? '' : 's'} → Excel. Column A = number from each name, column B = new name${nSheets ? ' (filled from your list)' : ' (empty, for you to fill in)'}, column C = current name.</span></div>` : '');
  if (RN.err) { box.innerHTML = steps + `<p class="msg bad">${esc(RN.err)}</p>`; return }
  if (nSheets > 1) { box.innerHTML = steps + '<p class="msg warn">Add only one Excel or CSV list. Remove the others.</p>'; return }
  if (!RN.plan) { box.innerHTML = steps + (RN.rows ? `<p class="lbl">${RN.rows.length} row${RN.rows.length === 1 ? '' : 's'} read from the list.</p>` : ''); return }
  const P = RN.plan, ok = P.items.filter(it => it.status === 'ok').length, warnN = P.items.filter(it => it.warn.length || it.status !== 'ok').length + P.rowsNoPdf.length;
  const st = it => it.status === 'ok' ? (it.warn.length ? `<span class="rn-w">⚠ ${esc(it.warn.join('. '))}</span>` : '<span class="rn-ok">✓ Ready</span>')
    : it.status === 'nomatch' ? '<span class="rn-bad">No row in the list matches this PDF. It keeps its name.</span>'
    : it.status === 'blank' ? `<span class="rn-bad">Row ${esc(it.row.a)} has no new name (column B is empty). It keeps its name.</span>`
    : `<span class="rn-bad">${esc(it.warn.join('. '))}</span>`;
  box.innerHTML = steps + `<div class="rn-head"><b>${ok} of ${P.items.length} PDF${P.items.length === 1 ? '' : 's'} will be renamed</b>${warnN ? ` · <span class="rn-w">${warnN} to check</span>` : ' · no problems found'}</div>
<div class="rn-tw"><table class="rn-t"><thead><tr><th>#</th><th>Old name</th><th></th><th>New name</th><th>Check</th></tr></thead><tbody>${P.items.map((it, n) => `<tr class="${it.status === 'ok' ? (it.warn.length ? 'w' : '') : 'bad'}"><td>${n + 1}</td><td class="rn-o" title="${esc(it.f.name)}">${esc(it.f.name)}</td><td aria-hidden="true">→</td><td class="rn-n"><b>${esc((it.name || it.keep) + '.pdf')}</b></td><td>${st(it)}</td></tr>`).join('')}</tbody></table></div>` +
    (P.rowsNoPdf.length ? `<p class="msg warn">No PDF found for ${P.rowsNoPdf.length} row${P.rowsNoPdf.length === 1 ? '' : 's'}: ${P.rowsNoPdf.slice(0, 12).map(r => esc(r.a || '(empty)') + (r.b ? ' → ' + esc(r.b) : '')).join(', ')}${P.rowsNoPdf.length > 12 ? ' …' : ''}</p>` : '') +
    (P.dupStop ? '<p class="msg bad">Two or more PDFs would get the same new name. Fix the list, or choose “Add _1, _2” under “If two PDFs get the same name”.</p>' : '') +
    (window.showDirectoryPicker && !/Android|iPhone|iPad/i.test(navigator.userAgent) ? '<div class="rn-dir"><button type="button" class="btn2" id="rnDir">Save renamed PDFs into a folder…</button><span class="lbl">Pick a folder on this computer. Your original files are not changed.</span></div>' : '');
}

function logCsv(P) {
  const q = v => /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const lines = ['Old name,New name,Result'];
  P.items.forEach(it => lines.push([it.f.name, (it.name || it.keep) + '.pdf', it.status === 'ok' ? (it.warn.join('; ') || 'Renamed') : it.status === 'nomatch' ? 'No matching row - name kept' : it.status === 'blank' ? 'Empty new name - name kept' : it.warn.join('; ')].map(q).join(',')));
  P.rowsNoPdf.forEach(r => lines.push(['', r.b, `No PDF found for row ${r.a}`].map(q).join(',')));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// PDF file names → Excel (column A = number in the name, B = new name, C = current file name)
function seriesOf(name) {
  const base = name.replace(/\.[^.]+$/, '').trim(), g = base.match(/\d+/g) || [];
  return g.length === 1 ? g[0] : base;   // one number → that number (001 stays 001); otherwise the whole name
}
async function namesXlsx() {
  const pdfs = gfiles.filter(f => isPdf(f)).slice().sort((a, b) => seriesOf(a.name).localeCompare(seriesOf(b.name), undefined, { numeric: true, sensitivity: 'base' }) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!pdfs.length) { toast('Add the PDFs first.', true); return }
  const newName = new Map(); if (RN.plan) RN.plan.items.forEach(it => { if (it.row && it.row.b) newName.set(it.f, it.row.b) });
  need('exceljs');
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('PDF names', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [{ header: 'Series (in file name)', key: 'a', width: 22, style: { numFmt: '@' } }, { header: 'New name', key: 'b', width: 36 }, { header: 'Current file name', key: 'c', width: 44 }];
  pdfs.forEach(f => ws.addRow({ a: seriesOf(f.name), b: newName.get(f) || '', c: f.name }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2EC' } };
  for (let r = 2; r <= pdfs.length + 1; r++) ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } };
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  try { await saveBlob(`pdf-names-${new Date().toISOString().slice(0, 10)}.xlsx`, blob); toast(`Saved ${pdfs.length} file name${pdfs.length === 1 ? '' : 's'} to Excel. Type the new names in column B, then add the file here.`) }
  catch (err) { if (!(err && err.code === 'declined')) toast(errText(err), true) }
}

async function onBox(e) {
  if (e.target.closest('#rnXls')) { namesXlsx(); return }
  if (!e.target.closest('button#rnDir')) return;
  const P = RN.plan; if (!P) return;
  if (P.dupStop) { toast('Two PDFs would get the same name. Fix the list first.', true); return }
  let dir;
  try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'pt-rename' }) } catch (err) { return }
  const b = busy('Saving renamed PDFs…'); let n = 0;
  try {
    for (const it of P.items) {
      const fh = await dir.getFileHandle((it.name || it.keep) + '.pdf', { create: true }), w = await fh.createWritable();
      await w.write(it.f); await w.close(); n++; b.set(`Saving renamed PDFs… ${n} of ${P.items.length}`);
    }
    const lh = await dir.getFileHandle(`rename-log-${new Date().toISOString().slice(0, 10)}.csv`, { create: true }), lw = await lh.createWritable();
    await lw.write(logCsv(P)); await lw.close();
    toast(`Saved ${n} PDF${n === 1 ? '' : 's'} and a log file into the folder “${dir.name}”.`);
  } catch (err) { console.error(err); toast(errText(err), true) } finally { b.done() }
}

function add() {
  if (TOOLS.renamepdf) return;
  TOOLS.renamepdf = {
    n: 'Bulk rename PDFs', d: 'Get PDF names into Excel, type new names, and rename them all at once (001 → Rahul Sharma)', cat: 'org', h: 32, multi: true, kinds: ['pdf', 'xls'], go: 'Rename PDFs', isNew: 1, min: 2,
    help: 'No list yet? Add the PDFs and press “Get PDF names as Excel”. Make a list in Excel: column A = the number in the PDF’s file name (001, 002 …), column B = the new name. Add the list and all the PDFs. 001.pdf, Scan_001.pdf and 1.pdf all match row 001. You get a ZIP with the renamed PDFs and a log file (old name → new name). Your original files are not changed.',
    opts: [SEL('by', 'Match PDFs to rows', [['num', 'By the number in the file name (001 = 1)'], ['order', 'By order (first PDF = first row)']]),
      SEL('dup', 'If two PDFs get the same name', [['suffix', 'Add _1, _2 to the names'], ['stop', 'Stop and show me']]),
      SEL('max', 'Longest new name', [['35', '35 letters'], ['50', '50 letters'], ['80', '80 letters']])],
    run: async (fs, o, P) => {
      const sheets = fs.filter(f => isXls(f)), pdfs = fs.filter(f => isPdf(f));
      if (!sheets.length) throw new UserError('Add your Excel or CSV list (column A = number, column B = new name).');
      if (sheets.length > 1) throw new UserError('Add only one Excel or CSV list.');
      if (!pdfs.length) throw new UserError('Add the PDFs you want to rename.');
      P(null, 'Reading the list…');
      const rows = await readSheet(sheets[0]);
      if (!rows.length) throw new UserError('The list is empty. Put the numbers in column A and the new names in column B.');
      const plan = makePlan(pdfs, rows, o);
      if (plan.dupStop) throw new UserError('Two or more PDFs would get the same new name. Fix the list, or choose “Add _1, _2”.');
      if (!plan.items.some(it => it.status === 'ok')) throw new UserError('None of the PDFs matched a row in the list. Check that column A has the numbers used in the file names.');
      const outs = [];
      for (let i = 0; i < plan.items.length; i++) { const it = plan.items[i]; P(i / plan.items.length, `Renaming ${it.f.name}`); outs.push({ name: (it.name || it.keep) + '.pdf', data: new Uint8Array(await it.f.arrayBuffer()) }) }
      outs.push({ name: 'rename-log.csv', data: new TextEncoder().encode(logCsv(plan)) });
      return outs;
    }
  };
  TI.renamepdf = 'M4 4h10l4 4v12H4zM14 4v4h4M7 13h6M7 17h9M16 11l2 2-2 2';
  ORDER.splice(ORDER.indexOf('merge') + 1, 0, 'renamepdf');
  // the drop zone takes PDFs and the list together
  const _drawFiles = drawFiles;
  drawFiles = function () {
    const r = _drawFiles.apply(this, arguments);
    if (isRename()) refresh().catch(e => console.warn(e)); else draw();
    return r;
  };
  $('gopts').addEventListener('change', () => { if (isRename()) refresh() });
  window.addEventListener('hashchange', () => { if (!isRename()) { RN.key = ''; RN.rows = null; draw() } });
  // the result is one ZIP with a clear name
  const _ready = window.ptResultReady;
  window.ptResultReady = (name, blob) => {
    if (_ready) _ready(name, blob);
    if (isRename() && /\.zip$/i.test(name) && gout) { gout.name = 'renamed-pdfs.zip'; setTimeout(() => { $('grname').textContent = gout.name }, 0) }
  };
}
return { add, makePlan, readSheet, normKey, seriesOf };
})();
