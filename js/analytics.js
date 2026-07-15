/* ═══════════════════════════════════════════════════════════════
   BatteryLake analytics — GA4 page views, custom download/run events,
   and public site-stats counters. Safe when gtag is blocked.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-5C061K2R5M';
  var STATS_URL = 'assets/data/site-stats.json';
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

  function applySiteStats(data) {
    if (!data || typeof data !== 'object') {
      modelStatsCache.downloads = Object.create(null);
      modelStatsCache.runs = Object.create(null);
      setStatsLoading();
      refreshModelUsageTags();
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
      note.textContent = text;
      note.hidden = !text;
    }
  }

  function loadSiteStats() {
    setStatsLoading();
    modelStatsCache.downloads = Object.create(null);
    modelStatsCache.runs = Object.create(null);
    refreshModelUsageTags();
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
