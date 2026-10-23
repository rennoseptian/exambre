/* ── IMAGE COMPRESSION ── */
async function compressImg(file,maxPx=900,quality=0.78){
  return new Promise(res=>{
    if(file.size>4*1024*1024){showToast('⚠️ Gambar terlalu besar (maks 4MB). Gunakan URL saja.','warn');res(null);return;}
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      const scale=Math.min(1,maxPx/Math.max(img.width,img.height));
      const w=Math.round(img.width*scale),h=Math.round(img.height*scale);
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);res(null);};
    img.src=url;
  });
}
function imgToBase64(file){return compressImg(file);}

/* ── DEFAULT DATA ── */
function defaultQ(){
  return[];
}

/* ── CONTOH SOAL (untuk pengguna baru — bisa diedit/dihapus) ── */
const SAMPLE_PACK={
cats:{
  MAT:{name:'Matematika',color:'#EAF1FE',textColor:'#3552CC',babs:['Aritmetika','Aljabar']},
  BIND:{name:'Bahasa Indonesia',color:'#FDECEC',textColor:'#B23A3A',babs:['Kosakata','Ejaan']},
  IPA:{name:'IPA',color:'#E7F6EC',textColor:'#1F7A44',babs:['Biologi','Fisika']},
  IPS:{name:'IPS',color:'#FFF3E0',textColor:'#9A5B00',babs:['Sejarah','Geografi']},
  BING:{name:'Bahasa Inggris',color:'#F1EAFE',textColor:'#5B3BB5',babs:['Grammar','Vocabulary']}
},
qs:[
  {cat:'MAT',bab:'Aritmetika',q:'Hasil dari 12 × 8 adalah ...',opts:['86','96','104','112','98'],correct:'B',exp:'<p>12 × 8 = <b>96</b>. Kalikan 10 × 8 = 80, lalu 2 × 8 = 16, sehingga 80 + 16 = 96.</p>'},
  {cat:'MAT',bab:'Aljabar',q:'Lanjutan deret 3, 6, 12, 24, ... adalah ...',opts:['30','36','42','48','54'],correct:'D',exp:'<p>Setiap suku dikalikan 2: 24 × 2 = <b>48</b>.</p>'},
  {cat:'MAT',bab:'Aritmetika',q:'Hasil dari 1/4 + 2/5 adalah ...',opts:['3/9','3/20','7/20','13/20','8/9'],correct:'D',exp:'<p>Samakan penyebut menjadi 20: 5/20 + 8/20 = <b>13/20</b>.</p>'},
  {cat:'BIND',bab:'Kosakata',q:'Sinonim dari kata "cerdas" adalah ...',opts:['cerdik','malas','ramah','ragu','lambat'],correct:'A',exp:'<p>"Cerdas" bersinonim dengan <b>cerdik</b>, yaitu tajam pikiran.</p>'},
  {cat:'BIND',bab:'Ejaan',q:'Penulisan kata baku yang benar adalah ...',opts:['apotik','apotek','aptik','apoték','aptopik'],correct:'B',exp:'<p>Bentuk baku menurut KBBI adalah <b>apotek</b>.</p>'},
  {cat:'BIND',bab:'Ejaan',q:'Perbaikan yang tepat untuk kalimat "Para siswa-siswa sedang belajar" adalah ...',opts:['Para siswa sedang belajar','Para siswa-siswa sedang belajar','Para para siswa sedang belajar','Siswa-siswa para sedang belajar','Para siswasiswa sedang belajar'],correct:'A',exp:'<p>Kata "para" sudah bermakna jamak, jadi tidak perlu diulang: <b>Para siswa sedang belajar</b>.</p>'},
  {cat:'IPA',bab:'Biologi',q:'Proses tumbuhan membuat makanan dengan bantuan cahaya matahari disebut ...',opts:['respirasi','fotosintesis','transpirasi','fermentasi','oksidasi'],correct:'B',exp:'<p><b>Fotosintesis</b> mengubah air dan karbon dioksida menjadi glukosa dengan bantuan cahaya.</p>'},
  {cat:'IPA',bab:'Fisika',q:'Planet yang paling dekat dengan Matahari adalah ...',opts:['Merkurius','Venus','Bumi','Mars','Jupiter'],correct:'A',exp:'<p>Urutan planet terdekat dari Matahari: <b>Merkurius</b>, Venus, Bumi, Mars, Jupiter, Saturnus, Uranus, Neptunus.</p>'},
  {cat:'IPA',bab:'Fisika',q:'Satuan gaya dalam Sistem Internasional (SI) adalah ...',opts:['joule','watt','pascal','newton','ampere'],correct:'D',exp:'<p>Gaya diukur dalam <b>newton</b> (N). Joule = energi, watt = daya, pascal = tekanan, ampere = arus listrik.</p>'},
  {cat:'IPS',bab:'Sejarah',q:'Proklamasi Kemerdekaan Indonesia dibacakan pada tanggal ...',opts:['17 Agustus 1945','28 Oktober 1928','1 Juni 1945','10 November 1945','18 Agustus 1945'],correct:'A',exp:'<p>Proklamasi dibacakan pada <b>17 Agustus 1945</b> oleh Soekarno didampingi Mohammad Hatta.</p>'},
  {cat:'IPS',bab:'Geografi',q:'Ibu kota Provinsi Jawa Barat adalah ...',opts:['Semarang','Bandung','Surabaya','Serang','Yogyakarta'],correct:'B',exp:'<p>Ibu kota Jawa Barat adalah <b>Bandung</b>. Semarang = Jawa Tengah, Surabaya = Jawa Timur, Serang = Banten.</p>'},
  {cat:'IPS',bab:'Geografi',q:'Gunung tertinggi di dunia adalah ...',opts:['Gunung Kilimanjaro','Gunung Fuji','Gunung Everest','Gunung Mont Blanc','Gunung Denali'],correct:'C',exp:'<p><b>Gunung Everest</b> di pegunungan Himalaya memiliki puncak tertinggi di dunia.</p>'},
  {cat:'BING',bab:'Grammar',q:'She ___ to school every day.',opts:['go','goes','going','gone','went'],correct:'B',exp:'<p>Subjek "she" (orang ketiga tunggal) memakai bentuk <b>goes</b> pada simple present tense.</p>'},
  {cat:'BING',bab:'Vocabulary',q:'The opposite of "expensive" is ...',opts:['cheap','rich','costly','valuable','pricey'],correct:'A',exp:'<p>Lawan kata <i>expensive</i> (mahal) adalah <b>cheap</b> (murah).</p>'},
  {cat:'BING',bab:'Grammar',q:'The plural form of "child" is ...',opts:['childs','childes','children','childrens','child'],correct:'C',exp:'<p>Bentuk jamak tidak beraturan dari <i>child</i> adalah <b>children</b>.</p>'}
]};

function loadSampleQs(){
  if(qs.length){showToast('Contoh soal hanya bisa dimuat saat daftar soal masih kosong.','warn');return;}
  Object.keys(SAMPLE_PACK.cats).forEach(k=>{
    const c=SAMPLE_PACK.cats[k];
    if(!cats[k])cats[k]={name:c.name,color:c.color,textColor:c.textColor,babs:[]};
    if(!Array.isArray(cats[k].babs))cats[k].babs=[];
    c.babs.forEach(b=>{if(!cats[k].babs.includes(b))cats[k].babs.push(b);});
  });
  SAMPLE_PACK.qs.forEach(s=>{
    qs.push({id:nid++,cat:s.cat,bab:s.bab,q:s.q,opts:s.opts.slice(),optImgs:{},wrong:'',correct:s.correct,
      expHtml:s.exp,qimgs:[],eimgs:[],mastered:false,srs:{due:Date.now()-1,interval:0,ease:2.5,reps:0,lapses:0}});
  });
  persist();buildCatTabs();populateCatSelects();updateBabFilter();render();renderGami();
  showToast('✨ '+SAMPLE_PACK.qs.length+' soal contoh dimuat — silakan edit atau hapus sesuai kebutuhan.','ok',5000);
}

/* ── ONBOARDING (3 langkah, muncul sekali saat instalasi baru & data kosong) ── */
const OB_STEPS=[
  {ic:'ti-category',t:'Buat kategori',d:'Kelompokkan soalmu — misalnya Matematika, Bahasa Indonesia, atau IPA. Kategori dipakai untuk memfilter daftar dan memilih soal simulasi.'},
  {ic:'ti-plus',t:'Tambah soal',d:'Isi manual, tempel dari tryout, scan foto, atau muat contoh soal. Semua cara berujung di daftar soal yang sama.'},
  {ic:'ti-repeat',t:'Latih & ulangi',d:'Review menjadwalkan pengulangan otomatis sesuai daya ingatmu. Simulasi ujian untuk latihan berwaktu — skornya terpisah.'}
];
let _obStep=0;
function maybeShowOnboard(){
  try{if(localStorage.getItem('exambre_onboarded')==='1')return;}catch(e){}
  if(getCatKeys().length||qs.length)return;
  _obStep=0;renderOnboardStep();
  const m=document.getElementById('onboard-modal');if(m)m.classList.add('on');
}
function renderOnboardStep(){
  const s=OB_STEPS[_obStep];if(!s)return;
  const ic=document.getElementById('ob-ic'),t=document.getElementById('ob-title'),d=document.getElementById('ob-desc'),dots=document.getElementById('ob-dots'),next=document.getElementById('ob-next');
  if(ic)ic.className='ti '+s.ic;
  if(t)t.textContent=s.t;
  if(d)d.textContent=s.d;
  if(dots)dots.innerHTML=OB_STEPS.map((_,i)=>`<span style="width:7px;height:7px;border-radius:50%;background:${i===_obStep?'var(--accent)':'var(--border2)'}"></span>`).join('');
  if(next)next.innerHTML=_obStep===OB_STEPS.length-1?'Mengerti <i class="ti ti-check"></i>':'Lanjut <i class="ti ti-arrow-right"></i>';
}
function obNext(){
  if(_obStep<OB_STEPS.length-1){_obStep++;renderOnboardStep();}
  else finishOnboard();
}
function onboardDone(){try{localStorage.setItem('exambre_onboarded','1');}catch(e){}}
function closeOnboardModal(){const m=document.getElementById('onboard-modal');if(m)m.classList.remove('on');}
function finishOnboard(){
  onboardDone();closeOnboardModal();
  const inp=document.getElementById('onboard-cat-inp');
  if(inp){inp.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>inp.focus(),250);}
}
function skipOnboard(){onboardDone();closeOnboardModal();}
function onboardSample(){onboardDone();closeOnboardModal();loadSampleQs();}

