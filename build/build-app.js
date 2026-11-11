// Builds public/app.html from the original single-file PDF Tools app plus the Pro add-on.
// Usage: npm run build
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');
let html = rd('original/PDF-Tools.html');
const forgeJs = rd('node_modules/node-forge/dist/forge.min.js');
// needed by the font library to shape Hindi / Kannada letters (MIT licence)
const regenJs = rd('node_modules/regenerator-runtime/runtime.js');
const EXT = ['src/compress.js', 'src/textremove.js', 'src/textedit.js', 'src/rename.js', 'src/newtools.js', 'src/ribbon.js'];
const addonJs = rd('server/cms.js') + '\n' + EXT.map(rd).join('\n') + '\n' + rd('src/addon.js');
const must = (cond, what) => { if (!cond) throw new Error('build: could not find ' + what); };
const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
for (const [n, s] of [['forge', forgeJs], ['regen', regenJs], ['addon', addonJs]]) must(!/<\/script/i.test(s), 'safe ' + n + ' (contains </script)');

// sanity: our hashing matches the hashes already in the page
const mainStart = html.lastIndexOf('<script>'), mainEnd = html.indexOf('</script>', mainStart);
must(mainStart > 0 && mainEnd > mainStart, 'main script');
const cspM = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
must(cspM, 'CSP meta');
must(cspM[1].includes(sha(html.slice(mainStart + 8, mainEnd))), 'matching main-script hash (hash method differs)');

// 0. small fixes inside the main app script (its CSP hash is updated to match)
{
  const a = html.lastIndexOf('<script>') + 8, b = html.indexOf('</script>', a);
  let main = html.slice(a, b);
  const oldHash = sha(main);
  const patch = (from, to, what) => { must(main.includes(from), 'main-script patch: ' + what); main = main.replace(from, to); };
  // Edit text: cover the old words with the page's own background (colour or a matching patch), not white
  patch(`if(o.cover)s+=\`<rect x="\${o.cover[0]}" y="\${o.cover[1]}" width="\${o.cover[2]}" height="\${o.cover[3]}" fill="#fff"/>\`;`,
    `if(o.cover)s+=o.bgImg?\`<image href="\${o.bgImg}" x="\${o.cover[0]}" y="\${o.cover[1]}" width="\${o.cover[2]}" height="\${o.cover[3]}" preserveAspectRatio="none"/>\`:\`<rect x="\${o.cover[0]}" y="\${o.cover[1]}" width="\${o.cover[2]}" height="\${o.cover[3]}" fill="\${o.bg||'#fff'}"/>\`;`, 'edit-text cover on screen');
  patch(`if(o.cover)out.push(\`1 1 1 rg \${N(o.cover[0])} \${N(o.cover[1])} \${N(o.cover[2])} \${N(o.cover[3])} re f\`);`,
    `if(o.cover){const bi=o.bgImg&&R[o.id+':bg'];if(bi)out.push('q',\`\${N(o.cover[2])} 0 0 \${N(-o.cover[3])} \${N(o.cover[0])} \${N(o.cover[1]+o.cover[3])} cm /\${ops.img(bi)} Do Q\`);else out.push(\`\${rgbs(o.bg||'#fff')} rg \${N(o.cover[0])} \${N(o.cover[1])} \${N(o.cover[2])} \${N(o.cover[3])} re f\`)}`, 'edit-text cover when saving');
  patch(`if(o.t==='text'&&!R[o.id])R[o.id]=await fontFor(`,
    `if(o.t==='text'&&o.bgImg&&!R[o.id+':bg'])R[o.id+':bg']=await embedDataUrl(doc,o.bgImg);\n  if(o.t==='text'&&!R[o.id])R[o.id]=await fontFor(`, 'edit-text cover image');
  // results stay in the app: a finished tool shows its result with Download / Open buttons instead of
  // downloading straight away (a download can make the browser open the file in another PDF app)
  patch("try{await saveBlob(name,blob)}catch(e){if(e&&e.code==='declined'){setMsg('gmsg','Download cancelled. Use “Download again” when you’re ready.','warn')}else throw e}", "if(typeof ptResultReady==='function')ptResultReady(name,blob);", 'no automatic download after a tool');
  main = main.split(' Check your Downloads folder.').join('');
  // no other product names in the help text
  patch('so they also show up in Adobe Reader and other apps.', 'so they also show up in other PDF readers.', 'annotate help text');
  html = html.slice(0, a) + main + html.slice(b);
  must(html.includes(oldHash), 'main-script hash in CSP');
  const newHash = sha(main);
  html = html.replace(oldHash, newHash);
  cspM[0] = cspM[0].replace(oldHash, newHash); cspM[1] = cspM[1].replace(oldHash, newHash);
}

// result card: clearer buttons
html = html.replace(/(<button class="btn2" id="gview" type="button" hidden>[\s\S]*?<\/svg>)Open in Reader/, '$1Open in AK Smarts PDF');
html = html.replace(/<button class="btn2" id="gagain" type="button">([\s\S]*?<\/svg>)Download again/, '<button class="btn" id="gagain" type="button">$1Download');
must(html.includes('Open in AK Smarts PDF') && html.includes('id="gagain" type="button">'), 'result buttons');

// 1. CSP: allow our own server for API calls, the manifest, the service worker and icons
let csp = cspM[1]
  .replace("blob: 'wasm-unsafe-eval'", `${sha(forgeJs)} ${sha(regenJs)} ${sha(addonJs)} blob: 'wasm-unsafe-eval'`)
  .replace('worker-src blob:', "worker-src blob: 'self'")
  .replace('img-src data: blob:', "img-src data: blob: 'self'")
  .replace('connect-src data: blob:', "connect-src data: blob: 'self'")
  .replace("manifest-src 'none'", "manifest-src 'self'");
must(csp.includes(sha(addonJs)) && csp.includes("manifest-src 'self'") && csp.includes("connect-src data: blob: 'self'"), 'CSP parts');
html = html.replace(cspM[0], `<meta http-equiv="Content-Security-Policy" content="${csp}">`);

// 2. head: title, manifest, styles
html = html.replace(/<title>[^<]*<\/title>/, '<title>AK Smarts PDF · Reader, Editor, e-Sign &amp; Converter</title>');
html = html.replace('<meta name="theme-color" content="#145447">', '<meta name="theme-color" content="#145447">\n<meta name="pt-token-key" content="__PT_TOKEN_KEY__">\n<link rel="manifest" href="/manifest.webmanifest">\n<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="AK Smarts PDF">\n<meta name="application-name" content="AK Smarts PDF">');
// app icon: favicon and the header logo use the AK Smarts icon
html = html.replace(/<link rel="icon" href="data:image\/svg\+xml[^"]*">/, '<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" href="/icons/icon-192.png">');
must(html.includes('href="/favicon.ico"'), 'favicon');
html = html.replace(/(<a class="brand" href="#" aria-label=")PDF Tools(, home">)<svg[\s\S]*?<\/svg>/, '$1AK Smarts PDF$2<img class="brand-icon" src="/icons/icon-128.png" alt="" width="36" height="36">');
must(html.includes('class="brand-icon"'), 'header logo');
html = html.replace('<div><b>PDF Tools</b>', '<div><b>AK Smarts PDF</b>');
must(html.includes('rel="manifest"'), 'theme-color meta');
html = html.replace('</head>', `<style>\n${rd('src/addon.css')}\n</style>\n</head>`);

// 3. body: start behind the log-in screen, add the new markup
must(html.includes('<body>'), '<body>');
html = html.replace('<body>', '<body class="gated booting">');
must(html.includes('<div id="toast"'), 'toast');
html = html.replace('<div id="toast"', rd('src/addon-body.html') + '\n<div id="toast"');

// 4. scripts: node-forge (loaded on demand like the other libraries) and the add-on, after the main script
// mark the main app script so the server can encrypt it (an id doesn't change the script's hash)
const ms = html.lastIndexOf('<script>');
html = html.slice(0, ms) + '<script id="pt-main">' + html.slice(ms + 8);
const end = html.lastIndexOf('</script>') + '</script>'.length;
// fonts for writing Hindi (Devanagari) and Kannada text into PDFs (SIL Open Font License, see src/fonts)
const b64 = p => fs.readFileSync(path.join(root, p)).toString('base64');
const fontTags = `\n<script type="application/octet-stream" id="bin-deva">${b64('src/fonts/NotoSansDevanagari-Regular.ttf')}</script>\n<script type="application/octet-stream" id="bin-knda">${b64('src/fonts/NotoSansKannada-Regular.ttf')}</script>`;
html = html.slice(0, end) + fontTags + `\n<script type="text/plain" id="lib-regen">${regenJs}</script>\n<script type="text/plain" id="lib-forge">${forgeJs}</script>\n<script>${addonJs}</script>` + html.slice(end);

fs.writeFileSync(path.join(root, 'public', 'app.html'), html);
const build = crypto.createHash('sha256').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(root, 'public', 'sw.js'), rd('src/sw.js').replace('__BUILD__', build));
console.log(`public/app.html written (${(html.length / 1048576).toFixed(1)} MB, build ${build})`);
