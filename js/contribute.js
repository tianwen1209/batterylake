/* ═══════════════════════════════════════════════════════════════
   BatteryLake — Contribute page
   Describe → Check → Package → Submit, aligned with the v2.0.0 processing
   standard: the form yields the catalog ref_name and metadata.json, the
   browser quality engine pre-checks a data sample, an optional status.json
   shows the five processing gates, and the submission package is zipped in
   the browser. Nothing is uploaded from this page.

   Exposes window.BatteryLakeContribute for the AI agent:
     prefill(fields) · check() · precheckFile(file) · downloadPackage() ·
     submitLink() · summary() · focusStep(n) · refresh()
   Depends on globals from main.js: bwZipBlob, showToast, esc, Papa (vendor),
   BatteryLakeQuality (js/quality-engine.js).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'batteryLakeContributionDraftV1';
  var ISSUE_URL = 'https://github.com/tianwen1209/BatteryLake-Benchmark-DataPrep/issues/new';
  var CATEGORIES = [
    ['cycle_aging', 'Cycle aging'], ['calendar_aging', 'Calendar aging'], ['characterization', 'Characterization'],
    ['field_data', 'Field data'], ['field_fault_diagnosis', 'Field fault diagnosis'], ['soh_estimation', 'SOH estimation'],
    ['soc_estimation', 'SOC estimation'], ['eis', 'EIS / impedance'], ['thermal_runaway', 'Thermal runaway / safety'], ['ev', 'EV fleet']
  ];
  var FIELDS = [
    { key: 'name', label: 'Dataset name', required: true, placeholder: 'e.g. NTU LFP 18650 fast-charge aging' },
    { key: 'institution', label: 'Institution / lab', required: true, placeholder: 'e.g. NTU_EEE', hint: 'Becomes the Source token of the reference name' },
    { key: 'year', label: 'Year', required: true, type: 'number', placeholder: String(new Date().getFullYear()), min: 2000, max: 2100 },
    { key: 'chemistry', label: 'Chemistry', required: true, type: 'select', options: ['LFP', 'NMC', 'NMC811', 'NCA', 'LCO', 'LMO', 'LTO', 'LiIon', 'MultiChem'] },
    { key: 'form', label: 'Form factor', required: true, type: 'select', options: ['18650', '21700', 'Pouch', 'Prismatic', 'Cyl', 'Auto', 'EV-BMS'] },
    { key: 'cells', label: 'Number of cells', required: true, type: 'number', min: 1, placeholder: 'e.g. 24' },
    { key: 'capacity_ah', label: 'Nominal capacity (Ah)', type: 'number', step: '0.01', placeholder: 'e.g. 2.5' },
    { key: 'charge_c', label: 'Charge rate', required: true, placeholder: '1C, 0.5C or Multi' },
    { key: 'discharge_c', label: 'Discharge rate', required: true, placeholder: '1C or Multi' },
    { key: 'temperature', label: 'Test temperature (°C)', required: true, placeholder: '25 or Multi' },
    { key: 'category', label: 'Category', type: 'select', options: CATEGORIES, optional: true },
    { key: 'data_url', label: 'Data download link', placeholder: 'Zenodo / Figshare / institutional share link', hint: 'Raw files are shared by link, not uploaded here' },
    { key: 'doi', label: 'Paper or data DOI / URL', placeholder: 'https://doi.org/…' },
    { key: 'license', label: 'License', type: 'select', options: ['CC BY 4.0', 'CC BY-NC 4.0', 'CC BY-SA 4.0', 'CC0 1.0', 'MIT', 'ODC-By 1.0', 'Custom (state in notes)'], optional: true },
    { key: 'contact', label: 'Contact email', type: 'email', placeholder: 'name@university.edu' },
    { key: 'protocol', label: 'Protocol notes', type: 'textarea', wide: true, placeholder: 'Charge / discharge procedure, rest periods, formation cycles, RPT schedule, cut-off voltages, equipment, sampling rate…' },
    { key: 'notes', label: 'Notes for the reviewers', type: 'textarea', wide: true, placeholder: 'Anything unusual: clock resets, file naming, missing channels, publication status…' }
  ];
  var GATES = [
    ['I', 'Inventory', 'Every archive member is listed with size and SHA-256.'],
    ['S', 'Semantics', 'Field mapping, cell identity, units, clocks and labels are decided from your protocol notes.'],
    ['C', 'Conversion', 'A re-runnable adapter writes all source measurements into the canonical layer.'],
    ['V', 'Fidelity', 'Record-by-record comparison of raw and standard values.'],
    ['E', 'Equivalence', 'Raw and standard loaders give the same benchmark inputs before a task view is published.']
  ];
  var DONE_RE = /done|complete|verified|passed|validated|inventoried|decoded|converted|checked/i;
  var PARTIAL_RE = /pending|not_run|not run|only|partial|converting|error|sample|unverified|unavailable|separate|needs|review|subset/i;

  var state = { fields: {}, precheck: null, status: null, statusName: '', initialized: false };

  /* ── helpers ─────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function toast(msg, type, ms) { if (typeof window.showToast === 'function') window.showToast(msg, type || 'info', ms || 3500); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function val(key) { return String(state.fields[key] == null ? '' : state.fields[key]).trim(); }
  function isUrl(s) { return /^https?:\/\/\S+$/i.test(s); }
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
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.fields)); } catch (_) { /* ignore */ } }
  function load() { try { var raw = localStorage.getItem(STORAGE_KEY); if (raw) state.fields = JSON.parse(raw) || {}; } catch (_) { state.fields = {}; } }

  /* ── form ────────────────────────────────────────────────────── */
  function renderForm() {
    var form = $('cb-form');
    if (!form || form.dataset.rendered) return;
    form.dataset.rendered = '1';
    form.innerHTML = FIELDS.map(function (f) {
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
      return '<label class="cb-field' + (f.wide ? ' is-wide' : '') + '" for="' + id + '">' +
        '<span class="cb-field-label">' + escapeHtml(f.label) + (f.required ? ' <b>*</b>' : '') + '</span>' + control +
        (f.hint ? '<span class="cb-field-hint">' + escapeHtml(f.hint) + '</span>' : '') + '</label>';
    }).join('');
    form.addEventListener('input', onFieldInput);
    form.addEventListener('change', onFieldInput);
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
  }

  /* ── readiness ───────────────────────────────────────────────── */
  function requiredFilled() {
    return FIELDS.filter(function (f) { return f.required; }).map(function (f) { return { key: f.key, label: f.label, ok: !!val(f.key) }; });
  }
  function channelsStatus() {
    var p = state.precheck;
    if (!p) return { state: 'todo', text: 'Drop a data sample below to detect the channels.' };
    var have = p.metrics && p.metrics.channels_present || [];
    var cols = p.resolved_columns || {};
    var required = ['voltage', 'current', 'timestamp'];
    var missingReq = required.filter(function (c) { return have.indexOf(c) < 0; });
    var preferred = ['temperature', 'capacity'].filter(function (c) { return have.indexOf(c) < 0; });
    var cell = cols.cell ? 'cell id column `' + cols.cell + '`' : 'no cell id column';
    if (missingReq.length) return { state: 'warn', text: 'Missing required channel' + (missingReq.length > 1 ? 's' : '') + ': ' + missingReq.join(', ') + ' · ' + cell };
    if (preferred.length || !cols.cell) return { state: 'warn', text: 'Required channels present · ' + (preferred.length ? 'preferred channel' + (preferred.length > 1 ? 's' : '') + ' missing: ' + preferred.join(', ') + ' · ' : '') + cell };
    return { state: 'ok', text: 'Voltage, current, timestamp, temperature, capacity and ' + cell + ' detected.' };
  }
  function readiness() {
    var rn = refName();
    var req = requiredFilled();
    var identityMissing = ['name', 'institution', 'year', 'chemistry', 'form'].filter(function (k) { return !val(k); });
    var protoMissing = ['cells', 'charge_c', 'discharge_c', 'temperature'].filter(function (k) { return !val(k); });
    var items = [
      { key: 'identity', label: 'Identity and reference name', tag: 'Required',
        state: identityMissing.length ? 'todo' : 'ok',
        text: identityMissing.length ? 'Fill ' + identityMissing.map(labelOf).join(', ') + ' to complete the reference name.' : 'ref_name `' + rn.name + '`' },
      { key: 'metadata', label: 'Cell and protocol metadata', tag: 'Required',
        state: protoMissing.length ? 'todo' : (val('capacity_ah') ? 'ok' : 'warn'),
        text: protoMissing.length ? 'Missing ' + protoMissing.map(labelOf).join(', ') + '.' : (val('capacity_ah') ? val('cells') + ' cells · ' + val('capacity_ah') + ' Ah · ' + rateToken(val('charge_c')) + '/' + rateToken(val('discharge_c')) + ' · ' + tempToken(val('temperature')) : 'Add the nominal capacity (Ah) so SOH can be defined.') },
      Object.assign({ key: 'channels', label: 'Time-series channels', tag: 'Required' }, channelsStatus()),
      { key: 'protocol', label: 'Protocol notes', tag: 'Required',
        state: val('protocol').length >= 80 ? 'ok' : (val('protocol') ? 'warn' : 'todo'),
        text: val('protocol').length >= 80 ? val('protocol').length + ' characters of protocol notes.' : (val('protocol') ? 'A few more details please (rest periods, cut-offs, RPT schedule).' : 'Describe charge / discharge procedure, rest periods, formation and RPT cycles.') },
      { key: 'attribution', label: 'Attribution and license', tag: 'Required',
        state: val('doi') && val('license') ? 'ok' : (val('doi') || val('license') ? 'warn' : 'todo'),
        text: val('doi') && val('license') ? val('license') + ' · ' + val('doi') : (val('doi') ? 'Choose a license.' : (val('license') ? 'Add the paper or data DOI / URL.' : 'Add a DOI (or source URL) and choose a license.')) },
      { key: 'access', label: 'Data access link', tag: 'Required',
        state: isUrl(val('data_url')) ? 'ok' : (val('data_url') ? 'warn' : 'todo'),
        text: isUrl(val('data_url')) ? val('data_url') : (val('data_url') ? 'The link should start with https://' : 'Where can the team download the raw files? (Zenodo, Figshare, an institutional share link)') }
    ];
    var ok = items.filter(function (i) { return i.state === 'ok'; }).length;
    return { items: items, ok: ok, total: items.length, refName: rn, required: req, readyToSubmit: ok === items.length, packageable: rn.complete };
  }
  function labelOf(key) { var f = FIELDS.filter(function (x) { return x.key === key; })[0]; return f ? f.label : key; }

  /* ── precheck: quality engine on a data sample ───────────────── */
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
  function precheckFile(file) {
    if (!file) return Promise.reject(new Error('no file'));
    if (!window.BatteryLakeQuality) return Promise.reject(new Error('quality engine not loaded'));
    var box = $('cb-sample-result');
    if (box) { box.hidden = false; box.innerHTML = '<div class="cb-result-title">Checking ' + escapeHtml(file.name) + '…</div>'; }
    return parseFile(file).then(function (parsed) {
      if (!parsed.rows.length) throw new Error('no data rows found');
      var chem = (val('chemistry').match(/^(NMC811|LFP|LCO|NCA|NMC)/) || [])[1] || null;
      var report = window.BatteryLakeQuality.assessRows(parsed.rows, { datasetId: refName().name, fileName: file.name, chemistry: chem, columns: parsed.columns });
      state.precheck = report;
      state.precheckName = file.name;
      refresh();
      toast('Sample checked: overall ' + report.overall.toFixed(2), 'success');
      return report;
    }).catch(function (err) {
      state.precheck = null;
      if (box) box.innerHTML = '<div class="cb-result-title is-bad">Could not read ' + escapeHtml(file.name) + ': ' + escapeHtml(err.message || 'unknown error') + '</div>';
      toast('Sample check failed: ' + (err.message || err), 'error');
      throw err;
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
    var checks = (p.checks_detail || []).map(function (c) {
      return '<li class="' + c.status + '"><span>' + (c.status === 'pass' ? '✓' : '!') + '</span>' + escapeHtml(c.name) + (c.note ? ' <em>' + escapeHtml(c.note) + '</em>' : '') + '</li>';
    }).join('');
    var gate = p.gate === 'ready' ? 'Ready' : p.gate === 'needs_review' ? 'Needs review' : 'Ready with warning' + (p.warn_count === 1 ? '' : 's');
    box.innerHTML =
      '<div class="cb-result-head"><div class="cb-result-title">' + escapeHtml(state.precheckName || 'sample') + ' · ' + Number(p.n_rows).toLocaleString('en-US') + ' rows' + (p.metrics && p.metrics.n_cells > 1 ? ' · ' + p.metrics.n_cells + ' cells' : '') + '</div>' +
      '<div class="cb-result-score ' + (p.gate === 'ready' ? 'is-ok' : p.gate === 'needs_review' ? 'is-bad' : 'is-warn') + '"><strong>' + p.overall.toFixed(2) + '</strong><span>' + gate + '</span></div></div>' +
      '<div class="cb-chips">' + chips + '</div>' +
      '<ul class="cb-checks">' + checks + '</ul>' +
      '<div class="cb-result-foot">Completeness ' + p.quality_score.completeness.toFixed(2) + ' · Consistency ' + p.quality_score.consistency.toFixed(2) + ' · Accuracy ' + p.quality_score.accuracy.toFixed(2) + ' · Validity ' + p.quality_score.validity.toFixed(2) + ' — the same engine as the <a href="#quality" onclick="showPage(\'quality\'); return false;">Quality page</a>.</div>';
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
    if (!file) return Promise.reject(new Error('no file'));
    return file.text().then(function (text) {
      var data = JSON.parse(text);
      if (!data || typeof data !== 'object' || (!data.stages && !data.status && !data.conversion)) throw new Error('not a BatteryLake status.json');
      state.status = data;
      state.statusName = file.name;
      refresh();
      toast('Loaded status for ' + (data.dataset_id || file.name), 'success');
      return data;
    }).catch(function (err) { toast('Could not read status.json: ' + (err.message || err), 'error'); throw err; });
  }
  function renderStatus() {
    var box = $('cb-status-result');
    if (!box) return;
    var st = state.status;
    if (!st) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var stages = st.stages || {};
    box.innerHTML = '<div class="cb-result-title">' + escapeHtml(st.dataset_id || state.statusName) + ' · status <code>' + escapeHtml(st.status || '—') + '</code></div>' +
      '<div class="cb-gates">' + GATES.map(function (g) {
        var cls = classify(stages[g[0]]);
        return '<div class="cb-gate is-' + cls + '" title="' + escapeHtml(String(stages[g[0]] || 'pending')) + '"><b>' + g[0] + '</b><span>' + g[1] + '</span><em>' + escapeHtml(String(stages[g[0]] || 'pending')).slice(0, 40) + '</em></div>';
      }).join('') + '</div>';
  }

  /* ── package ─────────────────────────────────────────────────── */
  function metadataJson() {
    var rn = refName();
    var out = { schema: 'batterylake-contribution/1', ref_name: rn.name, generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), dataset: {} };
    FIELDS.forEach(function (f) { if (f.key !== 'protocol' && f.key !== 'notes') out.dataset[f.key] = val(f.key) || null; });
    out.dataset.cells = val('cells') ? Number(val('cells')) : null;
    out.dataset.capacity_ah = val('capacity_ah') ? Number(val('capacity_ah')) : null;
    out.dataset.year = val('year') ? Number(val('year')) : null;
    out.notes = val('notes') || null;
    if (state.precheck) out.quality_precheck = { overall: state.precheck.overall, gate: state.precheck.gate, channels_present: state.precheck.metrics && state.precheck.metrics.channels_present, sample: state.precheckName };
    return JSON.stringify(out, null, 2);
  }
  function protocolMd() {
    var rn = refName();
    return '# Protocol — ' + (val('name') || rn.name) + '\n\n' +
      '- Chemistry: ' + (val('chemistry') || '?') + ' · Form factor: ' + (val('form') || '?') + ' · Cells: ' + (val('cells') || '?') + ' · Nominal capacity: ' + (val('capacity_ah') || '?') + ' Ah\n' +
      '- Charge rate: ' + (val('charge_c') || '?') + ' · Discharge rate: ' + (val('discharge_c') || '?') + ' · Temperature: ' + (val('temperature') || '?') + ' °C\n\n' +
      '## Test procedure\n\n' + (val('protocol') || '_(describe charge / discharge steps, rest periods, formation cycles, RPT schedule, cut-off voltages, equipment, sampling rate)_') + '\n\n' +
      '## Cell identifiers\n\n_(list how cells are named in the files and how they map to physical cells)_\n\n' +
      '## Known issues\n\n' + (val('notes') || '_(clock resets, missing channels, partial cycles, file quirks)_') + '\n';
  }
  function readmeMd() {
    var r = readiness();
    var lines = ['# BatteryLake contribution — ' + r.refName.name, '', (val('name') || 'Untitled dataset') + ' · ' + (val('institution') || '?') + ' · ' + (val('year') || '?'), '',
      '## Package contents', '', '- `metadata.json` — dataset description (this form)', '- `protocol.md` — test procedure', '- `CHECKLIST.md` — readiness self-check', state.precheck ? '- `quality_precheck.json` — browser quality engine result on a sample' : null, state.status ? '- `status.json` — processing status supplied by the contributor' : null, '- `raw_data/` — put the raw cycler exports here, or share them via the link in metadata.json', '',
      '## What happens next', '', 'The BatteryLake team runs the batterylake-processing skill on the files. The dataset passes five gates:', ''].concat(GATES.map(function (g) { return '- **' + g[0] + ' · ' + g[1] + '** — ' + g[2]; }))
      .concat(['', 'You receive a status.json and a quality report; the dataset is published in the catalog with your DOI and license.', '']);
    return lines.filter(function (l) { return l !== null; }).join('\n');
  }
  function checklistMd() {
    var r = readiness();
    return '# Readiness checklist — ' + r.refName.name + '\n\n' + r.ok + ' of ' + r.total + ' items ready.\n\n' +
      r.items.map(function (i) { return '- [' + (i.state === 'ok' ? 'x' : ' ') + '] **' + i.label + '** (' + i.tag + '): ' + i.text.replace(/`/g, ''); }).join('\n') + '\n';
  }
  function packageFiles() {
    var rn = refName();
    var root = (rn.complete ? rn.name : 'batterylake_contribution') + '/';
    var files = [
      { name: root + 'metadata.json', data: metadataJson() },
      { name: root + 'protocol.md', data: protocolMd() },
      { name: root + 'README.md', data: readmeMd() },
      { name: root + 'CHECKLIST.md', data: checklistMd() },
      { name: root + 'raw_data/README.txt', data: 'Place the raw cycler exports here (or share them via metadata.json -> dataset.data_url).\nKeep the original file names; do not resample, clean or truncate.\n' }
    ];
    if (state.precheck) files.push({ name: root + 'quality_precheck.json', data: JSON.stringify(state.precheck, null, 2) });
    if (state.status) files.push({ name: root + 'status.json', data: JSON.stringify(state.status, null, 2) });
    return files;
  }
  function downloadPackage() {
    var r = readiness();
    if (!r.packageable) { toast('Complete the reference name first (institution, year, chemistry, form factor, rates, temperature).', 'error', 5000); return false; }
    if (typeof window.bwZipBlob !== 'function') { toast('Zip builder unavailable in this build.', 'error'); return false; }
    var files = packageFiles();
    var blob = window.bwZipBlob(files);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (r.refName.complete ? r.refName.name : 'batterylake_contribution') + '_submission.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast('Downloading ' + a.download, 'success');
    if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
      window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'contribution_package' });
    }
    return true;
  }
  function renderTree() {
    var el = $('cb-tree');
    if (!el) return;
    var r = readiness();
    var root = r.refName.complete ? r.refName.name : 'batterylake_contribution';
    var rows = [
      [root + '/', '', 'root'],
      ['├── metadata.json', r.items[0].state === 'ok' && r.items[1].state !== 'todo' ? 'ready' : 'partial', 'generated from the form'],
      ['├── protocol.md', r.items[3].state === 'ok' ? 'ready' : 'partial', 'generated from the protocol notes'],
      ['├── README.md', 'ready', 'package summary and the five gates'],
      ['├── CHECKLIST.md', r.readyToSubmit ? 'ready' : 'partial', r.ok + ' / ' + r.total + ' items ready'],
      ['├── quality_precheck.json', state.precheck ? 'ready' : 'todo', state.precheck ? 'overall ' + state.precheck.overall.toFixed(2) : 'drop a sample in step 2'],
      ['├── status.json', state.status ? 'ready' : 'optional', state.status ? (state.status.status || 'loaded') : 'only if you ran the processing skill'],
      ['└── raw_data/', isUrl(val('data_url')) ? 'ready' : 'todo', isUrl(val('data_url')) ? 'shared via link' : 'add files or a download link']
    ];
    el.innerHTML = rows.map(function (row) {
      return '<div class="cb-tree-row is-' + row[1] + '"><code>' + escapeHtml(row[0]) + '</code><span>' + escapeHtml(row[2]) + '</span></div>';
    }).join('');
  }

  /* ── submit ──────────────────────────────────────────────────── */
  function summaryText() {
    var r = readiness();
    var lines = ['## New dataset contribution', '', '**' + (val('name') || 'Untitled dataset') + '**', '', '| Field | Value |', '|---|---|',
      '| ref_name | `' + r.refName.name + '` |', '| Institution | ' + (val('institution') || '?') + ' |', '| Year | ' + (val('year') || '?') + ' |',
      '| Chemistry / form | ' + (val('chemistry') || '?') + ' / ' + (val('form') || '?') + ' |', '| Cells / capacity | ' + (val('cells') || '?') + ' / ' + (val('capacity_ah') ? val('capacity_ah') + ' Ah' : '?') + ' |',
      '| Rates / temperature | ' + (val('charge_c') || '?') + ' / ' + (val('discharge_c') || '?') + ' · ' + (val('temperature') || '?') + ' °C |',
      '| Category | ' + (val('category') || '?') + ' |', '| Data link | ' + (val('data_url') || '?') + ' |', '| DOI / source | ' + (val('doi') || '?') + ' |', '| License | ' + (val('license') || '?') + ' |', '| Contact | ' + (val('contact') || '?') + ' |', '',
      '**Readiness:** ' + r.ok + ' / ' + r.total, ''].concat(r.items.map(function (i) { return '- [' + (i.state === 'ok' ? 'x' : ' ') + '] ' + i.label + ' — ' + i.text.replace(/`/g, ''); }));
    if (state.precheck) lines.push('', '**Quality pre-check (browser):** overall ' + state.precheck.overall.toFixed(2) + ', ' + state.precheck.gate + ' (' + state.precheckName + ')');
    if (val('protocol')) lines.push('', '**Protocol notes**', '', val('protocol'));
    if (val('notes')) lines.push('', '**Notes**', '', val('notes'));
    lines.push('', '_Submission package generated on the BatteryLake Contribute page; the zip is attached / linked above._');
    return lines.join('\n');
  }
  function submitLink() {
    var title = '[Dataset] ' + (val('name') || refName().name);
    var body = summaryText();
    if (body.length > 6000) body = body.slice(0, 6000) + '\n\n_(truncated — full details in the attached package)_';
    return ISSUE_URL + '?title=' + encodeURIComponent(title) + '&labels=' + encodeURIComponent('dataset-contribution') + '&body=' + encodeURIComponent(body);
  }
  function copySummary() {
    var text = summaryText();
    var done = function () { toast('Submission summary copied.', 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast('Copy failed.', 'error'); });
    else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (_) { toast('Copy failed.', 'error'); } ta.remove(); }
  }

  /* ── render everything ───────────────────────────────────────── */
  function refresh() {
    if (!$('cb-form')) return;
    renderForm();
    syncFormFromState();
    var r = readiness();
    var rn = r.refName;
    var refEl = $('cb-refname');
    if (refEl) refEl.innerHTML = rn.parts.map(function (p, i) { return '<span class="cb-ref-part' + (p ? '' : ' is-missing') + '" data-part="' + i + '">' + escapeHtml(p || '?') + '</span>'; }).join('<i>_</i>');
    var refNote = $('cb-refname-note');
    if (refNote) refNote.textContent = rn.complete ? 'Follows the BatteryLake naming standard: Year_Source_Chemistry_Form_ChargeRate_DischargeRate_Temperature.' : 'Fill the required fields to complete the reference name.';
    var json = $('cb-json');
    if (json) json.textContent = metadataJson();
    var list = $('cb-readiness');
    if (list) list.innerHTML = r.items.map(function (i) {
      return '<li class="cb-ready is-' + i.state + '"><span class="cb-ready-icon">' + (i.state === 'ok' ? '✓' : i.state === 'warn' ? '!' : '○') + '</span><div><strong>' + escapeHtml(i.label) + '</strong><small>' + i.text.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + escapeHtml(c) + '</code>'; }) + '</small></div><span class="cb-ready-tag">' + i.tag + '</span></li>';
    }).join('');
    var score = $('cb-score');
    if (score) { score.textContent = r.ok + ' / ' + r.total; score.className = 'cb-score-value ' + (r.readyToSubmit ? 'is-ok' : r.ok >= 3 ? 'is-warn' : 'is-todo'); }
    var scoreNote = $('cb-score-note');
    if (scoreNote) scoreNote.textContent = r.readyToSubmit ? 'Ready to submit.' : (r.total - r.ok) + ' item' + (r.total - r.ok === 1 ? '' : 's') + ' left before the package is complete. You can still download a draft.';
    var bar = $('cb-score-bar');
    if (bar) bar.style.setProperty('--pct', Math.round(r.ok / r.total * 100) + '%');
    renderPrecheck();
    renderStatus();
    renderTree();
    var gh = $('cb-github');
    if (gh) gh.href = submitLink();
    var dl = $('cb-download-btn');
    if (dl) dl.disabled = !r.packageable;
    var filled = r.required.filter(function (x) { return x.ok; }).length;
    var rail = { 1: filled + ' / ' + r.required.length + ' required fields', 2: state.precheck ? 'sample checked · ' + r.ok + '/' + r.total + ' ready' : r.ok + ' / ' + r.total + ' ready', 3: r.packageable ? (r.readyToSubmit ? 'complete' : 'draft available') : 'needs step 1', 4: r.readyToSubmit ? 'ready' : 'after the checks' };
    Object.keys(rail).forEach(function (k) { var e = $('cb-rail-' + k); if (e) e.textContent = rail[k]; });
    document.querySelectorAll('#cb-rail li').forEach(function (li) {
      var n = Number(li.dataset.step);
      li.classList.toggle('is-done', (n === 1 && filled === r.required.length) || (n === 2 && r.readyToSubmit) || (n === 3 && r.readyToSubmit));
    });
  }

  /* ── agent-facing API ────────────────────────────────────────── */
  var ALIASES = { dataset_name: 'name', title: 'name', lab: 'institution', source: 'institution', organisation: 'institution', organization: 'institution', university: 'institution', chem: 'chemistry', form_factor: 'form', format: 'form', n_cells: 'cells', cell_count: 'cells', number_of_cells: 'cells', capacity: 'capacity_ah', nominal_capacity: 'capacity_ah', nominal_capacity_ah: 'capacity_ah', charge_rate: 'charge_c', c_rate: 'charge_c', discharge_rate: 'discharge_c', temp: 'temperature', temperature_c: 'temperature', url: 'data_url', download_url: 'data_url', link: 'data_url', paper: 'doi', paper_doi: 'doi', licence: 'license', email: 'contact', contact_email: 'contact', protocol_notes: 'protocol', description: 'notes', note: 'notes' };
  function prefill(fields) {
    var applied = [], ignored = [];
    Object.keys(fields || {}).forEach(function (k) {
      var key = ALIASES[k] || k;
      var def = FIELDS.filter(function (f) { return f.key === key; })[0];
      var v = fields[k];
      if (!def || v == null || v === '') { ignored.push(k); return; }
      v = String(v).trim();
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
    state.fields = {}; state.precheck = null; state.status = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    var form = $('cb-form');
    if (form) form.querySelectorAll('[data-key]').forEach(function (el) { el.value = ''; });
    refresh();
    toast('Draft cleared.', 'info');
  }
  function summary() {
    var r = readiness();
    return { refName: r.refName.name, ok: r.ok, total: r.total, readyToSubmit: r.readyToSubmit, packageable: r.packageable, items: r.items.map(function (i) { return { key: i.key, label: i.label, state: i.state, text: i.text }; }), precheck: state.precheck ? { overall: state.precheck.overall, gate: state.precheck.gate } : null, fields: Object.assign({}, state.fields) };
  }

  /* ── drop zones + init ───────────────────────────────────────── */
  function wireDrop(zoneId, inputId, handler) {
    var zone = $(zoneId), input = $(inputId);
    if (!zone) return;
    ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-drag'); }); });
    ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); if (t === 'dragleave' && zone.contains(e.relatedTarget)) return; zone.classList.remove('is-drag'); }); });
    zone.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handler(f).catch(function () {}); });
    if (input) input.addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; if (f) handler(f).catch(function () {}); e.target.value = ''; });
  }
  function init() {
    if (state.initialized || !$('cb-form')) return;
    state.initialized = true;
    load();
    renderForm();
    wireDrop('cb-sample-drop', 'cb-sample-input', precheckFile);
    wireDrop('cb-status-drop', 'cb-status-input', loadStatusFile);
    var dl = $('cb-download-btn'); if (dl) dl.addEventListener('click', downloadPackage);
    var cp = $('cb-copy-btn'); if (cp) cp.addEventListener('click', copySummary);
    var cj = $('cb-copy-json'); if (cj) cj.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(metadataJson()).then(function () { toast('metadata.json copied.', 'success'); }); });
    var cl = $('cb-clear-btn'); if (cl) cl.addEventListener('click', clearDraft);
    var gh = $('cb-github'); if (gh) gh.addEventListener('click', function () { gh.href = submitLink(); });
    document.querySelectorAll('#cb-rail li').forEach(function (li) { li.addEventListener('click', function () { focusStep(Number(li.dataset.step)); }); });
    var gatesEl = $('cb-gates-info');
    if (gatesEl) gatesEl.innerHTML = GATES.map(function (g) { return '<div class="cb-gate-info"><b>' + g[0] + '</b><strong>' + g[1] + '</strong><span>' + g[2] + '</span></div>'; }).join('');
    refresh();
  }

  window.BatteryLakeContribute = {
    init: init, refresh: refresh, prefill: prefill, check: function () { refresh(); return summary(); }, precheckFile: precheckFile, loadStatusFile: loadStatusFile,
    downloadPackage: downloadPackage, submitLink: submitLink, summaryText: summaryText, summary: summary, focusStep: focusStep, clearDraft: clearDraft, FIELDS: FIELDS
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
