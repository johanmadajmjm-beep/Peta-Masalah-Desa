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
        <div class="detail-row"><span class="detail-label">Lokasi</span><span class="detail-value">${[m.nama_kabkota,m.nama_kecamatan,(m.jenis_desa||'')+' '+m.nama_desa,m.dusun,m.rt?'RT '+m.rt:'',m.rw?'RW '+m.rw:''].filter(Boolean).join(', ')}</span></div>
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
    // Wilayah cascading (Kepmendagri 2025 — dari assets/data/wilayah.json)
    WilayahManager.initCascading({
      kab:  'inp-kabkota',
      kec:  'inp-kecamatan',
      desa: 'inp-desa',
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
    // Ambil data wilayah dari WilayahManager
    const _wil = WilayahManager.getSelectedWilayah({ kab:'inp-kabkota', kec:'inp-kecamatan', desa:'inp-desa' });

    const data = {
      id:              _editingId || StorageManager.generateID(),
      tanggal_input:   new Date().toISOString().split('T')[0],
      waktu_input:     new Date().toLocaleTimeString('id-ID'),

      // Petugas
      nama_petugas:    _getVal('inp-nama-petugas'),
      jabatan:         _getVal('inp-jabatan'),
      hp_petugas:      _getVal('inp-hp-petugas'),

      // Wilayah (kode Kemendagri 2025, dari wilayah.json)
      kode_kabkota:    _wil.kode_kabkota,
      nama_kabkota:    _wil.nama_kabkota,
      kode_kecamatan:  _wil.kode_kecamatan,
      nama_kecamatan:  _wil.nama_kecamatan,
      kode_desa:       _wil.kode_desa,
      nama_desa:       _wil.nama_desa,
      jenis_desa:      _wil.jenis_desa,
      // Lokasi detail — isi manual petugas
      dusun:           _getVal('inp-dusun'),
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
    // Re-init cascading setelah reset (select wilayah kembali ke awal)
    WilayahManager.initCascading({ kab:'inp-kabkota', kec:'inp-kecamatan', desa:'inp-desa' });
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
    // Restore cascading wilayah dari data tersimpan
    WilayahManager.restoreWilayah(
      { kode_kabkota: m.kode_kabkota, kode_kecamatan: m.kode_kecamatan, kode_desa: m.kode_desa },
      { kab: 'inp-kabkota', kec: 'inp-kecamatan', desa: 'inp-desa' }
    );
    _setVal('inp-dusun',        m.dusun);
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
    WilayahManager.init(); // Data sudah embed, langsung siap

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

// ─── SEED DATA CONTOH ─────────────────────────────────────────────────────
// Panggil dari konsol browser: seedData()
// Hapus data contoh:          clearSeedData()
window.seedData = async function() {
  const PETUGAS = [
    { nama:'Yohanes Damus',  jabatan:'CBR Worker',     hp:'081234560001' },
    { nama:'Maria Goreti',   jabatan:'CBR Worker',     hp:'081234560002' },
    { nama:'Petrus Rangga',  jabatan:'CBR Supervisor', hp:'081234560003' },
    { nama:'Agustina Nona',  jabatan:'CBR Worker',     hp:'081234560004' },
    { nama:'Eduardus Boro',  jabatan:'CBR Worker',     hp:'081234560005' },
  ];
  const WILAYAH = [
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531301',kec:'Langke Rembong',kode_desa:'5313010001',desa:'Pau' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531301',kec:'Langke Rembong',kode_desa:'5313010002',desa:'Carep' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531301',kec:'Langke Rembong',kode_desa:'5313010003',desa:'Wali' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531302',kec:'Ruteng',         kode_desa:'5313020001',desa:'Ruteng' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531302',kec:'Ruteng',         kode_desa:'5313020002',desa:'Golo Kantor' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531303',kec:'Cibal',          kode_desa:'5313030001',desa:'Wae Codi' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531303',kec:'Cibal',          kode_desa:'5313030002',desa:'Golo Mendo' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5313',kab:'Kabupaten Manggarai',      kode_kec:'531304',kec:'Reok',           kode_desa:'5313040001',desa:'Reo' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5319',kab:'Kabupaten Manggarai Timur',kode_kec:'531901',kec:'Borong',         kode_desa:'5319010001',desa:'Gurung Liwut' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5319',kab:'Kabupaten Manggarai Timur',kode_kec:'531901',kec:'Borong',         kode_desa:'5319010002',desa:'Satar Tesem' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5319',kab:'Kabupaten Manggarai Timur',kode_kec:'531902',kec:'Elar',           kode_desa:'5319020001',desa:'Watu Mori' },
    { kode_prov:'53',prov:'Nusa Tenggara Timur',kode_kab:'5315',kab:'Kabupaten Manggarai Barat',kode_kec:'531501',kec:'Komodo',         kode_desa:'5315010001',desa:'Labuan Bajo' },
  ];
  const BASE = {
    '531301':{lat:-8.6194,lng:120.4730},'531302':{lat:-8.6050,lng:120.4600},
    '531303':{lat:-8.7100,lng:120.3800},'531304':{lat:-8.4500,lng:120.7500},
    '531901':{lat:-8.5500,lng:120.8200},'531902':{lat:-8.7800,lng:121.1000},
    '531501':{lat:-8.4969,lng:119.8897},
  };
  const DUSUN = ['Dusun 1','Dusun 2','Dusun 3','Dusun Baru','Kampung Barat','Kampung Timur'];
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const ri   = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const rc   = (lat,lng,r=0.05) => ({ lat:(lat+(Math.random()-.5)*2*r).toFixed(6), lng:(lng+(Math.random()-.5)*2*r).toFixed(6) });
  const ago  = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString(); };

  const RAW = [
    {kategori:'Infrastruktur',subkategori:'Jalan Rusak',      urgensi:'tinggi', judul:'Jalan Desa Berlubang Besar',               deskripsi:'Jalan utama desa berlubang besar sepanjang ±200 meter, membahayakan pengguna jalan terutama saat hujan.',tindakan:'Memasang tanda peringatan sementara dan melaporkan ke kepala desa',nama_warga:'Marianus Nong',   jk:'L',umur:45},
    {kategori:'Infrastruktur',subkategori:'Jembatan',         urgensi:'darurat',judul:'Jembatan Bambu Lapuk Membahayakan',          deskripsi:'Jembatan bambu yang menghubungkan dua kampung sudah lapuk dan salah satu papan patah. Tidak ada jalur alternatif.',tindakan:'Koordinasi dengan kepala dusun untuk perbaikan darurat',nama_warga:'Florentina Ina', jk:'P',umur:38},
    {kategori:'Infrastruktur',subkategori:'Air Bersih',       urgensi:'tinggi', judul:'Pipa Air Bersih Bocor',                      deskripsi:'Pipa distribusi air bersih bocor di persimpangan RT 3. Air terbuang sia-sia selama ±2 minggu.',tindakan:'Lapor ke PDAM dan kepala desa',nama_warga:'Elisabet Wula',  jk:'P',umur:52},
    {kategori:'Infrastruktur',subkategori:'Listrik',          urgensi:'sedang', judul:'Tiang Listrik Miring Hampir Roboh',           deskripsi:'Tiang listrik PLN miring sekitar 30 derajat akibat tanah longsor. Berpotensi menimpa rumah warga.',tindakan:'Lapor ke PLN ULP Ruteng',nama_warga:'Benediktus Bau', jk:'L',umur:60},
    {kategori:'Infrastruktur',subkategori:'Sanitasi',         urgensi:'tinggi', judul:'Drainase Tersumbat Menyebabkan Banjir',       deskripsi:'Saluran drainase di RT 2 tersumbat sampah. Saat hujan air menggenang setinggi 30 cm masuk ke rumah warga.',tindakan:'Gotong royong bersihkan drainase sudah direncanakan',nama_warga:'Agustina Mboi',  jk:'P',umur:41},
    {kategori:'Infrastruktur',subkategori:'Jalan Rusak',      urgensi:'sedang', judul:'Longsor Menutup Akses Jalan',                 deskripsi:'Longsor kecil menutup sebagian badan jalan menuju kebun warga.',tindakan:'Sudah lapor ke BPD desa',nama_warga:'Kornelius Rade', jk:'L',umur:55},
    {kategori:'Infrastruktur',subkategori:'Air Bersih',       urgensi:'darurat',judul:'Sumber Air Kering Musim Kemarau',             deskripsi:'Sumber air utama desa mengering total. Warga harus membeli atau mengambil dari sumber yang jaraknya 4 km.',tindakan:'Koordinasi distribusi air dengan dinas',nama_warga:'Magdalena Wea',  jk:'P',umur:34},
    {kategori:'Infrastruktur',subkategori:'Gedung',           urgensi:'sedang', judul:'Atap Posyandu Bocor',                         deskripsi:'Atap seng gedung posyandu bocor di empat titik. Saat hujan kegiatan posyandu tidak bisa dilaksanakan.',tindakan:'Mengajukan perbaikan ke pemerintah desa',nama_warga:'Theresia Geto',  jk:'P',umur:47},
    {kategori:'Infrastruktur',subkategori:'Jembatan',         urgensi:'tinggi', judul:'Jembatan Beton Retak',                        deskripsi:'Retakan memanjang ±1,5 meter pada badan jembatan beton yang dilalui kendaraan bermuatan berat setiap hari.',tindakan:'Memasang papan larangan kendaraan berat',nama_warga:'Petrus Dedo',    jk:'L',umur:63},
    {kategori:'Infrastruktur',subkategori:'Sanitasi',         urgensi:'rendah', judul:'MCK Umum Tidak Terawat',                      deskripsi:'MCK umum di dusun 2 tidak terawat. Pintu rusak, lantai licin, dan tidak ada air mengalir.',tindakan:'Diskusi dengan PKK tentang pengelolaan',nama_warga:'Yolanda Siu',    jk:'P',umur:29},
    {kategori:'Kesehatan',    subkategori:'Gizi Buruk',       urgensi:'darurat',judul:'Balita Gizi Buruk Tidak Tertangani',          deskripsi:'Balita usia 18 bulan dengan berat badan jauh di bawah standar. Orang tua kurang paham pentingnya gizi seimbang.',tindakan:'Merujuk ke Puskesmas dan pendampingan keluarga',nama_warga:'Rikardus Lelo',  jk:'L',umur:2},
    {kategori:'Kesehatan',    subkategori:'Penyakit Menular', urgensi:'tinggi', judul:'Kasus Diare Berulang pada Anak',              deskripsi:'Dalam sebulan ada 7 anak di RT 1 terkena diare berulang. Diduga dari sumber air minum yang terkontaminasi.',tindakan:'Distribusi oralit dan edukasi cuci tangan',nama_warga:'Sisilia Nona',   jk:'P',umur:6},
    {kategori:'Kesehatan',    subkategori:'Ibu & Anak',       urgensi:'tinggi', judul:'Ibu Hamil Tidak Rutin ANC',                   deskripsi:'Ibu hamil trimester ketiga belum pernah periksa kehamilan karena biaya dan jarak ke fasilitas kesehatan.',tindakan:'Mendampingi ke Pustu untuk pemeriksaan',nama_warga:'Veronika Beba',  jk:'P',umur:24},
    {kategori:'Kesehatan',    subkategori:'Lansia',           urgensi:'sedang', judul:'Lansia Hipertensi Tidak Teratur Minum Obat',  deskripsi:'Nenek 72 tahun penderita hipertensi tidak rutin minum obat karena kehabisan dan tidak ada yang mengantar.',tindakan:'Koordinasi dengan kader untuk antar obat',nama_warga:'Katarina Sae',   jk:'P',umur:72},
    {kategori:'Kesehatan',    subkategori:'Disabilitas',      urgensi:'sedang', judul:'Penyandang Disabilitas Tanpa Alat Bantu',     deskripsi:'Warga penyandang disabilitas fisik tidak memiliki kruk atau kursi roda. Tidak bisa keluar rumah mandiri.',tindakan:'Menghubungi Dinas Sosial untuk bantuan alat',nama_warga:'Aloysius Rima',  jk:'L',umur:35},
    {kategori:'Kesehatan',    subkategori:'Penyakit Menular', urgensi:'darurat',judul:'Suspect TBC Belum Diperiksa',                 deskripsi:'Warga batuk lebih dari 2 bulan, berkeringat malam, berat badan turun drastis. Belum pernah diperiksa.',tindakan:'Edukasi dan merujuk ke Puskesmas untuk pemeriksaan dahak',nama_warga:'Dominikus Eso',  jk:'L',umur:48},
    {kategori:'Kesehatan',    subkategori:'Gizi Buruk',       urgensi:'tinggi', judul:'Stunting pada Balita',                        deskripsi:'Tiga balita di RT 4 teridentifikasi stunting. Pola makan keluarga rendah protein hewani.',tindakan:'Edukasi gizi dan pendampingan PMBA',nama_warga:'Rafael Dua',     jk:'L',umur:3},
    {kategori:'Kesehatan',    subkategori:'Ibu & Anak',       urgensi:'sedang', judul:'Bayi Tidak Imunisasi Lengkap',                deskripsi:'Bayi usia 9 bulan belum dapat imunisasi campak karena orang tua takut efek samping.',tindakan:'Edukasi ke orang tua dan koordinasi dengan bidan desa',nama_warga:'Yunita Dhoi',    jk:'P',umur:1},
    {kategori:'Pendidikan',   subkategori:'Putus Sekolah',    urgensi:'tinggi', judul:'Anak Putus Sekolah untuk Membantu Orang Tua', deskripsi:'Anak usia 13 tahun tidak melanjutkan sekolah karena harus membantu orang tua berkebun.',tindakan:'Koordinasi dengan sekolah dan Dinas Pendidikan',nama_warga:'Timoteus Kama',  jk:'L',umur:13},
    {kategori:'Pendidikan',   subkategori:'Fasilitas Sekolah',urgensi:'tinggi', judul:'Ruang Kelas Roboh Akibat Hujan Deras',        deskripsi:'Satu ruang kelas SD rusak berat — dinding retak dan atap sebagian roboh. Siswa dipindah ke ruang yang sudah penuh.',tindakan:'Lapor ke dinas pendidikan dan pemerintah desa',nama_warga:'Karolina Watu',  jk:'P',umur:42},
    {kategori:'Pendidikan',   subkategori:'Akses Pendidikan', urgensi:'sedang', judul:'Tidak Ada Guru di Sekolah Terpencil',         deskripsi:'SD filial di dusun 3 hanya punya 1 guru aktif dari 4 yang seharusnya ada.',tindakan:'Lapor ke kepala sekolah induk',nama_warga:'Fransiskus Wio', jk:'L',umur:50},
    {kategori:'Pendidikan',   subkategori:'Putus Sekolah',    urgensi:'sedang', judul:'Remaja Perempuan Berhenti Sekolah',           deskripsi:'Tiga siswi SMP berhenti sekolah semester ini. Dua diduga karena pertunangan dini, satu karena biaya.',tindakan:'Kunjungan ke keluarga dan koordinasi dengan kepala sekolah',nama_warga:'Melania Reo',    jk:'P',umur:14},
    {kategori:'Pendidikan',   subkategori:'Fasilitas Sekolah',urgensi:'rendah', judul:'Perpustakaan Sekolah Tidak Berfungsi',        deskripsi:'Perpustakaan SD tidak berfungsi karena buku rusak dan ruangan dipakai untuk gudang.',tindakan:'Mengusulkan revitalisasi ke komite sekolah',nama_warga:'Hendrikus Bao',  jk:'L',umur:56},
    {kategori:'Pendidikan',   subkategori:'Akses Pendidikan', urgensi:'rendah', judul:'Anak Berkebutuhan Khusus Tidak Terlayani',    deskripsi:'Anak usia 10 tahun dengan keterlambatan perkembangan tidak bersekolah karena SD tidak punya fasilitas.',tindakan:'Menghubungi SLB terdekat dan Dinas Pendidikan',nama_warga:'Adrianus Sola',  jk:'L',umur:10},
    {kategori:'Ekonomi',      subkategori:'Kemiskinan',       urgensi:'tinggi', judul:'Keluarga Miskin Tidak Terdaftar DTKS',        deskripsi:'Keluarga dengan 5 anak, suami sakit keras, tidak terdaftar DTKS dan tidak menerima bantuan apapun.',tindakan:'Mendampingi pengurusan dokumen ke desa',nama_warga:'Kornelius Wae',  jk:'L',umur:40},
    {kategori:'Ekonomi',      subkategori:'Usaha Mikro',      urgensi:'sedang', judul:'Kelompok Tani Kesulitan Modal',               deskripsi:'Kelompok tani 15 orang kesulitan beli pupuk dan bibit karena tidak ada akses kredit.',tindakan:'Menghubungi PPL pertanian dan koperasi',nama_warga:'Benediktus Noa', jk:'L',umur:45},
    {kategori:'Ekonomi',      subkategori:'Pengangguran',     urgensi:'sedang', judul:'Banyak Pemuda Menganggur Tanpa Keahlian',     deskripsi:'Sekitar 20 pemuda usia 18–25 tahun tidak bekerja dan tidak ada program pelatihan keterampilan di desa.',tindakan:'Usul program pelatihan ke Disnaker',nama_warga:'Rosaline Bola',  jk:'P',umur:21},
    {kategori:'Ekonomi',      subkategori:'Kemiskinan',       urgensi:'darurat',judul:'Keluarga Tidak Mampu Beli Beras',             deskripsi:'Keluarga janda dengan 3 anak kecil kehabisan beras dan tidak punya uang. Tidak ada sanak saudara.',tindakan:'Distribusi bantuan pangan darurat dari gereja setempat',nama_warga:'Wilhelmina Sua', jk:'P',umur:32},
    {kategori:'Ekonomi',      subkategori:'Usaha Mikro',      urgensi:'rendah', judul:'Produk UMKM Tidak Ada Akses Pasar',           deskripsi:'Ibu-ibu PKK menghasilkan kerajinan anyaman berkualitas namun tidak tahu cara memasarkan.',tindakan:'Menghubungi Dinas Koperasi UKM',nama_warga:'Cecilia Goa',    jk:'P',umur:38},
    {kategori:'Ekonomi',      subkategori:'Pertanian',        urgensi:'tinggi', judul:'Hama Wereng Menyerang Padi',                  deskripsi:'Serangan hama wereng coklat di lahan ±5 hektar. Petani belum tahu penanganan yang tepat.',tindakan:'Memanggil PPL pertanian untuk identifikasi',nama_warga:'Paulus Jawa',    jk:'L',umur:53},
    {kategori:'Lingkungan',   subkategori:'Sampah',           urgensi:'sedang', judul:'Tumpukan Sampah di Pinggir Sungai',           deskripsi:'Tumpukan sampah rumah tangga di pinggir sungai semakin besar. Tidak ada TPS dan jadwal pengangkutan.',tindakan:'Diskusi dengan perangkat desa tentang pengelolaan sampah',nama_warga:'Laurentius Deo', jk:'L',umur:44},
    {kategori:'Lingkungan',   subkategori:'Bencana Alam',     urgensi:'darurat',judul:'Ancaman Longsor di Pemukiman',                deskripsi:'Lereng di atas pemukiman menunjukkan tanda-tanda akan longsor. Ada 12 rumah dalam radius bahaya.',tindakan:'Koordinasi evakuasi dengan kepala desa dan BPBD',nama_warga:'Stefanus Naru',  jk:'L',umur:59},
    {kategori:'Lingkungan',   subkategori:'Pencemaran',       urgensi:'tinggi', judul:'Sungai Tercemar Limbah Ternak',               deskripsi:'Sungai yang digunakan warga tercemar kotoran ternak dari kandang yang terlalu dekat.',tindakan:'Mediasi dengan pemilik kandang',nama_warga:'Adrianus Goa',   jk:'L',umur:37},
    {kategori:'Lingkungan',   subkategori:'Sampah',           urgensi:'rendah', judul:'Pembakaran Sampah Sembarangan',               deskripsi:'Warga membakar sampah termasuk plastik setiap hari di dekat pemukiman. Berbahaya bagi balita.',tindakan:'Edukasi pemilahan sampah dan bahaya pembakaran',nama_warga:'Martina Rua',    jk:'P',umur:31},
    {kategori:'Lingkungan',   subkategori:'Bencana Alam',     urgensi:'tinggi', judul:'Banjir Merendam Kebun Warga',                 deskripsi:'Hujan lebat menyebabkan aliran sungai meluap dan merendam kebun sayur ±2 hektar.',tindakan:'Dokumentasi kerugian untuk dilaporkan ke dinas',nama_warga:'Goreti Wate',    jk:'P',umur:49},
    {kategori:'Sosial',       subkategori:'Konflik',          urgensi:'tinggi', judul:'Sengketa Lahan Antar Keluarga',               deskripsi:'Dua keluarga berselisih batas lahan sejak lama. Sempat ada perkelahian kecil. Mediasi adat belum berhasil.',tindakan:'Melibatkan tokoh adat dan BPD untuk mediasi',nama_warga:'Hendrikus Pora', jk:'L',umur:55},
    {kategori:'Sosial',       subkategori:'Kekerasan',        urgensi:'darurat',judul:'Dugaan KDRT dalam Keluarga',                  deskripsi:'Tetangga sering mendengar keributan. Ibu terlihat dengan memar di wajah. Anak-anak terlihat ketakutan.',tindakan:'Koordinasi dengan kepala desa dan P2TP2A',nama_warga:'Ningsih Ruku',   jk:'P',umur:27},
    {kategori:'Sosial',       subkategori:'Anak',             urgensi:'tinggi', judul:'Anak Terlantar Tanpa Pengasuhan',             deskripsi:'Dua anak usia 7 dan 9 tahun ditinggal orang tua merantau. Tinggal bersama nenek yang sakit-sakitan.',tindakan:'Kunjungan rutin dan koordinasi dengan Dinas Sosial',nama_warga:'Katarina Meo',   jk:'P',umur:70},
    {kategori:'Sosial',       subkategori:'Lansia Terlantar', urgensi:'sedang', judul:'Lansia Sebatang Kara Tanpa Perawatan',        deskripsi:'Kakek 78 tahun tinggal sendirian. Anak-anak merantau semua. Tidak ada yang membantu kebutuhan harian.',tindakan:'Koordinasi dengan kader dan PKK untuk pendampingan',nama_warga:'Benediktus Sewa',jk:'L',umur:78},
    {kategori:'Sosial',       subkategori:'Konflik',          urgensi:'rendah', judul:'Perpecahan Kelompok Tani',                    deskripsi:'Kelompok tani pecah menjadi dua karena selisih paham pembagian hasil. Kegiatan terhenti dua bulan.',tindakan:'Memfasilitasi pertemuan rekonsiliasi',nama_warga:'Gabriela Ola',   jk:'P',umur:42},
    {kategori:'Adminduk',     subkategori:'KTP',              urgensi:'sedang', judul:'Warga Belum Punya KTP Seumur Hidup',          deskripsi:'Warga dewasa 45 tahun belum pernah punya KTP. Kesulitan akses layanan kesehatan dan bantuan sosial.',tindakan:'Mendampingi perekaman e-KTP ke Disdukcapil',nama_warga:'Antonius Bele',  jk:'L',umur:45},
    {kategori:'Adminduk',     subkategori:'Akta Lahir',       urgensi:'sedang', judul:'Anak Tanpa Akta Kelahiran',                   deskripsi:'Lima anak usia sekolah di RT 3 tidak punya akta kelahiran. Terancam tidak bisa masuk sekolah.',tindakan:'Mendampingi pengurusan dokumen ke Disdukcapil',nama_warga:'Rosalia Seo',    jk:'P',umur:36},
    {kategori:'Adminduk',     subkategori:'KK',               urgensi:'rendah', judul:'Kartu Keluarga Tidak Update',                 deskripsi:'KK belum diperbarui lebih dari 10 tahun. Anggota keluarga baru belum tercantum.',tindakan:'Edukasi prosedur update KK ke warga',nama_warga:'Margarita Keo',  jk:'P',umur:33},
    {kategori:'Adminduk',     subkategori:'KTP',              urgensi:'rendah', judul:'KTP Rusak Tidak Bisa Diproses',               deskripsi:'Beberapa lansia memiliki KTP rusak dan kesulitan datang ke kantor Disdukcapil.',tindakan:'Koordinasi layanan jemput bola Disdukcapil',nama_warga:'Yoseph Soa',     jk:'L',umur:68},
    {kategori:'Pertanian',    subkategori:'Irigasi',          urgensi:'tinggi', judul:'Saluran Irigasi Rusak Sawah Kering',          deskripsi:'Saluran irigasi yang mengairi sawah 8 hektar jebol di dua titik. Sawah terancam kekeringan.',tindakan:'Lapor ke Dinas Pertanian dan PUPR',nama_warga:'Barnabas Roka',  jk:'L',umur:57},
    {kategori:'Pertanian',    subkategori:'Pupuk',            urgensi:'sedang', judul:'Kelangkaan Pupuk Bersubsidi',                 deskripsi:'Pupuk urea bersubsidi tidak tersedia di kios resmi desa sejak 2 bulan. Petani beli non-subsidi 3x lipat.',tindakan:'Lapor ke Babinsa dan Dinas Pertanian',nama_warga:'Yohanes Noa',    jk:'L',umur:50},
    {kategori:'Pertanian',    subkategori:'Bibit',            urgensi:'rendah', judul:'Bibit Padi Tidak Tersedia di Musim Tanam',    deskripsi:'Kelompok tani tidak dapat jatah bibit padi unggul dari dinas. Menggunakan bibit sendiri yang rendah produktivitas.',tindakan:'Koordinasi dengan PPL dan Gapoktan',nama_warga:'Agustinus Watu', jk:'L',umur:46},
    {kategori:'Pertanian',    subkategori:'Penyakit Tanaman', urgensi:'tinggi', judul:'Penyakit Busuk Akar Menyerang Kakao',        deskripsi:'Tanaman kakao terserang busuk akar (Phytophthora). Lebih dari 200 pohon sudah mati atau sekarat.',tindakan:'Pelaporan ke PPL dan identifikasi tanaman terdampak',nama_warga:'Florentinus Owa',jk:'L',umur:52},
    {kategori:'Keamanan',     subkategori:'Pencurian',        urgensi:'tinggi', judul:'Pencurian Ternak Berulang',                   deskripsi:'Dalam 3 bulan terjadi 4 kasus pencurian sapi dan kambing di dua kampung. Warga resah.',tindakan:'Meningkatkan ronda malam dan lapor ke Polsek',nama_warga:'Klemens Wao',    jk:'L',umur:62},
    {kategori:'Keamanan',     subkategori:'Penerangan Jalan', urgensi:'sedang', judul:'Jalan Gelap Rawan Kecelakaan Malam',          deskripsi:'Ruas jalan 500 meter tanpa penerangan. Sudah terjadi 2 kecelakaan lalulintas malam ini bulan ini.',tindakan:'Mengusulkan pemasangan PJU ke pemerintah desa',nama_warga:'Kristina Reo',   jk:'P',umur:39},
  ];

  const records = RAW.map((m, i) => {
    const wil  = WILAYAH[i % WILAYAH.length];
    const ptg  = PETUGAS[i % PETUGAS.length];
    const base = BASE[wil.kode_kec] || {lat:-8.6194,lng:120.4730};
    const c    = rc(base.lat, base.lng);
    const hari = ri(1, 90);
    const sync = i < 30 ? 'terkirim' : (i < 40 ? 'belum' : 'gagal');
    return {
      id: StorageManager.generateID(),
      created_at: ago(hari), updated_at: ago(Math.max(0, hari - ri(0,3))),
      status_sync: sync,
      nama_petugas: ptg.nama, jabatan: ptg.jabatan, hp_petugas: ptg.hp,
      kode_provinsi: wil.kode_prov, nama_provinsi: wil.prov,
      kode_kabkota: wil.kode_kab,  nama_kabkota: wil.kab,
      kode_kecamatan: wil.kode_kec, nama_kecamatan: wil.kec,
      kode_desa: wil.kode_desa,    nama_desa: wil.desa,
      dusun: pick(DUSUN), rt: String(ri(1,5)), rw: String(ri(1,3)),
      latitude: c.lat, longitude: c.lng, akurasi_gps: String(ri(5,25)),
      judul: m.judul, kategori: m.kategori, subkategori: m.subkategori,
      deskripsi: m.deskripsi, urgensi: m.urgensi,
      nama_warga: m.nama_warga, jenis_kelamin: m.jk==='L'?'Laki-laki':'Perempuan', umur: m.umur,
      tindakan_awal: m.tindakan, status_tindak: ['belum','proses','selesai'][i%3],
      foto_1: null, foto_2: null, foto_3: null,
      _is_seed: true,
    };
  });

  let ok = 0;
  for (const r of records) {
    try { await StorageManager.saveMasalah(r); ok++; } catch(e) { console.warn('Gagal simpan:', r.id, e); }
  }
  await AppState.refreshStats();
  AppState.navigate('beranda');
  console.log(`✅ seedData selesai: ${ok}/${records.length} data berhasil disimpan.`);
  alert(`✅ ${ok} data contoh berhasil dimasukkan! Halaman akan direfresh.`);
  location.reload();
};

window.clearSeedData = async function() {
  if (!confirm('Hapus semua data contoh (flag _is_seed)?')) return;
  const all  = await StorageManager.getAllMasalah();
  const seed = all.filter(r => r._is_seed === true);
  for (const r of seed) await StorageManager.deleteMasalah(r.id);
  await AppState.refreshStats();
  console.log(`🗑️ clearSeedData: ${seed.length} data seed dihapus.`);
  alert(`🗑️ ${seed.length} data seed dihapus.`);
  location.reload();
};
