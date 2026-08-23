/* ── RENDER ── */
function render(){
  buildCatTabs();updateBabFilter();updateDueBadge();renderGami();checkBadges();
  const list=getFiltered(),el=document.getElementById('qlist');
  if(!qs.length&&getCatKeys().length===0){
    el.innerHTML=`<div class="onboard-card">
  <i class="ti ti-book-2" style="font-size:40px;color:var(--accent);margin-bottom:12px;display:block"></i>
  <h3 style="font-size:16px;font-weight:700;margin-bottom:6px">Selamat datang di Exambre!</h3>
  <p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">
    Mulai dengan membuat kategori soal pertama kamu — misalnya TIU, TWK, atau TKP.
  </p>
  <div style="display:flex;gap:8px;justify-content:center">
    <input id="onboard-cat-inp" placeholder="Nama kategori (cth: TIU)" 
      style="font-size:13px;border:1px solid var(--border2);border-radius:var(--radius);padding:8px 12px;background:var(--bg);color:var(--text);font-family:inherit;flex:1;max-width:220px"
      onkeydown="if(event.key==='Enter')onboardCreateCat()">
    <button class="btn btn-p" onclick="onboardCreateCat()">
      <i class="ti ti-plus"></i> Buat Kategori
    </button>
  </div>
</div>`;
    return;
  }
  if(!list.length){
    el.innerHTML='<div class="empty"><i class="ti ti-books"></i><p>'+(searchQ?`Soal dengan kata "<b>${searchQ}</b>" tidak ditemukan.`:'Belum ada soal'+(curCat!=='ALL'?' untuk kategori ini':'')+'.<br>Tambahkan soal yang salah dijawab biar bisa dilatih ulang.')+'</p>'+(searchQ?'':'<button class="btn btn-p" style="margin-top:16px" onclick="togglePanel()"><i class="ti ti-plus"></i> Tambah Soal</button>')+'</div>';
    return;
  }
  el.innerHTML=list.map((q,i)=>renderQCard(q,i)).join('');
}
function onboardCreateCat(){
  const inp=document.getElementById('onboard-cat-inp');
  const name=inp?inp.value.trim():'';
  if(!name){showToast('Masukkan nama kategori dulu','warn');return;}
  const key=name.toUpperCase().replace(/\s+/g,'_').slice(0,10);
  cats[key]={name,color:'#EAF1FE',textColor:'#3552CC',babs:['Umum']};
  persist();
  buildCatTabs();
  populateCatSelects();
  render();
  showToast('Kategori "'+name+'" berhasil dibuat!','ok');
  togglePanel();
}

function renderQCard(q,i){
  const catStyle=catBadgeStyle(q.cat);
  const catName=cats[q.cat]?(cats[q.cat].name||q.cat):q.cat;
  // FIX BUG #4: filter opsi kosong
  const validOpts=(q.opts||[]).filter((o,oi)=>LETTERS[oi]&&(o&&o.trim()&&o!=='<br>'));
  const hasImgs=validOpts.some(o=>o&&o.includes('<img'))||Object.keys(q.optImgs||{}).length>0;
  return`<div class="qcard" id="qcard-${q.id}">
    <div class="qmeta">
      <div class="qmeta-left">
        <span style="font-size:11px;color:var(--text2)">${i+1}.</span>
        <span class="badge" style="${catStyle}">${catName}</span>
        ${q.bab?`<span class="badge-bab">${q.bab}</span>`:''}
        ${q.mastered?'<span class="bM"><i class="ti ti-check" style="font-size:10px"></i> Dikuasai</span>':''}
      </div>
      <div class="qacts nopr">
        <button class="ibtn" title="Tanya Tutor" aria-label="Tanya Tutor" onclick="openTutor(${q.id})"><i class="ti ti-message-circle"></i></button>
        <button class="ibtn" title="Buat variasi soal serupa" aria-label="Buat variasi soal serupa" onclick="buatVariasi(${q.id},this)"><i class="ti ti-arrows-shuffle"></i></button>
        <button class="ibtn edit-btn" title="Edit" onclick="toggleInlineEdit(${q.id})" aria-label="Edit soal"><i class="ti ti-pencil"></i></button>
        <button class="ibtn ok" title="${q.mastered?'Tandai belum dikuasai':'Tandai dikuasai'}" onclick="toggleM(${q.id})" aria-label="${q.mastered?'Tandai belum dikuasai':'Tandai dikuasai'}"><i class="ti ti-${q.mastered?'rotate':'check'}"></i></button>
        <button class="ibtn del" title="Hapus" onclick="delQ(${q.id})" aria-label="Hapus soal"><i class="ti ti-trash"></i></button>
      </div>
    </div>
    <p class="qtext">${sanitizeHtml((q.q||'').replace(/^(\s*[A-E]\s*){2,}/,'').trim())}</p>
    ${renderImgList(q.id,q.qimgs)}
    <div class="opts-list${hasImgs?' has-images':''}">
      ${(q.opts||[]).map((o,oi)=>{
        if(!LETTERS[oi])return'';
        const l=LETTERS[oi];
        if(!o||!o.trim()||o==='<br>')return''; // FIX: skip empty opts
        let c='';if(l===q.wrong)c='ow';if(l===q.correct)c='oc';
        const imgSrc=q.optImgs&&q.optImgs[l]?q.optImgs[l]:'';
        const scaled=renderOptImgScaled(sanitizeHtml(o),q.id,l,imgSrc);
        return`<div class="opt-item ${c}"><span class="ltr">${l}</span><div class="opt-html-content">${scaled}</div>${l===q.wrong?'<span class="opt-tag">✗ jawaban saya</span>':''}${l===q.correct?'<span class="opt-tag">✓ benar</span>':''}</div>`;
      }).join('')}
    </div>
    ${renderExpBlock(q)}
    <div class="inline-edit" id="inline-edit-${q.id}" data-qid="${q.id}"></div>
  </div>`;
}

function renderImgList(qid,imgs){
  if(!imgs||!imgs.length)return'';
  return`<div class="qimgs-section">`+imgs.map((img)=>{
    const ei=typeof img==='string'?{src:img}:img;
    return`<img src="${ei.src}" alt="" style="max-height:200px;max-width:100%;object-fit:contain;border-radius:var(--radius);border:0.5px solid var(--border);cursor:pointer;display:block" onclick="openLB('${ei.src}')">`;
  }).join('')+'</div>';
}
function renderExpBlock(q){
  const eimgsHtml=q.eimgs&&q.eimgs.length?'<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">'+q.eimgs.map((img,ii)=>{const ei=typeof img==='string'?{src:img}:img;return`<div class="img-stored-item"><img src="${ei.src}" alt="" style="max-height:200px;max-width:100%;object-fit:contain;border-radius:var(--radius);border:0.5px solid var(--border);cursor:pointer;display:block" onclick="openLB('${ei.src}')"><button class="rm-img-btn" onclick="rmStoredEimg(${q.id},${ii})" aria-label="Hapus gambar"><i class="ti ti-trash" style="font-size:12px"></i></button></div>`;}).join('')+'</div>':'';
  const genBtn=`<div style="margin-top:8px"><button id="gen-exp-btn-${q.id}" class="btn btn-s" onclick="generateExp(${q.id})" style="font-size:12px;gap:5px" aria-label="Generate penjelasan AI untuk soal ini"><i class="ti ti-sparkles" style="color:var(--accent)"></i> Generate Penjelasan</button></div>`;
  if(q.expHtml){
    return`<div class="exp-block"><div class="exp-label"><i class="ti ti-bulb" style="font-size:11px;vertical-align:-1px"></i> Pembahasan</div>
    <div class="exp-content">${sanitizeHtml(q.expHtml)}</div>${eimgsHtml}
  </div>`;
  }
  if(eimgsHtml){
    return`<div class="exp-block"><div class="exp-label"><i class="ti ti-bulb" style="font-size:11px;vertical-align:-1px"></i> Pembahasan</div>${eimgsHtml}
  </div>${genBtn}`;
  }
  return genBtn;
}
function buildInlineEditHTML(q){
  return`<div class="inline-edit-title"><i class="ti ti-pencil"></i> Edit Soal</div>
    <div class="g2">
      <div class="field"><label>Kategori</label><select id="e-cat-${q.id}" onchange="updateBabSelectEdit(${q.id})">
        ${getCatKeys().map(k=>`<option value="${k}"${q.cat===k?' selected':''}>${cats[k].name||k}</option>`).join('')}
      </select></div>
      <div class="field"><label>Sub-Bab</label><select id="e-bab-${q.id}">
        ${(cats[q.cat]?cats[q.cat].babs:[]).map(b=>`<option value="${b}"${q.bab===b?' selected':''}>${b}</option>`).join('')}
      </select></div>
    </div>
    <div class="field"><label>Pertanyaan</label><textarea id="e-q-${q.id}" rows="3">${q.q}</textarea></div>
    <div class="field"><label>Pilihan Jawaban (A–E)</label>
      ${LETTERS.map(l=>`<div class="opt-row-wrap" style="margin-bottom:6px"><div class="opt-lbl">${l}</div><div class="opt-row-inner"><div class="opt-ce" id="e-opt-${q.id}-${l}" contenteditable="true" spellcheck="false" data-ph="Pilihan ${l}">${(q.opts&&q.opts[LETTERS.indexOf(l)])||''}</div><div class="opt-ce-hint"><i class="ti ti-photo" style="font-size:10px;vertical-align:-1px"></i> Ctrl+V paste gambar</div></div></div>`).join('')}
    </div>
    <div class="g2">
      <div class="field"><label>Jawaban saya (salah)</label><select id="e-wrong-${q.id}">${LETTERS.map(l=>`<option value="${l}"${q.wrong===l?' selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Jawaban benar</label><select id="e-correct-${q.id}">${LETTERS.map(l=>`<option value="${l}"${q.correct===l?' selected':''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Gambar soal</label><div id="img-area-edit-qimgs-${q.id}"></div></div>
    <div class="field"><label>Pembahasan</label>
      <div class="rte-toolbar"><button class="rte-btn" onclick="rteCmd('e-${q.id}','bold')" aria-label="Tebal"><b>B</b></button><button class="rte-btn" onclick="rteCmd('e-${q.id}','italic')" aria-label="Miring"><i>I</i></button><button class="rte-btn" onclick="rteCmd('e-${q.id}','underline')" aria-label="Garis bawah"><u>U</u></button><div class="rte-sep"></div><button class="rte-btn" onclick="rteCmd('e-${q.id}','insertUnorderedList')" aria-label="Daftar bullet"><i class="ti ti-list"></i></button><button class="rte-btn" onclick="rteCmd('e-${q.id}','insertOrderedList')" aria-label="Daftar bernomor"><i class="ti ti-list-numbers"></i></button><div class="rte-sep"></div><button class="rte-btn" onclick="rteCmd('e-${q.id}','removeFormat')" aria-label="Hapus format"><i class="ti ti-clear-formatting"></i></button></div>
      <div class="rte-area" id="rte-e-${q.id}" contenteditable="true" spellcheck="false">${q.expHtml||''}</div>
    </div>
    <div class="field"><label>Gambar pembahasan <span style="font-weight:400;color:var(--text3)">(Ctrl+V screenshot)</span></label><div id="img-area-edit-eimgs-${q.id}"></div></div>
    <div class="btn-row">
      <button class="btn btn-warn" onclick="toggleInlineEdit(${q.id})">Batal</button>
      <button class="btn btn-p" onclick="saveEdit(${q.id})"><i class="ti ti-device-floppy"></i> Simpan Perubahan</button>
    </div>`;
}

/* ── INLINE EDIT ── */
function toggleInlineEdit(id){
  const el=document.getElementById('inline-edit-'+id);if(!el)return;
  const isOpen=el.classList.contains('on');
  document.querySelectorAll('.inline-edit.on').forEach(e=>{e.classList.remove('on');e.innerHTML='';});
  if(!isOpen){
    const q=qs.find(x=>x.id===id);if(!q)return;
    el.innerHTML=buildInlineEditHTML(q);
    el.classList.add('on');
    imgAreas['edit-qimgs-'+id]=(q.qimgs||[]).map(i=>typeof i==='string'?{src:i,width:120}:i);
    imgAreas['edit-eimgs-'+id]=(q.eimgs||[]).map(i=>typeof i==='string'?{src:i,width:120}:i);
    renderImgArea('edit-qimgs-'+id);renderImgArea('edit-eimgs-'+id);
    LETTERS.forEach(l=>{
      const ce=document.getElementById('e-opt-'+id+'-'+l);if(!ce)return;
      ce.addEventListener('paste',async e=>{
        const imgItem=[...e.clipboardData.items].find(it=>it.type.startsWith('image/'));
        if(imgItem){e.preventDefault();const b=await compressImg(imgItem.getAsFile());if(b){ce.focus();document.execCommand('insertImage',false,b);}return;}
        const text=e.clipboardData.getData('text/plain').trim();
        if(text&&isUrl(text)){e.preventDefault();ce.focus();document.execCommand('insertImage',false,text);return;}
      });
      ce.addEventListener('click',e=>{if(e.target.tagName==='IMG')openLB(e.target.src);});
    });
  }
}
function updateBabSelectEdit(id){
  const catSel=document.getElementById('e-cat-'+id),babSel=document.getElementById('e-bab-'+id);
  if(!catSel||!babSel)return;
  const c=cats[catSel.value];babSel.innerHTML=(c?c.babs:[]).map(b=>`<option value="${b}">${b}</option>`).join('');
}
// FIX BUG #1: hapus double optImgs reset, hanya ekstrak dari HTML
function saveEdit(id){
  const q=qs.find(x=>x.id===id);if(!q)return;
  q.cat=document.getElementById('e-cat-'+id).value;
  const babSel=document.getElementById('e-bab-'+id);q.bab=babSel?babSel.value:'';
  q.q=document.getElementById('e-q-'+id).value.trim();
  q.opts=LETTERS.map(l=>{const ce=document.getElementById('e-opt-'+id+'-'+l);return ce?ce.innerHTML.trim():'';});
  // Bangun optImgs hanya dari inline <img> dalam HTML opsi (TIDAK di-reset dua kali)
  q.optImgs={};
  LETTERS.forEach((l,li)=>{
    const opt=q.opts[li]||'';
    const m=opt.match(/<img[^>]+src=["']([^"']+)["']/i);
    if(m)q.optImgs[l]=m[1];
  });
  q.wrong=document.getElementById('e-wrong-'+id).value;
  q.correct=document.getElementById('e-correct-'+id).value;
  q.expHtml=document.getElementById('rte-e-'+id).innerHTML.trim();
  q.qimgs=[...getArea('edit-qimgs-'+id)];
  q.eimgs=[...getArea('edit-eimgs-'+id)];
  persist();showToast('✅ Soal berhasil diperbarui!','ok');render();
}

