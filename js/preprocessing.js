/* ═══════════════════════════════════════════════════════════════
   Preprocessing page — hand-off to the BatteryLake processing skill.
   Serves the skill files under assets/skills/batterylake-processing/
   as a zip, builds the agent prompt for a catalog dataset, and renders
   a dataset's status.json against the five acceptance gates.
   Depends on globals from js/main.js: DATASETS, getCatalogDatasets,
   esc, showToast, bwZipBlob, BatteryLakeAnalytics.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SKILL_ROOT = 'assets/skills/batterylake-processing/';
  var SKILL_NAME = 'batterylake-processing';
  var SKILL_FILES = [
    { path: 'SKILL.md', desc: 'Execution routing for the agent (read first)' },
    { path: 'references/schema.md', desc: 'Schema 2.0.0: file layout, canonical tables, labels, manifest' },
    { path: 'references/equivalence.md', desc: 'Raw-versus-standard benchmark equivalence contract' },
    { path: 'standard/README.md', desc: 'BatteryLake processing standard v2.0.0 (English)' },
    { path: 'standard/README.zh-CN.md', desc: 'BatteryLake processing standard v2.0.0 (Chinese)' }
  ];

  var AGENT_INSTALL = {
    claude: {
      code: 'unzip batterylake-processing.zip -d .claude/skills/\n# -> .claude/skills/batterylake-processing/SKILL.md',
      note: 'Claude Code discovers <code>.claude/skills/&lt;name&gt;/SKILL.md</code> automatically; invoke it with <code>/batterylake-processing</code> or by asking for it by name.'
    },
    codex: {
      code: 'unzip batterylake-processing.zip -d .agents/skills/\n# -> .agents/skills/batterylake-processing/SKILL.md',
      note: 'Codex loads skills from <code>.agents/skills/&lt;name&gt;/SKILL.md</code> in the repository; mention the skill by name in your request.'
    }
  };

  /* Server-side category folder for each catalog category key. */
  var CATEGORY_FOLDERS = {
    cycle_aging: 'cycle_aging',
    calendar_aging: 'calendar_aging',
    characterization: 'characterization',
    field_data: 'field_data',
    field_fault_diagnosis: 'field_data',
    soh_estimation: 'soh_estimation',
    soc_estimation: 'soc_estimation',
    relaxation: 'eis',
    eis: 'eis',
    thermal_runaway: 'thermal_runaway',
    safety: 'thermal_runaway',
    ev: 'ev'
  };
  var FOLDER_OVERRIDES = { dataset_12: 'ev', dataset_31: 'eis' };

  var GATES = [
    { key: 'I', name: 'Inventory' },
    { key: 'S', name: 'Semantics' },
    { key: 'C', name: 'Conversion' },
    { key: 'V', name: 'Fidelity' },
    { key: 'E', name: 'Equivalence' }
  ];
  var DIMENSIONS = [
    ['status', 'Status'],
    ['conversion', 'Conversion'],
    ['canonical_validation', 'Canonical validation'],
    ['benchmark_validation', 'Benchmark validation'],
    ['upstream_completeness', 'Upstream completeness']
  ];

  /* Real status.json from the data server (dataset_21, eVTOL), shown until a file is dropped. */
  var EXAMPLE_STATUS = {
    dataset_id: 'dataset_21',
    schema_version: '2.0.0',
    status: 'needs_semantic_review',
    conversion: 'source_tables_converted',
    canonical_validation: 'measurement_fields_verified; cycle/protocol semantics pending',
    benchmark_validation: 'not_run',
    upstream_completeness: 'unverified',
    stages: { I: 'done', S: 'pending', C: 'local_source_decode_complete', V: 'storage_only', E: 'pending' },
    parser_errors: 0,
    source_table_rows: 15309852,
    standard_signal_rows: 15309317
  };

  var state = { agent: 'claude', fileSizes: {}, status: EXAMPLE_STATUS, isExample: true };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) { return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s); }
  function toast(msg, type) { if (typeof window.showToast === 'function') window.showToast(msg, type || 'info'); }
  function fmtBytes(n) {
    if (!Number.isFinite(n)) return '';
    return n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';
  }
  function fmtInt(n) { return Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : String(n); }

  /* ── 1. Skill package ─────────────────────────────────────── */
  function renderFiles() {
    var box = $('px-skill-files');
    if (!box) return;
    box.innerHTML = SKILL_FILES.map(function (f) {
      var size = state.fileSizes[f.path];
      return '<a class="px-file" href="' + SKILL_ROOT + f.path + '" target="_blank" rel="noopener">'
        + '<span class="px-file-name">' + escapeHtml(f.path) + '</span>'
        + '<span class="px-file-desc">' + escapeHtml(f.desc) + '</span>'
        + '<span class="px-file-size">' + (size ? fmtBytes(size) : '') + '</span>'
        + '</a>';
    }).join('');
  }

  function fetchSkillFile(path) {
    return fetch(SKILL_ROOT + path, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + path + ' (' + res.status + ')');
      return res.text();
    });
  }

  function loadFileSizes() {
    SKILL_FILES.forEach(function (f) {
      fetchSkillFile(f.path).then(function (text) {
        state.fileSizes[f.path] = new TextEncoder().encode(text).length;
        renderFiles();
      }).catch(function () { /* sizes are cosmetic */ });
    });
  }

  function installMd() {
    return '# batterylake-processing skill\n\n'
      + 'Agent skill for converting raw BatteryLake datasets into the v2.0.0 processing standard.\n'
      + 'Downloaded from the BatteryLake platform (https://tianwen1209.github.io/batterylake/#preprocessing).\n\n'
      + '## Install\n\n'
      + 'Run inside the BatteryLake data repository (the folder containing Raw_Dataset/ and Processed_Dataset_Standard/).\n\n'
      + '- Claude Code: unzip into `.claude/skills/` so that `.claude/skills/batterylake-processing/SKILL.md` exists.\n'
      + '- Codex: unzip into `.agents/skills/` so that `.agents/skills/batterylake-processing/SKILL.md` exists.\n\n'
      + '## Files\n\n'
      + SKILL_FILES.map(function (f) { return '- `' + f.path + '` - ' + f.desc; }).join('\n') + '\n\n'
      + 'SKILL.md and the references are the execution routing; `standard/README.md` is the processing standard the skill defers to. '
      + 'In the data repository the standard lives at `Processed_Dataset_Standard/README.md`; the copy here is for reading offline.\n\n'
      + '## Example prompt\n\n'
      + '```\n' + buildPrompt(selectedDataset()) + '\n```\n';
  }

  function downloadSkill() {
    var btn = $('px-download-btn');
    if (typeof window.bwZipBlob !== 'function') { toast('Zip builder unavailable in this build.', 'error'); return; }
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Preparing…'; }
    Promise.all(SKILL_FILES.map(function (f) { return fetchSkillFile(f.path); })).then(function (texts) {
      var files = SKILL_FILES.map(function (f, i) { return { name: SKILL_NAME + '/' + f.path, data: texts[i] }; });
      files.push({ name: SKILL_NAME + '/INSTALL.md', data: installMd() });
      var blob = window.bwZipBlob(files);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = SKILL_NAME + '.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
        window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'preprocessing_skill' });
      }
      toast('Downloading ' + SKILL_NAME + '.zip', 'success');
    }).catch(function (err) {
      toast('Download failed: ' + (err && err.message || 'unknown error'), 'error');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Download skill (.zip)'; }
    });
  }

  function setAgent(agent) {
    if (!AGENT_INSTALL[agent]) return;
    state.agent = agent;
    document.querySelectorAll('#page-preprocessing .px-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.agent === agent);
      tab.setAttribute('aria-selected', tab.dataset.agent === agent ? 'true' : 'false');
    });
    var code = $('px-install-code');
    var note = $('px-install-note');
    if (code) code.textContent = AGENT_INSTALL[agent].code;
    if (note) note.innerHTML = AGENT_INSTALL[agent].note;
  }

  /* ── 2. Prompt builder ────────────────────────────────────── */
  function catalog() {
    var list = typeof window.getCatalogDatasets === 'function' ? window.getCatalogDatasets() : (window.DATASETS || []);
    return list.slice().sort(function (a, b) { return String(a.id).localeCompare(String(b.id), undefined, { numeric: true }); });
  }
  function folderFor(d) {
    if (!d) return 'cycle_aging';
    return FOLDER_OVERRIDES[d.id] || CATEGORY_FOLDERS[d.category] || 'cycle_aging';
  }
  function selectedDataset() {
    var sel = $('px-dataset-select');
    var id = sel ? sel.value : '';
    return catalog().find(function (d) { return d.id === id; }) || catalog()[0] || null;
  }
  function buildPrompt(d) {
    var id = d ? d.id : 'dataset_xx';
    var folder = folderFor(d);
    var ref = d && d.ref_name && d.ref_name !== '—' ? d.ref_name : '';
    var lines = [
      'Use the batterylake-processing skill in this repository.',
      'Dataset: Raw_Dataset/' + folder + '/' + id + (ref ? ' (' + ref + ')' : '') + '.',
      'Output: Processed_Dataset/' + folder + '/' + id + '/.',
      'Read Processed_Dataset_Standard/README.md and the dataset TODO.md first, then continue from the first unfinished gate in status.json.',
      'Do not modify anything under Raw_Dataset. Preserve every source field in the canonical layer; do not resample, clean or guess labels there.',
      'When you stop, report actual row counts, coverage, failures, unresolved semantics and the next step.'
    ];
    return lines.join('\n');
  }
  function renderDatasetOptions() {
    var sel = $('px-dataset-select');
    if (!sel) return;
    var current = sel.value;
    var items = catalog();
    sel.innerHTML = items.map(function (d) {
      var label = d.id + ' · ' + (d.ref_name && d.ref_name !== '—' ? d.ref_name : d.name);
      return '<option value="' + escapeHtml(d.id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    if (current && items.some(function (d) { return d.id === current; })) sel.value = current;
    else if (items.some(function (d) { return d.id === 'dataset_03'; })) sel.value = 'dataset_03';
    renderPrompt();
  }
  function renderPrompt() {
    var pre = $('px-prompt');
    if (pre) pre.textContent = buildPrompt(selectedDataset());
  }

  /* ── 3. Copy helper ───────────────────────────────────────── */
  function copy(id, btn) {
    var el = $(id);
    var text = el ? el.textContent.trim() : '';
    if (!text) return;
    function done(ok) {
      if (btn) {
        var old = btn.textContent;
        btn.textContent = ok ? 'Copied' : 'Select text';
        setTimeout(function () { btn.textContent = old; }, 1500);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      done(ok);
    }
  }

  /* ── 4. status.json viewer ────────────────────────────────── */
  var DONE_RE = /done|complete|verified|passed|validated|inventoried|decoded|converted|checked/i;
  var PENDING_RE = /pending|not_run|not run|blocked|missing|unverified|^-?$/i;
  function classify(value) {
    var v = String(value == null ? '' : value).trim();
    if (!v) return 'pending';
    if (PENDING_RE.test(v) && !DONE_RE.test(v)) return 'pending';
    if (/only|partial|pending|sample|source_checks/i.test(v)) return 'partial';
    if (DONE_RE.test(v)) return 'done';
    return 'partial';
  }
  function renderStatus() {
    var st = state.status || {};
    var badge = $('px-status-badge');
    if (badge) badge.hidden = !state.isExample;
    var idEl = $('px-status-id');
    if (idEl) idEl.textContent = st.dataset_id || 'unknown dataset';
    var overall = $('px-status-overall');
    if (overall) {
      overall.textContent = st.status || '—';
      overall.className = 'px-status-overall is-' + classify(st.status);
    }
    var stages = st.stages || {};
    var track = $('px-stage-track');
    if (track) {
      track.innerHTML = GATES.map(function (g) {
        var raw = stages[g.key];
        var cls = raw === undefined ? 'pending' : classify(raw);
        var label = raw === undefined ? 'not recorded' : String(raw);
        return '<div class="px-stage is-' + cls + '" title="' + escapeHtml(label) + '">'
          + '<span class="px-stage-letter">' + g.key + '</span>'
          + '<span class="px-stage-name">' + g.name + '</span>'
          + '<span class="px-stage-value">' + escapeHtml(label) + '</span>'
          + '</div>';
      }).join('');
    }
    var dims = $('px-status-dims');
    if (dims) {
      dims.innerHTML = DIMENSIONS.map(function (pair) {
        var raw = st[pair[0]];
        var text = raw === undefined || raw === null || raw === '' ? 'not recorded' : String(raw);
        return '<div class="px-dim is-' + classify(raw) + '"><dt>' + pair[1] + '</dt><dd>' + escapeHtml(text) + '</dd></div>';
      }).join('');
    }
    var counts = $('px-status-counts');
    if (counts) {
      var items = [];
      if (st.source_table_rows !== undefined && st.source_table_rows !== null) items.push(['Source table rows', fmtInt(st.source_table_rows)]);
      if (st.standard_signal_rows !== undefined && st.standard_signal_rows !== null) items.push(['Standard signal rows', fmtInt(st.standard_signal_rows)]);
      if (st.parser_errors !== undefined) items.push(['Parser errors', fmtInt(st.parser_errors)]);
      if (st.incremental_processing) {
        var ip = st.incremental_processing;
        items.push(['Sources processed / failed / pending', fmtInt(ip.processed_sources || 0) + ' / ' + fmtInt(ip.failed_sources || 0) + ' / ' + fmtInt(ip.pending_sources || 0)]);
      }
      if (st.schema_version) items.push(['Schema', String(st.schema_version)]);
      counts.innerHTML = items.map(function (it) {
        return '<div class="px-count"><span>' + escapeHtml(it[0]) + '</span><strong>' + escapeHtml(it[1]) + '</strong></div>';
      }).join('');
    }
  }
  function loadStatusFile(file) {
    if (!file) return;
    file.text().then(function (text) {
      var data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('not an object');
      if (!data.stages && !data.status && !data.conversion) throw new Error('no status fields');
      state.status = data;
      state.isExample = false;
      renderStatus();
      toast('Loaded status for ' + (data.dataset_id || file.name), 'success');
    }).catch(function () {
      toast('This file is not a BatteryLake status.json.', 'error');
    });
  }
  function handleStatusFile(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    loadStatusFile(file);
    if (event && event.target) event.target.value = '';
  }
  function initDropZone() {
    var zone = $('px-status-drop');
    if (!zone) return;
    ['dragenter', 'dragover'].forEach(function (type) {
      zone.addEventListener(type, function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragging'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      zone.addEventListener(type, function (e) {
        e.preventDefault(); e.stopPropagation();
        if (type === 'dragleave' && zone.contains(e.relatedTarget)) return;
        zone.classList.remove('dragging');
      });
    });
    zone.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) { toast('No file was dropped.', 'error'); return; }
      loadStatusFile(file);
    });
  }

  /* ── init ─────────────────────────────────────────────────── */
  function init() {
    if (!$('page-preprocessing')) return;
    renderFiles();
    loadFileSizes();
    setAgent(state.agent);
    renderDatasetOptions();
    renderStatus();
    initDropZone();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.BatteryLakePreprocessing = {
    downloadSkill: downloadSkill,
    setAgent: setAgent,
    renderPrompt: renderPrompt,
    refreshDatasets: renderDatasetOptions,
    copy: copy,
    handleStatusFile: handleStatusFile
  };
})();
