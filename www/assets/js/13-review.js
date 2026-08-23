/* ── REVIEW ── */
function startReview(forceAll){
  revIdx=0;revSessionXP=0;sessionCorrect=0;
  if(forceAll){
    revList=qs.slice().sort(()=>Math.random()-.5);
  }else{
    revList=srsDueQs().sort((a,b)=>a.srs.due-b.srs.due);
  }
  if(!revList.length){
    if(!qs.length){document.getElementById('rev-content').innerHTML='<div class="empty"><i class="ti ti-books"></i><p>Belum ada soal sama sekali.<br>Tambahkan soal dulu di tab Daftar Soal.</p></div>';return;}
    const nextLabel=srsNextDueLabel();
    document.getElementById('rev-content').innerHTML=`
  <div class="empty" style="padding:60px 20px">
    <i class="ti ti-calendar-check" style="font-size:52px;color:var(--success);opacity:.7;margin-bottom:16px;display:block"></i>
    <h3 style="font-size:17px;font-weight:700;margin-bottom:8px">Semua soal sudah direview!</h3>
    <p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:6px">
      Tidak ada soal yang jatuh tempo saat ini.
    </p>
    <p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:20px">
      ${nextLabel?'Sesi berikutnya: <b>'+nextLabel+'</b>':'Tambahkan lebih banyak soal untuk memulai latihan.'}
    </p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn btn-s" onclick="startReview(true)"><i class="ti ti-bolt"></i> Latihan Bebas (semua soal)</button>
      <button class="btn btn-p" onclick="goSec('list', document.querySelectorAll('.bnav-item')[0])"><i class="ti ti-plus"></i> Tambah Soal Baru</button>
    </div>
  </div>`;
    return;
  }
  renderRev();
}
function renderRev(){
  if(revIdx>=revList.length){renderRevSummary();return;}
  const q=revList[revIdx];revDone=false;
  const catStyle=catBadgeStyle(q.cat);const catName=cats[q.cat]?(cats[q.cat].name||q.cat):q.cat;
  const pct=Math.round((revIdx/revList.length)*100);
  document.getElementById('rev-content').innerHTML=`
    <div class="rev-prog"><div class="rev-progf" style="width:${pct}%"></div></div>
    <div class="rnav">
      <div style="display:flex;gap:6px;align-items:center"><span class="badge" style="${catStyle}">${catName}</span>${q.bab?`<span class="badge-bab">${q.bab}</span>`:''}</div>
      <span style="font-size:13px;color:var(--text2)">${revIdx+1} / ${revList.length}</span>
    </div>
    <div class="rcard">
      <p class="rq">${sanitizeHtml(q.q)}</p>
      ${q.qimgs&&q.qimgs.length?'<div style="margin-bottom:12px">'+q.qimgs.map(img=>{const ei=typeof img==='string'?{src:img,width:80}:img;return`<img src="${ei.src}" style="max-height:160px;border-radius:4px;border:0.5px solid var(--border);object-fit:contain;cursor:pointer;display:block;margin-bottom:6px" onclick="openLB('${ei.src}')">`;}).join('')+'</div>':''}
      <div class="ropts">${(q.opts||[]).map((o,i)=>{
        if(!LETTERS[i]||!o||!o.trim()||o==='<br>')return'';const l=LETTERS[i];
        const safeO=sanitizeHtml(o);
        const imgSrc=q.optImgs&&q.optImgs[l]?q.optImgs[l]:'';
        const extraImg=imgSrc&&!safeO.includes('<img')?`<img src="${imgSrc}" style="max-height:100px;max-width:100%;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin-top:4px">` :'';
        const displayHtml=safeO.replace(/<img([^>]*)style="[^"]*"([^>]*)>/gi,'<img$1style="max-height:100px;max-width:100%;width:auto;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin-top:4px"$2>');
        return`<button class="ropt" data-l="${l}" onclick="ansRev(${q.id},'${l}',this)"><span class="ltr">${l}.</span><div class="opt-html-content">${displayHtml}${extraImg}</div></button>`;
      }).join('')}</div>
      <div id="rfb"></div>
      <div style="display:flex;justify-content:flex-end"><button class="btn btn-p" id="rnext" style="display:none" onclick="nextRev()">Soal Berikutnya <i class="ti ti-arrow-right"></i></button></div>
    </div>`;
}
function renderRevSummary(){
  const total=revList.length;
  const sessionXP=revSessionXP||0;
  document.getElementById('rev-content').innerHTML=`
    <div class="rcard" style="text-align:center;padding:32px 20px">
      <div style="font-size:48px;margin-bottom:12px">🎉</div>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">Sesi selesai!</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:24px">
        Kamu sudah mereview semua soal yang jatuh tempo hari ini.
      </p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
        <div class="scard"><div class="snum">${total}</div><div class="slbl">Direview</div></div>
        <div class="scard"><div class="snum" style="color:var(--success)">${sessionCorrect}</div><div class="slbl">Benar</div></div>
        <div class="scard"><div class="snum" style="color:var(--accent)">+${sessionXP}</div><div class="slbl">XP</div></div>
      </div>
      <p style="font-size:12px;color:var(--text3);margin-bottom:20px">
        Sesi berikutnya: <b>${srsNextDueLabel()||'Belum ada soal terjadwal'}</b>
      </p>
      <button class="btn btn-p" onclick="goSec('list', document.querySelector('.bnav-item'))">
        <i class="ti ti-books"></i> Kembali ke Daftar Soal
      </button>
    </div>`;
}
function ansRev(qid,chosen,btn){
  if(revDone)return;revDone=true;
  const q=qs.find(x=>x.id===qid),ok=chosen===q.correct;
  document.querySelectorAll('.ropt').forEach(b=>{b.disabled=true;const l=b.dataset.l;if(l===chosen&&!ok)b.classList.add('rw');if(l===q.correct)b.classList.add('rc');if(l===chosen&&ok)b.classList.add('rc');});
  const eimgHtml=q.eimgs&&q.eimgs.length?'<div style="margin-top:8px">'+q.eimgs.map(img=>{const ei=typeof img==='string'?{src:img,width:80}:img;return'<img src="'+ei.src+'" onclick="openLB(\''+ei.src+'\')" style="max-height:200px;border-radius:4px;border:0.5px solid var(--border);cursor:pointer;object-fit:contain;display:block;margin-bottom:6px">';}).join('')+'</div>':'';
  const wasMastered=!!q.mastered;
  srsUpdate(q,ok);
  if(!ok){
    const reinsertAt=Math.min(revIdx+3,revList.length);
    revList.splice(reinsertAt,0,q);
  }
  const justMastered=!wasMastered&&q.mastered;
  ensureGami();trackDailyActivity();
  const xpGain=(ok?10:2)+(justMastered?20:0);
  gami.xp+=xpGain;
  revSessionXP+=xpGain;
  if(ok)sessionCorrect++;
  persist();
  checkBadges();
  renderGami();
  const srsMsg=ok?`Direview lagi dalam <b>${q.srs.interval} hari</b>.`:`Kartu ini akan muncul lagi sebentar lagi untuk dilatih ulang.`;
  const xpPill=`<span style="display:inline-flex;align-items:center;gap:3px;background:var(--bg2);border:1px solid var(--border2);color:var(--text2);font-weight:600;border-radius:var(--radius-pill);padding:2px 9px;font-size:11px;margin-left:8px;vertical-align:middle"><i class="ti ti-bolt" style="font-size:11px"></i>+${xpGain} XP</span>`;
  const aiExpBtn=!q.expHtml?`<button id="gen-exp-btn-rev-${q.id}" class="btn btn-s" onclick="generateExp(${q.id})" style="font-size:12px;margin-top:8px" aria-label="Generate penjelasan AI"><i class="ti ti-sparkles" style="color:var(--accent)"></i> Generate Penjelasan</button>`:'';
  document.getElementById('rfb').innerHTML='<div class="rfb '+(ok?'right':'wrong')+'"><b>'+(ok?'Benar.':'Kurang tepat. Jawaban benar: '+q.correct+'.')+'</b>'+xpPill+(justMastered?'<div style="margin-top:6px;font-size:12px">Soal ini sekarang <b>Dikuasai</b>.</div>':'')+(q.expHtml?'<div class="exp-content" style="margin-top:6px">'+sanitizeHtml(q.expHtml)+'</div>':'')+eimgHtml+aiExpBtn+'<div style="margin-top:8px;font-size:11px;opacity:.75">'+srsMsg+'</div></div>';
  if(ok){q.mastered=q.srs.reps>=3;}
  document.getElementById('rnext').style.display='flex';
  updateDueBadge();
}
function nextRev(){revIdx++;renderRev();}

