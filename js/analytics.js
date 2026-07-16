/* ═══════════════════════════════════════════════════════════════
   BatteryLake analytics — GA4 page views, custom download/run events,
   and public site-stats counters. Safe when gtag is blocked.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-5C061K2R5M';
  var STATS_URL = 'assets/data/site-stats.json';
  var WORLD_MAP_URL = 'assets/vendor/echarts/world.json';
  var CENTROIDS_URL = 'assets/vendor/echarts/country-centroids.json';
  var ECHARTS_URL = 'assets/vendor/echarts/echarts.min.js';
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
    chart: null,
    countries: [],
    worldReady: false,
    centroids: null,
    echartsLoading: null,
    resizeBound: false,
    themeObserver: null
  };

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

  function resolveLocations(data) {
    if (!data || typeof data !== 'object') {
      if (wantDevLocationSample()) {
        return {
          countries: normalizeCountries(DEV_SAMPLE_LOCATIONS.countries),
          updatedAt: null,
          isDevSample: true
        };
      }
      return { countries: [], updatedAt: null, isDevSample: false };
    }

    var locations = data.locations;
    if (locations != null && (typeof locations !== 'object' || Array.isArray(locations))) {
      // Malformed locations block — treat as missing.
      locations = null;
    }

    var countries = normalizeCountries(locations && locations.countries);
    if (countries.length) {
      return {
        countries: countries,
        updatedAt: (locations && locations.updatedAt) || data.updated_at || null,
        isDevSample: false
      };
    }
    if (wantDevLocationSample()) {
      return {
        countries: normalizeCountries(DEV_SAMPLE_LOCATIONS.countries),
        updatedAt: null,
        isDevSample: true
      };
    }
    return { countries: [], updatedAt: null, isDevSample: false };
  }

  function setMapEmptyState(showEmpty) {
    var empty = document.getElementById('reach-map-empty');
    var legend = document.getElementById('reach-map-legend');
    var mapEl = document.getElementById('reach-visitor-map');
    if (empty) empty.hidden = !showEmpty;
    if (legend) legend.hidden = showEmpty;
    if (mapEl) mapEl.style.visibility = showEmpty ? 'hidden' : 'visible';
  }

  function disposeVisitorMap() {
    if (visitorMap.chart) {
      try { visitorMap.chart.dispose(); } catch (_) { /* no-op */ }
      visitorMap.chart = null;
    }
  }

  function symbolSizeForVisitors(value, maxVisitors) {
    var minSize = 8;
    var maxSize = 28;
    if (!maxVisitors || maxVisitors <= 0) return minSize;
    var t = Math.sqrt(Math.max(0, value) / maxVisitors);
    return Math.round(minSize + t * (maxSize - minSize));
  }

  function buildMapOption(scatterData, maxVisitors) {
    var dark = isDarkTheme();
    var land = cssVar('--bg3', dark ? '#17263d' : '#e9eef7');
    var landBorder = cssVar('--border', dark ? '#263a59' : '#e4e9f2');
    var accent = cssVar('--accent', dark ? '#7db3ff' : '#2a5fea');
    var tooltipBg = cssVar('--surface', dark ? '#122037' : '#ffffff');
    var tooltipText = cssVar('--text1', dark ? '#f4f8ff' : '#151d2c');
    var tooltipMuted = cssVar('--text3', dark ? '#9fb0c7' : '#6b7689');

    return {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: tooltipBg,
        borderColor: landBorder,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: {
          color: tooltipText,
          fontSize: 12,
          fontFamily: cssVar('--sans', 'Source Sans 3, sans-serif')
        },
        formatter: function (params) {
          var data = params && params.data;
          if (!data || data.visitors == null) return '';
          return (
            '<div style="font-weight:600;margin-bottom:2px">' + data.country + '</div>' +
            '<div style="color:' + tooltipMuted + '">Visitors: ' +
            numberFmt.format(data.visitors) + '</div>'
          );
        }
      },
      geo: {
        map: 'world',
        roam: false,
        silent: true,
        zoom: 1.05,
        center: [10, 12],
        aspectScale: 0.75,
        itemStyle: {
          areaColor: land,
          borderColor: landBorder,
          borderWidth: 0.6
        },
        emphasis: {
          disabled: true
        }
      },
      series: [{
        type: 'scatter',
        coordinateSystem: 'geo',
        data: scatterData,
        symbol: 'circle',
        symbolSize: function (val) {
          var visitors = Array.isArray(val) ? val[2] : 0;
          return symbolSizeForVisitors(visitors, maxVisitors);
        },
        itemStyle: {
          color: accent,
          opacity: 0.72,
          shadowBlur: 0
        },
        emphasis: {
          scale: false,
          itemStyle: {
            opacity: 0.92
          }
        },
        zlevel: 1
      }]
    };
  }

  function buildScatterPoints(countries, centroids) {
    var maxVisitors = 0;
    var points = [];
    countries.forEach(function (row) {
      var coord = centroids[row.countryCode];
      if (!coord || coord.length < 2) return;
      if (row.visitors > maxVisitors) maxVisitors = row.visitors;
      points.push({
        name: row.country,
        country: row.country,
        countryCode: row.countryCode,
        visitors: row.visitors,
        value: [coord[0], coord[1], row.visitors]
      });
    });
    return { points: points, maxVisitors: maxVisitors };
  }

  function renderVisitorMap(countries) {
    var mapEl = document.getElementById('reach-visitor-map');
    if (!mapEl) {
      disposeVisitorMap();
      setMapEmptyState(true);
      return;
    }

    if (!countries || !countries.length) {
      disposeVisitorMap();
      setMapEmptyState(true);
      return;
    }

    ensureMapAssets().then(function () {
      if (!visitorMap.worldReady || !visitorMap.centroids || typeof window.echarts === 'undefined') {
        disposeVisitorMap();
        setMapEmptyState(true);
        return;
      }

      var built = buildScatterPoints(countries, visitorMap.centroids);
      if (!built.points.length) {
        disposeVisitorMap();
        setMapEmptyState(true);
        return;
      }

      setMapEmptyState(false);
      if (!visitorMap.chart) {
        visitorMap.chart = window.echarts.init(mapEl, null, { renderer: 'canvas' });
      }
      visitorMap.chart.setOption(buildMapOption(built.points, built.maxVisitors), true);
      visitorMap.chart.resize();
      bindMapChrome();
    }).catch(function () {
      disposeVisitorMap();
      setMapEmptyState(true);
    });
  }

  function loadEcharts() {
    if (typeof window.echarts !== 'undefined') return Promise.resolve();
    if (visitorMap.echartsLoading) return visitorMap.echartsLoading;
    visitorMap.echartsLoading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = ECHARTS_URL;
      script.async = true;
      script.onload = function () {
        if (typeof window.echarts === 'undefined') {
          reject(new Error('echarts failed to initialize'));
          return;
        }
        resolve();
      };
      script.onerror = function () {
        visitorMap.echartsLoading = null;
        reject(new Error('echarts failed to load'));
      };
      document.head.appendChild(script);
    });
    return visitorMap.echartsLoading;
  }

  function ensureMapAssets() {
    if (visitorMap.worldReady && visitorMap.centroids && typeof window.echarts !== 'undefined') {
      return Promise.resolve();
    }
    return loadEcharts().then(function () {
      return Promise.all([
        fetch(WORLD_MAP_URL, { cache: 'force-cache' }).then(function (res) {
          if (!res.ok) throw new Error('world map ' + res.status);
          return res.json();
        }),
        fetch(CENTROIDS_URL, { cache: 'force-cache' }).then(function (res) {
          if (!res.ok) throw new Error('centroids ' + res.status);
          return res.json();
        })
      ]);
    }).then(function (results) {
      if (typeof window.echarts === 'undefined') throw new Error('echarts missing');
      if (!visitorMap.worldReady) {
        window.echarts.registerMap('world', results[0]);
        visitorMap.worldReady = true;
      }
      visitorMap.centroids = results[1] || {};
    });
  }

  function bindMapChrome() {
    if (!visitorMap.resizeBound) {
      visitorMap.resizeBound = true;
      window.addEventListener('resize', function () {
        if (visitorMap.chart) visitorMap.chart.resize();
      });
    }
    if (!visitorMap.themeObserver && typeof MutationObserver !== 'undefined') {
      visitorMap.themeObserver = new MutationObserver(function () {
        if (visitorMap.countries && visitorMap.countries.length) {
          renderVisitorMap(visitorMap.countries);
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
    visitorMap.countries = resolved.countries;
    renderVisitorMap(resolved.countries);
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
