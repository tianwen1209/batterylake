/* ═══════════════════════════════════════════════════════════════
   BatteryLake analytics — GA4 page views, custom download/run events,
   and public site-stats counters. Safe when gtag is blocked.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-5C061K2R5M';
  var STATS_URL = 'assets/data/site-stats.json';
  var CENTROIDS_URL = 'assets/vendor/leaflet/country-centroids.json';
  var LEAFLET_JS_URL = 'assets/vendor/leaflet/leaflet.js';
  var lastPagePath = null;
  var numberFmt = typeof Intl !== 'undefined' && Intl.NumberFormat
    ? new Intl.NumberFormat()
    : { format: function (n) { return String(n); } };

  var PAGE_TITLES = {
    home: 'Home',
    datasets: 'Datasets',
    benchmarks: 'Benchmarks',
    models: 'Model Library',
    'model-details': 'Model Details',
    tasks: 'Tasks',
    naming: 'Naming Standard',
    docs: 'Documentation',
    about: 'About',
    terms: 'Terms & Citation',
    quality: 'Quality Assessment',
    preprocessing: 'Preprocessing',
    apis: 'Platform APIs',
    contribute: 'Contribute Dataset'
  };

  var DATASET_DOWNLOAD_TYPES = {
    source_dataset: true,
    processed_dataset: true
  };

  var SKILL_SOURCES = {
    benchmarks_package: true,
    quality_assessment: true,
    preprocessing_skill: true
  };

  var MODEL_DOWNLOAD_SOURCES = {
    model_detail: true,
    model_card: true
  };

  var modelStatsCache = {
    downloads: Object.create(null),
    runs: Object.create(null)
  };

  var visitorMap = {
    map: null,
    tileLayer: null,
    markerLayer: null,
    places: [],
    centroids: null,
    leafletLoading: null,
    resizeBound: false,
    themeObserver: null,
    savedView: null
  };

  var MAP_DEFAULT_CENTER = [20, 0];
  var MAP_DEFAULT_ZOOM = 2;
  var MAP_MIN_ZOOM = 1;
  var MAP_MAX_ZOOM = 10;

  var TILE_URLS = {
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  };
  var TILE_ATTR =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

  /** Dev-only sample locations. Enabled with ?demoLocations=1 — never used as production data. */
  var DEV_SAMPLE_LOCATIONS = {
    _devSample: true,
    updatedAt: null,
    countries: [
      { country: 'Singapore', countryCode: 'SG', visitors: 42 },
      { country: 'United States', countryCode: 'US', visitors: 28 },
      { country: 'China', countryCode: 'CN', visitors: 18 },
      { country: 'Germany', countryCode: 'DE', visitors: 11 },
      { country: 'Japan', countryCode: 'JP', visitors: 9 },
      { country: 'United Kingdom', countryCode: 'GB', visitors: 7 },
      { country: 'Australia', countryCode: 'AU', visitors: 5 },
      { country: 'India', countryCode: 'IN', visitors: 4 }
    ],
    cities: [
      { country: 'Singapore', countryCode: 'SG', city: 'Singapore', visitors: 42, lng: 103.85, lat: 1.29 },
      { country: 'United States', countryCode: 'US', city: 'San Francisco', visitors: 12, lng: -122.419, lat: 37.775 },
      { country: 'United States', countryCode: 'US', city: 'New York', visitors: 10, lng: -74.006, lat: 40.714 },
      { country: 'China', countryCode: 'CN', city: 'Beijing', visitors: 11, lng: 116.397, lat: 39.907 },
      { country: 'China', countryCode: 'CN', city: 'Shanghai', visitors: 7, lng: 121.458, lat: 31.222 },
      { country: 'Germany', countryCode: 'DE', city: 'Berlin', visitors: 8, lng: 13.411, lat: 52.524 },
      { country: 'Japan', countryCode: 'JP', city: 'Tokyo', visitors: 9, lng: 139.692, lat: 35.69 },
      { country: 'United Kingdom', countryCode: 'GB', city: 'London', visitors: 7, lng: -0.126, lat: 51.509 },
      { country: 'Australia', countryCode: 'AU', city: 'Sydney', visitors: 5, lng: 151.207, lat: -33.868 },
      { country: 'India', countryCode: 'IN', city: 'Bengaluru', visitors: 4, lng: 77.594, lat: 12.972 }
    ]
  };

  function callGtag() {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag.apply(window, arguments);
      }
    } catch (_) { /* no-op if blocked or unavailable */ }
  }

  function pageTitleForHash() {
    var raw = (location.hash || '#home').replace(/^#/, '') || 'home';
    var key = raw;
    if (raw.indexOf('datasets-') === 0) key = 'datasets';
    else if (raw.indexOf('model-') === 0) key = 'model-details';
    else if (raw.indexOf('quality-') === 0 || raw.indexOf('quality/') === 0) key = 'quality';
    var label = PAGE_TITLES[key] || PAGE_TITLES[raw.split('-')[0]] || raw;
    return 'BatteryLake — ' + label;
  }

  /** One page_view per distinct hash path; skips duplicates on the same load. */
  function trackPageView() {
    try {
      var pagePath = location.pathname + location.search + (location.hash || '#home');
      if (pagePath === lastPagePath) return;
      lastPagePath = pagePath;
      callGtag('event', 'page_view', {
        page_title: pageTitleForHash(),
        page_location: location.href,
        page_path: pagePath
      });
    } catch (_) { /* never break navigation */ }
  }

  /**
   * Dataset details popup: Source Dataset link or Processed Dataset download.
   * params: { download_type, dataset_id?, dataset_name? }
   */
  function trackDatasetDownload(params) {
    try {
      params = params || {};
      var downloadType = String(params.download_type || '');
      if (!DATASET_DOWNLOAD_TYPES[downloadType]) return;
      var payload = { download_type: downloadType };
      if (params.dataset_id) payload.dataset_id = String(params.dataset_id);
      if (params.dataset_name) payload.dataset_name = String(params.dataset_name);
      callGtag('event', 'dataset_download', payload);
    } catch (_) { /* no-op */ }
  }

  /**
   * Skill counters: benchmarks package, quality Run Assessment, preprocessing skill.
   * params: { skill_source }
   */
  function trackSkillDownload(params) {
    try {
      params = params || {};
      var skillSource = String(params.skill_source || '');
      if (!SKILL_SOURCES[skillSource]) return;
      callGtag('event', 'skill_use', {
        skill_source: skillSource
      });
    } catch (_) { /* no-op */ }
  }

  /**
   * Model library: detail Download Code/Package or card quick-download.
   * params: { model_id, download_source: 'model_detail' | 'model_card' }
   */
  function trackModelDownload(params) {
    try {
      params = params || {};
      var modelId = String(params.model_id || '');
      var downloadSource = String(params.download_source || '');
      if (!modelId || !MODEL_DOWNLOAD_SOURCES[downloadSource]) return;
      callGtag('event', 'model_download', {
        model_id: modelId,
        download_source: downloadSource
      });
    } catch (_) { /* no-op */ }
  }

  /**
   * Model library: detail Run Benchmark.
   * params: { model_id }
   */
  function trackModelRun(params) {
    try {
      params = params || {};
      var modelId = String(params.model_id || '');
      if (!modelId) return;
      callGtag('event', 'model_run', {
        model_id: modelId
      });
    } catch (_) { /* no-op */ }
  }

  function normalizeModelCountMap(raw) {
    var out = Object.create(null);
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (key) {
      var n = Number(raw[key]);
      out[key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    });
    return out;
  }

  function getModelStatCount(modelId, kind) {
    var map = kind === 'runs' ? modelStatsCache.runs : modelStatsCache.downloads;
    var n = map[String(modelId || '')];
    if (n === null || n === undefined || Number.isNaN(Number(n))) return 0;
    return Number(n) || 0;
  }

  function getModelUsage(modelId) {
    return {
      downloads: getModelStatCount(modelId, 'downloads'),
      runs: getModelStatCount(modelId, 'runs')
    };
  }

  function formatUsageLabel(count, singular, plural) {
    var n = Number(count) || 0;
    return numberFmt.format(n) + ' ' + (n === 1 ? singular : plural);
  }

  function refreshModelUsageTags() {
    try {
      document.querySelectorAll('[data-ml-stat][data-model-id]').forEach(function (el) {
        var modelId = el.getAttribute('data-model-id') || '';
        var kind = el.getAttribute('data-ml-stat');
        if (kind === 'runs') {
          el.textContent = formatUsageLabel(getModelStatCount(modelId, 'runs'), 'run', 'runs');
        } else if (kind === 'downloads') {
          el.textContent = formatUsageLabel(getModelStatCount(modelId, 'downloads'), 'download', 'downloads');
        }
      });
    } catch (_) { /* no-op */ }
  }

  function setStatValue(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      el.textContent = '—';
      return;
    }
    el.textContent = numberFmt.format(Number(value));
  }

  function setStatsLoading() {
    setStatValue('stat-website-visits', null);
    setStatValue('stat-dataset-downloads', null);
    setStatValue('stat-skill-downloads', null);
    var note = document.getElementById('stat-updated-note');
    if (note) {
      note.textContent = '';
      note.hidden = true;
    }
  }

  function formatUpdatedNote(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      var dateFmt = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      return 'Updated ' + dateFmt.format(d);
    } catch (_) {
      return '';
    }
  }

  function cssVar(name, fallback) {
    try {
      var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function isDarkTheme() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function wantDevLocationSample() {
    try {
      return /(?:\?|&)demoLocations=1(?:&|$)/.test(location.search || '');
    } catch (_) {
      return false;
    }
  }

  function normalizeCountries(rawCountries) {
    if (!Array.isArray(rawCountries)) return [];
    var out = [];
    rawCountries.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      var country = String(row.country || '').trim();
      var code = String(row.countryCode || row.country_code || '').trim().toUpperCase();
      var visitors = Number(row.visitors);
      if (!Number.isFinite(visitors) || visitors <= 0) return;
      // Never render Unknown / unset rows on the map.
      if (!country || /^(unknown|\(not set\)|not set)$/i.test(country)) return;
      if (!code || code === 'ZZ' || code === '(NOT SET)' || code === 'UNKNOWN') return;
      out.push({
        country: country,
        countryCode: code,
        visitors: Math.floor(visitors)
      });
    });
    out.sort(function (a, b) {
      return b.visitors - a.visitors || a.countryCode.localeCompare(b.countryCode);
    });
    return out;
  }

  function normalizeCities(rawCities) {
    if (!Array.isArray(rawCities)) return [];
    var out = [];
    rawCities.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      var country = String(row.country || '').trim();
      var code = String(row.countryCode || row.country_code || '').trim().toUpperCase();
      var city = String(row.city || '').trim();
      var visitors = Number(row.visitors);
      var lng = Number(row.lng);
      var lat = Number(row.lat);
      if (!Number.isFinite(visitors) || visitors <= 0) return;
      if (!country || /^(unknown|\(not set\)|not set)$/i.test(country)) return;
      if (!code || code === 'ZZ' || code === '(NOT SET)' || code === 'UNKNOWN') return;
      if (!city || /^(unknown|\(not set\)|not set)$/i.test(city)) return;
      var place = {
        country: country,
        countryCode: code,
        city: city,
        visitors: Math.floor(visitors)
      };
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        place.lng = lng;
        place.lat = lat;
      }
      out.push(place);
    });
    out.sort(function (a, b) {
      return b.visitors - a.visitors
        || a.countryCode.localeCompare(b.countryCode)
        || a.city.localeCompare(b.city);
    });
    return out;
  }

  function resolveMapPlaces(locations) {
    var countries = normalizeCountries(locations && locations.countries);
    var cities = normalizeCities(locations && locations.cities);
    if (cities.length) {
      // Prefer city markers; add country markers only for countries with no city points.
      var covered = Object.create(null);
      cities.forEach(function (row) { covered[row.countryCode] = true; });
      var places = cities.slice();
      countries.forEach(function (row) {
        if (!covered[row.countryCode]) places.push(row);
      });
      places.sort(function (a, b) {
        return b.visitors - a.visitors
          || a.countryCode.localeCompare(b.countryCode)
          || String(a.city || '').localeCompare(String(b.city || ''));
      });
      return places;
    }
    return countries;
  }

  function resolveLocations(data) {
    if (!data || typeof data !== 'object') {
      if (wantDevLocationSample()) {
        return {
          places: resolveMapPlaces(DEV_SAMPLE_LOCATIONS),
          updatedAt: null,
          isDevSample: true
        };
      }
      return { places: [], updatedAt: null, isDevSample: false };
    }

    var locations = data.locations;
    if (locations != null && (typeof locations !== 'object' || Array.isArray(locations))) {
      locations = null;
    }

    var places = resolveMapPlaces(locations);
    if (places.length) {
      return {
        places: places,
        updatedAt: (locations && locations.updatedAt) || data.updated_at || null,
        isDevSample: false
      };
    }
    if (wantDevLocationSample()) {
      return {
        places: resolveMapPlaces(DEV_SAMPLE_LOCATIONS),
        updatedAt: null,
        isDevSample: true
      };
    }
    return { places: [], updatedAt: null, isDevSample: false };
  }

  function setMapEmptyState(showEmpty) {
    var empty = document.getElementById('reach-map-empty');
    var legend = document.getElementById('reach-map-legend');
    if (empty) empty.hidden = !showEmpty;
    if (legend) legend.hidden = showEmpty;
  }

  function disposeVisitorMap() {
    if (visitorMap.map) {
      try { visitorMap.map.remove(); } catch (_) { /* no-op */ }
      visitorMap.map = null;
      visitorMap.tileLayer = null;
      visitorMap.markerLayer = null;
    }
    visitorMap.savedView = null;
  }

  function captureMapView() {
    if (!visitorMap.map) return null;
    try {
      var center = visitorMap.map.getCenter();
      return {
        center: [center.lat, center.lng],
        zoom: visitorMap.map.getZoom()
      };
    } catch (_) {
      return null;
    }
  }

  function radiusForVisitors(value, maxVisitors) {
    var minSize = 6;
    var maxSize = 22;
    if (!maxVisitors || maxVisitors <= 0) return minSize;
    var t = Math.sqrt(Math.max(0, value) / maxVisitors);
    return Math.round(minSize + t * (maxSize - minSize));
  }

  function opacityForVisitors(value, maxVisitors) {
    if (!maxVisitors || maxVisitors <= 0) return 0.7;
    var t = Math.sqrt(Math.max(0, value) / maxVisitors);
    return Math.round((0.42 + t * 0.48) * 100) / 100;
  }

  function formatPlaceLabel(data) {
    if (!data) return '';
    // Only use analytics fields — never invent city labels from the basemap.
    if (data.city) return data.country + ' · ' + data.city;
    return data.country || '';
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tooltipHtml(place) {
    var muted = cssVar('--text3', '#6b7689');
    return (
      '<div class="sc-reach-map-tooltip">' +
        '<div class="sc-reach-map-tooltip-title">' + escapeHtml(formatPlaceLabel(place)) + '</div>' +
        '<div class="sc-reach-map-tooltip-meta" style="color:' + muted + '">Visitors: ' +
          escapeHtml(numberFmt.format(place.visitors)) +
        '</div>' +
      '</div>'
    );
  }

  function resolvePlaceLatLng(place, centroids) {
    var lng = Number(place.lng);
    var lat = Number(place.lat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lat, lng];
    }
    var coord = centroids && centroids[place.countryCode];
    if (!coord || coord.length < 2) return null;
    // Centroids file stores [lng, lat].
    return [coord[1], coord[0]];
  }

  function buildMarkerPoints(places, centroids) {
    var maxVisitors = 0;
    var points = [];
    (places || []).forEach(function (row) {
      var latLng = resolvePlaceLatLng(row, centroids);
      if (!latLng) return;
      if (row.visitors > maxVisitors) maxVisitors = row.visitors;
      points.push({
        place: row,
        latLng: latLng
      });
    });
    return { points: points, maxVisitors: maxVisitors };
  }

  function tileUrlForTheme() {
    return isDarkTheme() ? TILE_URLS.dark : TILE_URLS.light;
  }

  function ensureTileLayer() {
    if (!visitorMap.map || typeof window.L === 'undefined') return;
    var nextUrl = tileUrlForTheme();
    if (visitorMap.tileLayer) {
      visitorMap.map.removeLayer(visitorMap.tileLayer);
      visitorMap.tileLayer = null;
    }
    visitorMap.tileLayer = window.L.tileLayer(nextUrl, {
      attribution: TILE_ATTR,
      subdomains: 'abcd',
      maxZoom: MAP_MAX_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      detectRetina: true
    });
    visitorMap.tileLayer.addTo(visitorMap.map);
  }

  function ensureLeafletMap(mapEl) {
    if (visitorMap.map) return visitorMap.map;
    var L = window.L;
    var view = visitorMap.savedView;
    visitorMap.map = L.map(mapEl, {
      center: view && view.center ? view.center : MAP_DEFAULT_CENTER,
      zoom: view && Number.isFinite(view.zoom) ? view.zoom : MAP_DEFAULT_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: true,
      worldCopyJump: true
    });
    L.control.zoom({ position: 'topleft' }).addTo(visitorMap.map);
    ensureTileLayer();
    visitorMap.markerLayer = L.layerGroup().addTo(visitorMap.map);
    visitorMap.map.on('moveend zoomend', function () {
      visitorMap.savedView = captureMapView();
    });
    // Invalidate size after layout settles (aspect-ratio panel).
    setTimeout(function () {
      if (visitorMap.map) visitorMap.map.invalidateSize();
    }, 0);
    return visitorMap.map;
  }

  function renderVisitorMarkers(places) {
    if (!visitorMap.map || !visitorMap.markerLayer || !visitorMap.centroids) return false;
    var L = window.L;
    var built = buildMarkerPoints(places, visitorMap.centroids);
    visitorMap.markerLayer.clearLayers();
    if (!built.points.length) return false;

    var accent = cssVar('--accent', isDarkTheme() ? '#7db3ff' : '#2a5fea');
    built.points.forEach(function (point) {
      var visitors = point.place.visitors;
      var marker = L.circleMarker(point.latLng, {
        radius: radiusForVisitors(visitors, built.maxVisitors),
        color: accent,
        weight: 1.25,
        opacity: Math.min(1, opacityForVisitors(visitors, built.maxVisitors) + 0.15),
        fillColor: accent,
        fillOpacity: opacityForVisitors(visitors, built.maxVisitors),
        interactive: true
      });
      marker.bindTooltip(tooltipHtml(point.place), {
        direction: 'top',
        opacity: 1,
        className: 'sc-reach-map-leaflet-tooltip',
        sticky: false
      });
      visitorMap.markerLayer.addLayer(marker);
    });
    return true;
  }

  function renderVisitorMap(places) {
    var mapEl = document.getElementById('reach-visitor-map');
    if (!mapEl) {
      disposeVisitorMap();
      setMapEmptyState(true);
      return;
    }

    ensureMapAssets().then(function () {
      if (!visitorMap.centroids || typeof window.L === 'undefined') {
        disposeVisitorMap();
        setMapEmptyState(true);
        return;
      }

      ensureLeafletMap(mapEl);
      ensureTileLayer();

      var hasMarkers = false;
      if (places && places.length) {
        hasMarkers = renderVisitorMarkers(places);
      } else if (visitorMap.markerLayer) {
        visitorMap.markerLayer.clearLayers();
      }

      setMapEmptyState(!hasMarkers);
      if (visitorMap.map) visitorMap.map.invalidateSize();
      bindMapChrome();
    }).catch(function () {
      disposeVisitorMap();
      setMapEmptyState(true);
    });
  }

  function loadLeaflet() {
    if (typeof window.L !== 'undefined') return Promise.resolve();
    if (visitorMap.leafletLoading) return visitorMap.leafletLoading;
    visitorMap.leafletLoading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = LEAFLET_JS_URL;
      script.async = true;
      script.onload = function () {
        if (typeof window.L === 'undefined') {
          reject(new Error('leaflet failed to initialize'));
          return;
        }
        resolve();
      };
      script.onerror = function () {
        visitorMap.leafletLoading = null;
        reject(new Error('leaflet failed to load'));
      };
      document.head.appendChild(script);
    });
    return visitorMap.leafletLoading;
  }

  function ensureMapAssets() {
    if (visitorMap.centroids && typeof window.L !== 'undefined') {
      return Promise.resolve();
    }
    return loadLeaflet().then(function () {
      return fetch(CENTROIDS_URL, { cache: 'force-cache' }).then(function (res) {
        if (!res.ok) throw new Error('centroids ' + res.status);
        return res.json();
      });
    }).then(function (centroids) {
      if (typeof window.L === 'undefined') throw new Error('leaflet missing');
      visitorMap.centroids = centroids || {};
    });
  }

  function bindMapChrome() {
    if (!visitorMap.resizeBound) {
      visitorMap.resizeBound = true;
      window.addEventListener('resize', function () {
        if (visitorMap.map) visitorMap.map.invalidateSize();
      });
    }
    if (!visitorMap.themeObserver && typeof MutationObserver !== 'undefined') {
      visitorMap.themeObserver = new MutationObserver(function () {
        if (!visitorMap.map) return;
        ensureTileLayer();
        if (visitorMap.places && visitorMap.places.length) {
          renderVisitorMarkers(visitorMap.places);
        }
      });
      visitorMap.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
    }
  }

  function applyVisitorLocations(data) {
    var resolved = resolveLocations(data);
    visitorMap.places = resolved.places;
    renderVisitorMap(resolved.places);
  }

  function applySiteStats(data) {
    if (!data || typeof data !== 'object') {
      modelStatsCache.downloads = Object.create(null);
      modelStatsCache.runs = Object.create(null);
      setStatsLoading();
      refreshModelUsageTags();
      applyVisitorLocations(null);
      return;
    }
    setStatValue('stat-website-visits', data.total_visits);
    setStatValue('stat-dataset-downloads', data.dataset_downloads);
    setStatValue('stat-skill-downloads', data.skill_uses);
    modelStatsCache.downloads = normalizeModelCountMap(data.model_downloads);
    modelStatsCache.runs = normalizeModelCountMap(data.model_runs);
    refreshModelUsageTags();
    var note = document.getElementById('stat-updated-note');
    if (note) {
      var text = formatUpdatedNote(data.updated_at);
      if (resolveLocations(data).isDevSample) {
        text = text ? text + ' · Dev sample locations' : 'Dev sample locations (?demoLocations=1)';
      }
      note.textContent = text;
      note.hidden = !text;
    }
    applyVisitorLocations(data);
  }

  function loadSiteStats() {
    setStatsLoading();
    modelStatsCache.downloads = Object.create(null);
    modelStatsCache.runs = Object.create(null);
    refreshModelUsageTags();
    applyVisitorLocations(null);
    fetch(STATS_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('stats ' + res.status);
        return res.json();
      })
      .then(applySiteStats)
      .catch(function () {
        modelStatsCache.downloads = Object.create(null);
        modelStatsCache.runs = Object.create(null);
        setStatsLoading();
        refreshModelUsageTags();
        applyVisitorLocations(wantDevLocationSample() ? { locations: DEV_SAMPLE_LOCATIONS } : null);
      });
  }

  window.BatteryLakeAnalytics = {
    measurementId: MEASUREMENT_ID,
    trackPageView: trackPageView,
    trackDatasetDownload: trackDatasetDownload,
    trackSkillDownload: trackSkillDownload,
    trackModelDownload: trackModelDownload,
    trackModelRun: trackModelRun,
    getModelUsage: getModelUsage,
    loadSiteStats: loadSiteStats
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSiteStats);
  } else {
    loadSiteStats();
  }
})();
