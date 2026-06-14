/**
 * wilayah.js
 * Cascading dropdown Kabupaten → Kecamatan → Desa/Kelurahan
 *
 * Sumber data  : Kepmendagri No. 300.2.2-2430 Tahun 2025
 * File data    : assets/data/wilayah.json  (JANGAN hardcode di sini)
 * Offline      : data di-cache di memory setelah fetch pertama
 *
 * API publik:
 *   WilayahManager.init()                   — wajib dipanggil sekali saat boot
 *   WilayahManager.initCascading(ids)       — pasang listener ke 3 select
 *   WilayahManager.restoreWilayah(data, ids)— isi ulang cascading dari data tersimpan
 *   WilayahManager.getMeta()                — { versi, sumber_data, tahun_data, ... }
 */

'use strict';

const WilayahManager = (() => {

  // ─── State ─────────────────────────────────────────────────────────────────
  let _data   = null;   // isi wilayah.json setelah load
  let _loaded = false;
  let _meta   = {};

  // ─── Load JSON (offline-first, cache memory) ───────────────────────────────
  async function _loadData() {
    if (_loaded) return _data;
    try {
      const res  = await fetch('assets/data/wilayah.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _data   = await res.json();
      _meta   = _data.meta || {};
      _loaded = true;
      console.log(`[Wilayah] Data dimuat: ${_meta.versi || '-'}`);
      return _data;
    } catch (err) {
      console.error('[Wilayah] Gagal memuat wilayah.json:', err);
      _data   = { meta: {}, kabupaten: [] };
      _loaded = true;
      return _data;
    }
  }

  // ─── Helper: bersihkan & isi <select> ──────────────────────────────────────
  function _resetSelect(el, placeholder) {
    el.innerHTML = `<option value="">${placeholder}</option>`;
    el.disabled  = true;
  }

  function _fillSelect(el, items, valKey, labelFn) {
    el.innerHTML = `<option value="">-- Pilih --</option>`;
    items.forEach(item => {
      const opt   = document.createElement('option');
      opt.value   = item[valKey];
      opt.dataset.nama = typeof labelFn === 'function' ? labelFn(item) : item.nama;
      opt.textContent  = opt.dataset.nama;
      el.appendChild(opt);
    });
    el.disabled = false;
  }

  // ─── Init cascading dropdown ───────────────────────────────────────────────
  // ids = { kab, kec, desa }  (nilai adalah ID elemen <select>)
  async function initCascading(ids = {}) {
    const selKab  = document.getElementById(ids.kab  || 'inp-kabkota');
    const selKec  = document.getElementById(ids.kec  || 'inp-kecamatan');
    const selDesa = document.getElementById(ids.desa || 'inp-desa');

    if (!selKab || !selKec || !selDesa) {
      console.warn('[Wilayah] Elemen select tidak ditemukan:', ids);
      return;
    }

    // Pastikan data sudah dimuat
    await _loadData();

    // Isi kabupaten
    _fillSelect(selKab, _data.kabupaten, 'kode_kemendagri', d => d.nama);
    _resetSelect(selKec,  '-- Pilih Kecamatan --');
    _resetSelect(selDesa, '-- Pilih Desa/Kelurahan --');

    // Tampilkan info versi data
    _showVersi(ids.kab);

    // Listener: kab → kec
    selKab.addEventListener('change', () => {
      _resetSelect(selKec,  '-- Pilih Kecamatan --');
      _resetSelect(selDesa, '-- Pilih Desa/Kelurahan --');
      if (!selKab.value) return;

      const kab = _data.kabupaten.find(k => k.kode_kemendagri === selKab.value);
      if (!kab) return;
      _fillSelect(selKec, kab.kecamatan, 'kode_kemendagri', d => d.nama);
    });

    // Listener: kec → desa
    selKec.addEventListener('change', () => {
      _resetSelect(selDesa, '-- Pilih Desa/Kelurahan --');
      if (!selKec.value || !selKab.value) return;

      const kab = _data.kabupaten.find(k => k.kode_kemendagri === selKab.value);
      if (!kab) return;
      const kec = kab.kecamatan.find(k => k.kode_kemendagri === selKec.value);
      if (!kec) return;
      _fillSelect(selDesa, kec.desa, 'kode_kemendagri',
        d => `${d.jenis_wilayah} ${d.nama}`);
    });
  }

  // ─── Restore cascading dari data tersimpan ─────────────────────────────────
  // data = { kode_kabkota, kode_kecamatan, kode_desa }
  async function restoreWilayah(data, ids = {}) {
    const selKab  = document.getElementById(ids.kab  || 'inp-kabkota');
    const selKec  = document.getElementById(ids.kec  || 'inp-kecamatan');
    const selDesa = document.getElementById(ids.desa || 'inp-desa');
    if (!selKab || !selKec || !selDesa || !data) return;

    await _loadData();

    // Isi kabupaten dulu
    _fillSelect(selKab, _data.kabupaten, 'kode_kemendagri', d => d.nama);
    selKab.value = data.kode_kabkota || '';

    // Isi kecamatan
    const kab = _data.kabupaten.find(k => k.kode_kemendagri === data.kode_kabkota);
    if (kab) {
      _fillSelect(selKec, kab.kecamatan, 'kode_kemendagri', d => d.nama);
      selKec.value = data.kode_kecamatan || '';

      // Isi desa
      const kec = kab.kecamatan.find(k => k.kode_kemendagri === data.kode_kecamatan);
      if (kec) {
        _fillSelect(selDesa, kec.desa, 'kode_kemendagri',
          d => `${d.jenis_wilayah} ${d.nama}`);
        selDesa.value = data.kode_desa || '';
      }
    }
  }

  // ─── Helper: ambil nama dari value select ──────────────────────────────────
  function _getSelectedText(selectEl) {
    if (!selectEl || !selectEl.value) return '';
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? (opt.dataset.nama || opt.textContent) : '';
  }

  // ─── Ambil object wilayah lengkap dari state dropdown saat ini ─────────────
  function getSelectedWilayah(ids = {}) {
    const selKab  = document.getElementById(ids.kab  || 'inp-kabkota');
    const selKec  = document.getElementById(ids.kec  || 'inp-kecamatan');
    const selDesa = document.getElementById(ids.desa || 'inp-desa');
    return {
      kode_kabkota:   selKab?.value  || '',
      nama_kabkota:   _getSelectedText(selKab),
      kode_kecamatan: selKec?.value  || '',
      nama_kecamatan: _getSelectedText(selKec),
      kode_desa:      selDesa?.value || '',
      nama_desa:      _getSelectedText(selDesa)?.replace(/^(Desa|Kelurahan)\s+/, '') || '',
      jenis_desa:     selDesa?.value?.split('.')[3]?.startsWith('1') ? 'Kelurahan' : 'Desa',
    };
  }

  // ─── Tampilkan versi data (opsional) ───────────────────────────────────────
  function _showVersi(kabId) {
    const label = document.getElementById('wilayah-versi');
    if (label && _meta.versi) {
      label.textContent = `Sumber: ${_meta.versi}`;
    }
  }

  function getMeta() { return { ..._meta }; }

  // ─── Init (preload saat boot) ──────────────────────────────────────────────
  async function init() {
    await _loadData();
  }

  return { init, initCascading, restoreWilayah, getSelectedWilayah, getMeta };

})();
