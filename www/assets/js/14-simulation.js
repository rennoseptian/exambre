/* ════════════════════════════════════════════════════════════
   MODE SIMULASI UJIAN — timed mock-exam, terpisah total dari SRS.
   - TIDAK PERNAH memanggil srsUpdate(), persist() pada qs, atau
     mengubah q.mastered. Skor & riwayat disimpan sendiri di
     localStorage (key terpisah: SIMHISTK).
   - Feedback benar/salah baru muncul di akhir sesi (mode summary),
     bukan langsung per soal — supaya mirip kondisi ujian asli.
   - User pilih mode timer tiap mulai sesi: per-soal atau total-sesi.
   ════════════════════════════════════════════════════════════ */
function loadSimHistory(){
  try{simHistory=JSON.parse(localStorage.getItem(SIMHISTK)||'[]');}catch(e){simHistory=[];}
}
function saveSimHistory(){
  try{localStorage.setItem(SIMHISTK,JSON.stringify(simHistory.slice(0,30)));}
  catch(e){showToast('Gagal menyimpan riwayat simulasi','warn');}
}
function fmtMMSS(s){s=Math.max(0,Math.round(s));const m=Math.floor(s/60),sec=s%60;return m+':'+String(sec).padStart(2,'0');}
function renderRevModeTabs(){
  const s=document.getElementById('rmode-srs-btn'),m=document.getElementById('rmode-sim-btn');
  if(!s||!m)return;
  s.classList.toggle('on',revMode==='srs');
  m.classList.toggle('on',revMode==='sim');
}
function openReviewTab(){
  renderRevModeTabs();
  if(revMode==='sim'){
    if(simState&&!simState.finished){
      clearInterval(simTimerHandle);
      simTimerHandle=setInterval(simTick,1000);
      renderSimQuestion();
    }
    else if(simState&&simState.finished)renderSimSummary();
    else renderSimSetup();
  }else{
    startReview();
  }
}
function switchRevMode(mode){
  if(mode===revMode)return;
  if(revMode==='sim'&&simState&&!simState.finished){
    showConfirm({icon:'⚠️',title:'Keluar dari simulasi?',body:'Simulasi yang sedang berjalan akan dibatalkan dan TIDAK disimpan ke riwayat.',actionLabel:'Ya, keluar',actionClass:'btn-warn',onConfirm:()=>{
      clearInterval(simTimerHandle);simState=null;revMode=mode;renderRevModeTabs();
      if(mode==='srs')startReview();else renderSimSetup();
    }});
    return;
  }
  revMode=mode;renderRevModeTabs();
  if(mode==='srs')startReview();
  else{if(simState&&simState.finished)renderSimSummary();else renderSimSetup();}
}
function getSimAvailCats(){return getCatKeys().filter(k=>qs.some(q=>q.cat===k));}
function getSimPool(){
  if(!simSelectedCats)return[];
  return qs.filter(q=>simSelectedCats.has(q.cat)&&(q.opts||[]).filter(o=>o&&o.trim()&&o!=='<br>').length>=2);
}
function toggleSimCat(k){
  if(!simSelectedCats)simSelectedCats=new Set(getSimAvailCats());
  if(simSelectedCats.has(k))simSelectedCats.delete(k);else simSelectedCats.add(k);
  renderSimSetup();
}
function simSelectAllCats(){simSelectedCats=new Set(getSimAvailCats());renderSimSetup();}
function simClearCats(){simSelectedCats=new Set();renderSimSetup();}
function setSimQCount(n){const inp=document.getElementById('sim-qcount');if(inp)inp.value=n;}
function setSimPersoalSec(n){const inp=document.getElementById('sim-persoal-sec');if(inp)inp.value=n;}
function setSimTotalMin(n){const inp=document.getElementById('sim-total-min');if(inp)inp.value=n;}
function setSimTimerType(type){
  simTimerType=type;
  const pb=document.getElementById('rsimtype-persoal-btn'),tb=document.getElementById('rsimtype-total-btn');
  const pf=document.getElementById('sim-persoal-field'),tf=document.getElementById('sim-total-field');
  if(pb)pb.classList.toggle('on',type==='persoal');
  if(tb)tb.classList.toggle('on',type==='total');
  if(pf)pf.style.display=type==='persoal'?'block':'none';
  if(tf)tf.style.display=type==='total'?'block':'none';
}
function renderSimSetup(){
  if(!simSelectedCats)simSelectedCats=new Set(getSimAvailCats());
  const availCats=getSimAvailCats();
  const pool=getSimPool();
  const defaultQCount=Math.min(20,pool.length||1);
  const defaultMin=Math.max(5,Math.ceil((pool.length||10)*0.75));
  const catsHtml=availCats.length?availCats.map(k=>{
    const c=cats[k]||{};const n=qs.filter(q=>q.cat===k).length;
    const on=simSelectedCats.has(k);
    return`<button class="ctab${on?' on':''}" onclick="toggleSimCat('${k}')">${c.name||k} <span style="opacity:.6;font-size:10px">${n}</span></button>`;
  }).join(''):'<p style="font-size:12px;color:var(--text2)">Belum ada kategori dengan soal. Tambahkan soal dulu di tab Daftar Soal.</p>';
  const histHtml=simHistory.length?simHistory.slice(0,8).map((h,i)=>{
    const catLbl=(!h.cats||h.cats.length>=availCats.length)?'Semua kategori':h.cats.map(k=>cats[k]?cats[k].name:k).join(', ');
    const d=new Date(h.date);
    const dateLbl=d.toLocaleDateString('id-ID',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    const scoreColor=h.accPct>=80?'var(--success)':h.accPct>=55?'var(--accent)':'var(--danger)';
    return`<div class="sim-hist-row">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600">${h.correct}/${h.total} benar <span style="color:${scoreColor};font-weight:700">(${h.accPct}%)</span></div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${catLbl} · ${dateLbl} · ${h.timerType==='persoal'?h.timerVal+'s/soal':fmtMMSS(h.timerVal)+' total'}${h.timedOut?' · ⏰ waktu habis':''}</div>
      </div>
      <button class="ibtn del" onclick="delSimHistoryEntry(${i})" aria-label="Hapus riwayat" style="flex-shrink:0"><i class="ti ti-trash" style="font-size:15px"></i></button>
    </div>`;
  }).join(''):'<p style="font-size:12px;color:var(--text2);padding:8px 0">Belum ada riwayat simulasi.</p>';
  document.getElementById('rev-content').innerHTML=`
    <div class="panel">
      <h3 style="font-size:15px;font-weight:700;margin-bottom:4px"><i class="ti ti-clock-hour-4" style="color:var(--accent)"></i> Simulasi Ujian</h3>
      <p style="font-size:12px;color:var(--text2);margin-bottom:16px;line-height:1.6">Latihan dengan waktu terbatas, mirip ujian asli. Jawaban baru ditampilkan di akhir sesi. <b>Tidak memengaruhi</b> jadwal SRS atau status "Dikuasai".</p>

      <div class="field"><label>Pilih kategori soal</label>
        <div class="cats" style="margin-bottom:6px">${catsHtml}</div>
        ${availCats.length?`<div style="display:flex;gap:10px"><button onclick="simSelectAllCats()" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:600">Pilih semua</button><button onclick="simClearCats()" style="font-size:11px;color:var(--text2);background:none;border:none;cursor:pointer;font-weight:600">Kosongkan</button></div>`:''}
      </div>

      <div class="field"><label>Jumlah soal (tersedia: ${pool.length})</label>
        <input type="number" id="sim-qcount" min="1" max="${pool.length||1}" value="${defaultQCount}">
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          ${[10,25,50].filter(n=>n<=pool.length).map(n=>`<button class="ctab" style="padding:5px 10px;font-size:11px" onclick="setSimQCount(${n})">${n}</button>`).join('')}
          <button class="ctab" style="padding:5px 10px;font-size:11px" onclick="setSimQCount(${pool.length||1})">Semua (${pool.length})</button>
        </div>
      </div>

      <div class="field"><label>Mode timer</label>
        <div class="theme-toggle" style="max-width:280px">
          <button id="rsimtype-persoal-btn" class="${simTimerType==='persoal'?'on':''}" onclick="setSimTimerType('persoal')">Per Soal</button>
          <button id="rsimtype-total-btn" class="${simTimerType==='total'?'on':''}" onclick="setSimTimerType('total')">Total Sesi</button>
        </div>
      </div>

      <div class="field" id="sim-persoal-field" style="display:${simTimerType==='persoal'?'block':'none'}">
        <label>Detik per soal</label>
        <input type="number" id="sim-persoal-sec" min="5" value="60">
        <div style="display:flex;gap:6px;margin-top:6px">
          ${[30,45,60,90].map(n=>`<button class="ctab" style="padding:5px 10px;font-size:11px" onclick="setSimPersoalSec(${n})">${n}s</button>`).join('')}
        </div>
      </div>

      <div class="field" id="sim-total-field" style="display:${simTimerType==='total'?'block':'none'}">
        <label>Total menit untuk sesi ini</label>
        <input type="number" id="sim-total-min" min="1" value="${defaultMin}">
        <div style="display:flex;gap:6px;margin-top:6px">
          ${[15,30,60,90].map(n=>`<button class="ctab" style="padding:5px 10px;font-size:11px" onclick="setSimTotalMin(${n})">${n}m</button>`).join('')}
        </div>
      </div>

      <button class="btn btn-p" style="width:100%;justify-content:center;margin-top:6px" onclick="startSimulation()"><i class="ti ti-player-play"></i> Mulai Simulasi</button>
    </div>

    <div class="panel">
      <h4 style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-history"></i> Riwayat Simulasi</h4>
      ${histHtml}
      ${simHistory.length?`<button onclick="clearAllSimHistory()" style="font-size:11px;color:var(--danger-ink);background:none;border:none;cursor:pointer;font-weight:600;margin-top:6px">Hapus semua riwayat</button>`:''}
    </div>`;
}
function delSimHistoryEntry(i){simHistory.splice(i,1);saveSimHistory();renderSimSetup();}
function clearAllSimHistory(){
  showConfirm({icon:'🗑️',title:'Hapus semua riwayat simulasi?',body:'Tindakan ini tidak bisa dibatalkan.',actionLabel:'Ya, hapus semua',actionClass:'btn-warn',onConfirm:()=>{simHistory=[];saveSimHistory();renderSimSetup();}});
}
function startSimulation(){
  const pool=getSimPool();
  if(!pool.length){showToast('Pilih minimal satu kategori yang punya soal','warn');return;}
  let qcount=parseInt(document.getElementById('sim-qcount').value,10);
  if(!qcount||qcount<1)qcount=pool.length;
  qcount=Math.min(qcount,pool.length);
  const shuffled=pool.slice().sort(()=>Math.random()-.5).slice(0,qcount);
  const timerType=simTimerType;
  let perSoalSec=60,totalSec=0;
  if(timerType==='persoal'){
    perSoalSec=Math.max(5,parseInt(document.getElementById('sim-persoal-sec').value,10)||60);
  }else{
    const mins=Math.max(1,parseInt(document.getElementById('sim-total-min').value,10)||Math.ceil(shuffled.length*0.75));
    totalSec=mins*60;
  }
  simState={questions:shuffled,idx:0,answers:{},timerType,perSoalSec,perSoalLeft:perSoalSec,totalSecInit:totalSec,totalLeft:totalSec,startedAt:Date.now(),finished:false,catsUsed:Array.from(simSelectedCats)};
  clearInterval(simTimerHandle);
  simTimerHandle=setInterval(simTick,1000);
  renderSimQuestion();
}
function simTick(){
  if(!simState||simState.finished)return;
  if(simState.timerType==='total'){
    simState.totalLeft--;
    updateSimTotalBar();
    if(simState.totalLeft<=0){finishSimulation(true);}
  }else{
    simState.perSoalLeft--;
    updateSimPersoalBar();
    if(simState.perSoalLeft<=0){simNext();}
  }
}
function updateSimTotalBar(){
  const txt=document.getElementById('sim-total-txt'),fill=document.getElementById('sim-total-fill');
  if(!txt||!simState)return;
  txt.textContent=fmtMMSS(simState.totalLeft);
  if(fill)fill.style.width=Math.max(0,simState.totalLeft/simState.totalSecInit*100)+'%';
  txt.style.color=simState.totalLeft<=30?'var(--danger)':'var(--text)';
}
function updateSimPersoalBar(){
  const txt=document.getElementById('sim-ps-txt'),fill=document.getElementById('sim-ps-fill');
  if(!txt||!simState)return;
  txt.textContent=simState.perSoalLeft+'s';
  if(fill)fill.style.width=Math.max(0,simState.perSoalLeft/simState.perSoalSec*100)+'%';
  txt.style.color=simState.perSoalLeft<=5?'var(--danger)':'var(--text)';
}
function renderSimQuestion(){
  if(!simState||simState.finished)return;
  const q=simState.questions[simState.idx];
  const catStyle=catBadgeStyle(q.cat);const catName=cats[q.cat]?(cats[q.cat].name||q.cat):q.cat;
  const pct=Math.round((simState.idx/simState.questions.length)*100);
  const selectedAns=simState.answers[q.id];
  const isLast=simState.idx>=simState.questions.length-1;
  const timerHtml=simState.timerType==='total'
    ?`<div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border-radius:var(--radius);padding:8px 12px;margin-bottom:12px">
        <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:5px"><i class="ti ti-hourglass"></i> Sisa waktu sesi</span>
        <span id="sim-total-txt" style="font-weight:700;font-size:14px;font-variant-numeric:tabular-nums">${fmtMMSS(simState.totalLeft)}</span>
      </div>
      <div class="rev-prog" style="margin-bottom:8px"><div id="sim-total-fill" class="rev-progf" style="background:var(--accent);width:${Math.max(0,simState.totalLeft/simState.totalSecInit*100)}%"></div></div>`
    :`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:5px"><i class="ti ti-hourglass"></i> Waktu soal ini</span>
        <span id="sim-ps-txt" style="font-weight:700;font-size:13px;font-variant-numeric:tabular-nums">${simState.perSoalLeft}s</span>
      </div>
      <div class="rev-prog" style="margin-bottom:8px;height:5px"><div id="sim-ps-fill" class="rev-progf" style="background:var(--gold);width:${Math.max(0,simState.perSoalLeft/simState.perSoalSec*100)}%"></div></div>`;
  document.getElementById('rev-content').innerHTML=`
    ${timerHtml}
    <div class="rev-prog"><div class="rev-progf" style="width:${pct}%"></div></div>
    <div class="rnav">
      <div style="display:flex;gap:6px;align-items:center"><span class="badge" style="${catStyle}">${catName}</span>${q.bab?`<span class="badge-bab">${q.bab}</span>`:''}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:13px;color:var(--text2)">${simState.idx+1} / ${simState.questions.length}</span>
        <button onclick="endSimulationEarly()" style="font-size:11px;color:var(--danger-ink);background:none;border:none;cursor:pointer;font-weight:600">Akhiri</button>
      </div>
    </div>
    <div class="rcard">
      <p class="rq">${sanitizeHtml(q.q)}</p>
      ${q.qimgs&&q.qimgs.length?'<div style="margin-bottom:12px">'+q.qimgs.map(img=>{const ei=typeof img==='string'?{src:img,width:80}:img;return`<img src="${ei.src}" style="max-height:160px;border-radius:4px;border:0.5px solid var(--border);object-fit:contain;cursor:pointer;display:block;margin-bottom:6px" onclick="openLB('${ei.src}')">`;}).join('')+'</div>':''}
      <div class="ropts">${(q.opts||[]).map((o,i)=>{
        if(!LETTERS[i]||!o||!o.trim()||o==='<br>')return'';const l=LETTERS[i];
        const safeO=sanitizeHtml(o);
        const imgSrc=q.optImgs&&q.optImgs[l]?q.optImgs[l]:'';
        const extraImg=imgSrc&&!safeO.includes('<img')?`<img src="${imgSrc}" style="max-height:100px;max-width:100%;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin-top:4px">`:'';
        const displayHtml=safeO.replace(/<img([^>]*)style="[^"]*"([^>]*)>/gi,'<img$1style="max-height:100px;max-width:100%;width:auto;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin-top:4px"$2>');
        const selCls=selectedAns===l?' sel':'';
        return`<button class="ropt${selCls}" onclick="selectSimAnswer(${q.id},'${l}',this)"><span class="ltr">${l}.</span><div class="opt-html-content">${displayHtml}${extraImg}</div></button>`;
      }).join('')}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-p" onclick="simNext()">${isLast?'Selesai & Lihat Hasil':'Soal Berikutnya'} <i class="ti ti-arrow-right"></i></button></div>
    </div>`;
}
function selectSimAnswer(qid,letter,btn){
  if(!simState||simState.finished)return;
  simState.answers[qid]=letter;
  btn.parentElement.querySelectorAll('.ropt').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
}
function simNext(){
  if(!simState||simState.finished)return;
  simState.idx++;
  if(simState.idx>=simState.questions.length){finishSimulation(false);return;}
  simState.perSoalLeft=simState.perSoalSec;
  renderSimQuestion();
}
function endSimulationEarly(){
  if(!simState||simState.finished)return;
  showConfirm({icon:'⚠️',title:'Akhiri simulasi sekarang?',body:'Soal yang belum dijawab akan dihitung kosong. Hasil akan langsung ditampilkan.',actionLabel:'Ya, akhiri & lihat hasil',actionClass:'btn-warn',onConfirm:()=>finishSimulation(false)});
}
function finishSimulation(timedOut){
  if(!simState||simState.finished)return;
  clearInterval(simTimerHandle);
  simState.finished=true;simState.finishedAt=Date.now();simState.timedOut=!!timedOut;
  const elapsedSec=Math.round((simState.finishedAt-simState.startedAt)/1000);
  let correct=0,blank=0;const perCat={};
  simState.questions.forEach(q=>{
    const ans=simState.answers[q.id];const ok=ans===q.correct;
    if(!ans)blank++;else if(ok)correct++;
    if(!perCat[q.cat])perCat[q.cat]={total:0,correct:0};
    perCat[q.cat].total++;if(ok)perCat[q.cat].correct++;
  });
  const total=simState.questions.length,wrong=total-correct-blank;
  const accPct=total?Math.round(correct/total*100):0;
  simState.result={correct,wrong,blank,total,accPct,elapsedSec,perCat};
  simHistory.unshift({date:Date.now(),cats:simState.catsUsed,total,correct,accPct,timerType:simState.timerType,timerVal:simState.timerType==='persoal'?simState.perSoalSec:simState.totalSecInit,elapsedSec,timedOut:!!timedOut});
  saveSimHistory();
  if(timedOut)showToast('⏰ Waktu simulasi habis — hasil sudah dihitung','warn');
  renderSimSummary();
}
function renderSimSummary(){
  if(!simState||!simState.result)return;
  const r=simState.result;
  const color=r.accPct>=80?'var(--success)':r.accPct>=55?'var(--accent)':'var(--danger)';
  const catRows=Object.keys(r.perCat).map(k=>{
    const c=r.perCat[k];const pct=c.total?Math.round(c.correct/c.total*100):0;
    const nm=cats[k]?cats[k].name:k;
    return`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12.5px">${nm}</span>
      <span style="font-size:12.5px;font-weight:700;color:${pct>=80?'var(--success)':pct>=55?'var(--accent)':'var(--danger)'}">${c.correct}/${c.total} (${pct}%)</span>
    </div>`;
  }).join('');
  const qRows=simState.questions.map((q,i)=>{
    const ans=simState.answers[q.id];const ok=ans===q.correct;
    const stcolor=!ans?'var(--text3)':ok?'var(--success)':'var(--danger)';
    const stlabel=!ans?'Kosong':ok?'Benar':'Salah';
    const stbg=!ans?'var(--bg2)':ok?'var(--green50)':'var(--red50)';
    return`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <p style="font-size:12.5px;line-height:1.5;flex:1">${i+1}. ${sanitizeHtml(q.q)}</p>
        <span class="badge" style="background:${stbg};color:${stcolor};flex-shrink:0">${stlabel}</span>
      </div>
      <p style="font-size:11.5px;color:var(--text2);margin-top:4px">Jawabanmu: <b>${ans||'—'}</b> · Jawaban benar: <b>${q.correct}</b></p>
    </div>`;
  }).join('');
  document.getElementById('rev-content').innerHTML=`
    <div class="rcard" style="text-align:center;padding:28px 20px">
      <div style="font-size:13px;color:var(--text2);margin-bottom:6px">${simState.timedOut?'⏰ Waktu habis':'Simulasi selesai'}</div>
      <div style="font-size:40px;font-weight:800;color:${color}">${r.accPct}%</div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">${r.correct} benar · ${r.wrong} salah · ${r.blank} kosong dari ${r.total} soal</div>
      <div style="font-size:12px;color:var(--text3);margin-top:8px">Waktu terpakai: ${fmtMMSS(r.elapsedSec)}</div>
    </div>
    <div class="panel"><h4 style="font-size:13px;font-weight:700;margin-bottom:6px">Per Kategori</h4>${catRows}</div>
    <div class="panel"><h4 style="font-size:13px;font-weight:700;margin-bottom:6px">Detail Jawaban</h4>${qRows}</div>
    <button class="btn btn-p" style="width:100%;justify-content:center" onclick="closeSimSummary()"><i class="ti ti-check"></i> Tutup</button>`;
}
function closeSimSummary(){simState=null;renderSimSetup();}

