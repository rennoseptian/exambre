/* ── GAMIFIKASI: streak, XP, badge (ala Duolingo) ── */
function ensureGami(){
  if(!gami)gami={streak:0,lastActive:null,xp:0,badges:[]};
  if(gami.streak===undefined)gami.streak=0;
  if(gami.xp===undefined)gami.xp=0;
  if(!gami.badges)gami.badges=[];
  if(gami.lastActive===undefined)gami.lastActive=null;
}
function trackDailyActivity(){
  ensureGami();
  const today=new Date().toDateString();
  if(gami.lastActive===today)return false;
  if(gami.lastActive){
    const diffDays=Math.round((new Date(today)-new Date(gami.lastActive))/DAY_MS);
    gami.streak=diffDays===1?gami.streak+1:1;
  }else{gami.streak=1;}
  gami.lastActive=today;
  return true;
}
function renderGami(){
  const el=document.getElementById('gami-row');if(!el)return;
  ensureGami();
  const lit=gami.streak>0&&gami.lastActive===new Date().toDateString();
  el.innerHTML=`<span class="gpill streak${lit?' lit':''}" title="Streak belajar harian"><i class="ti ti-flame"></i><b>${gami.streak}</b></span><span class="gpill xp" title="Total XP"><i class="ti ti-bolt"></i><b>${gami.xp}</b> XP</span>`;
}
const BADGES=[
  {id:'first_step',name:'Langkah Pertama',desc:'Jawab soal pertama di Mode Review',icon:'🚀',check:c=>c.totalAttempts>=1},
  {id:'streak_3',name:'Rajin 3 Hari',desc:'Streak belajar 3 hari berturut-turut',icon:'🔥',check:c=>c.gami.streak>=3},
  {id:'streak_7',name:'Konsisten 7 Hari',desc:'Streak belajar 7 hari berturut-turut',icon:'🔥',check:c=>c.gami.streak>=7},
  {id:'streak_30',name:'Sang Veteran',desc:'Streak belajar 30 hari berturut-turut',icon:'🏆',check:c=>c.gami.streak>=30},
  {id:'mastered_10',name:'10 Soal Dikuasai',desc:'Kuasai 10 soal',icon:'⭐',check:c=>c.masteredAll>=10},
  {id:'mastered_50',name:'50 Soal Dikuasai',desc:'Kuasai 50 soal',icon:'🌟',check:c=>c.masteredAll>=50},
  {id:'mastered_100',name:'100 Soal Dikuasai',desc:'Kuasai 100 soal',icon:'💎',check:c=>c.masteredAll>=100},
  {id:'sharp_shooter',name:'Jagoan Akurat',desc:'Akurasi ≥90% (min. 20x latihan)',icon:'🎯',check:c=>c.accAll!==null&&c.accAll>=90&&c.totalAttempts>=20},
  {id:'xp_500',name:'Pemburu XP',desc:'Kumpulkan 500 XP',icon:'⚡',check:c=>c.gami.xp>=500},
  {id:'xp_1500',name:'Maestro XP',desc:'Kumpulkan 1500 XP',icon:'👑',check:c=>c.gami.xp>=1500}
];
function getBadgeContext(){
  ensureGami();
  const totalAttempts=qs.reduce((s,q)=>s+ensureSrs(q).totalAttempts,0);
  const totalCorrect=qs.reduce((s,q)=>s+ensureSrs(q).totalCorrect,0);
  const masteredAll=qs.filter(q=>q.mastered).length;
  const accAll=totalAttempts?Math.round(totalCorrect/totalAttempts*100):null;
  return{totalAttempts,totalCorrect,masteredAll,accAll,gami};
}
function allBadgeDefs(){
  const ctx=getBadgeContext();
  const dyn=getCatKeys().map(k=>{
    const catQs=qs.filter(q=>q.cat===k);
    if(!catQs.length)return null;
    const name=cats[k]?(cats[k].name||k):k;
    return{id:'cat_'+k,name:'Master '+name,desc:'Kuasai semua soal kategori '+name,icon:'🏅',unlocked:catQs.every(q=>q.mastered)};
  }).filter(Boolean);
  const stat=BADGES.map(b=>({id:b.id,name:b.name,desc:b.desc,icon:b.icon,unlocked:b.check(ctx)}));
  return[...stat,...dyn];
}
function checkBadges(){
  ensureGami();
  const defs=allBadgeDefs();
  const newly=defs.filter(d=>d.unlocked&&!gami.badges.includes(d.id));
  if(newly.length){
    newly.forEach(d=>gami.badges.push(d.id));
    showBadgeToast(newly[0]);
    persist();
  }
  return newly;
}
function showBadgeToast(d){
  const el=document.getElementById('badge-toast');if(!el)return;
  sfx('badge');
  el.innerHTML=`<span class="ic">${d.icon}</span><div><div class="tt">Lencana baru</div><div class="nm">${d.name}</div></div>`;
  el.classList.add('on');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('on'),3200);
}

/* ── STORAGE ── */
function loadData(){
  try{
    const raw=localStorage.getItem(SK);
    if(raw){
      const d=JSON.parse(raw);
      qs=d.qs||[];nid=d.nid||10;
      cats=d.cats||JSON.parse(JSON.stringify(INIT_CATS));
      gami=d.gami||{streak:0,lastActive:null,xp:0,badges:[]};
      if(!qs.length)qs=defaultQ();
      qs.forEach(q=>ensureSrs(q));
      Object.keys(cats).forEach(k=>{if(!cats[k].name)cats[k].name=k;});
    }else{qs=defaultQ();nid=10;cats=JSON.parse(JSON.stringify(INIT_CATS));gami={streak:0,lastActive:null,xp:0,badges:[]};}
  }catch(e){qs=defaultQ();nid=10;cats=JSON.parse(JSON.stringify(INIT_CATS));gami={streak:0,lastActive:null,xp:0,badges:[]};}
  try{
    const nr=localStorage.getItem(NK);
    if(nr){const nd=JSON.parse(nr);notes=nd.notes||[];noteCats=nd.cats||[];noteNid=nd.nid||1;}
    else{notes=[];noteCats=[];noteNid=1;}
  }catch(e){notes=[];noteCats=[];noteNid=1;}
  ensureGami();migrateCatColors();
  buildCatTabs();populateCatSelects();buildManualOptRows();updateBabFilter();render();renderGami();
}
function persistNotes(){
  try{localStorage.setItem(NK,JSON.stringify({notes,cats:noteCats,nid:noteNid}));}
  catch(e){showToast('Gagal menyimpan catatan: '+(e&&e.message?e.message:'error'),'warn');}
}


/* ── SFX & EFEK VISUAL (playful) ── */
const SFX_KEY='exambre_sfx';
let _sfxCache={};
function sfxEnabled(){try{return localStorage.getItem(SFX_KEY)!=='off';}catch(e){return true;}}
function setSfx(on){try{localStorage.setItem(SFX_KEY,on?'on':'off');}catch(e){}loadSfxToggle();}
function loadSfxToggle(){
  const on=sfxEnabled();
  document.querySelectorAll('#sfx-toggle button').forEach(b=>b.classList.toggle('on',(b.dataset.sfx==='on')===on));
}
function sfx(name){
  if(!sfxEnabled())return;
  try{
    if(!_sfxCache[name])_sfxCache[name]=new Audio('./assets/sfx/'+name+'.wav');
    const a=_sfxCache[name].cloneNode();a.volume=0.55;a.play().catch(()=>{});
  }catch(e){}
}
function confettiBurst(){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const cv=document.createElement('canvas');
  cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9998';
  document.body.appendChild(cv);
  const dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;
  const ctx=cv.getContext('2d');ctx.scale(dpr,dpr);
  const colors=['#4F62E0','#1D9E75','#B45A00','#7C3AED','#D6433D','#e0a040'];
  const parts=Array.from({length:130},()=>({
    x:innerWidth/2+(Math.random()-.5)*140,y:-20-Math.random()*60,
    vx:(Math.random()-.5)*7,vy:2+Math.random()*4,
    w:6+Math.random()*6,h:8+Math.random()*8,
    rot:Math.random()*Math.PI,vr:(Math.random()-.5)*.25,
    col:colors[Math.floor(Math.random()*colors.length)],
    life:110+Math.random()*50
  }));
  let frames=0;
  (function loop(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    parts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.vy+=.09;p.rot+=p.vr;p.life--;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      ctx.globalAlpha=Math.min(1,p.life/40);ctx.fillStyle=p.col;
      ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h*Math.abs(Math.sin(frames*.12+p.rot)));ctx.restore();
    });
    frames++;
    if(parts.some(p=>p.life>0&&p.y<innerHeight+30))requestAnimationFrame(loop);
    else cv.remove();
  })();
}
function countUpNumbers(rootSel){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const root=document.querySelector(rootSel);if(!root)return;
  root.querySelectorAll('.scard .snum').forEach(el=>{
    const raw=el.textContent.trim();const m=raw.match(/^(\d+)(.*)$/);if(!m)return;
    const target=parseInt(m[1],10);const suffix=m[2]||'';if(!target)return;
    const t0=performance.now(),dur=650;
    (function step(t){
      const k=Math.min(1,(t-t0)/dur),ease=1-Math.pow(1-k,3);
      el.textContent=Math.round(target*ease)+suffix;
      if(k<1)requestAnimationFrame(step);
    })(t0);
  });
}
