/* ── CATEGORY ── */
function getCatKeys(){return Object.keys(cats);}
function catBadgeStyle(k){const c=cats[k];if(!c)return'background:#eee;color:#333';const bg=safeColor(c.color,'#eeeeee');return`background:${bg};color:${c.textColor?safeColor(c.textColor):autoTextColor(bg)}`;}
function initCatScroll(scrollEl){
  if(!scrollEl)return;
  const wrap=scrollEl.closest('.cats-wrap');
  if(!wrap)return;
  if(!wrap._catNav){
    const mk=(dir,label)=>{
      const b=document.createElement('button');
      b.type='button';b.className='cats-nav '+(dir<0?'prev':'next');
      b.setAttribute('aria-label',label);
      b.innerHTML=`<i class="ti ti-chevron-${dir<0?'left':'right'}" aria-hidden="true"></i>`;
      b.addEventListener('click',()=>scrollEl.scrollBy({left:dir*Math.max(160,Math.round(scrollEl.clientWidth*.7)),behavior:'smooth'}));
      wrap.appendChild(b);return b;
    };
    wrap._catNav={prev:mk(-1,'Geser kategori ke kiri'),next:mk(1,'Geser kategori ke kanan')};
  }
  const nav=wrap._catNav;
  function update(){
    const overflow=scrollEl.scrollWidth>scrollEl.clientWidth+2;
    const atStart=scrollEl.scrollLeft<=2;
    const atEnd=!overflow||scrollEl.scrollLeft+scrollEl.clientWidth>=scrollEl.scrollWidth-4;
    wrap.classList.toggle('no-overflow',!overflow);
    wrap.classList.toggle('at-start',atStart);
    wrap.classList.toggle('at-end',atEnd);
    nav.prev.disabled=atStart;nav.next.disabled=atEnd;
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
  const prevScroll=el.scrollLeft;
  const allCount=qs.length;
  el.innerHTML=`<button class="ctab${curCat==='ALL'?' on':''}" role="tab" aria-selected="${curCat==='ALL'}" aria-controls="qlist" onclick="fCat('ALL',this)">Semua<span class="ctab-count">${allCount}</span></button>`
    +getCatKeys().map(k=>{
      const cnt=qs.filter(q=>q.cat===k).length;
      const dot=safeColor(cats[k].color,'#eeeeee');
      const ring=safeColor(cats[k].textColor,autoTextColor(dot));
      return`<button class="ctab${k===curCat?' on':''}" role="tab" aria-selected="${k===curCat}" aria-controls="qlist" onclick="fCat('${escHtml(jsStr(k))}',this)" style="--cat:${dot}"><span class="ctab-dot" style="background:${dot};--dot-ring:${ring}" aria-hidden="true"></span>${escHtml(cats[k].name||k)}<span class="ctab-count">${cnt}</span></button>`;
    }).join('');
  el.scrollLeft=prevScroll;
  initCatScroll(document.getElementById('cat-tabs'));
  initCatScroll(document.getElementById('note-cat-tabs'));
}
function populateCatSelects(){
  ['p-cat','m-cat'].forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    const prev=sel.value;
    sel.innerHTML=getCatKeys().map(k=>`<option value="${escHtml(k)}">${escHtml(cats[k].name||k)}</option>`).join('');
    if(prev&&cats[prev])sel.value=prev;
  });
  updateBabSelect('p-bab','p-cat');updateBabSelect('m-bab','m-cat');
}
function updateBabSelect(babId,catId){
  const catSel=document.getElementById(catId),babSel=document.getElementById(babId);
  if(!catSel||!babSel)return;
  const c=cats[catSel.value];
  babSel.innerHTML=(c?c.babs:[]).map(b=>`<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('');
}
function updateBabFilter(){
  const sel=document.getElementById('filter-bab');if(!sel)return;
  let opts='<option value="all">Semua bab</option>';
  const src=curCat!=='ALL'&&cats[curCat]?cats[curCat].babs:[...new Set(qs.map(q=>q.bab).filter(Boolean))].sort();
  src.forEach(b=>{opts+=`<option value="${escHtml(b)}">${escHtml(b)}</option>`;});
  sel.innerHTML=opts;sel.value=curBab;
}
function populateAnswerSelects(wId,cId){
  [wId,cId].forEach(id=>{const s=document.getElementById(id);if(!s)return;const p=s.value||'A';s.innerHTML=LETTERS.map(l=>`<option value="${l}">${l}</option>`).join('');s.value=p;});
}

/* ── NAV ── */
const SEC_TITLES={belajar:'Belajar',list:'Latihan',review:'Latihan',catatan:'Catatan',stats:'Saya',lainnya:'Saya'};
/* 4 tab di navigasi; tiap tab bisa berisi beberapa bagian (section) yang dipindah lewat .subnav */
const SEC_TAB={belajar:'belajar',list:'latihan',review:'latihan',catatan:'catatan',stats:'saya',lainnya:'saya'};
const TAB_ORDER=['belajar','latihan','catatan','saya'];
const _subLast={latihan:'list',saya:'stats'};
function setShellTitle(id){
  const el=document.getElementById('shell-title');if(!el)return;
  const label=SEC_TITLES[id]||'Exambre';
  el.textContent=label;
  document.title=id==='list'?'Exambre':label+' · Exambre';
}
let _lastSec='list';
/* Indikator tab aktif yang meluncur (bar bawah di HP, sidebar di desktop) */
function moveNavInd(instant){
  const nav=document.querySelector('.bottom-nav'),on=nav&&nav.querySelector('.bnav-item.on');
  if(!nav||!on||!on.offsetWidth)return;
  const nr=nav.getBoundingClientRect(),or=on.getBoundingClientRect();
  nav.style.setProperty('--ix',(or.left-nr.left-nav.clientLeft)+'px');nav.style.setProperty('--iy',(or.top-nr.top-nav.clientTop)+'px');
  nav.style.setProperty('--iw',or.width+'px');nav.style.setProperty('--ih',or.height+'px');
  nav.style.setProperty('--ir',getComputedStyle(on).borderRadius||'12px');
  const first=!nav.classList.contains('nav-sliding');
  nav.classList.add('nav-sliding');
  if(instant||first){nav.classList.remove('nav-ready');void nav.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>nav.classList.add('nav-ready')));}
}
function goTab(tab){
  if(SEC_TAB[_lastSec]===tab){window.scrollTo({top:0,behavior:'smooth'});return;}
  goSec(tab==='latihan'||tab==='saya'?_subLast[tab]:tab);
}
/* Latihan = Review | Simulasi | Soal. Review dan Simulasi berbagi satu bagian (mode di dalamnya), Soal bagian terpisah */
function goLatihan(k){
  if(k==='list'){goSec('list');return;}
  goSec('review');switchRevMode(k==='sim'?'sim':'srs');renderSubnav();
}
const SUBNAV={
  latihan:[{k:'review',l:'Review',i:'ti-repeat'},{k:'sim',l:'Simulasi',i:'ti-clock-hour-4'},{k:'list',l:'Soal',i:'ti-books'}],
  saya:[{k:'stats',l:'Statistik',i:'ti-chart-bar'},{k:'lainnya',l:'Pengaturan',i:'ti-settings'}]
};
function subnavCurrent(g){
  if(g==='latihan'){let sim=false;try{sim=revMode==='sim';}catch(e){}return _lastSec==='list'?'list':(sim?'sim':'review');}
  return _lastSec;
}
function renderSubnav(){
  document.querySelectorAll('[data-subnav]').forEach(el=>{
    const g=el.dataset.subnav,cur=subnavCurrent(g);
    el.innerHTML=SUBNAV[g].map(x=>'<button type="button" data-sub="'+x.k+'" class="'+(x.k===cur?'on':'')+'" aria-pressed="'+(x.k===cur)+'"><i class="ti '+x.i+'" aria-hidden="true"></i> '+x.l+'</button>').join('');
  });
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-subnav] button');if(!b)return;
  const g=b.parentElement.dataset.subnav,k=b.dataset.sub;
  if(g==='latihan')goLatihan(k);else goSec(k);
});
document.addEventListener('DOMContentLoaded',renderSubnav);
function goSec(id,btn){
  sfx('tap',0.4);setShellTitle(id);
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  const tab=SEC_TAB[id]||id,prevTab=SEC_TAB[_lastSec]||_lastSec;
  document.querySelectorAll('.bnav-item').forEach(t=>{const on=t.dataset.tab===tab;t.classList.toggle('on',on);t.setAttribute('aria-selected',String(on));});
  const target=document.getElementById('sec-'+id);
  target.classList.add('on');
  if(tab==='latihan'||tab==='saya')_subLast[tab]=id;
  const prevI=TAB_ORDER.indexOf(prevTab),nextI=TAB_ORDER.indexOf(tab),sectionChanged=id!==_lastSec;_lastSec=id;
  if(sectionChanged)window.scrollTo(0,0);
  moveNavInd();
  if(!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){
    const desk=matchMedia('(min-width:1024px)').matches,dir=nextI>=prevI?1:-1,same=nextI===prevI;
    target.style.setProperty('--dx',desk||same?'0px':(dir*14)+'px');target.style.setProperty('--dy',desk?'8px':same?'6px':'0px');
    target.style.animation='none';requestAnimationFrame(()=>{target.style.animation='secSlide var(--dur-3) var(--ease-out)';});
  }
  if(id!=='review'){clearInterval(simTimerHandle);if(typeof simState!=='undefined'&&simState&&!simState.finished)window.simPausedAt=Date.now();}
  if(id==='review')openReviewTab();else if(id==='stats')renderStatsPage();else if(id==='lainnya'){renderLainnya();if(typeof showSettingsHub==='function')showSettingsHub();}else if(id==='catatan')renderNotes();else if(id==='belajar'){if(typeof renderBelajar==='function')renderBelajar();}else render();
  renderSubnav();
}


(function(){
  const nav=document.querySelector('.bottom-nav');if(!nav)return;
  const init=()=>moveNavInd(true);
  if(window.ResizeObserver)new ResizeObserver(init).observe(nav);
  window.addEventListener('resize',init);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(init);
  requestAnimationFrame(init);
})();
