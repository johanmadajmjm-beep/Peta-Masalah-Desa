# 🗺️ Peta Masalah Desa

Aplikasi lapangan berbasis web untuk mencatat dan memetakan masalah desa. Bekerja **offline-first**, mobile-first, ringan, dan siap diintegrasikan dengan Google Sheet + Google Drive sebagai backend.

---

## 📁 Struktur Project

```
peta-masalah-desa/
├── index.html                  ← SPA utama (semua halaman)
├── manifest.json               ← PWA manifest
├── assets/
│   ├── css/
│   │   └── style.css           ← Design system lengkap
│   ├── js/
│   │   ├── wilayah.js          ← Data wilayah + cascading dropdown
│   │   ├── storage.js          ← IndexedDB + localStorage manager
│   │   ├── sync.js             ← GPS, foto kompresi, sinkronisasi
│   │   ├── map.js              ← Leaflet/OpenStreetMap manager
│   │   └── app.js              ← SPA controller utama + Toast + Modal
│   ├── data/                   ← (opsional) JSON data wilayah per provinsi
│   │   ├── kabkota_11.json     ← Kabupaten Aceh
│   │   ├── kabkota_32.json     ← Kabupaten Jawa Barat
│   │   └── ...
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── google-apps-script/
    └── Code.gs                 ← Backend Apps Script (copy ke script.google.com)
```

---

## 🚀 Cara Deploy ke GitHub Pages

### 1. Buat Repository GitHub

```bash
git init
git add .
git commit -m "Initial commit — Peta Masalah Desa"
git remote add origin https://github.com/USERNAME/peta-masalah-desa.git
git push -u origin main
```

### 2. Aktifkan GitHub Pages

- Buka repository → Settings → Pages
- Source: **Deploy from a branch**
- Branch: `main` / folder `/` (root)
- Save → URL tersedia dalam 1-2 menit

### 3. Akses di HP

Buka URL: `https://USERNAME.github.io/peta-masalah-desa`

Untuk install sebagai PWA di Android:
- Buka Chrome → tap menu ⋮ → "Tambahkan ke Layar Utama"

---

## ⚙️ Setup Google Apps Script (Backend)

### Langkah 1 — Buat Google Sheet

1. Buka [sheets.google.com](https://sheets.google.com) → buat spreadsheet baru
2. Catat **ID Sheet** dari URL: `https://docs.google.com/spreadsheets/d/`**`[SHEET_ID]`**`/edit`

### Langkah 2 — Buat Folder Google Drive

1. Buka [drive.google.com](https://drive.google.com) → buat folder baru bernama "Foto Masalah Desa"
2. Catat **ID Folder** dari URL: `https://drive.google.com/drive/folders/`**`[FOLDER_ID]`**

### Langkah 3 — Deploy Apps Script

1. Buka [script.google.com](https://script.google.com) → New Project
2. Hapus semua kode → paste isi file `google-apps-script/Code.gs`
3. Edit konfigurasi di bagian atas:

```javascript
const CONFIG = {
  SHEET_ID:  'ID_GOOGLE_SHEET_ANDA',
  FOLDER_ID: 'ID_FOLDER_DRIVE_ANDA',
  API_TOKEN: 'buat_token_acak_yang_aman_contoh_abc123xyz',
  // ...
};
```

4. Jalankan sekali: **Run** → `setupSheetPermissions` (izinkan akses)
5. Deploy: **Deploy** → **New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy URL deployment

### Langkah 4 — Sambungkan ke Aplikasi

Edit file `assets/js/sync.js`:

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec';
const API_TOKEN       = 'token_yang_sama_dengan_di_Code.gs';
```

Push ke GitHub → aplikasi langsung terhubung.

---

## 📊 Struktur Google Sheet

Sheet akan dibuat otomatis dengan kolom:

| # | Kolom | Keterangan |
|---|-------|-----------|
| 1 | ID Data | PMD-XXXXX-XXXXX (unik) |
| 2 | Tanggal Input | YYYY-MM-DD |
| 3 | Waktu Input | HH:MM:SS |
| 4 | Nama Petugas | |
| 5 | Jabatan/Peran | |
| 6 | Nomor HP | |
| 7 | Provinsi | Nama provinsi |
| 8 | Kabupaten/Kota | |
| 9 | Kecamatan | |
| 10 | Desa/Kelurahan | |
| 11 | Dusun | Isi manual |
| 12 | Kampung | Isi manual |
| 13 | RT | |
| 14 | RW | |
| 15 | Latitude | Koordinat GPS |
| 16 | Longitude | |
| 17 | Akurasi GPS (m) | |
| 18 | Kategori Masalah | 18 kategori |
| 19 | Subkategori | |
| 20 | Judul Masalah | |
| 21 | Deskripsi | |
| 22 | Tingkat Urgensi | rendah/sedang/tinggi/darurat |
| 23 | Status Masalah | baru/tindak/selesai/eskalasi |
| 24 | Nama Warga | |
| 25 | NIK | Opsional |
| 26 | Jenis Kelamin | |
| 27 | Umur | |
| 28 | Kelompok Rentan | |
| 29 | Jumlah Terdampak | |
| 30 | Tindakan Awal | |
| 31 | Rekomendasi | |
| 32 | Instansi Terlibat | |
| 33 | Tanggal Rencana | |
| 34 | Catatan Tambahan | |
| 35 | Link Foto 1 | URL Google Drive |
| 36 | Link Foto 2 | |
| 37 | Link Foto 3 | |
| 38 | Status Sinkronisasi | terkirim |
| 39 | Created At | ISO timestamp |
| 40 | Updated At | |
| 41 | Sumber Perangkat | |

---

## 📁 Struktur Folder Google Drive

```
📁 Foto Masalah Desa/
└── 📁 Kabupaten Manggarai/
    └── 📁 Kecamatan Langke Rembong/
        └── 📁 Kelurahan Pitak/
            └── 📁 2025-01/
                ├── PMD-ABC123_foto1_1234567890.jpg
                ├── PMD-ABC123_foto2_1234567891.jpg
                └── PMD-DEF456_foto1_1234567892.jpg
```

---

## 📶 Mode Offline

Aplikasi bekerja **sepenuhnya offline**:

| Kondisi | Apa yang terjadi |
|---------|-----------------|
| Tanpa internet | Data tersimpan di IndexedDB perangkat |
| Internet kembali | Sinkronisasi otomatis dimulai |
| Gagal kirim | Retry otomatis hingga 3x |
| Tutup browser | Draft tersimpan, tidak ada data yang hilang |

---

## 🗺️ Data Wilayah

**Data yang sudah ada dalam aplikasi:**
- ✅ 34 Provinsi (lengkap)
- ✅ Kabupaten/Kota NTT (22 kab/kota, lengkap)
- ✅ Kecamatan Kabupaten Manggarai, Manggarai Timur, Manggarai Barat
- ✅ Beberapa desa/kelurahan contoh

**Menambah data wilayah provinsi lain:**

Buat file JSON di `assets/data/kabkota_[kode_provinsi].json`:

```json
[
  { "kode": "3201", "nama": "Kabupaten Bogor" },
  { "kode": "3202", "nama": "Kabupaten Sukabumi" }
]
```

Buat file `assets/data/kecamatan_[kode_kabkota].json`:

```json
[
  { "kode": "320101", "nama": "Kecamatan Cibinong" }
]
```

Sistem akan otomatis lazy-load saat dipilih. Data di-cache di localStorage untuk akses offline berikutnya.

**Sumber data resmi:**
- [data.kemendagri.go.id](https://data.kemendagri.go.id)
- [sig.bps.go.id](https://sig.bps.go.id) — BPS Master File Desa
- [inaGeoportal.ina.go.id](https://tanahair.indonesia.go.id)

---

## 🎨 Desain

- **Font:** Plus Jakarta Sans (display) + Inter (body)
- **Warna utama:** Hijau forest `#1D6B4E` — mencerminkan desa, lahan, alam
- **Warna aksen:** Amber `#F2A63A` — urgensi, highlight
- **Mobile-first** — dioptimalkan untuk layar 360–420px
- **Bottom navigation** dengan badge notifikasi
- **Dark mode** — belum diimplementasikan (bisa ditambahkan via `prefers-color-scheme`)

---

## 🔒 Keamanan

- Token API sederhana di header request (mencegah akses tidak sah)
- NIK tidak wajib dan tidak ditampilkan di tampilan publik
- Data foto di Google Drive hanya bisa diakses via link (tidak terindeks publik)
- Tidak ada database pihak ketiga berbayar

---

## 📱 Fitur Lengkap

| Fitur | Status |
|-------|--------|
| Input form 8 bagian | ✅ |
| Cascading wilayah | ✅ |
| GPS otomatis + manual | ✅ |
| Upload + kompresi foto | ✅ |
| Offline storage IndexedDB | ✅ |
| Auto-save draft | ✅ |
| Daftar data + filter | ✅ |
| Detail & edit data | ✅ |
| Hapus data lokal | ✅ |
| Peta Leaflet + marker | ✅ |
| Filter peta per urgensi | ✅ |
| Sinkronisasi ke Sheet | ✅ |
| Upload foto ke Drive | ✅ |
| Retry gagal sinkron | ✅ |
| Status koneksi realtime | ✅ |
| Toast notifikasi | ✅ |
| Modal konfirmasi | ✅ |
| Badge antrian sync | ✅ |
| PWA installable | ✅ |
| Kategori + subkategori | ✅ |
| Quick input dari beranda | ✅ |

---

## 🛠️ Pengembangan Lanjutan

**Dashboard Admin (terpisah):**
Baca data dari Google Sheet via Sheets API atau Apps Script, tampilkan:
- Peta agregat semua masalah
- Filter per wilayah, kategori, urgensi, waktu
- Export PDF laporan
- Statistik dan grafik tren

**Tambahan yang bisa dikembangkan:**
- Service Worker untuk full offline (termasuk peta cached)
- Push notification saat data baru masuk
- QR Code untuk berbagi data
- Export Excel dari aplikasi
- Multi-bahasa (Bahasa Daerah)

---

## 👨‍💻 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Storage | IndexedDB (primer) + localStorage |
| Peta | Leaflet.js + OpenStreetMap |
| Backend | Google Apps Script |
| Database | Google Sheets |
| File Storage | Google Drive |
| Hosting | GitHub Pages |
| Font | Google Fonts (Plus Jakarta Sans + Inter) |

**Tidak menggunakan:**
- Framework JS (React/Vue) — agar ringan di HP murah
- Database berbayar
- Server berbayar
- Firebase

---

*Dibangun untuk mendukung program CBR/BEN SCN Manggarai, NTT — namun dapat digunakan untuk program desa mana pun di Indonesia.*
