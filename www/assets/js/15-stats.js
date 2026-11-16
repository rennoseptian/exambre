/* ── STATISTIK PER KATEGORI ── */
function renderStatsPage(){
  const el=document.getElementById('stats-content');if(!el)return;
  const examHtml=typeof renderExamDatePanel==='function'?renderExamDatePanel():'';
  if(!qs.length){
    el.innerHTML=examHtml+'<div class="empty"><i class="ti ti-chart-bar"></i><p>Belum ada soal untuk dianalisis.<br>Tambahkan soal dulu di tab Daftar Soal.</p></div>';
    if(typeof loadExamDate==='function')loadExamDate();
    return;
  }

  const totalAll=qs.length;
  const masteredAll=qs.filter(q=>q.mastered).length;
  const dueAll=srsDueQs().length;
  const attAll=qs.reduce((s,q)=>s+ensureSrs(q).totalAttempts,0);
  const corAll=qs.reduce((s,q)=>s+ensureSrs(q).totalCorrect,0);
  const accAll=attAll?Math.round(corAll/attAll*100):null;

  let html=examHtml+renderReadinessWidget();
  html+=renderPolaPanel();
  html+=renderStatsHero(totalAll,masteredAll,dueAll,accAll);
  html+=`<div class="stats" style="margin-bottom:16px">
    <div class="scard"><div class="snum">${totalAll}</div><div class="slbl">Total Soal</div></div>
    <div class="scard"><div class="snum" style="color:var(--success)">${masteredAll}</div><div class="slbl">Dikuasai</div></div>
    <div class="scard"><div class="snum" style="color:var(--accent)">${dueAll}</div><div class="slbl">Jatuh Tempo</div></div>
    <div class="scard"><div class="snum">${accAll===null?'—':accAll+'%'}</div><div class="slbl">Akurasi</div></div>
  </div>`;

  ensureGami();
  html+=`<div class="panel" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ti ti-flame" style="font-size:26px;color:var(--gold-dark)"></i><div><div style="font-size:20px;font-weight:800">${gami.streak} hari</div><div style="font-size:11px;color:var(--text2);font-weight:700">Streak belajar</div></div></div>
    <div style="display:flex;align-items:center;gap:8px"><i class="ti ti-bolt" style="font-size:26px;color:var(--accent)"></i><div><div style="font-size:20px;font-weight:800">${gami.xp} XP</div><div style="font-size:11px;color:var(--text2);font-weight:700">Total XP terkumpul</div></div></div>
    <div style="display:flex;align-items:center;gap:8px"><i class="ti ti-award" style="font-size:26px;color:var(--purple800)"></i><div><div style="font-size:20px;font-weight:800">${gami.badges.length}</div><div style="font-size:11px;color:var(--text2);font-weight:700">Lencana terkumpul</div></div></div>
  </div>`;
  const badgeDefs=allBadgeDefs();
  html+=`<div style="font-size:13px;font-weight:800;margin-bottom:8px">🏅 Lencana</div><div class="badge-grid">`+badgeDefs.map(b=>`<div class="ach${b.unlocked?' unlocked':''}" title="${b.desc}"><span class="ach-ic">${b.icon}</span><div class="ach-name">${b.name}</div><div class="ach-desc">${b.desc}</div></div>`).join('')+`</div>`;

  const rows=getCatKeys().map(k=>{
    const catQs=qs.filter(q=>q.cat===k);
    const total=catQs.length;
    if(!total)return null;
    const mastered=catQs.filter(q=>q.mastered).length;
    const due=catQs.filter(q=>ensureSrs(q).due<=Date.now()).length;
    const att=catQs.reduce((s,q)=>s+ensureSrs(q).totalAttempts,0);
    const cor=catQs.reduce((s,q)=>s+ensureSrs(q).totalCorrect,0);
    const acc=att?Math.round(cor/att*100):null;
    const pct=total?Math.round(mastered/total*100):0;
    return{k,total,mastered,due,acc,pct,att};
  }).filter(Boolean);

  const weakCandidates=rows.filter(r=>r.att>=3&&r.acc!==null).sort((a,b)=>a.acc-b.acc);
  const weakest=weakCandidates[0];
  if(weakest){
    const c=cats[weakest.k];
    html+=`<div class="panel" style="border-color:#F09595;background:var(--red50);padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <i class="ti ti-alert-triangle" style="color:var(--red800);font-size:17px"></i>
        <span style="font-weight:700;color:var(--red800);font-size:13px">Perlu Fokus: ${escHtml(c.name||weakest.k)}</span>
      </div>
      <p style="font-size:12px;color:var(--red800);opacity:.85;line-height:1.5">Akurasi cuma <b>${weakest.acc}%</b> dari ${weakest.att}x latihan — paling lemah dibanding kategori lain. Coba fokus latihan di sini dulu.</p>
    </div>`;
  }

  html+=renderAccChart(rows);

  html+=rows.map(r=>{
    const c=cats[r.k];
    const accLabel=r.acc===null?'Belum direview':r.acc+'%';
    const accColor=r.acc===null?'var(--text3)':r.acc>=80?'var(--green800)':r.acc>=50?'var(--amber800)':'var(--red800)';
    return`<div class="panel" style="padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="badge" style="${catBadgeStyle(r.k)};font-size:12px">${escHtml(c.name||r.k)}</span>
        <span style="font-size:11px;color:var(--text2)">${r.total} soal</span>
      </div>
      <div class="prog" style="margin-bottom:10px"><div class="progf" style="width:${r.pct}%"></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
        <div><div style="font-size:16px;font-weight:700">${r.mastered}/${r.total}</div><div style="font-size:10px;color:var(--text2)">Dikuasai</div></div>
        <div><div style="font-size:16px;font-weight:700;${r.due>0?'color:var(--accent)':''}">${r.due}</div><div style="font-size:10px;color:var(--text2)">Jatuh Tempo</div></div>
        <div><div style="font-size:16px;font-weight:700;color:${accColor}">${accLabel}</div><div style="font-size:10px;color:var(--text2)">Akurasi</div></div>
      </div>
    </div>`;
  }).join('');

  html+=renderWeaknessSection();
  el.innerHTML=html;
  if(typeof loadExamDate==='function')loadExamDate();
  countUpNumbers('#stats-content');
  animateStatsVisuals(el);
}

function bindPasteArea(){
  const pa=document.getElementById('paste-ta');if(!pa||pa._bound)return;pa._bound=true;
  pa.addEventListener('input',()=>{clearTimeout(pa._pt);pa._pt=setTimeout(runParseFromRich,400);});
  pa.addEventListener('paste',()=>{clearTimeout(pa._pt);pa._pt=setTimeout(runParseFromRich,600);});
  pa.addEventListener('click',e=>{if(e.target.tagName==='IMG')openLB(e.target.src);});
}

/* ── SPLASH ── */
function initExambreSplash() {
  const overlay = document.getElementById('exambre-splash');
  if (!overlay) return;
  setTimeout(dismissSplash, 2200);
}
function dismissSplash() {
  const overlay = document.getElementById('exambre-splash');
  if (!overlay || overlay.classList.contains('hide')) return;
  overlay.classList.add('hide');
  setTimeout(() => overlay.remove(), 500);
  if (!window._obChecked) { window._obChecked = true; setTimeout(maybeShowOnboard, 350); }
}



/* ── Visual statistik: cincin progres, grafik akurasi, animasi masuk ── */
function statsRing(pct,color,label,sub){
  const C=2*Math.PI*34,to=C*(1-Math.max(0,Math.min(100,pct))/100);
  return`<div class="ring-card"><div class="ring-wrap"><svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-bg" cx="40" cy="40" r="34"/><circle class="ring-fg" cx="40" cy="40" r="34" style="stroke:${color};--c:${C.toFixed(1)};--to:${to.toFixed(1)}"/></svg><div class="ring-val"><b data-count="${pct}" data-suffix="%">${pct}%</b></div></div><div class="ring-lbl">${label}</div><div class="ring-sub">${sub}</div></div>`;
}
function renderStatsHero(total,mastered,due,acc){
  const mp=total?Math.round(mastered/total*100):0;
  const ap=acc===null?0:acc;
  const ac=acc===null?'var(--text3)':acc>=80?'var(--success)':acc>=50?'var(--streak)':'var(--danger)';
  return`<div class="panel hero-rings" role="group" aria-label="Ringkasan belajar">
    ${statsRing(mp,'var(--accent)','Penguasaan',mastered+' dari '+total+' soal')}
    ${statsRing(ap,ac,'Akurasi',acc===null?'Belum direview':due+' soal jatuh tempo')}
  </div>`;
}
function renderAccChart(rows){
  const withAcc=rows.filter(r=>r.acc!==null).sort((a,b)=>b.acc-a.acc);
  if(!withAcc.length)return`<div class="panel"><div class="chart-title"><i class="ti ti-chart-bar"></i> Akurasi per Kategori</div><p class="chart-empty">Grafik muncul setelah kamu mereview beberapa soal.</p></div>`;
  return`<div class="panel"><div class="chart-title"><i class="ti ti-chart-bar"></i> Akurasi per Kategori</div>`+withAcc.map((r,i)=>{
    const c=cats[r.k]||{};
    const col=r.acc>=80?'var(--success)':r.acc>=50?'var(--streak)':'var(--danger)';
    return`<div class="hbar-row"><span class="hbar-name">${escHtml(c.name||r.k)}</span><div class="hbar" role="img" aria-label="${r.acc} persen"><div class="hbar-fill" style="width:${r.acc}%;background:${col};--i:${i}"></div></div><span class="hbar-val">${r.acc}%</span></div>`;
  }).join('')+`</div>`;
}
function animateStatsVisuals(root){
  [...root.children].forEach((c,i)=>c.style.setProperty('--i',Math.min(i,8)));
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  root.querySelectorAll('[data-count]').forEach(el=>{
    const target=parseInt(el.dataset.count,10)||0,suf=el.dataset.suffix||'';if(!target)return;
    const t0=performance.now(),dur=900;
    (function step(t){const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=Math.round(target*e)+suf;if(k<1)requestAnimationFrame(step);})(t0);
  });
}
