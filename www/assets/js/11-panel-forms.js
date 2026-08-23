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
    ['p-qimgs','p-eimgs','m-qimgs','m-eimgs'].forEach(k=>{imgAreas[k]=[];renderImgArea(k);});
    buildManualOptRows('m');setTimeout(bindPasteArea,50);
  }
}
function switchMode(m,btn){
  document.querySelectorAll('.t2').forEach(t=>{t.classList.remove('on');t.setAttribute('aria-selected','false');});
  btn.classList.add('on');btn.setAttribute('aria-selected','true');
  document.getElementById('mode-paste').style.display=m==='paste'?'block':'none';
  document.getElementById('mode-manual').style.display=m==='manual'?'block':'none';
  if(m==='manual'){buildManualOptRows('m');['m-qimgs','m-eimgs'].forEach(k=>{if(!imgAreas[k])imgAreas[k]=[];renderImgArea(k);});}
}
function rteCmd(w,cmd){const el=document.getElementById('rte-'+w);if(el){el.focus();document.execCommand(cmd,false,null);}}

/* ── PASTE & PARSE ── */
function clearPasteArea(){
  const el=document.getElementById('paste-ta');if(el)el.innerHTML='';
  const out=document.getElementById('parsed-out');if(out)out.style.display='none';
  window._lastParsed=null;
}
function runParseFromRich(){
  const el=document.getElementById('paste-ta');if(!el)return;
  const html=el.innerHTML,text=el.innerText||'';
  if(!text.trim()&&!html.includes('<img')){const out=document.getElementById('parsed-out');if(out)out.style.display='none';return;}
  const r=parseRichContent(html,text);window._lastParsed=r;showParsedPreview(r);
  if(r.cat&&cats[r.cat]){document.getElementById('p-cat').value=r.cat;updateBabSelect('p-bab','p-cat');}
  if(r.correct)document.getElementById('p-correct').value=r.correct;
  if(r.wrong)document.getElementById('p-wrong').value=r.wrong;
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
      if(img){opts[idx]=txt?`${txt}<br><img src="${img.src}" style="max-height:100px;border-radius:4px">`:`<img src="${img.src}" style="max-height:100px;border-radius:4px">`;optImgsRich[l]=img.src;}
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
function showParsedPreview(r){
  const out=document.getElementById('parsed-out');if(!out)return;
  const hasContent=r.q||r.opts.some(Boolean);
  if(!hasContent){out.style.display='none';return;}
  let html='<div style="background:var(--bg2);border-radius:var(--radius);padding:10px 14px;font-size:13px">';
  if(r.q)html+=`<div style="display:flex;gap:8px;margin-bottom:5px"><span style="font-size:11px;color:var(--text2);min-width:70px;flex-shrink:0;font-weight:600">Soal</span><span>${r.q.substring(0,120)}${r.q.length>120?'...':''}</span></div>`;
  if(r.qImgsFromPaste&&r.qImgsFromPaste.length)html+=`<div style="display:flex;gap:8px;margin-bottom:5px"><span style="font-size:11px;color:var(--text2);min-width:70px;flex-shrink:0;font-weight:600">Gambar soal</span><span style="color:var(--accent)">🖼 ${r.qImgsFromPaste.length} gambar</span></div>`;
  const optsD=r.opts.map((o,i)=>{if(!o)return'';const l=LETTERS[i];const hasImg=(r.optImgsRich&&r.optImgsRich[l])||o.includes('<img');return`<span style="margin-right:8px"><b>${l}.</b>${hasImg?' 🖼':''}</span>`;}).filter(Boolean);
  if(optsD.length)html+=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px"><span style="font-size:11px;color:var(--text2);min-width:70px;flex-shrink:0;font-weight:600">Pilihan (${optsD.length})</span><span>${optsD.join('')}</span></div>`;
  if(r.correct)html+=`<div style="display:flex;gap:8px"><span style="font-size:11px;color:var(--text2);min-width:70px;flex-shrink:0;font-weight:600">Benar</span><span style="color:#1D9E75;font-weight:700">${r.correct}</span></div>`;
  html+='</div>';out.innerHTML=html;out.style.display='block';
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
  const paEl=document.getElementById('paste-ta');
  const plainText=(paEl?paEl.innerText||paEl.textContent:'').trim();
  const richHtml=paEl?paEl.innerHTML:'';
  const r=window._lastParsed||(richHtml?parseRichContent(richHtml,plainText):parseText(plainText));
  if(!r.q&&!plainText&&!(r.qImgsFromPaste&&r.qImgsFromPaste.length)){showToast('Tempel soal terlebih dahulu!','warn');return;}
  let opts=r.opts?r.opts.slice():[];while(opts.length<5)opts.push('');
  const correct=document.getElementById('p-correct').value||r.correct||'A';
  const wrong=document.getElementById('p-wrong').value||r.wrong||(correct==='A'?'B':'A');
  const pasteQImgs=r.qImgsFromPaste||[];const manualQImgs=getArea('p-qimgs')||[];
  qs.push({id:nid++,cat:document.getElementById('p-cat').value,bab:(document.getElementById('p-bab')||{value:''}).value||'',q:r.q||plainText,opts,optImgs:r.optImgsRich||{},wrong,correct,expHtml:document.getElementById('rte-p').innerHTML.trim(),qimgs:[...pasteQImgs,...manualQImgs],eimgs:[...getArea('p-eimgs')],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
  persist();togglePanel();resetAddForm();render();
  showToast('✅ Soal berhasil ditambahkan!','ok');
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
  showToast('✅ Soal berhasil ditambahkan!','ok');
}
function resetAddForm(){
  const ta=document.getElementById('paste-ta');if(ta)ta.innerHTML='';
  const mq=document.getElementById('m-q');if(mq)mq.value='';
  const rp=document.getElementById('rte-p');if(rp)rp.innerHTML='';
  const rm=document.getElementById('rte-m');if(rm)rm.innerHTML='';
  LETTERS.forEach(l=>{const ce=document.getElementById('m-opt-'+l);if(ce)ce.innerHTML='';});
  const po=document.getElementById('parsed-out');if(po)po.style.display='none';
  window._lastParsed=null;['p-qimgs','p-eimgs','m-qimgs','m-eimgs'].forEach(k=>{imgAreas[k]=[];});
}

