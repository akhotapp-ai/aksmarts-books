// Hands PDFs that Windows/macOS asks us to open over to the web app.
// The page registers a handler; only then does the main process send the files (again after a reload).
const { contextBridge, ipcRenderer } = require('electron');
let handler = null;
const queue = [];
ipcRenderer.on('open-file', (_e, file) => { if (handler) handler(file.name, file.data); else queue.push(file); });
contextBridge.exposeInMainWorld('pdfDesktop', {
  isDesktop: true,
  onOpenFile(cb) {
    if (typeof cb !== 'function') return;
    handler = cb;
    while (queue.length) { const f = queue.shift(); cb(f.name, f.data); }
    ipcRenderer.send('pdf-ready');
  }
});
