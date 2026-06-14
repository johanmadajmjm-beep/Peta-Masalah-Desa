/**
 * wilayah.js
 * Data wilayah Indonesia berdasarkan kode BPS/Kemendagri.
 * Struktur: Provinsi → Kabupaten/Kota → Kecamatan → Desa/Kelurahan
 *
 * CATATAN IMPLEMENTASI:
 * Data lengkap seluruh Indonesia sangat besar (~5MB+).
 * Strategi yang digunakan:
 * 1. Data Provinsi dan Kabupaten/Kota: dimuat langsung (file kecil)
 * 2. Data Kecamatan dan Desa: lazy-load via fetch dari JSON terpisah,
 *    atau fallback ke cache IndexedDB jika offline.
 *
 * Untuk deploy, sediakan file JSON di:
 *   /assets/data/kecamatan_{kode_kab}.json
 *   /assets/data/desa_{kode_kec}.json
 *
 * Sumber data: data.kemendagri.go.id, BPS Master File Desa 2023
 */

'use strict';

const WilayahManager = (() => {

  // ─── Data Provinsi (34 Provinsi, kode BPS) ───────────────────────────────
  const PROVINSI = [
    { kode: '11', nama: 'Aceh' },
    { kode: '12', nama: 'Sumatera Utara' },
    { kode: '13', nama: 'Sumatera Barat' },
    { kode: '14', nama: 'Riau' },
    { kode: '15', nama: 'Jambi' },
    { kode: '16', nama: 'Sumatera Selatan' },
    { kode: '17', nama: 'Bengkulu' },
    { kode: '18', nama: 'Lampung' },
    { kode: '19', nama: 'Kepulauan Bangka Belitung' },
    { kode: '21', nama: 'Kepulauan Riau' },
    { kode: '31', nama: 'DKI Jakarta' },
    { kode: '32', nama: 'Jawa Barat' },
    { kode: '33', nama: 'Jawa Tengah' },
    { kode: '34', nama: 'DI Yogyakarta' },
    { kode: '35', nama: 'Jawa Timur' },
    { kode: '36', nama: 'Banten' },
    { kode: '51', nama: 'Bali' },
    { kode: '52', nama: 'Nusa Tenggara Barat' },
    { kode: '53', nama: 'Nusa Tenggara Timur' },
    { kode: '61', nama: 'Kalimantan Barat' },
    { kode: '62', nama: 'Kalimantan Tengah' },
    { kode: '63', nama: 'Kalimantan Selatan' },
    { kode: '64', nama: 'Kalimantan Timur' },
    { kode: '65', nama: 'Kalimantan Utara' },
    { kode: '71', nama: 'Sulawesi Utara' },
    { kode: '72', nama: 'Sulawesi Tengah' },
    { kode: '73', nama: 'Sulawesi Selatan' },
    { kode: '74', nama: 'Sulawesi Tenggara' },
    { kode: '75', nama: 'Gorontalo' },
    { kode: '76', nama: 'Sulawesi Barat' },
    { kode: '81', nama: 'Maluku' },
    { kode: '82', nama: 'Maluku Utara' },
    { kode: '91', nama: 'Papua Barat' },
    { kode: '92', nama: 'Papua' },
  ];

  // ─── Kabupaten/Kota per Provinsi ─────────────────────────────────────────
  // Disertakan data lengkap untuk Provinsi NTT (kode 53) karena relevan
  // dengan konteks penggunaan SCN Manggarai. Provinsi lain tersedia via API.
  const KABKOTA = {
    '53': [
      { kode: '5301', nama: 'Kabupaten Sumba Barat' },
      { kode: '5302', nama: 'Kabupaten Sumba Timur' },
      { kode: '5303', nama: 'Kabupaten Kupang' },
      { kode: '5304', nama: 'Kabupaten Timor Tengah Selatan' },
      { kode: '5305', nama: 'Kabupaten Timor Tengah Utara' },
      { kode: '5306', nama: 'Kabupaten Belu' },
      { kode: '5307', nama: 'Kabupaten Alor' },
      { kode: '5308', nama: 'Kabupaten Lembata' },
      { kode: '5309', nama: 'Kabupaten Flores Timur' },
      { kode: '5310', nama: 'Kabupaten Sikka' },
      { kode: '5311', nama: 'Kabupaten Ende' },
      { kode: '5312', nama: 'Kabupaten Ngada' },
      { kode: '5313', nama: 'Kabupaten Manggarai' },
      { kode: '5314', nama: 'Kabupaten Rote Ndao' },
      { kode: '5315', nama: 'Kabupaten Manggarai Barat' },
      { kode: '5316', nama: 'Kabupaten Sumba Tengah' },
      { kode: '5317', nama: 'Kabupaten Sumba Barat Daya' },
      { kode: '5318', nama: 'Kabupaten Nagekeo' },
      { kode: '5319', nama: 'Kabupaten Manggarai Timur' },
      { kode: '5320', nama: 'Kabupaten Sabu Raijua' },
      { kode: '5321', nama: 'Kabupaten Malaka' },
      { kode: '5371', nama: 'Kota Kupang' },
    ],
  };

  // ─── Kecamatan per Kabupaten (NTT — Kabupaten Manggarai 5313) ────────────
  const KECAMATAN = {
    '5313': [
      { kode: '531301', nama: 'Langke Rembong' },
      { kode: '531302', nama: 'Wae Ri\'i' },
      { kode: '531303', nama: 'Rahong Utara' },
      { kode: '531304', nama: 'Cibal' },
      { kode: '531305', nama: 'Ruteng' },
      { kode: '531306', nama: 'Lelak' },
      { kode: '531307', nama: 'Reok' },
      { kode: '531308', nama: 'Reok Barat' },
      { kode: '531309', nama: 'Satar Mese' },
      { kode: '531310', nama: 'Satar Mese Barat' },
      { kode: '531311', nama: 'Satar Mese Utara' },
      { kode: '531312', nama: 'Cibal Barat' },
    ],
    '5319': [
      { kode: '531901', nama: 'Borong' },
      { kode: '531902', nama: 'Kota Komba' },
      { kode: '531903', nama: 'Lamba Leda' },
      { kode: '531904', nama: 'Poco Ranaka' },
      { kode: '531905', nama: 'Elar' },
      { kode: '531906', nama: 'Sambi Rampas' },
      { kode: '531907', nama: 'Poco Ranaka Timur' },
      { kode: '531908', nama: 'Lamba Leda Selatan' },
      { kode: '531909', nama: 'Lamba Leda Timur' },
      { kode: '531910', nama: 'Kota Komba Utara' },
      { kode: '531911', nama: 'Elar Selatan' },
    ],
    '5315': [
      { kode: '531501', nama: 'Komodo' },
      { kode: '531502', nama: 'Sano Nggoang' },
      { kode: '531503', nama: 'Lembor' },
      { kode: '531504', nama: 'Welak' },
      { kode: '531505', nama: 'Kuwus' },
      { kode: '531506', nama: 'Macang Pacar' },
      { kode: '531507', nama: 'Mbeliling' },
      { kode: '531508', nama: 'Lembor Selatan' },
      { kode: '531509', nama: 'Pacar' },
      { kode: '531510', nama: 'Kuwus Barat' },
    ],
  };

  // ─── Desa/Kelurahan (contoh untuk Kecamatan Langke Rembong) ─────────────
  const DESA = {
    '531301': [
      { kode: '5313010001', nama: 'Kelurahan Pitak', tipe: 'Kelurahan' },
      { kode: '5313010002', nama: 'Kelurahan Pau', tipe: 'Kelurahan' },
      { kode: '5313010003', nama: 'Kelurahan Carep', tipe: 'Kelurahan' },
      { kode: '5313010004', nama: 'Kelurahan Mbaumuku', tipe: 'Kelurahan' },
      { kode: '5313010005', nama: 'Kelurahan Karot', tipe: 'Kelurahan' },
      { kode: '5313010006', nama: 'Kelurahan Tenda', tipe: 'Kelurahan' },
      { kode: '5313010007', nama: 'Kelurahan Watu', tipe: 'Kelurahan' },
      { kode: '5313010008', nama: 'Kelurahan Lawir', tipe: 'Kelurahan' },
      { kode: '5313010009', nama: 'Kelurahan Bangka Kota', tipe: 'Kelurahan' },
      { kode: '5313010010', nama: 'Kelurahan Colol', tipe: 'Kelurahan' },
    ],
    '531305': [
      { kode: '5313050001', nama: 'Desa Golo Sengang', tipe: 'Desa' },
      { kode: '5313050002', nama: 'Desa Poco Ruteng', tipe: 'Desa' },
      { kode: '5313050003', nama: 'Desa Pong Leko', tipe: 'Desa' },
      { kode: '5313050004', nama: 'Desa Golo Loni', tipe: 'Desa' },
      { kode: '5313050005', nama: 'Desa Compang Ruteng', tipe: 'Desa' },
    ],
  };

  // ─── Cache lokal (IndexedDB wrapper sederhana) ───────────────────────────
  let _cache = {};

  function _toCache(key, data) {
    _cache[key] = data;
    try { localStorage.setItem('wilayah_cache_' + key, JSON.stringify(data)); } catch(e) {}
  }

  function _fromCache(key) {
    if (_cache[key]) return _cache[key];
    try {
      const raw = localStorage.getItem('wilayah_cache_' + key);
      if (raw) { _cache[key] = JSON.parse(raw); return _cache[key]; }
    } catch(e) {}
    return null;
  }

  // ─── Lazy-load dari file JSON eksternal ──────────────────────────────────
  async function _fetchWilayah(type, kode) {
    const cacheKey = `${type}_${kode}`;
    const cached = _fromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `./assets/data/${type}_${kode}.json`;
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      _toCache(cacheKey, data);
      return data;
    } catch(e) {
      return null;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  function getProvinsi() { return PROVINSI; }

  async function getKabkota(kodeProvinsi) {
    if (KABKOTA[kodeProvinsi]) return KABKOTA[kodeProvinsi];
    const fetched = await _fetchWilayah('kabkota', kodeProvinsi);
    if (fetched) { KABKOTA[kodeProvinsi] = fetched; return fetched; }
    return [];
  }

  async function getKecamatan(kodeKabkota) {
    if (KECAMATAN[kodeKabkota]) return KECAMATAN[kodeKabkota];
    const fetched = await _fetchWilayah('kecamatan', kodeKabkota);
    if (fetched) { KECAMATAN[kodeKabkota] = fetched; return fetched; }
    return [];
  }

  async function getDesa(kodeKecamatan) {
    if (DESA[kodeKecamatan]) return DESA[kodeKecamatan];
    const fetched = await _fetchWilayah('desa', kodeKecamatan);
    if (fetched) { DESA[kodeKecamatan] = fetched; return fetched; }
    return [];
  }

  // ─── Populate dropdown helper ────────────────────────────────────────────
  function _populateSelect(selectEl, items, valueKey, labelKey, placeholder) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item[valueKey];
      opt.textContent = item[labelKey];
      selectEl.appendChild(opt);
    });
    selectEl.disabled = items.length === 0;
  }

  function _resetSelect(selectEl, placeholder) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    selectEl.disabled = true;
  }

  // ─── Initialize cascading dropdowns ─────────────────────────────────────
  function initCascading(config) {
    const {
      selProvinsi, selKabkota, selKecamatan, selDesa,
      onDesaChange
    } = config;

    // Isi provinsi
    _populateSelect(selProvinsi, PROVINSI, 'kode', 'nama', '— Pilih Provinsi —');
    _resetSelect(selKabkota, '— Pilih Kab/Kota —');
    _resetSelect(selKecamatan, '— Pilih Kecamatan —');
    _resetSelect(selDesa, '— Pilih Desa/Kelurahan —');

    selProvinsi.addEventListener('change', async () => {
      const kode = selProvinsi.value;
      _resetSelect(selKabkota, 'Memuat...');
      _resetSelect(selKecamatan, '— Pilih Kecamatan —');
      _resetSelect(selDesa, '— Pilih Desa/Kelurahan —');

      if (!kode) {
        _resetSelect(selKabkota, '— Pilih Kab/Kota —');
        return;
      }

      const data = await getKabkota(kode);
      _populateSelect(selKabkota, data, 'kode', 'nama', '— Pilih Kab/Kota —');
      if (data.length === 0) {
        _resetSelect(selKabkota, 'Data tidak tersedia');
      }
    });

    selKabkota.addEventListener('change', async () => {
      const kode = selKabkota.value;
      _resetSelect(selKecamatan, 'Memuat...');
      _resetSelect(selDesa, '— Pilih Desa/Kelurahan —');

      if (!kode) {
        _resetSelect(selKecamatan, '— Pilih Kecamatan —');
        return;
      }

      const data = await getKecamatan(kode);
      _populateSelect(selKecamatan, data, 'kode', 'nama', '— Pilih Kecamatan —');
      if (data.length === 0) {
        _resetSelect(selKecamatan, 'Data tidak tersedia');
      }
    });

    selKecamatan.addEventListener('change', async () => {
      const kode = selKecamatan.value;
      _resetSelect(selDesa, 'Memuat...');

      if (!kode) {
        _resetSelect(selDesa, '— Pilih Desa/Kelurahan —');
        return;
      }

      const data = await getDesa(kode);
      _populateSelect(selDesa, data, 'kode', 'nama', '— Pilih Desa/Kelurahan —');
      if (data.length === 0) {
        _resetSelect(selDesa, 'Data tidak tersedia (isi manual)');
      }
    });

    if (onDesaChange) selDesa.addEventListener('change', onDesaChange);
  }

  // ─── Restore saved wilayah ke dropdown ──────────────────────────────────
  async function restoreWilayah(selProvinsi, selKabkota, selKecamatan, selDesa, savedData) {
    if (!savedData || !savedData.kode_provinsi) return;

    selProvinsi.value = savedData.kode_provinsi;
    selProvinsi.dispatchEvent(new Event('change'));

    await new Promise(r => setTimeout(r, 200));
    if (savedData.kode_kabkota) {
      selKabkota.value = savedData.kode_kabkota;
      selKabkota.dispatchEvent(new Event('change'));
    }

    await new Promise(r => setTimeout(r, 200));
    if (savedData.kode_kecamatan) {
      selKecamatan.value = savedData.kode_kecamatan;
      selKecamatan.dispatchEvent(new Event('change'));
    }

    await new Promise(r => setTimeout(r, 200));
    if (savedData.kode_desa) {
      selDesa.value = savedData.kode_desa;
    }
  }

  // ─── Get nama dari kode ──────────────────────────────────────────────────
  function getNamaProvinsi(kode) {
    return PROVINSI.find(p => p.kode === kode)?.nama || kode;
  }

  async function getNamaKabkota(kodeProvinsi, kode) {
    const data = await getKabkota(kodeProvinsi);
    return data.find(k => k.kode === kode)?.nama || kode;
  }

  return { getProvinsi, getKabkota, getKecamatan, getDesa, initCascading, restoreWilayah, getNamaProvinsi, getNamaKabkota };
})();

window.WilayahManager = WilayahManager;
