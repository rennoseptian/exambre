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
  /* Di-render SEBELUM cek status: kontrol reasoning berdiri sendiri dan model aktif ikut
     berubah tiap provider kustom disimpan/dihapus. Kalau AFTER early-return, widgetnya
     diam-diam tidak muncul saat elemen status tidak ada. */
  renderReasonChips();
  const st=document.getElementById('custom-ai-status');if(!st)return;
  const keyInp=document.getElementById('cai-key');
  if(c){
    const urlEl=document.getElementById('cai-url'),mEl=document.getElementById('cai-model');
    if(urlEl)urlEl.value=c.baseUrl;if(mEl)mEl.value=c.model;
    if(keyInp)keyInp.placeholder='Tersimpan ('+c.key.slice(-4)+') — kosongkan jika tak ingin mengganti';
    st.textContent='✅ Aktif: '+c.model+' @ '+c.baseUrl.replace(/^https?:\/\//,'')+' · key ••••'+c.key.slice(-4);
    st.style.color='var(--success)';
  }else{
    if(keyInp)keyInp.placeholder='API key provider';
    st.textContent='Belum ada provider kustom (memakai Gemini).';
    st.style.color='var(--text3)';
  }
}
function saveCustomAI(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const baseUrl=g('cai-url').trim().replace(/\/+$/,''),model=g('cai-model').trim(),keyIn=g('cai-key').trim();
  const prev=getCustomAI();
  const key=keyIn||((prev&&prev.key)||'');
  if(!baseUrl||!model||!key){showToast(prev?'Isi Base URL & Model (key lama tetap dipakai jika kolom key dibiarkan kosong)':'Lengkapi Base URL, Model, dan API key','warn');return;}
  if(!/^https?:\/\//i.test(baseUrl)){showToast('Base URL harus diawali http:// atau https://','warn');return;}
  localStorage.setItem(CAI_KEY,JSON.stringify({baseUrl,model,key}));
  loadCustomAI();showToast('Provider AI kustom aktif ✨','ok');
}
function clearCustomAI(){localStorage.removeItem(CAI_KEY);loadCustomAI();showToast('Kembali memakai Gemini','ok');}

/* ── AI REQUEST LAYER: timeout, klasifikasi error, retry 503, cooldown per provider ── */
const AI_CD_KEY='exambre_ai_cooldown';          /* pengaturan/scratch — TIDAK ikut dihapus clearAllData */
const AI_TMO=45000;                             /* 45 detik; tanpa ini spinner bisa menggantung selamanya */
const GEM_MODEL='gemini-3.5-flash';
const GEM_MODEL_LITE='gemini-3.5-flash-lite';  /* fallback saat 503/overload */
const AI_RETRY_DELAYS=[0,1500,4000,9000,18000]; /* total ~32 dtk */
const AI_RETRYABLE=['OVERLOADED','NETWORK','TIMEOUT']; /* 429 SENGAJA TIDAK di sini — retry cuma memperpanjang throttle */

/* Cooldown = kunci lokal agar tidak menembak server yang sedang menolak.
   AI_CD_MAX hanya batas KUNCI (15 mnt) — durasi yang dilaporkan server tetap disimpan utuh
   untuk ditampilkan, supaya user tidak diberi tahu "15 menit" padahal resetnya besok. */
const AI_CD_MAX=15*60000;
function _aiCds(){try{const o=JSON.parse(localStorage.getItem(AI_CD_KEY)||'{}');return(o&&typeof o==='object'&&!Array.isArray(o))?o:{};}catch(e){return {};}}
function aiCooldownLeft(p){return Math.max(0,(Number(_aiCds()[p])||0)-Date.now());}
function aiSetCooldown(p,ms){const o=_aiCds();o[p]=Date.now()+Math.max(1000,Math.min(ms||0,AI_CD_MAX));try{localStorage.setItem(AI_CD_KEY,JSON.stringify(o));}catch(e){}}
function aiClearCooldown(p){const o=_aiCds();if(!(p in o))return;delete o[p];try{localStorage.setItem(AI_CD_KEY,JSON.stringify(o));}catch(e){}}
function aiCooldownLabel(ms){
  const s=Math.max(0,Math.ceil((Number(ms)||0)/1000));
  if(s<60)return s+' detik';
  const m=Math.ceil(s/60);
  if(m<60)return m+' menit';
  const h=Math.floor(m/60),r=m%60;
  if(h<24)return h+' jam'+(r?' '+r+' menit':'');
  return Math.ceil(h/24)+' hari';
}
function aiProviderLabel(p){return p==='groq'?'Provider kustom (Groq)':'Gemini';}

/* Durasi majemuk gaya Groq: "6m0s", "1h2m3s", "1.5s", "250ms" → total ms.
   Guard regex memastikan SELURUH string adalah rangkaian komponen yang valid, jadi
   exec() pasti membaca semuanya. Jangan_andalkan lastIndex: setelah loop selesai
   lastIndex di-reset ke 0, bukan panjang yang sudah dikonsumsi. */
function _aiDurMs(t){
  const s=String(t==null?'':t).trim();
  if(!/^(?:\d+(?:\.\d+)?(?:ms|h|m|s))+$/.test(s))return null;
  const u={ms:1,s:1000,m:60000,h:3600000},re=/(\d+(?:\.\d+)?)(ms|h|m|s)/g;
  let tot=0,m;
  while((m=re.exec(s)))tot+=parseFloat(m[1])*u[m[2]];
  return tot>0?tot:null;
}
/* Retry-After (detik / HTTP-date) + header reset Groq ("6m0s" / epoch) → ms.
   TIDAK di-cap di sini: nilai mentah dipakai untuk teks "reset dalam …". */
function _aiRetryMs(res,def){
  const H=res&&res.headers&&res.headers.get;
  if(!H)return def;
  const cap=24*3600000;
  const ra=H.call(res.headers,'retry-after');
  if(ra){const n=parseFloat(ra);
    if(isFinite(n)&&n>0)return Math.min(n*1000,cap);
    const d=Date.parse(ra);if(!isNaN(d))return Math.max(1000,Math.min(d-Date.now(),cap));}
  const xr=H.call(res.headers,'x-ratelimit-reset-requests')||H.call(res.headers,'x-ratelimit-reset-tokens');
  if(xr){const t=xr.trim();
    const dur=_aiDurMs(t);
    if(dur!==null)return Math.min(dur,cap);
    if(/^\d+(\.\d+)?$/.test(t)){const v=parseFloat(t),ms=v<1e11?v*1000:v,delta=ms-Date.now();
      if(isFinite(delta)&&delta>0)return Math.min(delta,cap);}}
  return def;
}
/* Sinyal overload di dalam body — Google balas 503, tapi beberapa proxy hanya teks */
const AI_OVERLOAD=/high demand|overload|spikes in demand|resource[ _-]?exhausted|capacity|temporarily unavailable|try again later|rate limit|too many requests|quota exceeded/i;
const AI_200_OVERLOAD=/currently experiencing high demand|Spikes in demand are usually temporary/i;

/* Metadata kuota dari body 429 Gemini. Retry-After TIDAK pernah dikirim Google, jadi tanpa
   parsing ini kita selalu menebak "1 menit" — padahal kuota HARIAN (…PerDay) juga balas 429
   dengan bentuk sama. Bentuk: error.details[].RetryInfo.retryDelay + QuotaFailure.quotaId. */
function _aiQuota(body){
  const out={retryMs:0,quotaId:''};
  const det=body&&body.error&&body.error.details;
  if(!Array.isArray(det))return out;
  det.forEach(d=>{
    if(!d||typeof d!=='object')return;
    const t=String(d['@type']||'');
    if(t.indexOf('RetryInfo')!==-1&&d.retryDelay!=null){
      const raw=String(d.retryDelay);
      const dur=_aiDurMs(raw);
      if(dur!==null)out.retryMs=dur;
      else if(/^\d+(\.\d+)?$/.test(raw))out.retryMs=parseFloat(raw)*1000;
    }
    if(t.indexOf('QuotaFailure')!==-1&&Array.isArray(d.violations)&&d.violations.length){
      const q=String((d.violations[0]||{}).quotaId||'');
      if(q)out.quotaId=q;
    }
  });
  return out;
}

function aiClassify(res,body){
  const st=(res&&res.status)||0;
  const msg=String((body&&(body.error&&(body.error.message||body.error.status))||(body&&body.message))||((res&&res.statusText)||''));
  if(st===429){
    const q=_aiQuota(body);
    return{code:'RATE_LIMIT',msg,retryMs:q.retryMs||_aiRetryMs(res,60000),quotaId:q.quotaId};
  }
  if(st===401||st===403)return{code:'BAD_KEY',msg,retryMs:0};
  if(st===400)return{code:/api[ _-]?key/i.test(msg)?'BAD_KEY':'BAD_REQUEST',msg,retryMs:0}; /* Gemini 400 = key rusak ATAU parameter salah */
  if(st===404)return{code:'NOT_FOUND',msg,retryMs:0};
  if(st===408||st===500||st===502||st===503||st===504)return{code:'OVERLOADED',msg,retryMs:_aiRetryMs(res,8000)};
  if(st>=400)return{code:'HTTP_ERROR',msg,retryMs:0};
  if(AI_OVERLOAD.test(msg))return{code:'OVERLOADED',msg,retryMs:8000};
  return{code:null,msg,retryMs:0};
}
function _aiErr(code,extra){const e=new Error(code);if(extra)Object.assign(e,extra);return e;}

/* Semua request AI wajib lewat sini: cek cooldown → timeout → retry 5xx → klasifikasi.
   maxTries=1 dipakai untuk percobaan model cadangan supaya total tunggu tidak berlipat. */
async function aiFetch(url,opts,pv,maxTries){
  pv=pv||'gemini';
  const tries=Math.max(1,Math.min(maxTries||AI_RETRY_DELAYS.length,AI_RETRY_DELAYS.length));
  const left=aiCooldownLeft(pv);
  if(left>0)throw _aiErr('COOLDOWN',{provider:pv,cooldown:left});
  let last={code:'NETWORK',msg:'',retryMs:0},n=0;
  while(n<tries){
    if(AI_RETRY_DELAYS[n])await new Promise(r=>setTimeout(r,AI_RETRY_DELAYS[n]));
    n++;
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),AI_TMO);
    let res;
    try{
      res=await fetch(url,Object.assign({},opts,{signal:ctrl.signal}));
    }catch(err){
      clearTimeout(timer);
      const aborted=err&&err.name==='AbortError';
      last={code:aborted?'TIMEOUT':'NETWORK',msg:aborted?'Waktu tunggu '+Math.round(AI_TMO/1000)+' detik habis':'Tidak ada koneksi ke server',retryMs:0};
      if(n>=tries)break;
      continue;
    }
    clearTimeout(timer);
    if(res.ok){aiClearCooldown(pv);return res;}
    const body=await res.json().catch(()=>null);
    last=aiClassify(res,body);
    if(!last.code||AI_RETRYABLE.indexOf(last.code)===-1)break;
    if(n>=tries)break;
  }
  /* Cooldown hanya dari klasifikasi FINAL — jangan dipasang di tengah loop, kalau tidak
     503 yang sempat muncul lalu gagal NETWORK akan meninggalkan kunci cooldown yang menyesatkan. */
  if(last.code==='RATE_LIMIT')aiSetCooldown(pv,last.retryMs||60000);
  else if(last.code==='OVERLOADED')aiSetCooldown(pv,last.retryMs||30000);
  throw _aiErr(last.code||'NETWORK',{provider:pv,detail:last.msg||'',retryMs:last.retryMs||0,quotaId:last.quotaId||''});
}

/* Bentuk balasan: OpenAI-compat (choices[0].message.content) vs Gemini (candidates[0].content.parts[0].text) */
function aiText(res,shape){
  return res.json().then(d=>{
    let t='';
    if(shape==='openai')t=(d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||'';
    else{
      const c=d&&d.candidates&&d.candidates[0];
      if(c&&c.finishReason&&/SAFETY|RECITATION|BLOCKLIST|PROHIBITED/i.test(c.finishReason))t='';
      else t=(c&&c.content&&c.content.parts&&c.content.parts[0]&&c.content.parts[0].text)||'';
      if(t&&AI_200_OVERLOAD.test(t))throw _aiErr('OVERLOADED',{provider:'gemini',detail:String(t).slice(0,160)});
    }
    if(!String(t).trim())throw _aiErr('EMPTY_RESPONSE');
    return String(t).trim();
  });
}
function _gemUrl(model,key){return 'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+key;}
const _gemHead={'Content-Type':'application/json'};
/* 503 "high demand" sering per-model, bukan per-kuota. Coba model lebih kecil satu kali
   (kuota tetap akun yang sama) sebelum menyerah. Callerعادkan error aslinya kalau tetap gagal. */
async function gemFetch(key,buildBody,forJson){
  const call=async(model,tries)=>{
    const body=buildBody(model);
    /* thinkingConfig hanya untuk model yang kapabilitasnya terverifikasi (reasonCap);
       model lain → applyReason tidak mengirim apa pun. */
    applyReason(body,model,forJson,'thinkingLevel');
    const res=await aiFetch(_gemUrl(model,key),{method:'POST',headers:_gemHead,body:JSON.stringify(body)},'gemini',tries);
    return await aiText(res,'gemini');
  };
  /* Fallback flash-lite. WAJIB aiClearCooldown dulu: kalau tidak, aiFetch langsung
     melempar COOLDOWN dan percobaan lite tidak pernah terpakai. */
  const tryLite=async err=>{
    if(err.message!=='OVERLOADED'||GEM_MODEL_LITE===GEM_MODEL)throw err;
    console.warn('Gemini overload, coba '+GEM_MODEL_LITE+':',err.detail||'');
    aiClearCooldown('gemini');
    return await call(GEM_MODEL_LITE,1);
  };
  let e=null;
  try{
    return await call(GEM_MODEL);
  }catch(x){e=x;}
  /* 400 yang menyebut thinkingLevel = tabel REASON_CAP usang untuk model ini. Matikan
     reasoning lalu ulangi TANPA parameter (satu kali). Error retry diteruskan ke tryLite
     supaya jalur flash-lite di bawah tetap kepakai kalau hasilnya OVERLOADED. */
  if(e.message==='BAD_REQUEST'&&e.detail&&/reasoning|effort|thinkinglevel|thinking level/i.test(e.detail)&&reasonCap(GEM_MODEL)&&!reasonOff(GEM_MODEL)){
    reasonOffAdd(GEM_MODEL);
    /* Flash-Lite ikut dimatikan: 400 come here means our table is stale, and the lite
       model is from the same family. Keeping reasoning on there would just be
       immediately 400 again on the fallback request. */
    reasonOffAdd(GEM_MODEL_LITE);
    console.warn('thinkingLevel tidak didukung',GEM_MODEL,'— dimatikan:',e.detail);
    showToast('Tingkat reasoning tidak didukung model ini — dinonaktifkan otomatis.','warn',6000);
    aiClearCooldown('gemini');
    try{return await call(GEM_MODEL);}catch(x){e=x;}
  }
  return await tryLite(e);
}

async function cekModelProvider(btn){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const baseUrl=g('cai-url').trim().replace(/\/+$/,'');
  const key=g('cai-key').trim()||((getCustomAI()||{}).key||'');
  if(!baseUrl||!/^https?:\/\//i.test(baseUrl)){showToast('Isi Base URL dulu','warn');return;}
  if(!key){showToast('Isi API key dulu (atau simpan provider dulu)','warn');return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Memuat...';}
  try{
    /* Provider id terpisah ('groq-list'): daftar model cuma diagnostik, tidak boleh
       mengunci cooldown generate yang dipakai user. */
    const res=await aiFetch(baseUrl+'/models',{headers:{'Authorization':'Bearer '+key}},'groq-list');
    if(res.status===401)throw new Error('API key tidak valid');
    if(!res.ok)throw new Error('HTTP '+res.status);
    const d=await res.json();
    const ids=(d.data||[]).map(m=>m.id).sort();
    const wrap=document.getElementById('cai-model-list');
    if(wrap){
      wrap.innerHTML='';
      if(!ids.length){wrap.innerHTML='<span style="font-size:11.5px;color:var(--text3)">Tidak ada model dilaporkan provider.</span>';}
      ids.forEach(id=>{
        const b=document.createElement('button');
        b.type='button';b.className='ctab';
        b.style.cssText='padding:5px 11px;min-height:0;font-size:11px;background:var(--bg2);color:var(--text);box-shadow:none';
        b.textContent=id;
        b.onclick=()=>{const m=document.getElementById('cai-model');if(m)m.value=id;};
        wrap.appendChild(b);
      });
      wrap.style.marginTop='8px';
    }
    showToast(ids.length+' model tersedia — klik salah satu untuk mengisi kolom Model','ok',4000);
  }catch(e){
    showToast('Gagal mengambil daftar model: '+escHtml(e.message),'warn',4500);
  }finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-list-check"></i> Cek Daftar Model';}}
}
/* ── Kontrol reasoning: hanya kirim parameter bila model mendukung ──
   Dua provider memakai NAMA BERBEDA, dan level di luar daftar resmi akan kena HTTP 400
   (Gemini "Not supported", Groq "Values outside a model's supported set are rejected").
   Jadi daftar ini WAJIB konservatif: model tak dikenal → tidak kirim apa pun. */
const REASON_KEY='exambre_reasoning';       /* auto|minimal|low|medium|high */
const REASON_OFF_KEY='exambre_reasoning_off';/* model yang otomatis dimatikan setelah 400 */
const REASON_LEVELS=[
  {v:'minimal',label:'Minimal',hint:'paling cepat & paling hemat kuota'},
  {v:'low',    label:'Rendah', hint:'cepat, cukup untuk soal biasa'},
  {v:'medium', label:'Sedang', hint:'seimbang (default model)'},
  {v:'high',   label:'Tinggi', hint:'paling akurat, paling boros kuota'},
];
/* levels diurutkan dari paling rendah — levels[0] dipakai otomatis untuk fitur JSON.
   SENGAJA sempit: hanya model yang kapabilitasnya sudah DIVERIFIKASI. Model Gemini lain
   (3.1/3.7/pro) tidak boleh nebak — level yang tak didukung kena 400 dan membakar kuota. */
const REASON_CAP=[
  {re:/gpt-oss-(20b|120b)|qwen3\.8-27b/i,field:'reasoning_effort',levels:['low','medium','high']},
  {re:/qwen3\.6-27b/i,                    field:'reasoning_effort',levels:['none','default']},
  {re:/^gemini-3\.5-flash/i,              field:'thinkingLevel',   levels:['minimal','low','medium','high']},
];
function reasonOffList(){try{const a=JSON.parse(localStorage.getItem(REASON_OFF_KEY)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function reasonOff(model){return reasonOffList().indexOf(String(model||''))!==-1;}
function reasonOffAdd(model){
  const a=reasonOffList(),id=String(model||'');
  if(!id||a.indexOf(id)!==-1)return;
  a.push(id);try{localStorage.setItem(REASON_OFF_KEY,JSON.stringify(a.slice(-20)));}catch(e){}
}
function reasonOffClear(){
  try{localStorage.removeItem(REASON_OFF_KEY);}catch(e){}
  renderReasonChips();
  showToast('Kendali reasoning diaktifkan lagi','ok',4000);
}
/* Kapabilitas murni dari model ID. SENGAJA tidak consulting reasonOff(): model yang
   reasoning-nya dimatikan masih model reasoning, jadi max_completion_tokens tetap perlu. */
function reasonCap(model){
  const id=String(model||'');
  if(!id)return null;
  for(const c of REASON_CAP)if(c.re.test(id))return c;
  return null;   /* model tak dikenal / tanpa reasoning → JANGAN kirim parameter */
}
function reasonChoice(){
  const v=localStorage.getItem(REASON_KEY)||'auto';
  return REASON_LEVELS.some(l=>l.v===v)?v:'auto';
}
function setReasonChoice(v){
  localStorage.setItem(REASON_KEY,REASON_LEVELS.some(l=>l.v===v)?v:'auto');
  renderReasonChips();
}
/* Model aktif = provider kustom bila ada, else Gemini */
function reasonActiveModel(){const c=getCustomAI();return c?c.model:GEM_MODEL;}
/* Level yang akan dikirim. forJson → dipaksa ke levels[0] (terendah) karena token
   reasoning yang banyak menaikkan peluang JSON rusak → FORMAT_ERROR → retry → boros. */
function reasonLevel(model,forJson){
  const cap=reasonCap(model);
  if(!cap||reasonOff(model))return null;
  const lv=reasonChoice();
  if(forJson)return{field:cap.field,value:cap.levels[0],cap};
  if(lv==='auto'||cap.levels.indexOf(lv)===-1)return null;
  return{field:cap.field,value:lv,cap};
}
/* Sisipkan parameter reasoning ke body request sesuai bentuk tiap provider.
   Gemini: generationConfig.thinkingConfig.thinkingLevel (bukan thinkingLevel langsung).
   Groq/OpenAI: reasoning_effort di root, DAN max_tokens → max_completion_tokens
   karena max_tokens deprecated untuk model reasoning (token reasoning memakan
   jatah itu → jawaban terpotong → EMPTY_RESPONSE). */
function applyReason(body,model,forJson,genField){
  const cap=reasonCap(model);if(!cap)return null;
  /* max_tokens deprecated untuk model reasoning → pakai max_completion_tokens TEPAKUT
     model-nya reasoning, terlepas dari apakah kita mengirim level atau tidak. Kalau hanya
     ikut level, mode 'auto' akan diam-diam kembali ke max_tokens yang bisa memotong jawaban. */
  if(cap.field==='reasoning_effort'&&body.max_tokens!==undefined){body.max_completion_tokens=body.max_tokens;delete body.max_tokens;}
  const r=reasonLevel(model,forJson);if(!r)return null;
  if(r.field==='reasoning_effort')body.reasoning_effort=r.value;
  else if(genField){
    body.generationConfig=body.generationConfig||{};
    body.generationConfig.thinkingConfig=Object.assign({},body.generationConfig.thinkingConfig);
    body.generationConfig.thinkingConfig[genField]=r.value;
  }
  return r.value;
}
function reasonUIHtml(){
  const model=reasonActiveModel(),cap=reasonCap(model);
  if(!cap)return'<p style="font-size:11.5px;color:var(--text3);margin-top:8px">Model <b>'+escHtml(model||'—')+'</b> tidak punya kendali reasoning, jadi tidak ada parameter yang dikirim.</p>';
  if(reasonOff(model))return'<p style="font-size:11.5px;color:var(--text3);margin-top:8px">Kendali reasoning untuk <b>'+escHtml(model)+'</b> dinonaktifkan otomatis karena server menolaknya (kemungkinan model/level ini tidak mendukung).</p>'
    +'<button class="btn btn-s btn-sm" style="margin-top:8px" onclick="reasonOffClear()"><i class="ti ti-refresh"></i> Aktifkan lagi</button>';
  const cur=reasonChoice();
  const chips=REASON_LEVELS.filter(l=>cap.levels.indexOf(l.v)!==-1).map(l=>
    '<button class="ctab ctab-sm'+(cur===l.v?' on':'')+'" onclick="setReasonChoice(\''+l.v+'\')" title="'+escHtml(l.hint)+'">'+l.label+'</button>').join('');
  const auto='<button class="ctab ctab-sm'+(cur==='auto'?' on':'')+'" onclick="setReasonChoice(\'auto\')" title="biarkan model memakai default-nya">Otomatis</button>';
  return'<div style="display:flex;flex-wrap:wrap;gap:6px">'+auto+chips+'</div>'
    +'<p style="font-size:11.5px;color:var(--text3);margin-top:8px;line-height:1.5">Terapkan ke <b>'+escHtml(model)+'</b> lewat <code>'+cap.field+'</code>. '
    +'Fitur scan/JSON otomatis memakai level terendah demi hasil JSON valid. '
    +'Tinggi paling akurat tapi paling cepat menghabiskan kuota.</p>';
}
function renderReasonChips(){
  const box=document.getElementById('reason-box');if(box)box.innerHTML=reasonUIHtml();
}

async function callCustomAI(prompt,json){
  const attempt=async useJson=>{
    const c=getCustomAI();
    const body={model:c.model,messages:[{role:'user',content:prompt}],temperature:useJson?0.3:0.4,max_tokens:2048};
    if(useJson)body.response_format={type:'json_object'};
    applyReason(body,c.model,useJson,null);
    const res=await aiFetch(c.baseUrl+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},
      body:JSON.stringify(body)
    },'groq');
    return await aiText(res,'openai');
  };
  try{
    return await attempt(json);
  }catch(e){
    /* 400 yang menyebut reasoning = tabel REASON_CAP usang untuk model ini (atau level tak
       didukung). Matikan untuk model ini lalu ulangi TANPA parameter — hanya sekali. */
    if(e.message==='BAD_REQUEST'&&e.detail&&/reasoning|effort|thinkinglevel/i.test(e.detail)){
      const c=getCustomAI();
      if(c&&reasonCap(c.model)&&!reasonOff(c.model)){
        reasonOffAdd(c.model);
        console.warn('Reasoning tidak didukung model',c.model,'— dimatikan untuk model ini:',e.detail);
        showToast('Tingkat reasoning tidak didukung model ini — dinonaktifkan otomatis untuk model tersebut.','warn',6000);
        return await attempt(json);
      }
    }
    /* Retry TANPA json:true dicoba untuk error yang mungkin disebabkan response_format
       (BAD_REQUEST dari provider, EMPTY_RESPONSE, FORMAT-ish). DICUALKAN: 429/COOLDOWN
       (retry cuma memperpanjang throttle), BAD_KEY & NOT_FOUND (percuma), serta
       OVERLOADED/NETWORK/TIMEOUT (sudah ditangani retry+jeda di aiFetch — mengulang di sini
       akan menembak provider dua kali dalam satu permintaan). */
    if(json&&!['RATE_LIMIT','BAD_KEY','NO_KEY','NOT_FOUND','COOLDOWN','OVERLOADED','NETWORK','TIMEOUT'].includes(e.message)){
      return await attempt(false);
    }
    throw e;
  }
}

async function callAI(prompt,json){
  const c=getCustomAI();
  if(!c)return callGemini(prompt,json);
  try{
    return await callCustomAI(prompt,json);
  }catch(e){
    /* Fallback TIDAK diam-diam lagi: pakai provider lain justru membakar kuota dua provider
       sekaligus dan menutupi provider mana yang sebenarnya bermasalah. Caller yang-au-toggle
       lewat aiOfferFallback() sebelum mengulang. */
    console.warn('Provider kustom gagal:',aiProviderLabel(e.provider||'groq'),'—',e.message,e.detail||'');
    throw e;
  }
}

/* Tawarkan pindah provider HANYA untuk error yang memang bisa diperbaiki provider lain
   (429/503/timeout/jaringan). Key/jaringan rusak TIDAK layak dicoba ke provider lain. */
const AI_FALLBACKABLE=['RATE_LIMIT','OVERLOADED','TIMEOUT','NETWORK','COOLDOWN'];
function aiCanFallback(e){return AI_FALLBACKABLE.indexOf((e&&e.message)||'')!==-1;}
function aiAltProvider(p){return(p||'')==='groq'?'gemini':'groq';}
function aiAltReady(p){return p==='gemini'?!!localStorage.getItem('exambre_gemini_key'):!!getCustomAI();}
/* Modality: true = hanya Gemini yang bisa (scan foto), jadi tak ada tawaran pindah */
function aiOfferFallback(e,fn,visionOnly){
  const p=(e&&e.provider)||'groq';
  const alt=aiAltProvider(p);
  if(!aiCanFallback(e))return false;
  if(!aiAltReady(alt)||visionOnly)return false;
  const left=(e.message==='COOLDOWN')?(e.cooldown||0):(e.retryMs||0);
  const pem=aiProviderLabel(p);
  const srv=(e&&e.retryMs)||0;
  const ket=e.message==='RATE_LIMIT'
    ? pem+' kehabisan kuota. Batas kuota berlaku per menit/produk, jadi menunggu sebentar tidak selalu membantu.'
    : pem+' sedanglibat/ penuh. Semua fitur AI akan gagal sampai recover.';
  let sisa='';
  if(srv>AI_CD_MAX)sisa=' Reset kuota diperkirakan '+aiCooldownLabel(srv)+' lagi — jauh lebih lama dari sebentar.';
  else if(left>0)sisa=' Tersedia lagi dalam '+aiCooldownLabel(left)+'.';
  showConfirm({
    icon:'⚠️',
    title:'AI '+pem+' bermasalah',
    body:ket+sisa+' Mau coba pakai '+aiProviderLabel(alt)+' untuk permintaan ini?',
    actionLabel:'Coba lewat '+aiProviderLabel(alt),
    actionClass:'btn-p',
    onConfirm:()=>{aiClearCooldown(p);fn();}
  });
  return true;
}
/* Pesan error seragam untuk semua fitur (ganti 8 mapper yang sebelumnya berbeda-beda).
   aiErrLabel = teks saja (untuk bubble inline), aiErrToast = versi toast. */
function aiErrLabel(msg,e){
  const m=String(msg||'');
  const cdG=aiCooldownLeft('gemini'),cdR=aiCooldownLeft('groq');
  const hint=()=>{
    const srv=(e&&e.retryMs)||0;
    const q=String((e&&e.quotaId)||'');
    /* Gemini tidak pernah mengirim Retry-Header, jadi durasi asalnya hanya dari
       RetryInfo.retryDelay. Kalau tidak ada, JANGAN menebak "per menit" — kuota harian
       juga balas 429 dengan bentuk identik, dan tebakan itu membuat user menunggu
       sia-sia padahal resetnya besok. */
    if(/perday|daily/i.test(q))return ' Ini kuota HARIAN yang habis, jadi mencoba lagi hari ini tidak akan berhasil — reset besok.';
    if(srv>0)return ' Batas kuota di server perkiraan '+aiCooldownLabel(srv)+' lagi.';
    return ' Batas kuota biasanya pulih dalam hitungan menit, tapi server tidak memberi tahu sisa waktunya. Coba lagi sebentar.';
  };
  if(m==='NO_KEY')return 'Masukkan Gemini API key dulu di menu Lainnya';
  if(m==='RATE_LIMIT')return 'Kuota AI habis sebentar.'+hint();
  if(m==='OVERLOADED')return 'Server AI sedang sibuk. Sudah dicoba ulang otomatis, masih belum tersedia.';
  if(m==='TIMEOUT')return 'Server AI tidak merespons dalam 45 detik. Coba lagi.';
  if(m==='NETWORK')return 'Tidak ada koneksi ke server AI. Periksa internet lalu coba lagi.';
  if(m==='BAD_KEY')return 'API key tidak valid. Periksa di menu Lainnya.';
  if(m==='BAD_REQUEST')return 'Permintaan ditolak server (model/parameter tidak cocok). Periksa pengaturan AI di Lainnya.';
  if(m==='NOT_FOUND')return 'Model tidak ditemukan di provider ini. Periksa nama model di Lainnya.';
  if(m==='COOLDOWN')return 'AI masih cooldown '+aiCooldownLabel(cdG||cdR)+'. Sabar sebentar ya.';
  if(m==='FORMAT_ERROR')return 'Format balasan AI tidak terbaca. Foto lebih jelas & coba lagi.';
  if(m==='EMPTY_RESPONSE')return 'Balasan AI kosong. Coba lagi.';
  return m;
}
function aiErrToast(msg,prefix,e){
  const m=String(msg||'');
  if(m==='RATE_LIMIT'||m==='OVERLOADED'||m==='TIMEOUT'||m==='NETWORK'||m==='BAD_KEY'||m==='BAD_REQUEST'||m==='NOT_FOUND'||m==='COOLDOWN'||m==='NO_KEY'||m==='FORMAT_ERROR'||m==='EMPTY_RESPONSE')
    return showToast(aiErrLabel(m,e),'warn',6000);
  return showToast((prefix?prefix+': ':'Gagal: ')+escHtml(m),'warn',5000);
}

async function callAIChat(systemText,hist){
  const c=getCustomAI();
  if(c){
    const res=await aiFetch(c.baseUrl+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},
      body:JSON.stringify({model:c.model,messages:[{role:'system',content:systemText},...hist.map(h=>({role:h.r==='user'?'user':'assistant',content:h.t}))],temperature:0.5,max_tokens:1024})
    },'groq');
    return await aiText(res,'openai');
  }
  const key=localStorage.getItem('exambre_gemini_key');
  if(!key)throw new Error('NO_KEY');
  const contents=hist.map((h,i)=>({role:h.r==='user'?'user':'model',parts:[{text:i===0?(systemText+'\n\nPertanyaan user: '+h.t):h.t}]}));
  return await gemFetch(key,()=>({contents,generationConfig:{temperature:0.5,maxOutputTokens:1024}}),false);
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
async function callGemini(prompt,json){
  const key=localStorage.getItem('exambre_gemini_key');
  if(!key)throw new Error('NO_KEY');
  return await gemFetch(key,()=>({
    contents:[{parts:[{text:prompt}]}],
    generationConfig:Object.assign({temperature:json?0.3:0.4,maxOutputTokens:2048},json?{response_mime_type:'application/json'}:{})
  }),json);
}

/* Feature 1.1b — Gemini Vision API call */
async function callGeminiVision(base64, mimeType) {
  const key = localStorage.getItem('exambre_gemini_key');
  if (!key) throw new Error('NO_KEY');

  return await gemFetch(key,()=>({
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
    }),true);
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
    /* WAJIB kompres sebelum kirim — file HP mentah bisa ~15.000 token gambar dan langsung
       menghabiskan kuota token per menit (429). compressImg() capped ~2.500 token.
       Preview memakai hasil kompres juga: tidak ada bedanya di layar, dan tidak menahan
       gambar mentah 5MB di memori. */
    const dataUrl = await compressImg(file, 1400, 0.85);
    if (!dataUrl) throw new Error('Gagal membaca gambar');
    showScanPreview(dataUrl);

    const base64 = dataUrl.split(',')[1];
    const mimeType = file.type || 'image/jpeg';
    const rawResponse = await callGeminiVision(base64, mimeType);

    const clean = rawResponse.replace(/```json?|```/gi, '').trim();

    let parsed;
    try {
      parsed = _extractJSON(clean);
    } catch (e) {
      throw new Error('FORMAT_ERROR');
    }

    fillQuestionFormFromScan(parsed);
    showToast('Soal berhasil dipindai! Periksa kembali sebelum menyimpan ✨', 'ok', 6000);

  } catch (e) {
    const msg = e.message || '';
    if (aiOfferFallback(e, () => scanImageToQuestion(inputEl), true)) return;
    aiErrToast(msg, '', e);
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
    else if(aiOfferFallback(e,()=>generateExp(qId)))return;
    else aiErrToast(e.message,'Gagal generate',e);
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
    const attSum=answered.reduce((a,q)=>a+(q.srs.totalAttempts||0),0);
    const corSum=answered.reduce((a,q)=>a+(q.srs.totalCorrect||0),0);
    const accuracy=attSum>0?corSum/attSum:null;
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
        <span style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(d.name)}</span>
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
  const reviewedLast7=qs.filter(q=>q.srs&&(q.srs.lastReviewedAt||0)>Date.now()-7*86400000).length;
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
        <div style="font-size:18px;font-weight:800;color:${color};margin-bottom:4px">${escHtml(r.label)}</div>
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
  if(cs)cs.innerHTML=getCatKeys().map(k=>`<option value="${escHtml(k)}">${escHtml((cats[k]&&cats[k].name)||k)}</option>`).join('');
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
    const raw=await callAI(prompt,true);
    const data=_extractJSON(raw);
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
    if(aiOfferFallback(e,()=>runNoteToQ()))return;
    aiErrToast(e.message,'Gagal membuat soal',e);
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-sparkles"></i> Generate';}
  }
}

/* Feature 4.3 — Batch scan multi-soal */

function _extractJSON(raw){
  let t=String(raw||'').replace(/```json?|```/gi,'').trim();
  try{return JSON.parse(t);}catch(e){}
  for(const [a,b] of [['{','}'],['[',']']]){
    const i=t.indexOf(a),j=t.lastIndexOf(b);
    if(i>-1&&j>i){const seg=t.slice(i,j+1);
      try{return JSON.parse(seg);}catch(e){}
      try{return JSON.parse(seg.replace(/\u201C|\u201D/g,'"').replace(/\u2018|\u2019/g,"'").replace(/,\s*([}\]])/g,'$1'));}catch(e){}
    }
  }
  throw new Error('FORMAT_ERROR');
}
async function callGeminiVisionBatch(base64,mime){
  const key=localStorage.getItem('exambre_gemini_key');
  if(!key)throw new Error('NO_KEY');
  return await gemFetch(key,()=>({
      contents:[{parts:[
        {inlineData:{mimeType:mime,data:base64}},
        {text:`Kamu adalah sistem ekstraksi soal ujian dan tes seleksi apa pun.\nEkstrak SEMUA soal pilihan ganda yang terlihat pada gambar halaman ini.\n\nATURAN WAJIB:\n- Jawab HANYA dengan JSON valid. Tidak ada teks lain, tidak ada markdown, tidak ada backtick.\n- Salin teks PERSIS seperti di gambar, jangan ubah atau ringkas. Abaikan nomor soal.\n- Jika suatu field tidak ada di gambar, isi string kosong "".\n- "jawaban" HANYA SATU HURUF KAPITAL (A-E) dari kunci benar (warna hijau/centang/kata Kunci); kosongkan jika tidak ada.\n- "pembahasan" memakai HTML dasar (<p>, <b>, <ol>, <li>) jika terlihat; kosongkan jika tidak ada.\n\nFORMAT JSON:\n{"questions":[{"soal":"...","A":"...","B":"...","C":"...","D":"...","E":"...","jawaban":"X","pembahasan":""}]}`}
      ]}],
      generationConfig:{temperature:0.1,maxOutputTokens:4096,response_mime_type:'application/json'}
    }),true);
}
async function scanBatchToQuestions(inputEl){
  const file=inputEl&&inputEl.files&&inputEl.files[0];if(!file)return;
  if(!localStorage.getItem('exambre_gemini_key')){showToast('Scan foto memakai Gemini — masukkan API key dulu di Lainnya','warn',5000);inputEl.value='';return;}
  const btn=document.getElementById('batch-img-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Memindai halaman...';}
  try{
    /* WAJIB kompres sebelum kirim. File HP bisa 12MP → ~15.000 token gambar (w*h/768),
       padahal compressImg() capped ~2.500 token. Kirim mentah = menghabiskan kuota token per
       menit tiap kali, sehingga scan hampir selalu kena 429. 1400px masih cukup terbaca
       untuk teks kecil soal, 0.85 supaya huruf kecil tidak pecah. */
    const dataUrl=await compressImg(file,1400,0.85);
    if(!dataUrl)throw new Error('Gagal membaca gambar');
    const base64=dataUrl.split(',')[1];
    const raw=await callGeminiVisionBatch(base64,file.type||'image/jpeg');
    let data=_extractJSON(raw);
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
    if(catSel)catSel.innerHTML=getCatKeys().map(k=>`<option value="${escHtml(k)}">${escHtml((cats[k]&&cats[k].name)||k)}</option>`).join('');
    document.getElementById('batch-modal').classList.add('on');
  }catch(e){
    if(aiOfferFallback(e,()=>scanBatchToQuestions(inputEl),true))return;
    aiErrToast(e.message,'Gagal memindai',e);
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-file-text"></i> Scan Halaman — Banyak Soal Sekaligus';}
    if(inputEl)inputEl.value='';
  }
}
function renderBatchPreview(){
  const wrap=document.getElementById('batch-list');if(!wrap)return;
  const asg=window._batchAssign||{};
  wrap.innerHTML=(window._batchItems||[]).map((it,i)=>{
    const a=asg[i];
    const tag=a?`<span style="flex-shrink:0;font-size:10px;font-weight:700;${catBadgeStyle(a.cat)}padding:3px 9px;border-radius:99px">${escHtml(((cats[a.cat]&&cats[a.cat].name)||a.cat)+(a.bab?' · '+a.bab:''))}</span>`:'';
    return`
    <label class="batch-row${it.ok?'':' inv'}">
      <input type="checkbox" ${it._sel?'checked':''} ${it.ok?'':'disabled'} onchange="_bt(${i},this.checked)">
      <span style="flex:1">${escHtml((i+1)+'. '+it.soal.slice(0,120))}${it.ok?'':' <b style="color:var(--danger-ink)">tidak valid</b>'}</span>
      ${tag}
      <b style="flex-shrink:0">${escHtml(it.jawaban||'—')}</b>
    </label>`;}).join('');
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
  const fallback=(document.getElementById('batch-cat')||{}).value||'';
  const asg=window._batchAssign||{};
  const all=window._batchItems||[];
  const chosen=all.map((it,idx)=>({it,idx})).filter(o=>o.it._sel&&o.it.ok);
  if(!chosen.length){showToast('Tidak ada soal terpilih','warn');return;}
  if(!fallback&&!chosen.some(o=>asg[o.idx])){showToast('Pilih kategori manual atau jalankan ✨ Sarankan dulu','warn');return;}
  chosen.forEach(({it,idx})=>{
    const a=asg[idx];
    qs.push({id:nid++,cat:(a&&a.cat)||fallback,bab:(a&&a.bab)||'',q:sanitizeHtml(it.soal),opts:it.opts,optImgs:{},wrong:'',correct:it.jawaban,
      expHtml:it.pembahasan?sanitizeHtml(it.pembahasan):'',
      qimgs:[],eimgs:[],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
  });
  window._batchAssign=null;
  persist();closeBatchModal();
  checkBadges();updateDueBadge();renderGami();
  showToast('✅ '+items.length+' soal berhasil diimpor!','ok');
}

/* Feature 4.4 — Tanya Tutor per Soal */
function openTutor(qid){
  const q=qs.find(x=>x.id===qid);if(!q)return;
  if(!(getCustomAI()||localStorage.getItem('exambre_gemini_key'))){showToast('Atur AI dulu di menu Lainnya (Gemini key atau provider kustom)','warn',5000);return;}
  window._tutor={qid,hist:[],view:[]};
  const sub=document.getElementById('tutor-sub');
  if(sub)sub.textContent='Tanya bebas tentang soal ini — sentuh salah satu contoh di bawah, atau ketik pertanyaanmu sendiri.';
  const m=document.getElementById('tutor-msgs');
  if(m){m.innerHTML='';_tutorAdd('ai','Halo! Saya siap membantu soal ini. Sentuh salah satunya:<br><span class="tchip" onclick="_tutorAsk(this)">Kenapa jawaban kuncinya benar?</span><span class="tchip" onclick="_tutorAsk(this)">Jelaskan langkah demi langkah</span><span class="tchip" onclick="_tutorAsk(this)">Kasih trik cepat mengerjakannya</span>');}
  const inp=document.getElementById('tutor-inp');if(inp)inp.value='';
  document.getElementById('tutor-modal').classList.add('on');
  setTimeout(()=>{if(inp)inp.focus();},180);
}
function closeTutor(){document.getElementById('tutor-modal').classList.remove('on');}
function _tutorAsk(el){
  if(!window._tutor)return;
  const btn=document.getElementById('tutor-send');if(btn&&btn.disabled)return;
  const inp=document.getElementById('tutor-inp');if(inp)inp.value=el.textContent;
  sendTutor();
}
function saveTutorToNotes(){
  if(!window._tutor)return;
  const v=(window._tutor.view||[]);
  if(!v.some(x=>x.r==='ai')){showToast('Belum ada jawaban tutor untuk disimpan','warn');return;}
  const q=qs.find(x=>x.id===window._tutor.qid);
  const qPlain=q?(q.q||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim():'';
  let html='<p><b>Soal:</b> '+escHtml(qPlain||'(soal tidak tersedia)')+'</p>';
  v.forEach(x=>{html+=x.r==='user'?'<p><b>Tanya:</b> '+escHtml(x.t)+'</p>':'<div><b>Tutor:</b>'+x.h+'</div>';});
  notes.push({id:noteNid++,title:'Tutor — '+(qPlain.slice(0,60)||'percakapan'),body:html,bodyText:html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),catId:'',createdAt:Date.now(),updatedAt:Date.now()});
  persistNotes();renderNotes();
  showToast('Disimpan ke Catatan. <a onclick="closeTutor();goSec(\'catatan\')">Buka</a>','ok',5000);
}
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
  _tutorAdd('user',escHtml(text));window._tutor.view.push({r:'user',t:text});
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
    const clean=sanitizeHtml(String(out).replace(/```html?|```/gi,''));
    load.innerHTML=clean;
    window._tutor.hist.push({r:'ai',t:String(out).slice(0,2000)});
    window._tutor.view.push({r:'ai',h:clean});
  }catch(e){
    const msg=e.message||'';
    if(aiCanFallback(e)&&aiAltReady(aiAltProvider(e.provider))){
      load.innerHTML='<span style="color:var(--danger-ink)">'+escHtml(aiProviderLabel(e.provider)+' bermasalah — '+escHtml(aiErrLabel(msg,e)))+'</span>';
      if(!aiOfferFallback(e,()=>sendTutor()))return;
      return;
    }
    load.innerHTML='<span style="color:var(--danger-ink)">'+escHtml(aiErrLabel(msg,e))+'</span>';
  }finally{if(btn)btn.disabled=false;}
}

/* Feature 4.5 — Variasi Soal */
async function buatVariasi(qid,btn){
  const q=qs.find(x=>x.id===qid);if(!q)return;
  if(!(getCustomAI()||localStorage.getItem('exambre_gemini_key'))){showToast('Atur AI dulu di menu Lainnya (Gemini key atau provider kustom)','warn',5000);return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i>';}
  const prompt=[
    'Kamu adalah pembuat soal latihan ahli. Buat SATU soal pilihan ganda BARU yang menguji konsep dan keterampilan yang SAMA dengan soal contoh berikut, tetapi dengan skenario/angka/konteks yang berbeda sehingga menjawabnya menuntut pemahaman — bukan ingatan pada soal asli.',
    '',
    'SOAL ASLI: '+(q.q||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),
    'OPSI ASLI: '+((q.opts||[]).map((o,i)=>o?LETTERS[i]+'. '+String(o).replace(/<[^>]+>/g,' ').trim():null).filter(Boolean).join(' | ')||'(tanpa opsi)'),
    'KUNCI ASLI: '+q.correct,
    'PEMBAHASAN ASLI: '+(q.expHtml?String(q.expHtml).replace(/<[^>]+>/g,' ').slice(0,500):'(tidak ada)'),
    '',
    'ATURAN WAJIB:',
    '- Jawab HANYA JSON valid. Tidak ada markdown, tidak ada backtick.',
    '- Format: {"questions":[{"soal":"...","A":"...","B":"...","C":"...","D":"...","E":"...","jawaban":"SATU HURUF KAPITAL","pembahasan":"<p>...</p>"}]}',
    '- Opsi boleh hanya 4; isi E dengan "".',
    '- Tingkat kesulitan setara soal asli. Bahasa Indonesia.'
  ].join('\n');
  try{
    const raw=await callAI(prompt,true);
    const data=_extractJSON(raw);
    const arr=Array.isArray(data)?data:(data.questions||[]);
    let it=null;
    for(const c of arr){
      const qtxt=((c&&c.soal)||'').trim();
      const opts=LETTERS.map(l=>(c[l]||'').trim());
      const m=/\b([A-E])\b/.exec((c.jawaban||'').toUpperCase().trim());const cor=m?m[1]:'';
      if(qtxt&&opts.filter(Boolean).length>=2&&cor){it={soal:qtxt,opts,jawaban:cor,pembahasan:String(c.pembahasan||'')};break;}
    }
    if(!it)throw new Error('EMPTY_RESPONSE');
    window._vari={it,srcId:qid};
    const body=document.getElementById('variasi-body');
    if(body)body.innerHTML='<p style="font-weight:700;margin-bottom:8px">'+escHtml(it.soal)+'</p>'
      +'<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">'
      +it.opts.map((o,i)=>o?'<div style="background:var(--bg2);border-radius:10px;padding:7px 11px;font-size:12.5px'+(LETTERS[i]===it.jawaban?';outline:1.5px solid var(--success);color:var(--success-ink);font-weight:600':'')+'"><b>'+LETTERS[i]+'.</b> '+escHtml(o)+'</div>':'').join('')
      +'</div>'
      +(it.pembahasan?'<div class="exp-block" style="font-size:12.5px">'+sanitizeHtml(it.pembahasan)+'</div>':'');
    document.getElementById('variasi-modal').classList.add('on');
  }catch(e){
    if(aiOfferFallback(e,()=>buatVariasi(qid,btn)))return;
    aiErrToast(e.message,'Gagal membuat variasi',e);
  }finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-arrows-shuffle"></i>';}}

}
function simpanVariasi(){
  const v=window._vari;if(!v)return;
  const src=qs.find(x=>x.id===v.srcId);
  qs.push({id:nid++,cat:src?src.cat:'',bab:src?src.bab:'',q:sanitizeHtml(v.it.soal),opts:v.it.opts,optImgs:{},wrong:'',correct:v.it.jawaban,
    expHtml:v.it.pembahasan?sanitizeHtml(v.it.pembahasan):'',
    qimgs:[],eimgs:[],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
  window._vari=null;
  persist();
  document.getElementById('variasi-modal').classList.remove('on');
  checkBadges();updateDueBadge();renderGami();
  showToast('🔀 Variasi soal masuk daftar!','ok');
}

/* Feature 4.6 — Saran kategori otomatis */
const _PALETTE=['#EAF1FE','#E4F6EE','#FEF2E2','#F3EEFE','#FDEDE8','#E9F7F0','#FBEAE9'];
function _ensureCat(name,bab){
  const key=(name||'LAINNYA').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,12)||'KAT';
  if(!cats[key]){
    cats[key]={name:(name||key).slice(0,24),color:_PALETTE[Object.keys(cats).length%_PALETTE.length],textColor:'#3552CC',babs:[]};
  }
  if(bab&&!cats[key].babs.includes(bab))cats[key].babs.push(bab);
  return key;
}
async function saranKategoriBatch(btn){
  const all=window._batchItems||[];
  if(!all.some(x=>x.ok)){showToast('Tidak ada soal untuk dianalisis','warn');return;}
  if(!(getCustomAI()||localStorage.getItem('exambre_gemini_key'))){showToast('Atur AI dulu di menu Lainnya','warn',5000);return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Menganalisis...';}
  const daftar=all.map((it,i)=>it.ok?((i+1)+'. '+it.soal.replace(/\s+/g,' ').slice(0,140)):'').filter(Boolean).join('\n');
  const prompt=[
    'Kamu adalah asisten kurikulum. Kelompokkan soal-soal bernomor berikut ke kategori pelajaran & sub-bab paling tepat.',
    'Nama kategori ringkas dan umum (contoh: MATEMATIKA, FISIKA, BAHASA INDONESIA, SEJARAH). Sub-bab lebih spesifik (contoh: Trigonometri).',
    '',
    daftar,
    '',
    'ATURAN WAJIB:',
    '- Jawab HANYA JSON valid tanpa markdown tanpa backtick.',
    '- Format: {"groups":[{"kategori":"NAMA","subbab":"Nama","indeks":[nomor soal mulai dari 1]}]}',
    '- Setiap nomor yang tercantum harus masuk tepat satu group.'
  ].join('\n');
  try{
    const data=_extractJSON(await callAI(prompt,true));
    const groups=Array.isArray(data)?data:(data.groups||[]);
    const assign={};let made=0;
    const existing=new Set(getCatKeys());
    groups.forEach(g=>{
      const bab=String((g&&g.subbab)||'').trim();
      const key=_ensureCat(String((g&&g.kategori)||'').trim(),bab);
      if(!existing.has(key))made++;
      (g&&g.indeks||[]).forEach(n=>{const i=parseInt(n,10)-1;if(all[i]&&all[i].ok)assign[i]={cat:key,bab};});
    });
    window._batchAssign=assign;
    persist();buildCatTabs();populateCatSelects();
    renderBatchPreview();
    showToast('✨ '+Object.keys(assign).length+' soal dikelompokkan'+(made?', '+made+' kategori baru dibuat':'')+' — cek label di tiap baris','ok',4500);
  }catch(e){
    if(aiOfferFallback(e,()=>saranKategoriBatch(btn)))return;
    aiErrToast(e.message,'Gagal menganalisis',e);
  }finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-sparkles"></i> Sarankan';}}
}
async function saranKategoriTunggal(){
  const pa=document.getElementById('paste-ta');
  const txt=((pa&&(pa.innerText||pa.textContent))||'').trim().slice(0,600);
  if(!txt){showToast('Tempel soalnya dulu','warn');return;}
  if(!(getCustomAI()||localStorage.getItem('exambre_gemini_key'))){showToast('Atur AI dulu di menu Lainnya','warn',5000);return;}
  try{
    const prompt=[
      'Tentukan kategori pelajaran & sub-bab untuk soal berikut.',
      'Nama kategori ringkas umum (contoh: MATEMATIKA). Sub-bab spesifik.',
      '',
      txt,
      '',
      'Jawab HANYA JSON valid: {"kategori":"NAMA","subbab":"Nama"} — tanpa markdown/backtick.'
    ].join('\n');
    const d=_extractJSON(await callAI(prompt,true));
    const key=_ensureCat(String(d.kategori||'').trim(),String(d.subbab||'').trim());
    persist();populateCatSelects();buildCatTabs();
    const sel=document.getElementById('p-cat');
    if(sel){sel.value=key;updateBabSelect('p-bab','p-cat');}
    const bs=document.getElementById('p-bab');
    if(bs&&d.subbab&&[...bs.options].some(o=>o.value===d.subbab))bs.value=d.subbab;
    showToast('✨ Saran: '+escHtml((cats[key]&&cats[key].name)||key)+(d.subbab?' · '+escHtml(d.subbab):''),'ok');
  }catch(e){
    if(!aiOfferFallback(e,()=>saranKategoriTunggal()))aiErrToast(e.message,'Gagal menyarankan',e);
  }
}

/* Feature 4.7 — Analisis Pola Kesalahan */
function renderPolaPanel(){
  return `<div class="panel" style="margin-bottom:16px">
    <h3 style="font-size:14px;font-weight:700;margin-bottom:4px"><i class="ti ti-bulb" style="color:var(--gold-dark)"></i> Analisis Pola Kesalahan</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5">AI menelaah riwayat jawaban Anda — menemukan pola kekeliruan lalu menyusun micro-lesson yang ditargetkan.</p>
    <button class="btn btn-p" onclick="analisisPola(this)"><i class="ti ti-wand"></i> Analisis Sekarang</button>
    <div id="pola-result" style="margin-top:12px"></div>
  </div>`;
}
async function analisisPola(btn){
  if(!qs.length){showToast('Belum ada soal','warn');return;}
  if(!(getCustomAI()||localStorage.getItem('exambre_gemini_key'))){showToast('Atur AI dulu di menu Lainnya','warn',5000);return;}
  const catStats=getCatKeys().map(k=>{
    const cqs=qs.filter(q=>q.cat===k);
    const att=cqs.reduce((a,q)=>a+ensureSrs(q).totalAttempts,0);
    if(!att)return null;
    const cor=cqs.reduce((a,q)=>a+ensureSrs(q).totalCorrect,0);
    const lapses=cqs.reduce((a,q)=>a+(ensureSrs(q).lapses||0),0);
    return{kategori:(cats[k]&&cats[k].name)||k,jumlah_soal:cqs.length,percobaan:att,benar:cor,akurasi_persen:Math.round(cor/att*100),total_kejadian_salah:lapses};
  }).filter(Boolean);
  const lemah=qs.filter(q=>{const s=ensureSrs(q);return s.totalAttempts>0&&!q.mastered;})
    .sort((a,b)=>(ensureSrs(b).lapses-ensureSrs(a).lapses)||((ensureSrs(a).totalCorrect/Math.max(1,ensureSrs(a).totalAttempts))-(ensureSrs(b).totalCorrect/Math.max(1,ensureSrs(b).totalAttempts))))
    .slice(0,12)
    .map(q=>({soal:(q.q||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,120),kategori:(cats[q.cat]&&cats[q.cat].name)||q.cat,kunci_benar:q.correct,jawaban_user_tersimpan:q.wrong||'-',kali_lupus:ensureSrs(q).lapses||0}));
  if(!catStats.length&&!lemah.length){
    showToast('Belum ada data percobaan — kerjakan beberapa soal dulu','warn');return;
  }
  const wrap=document.getElementById('pola-result');
  if(wrap)wrap.innerHTML='<div class="tbub ai"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> menelaah riwayat jawaban…</div>';
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Menganalisis...';}
  const prompt=[
    'Kamu adalah coach belajar yang tajam dan membangun semangat.',
    'Berikut data belajar pengguna dalam JSON:',
    JSON.stringify({statistik_kategori:catStats,soal_yang_seringsalah:lemah}),
    '',
    'TUGAS:',
    '1. Temukan POLA kekeliruan yang spesifik (bukan generik) dari data tersebut.',
    '2. Beri fokus perbaikan per kategori terlemah.',
    '3. Susun SATU micro-lesson singkat untuk pola paling dominan.',
    '',
    'ATURAN WAJIB:',
    '- Jawab HANYA JSON valid tanpa markdown/backtick.',
    '- Format: {"ringkasan":"<p>2-3 kalimat pola umum</p>","fokus":[{"kategori":"","masalah":"","saran":""}],"micro_lesson":"<p>HTML pelajaran mini 4-8 kalimat, boleh <b>, <ul>, <li>, sertakan contoh singkat</p>"}',
    '- Bahasa Indonesia yang memotivasi.'
  ].join('\n');
  try{
    const d=_extractJSON(await callAI(prompt,true));
    if(wrap){
      const f=(d.fokus||[]).map(x=>'<div style="padding:9px 0;border-bottom:1px solid var(--border)">'
        +'<div style="font-weight:800;font-size:12.5px">'+escHtml(x.kategori||'')+'</div>'
        +'<div style="font-size:12px;color:var(--text2);margin-top:2px">'+escHtml(x.masalah||'')+'</div>'
        +(x.saran?'<div style="font-size:12px;margin-top:3px"><b>Saran:</b> '+escHtml(x.saran)+'</div>':'')
        +'</div>').join('');
      wrap.innerHTML='<div style="background:var(--bg2);border-radius:var(--radius);padding:11px 13px;font-size:13px;line-height:1.6">'+sanitizeHtml(String(d.ringkasan||''))+'</div>'
        +(f?'<div style="margin-top:8px">'+f+'</div>':'')
        +(d.micro_lesson?'<div class="exp-block" style="margin-top:10px"><div class="exp-label">Micro Lesson</div><div class="exp-content">'+sanitizeHtml(String(d.micro_lesson))+'</div></div>':'');
    }
  }catch(e){
    if(wrap)wrap.innerHTML='<div class="tbub ai" style="color:var(--danger-ink)">'+escHtml(aiErrLabel(e.message,e))+'</div>';
    if(aiCanFallback(e)&&aiAltReady(aiAltProvider(e.provider)))aiOfferFallback(e,()=>analisisPola(btn));
  }finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-wand"></i> Analisis Sekarang';}}
}


