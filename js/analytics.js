/* ═══════════════════════════════════════════════════════════════
   BatteryLake analytics — GA4 page views, custom download/run events,
   and public site-stats counters. Safe when gtag is blocked.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-5C061K2R5M';
  var STATS_URL = 'assets/data/site-stats.json';
  var CENTROIDS_URL = 'assets/vendor/leaflet/country-centroids.json';
  var WORLD_COUNTRIES_URL = 'assets/data/world-countries.geojson';
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
    countryLayer: null,
    markerLayer: null,
    places: [],
    centroids: null,
    countries: null,
    leafletLoading: null,
    resizeBound: false,
    themeObserver: null,
    savedView: null
  };

  // Europe-to-Asia framing keeps Africa and Southeast Asia in view while
  // preserving the existing zoom level. Users can still zoom/drag freely.
  var MAP_DEFAULT_CENTER = [15, 75];
  var MAP_DEFAULT_ZOOM = 1.5;
  var MAP_MIN_ZOOM = 1;
  var MAP_MAX_ZOOM = 10;

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

  function formatUpdatedNoteDateOnly(iso) {
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

  /** Full SGT stamp from analytics updatedAt; falls back to date-only if needed. */
  function formatUpdatedNote(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      var datePart = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(d);
      var timePart = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Singapore',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d).replace(/\u202f/g, ' ');
      if (!datePart || !timePart) return formatUpdatedNoteDateOnly(iso);
      return 'Last updated · ' + datePart + ' · ' + timePart + ' SGT';
    } catch (_) {
      return formatUpdatedNoteDateOnly(iso);
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
    if (!cities.length) return countries;
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
      visitorMap.countryLayer = null;
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

  var MAP_COUNTRY_COLORS = ['#dff3ff', '#def7f1', '#e8efff', '#e2f7f7', '#edf7ff'];

  function countryStyle(feature) {
    var colorIndex = feature && feature.properties
      ? Number(feature.properties._mapColorIndex) || 0
      : 0;
    return {
      color: '#ffffff',
      weight: 0.9,
      opacity: 1,
      fillColor: MAP_COUNTRY_COLORS[colorIndex % MAP_COUNTRY_COLORS.length],
      fillOpacity: 1,
      interactive: false,
      className: 'sc-reach-country'
    };
  }

  function ensureCountryLayer() {
    if (!visitorMap.map || !visitorMap.countries || typeof window.L === 'undefined') return;
    if (visitorMap.countryLayer) return;
    visitorMap.countryLayer = window.L.geoJSON(visitorMap.countries, {
      style: countryStyle
    }).addTo(visitorMap.map);
  }

  function resolvePlaceLatLng(place) {
    var lng = Number(place.lng);
    var lat = Number(place.lat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lat, lng];
    var coord = visitorMap.centroids && visitorMap.centroids[place.countryCode];
    if (!coord || coord.length < 2) return null;
    return [Number(coord[1]), Number(coord[0])];
  }

  function clusterDistanceForZoom(zoom) {
    if (zoom >= 6) return 26;
    if (zoom >= 4) return 38;
    if (zoom >= 2.5) return 52;
    return 68;
  }

  function buildLocationClusters(places) {
    if (!visitorMap.map) return [];
    var threshold = clusterDistanceForZoom(visitorMap.map.getZoom());
    var clusters = [];
    (places || []).forEach(function (place) {
      var latLng = resolvePlaceLatLng(place);
      if (!latLng) return;
      var pixel = visitorMap.map.latLngToLayerPoint(latLng);
      var target = null;
      for (var i = 0; i < clusters.length; i += 1) {
        var dx = clusters[i].pixel.x - pixel.x;
        var dy = clusters[i].pixel.y - pixel.y;
        if (Math.sqrt(dx * dx + dy * dy) <= threshold) {
          target = clusters[i];
          break;
        }
      }
      if (!target) {
        target = { places: [], visitors: 0, latTotal: 0, lngTotal: 0, pixel: pixel };
        clusters.push(target);
      }
      var weight = Math.max(1, place.visitors);
      target.places.push(place);
      target.visitors += place.visitors;
      target.latTotal += latLng[0] * weight;
      target.lngTotal += latLng[1] * weight;
    });
    clusters.forEach(function (cluster) {
      var weight = Math.max(1, cluster.visitors);
      cluster.latLng = [cluster.latTotal / weight, cluster.lngTotal / weight];
    });
    return clusters;
  }

  function clusterTooltipHtml(cluster) {
    if (cluster.places.length === 1) return tooltipHtml(cluster.places[0]);
    return (
      '<div class="sc-reach-map-tooltip">' +
        '<div class="sc-reach-map-tooltip-title">' +
          escapeHtml(numberFmt.format(cluster.places.length)) + ' locations' +
        '</div>' +
        '<div class="sc-reach-map-tooltip-meta">Visitors: ' +
          escapeHtml(numberFmt.format(cluster.visitors)) +
        '</div>' +
      '</div>'
    );
  }

  function renderLocationClusters() {
    if (!visitorMap.map || !visitorMap.markerLayer || typeof window.L === 'undefined') return false;
    visitorMap.markerLayer.clearLayers();
    var clusters = buildLocationClusters(visitorMap.places);
    if (!clusters.length) return false;
    var maxVisitors = clusters.reduce(function (max, cluster) {
      return Math.max(max, cluster.visitors);
    }, 1);
    clusters.forEach(function (cluster) {
      var strength = Math.sqrt(cluster.visitors / maxVisitors);
      var fillOpacity = Math.round((0.38 + strength * 0.5) * 100) / 100;
      var strokeOpacity = Math.min(0.96, fillOpacity + 0.12);
      var size = Math.round(18 + strength * 18);
      var multiClass = cluster.places.length > 1 ? ' is-multi' : '';
      var icon = window.L.divIcon({
        className: 'sc-reach-cluster-marker',
        html: '<span class="sc-reach-cluster-bubble' + multiClass +
          '" style="--cluster-fill:' + fillOpacity + ';--cluster-stroke:' + strokeOpacity +
          '" aria-hidden="true"></span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
      var marker = window.L.marker(cluster.latLng, {
        icon: icon,
        keyboard: true,
        title: numberFmt.format(cluster.visitors) + ' visitors'
      });
      marker.bindTooltip(clusterTooltipHtml(cluster), {
        direction: 'top',
        opacity: 1,
        className: 'sc-reach-map-leaflet-tooltip',
        sticky: false
      });
      if (cluster.places.length > 1) {
        marker.on('click', function () {
          visitorMap.map.setView(cluster.latLng, Math.min(MAP_MAX_ZOOM, visitorMap.map.getZoom() + 2));
        });
      }
      visitorMap.markerLayer.addLayer(marker);
    });
    return true;
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
      attributionControl: false,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: true,
      worldCopyJump: true
    });
    L.control.zoom({ position: 'topleft' }).addTo(visitorMap.map);
    ensureCountryLayer();
    visitorMap.markerLayer = L.layerGroup().addTo(visitorMap.map);
    visitorMap.map.on('moveend zoomend', function () {
      visitorMap.savedView = captureMapView();
      renderLocationClusters();
    });
    // Invalidate size after layout settles (aspect-ratio panel).
    setTimeout(function () {
      if (visitorMap.map) visitorMap.map.invalidateSize();
    }, 0);
    return visitorMap.map;
  }

  function renderVisitorMap(places) {
    var mapEl = document.getElementById('reach-visitor-map');
    if (!mapEl) {
      disposeVisitorMap();
      setMapEmptyState(true);
      return;
    }

    ensureMapAssets().then(function () {
      if (!visitorMap.centroids || !visitorMap.countries || typeof window.L === 'undefined') {
        disposeVisitorMap();
        setMapEmptyState(true);
        return;
      }

      ensureLeafletMap(mapEl);
      ensureCountryLayer();
      var hasClusters = renderLocationClusters();
      setMapEmptyState(!hasClusters);
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
    if (visitorMap.centroids && visitorMap.countries && typeof window.L !== 'undefined') {
      return Promise.resolve();
    }
    return loadLeaflet().then(function () {
      return Promise.all([
        fetch(CENTROIDS_URL, { cache: 'force-cache' }).then(function (res) {
          if (!res.ok) throw new Error('centroids ' + res.status);
          return res.json();
        }),
        fetch(WORLD_COUNTRIES_URL, { cache: 'force-cache' }).then(function (res) {
          if (!res.ok) throw new Error('world countries ' + res.status);
          return res.json();
        })
      ]);
    }).then(function (assets) {
      if (typeof window.L === 'undefined') throw new Error('leaflet missing');
      visitorMap.centroids = assets[0] || {};
      visitorMap.countries = assets[1] || null;
      if (visitorMap.countries && Array.isArray(visitorMap.countries.features)) {
        visitorMap.countries.features.forEach(function (feature, index) {
          feature.properties = feature.properties || {};
          feature.properties._mapColorIndex = index % MAP_COUNTRY_COLORS.length;
        });
      }
    });
  }

  function bindMapChrome() {
    if (!visitorMap.resizeBound) {
      visitorMap.resizeBound = true;
      window.addEventListener('resize', function () {
        if (visitorMap.map) {
          visitorMap.map.invalidateSize();
          renderLocationClusters();
        }
      });
    }
    if (!visitorMap.themeObserver && typeof MutationObserver !== 'undefined') {
      visitorMap.themeObserver = new MutationObserver(function () {
        if (!visitorMap.map) return;
        if (visitorMap.countryLayer) visitorMap.countryLayer.setStyle(countryStyle);
        renderLocationClusters();
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
      var updatedAt = (data.locations && data.locations.updatedAt) || data.updated_at || null;
      var text = formatUpdatedNote(updatedAt);
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
