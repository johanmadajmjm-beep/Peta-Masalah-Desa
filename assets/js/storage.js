/**
 * storage.js
 * Manajemen penyimpanan data offline menggunakan IndexedDB (primer)
 * dan localStorage (fallback + cache ringan).
 *
 * Struktur:
 * - DB: PetaMasalahDesa (v1)
 * - Store: masalah  (data utama)
 * - Store: queue    (antrian sinkronisasi)
 * - Store: petugas  (cache data petugas)
 * - Store: draft    (draft form aktif)
 */

'use strict';

const StorageManager = (() => {

  const DB_NAME    = 'PetaMasalahDesa';
  const DB_VERSION = 1;
  let _db          = null;

  // ─── Buka / inisialisasi IndexedDB ──────────────────────────────────────
  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Store masalah
        if (!db.objectStoreNames.contains('masalah')) {
          const store = db.createObjectStore('masalah', { keyPath: 'id' });
          store.createIndex('status_sync', 'status_sync', { unique: false });
          store.createIndex('kategori', 'kategori', { unique: false });
          store.createIndex('urgensi', 'urgensi', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          store.createIndex('kode_desa', 'kode_desa', { unique: false });
        }

        // Store queue sinkronisasi
        if (!db.objectStoreNames.contains('queue')) {
          const qStore = db.createObjectStore('queue', { keyPath: 'id' });
          qStore.createIndex('attempts', 'attempts', { unique: false });
          qStore.createIndex('queued_at', 'queued_at', { unique: false });
        }

        // Store petugas (cache)
        if (!db.objectStoreNames.contains('petugas')) {
          db.createObjectStore('petugas', { keyPath: 'id', autoIncrement: true });
        }

        // Store draft form aktif
        if (!db.objectStoreNames.contains('draft')) {
          db.createObjectStore('draft', { keyPath: 'key' });
        }
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ─── Generic CRUD helpers ────────────────────────────────────────────────
  function _tx(storeName, mode = 'readonly') {
    return _db.transaction([storeName], mode).objectStore(storeName);
  }

  function _idbGet(storeName, key) {
    return new Promise((resolve, reject) => {
      openDB().then(() => {
        const req = _tx(storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => reject(req.error);
      });
    });
  }

  function _idbPut(storeName, data) {
    return new Promise((resolve, reject) => {
      openDB().then(() => {
        const req = _tx(storeName, 'readwrite').put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
    });
  }

  function _idbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      openDB().then(() => {
        const req = _tx(storeName, 'readwrite').delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => reject(req.error);
      });
    });
  }

  function _idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      openDB().then(() => {
        const req = _tx(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
      });
    });
  }

  function _idbGetByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      openDB().then(() => {
        const idx = _tx(storeName).index(indexName);
        const req = idx.getAll(value);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
      });
    });
  }

  // ─── ID Generator ────────────────────────────────────────────────────────
  function generateID() {
    const now  = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `PMD-${now}-${rand}`;
  }

  // ─── MASALAH ─────────────────────────────────────────────────────────────
  async function saveMasalah(data) {
    const now = new Date().toISOString();
    const item = {
      ...data,
      id: data.id || generateID(),
      created_at: data.created_at || now,
      updated_at: now,
      status_sync: data.status_sync || 'belum',
    };
    await _idbPut('masalah', item);
    return item;
  }

  async function getMasalah(id) {
    return _idbGet('masalah', id);
  }

  async function getAllMasalah() {
    const all = await _idbGetAll('masalah');
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async function getMasalahByStatus(status) {
    return _idbGetByIndex('masalah', 'status_sync', status);
  }

  async function deleteMasalah(id) {
    return _idbDelete('masalah', id);
  }

  async function updateSyncStatus(id, status, linkFoto = null) {
    const item = await getMasalah(id);
    if (!item) return null;
    item.status_sync = status;
    item.updated_at  = new Date().toISOString();
    if (linkFoto) {
      item.link_foto_1 = linkFoto[0] || item.link_foto_1;
      item.link_foto_2 = linkFoto[1] || item.link_foto_2;
      item.link_foto_3 = linkFoto[2] || item.link_foto_3;
    }
    await _idbPut('masalah', item);
    return item;
  }

  // ─── QUEUE SINKRONISASI ──────────────────────────────────────────────────
  async function addToQueue(masalahId) {
    const item = await getMasalah(masalahId);
    if (!item) return;

    await _idbPut('queue', {
      id:         masalahId,
      queued_at:  new Date().toISOString(),
      attempts:   0,
      last_error: null,
    });
    await updateSyncStatus(masalahId, 'menunggu');
  }

  async function getQueue() {
    return _idbGetAll('queue');
  }

  async function removeFromQueue(id) {
    return _idbDelete('queue', id);
  }

  async function incrementAttempt(id) {
    const item = await _idbGet('queue', id);
    if (!item) return;
    item.attempts++;
    item.last_attempt = new Date().toISOString();
    await _idbPut('queue', item);
  }

  async function setQueueError(id, error) {
    const item = await _idbGet('queue', id);
    if (!item) return;
    item.last_error = error;
    item.last_attempt = new Date().toISOString();
    await _idbPut('queue', item);
  }

  // ─── DRAFT ───────────────────────────────────────────────────────────────
  async function saveDraft(key, data) {
    await _idbPut('draft', {
      key,
      data,
      saved_at: new Date().toISOString()
    });
  }

  async function getDraft(key) {
    const record = await _idbGet('draft', key);
    return record ? record.data : null;
  }

  async function clearDraft(key) {
    return _idbDelete('draft', key);
  }

  // ─── PETUGAS (cache) ─────────────────────────────────────────────────────
  async function savePetugas(data) {
    // Simpan juga ke localStorage untuk akses cepat
    try { localStorage.setItem('petugas_terakhir', JSON.stringify(data)); } catch(e) {}
    return _idbPut('petugas', { ...data, id: 1 }); // single record
  }

  function getPetugasTerakhir() {
    try {
      const raw = localStorage.getItem('petugas_terakhir');
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  // ─── Statistik ringkasan ─────────────────────────────────────────────────
  async function getStats() {
    const all = await getAllMasalah();
    const stats = {
      total:    all.length,
      belum:    0,
      menunggu: 0,
      terkirim: 0,
      gagal:    0,
      darurat:  0,
      tinggi:   0,
      kategori: {},
    };

    all.forEach(item => {
      // Sync status
      if (item.status_sync === 'belum')    stats.belum++;
      if (item.status_sync === 'menunggu') stats.menunggu++;
      if (item.status_sync === 'terkirim') stats.terkirim++;
      if (item.status_sync === 'gagal')    stats.gagal++;

      // Urgensi
      if (item.urgensi === 'darurat') stats.darurat++;
      if (item.urgensi === 'tinggi')  stats.tinggi++;

      // Kategori
      if (item.kategori) {
        stats.kategori[item.kategori] = (stats.kategori[item.kategori] || 0) + 1;
      }
    });

    return stats;
  }

  // ─── Export semua data sebagai JSON ─────────────────────────────────────
  async function exportData() {
    const all = await getAllMasalah();
    return JSON.stringify(all, null, 2);
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  async function init() {
    try {
      await openDB();
      console.log('[Storage] IndexedDB ready.');
      return true;
    } catch(e) {
      console.warn('[Storage] IndexedDB gagal, fallback ke localStorage:', e);
      return false;
    }
  }

  return {
    init, generateID,
    saveMasalah, getMasalah, getAllMasalah, getMasalahByStatus,
    deleteMasalah, updateSyncStatus,
    addToQueue, getQueue, removeFromQueue, incrementAttempt, setQueueError,
    saveDraft, getDraft, clearDraft,
    savePetugas, getPetugasTerakhir,
    getStats, exportData,
  };
})();

window.StorageManager = StorageManager;
