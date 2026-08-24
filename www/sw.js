/* Exambre Service Worker — cache-first shell, runtime untuk sisanya.
   Naikkan versi CACHE saat mengubah file inti agar client lama ter-refresh. */
const CACHE='exambre-v4';
const CORE=[
  './index.html','./manifest.json','./assets/app.css',
  './assets/js/01-state.js','./assets/js/02-gamify-data.js','./assets/js/03-notes.js',
  './assets/js/04-srs-toast.js','./assets/js/06-media.js','./assets/js/07-categories.js',
  './assets/js/08-theme-io.js','./assets/js/09-image-inputs.js','./assets/js/10-render-edit.js',
  './assets/js/11-panel-forms.js','./assets/js/12-card-actions.js','./assets/js/13-review.js',
  './assets/js/14-simulation.js','./assets/js/15-stats.js','./assets/js/16-ai.js','./assets/js/17-main.js',
  './assets/fonts/inter-400.woff2','./assets/fonts/inter-500.woff2','./assets/fonts/inter-500italic.woff2',
  './assets/fonts/inter-600.woff2','./assets/fonts/inter-700.woff2','./assets/fonts/inter-800.woff2',
  './assets/icons/tabler-icons.min.css',
  './assets/icon/icon-32.png','./assets/icon/icon-192.png','./assets/icon/icon-512.png',
  './assets/sfx/correct.wav','./assets/sfx/wrong.wav','./assets/sfx/mastered.wav',
  './assets/sfx/badge.wav','./assets/sfx/session.wav','./assets/sfx/tap.wav'
];
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>Promise.allSettled(CORE.map(u=>c.add(u)))).then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin)return; /* API AI & CDN lewat jaringan */
  e.respondWith(
    caches.match(e.request).then(hit=>{
      const net=fetch(e.request).then(res=>{
        if(res&&res.status===200){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}
        return res;
      }).catch(()=>hit);
      return hit||net;
    })
  );
});
