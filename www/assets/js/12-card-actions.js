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
function openLB(src,alt){const im=document.getElementById('lb-img');im.src=src;im.alt=alt||'Gambar diperbesar';document.getElementById('lightbox').classList.add('on');}
function closeLB(){document.getElementById('lightbox').classList.remove('on');}

const DIALOG_SELECTOR='.modal-overlay,.note-editor-overlay,.lightbox';
function _dialogOpen(){return [...document.querySelectorAll(DIALOG_SELECTOR)].filter(el=>el.classList.contains('on'));}
function _dialogVisible(el){return !!(el&&el.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');}
function _dialogFocusables(el){
  return [...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]')]
    .filter(x=>_dialogVisible(x)&&!x.closest('[aria-hidden="true"],[inert]'));
}
function _focusEl(el){if(!el)return;try{el.focus({preventScroll:true});}catch(e){try{el.focus();}catch(_){}}}
function _dialogTop(){
  for(let i=dialogStack.length-1;i>=0;i--){const el=dialogStack[i].el;if(el&&el.classList.contains('on'))return el;}
  const open=_dialogOpen();return open[open.length-1]||null;
}
function _focusDialog(el){
  if(el.contains(document.activeElement))return;
  const auto=el.querySelector('[data-autofocus]');
  _focusEl((auto&&_dialogVisible(auto))?auto:_dialogFocusables(el)[0]||el);
}
function _dialogRestore(opener){
  if(!opener)return;
  clearTimeout(dialogRestoreTimer);
  dialogRestoreTimer=setTimeout(()=>{
    const open=_dialogOpen();
    if(open.length){const top=_dialogTop();if(!top||!top.contains(opener))return;}
    let t=opener;
    if(!_dialogVisible(t))t=dialogLastFocus;
    if(!_dialogVisible(t))t=document.querySelector('.bnav-item.on');
    if(_dialogVisible(t))_focusEl(t);
  },0);
}
function _dialogSync(){
  const open=_dialogOpen();
  for(let i=dialogStack.length-1;i>=0;i--){
    const entry=dialogStack[i];
    if(!open.includes(entry.el)){dialogStack.splice(i,1);_dialogRestore(entry.opener);}
  }
  open.forEach(el=>{
    if(dialogStack.some(x=>x.el===el))return;
    const active=document.activeElement;
    let opener=(active&&active!==document.body&&!el.contains(active))?active:dialogLastFocus;
    if(!_dialogVisible(opener))opener=null;
    dialogStack.push({el,opener});
  });
  document.body.classList.toggle('dialog-open',open.length>0);
  const top=_dialogTop();
  if(top)_focusDialog(top);
}
function closeDialogEl(el){
  if(!el)return;
  switch(el.id){
    case 'settings-modal':closeSettings();return;
    case 'note-cat-modal':closeNoteCatModal();return;
    case 'batch-modal':closeBatchModal();return;
    case 'tutor-modal':closeTutor();return;
    case 'import-modal':closeImportModal();return;
    case 'ai-guide-modal':closeAiGuide();return;
    case 'cat-del-modal':closeCatDel();return;
    case 'confirm-modal':closeConfirm();return;
    case 'onboard-modal':skipOnboard();return;
    case 'note-editor-overlay':closeNoteEditor();return;
    case 'lightbox':closeLB();return;
    default:el.classList.remove('on');
  }
}
function initDialogA11y(){
  if(document.body.dataset.dialogA11y==='1')return;
  document.body.dataset.dialogA11y='1';
  const els=[...document.querySelectorAll(DIALOG_SELECTOR)];
  els.forEach(el=>{
    if(!el.hasAttribute('role'))el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    if(!el.hasAttribute('aria-label')&&!el.hasAttribute('aria-labelledby')){
      const h=el.querySelector('h3');
      if(h){if(!h.id)h.id='dialog-title-'+el.id;el.setAttribute('aria-labelledby',h.id);}
    }
    if(!el.hasAttribute('tabindex'))el.tabIndex=-1;
  });
  dialogObserver=new MutationObserver(_dialogSync);
  els.forEach(el=>dialogObserver.observe(el,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('focusin',e=>{
    const el=e.target;
    if(el&&el!==document.body&&!_dialogOpen().some(d=>d.contains(el)))dialogLastFocus=el;
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'||e.key==='Esc'){
      if(e.defaultPrevented)return;
      const top=_dialogTop();if(!top)return;
      e.preventDefault();closeDialogEl(top);return;
    }
    if(e.key!=='Tab'||e.defaultPrevented)return;
    const top=_dialogTop();if(!top)return;
    const f=_dialogFocusables(top);
    if(!f.length){e.preventDefault();_focusEl(top);return;}
    const active=document.activeElement;
    if(!top.contains(active)||active===top){e.preventDefault();_focusEl(e.shiftKey?f[f.length-1]:f[0]);return;}
    if(e.shiftKey&&active===f[0]){e.preventDefault();_focusEl(f[f.length-1]);}
    else if(!e.shiftKey&&active===f[f.length-1]){e.preventDefault();_focusEl(f[0]);}
  });
  _dialogSync();
}

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
      <input id="cat-name-${escHtml(k)}" value="${escHtml(c.name||k)}" aria-label="Nama kategori ${escHtml(c.name||k)}" placeholder="Nama kategori" style="font-weight:600">
      <div class="cat-header-right">
        <label style="font-size:11px;color:var(--text2);flex-shrink:0;display:flex;align-items:center;gap:4px">Warna: <input type="color" id="cat-color-${escHtml(k)}" value="${escHtml(c.color||'#eeeeee')}" aria-label="Warna kategori ${escHtml(c.name||k)}" style="width:28px;height:22px;border:none;cursor:pointer;border-radius:4px;padding:0"></label>
        <button class="rm-bab" onclick="removeCategory('${escHtml(jsStr(k))}')" style="background:transparent;border:none;cursor:pointer;color:var(--text3);font-size:14px;display:flex;align-items:center" aria-label="Hapus kategori"><i class="ti ti-trash"></i></button>
      </div>
    </div><div class="cat-body">
      <div style="font-size:11px;color:var(--text2);font-weight:600;margin-bottom:6px">Sub-Bab</div>
      <div class="bab-list" id="bab-list-${escHtml(k)}">${(c.babs||[]).map((b,i)=>`<div class="bab-item"><i class="ti ti-grip-vertical" style="font-size:13px;color:var(--text3)"></i><input value="${escHtml(b)}" aria-label="Sub-bab ${i+1} kategori ${escHtml(c.name||k)}" onchange="editBab('${escHtml(jsStr(k))}',${i},this.value)"><button class="rm-bab" onclick="removeBab('${escHtml(jsStr(k))}',${i})" aria-label="Hapus sub-bab"><i class="ti ti-x"></i></button></div>`).join('')}</div>
      <div class="bab-add-row"><input id="new-bab-${escHtml(k)}" placeholder="Tambah sub-bab baru..." aria-label="Tambah sub-bab baru untuk ${escHtml(c.name||k)}" onkeydown="if(event.key==='Enter')addBab('${escHtml(jsStr(k))}')"><button onclick="addBab('${escHtml(jsStr(k))}')" aria-label="Tambah sub-bab"><i class="ti ti-plus" style="font-size:11px"></i> Tambah</button></div>
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

