# 📚 Exambre

Aplikasi latihan soal CPNS dengan **spaced repetition** (repetisi berjarak ala Anki/SM-2), simulasi ujian ber-timer, catatan rich-text, gamifikasi, sinkronisasi cloud, dan bantuan AI.

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

### 🤖 AI Gemini (opsional)
- **Scan soal dari foto/screenshot** → otomatis mengisi form (butuh API key gratis dari [aistudio.google.com](https://aistudio.google.com))
- **Generate pembahasan** satu klik untuk soal yang belum ada penjelasan

### 📊 Statistik & Analisis
- Akurasi, progres dikuasai, titik lemah per kategori
- Widget **Kesiapan Ujian** berdasarkan tanggal target + pace belajar

### 💾 Data
- Export/import backup `.json` lengkap (soal, catatan, progres)
- Semua data tetap tersimpan lokal meski tanpa internet

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
