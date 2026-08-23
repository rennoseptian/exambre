/* ── CARD ACTIONS ── */
function delQ(id){
  const q=qs.find(x=>x.id===id);if(!q)return;
  showConfirm({icon:'🗑️',title:'Hapus soal?',body:'Soal ini akan dihapus permanen.',actionLabel:'Hapus',onConfirm:()=>{
    lastDeleted={...q,opts:[...(q.opts||[])],qimgs:[...(q.qimgs||[])],eimgs:[...(q.eimgs||[])]};
    qs=qs.filter(q=>q.id!==id);
    pendingDeletes.push(id);
    persist();render();
    showToast('Soal dihapus. <a onclick="undoDel()">Undo</a>','warn',4000);
  }});
}
function undoDel(){
  if(!lastDeleted)return;
  qs.push(lastDeleted);
  pendingDeletes=pendingDeletes.filter(id=>id!==lastDeleted.id);
  lastDeleted=null;
  qs.sort((a,b)=>a.id-b.id);persist();render();
  showToast('✅ Soal dipulihkan!','ok');
}
function toggleM(id){
  const q=qs.find(x=>x.id===id);if(!q)return;
  const prevMastered=q.mastered;
  const prevSrs={...ensureSrs(q)};
  q.mastered=!q.mastered;
  const s=ensureSrs(q);
  if(q.mastered){s.reps=3;s.interval=21;s.ease=Math.max(s.ease,2.2);s.due=Date.now()+21*DAY_MS;}
  else{s.reps=0;s.interval=0;s.due=Date.now()-1;}
  persist();render();
  const msg=q.mastered?'Soal ditandai <b>Dikuasai</b>':'Tanda dikuasai dihapus';
  showToastWithUndo(msg,()=>{
    q.mastered=prevMastered;
    q.srs=prevSrs;
    persist();render();
  });
}
function rmStoredEimg(qid,idx){const q=qs.find(x=>x.id===qid);if(!q)return;q.eimgs.splice(idx,1);persist();render();}

/* ── LIGHTBOX ── */
function openLB(src){document.getElementById('lb-img').src=src;document.getElementById('lightbox').classList.add('on');}
function closeLB(){document.getElementById('lightbox').classList.remove('on');}

/* ── CONFIRM MODAL ── */
function showConfirm(opts){
  // opts: { icon, title, body, actionLabel, actionClass, onConfirm }
  document.getElementById('confirm-icon').textContent=opts.icon||'⚠️';
  document.getElementById('confirm-title').textContent=opts.title||'Konfirmasi';
  document.getElementById('confirm-body').textContent=opts.body||'';
  const btn=document.getElementById('confirm-action-btn');
  btn.textContent=opts.actionLabel||'Lanjutkan';
  btn.className='btn '+(opts.actionClass||'btn-warn');
  btn.onclick=()=>{closeConfirm();opts.onConfirm();};
  document.getElementById('confirm-modal').classList.add('on');
}
function closeConfirm(){
  document.getElementById('confirm-modal').classList.remove('on');
}

/* ── SETTINGS ── */
function openSettings(){renderSettingsContent();document.getElementById('settings-modal').classList.add('on');}
function closeSettings(){
  getCatKeys().forEach(k=>{const inp=document.getElementById('cat-name-'+k);if(inp)cats[k].name=inp.value.trim()||k;const ci=document.getElementById('cat-color-'+k);if(ci&&ci.value){cats[k].color=ci.value;cats[k].textColor=autoTextColor(ci.value);}});
  document.getElementById('settings-modal').classList.remove('on');
  persist();buildCatTabs();populateCatSelects();updateBabFilter();render();
}
function renderSettingsContent(){
  let html='';
  getCatKeys().forEach(k=>{
    const c=cats[k];
    html+=`<div class="cat-section"><div class="cat-header">
      <span style="font-size:11px;color:var(--text2);flex-shrink:0">Nama:</span>
      <input id="cat-name-${k}" value="${c.name||k}" placeholder="Nama kategori" style="font-weight:600">
      <div class="cat-header-right">
        <label style="font-size:11px;color:var(--text2);flex-shrink:0;display:flex;align-items:center;gap:4px">Warna: <input type="color" id="cat-color-${k}" value="${c.color||'#eeeeee'}" style="width:28px;height:22px;border:none;cursor:pointer;border-radius:4px;padding:0"></label>
        <button class="rm-bab" onclick="removeCategory('${k}')" style="background:transparent;border:none;cursor:pointer;color:var(--text3);font-size:14px;display:flex;align-items:center" aria-label="Hapus kategori"><i class="ti ti-trash"></i></button>
      </div>
    </div><div class="cat-body">
      <div style="font-size:11px;color:var(--text2);font-weight:600;margin-bottom:6px">Sub-Bab</div>
      <div class="bab-list" id="bab-list-${k}">${(c.babs||[]).map((b,i)=>`<div class="bab-item"><i class="ti ti-grip-vertical" style="font-size:13px;color:var(--text3)"></i><input value="${b}" onchange="editBab('${k}',${i},this.value)"><button class="rm-bab" onclick="removeBab('${k}',${i})" aria-label="Hapus sub-bab"><i class="ti ti-x"></i></button></div>`).join('')}</div>
      <div class="bab-add-row"><input id="new-bab-${k}" placeholder="Tambah sub-bab baru..." onkeydown="if(event.key==='Enter')addBab('${k}')"><button onclick="addBab('${k}')"><i class="ti ti-plus" style="font-size:11px"></i> Tambah</button></div>
    </div></div>`;
  });
  document.getElementById('settings-content').innerHTML=html;
}
function editBab(cat,idx,val){if(cats[cat])cats[cat].babs[idx]=val;}
function removeBab(cat,idx){
  showConfirm({icon:'🗑️',title:'Hapus sub-bab ini?',body:'Sub-bab ini akan dihapus dari kategori.',actionLabel:'Hapus',onConfirm:()=>{
    cats[cat].babs.splice(idx,1);renderSettingsContent();
  }});
}
function addBab(cat){const inp=document.getElementById('new-bab-'+cat),val=inp.value.trim();if(!val)return;if(!cats[cat].babs)cats[cat].babs=[];cats[cat].babs.push(val);inp.value='';renderSettingsContent();}
function removeCategory(k){
  showConfirm({icon:'🗑️',title:`Hapus kategori "${cats[k].name||k}"?`,body:'Soal yang sudah memakai kategori ini tidak akan terhapus, hanya kehilangan label kategori.',actionLabel:'Hapus',onConfirm:()=>{
    delete cats[k];renderSettingsContent();buildCatTabs();populateCatSelects();
  }});
}
function addCategory(){const key='KAT'+(Date.now()%10000);const bg='#e8e8e8';cats[key]={name:'Kategori Baru',color:bg,textColor:autoTextColor(bg),babs:[]};renderSettingsContent();}

