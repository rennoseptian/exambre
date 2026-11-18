/* ── Pembaruan APK ──
   Hanya berjalan di aplikasi Android (Capacitor). Membaca rilis terbaru "apk-latest" dari GitHub,
   membandingkan nomor build dengan versionCode aplikasi ini, lalu menawarkan unduhan lewat halaman download.
   Versi web/PWA tidak terpengaruh: ia memperbarui diri lewat service worker. */
const UPD_REPO='rennoseptian/exambre';
const UPD_API='https://api.github.com/repos/'+UPD_REPO+'/releases/latest';
const UPD_FALLBACK_PAGE='https://rennoseptian.github.io/exambre/download/';
const UPD_THROTTLE=6*3600*1000;   /* cek otomatis paling sering sekali per 6 jam */
const UPD_SNOOZE=24*3600*1000;    /* "Nanti" = ingatkan lagi setelah 24 jam */

function isNativeApp(){const C=window.Capacitor;return !!(C&&C.isNativePlatform&&C.isNativePlatform());}
async function getLocalBuild(){
  try{
    const App=window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
    if(App&&App.getInfo){const i=await App.getInfo();return{build:parseInt(i.build,10)||0,version:i.version||''};}
  }catch(e){}
  return null;
}
function parseRelease(rel){
  const body=String(rel&&rel.body||'');
  const g=re=>{const m=body.match(re);return m?m[1]:null;};
  const build=parseInt(g(/^build:\s*(\d+)/m),10);
  if(!build)return null;
  const page=g(/^page:\s*(\S+)/m);
  return{build,version:g(/^version:\s*(\S+)/m)||('1.0.'+build),
    page:page&&/^https:\/\//.test(page)?page:UPD_FALLBACK_PAGE,
    notes:body.replace(/^(build|version|page|commit):.*$/mg,'').trim()};
}
async function fetchLatestRelease(){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),8000);
  try{
    const r=await fetch(UPD_API,{headers:{Accept:'application/vnd.github+json'},cache:'no-store',signal:ctl.signal});
    if(!r.ok)return null;
    return parseRelease(await r.json());
  }catch(e){return null;}
  finally{clearTimeout(t);}
}
async function checkForUpdate(manual){
  if(!isNativeApp()){if(manual)showToast('Versi web selalu terbaru. Cek pembaruan hanya untuk aplikasi Android.');return;}
  if(navigator.onLine===false){if(manual)showToast('Tidak ada koneksi internet','error');return;}
  if(!manual){
    const last=+localStorage.getItem('exambre_upd_last')||0;
    if(Date.now()-last<UPD_THROTTLE)return;
  }
  const local=await getLocalBuild();
  if(!local||!local.build){if(manual)showToast('Versi aplikasi tidak terbaca','error');return;}
  localStorage.setItem('exambre_upd_last',String(Date.now()));
  const rem=await fetchLatestRelease();
  if(!rem){if(manual)showToast('Gagal memeriksa pembaruan. Coba lagi nanti.','error');return;}
  if(rem.build<=local.build){if(manual)showToast('Kamu sudah memakai versi terbaru (v'+(local.version||rem.version)+')','success');return;}
  if(!manual){
    let s=null;try{s=JSON.parse(localStorage.getItem('exambre_upd_snooze')||'null');}catch(e){}
    if(s&&s.build===rem.build&&Date.now()<s.until)return;
  }
  showWhenIdle(rem,local,12);
}
/* Tunda selama ada dialog terbuka (mis. onboarding) supaya kartu tidak tertutup atau mengganggu */
function showWhenIdle(rem,local,tries){
  if(!document.querySelector('.modal-overlay.on')){showUpdateCard(rem,local);return;}
  if(tries>0)setTimeout(()=>showWhenIdle(rem,local,tries-1),5000);
}
function showUpdateCard(rem,local){
  const old=document.getElementById('upd-card');if(old)old.remove();
  const c=document.createElement('div');c.id='upd-card';c.className='upd-card nopr';c.setAttribute('role','dialog');c.setAttribute('aria-label','Pembaruan tersedia');
  const t=document.createElement('b');t.textContent='Versi baru tersedia';
  const p=document.createElement('p');p.textContent='v'+rem.version+(local.version?' \u00b7 kamu memakai v'+local.version:'');
  const row=document.createElement('div');row.className='upd-actions';
  const later=document.createElement('button');later.className='btn btn-s btn-sm';later.textContent='Nanti';later.onclick=()=>snoozeUpdate(rem.build);
  const go=document.createElement('button');go.className='btn btn-p btn-sm';go.innerHTML='<i class="ti ti-download" aria-hidden="true"></i> Perbarui';go.onclick=()=>{openUpdatePage(rem.page);c.remove();};
  row.append(later,go);c.append(t,p);
  if(rem.notes){const n=document.createElement('p');n.className='upd-notes';n.textContent=rem.notes.split('\n')[0].slice(0,120);c.append(n);}
  c.append(row);document.body.appendChild(c);
}
function snoozeUpdate(build){
  localStorage.setItem('exambre_upd_snooze',JSON.stringify({build,until:Date.now()+UPD_SNOOZE}));
  const c=document.getElementById('upd-card');if(c)c.remove();
}
async function openUpdatePage(url){
  try{const B=window.Capacitor.Plugins&&window.Capacitor.Plugins.Browser;if(B&&B.open){await B.open({url});return;}}catch(e){}
  window.open(url,'_blank');
}
async function renderAboutVersion(){
  const el=document.getElementById('about-version'),act=document.getElementById('upd-actions');if(!el)return;
  if(!isNativeApp()){el.textContent='Versi web \u00b7 diperbarui otomatis saat online';return;}
  const l=await getLocalBuild();
  el.textContent=l&&l.version?'Versi aplikasi: v'+l.version:'Versi aplikasi';
  if(act)act.style.display='block';
}
window.addEventListener('load',()=>{
  renderAboutVersion();
  if(!isNativeApp())return;
  setTimeout(()=>checkForUpdate(false),4000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForUpdate(false);});
});
