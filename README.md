# Exambre

Aplikasi latihan soal universal untuk web dan Android. Exambre menggabungkan latihan spaced repetition, simulasi ujian ber-timer, catatan rich-text, statistik belajar, dan fitur AI opsional dalam satu aplikasi local-first.

Aplikasi web: [rennoseptian.github.io/exambre](https://rennoseptian.github.io/exambre)

[Ringkasan](#ringkasan) | [Fitur](#fitur) | [Peta fitur](#peta-fitur-dan-berkas) | [Arsitektur](#arsitektur) | [Menjalankan](#menjalankan) | [Build APK](#build-apk) | [Privasi](#privasi-dan-keamanan) | [Lisensi](#lisensi)

## Ringkasan

| Aspek | Keterangan |
|---|---|
| Platform | Android melalui Capacitor 6 dan web/PWA |
| Basis aplikasi | HTML, CSS, dan JavaScript tanpa framework frontend |
| Penyimpanan | Local-first dengan export dan import backup JSON |
| AI | Opsional; Gemini atau provider OpenAI-compatible pilihan pengguna |
| Lisensi | MIT |

Exambre tidak bergantung pada akun, server aplikasi, atau sinkronisasi cloud. Data belajar disimpan di perangkat. Fitur AI hanya mengirim konten ke provider yang dikonfigurasi pengguna saat fitur tersebut digunakan.

## Fitur

### Latihan spaced repetition

- Algoritme SM-2 sederhana: jawaban salah muncul kembali dalam hitungan menit; jawaban benar memperpanjang interval secara bertahap.
- Status **Dikuasai** diberikan setelah tiga jawaban benar berturut-turut.
- Badge jatuh tempo pada navigasi menunjukkan jumlah soal yang perlu direview.
- Mode **Latihan Bebas** tersedia untuk melatih seluruh soal tanpa menunggu jadwal SRS.

### Simulasi ujian

- Timer per soal atau timer total sesi.
- Pemilihan kategori dan jumlah soal.
- Grid navigasi nomor soal dengan penanda ragu-ragu.
- Hasil akhir mencakup akurasi, rincian per kategori, serta jumlah jawaban benar, salah, dan kosong.
- Riwayat hingga 30 sesi terakhir tersimpan lokal.
- Simulasi terpisah dari SRS dan tidak mengubah jadwal review.

### Input soal

- **Paste cepat** untuk mengekstrak soal, kategori, pilihan A-E, kunci jawaban, dan gambar dari teks.
- Form manual dengan editor rich-text untuk pembahasan.
- Dukungan gambar melalui URL, upload file, drag-and-drop, atau paste langsung.

### Catatan rich-text

- Format tebal, miring, garis bawah, daftar, kode, tabel, dan gambar.
- Pengelompokan catatan per kategori warna.
- Pencarian teks di seluruh catatan.

### Gamifikasi

- Streak belajar harian, XP, dan lencana pencapaian.
- Efek suara dapat dimatikan dari pengaturan; animasi menghormati preferensi reduced motion sistem.

### Statistik

- Akurasi, progres penguasaan, dan titik lemah per kategori.
- Widget kesiapan ujian berdasarkan tanggal target dan kecepatan belajar.
- Analisis pola kesalahan dengan ringkasan dan micro-lesson melalui AI.

### Web dan PWA

- Deploy otomatis ke GitHub Pages setiap push ke `main`.
- Dapat dipasang ke layar utama sebagai PWA.
- Aset dan data tersedia offline setelah kunjungan pertama; fitur AI tetap memerlukan koneksi internet.
- Layout desktop aktif pada lebar layar minimal 1024px dengan sidebar navigasi kiri.
- Data setiap perangkat berdiri sendiri; aplikasi web tidak melakukan sinkronisasi antardevice.

### AI opsional

Fitur AI memerlukan API key. Gemini menjadi provider default. Fitur teks juga dapat diarahkan ke endpoint OpenAI-compatible seperti Groq, OpenRouter, Cerebras, atau Ollama melalui **Lainnya > Provider Kustom**.

Pemindaian gambar menggunakan model vision yang dikonfigurasi. Jika model vision tidak diisi, permintaan diarahkan ke Gemini. Model vision dapat diatur terpisah dari model teks.

- **Scan soal dari foto** untuk mengisi form secara otomatis.
- **Scan halaman** untuk memproses banyak soal sekaligus dengan preview sebelum impor.
- **Saran kategori** untuk mengelompokkan soal ke kategori dan sub-bab, termasuk pembuatan kategori baru.
- **Buat soal dari catatan** dengan pembahasan dan jadwal SRS otomatis.
- **Generate pembahasan** untuk soal yang sudah tersimpan.
- **Tutor chat** kontekstual per soal dengan riwayat percakapan.
- **Variasi soal** untuk membuat soal baru dengan konsep serupa dalam konteks berbeda.
- **Analisis pola kesalahan** untuk merangkum kelemahan dan memberikan fokus belajar.

## Peta fitur dan berkas

Modul berikut berada di `www/assets/js/`.

| Area | Fungsi utama | Modul terkait |
|---|---|---|
| Tab Soal | Daftar soal, edit inline, hapus dengan undo, tutor, variasi | `10-render-edit`, `12-card-actions`, `16-ai` |
| Panel Tambah Soal | Input paste dan manual, preview hasil parsing | `11-panel-forms` |
| Scan foto dan scan halaman | Ekstraksi soal dari gambar dengan AI | `16-ai` |
| Pencarian dan filter | Filter kategori, status, dan sub-bab | `08-theme-io`, CSS `.filter-row` |
| Chip kategori | Perpindahan kategori soal | `07-categories` |
| Review SRS | Sesi review, feedback, XP, streak, badge | `13-review`, `02-gamify-data` |
| Simulasi ujian | Timer, hasil per kategori, riwayat simulasi | `14-simulation` |
| Catatan | Editor rich-text, kategori catatan, buat soal dari catatan | `03-notes`, `16-ai` |
| Statistik | Ringkasan, lencana, kelemahan, kesiapan ujian | `15-stats`, `16-ai` |
| Lainnya | Tema, export/import, API key, reset data | `08-theme-io`, `16-ai` |
| Media | Gambar soal, opsi, dan pembahasan | `06-media`, `09-image-inputs` |
| Shell aplikasi | Navigasi, splash, toast, dan dialog | `index.html`, `17-main`, CSS |
| State terpusat | Store aplikasi dan accessor global | `01-state` |

## Data dan penyimpanan

Key utama di `localStorage`:

| Key | Isi |
|---|---|
| `cpns-wb-v6` | Soal, kategori, progres SRS, dan gamifikasi |
| `exambre-notes-v1` | Catatan dan kategori catatan |
| `exambre_sim_history` | Riwayat simulasi ujian |
| `exambre-theme` | Preferensi tema |
| `exambre_gemini_key` | API key Gemini |
| `exambre_custom_ai` | Konfigurasi provider AI kustom |
| `exambre_exam_date` | Tanggal target ujian |
| `exambre_sfx` | Preferensi efek suara |

Backup dan pemulihan dilakukan melalui export/import file JSON di tab **Lainnya**.

## Arsitektur

Aplikasi web berada di `www/` dan dibungkus Capacitor untuk Android. Tidak ada bundler atau framework frontend. JavaScript terdiri dari 16 modul classic-script yang dimuat berurutan dan berbagi state melalui objek `Store`.

Urutan pemuatan modul penting. Nomor `05` sengaja tidak digunakan karena modul cloud lama sudah dihapus.

```text
exambre/
├── www/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   └── assets/
│       ├── app.css
│       ├── js/
│       │   ├── 01-state.js
│       │   ├── ...
│       │   └── 17-main.js
│       ├── fonts/
│       ├── icons/
│       ├── icon/
│       └── sfx/
├── android/
├── .github/workflows/
├── package.json
└── README.md
```

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Native shell | Capacitor 6 untuk Android |
| Web/PWA | Service worker cache-first dan GitHub Pages |
| UI | CSS custom properties, Tabler Icons, font Inter, layout responsif |
| Logika | Vanilla JavaScript dengan 16 modul classic-script |
| AI | Gemini REST API dan provider OpenAI-compatible opsional |
| CI | GitHub Actions untuk APK release dan deploy web |

## Menjalankan

### Prasyarat

- Node.js 20
- Java 17 dan Android SDK 34 untuk build Android
- Android Studio opsional untuk menjalankan project native

### Perintah

```bash
npm install
npm run sync
npm run open
```

`npm run sync` menyalin `www/` ke project Android. `npm run open` membuka project di Android Studio.

### Tes cepat di browser

```bash
python3 -m http.server 8080 --directory www
```

Buka `http://localhost:8080`.

### Build APK manual

```bash
cd android
./gradlew assembleDebug
```

## Build APK

Setiap push ke `main` menjalankan workflow **Build Android APK** di GitHub Actions. APK release bertanda tangan tersedia di tab **Actions**, pada workflow terbaru, bagian **Artifacts**.

Signing release memerlukan secrets berikut:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Workflow terkait:

- `.github/workflows/build-android-apk.yml`
- `.github/workflows/deploy-web.yml`

## Privasi dan keamanan

- Exambre tidak memiliki akun pengguna, server aplikasi, atau pelacakan.
- Data belajar disimpan di perangkat melalui `localStorage`.
- Tidak ada sinkronisasi cloud; setiap perangkat memiliki data sendiri.
- Export backup JSON disarankan sebelum mengganti perangkat atau menghapus data browser.
- Fitur AI mengirim konten yang relevan ke provider pilihan pengguna. Kunci API disimpan secara lokal di perangkat.
- Konten HTML pengguna disanitasi sebelum dirender, dan data import dinormalisasi sebelum digunakan.

## Lisensi

MIT. Lihat [package.json](package.json).

## Tautan

- Aplikasi web: [rennoseptian.github.io/exambre](https://rennoseptian.github.io/exambre)
- Repositori: [github.com/rennoseptian/exambre](https://github.com/rennoseptian/exambre)
- Laporan bug: [github.com/rennoseptian/exambre/issues](https://github.com/rennoseptian/exambre/issues)
