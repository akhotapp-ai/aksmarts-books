/* =====================================================================
   AK Smarts PDF: Excel-style tools ribbon (11 tabs)
   Shown on the home page and on tool pages of laptop and desktop screens (900 px and wider).
   Phones keep the card layout. The Reader & Editor keeps its own ribbon.
   Every tool has one home; any tool not named below is still shown (in a "More" group), so nothing is lost.
   ===================================================================== */
window.PTRibbon = (() => {
'use strict';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LS = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} } };
const SS = { get: k => { try { return sessionStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { sessionStorage.setItem(k, v) } catch (e) {} } };

// shorter button labels where the full tool name is long
const SHORT = { ocr: 'OCR PDF', esign: 'e-Sign & lock', dsc: 'Sign with DSC', renamepdf: 'Bulk rename', extract: 'Extract & reorder', blankpages: 'Remove blank pages', verify: 'Verify signatures', stamps: 'Stamps & QR code', jpg2pdf: 'Images to PDF', pdf2jpg: 'PDF to images' };
const ICON = {
  guide: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 8h6M9 12h6',
  keys: 'M3 8h18v9H3zM6 11h1M9 11h1M12 11h1M15 11h1M18 11h0M7 14h10',
  news: 'M12 3l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z',
  contact: 'M4 6h16v12H4zM4 7l8 6 8-6',
  menu: 'M4 5h16v6H4zM4 14h16v6H4z'
};

// ---- where every tool lives: [tab, groups[]], a group is [title, items[]], an item is a tool id or {menu,icon,items}
const MAP = [
  ['Home', [['Read and edit', ['read', 'edit', 'annotate']]]],
  ['Sign & Fill', [['Sign', ['sign', 'esign', 'dsc']], ['Forms', ['forms']]]],
  ['Merge & Split', [['Combine', ['merge']], ['Split', [{ menu: 'Split', icon: 'split', items: ['split', 'splitsize'] }]], ['Reorder', ['extract', 'renamepdf']]]],
  ['Pages', [['Pages', ['organize', 'remove']], ['Layout', ['rotate', 'crop', 'resize', 'nup']]]],
  ['Convert', [['To PDF', ['jpg2pdf', 'word2pdf', 'excel2pdf', 'txt2pdf']], ['From PDF', ['pdf2word', 'pdf2ppt', 'excel', 'pdf2jpg', 'text', 'extractimg']], ['Pictures', ['compressimg', 'resizeimg', 'cropimg', 'convertimg']]]],
  ['Scan & OCR', [['Scan', ['scan2pdf', 'blankpages']], ['Read the text', ['ocr', 'imgtext']], ['Clean-up', ['grayscale']]]],
  ['Optimize', [['Size', ['compress']], ['Fix', ['repair']], ['Flatten', ['flatten']]]],
  ['Security', [['Protect', ['protect', 'unlock']], ['Remove', ['redact']]]],
  ['Page design', [['Text on pages', ['number', 'headerfooter']], ['Marks', ['watermark', 'stamps']]]],
  ['Compare & Info', [['Compare', ['compare', 'verify']], ['Info', ['metadata']]]],
  ['Help', []]
];
const FALLBACK_TAB = { view: 'Home', org: 'Pages', opt: 'Optimize', to: 'Convert', from: 'Convert', sec: 'Security', design: 'Page design' };

let tabs = [], root = null, cur = 0, openMenu = null;

function iconSvg(id, d) {
  const path = d || (typeof TI !== 'undefined' && TI[id]) || ICON.menu;
  return `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${esc(path)}"/></svg>`;
}
const label = id => SHORT[id] || (TOOLS[id] && TOOLS[id].n) || id;
const link = id => `<a class="rb" href="#${esc(id)}" data-id="${esc(id)}" title="${esc(TOOLS[id].d || '')}">${iconSvg(id)}<span>${esc(label(id))}</span></a>`;

function compute() {
  const placed = new Set(), out = [];
  MAP.forEach(([name, groups]) => {
    const gs = [];
    groups.forEach(([t, items]) => {
      const keep = [];
      items.forEach(it => {
        if (typeof it === 'string') { if (TOOLS[it]) { keep.push(it); placed.add(it) } }
        else { const sub = it.items.filter(x => TOOLS[x]); sub.forEach(x => placed.add(x)); if (sub.length > 1) keep.push({ ...it, items: sub }); else sub.forEach(x => keep.push(x)) }
      });
      if (keep.length) gs.push([t, keep]);
    });
    out.push({ name, groups: gs });
  });
  const more = {};
  ORDER.forEach(id => { if (!placed.has(id) && TOOLS[id]) { const t = FALLBACK_TAB[TOOLS[id].cat] || 'Home'; (more[t] = more[t] || []).push(id) } });
  Object.keys(more).forEach(t => { const tab = out.find(x => x.name === t); if (tab) tab.groups.push(['More', more[t]]) });
  return out;
}

function groupHtml([t, items]) {
  const body = items.map(it => typeof it === 'string' ? link(it)
    : `<div class="ptr-dd"><button type="button" class="rb" aria-haspopup="menu" aria-expanded="false">${iconSvg(it.icon, null)}<span>${esc(it.menu)} ▾</span></button><div class="ptr-menu" role="menu" hidden>${it.items.map(x => `<a role="menuitem" href="#${esc(x)}" data-id="${esc(x)}">${iconSvg(x).replace('width="32" height="32"', 'width="20" height="20"')}<span>${esc(TOOLS[x].n)}</span></a>`).join('')}</div></div>`).join('');
  return `<div class="ptr-grp"><div class="ptr-items">${body}</div><div class="ptr-lbl">${esc(t)}</div></div>`;
}
function helpHtml() {
  const b = (act, ic, txt) => `<button type="button" class="rb" data-act="${act}">${iconSvg('', ICON[ic])}<span>${txt}</span></button>`;
  return `<div class="ptr-grp"><div class="ptr-items">${b('guide', 'guide', 'Quick guide')}${b('keys', 'keys', 'Keyboard shortcuts')}</div><div class="ptr-lbl">Learn</div></div>` +
    `<div class="ptr-grp"><div class="ptr-items">${b('news', 'news', 'What’s new')}<a class="rb" id="ptrContact" hidden>${iconSvg('', ICON.contact)}<span>Contact support</span></a></div><div class="ptr-lbl">Updates and help</div></div>`;
}

function build() {
  tabs = compute();
  const old = document.getElementById('ptRibbon'); if (old) old.remove();
  root = document.createElement('nav'); root.id = 'ptRibbon'; root.className = 'ptr'; root.setAttribute('aria-label', 'Tools ribbon');
  root.innerHTML =
    `<div class="ptr-top"><div class="ptr-tabs" role="tablist" aria-label="Tool groups">${tabs.map((t, i) => `<button type="button" class="ptr-tab" role="tab" id="ptrT${i}" aria-controls="ptrP${i}" data-i="${i}">${esc(t.name)}</button>`).join('')}</div>` +
    `<div class="ptr-tools"><div class="ptr-search"><input id="ptrQ" type="search" placeholder="Tell me what you want to do…" aria-label="Search tools" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="ptrRes"><div id="ptrRes" class="ptr-res" role="listbox" hidden></div></div>` +
    `<button type="button" class="ptr-small" id="ptrCol" aria-expanded="true" title="Show or hide the buttons under the tabs">Collapse ▴</button><button type="button" class="ptr-small" id="ptrClassic" title="Go back to the plain tool cards">Classic view</button></div></div>` +
    `<div class="ptr-bodies">${tabs.map((t, i) => `<div class="ptr-body" role="tabpanel" id="ptrP${i}" aria-labelledby="ptrT${i}" hidden>${t.name === 'Help' ? helpHtml() : t.groups.map(groupHtml).join('')}</div>`).join('')}</div>`;
  const h = document.querySelector('header.app'); (h || document.body).after(root);
  wire();
  const want = SS.get('pt-rtab'), start = tabs.findIndex(t => t.name === want);
  select(start >= 0 ? start : 0);
  if (LS.get('pt-rcollapse') === '1') collapse(true);
  sync();
}

function select(i, focus) {
  cur = i; SS.set('pt-rtab', tabs[i].name);
  root.querySelectorAll('.ptr-tab').forEach((b, k) => { const on = k === i; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus() });
  root.querySelectorAll('.ptr-body').forEach((p, k) => { p.hidden = k !== i });
  closeMenu();
  if (root.classList.contains('collapsed')) collapse(false);
}
function collapse(on) {
  root.classList.toggle('collapsed', on); LS.set('pt-rcollapse', on ? '1' : '0');
  const b = root.querySelector('#ptrCol'); b.textContent = on ? 'Expand ▾' : 'Collapse ▴'; b.setAttribute('aria-expanded', String(!on));
}
function closeMenu() { if (openMenu) { openMenu.menu.hidden = true; openMenu.btn.setAttribute('aria-expanded', 'false'); openMenu = null } }

// highlights the tool you are on and shows its tab
function sync() {
  if (!root) return;
  const id = location.hash.slice(1);
  root.querySelectorAll('[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  if (!TOOLS[id]) return;
  const a = root.querySelector(`a[data-id="${CSS.escape(id)}"]`); if (!a) return;
  a.setAttribute('aria-current', 'page');
  const body = a.closest('.ptr-body'); if (body) { const i = +body.id.replace('ptrP', ''); if (i !== cur) select(i) }
}

// ---- search ("Tell me what you want to do")
function results(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
  return ORDER.filter(id => TOOLS[id]).map(id => {
    const t = TOOLS[id], name = (t.n + ' ' + id).toLowerCase(), all = (name + ' ' + (t.d || '')).toLowerCase();
    if (!words.every(w => all.includes(w))) return null;
    return [words.every(w => name.includes(w)) ? 0 : 1, id];
  }).filter(Boolean).sort((a, b) => a[0] - b[0]).slice(0, 8).map(x => x[1]);
}
function showResults(q) {
  const box = root.querySelector('#ptrRes'), input = root.querySelector('#ptrQ'), ids = results(q);
  if (!q.trim()) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return }
  box.innerHTML = ids.length ? ids.map((id, k) => `<a role="option" id="ptrO${k}" href="#${esc(id)}" data-id="${esc(id)}"><b>${esc(TOOLS[id].n)}</b><small>${esc(TOOLS[id].d || '')}</small></a>`).join('') : '<div class="ptr-none">No tool matches. Try “merge”, “word” or “sign”.</div>';
  box.hidden = false; input.setAttribute('aria-expanded', 'true');
}

// ---- help dialogs
function dialog(id, title, html) {
  let d = document.getElementById(id);
  if (!d) { d = document.createElement('dialog'); d.id = id; d.setAttribute('aria-labelledby', id + 'H'); d.innerHTML = `<h3 id="${id}H">${esc(title)}</h3>${html}<form method="dialog" style="margin-top:14px"><button class="btn" type="submit">Close</button></form>`; document.body.appendChild(d) }
  d.showModal();
}
const KEYS = [['Ctrl + O', 'Open a file'], ['Ctrl + S', 'Save'], ['Ctrl + P', 'Print'], ['Ctrl + F', 'Find text'], ['Ctrl + Z', 'Undo'], ['Ctrl + Y', 'Redo'], ['Ctrl + plus / minus', 'Zoom in / out'], ['Delete', 'Remove the selected item'], ['Arrow keys', 'Move the selected item a little'], ['Esc', 'Leave a tool and go back to all tools'], ['← →  on the tabs', 'Move between the ribbon tabs']];
const NEWS = ['Scan to PDF: photograph papers and make one clean PDF', 'Split PDF by size: parts under 1 MB, 2 MB or your own size', 'Remove blank pages from scans', 'Image to text (OCR): text, Word or searchable PDF', 'Stamps and QR code: PAID, APPROVED or a QR code on your pages', 'Autosave and recover: your unsaved work is offered back after a crash', 'Sharper pages and a reader that fits your screen', 'This tools ribbon: every tool in one place, with search'];
function act(name) {
  if (name === 'guide') { const a = document.getElementById('aboutBtn') || document.getElementById('aboutTop'); if (a) a.click() }
  else if (name === 'keys') dialog('ptrKeys', 'Keyboard shortcuts', `<table class="ptr-keys"><tbody>${KEYS.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`);
  else if (name === 'news') dialog('ptrNews', 'What’s new', `<ul>${NEWS.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
}

function wire() {
  root.addEventListener('click', e => {
    const tab = e.target.closest('.ptr-tab'); if (tab) { select(+tab.dataset.i); return }
    const dd = e.target.closest('.ptr-dd > button');
    if (dd) { const menu = dd.nextElementSibling, was = openMenu && openMenu.btn === dd; closeMenu(); if (!was) { menu.hidden = false; dd.setAttribute('aria-expanded', 'true'); openMenu = { btn: dd, menu }; const f = menu.querySelector('a'); if (f && e.detail === 0) f.focus() } return }
    const a = e.target.closest('[data-act]'); if (a) { act(a.dataset.act); return }
    if (e.target.id === 'ptrCol') { collapse(!root.classList.contains('collapsed')); return }
    if (e.target.id === 'ptrClassic') { LS.set('pt-ribbon', '0'); document.body.classList.add('pt-noribbon'); footerLink(); return }
    if (e.target.closest('a[data-id]')) { closeMenu(); const q = root.querySelector('#ptrQ'); q.value = ''; showResults('') }
  });
  root.addEventListener('keydown', e => {
    const t = e.target.closest('.ptr-tab');
    if (t && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); const n = tabs.length, i = +t.dataset.i;
      select(e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n, true);
    }
    const mi = e.target.closest('.ptr-menu a');
    if (mi && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const l = [...mi.parentNode.querySelectorAll('a')], k = l.indexOf(mi); l[(k + (e.key === 'ArrowDown' ? 1 : l.length - 1)) % l.length].focus() }
    if (e.target.id === 'ptrQ') {
      const opts = [...root.querySelectorAll('#ptrRes a')], on = root.querySelector('#ptrRes a[aria-selected="true"]'), k = opts.indexOf(on);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!opts.length) return; opts.forEach(o => o.removeAttribute('aria-selected')); const n = opts[(k + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length]; n.setAttribute('aria-selected', 'true'); e.target.setAttribute('aria-activedescendant', n.id) }
      else if (e.key === 'Enter') { const go = on || opts[0]; if (go) { e.preventDefault(); location.hash = go.getAttribute('href'); e.target.value = ''; showResults('') } }
    }
  });
  root.querySelector('#ptrQ').addEventListener('input', e => showResults(e.target.value));
  root.querySelector('#ptrQ').addEventListener('blur', () => setTimeout(() => { const b = root && root.querySelector('#ptrRes'); if (b && !b.contains(document.activeElement)) b.hidden = true }, 150));
  root.querySelector('#ptrQ').addEventListener('focus', e => { if (e.target.value) showResults(e.target.value) });
}
// Escape closes an open menu or the search list first (before the app leaves the tool page)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !root) return;
  const res = root.querySelector('#ptrRes');
  if (openMenu) { const b = openMenu.btn; closeMenu(); b.focus(); e.stopImmediatePropagation(); e.preventDefault() }
  else if (res && !res.hidden) { res.hidden = true; root.querySelector('#ptrQ').setAttribute('aria-expanded', 'false'); e.stopImmediatePropagation(); e.preventDefault() }
}, true);
document.addEventListener('click', e => { if (openMenu && !e.target.closest('.ptr-dd')) closeMenu() });

function footerLink() {
  if (document.getElementById('ptrBack')) return;
  const f = document.querySelector('footer .in') || document.querySelector('footer'); if (!f) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'ptrBack'; b.className = 'linkbtn'; b.textContent = 'Show the tools ribbon';
  b.onclick = () => { LS.set('pt-ribbon', '1'); document.body.classList.remove('pt-noribbon'); b.remove() };
  f.appendChild(b);
}

function add() {
  if (typeof TOOLS === 'undefined' || document.getElementById('ptRibbon')) return;
  build();
  window.addEventListener('hashchange', sync);
  if (LS.get('pt-ribbon') === '0') { document.body.classList.add('pt-noribbon'); footerLink() }
  // optional "Contact support" button: set SUPPORT_CONTACT (an email or a web address) on the server
  if (/^https?:/.test(location.protocol)) fetch('/api/config').then(r => r.json()).then(c => {
    const s = c && c.support, a = document.getElementById('ptrContact'); if (!s || !a) return;
    a.href = /^https?:\/\//i.test(s) ? s : /^[^@\s]+@[^@\s]+$/.test(s) ? 'mailto:' + s : ''; if (a.href) { a.target = '_blank'; a.rel = 'noopener'; a.hidden = false }
  }).catch(() => {});
}
return { add, compute, select };
})();
