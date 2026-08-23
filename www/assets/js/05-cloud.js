/* ── CLOUD SYNC (Firebase) ──
   Ganti backup JSON manual. Soal disimpan satu-per-satu sebagai dokumen Firestore
   (biar gak kena limit ukuran 1MB/dokumen), dan semua gambar diupload ke Firebase
   Storage (bukan base64 lagi) — ini sekaligus mengatasi localStorage yang gampang penuh.
   "Kode Sync" dipakai untuk menyambungkan data yang sama di device lain. */
let fbApp=null,fbDb=null,fbStorage=null,fbReady=false,syncCode=null;
let cloudSaveTimer=null,cloudBusy=false,pendingDeletes=[];

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
  const objText=raw.slice(start,end+1);
  let cfg;
  try{cfg=JSON.parse(objText);}
  catch(e){showToast('❌ Format JSON tidak valid. Pastikan config Firebase berbentuk JSON murni.','warn');return;}
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

