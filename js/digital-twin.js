/* Illustrative local Studio workflow; no model training or API request is performed. */
(function () {
  'use strict';
  const root = document.getElementById('page-studio');
  if (!root) return;
  const el = id => document.getElementById('studio-' + id);
  const state = { selected: null, confirmed: null, initialized: false, estimated: false, validated: false, page: 1, query: '', charge: 1, discharge: 1, temperature: 25, initialSoc: 90, cycles: 500, scenario: 'constant', generatedData: null };
  const datasetPageSize = 6;
  const emptyFilters = () => ({ all: false, chem: new Set(), form: new Set(), cat: new Set(), domain: new Set(), duty: new Set() });
  let filters = emptyFilters();
  let pendingFilters = emptyFilters();
  let calibrationFrame = 0;
  let revealObserver = null;
  const filterTypes = { chem: 'chemistry', form: 'form', cat: 'category', domain: 'domain', duty: 'profile' };
  // Reuse Benchmark's filter markup and tokens, with independent Studio state.
  const filterTemplate = document.getElementById('bwr-dataset-filter-popover').cloneNode(true);
  filterTemplate.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  filterTemplate.querySelectorAll('[onclick]').forEach(node => node.removeAttribute('onclick'));
  filterTemplate.querySelectorAll('.filter-token').forEach(token => {
    const entry = Object.entries(token.dataset).find(([key]) => key.startsWith('bwr'));
    const type = entry[0].slice(3).toLowerCase();
    const button = document.createElement('button');
    button.type = 'button'; button.className = token.className; button.textContent = token.textContent;
    button.dataset.filterType = type; button.dataset.filterValue = entry[1];
    button.addEventListener('click', () => {
      if (type === 'all') {
        const all = !pendingFilters.all; pendingFilters = emptyFilters(); pendingFilters.all = all;
      } else {
        pendingFilters.all = false;
        const set = pendingFilters[type];
        if (set.has(entry[1])) set.delete(entry[1]); else set.add(entry[1]);
      }
      syncFilters();
    });
    token.replaceWith(button);
  });
  el('filters').replaceChildren(...filterTemplate.childNodes);
  function syncFilters() {
    el('filters').querySelectorAll('.filter-token').forEach(button => {
      const { filterType: type, filterValue: value } = button.dataset;
      const active = type === 'all' ? pendingFilters.all : pendingFilters[type].has(value);
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
  }
  function renderFilterChips() {
    const box = el('applied-filter-chips'); box.replaceChildren();
    const chips = filters.all ? [{ type: 'all', value: 'all', label: 'All datasets' }] : [];
    Object.keys(filterTypes).forEach(type => filters[type].forEach(value => chips.push({ type, value, label: bwFilterLabel(type, value) })));
    chips.forEach(({ type, value, label }) => {
      const chip = document.createElement('span'); chip.className = 'applied-chip ' + filterTypeClass(filterTypes[type] || 'all');
      chip.append(document.createTextNode(label));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove ' + label + ' filter');
      remove.addEventListener('click', () => {
        if (type === 'all') filters.all = false; else filters[type].delete(value);
        pendingFilters = bwCloneFilterState(filters); state.page = 1; syncFilters(); renderDatasets();
      });
      chip.append(remove); box.append(chip);
    });
    box.classList.toggle('has-chips', chips.length > 0);
  }
  const controls = [
    { label: 'Charge Rate (C)', keys: ['charge'], min: 0.1, max: 5, step: 0.1, unit: 'C' },
    { label: 'Discharge Rate (C)', keys: ['discharge'], min: 0.1, max: 5, step: 0.1, unit: 'C' },
    { label: 'Temperature (°C)', keys: ['temperature'], min: -20, max: 60, step: 1, unit: '°C' },
    { label: 'Initial SOC (%)', keys: ['initialSoc'], min: 10, max: 100, step: 1, unit: '%' },
    { label: 'Number of Cycles', keys: ['cycles'], min: 1, max: 1000, step: 1, unit: '' }
  ];
  // Use the same cycle-aging catalog and ordering as Benchmark's data selection.
  const catalog = () => bwFlowSortedDatasets(getCatalogDatasets().filter(bwIsCycleAgingDataset));
  const format = (key, value) => ['charge', 'discharge'].includes(key) ? value.toFixed(1) : String(value);
  const twinAssets = {
    '18650': 'assets/images/studio-batteries/18650.png?v=2',
    '21700': 'assets/images/studio-batteries/21700.png?v=2',
    pouch: 'assets/images/studio-batteries/pouch.png?v=2',
    prismatic: 'assets/images/studio-batteries/prismatic.png?v=2',
    cyl: 'assets/images/studio-batteries/cyl.png?v=2'
  };
  function twinAssetFor(form) {
    const value = String(form || '').trim().toLowerCase();
    if (twinAssets[value]) return twinAssets[value];
    if (value.includes('pouch')) return twinAssets.pouch;
    if (value.includes('prismatic')) return twinAssets.prismatic;
    if (value.includes('21700')) return twinAssets['21700'];
    if (value.includes('18650')) return twinAssets['18650'];
    if (value.includes('cyl')) return twinAssets.cyl;
    if (value === 'multi') return twinAssets.prismatic;
    return null;
  }
  function twinFormKey(form) {
    const value = String(form || '').trim().toLowerCase();
    if (value.includes('21700')) return '21700';
    if (value.includes('18650')) return '18650';
    if (value.includes('pouch')) return 'pouch';
    if (value.includes('prismatic') || value === 'multi') return 'prismatic';
    if (value.includes('cyl')) return 'cyl';
    return value;
  }
  function clearResults(reset = false) {
    el('download').disabled = true;
    if (!reset && el('results').classList.contains('has-results')) {
      el('results').classList.add('is-stale');
      el('result-status').textContent = 'Setup changed · run simulation again to update';
      el('run').textContent = 'Run Simulation & Generate Data';
      return;
    }
    state.generatedData = null;
    el('results').classList.remove('has-results', 'is-stale');
    el('results').innerHTML = '<div class="studio-empty studio-results-empty"><div class="studio-empty-mark" aria-hidden="true"><span></span><span></span><span></span></div><span>Validate the digital twin, configure operating conditions, then run a simulation.</span></div>';
    el('run').textContent = 'Run Simulation & Generate Data';
  }
  function setCalibrationProgress(value) {
    const progress = Math.max(0, Math.min(100, Math.round(value)));
    el('calibration-ring').style.setProperty('--progress', progress);
    el('calibration-value').textContent = progress + '%';
  }
  function setFlowStage(stage) {
    const stages = ['data', 'model', 'estimation', 'validation', 'simulation'];
    const selectors = ['.studio-process-data', '.studio-process-model', '.studio-process-estimation', '.studio-process-validation', '.studio-process-simulation'];
    const current = stages.indexOf(stage);
    selectors.forEach((selector, index) => {
      const node = root.querySelector(selector);
      node.classList.toggle('is-complete', index < current);
      node.classList.toggle('is-current', index === current);
    });
    root.dataset.flowStage = stage;
  }
  function syncWorkflow() {
    const enabled = { data: true, model: !!state.confirmed, estimation: state.initialized, validation: state.estimated, simulation: state.validated };
    Object.entries(enabled).forEach(([step, active]) => {
      const article = root.querySelector(`[data-studio-step="${step}"]`);
      article.classList.toggle('is-locked', !active);
    });
    el('initialize').disabled = !state.confirmed || state.initialized;
    el('validate').disabled = !state.estimated;
    el('run').disabled = !state.validated;
    el('scenario').disabled = !state.validated;
    el('controls').querySelectorAll('input').forEach(input => { input.disabled = !state.validated; });
    if (!state.confirmed) setFlowStage('data');
    else if (!state.initialized) setFlowStage('model');
    else if (!state.estimated) setFlowStage('estimation');
    else if (!state.validated) setFlowStage('validation');
    else setFlowStage('simulation');
  }
  function restartSignalAnimation(selector, className) {
    const node = root.querySelector(selector);
    if (!node) return;
    node.classList.remove(className);
    requestAnimationFrame(() => node.classList.add(className));
  }
  function calibrateTwin() {
    cancelAnimationFrame(calibrationFrame);
    state.estimated = false;
    state.validated = false;
    clearResults(true);
    el('validation-results').innerHTML = '<div class="studio-empty studio-results-empty">Complete battery parameter estimation to validate measured and simulated responses.</div>';
    renderParameters();
    setCalibrationProgress(0);
    root.querySelector('.studio-live-loss').classList.remove('is-reset');
    root.classList.add('is-calibrating');
    syncWorkflow();
    restartSignalAnimation('.studio-live-loss', 'is-training');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    const duration = reduced ? 0 : 1300;
    const tick = now => {
      const ratio = duration ? Math.min(1, (now - started) / duration) : 1;
      const eased = 1 - Math.pow(1 - ratio, 3);
      setCalibrationProgress(eased * 100);
      if (ratio < 1) calibrationFrame = requestAnimationFrame(tick);
      else {
        root.classList.remove('is-calibrating');
        state.estimated = true;
        renderParameters();
        syncWorkflow();
      }
    };
    calibrationFrame = requestAnimationFrame(tick);
  }
  function selectedDataset() { return catalog().find(d => d.id === state.confirmed); }
  function demoCapacity(dataset) {
    const seed = Number(String(dataset?.id || '').match(/\d+/)?.[0] || 1);
    return 2.8 + seed % 5 * .08;
  }
  function renderParameters() {
    if (!state.estimated) { el('estimated-parameters').innerHTML = '<span class="studio-placeholder-copy">Estimated values appear after initialization.</span>'; return; }
    const dataset = selectedDataset();
    const seed = Number(String(dataset.id).match(/\d+/)?.[0] || 1);
    const values = [
      ['Capacity', demoCapacity(dataset).toFixed(2), 'Ah'],
      ['Internal Resistance', (34 + seed % 7 * 2.1).toFixed(1), 'mΩ'],
      ['Thermal parameter', (0.72 + seed % 4 * .03).toFixed(2), 'W/K'],
      ['Aging coefficient', (0.013 + seed % 5 * .001).toFixed(3), 'cycle⁻¹']
    ];
    el('estimated-parameters').innerHTML = values.map(([label, number, unit]) => `<div><span>${label}</span><strong>${number} <small>${unit}</small></strong></div>`).join('') + '<small class="studio-demo-note">Illustrative prototype estimates; no optimization is run.</small>';
  }
  function comparisonChart(title, measured, simulated, unit) {
    const min = Math.floor(Math.min(...measured, ...simulated) * 10) / 10 - .1;
    const max = Math.ceil(Math.max(...measured, ...simulated) * 10) / 10 + .1;
    const x = index => 40 + index / (measured.length - 1) * 240;
    const y = value => 150 - (value - min) / (max - min) * 120;
    const line = series => series.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
    const ticks = [min, (min + max) / 2, max];
    return `<svg class="studio-chart" viewBox="0 0 300 180" role="img" aria-label="${title}, measured and simulated response"><g class="studio-chart-grid">${ticks.map(tick => `<line x1="40" x2="280" y1="${y(tick)}" y2="${y(tick)}"/><text x="34" y="${y(tick) + 4}" text-anchor="end">${tick.toFixed(1)}${unit}</text>`).join('')}<text x="40" y="174">0</text><text x="280" y="174" text-anchor="end">Time</text></g><polyline class="studio-curve studio-measured-curve" points="${line(measured)}"/><polyline class="studio-curve studio-simulated-curve" points="${line(simulated)}"/></svg>`;
  }
  function enableDatasetReviewAction() {
    el('validation-results').querySelector('.studio-review-action')?.addEventListener('click', () => {
      el('reset').click();
      root.querySelector('[data-studio-step="data"]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function runValidation() {
    if (!state.estimated) return;
    const dataset = selectedDataset();
    // Prototype-only variation: catalog processing flags are not measured-response validation evidence.
    const seed = Array.from(String(dataset.id)).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 0);
    const reviewDemo = seed % 5 === 0;
    const measuredVoltage = Array.from({ length: 25 }, (_, i) => 4.15 - .91 * i / 24 - .11 * Math.pow(i / 24, 5));
    const simulatedVoltage = measuredVoltage.map((value, i) => value + (reviewDemo ? .09 : .012) * Math.sin(i * .8 + seed));
    const measuredTemp = Array.from({ length: 25 }, (_, i) => 25 + 5.8 * (1 - Math.exp(-i / 7)));
    const simulatedTemp = measuredTemp.map((value, i) => value + (reviewDemo ? .8 : .19) * Math.sin(i * .55 + seed));
    const rmse = (a, b) => Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) / a.length);
    const voltageRmse = rmse(measuredVoltage, simulatedVoltage);
    const tempRmse = rmse(measuredTemp, simulatedTemp);
    const capacityError = reviewDemo ? 2.4 : .8 + seed % 5 * .1;
    const residual = reviewDemo ? .06 : .011 + seed % 4 * .001;
    state.validated = voltageRmse < .05 && tempRmse < .5 && capacityError < 2 && residual < .05;
    const metric = (label, value) => `<div><span>${label}</span><strong>${value}</strong></div>`;
    el('validation-results').innerHTML = `<div class="studio-subsection-head"><span class="studio-status-pill ${state.validated ? 'is-ready' : 'is-review'}">${state.validated ? 'Validation Passed' : 'Needs Review'}</span></div>
      <div class="studio-validation-charts"><figure class="studio-prediction-block"><figcaption>Measured Voltage vs PIML Twin Voltage</figcaption>${comparisonChart('Voltage comparison', measuredVoltage, simulatedVoltage, ' V')}</figure><figure class="studio-prediction-block"><figcaption>Measured Temperature vs PIML Twin Temperature</figcaption>${comparisonChart('Temperature comparison', measuredTemp, simulatedTemp, ' °C')}</figure></div>
      <div class="studio-response-legend"><span><i></i>Measured Response</span><span><i></i>Simulated Response</span></div>
      <section class="studio-validation-metrics"><div class="studio-subsection-head"><h4>Validation Metrics</h4></div><div class="studio-parameter-grid">${metric('Voltage RMSE', voltageRmse.toFixed(3) + ' V')}${metric('Temperature RMSE', tempRmse.toFixed(2) + ' °C')}${metric('Capacity Error', capacityError.toFixed(1) + '%')}${metric('Physics Residual', residual.toFixed(3))}</div><small class="studio-demo-note">Illustrative only: both response traces and metrics are generated in the browser from the selected dataset ID. No measured files or real PIML validation are used.</small></section>${state.validated ? '' : '<div class="studio-validation-review"><div class="studio-review-guidance"><div><strong>Why this appears</strong><p>One or more demo metrics exceed the prototype limits. This does not evaluate the actual dataset or twin.</p></div><div><strong>What to do</strong><p>Try another dataset to explore a different result. Real validation would require measured responses and model recalibration.</p></div></div><button type="button" class="bw-pg studio-action studio-review-action">Choose Another Dataset</button></div>'}`;
    if (!state.validated) enableDatasetReviewAction();
    syncWorkflow();
  }
  function renderTwin() {
    const dataset = state.initialized ? selectedDataset() : null;
    el('twin').classList.toggle('is-confirmed', !!dataset);
    el('twin').replaceChildren();
    if (dataset) {
      const caption = document.createElement('div');
      caption.className = 'studio-twin-caption';
      const name = document.createElement('strong');
      name.textContent = dataset.name;
      const meta = document.createElement('span');
      meta.textContent = [dataset.chemistry, dataset.form].filter(Boolean).join(' · ');
      caption.append(name, meta);
      const asset = twinAssetFor(dataset.form);
      if (asset) {
        const visual = document.createElement('div');
        visual.className = `studio-twin-visual twin-form-${twinFormKey(dataset.form)}`;
        const image = document.createElement('img');
        image.className = 'studio-twin-image';
        image.src = asset;
        image.alt = `${dataset.form} battery illustration`;
        image.loading = 'eager';
        const effects = document.createElement('div');
        effects.className = 'studio-twin-effects';
        effects.setAttribute('aria-hidden', 'true');
        effects.innerHTML = '<span class="studio-twin-beam"></span><span class="studio-twin-platform"></span><span class="studio-twin-scan"></span><span class="studio-twin-particles"></span>';
        const tags = document.createElement('div');
        tags.className = 'studio-twin-tags';
        tags.setAttribute('aria-hidden', 'true');
        tags.innerHTML = '<span class="studio-twin-tag tag-soc"><i></i><b>SOC</b><em>82%</em></span><span class="studio-twin-tag tag-soh"><i></i><b>SOH</b><em>96%</em></span><span class="studio-twin-tag tag-voltage"><i></i><b>Voltage</b><em>3.68 V</em></span><span class="studio-twin-tag tag-temperature"><i></i><b>Temperature</b><em>28 °C</em></span>';
        visual.append(effects, image, tags);
        el('twin').append(caption, visual);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'studio-visual-placeholder';
        placeholder.textContent = 'Digital twin visualization';
        el('twin').append(caption, placeholder);
      }
    } else {
      el('twin').textContent = 'Initialize the PIML Battery Digital Twin to begin calibration.';
      setCalibrationProgress(0);
    }
  }
  function renderDatasets() {
    const list = catalog().filter(d => {
      if (state.query && ![d.name, d.ref_name, d.notes, d.chemistry, d.form].join(' ').toLowerCase().includes(state.query)) return false;
      if (filters.all) return true;
      return (!filters.chem.size || filters.chem.has(d.chemistry))
        && (!filters.form.size || filters.form.has(d.form))
        && (!filters.cat.size || filters.cat.has(d.category))
        && (!filters.domain.size || inferDatasetDomains(d).some(value => filters.domain.has(value)))
        && (!filters.duty.size || inferDatasetProfiles(d).some(value => filters.duty.has(value)));
    });
    renderFilterChips();
    const pages = Math.max(1, Math.ceil(list.length / datasetPageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * datasetPageSize;
    el('dataset-list').replaceChildren();
    list.slice(start, start + datasetPageSize).forEach(d => {
      // Keep the shared renderer's metadata and tags; replace only modal behavior.
      const template = document.createElement('template');
      template.innerHTML = datasetCardHTML(d).trim();
      const card = template.content.firstElementChild;
      card.removeAttribute('onclick');
      card.dataset.datasetId = d.id;
      card.classList.toggle('studio-selected', d.id === state.selected);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-pressed', String(d.id === state.selected));
      card.setAttribute('aria-label', d.name);
      card.querySelector('.dc-name').title = d.ref_name || d.name;
      const choose = () => {
        state.selected = d.id;
        renderDatasets();
        Array.from(el('dataset-list').children).find(c => c.dataset.datasetId === d.id)?.focus({ preventScroll: true });
      };
      card.addEventListener('click', choose);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
      });
      el('dataset-list').append(card);
    });
    if (!list.length) el('dataset-list').innerHTML = '<div class="studio-empty">No datasets match your search or filters</div>';
    el('pager-info').textContent = list.length ? `${start + 1}–${Math.min(start + datasetPageSize, list.length)} of ${list.length} datasets` : '0 datasets';
    el('pager').replaceChildren();
    const pageButton = (text, page, label, disabled) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'bw-pg'; button.textContent = text;
      button.setAttribute('aria-label', label); button.disabled = disabled;
      if (page === state.page && /^\d+$/.test(text)) { button.classList.add('active'); button.setAttribute('aria-current', 'page'); }
      button.addEventListener('click', () => {
        state.page = page; renderDatasets();
        el('pager').querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
      });
      el('pager').append(button);
    };
    pageButton('‹', state.page - 1, 'Previous dataset page', state.page === 1);
    bwDatasetPagerItems(state.page, pages).forEach(page => {
      if (page === 'dots') {
        const dots = document.createElement('span'); dots.textContent = '…'; el('pager').append(dots);
      } else pageButton(String(page), page, 'Dataset page ' + page, false);
    });
    pageButton('›', state.page + 1, 'Next dataset page', state.page === pages);
    el('confirm').disabled = !state.selected || state.selected === state.confirmed;
    el('confirm').textContent = state.selected && state.selected === state.confirmed ? 'Dataset in use' : 'Use Dataset';
  }
  function refresh() {
    const list = catalog();
    if (!list.some(d => d.id === state.selected)) state.selected = null;
    if (!list.some(d => d.id === state.confirmed)) { state.confirmed = null; state.initialized = false; state.estimated = false; state.validated = false; clearResults(true); }
    renderDatasets(); renderTwin(); syncWorkflow();
  }
  controls.forEach((control, index) => {
    const row = document.createElement('div');
    row.className = 'studio-control';
    row.innerHTML = `<span id="studio-label-${index}" class="studio-control-label">${control.label}</span><div class="studio-slider${control.keys.length > 1 ? ' studio-range' : ''}"><div class="studio-slider-track"></div></div><div class="studio-values"></div>`;
    control.keys.forEach((key, keyIndex) => {
      const name = control.label + (control.keys.length > 1 ? (keyIndex ? ' maximum' : ' minimum') : '');
      ['range', 'number'].forEach(type => {
        const input = document.createElement('input');
        input.type = type; input.min = control.min; input.max = control.max; input.step = control.step;
        input.value = format(key, state[key]); input.dataset.key = key; input.setAttribute('aria-label', name);
        if (type === 'number') input.className = 'studio-input';
        input.addEventListener('input', () => {
          if (!Number.isFinite(input.valueAsNumber)) return;
          let value = Math.round(input.valueAsNumber / control.step) * control.step;
          value = Math.max(control.min, Math.min(control.max, value));
          if (control.keys.length > 1) value = keyIndex ? Math.max(state[control.keys[0]] + control.step, value) : Math.min(state[control.keys[1]] - control.step, value);
          state[key] = value;
          syncControls(input); clearResults();
        });
        input.addEventListener('change', () => syncControls());
        row.querySelector(type === 'range' ? '.studio-slider' : '.studio-values').append(input);
      });
      if (keyIndex === 0 && control.keys.length > 1) row.querySelector('.studio-values').insertAdjacentHTML('beforeend', '<span aria-hidden="true">–</span>');
    });
    if (control.unit) {
      const unit = document.createElement('span'); unit.textContent = control.unit; row.querySelector('.studio-values').append(unit);
    }
    el('controls').append(row);
  });
  function syncControls(activeInput) {
    controls.forEach((control, index) => {
      const row = el('controls').children[index];
      row.querySelectorAll('input').forEach(input => {
        if (input !== activeInput || input.type === 'range') input.value = format(input.dataset.key, state[input.dataset.key]);
        input.setAttribute('aria-valuetext', format(input.dataset.key, state[input.dataset.key]) + (control.unit ? ' ' + control.unit : ''));
      });
      const percent = key => (state[key] - control.min) / (control.max - control.min) * 100;
      row.style.setProperty('--range-start', (control.keys.length > 1 ? percent(control.keys[0]) : 0) + '%');
      row.style.setProperty('--range-end', percent(control.keys[control.keys.length - 1]) + '%');
    });
  }
  function runGeneration(event) {
    event.preventDefault(); syncControls();
    if (!state.validated) return;
    const firstRun = !el('results').classList.contains('has-results');
    const params = { ...state };
    // Deterministic prototype response, sensitive to setup controls; no backend request.
    const stress = Math.pow((params.charge + params.discharge) / 2, 0.35) * (1 + Math.abs(params.temperature - 25) * 0.012) * (params.initialSoc / 90) * ({ constant: 1, fast: 1.2, dynamic: 1.1 }[params.scenario]);
    const soh = cycle => Math.max(40, 100 - 16.8 * Math.pow(cycle / 500, 0.72) * stress);
    const current = soh(0);
    const peak = params.temperature + 4.4 * Math.pow(params.charge, 1.2);
    const duration = Math.round(130 / params.charge);
    const cycleCount = params.cycles;
    const consistency = Math.max(94, 99.4 - Math.abs(params.temperature - 25) * .025 - Math.max(0, params.charge - 1) * .3);
    const temperatureValid = peak >= 0 && peak <= 60;
    const dataset = catalog().find(d => d.id === params.confirmed);
    const baselineCapacity = demoCapacity(dataset);
    const finalCapacity = baselineCapacity * soh(params.cycles) / 100;
    state.generatedData = {
      dataset,
      params,
      rows: Array.from({ length: cycleCount }, (_, index) => {
        const cycle = index + 1;
        return { cycle, soh: soh(cycle), capacity: baselineCapacity * soh(cycle) / 100 };
      })
    };
    el('download').disabled = false;
    const metric = (label, value, unit, change = '', note = '') => `<div class="studio-metric"${note ? ` title="${note}"` : ''}><span>${label}</span><div><strong>${value}</strong><small>${unit}</small>${change ? `<span class="studio-metric-delta">${change}</span>` : ''}</div></div>`;
    const info = text => `<span class="studio-info" tabindex="0" role="note" aria-label="${text}">i<span class="studio-info-tip">${text}</span></span>`;
    el('results').classList.add('has-results');
    el('results').classList.remove('is-stale');
    el('run').textContent = 'Run Simulation & Generate Data';
    const datasetName = dataset?.name || '';
    el('results').innerHTML = `<div class="studio-report-head"><div><strong>${esc(datasetName)} · Synthetic dataset</strong></div><span id="studio-result-status" role="status">Illustrative output · prototype simulation</span></div>
      <section class="studio-prediction-block" aria-labelledby="studio-performance-title">
        <div class="studio-chart-heading"><h3 id="studio-performance-title">Synthetic Signal Profile ${info('Illustrative signals generated from the selected operating envelope. No backend parameter optimization or simulation API request is performed.')}</h3>
          <select class="studio-input" id="studio-performance-view" aria-label="Synthetic signal chart metric"><option value="temperature">Temperature (°C)</option><option value="voltage">Voltage (V)</option><option value="current">Current (A)</option></select></div>
        <div class="studio-output-grid"><div class="studio-metrics">
          ${metric('Simulated Cycles', cycleCount.toLocaleString(), '')}
          ${metric('Generated Samples', cycleCount.toLocaleString(), 'cycle records')}
          ${metric('Conditions Covered', '1', 'scenario')}
        </div><div id="studio-performance-chart"></div></div>
      </section>
      <section class="studio-prediction-block" aria-labelledby="studio-soh-title">
        <div class="studio-chart-heading"><h3 id="studio-soh-title">Synthetic Capacity Trajectory ${info('Illustrative capacity retention derived from the selected operating conditions; no calibrated backend twin is run.')}</h3></div>
        <div class="studio-output-grid"><div class="studio-metrics">
          ${metric('Initial Capacity', (baselineCapacity * current / 100).toFixed(2), 'Ah')}
          ${metric('Final Capacity', finalCapacity.toFixed(2), 'Ah')}
          ${metric('Capacity Retention', soh(params.cycles).toFixed(1), '%')}
        </div><div id="studio-soh-chart"></div></div>
      </section>
      <section class="studio-physics-checks"><div class="studio-subsection-head"><h4>Physics Checks</h4><span class="studio-status-pill ${temperatureValid ? 'is-ready' : 'is-review'}">${temperatureValid ? consistency.toFixed(1) + '% consistent' : 'Needs Review'}</span></div><div class="studio-check-grid"><span class="${temperatureValid ? 'is-pass' : 'is-review'}">${temperatureValid ? '✓' : '!'} Temperature range valid</span><span class="is-pass">✓ Voltage range valid</span><span class="is-pass">✓ Energy consistency</span><span class="is-pass">✓ Physics constraints satisfied</span></div><small class="studio-demo-note">Illustrative prototype checks; they do not certify a physical dataset.</small></section>`;
    // Both figures share scales, typography, grid, area fill, markers and line treatments.
    function chart({ title, values, min, max, ticks, labels, unit, split, limit, endpoint }) {
      const x = i => 42 + i / (values.length - 1) * 228;
      const y = v => 164 - (v - min) / (max - min) * 132;
      const points = (start, end) => values.slice(start, end).map((v, j) => `${x(start + j).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
      const all = points(0, values.length);
      return `<svg class="studio-chart" viewBox="0 0 288 199" role="img" aria-label="${title}">
        <g class="studio-chart-grid">${ticks.map(v => `<line x1="42" x2="270" y1="${y(v)}" y2="${y(v)}"/><text x="34" y="${y(v) + 4}" text-anchor="end">${v}${unit}</text>`).join('')}
        ${labels.map(({ index, label }) => `<text x="${x(index)}" y="186" text-anchor="${index === 0 ? 'start' : index === values.length - 1 ? 'end' : 'middle'}">${label}</text>`).join('')}</g>
        <polygon class="studio-chart-area" points="42,164 ${all} 270,164"/>
        ${limit === undefined ? '' : `<line class="studio-chart-limit" x1="42" x2="270" y1="${y(limit)}" y2="${y(limit)}"/><text class="studio-limit-label" x="48" y="${y(limit) - 8}">${limit} °C limit</text>`}
        ${split === undefined ? `<polyline class="studio-curve" points="${all}"/>` : `<line class="studio-now-line" x1="${x(split)}" x2="${x(split)}" y1="32" y2="164"/><polyline class="studio-curve" points="${points(0, split + 1)}"/><polyline class="studio-curve studio-forecast" points="${points(split, values.length)}"/>`}
        <circle class="studio-chart-point" cx="270" cy="${y(values[values.length - 1])}" r="4"/>
        <text class="studio-endpoint" x="268" y="${Math.max(16, y(values[values.length - 1]) - 10)}" text-anchor="end">${endpoint}</text></svg>`;
    }
    function renderPerformance() {
      const mode = el('performance-view').value;
      const config = mode === 'temperature'
        ? { total: peak, min: Math.floor(Math.min(params.temperature, 25) / 5) * 5, max: Math.ceil(Math.max(45, peak + 5) / 5) * 5, unit: '°', limit: 40, title: 'Synthetic temperature (°C)' }
        : mode === 'voltage'
          ? { total: 3.2, min: 2.8, max: 4.3, unit: '', title: 'Synthetic voltage (V)' }
          : { total: params.charge * 3, min: 0, max: Math.max(4, params.charge * 3.5), unit: '', title: 'Synthetic current (A)' };
      const values = Array.from({ length: 41 }, (_, i) => {
        if (mode === 'temperature') return params.temperature + (peak - params.temperature) * (1 - Math.exp(-i / 9)) / (1 - Math.exp(-40 / 9));
        if (mode === 'voltage') return 4.2 - .82 * (i / 40) - .18 * Math.pow(i / 40, 5);
        return config.total * (.76 + .18 * Math.sin(i / 3.2) + .06 * Math.sin(i / 1.3));
      });
      const lastValue = values[values.length - 1];
      const endpoint = mode === 'temperature' ? `${peak.toFixed(1)} °C` : mode === 'voltage' ? `${lastValue.toFixed(2)} V` : `${lastValue.toFixed(2)} A`;
      el('performance-chart').innerHTML = chart({ ...config, values, ticks: Array.from({ length: 4 }, (_, i) => +(config.min + (config.max - config.min) * i / 3).toFixed(1)), labels: [{ index: 0, label: '0' }, { index: 20, label: Math.round(duration / 2) }, { index: 40, label: `${duration} min` }], endpoint });
    }
    const values = Array.from({ length: 51 }, (_, i) => baselineCapacity * soh(1 + (params.cycles - 1) * i / 50) / 100);
    const lower = Math.max(0, Math.floor((Math.min(...values) - .1) * 10) / 10);
    const upper = Math.ceil((Math.max(...values) + .05) * 10) / 10;
    el('soh-chart').innerHTML = chart({ title: 'Synthetic capacity trajectory over requested cycles', values, min: lower, max: upper, ticks: [lower, +((lower + upper) / 2).toFixed(2), upper], unit: '', labels: [{ index: 0, label: 'Cycle 1' }, { index: 25, label: Math.round(params.cycles / 2) }, { index: 50, label: `Cycle ${params.cycles}` }], endpoint: `${finalCapacity.toFixed(2)} Ah` });
    el('performance-view').addEventListener('change', renderPerformance);
    renderPerformance();
    if (firstRun && el('results-title').getBoundingClientRect().top > window.innerHeight * 0.5) {
      el('results-title').focus({ preventScroll: true });
      el('results-title').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  }
  function downloadGeneratedData() {
    const generated = state.generatedData;
    if (!generated) return;
    const csvEscape = value => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const { dataset, params, rows } = generated;
    const header = ['dataset_id', 'dataset_name', 'scenario', 'cycle', 'charge_rate_c', 'discharge_rate_c', 'temperature_c', 'initial_soc_pct', 'soh_pct', 'capacity_ah'];
    const csv = [header, ...rows.map(row => [dataset?.id || '', dataset?.name || '', params.scenario, row.cycle, params.charge.toFixed(1), params.discharge.toFixed(1), params.temperature, params.initialSoc, row.soh.toFixed(3), row.capacity.toFixed(4)])]
      .map(row => row.map(csvEscape).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batterylake-synthetic-${dataset?.id || 'dataset'}-${params.cycles}-cycles.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  el('search').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); state.page = 1; renderDatasets(); });
  function closeFilters() { el('filters').classList.remove('open'); el('filter-toggle').setAttribute('aria-expanded', 'false'); }
  el('filter-toggle').addEventListener('click', () => {
    if (el('filters').classList.contains('open')) return;
    pendingFilters = bwCloneFilterState(filters); syncFilters();
    el('filters').classList.add('open'); el('filter-toggle').setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', event => { if (!root.querySelector('.studio-search-tools').contains(event.target)) closeFilters(); });
  el('filters').addEventListener('keydown', event => { if (event.key === 'Escape') { closeFilters(); el('filter-toggle').focus(); } });
  el('filters').querySelector('.dataset-filter-action:not(.apply)').addEventListener('click', () => {
    pendingFilters = emptyFilters(); syncFilters();
  });
  el('filters').querySelector('.dataset-filter-action.apply').addEventListener('click', () => {
    filters = bwCloneFilterState(pendingFilters); state.page = 1; closeFilters(); renderDatasets(); el('filter-toggle').focus();
  });
  el('reset').addEventListener('click', () => {
    cancelAnimationFrame(calibrationFrame);
    state.selected = null; state.confirmed = null; state.initialized = false; state.estimated = false; state.validated = false; state.page = 1; state.query = '';
    filters = emptyFilters(); pendingFilters = emptyFilters();
    el('search').value = '';
    root.querySelector('.studio-live-loss')?.classList.add('is-reset');
    root.querySelector('.studio-live-loss')?.classList.remove('is-training');
    closeFilters(); syncFilters(); clearResults(true); renderDatasets(); renderTwin();
    renderParameters();
    el('validation-results').innerHTML = '<div class="studio-empty studio-results-empty">Complete battery parameter estimation to validate measured and simulated responses.</div>';
    el('initialize-status').textContent = '';
    root.classList.remove('is-calibrating');
    syncWorkflow();
    el('search').focus({ preventScroll: true });
  });
  el('confirm').addEventListener('click', () => {
    if (!state.selected) return;
    cancelAnimationFrame(calibrationFrame);
    state.confirmed = state.selected;
    state.initialized = false; state.estimated = false; state.validated = false;
    root.classList.remove('is-calibrating');
    root.querySelector('.studio-live-loss')?.classList.add('is-reset');
    root.querySelector('.studio-live-loss')?.classList.remove('is-training');
    setCalibrationProgress(0);
    el('initialize-status').textContent = '';
    el('validation-results').innerHTML = '<div class="studio-empty studio-results-empty">Complete battery parameter estimation to validate measured and simulated responses.</div>';
    clearResults(true); renderTwin(); renderDatasets(); renderParameters(); syncWorkflow();
  });
  el('initialize').addEventListener('click', () => {
    if (!state.confirmed || state.initialized) return;
    state.initialized = true;
    el('initialize-status').textContent = 'PIML Battery Twin Initialized';
    renderTwin();
    calibrateTwin();
  });
  el('validate').addEventListener('click', runValidation);
  el('scenario').addEventListener('change', event => { state.scenario = event.target.value; clearResults(); });
  el('prediction-form').addEventListener('submit', runGeneration);
  el('download').addEventListener('click', downloadGeneratedData);
  window.BatteryLakeDigitalTwin = { refresh };
  const revealNodes = root.querySelectorAll('.studio-explainer, .studio-step');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealNodes.forEach(node => node.classList.add('studio-reveal'));
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }), { threshold: .12 });
    revealNodes.forEach(node => revealObserver.observe(node));
  }
  syncControls(); refresh();
})();
