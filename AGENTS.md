# AGENTS.md — Panduan untuk AI Agent (Exambre)

## Ringkasan Proyek
Exambre = app Android (Capacitor 6) latihan soal CPNS dengan spaced repetition (SRS ala SM-2),
mode simulasi ujian ber-timer, catatan rich-text, gamifikasi (streak/XP/badge), cloud sync Firebase,
dan fitur AI Gemini (scan soal dari foto, generate pembahasan).

## Struktur
- `www/index.html` — SEMUA kode di satu file (~3.100 baris):
  - `<style>` utama: awal file s/d ~baris 349 (+1 inline `<style>` kecil di area paste ~line 547)
  - Body HTML: splash, lightbox, toast-wrap, badge-toast, modals (settings/sync/note-cat/confirm/import), `.app` dengan 5 sec: list/review/catatan/stats/lainnya, bottom-nav
  - `<script>` utama: mulai setelah 3 script firebase compat gstatic, s/d `</script>` sebelum `</body>`
- `www/manifest.json`, `www/assets/` (font Inter lokal, tabler icons webfont lokal)
- `capacitor.config.json` — appId com.exambre.app, webDir www
- Tidak ada build system / bundler / test framework saat ini.

## State Global Penting (jangan ubah nama sembarangan — dipakai lintas-fungsi & inline onclick)
`qs, nid, cats, revList, revIdx, revMode('srs'|'sim'), simState, simHistory, notes, noteCats,
gami, imgAreas, curCat, curSt, curBab, searchQ, fbReady, syncCode`
Storage keys: `cpns-wb-v6` (data utama), `exambre-notes-v1`, `exambre_sim_history`,
`exambre-theme`, `exambre_gemini_key`, `exambre_exam_date`, `cpns-fb-config`, `cpns-sync-code`.

## Konvensi Kode
- Gaya JS kompak ala penulis asli (one-liner, template literal untuk render HTML string).
- Semua string UI Bahasa Indonesia.
- HTML dari user WAJIB lewat `sanitizeHtml()` sebelum dirender (ALLOWED_TAGS + SAFE_URL).
- Class CSS = hook JS (mis. `.sec.on`, `.bnav-item.on`, `.ropt`, `.ctab`, `.t2`, `.modal.on`):
  JANGAN rename class tanpa cek pemakaian di JS/render string.
- Verifikasi syntax JS: `node --check` pada hasil ekstraksi antara marker `<script>`/`</script>`.
- Commit hanya jika diminta. Push sudah ter-setup (credential store PAT, user rennoseptian).

## Perbaikan Bug Terakhir (commit 4a058fc — jangan regresi)
1. `loadSimHistory()` kini dipanggil di listener DOMContentLoaded.
2. renderRev & renderSimQuestion: opsi A-E memakai indeks ASLI array (`map` dulu, skip kosong di dalam),
   bukan filter-then-map (dulu label bergeser kalau ada slot opsi kosong). Tombol .ropt punya `data-l`.
3. ansRev highlight memakai `b.dataset.l`, bukan LETTERS[i] dari indeks DOM.
4. CSS var `--warn` TERDEFINISI di 3 blok palet (light, prefers-dark, data-theme=dark).
5. Regex jawaban scan AI `/\b([A-E])\b/` — hati-hati byte kontrol 0x08 tak terlihat saat edit regex.

## Riwayat Redesign UI (penting!)
Commit 1c96fc5 = redesign Material-3 minimalis (CSS-swap besar) → BANYAK BUG → di-revert di 293b4ed.
Pelajaran: jangan big-bang ganti stylesheet; verifikasi per-komponen; app tidak punya preview/test.
Keinginan user (belum terealisasi): tampilan modern-minimalis ala Material You untuk Android.

## Rencana Refactoring (disetujui user, kerjakan BERURUTAN)
- Fase 1 (aman): pisahkan `<style>` → `www/assets/app.css`, `<script>` utama → `www/assets/app.js`
  (referensikan via <link>/<script src>). Verifikasi: node --check + app jalan + diff konten.
- Fase 2: pecah app.js jadi ES modules per domain (srs, review, sim, notes, cloud, ai, ui) +
  Vite sebagai bundler (output ke www/, Capacitor-friendly).
- Fase 3: kumpulkan state global tersebar jadi store sederhana.
- Fase 4 (opsional): pertimbangkan lit/preact HANYA jika sudah dibutuhkan.
- Setelah refactor selesai: ulangi redesign UI bertahap per komponen.

## Perintah
- `npm run sync` / `npm run open` (Capacitor)
- Tidak ada linter/formatter/test resmi — gunakan node --check sebagai gate minimum.
