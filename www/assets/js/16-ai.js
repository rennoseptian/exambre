/* ── AI FEATURES ── */

/* Feature 4.2 — Custom OpenAI-compatible provider */
const CAI_KEY='exambre_custom_ai';
function getCustomAI(){
  try{
    const c=JSON.parse(localStorage.getItem(CAI_KEY)||'null');
    if(!c||!c.baseUrl||!/^https?:\/\//i.test(c.baseUrl)||!c.model||!c.key)return null;
    return c;
  }catch(e){return null;}
}
function loadCustomAI(){
  const c=getCustomAI();
  ['cai-url','cai-model','cai-key'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const st=document.getElementById('custom-ai-status');if(!st)return;
  if(c){
    const urlEl=document.getElementById('cai-url'),mEl=document.getElementById('cai-model');
    if(urlEl)urlEl.value=c.baseUrl;if(mEl)mEl.value=c.model;
    st.textContent='✅ Aktif: '+c.model+' @ '+c.baseUrl.replace(/^https?:\/\//,'');
    st.style.color='var(--success)';
  }else{
    st.textContent='Belum ada provider kustom (memakai Gemini).';
    st.style.color='var(--text3)';
  }
}
function saveCustomAI(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const baseUrl=g('cai-url').trim().replace(/\/+$/,''),model=g('cai-model').trim(),key=g('cai-key').trim();
  if(!baseUrl||!model||!key){showToast('Lengkapi Base URL, Model, dan API key','warn');return;}
  if(!/^https?:\/\//i.test(baseUrl)){showToast('Base URL harus diawali http:// atau https://','warn');return;}
  localStorage.setItem(CAI_KEY,JSON.stringify({baseUrl,model,key}));
  loadCustomAI();showToast('Provider AI kustom aktif ✨','ok');
}
function clearCustomAI(){localStorage.removeItem(CAI_KEY);loadCustomAI();showToast('Kembali memakai Gemini','ok');}
async function callCustomAI(prompt){
  const c=getCustomAI();
  const res=await fetch(c.baseUrl+'/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},
    body:JSON.stringify({model:c.model,messages:[{role:'user',content:prompt}],temperature:0.4})
  });
  if(!res.ok){
    let msg=res.statusText;
    try{const e=await res.json();msg=(e.error&&e.error.message)||msg;}catch(_){}
    if(res.status===429)throw new Error('RATE_LIMIT');
    if(res.status===401||res.status===403)throw new Error('BAD_KEY');
    throw new Error(msg);
  }
  const data=await res.json();
  const text=data&&data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;
  if(!text)throw new Error('EMPTY_RESPONSE');
  return String(text).trim();
}
async function callAI(prompt){return getCustomAI()?callCustomAI(prompt):callGemini(prompt);}

async function callAIChat(systemText,hist){
  const c=getCustomAI();
  if(c){
    const res=await fetch(c.baseUrl+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},
      body:JSON.stringify({model:c.model,messages:[{role:'system',content:systemText},...hist.map(h=>({role:h.r==='user'?'user':'assistant',content:h.t}))],temperature:0.5,max_tokens:1024})
    });
    if(!res.ok){
      if(res.status===429)throw new Error('RATE_LIMIT');
      if(res.status===401||res.status===403)throw new Error('BAD_KEY');
      throw new Error(res.statusText);
    }
    const d=await res.json();
    const t=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
    if(!t)throw new Error('EMPTY_RESPONSE');
    return String(t).trim();
  }
  const key=localStorage.getItem('exambre_gemini_key');
  if(!key)throw new Error('NO_KEY');
  const contents=hist.map((h,i)=>({role:h.r==='user'?'user':'model',parts:[{text:i===0?(systemText+'\n\nPertanyaan user: '+h.t):h.t}]}));
  const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key='+key,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents,generationConfig:{temperature:0.5,maxOutputTokens:1024}})
  });
  if(!res.ok){
    if(res.status===429)throw new Error('RATE_LIMIT');
    if(res.status===400)throw new Error('BAD_KEY');
    throw new Error(res.statusText);
  }
  const d=await res.json();
  const t=d&&d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts&&d.candidates[0].content.parts[0]&&d.candidates[0].content.parts[0].text;
  if(!t)throw new Error('EMPTY_RESPONSE');
  return t.trim();
}

/* Feature 1.2 — Gemini API Key Management */
function loadGeminiKey(){
  const key=localStorage.getItem('exambre_gemini_key')||'';
  const inp=document.getElementById('gemini-key-inp');
  const status=document.getElementById('gemini-key-status');
  if(inp)inp.value=key;
  if(status){
    status.textContent=key?'✅ API key tersimpan ('+key.slice(0,8)+'...)':'Belum ada API key.';
    status.style.color=key?'var(--success)':'var(--text3)';
  }
}
function previewGeminiKey(val){
  const status=document.getElementById('gemini-key-status');if(!status)return;
  status.textContent=val?'Tekan Simpan untuk menyimpan key.':'Belum ada API key.';
  status.style.color='var(--text3)';
}
function saveGeminiKey(){
  const val=(document.getElementById('gemini-key-inp').value||'').trim();
  if(!val){localStorage.removeItem('exambre_gemini_key');loadGeminiKey();showToast('API key dihapus','ok');return;}
  if(val.length<20){showToast('API key terlalu pendek, pastikan menyalin key yang lengkap','warn',4000);return;}
  localStorage.setItem('exambre_gemini_key',val);loadGeminiKey();showToast('API key tersimpan','ok');
}

/* Feature 1.3 — Core Gemini API call */
async function callGemini(prompt){
  const key=localStorage.getItem('exambre_gemini_key');
  if(!key)throw new Error('NO_KEY');
  const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key='+key,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.4,maxOutputTokens:512}
    })
  });
  if(!res.ok){
    const err=await res.json().catch(()=>({}));
    const msg=err?.error?.message||res.statusText;
    if(res.status===429)throw new Error('RATE_LIMIT');
    if(res.status===400)throw new Error('BAD_KEY');
    throw new Error(msg);
  }
  const data=await res.json();
  const text=data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!text)throw new Error('EMPTY_RESPONSE');
  return text.trim();
}

/* Feature 1.1b — Gemini Vision API call */
async function callGeminiVision(base64, mimeType) {
  const key = localStorage.getItem('exambre_gemini_key');
  if (!key) throw new Error('NO_KEY');

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' + key,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: { mimeType: mimeType, data: base64 }
            },
            {
              text: `Kamu adalah sistem ekstraksi soal ujian dan tes seleksi apa pun.\nEkstrak semua informasi dari gambar soal ini.\n\nATURAN WAJIB:\n- Jawab HANYA dengan JSON valid. Tidak ada teks lain, tidak ada markdown, tidak ada backtick.\n- Jika field tidak ada di gambar, isi dengan string kosong "".\n- Salin teks PERSIS seperti di gambar, jangan ubah atau ringkas.\n- Untuk "pembahasan": format menggunakan HTML dasar: <p> paragraf, <b> tebal, <ol><li> daftar bernomor. Jangan gunakan tag lain.\n- Untuk "jawaban", tulis HANYA SATU HURUF KAPITAL (A, B, C, D, atau E) — TANPA titik, tanpa tanda kurung, tanpa teks lain. Contoh benar: "B". Contoh SALAH: "B. Sadar Berbangsa", "(B)", "b".
- Cari jawaban benar dari: warna hijau, tanda centang (✓), lingkaran terisi, atau kata Benar/Kunci/Answer di gambar.\n- Cari jawaban SALAH dari: warna merah/pink, tanda silang (✗), atau kata Jawaban Saya di gambar.\n\nFORMAT JSON:\n{\n  "soal": "teks lengkap soal termasuk nomor jika ada",\n  "A": "teks pilihan A",\n  "B": "teks pilihan B",\n  "C": "teks pilihan C",\n  "D": "teks pilihan D",\n  "E": "teks pilihan E",\n  "jawaban": "SATU HURUF jawaban BENAR (hijau/centang), kosong jika tidak ada",\n  "jawaban_saya": "SATU HURUF jawaban yang DIPILIH PENGGUNA (ada label: Jawaban kamu adalah X, Jawaban anda X, atau pilihan berwarna merah/pink), kosong jika tidak ada",\n  "pembahasan": "pembahasan dalam format HTML dasar jika ada di gambar, kosong jika tidak"\n}`
            }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      })
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (res.status === 400) throw new Error('BAD_KEY');
    throw new Error(err?.error?.message || res.statusText);
  }

  const data = await res.json();
  const text2 = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text2) throw new Error('EMPTY_RESPONSE');
  return text2.trim();
}

/* Feature 1.1c — Scan image → auto-fill form */
function showScanPreview(src) {
  const wrap = document.getElementById('scan-preview-wrap');
  const img  = document.getElementById('scan-preview-img');
  if (!wrap || !img) return;
  img.src = src;
  wrap.style.display = 'block';
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideScanPreview() {
  const wrap = document.getElementById('scan-preview-wrap');
  const img  = document.getElementById('scan-preview-img');
  if (wrap) wrap.style.display = 'none';
  if (img)  img.src = '';
}

async function scanImageToQuestion(inputEl) {
  const file = inputEl && inputEl.files && inputEl.files[0];
  if (!file) return;

  if (!localStorage.getItem('exambre_gemini_key')) {
    showToast('Masukkan Gemini API key dulu di Lainnya → AI Penjelasan', 'warn', 5000);
    inputEl.value = '';
    return;
  }

  const btn = document.getElementById('scan-img-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Memindai...';
  }

  try {
    // Read file — capture both full dataUrl (for preview) and base64 (for API)
    const { base64, dataUrl } = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve({ dataUrl: e.target.result, base64: e.target.result.split(',')[1] });
      reader.onerror = () => reject(new Error('Gagal membaca gambar'));
      reader.readAsDataURL(file);
    });
    showScanPreview(dataUrl); // tampilkan preview gambar asli

    const mimeType = file.type || 'image/jpeg';
    const rawResponse = await callGeminiVision(base64, mimeType);

    const clean = rawResponse.replace(/```json?|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      throw new Error('FORMAT_ERROR');
    }

    fillQuestionFormFromScan(parsed);
    showToast('Soal berhasil dipindai! Periksa kembali sebelum menyimpan ✨', 'ok', 6000);

  } catch (e) {
    const msg = e.message || '';
    if (msg === 'NO_KEY')           showToast('Masukkan Gemini API key dulu di menu Lainnya', 'warn', 5000);
    else if (msg === 'RATE_LIMIT')  showToast('Terlalu banyak request. Tunggu 1 menit lalu coba lagi.', 'warn', 5000);
    else if (msg === 'BAD_KEY')     showToast('API key tidak valid. Periksa kembali di menu Lainnya.', 'warn', 5000);
    else if (msg === 'FORMAT_ERROR') showToast('Gagal membaca format soal. Coba ambil foto lebih jelas.', 'warn', 5000);
    else showToast('Gagal memindai gambar: ' + msg, 'warn', 5000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-camera"></i> Scan Soal dari Foto/Screenshot';
    }
    if (inputEl) inputEl.value = '';
  }
}

function fillQuestionFormFromScan(parsed) {
  // Switch to manual mode (find the manual tab button and call switchMode)
  const manualTab = document.querySelector('#add-panel .t2[onclick*="manual"]');
  if (manualTab) switchMode('manual', manualTab);

  // Fill question text — m-q is a <textarea>, use .value
  const qEl = document.getElementById('m-q');
  if (qEl && parsed.soal) qEl.value = parsed.soal;

  // Fill options A–E (contenteditable divs with ids m-opt-A … m-opt-E)
  ['A','B','C','D','E'].forEach(l => {
    const optEl = document.getElementById('m-opt-' + l);
    if (optEl && parsed[l]) optEl.innerHTML = sanitizeHtml(parsed[l]);
  });

  // Set correct answer in select
  if (parsed.jawaban) {
    const sel = document.getElementById('m-correct');
    // Gemini kadang mengembalikan "B. Teks pilihan..." atau "(B)" atau "B)"
    // Ekstrak huruf pertama yang valid saja
    const raw = (parsed.jawaban || '').toUpperCase().trim();
    const letterMatch = raw.match(/\b([A-E])\b/);
    const jawaban = letterMatch ? letterMatch[1] : raw.charAt(0);
    if (sel && jawaban && LETTERS.includes(jawaban)) sel.value = jawaban;
  }

  // Fill wrong answer (jawaban saya yang salah — warna merah di screenshot)
  if (parsed.jawaban_saya) {
    const wrongSel = document.getElementById('m-wrong');
    const rawW = (parsed.jawaban_saya || '').toUpperCase().trim();
    const wrongMatch = rawW.match(/\b([A-E])\b/);
    const jawabanSaya = wrongMatch ? wrongMatch[1] : rawW.charAt(0);
    if (wrongSel && jawabanSaya && LETTERS.includes(jawabanSaya)) wrongSel.value = jawabanSaya;
  }

  // Fill explanation RTE
  if (parsed.pembahasan && parsed.pembahasan.trim()) {
    const expEl = document.getElementById('rte-m');
    if (expEl) expEl.innerHTML = sanitizeHtml(parsed.pembahasan);
  }
}

/* Feature 1.4 — Generate Explanation */
async function generateExp(qId){
  const q=qs.find(x=>x.id===qId);if(!q)return;
  const hasAI=!!(getCustomAI()||localStorage.getItem('exambre_gemini_key'));
  if(!hasAI){showToast('Atur AI dulu di menu Lainnya (Gemini key atau provider kustom)','warn',5000);return;}

  // Show loading state on all matching buttons (card + review)
  ['gen-exp-btn-'+qId,'gen-exp-btn-rev-'+qId].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Generating...';}
  });

  const optLabels=q.opts.map((o,i)=>(LETTERS[i]||String.fromCharCode(65+i))+'. '+o.replace(/<[^>]+>/g,''));
  const correctLabel=q.correct; // stored as letter 'A'–'E'

  const prompt=`Kamu adalah tutor ahli untuk berbagai jenis ujian dan tes seleksi.
Buat penjelasan singkat, jelas, dan mudah dipahami untuk soal berikut.

SOAL:
${q.q.replace(/<[^>]+>/g,'')}

PILIHAN JAWABAN:
${optLabels.join('\n')}

JAWABAN BENAR: ${correctLabel}

FORMAT WAJIB (gunakan HTML sederhana, hanya <p>, <b>, <ul>, <li>):
<p><b>Kenapa ${correctLabel} benar:</b> [penjelasan 2-3 kalimat]</p>
<p><b>Kenapa pilihan lain salah:</b> [ringkasan singkat]</p>
<p><b>Tips mengingat:</b> [1 kalimat tip praktis]</p>

Jangan gunakan tag lain. Jawab langsung tanpa preamble.`;

  try{
    const result=await callAI(prompt);
    const clean=result.replace(/\`\`\`html?|\`\`\`/gi,'').trim();
    q.expHtml=sanitizeHtml(clean);
    persist();render();
    showToast('Penjelasan berhasil digenerate! ✨','ok');
  }catch(e){
    ['gen-exp-btn-'+qId,'gen-exp-btn-rev-'+qId].forEach(id=>{
      const btn=document.getElementById(id);
      if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-sparkles"></i> Generate Penjelasan';}
    });
    if(e.message==='NO_KEY'){showToast('Masukkan Gemini API key dulu di menu Lainnya','warn',5000);}
    else if(e.message==='RATE_LIMIT'){showToast('Terlalu banyak request. Tunggu 1 menit lalu coba lagi.','warn',5000);}
    else if(e.message==='BAD_KEY'){showToast('API key tidak valid. Periksa kembali di menu Lainnya.','warn',5000);}
    else{showToast('Gagal generate: '+e.message,'warn',5000);}
  }
}

/* Feature 2.1 — Weakness Analysis */
function analyzeWeakness(){
  const catKeys=getCatKeys();
  if(!catKeys.length||!qs.length)return[];
  const dueSet=new Set(srsDueQs().map(q=>q.id));
  return catKeys.map(key=>{
    const catQs=qs.filter(q=>q.cat===key);
    const answered=catQs.filter(q=>q.srs&&q.srs.reps>0);
    const accuracy=answered.length
      ?answered.reduce((s,q)=>{const tot=q.srs.totalAttempts||0;return s+(tot>0?(q.srs.totalCorrect||0)/tot:0);},0)/answered.length
      :null;
    const avgEase=catQs.length?catQs.reduce((s,q)=>s+((q.srs&&q.srs.ease)||2.5),0)/catQs.length:2.5;
    const dueCount=catQs.filter(q=>dueSet.has(q.id)).length;
    const mastered=catQs.filter(q=>q.mastered).length;
    return{
      key,name:cats[key]?.name||key,color:cats[key]?.color||'var(--bg2)',textColor:cats[key]?.textColor||'var(--text)',
      total:catQs.length,answered:answered.length,accuracy,avgEase,dueCount,mastered,
      score:accuracy!==null?accuracy*0.6+(avgEase/3.5)*0.4:-1
    };
  }).sort((a,b)=>a.score-b.score);
}

/* Feature 2.2 — Render Weakness Section */
function renderWeaknessSection(){
  const data=analyzeWeakness();
  if(!data.length)return'';
  const hasAnswered=data.some(d=>d.accuracy!==null);
  if(!hasAnswered){
    return`<div class="panel" style="text-align:center;padding:24px;color:var(--text2);font-size:13px">
      <i class="ti ti-chart-bar" style="font-size:32px;display:block;margin-bottom:8px;opacity:.4"></i>
      Selesaikan beberapa soal dulu untuk melihat analisis kelemahan.
    </div>`;
  }
  const rows=data.map(d=>{
    const pct=d.accuracy!==null?Math.round(d.accuracy*100):null;
    const bar=pct!==null
      ?`<div style="height:6px;background:var(--bg3);border-radius:3px;margin-top:4px"><div style="width:${pct}%;height:100%;border-radius:3px;background:${pct>=70?'var(--success)':pct>=40?'var(--accent)':'var(--warn)'};transition:width .4s"></div></div>`
      :'<p style="font-size:11px;color:var(--text3);margin:4px 0 0">Belum pernah dijawab</p>';
    return`<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:600;color:var(--text)">${d.name}</span>
        <span style="font-size:12px;color:${pct===null?'var(--text3)':pct>=70?'var(--success)':pct>=40?'var(--accent)':'var(--warn)'};font-weight:700">${pct!==null?pct+'%':'—'}</span>
      </div>${bar}
      <div style="display:flex;gap:12px;margin-top:4px">
        <span style="font-size:11px;color:var(--text3)">${d.total} soal</span>
        <span style="font-size:11px;color:var(--text3)">${d.mastered} dikuasai</span>
        <span style="font-size:11px;color:var(--text3)">${d.dueCount} jatuh tempo</span>
      </div>
    </div>`;
  }).join('');
  const weakest=data[0];
  const tip=weakest.accuracy!==null
    ?`Fokuskan review ke <b>${weakest.name}</b> — akurasi kamu di sana baru ${Math.round(weakest.accuracy*100)}%.`
    :`Mulai kerjakan soal di <b>${weakest.name}</b> untuk memulai analisis.`;
  return`<div class="panel" style="margin-bottom:var(--sp-4)">
    <h3 style="font-size:14px;font-weight:700;margin-bottom:4px">
      <i class="ti ti-target" style="color:var(--warn)"></i> Analisis Kelemahan
    </h3>
    <div style="background:var(--bg2);border-radius:var(--radius);padding:10px 12px;margin-bottom:12px;font-size:13px;line-height:1.6;color:var(--text2)">
      💡 ${tip}
    </div>
    <div style="padding:0 2px">${rows}</div>
  </div>`;
}

/* Feature 3.2 — Exam Date Functions */
function loadExamDate(){
  const saved=localStorage.getItem('exambre_exam_date');
  const inp=document.getElementById('exam-date-inp');
  if(inp&&saved)inp.value=saved;
  updateExamDateStatus(saved);
}
function saveExamDate(val){
  if(!val)return;
  const d=new Date(val);
  if(d<=new Date()){showToast('Tanggal ujian harus di masa depan','warn');return;}
  localStorage.setItem('exambre_exam_date',val);updateExamDateStatus(val);showToast('Tanggal ujian disimpan','ok');
}
function clearExamDate(){
  localStorage.removeItem('exambre_exam_date');
  const inp=document.getElementById('exam-date-inp');if(inp)inp.value='';
  updateExamDateStatus(null);
}
function updateExamDateStatus(val){
  const status=document.getElementById('exam-date-status');if(!status)return;
  if(!val){status.textContent='Belum ada tanggal ujian.';return;}
  const days=Math.ceil((new Date(val)-Date.now())/86400000);
  status.textContent=days>0?`📅 ${days} hari lagi menuju ujian`:'Ujian sudah lewat.';
  status.style.color=days<=7?'var(--warn)':'var(--text3)';
}

/* Feature 3.3 — Readiness Calculation */
function calcReadiness(){
  const examDate=localStorage.getItem('exambre_exam_date');
  if(!examDate||!qs.length)return null;
  const daysLeft=Math.ceil((new Date(examDate)-Date.now())/86400000);
  if(daysLeft<=0)return null;
  const total=qs.length;
  const mastered=qs.filter(q=>q.mastered).length;
  const answered=qs.filter(q=>q.srs&&q.srs.reps>0).length;
  const avgAccuracy=answered
    ?qs.filter(q=>q.srs&&q.srs.reps>0).reduce((s,q)=>{const tot=q.srs.totalAttempts||0;return s+(tot>0?(q.srs.totalCorrect||0)/tot:0);},0)/answered
    :0;
  const reviewedLast7=qs.filter(q=>q.srs&&q.srs.due&&q.srs.due>Date.now()-7*86400000&&q.srs.reps>0).length;
  const dailyPace=Math.max(1,Math.round(reviewedLast7/7));
  const remaining=total-mastered;
  const daysNeeded=remaining>0?Math.ceil(remaining/dailyPace):0;
  const masteredScore=total>0?(mastered/total)*50:0;
  const accuracyScore=avgAccuracy*30;
  const timeScore=daysLeft>=daysNeeded?20:(daysLeft/Math.max(daysNeeded,1))*20;
  const score=Math.min(100,Math.round(masteredScore+accuracyScore+timeScore));
  return{score,daysLeft,daysNeeded,mastered,total,dailyPace,avgAccuracy:Math.round(avgAccuracy*100),label:score>=80?'Siap':score>=55?'Hampir Siap':'Perlu Latihan'};
}

/* Feature 3.4 — Render Readiness Widget */
function renderReadinessWidget(){
  const r=calcReadiness();if(!r)return'';
  const color=r.score>=80?'var(--success)':r.score>=55?'var(--accent)':'var(--warn)';
  const circumference=2*Math.PI*36;
  const dash=circumference*(1-r.score/100);
  return`<div class="panel" style="margin-bottom:var(--sp-4)">
    <h3 style="font-size:14px;font-weight:700;margin-bottom:16px">
      <i class="ti ti-rosette" style="color:${color}"></i> Kesiapan Ujian
    </h3>
    <div style="display:flex;align-items:center;gap:20px">
      <div style="flex-shrink:0">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="var(--bg3)" stroke-width="8"/>
          <circle cx="44" cy="44" r="36" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dash}"
            stroke-linecap="round"
            transform="rotate(-90 44 44)"
            style="transition:stroke-dashoffset .6s"/>
          <text x="44" y="48" text-anchor="middle" font-size="18" font-weight="800" fill="${color}">${r.score}</text>
        </svg>
      </div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800;color:${color};margin-bottom:4px">${r.label}</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          📅 ${r.daysLeft} hari menuju ujian<br>
          ✅ ${r.mastered}/${r.total} soal dikuasai<br>
          🎯 Akurasi rata-rata: ${r.avgAccuracy}%<br>
          ${r.daysNeeded>r.daysLeft?`⚠️ Butuh ±${r.daysNeeded} hari — percepat pace!`:`✨ Kamu on track dengan pace ${r.dailyPace} soal/hari`}
        </div>
      </div>
    </div>
  </div>`;
}

/* Feature 4.1 — Generate Soal dari Catatan */
function openNoteToQ(noteId){
  const n=notes.find(x=>x.id===noteId);if(!n)return;
  if(!getCatKeys().length){showToast('Buat kategori dulu di tab Lainnya → Kelola Kategori','warn',4000);return;}
  const src=(n.bodyText&&n.bodyText.trim())||(n.body||'').replace(/<[^>]+>/g,' ');
  if(!src.trim()){showToast('Catatan masih kosong','warn');return;}
  window._n2qId=noteId;
  const info=document.getElementById('note2q-info');if(info)info.textContent='Sumber: '+(n.title||'(Tanpa judul)');
  const cs=document.getElementById('note2q-cat');
  if(cs)cs.innerHTML=getCatKeys().map(k=>`<option value="${k}">${(cats[k]&&cats[k].name)||k}</option>`).join('');
  const modal=document.getElementById('note2q-modal');if(modal)modal.classList.add('on');
}
async function runNoteToQ(){
  const n=notes.find(x=>x.id===window._n2qId);if(!n)return;
  const modal=document.getElementById('note2q-modal');
  const cat=(document.getElementById('note2q-cat')||{}).value||'';
  if(!cat){showToast('Pilih kategori tujuan dulu','warn');return;}
  const cnt=parseInt((document.getElementById('note2q-count')||{}).value,10)||5;
  if(!(getCustomAI()||localStorage.getItem('exambre_gemini_key'))){showToast('Atur AI dulu di menu Lainnya (Gemini key atau provider kustom)','warn',5000);return;}
  const src=((n.bodyText&&n.bodyText.trim())?(n.bodyText.trim()):(n.body||'').replace(/<[^>]+>/g,' ')).slice(0,8000);
  const btn=document.getElementById('note2q-go');if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Membuat...';}
  const prompt=`Kamu adalah pembuat soal latihan ahli. Buat ${cnt} soal pilihan ganda BERDASARKAN materi berikut. Variasikan tingkat kesulitan dan utamakan pemahaman, bukan hafalan kata per kata.\n\nMATERI:\n${src}\n\nATURAN WAJIB:\n- Jawab HANYA dengan JSON valid. Tidak ada teks lain, tidak ada markdown, tidak ada backtick.\n- Format: {"questions":[{"soal":"...","A":"...","B":"...","C":"...","D":"...","E":"...","jawaban":"SATU HURUF KAPITAL","pembahasan":"<p>penjelasan singkat</p>"}]}\n- Opsi boleh hanya 4; isi E dengan string kosong "".\n- "jawaban" HANYA satu huruf kapital tanpa titik atau tanda kurung.\n- "pembahasan" memakai HTML sederhana (<p>, <b>, <ol>, <li>) dan menjelaskan MENGAPA kunci benar.`;
  try{
    const raw=await callAI(prompt);
    const clean=raw.replace(/```json?|```/gi,'').trim();
    let data;try{data=JSON.parse(clean);}catch(e){throw new Error('FORMAT_ERROR');}
    const arr=Array.isArray(data)?data:(data.questions||[]);
    let added=0;
    arr.forEach(it=>{
      const qtxt=((it&&it.soal)||'').trim();if(!qtxt)return;
      const opts=LETTERS.map(l=>(it[l]||'').trim());
      if(opts.filter(Boolean).length<2)return;
      const m=/\b([A-E])\b/.exec((it.jawaban||'').toUpperCase().trim());const cor=m?m[1]:'';
      if(!cor)return;
      qs.push({id:nid++,cat,bab:'',q:sanitizeHtml(qtxt),opts,optImgs:{},wrong:'',correct:cor,
        expHtml:it.pembahasan?sanitizeHtml(String(it.pembahasan)):'',
        qimgs:[],eimgs:[],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
      added++;
    });
    persist();
    if(modal)modal.classList.remove('on');
    if(added){checkBadges();updateDueBadge();renderGami();}
    showToast(added?`✨ ${added} soal berhasil dibuat dari catatan!`:'Tidak ada soal valid yang dihasilkan — coba lagi.',added?'ok':'warn',5000);
  }catch(e){
    const msg=e.message||'';
    if(msg==='BAD_KEY')showToast('API key tidak valid. Periksa di menu Lainnya.','warn',5000);
    else if(msg==='RATE_LIMIT')showToast('Kuota AI habis sebentar. Coba lagi beberapa menit.','warn',5000);
    else if(msg==='FORMAT_ERROR')showToast('Format balasan AI tidak terbaca. Coba lagi.','warn',5000);
    else showToast('Gagal membuat soal: '+msg,'warn',5000);
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-sparkles"></i> Generate';}
  }
}

/* Feature 4.3 — Batch scan multi-soal */
function _escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
async function callGeminiVisionBatch(base64,mime){
  const key=localStorage.getItem('exambre_gemini_key');
  if(!key)throw new Error('NO_KEY');
  const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key='+key,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      contents:[{parts:[
        {inlineData:{mimeType:mime,data:base64}},
        {text:`Kamu adalah sistem ekstraksi soal ujian dan tes seleksi apa pun.\nEkstrak SEMUA soal pilihan ganda yang terlihat pada gambar halaman ini.\n\nATURAN WAJIB:\n- Jawab HANYA dengan JSON valid. Tidak ada teks lain, tidak ada markdown, tidak ada backtick.\n- Salin teks PERSIS seperti di gambar, jangan ubah atau ringkas. Abaikan nomor soal.\n- Jika suatu field tidak ada di gambar, isi string kosong "".\n- "jawaban" HANYA SATU HURUF KAPITAL (A-E) dari kunci benar (warna hijau/centang/kata Kunci); kosongkan jika tidak ada.\n- "pembahasan" memakai HTML dasar (<p>, <b>, <ol>, <li>) jika terlihat; kosongkan jika tidak ada.\n\nFORMAT JSON:\n{"questions":[{"soal":"...","A":"...","B":"...","C":"...","D":"...","E":"...","jawaban":"X","pembahasan":""}]}`}
      ]}],
      generationConfig:{temperature:0.1,maxOutputTokens:8192}
    })
  });
  if(!res.ok){
    if(res.status===429)throw new Error('RATE_LIMIT');
    if(res.status===400)throw new Error('BAD_KEY');
    let msg=res.statusText;
    try{const e=await res.json();msg=(e.error&&e.error.message)||msg;}catch(_){}
    throw new Error(msg);
  }
  const data=await res.json();
  const text=data&&data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts&&data.candidates[0].content.parts[0]&&data.candidates[0].content.parts[0].text;
  if(!text)throw new Error('EMPTY_RESPONSE');
  return text.trim();
}
async function scanBatchToQuestions(inputEl){
  const file=inputEl&&inputEl.files&&inputEl.files[0];if(!file)return;
  if(!localStorage.getItem('exambre_gemini_key')){showToast('Scan foto memakai Gemini — masukkan API key dulu di Lainnya','warn',5000);inputEl.value='';return;}
  const btn=document.getElementById('batch-img-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Memindai halaman...';}
  try{
    const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(',')[1]);r.onerror=()=>rej(new Error('Gagal membaca gambar'));r.readAsDataURL(file);});
    const raw=await callGeminiVisionBatch(base64,file.type||'image/jpeg');
    const clean=raw.replace(/```json?|```/gi,'').trim();
    let data;try{data=JSON.parse(clean);}catch(e){throw new Error('FORMAT_ERROR');}
    const arr=Array.isArray(data)?data:(data.questions||[]);
    const items=[];
    arr.forEach(it=>{
      const qtxt=((it&&it.soal)||'').trim();if(!qtxt)return;
      const opts=LETTERS.map(l=>(it[l]||'').trim());
      const m=/\b([A-E])\b/.exec((it.jawaban||'').toUpperCase().trim());const cor=m?m[1]:'';
      const ok=opts.filter(Boolean).length>=2&&!!cor;
      items.push({soal:qtxt,opts,jawaban:cor,pembahasan:String(it.pembahasan||''),ok,_sel:ok});
    });
    if(!items.length)throw new Error('EMPTY_RESPONSE');
    window._batchItems=items;
    renderBatchPreview();
    const catSel=document.getElementById('batch-cat');
    if(catSel)catSel.innerHTML=getCatKeys().map(k=>`<option value="${k}">${(cats[k]&&cats[k].name)||k}</option>`).join('');
    document.getElementById('batch-modal').classList.add('on');
  }catch(e){
    const msg=e.message||'';
    if(msg==='RATE_LIMIT')showToast('Kuota AI habis sebentar. Coba lagi beberapa menit.','warn',5000);
    else if(msg==='BAD_KEY')showToast('API key tidak valid. Periksa di menu Lainnya.','warn',5000);
    else if(msg==='FORMAT_ERROR')showToast('Format balasan AI tidak terbaca. Foto lebih jelas & coba lagi.','warn',5000);
    else showToast('Gagal memindai: '+msg,'warn',5000);
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-file-text"></i> Scan Halaman — Banyak Soal Sekaligus';}
    if(inputEl)inputEl.value='';
  }
}
function renderBatchPreview(){
  const wrap=document.getElementById('batch-list');if(!wrap)return;
  wrap.innerHTML=(window._batchItems||[]).map((it,i)=>`
    <label class="batch-row${it.ok?'':' inv'}">
      <input type="checkbox" ${it._sel?'checked':''} ${it.ok?'':'disabled'} onchange="_bt(${i},this.checked)">
      <span style="flex:1">${_escHtml((i+1)+'. '+it.soal.slice(0,120))}${it.ok?'':' <b style="color:var(--danger-ink)">tidak valid</b>'}</span>
      <b style="flex-shrink:0">${it.jawaban||'—'}</b>
    </label>`).join('');
  updateBatchCount();
}
window._bt=function(i,v){if(window._batchItems[i]){window._batchItems[i]._sel=v;updateBatchCount();}};
function updateBatchCount(){
  const n=(window._batchItems||[]).filter(x=>x._sel).length;
  const b=document.getElementById('batch-go');
  if(b)b.innerHTML='<i class="ti ti-download"></i> Impor '+n+' Soal';
}
function closeBatchModal(){document.getElementById('batch-modal').classList.remove('on');}
function runBatchImport(){
  const cat=(document.getElementById('batch-cat')||{}).value||'';
  if(!cat){showToast('Pilih kategori tujuan dulu','warn');return;}
  const items=(window._batchItems||[]).filter(x=>x._sel&&x.ok);
  if(!items.length){showToast('Tidak ada soal terpilih','warn');return;}
  items.forEach(it=>{
    qs.push({id:nid++,cat,bab:'',q:sanitizeHtml(it.soal),opts:it.opts,optImgs:{},wrong:'',correct:it.jawaban,
      expHtml:it.pembahasan?sanitizeHtml(it.pembahasan):'',
      qimgs:[],eimgs:[],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
  });
  persist();closeBatchModal();
  checkBadges();updateDueBadge();renderGami();
  showToast('✅ '+items.length+' soal berhasil diimpor!','ok');
}

/* Feature 4.4 — Tanya Tutor per Soal */
function openTutor(qid){
  const q=qs.find(x=>x.id===qid);if(!q)return;
  if(!(getCustomAI()||localStorage.getItem('exambre_gemini_key'))){showToast('Atur AI dulu di menu Lainnya (Gemini key atau provider kustom)','warn',5000);return;}
  window._tutor={qid,hist:[]};
  const sub=document.getElementById('tutor-sub');
  if(sub)sub.textContent=_escHtml((q.q||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,90));
  const m=document.getElementById('tutor-msgs');if(m)m.innerHTML='';
  const inp=document.getElementById('tutor-inp');if(inp)inp.value='';
  document.getElementById('tutor-modal').classList.add('on');
  setTimeout(()=>{if(inp)inp.focus();},180);
}
function closeTutor(){document.getElementById('tutor-modal').classList.remove('on');}
function _tutorAdd(role,html){
  const w=document.getElementById('tutor-msgs');if(!w)return null;
  const d=document.createElement('div');d.className='tbub '+(role==='user'?'me':'ai');d.innerHTML=html;
  w.appendChild(d);w.scrollTop=w.scrollHeight;return d;
}
async function sendTutor(){
  if(!window._tutor)return;
  const inp=document.getElementById('tutor-inp');
  const text=(inp&&inp.value||'').trim();if(!text)return;
  const q=qs.find(x=>x.id===window._tutor.qid);if(!q)return;
  inp.value='';
  _tutorAdd('user',_escHtml(text));
  window._tutor.hist.push({r:'user',t:text});
  const load=_tutorAdd('ai','<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> menyusun jawaban…');
  const btn=document.getElementById('tutor-send');if(btn)btn.disabled=true;
  try{
    const system=[
      'Kamu adalah tutor pribadi yang sabar dan jelas untuk soal berikut.',
      'SOAL: '+(q.q||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),
      'OPSI: '+((q.opts||[]).map((o,i)=>o?LETTERS[i]+'. '+String(o).replace(/<[^>]+>/g,' ').trim():null).filter(Boolean).join(' | ')||'(tanpa opsi)'),
      'KUNCI BENAR: '+q.correct,
      'JAWABAN USER: '+(q.wrong?q.wrong+' (tercatat salah)':'belum menjawab'),
      'PEMBAHASAN TERSIMPAN: '+(q.expHtml?String(q.expHtml).replace(/<[^>]+>/g,' ').slice(0,600):'(tidak ada)'),
      '',
      'ATURAN: Jawab HANYA pertanyaan user terakhir — jangan melanjutkan kalimat siapa pun, jangan mengarang konteks baru. Singkat, padat, bahasa Indonesia santai. Format HTML sederhana (<p>, <b>, <ul>, <li>) tanpa markdown tanpa backtick.'
    ].join('\n');
    const out=await callAIChat(system,window._tutor.hist);
    load.innerHTML=sanitizeHtml(String(out).replace(/```html?|```/gi,''));
    window._tutor.hist.push({r:'ai',t:String(out).slice(0,2000)});
  }catch(e){
    const msg=e.message||'';
    load.innerHTML='<span style="color:var(--danger-ink)">'+(msg==='RATE_LIMIT'?'Kuota AI habis sebentar — coba beberapa menit lagi.':msg==='BAD_KEY'?'API key tidak valid. Periksa Lainnya.':'Gagal: '+_escHtml(msg))+'</span>';
  }finally{if(btn)btn.disabled=false;}
}


