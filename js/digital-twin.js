/* Illustrative local Studio workflow; no model training or API request is performed. */
(function () {
  'use strict';
  const root = document.getElementById('page-studio');
  if (!root) return;
  const el = id => document.getElementById('studio-' + id);
  const state = { selected: null, confirmed: null, page: 1, query: '', charge: 1, temperature: 25, socMin: 10, socMax: 90, cycleMin: 1, cycleMax: 500, scenario: 'constant', generatedData: null };
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
    { label: 'Temperature (°C)', keys: ['temperature'], min: -20, max: 60, step: 1, unit: '°C' },
    { label: 'SOC Window (%)', keys: ['socMin', 'socMax'], min: 0, max: 100, step: 1, unit: '%' },
    { label: 'Cycle Range', keys: ['cycleMin', 'cycleMax'], min: 1, max: 1000, step: 1, unit: '' }
  ];
  // Use the same cycle-aging catalog and ordering as Benchmark's data selection.
  const catalog = () => bwFlowSortedDatasets(getCatalogDatasets().filter(bwIsCycleAgingDataset));
  const format = (key, value) => key === 'charge' ? value.toFixed(1) : String(value);
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
      el('result-status').textContent = 'Setup changed · generate again to update';
      el('run').textContent = 'Update';
      return;
    }
    state.generatedData = null;
    el('results').classList.remove('has-results', 'is-stale');
    el('results').innerHTML = '<div class="studio-empty studio-results-empty"><div class="studio-empty-mark" aria-hidden="true"><span></span><span></span><span></span></div><span>Build a digital twin, adjust the setup, then generate data.</span></div>';
    el('run').textContent = 'Generate';
  }
  function setCalibrationProgress(value) {
    const progress = Math.max(0, Math.min(100, Math.round(value)));
    el('calibration-ring').style.setProperty('--progress', progress);
    el('calibration-value').textContent = progress + '%';
  }
  function setWorkspaceStatus(message, stage) {
    const status = el('workspace-status');
    if (!status) return;
    status.className = 'studio-workspace-status' + (stage ? ' is-' + stage : '');
    status.replaceChildren();
    const mark = document.createElement('span');
    mark.setAttribute('aria-hidden', 'true');
    status.append(mark, document.createTextNode(message));
  }
  function setFlowStage(stage) {
    const nodes = {
      select: root.querySelector('.studio-process-step-1'),
      identify: root.querySelector('.studio-process-step-2'),
      calibrate: root.querySelector('.studio-process-calibration'),
      engine: root.querySelector('.studio-process-engine'),
      setup: root.querySelector('.studio-process-setup'),
      results: root.querySelector('.studio-process-result')
    };
    const completed = {
      select: [], identify: ['select'], calibrate: ['select', 'identify'],
      setup: ['select', 'identify', 'calibrate', 'engine'],
      results: ['select', 'identify', 'calibrate', 'engine', 'setup', 'results']
    };
    Object.entries(nodes).forEach(([name, node]) => {
      if (!node) return;
      node.classList.toggle('is-complete', completed[stage]?.includes(name));
      node.classList.toggle('is-current', stage !== 'results' && name === stage);
    });
    root.dataset.flowStage = stage;
  }
  function restartSignalAnimation(selector, className) {
    const node = root.querySelector(selector);
    if (!node) return;
    node.classList.remove(className);
    requestAnimationFrame(() => node.classList.add(className));
  }
  function calibrateTwin(dataset) {
    cancelAnimationFrame(calibrationFrame);
    el('run').disabled = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    const duration = reduced ? 0 : 1300;
    const tick = now => {
      const ratio = duration ? Math.min(1, (now - started) / duration) : 1;
      const eased = 1 - Math.pow(1 - ratio, 3);
      setCalibrationProgress(eased * 100);
      if (ratio < 1) calibrationFrame = requestAnimationFrame(tick);
      else {
        el('run').disabled = false;
        root.classList.remove('is-calibrating');
        setFlowStage('setup');
        setWorkspaceStatus('Digital twin ready · configure a synthetic scenario', 'ready');
      }
    };
    root.classList.add('is-calibrating');
    setFlowStage('calibrate');
    setWorkspaceStatus('Calibrating the digital twin…', 'working');
    calibrationFrame = requestAnimationFrame(tick);
  }
  function renderTwin() {
    const dataset = catalog().find(d => d.id === state.confirmed);
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
      el('twin').textContent = 'Select and confirm a dataset to build its digital twin';
      setCalibrationProgress(0);
    }
    el('run').disabled = !dataset;
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
        setWorkspaceStatus('Dataset selected · confirm to begin', 'ready');
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
    if (!list.some(d => d.id === state.confirmed)) { state.confirmed = null; clearResults(true); }
    renderDatasets(); renderTwin();
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
    if (!state.confirmed) return;
    const firstRun = !el('results').classList.contains('has-results');
    const params = { ...state };
    // Deterministic mock, sensitive to setup controls. No training or API request.
    const stress = Math.pow(params.charge, 0.35) * (1 + Math.abs(params.temperature - 25) * 0.012) * ((params.socMax - params.socMin) / 80) * ({ constant: 1, fast: 1.2, dynamic: 1.1 }[params.scenario]);
    const soh = cycle => Math.max(40, 100 - 16.8 * Math.pow(cycle / 500, 0.72) * stress);
    const currentCycle = params.cycleMin - 1;
    const current = soh(currentCycle);
    const peak = params.temperature + 4.4 * Math.pow(params.charge, 1.2);
    const capacity = 3 * current / 100 * (params.socMax - params.socMin) / 80 / (1 + Math.max(0, params.charge - 1) * 0.04);
    const duration = Math.round(130 / params.charge);
    const cycleCount = Math.max(1, params.cycleMax - params.cycleMin + 1);
    const sampleCount = cycleCount * Math.max(60, Math.round(duration * 6));
    const consistency = Math.max(94, 99.4 - Math.abs(params.temperature - 25) * .025 - Math.max(0, params.charge - 1) * .3);
    const finalCapacity = 3 * soh(params.cycleMax) / 100;
    const dataset = catalog().find(d => d.id === params.confirmed);
    state.generatedData = {
      dataset,
      params,
      rows: Array.from({ length: cycleCount }, (_, index) => {
        const cycle = params.cycleMin + index;
        return { cycle, soh: soh(cycle), capacity: 3 * soh(cycle) / 100 };
      })
    };
    el('download').disabled = false;
    setFlowStage('results');
    setWorkspaceStatus('Synthetic dataset ready · download or refine the setup', 'ready');
    const metric = (label, value, unit, change = '', note = '') => `<div class="studio-metric"${note ? ` title="${note}"` : ''}><span>${label}</span><div><strong>${value}</strong><small>${unit}</small>${change ? `<span class="studio-metric-delta">${change}</span>` : ''}</div></div>`;
    const info = text => `<span class="studio-info" tabindex="0" role="note" aria-label="${text}">i<span class="studio-info-tip">${text}</span></span>`;
    el('results').classList.add('has-results');
    el('results').classList.remove('is-stale');
    el('run').textContent = 'Generate Again';
    const datasetName = dataset?.name || '';
    el('results').innerHTML = `<div class="studio-report-head"><div><strong>${esc(datasetName)} · Synthetic dataset</strong><span>${params.charge.toFixed(1)} C · ${params.temperature} °C · SOC ${params.socMin}–${params.socMax}% · Cycles ${params.cycleMin}–${params.cycleMax}</span></div><span id="studio-result-status" role="status">Illustrative output · generated by calibrated twin</span></div>
      <section class="studio-prediction-block" aria-labelledby="studio-performance-title">
        <div class="studio-chart-heading"><h3 id="studio-performance-title">Synthetic Signal Profile ${info('Illustrative signals generated from the selected operating envelope. No real model training or API request is performed.')}</h3>
          <select class="studio-input" id="studio-performance-view" aria-label="Synthetic signal chart metric"><option value="temperature">Temperature (°C)</option><option value="voltage">Voltage (V)</option><option value="current">Current (A)</option></select></div>
        <div class="studio-output-grid"><div class="studio-metrics">
          ${metric('Generated Cycles', cycleCount.toLocaleString(), '')}
          ${metric('Profile Samples', sampleCount.toLocaleString(), '')}
          ${metric('Physics Consistency', consistency.toFixed(1), '%')}
        </div><div id="studio-performance-chart"></div></div>
      </section>
      <section class="studio-prediction-block" aria-labelledby="studio-soh-title">
        <div class="studio-chart-heading"><h3 id="studio-soh-title">Synthetic Capacity Trajectory ${info('Capacity retention is generated across the requested cycle range using the calibrated digital twin.')}</h3></div>
        <div class="studio-output-grid"><div class="studio-metrics">
          ${metric('Initial Capacity', (3 * current / 100).toFixed(2), 'Ah')}
          ${metric('Final Capacity', finalCapacity.toFixed(2), 'Ah')}
          ${metric('Capacity Retention', soh(params.cycleMax).toFixed(1), '%')}
        </div><div id="studio-soh-chart"></div></div>
      </section>`;
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
    const values = Array.from({ length: 51 }, (_, i) => 3 * soh(params.cycleMin + (params.cycleMax - params.cycleMin) * i / 50) / 100);
    const lower = Math.max(0, Math.floor((Math.min(...values) - .1) * 10) / 10);
    const upper = Math.ceil((Math.max(...values) + .05) * 10) / 10;
    el('soh-chart').innerHTML = chart({ title: 'Synthetic capacity trajectory over requested cycles', values, min: lower, max: upper, ticks: [lower, +((lower + upper) / 2).toFixed(2), upper], unit: '', labels: [{ index: 0, label: `Cycle ${params.cycleMin}` }, { index: 25, label: Math.round((params.cycleMin + params.cycleMax) / 2) }, { index: 50, label: `Cycle ${params.cycleMax}` }], endpoint: `${finalCapacity.toFixed(2)} Ah` });
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
    const header = ['dataset_id', 'dataset_name', 'scenario', 'cycle', 'charge_rate_c', 'temperature_c', 'soc_min_pct', 'soc_max_pct', 'soh_pct', 'capacity_ah'];
    const csv = [header, ...rows.map(row => [dataset?.id || '', dataset?.name || '', params.scenario, row.cycle, params.charge.toFixed(1), params.temperature, params.socMin, params.socMax, row.soh.toFixed(3), row.capacity.toFixed(4)])]
      .map(row => row.map(csvEscape).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batterylake-synthetic-${dataset?.id || 'dataset'}-cycles-${params.cycleMin}-${params.cycleMax}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
    state.selected = null; state.confirmed = null; state.page = 1; state.query = '';
    filters = emptyFilters(); pendingFilters = emptyFilters();
    el('search').value = '';
    root.querySelector('.studio-feature-grid')?.classList.add('is-reset');
    root.querySelector('.studio-live-loss')?.classList.add('is-reset');
    root.querySelector('.studio-feature-grid')?.classList.remove('is-identified');
    root.querySelector('.studio-live-loss')?.classList.remove('is-training');
    closeFilters(); syncFilters(); clearResults(true); renderDatasets(); renderTwin();
    root.classList.remove('is-calibrating');
    setFlowStage('select');
    setWorkspaceStatus('Start by selecting a dataset');
    el('search').focus({ preventScroll: true });
  });
  el('confirm').addEventListener('click', () => {
    if (!state.selected) return;
    state.confirmed = state.selected;
    root.querySelector('.studio-feature-grid')?.classList.remove('is-reset');
    root.querySelector('.studio-live-loss')?.classList.remove('is-reset');
    restartSignalAnimation('.studio-feature-grid', 'is-identified');
    restartSignalAnimation('.studio-live-loss', 'is-training');
    clearResults(true); renderTwin(); renderDatasets();
    const dataset = catalog().find(d => d.id === state.confirmed);
    if (dataset) calibrateTwin(dataset);
  });
  el('scenario').addEventListener('change', event => { state.scenario = event.target.value; clearResults(); setWorkspaceStatus('Scenario updated · generate when ready', 'ready'); });
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
  setFlowStage('select');
  syncControls(); refresh();
})();
