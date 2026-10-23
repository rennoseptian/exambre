/* ── TAB LAINNYA: tema, export/import ── */
const BACKUP_KEY='exambre_last_backup';
const BACKUP_REMINDER_KEY='exambre_backup_reminder_at';
function fmtBytes(n){
  if(n<1024)return n+' B';
  if(n<1048576)return (n/1024).toFixed(n<10240?1:0)+' KB';
  return (n/1048576).toFixed(1)+' MB';
}
function storageBytes(){
  try{
    let n=0;
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      n+=(k.length+(localStorage.getItem(k)||'').length)*2;
    }
    return n;
  }catch(e){return 0;}
}
function backupDaysAgo(){
  const t=Number(localStorage.getItem(BACKUP_KEY))||0;
  if(!t)return null;
  return Math.max(0,Math.floor((Date.now()-t)/86400000));
}
function markBackup(){try{localStorage.setItem(BACKUP_KEY,String(Date.now()));}catch(e){}}
function renderStorageStatus(){
  const label=document.getElementById('storage-label');if(!label)return;
  const bytes=storageBytes(),quota=5*1024*1024,pct=Math.min(100,Math.round(bytes/quota*100));
  label.textContent='Data terpakai: '+fmtBytes(bytes);
  const p=document.getElementById('storage-pct');if(p)p.textContent=(bytes&&!pct?'<1':pct)+'% dari ±5 MB';
  const bar=document.getElementById('storage-bar');
  if(bar){bar.style.width=(bytes?Math.max(1,pct):0)+'%';bar.style.background=pct>=85?'var(--danger)':pct>=60?'var(--warn)':'var(--accent)';}
  const b=document.getElementById('backup-status');if(!b)return;
  if(!qs.length){b.textContent='Belum ada data soal untuk dibackup.';b.style.color='var(--text3)';return;}
  const days=backupDaysAgo();
  if(days===null){b.textContent='⚠️ Belum pernah backup. Export Data agar aman jika app dihapus.';b.style.color='var(--warn)';}
  else if(days===0){b.textContent='✅ Backup terakhir: hari ini.';b.style.color='var(--text3)';}
  else if(days>=14){b.textContent='⚠️ Backup terakhir '+days+' hari lalu. Sebaiknya export sekarang.';b.style.color='var(--warn)';}
  else{b.textContent='Backup terakhir '+days+' hari lalu.';b.style.color='var(--text3)';}
}
function maybeBackupReminder(){
  try{
    if(!qs.length)return;
    const last=Number(localStorage.getItem(BACKUP_KEY))||0;
    if(last&&Date.now()-last<14*86400000)return;
    const shown=Number(localStorage.getItem(BACKUP_REMINDER_KEY))||0;
    if(Date.now()-shown<7*86400000)return;
    if(document.querySelector('.modal-overlay.on'))return;
    localStorage.setItem(BACKUP_REMINDER_KEY,String(Date.now()));
    showToast(last?'📦 Sudah 14 hari tanpa backup. Ekspor data di tab Lainnya ya.':'📦 Belum pernah backup. Ekspor data di tab Lainnya ya.','warn',6000);
  }catch(e){}
}
function renderLainnya(){
  const cur=localStorage.getItem('exambre-theme')||'auto';
  document.querySelectorAll('#theme-toggle button').forEach(b=>{
    b.classList.toggle('on', b.dataset.th===cur);
  });
  const ver=document.getElementById('app-ver-label');if(ver)ver.textContent=APP_VERSION;
  renderStorageStatus();
  loadGeminiKey();
  loadCustomAI();
  loadSfxToggle();
  loadExamDate();
}
function applyTheme(theme){
  if(theme==='light'||theme==='dark'){
    document.documentElement.setAttribute('data-theme',theme);
    localStorage.setItem('exambre-theme',theme);
  }else{
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('exambre-theme','auto');
  }
  renderLainnya();
}
async function exportData(){
  const payload={app:'Exambre',version:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),qs,nid,cats,gami,notes,noteCats,noteNid};
  const json=JSON.stringify(payload,null,2);
  const filename=`exambre-backup-${new Date().toISOString().slice(0,10)}.json`;
  const isNative=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();

  if(isNative){
    try{
      const Filesystem=window.Capacitor.Plugins&&window.Capacitor.Plugins.Filesystem;
      const Share=window.Capacitor.Plugins&&window.Capacitor.Plugins.Share;
      if(!Filesystem){
        showToast('Plugin penyimpanan belum terpasang di app ini (lihat instruksi setup)','warn',5000);
        return;
      }
      const result=await Filesystem.writeFile({path:filename,data:json,directory:'CACHE',encoding:'utf8'});
      if(Share){
        await Share.share({title:'Backup Exambre',text:'Backup data Exambre',url:result.uri,dialogTitle:'Simpan atau bagikan backup'});
        markBackup();renderStorageStatus();
        showToast('Pilih lokasi simpan di menu yang muncul','ok');
      }else{
        showToast('File backup dibuat, tapi plugin Share belum ada untuk menyimpannya','warn',5000);
      }
    }catch(e){
      showToast('Gagal export: '+escHtml(e&&e.message?e.message:'error tidak dikenal'),'warn',5000);
      console.error('exportData error:',e);
    }
    return;
  }

  try{
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    markBackup();renderStorageStatus();
    showToast('Data berhasil diexport','ok');
  }catch(e){showToast('Gagal export data','warn');}
}
function openImportModal(){
  const isNative=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();
  if(isNative){importDataNative();return;}
  // Web fallback: paste modal
  const area=document.getElementById('import-paste-area');
  if(area)area.value='';
  document.getElementById('import-modal').classList.add('on');
  setTimeout(()=>{if(area)area.focus();},200);
}
function closeImportModal(){
  document.getElementById('import-modal').classList.remove('on');
  const area=document.getElementById('import-paste-area');
  if(area)area.value='';
}
async function importDataNative(){
  try{
    const FilePicker=window.Capacitor.Plugins&&window.Capacitor.Plugins.FilePicker;
    if(!FilePicker){
      showToast('Plugin FilePicker belum tersedia, gunakan mode tempel','warn',4000);
      const area=document.getElementById('import-paste-area');
      if(area)area.value='';
      document.getElementById('import-modal').classList.add('on');
      setTimeout(()=>{if(area)area.focus();},200);
      return;
    }
    const result=await FilePicker.pickFiles({types:['application/json'],readData:true});
    if(!result||!result.files||!result.files.length)return;
    const file=result.files[0];
    if(!file.data){showToast('Gagal membaca isi file','warn');return;}
    const content=atob(file.data);
    processImportJson(content);
  }catch(e){
    const msg=(e&&e.message)||'';
    if(/cancel|dismiss/i.test(msg))return; // user cancelled picker
    showToast('Gagal membuka file: '+escHtml(msg),'warn',5000);
    console.error('importDataNative error:',e);
  }
}
function doImportFromPaste(){
  const raw=(document.getElementById('import-paste-area').value||'').trim();
  if(!raw){showToast('Tempel isi file JSON dulu ya','warn');return;}
  closeImportModal();
  processImportJson(raw);
}
function processImportJson(raw){
  let data;
  try{data=JSON.parse(raw);}catch(e){showToast('Format JSON tidak valid. Pastikan salin seluruh isi file.','warn');return;}
  if(!data||!Array.isArray(data.qs)){showToast('File tidak dikenali sebagai backup Exambre','warn');return;}
  showConfirm({icon:'📥',title:'Import data?',body:`Import ${data.qs.length} soal? Ini akan MENGGANTI semua data yang ada sekarang di app ini.`,actionLabel:'Import',onConfirm:()=>{
    qs=data.qs;
    nid=data.nid||(qs.reduce((m,q)=>Math.max(m,q.id||0),0)+1);
    cats=data.cats||{};
    gami=data.gami||gami;
    qs.forEach(q=>ensureSrs(q));
    ensureGami();migrateCatColors();
    if(Array.isArray(data.notes)){notes=data.notes;noteCats=data.noteCats||[];noteNid=data.noteNid||(notes.reduce((m,n)=>Math.max(m,n.id||0),0)+1);persistNotes();}
    persist();
    buildCatTabs();populateCatSelects();updateBabFilter();render();renderGami();
    showToast('Import berhasil! '+data.qs.length+' soal dimuat.','ok');
  }});
}
function clearAllData(){
  showConfirm({icon:'⛔',title:'Hapus SEMUA data?',body:'Yakin ingin menghapus SEMUA data (soal, kategori, catatan, progress)? Tindakan ini tidak bisa dibatalkan.',actionLabel:'Ya, Hapus Semuanya',onConfirm:()=>{
    showConfirm({icon:'⛔',title:'Konfirmasi sekali lagi',body:'Semua data akan hilang permanen dari perangkat ini. Lanjutkan?',actionLabel:'Ya, Hapus Semuanya',onConfirm:()=>{
      try{localStorage.removeItem(SK);}catch(e){}
      try{localStorage.removeItem(NK);}catch(e){}
      // Riwayat simulasi juga data — tanpa ini tab Riwayat & badge masih tampil sesi lama
      try{localStorage.removeItem(SIMHISTK);}catch(e){}
      showToast('Semua data dihapus. Memuat ulang...','ok');
      setTimeout(()=>location.reload(),800);
    }});
  }});
}
// FIX BUG #2: reset curBab saat ganti kategori
function fCat(c,btn){
  curCat=c;curBab='all';
  document.querySelectorAll('.ctab').forEach(t=>t.classList.remove('on'));btn.classList.add('on');
  const fbSel=document.getElementById('filter-bab');if(fbSel)fbSel.value='all';
  updateBabFilter();render();
}
function fStatus(v){curSt=v;render();}
function fBab(v){curBab=v;render();}
function fSearch(v){searchQ=v.toLowerCase();render();}
function getFiltered(){
  return qs.filter(q=>{
    if(curCat!=='ALL'&&q.cat!==curCat)return false;
    if(curSt==='wrong'&&q.mastered)return false;
    if(curSt==='mastered'&&!q.mastered)return false;
    if(curBab!=='all'&&q.bab!==curBab)return false;
    if(searchQ&&!(q.q||'').toLowerCase().includes(searchQ))return false;
    return true;
  });
}

