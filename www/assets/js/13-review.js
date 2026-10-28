/* ── REVIEW ── */
function startReview(forceAll){
  revIdx=0;revSessionXP=0;sessionCorrect=0;sessionWrong=0;window._revFree=!!forceAll;
  if(forceAll){
    revList=qs.slice().sort(()=>Math.random()-.5);
  }else{
    revList=srsDueQs().sort((a,b)=>a.srs.due-b.srs.due);
  }
  if(!revList.length){
    const el=document.getElementById('rev-content');
    if(!qs.length){
      el.innerHTML=`<div class="empty rev-empty">
        <i class="ti ti-books" aria-hidden="true"></i>
        <h3>Belum ada soal</h3>
        <p>Tambahkan soal dulu di tab Daftar Soal untuk mulai latihan.</p>
        <div class="rev-empty-actions"><button class="btn btn-ink" onclick="goSec('list', document.querySelectorAll('.bnav-item')[0])"><i class="ti ti-plus" aria-hidden="true"></i> Tambah Soal</button></div>
      </div>`;
      return;
    }
    const nextLabel=srsNextDueLabel();
    el.innerHTML=`<div class="empty rev-empty rev-empty-ok">
      <i class="ti ti-calendar-check" aria-hidden="true"></i>
      <h3>Semua soal sudah direview</h3>
      <p>Tidak ada soal yang jatuh tempo saat ini. ${nextLabel?`Sesi berikutnya <b>${nextLabel}</b>.`:'Tambahkan lebih banyak soal untuk memulai latihan.'}</p>
      <div class="rev-empty-actions">
        <button class="btn btn-ink" onclick="startReview(true)"><i class="ti ti-bolt" aria-hidden="true"></i> Latihan Bebas</button>
        <button class="btn btn-s" onclick="goSec('list', document.querySelectorAll('.bnav-item')[0])"><i class="ti ti-plus" aria-hidden="true"></i> Tambah Soal</button>
      </div>
    </div>`;
    return;
  }
  renderRev();
}
function renderRev(){
  if(revIdx>=revList.length){renderRevSummary();return;}
  const q=revList[revIdx];revDone=false;
  const cat=cats[q.cat];
  const catName=escHtml(cat?(cat.name||q.cat):q.cat);
  const catDot=safeColor(cat&&cat.color,'#eeeeee');
  const catRing=safeColor(cat&&cat.textColor,autoTextColor(catDot));
  const pct=Math.round(((revIdx+1)/revList.length)*100);
  const pos=String(revIdx+1).padStart(2,'0'),total=String(revList.length).padStart(2,'0');
  document.getElementById('rev-content').innerHTML=`
    <div class="rev-head">
      <div class="rev-head-left">
        <span class="rev-cat"><span class="rev-dot" style="background:${catDot};--dot-ring:${catRing}" aria-hidden="true"></span><span class="rev-cat-name">${catName}</span></span>
        ${q.bab?`<span class="rev-sep" aria-hidden="true">·</span><span class="rev-bab">${escHtml(q.bab)}</span>`:''}
      </div>
      <span class="rev-count">${pos} / ${total}</span>
    </div>
    <div class="rev-prog" role="progressbar" aria-label="Progres latihan" aria-valuemin="0" aria-valuemax="${revList.length}" aria-valuenow="${revIdx+1}"><div class="rev-progf" style="width:${pct}%"></div></div>
    <div class="rcard rev-card">
      <p class="rq">${sanitizeHtml(q.q)}</p>
      ${q.qimgs&&q.qimgs.length?'<div style="margin-bottom:12px">'+q.qimgs.map(img=>{const ei=typeof img==='string'?{src:img,width:80}:img;return`<img src="${escHtml(ei.src)}" alt="Gambar soal" decoding="async" style="max-height:160px;border-radius:4px;border:0.5px solid var(--border);object-fit:contain;cursor:pointer;display:block;margin-bottom:6px" onclick="openLB('${escHtml(jsStr(ei.src))}','Gambar soal')">`;}).join('')+'</div>':''}
      <div class="ropts">${(q.opts||[]).map((o,i)=>{
        if(!LETTERS[i]||!o||!o.trim()||o==='<br>')return'';const l=LETTERS[i];
        const safeO=sanitizeHtml(o);
        const imgSrc=q.optImgs&&q.optImgs[l]?q.optImgs[l]:'';
        const extraImg=imgSrc&&!safeO.includes('<img')?`<img src="${escHtml(imgSrc)}" alt="Gambar pilihan ${l}" style="max-height:100px;max-width:100%;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin-top:4px">` :'';
        const displayHtml=safeO.replace(/<img([^>]*)style="[^"]*"([^>]*)>/gi,'<img$1style="max-height:100px;max-width:100%;width:auto;object-fit:contain;border-radius:4px;border:0.5px solid var(--border);display:block;margin-top:4px"$2>');
        return`<button class="ropt" data-l="${l}" onclick="ansRev(${q.id},'${l}',this)"><span class="ltr">${l}</span><div class="opt-html-content">${displayHtml}${extraImg}</div></button>`;
      }).join('')}</div>
      <div id="rfb" aria-live="polite"></div>
      <div class="rev-actions"><button class="btn btn-ink rev-next" id="rnext" style="display:none" onclick="nextRev()">Soal Berikutnya <i class="ti ti-arrow-right" aria-hidden="true"></i></button></div>
    </div>`;
}
function renderRevSummary(){
  sfx('session');confettiBurst();
  const total=revList.length;
  const sessionXP=revSessionXP||0;
  document.getElementById('rev-content').innerHTML=`
    <div class="rcard rev-summary">
      <i class="ti ti-circle-check rev-done-ic" aria-hidden="true"></i>
      <h2>Sesi selesai</h2>
      <p class="rev-summary-lead">${window._revFree?'Latihan bebas selesai — kamu sudah mengerjakan seluruh soal.':'Kamu sudah mereview semua soal yang jatuh tempo hari ini.'}</p>
      ${sessionWrong?'<p class="rev-summary-note">Soal yang salah otomatis disisipkan ulang dalam sesi ini untuk langsung dilatih ulang — karena itu angka &ldquo;Direview&rdquo; bisa lebih besar dari jumlah soal unik.</p>':''}
      <div class="rev-stats">
        <div class="scard"><div class="snum">${total}</div><div class="slbl">Direview</div></div>
        <div class="scard"><div class="snum" style="color:var(--success)">${sessionCorrect}</div><div class="slbl">Benar</div></div>
        <div class="scard"><div class="snum" style="color:var(--accent)">+${sessionXP}</div><div class="slbl">XP</div></div>
      </div>
      <p class="rev-next-due">Sesi berikutnya: <b>${srsNextDueLabel()||'Belum ada soal terjadwal'}</b></p>
      <button class="btn btn-ink" onclick="goSec('list', document.querySelector('.bnav-item'))"><i class="ti ti-books" aria-hidden="true"></i> Kembali ke Daftar Soal</button>
    </div>`;
  countUpNumbers('#rev-content');
}
function ansRev(qid,chosen,btn){
  if(revDone)return;revDone=true;
  const q=qs.find(x=>x.id===qid),ok=chosen===q.correct;
  document.querySelectorAll('.ropt').forEach(b=>{b.disabled=true;const l=b.dataset.l;if(l===chosen&&!ok)b.classList.add('rw');if(l===q.correct)b.classList.add('rc');if(l===chosen&&ok)b.classList.add('rc');});
  const eimgHtml=q.eimgs&&q.eimgs.length?'<div style="margin-top:8px">'+q.eimgs.map(img=>{const ei=typeof img==='string'?{src:img,width:80}:img;return'<img src="'+escHtml(ei.src)+'" alt="Gambar pembahasan" loading="lazy" decoding="async" onclick="openLB(\''+escHtml(jsStr(ei.src))+'\',\'Gambar pembahasan\')" style="max-height:200px;border-radius:4px;border:0.5px solid var(--border);cursor:pointer;object-fit:contain;display:block;margin-bottom:6px">';}).join('')+'</div>':'';
  const wasMastered=!!q.mastered;
  srsUpdate(q,ok);
  if(!ok){
    const reinsertAt=Math.min(revIdx+3,revList.length);
    revList.splice(reinsertAt,0,q);
  }
  const justMastered=!wasMastered&&q.mastered;
  ensureGami();trackDailyActivity();
  sfx(ok?'correct':'wrong');
  if(justMastered){sfx('mastered');confettiBurst();}
  const xpGain=(ok?10:2)+(justMastered?20:0);
  gami.xp+=xpGain;
  revSessionXP+=xpGain;
  if(ok)sessionCorrect++;else sessionWrong++;
  persist();
  checkBadges();
  renderGami();
  const srsMsg=ok?`Direview lagi dalam <b>${q.srs.interval} hari</b>.`:`Kartu ini akan muncul lagi sebentar lagi untuk dilatih ulang.`;
  const xpPill=`<span class="rev-xp"><i class="ti ti-bolt" aria-hidden="true"></i>+${xpGain} XP</span>`;
  const aiExpBtn=!q.expHtml?`<button id="gen-exp-btn-rev-${q.id}" class="btn btn-s rev-ai" onclick="generateExp(${q.id})" aria-label="Generate penjelasan AI"><i class="ti ti-sparkles" aria-hidden="true"></i> Generate Penjelasan</button>`:'';
  document.getElementById('rfb').innerHTML='<div class="rfb '+(ok?'right':'wrong')+'"><div class="rfb-head"><b>'+(ok?'Benar.':'Kurang tepat. Jawaban benar: '+q.correct+'.')+'</b>'+xpPill+'</div>'+(justMastered?'<div class="rev-mastered">Soal ini sekarang <b>Dikuasai</b>.</div>':'')+(q.expHtml?'<div class="exp-content">'+sanitizeHtml(q.expHtml)+'</div>':'')+eimgHtml+aiExpBtn+'<div class="rev-srs">'+srsMsg+'</div></div>';
  if(ok){q.mastered=q.srs.reps>=3;}
  document.getElementById('rnext').style.display='flex';
  updateDueBadge();
}
function nextRev(){revIdx++;renderRev();}

