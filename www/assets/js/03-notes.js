/* ── CATATAN ── */
function getNoteCatById(id){return noteCats.find(c=>c.id===id);}
function buildNoteCatSelect(){
  const sel=document.getElementById('note-editor-cat');if(!sel)return;
  sel.innerHTML='<option value="">Tanpa kategori</option>'+noteCats.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
}
function renderNoteCatTabs(){
  const el=document.getElementById('note-cat-tabs');if(!el)return;
  el.setAttribute('role','tablist');
  const allCount=notes.length;
  el.innerHTML=`<button class="ctab${curNoteCat==='ALL'?' on':''}" role="tab" aria-selected="${curNoteCat==='ALL'}" onclick="fNoteCat('ALL',this)">Semua <span style="opacity:.6;font-size:10px">${allCount}</span></button>`
    +noteCats.map(c=>{
      const cnt=notes.filter(n=>n.catId===c.id).length;
      const bg=safeColor(c.color,'#7C3AED');
      const fg=c.textColor?safeColor(c.textColor):autoTextColor(bg);
      return`<button class="ctab${curNoteCat===c.id?' on':''}" role="tab" aria-selected="${curNoteCat===c.id}" onclick="fNoteCat('${escHtml(jsStr(c.id))}',this)" style="${curNoteCat===c.id?'':'background:'+bg+';color:'+fg}">${escHtml(c.name)} <span style="opacity:.6;font-size:10px">${cnt}</span></button>`;
    }).join('');
}
function fNoteCat(id,btn){curNoteCat=id;renderNoteCatTabs();renderNotes();}
function fNoteSearch(v){noteSearchQ=v.toLowerCase();renderNotes();}
function getFilteredNotes(){
  return notes.filter(n=>{
    if(curNoteCat!=='ALL'&&n.catId!==curNoteCat)return false;
    if(noteSearchQ){
      const hay=(n.title+' '+(n.bodyText||'')).toLowerCase();
      if(!hay.includes(noteSearchQ))return false;
    }
    return true;
  }).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
}
function renderNotes(){
  renderNoteCatTabs();
  const el=document.getElementById('note-list');if(!el)return;
  const list=getFilteredNotes();
  if(!list.length){
    el.innerHTML='<div class="empty"><i class="ti ti-notebook"></i><p>'+(noteSearchQ?`Catatan dengan kata "<b>${escHtml(noteSearchQ)}</b>" tidak ditemukan.`:'Belum ada catatan.<br>Tulis rumus, ringkasan, atau apa pun yang membantu belajar.')+'</p>'+(noteSearchQ?'':'<button class="btn btn-note" style="margin-top:16px" onclick="openNoteEditor(null)"><i class="ti ti-plus"></i> Catatan Baru</button>')+'</div>';
    return;
  }
  el.innerHTML=list.map(n=>{
    const cat=getNoteCatById(n.catId);
    const badgeBg=cat?safeColor(cat.color,'#7C3AED'):'';
    const badgeFg=cat?(cat.textColor?safeColor(cat.textColor):autoTextColor(badgeBg)):'';
    const catBadge=cat?`<span class="note-cat-badge" style="background:${badgeBg}22;color:${badgeFg};border-color:${badgeBg}55">${escHtml(cat.name)}</span>`:'';
    const d=n.updatedAt?new Date(n.updatedAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'';
    const preview=(n.bodyText||'').slice(0,140);
    return`<div class="note-card" onclick="openNoteEditor(${n.id})">
      <div class="note-card-header"><div class="note-card-title">${escHtml(n.title||'(Tanpa judul)')}</div><button class="ibtn edit-btn" style="width:34px;height:34px;font-size:13px" title="Buat soal dari catatan ini" aria-label="Buat soal dari catatan ini" onclick="event.stopPropagation();openNoteToQ(${n.id})"><i class="ti ti-sparkles"></i></button></div>
      <div class="note-meta">${catBadge}<span class="note-date">${d}</span></div>
      <div class="note-card-preview">${preview?escHtml(preview):'<i style="color:var(--text3)">Kosong</i>'}</div>
    </div>`;
  }).join('');
}
function openNoteEditor(id){
  if(id===null&&noteCats.length===0){
    showToast('Tambahkan kategori catatan dulu (opsional, tapi membantu mengorganisir)','',3000);
  }
  curNoteId=id;
  buildNoteCatSelect();
  const titleInp=document.getElementById('note-editor-title');
  const area=document.getElementById('note-rte-area');
  const catSel=document.getElementById('note-editor-cat');
  const dateEl=document.getElementById('note-editor-date');
  const delBtn=document.getElementById('note-del-btn');
  if(id===null){
    titleInp.value='';area.innerHTML='';catSel.value='';dateEl.textContent='';delBtn.style.display='none';
  }else{
    const n=notes.find(x=>x.id===id);if(!n)return;
    titleInp.value=n.title||'';area.innerHTML=n.body||'';catSel.value=n.catId||'';
    dateEl.textContent=n.updatedAt?'Diubah '+new Date(n.updatedAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'';
    delBtn.style.display='flex';
  }
  document.getElementById('note-editor-overlay').classList.add('on');
  setTimeout(()=>titleInp.focus(),100);
}
function closeNoteEditor(){
  document.getElementById('note-editor-overlay').classList.remove('on');
  curNoteId=null;
}
function saveNote(){
  const title=document.getElementById('note-editor-title').value.trim();
  const body=document.getElementById('note-rte-area').innerHTML;
  const bodyText=document.getElementById('note-rte-area').textContent.trim();
  const catId=document.getElementById('note-editor-cat').value;
  if(!title&&!bodyText){showToast('Catatan masih kosong','warn');return;}
  if(curNoteId===null){
    notes.push({id:noteNid++,title:title||'(Tanpa judul)',body,bodyText,catId,createdAt:Date.now(),updatedAt:Date.now()});
  }else{
    const n=notes.find(x=>x.id===curNoteId);
    if(n){n.title=title||'(Tanpa judul)';n.body=body;n.bodyText=bodyText;n.catId=catId;n.updatedAt=Date.now();}
  }
  persistNotes();
  closeNoteEditor();
  renderNotes();
  showToast('Catatan disimpan','ok');
}
function deleteCurrentNote(){if(curNoteId!==null)deleteNote(curNoteId);}
function deleteNote(id){
  showConfirm({icon:'🗑️',title:'Hapus catatan?',body:'Catatan ini akan dihapus permanen dan tidak bisa dikembalikan.',actionLabel:'Hapus',onConfirm:()=>{
    notes=notes.filter(n=>n.id!==id);
    persistNotes();
    closeNoteEditor();
    renderNotes();
    showToast('Catatan dihapus','ok');
  }});
}
function noteCmd(cmd,val){const el=document.getElementById('note-rte-area');if(el){el.focus();document.execCommand(cmd,false,val||null);}}
function insertNoteCode(){
  const sel=window.getSelection();const text=sel&&sel.toString()?sel.toString():'kode';
  document.getElementById('note-rte-area').focus();
  document.execCommand('insertHTML',false,'<code>'+text.replace(/</g,'&lt;')+'</code>&nbsp;');
}
function insertNoteTable(){
  const html='<table><tr><th>Kolom 1</th><th>Kolom 2</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p><br></p>';
  document.getElementById('note-rte-area').focus();
  document.execCommand('insertHTML',false,html);
}
function openNoteCatModal(){renderNoteCatModalContent();document.getElementById('note-cat-modal').classList.add('on');}
function closeNoteCatModal(){
  document.getElementById('note-cat-modal').classList.remove('on');
  persistNotes();buildNoteCatSelect();renderNotes();
}
function renderNoteCatModalContent(){
  const el=document.getElementById('note-cats-content');if(!el)return;
  if(!noteCats.length){el.innerHTML='<p style="font-size:12px;color:var(--text2);margin-bottom:8px">Belum ada kategori catatan.</p>';return;}
  el.innerHTML='<div class="note-cats-list">'+noteCats.map(c=>`
    <div class="note-cat-item">
      <span class="note-cat-color-dot" style="background:${safeColor(c.color,'#7C3AED')}"></span>
      <span class="note-cat-item-name">${escHtml(c.name)}</span>
      <button class="ibtn del" onclick="removeNoteCat('${escHtml(jsStr(c.id))}')" aria-label="Hapus kategori catatan"><i class="ti ti-trash" style="font-size:13px"></i></button>
    </div>`).join('')+'</div>';
}
function addNoteCat(){
  const inp=document.getElementById('new-note-cat-inp');
  const colorInp=document.getElementById('new-note-cat-color');
  const name=inp.value.trim();
  if(!name){showToast('Nama kategori tidak boleh kosong','warn');return;}
  const color=colorInp.value||'#7C3AED';
  noteCats.push({id:'nc'+Date.now(),name,color,textColor:autoTextColor(color)});
  inp.value='';
  renderNoteCatModalContent();
}
function removeNoteCat(id){
  showConfirm({icon:'🗑️',title:'Hapus kategori catatan?',body:'Catatan di dalamnya tidak akan terhapus, hanya kehilangan label kategori.',actionLabel:'Hapus',onConfirm:()=>{
    noteCats=noteCats.filter(c=>c.id!==id);
    notes.forEach(n=>{if(n.catId===id)n.catId='';});
    renderNoteCatModalContent();
  }});
}
function persist(){
  try{localStorage.setItem(SK,JSON.stringify({qs,nid,cats,gami}));}
  catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22)){
      showToast('Penyimpanan penuh! Hapus beberapa gambar besar.','warn');
    }else{
      showToast('Gagal menyimpan: '+escHtml(e&&e.message?e.message:'error tidak dikenal'),'warn');
      console.error('persist() error:',e);
    }
  }
}

