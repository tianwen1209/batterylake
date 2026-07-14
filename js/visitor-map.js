/* ═══════════════════════════════════════════════════════════════
   HOME — Global Reach visitor map
   Mock city/country-level visit aggregates + Leaflet rendering.
   No IP addresses or precise locations are collected in the frontend.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Mock visitor data (city / country centroids only) ────────
     Replace this block when wiring a real analytics backend.
     Shape: { id, city?, country, lat, lng, visits }              */
  var MOCK_VISITOR_LOCATIONS = [
    { id: 'sg-singapore', city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, visits: 1480 },
    { id: 'cn-shanghai', city: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737, visits: 920 },
    { id: 'cn-beijing', city: 'Beijing', country: 'China', lat: 39.9042, lng: 116.4074, visits: 710 },
    { id: 'us-boston', city: 'Boston', country: 'United States', lat: 42.3601, lng: -71.0589, visits: 640 },
    { id: 'us-bay-area', city: 'Bay Area', country: 'United States', lat: 37.5485, lng: -122.1089, visits: 580 },
    { id: 'de-munich', city: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.5820, visits: 460 },
    { id: 'gb-london', city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, visits: 420 },
    { id: 'jp-tokyo', city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, visits: 390 },
    { id: 'kr-seoul', city: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.9780, visits: 340 },
    { id: 'au-sydney', city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, visits: 280 },
    { id: 'fr-grenoble', city: 'Grenoble', country: 'France', lat: 45.1885, lng: 5.7245, visits: 210 },
    { id: 'ca-toronto', city: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, visits: 190 },
    { id: 'in-bengaluru', city: 'Bengaluru', country: 'India', lat: 12.9716, lng: 77.5946, visits: 175 },
    { id: 'nl-eindhoven', city: 'Eindhoven', country: 'Netherlands', lat: 51.4416, lng: 5.4697, visits: 150 },
    { id: 'se-stockholm', city: 'Stockholm', country: 'Sweden', lat: 59.3293, lng: 18.0686, visits: 120 }
  ];

  var SINGAPORE = [1.3521, 103.8198];
  var DEFAULT_ZOOM = 2;
  var mapInstance = null;
  var tileLayer = null;
  var initialized = false;

  function formatNumber(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function summarizeLocations(locations) {
    var totalVisits = 0;
    var countries = {};
    locations.forEach(function (loc) {
      totalVisits += loc.visits || 0;
      if (loc.country) countries[loc.country] = true;
    });
    return {
      locations: locations,
      totalVisits: totalVisits,
      regionCount: Object.keys(countries).length
    };
  }

  /* Future: fetch aggregated visitor stats from an analytics API
     (city/country-level only — never IP or precise coordinates).
     Example:
       return fetch('/api/visitor-stats').then(function (r) { return r.json(); });
     Keep the response shape:
       { locations: [...], totalVisits: number, regionCount: number } */
  function loadVisitorStats() {
    return Promise.resolve(summarizeLocations(MOCK_VISITOR_LOCATIONS));
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function tileUrl() {
    // Carto basemaps — light Positron / dark Matter
    return isDarkTheme()
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  }

  function markerStyle(visits, maxVisits) {
    var t = maxVisits > 0 ? visits / maxVisits : 0;
    var radius = 6 + t * 18;
    var opacity = 0.28 + t * 0.52;
    var accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim() || '#2a5fea';
    return {
      radius: radius,
      color: accent,
      weight: 1.5,
      opacity: Math.min(0.95, opacity + 0.2),
      fillColor: accent,
      fillOpacity: opacity
    };
  }

  function renderStats(stats) {
    var visitsEl = document.getElementById('visitor-stat-visits');
    var regionsEl = document.getElementById('visitor-stat-regions');
    if (visitsEl) visitsEl.textContent = formatNumber(stats.totalVisits);
    if (regionsEl) regionsEl.textContent = formatNumber(stats.regionCount);
  }

  function renderMarkers(map, locations) {
    var maxVisits = 0;
    locations.forEach(function (loc) {
      if (loc.visits > maxVisits) maxVisits = loc.visits;
    });

    locations.forEach(function (loc) {
      var style = markerStyle(loc.visits, maxVisits);
      var label = loc.city
        ? loc.city + ', ' + loc.country
        : loc.country;
      var circle = L.circleMarker([loc.lat, loc.lng], style);
      circle.bindTooltip(
        '<strong>' + label + '</strong><br>' +
        formatNumber(loc.visits) + ' visits',
        { direction: 'top', offset: [0, -4], opacity: 0.95 }
      );
      circle.addTo(map);
    });
  }

  function syncTileLayer() {
    if (!mapInstance) return;
    if (tileLayer) mapInstance.removeLayer(tileLayer);
    tileLayer = L.tileLayer(tileUrl(), {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18
    }).addTo(mapInstance);
  }

  function invalidateMap() {
    if (!mapInstance) return;
    setTimeout(function () {
      mapInstance.invalidateSize();
    }, 80);
  }

  function buildMap(stats) {
    var el = document.getElementById('visitor-map');
    if (!el || typeof L === 'undefined') return;

    mapInstance = L.map(el, {
      center: SINGAPORE,
      zoom: DEFAULT_ZOOM,
      minZoom: 1,
      maxZoom: 8,
      worldCopyJump: true,
      scrollWheelZoom: false,
      attributionControl: true
    });

    syncTileLayer();
    renderMarkers(mapInstance, stats.locations);
    renderStats(stats);

    // Enable scroll-zoom only while the map is focused / hovered
    el.addEventListener('mouseenter', function () { mapInstance.scrollWheelZoom.enable(); });
    el.addEventListener('mouseleave', function () { mapInstance.scrollWheelZoom.disable(); });

    invalidateMap();
  }

  function initVisitorMap() {
    var home = document.getElementById('page-home');
    var el = document.getElementById('visitor-map');
    if (!el || typeof L === 'undefined') return;
    // Wait until Home is shown so Leaflet measures a non-zero container
    if (home && !home.classList.contains('active')) return;

    if (initialized) {
      invalidateMap();
      return;
    }
    initialized = true;

    loadVisitorStats().then(function (stats) {
      buildMap(stats);
    }).catch(function () {
      // Fail soft — section stays empty rather than breaking Home
      initialized = false;
    });
  }

  // Init / re-fit when the Home page becomes visible (SPA navigations)
  function watchHomeVisibility() {
    var home = document.getElementById('page-home');
    if (!home || typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function () {
      if (home.classList.contains('active')) initVisitorMap();
    });
    mo.observe(home, { attributes: true, attributeFilter: ['class'] });
  }

  function watchTheme() {
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function () {
      syncTileLayer();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  function init() {
    initVisitorMap();
    watchHomeVisibility();
    watchTheme();
    window.addEventListener('resize', invalidateMap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BatteryLakeVisitorMap = {
    refresh: invalidateMap,
    init: initVisitorMap
  };
})();
