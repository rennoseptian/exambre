# AGENTS.md — Panduan untuk AI Agent (Exambre)

## Ringkasan Proyek
Exambre = aplikasi **universal** untuk latihan soal apa pun (bukan spesifik CPNS) berbasis Android
(Capacitor 6) + PWA. Fitur inti:
- Spaced repetition (SRS ala SM-2 sederhana) dengan status "Dikuasai"
- Simulasi ujian ber-timer (per-soal / total sesi) — terpisah total dari SRS
- Catatan rich-text per kategori
- Gamifikasi ringan (streak harian / XP / lencana)
- 8 fitur AI opsional (lihat seksi "Lapisan AI")
Seluruh string UI berbahasa Indonesia. Aplikasi single-page tanpa framework frontend.

## Struktur & Arsitektur
- `www/index.html` — HANYA markup + modal-modal. Dua pengecualian yang sengaja inline:
  theme-init script satu baris di <head> (anti-FOUC, jangan dipindah) dan
  satu `<style>` kecil untuk area paste-ta.
- `www/assets/app.css` — seluruh stylesheet. Ada 3 blok palet yang HARUS sinkron jika mengubah token:
  `:root` (light), `@media(prefers-color-scheme:dark) :root:not([data-theme=light])`,
  `:root[data-theme="dark"]`. Blok TERAKHIR file = layout desktop `@media(min-width:1024px)`
  (sidebar kiri menggantikan bottom-nav, konten 1080px).
- `www/sw.js` — service worker PWA (cache-first, offline + installable). WAJIB naikkan versi
  `CACHE` (`exambre-vN`) setiap mengubah file inti agar client lama tidak dapat aset stale.
- `www/assets/js/*.js` — 16 file classic-script BERURUTAN berbagi scope global
  (bukan ES module). URUTAN load penting; nomor 05 sengaja bolong (file cloud lama dihapus,
  tag `<script>`-nya pun sudah dibuang dari index.html — jangan dipasang lagi):
  01-state, 02-gamify-data, 03-notes, 04-srs-toast, 06-media, 07-categories,
  08-theme-io, 09-image-inputs, 10-render-edit, 11-panel-forms, 12-card-actions,
  13-review, 14-simulation, 15-stats, 16-ai, 17-main (hanya listener DOMContentLoaded).
- `android/` — project native Capacitor (sudah di-commit; JANGAN jalankan `npx cap add android`
  lagi karena platform sudah ada).
- `.github/workflows/build-android-apk.yml` + `.github/workflows/deploy-web.yml` — CI membangun
  APK release DAN deploy web ke GitHub Pages (https://rennoseptian.github.io/exambre)
  otomatis pada tiap push ke main; hasil APK di tab Actions → Artifacts.
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
`exambre_exam_date`. (Kunci lama `cpns-fb-config`/`cpns-sync-code` tak lagi dipakai.)

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
12. Daftar panjang TANPA CSS `columns`: `render()` membangun ulang seluruh `#qlist` tiap ketukan
    kategori/search — column balancing di 86+ kartu bikin lag berat saat pindah tab.
    Optimasi yang dipakai: `.qcard{content-visibility:auto;contain-intrinsic-size:auto 220px}`.
13. Hover guard berlaku juga di blok desktop (media query nested `@media(hover:hover)` di dalam
    `@media(min-width:1024px)`) — transform :hover tanpa guard "nyangkut" di layar sentuh besar.
14. `#sim-nav-container` (grid nomor simulasi) default `display:none` di CSS; hanya `display:block`
    saat `#sec-review.sim-active`. Bila dibiarkan elemen kosong tetap fixed bottom dengan
    `border-top`, muncul garis tipis putih melintang di layar (setelah selesai ujian dsb.).
15. Undo hapus soal WAJIB per-toast lewat closure (`showToastWithUndo('...',()=>{snap})` di
    `delQ`), BUKAN slot global `lastDeleted` + `onclick="undoDel()"`. Dua toast hapus bisa hidup
    bersamaan sehingga undo di toast lama memulihkan soal yang SALAH lalu mengunci
    `lastDeleted=null` — soal yang dihapus pertama hilang permanen. Durasi toast hapus juga
    WAJIB 8 dtk (bukan default 4 dtk): tiap hapus butuh dialog konfirmasi, jadi dua hapus
    berturut-turut makan >4 dtk dan toast pertama lenyap sebelum sempat diklik.
16. `clearAllData()` WAJIB menghapus tiga key data: `SK`, `NK`, **dan `SIMHISTK`**
    (`exambre_sim_history`). Tanpa `SIMHISTK`, tab Riwayat & badge masih menampilkan sesi
    simulasi lama padahal teks konfirmasi menjanjikan SEMUA data hilang. Key lain
    (`exambre-theme`, `exambre_gemini_key`, `CAI_KEY`, `SFX_KEY`, `exambre_exam_date`)
    adalah pengaturan/rahasia dan TIDAK boleh ikut terhapus — tiap punya tombol reset sendiri.
17. Grid nomor simulasi di MOBILE wajib punya `max-height:34vh` + `overflow-y:auto`, dan tombolnya
    dikecilkan 38px→34px. Tanpa itu 100+ soal membuat kontainer `position:fixed` setinggi ~480px
    yang menutupi soal. WAJIB di dalam `@media(max-width:1023px)` — kalau ditaruh di rule dasar,
    panel statis desktop (blok `min-width:1024px`) ikut terkunci dan grid terpotong.
18. Teks milik pengguna yang masuk `innerHTML` WAJIB lewat `escHtml()` (didefinisikan di
    `01-state.js`, dipindah dari `_escHtml()` yang tadinya hanya di `16-ai.js`) — bukan
    disisipkan mentah. `sanitizeHtml()` hanya untuk HTML kaya (opsian/pembahasan), sedangkan
    teks polos (judul catatan, preview, kata kunci search, nama kategori, sub-bab) harus
    di-*escape* supaya `&`, `<`, `>` tampil apa adanya dan tag tidak jadi elemen nyata.
    Tambahan: (a) `escHtml()` juga escape `"` supaya aman di nilai atribut; (b) string JS di
    dalam `onclick` WAJIB `escHtml(jsStr(k))` — `jsStr` dulu (backslash + kutip tunggal),
    baru `escHtml` (kutip ganda = pembatas atribut), urutan terbalik merusak; (c) WARNA yang
    masuk `style="..."` WAJIB lewat `safeColor()` (hanya `#RGB`/`#RRGGBB`, 3-digit
    dinormalkan ke 6-digit) — `migrateCatColors()` TIDAK memvalidasi warna, dan file import
    bisa menyuntikkan `red" onmouseover="alert(1)`. Opsi jawaban di contenteditable form edit
     pakai `sanitizeHtml()` (bukan `escHtml`) supaya `<img>` hasil paste tetap hidup.
19. `processImportJson()` TIDAK memvalidasi isi file backup — seluruh `data.qs` dan `data.cats`
    dipakai apa adanya. Jadi SEMUA nilai dari storage/import wajib dianggap tidak dipercaya,
    termasuk yang secara intuitif "pasti aman": (a) `src` gambar di `q.qimgs`/`q.eimgs`/
    `q.optImgs`/`imgAreas` WAJIB `escHtml(...)`, dan kalau ikut masuk `onclick="openLB('...')"`
    WAJIB `escHtml(jsStr(...))` — vektor nyata `x" onerror="alert(1)` lewat file backup;
    (b) TIADA `<option>` boleh dirender dengan nilai mentah — `updateBabSelectEdit()` pernah
    terlewat padahal tiga situs sub-bab lain sudah diamankan; select kategori di `16-ai.js`,
    chip kategori simulasi, `catLbl` riwayat, dan nama kategori di `15-stats.js` juga mentah;
    (c) teks dari respons AI (`r.label`, `it.jawaban`) dan preview hasil parse-paste (`r.q`)
    ikut di-escape karena prompt-injection bisa menyuntikkan HTML.
    Cara verifikasi cepat: invariant "jumlah kutip mentah di dalam satu tag = 2 × jumlah
    atribut". Kalau kutip melebihi hitungan itu, ada atribut asing yang bocor.

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
- Google Login & Cloud Sync Firebase DIHAPUS atas keputusan user (b95cb9e) setelah
  setup rules terasa merepotkan — app kini 100% lokal. Jangan bangun ulang tanpa diminta.
- SFX & FX playful ada (assets/sfx/*.wav custom + confetti + count-up); saklar di Lainnya,
  preferensi disimpan di key `exambre_sfx` ('off' = mati, default aktif).
- Versi web online: GitHub Pages + service worker PWA offline/installable (779f50b);
  manifest diperbaiki (branding Exambre, path ikon benar, start_url relatif) + ikon
  dibuat transparan via flood-fill (072a04e).
- Layout desktop responsif ≥1024px: sidebar kiri ganti bottom-nav, konten 1080px (30f6180).
  List 2-kolom CSS columns DIBATALKAN karena lag (a619fa8) → lihat anti-regresi #12.
- Simulasi CAT BKN-style: grid nomor + prev/next + lompat + ragen (37de85e); posisi nav grid
  sempat sidebar kanan sticky (104efe5) lalu DIPUTUSKAN pindah ke bawah konten full-width karena
  mengapit kolom soal jadi sempit; mode-switch (Latihan/Simulasi) disembunyikan saat sesi berjalan
  (a91582a). Bagian kosong container diasir dengan `display:none` default (50fd6cb) — lihat anti-regresi #14.
- Cleanup: tag `<script 05-cloud.js>` dibuang dari index.html (404 tiap load), font yatim
  `.woff2` dihapus (50fd6cb).

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
