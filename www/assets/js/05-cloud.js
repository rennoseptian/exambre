/* ── CLOUD SYNC (Firebase) ──
   Ganti backup JSON manual. Soal disimpan satu-per-satu sebagai dokumen Firestore
   (biar gak kena limit ukuran 1MB/dokumen), dan semua gambar diupload ke Firebase
   Storage (bukan base64 lagi) — ini sekaligus mengatasi localStorage yang gampang penuh.
   "Kode Sync" dipakai untuk menyambungkan data yang sama di device lain. */
/* State cloud (fbApp, fbReady, syncCode, dst.) dideklarasikan di 01-state.js (Store terpusat). */

function getFbConfig(){try{return JSON.parse(localStorage.getItem('cpns-fb-config')||'null');}catch(e){return null;}}
function setFbConfig(cfg){localStorage.setItem('cpns-fb-config',JSON.stringify(cfg));}
function clearFbConfig(){localStorage.removeItem('cpns-fb-config');}
function getSyncCode(){
  let c=localStorage.getItem('cpns-sync-code');
  if(!c){c=genSyncCode();localStorage.setItem('cpns-sync-code',c);}
  return c;
}
function genSyncCode(){
  const ch='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const arr=new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr,b=>ch[b%ch.length]).join('');
}
function setCloudStatus(state,extra){
  const el=document.getElementById('cloud-status');if(!el)return;
  const map={
    off:{icon:'cloud-off',txt:'Cloud belum disambung'},
    connecting:{icon:'loader-2',txt:'Menyambungkan...'},
    syncing:{icon:'cloud-upload',txt:'Menyimpan ke cloud...'},
    synced:{icon:'cloud-check',txt:'Tersinkron'},
    error:{icon:'cloud-exclamation',txt:'Gagal sinkron (cek koneksi)'}
  };
  const m=map[state]||map.off;
  el.innerHTML=`<i class="ti ti-${m.icon}"></i> ${extra||m.txt}`;
}

async function initCloud(){
  const cfg=getFbConfig();
  if(!cfg){setCloudStatus('off');return;}
  try{
    setCloudStatus('connecting');
    fbApp=(firebase.apps&&firebase.apps.length)?firebase.apps[0]:firebase.initializeApp(cfg);
    fbDb=firebase.firestore();
    fbStorage=firebase.storage();
    syncCode=getSyncCode();
    fbReady=true;
    await cloudLoad();
    setCloudStatus('synced');
  }catch(e){
    console.error('Firebase init gagal:',e);
    fbReady=false;
    setCloudStatus('error');
  }
}

async function cloudLoad(){
  if(!fbReady)return;
  const mainRef=fbDb.collection('syncs').doc(syncCode);
  const mainSnap=await mainRef.get();
  if(mainSnap.exists){
    const data=mainSnap.data();
    if(data.cats)cats=data.cats;
    if(data.nid)nid=data.nid;
    if(data.gami)gami=data.gami;
    const qsnap=await mainRef.collection('questions').get();
    if(!qsnap.empty){
      qs=qsnap.docs.map(d=>d.data());
      qs.forEach(q=>ensureSrs(q));
    }
  }else{
    await cloudSaveNow();
  }
  localStorage.setItem(SK,JSON.stringify({qs,nid,cats,gami}));
  ensureGami();migrateCatColors();
  buildCatTabs();populateCatSelects();updateBabFilter();render();renderGami();
}

function scheduleCloudSave(){
  if(!fbReady)return;
  clearTimeout(cloudSaveTimer);
  setCloudStatus('syncing');
  cloudSaveTimer=setTimeout(cloudSaveNow,1500);
}

async function cloudSaveNow(){
  if(!fbReady||cloudBusy)return;
  cloudBusy=true;
  setCloudStatus('syncing');
  try{
    for(const q of qs)await migrateQuestionImages(q);
    localStorage.setItem(SK,JSON.stringify({qs,nid,cats,gami}));
    const mainRef=fbDb.collection('syncs').doc(syncCode);
    const docs=[{ref:mainRef,data:JSON.parse(JSON.stringify({cats,nid,gami,updatedAt:Date.now()}))}];
    qs.forEach(q=>docs.push({ref:mainRef.collection('questions').doc(String(q.id)),data:JSON.parse(JSON.stringify(q))}));
    await commitInChunks(docs);
    if(pendingDeletes.length){
      const delRefs=pendingDeletes.map(id=>mainRef.collection('questions').doc(String(id)));
      await commitDeletesInChunks(delRefs);
      pendingDeletes=[];
    }
    setCloudStatus('synced');
  }catch(e){
    console.error('Cloud save gagal:',e);
    setCloudStatus('error');
  }
  cloudBusy=false;
}
async function commitInChunks(docs,size=450){
  for(let i=0;i<docs.length;i+=size){
    const batch=fbDb.batch();
    docs.slice(i,i+size).forEach(({ref,data})=>batch.set(ref,data));
    await batch.commit();
  }
}
async function commitDeletesInChunks(refs,size=450){
  for(let i=0;i<refs.length;i+=size){
    const batch=fbDb.batch();
    refs.slice(i,i+size).forEach(ref=>batch.delete(ref));
    await batch.commit();
  }
}

/* migrasi gambar base64 → Firebase Storage, jalan otomatis tiap sync */
async function migrateImageToStorage(src){
  if(!src||!src.startsWith('data:'))return src;
  if(!fbReady)return src;
  try{
    const path=`syncs/${syncCode}/img/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
    const ref=fbStorage.ref(path);
    await ref.putString(src,'data_url');
    return await ref.getDownloadURL();
  }catch(e){console.error('Upload gambar gagal:',e);return src;}
}
async function migrateHtmlImages(html){
  if(!html||!html.includes('data:image'))return html;
  const re=/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
  const found=[...new Set(html.match(re)||[])];
  let out=html;
  for(const b64 of found){
    const url=await migrateImageToStorage(b64);
    out=out.split(b64).join(url);
  }
  return out;
}
async function migrateQuestionImages(q){
  for(const key of['qimgs','eimgs']){
    if(!q[key])continue;
    for(let i=0;i<q[key].length;i++){
      let item=q[key][i];
      if(typeof item==='string')item={src:item,width:120};
      item.src=await migrateImageToStorage(item.src);
      q[key][i]=item;
    }
  }
  if(q.optImgs){for(const l of Object.keys(q.optImgs))q.optImgs[l]=await migrateImageToStorage(q.optImgs[l]);}
  if(q.opts){for(let i=0;i<q.opts.length;i++)q.opts[i]=await migrateHtmlImages(q.opts[i]);}
  if(q.expHtml)q.expHtml=await migrateHtmlImages(q.expHtml);
}

/* ── SYNC MODAL UI ── */
function openSyncModal(){renderSyncModal();document.getElementById('sync-modal').classList.add('on');}
function renderSyncModal(){
  const el=document.getElementById('sync-content');if(!el)return;
  const cfg=getFbConfig();
  if(!cfg){
    el.innerHTML=`
      <p style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">Biar soal & gambar kamu otomatis tersimpan online dan gak ilang walau ganti HP/browser, sambungkan ke project Firebase gratis kamu sendiri. Tempel konfigurasi Firebase di bawah (dari Firebase Console → Project Settings → Your apps):</p>
      <div class="field"><label>Firebase Config</label><textarea id="fb-config-input" rows="6" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"..."}' style="font-family:monospace;font-size:11px"></textarea></div>
      <div class="btn-row" style="justify-content:flex-end">
        <button class="btn btn-p" id="btn-connect-fb" onclick="connectFirebase()"><i class="ti ti-plug-connected"></i> Sambungkan</button>
      </div>`;
    return;
  }
  el.innerHTML=`
    <div class="field"><label>Kode Sync Kamu</label>
      <div style="display:flex;gap:8px">
        <input id="sync-code-display" value="${syncCode||''}" readonly style="font-family:monospace;letter-spacing:.5px">
        <button class="btn btn-s" onclick="copySyncCode()" aria-label="Salin kode sync"><i class="ti ti-copy"></i></button>
      </div>
      <div class="opt-ce-hint" style="margin-top:4px">Catat kode ini. Masukkan kode yang sama di HP/browser lain biar datanya nyambung jadi satu.</div>
    </div>
    <div class="btn-row" style="justify-content:flex-start;margin-top:0">
      <button class="btn btn-s" id="btn-sync-now" onclick="forceSyncNow()"><i class="ti ti-refresh"></i> Sync Sekarang</button>
    </div>
    <div style="border-top:0.5px solid var(--border);margin:16px 0;padding-top:14px">
      <div class="field"><label>Pakai data dari device lain?</label>
        <div style="display:flex;gap:8px">
          <input id="other-sync-code" placeholder="Tempel kode sync dari device lain">
          <button class="btn btn-s" onclick="switchSyncCode()">Ganti</button>
        </div>
        <div class="opt-ce-hint" style="margin-top:4px">⚠️ Ini akan mengganti semua soal di HP ini dengan data dari kode tersebut.</div>
      </div>
    </div>
    <div style="text-align:right"><button class="btn btn-warn" style="font-size:12px" onclick="disconnectCloud()">Putuskan Cloud Sync</button></div>`;
}
async function connectFirebase(){
  const raw=document.getElementById('fb-config-input').value.trim();
  if(!raw){showToast('Tempel config Firebase dulu','warn');return;}
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start===-1||end===-1||end<start){showToast('❌ Format config tidak valid','warn');return;}
  let objText=raw.slice(start,end+1)
    .replace(/;\s*$/,'')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*):/g,'$1"$2"$3:')
    .replace(/'/g,'"')
    .replace(/,\s*([}\]])/g,'$1');
  let cfg;
  try{cfg=JSON.parse(objText);}
  catch(e){showToast('❌ Config tetap tak terbaca. Salin ulang blok firebaseConfig utuh dari console.','warn',5000);return;}
  if(!cfg.apiKey||!cfg.projectId){showToast('❌ Config tidak lengkap (butuh apiKey & projectId)','warn');return;}
  setFbConfig(cfg);
  const btn=document.getElementById('btn-connect-fb');if(btn)btn.classList.add('loading');
  await initCloud();
  renderSyncModal();
  if(fbReady)showToast('Cloud Sync aktif','ok');
}
function copySyncCode(){
  const inp=document.getElementById('sync-code-display');if(!inp)return;
  inp.select();document.execCommand('copy');
  showToast('Kode sync disalin','ok');
}
async function forceSyncNow(){
  if(!fbReady){showToast('Cloud belum disambung','warn');return;}
  const btn=document.getElementById('btn-sync-now');if(btn)btn.classList.add('loading');
  await cloudSaveNow();
  if(btn)btn.classList.remove('loading');
  showToast('Sinkron selesai','ok');
}
function switchSyncCode(){
  const inp=document.getElementById('other-sync-code');if(!inp)return;
  const code=inp.value.trim();
  if(!code){showToast('Masukkan kode sync dulu','warn');return;}
  showConfirm({icon:'🔄',title:'Ganti kode sync?',body:'Ini akan mengganti semua data di HP ini dengan data dari kode tersebut. Lanjutkan?',actionLabel:'Ganti',onConfirm:async()=>{
    localStorage.setItem('cpns-sync-code',code);
    syncCode=code;
    showToast('Memuat data...','');
    await cloudLoad();
    renderSyncModal();
    showToast('✅ Data berhasil dimuat','ok');
  }});
}
function disconnectCloud(){
  showConfirm({icon:'🔌',title:'Putuskan Cloud Sync?',body:'Data di HP ini tetap aman, tapi gak akan tersimpan online lagi sampai disambungkan ulang.',actionLabel:'Putuskan',onConfirm:()=>{
    clearFbConfig();fbReady=false;fbApp=null;fbDb=null;fbStorage=null;
    setCloudStatus('off');
    document.getElementById('sync-modal').classList.remove('on');
    showToast('Cloud Sync diputuskan','ok');
  }});
}


/* ── LOGIN GOOGLE (Firebase Auth) ── */
let gUser=null;
const G_SVG='<svg class="gico" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.4 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/></svg>';
function renderHeaderAcct(){
  const el=document.getElementById('hdr-acct');if(!el)return;
  if(gUser){
    const name=(gUser.displayName||'Akun Google').split(' ')[0];
    const photo=gUser.photoURL?'<img src="'+gUser.photoURL+'" referrerpolicy="no-referrer" alt="">':'';
    el.innerHTML='<button class="acct-btn" onclick="googleLogoutConfirm()" title="'+(gUser.email||'')+'">'+photo+'<span>'+name+'</span><span class="acct-out" role="button" onclick="event.stopPropagation();googleLogoutConfirm()"><i class="ti ti-logout"></i></span></button>';
  }else{
    el.innerHTML='<button class="acct-btn" onclick="googleLogin()">'+G_SVG+'<span>Masuk dengan Google</span></button>';
  }
}
async function googleLogin(){
  if(!(window.firebase&&firebase.auth)){showToast('Modul auth belum termuat (cek koneksi)','warn');return;}
  if(!getFbConfig()){showToast('Sambungkan Cloud Sync dulu di Lainnya — login Google memakai project Firebase Anda','warn',5000);openSyncModal();return;}
  try{
    await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
  }catch(e){
    const code=(e&&e.code)||'';
    if(code.indexOf('popup')>-1){
      try{await firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());}
      catch(e2){showToast('Login gagal: '+(e2.message||e2),'warn',5000);}
    }else showToast('Login gagal: '+(e.message||code),'warn',5000);
  }
}
function googleLogoutConfirm(){
  showConfirm({icon:'🚪',title:'Keluar dari akun?',body:'Data lokal tetap aman. Sinkron berikutnya akan kembali memakai kode manual.',actionLabel:'Keluar',onConfirm:()=>{if(window.firebase&&firebase.auth)firebase.auth().signOut();}});
}
if(window.firebase&&firebase.auth){
  firebase.auth().onAuthStateChanged(u=>{
    gUser=u;
    renderHeaderAcct();
    if(fbReady&&u){
      const code='u_'+u.uid.slice(0,24);
      if(syncCode!==code){syncCode=code;localStorage.setItem('cpns-sync-code',code);cloudLoad();}
    }
  });
}
