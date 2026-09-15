/* First-pass UI only. Predictions are illustrative, never fitted to catalog data. */
(function () {
  'use strict';
  const root = document.getElementById('page-digital-twin');
  if (!root) return;
  const el = id => document.getElementById('studio-' + id);
  const state = { selected: null, confirmed: null, page: 1, query: '', chemistry: '', form: '', charge: 1, temperature: 25, socMin: 10, socMax: 90, cycleMin: 1, cycleMax: 500, scenario: 'constant' };
  const controls = [
    { label: 'Charge Rate (C)', keys: ['charge'], min: 0.1, max: 5, step: 0.1, unit: 'C' },
    { label: 'Temperature (°C)', keys: ['temperature'], min: -20, max: 60, step: 1, unit: '°C' },
    { label: 'SOC Window (%)', keys: ['socMin', 'socMax'], min: 0, max: 100, step: 1, unit: '%' },
    { label: 'Cycle Range', keys: ['cycleMin', 'cycleMax'], min: 1, max: 1000, step: 1, unit: '' }
  ];
  // Use the same cycle-aging catalog and ordering as Benchmark's data selection.
  const catalog = () => bwFlowSortedDatasets(getCatalogDatasets().filter(bwIsCycleAgingDataset));
  const format = (key, value) => key === 'charge' ? value.toFixed(1) : String(value);
  function clearResults() {
    el('results').innerHTML = '<div class="studio-empty">Run a prediction to view results</div>';
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
      const placeholder = document.createElement('span');
      placeholder.className = 'studio-visual-placeholder';
      placeholder.textContent = 'Digital twin visualization';
      el('twin').append(caption, placeholder);
    } else {
      el('twin').textContent = 'Select and confirm a dataset to load its digital twin';
    }
    el('run').disabled = !dataset;
  }
  function renderDatasets() {
    const list = catalog().filter(d => (!state.query || [d.name, d.ref_name, d.chemistry, d.form].join(' ').toLowerCase().includes(state.query)) && (!state.chemistry || d.chemistry === state.chemistry) && (!state.form || d.form === state.form));
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
    if (!list.some(d => d.id === state.confirmed)) { state.confirmed = null; clearResults(); }
    ['chemistry', 'form'].forEach(key => {
      const select = el(key);
      select.replaceChildren(new Option(key === 'chemistry' ? 'All chemistries' : 'All form factors', ''));
      [...new Set(list.map(d => d[key]).filter(Boolean))].sort().forEach(value => select.add(new Option(value, value)));
      if (!Array.from(select.options).some(option => option.value === state[key])) state[key] = '';
      select.value = state[key];
    });
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
    // Deterministic mock, sensitive to setup controls. No training or API request.
    const stress = Math.pow(state.charge, 0.35) * (1 + Math.abs(state.temperature - 25) * 0.012) * ((state.socMax - state.socMin) / 80) * ({ constant: 1, fast: 1.2, dynamic: 1.1 }[state.scenario]);
    const soh = cycle => Math.max(40, 100 - 16.8 * Math.pow(cycle / 500, 0.72) * stress);
    const end = soh(state.cycleMax);
    const yMin = Math.max(0, Math.floor((end - 4) / 10) * 10);
    const x = cycle => 48 + (cycle - state.cycleMin) / (state.cycleMax - state.cycleMin) * 426;
    const y = value => 178 - (value - yMin) / (100 - yMin) * 156;
    let grid = '';
    for (let health = yMin; health <= 100; health += 10) {
      grid += `<line x1="48" x2="474" y1="${y(health)}" y2="${y(health)}"/><text x="38" y="${y(health) + 4}" text-anchor="end">${health}</text>`;
    }
    const tickCount = Math.min(4, state.cycleMax - state.cycleMin);
    for (let i = 0; i <= tickCount; i++) {
      const cycle = Math.round(state.cycleMin + (state.cycleMax - state.cycleMin) * i / tickCount);
      grid += `<text x="${x(cycle)}" y="197" text-anchor="middle">${cycle}</text>`;
    }
    const points = Array.from({ length: 61 }, (_, i) => {
      const cycle = state.cycleMin + (state.cycleMax - state.cycleMin) * i / 60;
      return `${x(cycle).toFixed(2)},${y(soh(cycle)).toFixed(2)}`;
    }).join(' ');
    el('results').innerHTML = `<div class="studio-chart-heading"><h3>State of Health (SoH)</h3><span>Illustrative preview</span></div>
      <svg class="studio-chart" viewBox="0 0 490 225" role="img" aria-labelledby="studio-chart-title studio-chart-desc"><title id="studio-chart-title">Illustrative state of health prediction</title><desc id="studio-chart-desc">Mock SoH curve from cycle ${state.cycleMin} to ${state.cycleMax}, ending at ${end.toFixed(1)} percent. Not fitted to the selected dataset.</desc><g class="studio-chart-grid">${grid}</g><text class="studio-axis-label" transform="translate(13 103) rotate(-90)" text-anchor="middle">SoH (%)</text><text class="studio-axis-label" x="261" y="220" text-anchor="middle">Cycle</text><polyline class="studio-curve" points="${points}"/></svg>
      <div class="studio-result-value"><div><span>Predicted SoH</span><small>@ ${state.cycleMax} cycles</small></div><strong>${end.toFixed(1)}<span>%</span></strong></div>`;
  }
  el('search').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); state.page = 1; renderDatasets(); });
  function closeFilters() { el('filters').hidden = true; el('filter-toggle').setAttribute('aria-expanded', 'false'); }
  el('filter-toggle').addEventListener('click', () => { el('filters').hidden = !el('filters').hidden; el('filter-toggle').setAttribute('aria-expanded', String(!el('filters').hidden)); });
  document.addEventListener('click', event => { if (!root.querySelector('.studio-search-tools').contains(event.target)) closeFilters(); });
  el('filters').addEventListener('keydown', event => { if (event.key === 'Escape') { closeFilters(); el('filter-toggle').focus(); } });
  ['chemistry', 'form'].forEach(key => el(key).addEventListener('change', event => { state[key] = event.target.value; state.page = 1; renderDatasets(); }));
  el('reset-filters').addEventListener('click', () => { state.chemistry = ''; state.form = ''; state.page = 1; refresh(); });
  el('confirm').addEventListener('click', () => { if (!state.selected) return; state.confirmed = state.selected; clearResults(); renderTwin(); renderDatasets(); });
  el('scenario').addEventListener('change', event => { state.scenario = event.target.value; clearResults(); });
  el('prediction-form').addEventListener('submit', runPrediction);
  window.BatteryLakeDigitalTwin = { refresh };
  syncControls(); refresh();
})();
