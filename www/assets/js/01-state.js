const SK='cpns-wb-v6';
const NK='exambre-notes-v1';
const LETTERS=['A','B','C','D','E'];

/* ── SANITIZE ── */
/* escHtml: untuk TEKS PLAIN milik pengguna yang disisipkan ke innerHTML
   (judul, preview, kata kunci search, nama kategori, dsb). Berbeda dengan
   sanitizeHtml() yang menyaring HTML kaya — di sini teks harus tampil apa
   adanya, hanya "&", "<", ">" yang jadi entity.
   '"' ikut di-escape supaya aman dipakai di nilai atribut bertanda kutip
   (tidak mengubah tampilan di konteks teks). */
function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
/* jsStr: escape untuk literal string JS di dalam atribut onclick, mis.
   onclick="fCat('${escHtml(jsStr(k))}',this)" — jsStr dulu (backslash + kutip
   tunggal), baru escHtml (kutip ganda attribute delimiter). Urutan dibalik
   justru merusak. */
function jsStr(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
/* safeColor: hanya izinkan #RGB / #RRGGBB (3-digit dinormalkan ke 6-digit supaya
   aman kalau caller menempelkan alpha seperti +"22"). Warna kategori bisa datang
   dari file import (JSON bebas) lalu masuk ke style="..." — string sembarang di
   sana bisa memecah atribut dan menyuntik event handler. */
function safeColor(v,fallback){
  const h=String(v==null?'':v).trim();
  if(/^#[0-9a-f]{6}$/i.test(h))return h;
  if(/^#[0-9a-f]{3}$/i.test(h))return '#'+h.slice(1).split('').map(c=>c+c).join('');
  return fallback||'#eeeeee';
}
const ALLOWED_TAGS=/^(b|i|u|strong|em|br|ul|ol|li|p|code|img|span|div)$/i;
const SAFE_URL=/^(https?:|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i;
const URL_ATTRS=new Set(['src','href','action','formaction','xlink:href']);
function sanitizeHtml(html){
  if(!html)return'';
  const tmp=document.createElement('div');
  tmp.innerHTML=html;
  tmp.querySelectorAll('*').forEach(el=>{
    if(!ALLOWED_TAGS.test(el.tagName)){
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    [...el.attributes].forEach(attr=>{
      const n=attr.name.toLowerCase();
      if(n.startsWith('on')){el.removeAttribute(attr.name);return;}
      if(URL_ATTRS.has(n)&&!SAFE_URL.test(attr.value.trim())){
        el.removeAttribute(attr.name);
      }
    });
  });
  return tmp.innerHTML;
}

const INIT_CATS={};
/* Migrasi otomatis: kalau kategori masih pakai warna versi sebelumnya (pastel lama ATAU solid cerah ala-gim, belum dikustomisasi user), turunkan jadi palet netral-profesional saat ini */
const OLD_CAT_COLORS_V1={TIU:'#E6F1FB',TWK:'#E1F5EE',TKP:'#FAEEDA',TBI:'#EEEDFE',TPA:'#FAECE7'};
const OLD_CAT_COLORS_V2={TIU:'#1CB0F6',TWK:'#00C2A8',TKP:'#FF9600',TBI:'#CE82FF',TPA:'#FF6F59'};
function normHex(h){return(h||'').replace('#','').trim().toUpperCase();}
function relLuminance(hex){
  let h=normHex(hex);if(h.length===3)h=h.split('').map(c=>c+c).join('');
  if(h.length!==6)return 1;
  const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  const lin=c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
}
function autoTextColor(bgHex){return relLuminance(bgHex)>0.55?'#33363f':'#ffffff';}
function migrateCatColors(){
  [OLD_CAT_COLORS_V1,OLD_CAT_COLORS_V2].forEach(OLD=>{
    Object.keys(OLD).forEach(k=>{
      if(cats[k]&&cats[k].color&&normHex(cats[k].color)===normHex(OLD[k])&&INIT_CATS[k]){
        cats[k].color=INIT_CATS[k].color;cats[k].textColor=INIT_CATS[k].textColor;
      }
    });
  });
  /* Safety-net: kategori bawaan yang masih nyangkut kombinasi lama (teks putih di atas warna solid, dari versi sebelumnya) langsung dikembalikan ke palet pastel saat ini, apa pun penyebabnya */
  Object.keys(INIT_CATS).forEach(k=>{
    if(cats[k]&&normHex(cats[k].textColor)==='FFFFFF'){
      cats[k].color=INIT_CATS[k].color;cats[k].textColor=INIT_CATS[k].textColor;
    }
  });
}

/* ── STORE TERPUSAT (fase 3) ──
   Semua state mutable tinggal di satu objek `Store`.
   Nama-nama global lama dipertahankan sebagai accessor di `window`,
   jadi seluruh kode lama (termasuk inline onclick) tetap berfungsi tanpa perubahan. */
const Store={
  qs:[],nid:10,curCat:'ALL',curSt:'all',curBab:'all',searchQ:'',
  cats:{},
  revList:[],revIdx:0,revDone:false,revSessionXP:0,sessionCorrect:0,sessionWrong:0,
  revMode:'srs',simState:null,simTimerHandle:null,simSelectedCats:null,simTimerType:'total',simHistory:[],
  imgAreas:{},
  lastDeleted:null,
  notes:[],noteCats:[],noteNid:1,curNoteCat:'ALL',noteSearchQ:'',curNoteId:null,
  gami:{streak:0,lastActive:null,xp:0,badges:[]},
  pendingDeletes:[]
};
function defineState(name){
  Object.defineProperty(window,name,{get(){return Store[name];},set(v){Store[name]=v;},configurable:true});
}
Object.keys(Store).forEach(defineState);
const SIMHISTK='exambre_sim_history';

