/* ── CATEGORY ── */
function getCatKeys(){return Object.keys(cats);}
function catBadgeStyle(k){const c=cats[k];if(!c)return'background:#eee;color:#333';return`background:${c.color};color:${c.textColor}`;}
function initCatScroll(scrollEl){
  if(!scrollEl)return;
  const wrap=scrollEl.closest('.cats-wrap');
  if(!wrap)return;
  function update(){
    const overflow=scrollEl.scrollWidth>scrollEl.clientWidth+2;
    wrap.classList.toggle('no-overflow',!overflow);
    if(overflow){
      const atEnd=scrollEl.scrollLeft+scrollEl.clientWidth>=scrollEl.scrollWidth-4;
      wrap.classList.toggle('at-end',atEnd);
    }
  }
  scrollEl.removeEventListener('scroll',update);
  scrollEl.addEventListener('scroll',update,{passive:true});
  if(!wrap._roInitialized){
    new ResizeObserver(update).observe(scrollEl);
    wrap._roInitialized=true;
  }
  update();
}
function buildCatTabs(){
  const el=document.getElementById('cat-tabs');if(!el)return;
  el.setAttribute('role','tablist');
  const allCount=qs.length;
  el.innerHTML=`<button class="ctab${curCat==='ALL'?' on':''}" role="tab" aria-selected="${curCat==='ALL'}" onclick="fCat('ALL',this)">Semua <span style="opacity:.6;font-size:10px">${allCount}</span></button>`
    +getCatKeys().map(k=>{
      const cnt=qs.filter(q=>q.cat===k).length;
      return`<button class="ctab${k===curCat?' on':''}" role="tab" aria-selected="${k===curCat}" onclick="fCat('${k}',this)" style="${curCat===k?'':'background:'+cats[k].color+';color:'+(cats[k].textColor||autoTextColor(cats[k].color))}">${cats[k].name||k} <span style="opacity:.6;font-size:10px">${cnt}</span></button>`;
    }).join('');
  initCatScroll(document.getElementById('cat-tabs'));
  initCatScroll(document.getElementById('note-cat-tabs'));
}
function populateCatSelects(){
  ['p-cat','m-cat'].forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    const prev=sel.value;
    sel.innerHTML=getCatKeys().map(k=>`<option value="${k}">${cats[k].name||k}</option>`).join('');
    if(prev&&cats[prev])sel.value=prev;
  });
  updateBabSelect('p-bab','p-cat');updateBabSelect('m-bab','m-cat');
}
function updateBabSelect(babId,catId){
  const catSel=document.getElementById(catId),babSel=document.getElementById(babId);
  if(!catSel||!babSel)return;
  const c=cats[catSel.value];
  babSel.innerHTML=(c?c.babs:[]).map(b=>`<option value="${b}">${b}</option>`).join('');
}
function updateBabFilter(){
  const sel=document.getElementById('filter-bab');if(!sel)return;
  let opts='<option value="all">Semua bab</option>';
  const src=curCat!=='ALL'&&cats[curCat]?cats[curCat].babs:[...new Set(qs.map(q=>q.bab).filter(Boolean))].sort();
  src.forEach(b=>{opts+=`<option value="${b}">${b}</option>`;});
  sel.innerHTML=opts;sel.value=curBab;
}
function populateAnswerSelects(wId,cId){
  [wId,cId].forEach(id=>{const s=document.getElementById(id);if(!s)return;const p=s.value||'A';s.innerHTML=LETTERS.map(l=>`<option value="${l}">${l}</option>`).join('');s.value=p;});
}

/* ── NAV ── */
function goSec(id,btn){
  sfx('tap',0.4);
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.querySelectorAll('.bnav-item').forEach(t=>{t.classList.remove('on');t.setAttribute('aria-selected','false');});
  const target=document.getElementById('sec-'+id);
  target.classList.add('on');if(btn){btn.classList.add('on');btn.setAttribute('aria-selected','true');}
  target.style.animation='none';requestAnimationFrame(()=>{target.style.animation='secIn var(--dur-2) var(--ease)';});
  if(id!=='review'){clearInterval(simTimerHandle);if(typeof simState!=='undefined'&&simState&&!simState.finished)window.simPausedAt=Date.now();}
  if(id==='review')openReviewTab();else if(id==='stats')renderStatsPage();else if(id==='lainnya')renderLainnya();else if(id==='catatan')renderNotes();else render();
}

