/* ── CARD ACTIONS ── */
function delQ(id){
  const q=qs.find(x=>x.id===id);if(!q)return;
  showConfirm({icon:'🗑️',title:'Hapus soal?',body:'Soal ini akan dihapus permanen.',actionLabel:'Hapus',onConfirm:()=>{
    const snap={...q,opts:[...(q.opts||[])],qimgs:[...(q.qimgs||[])],eimgs:[...(q.eimgs||[])]};
    lastDeleted=snap;
    qs=qs.filter(q=>q.id!==id);
    pendingDeletes.push(id);
    persist();render();
    // Undo WAJIB per-toast (closure snap), bukan lewat slot global lastDeleted:
    // dua toast bisa hidup bersamaan sehingga global salah memulihkan soal.
    showToastWithUndo('Soal dihapus.',()=>{
      if(qs.some(x=>x.id===snap.id))return;
      qs.push(snap);
      pendingDeletes=pendingDeletes.filter(i=>i!==snap.id);
      if(lastDeleted&&lastDeleted.id===snap.id)lastDeleted=null;
      qs.sort((a,b)=>a.id-b.id);persist();render();
      showToast('✅ Soal dipulihkan!','ok');
    },8000);
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
      <input id="cat-name-${escHtml(k)}" value="${escHtml(c.name||k)}" placeholder="Nama kategori" style="font-weight:600">
      <div class="cat-header-right">
        <label style="font-size:11px;color:var(--text2);flex-shrink:0;display:flex;align-items:center;gap:4px">Warna: <input type="color" id="cat-color-${escHtml(k)}" value="${escHtml(c.color||'#eeeeee')}" style="width:28px;height:22px;border:none;cursor:pointer;border-radius:4px;padding:0"></label>
        <button class="rm-bab" onclick="removeCategory('${escHtml(jsStr(k))}')" style="background:transparent;border:none;cursor:pointer;color:var(--text3);font-size:14px;display:flex;align-items:center" aria-label="Hapus kategori"><i class="ti ti-trash"></i></button>
      </div>
    </div><div class="cat-body">
      <div style="font-size:11px;color:var(--text2);font-weight:600;margin-bottom:6px">Sub-Bab</div>
      <div class="bab-list" id="bab-list-${escHtml(k)}">${(c.babs||[]).map((b,i)=>`<div class="bab-item"><i class="ti ti-grip-vertical" style="font-size:13px;color:var(--text3)"></i><input value="${escHtml(b)}" onchange="editBab('${escHtml(jsStr(k))}',${i},this.value)"><button class="rm-bab" onclick="removeBab('${escHtml(jsStr(k))}',${i})" aria-label="Hapus sub-bab"><i class="ti ti-x"></i></button></div>`).join('')}</div>
      <div class="bab-add-row"><input id="new-bab-${escHtml(k)}" placeholder="Tambah sub-bab baru..." onkeydown="if(event.key==='Enter')addBab('${escHtml(jsStr(k))}')"><button onclick="addBab('${escHtml(jsStr(k))}')"><i class="ti ti-plus" style="font-size:11px"></i> Tambah</button></div>
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
let _catDelKey=null;
function removeCategory(k){
  if(!cats[k])return;
  _catDelKey=k;
  const n=qs.filter(q=>q.cat===k).length;
  const t=document.getElementById('cat-del-title'),d=document.getElementById('cat-del-desc'),row=document.getElementById('cat-del-all-row'),cnt=document.getElementById('cat-del-count');
  if(t)t.textContent='Hapus kategori "'+(cats[k].name||k)+'"?';
  if(d)d.textContent=n?n+' soal memakai kategori ini. Pilih tindakan yang diinginkan:':'Kategori ini belum dipakai soal.';
  if(row)row.style.display=n?'flex':'none';
  if(cnt)cnt.textContent=n;
  const only=document.querySelector('input[name="cat-del-choice"][value="only"]');
  if(only)only.checked=true;
  const m=document.getElementById('cat-del-modal');if(m)m.classList.add('on');
}
function closeCatDel(){
  const m=document.getElementById('cat-del-modal');if(m)m.classList.remove('on');
  _catDelKey=null;
}
function confirmCatDel(){
  const k=_catDelKey;if(!k||!cats[k]){closeCatDel();return;}
  const n=qs.filter(q=>q.cat===k).length;
  const choice=document.querySelector('input[name="cat-del-choice"]:checked');
  const delQs=!!(choice&&choice.value==='all'&&n>0);
  const name=cats[k].name||k;
  closeCatDel();
  if(delQs){
    showConfirm({icon:'⛔',title:'Hapus '+n+' soal permanen?',body:'Kategori "'+name+'" beserta '+n+' soal, gambar, dan progres SRS-nya akan dihapus. Kamu masih bisa membatalkan lewat tombol "Batalkan" selama 8 detik.',actionLabel:'Ya, hapus semua',actionClass:'btn-warn',onConfirm:()=>doDeleteCategory(k,true)});
  }else doDeleteCategory(k,false);
}
function doDeleteCategory(k,withQs){
  if(!cats[k])return;
  const snap={cat:JSON.parse(JSON.stringify(cats[k])),qs:withQs?JSON.parse(JSON.stringify(qs.filter(q=>q.cat===k))):[]};
  if(withQs)qs=qs.filter(q=>q.cat!==k);
  delete cats[k];
  if(curCat===k){curCat='ALL';curBab='all';}
  if(simSelectedCats&&simSelectedCats.has(k))simSelectedCats.delete(k);
  persist();buildCatTabs();populateCatSelects();updateBabFilter();render();renderSettingsContent();updateDueBadge();
  const label=escHtml(snap.cat.name||k);
  showToastWithUndo(withQs?'Kategori "'+label+'" dan '+snap.qs.length+' soal dihapus.':'Kategori "'+label+'" dihapus.',()=>{
    if(!cats[k])cats[k]=snap.cat;
    if(snap.qs.length){
      const have=new Set(qs.map(q=>q.id));
      snap.qs.forEach(q=>{if(!have.has(q.id))qs.push(q);});
      qs.sort((a,b)=>a.id-b.id);
    }
    persist();buildCatTabs();populateCatSelects();updateBabFilter();render();renderSettingsContent();updateDueBadge();
    showToast('✅ Kategori dipulihkan','ok');
  },8000);
}
function addCategory(){const key='KAT'+(Date.now()%10000);const bg='#e8e8e8';cats[key]={name:'Kategori Baru',color:bg,textColor:autoTextColor(bg),babs:[]};renderSettingsContent();}

