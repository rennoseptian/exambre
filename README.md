# 📚 Exambre

Aplikasi latihan soal universal dengan **spaced repetition** (repetisi berjarak ala Anki/SM-2), simulasi ujian ber-timer, catatan rich-text, gamifikasi, sinkronisasi cloud, dan bantuan AI.

Cocok untuk materi apa pun — ujian masuk, sertifikasi, bahasa asing, kedokteran, hukum, atau kumpulan rumus pribadi Anda.

Dibangun sebagai aplikasi Android native via [Capacitor 6](https://capacitorjs.com) — tanpa framework frontend, murni HTML/CSS/JavaScript modular.

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

### ☁️ Cloud Sync (opsional)
- Sinkronisasi otomatis antar perangkat via Firebase Firestore + Storage (gambar diupload, hemat ruang localStorage)
- Cukup tempel config Firebase Anda sendiri; data terkunci pada **Kode Sync** unik

### 🤖 AI (opsional)
Butuh API key gratis [Gemini](https://aistudio.google.com); teks juga bisa dialihkan ke provider OpenAI-compatible lain (Groq/OpenRouter/Cerebras/Ollama).
- **Scan soal dari foto** → otomatis mengisi form tambah soal *(vision: Gemini)*
- **Scan Halaman** — banyak soal sekaligus → preview centang → impor massal *(vision: Gemini)*
- **Buat Soal dari Catatan** ✨ — AI menyusun soal ber-pembahasan dari isi catatan, langsung masuk jadwal SRS
- **Generate pembahasan** satu klik untuk soal apa pun

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
| Tab Soal — kartu soal | daftar, tag dikuasai, edit inline, hapus+undo | `10-render-edit`, `12-card-actions` |
| Tombol "+ Tambah Soal" | panel paste/manual + preview parse | `11-panel-forms` |
| Scan foto & Scan Halaman | ekstraksi AI dari gambar | `16-ai` |
| Search bar & filter status/bab | penyaringan daftar soal | `08-theme-io`, CSS `.filter-row` |
| Chip kategori (atas) | pindah kategori soal | `07-categories` |
| Tab Review → Latihan (SRS) | sesi review, feedback, XP/streak, badge toast | `13-review`, `02-gamify-data` |
| Tab Review → Simulasi Ujian | timer, hasil per kategori, riwayat simulasi | `14-simulation` |
| Tab Catatan | editor rich-text, kategori catatan, tombol ✨ buat soal | `03-notes`, `16-ai` |
| Tab Statistik | ringkasan, lencana, kelemahan, kesiapan ujian, countdown ujian | `15-stats`, `16-ai` |
| Tab Lainnya | tema, export/import, cloud sync, API keys, reset data | `08-theme-io`, `05-cloud`, `16-ai` |
| Navigasi bawah / splash / toast | kerangka & notifikasi global | `index.html`, `17-main`, CSS |
| State semua fitur | objek pusat `Store` + accessor window | `01-state` |

**Penyimpanan lokal:** `cpns-wb-v6` (soal+progress) · `exambre-notes-v1` (catatan) · `exambre_sim_history` · `exambre-theme` · `exambre_gemini_key` · `exambre_custom_ai` · `exambre_exam_date` · `cpns-fb-config` & `cpns-sync-code` (cloud)

---

## 🛠️ Teknologi
| Lapisan | Teknologi |
|---|---|
| Native shell | Capacitor 6 (Android) |
| UI | Vanilla CSS custom-properties, Tabler Icons, font Inter |
| Logika | Vanilla JS — 17 modul classic-script berbagi store terpusat |
| Cloud | Firebase (Firestore + Storage, compat SDK) |
| AI | Google Gemini REST API |

## 📁 Struktur
```
├── index.html              # markup + theme-init anti-FOUC
├── manifest.json           # PWA manifest
└── assets/
    ├── app.css             # seluruh stylesheet
    ├── js/                 # 01-state … 17-main (urutan load penting)
    │   └── …               # state/gamify/notes/srs/cloud/media/categories/
    │                       # io/images/render/forms/actions/review/
    │                       # simulation/stats/ai/main
    ├── fonts/  icons/
├── android/                # project native Capacitor
└── .github/workflows/      # CI build APK otomatis
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
