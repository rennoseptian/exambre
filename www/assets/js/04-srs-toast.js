/* ── SPACED REPETITION ──
   Skema mirip SM-2 yang disederhanakan:
   - reps 1 → interval 1 hari, reps 2 → 6 hari, reps 3+ → interval*ease
   - Jawaban salah: reps reset ke 0, interval ke 0 (jatuh tempo lagi sekarang),
     ease turun, dan kartu disisipkan lagi beberapa soal ke depan di sesi review
     yang sedang berjalan supaya langsung dilatih ulang.
   - "Dikuasai" sekarang berarti sudah lolos 3x rep berturut-turut (bukan cuma sekali benar). */
const DAY_MS=86400000;
function ensureSrs(q){
  if(!q.srs)q.srs={due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0,totalAttempts:0,totalCorrect:0,lastReviewedAt:0};
  if(q.srs.totalAttempts===undefined)q.srs.totalAttempts=0;
  if(q.srs.totalCorrect===undefined)q.srs.totalCorrect=0;
  if(q.srs.lastReviewedAt===undefined)q.srs.lastReviewedAt=0;
  return q.srs;
}
function srsUpdate(q,correct){
  const s=ensureSrs(q);
  s.totalAttempts+=1;
  s.lastReviewedAt=Date.now();
  if(correct){
    s.totalCorrect+=1;
    s.reps+=1;
    if(s.reps===1)s.interval=1;
    else if(s.reps===2)s.interval=6;
    else s.interval=Math.max(1,Math.round(s.interval*s.ease));
    s.ease=Math.min(2.8,+(s.ease+0.05).toFixed(2));
    q.mastered=s.reps>=3;
  }else{
    s.lapses+=1;s.reps=0;s.interval=0;
    s.ease=Math.max(1.3,+(s.ease-0.2).toFixed(2));
    q.mastered=false;
  }
  s.due=Date.now()+s.interval*DAY_MS;
}
function srsDueQs(){const now=Date.now();return qs.filter(q=>ensureSrs(q).due<=now);}
function srsNextDueLabel(){
  const future=qs.map(q=>ensureSrs(q).due).filter(d=>d>Date.now()).sort((a,b)=>a-b);
  if(!future.length)return'';
  const d=new Date(future[0]);
  const sameDay=d.toDateString()===new Date().toDateString();
  return(sameDay?'Hari ini, ':d.toLocaleDateString('id-ID',{day:'numeric',month:'long'})+', ')+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function updateDueBadge(){
  const b=document.getElementById('due-badge');if(!b)return;
  const n=srsDueQs().length;
  if(n>0){b.textContent=n>99?'99+':n;b.style.display='flex';}else{b.style.display='none';}
}

/* ── TOAST ── */
function showToast(msg,type='',dur=3000){
  const w=document.getElementById('toast-wrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.innerHTML=msg;
  w.appendChild(t);
  setTimeout(()=>t.classList.add('on'),10);
  setTimeout(()=>{t.classList.remove('on');setTimeout(()=>t.remove(),300);},dur);
}
function showToastWithUndo(msg,onUndo,dur=4000){
  const w=document.getElementById('toast-wrap');
  const t=document.createElement('div');
  t.className='toast ok';
  t.innerHTML=msg+' <button onclick="this.closest(\'.toast\')._undo()" style="background:transparent;border:none;color:inherit;font-weight:700;cursor:pointer;text-decoration:underline;font-size:12px;margin-left:8px;font-family:inherit">Batalkan</button>';
  t._undo=()=>{onUndo();t.classList.remove('on');setTimeout(()=>t.remove(),300);};
  w.appendChild(t);
  setTimeout(()=>t.classList.add('on'),10);
  setTimeout(()=>{t.classList.remove('on');setTimeout(()=>t.remove(),300);},dur);
}

