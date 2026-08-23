/* ── STATISTIK PER KATEGORI ── */
function renderStatsPage(){
  const el=document.getElementById('stats-content');if(!el)return;
  if(!qs.length){el.innerHTML='<div class="empty"><i class="ti ti-chart-bar"></i><p>Belum ada soal untuk dianalisis.<br>Tambahkan soal dulu di tab Daftar Soal.</p></div>';return;}

  const totalAll=qs.length;
  const masteredAll=qs.filter(q=>q.mastered).length;
  const dueAll=srsDueQs().length;
  const attAll=qs.reduce((s,q)=>s+ensureSrs(q).totalAttempts,0);
  const corAll=qs.reduce((s,q)=>s+ensureSrs(q).totalCorrect,0);
  const accAll=attAll?Math.round(corAll/attAll*100):null;

  let html=renderReadinessWidget();
  html+=renderPolaPanel();
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
        <span style="font-weight:700;color:var(--red800);font-size:13px">Perlu Fokus: ${c.name||weakest.k}</span>
      </div>
      <p style="font-size:12px;color:var(--red800);opacity:.85;line-height:1.5">Akurasi cuma <b>${weakest.acc}%</b> dari ${weakest.att}x latihan — paling lemah dibanding kategori lain. Coba fokus latihan di sini dulu.</p>
    </div>`;
  }

  html+=rows.map(r=>{
    const c=cats[r.k];
    const accLabel=r.acc===null?'Belum direview':r.acc+'%';
    const accColor=r.acc===null?'var(--text3)':r.acc>=80?'var(--green800)':r.acc>=50?'var(--amber800)':'var(--red800)';
    return`<div class="panel" style="padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="badge" style="${catBadgeStyle(r.k)};font-size:12px">${c.name||r.k}</span>
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
}

