/* ═══════════════════════════════════════════════════════════════
   SHOWCASE ENGINE — scroll reveals + interactive console
   Pages: Home, Quality Assessment, Platform APIs
   Additive only; safe if elements are absent.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Scroll-reveal engine ─────────────────────────────────
     Elements with .reveal get .in-view when they enter the
     viewport. Works across SPA page switches because hidden
     (display:none) elements simply never intersect until shown. */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        } else {
          // re-arm so the animation plays again on the next scroll-in
          entry.target.classList.remove('in-view');
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ── 2. Count-up numbers (data-count / data-count-decimals) ── */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
    var suffix = el.getAttribute('data-count-suffix') || '';
    if (reducedMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }
    var dur = 1300, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCountUps() {
    var els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(countUp); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // replay the count-up each time the element scrolls back into view
        if (entry.isIntersecting) countUp(entry.target);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ── 3. Home metric band: replay main.js count-up on view ─── */
  function initHomeMetricsReplay() {
    var panel = document.getElementById('metrics-panel');
    if (!panel || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // replay the metric count-up on every scroll-in
        if (entry.isIntersecting &&
            typeof window.animateHomeMetrics === 'function' && !reducedMotion) {
          window.animateHomeMetrics();
        }
      });
    }, { threshold: 0.3 });
    io.observe(panel);
  }

  /* ── 4. Quality page: dimension cards ↔ JSON report sync ──── */
  function initQualityCards() {
    var cards = document.querySelectorAll('#page-quality .quality-card');
    var lines = document.querySelectorAll('#page-quality .qa-code .qa-line');
    if (!cards.length) return;
    cards.forEach(function (card) {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      function select() {
        var key = card.getAttribute('data-dim');
        var isSel = card.classList.contains('qa-selected');
        cards.forEach(function (c) { c.classList.remove('qa-selected'); });
        lines.forEach(function (l) { l.classList.remove('hl'); });
        if (isSel) return; // toggle off
        card.classList.add('qa-selected');
        lines.forEach(function (l) {
          if (l.getAttribute('data-dim') === key) l.classList.add('hl');
        });
      }
      card.addEventListener('click', select);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
    });
  }

  /* ── 5. API console: route library drives the whole board ─── */
  var API_ROUTES = {
    catalog: {
      method: 'GET', methodClass: '',
      title: 'Dataset catalog endpoint',
      sub: 'Designed for search, filtering, and benchmark preparation. The response returns only datasets that pass the required ETL and quality gates.',
      path: '/v1/datasets?chemistry=LCO&quality=ready',
      status: 'Available',
      params: [
        ['chemistry', 'LCO | LFP | NMC'],
        ['format', 'CSV | Parquet'],
        ['split_ready', 'true']
      ],
      fields: ['dataset_id', 'cell_count', 'cycle_count', 'quality_score'],
      code: 'import requests\n\nresp = requests.get(\n  <span class="accent">"https://api.batterylake.org/v1/datasets"</span>,\n  headers={"Authorization": "Bearer BT_TOKEN"},\n  params={"chemistry": "LCO", "quality": "ready"}\n)\n\nfor dataset in resp.json()["items"]:\n  print(dataset["name"], dataset["quality_score"])',
      response: '{\n  <span class="k">"count"</span>: <span class="n">2</span>,\n  <span class="k">"items"</span>: [\n    {\n      <span class="k">"dataset_id"</span>: <span class="s">"dataset_03"</span>,\n      <span class="k">"ref_name"</span>: <span class="s">"2007_NASA_PCoE_LCO_18650_1C_1C_25T"</span>,\n      <span class="k">"cell_count"</span>: <span class="n">34</span>,\n      <span class="k">"cycle_count"</span>: <span class="n">27400</span>,\n      <span class="k">"quality_score"</span>: <span class="n">0.96</span>\n    },\n    {\n      <span class="k">"dataset_id"</span>: <span class="s">"dataset_07"</span>,\n      <span class="k">"ref_name"</span>: <span class="s">"2017_CALCE_UMD_LCO_Prismatic_MultiC_MultiT"</span>,\n      <span class="k">"cell_count"</span>: <span class="n">18</span>,\n      <span class="k">"cycle_count"</span>: <span class="n">12730</span>,\n      <span class="k">"quality_score"</span>: <span class="n">0.94</span>\n    }\n  ]\n}'
    },
    timeseries: {
      method: 'GET', methodClass: '',
      title: 'Cell time-series endpoint',
      sub: 'Stream voltage, current, and temperature measurements for a single cell, sliced by cycle range. Ideal for feature pipelines and visual QC.',
      path: '/v1/cells/B0005/timeseries?cycles=180-190',
      status: 'Available',
      params: [
        ['cell_id', 'e.g. B0005'],
        ['cycles', 'range 180-190'],
        ['channels', 'V | I | T']
      ],
      fields: ['timestamp', 'voltage_V', 'current_A', 'temperature_C'],
      code: 'import requests\n\nresp = requests.get(\n  <span class="accent">"https://api.batterylake.org/v1/cells/B0005/timeseries"</span>,\n  headers={"Authorization": "Bearer BT_TOKEN"},\n  params={"cycles": "180-190", "channels": "V,I,T"}\n)\n\ndf = pd.DataFrame(resp.json()["points"])\ndf.plot(x="t", y="voltage_V")',
      response: '{\n  <span class="k">"cell_id"</span>: <span class="s">"B0005"</span>,\n  <span class="k">"cycle"</span>: <span class="n">187</span>,\n  <span class="k">"points"</span>: [\n    { <span class="k">"t"</span>: <span class="n">0.0</span>, <span class="k">"voltage_V"</span>: <span class="n">4.19</span>, <span class="k">"current_A"</span>: <span class="n">-2.0</span>, <span class="k">"temperature_C"</span>: <span class="n">24.3</span> },\n    { <span class="k">"t"</span>: <span class="n">1.0</span>, <span class="k">"voltage_V"</span>: <span class="n">4.11</span>, <span class="k">"current_A"</span>: <span class="n">-2.0</span>, <span class="k">"temperature_C"</span>: <span class="n">24.9</span> },\n    { <span class="k">"t"</span>: <span class="n">2.0</span>, <span class="k">"voltage_V"</span>: <span class="n">4.05</span>, <span class="k">"current_A"</span>: <span class="n">-2.0</span>, <span class="k">"temperature_C"</span>: <span class="n">25.6</span> }\n  ]\n}'
    },
    benchmark: {
      method: 'POST', methodClass: 'post',
      title: 'Benchmark run endpoint',
      sub: 'Create a reproducible SOH or RUL experiment: pick datasets, a split protocol, and a model. The run executes against pinned seeds and returns comparable metrics.',
      path: '/v1/benchmarks',
      status: 'In progress',
      params: [
        ['task', 'SOH | RUL'],
        ['split', 'random | temporal | cross-cell'],
        ['model', 'lstm | xgboost | transformer']
      ],
      fields: ['run_id', 'rmse', 'mae', 'mape'],
      code: 'import requests\n\nresp = requests.post(\n  <span class="accent">"https://api.batterylake.org/v1/benchmarks"</span>,\n  headers={"Authorization": "Bearer BT_TOKEN"},\n  json={\n    "task": "SOH",\n    "datasets": ["dataset_03"],\n    "split": {"protocol": "cross-cell", "seed": 42},\n    "model": "lstm"\n  }\n)\nprint(resp.json()["run_id"])',
      response: '{\n  <span class="k">"run_id"</span>: <span class="s">"bench_20260707_0042"</span>,\n  <span class="k">"task"</span>: <span class="s">"SOH"</span>,\n  <span class="k">"model"</span>: <span class="s">"lstm"</span>,\n  <span class="k">"split"</span>: <span class="s">"cross-cell"</span>,\n  <span class="k">"metrics"</span>: {\n    <span class="k">"rmse"</span>: <span class="n">0.0121</span>,\n    <span class="k">"mae"</span>: <span class="n">0.0094</span>,\n    <span class="k">"mape"</span>: <span class="n">1.08</span>\n  },\n  <span class="k">"artifacts"</span>: <span class="s">"s3://batterylake-runs/bench_20260707_0042/"</span>\n}'
    },
    recipe: {
      method: 'POST', methodClass: 'post',
      title: 'Feature recipe endpoint',
      sub: 'Submit formula features for the preprocessing stage. Recipes are validated against the unified schema, then computed per cycle across the selected datasets.',
      path: '/v1/features/recipes',
      status: 'Planned',
      params: [
        ['recipe', 'formula TXT'],
        ['scope', 'dataset | cell'],
        ['validate_only', 'true | false']
      ],
      fields: ['recipe_id', 'features', 'status', 'warnings'],
      code: 'import requests\n\nrecipe = open("feature_schema.txt").read()\n\nresp = requests.post(\n  <span class="accent">"https://api.batterylake.org/v1/features/recipes"</span>,\n  headers={"Authorization": "Bearer BT_TOKEN"},\n  json={"recipe": recipe, "scope": "dataset"}\n)\nprint(resp.json()["status"])',
      response: '{\n  <span class="k">"recipe_id"</span>: <span class="s">"rcp_8f31"</span>,\n  <span class="k">"status"</span>: <span class="s">"validated"</span>,\n  <span class="k">"features"</span>: [\n    <span class="s">"dqdv_peak_1"</span>,\n    <span class="s">"cv_time_ratio"</span>,\n    <span class="s">"ir_drop_mean"</span>\n  ],\n  <span class="k">"warnings"</span>: []\n}'
    }
  };

  function initApiConsole() {
    var rail = document.getElementById('api-route-rail');
    if (!rail) return;
    var routes = rail.querySelectorAll('.api-route');
    var boardSwap = document.getElementById('api-board-swap');
    var codeSwap = document.getElementById('api-code-swap');
    var titleEl = document.getElementById('api-ep-title');
    var subEl = document.getElementById('api-ep-sub');
    var statusEl = document.getElementById('api-ep-status');
    var pathEl = document.getElementById('api-ep-path');
    var paramsEl = document.getElementById('api-ep-params');
    var fieldsEl = document.getElementById('api-ep-fields');
    var codeEl = document.getElementById('api-ep-code');
    var respView = document.getElementById('api-response-view');
    var respBody = document.getElementById('api-response-body');
    var runBtn = document.getElementById('api-run-btn');
    var runStatus = document.getElementById('api-run-status');
    var current = 'catalog';

    function render(key) {
      var r = API_ROUTES[key];
      if (!r) return;
      current = key;
      titleEl.textContent = r.title;
      subEl.textContent = r.sub;
      statusEl.textContent = r.status;
      pathEl.innerHTML = '<span>' + r.method + '</span>' + r.path;
      paramsEl.innerHTML = r.params.map(function (p) {
        return '<div class="api-param"><span>' + p[0] + '</span><strong>' + p[1] + '</strong></div>';
      }).join('');
      fieldsEl.innerHTML = r.fields.map(function (f) {
        return '<div>' + f + '</div>';
      }).join('');
      codeEl.innerHTML = r.code;
      // reset response area
      if (respView) respView.classList.remove('open');
      if (runStatus) runStatus.textContent = '';
    }

    function swapTo(key) {
      if (key === current) return;
      var panels = [boardSwap, codeSwap].filter(Boolean);
      panels.forEach(function (p) { p.classList.add('swapping'); });
      setTimeout(function () {
        render(key);
        panels.forEach(function (p) { p.classList.remove('swapping'); });
      }, reducedMotion ? 0 : 200);
    }

    routes.forEach(function (btn) {
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('role', 'button');
      function activate() {
        routes.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        swapTo(btn.getAttribute('data-route'));
      }
      btn.addEventListener('click', activate);
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });

    if (runBtn) {
      runBtn.addEventListener('click', function () {
        var r = API_ROUTES[current];
        runBtn.disabled = true;
        if (runStatus) runStatus.textContent = 'requesting…';
        if (respView) respView.classList.remove('open');
        setTimeout(function () {
          if (respBody) respBody.innerHTML = r.response;
          if (respView) respView.classList.add('open');
          if (runStatus) runStatus.innerHTML = '<span class="ok">200 OK</span> · 84 ms · simulated preview';
          runBtn.disabled = false;
        }, reducedMotion ? 60 : 620);
      });
    }

    // copy button
    var copyBtn = document.getElementById('api-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = codeEl ? codeEl.textContent : '';
        function done() {
          copyBtn.textContent = 'copied ✓';
          setTimeout(function () { copyBtn.textContent = 'copy'; }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, done);
        } else { done(); }
      });
    }

    render('catalog');
  }

  /* ── init ────────────────────────────────────────────────── */
  function init() {
    initReveal();
    initCountUps();
    initHomeMetricsReplay();
    initQualityCards();
    initApiConsole();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
