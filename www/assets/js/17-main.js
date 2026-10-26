document.addEventListener('DOMContentLoaded',()=>{loadSimHistory();loadData();initExambreSplash();initHardwareBack();initDialogA11y();setTimeout(maybeBackupReminder,2500);});

/* ── PENANGKAP ERROR GLOBAL ──
   Error tak terduga tidak boleh membuat app diam saja tanpa penjelasan.
   Cukup satu toast per 10 dtk agar tidak membanjiri layar; detail ke console. */
let _unexpectedAt=0;
function reportUnexpected(kind,detail){
  try{console.error('[Exambre] '+kind,detail);}catch(e){}
  if(Date.now()-_unexpectedAt<10000)return;
  if(typeof showToast!=='function'||!document.getElementById('toast-wrap'))return;
  _unexpectedAt=Date.now();
  showToast('⚠️ Ada gangguan teknis. Coba ulangi; data yang sudah tersimpan tetap aman.','warn',5000);
}
window.addEventListener('error',e=>{if(e&&e.message)reportUnexpected('error',e.error||e.message);});
window.addEventListener('unhandledrejection',e=>reportUnexpected('rejection',e.reason));

/* ── TOMBOL BACK ANDROID ──
   Tanpa listener, tombol back langsung menutup app walau modal/form masih terbuka.
   Urutan: splash → konfirmasi → editor catatan → lightbox → modal teratas →
   tab lain → form edit inline → panel tambah → konfirmasi keluar. */
function backCloseOverlay(id){const el=document.getElementById(id);if(el)closeDialogEl(el);}
function handleHardwareBack(){
  const splash=document.getElementById('exambre-splash');
  if(splash&&!splash.classList.contains('hide')){dismissSplash();return;}
  if(document.getElementById('confirm-modal').classList.contains('on')){closeConfirm();return;}
  const ne=document.getElementById('note-editor-overlay');
  if(ne&&ne.classList.contains('on')){closeNoteEditor();return;}
  const lb=document.getElementById('lightbox');
  if(lb&&lb.classList.contains('on')){closeLB();return;}
  const modals=[...document.querySelectorAll('.modal-overlay.on')];
  if(modals.length){backCloseOverlay(modals[modals.length-1].id);return;}
  const active=document.querySelector('.sec.on');
  if(active&&active.id!=='sec-list'){goSec('list',document.querySelector('.bnav-item'));return;}
  const ie=document.querySelector('.inline-edit.on');
  if(ie){toggleInlineEdit(Number(ie.dataset.qid));return;}
  const panel=document.getElementById('add-panel');
  if(panel&&panel.style.display!=='none'){togglePanel();return;}
  showConfirm({icon:'👋',title:'Keluar dari Exambre?',body:'Semua data tetap tersimpan di perangkat ini.',actionLabel:'Keluar',actionClass:'btn-p',onConfirm:()=>{
    const App=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
    if(App&&App.exitApp)App.exitApp();
  }});
}
function initHardwareBack(){
  const App=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
  if(!App||!App.addListener)return;
  App.addListener('backButton',handleHardwareBack);
}
