/**
 * gps.js — Manajemen GPS dan geolokasi
 */
'use strict';

const GPSManager = (() => {
  let _watchId = null;
  let _lastPosition = null;

  function getPosition(opts = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolokasi tidak didukung di perangkat ini.'));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
        ...opts,
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          _lastPosition = {
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  Math.round(pos.coords.accuracy),
            altitude:  pos.coords.altitude,
            timestamp: new Date().toISOString(),
          };
          resolve(_lastPosition);
        },
        (err) => {
          let msg = 'Gagal mendapatkan lokasi.';
          if (err.code === 1) msg = 'Izin lokasi ditolak. Aktifkan lokasi di pengaturan browser.';
          if (err.code === 2) msg = 'Lokasi tidak tersedia. Pastikan GPS aktif.';
          if (err.code === 3) msg = 'Waktu habis. Coba lagi atau input koordinat manual.';
          reject(new Error(msg));
        },
        options
      );
    });
  }

  function getLastPosition() { return _lastPosition; }

  function formatCoords(lat, lng) {
    if (!lat || !lng) return 'Koordinat belum diambil';
    const latDir = lat >= 0 ? 'LU' : 'LS';
    const lngDir = lng >= 0 ? 'BT' : 'BB';
    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
  }

  function getAccuracyLabel(accuracy) {
    if (!accuracy) return '';
    if (accuracy <= 5)   return `±${accuracy}m (Sangat Akurat)`;
    if (accuracy <= 20)  return `±${accuracy}m (Akurat)`;
    if (accuracy <= 50)  return `±${accuracy}m (Cukup Akurat)`;
    if (accuracy <= 100) return `±${accuracy}m (Kurang Akurat)`;
    return `±${accuracy}m (Tidak Akurat — coba di luar ruangan)`;
  }

  return { getPosition, getLastPosition, formatCoords, getAccuracyLabel };
})();

window.GPSManager = GPSManager;


/**
 * photo.js — Kompresi dan manajemen foto
 */
const PhotoManager = (() => {
  const MAX_WIDTH  = 1280;
  const MAX_HEIGHT = 960;
  const QUALITY    = 0.75;

  // Kompres gambar menggunakan Canvas API
  function compressImage(file, maxWidth = MAX_WIDTH, maxHeight = MAX_HEIGHT, quality = QUALITY) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('File bukan gambar.'));
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;

        img.onload = () => {
          let { width, height } = img;

          // Hitung dimensi baru
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width  = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width  = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Output sebagai base64 JPEG
          const compressed = canvas.toDataURL('image/jpeg', quality);
          const sizeKB = Math.round((compressed.length * 3) / 4 / 1024);

          resolve({
            base64:    compressed,
            dataUrl:   compressed,
            sizeKB,
            width,
            height,
            original:  file.name,
          });
        };

        img.onerror = () => reject(new Error('Gagal memuat gambar.'));
      };

      reader.onerror = () => reject(new Error('Gagal membaca file.'));
    });
  }

  // Buat nama file unik untuk foto di Google Drive
  function buildFileName(masalahId, index) {
    const ts = Date.now();
    return `PMD_${masalahId}_foto${index + 1}_${ts}.jpg`;
  }

  // Ekstrak base64 pure dari dataUrl
  function dataUrlToBase64(dataUrl) {
    return dataUrl.split(',')[1] || dataUrl;
  }

  return { compressImage, buildFileName, dataUrlToBase64 };
})();

window.PhotoManager = PhotoManager;


/**
 * sync.js — Sinkronisasi data ke Google Apps Script
 */
const SyncManager = (() => {

  // ⚠️ GANTI dengan URL Apps Script Anda setelah deploy
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwU9nThoMLcy7XKDuKv7g_NYg9_ifmFtNxqZl03e1kAvZ9x7T58feKinEQ7Ok3kdr1h/exec';
  const API_TOKEN       = 'pmd-scn-manggarai-2026'; // Harus sama dengan di Code.gs
  const MAX_RETRIES     = 3;
  const RETRY_DELAY_MS  = 3000;

  let _isSyncing = false;
  let _onlineStatus = navigator.onLine;

  // ─── Deteksi koneksi ───────────────────────────────────────────────────
  window.addEventListener('online',  () => { _onlineStatus = true;  onConnectionChange(true); });
  window.addEventListener('offline', () => { _onlineStatus = false; onConnectionChange(false); });

  function isOnline() { return _onlineStatus && navigator.onLine; }

  function onConnectionChange(online) {
    // Update UI
    document.querySelectorAll('[data-conn-status]').forEach(el => {
      el.textContent = online ? 'Online' : 'Offline';
      el.className = online ? 'conn-dot online' : 'conn-dot offline';
    });
    document.querySelectorAll('[data-conn-text]').forEach(el => {
      el.textContent = online ? 'Terhubung ke Internet' : 'Tidak Ada Koneksi';
    });

    if (online) {
      Toast.show('Koneksi internet tersedia. Sinkronisasi otomatis...', 'success');
      setTimeout(() => syncAll(), 1500);
    } else {
      Toast.show('Koneksi terputus. Data disimpan offline.', 'warning');
    }
  }

  // ─── Kirim satu masalah (adopsi pola TaniMap) ────────────────────────
  //
  // STEP 1: Kirim data teks via POST text/plain → baca response JSON
  // STEP 2: Kirim foto satu per satu via POST no-cors → fire & forget
  //
  // Dua endpoint terpisah di Apps Script:
  //   doPost() action='simpan_masalah' → terima data teks
  //   doPost() action='upload_foto'    → terima foto, simpan ke Drive
  //
  async function sendMasalah(masalah) {

    // ── STEP 1: Kirim data teks (tanpa foto base64) ──────────────────
    const payload = { ...masalah };
    // Hapus foto base64 dari payload teks — dikirim terpisah
    delete payload.foto_1_base64;
    delete payload.foto_2_base64;
    delete payload.foto_3_base64;
    // Hapus juga foto yang mungkin sudah di-embed langsung
    delete payload.foto_1;
    delete payload.foto_2;
    delete payload.foto_3;

    payload.action = 'simpan_masalah';
    payload.token  = API_TOKEN;

    // POST dengan Content-Type: text/plain → tidak trigger CORS preflight
    // Apps Script membaca via e.postData.contents di doPost()
    const response = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Apps Script error');

    // ── STEP 2: Kirim foto terpisah (fire & forget, no-cors) ─────────
    // Sama persis dengan pola TaniMap — tidak perlu baca response foto
    const fotoSlots = [
      { data: masalah.foto_1_base64, index: 0 },
      { data: masalah.foto_2_base64, index: 1 },
      { data: masalah.foto_3_base64, index: 2 },
    ];

    for (const slot of fotoSlots) {
      if (!slot.data) continue;
      try {
        const base64pure = PhotoManager.dataUrlToBase64(slot.data);
        const filename   = PhotoManager.buildFileName(masalah.id, slot.index);
        await fetch(APPS_SCRIPT_URL, {
          method:  'POST',
          mode:    'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body:    JSON.stringify({
            action:       'upload_foto',
            token:        API_TOKEN,
            masalah_id:   masalah.id,
            nama_file:    filename,
            base64:       base64pure,
            mime_type:    'image/jpeg',
            nama_kabkota: masalah.nama_kabkota  || '',
            nama_kec:     masalah.nama_kecamatan || '',
            nama_desa:    masalah.nama_desa      || '',
          }),
        });
        // no-cors = opaque response, tidak bisa dibaca — ini normal dan aman
      } catch(e) {
        // Foto gagal tidak menggagalkan keseluruhan sync data teks
        console.warn('[Sync] Foto gagal dikirim:', e.message);
      }
    }

    return result;
  }

  // ─── Sinkronisasi semua yang belum terkirim ───────────────────────────
  async function syncAll() {
    if (_isSyncing) return;
    if (!isOnline()) {
      Toast.show('Tidak ada koneksi. Sinkronisasi dibatalkan.', 'warning');
      return;
    }

    _isSyncing = true;
    updateSyncUI('syncing');

    try {
      const queue = await StorageManager.getQueue();
      if (queue.length === 0) {
        updateSyncUI('idle');
        _isSyncing = false;
        return;
      }

      let berhasil = 0, gagal = 0;

      for (const qItem of queue) {
        if (qItem.attempts >= MAX_RETRIES) {
          await StorageManager.updateSyncStatus(qItem.id, 'gagal');
          gagal++;
          continue;
        }

        const masalah = await StorageManager.getMasalah(qItem.id);
        if (!masalah) {
          await StorageManager.removeFromQueue(qItem.id);
          continue;
        }

        try {
          await StorageManager.incrementAttempt(qItem.id);
          const result = await sendMasalah(masalah);

          // Berhasil
          await StorageManager.updateSyncStatus(
            qItem.id,
            'terkirim',
            [result.link_foto_1, result.link_foto_2, result.link_foto_3].filter(Boolean)
          );
          await StorageManager.removeFromQueue(qItem.id);
          berhasil++;

        } catch(err) {
          await StorageManager.setQueueError(qItem.id, err.message);
          await StorageManager.updateSyncStatus(qItem.id, 'menunggu');
          gagal++;
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      if (berhasil > 0) Toast.show(`${berhasil} data berhasil dikirim.`, 'success');
      if (gagal > 0)    Toast.show(`${gagal} data gagal. Coba lagi nanti.`, 'error');

    } catch(err) {
      console.error('[Sync] Error:', err);
      Toast.show('Sinkronisasi gagal: ' + err.message, 'error');
    }

    _isSyncing = false;
    updateSyncUI('idle');

    // Refresh stats
    if (window.AppState) AppState.refreshStats();
  }

  // ─── UI sync state ─────────────────────────────────────────────────────
  function updateSyncUI(state) {
    const btn = document.getElementById('btn-sync-now');
    if (!btn) return;
    if (state === 'syncing') {
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner"></span> Menyinkronkan...`;
    } else {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg> Sinkronkan Sekarang`;
    }
  }

  function isSyncing() { return _isSyncing; }

  // ─── Auto-sync saat online ─────────────────────────────────────────────
  async function init() {
    if (isOnline()) {
      const queue = await StorageManager.getQueue();
      if (queue.length > 0) {
        setTimeout(() => syncAll(), 2000);
      }
    }
  }

  return { syncAll, isOnline, isSyncing, init };
})();

window.SyncManager = SyncManager;
