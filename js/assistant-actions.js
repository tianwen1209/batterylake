/* BatteryLake AI assistant — Agent mode tools.
 *
 * A small, whitelisted set of page actions the assistant can execute on the
 * user's behalf ("open dataset_21's quality report", "filter LFP pouch
 * datasets", "download the processing skill"). The language model (or the
 * rule-based fallback planner below) turns a request into a JSON plan of
 * these tools; assistant.js executes the plan and reports each step.
 *
 * Every tool validates its arguments against the live catalog / page state,
 * so the model can never trigger anything outside this list.
 */
(function () {
  'use strict';

  var PAGES = {
    home: 'Home', datasets: 'Datasets', benchmarks: 'Benchmarks', models: 'Model library', quality: 'Quality Assessment',
    preprocessing: 'Preprocessing', apis: 'APIs & Applications', contribute: 'Contribute', naming: 'Naming Standard',
    docs: 'Documentation', about: 'About', terms: 'Terms & Citation', tasks: 'Tasks'
  };
  var CHEMS = ['LCO', 'LFP', 'NCA', 'NMC'];
  var FORMS = ['18650', '21700', 'Cyl', 'Pouch', 'Prismatic'];
  var CATEGORIES = ['calendar_aging', 'characterization', 'cycle_aging', 'eis', 'field_data', 'field_fault_diagnosis', 'relaxation', 'soc_estimation', 'soh_estimation', 'thermal_runaway'];
  var DOMAINS = ['ev', 'grid', 'lab'];

  var TOOLS = [
    { name: 'open_page', description: 'Navigate to a page of the site.', args: { page: 'one of ' + Object.keys(PAGES).join(' | ') } },
    { name: 'open_dataset', description: 'Open the detail window of a catalog dataset (metadata, source and processed downloads).', args: { dataset_id: 'catalog id such as dataset_21' } },
    { name: 'open_quality_report', description: 'Open the precomputed quality report of a dataset on the Quality page.', args: { dataset_id: 'catalog id' } },
    { name: 'download_quality_report', description: 'Download the quality report JSON (of a dataset, or of the report currently shown).', args: { dataset_id: 'catalog id, optional' } },
    { name: 'assess_quality_sample', description: 'Run the browser quality engine on a bundled sample excerpt of a dataset (only dataset_21, dataset_17, dataset_05, dataset_35 have samples).', args: { dataset_id: 'catalog id' } },
    { name: 'filter_datasets', description: 'Filter the Datasets catalog. Omitted fields are left unfiltered; the previous filter is replaced.', args: { chemistry: 'list of ' + CHEMS.join(' | '), form: 'list of ' + FORMS.join(' | '), category: 'list of ' + CATEGORIES.join(' | '), domain: 'list of ' + DOMAINS.join(' | '), query: 'free-text search, optional' } },
    { name: 'clear_filters', description: 'Clear all catalog filters and the search box.', args: {} },
    { name: 'download_skill', description: 'Download the batterylake-processing agent skill package (zip).', args: {} },
    { name: 'select_preprocessing_dataset', description: 'On the Preprocessing page, select the dataset for which the agent prompt is generated.', args: { dataset_id: 'catalog id' } },
    { name: 'open_model', description: 'Open a model from the Model library.', args: { model: 'model id or part of its name' } },
    { name: 'set_theme', description: 'Switch the site theme.', args: { theme: 'light | dark' } },
    { name: 'start_contribution', description: 'Open the Contribute page (describe -> upload raw data -> submit a new dataset).', args: {} },
    { name: 'prefill_contribution', description: 'Fill the contribution form from what the user said. Give only the fields mentioned.', args: { name: 'dataset name', institution: 'lab / university token, e.g. NTU_EEE', year: 'publication year', chemistry: 'LFP | NMC | NMC811 | NCA | LCO | LMO | LTO | LiIon | MultiChem', form: '18650 | 21700 | Pouch | Prismatic | Cyl | Auto | EV-BMS', cells: 'number of cells', capacity_ah: 'nominal capacity in Ah', charge_c: 'charge rate, e.g. 1C or Multi', discharge_c: 'discharge rate', temperature: 'test temperature in C or Multi', category: 'cycle_aging | calendar_aging | characterization | field_data | field_fault_diagnosis | soh_estimation | soc_estimation | eis | thermal_runaway | ev', data_url: 'download link', doi: 'paper or data DOI/URL', license: 'CC BY 4.0 | CC BY-NC 4.0 | CC BY-SA 4.0 | CC0 1.0 | MIT | ODC-By 1.0', contact: 'email', protocol: 'test protocol notes', layout: 'file layout and cell identifier notes', notes: 'known issues' } },
    { name: 'check_contribution', description: 'Report the contribution readiness checklist (what is filled, what is missing, files uploaded).', args: {} },
    { name: 'open_contribution_upload', description: 'Open the raw-data upload step of the Contribute page so the user can drop the files (files cannot be selected by the agent).', args: {} },
    { name: 'download_contribution_package', description: 'Download a zip copy of the contribution (metadata.json, protocol.md, checklist).', args: {} },
    { name: 'submit_contribution', description: 'Submit the contribution: stores submission.json next to the uploaded files and gives the prefilled GitHub issue link.', args: {} }
  ];

  /* ── helpers ─────────────────────────────────────────────────────── */
  function KB() { return window.BatteryLakeKnowledge || null; }
  function catalog() { return KB() ? KB().catalog() : (typeof getCatalogDatasets === 'function' ? getCatalogDatasets() : []); }
  function isZh(text) { return /[぀-ヿ㐀-鿿]/.test(text || ''); }
  function link(d) { return '[' + d.name + '](dataset:' + d.id + ')'; }
  function pageLink(page) { return '[' + (PAGES[page] || page) + '](#' + page + ')'; }
  function fn(name) { return typeof window[name] === 'function' ? window[name] : (function () { try { return eval(name); } catch (_) { return null; } })(); }
  function call(name) {
    var f = fn(name);
    if (typeof f !== 'function') throw new Error(name + ' is not available on this page');
    return f.apply(null, Array.prototype.slice.call(arguments, 1));
  }
  function navEl(page) {
    return document.getElementById('nav-' + page) || document.querySelector('.sidebar-nav a[onclick*="showPage(\'' + page + '\'"]');
  }
  function gotoPage(page) {
    call('showPage', page, navEl(page));
  }
  /* The model is not always consistent about argument names: accept any
     string argument that looks like a dataset reference. */
  function datasetArg(args) {
    args = args || {};
    var keys = ['dataset_id', 'dataset', 'id', 'datasetId', 'dataset_name', 'name', 'ref_name', 'query', 'target'];
    for (var i = 0; i < keys.length; i++) if (typeof args[keys[i]] === 'string' && args[keys[i]].trim()) return args[keys[i]];
    var any = Object.keys(args).map(function (k) { return args[k]; }).filter(function (v) { return typeof v === 'string' && v.trim(); });
    return any[0] || '';
  }
  function resolveDataset(ref) {
    var items = catalog();
    if (ref && typeof ref === 'object') ref = datasetArg(ref);
    var raw = String(ref || '').trim();
    if (!raw) return null;
    var m = raw.toLowerCase().match(/dataset[_\s-]?(\d{1,3})/);
    if (m) {
      var id = 'dataset_' + (m[1].length === 1 ? '0' + m[1] : m[1]);
      var hit = items.filter(function (d) { return d.id === id; })[0];
      if (hit) return hit;
    }
    var exact = items.filter(function (d) { return d.id === raw || d.ref_name === raw || d.name.toLowerCase() === raw.toLowerCase(); })[0];
    if (exact) return exact;
    if (KB()) {
      var found = KB().find(raw);
      if (found && found.items && found.items.length === 1) return found.items[0];
      if (found && found.items && found.items.length) return found.items[0];
    }
    return null;
  }
  function asList(v) {
    if (v === undefined || v === null || v === '') return [];
    return (Array.isArray(v) ? v : String(v).split(/[,/]/)).map(function (x) { return String(x).trim(); }).filter(Boolean);
  }
  function normChem(c) { c = String(c).toUpperCase(); if (c.indexOf('NMC') === 0) return 'NMC'; return CHEMS.indexOf(c) >= 0 ? c : null; }
  function normForm(f) {
    var s = String(f).toLowerCase();
    if (/^cyl/.test(s)) return 'Cyl';
    var hit = FORMS.filter(function (x) { return x.toLowerCase() === s; })[0];
    return hit || null;
  }
  function normCategory(c) {
    var s = String(c).toLowerCase().replace(/[\s-]+/g, '_');
    if (s === 'safety') s = 'thermal_runaway';
    if (s === 'impedance') s = 'eis';
    return CATEGORIES.indexOf(s) >= 0 ? s : null;
  }

  /* ── tool implementations: each returns {ok, summary, navigated} ── */
  var IMPL = {
    open_page: function (args) {
      var page = String(args.page || '').toLowerCase().trim();
      if (page === 'model-library' || page === 'model_library') page = 'models';
      if (!PAGES[page]) return { ok: false, summary: 'Unknown page "' + (args.page || '') + '". Pages: ' + Object.keys(PAGES).join(', ') };
      gotoPage(page);
      return { ok: true, summary: 'Opened the ' + pageLink(page) + ' page', navigated: true };
    },
    open_dataset: function (args) {
      var d = resolveDataset(datasetArg(args));
      if (!d) return { ok: false, summary: 'Could not find a catalog dataset matching "' + datasetArg(args) + '"' };
      gotoPage('datasets');
      call('openDatasetModal', d.id);
      var cells = String(d.cells || '').trim().replace(/^[—–-]+$/, '');
      return { ok: true, summary: 'Opened ' + link(d) + ' (' + d.id + ') — ' + [d.chemistry, d.form, cells ? cells + (/^[\d,]+$/.test(cells) ? ' cells' : '') : ''].filter(Boolean).join(' · '), navigated: true };
    },
    open_quality_report: async function (args) {
      var d = resolveDataset(datasetArg(args));
      if (!d) return { ok: false, summary: 'Could not find a catalog dataset matching "' + datasetArg(args) + '"' };
      var report = await call('loadQualityReport', d.id);
      if (!report) return { ok: false, summary: 'No precomputed quality report for ' + link(d) + ' yet (it has no canonical v2 time series). Reports exist for datasets listed on the [Quality](#quality) page.' };
      await call('showDatasetQuality', d.id);
      return { ok: true, summary: 'Opened the quality report of ' + link(d) + ': overall **' + Number(report.overall).toFixed(2) + '**, ' + (report.gate === 'ready' ? 'ready' : report.gate === 'needs_review' ? 'needs review' : 'ready with ' + report.warn_count + ' warning' + (report.warn_count === 1 ? '' : 's')), navigated: true };
    },
    download_quality_report: async function (args) {
      if (datasetArg(args)) {
        var r = await IMPL.open_quality_report(args);
        if (!r.ok) return r;
      } else {
        gotoPage('quality');
      }
      call('downloadQualityReport');
      return { ok: true, summary: 'Downloaded the quality report JSON', navigated: true };
    },
    assess_quality_sample: async function (args) {
      var d = resolveDataset(datasetArg(args));
      gotoPage('quality');
      await call('qaLoadSamples');
      var grid = document.getElementById('qaSampleGrid');
      var samples = [];
      try { samples = JSON.parse((grid && grid.dataset.samples) || '[]'); } catch (_) { samples = []; }
      var idx = d ? samples.findIndex(function (s) { return s.dataset_id === d.id; }) : -1;
      if (idx < 0) return { ok: false, summary: 'No sample excerpt for ' + (d ? link(d) : '"' + datasetArg(args) + '"') + '. Samples: ' + samples.map(function (s) { return s.dataset_id; }).join(', '), navigated: true };
      call('qaRunSample', idx);
      return { ok: true, summary: 'Running the quality engine on the ' + link(d) + ' sample (' + samples[idx].rows + ' rows) in your browser', navigated: true };
    },
    filter_datasets: function (args) {
      var chems = asList(args.chemistry).map(normChem).filter(Boolean);
      var forms = asList(args.form || args.form_factor).map(normForm).filter(Boolean);
      var cats = asList(args.category).map(normCategory).filter(Boolean);
      var domains = asList(args.domain).map(function (x) { return String(x).toLowerCase(); }).filter(function (x) { return DOMAINS.indexOf(x) >= 0; });
      asList(args.category).forEach(function (c) { if (/^ev$|electric/i.test(c) && domains.indexOf('ev') < 0) domains.push('ev'); });
      var query = String(args.query || '').trim();
      if (!chems.length && !forms.length && !cats.length && !domains.length && !query) {
        return { ok: false, summary: 'No usable filter given. Chemistry: ' + CHEMS.join('/') + '; form: ' + FORMS.join('/') + '; category: ' + CATEGORIES.join('/') };
      }
      gotoPage('datasets');
      call('clearPendingDatasetFilters');
      chems.forEach(function (c) { pendingChems.add(c); });
      forms.forEach(function (f) { pendingForms.add(f); });
      cats.forEach(function (c) { pendingCategories.add(c); });
      domains.forEach(function (x) { pendingDomains.add(x); });
      call('applyDatasetFilters');
      var input = document.getElementById('searchInput');
      if (input) { input.value = query; call('onSearchInput'); }
      var items = call('getFiltered');
      var label = [].concat(chems, forms, cats.map(function (c) { return KB() ? KB().categoryLabel(c) : c; }), domains.map(function (x) { return x.toUpperCase(); }), query ? ['"' + query + '"'] : []).join(' · ');
      var names = items.slice(0, 6).map(link).join(', ') + (items.length > 6 ? ', …' : '');
      return { ok: true, summary: 'Filtered the catalog by ' + label + ': **' + items.length + '** dataset' + (items.length === 1 ? '' : 's') + (items.length ? ' — ' + names : ''), navigated: true, count: items.length };
    },
    clear_filters: function () {
      gotoPage('datasets');
      call('clearPendingDatasetFilters');
      var input = document.getElementById('searchInput');
      if (input && input.value) { input.value = ''; call('onSearchInput'); }
      return { ok: true, summary: 'Cleared all catalog filters (' + call('getFiltered').length + ' datasets shown)', navigated: true };
    },
    download_skill: function () {
      gotoPage('preprocessing');
      if (!window.BatteryLakePreprocessing || typeof window.BatteryLakePreprocessing.downloadSkill !== 'function') return { ok: false, summary: 'The Preprocessing page is not ready' };
      window.BatteryLakePreprocessing.downloadSkill();
      return { ok: true, summary: 'Downloading `batterylake-processing.zip` — install it with `unzip batterylake-processing.zip -d .claude/skills/` (see the [Preprocessing](#preprocessing) page)', navigated: true };
    },
    select_preprocessing_dataset: function (args) {
      var d = resolveDataset(datasetArg(args));
      if (!d) return { ok: false, summary: 'Could not find a catalog dataset matching "' + datasetArg(args) + '"' };
      gotoPage('preprocessing');
      var sel = document.getElementById('px-dataset-select');
      if (!sel) return { ok: false, summary: 'The Preprocessing page is not ready' };
      if (!sel.querySelector('option[value="' + d.id + '"]') && window.BatteryLakePreprocessing) window.BatteryLakePreprocessing.refreshDatasets();
      if (!sel.querySelector('option[value="' + d.id + '"]')) return { ok: false, summary: link(d) + ' is not available in the Preprocessing selector' };
      sel.value = d.id;
      if (window.BatteryLakePreprocessing && typeof window.BatteryLakePreprocessing.renderPrompt === 'function') window.BatteryLakePreprocessing.renderPrompt();
      return { ok: true, summary: 'Selected ' + link(d) + ' on the [Preprocessing](#preprocessing) page; the agent prompt is ready to copy', navigated: true };
    },
    open_model: function (args) {
      var q = String(args.model || args.model_id || args.query || '').trim().toLowerCase();
      var models = call('mlCatalogModels') || [];
      var m = models.filter(function (x) { return String(x.id).toLowerCase() === q; })[0] ||
        models.filter(function (x) { return q && String(x.name || '').toLowerCase().indexOf(q) >= 0; })[0] ||
        models.filter(function (x) { return q && q.split(/\s+/).some(function (t) { return t.length > 2 && (String(x.name || '') + ' ' + x.id).toLowerCase().indexOf(t) >= 0; }); })[0];
      if (!m) return { ok: false, summary: 'No model matching "' + q + '". Models: ' + models.map(function (x) { return x.name || x.id; }).join(', ') };
      call('mlOpenDetails', m.id);
      return { ok: true, summary: 'Opened the model **' + (m.name || m.id) + '** in the [Model library](#models)', navigated: true };
    },
    start_contribution: function () {
      gotoPage('contribute');
      var C = window.BatteryLakeContribute;
      if (C) { C.init(); C.refresh(); C.focusStep(1); }
      return { ok: true, summary: 'Opened the [Contribute](#contribute) page: describe the dataset, upload the raw files, submit', navigated: true };
    },
    prefill_contribution: function (args) {
      var C = window.BatteryLakeContribute;
      if (!C) return { ok: false, summary: 'The Contribute page is not available' };
      gotoPage('contribute');
      C.init();
      var r = C.prefill(args || {});
      if (!r.applied.length) return { ok: false, summary: 'No recognised contribution fields in ' + JSON.stringify(args || {}), navigated: true };
      var missing = r.readiness.required.filter(function (x) { return !x.ok; }).map(function (x) { return x.label; });
      C.focusStep(1);
      return { ok: true, summary: 'Filled ' + r.applied.join(', ') + ' on the [Contribute](#contribute) form — reference name `' + r.refName + '`' + (missing.length ? '. Still needed: ' + missing.join(', ') : '. All required fields are filled'), navigated: true };
    },
    check_contribution: function () {
      var C = window.BatteryLakeContribute;
      if (!C) return { ok: false, summary: 'The Contribute page is not available' };
      gotoPage('contribute');
      C.init();
      var sm = C.check();
      C.focusStep(3);
      var lines = sm.items.map(function (i) { return (i.state === 'ok' ? '✓ ' : i.state === 'warn' ? '! ' : '○ ') + i.label + ' — ' + i.text; });
      return { ok: true, summary: 'Readiness **' + sm.ok + ' / ' + sm.total + '** for `' + sm.refName + '`' + (sm.uploads ? ' · ' + sm.uploads + ' file(s) uploaded' : '') + (sm.precheck ? ' · quick check ' + sm.precheck.overall.toFixed(2) : '') + '\n' + lines.join('\n'), navigated: true };
    },
    open_contribution_upload: function () {
      var C = window.BatteryLakeContribute;
      if (!C) return { ok: false, summary: 'The Contribute page is not available' };
      gotoPage('contribute');
      C.init();
      var sm = C.summary();
      C.focusStep(2);
      if (!sm.packageable) return { ok: false, summary: 'Complete the reference name in step 1 first (institution, year, chemistry, form, rates, temperature); uploads are stored under that name', navigated: true };
      return { ok: true, summary: 'Upload step opened for `' + sm.refName + '` — drop the raw files or a folder into the box (I cannot pick files from your disk for you)' + (sm.uploadEnabled === false ? '. Direct upload is not enabled on this site yet: paste a download link instead' : ''), navigated: true };
    },
    download_contribution_package: function () {
      var C = window.BatteryLakeContribute;
      if (!C) return { ok: false, summary: 'The Contribute page is not available' };
      gotoPage('contribute');
      C.init();
      var sm = C.summary();
      if (!sm.packageable) return { ok: false, summary: 'Complete the reference name first: institution, year, chemistry, form factor, charge/discharge rate and temperature (use the form or tell me the details)', navigated: true };
      C.focusStep(3);
      var ok = C.downloadPackage();
      return { ok: !!ok, summary: ok ? 'Downloading `' + sm.refName + '_submission.zip` (metadata.json, protocol.md, README, checklist' + (sm.precheck ? ', quality precheck' : '') + ')' : 'Package download failed', navigated: true };
    },
    submit_contribution: async function () {
      var C = window.BatteryLakeContribute;
      if (!C) return { ok: false, summary: 'The Contribute page is not available' };
      gotoPage('contribute');
      C.init();
      C.focusStep(3);
      var res = await C.submit();
      if (!res.ok) return { ok: false, summary: 'Cannot submit yet: ' + (res.reason || 'incomplete'), navigated: true };
      var sm = C.summary();
      var missing = sm.items.filter(function (i) { return i.state !== 'ok'; }).map(function (i) { return i.label; });
      return { ok: true, summary: (res.stored ? 'Submitted `' + res.refName + '` — metadata, notes and the file list are stored with your uploads. ' : 'Summary prepared for `' + res.refName + '` (direct upload not enabled, so the files must be linked). ') + '[Open the prefilled GitHub issue](' + res.issueUrl + ') to notify the team' + (missing.length ? '. Still missing: ' + missing.join(', ') : ''), navigated: true };
    },
    set_theme: function (args) {
      var theme = /dark|night|深|夜/i.test(String(args.theme || '')) ? 'dark' : 'light';
      call('setTheme', theme);
      return { ok: true, summary: 'Switched to the ' + theme + ' theme' };
    }
  };

  /* ── executor ────────────────────────────────────────────────────── */
  async function execute(actions) {
    var results = [];
    var list = Array.isArray(actions) ? actions.slice(0, 6) : [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i] || {};
      var tool = String(a.tool || a.name || a.action || '').trim();
      var args = (a.args && typeof a.args === 'object') ? a.args
        : (a.arguments && typeof a.arguments === 'object') ? a.arguments
        : (a.params && typeof a.params === 'object') ? a.params
        : (a.input && typeof a.input === 'object') ? a.input : null;
      if (!args) {
        // The model sometimes puts the arguments next to "tool" instead of under "args".
        args = {};
        Object.keys(a).forEach(function (k) { if (['tool', 'name', 'action', 'args', 'arguments', 'params', 'input'].indexOf(k) < 0) args[k] = a[k]; });
      }
      if (!IMPL[tool]) { results.push({ tool: tool, args: args, ok: false, summary: 'Unknown action "' + tool + '"' }); continue; }
      try {
        var r = await IMPL[tool](args);
        results.push(Object.assign({ tool: tool, args: args }, r));
      } catch (err) {
        results.push({ tool: tool, args: args, ok: false, summary: (err && err.message) || 'failed' });
      }
    }
    return results;
  }

  /* ── planner prompt material ─────────────────────────────────────── */
  function toolSpec() {
    return TOOLS.map(function (t) {
      var args = Object.keys(t.args).map(function (k) { return k + ': ' + t.args[k]; }).join('; ');
      return '- ' + t.name + (args ? ' {' + args + '}' : ' {}') + ' — ' + t.description;
    }).join('\n');
  }
  function catalogSummary() {
    return catalog().map(function (d) {
      return d.id + ' | ' + d.name + ' | ' + (d.chemistry || '-') + ' | ' + (d.form || '-') + ' | ' + (d.category || '-') + ' | ' + (d.status || '-');
    }).join('\n');
  }
  function plannerPrompt(question) {
    return [
      'You are the BatteryLake Agent: you operate the BatteryLake website for the user by returning a plan of tool calls.',
      'Available tools:',
      toolSpec(),
      '',
      'Catalog: ' + catalog().length + ' datasets (id | name | chemistry | form | category | status):',
      catalogSummary(),
      '',
      'Respond with ONLY a JSON object, no markdown fences, of the form',
      '{"actions":[{"tool":"<tool name>","args":{...}}],"reply":"<one or two sentences>"}',
      'Rules: use only the tools and argument values listed; use catalog ids for datasets; chain several actions when the request needs it (at most 5).',
      'If the request is a question rather than an action, return an empty actions list and answer briefly in reply using the catalog above.',
      'If the request is ambiguous, return an empty actions list and ask one clarifying question in reply.',
      'For prefill_contribution pass only the fields the user actually stated; never invent a name, DOI, license, link or number.',
      'Write reply in the same language as the user (' + (isZh(question) ? 'Chinese' : 'English') + '), plain text, describing what you are doing.'
    ].join('\n');
  }
  function parsePlan(text) {
    if (!text) return null;
    var s = String(text).replace(/```json|```/gi, '').trim();
    var start = s.indexOf('{'), end = s.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      var obj = JSON.parse(s.slice(start, end + 1));
      if (!obj || typeof obj !== 'object') return null;
      return { actions: Array.isArray(obj.actions) ? obj.actions : [], reply: typeof obj.reply === 'string' ? obj.reply : '' };
    } catch (_) { return null; }
  }

  /* Pull contribution fields out of free text ("24 NMC 21700 cells from NTU, 2025, 1C/1C at 25C"). */
  function extractContribution(text) {
    var t = String(text || '');
    var q = t.toLowerCase();
    var out = {};
    var m;
    if ((m = q.match(/(\d{1,4})\s*(?:cells?|电芯|颗|节)/))) out.cells = m[1];
    if ((m = q.match(/\b(20\d{2})\b/))) out.year = m[1];
    if ((m = q.match(/\b(nmc811|nmc|lfp|nca|lco|lmo|lto)\b/))) out.chemistry = m[1].toUpperCase();
    else if (/磷酸铁锂/.test(q)) out.chemistry = 'LFP'; else if (/三元/.test(q)) out.chemistry = 'NMC';
    if ((m = q.match(/\b(18650|21700)\b/))) out.form = m[1];
    else if (/pouch|软包/.test(q)) out.form = 'Pouch'; else if (/prismatic|方形/.test(q)) out.form = 'Prismatic'; else if (/cylindrical|圆柱/.test(q)) out.form = 'Cyl';
    if ((m = q.match(/(\d+(?:\.\d+)?)\s*ah\b/))) out.capacity_ah = m[1];
    if ((m = q.match(/(\d+(?:\.\d+)?)\s*c\s*\/\s*(\d+(?:\.\d+)?)\s*c\b/))) { out.charge_c = m[1] + 'C'; out.discharge_c = m[2] + 'C'; }
    else if ((m = q.match(/(\d+(?:\.\d+)?)\s*c\s*(?:charge|charging|充电?)[^\d]{0,12}(\d+(?:\.\d+)?)\s*c\s*(?:discharge|discharging|放电?)/))) { out.charge_c = m[1] + 'C'; out.discharge_c = m[2] + 'C'; }
    else {
      var ch = q.match(/(\d+(?:\.\d+)?)\s*c\s*(?:charge|charging|充)/), dc = q.match(/(\d+(?:\.\d+)?)\s*c\s*(?:discharge|discharging|放)/);
      if (ch) out.charge_c = ch[1] + 'C';
      if (dc) out.discharge_c = dc[1] + 'C';
      if (!ch && !dc && (m = q.match(/(\d+(?:\.\d+)?)\s*c\b/))) { out.charge_c = m[1] + 'C'; out.discharge_c = m[1] + 'C'; }
    }
    if (/multi[- ]?rate|multiple rates|多倍率|多种倍率/.test(q)) { out.charge_c = out.charge_c || 'Multi'; out.discharge_c = 'Multi'; }
    if ((m = q.match(/(?:at|@|在)\s*(-?\d{1,2})\s*(?:°\s*c|c|度|℃)\b/)) || (m = q.match(/(-?\d{1,2})\s*(?:°\s*c|℃|度)/))) out.temperature = m[1];
    if ((m = t.match(/\bfrom\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,3})/))) out.institution = m[1].replace(/\s+/g, '_');
    else if ((m = t.match(/(?:来自|由)\s*([\u4e00-\u9fff]{2,12}?)(?:大学|实验室|的|，|,|。)/))) out.institution = m[1];
    else if ((m = t.match(/(?:来自|由)\s*([A-Za-z][A-Za-z0-9&.\- ]{1,30}?)\s*(?:大学|实验室|的|，|,|。|\n|$)/))) out.institution = m[1].trim().replace(/\s+/g, '_');
    if ((m = t.match(/https?:\/\/\S+/))) out.data_url = m[0];
    if ((m = t.match(/\b(10\.\d{4,}\/\S+)/))) out.doi = 'https://doi.org/' + m[1];
    if ((m = t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/))) out.contact = m[0];
    if ((m = t.match(/\b(CC[ -]BY(?:[ -]NC)?(?:[ -]SA)?(?: 4\.0)?|CC0|MIT)\b/i))) out.license = m[1].toUpperCase().replace(/-/g, ' ').replace(/^CC BY( NC| SA)?$/, 'CC BY$1 4.0').replace('CC0', 'CC0 1.0');
    if ((m = t.match(/(?:called|named|titled|名为|叫)\s*[“"']?([^”"'\n,，]{3,60})[”"']?/i))) out.name = m[1].trim();
    return out;
  }

  /* ── rule-based fallback planner (works without any model) ───────── */
  function planLocally(command) {
    var q = String(command || '').toLowerCase().replace(/[？！，。、；：]/g, function (c) { return ({ '？': '?', '！': '!', '，': ',', '。': '.', '、': ',', '；': ';', '：': ':' })[c] || c; }).trim();
    var zh = isZh(command);
    var kb = KB();
    var found = kb ? kb.find(command) : null;
    var filt = kb ? kb.filter(command) : null;
    var d = found && found.items && found.items.length ? found.items[0] : null;
    var wants = {
      open: /\b(open|show|go to|goto|navigate|take me|view)\b|打开|跳转|带我|前往|进入|查看|看看/.test(q),
      download: /\b(download|export|save)\b|下载|导出/.test(q),
      filter: /\b(filter|only|list|find|which|search|all the)\b|筛选|列出|找出|找到|有哪些|哪些|所有|搜索|搜/.test(q),
      quality: /\b(quality|report|assess|assessment|score)\b|质量|报告|评估|评分/.test(q),
      skill: /\bskill\b|技能/.test(q),
      preprocess: /\b(preprocess|preprocessing|process|convert|prompt)\b|预处理|处理|转换|提示词/.test(q),
      sample: /\b(sample|excerpt|example|try)\b|样例|示例|试/.test(q),
      dark: /\b(dark|night)\b|深色|夜间|暗色/.test(q),
      light: /\b(light|bright|day)\b|浅色|亮色|白天/.test(q),
      theme: /\b(theme|mode)\b|主题|模式/.test(q),
      clear: /\b(clear|reset|remove)\b|清除|清空|重置|取消/.test(q),
      model: /\b(model|models)\b|模型/.test(q)
    };
    var actions = [];
    // Plain questions ("how many datasets are there?") are answered, not turned into navigation.
    var isQuestion = /^(how|what|which|why|when|who|where|is|are|does|do|can|could|should)\b|\?$|多少|什么|是什么|是否|吗$|怎么|如何/.test(q);
    var page = null;
    Object.keys(PAGES).forEach(function (p) { if (new RegExp('\\b' + p + '\\b').test(q)) page = page || p; });
    var zhPages = { '首页': 'home', '数据集': 'datasets', '基准': 'benchmarks', '模型': 'models', '质量': 'quality', '预处理': 'preprocessing', '接口': 'apis', '贡献': 'contribute', '命名': 'naming', '文档': 'docs', '关于': 'about', '引用': 'terms', '任务': 'tasks' };
    if (!page) Object.keys(zhPages).forEach(function (k) { if (q.indexOf(k) >= 0 && (wants.open || /页/.test(q))) page = page || zhPages[k]; });
    if (/model library|模型库/.test(q)) page = 'models';

    var wantsContribute = /\b(contribut\w*|submit(?:ting)?\s+(?:a |my |our )?(?:new )?dataset|share (?:my|our) (?:data|dataset)|upload (?:my|our) dataset|donate)\b|贡献|提交(?:我的|我们的|一个|新)?数据集|分享(?:我的|我们的)?数据|上传(?:我的|我们的)?数据集/.test(q);
    var wantsPackage = /\b(package|zip|bundle)\b|打包|压缩包/.test(q);
    var wantsSubmit = /\b(submit|send|issue)\b|提交|发送/.test(q);
    var wantsCheck = /\b(check|readiness|ready|missing|status)\b|检查|还差|缺什么|准备好/.test(q);
    var extracted = extractContribution(command);

    if (wants.dark || wants.light) actions.push({ tool: 'set_theme', args: { theme: wants.dark ? 'dark' : 'light' } });
    else if (wantsContribute || (Object.keys(extracted).length >= 3 && /dataset|数据集|cells|电芯/.test(q))) {
      if (Object.keys(extracted).length) actions.push({ tool: 'prefill_contribution', args: extracted });
      if (/\b(upload|files?|folder)\b|上传|文件/.test(q) && !Object.keys(extracted).length && !wantsCheck) actions.push({ tool: 'open_contribution_upload', args: {} });
      else if (wantsPackage) actions.push({ tool: 'download_contribution_package', args: {} });
      else if (wantsSubmit && !Object.keys(extracted).length) actions.push({ tool: 'submit_contribution', args: {} });
      else if (wantsCheck) actions.push({ tool: 'check_contribution', args: {} });
      else if (!Object.keys(extracted).length) actions.push({ tool: 'start_contribution', args: {} });
    }
    else if (wantsPackage && /contribution|submission|贡献|提交/.test(q)) actions.push({ tool: 'download_contribution_package', args: {} });
    else if (wants.clear && (wants.filter || /filter|筛选|搜索/.test(q))) actions.push({ tool: 'clear_filters', args: {} });
    else if (wants.skill && wants.download) actions.push({ tool: 'download_skill', args: {} });
    else if (wants.skill) actions.push({ tool: 'open_page', args: { page: 'preprocessing' } });
    else if (wants.quality && wants.sample && d) actions.push({ tool: 'assess_quality_sample', args: { dataset_id: d.id } });
    else if (wants.quality && d) actions.push({ tool: wants.download ? 'download_quality_report' : 'open_quality_report', args: { dataset_id: d.id } });
    else if (wants.quality && wants.download) actions.push({ tool: 'download_quality_report', args: {} });
    else if (wants.quality && !filt) actions.push({ tool: 'open_page', args: { page: 'quality' } });
    else if (wants.preprocess && d) actions.push({ tool: 'select_preprocessing_dataset', args: { dataset_id: d.id } });
    else if (filt && (filt.chem || filt.form || filt.cat)) {
      var args = {};
      if (filt.chem) args.chemistry = [filt.chem];
      if (filt.form) args.form = [filt.form];
      if (filt.cat) { if (filt.cat === 'ev') args.domain = ['ev']; else args.category = [filt.cat]; }
      actions.push({ tool: 'filter_datasets', args: args });
    }
    else if (d && !isQuestion && (wants.open || wants.download || found.mode === 'card' || found.score >= 3)) actions.push({ tool: 'open_dataset', args: { dataset_id: d.id } });
    else if (page && !(isQuestion && !wants.open)) actions.push({ tool: 'open_page', args: { page: page } });
    else if (wants.model && wants.open) {
      var mq = q.replace(/\b(open|show|the|model|models)\b|打开|模型|查看/g, ' ').trim();
      actions.push(mq ? { tool: 'open_model', args: { model: mq } } : { tool: 'open_page', args: { page: 'models' } });
    }
    else if (wants.filter && kb) {
      var query = String(command).replace(/\b(filter|only|list|find|which|search|show|me|datasets?|the|all)\b/gi, ' ').replace(/筛选|列出|找出|找到|有哪些|哪些|所有|搜索|数据集/g, ' ').trim();
      if (query) actions.push({ tool: 'filter_datasets', args: { query: query } });
    }

    var reply;
    if (actions.length) reply = zh ? '好的，正在执行：' : 'On it:';
    if (actions.some(function (a) { return a.tool === 'prefill_contribution'; }) && !zh) reply = 'Starting a contribution with what you told me:';
    if (actions.some(function (a) { return a.tool === 'prefill_contribution'; }) && zh) reply = '按你提供的信息开始填写贡献表单：';
    else if (kb) reply = kb.answer(command).text + '\n\n' + (zh ? '（Agent 模式可以执行页面操作，例如：“打开 dataset_21 的质量报告”、“筛选 LFP 软包数据集”、“下载处理 skill”。）' : '(Agent mode can also act on the page, e.g. "open dataset_21 quality report", "filter LFP pouch datasets", "download the processing skill".)');
    else reply = zh ? '我没有理解这个指令。' : 'I could not understand that request.';
    return { actions: actions, reply: reply };
  }

  window.BatteryLakeActions = {
    TOOLS: TOOLS,
    PAGES: PAGES,
    execute: execute,
    plannerPrompt: plannerPrompt,
    parsePlan: parsePlan,
    planLocally: planLocally,
    resolveDataset: resolveDataset
  };
})();
