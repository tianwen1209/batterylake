/* ═══════════════════════════════════════════════════════════════
   BatteryLake analytics — GA4 page views, custom download events,
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

  function callGtag() {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag.apply(window, arguments);
      }
    } catch (_) { /* no-op if blocked or unavailable */ }
  }

  function currentSourcePage() {
    return location.pathname + location.search + (location.hash || '#home');
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

  function trackDatasetDownload(params) {
    try {
      params = params || {};
      var payload = {
        source_page: params.source_page || currentSourcePage()
      };
      if (params.dataset_id) payload.dataset_id = params.dataset_id;
      if (params.dataset_name) payload.dataset_name = params.dataset_name;
      callGtag('event', 'dataset_download', payload);
    } catch (_) { /* no-op */ }
  }

  function trackSkillDownload(params) {
    try {
      params = params || {};
      var payload = {
        source_page: params.source_page || currentSourcePage()
      };
      if (params.skill_name) payload.skill_name = params.skill_name;
      if (params.file_name) payload.file_name = params.file_name;
      callGtag('event', 'preprocessing_skill_download', payload);
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
      setStatsLoading();
      return;
    }
    setStatValue('stat-website-visits', data.total_visits);
    setStatValue('stat-dataset-downloads', data.dataset_downloads);
    setStatValue('stat-skill-downloads', data.skill_downloads);
    var note = document.getElementById('stat-updated-note');
    if (note) {
      var text = formatUpdatedNote(data.updated_at);
      note.textContent = text;
      note.hidden = !text;
    }
  }

  function loadSiteStats() {
    setStatsLoading();
    fetch(STATS_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('stats ' + res.status);
        return res.json();
      })
      .then(applySiteStats)
      .catch(function () {
        setStatsLoading();
      });
  }

  window.BatteryLakeAnalytics = {
    measurementId: MEASUREMENT_ID,
    trackPageView: trackPageView,
    trackDatasetDownload: trackDatasetDownload,
    trackSkillDownload: trackSkillDownload,
    loadSiteStats: loadSiteStats
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSiteStats);
  } else {
    loadSiteStats();
  }
})();
