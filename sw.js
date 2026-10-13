'use strict';
// Verhoog VERSION bij elke wijziging aan een van de bestanden hieronder.
const VERSION='v5';
const CACHE='takenbord-'+VERSION;
const ASSETS=['./','index.html','app.css','app.js','manifest.webmanifest',
  'icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('takenbord-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const hit=await caches.match(req,{ignoreSearch:true});
    if(hit)return hit;
    try{return await fetch(req)}
    catch(err){
      if(req.mode==='navigate'){const home=await caches.match('index.html');if(home)return home}
      throw err;
    }
  })());
});
