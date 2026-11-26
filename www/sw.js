/* Exambre Service Worker.
   File inti (HTML/CSS/JS/JSON): network-first, jadi versi terbaru selalu tampil saat online;
   cache hanya cadangan saat offline/lambat. Aset berat (font, ikon, suara): cache-first.
   Naikkan versi CACHE saat mengubah file inti agar cache lama dibuang. */
const CACHE='exambre-v76';
const CORE=[
  './index.html','./manifest.json','./assets/app.css',
  './assets/js/01-state.js','./assets/js/02-gamify-data.js','./assets/js/03-notes.js',
  './assets/js/04-srs-toast.js','./assets/js/06-media.js','./assets/js/07-categories.js',
  './assets/js/08-theme-io.js','./assets/js/09-image-inputs.js','./assets/js/10-render-edit.js',
  './assets/js/05-parser.js','./assets/js/11-panel-forms.js','./assets/js/12-card-actions.js','./assets/js/13-review.js',
  './assets/js/14-simulation.js','./assets/js/15-stats.js','./assets/js/16-ai.js','./assets/js/17-main.js','./assets/js/18-update.js','./assets/js/19-splash-fx.js','./assets/js/20-belajar.js','./data/belajar.json',
  './assets/fonts/inter-400.woff2','./assets/fonts/inter-500.woff2','./assets/fonts/inter-500italic.woff2',
  './assets/fonts/inter-600.woff2','./assets/fonts/inter-700.woff2','./assets/fonts/inter-800.woff2',
  './assets/fonts/ibmplexsans-400.woff2','./assets/fonts/ibmplexsans-500.woff2','./assets/fonts/ibmplexsans-600.woff2',
  './assets/fonts/ibmplexmono-400.woff2','./assets/fonts/ibmplexmono-500.woff2',
  './assets/icons/tabler-icons.min.css',
  './assets/exambre-logo.webp','./assets/icon/icon-32.png','./assets/icon/icon-192.png','./assets/icon/icon-512.png',
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
const FRESH=/\.(?:html|css|js|json)$/i;
function isFresh(req,url){return req.mode==='navigate'||url.pathname.endsWith('/')||FRESH.test(url.pathname);}
async function networkFirst(req){
  const c=await caches.open(CACHE);
  try{
    /* cache:'no-cache' = selalu validasi ke server, abaikan cache HTTP (mis. max-age GitHub Pages) */
    const res=await Promise.race([
      fetch(req,{cache:'no-cache'}),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),4000))
    ]);
    if(res&&res.status===200)c.put(req,res.clone());
    return res;
  }catch(_){
    const hit=await c.match(req,{ignoreSearch:true});
    if(hit)return hit;
    if(req.mode==='navigate'){const idx=await c.match('./index.html');if(idx)return idx;}
    return Response.error();
  }
}
async function cacheFirst(req){
  const c=await caches.open(CACHE);
  const hit=await c.match(req);
  if(hit)return hit;
  const res=await fetch(req);
  if(res&&res.status===200)c.put(req,res.clone());
  return res;
}
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin)return; /* API AI & CDN lewat jaringan */
  e.respondWith(isFresh(e.request,url)?networkFirst(e.request):cacheFirst(e.request));
});
