/* AK Smarts Books offline support: keeps the app files on this computer so it opens without internet. Books are never sent anywhere by this file. */
const V='aksbooks-2026.11.01-r7';
const CORE=['./','app','terms','privacy','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','favicon-32.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>(x.startsWith('findesk-')||x.startsWith('aksbooks-'))&&x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
function key(u){return new Request(u.origin+u.pathname)}
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);
 if(u.origin!==location.origin||/updates\.txt$/.test(u.pathname)||/oauth\.html$/.test(u.pathname)||/sw\.js$/.test(u.pathname))return;
 /* Pages: always try the network first so updates show immediately; fall back to the saved copy when offline. */
 if(r.mode==='navigate'){
  e.respondWith(fetch(r).then(res=>{
   if(res&&res.ok&&res.type=='basic'){const cp=res.clone();caches.open(V).then(c=>c.put(key(u),cp))}
   return res;
  }).catch(()=>caches.open(V).then(c=>{
   const p=u.pathname.replace(/\.html$/,'').replace(/\/$/,'');
   const name=(p===''||p==='/index')?'./':(p==='/AK-Smarts-Books'?'app':'.'+p);
   return c.match(name).then(h=>h||c.match('app'))
  })));
  return;
 }
 /* Other files: saved copy first, refreshed quietly in the background. */
 e.respondWith(caches.open(V).then(c=>c.match(r,{ignoreSearch:true}).then(hit=>{
  const net=fetch(r).then(res=>{if(res&&res.ok&&res.type=='basic')c.put(r,res.clone());return res}).catch(()=>hit);
  return hit||net})))
});
