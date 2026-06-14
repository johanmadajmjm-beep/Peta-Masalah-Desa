/**
 * map.js — Peta Leaflet dengan marker masalah
 */
'use strict';

const MapManager = (() => {
  let _map = null;
  let _markers = [];
  let _markerLayer = null;
  let _initialized = false;

  const CATEGORY_COLORS = {
    'Kesehatan':           '#0EA5E9',
    'Disabilitas':         '#8B5CF6',
    'ODDP/Kesehatan Jiwa': '#EC4899',
    'Lansia':              '#F59E0B',
    'Anak Rentan':         '#10B981',
    'Pendidikan':          '#3B82F6',
    'Bantuan Sosial':      '#6366F1',
    'RTLH':                '#D97706',
    'Air Bersih':          '#0EA5E9',
    'Sanitasi':            '#84CC16',
    'Jalan Rusak':         '#9CA3AF',
    'Jembatan Rusak':      '#6B7280',
    'Pertanian':           '#22C55E',
    'Peternakan':          '#A3E635',
    'UMKM':                '#F97316',
    'Bencana/Risiko':      '#EF4444',
    'Konflik Sosial':      '#DC2626',
    'Lainnya':             '#94A3B8',
  };

  const URGENSI_COLORS = {
    'rendah':  '#0EA5E9',
    'sedang':  '#F59E0B',
    'tinggi':  '#EF4444',
    'darurat': '#7F1D1D',
  };

  const CATEGORY_EMOJI = {
    'Kesehatan': '🏥', 'Disabilitas': '♿', 'ODDP/Kesehatan Jiwa': '🧠',
    'Lansia': '👴', 'Anak Rentan': '👶', 'Pendidikan': '📚',
    'Bantuan Sosial': '🤝', 'RTLH': '🏚️', 'Air Bersih': '💧',
    'Sanitasi': '🚿', 'Jalan Rusak': '🛣️', 'Jembatan Rusak': '🌉',
    'Pertanian': '🌾', 'Peternakan': '🐄', 'UMKM': '🏪',
    'Bencana/Risiko': '⚠️', 'Konflik Sosial': '⚡', 'Lainnya': '📌',
  };

  function _createIcon(kategori, urgensi) {
    const color = URGENSI_COLORS[urgensi] || '#64748B';
    const emoji = CATEGORY_EMOJI[kategori] || '📍';

    return L.divIcon({
      className: '',
      html: `
        <div style="
          width: 36px; height: 36px;
          background: ${color};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        ">
          <span style="transform: rotate(45deg); font-size: 14px; line-height: 1;">${emoji}</span>
        </div>
      `,
      iconSize:   [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });
  }

  function _buildPopup(masalah) {
    const tgl = masalah.tanggal_input || masalah.created_at?.split('T')[0] || '-';
    const urgensiClass = `badge-urgensi-${masalah.urgensi || 'rendah'}`;
    return `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 220px;">
        <div style="font-weight:700; font-size:0.9rem; margin-bottom:4px; color:#0F172A;">${masalah.judul || 'Masalah Desa'}</div>
        <div style="font-size:0.75rem; color:#64748B; margin-bottom:8px;">${masalah.nama_desa || ''} • ${tgl}</div>
        <span class="badge ${urgensiClass}" style="margin-bottom:8px;">${masalah.urgensi?.toUpperCase() || '-'}</span>
        <div style="font-size:0.78rem; color:#334155; margin-top:6px; line-height:1.4;">${(masalah.deskripsi || '').substring(0, 120)}${(masalah.deskripsi || '').length > 120 ? '...' : ''}</div>
        <button onclick="AppState.showDetail('${masalah.id}')"
          style="margin-top:8px; width:100%; padding:6px; background:#1D6B4E; color:#fff; border:none; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer; font-family:inherit;">
          Lihat Detail →
        </button>
      </div>
    `;
  }

  // ─── Inisialisasi peta ─────────────────────────────────────────────────
  function init(containerId = 'map-container') {
    if (_initialized) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Default center: Ruteng, Manggarai, NTT
    _map = L.map(containerId, {
      center: [-8.6194, 120.4730],
      zoom:   11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(_map);

    // Layer grup untuk marker
    _markerLayer = L.layerGroup().addTo(_map);

    _initialized = true;
    console.log('[Map] Leaflet initialized.');
  }

  // ─── Muat marker dari data masalah ────────────────────────────────────
  async function loadMarkers(filterFn = null) {
    if (!_initialized) return;

    _markerLayer.clearLayers();
    _markers = [];

    const allData = await StorageManager.getAllMasalah();
    const filtered = filterFn ? allData.filter(filterFn) : allData;

    const bounds = [];

    filtered.forEach(masalah => {
      const lat = parseFloat(masalah.latitude);
      const lng = parseFloat(masalah.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const icon   = _createIcon(masalah.kategori, masalah.urgensi);
      const marker = L.marker([lat, lng], { icon })
        .bindPopup(_buildPopup(masalah), { maxWidth: 240 });

      marker.masalahId = masalah.id;
      _markerLayer.addLayer(marker);
      _markers.push(marker);
      bounds.push([lat, lng]);
    });

    // Auto-fit bounds jika ada marker
    if (bounds.length > 1) {
      _map.fitBounds(bounds, { padding: [40, 40] });
    } else if (bounds.length === 1) {
      _map.setView(bounds[0], 14);
    }

    return _markers.length;
  }

  // ─── Pindah ke posisi tertentu ─────────────────────────────────────────
  function flyTo(lat, lng, zoom = 16) {
    if (!_initialized) return;
    _map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }

  // ─── Resize map (penting saat tab switch) ─────────────────────────────
  function invalidateSize() {
    if (_initialized && _map) {
      setTimeout(() => _map.invalidateSize(), 200);
    }
  }

  // ─── Tambah satu marker baru ──────────────────────────────────────────
  function addMarker(masalah) {
    if (!_initialized) return;
    const lat = parseFloat(masalah.latitude);
    const lng = parseFloat(masalah.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const icon   = _createIcon(masalah.kategori, masalah.urgensi);
    const marker = L.marker([lat, lng], { icon })
      .bindPopup(_buildPopup(masalah))
      .addTo(_markerLayer);

    _markers.push(marker);
  }

  function getMap()          { return _map; }
  function isInitialized()   { return _initialized; }
  function getMarkerCount()  { return _markers.length; }

  return { init, loadMarkers, flyTo, invalidateSize, addMarker, getMap, isInitialized, getMarkerCount };
})();

window.MapManager = MapManager;
