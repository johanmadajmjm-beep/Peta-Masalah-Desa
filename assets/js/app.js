/**
 * app.js — SPA Controller utama
 * Mengelola navigasi, state, form input, daftar data, sinkronisasi UI
 */
'use strict';

// ─── Toast Notifications ──────────────────────────────────────────────────────
const Toast = (() => {
  let _container = null;

  function _getContainer() {
    if (!_container) {
      _container = document.getElementById('toast-container');
      if (!_container) {
        _container = document.createElement('div');
        _container.id = 'toast-container';
        document.body.appendChild(_container);
      }
    }
    return _container;
  }

  const ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  function show(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${ICONS[type] || ''}<span>${message}</span>`;

    _getContainer().appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  return { show };
})();

window.Toast = Toast;

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = (() => {
  let _overlay = null;

  function _getOverlay() {
    if (!_overlay) _overlay = document.getElementById('modal-overlay');
    return _overlay;
  }

  function show(options = {}) {
    const { title, content, actions = [], onClose } = options;
    const overlay = _getOverlay();
    if (!overlay) return;

    const modal = overlay.querySelector('.modal');
    modal.querySelector('.modal-title').textContent = title || '';
    modal.querySelector('.modal-body').innerHTML    = content || '';

    const actionsEl = modal.querySelector('.modal-actions');
    actionsEl.innerHTML = '';
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className   = `btn ${action.class || 'btn-ghost'}`;
      btn.textContent = action.label;
      btn.onclick = () => {
        if (action.onClick) action.onClick();
        if (action.close !== false) close();
      };
      actionsEl.appendChild(btn);
    });

    overlay.classList.add('open');
    overlay._onClose = onClose;
  }

  function close() {
    const overlay = _getOverlay();
    if (!overlay) return;
    overlay.classList.remove('open');
    if (overlay._onClose) overlay._onClose();
  }

  function confirm(message, onConfirm, onCancel) {
    show({
      title: 'Konfirmasi',
      content: `<p style="color:#475569;">${message}</p>`,
      actions: [
        { label: 'Batal',  class: 'btn-ghost',  onClick: onCancel },
        { label: 'Ya',     class: 'btn-danger',  onClick: onConfirm },
      ],
    });
  }

  return { show, close, confirm };
})();

window.Modal = Modal;

// ─── App State & Controller ───────────────────────────────────────────────────
const AppState = (() => {

  let _currentPage = 'beranda';
  let _allMasalah  = [];
  let _activeFilter = { kategori: 'semua', sync: 'semua', urgensi: 'semua', search: '' };
  let _editingId   = null;

  // ─── Navigasi SPA ─────────────────────────────────────────────────────
  function navigate(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    const nav  = document.querySelector(`[data-page="${pageId}"]`);
    if (page) page.classList.add('active');
    if (nav)  nav.classList.add('active');

    _currentPage = pageId;
    window.scrollTo(0, 0);

    // Page-specific init
    if (pageId === 'beranda')     loadBeranda();
    if (pageId === 'data')        loadDataList();
    if (pageId === 'peta')        { MapManager.invalidateSize(); MapManager.loadMarkers(); }
    if (pageId === 'sinkronisasi') loadSyncPage();
  }

  // ─── Beranda ──────────────────────────────────────────────────────────
  async function loadBeranda() {
    const stats = await StorageManager.getStats();

    // Update stat cards
    _setText('stat-total',    stats.total);
    _setText('stat-belum',    stats.belum + stats.menunggu);
    _setText('stat-terkirim', stats.terkirim);
    _setText('stat-gagal',    stats.gagal);
    _setText('stat-darurat',  stats.darurat);
    _setText('stat-tinggi',   stats.tinggi);

    // Badge di nav sinkronisasi
    const pending = stats.belum + stats.menunggu + stats.gagal;
    const badge = document.getElementById('sync-nav-badge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'flex' : 'none'; }

    // Greeting
    const petugas = StorageManager.getPetugasTerakhir();
    _setText('greeting-name', petugas ? `Halo, ${petugas.nama}` : 'Halo, Petugas!');

    // Top kategori
    const katEl = document.getElementById('top-kategori-list');
    if (katEl && stats.kategori) {
      const sorted = Object.entries(stats.kategori).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (sorted.length === 0) {
        katEl.innerHTML = `<p style="color:#94A3B8;font-size:0.8rem;">Belum ada data</p>`;
      } else {
        katEl.innerHTML = sorted.map(([kat, jml]) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9;">
            <span style="font-size:0.85rem;color:#334155;font-weight:500;">${CATEGORIES.find(c=>c.nama===kat)?.emoji||'📌'} ${kat}</span>
            <strong style="font-size:0.9rem;color:#1D6B4E;">${jml}</strong>
          </div>
        `).join('');
      }
    }
  }

  async function refreshStats() {
    if (_currentPage === 'beranda') await loadBeranda();
    const stats = await StorageManager.getStats();
    const pending = stats.belum + stats.menunggu + stats.gagal;
    const badge = document.getElementById('sync-nav-badge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'flex' : 'none'; }
  }

  // ─── Data List ────────────────────────────────────────────────────────
  async function loadDataList() {
    _allMasalah = await StorageManager.getAllMasalah();
    renderDataList();
  }

  function renderDataList() {
    const list = document.getElementById('data-list');
    if (!list) return;

    let filtered = _allMasalah;

    if (_activeFilter.search) {
      const q = _activeFilter.search.toLowerCase();
      filtered = filtered.filter(m =>
        (m.judul||'').toLowerCase().includes(q) ||
        (m.nama_desa||'').toLowerCase().includes(q) ||
        (m.deskripsi||'').toLowerCase().includes(q)
      );
    }
    if (_activeFilter.kategori !== 'semua') {
      filtered = filtered.filter(m => m.kategori === _activeFilter.kategori);
    }
    if (_activeFilter.sync !== 'semua') {
      filtered = filtered.filter(m => m.status_sync === _activeFilter.sync);
    }
    if (_activeFilter.urgensi !== 'semua') {
      filtered = filtered.filter(m => m.urgensi === _activeFilter.urgensi);
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg></div>
          <h3>Belum ada data</h3>
          <p>Mulai mencatat masalah desa dengan menekan tombol input di bawah.</p>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(m => _renderDataItem(m)).join('');

    list.querySelectorAll('.data-item').forEach(el => {
      el.addEventListener('click', () => showDetail(el.dataset.id));
    });
  }

  function _renderDataItem(m) {
    const tgl = m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '-';
    const urg = m.urgensi || 'rendah';
    const cat = CATEGORIES.find(c => c.nama === m.kategori);
    const emoji = cat?.emoji || '📌';
    const syncLabel = { belum: 'Belum Terkirim', menunggu: 'Menunggu', terkirim: 'Terkirim', gagal: 'Gagal Sinkron' };

    return `
      <div class="data-item urgensi-${urg}" data-id="${m.id}">
        <div class="data-item-header">
          <div style="display:flex;gap:8px;align-items:flex-start;flex:1">
            <div class="cat-icon" style="background:${cat?.bg||'#F1F5F9'}">${emoji}</div>
            <div style="flex:1">
              <div class="data-item-title">${m.judul || 'Tanpa Judul'}</div>
              <div class="data-item-location">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ${m.nama_desa || m.desa || '-'}${m.dusun ? ` • ${m.dusun}` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="badge badge-urgensi-${urg}">${urg.toUpperCase()}</span>
            <span class="badge badge-sync-${m.status_sync||'belum'}">${syncLabel[m.status_sync]||'Belum Terkirim'}</span>
          </div>
        </div>
        <div class="data-item-footer">
          <span class="data-item-date">${tgl}</span>
          <span style="font-size:0.75rem;color:#64748B;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;">${m.kategori || '—'}</span>
        </div>
      </div>`;
  }

  // ─── Detail masalah ───────────────────────────────────────────────────
  async function showDetail(id) {
    const m = await StorageManager.getMasalah(id);
    if (!m) return;

    const tgl = m.created_at ? new Date(m.created_at).toLocaleString('id-ID') : '-';
    const syncLabel = { belum: 'Belum Terkirim', menunggu: 'Menunggu Koneksi', terkirim: 'Terkirim ✓', gagal: 'Gagal Sinkron ✗' };

    const fotoHtml = [m.link_foto_1, m.link_foto_2, m.link_foto_3, m.foto_1_base64, m.foto_2_base64, m.foto_3_base64]
      .filter(Boolean).slice(0, 3)
      .map(f => `<img src="${f}" style="width:calc(33% - 4px);border-radius:8px;aspect-ratio:1;object-fit:cover;" onclick="window.open('${f}','_blank')">`).join('');

    Modal.show({
      title: m.judul || 'Detail Masalah',
      content: `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
          <span class="badge badge-urgensi-${m.urgensi||'rendah'}">${(m.urgensi||'rendah').toUpperCase()}</span>
          <span class="badge badge-sync-${m.status_sync||'belum'}">${syncLabel[m.status_sync||'belum']}</span>
          <span class="badge" style="background:#F1F5F9;color:#475569;">${m.kategori||'-'}</span>
        </div>
        ${fotoHtml ? `<div style="display:flex;gap:4px;margin-bottom:12px;">${fotoHtml}</div>` : ''}
        <div class="detail-row"><span class="detail-label">Lokasi</span><span class="detail-value">${[m.nama_provinsi,m.nama_kabkota,m.nama_kecamatan,m.nama_desa,m.dusun,m.rt?'RT '+m.rt:'',m.rw?'RW '+m.rw:''].filter(Boolean).join(', ')}</span></div>
        <div class="detail-row"><span class="detail-label">Koordinat GPS</span><span class="detail-value">${m.latitude ? `${m.latitude}, ${m.longitude} (±${m.akurasi_gps}m)` : 'Tidak diambil'}</span></div>
        <div class="detail-row"><span class="detail-label">Deskripsi</span><span class="detail-value">${m.deskripsi||'-'}</span></div>
        <div class="detail-row"><span class="detail-label">Warga Terkait</span><span class="detail-value">${m.nama_warga||'-'} ${m.jenis_kelamin?`(${m.jenis_kelamin})`:''} ${m.umur?`, ${m.umur} thn`:''}</span></div>
        <div class="detail-row"><span class="detail-label">Kelompok Rentan</span><span class="detail-value">${m.kelompok_rentan||'-'}</span></div>
        <div class="detail-row"><span class="detail-label">Jumlah Terdampak</span><span class="detail-value">${m.jumlah_terdampak ? m.jumlah_terdampak + ' orang' : '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Tindakan Awal</span><span class="detail-value">${m.tindakan_awal||'-'}</span></div>
        <div class="detail-row"><span class="detail-label">Rekomendasi</span><span class="detail-value">${m.rekomendasi||'-'}</span></div>
        <div class="detail-row"><span class="detail-label">Petugas</span><span class="detail-value">${m.nama_petugas||'-'} (${m.jabatan||'-'})</span></div>
        <div class="detail-row"><span class="detail-label">Waktu Input</span><span class="detail-value">${tgl}</span></div>
        <div class="detail-row"><span class="detail-label">ID Data</span><span class="detail-value" style="font-family:monospace;font-size:0.75rem;">${m.id}</span></div>
      `,
      actions: [
        {
          label: 'Tutup', class: 'btn-ghost', close: true
        },
        ...(m.status_sync !== 'terkirim' ? [{
          label: '✏️ Edit', class: 'btn-outline',
          onClick: () => { Modal.close(); openEditForm(id); }, close: false,
        }] : []),
        ...(m.status_sync !== 'terkirim' ? [{
          label: 'Kirim Ulang', class: 'btn-primary',
          onClick: async () => {
            await StorageManager.addToQueue(id);
            SyncManager.syncAll();
            Toast.show('Ditambahkan ke antrian sinkronisasi.', 'info');
          },
        }] : []),
        {
          label: '🗑️ Hapus', class: 'btn-danger',
          onClick: () => {
            Modal.close();
            Modal.confirm(
              `Hapus masalah "${m.judul}"? Tindakan ini tidak bisa dibatalkan.`,
              async () => {
                await StorageManager.deleteMasalah(id);
                await StorageManager.removeFromQueue(id);
                Toast.show('Data berhasil dihapus.', 'success');
                loadDataList();
                refreshStats();
              }
            );
          }, close: false,
        },
      ],
    });
  }

  window.AppState = { navigate, loadBeranda, loadDataList, refreshStats, showDetail };

  // ─── Input Form ───────────────────────────────────────────────────────
  let _photos = [null, null, null];
  let _gpsData = null;

  function initInputForm() {
    // Wilayah cascading
    WilayahManager.initCascading({
      selProvinsi:  document.getElementById('inp-provinsi'),
      selKabkota:   document.getElementById('inp-kabkota'),
      selKecamatan: document.getElementById('inp-kecamatan'),
      selDesa:      document.getElementById('inp-desa'),
      onDesaChange: (e) => {
        const opt = e.target.options[e.target.selectedIndex];
        document.getElementById('inp-nama-desa').value = opt.text !== '— Pilih Desa/Kelurahan —' ? opt.text : '';
      },
    });

    // Isi data petugas dari cache
    const petugas = StorageManager.getPetugasTerakhir();
    if (petugas) {
      _setVal('inp-nama-petugas', petugas.nama);
      _setVal('inp-jabatan', petugas.jabatan);
      _setVal('inp-hp-petugas', petugas.hp);
    }

    // GPS
    document.getElementById('btn-get-gps')?.addEventListener('click', getGPS);

    // Foto
    [0, 1, 2].forEach(i => {
      const slot = document.getElementById(`photo-slot-${i}`);
      const inp  = document.getElementById(`photo-inp-${i}`);
      if (!slot || !inp) return;

      slot.addEventListener('click', () => {
        if (!slot.classList.contains('has-photo')) inp.click();
      });

      inp.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const compressed = await PhotoManager.compressImage(file);
          _photos[i] = compressed.dataUrl;
          const img = slot.querySelector('img') || document.createElement('img');
          img.src = compressed.dataUrl;
          slot.appendChild(img);
          slot.classList.add('has-photo');
          slot.querySelector('.upload-icon')?.classList.add('d-none');
          Toast.show(`Foto ${i+1} ditambahkan (${compressed.sizeKB} KB)`, 'success');
        } catch(err) {
          Toast.show('Gagal memproses foto: ' + err.message, 'error');
        }
      });

      slot.querySelector('.remove-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _photos[i] = null;
        slot.classList.remove('has-photo');
        const img = slot.querySelector('img');
        if (img) img.remove();
        inp.value = '';
      });
    });

    // Draft auto-save setiap 30 detik
    setInterval(() => autoSaveDraft(), 30000);

    // Form submit
    document.getElementById('btn-save-masalah')?.addEventListener('click', saveMasalah);

    // Load draft jika ada
    loadDraft();
  }

  async function getGPS() {
    const btn = document.getElementById('btn-get-gps');
    const dot = document.getElementById('gps-dot');
    const info = document.getElementById('gps-info');

    btn.disabled = true;
    btn.textContent = 'Mengambil lokasi...';
    if (dot) { dot.className = 'gps-status-dot acquiring'; }

    try {
      _gpsData = await GPSManager.getPosition();
      _setVal('inp-lat',      _gpsData.latitude);
      _setVal('inp-lng',      _gpsData.longitude);
      _setVal('inp-akurasi',  _gpsData.accuracy);
      if (dot)  dot.className = 'gps-status-dot got';
      if (info) info.textContent = GPSManager.formatCoords(_gpsData.latitude, _gpsData.longitude) + ' ' + GPSManager.getAccuracyLabel(_gpsData.accuracy);
      Toast.show('Lokasi berhasil diambil!', 'success');
    } catch(err) {
      if (dot) dot.className = 'gps-status-dot failed';
      if (info) info.textContent = err.message;
      Toast.show(err.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = '📍 Ambil Lokasi Saat Ini';
  }

  async function saveMasalah() {
    // Validasi
    const required = [
      { id: 'inp-nama-petugas', label: 'Nama Petugas' },
      { id: 'inp-desa',         label: 'Desa/Kelurahan' },
      { id: 'inp-kategori',     label: 'Kategori Masalah' },
      { id: 'inp-judul',        label: 'Judul Masalah' },
      { id: 'inp-deskripsi',    label: 'Deskripsi Masalah' },
      { id: 'inp-urgensi',      label: 'Tingkat Urgensi' },
    ];

    let valid = true;
    required.forEach(({ id, label }) => {
      const el = document.getElementById(id);
      const group = el?.closest('.form-group');
      const err   = group?.querySelector('.form-error');
      if (!el?.value) {
        valid = false;
        group?.classList.add('has-error');
        if (err) err.textContent = `${label} wajib diisi.`;
        el?.focus();
      } else {
        group?.classList.remove('has-error');
      }
    });

    if (!valid) {
      Toast.show('Lengkapi field yang wajib diisi.', 'error');
      return;
    }

    // Kumpulkan data wilayah nama
    const selProv = document.getElementById('inp-provinsi');
    const selKab  = document.getElementById('inp-kabkota');
    const selKec  = document.getElementById('inp-kecamatan');
    const selDesa = document.getElementById('inp-desa');

    const data = {
      id:              _editingId || StorageManager.generateID(),
      tanggal_input:   new Date().toISOString().split('T')[0],
      waktu_input:     new Date().toLocaleTimeString('id-ID'),

      // Petugas
      nama_petugas:    _getVal('inp-nama-petugas'),
      jabatan:         _getVal('inp-jabatan'),
      hp_petugas:      _getVal('inp-hp-petugas'),

      // Wilayah
      kode_provinsi:   selProv?.value,
      nama_provinsi:   selProv?.options[selProv.selectedIndex]?.text,
      kode_kabkota:    selKab?.value,
      nama_kabkota:    selKab?.options[selKab.selectedIndex]?.text,
      kode_kecamatan:  selKec?.value,
      nama_kecamatan:  selKec?.options[selKec.selectedIndex]?.text,
      kode_desa:       selDesa?.value,
      nama_desa:       selDesa?.options[selDesa.selectedIndex]?.text || _getVal('inp-nama-desa'),
      dusun:           _getVal('inp-dusun'),
      kampung:         _getVal('inp-kampung'),
      rt:              _getVal('inp-rt'),
      rw:              _getVal('inp-rw'),

      // GPS
      latitude:        _getVal('inp-lat'),
      longitude:       _getVal('inp-lng'),
      akurasi_gps:     _getVal('inp-akurasi'),

      // Masalah
      kategori:        _getVal('inp-kategori'),
      subkategori:     _getVal('inp-subkategori'),
      judul:           _getVal('inp-judul'),
      deskripsi:       _getVal('inp-deskripsi'),
      urgensi:         _getVal('inp-urgensi'),
      status_masalah:  _getVal('inp-status-masalah') || 'baru',

      // Warga
      nama_warga:      _getVal('inp-nama-warga'),
      nik:             _getVal('inp-nik'),
      jenis_kelamin:   _getVal('inp-jenis-kelamin'),
      umur:            _getVal('inp-umur'),
      kelompok_rentan: _getVal('inp-kelompok-rentan'),
      jumlah_terdampak: _getVal('inp-jumlah-terdampak'),

      // Foto
      foto_1_base64:   _photos[0],
      foto_2_base64:   _photos[1],
      foto_3_base64:   _photos[2],

      // Tindak lanjut
      tindakan_awal:       _getVal('inp-tindakan-awal'),
      rekomendasi:         _getVal('inp-rekomendasi'),
      instansi_terlibat:   _getVal('inp-instansi'),
      tanggal_rencana:     _getVal('inp-tanggal-rencana'),
      catatan_tambahan:    _getVal('inp-catatan'),

      // Sync
      status_sync: _editingId ? 'belum' : 'belum',
    };

    // Simpan petugas ke cache
    StorageManager.savePetugas({ nama: data.nama_petugas, jabatan: data.jabatan, hp: data.hp_petugas });

    try {
      const saved = await StorageManager.saveMasalah(data);
      await StorageManager.clearDraft('form_input');

      // Tambah ke queue sync
      await StorageManager.addToQueue(saved.id);

      // Tambah ke peta
      if (MapManager.isInitialized() && data.latitude) {
        MapManager.addMarker(saved);
      }

      Toast.show(_editingId ? 'Data berhasil diperbarui!' : 'Data masalah berhasil disimpan!', 'success');

      // Reset form
      resetForm();
      _editingId = null;

      // Pindah ke beranda dan sync
      setTimeout(() => {
        navigate('beranda');
        if (SyncManager.isOnline()) SyncManager.syncAll();
      }, 800);

    } catch(err) {
      console.error('[Form] Gagal simpan:', err);
      Toast.show('Gagal menyimpan data: ' + err.message, 'error');
    }
  }

  function resetForm() {
    document.getElementById('form-input')?.reset();
    _photos = [null, null, null];
    [0, 1, 2].forEach(i => {
      const slot = document.getElementById(`photo-slot-${i}`);
      if (slot) {
        slot.classList.remove('has-photo');
        const img = slot.querySelector('img');
        if (img) img.remove();
      }
    });
    _gpsData = null;
    document.getElementById('gps-info').textContent = 'Koordinat belum diambil';
    document.getElementById('gps-dot').className = 'gps-status-dot';
  }

  async function autoSaveDraft() {
    const form = document.getElementById('form-input');
    if (!form) return;
    const data = {
      nama_petugas: _getVal('inp-nama-petugas'),
      judul:        _getVal('inp-judul'),
      deskripsi:    _getVal('inp-deskripsi'),
    };
    if (data.judul || data.deskripsi) {
      await StorageManager.saveDraft('form_input', data);
    }
  }

  async function loadDraft() {
    const draft = await StorageManager.getDraft('form_input');
    if (!draft) return;
    if (draft.judul) { _setVal('inp-judul', draft.judul); Toast.show('Draft terakhir dimuat.', 'info', 2000); }
  }

  async function openEditForm(id) {
    const m = await StorageManager.getMasalah(id);
    if (!m) return;
    _editingId = id;

    navigate('input');
    await new Promise(r => setTimeout(r, 300));

    _setVal('inp-nama-petugas', m.nama_petugas);
    _setVal('inp-jabatan',      m.jabatan);
    _setVal('inp-hp-petugas',   m.hp_petugas);
    _setVal('inp-dusun',        m.dusun);
    _setVal('inp-kampung',      m.kampung);
    _setVal('inp-rt',           m.rt);
    _setVal('inp-rw',           m.rw);
    _setVal('inp-lat',          m.latitude);
    _setVal('inp-lng',          m.longitude);
    _setVal('inp-akurasi',      m.akurasi_gps);
    _setVal('inp-kategori',     m.kategori);
    _setVal('inp-judul',        m.judul);
    _setVal('inp-deskripsi',    m.deskripsi);
    _setVal('inp-urgensi',      m.urgensi);
    _setVal('inp-status-masalah', m.status_masalah);
    _setVal('inp-nama-warga',   m.nama_warga);
    _setVal('inp-umur',         m.umur);
    _setVal('inp-jenis-kelamin', m.jenis_kelamin);
    _setVal('inp-tindakan-awal', m.tindakan_awal);
    _setVal('inp-rekomendasi',  m.rekomendasi);

    if (m.latitude) {
      document.getElementById('gps-info').textContent = GPSManager.formatCoords(m.latitude, m.longitude);
      document.getElementById('gps-dot').className = 'gps-status-dot got';
    }

    Toast.show('Mode edit aktif. Ubah data lalu simpan.', 'info');
  }

  // ─── Sync page ────────────────────────────────────────────────────────
  async function loadSyncPage() {
    const stats = await StorageManager.getStats();

    _setText('sync-total',    stats.total);
    _setText('sync-belum',    stats.belum);
    _setText('sync-menunggu', stats.menunggu);
    _setText('sync-terkirim', stats.terkirim);
    _setText('sync-gagal',    stats.gagal);

    const queue = await StorageManager.getQueue();
    const qList = document.getElementById('sync-queue-list');
    if (!qList) return;

    if (queue.length === 0) {
      qList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6L9 17l-5-5"/></svg></div>
          <h3>Antrian kosong</h3>
          <p>Semua data sudah terkirim atau belum ada data baru.</p>
        </div>`;
      return;
    }

    const rows = await Promise.all(queue.map(async q => {
      const m = await StorageManager.getMasalah(q.id);
      return m ? `
        <div class="queue-item">
          <div class="queue-item-info">
            <div class="queue-item-title">${m.judul||'Tanpa Judul'}</div>
            <div class="queue-item-sub">${m.nama_desa||'-'} • Percobaan: ${q.attempts}/${3}</div>
            ${q.last_error ? `<div style="font-size:0.7rem;color:#DC3545;margin-top:2px;">Error: ${q.last_error}</div>` : ''}
          </div>
          <span class="badge badge-sync-${m.status_sync||'belum'}">${{ belum:'Belum', menunggu:'Menunggu', gagal:'Gagal' }[m.status_sync]||'—'}</span>
        </div>` : '';
    }));

    qList.innerHTML = rows.join('');
  }

  // ─── Filter setup ─────────────────────────────────────────────────────
  function initFilters() {
    // Search
    const searchEl = document.getElementById('search-input');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        _activeFilter.search = e.target.value;
        renderDataList();
      });
    }

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filterType  = chip.dataset.filterType;
        const filterValue = chip.dataset.filterValue;

        chip.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        _activeFilter[filterType] = filterValue;
        renderDataList();
      });
    });
  }

  // ─── Category data ────────────────────────────────────────────────────
  const CATEGORIES = [
    { nama: 'Kesehatan',         emoji: '🏥', bg: '#E0F2FE', subkat: ['Gizi Buruk','Penyakit Menular','Akses Layanan Kesehatan','Lainnya'] },
    { nama: 'Disabilitas',       emoji: '♿', bg: '#EDE9FE', subkat: ['Fisik','Sensorik','Intelektual','Ganda','Lainnya'] },
    { nama: 'ODDP/Kesehatan Jiwa', emoji: '🧠', bg: '#FCE7F3', subkat: ['Depresi','Skizofrenia','Gangguan Kecemasan','Lainnya'] },
    { nama: 'Lansia',            emoji: '👴', bg: '#FEF3DC', subkat: ['Terlantar','Akses Layanan','Lainnya'] },
    { nama: 'Anak Rentan',       emoji: '👶', bg: '#DCFCE7', subkat: ['Putus Sekolah','Kekerasan','Gizi','Lainnya'] },
    { nama: 'Pendidikan',        emoji: '📚', bg: '#DBEAFE', subkat: ['Akses','Kualitas','Sarana','Lainnya'] },
    { nama: 'Bantuan Sosial',    emoji: '🤝', bg: '#EDE9FE', subkat: ['Data Tidak Valid','Belum Dapat Bantuan','Lainnya'] },
    { nama: 'RTLH',              emoji: '🏚️', bg: '#FEF3DC', subkat: ['Atap Rusak','Lantai Tanah','Dinding Rapuh','Lainnya'] },
    { nama: 'Air Bersih',        emoji: '💧', bg: '#E0F2FE', subkat: ['Tidak Ada Sumber','Tercemar','Jauh','Lainnya'] },
    { nama: 'Sanitasi',          emoji: '🚿', bg: '#ECFCCB', subkat: ['Tidak Ada MCK','MCK Rusak','Lainnya'] },
    { nama: 'Jalan Rusak',       emoji: '🛣️', bg: '#F1F5F9', subkat: ['Berlubang','Longsor','Tidak Ada Jalan','Lainnya'] },
    { nama: 'Jembatan Rusak',    emoji: '🌉', bg: '#F1F5F9', subkat: ['Rusak Berat','Putus','Lainnya'] },
    { nama: 'Pertanian',         emoji: '🌾', bg: '#DCFCE7', subkat: ['Gagal Panen','Hama','Irigasi','Lainnya'] },
    { nama: 'Peternakan',        emoji: '🐄', bg: '#ECFCCB', subkat: ['Penyakit Hewan','Pakan','Lainnya'] },
    { nama: 'UMKM',              emoji: '🏪', bg: '#FEF3DC', subkat: ['Modal','Akses Pasar','Perijinan','Lainnya'] },
    { nama: 'Bencana/Risiko',    emoji: '⚠️', bg: '#FEE2E2', subkat: ['Banjir','Longsor','Kekeringan','Angin','Lainnya'] },
    { nama: 'Konflik Sosial',    emoji: '⚡', bg: '#FEE2E2', subkat: ['Sengketa Lahan','Kekerasan','Lainnya'] },
    { nama: 'Lainnya',           emoji: '📌', bg: '#F1F5F9', subkat: ['Lainnya'] },
  ];

  window.CATEGORIES = CATEGORIES;

  function initCategorySelect() {
    const sel = document.getElementById('inp-kategori');
    const subSel = document.getElementById('inp-subkategori');
    if (!sel) return;

    sel.innerHTML = '<option value="">— Pilih Kategori —</option>';
    CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.nama;
      opt.textContent = `${c.emoji} ${c.nama}`;
      sel.appendChild(opt);
    });

    sel.addEventListener('change', () => {
      const cat = CATEGORIES.find(c => c.nama === sel.value);
      if (!subSel) return;
      subSel.innerHTML = '<option value="">— Pilih Subkategori —</option>';
      (cat?.subkat || []).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        subSel.appendChild(opt);
      });
      subSel.disabled = !cat;
    });
  }

  // ─── Quick input dari beranda ─────────────────────────────────────────
  function initQuickInput() {
    document.getElementById('btn-quick-input')?.addEventListener('click', () => navigate('input'));
    document.querySelectorAll('.cat-mini-card').forEach(card => {
      card.addEventListener('click', () => {
        const kat = card.dataset.kategori;
        navigate('input');
        setTimeout(() => {
          const sel = document.getElementById('inp-kategori');
          if (sel) { sel.value = kat; sel.dispatchEvent(new Event('change')); }
        }, 300);
      });
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  }

  function _getVal(id) {
    return document.getElementById(id)?.value || '';
  }

  // ─── Init ─────────────────────────────────────────────────────────────
  async function init() {
    await StorageManager.init();

    // Modal close
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') Modal.close();
    });

    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.page));
    });

    // Sync button
    document.getElementById('btn-sync-now')?.addEventListener('click', () => SyncManager.syncAll());

    // Map init (lazy)
    document.querySelector('[data-page="peta"]')?.addEventListener('click', () => {
      if (!MapManager.isInitialized()) {
        setTimeout(() => {
          MapManager.init('map-container');
          MapManager.loadMarkers();
        }, 100);
      }
    });

    // Init form
    initInputForm();
    initCategorySelect();
    initFilters();
    initQuickInput();

    // Sync init
    await SyncManager.init();

    // Beranda pertama
    navigate('beranda');

    console.log('[App] Peta Masalah Desa siap.');
  }

  return { init, navigate, loadBeranda, loadDataList, renderDataList, refreshStats, showDetail, loadSyncPage };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => AppState.init());
