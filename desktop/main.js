// AK Smarts PDF desktop app: a window around the hosted app that registers as a PDF handler,
// so double-clicking a PDF (or "Open with → AK Smarts PDF") opens it straight in the Reader.
const { app, BrowserWindow, shell, Menu, dialog, ipcMain, session, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const APP_URL = process.env.PDFTOOLS_URL || cfg.appUrl;
const ORIGIN = new URL(APP_URL).origin;
// the app itself lives at /app (the home page is the website)
const START_URL = new URL(APP_URL).pathname.length > 1 ? APP_URL : ORIGIN + '/app';
const MAX_FILE = 1024 * 1024 * 1024; // 1 GB
let win = null;
let pageReady = false;   // the page has said it can take files
const waiting = [];       // files to hand over once it can

const pdfArgs = argv => argv.slice(1).filter(a => /\.pdf$/i.test(a) && !a.startsWith('-')).map(a => path.resolve(a)).filter(a => { try { return fs.statSync(a).isFile() } catch (e) { return false } });
function flush() {
  if (!win || !pageReady) return;
  while (waiting.length) win.webContents.send('open-file', waiting.shift());
}
function sendFile(p) {
  try {
    const st = fs.statSync(p);
    if (st.size > MAX_FILE) throw new Error('This file is larger than 1 GB.');
    waiting.push({ name: path.basename(p), data: new Uint8Array(fs.readFileSync(p)) });
    flush();
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  } catch (e) { dialog.showErrorBox('Could not open file', String(e.message || e)); }
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  // a second launch (e.g. double-clicking another PDF) passes its file to the open window
  app.on('second-instance', (_e, argv) => {
    pdfArgs(argv).forEach(sendFile);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  const early = [];
  app.on('open-file', (e, p) => { e.preventDefault(); if (app.isReady()) sendFile(p); else early.push(p); }); // macOS

  // the page asks for files once its own code is listening (again after every reload)
  ipcMain.on('pdf-ready', e => { if (win && e.sender === win.webContents) { pageReady = true; flush(); } });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // the app never needs the camera, microphone, location or notifications
    session.fromPartition('persist:pdftools').setPermissionRequestHandler((_wc, perm, cb) => cb(['clipboard-sanitized-write', 'fullscreen', 'fileSystem'].includes(perm)));
    // the window fits the screen: never taller or wider than the usable area, opens maximized the first time,
    // and remembers how you left it (a 1366x768 laptop used to cut off the bottom bar)
    const stateFile = path.join(app.getPath('userData'), 'window.json');
    let st = {}; try { st = JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {} } catch (_) {}
    const wa = screen.getPrimaryDisplay().workAreaSize;
    const fitW = Math.max(820, Math.min(+st.width || 1360, wa.width)), fitH = Math.max(560, Math.min(+st.height || 900, wa.height));
    win = new BrowserWindow({
      width: fitW, height: fitH, minWidth: Math.min(820, wa.width), minHeight: Math.min(560, wa.height), show: false,
      title: 'AK Smarts PDF', icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'), backgroundColor: '#0a47c4',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, partition: 'persist:pdftools' }
    });
    if (st.maximized !== false) win.maximize();
    win.once('ready-to-show', () => win.show());
    win.on('close', () => {
      try {
        const b = win.getNormalBounds();
        fs.writeFileSync(stateFile, JSON.stringify({ width: b.width, height: b.height, maximized: win.isMaximized() }));
      } catch (_) {}
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith(ORIGIN + '/admin')) return { action: 'allow' };
      if (/^https:|^mailto:/.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN + '/') && url !== ORIGIN) { e.preventDefault(); if (/^https:/.test(url)) shell.openExternal(url); } });
    // a new page (or a reload) must say again that it is ready before it gets files
    win.webContents.on('did-start-navigation', (_e, _url, inPage, isMain) => { if (isMain && !inPage) pageReady = false; });
    // saving: always ask where to save, and never open the file in another program afterwards
    win.webContents.session.on('will-download', (_e, item) => {
      item.setSaveDialogOptions({ title: 'Save', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
    });
    win.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
      if (isMain && url && url.startsWith(ORIGIN) && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { reason: String(desc || '') } });
    });
    win.webContents.on('before-input-event', (e, input) => {
      if (input.control && input.key.toLowerCase() === 'r') { win.loadURL(START_URL); e.preventDefault(); }
      if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    });
    const first = pdfArgs(process.argv).concat(early);
    win.loadURL(first.length ? ORIGIN + '/open' : START_URL);
    first.forEach(sendFile);
  });
  app.on('window-all-closed', () => app.quit());
}
