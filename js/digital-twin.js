/* First-pass UI only. Predictions are illustrative, never fitted to catalog data. */
(function () {
  'use strict';
  const root = document.getElementById('page-digital-twin');
  if (!root) return;
  const el = id => document.getElementById('studio-' + id);
  const state = { selected: null, confirmed: null, page: 1, query: '', charge: 1, temperature: 25, socMin: 10, socMax: 90, cycleMin: 1, cycleMax: 500, scenario: 'constant' };
  const emptyFilters = () => ({ all: false, chem: new Set(), form: new Set(), cat: new Set(), domain: new Set(), duty: new Set() });
  let filters = emptyFilters();
  let pendingFilters = emptyFilters();
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
    '18650': 'assets/images/studio-batteries/18650.png',
    '21700': 'assets/images/studio-batteries/21700.png',
    pouch: 'assets/images/studio-batteries/pouch.png',
    prismatic: 'assets/images/studio-batteries/prismatic.png',
    cyl: 'assets/images/studio-batteries/cyl.png'
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
  const twinMeasureCrop = {
    '21700': { left: 0.38, right: 0.62, top: 0.27, bottom: 0.73 },
    '18650': { left: 0.36, right: 0.64, top: 0.25, bottom: 0.76 }
  };
  function positionTwinMeasures(image, measures, formKey) {
    if (!image || !measures || !image.getBoundingClientRect) return;
    const imageBox = image.getBoundingClientRect();
    const visualBox = measures.parentElement.getBoundingClientRect();
    const gap = 20;
    const crop = twinMeasureCrop[formKey] || { left: 0, right: 1, top: 0, bottom: 1 };
    const left = imageBox.left - visualBox.left + imageBox.width * crop.left;
    const right = imageBox.left - visualBox.left + imageBox.width * crop.right;
    const top = imageBox.top - visualBox.top + imageBox.height * crop.top;
    const bottom = imageBox.top - visualBox.top + imageBox.height * crop.bottom;
    const width = right - left;
    const height = bottom - top;
    const heightScale = measures.querySelector('.studio-measure-height');
    const widthScale = measures.querySelector('.studio-measure-width');
    if (heightScale) {
      heightScale.style.left = `${left - gap}px`;
      heightScale.style.top = `${top}px`;
      heightScale.style.transform = 'translateX(-100%)';
      const line = heightScale.querySelector('i');
      if (line) line.style.height = `${height}px`;
    }
    if (widthScale) {
      widthScale.style.left = `${left}px`;
      widthScale.style.top = `${top + height + gap}px`;
      widthScale.style.bottom = 'auto';
      widthScale.style.transform = 'none';
      const line = widthScale.querySelector('i');
      if (line) line.style.width = `${width}px`;
    }
  }
  function clearResults(reset = false) {
    if (!reset && el('results').classList.contains('has-results')) {
      el('results').classList.add('is-stale');
      el('result-status').textContent = 'Setup changed · run again to update';
      el('run').textContent = 'Update Prediction';
      return;
    }
    el('results').classList.remove('has-results', 'is-stale');
    el('results').innerHTML = '<div class="studio-empty studio-results-empty"><div class="studio-empty-mark" aria-hidden="true"><span></span><span></span><span></span></div><strong>Your prediction starts here</strong><span>Confirm a dataset, adjust the setup, then run a prediction.</span></div>';
    el('run').textContent = 'Run Prediction';
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
        visual.append(image);
        if (['18650', '21700'].includes(twinFormKey(dataset.form))) {
          const measure = document.createElement('div');
          measure.className = 'studio-twin-measures';
          measure.innerHTML = twinFormKey(dataset.form) === '18650'
            ? '<span class="studio-measure-height"><i></i>Height 65 mm</span><span class="studio-measure-width"><i></i>Ø 18 mm</span>'
            : '<span class="studio-measure-height"><i></i>Height 70 mm</span><span class="studio-measure-width"><i></i>Ø 21 mm</span>';
          visual.append(measure);
          const formKey = twinFormKey(dataset.form);
          const syncMeasures = () => requestAnimationFrame(() => positionTwinMeasures(image, measure, formKey));
          image.addEventListener('load', syncMeasures, { once: true });
          if (window.ResizeObserver) new ResizeObserver(syncMeasures).observe(image);
          syncMeasures();
        }
        el('twin').append(caption, visual);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'studio-visual-placeholder';
        placeholder.textContent = 'Digital twin visualization';
        el('twin').append(caption, placeholder);
      }
    } else {
      el('twin').textContent = 'Select and confirm a dataset to load its digital twin';
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
    const pages = Math.max(1, Math.ceil(list.length / 4));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * 4;
    el('dataset-list').replaceChildren();
    list.slice(start, start + 4).forEach(d => {
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
    el('pager-info').textContent = list.length ? `${start + 1}–${Math.min(start + 4, list.length)} of ${list.length} datasets` : '0 datasets';
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
    el('confirm').textContent = state.selected && state.selected === state.confirmed ? 'Confirmed' : 'Confirm';
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
  function runPrediction(event) {
    event.preventDefault(); syncControls();
    if (!state.confirmed) return;
    const firstRun = !el('results').classList.contains('has-results');
    const params = { ...state };
    // Deterministic mock, sensitive to setup controls. No training or API request.
    const stress = Math.pow(params.charge, 0.35) * (1 + Math.abs(params.temperature - 25) * 0.012) * ((params.socMax - params.socMin) / 80) * ({ constant: 1, fast: 1.2, dynamic: 1.1 }[params.scenario]);
    const soh = cycle => Math.max(40, 100 - 16.8 * Math.pow(cycle / 500, 0.72) * stress);
    const currentCycle = params.cycleMin - 1;
    const current = soh(currentCycle);
    const after50 = soh(currentCycle + 50);
    const daysTo90 = Math.max(0, Math.ceil(500 * Math.pow(10 / (16.8 * stress), 1 / 0.72) - currentCycle));
    const peak = params.temperature + 4.4 * Math.pow(params.charge, 1.2);
    const capacity = 3 * current / 100 * (params.socMax - params.socMin) / 80 / (1 + Math.max(0, params.charge - 1) * 0.04);
    const energy = capacity * 3.7;
    const duration = Math.round(130 / params.charge);
    const delta = (value, unit) => `${value > 0.05 ? '+' : value < -0.05 ? '−' : '±'}${Math.abs(value).toFixed(1)} ${unit}`;
    const metric = (label, value, unit, change = '', note = '') => `<div class="studio-metric"${note ? ` title="${note}"` : ''}><span>${label}</span><div><strong>${value}</strong><small>${unit}</small>${change ? `<span class="studio-metric-delta">${change}</span>` : ''}</div></div>`;
    const info = text => `<span class="studio-info" tabindex="0" role="note" aria-label="${text}">i<span class="studio-info-tip">${text}</span></span>`;
    el('results').classList.add('has-results');
    el('results').classList.remove('is-stale');
    el('run').textContent = 'Run Again';
    const datasetName = catalog().find(d => d.id === params.confirmed)?.name || '';
    el('results').innerHTML = `<div class="studio-report-head"><div><strong>${esc(datasetName)}</strong><span>${params.charge.toFixed(1)} C · ${params.temperature} °C · SOC ${params.socMin}–${params.socMax}% · Cycles ${params.cycleMin}–${params.cycleMax}</span></div><span id="studio-result-status" role="status">Illustrative preview · not fitted to dataset</span></div>
      <section class="studio-prediction-block" aria-labelledby="studio-performance-title">
        <div class="studio-chart-heading"><h3 id="studio-performance-title">Performance Prediction ${info('Mock performance for a nominal 3 Ah, 3.7 V cell. Deltas compare with 1 C, 25 °C and a 10–90% SOC window.')}</h3>
          <select class="studio-input" id="studio-performance-view" aria-label="Performance chart metric"><option value="temperature">Temperature (°C)</option><option value="capacity">Discharge Capacity (Ah)</option><option value="energy">Discharge Energy (Wh)</option></select></div>
        <div class="studio-output-grid"><div class="studio-metrics">
          ${metric('Peak Temp', peak.toFixed(1), '°C', delta(peak - 29.4, '°C'))}
          ${metric('Discharge Capacity', capacity.toFixed(2), 'Ah', delta(capacity - 3, 'Ah'))}
          ${metric('Discharge Energy', energy.toFixed(2), 'Wh', delta(energy - 11.1, 'Wh'))}
        </div><div id="studio-performance-chart"></div></div>
      </section>
      <section class="studio-prediction-block" aria-labelledby="studio-soh-title">
        <div class="studio-chart-heading"><h3 id="studio-soh-title">SoH Prediction ${info('Illustrative history and forecast. Now is the start of the selected cycle range. Time to 90% assumes one cycle per day. Dashed line: forecast.')}</h3></div>
        <div class="studio-output-grid"><div class="studio-metrics">
          ${metric('Current', current.toFixed(1), '%')}
          ${metric('After 50 cycles', after50.toFixed(1), '%', delta(after50 - current, 'pt'))}
          ${metric('Time to 90%', daysTo90 === 0 ? 'Reached' : daysTo90, daysTo90 === 0 ? '' : 'days', '', 'Assumes one cycle per day')}
        </div><div id="studio-soh-chart"></div></div>
        <div class="studio-forecast-summary">At ${params.cycleMax} cycles <strong>${soh(params.cycleMax).toFixed(1)}% SoH</strong><span>1 cycle/day assumed</span></div>
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
        ? { total: peak, min: Math.floor(Math.min(params.temperature, 25) / 5) * 5, max: Math.ceil(Math.max(45, peak + 5) / 5) * 5, unit: '°', limit: 40, title: 'Temperature (°C)' }
        : { total: mode === 'capacity' ? capacity : energy, min: 0, max: Math.ceil((mode === 'capacity' ? capacity : energy) * 1.15), unit: '', title: mode === 'capacity' ? 'Discharge Capacity (Ah)' : 'Discharge Energy (Wh)' };
      const values = Array.from({ length: 41 }, (_, i) => mode === 'temperature' ? params.temperature + (peak - params.temperature) * (1 - Math.exp(-i / 9)) / (1 - Math.exp(-40 / 9)) : config.total * i / 40);
      el('performance-chart').innerHTML = chart({ ...config, values, ticks: Array.from({ length: 4 }, (_, i) => +(config.min + (config.max - config.min) * i / 3).toFixed(1)), labels: [{ index: 0, label: 'Now' }, { index: 20, label: Math.round(duration / 2) }, { index: 40, label: `${duration} min` }], endpoint: `${config.total.toFixed(mode === 'temperature' ? 1 : 2)} ${mode === 'temperature' ? '°C' : mode === 'capacity' ? 'Ah' : 'Wh'}` });
    }
    const history = Math.min(20, currentCycle);
    const split = history ? 20 : 0;
    const values = Array.from({ length: split + 51 }, (_, i) => soh(split && i <= split ? currentCycle - history + history * i / split : currentCycle + i - split));
    const lower = Math.floor(Math.min(...values) - 1);
    el('soh-chart').innerHTML = chart({ title: 'State of health: illustrative history and 50-cycle forecast', values, min: lower, max: 100.5, ticks: [lower, +(lower + (100 - lower) / 2).toFixed(1), 100], unit: '%', split, labels: history ? [{ index: 0, label: `−${history}` }, { index: split, label: 'Now' }, { index: split + 50, label: '+50 cycles' }] : [{ index: 0, label: 'Now' }, { index: 25, label: '+25' }, { index: 50, label: '+50 cycles' }], endpoint: `${after50.toFixed(1)}%` });
    el('performance-view').addEventListener('change', renderPerformance);
    renderPerformance();
    if (firstRun && el('results-title').getBoundingClientRect().top > window.innerHeight * 0.5) {
      el('results-title').focus({ preventScroll: true });
      el('results-title').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
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
  el('confirm').addEventListener('click', () => { if (!state.selected) return; state.confirmed = state.selected; clearResults(true); renderTwin(); renderDatasets(); });
  el('scenario').addEventListener('change', event => { state.scenario = event.target.value; clearResults(); });
  el('prediction-form').addEventListener('submit', runPrediction);
  window.BatteryLakeDigitalTwin = { refresh };
  syncControls(); refresh();
})();
