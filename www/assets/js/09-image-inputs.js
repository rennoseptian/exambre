/* ── IMAGE AREAS ── */
function getArea(id){if(!imgAreas[id])imgAreas[id]=[];return imgAreas[id];}
function renderImgArea(areaId){
  const el=document.getElementById('img-area-'+areaId);if(!el)return;
  const items=getArea(areaId);
  el.innerHTML=`<div class="img-input-area">
    <div class="img-input-area-title"><i class="ti ti-photo" style="font-size:13px"></i> Tambah Gambar</div>
    <div class="img-input-row">
      <input class="img-url-input" id="url-input-${areaId}" placeholder="Paste URL gambar">
      <button class="img-url-btn" onclick="addImgFromUrl('${areaId}')"><i class="ti ti-link" style="font-size:12px"></i> Tambah</button>
    </div>
    <div class="img-dropzone-sm" ondragover="onDrag(event,this)" ondragleave="offDrag(this)" ondrop="onDropArea(event,'${areaId}')">
      <input type="file" accept="image/*" multiple onchange="onFileArea(event,'${areaId}')">
      <p><i class="ti ti-upload" style="font-size:14px;margin-bottom:2px;display:block"></i>Upload / drag file gambar (maks 4MB)</p>
    </div>
    <div class="stored-imgs" id="stored-${areaId}">${items.map((img,i)=>renderScaleWrap(areaId,i,img)).join('')}</div>
  </div>`;
  const urlInp=document.getElementById('url-input-'+areaId);
  if(urlInp){
    urlInp.addEventListener('paste',e=>{const txt=e.clipboardData.getData('text');if(txt&&isUrl(txt)){e.preventDefault();urlInp.value=txt;addImgFromUrl(areaId);}});
    urlInp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addImgFromUrl(areaId);}});
  }
}
function renderScaleWrap(areaId,idx,img){
  return`<div class="img-stored-item" id="sw-${areaId}-${idx}">
    <img src="${img.src}" alt="" style="max-height:200px;max-width:100%;object-fit:contain" onclick="openLB('${img.src}')">
    <button class="rm-img-btn" onclick="rmAreaImg('${areaId}',${idx})" aria-label="Hapus gambar"><i class="ti ti-trash" style="font-size:12px"></i></button>
  </div>`;
}
function rmAreaImg(areaId,idx){getArea(areaId).splice(idx,1);renderImgArea(areaId);}
function isUrl(s){try{const u=new URL(s);return u.protocol==='http:'||u.protocol==='https:';}catch{return false;}}
async function addImgFromUrl(areaId){
  const inp=document.getElementById('url-input-'+areaId);if(!inp)return;
  const val=inp.value.trim();if(!val)return;
  if(!isUrl(val)){showToast('URL tidak valid','warn');return;}
  getArea(areaId).push({src:val,width:120});inp.value='';renderImgArea(areaId);
}
function onDrag(e,el){e.preventDefault();el.classList.add('drag');}
function offDrag(el){el.classList.remove('drag');}
async function onDropArea(e,areaId){
  e.preventDefault();e.currentTarget.classList.remove('drag');
  for(const f of[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/'))){
    const b=await compressImg(f);if(b)getArea(areaId).push({src:b,width:120});
  }
  renderImgArea(areaId);
}
async function onFileArea(e,areaId){
  for(const f of[...e.target.files]){const b=await compressImg(f);if(b)getArea(areaId).push({src:b,width:120});}
  renderImgArea(areaId);
}

document.addEventListener('paste',async e=>{
  if(document.activeElement&&document.activeElement.classList.contains('img-url-input'))return;
  const panel=document.getElementById('add-panel');
  const editOpen=document.querySelector('.inline-edit.on');
  if((!panel||panel.style.display==='none')&&!editOpen)return;
  const active=document.activeElement;
  if(active&&(active.classList.contains('rte-area')||active.tagName==='TEXTAREA'||active.tagName==='INPUT'))return;
  const imgItem=[...e.clipboardData.items].find(it=>it.type.startsWith('image/'));
  if(!imgItem)return;
  e.preventDefault();
  const b=await compressImg(imgItem.getAsFile());
  if(!b)return;
  let targetArea=null;
  if(editOpen){targetArea='edit-eimgs-'+editOpen.dataset.qid;}
  else{const isManual=document.getElementById('mode-manual').style.display==='block';targetArea=isManual?'m-eimgs':'p-eimgs';}
  getArea(targetArea).push({src:b,width:120});renderImgArea(targetArea);
});

/* ── MANUAL OPT ROWS ── */
function buildManualOptRows(prefix='m',existingOpts={}){
  const el=document.getElementById(prefix+'-opt-rows');if(!el)return;
  el.innerHTML=LETTERS.map(l=>`
    <div class="opt-row-wrap"><div class="opt-lbl">${l}</div>
      <div class="opt-row-inner">
        <div class="opt-ce" id="${prefix}-opt-${l}" contenteditable="true" spellcheck="false" data-ph="Pilihan ${l}">${existingOpts[l]||''}</div>
        <div class="opt-ce-hint"><i class="ti ti-photo" style="font-size:10px;vertical-align:-1px"></i> Ctrl+V paste gambar langsung</div>
      </div>
    </div>`).join('');
  LETTERS.forEach(l=>{
    const ce=document.getElementById(prefix+'-opt-'+l);if(!ce)return;
    ce.addEventListener('paste',async e=>{
      const items=[...e.clipboardData.items];
      const imgItem=items.find(it=>it.type.startsWith('image/'));
      if(imgItem){e.preventDefault();const b=await compressImg(imgItem.getAsFile());if(b)document.execCommand('insertImage',false,b);return;}
      const text=e.clipboardData.getData('text/plain').trim();
      if(text&&isUrl(text)){e.preventDefault();document.execCommand('insertImage',false,text);return;}
    });
    ce.addEventListener('click',e=>{if(e.target.tagName==='IMG')openLB(e.target.src);});
  });
}

/* ── OPT IMAGE ── */
function renderOptImgScaled(html,qid,letter,legacyImgSrc){
  if(!html&&!legacyImgSrc)return'';
  let content=html||'';
  content=content.replace(/<img([^>]*)>/gi,(match,attrs)=>{
    const srcM=attrs.match(/src=["']([^"']+)["']/i);const src=srcM?srcM[1]:'';if(!src)return match;
    return`<img src="${src}" style="max-height:120px;max-width:100%;width:auto;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin:3px 0;cursor:pointer" onclick="openLB('${src}')">`;
  });
  if(!html&&legacyImgSrc){content=`<img src="${legacyImgSrc}" style="max-height:120px;max-width:100%;width:auto;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin:3px 0;cursor:pointer" onclick="openLB('${legacyImgSrc}')">`;}
  return content;
}

