const SK='cpns-wb-v6';
const NK='exambre-notes-v1';
const LETTERS=['A','B','C','D','E'];

/* ── SANITIZE ── */
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

let qs=[],nid=10,curCat='ALL',curSt='all',curBab='all',searchQ='';
let cats={};
let revList=[],revIdx=0,revDone=false,revSessionXP=0,sessionCorrect=0;
let revMode='srs',simState=null,simTimerHandle=null,simSelectedCats=null,simTimerType='total',simHistory=[];
const SIMHISTK='exambre_sim_history';
let imgAreas={};
let lastDeleted=null;
let notes=[],noteCats=[],noteNid=1,curNoteCat='ALL',noteSearchQ='',curNoteId=null;
let gami={streak:0,lastActive:null,xp:0,badges:[]};

