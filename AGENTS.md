# AGENTS.md — Panduan untuk AI Agent (Exambre)

## Ringkasan Proyek
Exambre = aplikasi **universal** untuk latihan soal apa pun (bukan spesifik CPNS) berbasis Android
(Capacitor 6) + PWA. Fitur inti:
- Spaced repetition (SRS ala SM-2 sederhana) dengan status "Dikuasai"
- Simulasi ujian ber-timer (per-soal / total sesi) — terpisah total dari SRS
- Catatan rich-text per kategori
- Gamifikasi ringan (streak harian / XP / lencana)
- Cloud sync opsional (Firebase Firestore + Storage)
- 8 fitur AI opsional (lihat seksi "Lapisan AI")
Seluruh string UI berbahasa Indonesia. Aplikasi single-page tanpa framework frontend.

## Struktur & Arsitektur
- `www/index.html` — HANYA markup + modal-modal. Dua pengecualian yang sengaja inline:
  theme-init script satu baris di <head> (anti-FOUC, jangan dipindah) dan
  satu `<style>` kecil untuk area paste-ta.
- `www/assets/app.css` — seluruh stylesheet. Ada 3 blok palet yang HARUS sinkron jika mengubah token:
  `:root` (light), `@media(prefers-color-scheme:dark) :root:not([data-theme=light])`,
  `:root[data-theme="dark"]`.
- `www/assets/js/*.js` — 17 file classic-script BERURUTAN yang berbagi scope global
  (bukan ES module). URUTAN load di index.html penting untuk const/let top-level:
  01-state, 02-gamify-data, 03-notes, 04-srs-toast, 05-cloud, 06-media, 07-categories,
  08-theme-io, 09-image-inputs, 10-render-edit, 11-panel-forms, 12-card-actions,
  13-review, 14-simulation, 15-stats, 16-ai, 17-main (hanya listener DOMContentLoaded).
- `android/` — project native Capacitor (sudah di-commit; JANGAN jalankan `npx cap add android`
  lagi karena platform sudah ada).
- `.github/workflows/build-android-apk.yml` — CI membangun APK release otomatis pada tiap push ke main;
  hasil di tab Actions → Artifacts.
- Tidak ada bundler/linter/test framework resmi.

## State & Penyimpanan
Sejak refactor fase 3, SEMUA state mutable tinggal di objek `Store` (dideklarasikan `01-state.js`).
Nama-nama global lama (`qs`, `cats`, `gami`, `simState`, dst.) adalah accessor window ke `Store` —
dipakai normal di seluruh kode termasuk inline onclick. Jangan ubah nama-nama ini:
`qs, nid, cats, revList, revIdx, revMode('srs'|'sim'), simState, simTimerHandle,
simSelectedCats, simHistory, notes, noteCats, noteNid, gami, imgAreas, curCat, curSt,
curBab, searchQ, fbApp, fbDb, fbStorage, fbReady, syncCode, pendingDeletes`.

localStorage keys (JANGAN rename `cpns-*` demi kompatibilitas data pengguna lama):
`cpns-wb-v6` (soal+progress utama) · `exambre-notes-v1` · `exambre_sim_history` ·
`exambre-theme` · `exambre_gemini_key` · `exambre_custom_ai` (provider kustom) ·
`exambre_exam_date` · `cpns-fb-config` · `cpns-sync-code`.

## Lapisan AI (file `16-ai.js`)
Dispatcher: `callAI(prompt, json?)` → provider kustom jika tersedia, else Gemini.
Jika provider kustom GAGAL (error apa pun) dan ada Gemini key, otomatis fallback ke Gemini (console.warn tercatat).
`callAIChat(systemText, hist)` untuk chat multi-turn sungguhan (tutor).
- Provider kustom: format OpenAI-compatible `/chat/completions`; config di Lainnya
  (baseUrl+model+key, disimpan `exambre_custom_ai`). Scan foto TETAP Gemini (vision).
- Mode JSON: kirim `json=true` → Gemini dapat `response_mime_type:'application/json'`,
  OpenAI-compatible dapat `response_format:{type:'json_object'}`. Selalu gunakan untuk
  fitur yang butuh JSON.
- Parsing respons JSON WAJIB lewat `_extractJSON()` (toleran fence/basa-basi/koma nyasar),
  bukan `JSON.parse` langsung.
- Fitur aktif: scan soal tunggal (vision), batch scan halaman → preview checkbox,
  generate pembahasan, buat soal dari catatan ✨, tutor chat 💬 per soal,
  variasi soal 🔀, saran kategori/sub-bab (batch + paste, boleh bikin kategori baru via `_ensureCat`),
  analisis pola kesalahan + micro-lesson (tab Statistik).
- Prompt sudah netral jenis ujian (universal) — pertahankan.
- Pelajaran penting: riwayat chat harus dikirim sebagai pesan multi-turn asli
  (role user/assistant/model), BUKAN transkrip teks tempelan — model bisa "melanjutkan cerita".

## Konvensi Kode & Verifikasi
- Gaya JS kompak ala penulis asli (one-liner, template literal untuk render HTML string).
- HTML dari user WAJIB lewat `sanitizeHtml()` sebelum dirender (ALLOWED_TAGS + SAFE_URL).
- Class CSS = hook JS/render-string (`.sec.on`, `.bnav-item.on`, `.ropt`, `.ctab`, `.t2`,
  `.modal.on`, `.tbub`, `.batch-row`, dst.) — JANGAN rename tanpa cek pemakaiannya.
- Verifikasi minimum setelah edit: `node --check www/assets/js/<file>.js`.
- Commit hanya jika diminta. Remote push sudah siap (credential store PAT, user rennoseptian,
  token punya scope repo+workflow).

## Daftar Anti-Regresi (bug yang pernah diperbaiki — JANGAN kambuh)
1. `loadSimHistory()` dipanggil di DOMContentLoaded (riwayat simulasi hilang bila tidak).
2. Opsi A–E dirender pakai indeks ASLI array (`map` dulu, skip kosong DI DALAM map);
   filter-then-map membuat label bergeser bila ada opsi kosong. Tombol `.ropt` punya `data-l`;
   highlight jawaban (`ansRev`) membaca `dataset.l`, bukan indeks DOM.
3. CSS var `--warn` terdefinisi di KETIGA blok palet.
4. Regex ekstraksi huruf `/\b([A-E])\b/` — hati-hati byte kontrol 0x08 tak terlihat saat edit regex.
5. Timer simulasi: pindah tab men-clear interval; `openReviewTab()` wajib menyalakan ulang
   `setInterval(simTick,1000)` saat sesi belum selesai.
6. Chip kategori: background SOLID warna kategori (bukan transparan) supaya kontras teks
   stabil lintas tema; gradien fade tepi `.cats-wrap::after` sudah dimatikan.
7. Glow pil/chip aktif butuh ruang: kontainer scroll chip di mobile pakai padding dalam
   vertikal+horizontal (kompensasi margin negatif); transisi box-shadow butuh zero-state shadow.
8. Hover kartu diguard `@media(hover:hover)` agar tidak "nyangkut" di layar sentuh.
9. `.badge-toast` idle = `visibility:hidden` (transform saja meninggalkan potongan pil terlihat).
10. Lingkaran huruf opsi TANPA titik (`${l}` bukan `${l}.`) agar huruf terpusat sempurna.
11. Tutor chat: multi-turn asli + maxOutputTokens 1024; fitur JSON lain 2048 + mode json native.

## Riwayat Keputusan Besar
- Refactor: fase 1 CSS/JS dipisah (f27653e) → fase 2 pecah 17 modul (3d949aa) →
  fase 3 Store terpusat (f5a1712). Fase 4 (ES modules murni/bundler) OPSIONAL — hanya jika benar-benar dibutuhkan.
- Redesign UI: percobaan big-bang CSS-swap (1c96fc5) GAGAL → di-revert (293b4ed) →
  diulang INKREMENTAL per komponen dan BERHASIL (langkah 1-8: token radius, tombol pill tonal,
  kartu borderless, bottom-nav floating + pil aktif glow, modal bottom-sheet mobile,
  chip solid warna + search filled, tombol jawaban + state `.sel`, input filled, filter pill geser).
  Prinsip terbukti WAJIB diikuti: SATU komponen per commit + user tes dulu sebelum lanjut.
- Aplikasi dideklarasikan user sebagai UNIVERSAL (semua mata pelajaran/jenis ujian),
  sehingga deskripsi & prompt tidak boleh spesifik CPNS.

## Cara Kerja dengan User
- Bahasa komunikasi: Indonesia. User bukan programmer, tapi tester yang teliti —
  ia akan melaporkan bug visual/fungsional dengan detail; verifikasi akar masalah sebelum patch.
- Pola yang berhasil: jelaskan rencana singkat → eksekusi → verifikasi (syntax + logika) →
  commit+push → minta user tes → baru lanjut langkah berikutnya.
- README.md memiliki tabel "Peta Fitur → Berkas" untuk bantu identifikasi lokasi bug.

## Perintah
- `npm install` sekali; `npm run sync` (salin www ke android); `npm run open` (butuh Android Studio).
- Tes cepat tanpa Android: serve folder `www/` (mis. `python3 -m http.server 8080 --directory www`).
- Build APK manual: `cd android && ./gradlew assembleDebug`; atau biarkan CI build otomatis per push.
