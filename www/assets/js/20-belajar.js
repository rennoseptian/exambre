/* ── Belajar: jalur playlist YouTube pilihan ──
   Daftar dikurasi di data/belajar.json (urutan di file = urutan belajar yang disarankan).
   Aplikasi hanya membuka playlist di YouTube (tanpa menyematkan pemutar, tanpa API key).
   belajarValidate() tidak menyentuh DOM, dipakai juga oleh tes dan skrip pemeriksa di Node. */
(function (root) {
  'use strict';
  var LEVELS = ['dasar', 'menengah', 'lanjut'];
  var LEVEL_LABEL = { dasar: 'Dasar', menengah: 'Menengah', lanjut: 'Lanjutan' };
  var RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var RE_PL = /^[A-Za-z0-9_-]{10,64}$/;
  var RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function isStr(v, min, max) { return typeof v === 'string' && v.trim().length >= min && v.length <= max; }

  /* -> { errors: [...], warnings: [...] }; errors = data tidak boleh dipakai */
  function belajarValidate(d) {
    var errors = [], warnings = [];
    if (!d || typeof d !== 'object') return { errors: ['Data bukan objek.'], warnings: warnings };
    if (!(Number.isInteger(d.version) && d.version >= 1)) errors.push('version harus bilangan bulat >= 1.');
    if (!(typeof d.updated === 'string' && RE_DATE.test(d.updated))) errors.push('updated harus berformat YYYY-MM-DD.');
    if (!Array.isArray(d.topics) || !d.topics.length) { errors.push('topics harus berisi minimal satu topik.'); return { errors: errors, warnings: warnings }; }
    var topicIds = {}, plIds = {};
    d.topics.forEach(function (t, i) {
      var tp = 'topik[' + i + ']';
      if (!t || typeof t !== 'object') { errors.push(tp + ' bukan objek.'); return; }
      if (!(typeof t.id === 'string' && RE_SLUG.test(t.id) && t.id.length <= 40)) errors.push(tp + ': id harus huruf kecil/angka dipisah "-".');
      else if (topicIds[t.id]) errors.push(tp + ': id "' + t.id + '" dobel.'); else topicIds[t.id] = 1;
      if (!isStr(t.judul, 1, 60)) errors.push(tp + ': judul wajib (maks 60 karakter).');
      if (t.ringkas != null && !isStr(t.ringkas, 0, 160)) errors.push(tp + ': ringkas maks 160 karakter.');
      if (!Array.isArray(t.playlists) || !t.playlists.length) { errors.push(tp + ': playlists harus berisi minimal satu playlist.'); return; }
      t.playlists.forEach(function (p, j) {
        var pp = tp + '.playlist[' + j + ']';
        if (!p || typeof p !== 'object') { errors.push(pp + ' bukan objek.'); return; }
        if (!(typeof p.id === 'string' && RE_PL.test(p.id))) errors.push(pp + ': id playlist tidak valid (ambil nilai setelah "list=" pada tautan, tanpa "&si=...").');
        else if (plIds[p.id]) errors.push(pp + ': id playlist dobel.'); else plIds[p.id] = 1;
        if (!isStr(p.judul, 1, 100)) errors.push(pp + ': judul wajib (maks 100 karakter).');
        if (!isStr(p.channel, 1, 60)) errors.push(pp + ': channel wajib (maks 60 karakter).');
        if (LEVELS.indexOf(p.level) < 0) errors.push(pp + ': level harus salah satu dari ' + LEVELS.join(', ') + '.');
        if (p.catatan != null && !isStr(p.catatan, 0, 240)) errors.push(pp + ': catatan maks 240 karakter.');
        if (p.jumlah_video != null && !(Number.isInteger(p.jumlah_video) && p.jumlah_video >= 1 && p.jumlah_video <= 2000)) errors.push(pp + ': jumlah_video harus bilangan bulat 1-2000 atau null.');
        if (p.perlu_verifikasi === true) warnings.push(pp + ' ("' + String(p.judul).slice(0, 40) + '"): judul/jumlah video belum diverifikasi.');
        else if (!p.catatan) warnings.push(pp + ' ("' + String(p.judul).slice(0, 40) + '"): belum ada catatan singkat.');
      });
    });
    return { errors: errors, warnings: warnings };
  }

  root.belajarValidate = belajarValidate;
  if (typeof module !== 'undefined' && module.exports) module.exports = { belajarValidate: belajarValidate, LEVELS: LEVELS };
  if (typeof document === 'undefined') return;

  /* ── UI ── */
  var PROG_KEY = 'exambre_belajar_prog', CACHE_KEY = 'exambre_belajar_cache', LAST_KEY = 'exambre_belajar_last';
  var REMOTE = 'https://rennoseptian.github.io/exambre/data/belajar.json';
  var data = null, bound = false;

  function loadProg() { try { var p = JSON.parse(localStorage.getItem(PROG_KEY) || '{}'); return p && typeof p === 'object' ? p : {}; } catch (e) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (e) { /* penyimpanan penuh: abaikan */ } }
  function usable(d) { return belajarValidate(d).errors.length === 0; }
  async function getJson(url) { var r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }

  async function loadData() {
    var best = null;
    try { var b = await getJson('./data/belajar.json'); if (usable(b)) best = b; } catch (e) { /* offline pertama kali / berkas hilang */ }
    try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && usable(c) && (!best || String(c.updated) > String(best.updated))) best = c; } catch (e) { /* cache rusak */ }
    return best;
  }
  /* di aplikasi Android isi berkas ikut terpasang di APK; ambil versi lebih baru dari situs (maks. sekali per 6 jam) */
  async function refreshRemote() {
    if (typeof isNativeApp !== 'function' || !isNativeApp() || !navigator.onLine) return null;
    if (Date.now() - Number(localStorage.getItem(LAST_KEY) || 0) < 6 * 3600 * 1000) return null;
    try {
      var r = await getJson(REMOTE); localStorage.setItem(LAST_KEY, String(Date.now()));
      if (usable(r) && (!data || String(r.updated) > String(data.updated))) { localStorage.setItem(CACHE_KEY, JSON.stringify(r)); return r; }
    } catch (e) { /* gagal: pakai yang ada */ }
    return null;
  }

  function findPl(id) {
    if (!data) return null;
    for (var i = 0; i < data.topics.length; i++) for (var j = 0; j < data.topics[i].playlists.length; j++) if (data.topics[i].playlists[j].id === id) return data.topics[i].playlists[j];
    return null;
  }
  function ago(ts) {
    var d = Math.floor((Date.now() - ts) / 86400000);
    return d <= 0 ? 'hari ini' : d === 1 ? 'kemarin' : d + ' hari lalu';
  }

  function itemHtml(p, n, prog) {
    var st = prog[p.id] || {}, done = !!st.done, e = escHtml;
    var meta = [e(p.channel), LEVEL_LABEL[p.level]].concat(p.jumlah_video ? [p.jumlah_video + ' video'] : []).join(' · ');
    var state = done ? 'Selesai ' + ago(st.done) : st.open ? 'Terakhir dibuka ' + ago(st.open) : '';
    return '<li class="bl-item' + (done ? ' done' : '') + '"><span class="bl-n" aria-hidden="true">' + (done ? '<i class="ti ti-check"></i>' : n) + '</span>' +
      '<div class="bl-body"><div class="bl-title">' + e(p.judul) + '</div><div class="bl-meta">' + meta + '</div>' +
      (p.catatan ? '<p class="bl-note">' + e(p.catatan) + '</p>' : '') +
      '<div class="bl-actions"><button type="button" class="btn btn-p btn-sm" data-act="open" data-id="' + e(p.id) + '" aria-label="Buka playlist ' + e(p.judul) + ' di YouTube"><i class="ti ti-player-play"></i> Buka di YouTube</button>' +
      '<label class="bl-check"><input type="checkbox" data-act="done" data-id="' + e(p.id) + '"' + (done ? ' checked' : '') + '> Selesai</label>' +
      '<span class="bl-links"><button type="button" class="link-btn" data-act="note" data-id="' + e(p.id) + '">Catat dari video</button>' +
      '<button type="button" class="link-btn" data-act="soal" data-id="' + e(p.id) + '">Buat soal</button></span></div>' +
      (state ? '<div class="bl-state">' + state + '</div>' : '') + '</div></li>';
  }

  function paint(el) {
    if (!data) {
      el.innerHTML = '<div class="bl-empty"><p>Daftar belajar belum bisa dimuat.</p><p class="bl-state">Coba lagi saat tersambung ke internet.</p><button type="button" class="btn btn-s btn-sm" data-act="retry">Coba lagi</button></div>';
      return;
    }
    var prog = loadProg(), total = 0, finished = 0;
    var topics = data.topics.map(function (t) {
      var done = t.playlists.filter(function (p) { return prog[p.id] && prog[p.id].done; }).length;
      total += t.playlists.length; finished += done;
      var pct = Math.round(done / t.playlists.length * 100);
      return '<section class="bl-topic" aria-label="' + escHtml(t.judul) + '"><div class="bl-topic-h"><h3>' + escHtml(t.judul) + '</h3><span class="bl-count">' + done + ' dari ' + t.playlists.length + ' selesai</span></div>' +
        (t.ringkas ? '<p class="bl-topic-d">' + escHtml(t.ringkas) + '</p>' : '') +
        '<div class="bl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
        '<ol class="bl-list">' + t.playlists.map(function (p, i) { return itemHtml(p, i + 1, prog); }).join('') + '</ol></section>';
    }).join('');
    el.innerHTML = '<p class="bl-lead">Tonton berurutan, catat yang penting, lalu uji dirimu lewat soal. Videonya dibuka di YouTube.</p>' +
      '<p class="bl-sum">' + finished + ' dari ' + total + ' playlist selesai</p>' + topics;
  }

  function bind(el) {
    if (bound) return; bound = true;
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b || b.type === 'checkbox') return;
      var act = b.dataset.act, id = b.dataset.id, pl = id ? findPl(id) : null;
      if (act === 'retry') { data = null; window.renderBelajar(); return; }
      if (!pl) return;
      if (act === 'open') {
        var p = loadProg(); p[id] = Object.assign({}, p[id], { open: Date.now() }); saveProg(p);
        openExternalUrl('https://www.youtube.com/playlist?list=' + encodeURIComponent(id)); paint(el);
      } else if (act === 'note') {
        goSec('catatan'); openNoteEditor(null);
        setTimeout(function () { var t = document.getElementById('note-editor-title'); if (t && !t.value) t.value = 'Catatan: ' + pl.judul; }, 80);
      } else if (act === 'soal') {
        goSec('list'); var panel = document.getElementById('add-panel');
        if (panel && panel.style.display === 'none') togglePanel();
        showToast('Tempel soal yang kamu buat dari "' + pl.judul + '".', '', 3500);
      }
    });
    el.addEventListener('change', function (ev) {
      var c = ev.target; if (!c.matches || !c.matches('input[data-act="done"]')) return;
      var p = loadProg(), id = c.dataset.id; p[id] = Object.assign({}, p[id], { done: c.checked ? Date.now() : 0 }); saveProg(p); paint(el);
    });
  }

  window.renderBelajar = async function renderBelajar() {
    var el = document.getElementById('belajar-content'); if (!el) return;
    bind(el);
    if (!data) data = await loadData();
    paint(el);
    var fresh = await refreshRemote(); if (fresh) { data = fresh; paint(el); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
