/* AK Smarts Books offline support: keeps the app files on this computer so it opens without internet. Books are never sent anywhere by this file. */
const V='findesk-2026.10.30-d94c52f356';
const CORE=['./','index.html','AK-Smarts-Books.html','oauth.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','favicon-32.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('findesk-')&&x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||/updates\.txt$/.test(u.pathname)||/oauth\.html$/.test(u.pathname))return;
 e.respondWith(caches.open(V).then(c=>c.match(r,{ignoreSearch:true}).then(hit=>{const net=fetch(r).then(res=>{if(res&&res.ok&&res.type=='basic')c.put(r,res.clone());return res}).catch(()=>hit);return hit||net})))});
