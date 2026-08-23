# AGENTS.md — Panduan untuk AI Agent (Exambre)

## Ringkasan Proyek
Exambre = app Android (Capacitor 6) latihan soal CPNS dengan spaced repetition (SRS ala SM-2),
mode simulasi ujian ber-timer, catatan rich-text, gamifikasi (streak/XP/badge), cloud sync Firebase,
dan fitur AI Gemini (scan soal dari foto, generate pembahasan).

## Struktur
- `www/index.html` — markup saja (~400 baris) + 1 inline `<style>` kecil di area paste
  + theme-init script satu baris di <head> (jangan dipindah, anti-FOUC).
- `www/assets/app.css` — seluruh stylesheet.
- `www/assets/js/*.js` — 17 file classic-script BERURUTAN berbagi scope global
  (bukan ES module; urutan load di index.html penting untuk const/let top-level):
  01-state, 02-gamify-data, 03-notes, 04-srs-toast, 05-cloud, 06-media, 07-categories,
  08-theme-io, 09-image-inputs, 10-render-edit, 11-panel-forms, 12-card-actions,
  13-review, 14-simulation, 15-stats, 16-ai, 17-main (listener DOMContentLoaded).
- `www/manifest.json`, `www/assets/fonts|icons`
- `capacitor.config.json` — appId com.exambre.app, webDir www
- Tidak ada bundler/test framework. Verifikasi: node --check per file js.

## State Global Penting (jangan ubah nama sembarangan — dipakai lintas-fungsi & inline onclick)
Sejak fase 3, semua state mutable tinggal di objek `Store` (dideklarasikan di `01-state.js`).
Nama lama (`qs`, `cats`, `gami`, `simState`, dll.) adalah accessor window ke `Store` —
tetap dipakai normal di seluruh kode. Daftar kuncinya:
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
- Fase 1 ✅ (f27653e): CSS → assets/app.css, JS → assets/app.js
- Fase 2 ✅ (3d949aa): app.js dipecah 17 file classic-script berurutan (assets/js/)
- Fase 3 ✅ (f5a1712): state global terpusat di objek Store + accessor window
- Fase 4 (opsional, BELUM): ES modules murni / bundler HANYA jika dibutuhkan

## Redesign UI — STATUS
Redesign inkremental per-komponen BERHASIL (setelah revert big-bang 293b4ed):
langkah 1-8 selesai = token radius, tombol pill tonal, kartu borderless, bottom-nav
floating + pil aktif (glow dua lapis), modal bottom-sheet mobile, chip kategori solid
warna + search filled, tombol jawaban (+state .sel yang dulu hilang), input filled,
filter pill geser. Fix lanjutan: clip glow di scroll-container chip (padding dalam),
badge-toast idle visibility:hidden, hapus titik di lingkaran huruf opsi.
Prinsip terbukti: SATU komponen per commit + user tes di browser dulu.

## Roadmap Fitur AI (disetujui user — urutan eksekusi)
1. ✅ Generate Soal dari Catatan (0fd37ad): tombol ✨ di kartu catatan → modal
   jumlah/kategori → callGemini → JSON {questions:[...]} → validasi → masuk SRS.
2. ✅ Custom provider AI (OpenAI-compatible): kolom opsional di Lainnya
   (base URL + model + API key, format OpenAI-compatible /v1/chat/completions)
   agar bisa pakai Groq/OpenRouter-free/Cerebras/Ollama-lokal; Gemini tetap default.
3. ✅ Batch scan multi-soal (tombol Scan Halaman): preview ber-checkbox → impor massal.
4. ✅ Tanya tutor per soal (tombol 💬 di kartu): chat bottom-sheet dengan konteks soal+opsi+kunci+jawaban user+pembahasan, riwayat dalam sesi.
5. ✅ Variasi soal (ikon shuffle di kartu): 1 soal baru konsep sama/konteks beda → preview → simpan.
6. Saran kategori/sub-bab otomatis saat import massal.
7. Analisis pola kesalahan user + micro-lesson.
Catatan desain AI layer: prompt scan/pembahasan sudah netral (bukan CPNS-specific);
kunci storage `cpns-*` JANGAN diganti (kompatibilitas data lama).

## Perintah
- `npm run sync` / `npm run open` (Capacitor)
- Tidak ada linter/formatter/test resmi — gunakan node --check sebagai gate minimum.
