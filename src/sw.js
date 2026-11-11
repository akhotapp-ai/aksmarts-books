// Service worker: lets the installed app start offline and open PDFs from the desktop.
const CACHE = 'pdftools-__BUILD__';
const CORE = ['/app', '/manifest.webmanifest', '/icons/icon-128.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/logo-256.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pdftools-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // a PDF shared from another app (Android share sheet): keep it for the page, then open the app
  if (e.request.method === 'POST' && u.origin === location.origin && u.pathname === '/share') {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData(); const c = await caches.open('pt-share'); let i = 0;
        for (const f of fd.getAll('pdf')) if (f && f.size) await c.put('/shared/' + Date.now() + '-' + (i++), new Response(f, { headers: { 'content-type': 'application/pdf', 'x-name': encodeURIComponent(f.name || 'shared.pdf') } }));
      } catch (err) {}
      return Response.redirect('/open?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin')) return;
  if (e.request.mode === 'navigate') {
    // try the network first so updates arrive. If it is slow (a sleeping server) and the app is already
    // saved, open the saved copy after 2 s; the network answer still updates the saved copy for next time.
    const app = u.pathname === '/app' || u.pathname === '/open';
    const fresh = u.searchParams.has('fresh');
    let saving = null;
    const done = new Promise(r => saving = r);
    e.waitUntil(done);
    e.respondWith((async () => {
      const c = await caches.open(CACHE), saved = app && !fresh ? await c.match('/app') : null;
      const net = fetch(e.request).then(r => {
        if (r.ok && r.status === 200 && app) {
          const copy = r.clone(), tag = r.headers.get('etag');
          saving(c.match('/app').then(old => (!old || !tag || old.headers.get('etag') !== tag) ? c.put('/app', copy) : null).catch(() => {}));
        } else saving();
        return r;
      });
      net.catch(() => saving());
      if (!saved) return net.catch(() => caches.match('/app')); // offline: any page opens the saved app
      return Promise.race([net.catch(() => saved), new Promise(r => setTimeout(() => r(saved), 2000))]);
    })());
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
