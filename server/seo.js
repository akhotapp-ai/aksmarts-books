// Search pages: one light, fast web address per tool (like iLovePDF), so people find each tool on Google.
// Example: /compress-pdf, /pdf-to-excel, /compress-image. The page is small (it loads instantly);
// when the visitor picks a file, the full app at /app opens straight in that tool with the file.
// The words on each page are in seo-content.js (English) and seo-i18n.js (Hindi, Kannada).

// [address, app tool id, page heading, short description, what it is good for]
const PAGES = [
  ['pdf-reader', 'read', 'PDF Reader', 'Open, read, search and print PDF files online.', 'Read any PDF in your browser or phone with thumbnails, bookmarks, search, zoom, night mode and printing.'],
  ['edit-pdf', 'edit', 'Edit PDF', 'Edit PDF text, add text, images and white-out online.', 'Click any text on the page to change it, add new text or images, or white-out parts you want to hide.'],
  ['annotate-pdf', 'annotate', 'Annotate PDF', 'Highlight, underline, draw and add comments to PDF files.', 'Highlight, underline, draw shapes, add sticky notes and stamps. Comments are saved as standard PDF comments that show in every PDF reader.'],
  ['sign-pdf', 'sign', 'Sign PDF', 'Draw, type or upload your signature and place it on a PDF.', 'Create your signature once by drawing, typing or uploading a picture, then place it anywhere on the document.'],
  ['esign-pdf', 'esign', 'e-Sign PDF', 'Digitally sign a PDF and lock it against changes.', 'Add a certified digital signature, with or without an account. The signed PDF is locked so any later change shows the signature as invalid.'],
  ['dsc-sign-pdf', 'dsc', 'Sign PDF with DSC', 'Sign PDFs with your Digital Signature Certificate (.pfx / .p12).', 'Use your Class 2 or Class 3 DSC to sign GST, MCA, tender and legal documents. The certificate never leaves your device.'],
  ['verify-pdf-signature', 'verify', 'Verify PDF Signature', 'Check who signed a PDF and whether it was changed.', 'Open a signed PDF to see the signer, the signing time and whether the document was changed after signing.'],
  ['fill-pdf-form', 'forms', 'Fill PDF Form', 'Type into PDF forms, tick boxes and add dates online.', 'Fill in fillable fields, or type anywhere on forms without fields. Add ticks, dates and your signature.'],
  ['merge-pdf', 'merge', 'Merge PDF', 'Combine PDF files and images into one PDF, or batch-merge many files by name.', 'Join several PDFs and pictures into one file in any order (sort A→Z, Z→A or drag), or switch to Batch to turn 01_…, 02_… files into 01.pdf, 02.pdf.'],
  ['merge-pdf-by-name', 'groupmerge', 'Merge PDFs by File Name', 'Batch merge: files whose names start the same become one PDF.', 'Add many PDFs and pictures at once. Files like 01_invoice, 01_receipt and _01 photo are joined into 01.pdf, 02_… into 02.pdf, and so on, then downloaded as a ZIP.'],
  ['bulk-rename-pdf', 'renamepdf', 'Bulk Rename PDFs', 'Rename many PDFs at once from an Excel or CSV list.', 'Get the PDF names into Excel, type the new names, and rename every PDF in one go (001 → Rahul Sharma).'],
  ['split-pdf', 'split', 'Split PDF', 'Split a PDF into separate files by page or range.', 'Split into single pages, groups of pages, your own ranges or two halves.'],
  ['organize-pdf', 'organize', 'Organize PDF Pages', 'Reorder, rotate, delete and insert PDF pages.', 'See every page as a thumbnail. Drag to reorder, rotate, delete, duplicate, or insert pages from other files.'],
  ['remove-pdf-pages', 'remove', 'Remove PDF Pages', 'Delete pages from a PDF online.', 'Type the pages you don’t need, such as 2, 5-7, and download the PDF without them.'],
  ['extract-pdf-pages', 'extract', 'Extract PDF Pages', 'Keep only the pages you need, in any order.', 'Pick the pages to keep and their order to create a new PDF.'],
  ['rotate-pdf', 'rotate', 'Rotate PDF', 'Rotate all or selected PDF pages.', 'Turn every page, only landscape or portrait pages, or the pages you choose.'],
  ['crop-pdf', 'crop', 'Crop PDF', 'Trim PDF margins automatically or by measurement.', 'Remove white margins automatically or cut exact margins in millimetres.'],
  ['resize-pdf', 'resize', 'Resize PDF Pages', 'Fit every PDF page to A4, Letter or another paper size.', 'Make all pages the same paper size, such as A4, Letter, Legal, A3 or A5.'],
  ['pdf-pages-per-sheet', 'nup', 'Multiple Pages per Sheet', 'Put 2, 4, 6 or 9 PDF pages on one sheet.', 'Save paper by printing several pages on each sheet (N-up).'],
  ['compress-pdf', 'compress', 'Compress PDF', 'Reduce PDF file size for email and upload.', 'Make PDFs smaller while keeping text sharp. Choose 90%, 75%, 50% or 25% quality, extreme or lossless.'],
  ['compress-image', 'compressimg', 'Compress Image', 'Reduce JPG and PNG image file size online.', 'Make photos and pictures smaller to send or upload to forms and portals with size limits.'],
  ['resize-image', 'resizeimg', 'Resize Image', 'Change the size of JPG, PNG and WebP pictures.', 'Make photos smaller in pixels for forms, websites and passport photos, without stretching them.'],
  ['crop-image', 'cropimg', 'Crop Image', 'Crop a photo online: free shape, square, 16:9 or passport size.', 'Drag a box over the part you want to keep, pick a ready-made shape, rotate if needed and download.'],
  ['passport-size-photo', 'cropimg', 'Passport Size Photo Maker', 'Crop a photo to passport size (3.5 × 4.5 cm) online.', 'Cut any photo to the exact passport shape for applications, ID cards and exam forms.'],
  ['jpg-to-png', 'convertimg', 'JPG to PNG', 'Convert JPG pictures to PNG online.', 'Change JPG photos to PNG for sharp edges, logos and editing.'],
  ['webp-to-jpg', 'convertimg', 'WebP to JPG', 'Convert WebP images to JPG online.', 'Turn WebP pictures saved from websites into JPG files that every app and form accepts.'],
  ['png-to-jpg', 'convertimg', 'PNG to JPG', 'Convert PNG, WebP and other pictures to JPG, PNG or WebP.', 'Change a picture’s format: PNG to JPG, JPG to PNG, or to WebP for websites.'],
  ['repair-pdf', 'repair', 'Repair PDF', 'Fix damaged PDF files that won’t open.', 'Rebuild broken PDFs from what can be recovered.'],
  ['ocr-pdf', 'ocr', 'OCR PDF', 'Make scanned PDFs searchable and selectable.', 'Recognise the text in scanned pages so you can search, select and copy it.'],
  ['flatten-pdf', 'flatten', 'Flatten PDF', 'Lock form answers and comments into the page.', 'Turn form fields and comments into part of the page so they can’t be changed.'],
  ['grayscale-pdf', 'grayscale', 'Grayscale PDF', 'Convert a colour PDF to black and white.', 'Turn colour pages into grayscale for printing.'],
  ['jpg-to-pdf', 'jpg2pdf', 'JPG to PDF', 'Convert JPG, PNG and other images to PDF.', 'Turn photos, scans and screenshots into one PDF, with page size and margin options.'],
  ['image-to-pdf', 'jpg2pdf', 'Image to PDF', 'Convert pictures to a PDF file.', 'Combine one or many pictures into a single PDF document.'],
  ['word-to-pdf', 'word2pdf', 'Word to PDF', 'Convert Word documents (.docx) to PDF.', 'Turn Word documents into PDF files that look the same everywhere.'],
  ['excel-to-pdf', 'excel2pdf', 'Excel to PDF', 'Convert Excel spreadsheets (.xlsx, .csv) to PDF.', 'Turn spreadsheets into neat PDF tables.'],
  ['text-to-pdf', 'txt2pdf', 'Text to PDF', 'Convert plain text files to PDF.', 'Turn .txt files into clean PDF pages.'],
  ['pdf-to-word', 'pdf2word', 'PDF to Word', 'Convert PDF to an editable Word document.', 'Turn a PDF into a .docx file you can edit in Microsoft Word.'],
  ['pdf-to-powerpoint', 'pdf2ppt', 'PDF to PowerPoint', 'Convert PDF to PowerPoint slides.', 'Make a slide deck with one PDF page per slide.'],
  ['pdf-to-excel', 'excel', 'PDF to Excel', 'Convert PDF tables and bank statements to Excel.', 'Turn bank statements, invoices and tables, even scanned ones, into an Excel spreadsheet.'],
  ['pdf-to-jpg', 'pdf2jpg', 'PDF to JPG', 'Convert PDF pages to JPG or PNG images.', 'Save every page of a PDF as a picture.'],
  ['pdf-to-text', 'text', 'PDF to Text', 'Extract text from PDF files, scans included.', 'Copy all the words out of a PDF.'],
  ['extract-images-from-pdf', 'extractimg', 'Extract Images from PDF', 'Save every picture inside a PDF.', 'Download all the images contained in a PDF.'],
  ['protect-pdf', 'protect', 'Protect PDF', 'Add a password to a PDF.', 'Encrypt a PDF with a password and choose whether others can print, copy or edit it.'],
  ['unlock-pdf', 'unlock', 'Unlock PDF', 'Remove the password and restrictions from a PDF.', 'Remove a PDF’s password (you need to know it) and its printing or copying limits.'],
  ['redact-pdf', 'redact', 'Redact PDF', 'Black out private information in a PDF permanently.', 'Hide account numbers, addresses and other private details for good.'],
  ['compare-pdf', 'compare', 'Compare PDF', 'Find the differences between two PDF files.', 'See what changed between two versions of a document.'],
  ['add-page-numbers-to-pdf', 'number', 'Add Page Numbers to PDF', 'Number the pages of a PDF.', 'Add page numbers in the position and style you choose.'],
  ['watermark-pdf', 'watermark', 'Watermark PDF', 'Add a text or logo watermark to a PDF.', 'Stamp text such as CONFIDENTIAL, or your logo, across pages.'],
  ['pdf-header-footer', 'headerfooter', 'Add Header and Footer to PDF', 'Add header and footer text to PDF pages.', 'Add text at the top or bottom of every page.'],
  ['edit-pdf-metadata', 'metadata', 'Edit PDF Metadata', 'Change or remove a PDF’s title, author and keywords.', 'Edit the document properties of a PDF, or remove them for privacy.'],
  ['split-pdf-by-size', 'splitsize', 'Split PDF by Size', 'Split a PDF into parts under 1 MB, 2 MB or your own size.', 'Cut a big PDF into smaller files that each fit an upload or email limit.'],
  ['remove-blank-pages-from-pdf', 'blankpages', 'Remove Blank Pages from PDF', 'Find and delete empty pages in a scanned PDF.', 'Remove the blank pages that scanners leave between sheets, ignoring dust and tiny marks.'],
  ['image-to-text', 'imgtext', 'Image to Text (OCR)', 'Read the text from photos and screenshots.', 'Turn a photo, scan or screenshot into text, a Word file or a searchable PDF.'],
  ['scan-to-pdf', 'scan2pdf', 'Scan to PDF', 'Photograph papers with your phone and make one clean PDF.', 'Take photos of documents, clean them up like a scanner and join them into one PDF.'],
  ['stamp-pdf', 'stamps', 'Stamps and QR Code for PDF', 'Add PAID, APPROVED or a QR code to PDF pages.', 'Stamp PAID, RECEIVED, APPROVED or your own text, or add a QR code, on the pages you choose.']
];

const { C, UPDATED } = require('./seo-content');
const I18N = require('./seo-i18n');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BY_SLUG = new Map(PAGES.map(p => [p[0], p]));

// groups for the "All tools" page and the footer
const GROUPS = [
  ['View, edit & sign', ['pdf-reader', 'edit-pdf', 'annotate-pdf', 'sign-pdf', 'esign-pdf', 'dsc-sign-pdf', 'verify-pdf-signature', 'fill-pdf-form']],
  ['Organize pages', ['merge-pdf', 'merge-pdf-by-name', 'bulk-rename-pdf', 'split-pdf', 'split-pdf-by-size', 'organize-pdf', 'remove-pdf-pages', 'remove-blank-pages-from-pdf', 'extract-pdf-pages', 'rotate-pdf', 'crop-pdf', 'resize-pdf', 'pdf-pages-per-sheet']],
  ['Compress & optimize', ['compress-pdf', 'repair-pdf', 'ocr-pdf', 'flatten-pdf', 'grayscale-pdf']],
  ['Image tools', ['compress-image', 'resize-image', 'crop-image', 'passport-size-photo', 'image-to-text', 'png-to-jpg', 'jpg-to-png', 'webp-to-jpg']],
  ['Convert to PDF', ['jpg-to-pdf', 'scan-to-pdf', 'image-to-pdf', 'word-to-pdf', 'excel-to-pdf', 'text-to-pdf']],
  ['Convert from PDF', ['pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint', 'pdf-to-jpg', 'pdf-to-text', 'extract-images-from-pdf']],
  ['Security', ['protect-pdf', 'unlock-pdf', 'redact-pdf', 'compare-pdf']],
  ['Page design', ['add-page-numbers-to-pdf', 'watermark-pdf', 'stamp-pdf', 'pdf-header-footer', 'edit-pdf-metadata']]
];
// a tool page can pre-pick an option in the app (JPG to PNG picks PNG)
const PAGE_OPTS = { 'jpg-to-png': { to: 'png' }, 'webp-to-jpg': { to: 'jpg' }, 'png-to-jpg': { to: 'jpg' }, 'passport-size-photo': { ratio: 'passport' }, 'crop-image': { ratio: 'free' } };
const POPULAR = ['compress-pdf', 'pdf-to-excel', 'pdf-to-word', 'merge-pdf', 'jpg-to-pdf', 'compress-image', 'crop-image', 'split-pdf', 'edit-pdf', 'sign-pdf', 'word-to-pdf', 'unlock-pdf'];

// what files each tool takes (for the file picker on its page)
const IMG = ['compressimg', 'resizeimg', 'convertimg', 'jpg2pdf'];
function accepts(tool) {
  if (tool === 'cropimg') return { accept: 'image/*', kind: 'image', multi: false };
  if (IMG.includes(tool)) return { accept: 'image/*', kind: 'images', multi: true };
  if (tool === 'renamepdf') return { accept: '.pdf,application/pdf,.xlsx,.xls,.csv,text/csv', kind: 'PDFs and Excel list', multi: true };
  if (tool === 'merge' || tool === 'groupmerge') return { accept: '.pdf,application/pdf,image/*', kind: 'PDF files or images', multi: true };
  if (tool === 'compress') return { accept: '.pdf,application/pdf,image/*', kind: 'PDF file', multi: false };
  if (tool === 'word2pdf') return { accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'Word file', multi: true };
  if (tool === 'excel2pdf') return { accept: '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv', kind: 'Excel file', multi: true };
  if (tool === 'txt2pdf') return { accept: '.txt,text/plain', kind: 'text file', multi: true };
  if (tool === 'excel' || tool === 'text') return { accept: '.pdf,application/pdf,image/*', kind: 'PDF file', multi: true };
  if (tool === 'compare') return { accept: '.pdf,application/pdf', kind: '2 PDF files', multi: true };
  return { accept: '.pdf,application/pdf', kind: 'PDF file', multi: false };
}

// the parent company site (e.g. https://aksmarts.com) when the PDF app lives on its own subdomain
const COMPANY = (() => { try { const u = new URL(process.env.COMPANY_URL || ''); return /^https?:$/.test(u.protocol) ? { url: u.origin + '/', name: process.env.COMPANY_NAME || 'AK Smarts' } : null; } catch (e) { return null; } })();
const org = (origin, appName) => COMPANY ? { '@type': 'Organization', '@id': COMPANY.url + '#org', name: COMPANY.name, url: COMPANY.url, logo: origin + '/icons/logo-512.png' } : { '@type': 'Organization', '@id': origin + '/#org', name: appName, url: origin + '/', logo: origin + '/icons/logo-512.png' };
// spellings people type when they search for the app by name
const altNames = n => { const a = n.replace(/\s+/g, ''), set = new Set([a, a.toLowerCase(), n.replace(/Smarts/i, 'Smart'), a.replace(/Smarts/i, 'Smart').toLowerCase(), n.replace(/\s*PDF$/i, '') + ' PDF Tools']); set.delete(n); return [...set] };
const orgId = origin => COMPANY ? COMPANY.url + '#org' : origin + '/#org';
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const fill = (t, free, word = ' Free') => t.replace('{F}', free ? word : '').replace(/\s+–\s+$/, '');
const withBrand = (t, app) => (t + ' | ' + app).length <= 72 ? t + ' | ' + app : t;

// the shared look of every light page
const CSS = `:root{--ink:#17262a;--muted:#55686b;--accent:#1d6b59;--accent2:#14544a;--soft:#e7f3ef;--rule:#dfe7e5;--bg:#f4f7f6;--card:#fff;--hero1:#0c332d;--hero2:#1d6b59}
@media (prefers-color-scheme:dark){:root{--ink:#e6eeec;--muted:#a3b3b0;--accent:#6fd0b4;--accent2:#8fe0c8;--soft:#1b2c29;--rule:#2b3a38;--bg:#0f1716;--card:#16201f;--hero1:#0a2420;--hero2:#14544a}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Devanagari","Noto Sans Kannada",sans-serif}
a{color:var(--accent)}img{max-width:100%;height:auto}
.wrap{max-width:1080px;margin:0 auto;padding:0 18px}
header.top{background:linear-gradient(120deg,var(--hero1),var(--hero2));color:#fff}
header.top .wrap{display:flex;align-items:center;gap:14px;min-height:60px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:700;font-size:1.05rem;margin-right:auto}
.brand img{width:36px;height:36px;border-radius:9px}
.tnav{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.tnav a{color:#fff;text-decoration:none;font-size:.92rem;padding:6px 10px;border-radius:9px}
.tnav a:hover{background:rgba(255,255,255,.14)}
.tnav a.si{border:1px solid rgba(255,255,255,.35);padding:5px 14px;border-radius:99px;font-weight:600}
.hero{padding:26px 0 8px}
.crumbs{font-size:.84rem;color:var(--muted);margin:0 0 10px}.crumbs a{color:var(--muted)}
h1{font-size:clamp(1.7rem,4.5vw,2.6rem);line-height:1.15;margin:0 0 8px;letter-spacing:-.02em}
.lead{font-size:clamp(1rem,2.2vw,1.18rem);color:var(--muted);margin:0 0 20px;max-width:760px}
.dz{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;border:2px dashed var(--accent);border-radius:20px;background:var(--card);padding:clamp(26px,6vw,52px) 18px;cursor:pointer;transition:background .15s}
.dz:hover,.dz.over{background:var(--soft)}
.dz .btn{display:inline-flex;align-items:center;gap:10px;background:var(--accent);color:#fff;border:0;border-radius:14px;padding:15px 28px;font:600 1.08rem/1 inherit;cursor:pointer;box-shadow:0 6px 18px rgba(20,84,74,.25)}
@media (prefers-color-scheme:dark){.dz .btn{color:#06201b}}
.dz .btn svg{width:22px;height:22px}
.dz small{color:var(--muted);font-size:.9rem}
.dz.busy{pointer-events:none;opacity:.8}
.badges{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;margin:14px 0 0;padding:0;list-style:none;font-size:.88rem;color:var(--muted)}
.badges li::before{content:"✓ ";color:var(--accent);font-weight:700}
.lnote{text-align:center;font-size:.84rem;color:var(--muted);margin:8px 0 0}
.langs{font-size:.88rem;margin:0 0 10px}.langs a,.langs b{margin-right:14px}
main section,main article{margin:30px 0}
.card{background:var(--card);border:1px solid var(--rule);border-radius:16px;padding:clamp(18px,3.5vw,32px)}
h2{font-size:clamp(1.25rem,3vw,1.55rem);margin:0 0 10px;letter-spacing:-.01em}h3{font-size:1.05rem;margin:0 0 4px}
.steps{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:12px}
.steps li{counter-increment:s;position:relative;padding:2px 0 2px 46px}
.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:32px;height:32px;border-radius:50%;background:var(--soft);color:var(--accent);font-weight:700;display:grid;place-items:center}
.feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:0;padding:0;list-style:none}
.feats li{background:var(--soft);border-radius:12px;padding:14px 16px}.feats p{margin:0;color:var(--muted);font-size:.94rem}
details{border-bottom:1px solid var(--rule);padding:12px 0}details:last-child{border-bottom:0}
summary{cursor:pointer;font-weight:600;list-style-position:outside}details p{margin:8px 0 0;color:var(--muted)}
.tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin:0;padding:0;list-style:none}
.tools a{display:block;height:100%;background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--ink)}
.tools a:hover{border-color:var(--accent)}.tools b{display:block;color:var(--accent)}.tools span{font-size:.88rem;color:var(--muted)}
.grp{margin:0 0 26px}.grp h2{font-size:1.15rem}
.ad{min-height:100px;margin:26px 0}.ad .lbl{display:block;font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 4px}
footer.foot{border-top:1px solid var(--rule);margin-top:40px;padding:28px 0 36px;font-size:.88rem;color:var(--muted)}
.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:18px}
.fgrid b{display:block;color:var(--ink);margin:0 0 6px}.fgrid a{display:block;color:var(--muted);text-decoration:none;padding:2px 0}.fgrid a:hover{color:var(--accent)}
.legal{display:flex;flex-wrap:wrap;gap:6px 16px;margin:22px 0 0}.legal a{color:var(--muted)}
@media (max-width:560px){.tnav a.hide-s{display:none}.brand span{font-size:.98rem}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>';

// small script: pick or drop files, hand them to the app (kept in this browser), open the app in the tool.
// The app starts downloading as soon as the visitor reaches for a file, so it is ready by the time they choose.
const SCRIPT = (tool, opts) => `(function(){var T=${JSON.stringify(tool)},O=${JSON.stringify(opts || null)},dz=document.getElementById('dz'),inp=document.getElementById('lf'),st=document.getElementById('dzst'),pre=0;
function prefetch(){if(pre)return;pre=1;var c=navigator.connection;if(c&&(c.saveData||/2g/.test(c.effectiveType||'')))return;var l=document.createElement('link');l.rel='prefetch';l.href='/app';document.head.appendChild(l)}
function open(){location.href='/app#'+T}
function go(fs){if(!fs||!fs.length)return;dz.classList.add('busy');if(st)st.textContent=st.getAttribute('data-l');
if(!('caches' in window)){open();return}
caches.open('pt-handoff').then(function(c){return c.keys().then(function(ks){return Promise.all(ks.map(function(k){return c.delete(k)}))}).then(function(){return Promise.all([].map.call(fs,function(f,i){return c.put('/handoff/'+i,new Response(f,{headers:{'content-type':f.type||'application/octet-stream','x-name':encodeURIComponent(f.name),'x-order':String(i)}}))}))})}).then(function(){try{sessionStorage.setItem('pt-handoff','1');sessionStorage.setItem('pt-handoff-opts',O?JSON.stringify(O):'')}catch(e){}open()},open)}
['pointerdown','focusin','dragenter','touchstart'].forEach(function(e){dz.addEventListener(e,prefetch,{passive:true})});
dz.addEventListener('click',function(e){if(e.target!==inp)inp.click()});
dz.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}});
['dragenter','dragover'].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add('over')})});
['dragleave','dragend'].forEach(function(t){dz.addEventListener(t,function(){dz.classList.remove('over')})});
dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('over');go(e.dataTransfer.files)});
inp.addEventListener('change',function(){go(inp.files)});
window.addEventListener('pageshow',function(e){if(e.persisted){dz.classList.remove('busy');if(st)st.textContent=''}})})();`;

function shell({ lang = 'en', title, desc, canonical, alternates = [], origin, appName, head = '', body, nonce, ads, robots, scriptTool, scriptOpts }) {
  const img = origin + '/icons/og-image.png';
  const alt = alternates.map(a => `<link rel="alternate" hreflang="${a[0]}" href="${esc(a[1])}">`).join('\n');
  const adsHead = ads && ads.client ? `\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ads.client)}" crossorigin="anonymous" nonce="${nonce}"></script>` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${robots ? `<meta name="robots" content="${robots}">` : ''}${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
${alt}
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(appName)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(appName)} logo">
<meta property="og:locale" content="${lang === 'hi' ? 'hi_IN' : lang === 'kn' ? 'kn_IN' : 'en_IN'}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#145447">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/icons/icon-192.png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">${head}${adsHead}
<style>${CSS}</style>
</head>
<body>
${body}
${scriptTool ? `<script nonce="${nonce}">${SCRIPT(scriptTool, scriptOpts)}</script>` : ''}${ads && ads.client && ads.slot ? `\n<script nonce="${nonce}">try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch(e){}</script>` : ''}
</body>
</html>`;
}

const topBar = (appName, u) => `<header class="top"><div class="wrap"><a class="brand" href="${u.home}"><img src="/icons/icon-64.png" alt="" width="36" height="36"><span>${esc(appName)}</span></a>
<nav class="tnav" aria-label="Main"><a href="/tools">${esc(u.tools)}</a><a href="/app#reader" class="hide-s">${esc(u.reader)}</a><a href="/app?signin=1" class="si">${esc(u.signin)}</a></nav></div></header>`;

function footer(appName) {
  const cols = GROUPS.map(([g, list]) => `<div><b>${esc(g)}</b>${list.map(s => `<a href="/${s}">${esc(BY_SLUG.get(s)[2])}</a>`).join('')}</div>`).join('');
  return `<footer class="foot"><div class="wrap"><nav class="fgrid" aria-label="All tools">${cols}</nav>
<nav class="legal" aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/licence">Licence</a><a href="/refund-policy">Refunds</a><a href="/cookies">Cookies</a><a href="/disclaimer">Disclaimer</a><a href="/contact">Contact</a></nav>
<p>© ${new Date().getFullYear()} ${esc(COMPANY ? COMPANY.name : appName)}.${COMPANY ? ` <a href="${esc(COMPANY.url)}">More apps from ${esc(COMPANY.name)}</a>.` : ''} Your files are processed on your own device and never uploaded.</p></div></footer>`;
}

const adBlock = ads => ads && ads.client && ads.slot ? `<aside class="ad" aria-label="Advertisement"><span class="lbl">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ads.client)}" data-ad-slot="${esc(ads.slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>` : '';

const EN_UI = { home: '/', tools: 'All tools', reader: 'PDF Reader', signin: 'Sign in' };

/** The page for one tool, in English or (where written) Hindi / Kannada. */
function landing(slug, lang, { appName, origin, free, nonce, ads }) {
  const p = BY_SLUG.get(slug); if (!p) return null;
  const [, tool, name] = p, en = C[slug];
  const tr = lang !== 'en' ? I18N.T[lang] && I18N.T[lang][slug] : null;
  if (lang !== 'en' && !tr) return null;
  const u = lang === 'en' ? null : I18N.UI[lang];
  const t = tr || en;
  const url = origin + (lang === 'en' ? '' : '/' + lang) + '/' + slug;
  const langs = ['en', ...I18N.LANGS.filter(l => I18N.T[l][slug])];
  const alternates = langs.length > 1 ? [...langs.map(l => [l, origin + (l === 'en' ? '' : '/' + l) + '/' + slug]), ['x-default', origin + '/' + slug]] : [];
  const title = withBrand(fill(t.title, free, u ? u.free : ' Free'), appName);
  const desc = t.desc + (lang === 'en' && free && !/free/i.test(t.desc) ? ' Free.' : '');
  const h1 = tr ? tr.h1 : name;
  const acc = accepts(tool);
  const how = u ? u.how : `How to ${name.replace(/^(\w)/, c => c.toLowerCase()).replace(/^pdf/, 'PDF')}`;
  const steps = t.steps, faq = [...t.faq, ...(u ? u.gfaq : [[`Is ${appName} safe for confidential files?`, 'Yes. Files are opened and processed on your own computer or phone and are never uploaded to our server. Only e-Sign sends a short fingerprint of the document, never the document itself.'], [`Does ${name} work on my phone?`, `Yes. ${appName} works in Chrome, Safari, Edge and Firefox on Android, iPhone, Windows and Mac. You can also install it like an app.`]])];
  const rel = (en.rel || []).filter(s => BY_SLUG.has(s));
  const chooseLabel = u ? u.choose : `Choose ${acc.kind}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'SoftwareApplication', '@id': url + '#app', name: `${h1} – ${appName}`, url, description: desc, applicationCategory: 'BusinessApplication', applicationSubCategory: 'PDF software', operatingSystem: 'Web browser, Windows, macOS, Android, iOS', inLanguage: lang, image: origin + '/icons/logo-512.png', publisher: { '@id': orgId(origin) }, ...(free ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' } } : {}) },
      { '@type': 'HowTo', name: how, inLanguage: lang, step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) },
      { '@type': 'FAQPage', inLanguage: lang, mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: appName, item: origin + '/' }, { '@type': 'ListItem', position: 2, name: 'All tools', item: origin + '/tools' }, { '@type': 'ListItem', position: 3, name: h1, item: url }] },
      org(origin, appName)
    ]
  };
  const langLinks = langs.length > 1 ? `<p class="langs">${langs.map(l => l === lang ? `<b>${l === 'en' ? 'English' : I18N.UI[l].name}</b>` : `<a href="${l === 'en' ? '' : '/' + l}/${slug}" hreflang="${l}" lang="${l}">${l === 'en' ? 'English' : I18N.UI[l].name}</a>`).join('')}</p>` : '';
  const badges = u ? u.badges : ['Files stay on your device', free ? 'Free, no sign-up' : 'No upload', 'Computer & phone'];
  const body = `${topBar(appName, { ...EN_UI, ...(u ? { tools: u.tools, reader: 'PDF Reader', signin: 'Sign in' } : {}) })}
<main class="wrap">
<div class="hero">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">${esc(u ? u.home : 'Home')}</a> › <a href="/tools">${esc(u ? u.tools : 'All tools')}</a> › <span>${esc(h1)}</span></nav>
${langLinks}<h1>${esc(h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<div class="dz" id="dz" role="button" tabindex="0" aria-label="${esc(chooseLabel)}">
<span class="btn">${UPLOAD_ICON}${esc(chooseLabel)}</span>
<small>${esc(u ? u.drop : 'or drop files here')}</small><small id="dzst" data-l="${esc(u ? u.loading : 'Opening…')}" aria-live="polite"></small>
<input type="file" id="lf" accept="${esc(acc.accept)}"${acc.multi ? ' multiple' : ''} hidden>
</div>
<ul class="badges">${badges.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
${u ? `<p class="lnote">${esc(u.note)}</p>` : ''}
</div>
${adBlock(ads)}
<article class="card">
${t.intro.map(x => `<p>${esc(x)}</p>`).join('\n')}
<h2>${esc(how)}</h2>
<ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
</article>
${!tr ? `<section><h2>Features</h2><ul class="feats">${en.feats.map(([a, b]) => `<li><h3>${esc(a)}</h3><p>${esc(b)}</p></li>`).join('')}</ul></section>
<section class="card"><h2>Private by design</h2><p>Most online PDF sites upload your file to their server. ${esc(appName)} opens and processes it inside your own browser, on your computer or phone, so salary slips, bank statements, Aadhaar and PAN copies, and contracts never leave your device. It works on Windows, Mac, Android and iPhone, and you can install it like an app to open PDFs with a double-click.</p></section>` : `<section class="card"><h2>${esc(u.privacyH)}</h2><p>${esc(u.privacy)}</p></section>`}
<section class="card"><h2>${esc(u ? u.faq : 'Questions')}</h2>${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
<section><h2>${esc(u ? u.more : 'Related tools')}</h2><ul class="tools">${rel.map(s => { const r = BY_SLUG.get(s); const has = lang !== 'en' && I18N.T[lang][s]; return `<li><a href="${has ? '/' + lang : ''}/${s}"><b>${esc(has ? I18N.T[lang][s].h1 : r[2])}</b><span>${esc(has ? I18N.T[lang][s].lead : r[3])}</span></a></li>` }).join('')}</ul></section>
</main>
${footer(appName)}`;
  return shell({ lang, title, desc, canonical: url, alternates, origin, appName, head: '\n' + ld(graph), body, nonce, ads, scriptTool: tool, scriptOpts: PAGE_OPTS[slug] });
}

/** The home page: open a PDF straight away, or pick a tool. */
function home({ appName, origin, free, nonce, ads }) {
  const title = `${appName} – ${free ? 'Free ' : ''}PDF Editor, Converter, Compressor & e-Sign`;
  const desc = `${free ? 'Free online' : 'Online'} PDF tools: edit, compress, merge, split, sign (e-Sign and DSC) and convert PDF to Word, Excel and JPG. Works on computer and phone. Files stay on your device.`;
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': origin + '/#site', name: appName, alternateName: altNames(appName), url: origin + '/', inLanguage: 'en', publisher: { '@id': orgId(origin) } },
    org(origin, appName),
    { '@type': 'SoftwareApplication', name: appName, alternateName: altNames(appName), url: origin + '/', description: desc, applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser, Windows, macOS, Android, iOS', image: origin + '/icons/logo-512.png', ...(free ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' } } : {}) }
  ] };
  const body = `${topBar(appName, EN_UI)}
<main class="wrap">
<div class="hero">
<h1>${esc(appName)}: every PDF tool you need, private and ${free ? 'free' : 'fast'}</h1>
<p class="lead">Read, edit, sign, compress, merge and convert PDFs in your browser or on your phone. Your files are processed on your own device and never uploaded.</p>
<div class="dz" id="dz" role="button" tabindex="0" aria-label="Open a PDF">
<span class="btn">${UPLOAD_ICON}Open a PDF</span>
<small>or drop a PDF here to read, edit and sign it</small><small id="dzst" data-l="Opening…" aria-live="polite"></small>
<input type="file" id="lf" accept=".pdf,application/pdf" hidden>
</div>
<ul class="badges"><li>Files stay on your device</li><li>${free ? 'Free, no sign-up' : 'No upload'}</li><li>45+ tools</li><li>e-Sign and DSC signing</li></ul>
</div>
${adBlock(ads)}
<section><h2>Most popular</h2><ul class="tools">${POPULAR.map(s => { const r = BY_SLUG.get(s); return `<li><a href="/${s}"><b>${esc(r[2])}</b><span>${esc(r[3])}</span></a></li>` }).join('')}</ul></section>
<section class="card"><h2>Why ${esc(appName)}?</h2><ul class="feats">
<li><h3>Private</h3><p>Files are processed in your browser and never uploaded, so bank statements, IDs and contracts stay with you.</p></li>
<li><h3>Complete</h3><p>45+ tools: edit text, fill forms, sign, compress to 100 KB, convert bank statements to Excel, OCR scans and more.</p></li>
<li><h3>Legal signatures</h3><p>e-Sign with a certified, tamper-evident signature, or sign with your Class 3 DSC for GST, MCA and tenders.</p></li>
<li><h3>Everywhere</h3><p>Windows, Mac, Android and iPhone. Install it like an app and open PDFs with a double-click.</p></li></ul></section>
<p style="text-align:center;margin:26px 0"><a href="/tools"><b>See all 45+ PDF tools →</b></a></p>
</main>
${footer(appName)}`;
  return shell({ title, desc, canonical: origin + '/', origin, appName, head: '\n' + ld(graph), body, nonce, ads, scriptTool: 'reader' });
}

/** All tools, grouped. */
function toolsHub({ appName, origin, free, nonce, ads }) {
  const title = withBrand(`All PDF Tools${free ? ' – Free Online' : ' Online'}`, appName);
  const desc = `All 45+ PDF tools in one place: edit, sign, merge, split, compress, convert to and from Word, Excel and JPG, protect and more.`;
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'All PDF tools', url: origin + '/tools', description: desc },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: appName, item: origin + '/' }, { '@type': 'ListItem', position: 2, name: 'All tools', item: origin + '/tools' }] },
    { '@type': 'ItemList', itemListElement: PAGES.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: origin + '/' + p[0], name: p[2] })) }
  ] };
  const body = `${topBar(appName, EN_UI)}
<main class="wrap"><div class="hero"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>All tools</span></nav><h1>All PDF tools</h1><p class="lead">${esc(desc)}</p></div>
${adBlock(ads)}
${GROUPS.map(([g, list]) => `<section class="grp"><h2>${esc(g)}</h2><ul class="tools">${list.map(s => { const r = BY_SLUG.get(s); return `<li><a href="/${s}"><b>${esc(r[2])}</b><span>${esc(r[3])}</span></a></li>` }).join('')}</ul></section>`).join('\n')}
</main>
${footer(appName)}`;
  return shell({ title, desc, canonical: origin + '/tools', origin, appName, head: '\n' + ld(graph), body, nonce, ads });
}

/** A friendly "page not found" (sent with status 404, not indexed). */
function notFound({ appName, origin, nonce }) {
  const body = `${topBar(appName, EN_UI)}
<main class="wrap"><div class="hero"><h1>Page not found</h1><p class="lead">That address doesn’t exist. It may have been mistyped or moved. Try one of these popular tools, or see <a href="/tools">all PDF tools</a>.</p></div>
<ul class="tools">${POPULAR.map(s => { const r = BY_SLUG.get(s); return `<li><a href="/${s}"><b>${esc(r[2])}</b><span>${esc(r[3])}</span></a></li>` }).join('')}</ul></main>
${footer(appName)}`;
  return shell({ title: `Page not found | ${appName}`, desc: 'This page does not exist.', origin, appName, body, nonce, robots: 'noindex' });
}

// the app at /app: title only (it is not a search page; the light pages are)
function appHead({ appName }) {
  return { head: `<title>${esc(appName)} · PDF Reader, Editor, e-Sign &amp; Converter</title>\n<meta name="robots" content="noindex">\n<link rel="canonical" href="/">`, section: '' };
}

function sitemap(origin, extra = []) {
  const alt = slug => {
    const langs = ['en', ...I18N.LANGS.filter(l => I18N.T[l][slug])];
    if (langs.length < 2) return '';
    return langs.map(l => `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(origin + (l === 'en' ? '' : '/' + l) + '/' + slug)}"/>`).join('') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(origin + '/' + slug)}"/>`;
  };
  const url = (loc, pr, slug) => `  <url><loc>${esc(origin + loc)}</loc><lastmod>${UPDATED}</lastmod><priority>${pr}</priority>${slug ? alt(slug) : ''}</url>`;
  const rows = [...PAGES.map(p => url('/' + p[0], POPULAR.includes(p[0]) ? '0.9' : '0.8', p[0])),
    ...I18N.LANGS.flatMap(l => Object.keys(I18N.T[l]).map(s => url(`/${l}/${s}`, '0.7', s))), ...extra.map(u => url(u, '0.3'))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`;
}

module.exports = { PAGES, BY_SLUG, GROUPS, landing, home, toolsHub, notFound, appHead, sitemap, UPDATED, LANGS: I18N.LANGS, hasLang: (l, s) => !!(I18N.T[l] && I18N.T[l][s]) };
