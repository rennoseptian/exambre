/* ── PANEL ── */
function togglePanel(){
  if(getCatKeys().length===0){
    const inp=document.getElementById('onboard-cat-inp');
    if(inp){
      inp.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>inp.focus(),350);
    } else {
      goSec('list',document.querySelector('.bnav-item'));
      setTimeout(()=>{
        const inp2=document.getElementById('onboard-cat-inp');
        if(inp2){inp2.scrollIntoView({behavior:'smooth',block:'center'});inp2.focus();}
      },200);
    }
    return;
  }
  const p=document.getElementById('add-panel'),isOpen=p.style.display!=='none';
  p.style.display=isOpen?'none':'block';
  if(isOpen){hideScanPreview();}
  if(!isOpen){
    populateCatSelects();populateAnswerSelects('p-wrong','p-correct');populateAnswerSelects('m-wrong','m-correct');
    syncAddPanelAI();restoreAddCat();renderPreview();
    // Form Tambah Soal adalah DRAFT: menutup lalu membuka lagi TIDAK boleh
    // menghapus ketikan/gambar user. Hanya Simpan & tombol Batal yang mereset.
    const rows=document.getElementById('m-opt-rows');
    if(rows&&!rows.children.length)buildManualOptRows('m');
    ['p-qimgs','p-eimgs','m-qimgs','m-eimgs'].forEach(k=>renderImgArea(k));
    setTimeout(bindPasteArea,50);
  }
}
function cancelAddPanel(){
  resetAddForm();
  const p=document.getElementById('add-panel');
  if(p&&p.style.display!=='none'){p.style.display='none';hideScanPreview();}
}
function switchMode(m,btn){
  document.querySelectorAll('.t2').forEach(t=>{t.classList.remove('on');t.setAttribute('aria-selected','false');});
  btn.classList.add('on');btn.setAttribute('aria-selected','true');
  document.getElementById('mode-paste').style.display=m==='paste'?'block':'none';
  document.getElementById('mode-manual').style.display=m==='manual'?'block':'none';
  if(m==='manual'){
    // Jangan bangun ulang baris opsi yang sudah ada: pindah tab Paste↔Manual
    // tidak boleh menghapus ketikan user (baris awal sudah dibuat loadData()).
    const rows=document.getElementById('m-opt-rows');
    if(rows&&!rows.children.length)buildManualOptRows('m');
    ['m-qimgs','m-eimgs'].forEach(k=>{if(!imgAreas[k])imgAreas[k]=[];renderImgArea(k);});
  }
}
function rteCmd(w,cmd){const el=document.getElementById('rte-'+w);if(el){el.focus();document.execCommand(cmd,false,null);}}

/* ── PASTE & PARSE ── */
/* ── PASTE & PARSE (pembaca baru: banyak soal sekaligus, kunci dipilih di pratinjau) ── */
function aiConfigured(){try{return !!((typeof getCustomAI==='function'&&getCustomAI())||localStorage.getItem('exambre_gemini_key'));}catch(e){return false;}}
function syncAddPanelAI(){const on=aiConfigured();document.querySelectorAll('#add-panel .ai-only').forEach(el=>{el.style.display=on?'':'none';});}
function openManualMode(){const b=document.querySelector('#add-panel .t2[onclick*="manual"]');if(b)switchMode('manual',b);}
function openPasteMode(){const b=document.querySelector('#add-panel .t2[onclick*="paste"]');if(b)switchMode('paste',b);}
function rememberAddCat(c,b){try{localStorage.setItem('exambre_add_last',JSON.stringify({c:c,b:b}));}catch(e){}}
function restoreAddCat(){
  try{
    const ta=document.getElementById('paste-ta');if(ta&&ta.textContent.trim())return;          // jangan ganggu draf
    const v=JSON.parse(localStorage.getItem('exambre_add_last')||'null');if(!v||!cats[v.c])return;
    const sc=document.getElementById('p-cat');if(!sc)return;sc.value=v.c;updateBabSelect('p-bab','p-cat');
    const sb=document.getElementById('p-bab');if(sb&&v.b&&[...sb.options].some(o=>o.value===v.b))sb.value=v.b;
  }catch(e){}
}
function clearPasteArea(){
  const el=document.getElementById('paste-ta');if(el)el.innerHTML='';
  window._lastParsed=null;renderPreview();
}
function pvItems(){return (window._lastParsed&&window._lastParsed.items)||[];}
function pvStrip(o){return String(o||'').replace(/<img[^>]*>/gi,' [gambar] ').replace(/<br\s*\/?>|&nbsp;/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
function pvOptCount(it){return (it.opts||[]).filter(o=>pvStrip(o)).length;}
function pvSig(it){return (it.q||'').slice(0,60)+'|'+(it.opts||[]).join('|').slice(0,80);}
function runParseFromRich(){
  const el=document.getElementById('paste-ta');if(!el)return;
  const html=el.innerHTML,text=el.innerText||'';
  const hasImg=/<img\b/i.test(html);
  const prev={};pvItems().forEach(it=>{if(it.correct&&!it.fromText)prev[pvSig(it)]=it.correct;});   // pilihan kunci user bertahan saat teks diedit
  let items=[];
  if(text.trim()||hasImg){
    if(hasImg){                                   // ada gambar: pakai jalur lama (satu soal + gambar)
      const r=parseRichContent(html,text);
      items=[{q:r.q||text.trim(),opts:(r.opts||[]).slice(0,5),optImgs:r.optImgsRich||{},qimgs:r.qImgsFromPaste||[],correct:r.correct||'',wrong:r.wrong||'',cat:r.cat||'',exp:'',warn:''}];
    }else{
      items=parseQuestions(text).map(it=>({q:it.q,opts:it.opts,optImgs:{},qimgs:[],correct:it.correct,wrong:it.wrong,cat:it.cat,exp:it.exp,warn:it.warn}));
    }
    items.forEach(it=>{it.fromText=!!it.correct;if(!it.correct&&prev[pvSig(it)])it.correct=prev[pvSig(it)];});
  }
  window._lastParsed={items};
  const c0=items.find(it=>it.cat&&cats[it.cat]);
  if(c0){const sc=document.getElementById('p-cat');if(sc){sc.value=c0.cat;updateBabSelect('p-bab','p-cat');}}
  renderPreview();
}
function renderPreview(){
  const out=document.getElementById('parsed-out'),panel=document.getElementById('add-panel'),items=pvItems();
  if(panel)panel.classList.toggle('pv-multi',items.length>1);
  if(panel)panel.classList.toggle('has-pv',items.length>0);
  if(out){
    if(!items.length){out.style.display='none';out.innerHTML='';}
    else{out.style.display='block';out.innerHTML='<div class="pv-list">'+items.map(pvItemHtml).join('')+'</div>';}
  }
  pvFooter();
}
function pvItemHtml(it,i){
  const head='<div class="pv-q"><span class="pv-n">'+(i+1)+'</span><span class="pv-qt">'+escHtml(it.q||'(tanpa teks soal)')+'</span><button type="button" class="pv-drop" aria-label="Buang soal '+(i+1)+'" onclick="pvDrop('+i+')">×</button></div>';
  if(pvOptCount(it)<2)return '<div class="pv-item bad" data-i="'+i+'">'+head+'<p class="pv-warn">'+escHtml(it.warn||'Pilihan jawaban tidak terbaca.')+' Isi soal ini lewat "Tulis manual".</p></div>';
  const rows=(it.opts||[]).map((o,k)=>({o,k})).filter(x=>pvStrip(x.o)).map(x=>{
    const l=LETTERS[x.k],on=it.correct===l;
    return '<button type="button" class="pv-opt'+(on?' on':'')+'" role="radio" aria-checked="'+on+'" data-l="'+l+'" onclick="pvPick('+i+',\''+l+'\')"><b>'+l+'</b><span>'+escHtml(pvStrip(x.o))+'</span></button>';
  }).join('');
  return '<div class="pv-item" data-i="'+i+'">'+head+'<div class="pv-opts" role="radiogroup" aria-label="Jawaban benar soal '+(i+1)+'">'+rows+'</div><p class="pv-hint'+(it.correct?'':' need')+'">'+(it.correct?'Kunci: '+it.correct+(it.fromText?' (dari teks)':''):'Ketuk jawaban yang benar.')+'</p></div>';
}
function pvPick(i,l){
  const it=pvItems()[i];if(!it)return;it.correct=l;it.fromText=false;
  const el=document.querySelector('#parsed-out .pv-item[data-i="'+i+'"]');
  if(el){
    el.querySelectorAll('.pv-opt').forEach(b=>{const on=b.dataset.l===l;b.classList.toggle('on',on);b.setAttribute('aria-checked',on);});
    const h=el.querySelector('.pv-hint');if(h){h.className='pv-hint';h.textContent='Kunci: '+l;}
  }
  if(pvItems().length===1){const sel=document.getElementById('p-correct');if(sel)sel.value=l;}
  pvFooter();
}
function pvDrop(i){const pv=window._lastParsed;if(!pv)return;pv.items.splice(i,1);renderPreview();}
function pvFooter(){
  const btn=document.getElementById('add-save-btn'),lbl=document.getElementById('add-save-label'),hint=document.getElementById('add-hint');if(!btn)return;
  const items=pvItems(),bad=items.filter(it=>pvOptCount(it)<2).length,miss=items.filter(it=>pvOptCount(it)>=2&&!it.correct).length;
  btn.disabled=!(items.length&&!bad&&!miss);
  if(lbl)lbl.textContent=items.length>1?'Simpan '+items.length+' soal':'Simpan soal';
  if(hint)hint.textContent=!items.length?'':bad?'Ada soal yang pilihannya tidak terbaca.':miss?(items.length>1?'Pilih jawaban benar di '+miss+' soal.':'Pilih jawaban yang benar.'):'';
}
function parseRichContent(html,plainText){
  let q='',opts=new Array(5).fill(''),optImgsRich={},correct='',wrong='',cat='',qImgsFromPaste=[];
  const catM=plainText.match(/\b(TIU|TWK|TKP|TBI|TPA)\b/);if(catM)cat=catM[1].toUpperCase();
  const ansM=plainText.match(/(?:jawaban|kunci|answer)[:\s]+([A-E])\b/i);if(ansM)correct=ansM[1].toUpperCase();
  const wrongM=plainText.match(/(?:jawaban saya|pilihan saya|saya memilih)[:\s]+([A-E])\b/i);if(wrongM)wrong=wrongM[1].toUpperCase();
  const tmp=document.createElement('div');tmp.innerHTML=html;
  const candidates={};
  const w=document.createTreeWalker(tmp,NodeFilter.SHOW_ELEMENT);let n=w.nextNode();
  while(n){
    const t=(n.innerText||n.textContent||'').trimStart();
    const m=t.match(/^([A-E])(?:[.\):\s])/);
    if(m&&!candidates[m[1]])candidates[m[1]]=[];
    if(m&&(n.querySelector('img')||t.length<350))candidates[m[1]].push(n);
    n=w.nextNode();
  }
  const optEls={};
  Object.keys(candidates).forEach(l=>{
    const arr=candidates[l];if(!arr.length)return;
    let best=arr[arr.length-1];
    for(let i=arr.length-1;i>=0;i--){
      const el=arr[i];const t=(el.innerText||el.textContent||'').trim();
      const others='ABCDE'.replace(l,'');let otherCount=0;
      for(const ol of others){if(new RegExp('\\b'+ol+'[.\\):]?\\s').test(t))otherCount++;}
      if(otherCount<2){best=el;break;}
    }
    optEls[l]=best;
  });
  const foundLetters=Object.keys(optEls).sort();
  if(foundLetters.length>=2){
    foundLetters.forEach(l=>{
      const el=optEls[l];const img=el.querySelector('img');
      const rawTxt=(el.innerText||el.textContent||'').trimStart();
      const txt=rawTxt.replace(/^[A-E][.\):\s]\s*/,'').trim();
      const idx=LETTERS.indexOf(l);if(idx<0)return;
      if(img){opts[idx]=txt?`${txt}<br><img src="${escHtml(img.src)}" alt="Gambar pilihan ${l}" style="max-height:100px;border-radius:4px">`:`<img src="${escHtml(img.src)}" alt="Gambar pilihan ${l}" style="max-height:100px;border-radius:4px">`;optImgsRich[l]=img.src;}
      else opts[idx]=txt;
    });
    const clone=tmp.cloneNode(true);
    foundLetters.forEach(l=>{
      const cw=document.createTreeWalker(clone,NodeFilter.SHOW_ELEMENT);let cn=cw.nextNode();
      while(cn){const t=(cn.innerText||cn.textContent||'').trimStart();if(t.match(new RegExp('^'+l+'[.\\):\\s]'))){cn.remove();break;}cn=cw.nextNode();}
    });
    clone.innerHTML=clone.innerHTML.replace(/(?:jawaban|kunci|answer)[:\s]+[A-E]\b[^<]*/gi,'').replace(/>\s*[A-E]\s*</g,'><');
    const allImgSrcs=new Set([...tmp.querySelectorAll('img')].map(i=>i.src).filter(Boolean));
    const optImgSrcs=new Set(Object.values(optImgsRich).filter(Boolean));
    allImgSrcs.forEach(src=>{if(!optImgSrcs.has(src))qImgsFromPaste.push({src,width:120});});
    clone.querySelectorAll('img').forEach(i=>i.remove());
    let rawQ=(clone.innerText||clone.textContent||'').replace(/\s+/g,' ').trim();
    rawQ=rawQ.replace(/^([A-E]\s*){2,}/,'').replace(/^\[(TIU|TWK|TKP|TBI|TPA)\]\s*/i,'').trim();
    q=rawQ;
    return{q,opts,optImgsRich,correct,wrong,cat,qImgsFromPaste};
  }
  const r=parseText(plainText);return{...r,optImgsRich:{},qImgsFromPaste:[]};
}
function parseText(raw){
  if(!raw||!raw.trim())return{q:'',opts:[],wrong:'',correct:'',cat:''};
  let q='',opts=[],correct='',wrong='',cat='';
  const catM=raw.match(/\b(TIU|TWK|TKP|TBI|TPA)\b/);if(catM)cat=catM[1].toUpperCase();
  const ansM=raw.match(/(?:jawaban|kunci|answer)[:\s]+([A-E])\b/i);if(ansM)correct=ansM[1].toUpperCase();
  const wrongM=raw.match(/(?:jawaban saya|pilihan saya|saya memilih)[:\s]+([A-E])\b/i);if(wrongM)wrong=wrongM[1].toUpperCase();
  let txt=raw.replace(/(?:jawaban|kunci|answer|jawaban saya|pilihan saya|saya memilih)[:\s]+[A-E]\b/gi,'').trim();
  if(/^[A-Ea-e][\.:\)]\s+\S/m.test(txt)){
    const lines=txt.split(/\n/).map(l=>l.trim()).filter(Boolean);let qLines=[],inOpts=false;
    for(const l of lines){if(/^[A-Ea-e][\.:\)]\s/.test(l)){inOpts=true;opts.push(l.replace(/^[A-Ea-e][\.:\)]\s+/,'').trim());continue;}if(!inOpts)qLines.push(l);}
    q=qLines.join(' ').trim();if(opts.length>=2)return{q:q.replace(/^\[(TIU|TWK|TKP|TBI|TPA)\]\s*/i,'').trim(),opts,correct,wrong,cat};
  }
  return{q:txt.replace(/^\[(TIU|TWK|TKP|TBI|TPA)\]\s*/i,'').trim(),opts,correct,wrong,cat};
}

/* ── SAVE ── */
function saveFromPaste(){
  const items=pvItems();
  if(!items.length){showToast('Tempel soalnya dulu.','warn');return;}
  if(items.some(it=>pvOptCount(it)<2)){showToast('Ada soal yang pilihannya tidak terbaca.','warn');return;}
  if(items.some(it=>!it.correct)){showToast('Pilih jawaban yang benar dulu.','warn');return;}
  const single=items.length===1;
  const catV=document.getElementById('p-cat').value,babV=(document.getElementById('p-bab')||{value:''}).value||'';
  const rteExp=single?document.getElementById('rte-p').innerHTML.trim():'';
  const manualQImgs=single?(getArea('p-qimgs')||[]):[],eimgs=single?[...getArea('p-eimgs')]:[];
  const userWrong=single?document.getElementById('p-wrong').value:'';
  items.forEach(it=>{
    const opts=it.opts.slice(0,5);while(opts.length<5)opts.push('');
    const wrong=(userWrong&&userWrong!==it.correct&&userWrong)||(it.wrong&&it.wrong!==it.correct&&it.wrong)||(it.correct==='A'?'B':'A');
    const cat=it.cat&&cats[it.cat]?it.cat:catV;
    qs.push({id:nid++,cat,bab:cat===catV?babV:'',q:it.q,opts,optImgs:it.optImgs||{},wrong,correct:it.correct,expHtml:rteExp||(it.exp?escHtml(it.exp):''),qimgs:[...(it.qimgs||[]),...manualQImgs],eimgs:[...eimgs],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
  });
  rememberAddCat(catV,babV);
  persist();togglePanel();resetAddForm();render();
  showToast(items.length>1?items.length+' soal ditambahkan.':'Soal ditambahkan.','ok');
}
function saveManual(){
  const q=document.getElementById('m-q').value.trim();
  if(!q){showToast('Tulis pertanyaan terlebih dahulu!','warn');return;}
  const opts=LETTERS.map(l=>{const ce=document.getElementById('m-opt-'+l);return ce?ce.innerHTML.trim():'';});
  const hasOpts=opts.some(o=>o&&o!=='<br>');
  if(!hasOpts){showToast('Isi minimal satu pilihan jawaban!','warn');return;}
  const optImgs={};
  LETTERS.forEach((l,li)=>{const opt=opts[li]||'';const m=opt.match(/<img[^>]+src=["']([^"']+)["']/i);if(m)optImgs[l]=m[1];});
  qs.push({id:nid++,cat:document.getElementById('m-cat').value,bab:(document.getElementById('m-bab')||{value:''}).value||'',q,opts,optImgs,wrong:document.getElementById('m-wrong').value,correct:document.getElementById('m-correct').value,expHtml:document.getElementById('rte-m').innerHTML.trim(),qimgs:[...getArea('m-qimgs')],eimgs:[...getArea('m-eimgs')],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
  persist();togglePanel();resetAddForm();render();
  showToast('Soal ditambahkan.','ok');
}
function resetAddForm(){
  const ta=document.getElementById('paste-ta');if(ta)ta.innerHTML='';
  const mq=document.getElementById('m-q');if(mq)mq.value='';
  const rp=document.getElementById('rte-p');if(rp)rp.innerHTML='';
  const rm=document.getElementById('rte-m');if(rm)rm.innerHTML='';
  LETTERS.forEach(l=>{const ce=document.getElementById('m-opt-'+l);if(ce)ce.innerHTML='';});
  const po=document.getElementById('parsed-out');if(po)po.style.display='none';
  window._lastParsed=null;renderPreview();['p-qimgs','p-eimgs','m-qimgs','m-eimgs'].forEach(k=>{imgAreas[k]=[];});
}

