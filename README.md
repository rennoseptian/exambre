# 📚 Exambre

Aplikasi latihan soal universal dengan **spaced repetition** (repetisi berjarak ala Anki/SM-2), simulasi ujian ber-timer, catatan rich-text, gamifikasi, dan bantuan AI.

Cocok untuk materi apa pun — ujian masuk, sertifikasi, bahasa asing, kedokteran, hukum, atau kumpulan rumus pribadi Anda.

Tersedia sebagai **aplikasi Android** (Capacitor 6) dan **web/PWA** (https://rennoseptian.github.io/exambre) — tanpa framework frontend, murni HTML/CSS/JavaScript modular, 100% lokal.

---

## ✨ Fitur

### 🧠 Latihan Spaced Repetition (SRS)
- Algoritme SM-2 sederhana: soal salah → muncul lagi dalam hitungan menit; soal benar → interval memanjang (1 → 6 → hari × faktor ease)
- Status **Dikuasai** dicapai setelah 3x berturut-turut benar
- Badge "jatuh tempo" di navigasi menampilkan jumlah soal yang perlu direview
- Opsi *Latihan Bebas* untuk melatih semua soal sekaligus

### ⏱️ Simulasi Ujian
- Timer **per soal** atau **total sesi**
- Pilih kategori & jumlah soal secara bebas
- Hasil dihitung di akhir: skor akurasi, rincian per kategori, jawaban benar/salah/kosong
- Riwayat hingga 30 sesi terakhir tersimpan lokal
- **Tidak memengaruhi** jadwal SRS — simulasi dan latihan terpisah total

### 📝 Input Soal Serba Bisa
- **Paste cepat**: tempel soal dari web/apk lain — kategori, pilihan A–E, kunci, bahkan gambar ikut terdeteksi otomatis
- **Isi manual**: form lengkap dengan rich-text editor untuk pembahasan
- Gambar via URL, upload file, drag-drop, atau langsung Ctrl+V

### 🗒️ Catatan Rich-Text
- Editor lengkap: heading, list, tabel, kutipan, `kode`, gambar
- Organisasi per kategori warna + pencarian teks

### 🎮 Gamifikasi
- Streak belajar harian 🔥, XP ⚡, dan lencana pencapaian 🏅

### 🌐 Versi Web & PWA
- Live di **https://rennoseptian.github.io/exambre** — deploy otomatis tiap push ke `main`
- Bisa **di-install ke layar utama** HP (menu browser → *Tambahkan ke layar utama*)
- **Offline penuh** setelah kunjungan pertama (service worker cache-first)
- Di layar ≥1024px (laptop/PC) layout berubah jadi **desktop**: sidebar navigasi kiri, konten lebar — bukan "HP besar"
- Catatan: online ≠ sinkron; tiap perangkat tetap punya datanya sendiri (lokal)

### 🤖 AI (opsional) — 8 kemampuan
Butuh API key gratis [Gemini](https://aistudio.google.com); fitur teks juga bisa dialihkan ke provider OpenAI-compatible lain (Groq/OpenRouter/Cerebras/Ollama) via *Lainnya → Provider Kustom*.
- **Scan soal dari foto** → otomatis mengisi form *(vision: Gemini)*
- **Scan Halaman** — banyak soal sekaligus → preview centang → impor massal *(vision: Gemini)*
- **✨ Sarankan Kategori** — AI mengelompokkan hasil scan ke kategori/sub-bab (boleh bikin baru), plus saran kategori di form paste
- **Buat Soal dari Catatan** ✨ — soal ber-pembahasan dari isi catatan, langsung terjadwal SRS
- **Generate pembahasan** satu klik untuk soal apa pun
- **💬 Tanya Tutor** — chat kontekstual per soal: pahami kunci, opsi, dan jawaban salah Anda
- **🔀 Variasi Soal** — soal baru konsep sama/konteks beda, melatih pemahaman bukan hafalan
- **🔍 Analisis Pola Kesalahan** — ringkasan pola + fokus per kategori + micro-lesson (tab Statistik)

### 📊 Statistik & Analisis
- Akurasi, progres dikuasai, titik lemah per kategori
- Widget **Kesiapan Ujian** berdasarkan tanggal target + pace belajar

### 💾 Data
- Export/import backup `.json` lengkap (soal, catatan, progres)
- Semua data tetap tersimpan lokal meski tanpa internet

---

## 🗺️ Peta Fitur → Berkas (panduan saat menemukan bug)

| Bagian di App | Fungsinya | Berkas terkait (`www/assets/js/`) |
|---|---|---|
| Tab Soal — kartu soal | daftar, tag dikuasai, edit inline, hapus+undo, 💬 tutor, 🔀 variasi | `10-render-edit`, `12-card-actions`, `16-ai` |
| Tombol "+ Tambah Soal" | panel paste/manual + preview parse | `11-panel-forms` |
| Scan foto & Scan Halaman | ekstraksi AI dari gambar | `16-ai` |
| Search bar & filter status/bab | penyaringan daftar soal | `08-theme-io`, CSS `.filter-row` |
| Chip kategori (atas) | pindah kategori soal | `07-categories` |
| Tab Review → Latihan (SRS) | sesi review, feedback, XP/streak, badge toast | `13-review`, `02-gamify-data` |
| Tab Review → Simulasi Ujian | timer, hasil per kategori, riwayat simulasi | `14-simulation` |
| Tab Catatan | editor rich-text, kategori catatan, tombol ✨ buat soal | `03-notes`, `16-ai` |
| Tab Statistik | ringkasan, lencana, kelemahan, kesiapan ujian, countdown ujian | `15-stats`, `16-ai` |
| Tab Lainnya | tema, export/import, API keys, reset data | `08-theme-io`, `16-ai` |
| Navigasi bawah / splash / toast | kerangka & notifikasi global | `index.html`, `17-main`, CSS |
| State semua fitur | objek pusat `Store` + accessor window | `01-state` |

**Penyimpanan lokal:** `cpns-wb-v6` (soal+progress) · `exambre-notes-v1` (catatan) · `exambre_sim_history` · `exambre-theme` · `exambre_gemini_key` · `exambre_custom_ai` · `exambre_exam_date` · `exambre_sfx` (saklar efek suara)

---

## 🛠️ Teknologi
| Lapisan | Teknologi |
|---|---|
| Native shell | Capacitor 6 (Android) |
| Web/PWA | Service worker cache-first + GitHub Pages (deploy otomatis) |
| UI | Vanilla CSS custom-properties, Tabler Icons, font Inter, layout responsif desktop ≥1024px |
| Logika | Vanilla JS — 16 modul classic-script berbagi store terpusat |
| AI | Google Gemini REST API + provider OpenAI-compatible opsional |

## 📁 Struktur
```
├── index.html              # markup + theme-init anti-FOUC
├── manifest.json           # PWA manifest (Exambre, ikon transparan)
├── sw.js                   # service worker (offline + installable; bump CACHE saat ubah file inti)
└── assets/
    ├── app.css             # seluruh stylesheet (+ blok desktop ≥1024px di akhir)
    ├── js/                 # 01-state … 17-main (urutan load penting; 05 bolong sengaja)
    │   └── …               # state/gamify/notes/srs/media/categories/
    │                       # io/images/render/forms/actions/review/
    │                       # simulation/stats/ai/main
    ├── fonts/  icons/  icon/  sfx/
├── android/                # project native Capacitor
└── .github/workflows/      # CI: build-android-apk.yml + deploy-web.yml (GitHub Pages)
```

## 🚀 Menjalankan
```bash
npm install          # pasang dependensi
npm run sync         # salin www/ ke project Android
npm run open         # buka di Android Studio (opsional)
```
Tanpa Android Studio pun bisa:
- **Tes cepat di browser**: serve folder `www/` (mis. `python3 -m http.server 8080 --directory www`)
- **Build APK manual**: `cd android && ./gradlew assembleDebug`

## 🤖 Build APK Otomatis
Setiap push ke `main` memicu workflow **Build Android APK** (GitHub Actions).
APK release bertanda tangan dapat diunduh di tab **Actions → build terbaru → Artifacts**.
Signing memerlukan secrets repo: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## 📄 Lisensi
MIT — lihat [package.json](package.json).
