/* ═══════════════════════════════════════════════════════════════
   BatteryLake — Contribute page
   Describe → Upload → Submit.
     1. Describe: the metadata the catalog needs plus the notes the
        batterylake-processing skill needs (protocol, file layout, cell ids).
        The naming-standard ref_name and metadata.json are generated live.
     2. Upload: raw files go straight from the browser to the contribution
        store (chunked, resumable) through the upload endpoint configured in
        js/ai-config.js. The first small CSV/JSON is also pre-checked with the
        quality engine. A public link can be given instead.
     3. Submit: submission.json (metadata + checklist + file list) is stored
        next to the files; a prefilled GitHub issue notifies the team.

   Upload protocol (implemented by deploy/cloudflare-worker/worker.js with R2
   and by app.py for self-hosting):
     GET  {endpoint}/status                     -> {enabled, part_size, max_gb}
     POST {endpoint}/init     {ref_name, file_name, size, content_type}
                                                -> {key, upload_id, part_size}
     PUT  {endpoint}/part?key&upload_id&part=N  (bytes) -> {etag}
     POST {endpoint}/complete {key, upload_id, parts:[{part, etag}]} -> {key, size}
     POST {endpoint}/abort    {key, upload_id}
     PUT  {endpoint}/object?key   (small JSON)  -> {key}

   Exposes window.BatteryLakeContribute for the AI agent.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'batteryLakeContributionDraftV2';
  var ISSUE_URL = 'https://github.com/tianwen1209/BatteryLake-Benchmark-DataPrep/issues/new';
  var PRECHECK_MAX_BYTES = 25 * 1024 * 1024;
  var CATEGORIES = [
    ['cycle_aging', 'Cycle aging'], ['calendar_aging', 'Calendar aging'], ['characterization', 'Characterization'],
    ['field_data', 'Field data'], ['field_fault_diagnosis', 'Field fault diagnosis'], ['soh_estimation', 'SOH estimation'],
    ['soc_estimation', 'SOC estimation'], ['eis', 'EIS / impedance'], ['thermal_runaway', 'Thermal runaway / safety'], ['ev', 'EV fleet']
  ];
  var FIELDS = [
    { key: 'name', group: 'meta', label: 'Dataset name', required: true, placeholder: 'e.g. NTU LFP 18650 fast-charge aging' },
    { key: 'institution', group: 'meta', label: 'Institution / lab', required: true, placeholder: 'e.g. NTU_EEE', hint: 'Becomes the Source token of the reference name' },
    { key: 'year', group: 'meta', label: 'Year', required: true, type: 'number', placeholder: String(new Date().getFullYear()), min: 2000, max: 2100 },
    { key: 'chemistry', group: 'meta', label: 'Chemistry', required: true, type: 'select', options: ['LFP', 'NMC', 'NMC811', 'NCA', 'LCO', 'LMO', 'LTO', 'LiIon', 'MultiChem'] },
    { key: 'form', group: 'meta', label: 'Form factor', required: true, type: 'select', options: ['18650', '21700', 'Pouch', 'Prismatic', 'Cyl', 'Auto', 'EV-BMS'] },
    { key: 'cells', group: 'meta', label: 'Number of cells', required: true, type: 'number', min: 1, placeholder: 'e.g. 24' },
    { key: 'capacity_ah', group: 'meta', label: 'Nominal capacity (Ah)', required: true, type: 'number', step: '0.01', placeholder: 'e.g. 2.5' },
    { key: 'charge_c', group: 'meta', label: 'Charge rate', required: true, placeholder: '1C, 0.5C or Multi' },
    { key: 'discharge_c', group: 'meta', label: 'Discharge rate', required: true, placeholder: '1C or Multi' },
    { key: 'temperature', group: 'meta', label: 'Test temperature (°C)', required: true, placeholder: '25 or Multi' },
    { key: 'category', group: 'meta', label: 'Category', type: 'select', options: CATEGORIES },
    { key: 'doi', group: 'meta', label: 'Paper or data DOI / URL', placeholder: 'https://doi.org/…' },
    { key: 'license', group: 'meta', label: 'License', type: 'select', options: ['CC BY 4.0', 'CC BY-NC 4.0', 'CC BY-SA 4.0', 'CC0 1.0', 'MIT', 'ODC-By 1.0', 'Custom (state in notes)'] },
    { key: 'contact', group: 'meta', label: 'Contact email', type: 'email', placeholder: 'name@university.edu' },
    { key: 'protocol', group: 'skill', label: 'Test protocol', required: true, type: 'textarea', wide: true, placeholder: 'Charge / discharge procedure, rest periods, formation cycles, RPT schedule, cut-off voltages, equipment, sampling rate…', hint: 'The skill decides cycle boundaries and labels from this' },
    { key: 'layout', group: 'skill', label: 'File layout and cell identifiers', type: 'textarea', wide: true, placeholder: 'One file per cell? How are cells named in the files? Which columns hold time, voltage, current, temperature, capacity? Units? Any clock resets or duplicated cycle numbers?', hint: 'Saves the reviewers a round of questions' },
    { key: 'notes', group: 'skill', label: 'Known issues / notes', type: 'textarea', wide: true, placeholder: 'Missing channels, interrupted tests, partial cycles, publication status…' }
  ];
  var GATES = [
    ['I', 'Inventory', 'Every archive member is listed with size and SHA-256.'],
    ['S', 'Semantics', 'Field mapping, cell identity, units, clocks and labels are decided from your notes.'],
    ['C', 'Conversion', 'A re-runnable adapter writes all source measurements into the canonical layer.'],
    ['V', 'Fidelity', 'Record-by-record comparison of raw and standard values.'],
    ['E', 'Equivalence', 'Raw and standard loaders give the same benchmark inputs before a task view is published.']
  ];
  var DONE_RE = /done|complete|verified|passed|validated|inventoried|decoded|converted|checked/i;
  var PARTIAL_RE = /pending|not_run|not run|only|partial|converting|error|sample|unverified|unavailable|separate|needs|review|subset/i;

  var state = {
    fields: {}, precheck: null, precheckName: '', status: null, statusName: '',
    uploads: [],            // [{name, size, key, done, error}]
    uploadEnabled: null,    // null = unknown, true / false after the first probe
    uploading: false, submitted: null, initialized: false
  };
  var queue = [];           // File objects waiting to upload

  /* ── helpers ─────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function toast(msg, type, ms) { if (typeof window.showToast === 'function') window.showToast(msg, type || 'info', ms || 3500); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function val(key) { return String(state.fields[key] == null ? '' : state.fields[key]).trim(); }
  function isUrl(s) { return /^https?:\/\/\S+$/i.test(s); }
  function fmtBytes(n) { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB'; if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'; if (n >= 1e3) return Math.round(n / 1e3) + ' KB'; return n + ' B'; }
  function token(s) { return String(s || '').trim().replace(/\s*[-–]\s*/g, '-').replace(/[\s/]+/g, '_').replace(/[^A-Za-z0-9_\-.]/g, ''); }
  function rateToken(s) {
    var v = String(s || '').trim();
    if (!v) return '';
    if (/multi|various|mixed|several/i.test(v)) return 'MultiC';
    var n = v.match(/^(\d+(?:\.\d+)?)\s*c?$/i);
    if (n) return n[1] + 'C';
    return token(v).replace(/c$/i, 'C');
  }
  function tempToken(s) {
    var v = String(s || '').trim().replace(/°\s*c$/i, '').replace(/\s*c$/i, '').trim();
    if (!v) return '';
    if (/multi|various|mixed|several/i.test(v)) return 'MultiT';
    var range = v.match(/^(-?\d+)\s*[-–~to]+\s*(-?\d+)$/i);
    if (range) return range[1] + '-' + range[2] + 'T';
    var n = v.match(/^(-?\d+(?:\.\d+)?)$/);
    if (n) return n[1] + 'T';
    return token(v) + 'T';
  }
  function refName() {
    var parts = [val('year') || '', token(val('institution')), val('chemistry'), val('form'), rateToken(val('charge_c')), rateToken(val('discharge_c')), tempToken(val('temperature'))];
    return { parts: parts, name: parts.map(function (p) { return p || '?'; }).join('_'), complete: parts.every(Boolean) };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ fields: state.fields, uploads: state.uploads.filter(function (u) { return u.done; }), submitted: state.submitted })); } catch (_) { /* ignore */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw) || {};
      state.fields = d.fields || {};
      state.uploads = Array.isArray(d.uploads) ? d.uploads : [];
      state.submitted = d.submitted || null;
    } catch (_) { state.fields = {}; }
  }
  function endpoint() {
    var cfg = window.BATTERYLAKE_AI_CONFIG || {};
    var override = null;
    try { override = localStorage.getItem('batteryLakeUploadEndpoint'); } catch (_) { override = null; }
    return String(override || cfg.uploadEndpoint || '').replace(/\/+$/, '');
  }

  /* ── form ────────────────────────────────────────────────────── */
  function renderForm() {
    var groups = { meta: $('cb-form-meta'), skill: $('cb-form-skill') };
    if (!groups.meta || groups.meta.dataset.rendered) return;
    groups.meta.dataset.rendered = '1';
    FIELDS.forEach(function (f) {
      var id = 'cb-f-' + f.key;
      var control;
      if (f.type === 'select') {
        var opts = f.options.map(function (o) {
          var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
          return '<option value="' + escapeHtml(v) + '">' + escapeHtml(l) + '</option>';
        }).join('');
        control = '<select id="' + id + '" data-key="' + f.key + '"><option value="">' + (f.required ? 'Select…' : 'Optional…') + '</option>' + opts + '</select>';
      } else if (f.type === 'textarea') {
        control = '<textarea id="' + id + '" data-key="' + f.key + '" rows="4" placeholder="' + escapeHtml(f.placeholder || '') + '"></textarea>';
      } else {
        control = '<input id="' + id + '" data-key="' + f.key + '" type="' + (f.type || 'text') + '" placeholder="' + escapeHtml(f.placeholder || '') + '"' +
          (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + (f.step ? ' step="' + f.step + '"' : '') + '>';
      }
      var html = '<label class="cb-field' + (f.wide ? ' is-wide' : '') + '" for="' + id + '">' +
        '<span class="cb-field-label">' + escapeHtml(f.label) + (f.required ? ' <b>*</b>' : '') + '</span>' + control +
        (f.hint ? '<span class="cb-field-hint">' + escapeHtml(f.hint) + '</span>' : '') + '</label>';
      (groups[f.group] || groups.meta).insertAdjacentHTML('beforeend', html);
    });
    ['meta', 'skill'].forEach(function (g) { if (groups[g]) { groups[g].addEventListener('input', onFieldInput); groups[g].addEventListener('change', onFieldInput); } });
  }
  function onFieldInput(event) {
    var el = event.target;
    if (!el || !el.dataset || !el.dataset.key) return;
    state.fields[el.dataset.key] = el.value;
    save();
    refresh();
  }
  function syncFormFromState() {
    FIELDS.forEach(function (f) {
      var el = $('cb-f-' + f.key);
      if (el && el.value !== (state.fields[f.key] || '')) el.value = state.fields[f.key] || '';
    });
    var link = $('cb-data-link');
    if (link && link.value !== (state.fields.data_url || '')) link.value = state.fields.data_url || '';
  }

  /* ── readiness ───────────────────────────────────────────────── */
  function labelOf(key) { var f = FIELDS.filter(function (x) { return x.key === key; })[0]; return f ? f.label : key; }
  function requiredFilled() {
    return FIELDS.filter(function (f) { return f.required; }).map(function (f) { return { key: f.key, label: f.label, ok: !!val(f.key) }; });
  }
  function uploadedFiles() { return state.uploads.filter(function (u) { return u.done; }); }
  function readiness() {
    var rn = refName();
    var identityMissing = ['name', 'institution', 'year', 'chemistry', 'form'].filter(function (k) { return !val(k); });
    var protoMissing = ['cells', 'capacity_ah', 'charge_c', 'discharge_c', 'temperature'].filter(function (k) { return !val(k); });
    var done = uploadedFiles();
    var bytes = done.reduce(function (a, u) { return a + (Number(u.size) || 0); }, 0);
    var link = val('data_url');
    var items = [
      { key: 'identity', label: 'Identity and reference name', tag: 'Required',
        state: identityMissing.length ? 'todo' : 'ok',
        text: identityMissing.length ? 'Fill ' + identityMissing.map(labelOf).join(', ') + ' to complete the reference name.' : 'ref_name `' + rn.name + '`' },
      { key: 'metadata', label: 'Cell and protocol metadata', tag: 'Required',
        state: protoMissing.length ? 'todo' : 'ok',
        text: protoMissing.length ? 'Missing ' + protoMissing.map(labelOf).join(', ') + '.' : val('cells') + ' cells · ' + val('capacity_ah') + ' Ah · ' + rateToken(val('charge_c')) + '/' + rateToken(val('discharge_c')) + ' · ' + tempToken(val('temperature')) },
      { key: 'skill', label: 'Notes for the processing skill', tag: 'Required',
        state: val('protocol').length >= 80 ? (val('layout') ? 'ok' : 'warn') : (val('protocol') ? 'warn' : 'todo'),
        text: val('protocol').length >= 80 ? (val('layout') ? 'Protocol and file layout described.' : 'Protocol described; add a line on the file layout and cell identifiers.') : (val('protocol') ? 'A few more protocol details please (rest periods, cut-offs, RPT schedule).' : 'Describe the test protocol (charge / discharge steps, rests, RPT schedule, cut-offs).') },
      { key: 'attribution', label: 'Attribution and license', tag: 'Required',
        state: val('doi') && val('license') ? 'ok' : (val('doi') || val('license') ? 'warn' : 'todo'),
        text: val('doi') && val('license') ? val('license') + ' · ' + val('doi') : (val('doi') ? 'Choose a license.' : (val('license') ? 'Add the paper or data DOI / URL.' : 'Add a DOI (or source URL) and choose a license.')) },
      { key: 'data', label: 'Raw data', tag: 'Required',
        state: done.length ? 'ok' : (isUrl(link) ? 'ok' : (state.uploading ? 'warn' : 'todo')),
        text: done.length ? done.length + ' file' + (done.length === 1 ? '' : 's') + ' uploaded (' + fmtBytes(bytes) + ')' + (isUrl(link) ? ' · link ' + link : '') : (isUrl(link) ? 'Linked: ' + link : (state.uploading ? 'Upload in progress…' : 'Upload the raw files in step 2, or paste a public download link.')) }
    ];
    var ok = items.filter(function (i) { return i.state === 'ok'; }).length;
    return { items: items, ok: ok, total: items.length, refName: rn, required: requiredFilled(), readyToSubmit: ok === items.length, packageable: rn.complete, uploads: done, bytes: bytes };
  }

  /* ── quality pre-check of a small sample ─────────────────────── */
  function parseFile(file) {
    var ext = String(file.name || '').split('.').pop().toLowerCase();
    if (ext === 'json') {
      return file.text().then(function (text) {
        var parsed = JSON.parse(text);
        if (parsed && !Array.isArray(parsed)) {
          var key = ['records', 'data', 'rows', 'timeseries', 'cycles'].filter(function (k) { return Array.isArray(parsed[k]); })[0];
          if (key) parsed = parsed[key];
        }
        if (!Array.isArray(parsed)) throw new Error('JSON must be an array of records');
        var rows = parsed.slice(0, 200000).filter(function (r) { return r && typeof r === 'object'; });
        var cols = Object.keys(rows.reduce(function (acc, r) { Object.keys(r).forEach(function (k) { acc[k] = 1; }); return acc; }, {}));
        return { rows: rows, columns: cols };
      });
    }
    return new Promise(function (resolve, reject) {
      if (!window.Papa) { reject(new Error('CSV parser unavailable')); return; }
      window.Papa.parse(file, {
        header: true, dynamicTyping: true, skipEmptyLines: 'greedy', preview: 200000,
        transformHeader: function (h) { return String(h || '').trim(); },
        complete: function (res) { resolve({ rows: res.data || [], columns: (res.meta && res.meta.fields) || [] }); },
        error: function (err) { reject(err instanceof Error ? err : new Error(String(err && err.message || err))); }
      });
    });
  }
  function precheckable(file) { return /\.(csv|tsv|txt|json)$/i.test(file.name || '') && file.size <= PRECHECK_MAX_BYTES; }
  function precheckFile(file) {
    if (!file) return Promise.reject(new Error('no file'));
    if (!window.BatteryLakeQuality) return Promise.reject(new Error('quality engine not loaded'));
    return parseFile(file).then(function (parsed) {
      if (!parsed.rows.length) throw new Error('no data rows found');
      var chem = (val('chemistry').match(/^(NMC811|LFP|LCO|NCA|NMC)/) || [])[1] || null;
      var report = window.BatteryLakeQuality.assessRows(parsed.rows, { datasetId: refName().name, fileName: file.name, chemistry: chem, columns: parsed.columns });
      state.precheck = report;
      state.precheckName = file.name;
      refresh();
      return report;
    });
  }
  function renderPrecheck() {
    var box = $('cb-sample-result');
    if (!box) return;
    var p = state.precheck;
    if (!p) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var have = (p.metrics && p.metrics.channels_present) || [];
    var chips = ['voltage', 'current', 'temperature', 'capacity', 'timestamp', 'cell'].map(function (c) {
      var on = c === 'cell' ? !!(p.resolved_columns && p.resolved_columns.cell) : have.indexOf(c) >= 0;
      return '<span class="cb-chip ' + (on ? 'is-on' : 'is-off') + '">' + c + (on && p.resolved_columns && p.resolved_columns[c] ? ' <i>' + escapeHtml(p.resolved_columns[c]) + '</i>' : '') + '</span>';
    }).join('');
    var warns = (p.checks_detail || []).filter(function (c) { return c.status !== 'pass'; }).map(function (c) { return '<li class="warn"><span>!</span>' + escapeHtml(c.name) + (c.note ? ' <em>' + escapeHtml(c.note) + '</em>' : '') + '</li>'; }).join('');
    var gate = p.gate === 'ready' ? 'Ready' : p.gate === 'needs_review' ? 'Needs review' : 'Ready with warning' + (p.warn_count === 1 ? '' : 's');
    box.innerHTML =
      '<div class="cb-result-head"><div class="cb-result-title">Quick check of ' + escapeHtml(state.precheckName || 'sample') + ' · ' + Number(p.n_rows).toLocaleString('en-US') + ' rows' + (p.metrics && p.metrics.n_cells > 1 ? ' · ' + p.metrics.n_cells + ' cells' : '') + '</div>' +
      '<div class="cb-result-score ' + (p.gate === 'ready' ? 'is-ok' : p.gate === 'needs_review' ? 'is-bad' : 'is-warn') + '"><strong>' + p.overall.toFixed(2) + '</strong><span>' + gate + '</span></div></div>' +
      '<div class="cb-chips">' + chips + '</div>' +
      (warns ? '<ul class="cb-checks">' + warns + '</ul>' : '') +
      '<div class="cb-result-foot">Detected channels are noted for the reviewers. Same engine as the <a href="#quality" onclick="showPage(\'quality\'); return false;">Quality page</a>; the full assessment runs after processing.</div>';
  }

  /* ── optional status.json ────────────────────────────────────── */
  function classify(value) {
    var v = String(value == null ? '' : value).trim();
    if (!v || v === 'None' || v === 'null') return 'pending';
    if (/not_applicable|n\/a/i.test(v)) return 'na';
    if (/^(pending|not_run|not run|no_measurements|unverified|none)$/i.test(v) || /^blocked/i.test(v)) return 'pending';
    if (PARTIAL_RE.test(v)) return 'partial';
    if (DONE_RE.test(v)) return 'done';
    return 'partial';
  }
  function loadStatusFile(file) {
    return file.text().then(function (text) {
      var data = JSON.parse(text);
      if (!data || typeof data !== 'object' || (!data.stages && !data.status && !data.conversion)) throw new Error('not a BatteryLake status.json');
      state.status = data;
      state.statusName = file.name;
      refresh();
      toast('Loaded status for ' + (data.dataset_id || file.name), 'success');
      return data;
    });
  }
  function renderStatus() {
    var box = $('cb-status-result');
    if (!box) return;
    var st = state.status;
    if (!st) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var stages = st.stages || {};
    box.innerHTML = '<div class="cb-result-title">' + escapeHtml(st.dataset_id || state.statusName) + ' · status <code>' + escapeHtml(st.status || '—') + '</code> (from your status.json)</div>' +
      '<div class="cb-gates">' + GATES.map(function (g) {
        var cls = classify(stages[g[0]]);
        return '<div class="cb-gate is-' + cls + '" title="' + escapeHtml(String(stages[g[0]] || 'pending')) + '"><b>' + g[0] + '</b><span>' + g[1] + '</span><em>' + escapeHtml(String(stages[g[0]] || 'pending')).slice(0, 40) + '</em></div>';
      }).join('') + '</div>';
  }

  /* ── upload ──────────────────────────────────────────────────── */
  function api(path, options) {
    var base = endpoint();
    if (!base) return Promise.reject(Object.assign(new Error('uploads_not_enabled'), { notEnabled: true }));
    return fetch(base + path, options).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
        if (res.status === 404 || res.status === 503 || (data && data.error === 'uploads_not_enabled')) {
          throw Object.assign(new Error(data.error || 'uploads_not_enabled'), { notEnabled: true, status: res.status });
        }
        if (!res.ok) throw Object.assign(new Error(data.error || ('upload endpoint HTTP ' + res.status)), { status: res.status });
        return data;
      });
    });
  }
  function probeUpload() {
    if (state.uploadEnabled !== null) return Promise.resolve(state.uploadEnabled);
    return api('/status', { method: 'GET' }).then(function (d) {
      state.uploadEnabled = !!d.enabled;
      state.uploadInfo = d;
    }).catch(function () { state.uploadEnabled = false; }).then(function () { refresh(); return state.uploadEnabled; });
  }
  function putWithRetry(url, body, attempts) {
    return fetch(url, { method: 'PUT', body: body }).then(function (res) {
      return res.text().then(function (text) {
        var data = {}; try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
        if (!res.ok) throw new Error(data.error || ('part upload HTTP ' + res.status));
        return data;
      });
    }).catch(function (err) {
      if (attempts > 1) return new Promise(function (r) { setTimeout(r, 1200); }).then(function () { return putWithRetry(url, body, attempts - 1); });
      throw err;
    });
  }
  function uploadOne(entry) {
    var file = entry.file;
    var rn = refName();
    var relName = entry.name;
    entry.done = false; entry.error = null; entry.progress = 0;
    return api('/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref_name: rn.name, file_name: relName, size: file.size, content_type: file.type || 'application/octet-stream' }) })
      .then(function (init) {
        entry.key = init.key;
        var partSize = Number(init.part_size) || 16 * 1024 * 1024;
        var total = Math.max(1, Math.ceil(file.size / partSize));
        var parts = [];
        var chain = Promise.resolve();
        for (var i = 0; i < total; i++) {
          (function (n) {
            chain = chain.then(function () {
              var chunk = file.slice(n * partSize, Math.min(file.size, (n + 1) * partSize));
              var url = endpoint() + '/part?key=' + encodeURIComponent(init.key) + '&upload_id=' + encodeURIComponent(init.upload_id) + '&part=' + (n + 1);
              return putWithRetry(url, chunk, 3).then(function (d) {
                parts.push({ part: n + 1, etag: d.etag || '' });
                entry.progress = (n + 1) / total;
                renderUploads();
              });
            });
          })(i);
        }
        return chain.then(function () {
          return api('/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: init.key, upload_id: init.upload_id, parts: parts }) });
        });
      })
      .then(function (done) {
        entry.done = true; entry.progress = 1; entry.size = file.size; entry.key = done.key || entry.key;
        state.uploads.push({ name: relName, size: file.size, key: entry.key, done: true, uploaded_at: new Date().toISOString() });
        save();
      })
      .catch(function (err) {
        entry.error = err.notEnabled ? 'direct upload is not enabled on this site yet' : (err.message || 'upload failed');
        if (err.notEnabled) state.uploadEnabled = false;
        throw err;
      });
  }
  function addFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return f && f.size >= 0 && !/^\./.test(f.name); });
    if (!list.length) return;
    var rn = refName();
    if (!rn.complete) { toast('Complete the reference name in step 1 first (institution, year, chemistry, form, rates, temperature).', 'error', 6000); focusStep(1); return; }
    list.forEach(function (f) {
      var rel = f.relativePath || f.webkitRelativePath || f.name;
      if (state.uploads.some(function (u) { return u.done && u.name === rel && u.size === f.size; })) return;
      if (queue.some(function (q) { return q.name === rel && q.file.size === f.size; })) return;
      queue.push({ file: f, name: rel, progress: 0, done: false, error: null });
    });
    var sample = list.filter(precheckable)[0];
    if (sample && !state.precheck) precheckFile(sample).catch(function () {});
    renderUploads();
    runQueue();
  }
  function runQueue() {
    if (state.uploading) return;
    var next = queue.filter(function (q) { return !q.done && !q.error && !q.active; })[0];
    if (!next) { state.uploading = false; refresh(); return; }
    state.uploading = true; next.active = true;
    refresh();
    uploadOne(next).catch(function () {}).then(function () {
      next.active = false; state.uploading = false;
      if (state.uploadEnabled === false) {
        // The store is not available: mark everything still waiting, do not keep trying.
        queue.forEach(function (q) { if (!q.done && !q.error) q.error = 'direct upload is not enabled on this site yet'; });
      }
      refresh();
      if (state.uploadEnabled !== false) runQueue();
    });
  }
  function retryFailed() { queue.forEach(function (q) { if (q.error) { q.error = null; q.progress = 0; } }); state.uploadEnabled = null; probeUpload().then(runQueue); }
  function removeUpload(key) { state.uploads = state.uploads.filter(function (u) { return u.key !== key; }); save(); refresh(); }
  function renderUploads() {
    var box = $('cb-upload-list');
    if (!box) return;
    var rows = [];
    uploadedFiles().forEach(function (u) {
      rows.push('<li class="cb-up is-done"><span class="cb-up-icon">✓</span><code>' + escapeHtml(u.name) + '</code><span class="cb-up-size">' + fmtBytes(u.size) + '</span><span class="cb-up-state">stored</span><button type="button" class="cb-mini-btn" data-remove="' + escapeHtml(u.key) + '" title="Forget this file (it stays in the store)">×</button></li>');
    });
    queue.filter(function (q) { return !q.done; }).forEach(function (q) {
      var pct = Math.round((q.progress || 0) * 100);
      rows.push('<li class="cb-up ' + (q.error ? 'is-error' : q.active ? 'is-active' : 'is-wait') + '"><span class="cb-up-icon">' + (q.error ? '!' : q.active ? '↑' : '·') + '</span><code>' + escapeHtml(q.name) + '</code><span class="cb-up-size">' + fmtBytes(q.file.size) + '</span>' +
        (q.error ? '<span class="cb-up-state is-error">' + escapeHtml(q.error) + '</span>' : '<span class="cb-up-bar" style="--pct:' + pct + '%"><i></i></span><span class="cb-up-state">' + (q.active ? pct + '%' : 'queued') + '</span>') + '</li>');
    });
    box.innerHTML = rows.join('');
    box.hidden = !rows.length;
    box.querySelectorAll('[data-remove]').forEach(function (b) { b.addEventListener('click', function () { removeUpload(b.dataset.remove); }); });
    var retry = $('cb-upload-retry');
    if (retry) retry.hidden = !queue.some(function (q) { return q.error; });
    var total = uploadedFiles().reduce(function (a, u) { return a + (Number(u.size) || 0); }, 0);
    var sum = $('cb-upload-summary');
    if (sum) sum.textContent = uploadedFiles().length ? uploadedFiles().length + ' file' + (uploadedFiles().length === 1 ? '' : 's') + ' · ' + fmtBytes(total) + ' stored under contributions/' + refName().name + '/raw_data/' : '';
  }
  function renderUploadState() {
    var note = $('cb-upload-note');
    var zone = $('cb-upload-drop');
    if (!note) return;
    if (state.uploadEnabled === false) {
      note.className = 'cb-upload-note is-off';
      note.innerHTML = '<strong>Direct upload is not enabled on this site yet.</strong> Paste a public download link below (Zenodo, Figshare, an institutional share link) and submit; the team will fetch the files.';
      if (zone) zone.classList.add('is-disabled');
    } else if (state.uploadEnabled === true) {
      var info = state.uploadInfo || {};
      note.className = 'cb-upload-note is-on';
      note.innerHTML = 'Files go straight from your browser to the BatteryLake contribution store in ' + fmtBytes(info.part_size || 16 * 1024 * 1024) + ' chunks' + (info.max_gb ? ', up to ' + info.max_gb + ' GB per file' : '') + '. Keep the original names; do not resample or clean. You can close the page after the list shows every file as stored.';
      if (zone) zone.classList.remove('is-disabled');
    } else {
      note.className = 'cb-upload-note';
      note.textContent = 'Checking the upload service…';
    }
  }
  function walkEntry(entry, prefix, out) {
    return new Promise(function (resolve) {
      if (entry.isFile) {
        entry.file(function (f) { try { Object.defineProperty(f, 'relativePath', { value: prefix + f.name }); } catch (_) { /* ignore */ } out.push(f); resolve(); }, function () { resolve(); });
      } else if (entry.isDirectory) {
        var reader = entry.createReader();
        var all = [];
        (function more() {
          reader.readEntries(function (batch) {
            if (!batch.length) {
              var chain = Promise.resolve();
              all.forEach(function (e) { chain = chain.then(function () { return walkEntry(e, prefix + entry.name + '/', out); }); });
              chain.then(resolve);
              return;
            }
            all = all.concat(Array.prototype.slice.call(batch));
            more();
          }, function () { resolve(); });
        })();
      } else resolve();
    });
  }
  function handleDrop(e) {
    var items = e.dataTransfer && e.dataTransfer.items;
    var out = [];
    if (items && items.length && items[0].webkitGetAsEntry) {
      var chain = Promise.resolve();
      Array.prototype.slice.call(items).forEach(function (it) {
        var entry = it.webkitGetAsEntry && it.webkitGetAsEntry();
        if (entry) chain = chain.then(function () { return walkEntry(entry, '', out); });
      });
      chain.then(function () { addFiles(out); });
    } else {
      addFiles(e.dataTransfer && e.dataTransfer.files);
    }
  }

  /* ── package / submit ────────────────────────────────────────── */
  function metadataJson() {
    var rn = refName();
    var out = { schema: 'batterylake-contribution/2', ref_name: rn.name, generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), dataset: {}, processing_notes: {} };
    FIELDS.forEach(function (f) { if (f.group === 'meta') out.dataset[f.key] = val(f.key) || null; });
    out.dataset.cells = val('cells') ? Number(val('cells')) : null;
    out.dataset.capacity_ah = val('capacity_ah') ? Number(val('capacity_ah')) : null;
    out.dataset.year = val('year') ? Number(val('year')) : null;
    out.dataset.data_url = val('data_url') || null;
    out.processing_notes = { protocol: val('protocol') || null, file_layout: val('layout') || null, known_issues: val('notes') || null };
    out.raw_files = uploadedFiles().map(function (u) { return { name: u.name, size: u.size, key: u.key, uploaded_at: u.uploaded_at }; });
    if (state.precheck) out.quality_precheck = { sample: state.precheckName, overall: state.precheck.overall, gate: state.precheck.gate, channels_present: state.precheck.metrics && state.precheck.metrics.channels_present, resolved_columns: state.precheck.resolved_columns };
    if (state.status) out.status_json = state.status;
    return JSON.stringify(out, null, 2);
  }
  function protocolMd() {
    var rn = refName();
    return '# Protocol — ' + (val('name') || rn.name) + '\n\n' +
      '- Chemistry: ' + (val('chemistry') || '?') + ' · Form factor: ' + (val('form') || '?') + ' · Cells: ' + (val('cells') || '?') + ' · Nominal capacity: ' + (val('capacity_ah') || '?') + ' Ah\n' +
      '- Charge rate: ' + (val('charge_c') || '?') + ' · Discharge rate: ' + (val('discharge_c') || '?') + ' · Temperature: ' + (val('temperature') || '?') + ' °C\n\n' +
      '## Test procedure\n\n' + (val('protocol') || '_(not provided)_') + '\n\n## File layout and cell identifiers\n\n' + (val('layout') || '_(not provided)_') + '\n\n## Known issues\n\n' + (val('notes') || '_(none reported)_') + '\n';
  }
  function checklistMd() {
    var r = readiness();
    return '# Readiness — ' + r.refName.name + '\n\n' + r.ok + ' of ' + r.total + ' items ready.\n\n' +
      r.items.map(function (i) { return '- [' + (i.state === 'ok' ? 'x' : ' ') + '] **' + i.label + '**: ' + i.text.replace(/`/g, ''); }).join('\n') + '\n';
  }
  function packageFiles() {
    var rn = refName();
    var root = (rn.complete ? rn.name : 'batterylake_contribution') + '/';
    var files = [
      { name: root + 'metadata.json', data: metadataJson() },
      { name: root + 'protocol.md', data: protocolMd() },
      { name: root + 'CHECKLIST.md', data: checklistMd() },
      { name: root + 'README.md', data: '# BatteryLake contribution — ' + rn.name + '\n\nGenerated by the BatteryLake Contribute page. Raw files: ' + (uploadedFiles().length ? uploadedFiles().length + ' uploaded to the contribution store.' : (val('data_url') || 'not yet provided.')) + '\n\nProcessing gates: ' + GATES.map(function (g) { return g[0] + ' ' + g[1]; }).join(' → ') + '.\n' }
    ];
    if (state.precheck) files.push({ name: root + 'quality_precheck.json', data: JSON.stringify(state.precheck, null, 2) });
    return files;
  }
  function downloadPackage() {
    var r = readiness();
    if (!r.packageable) { toast('Complete the reference name first (institution, year, chemistry, form factor, rates, temperature).', 'error', 5000); return false; }
    if (typeof window.bwZipBlob !== 'function') { toast('Zip builder unavailable in this build.', 'error'); return false; }
    var blob = window.bwZipBlob(packageFiles());
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = r.refName.name + '_submission.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast('Downloading ' + a.download, 'success');
    return true;
  }
  function summaryText() {
    var r = readiness();
    var lines = ['## New dataset contribution', '', '**' + (val('name') || 'Untitled dataset') + '**', '', '| Field | Value |', '|---|---|',
      '| ref_name | `' + r.refName.name + '` |', '| Institution | ' + (val('institution') || '?') + ' |', '| Year | ' + (val('year') || '?') + ' |',
      '| Chemistry / form | ' + (val('chemistry') || '?') + ' / ' + (val('form') || '?') + ' |', '| Cells / capacity | ' + (val('cells') || '?') + ' / ' + (val('capacity_ah') ? val('capacity_ah') + ' Ah' : '?') + ' |',
      '| Rates / temperature | ' + (val('charge_c') || '?') + ' / ' + (val('discharge_c') || '?') + ' · ' + (val('temperature') || '?') + ' °C |',
      '| Category | ' + (val('category') || '?') + ' |', '| DOI / source | ' + (val('doi') || '?') + ' |', '| License | ' + (val('license') || '?') + ' |', '| Contact | ' + (val('contact') || '?') + ' |',
      '| Raw data | ' + (r.uploads.length ? r.uploads.length + ' file(s), ' + fmtBytes(r.bytes) + ' in contributions/' + r.refName.name + '/raw_data/' : (val('data_url') || 'not provided')) + ' |', '',
      '**Readiness:** ' + r.ok + ' / ' + r.total, ''].concat(r.items.map(function (i) { return '- [' + (i.state === 'ok' ? 'x' : ' ') + '] ' + i.label + ' — ' + i.text.replace(/`/g, ''); }));
    if (state.precheck) lines.push('', '**Quick check (browser):** overall ' + state.precheck.overall.toFixed(2) + ', ' + state.precheck.gate + ' (' + state.precheckName + ')');
    if (val('protocol')) lines.push('', '**Test protocol**', '', val('protocol'));
    if (val('layout')) lines.push('', '**File layout and cell identifiers**', '', val('layout'));
    if (val('notes')) lines.push('', '**Known issues / notes**', '', val('notes'));
    if (state.submitted) lines.push('', '_submission.json stored at ' + state.submitted.key + ' on ' + state.submitted.at + '_');
    return lines.join('\n');
  }
  function submitLink() {
    var title = '[Dataset] ' + (val('name') || refName().name);
    var body = summaryText();
    if (body.length > 6000) body = body.slice(0, 6000) + '\n\n_(truncated)_';
    // encodeURIComponent leaves ( ) ' * ! unescaped; encode them too so the URL survives markdown link syntax.
    var enc = function (v) { return encodeURIComponent(v).replace(/[()'*!]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); };
    return ISSUE_URL + '?title=' + enc(title) + '&labels=' + enc('dataset-contribution') + '&body=' + enc(body);
  }
  function submit() {
    var r = readiness();
    if (!r.packageable) { toast('Complete the reference name first.', 'error', 5000); focusStep(1); return Promise.resolve({ ok: false, reason: 'incomplete reference name' }); }
    var btn = $('cb-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
    var key = 'contributions/' + r.refName.name + '/submission.json';
    var payload = metadataJson();
    return probeUpload().then(function (enabled) {
      if (!enabled) return { stored: false };
      return api('/object?key=' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload }).then(function (d) { return { stored: true, key: d.key || key }; });
    }).catch(function () { return { stored: false }; }).then(function (res) {
      state.submitted = { at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), key: res.stored ? res.key : null, stored: res.stored, ref_name: r.refName.name };
      save();
      refresh();
      if (btn) { btn.disabled = false; btn.textContent = 'Submit contribution'; }
      toast(res.stored ? 'Submitted: ' + r.refName.name : 'Submission summary prepared — open the GitHub issue to notify the team.', res.stored ? 'success' : 'info', 5000);
      return { ok: true, stored: res.stored, key: state.submitted.key, refName: r.refName.name, issueUrl: submitLink(), readiness: r.ok + ' / ' + r.total };
    });
  }
  function renderSubmitState() {
    var box = $('cb-submitted');
    if (!box) return;
    if (!state.submitted) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = state.submitted.stored
      ? '<strong>Submitted</strong> · <code>' + escapeHtml(state.submitted.ref_name) + '</code> on ' + escapeHtml(state.submitted.at) + '. The team has your metadata, notes and file list; you will be contacted at ' + (escapeHtml(val('contact')) || 'the address in the GitHub issue') + '.'
      : '<strong>Summary prepared</strong> on ' + escapeHtml(state.submitted.at) + '. Direct upload was not enabled, so please open the GitHub issue (button above) so the team can fetch the files from your link.';
  }

  /* ── render everything ───────────────────────────────────────── */
  function refresh() {
    if (!$('cb-form-meta')) return;
    renderForm();
    syncFormFromState();
    var r = readiness();
    var rn = r.refName;
    var refEl = $('cb-refname');
    if (refEl) refEl.innerHTML = rn.parts.map(function (p, i) { return '<span class="cb-ref-part' + (p ? '' : ' is-missing') + '" data-part="' + i + '">' + escapeHtml(p || '?') + '</span>'; }).join('<i>_</i>');
    var refNote = $('cb-refname-note');
    if (refNote) refNote.textContent = rn.complete ? 'Follows the naming standard: Year_Source_Chemistry_Form_ChargeRate_DischargeRate_Temperature. Files are stored under this name.' : 'Fill the required fields to complete the reference name; uploads use it as the folder name.';
    var json = $('cb-json');
    if (json) json.textContent = metadataJson();
    var list = $('cb-readiness');
    if (list) list.innerHTML = r.items.map(function (i) {
      return '<li class="cb-ready is-' + i.state + '"><span class="cb-ready-icon">' + (i.state === 'ok' ? '✓' : i.state === 'warn' ? '!' : '○') + '</span><div><strong>' + escapeHtml(i.label) + '</strong><small>' + escapeHtml(i.text).replace(/`([^`]+)`/g, '<code>$1</code>') + '</small></div><span class="cb-ready-tag">' + i.tag + '</span></li>';
    }).join('');
    var score = $('cb-score');
    if (score) { score.textContent = r.ok + ' / ' + r.total; score.className = 'cb-score-value ' + (r.readyToSubmit ? 'is-ok' : r.ok >= 3 ? 'is-warn' : 'is-todo'); }
    var scoreNote = $('cb-score-note');
    if (scoreNote) scoreNote.textContent = r.readyToSubmit ? 'Everything the team needs is here.' : (r.total - r.ok) + ' item' + (r.total - r.ok === 1 ? '' : 's') + ' left. You can submit anyway; the reviewers will ask for what is missing.';
    var bar = $('cb-score-bar');
    if (bar) bar.style.setProperty('--pct', Math.round(r.ok / r.total * 100) + '%');
    renderPrecheck();
    renderStatus();
    renderUploads();
    renderUploadState();
    renderSubmitState();
    var gh = $('cb-github');
    if (gh) gh.href = submitLink();
    var filled = r.required.filter(function (x) { return x.ok; }).length;
    var rail = { 1: filled + ' / ' + r.required.length + ' required fields', 2: r.uploads.length ? r.uploads.length + ' file' + (r.uploads.length === 1 ? '' : 's') + ' · ' + fmtBytes(r.bytes) : (isUrl(val('data_url')) ? 'link given' : (state.uploading ? 'uploading…' : 'no files yet')), 3: state.submitted ? 'submitted' : (r.readyToSubmit ? 'ready' : r.ok + ' / ' + r.total + ' ready') };
    Object.keys(rail).forEach(function (k) { var e = $('cb-rail-' + k); if (e) e.textContent = rail[k]; });
    document.querySelectorAll('#cb-rail li').forEach(function (li) {
      var n = Number(li.dataset.step);
      li.classList.toggle('is-done', (n === 1 && filled === r.required.length) || (n === 2 && r.items[4].state === 'ok') || (n === 3 && !!state.submitted));
    });
  }

  /* ── agent-facing API ────────────────────────────────────────── */
  var ALIASES = { dataset_name: 'name', title: 'name', lab: 'institution', source: 'institution', organisation: 'institution', organization: 'institution', university: 'institution', chem: 'chemistry', form_factor: 'form', format: 'form', n_cells: 'cells', cell_count: 'cells', number_of_cells: 'cells', capacity: 'capacity_ah', nominal_capacity: 'capacity_ah', nominal_capacity_ah: 'capacity_ah', charge_rate: 'charge_c', c_rate: 'charge_c', discharge_rate: 'discharge_c', temp: 'temperature', temperature_c: 'temperature', url: 'data_url', download_url: 'data_url', link: 'data_url', paper: 'doi', paper_doi: 'doi', licence: 'license', email: 'contact', contact_email: 'contact', protocol_notes: 'protocol', file_layout: 'layout', cell_ids: 'layout', description: 'notes', note: 'notes', known_issues: 'notes' };
  function prefill(fields) {
    var applied = [], ignored = [];
    Object.keys(fields || {}).forEach(function (k) {
      var key = ALIASES[k] || k;
      var v = fields[k];
      if (v == null || v === '') { ignored.push(k); return; }
      v = String(v).trim();
      if (key === 'data_url') { if (isUrl(v)) { state.fields.data_url = v; applied.push(key); } else ignored.push(k); return; }
      var def = FIELDS.filter(function (f) { return f.key === key; })[0];
      if (!def) { ignored.push(k); return; }
      if (def.type === 'select') {
        var opts = def.options.map(function (o) { return Array.isArray(o) ? o[0] : o; });
        var hit = opts.filter(function (o) { return o.toLowerCase() === v.toLowerCase(); })[0] ||
          opts.filter(function (o) { return v.toLowerCase().indexOf(o.toLowerCase()) === 0 || o.toLowerCase().indexOf(v.toLowerCase()) === 0; })[0];
        if (key === 'form' && /^cyl/i.test(v)) hit = 'Cyl';
        if (key === 'category') { var lc = v.toLowerCase().replace(/[\s-]+/g, '_'); hit = opts.filter(function (o) { return o === lc; })[0] || hit; }
        if (!hit) { ignored.push(k); return; }
        v = hit;
      }
      state.fields[key] = v;
      applied.push(key);
    });
    save();
    refresh();
    return { applied: applied, ignored: ignored, refName: refName().name, readiness: readiness() };
  }
  function focusStep(n) {
    var el = $('cb-step-' + n);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('#cb-rail li').forEach(function (li) { li.classList.toggle('is-active', Number(li.dataset.step) === n); });
  }
  function clearDraft() {
    state.fields = {}; state.precheck = null; state.status = null; state.uploads = []; state.submitted = null; queue.length = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    document.querySelectorAll('#page-contribute [data-key]').forEach(function (el) { el.value = ''; });
    var link = $('cb-data-link'); if (link) link.value = '';
    refresh();
    toast('Draft cleared.', 'info');
  }
  function summary() {
    var r = readiness();
    return { refName: r.refName.name, ok: r.ok, total: r.total, readyToSubmit: r.readyToSubmit, packageable: r.packageable, uploadEnabled: state.uploadEnabled, uploads: r.uploads.length, bytes: r.bytes, submitted: state.submitted, items: r.items.map(function (i) { return { key: i.key, label: i.label, state: i.state, text: i.text }; }), precheck: state.precheck ? { overall: state.precheck.overall, gate: state.precheck.gate } : null, fields: Object.assign({}, state.fields) };
  }

  /* ── init ────────────────────────────────────────────────────── */
  function init() {
    if (state.initialized || !$('cb-form-meta')) return;
    state.initialized = true;
    load();
    renderForm();
    var zone = $('cb-upload-drop');
    if (zone) {
      ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-drag'); }); });
      ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); if (t === 'dragleave' && zone.contains(e.relatedTarget)) return; zone.classList.remove('is-drag'); }); });
      zone.addEventListener('drop', handleDrop);
    }
    var fi = $('cb-upload-files'); if (fi) fi.addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
    var fd = $('cb-upload-folder'); if (fd) fd.addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
    var si = $('cb-status-input'); if (si) si.addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; if (f) loadStatusFile(f).catch(function (err) { toast('Could not read status.json: ' + (err.message || err), 'error'); }); e.target.value = ''; });
    var link = $('cb-data-link'); if (link) link.addEventListener('input', function () { state.fields.data_url = link.value; save(); refresh(); });
    var retry = $('cb-upload-retry'); if (retry) retry.addEventListener('click', retryFailed);
    var sb = $('cb-submit-btn'); if (sb) sb.addEventListener('click', function () { submit(); });
    var dl = $('cb-download-btn'); if (dl) dl.addEventListener('click', downloadPackage);
    var cp = $('cb-copy-btn'); if (cp) cp.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(summaryText()).then(function () { toast('Submission summary copied.', 'success'); }); });
    var cj = $('cb-copy-json'); if (cj) cj.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(metadataJson()).then(function () { toast('metadata.json copied.', 'success'); }); });
    var cl = $('cb-clear-btn'); if (cl) cl.addEventListener('click', clearDraft);
    document.querySelectorAll('#cb-rail li').forEach(function (li) { li.addEventListener('click', function () { focusStep(Number(li.dataset.step)); }); });
    var gatesEl = $('cb-gates-info');
    if (gatesEl) gatesEl.innerHTML = GATES.map(function (g) { return '<div class="cb-gate-info"><b>' + g[0] + '</b><strong>' + g[1] + '</strong><span>' + g[2] + '</span></div>'; }).join('');
    window.addEventListener('beforeunload', function (e) { if (state.uploading) { e.preventDefault(); e.returnValue = ''; } });
    refresh();
    probeUpload();
  }

  window.BatteryLakeContribute = {
    init: init, refresh: refresh, prefill: prefill, check: function () { refresh(); return summary(); }, addFiles: addFiles, precheckFile: precheckFile, loadStatusFile: loadStatusFile,
    downloadPackage: downloadPackage, submit: submit, submitLink: submitLink, summaryText: summaryText, summary: summary, focusStep: focusStep, clearDraft: clearDraft, probeUpload: probeUpload, FIELDS: FIELDS
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
