/* Static, verified experiment results. No backend or local-run state required. */
(() => {
  'use strict';
  const root = document.getElementById('published-benchmarks');
  if (!root) return;
  const el = id => document.getElementById('pbr-' + id);
  const integer = n => Number(n).toLocaleString('en-US');
  const number = n => n === 0 ? '0' : (Math.abs(n) < 0.0001 || Math.abs(n) >= 10000)
    ? n.toExponential(3) : n.toLocaleString('en-US', {maximumSignificantDigits: 6});
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const variants = {baseline: 'Frozen baseline definition', initial: 'Q / initial capacity', nominal: 'Q / nominal capacity',
    threshold_080: 'First observed ≤ 80% threshold', threshold_070: 'First observed ≤ 70% threshold', nominal_transfer: 'Q / nominal capacity · transfer'};
  const protocols = {cross_cell: 'Cross-cell', temporal: 'Temporal', random: 'Random · leakage control'};
  const protocolNotes = {
    cross_cell: 'Physical cells are separated across train, validation and test. Imputation and scaling use training data only.',
    temporal: 'Within-cell chronological split. The first 15 window anchors after each boundary are excluded to avoid overlapping history windows.',
    random: 'Deliberate leakage control: observations from the same cell may appear in every partition and history windows can overlap. Excluded from leakage-free comparisons.'
  };
  let data, loading = false;
  function options(id, rows, preferred) {
    const select = el(id), old = select.value;
    select.replaceChildren(...rows.map(([value, label]) => {
      const option = make('option', label); option.value = value; return option;
    }));
    select.disabled = !rows.length;
    select.value = rows.some(r => r[0] === old) ? old : rows.some(r => r[0] === preferred) ? preferred : (rows[0]?.[0] || '');
  }
  function profileOptions() {
    const candidates = data.cases.filter(c => c.dataset_id === el('dataset').value);
    const ready = candidates.filter(c => data.conditions.some(r => r.case_id === c.id && r.task === el('task').value));
    options('profile', (ready.length ? ready : candidates).map(c => [c.id, c.name]));
    variantOptions();
  }
  function matching() {
    return data.conditions.filter(c => c.case_id === el('profile').value && c.task === el('task').value);
  }
  function variantOptions() {
    const available = new Set(matching().map(c => c.variant));
    options('variant', Object.entries(variants).filter(([v]) => available.has(v)), 'baseline');
    protocolOptions();
  }
  function protocolOptions() {
    const available = new Set(matching().filter(c => c.variant === el('variant').value).map(c => c.protocol));
    options('protocol', Object.entries(protocols).filter(([p]) => available.has(p)), 'cross_cell');
    render();
  }
  function render() {
    const profile = data.cases.find(c => c.id === el('profile').value);
    const task = el('task').value;
    const condition = matching().find(c => c.variant === el('variant').value && c.protocol === el('protocol').value);
    const thirdParty = profile?.source_reference === 'third_party_processed_copy';
    const scope = el('scope'); scope.replaceChildren();
    if (profile) {
      scope.append(make('strong', profile.selected_cells === null ? 'Cross-dataset SOH transfer · frozen source and target splits'
        : `${profile.selected_cells} selected cells · inherited train / validation / test: ${Object.values(profile.split_cells).join(' / ')}`));
      scope.append(make('p', 'Baseline definition: ' + profile.label));
      if (thirdParty) scope.append(make('p', 'Source: BatteryLife processed copy → canonical. The BatteryArchive original CSV files were not acquired.', 'pbr-source-note'));
      if (profile.dataset_id === 'dataset_11') scope.append(make('p', 'KIT v2 EOC profile uses temperature endpoints; voltage and current are missing. This is not a full waveform benchmark.', 'pbr-source-note'));
      if (profile.dataset_id === 'dataset_19') scope.append(make('p', 'Oxford: Group 5 continuous-cycling cohort only.', 'pbr-source-note'));
      if (profile.dataset_id === 'dataset_37') scope.append(make('p', 'HM: incident-screened v7 identities only. Cells without valid observed endpoints remain right-censored.', 'pbr-source-note'));
    }
    const isRandom = condition?.protocol === 'random';
    el('protocol-note').textContent = condition ? protocolNotes[condition.protocol] : '';
    el('protocol-note').classList.toggle('is-control', isRandom);
    el('table-area').hidden = !condition;
    el('empty').hidden = !!condition;
    el('rows').replaceChildren();
    if (!condition) {
      el('empty').textContent = task === 'rul_prediction' && ['dataset_27', 'dataset_37'].includes(profile?.dataset_id)
        ? 'No point-value RUL result: this frozen cohort has no eligible observed threshold endpoints. Right-censored cells are retained; SOH results are available.'
        : 'This task has no published result for the selected scope. Missing labels or an ineligible frozen split are not reported as zero error.';
    } else {
      const unit = condition.target_unit === 'SOH ratio' ? 'SOH ratio (1.0 = 100%; multiply errors by 100 for percentage points)' : condition.target_unit.replaceAll('_', ' ');
      el('caption').textContent = `Processed inputs · ${variants[condition.variant]} · ${protocols[condition.protocol]} · Error unit: ${unit}`;
      const rows = [...condition.models].sort((a, b) => a.rank - b.rank || a.model.localeCompare(b.model));
      const minimumRank = Math.min(...rows.map(r => r.rank));
      const maximum = Math.max(...rows.map(r => r.rmse));
      for (const r of rows) {
        const tr = make('tr', undefined, r.rank === minimumRank ? 'pbr-best' : '');
        tr.dataset.model = r.model;
        tr.append(make('td', number(r.rank)), make('td', data.models[r.model]));
        const rmse = make('td', `${number(r.rmse)} ± ${number(r.sd)}`, 'pbr-metric');
        rmse.title = `${r.rmse} ± ${r.sd}`;
        const bar = make('span', undefined, 'pbr-error-bar'); bar.setAttribute('aria-hidden', 'true');
        bar.style.width = (maximum > 0 ? 100 * r.rmse / maximum : 0) + '%'; rmse.append(bar);
        tr.append(rmse, make('td', number(r.mae)), make('td', integer(r.test_cells)), make('td', integer(r.test_n)));
        el('rows').append(tr);
      }
    }
    const pairs = condition?.variant === 'baseline' && condition.protocol === 'cross_cell'
      ? data.pairs.filter(p => p.case_id === condition.case_id && p.task === task) : [];
    el('pair-table-area').hidden = !pairs.length;
    el('pair-badge').textContent = pairs.length ? `${pairs.filter(p => p.status === 'passed_direct_comparison').length}/${pairs.length} model groups passed` : 'Not run for this condition';
    el('pair-note').textContent = pairs.length
      ? `${thirdParty ? '“Raw” here means the BatteryLife processed copy. ' : ''}Raw-A and Raw-B are independent repeated training runs. Each processed run uses the same seed; fixed-checkpoint inference is also checked. Direct prediction agreement does not establish statistical equivalence.`
      : 'Paired training and fixed-checkpoint inference were evaluated for the frozen baseline label with cross-cell splits. This selected condition has no paired claim.';
    el('pair-rows').replaceChildren();
    for (const p of pairs.sort((a, b) => data.models[a.model].localeCompare(data.models[b.model]))) {
      const tr = make('tr');
      tr.append(...[data.models[p.model], number(p.raw_a), number(p.raw_b), number(p.processed), number(p.paired_max_abs)].map(x => make('td', x)));
      el('pair-rows').append(tr);
    }
    const detail = {condition: condition || null, profile, task, models: data.models};
    window.BatteryLakePublishedCondition = detail;
    document.dispatchEvent(new CustomEvent('batterylake:benchmark-condition', {detail}));
  }
  async function load() {
    if (loading || data) return;
    loading = true; el('loading').hidden = false; el('loading').textContent = 'Loading the verified result snapshot…'; el('retry').hidden = true;
    try {
      const response = await fetch(new URL('assets/data/benchmark-results/snapshot.json', document.baseURI));
      if (!response.ok) throw new Error('Snapshot unavailable');
      const snapshot = await response.json();
      if (snapshot.schema_version !== 1 || !snapshot.conditions?.length || snapshot.conditions.some(c => c.models.length !== 7)) throw new Error('Invalid snapshot');
      data = snapshot;
      const s = data.summary;
      el('stats').replaceChildren(...[
        [integer(s.datasets), 'Cycle-aging datasets', `${s.profiles} frozen profiles`],
        [integer(s.fits), 'Verified model fits', `${integer(s.task_fits.soh_estimation)} SOH · ${integer(s.task_fits.rul_prediction)} RUL`],
        [integer(s.models), 'Trainable models', 'Five seeds · PINN4SOH included'],
        [integer(s.paired_groups), 'Direct paired checks', `${s.paired_statuses.passed_direct_comparison} passed`]
      ].map(([value, label, detail]) => {
        const card = make('div', undefined, 'pbr-stat'); card.append(make('strong', value), make('span', label), make('small', detail)); return card;
      }));
      const date = new Date(data.results_at).toLocaleDateString('en-GB', {timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric'});
      el('snapshot').textContent = `Results snapshot: ${date} · ${s.conditions} ranked conditions · Selected cell subsets; original releases may be larger.`;
      el('audit-summary').textContent = `${s.paired_statuses.passed_direct_comparison}/${s.paired_groups} baseline cross-cell model/task groups passed direct prediction comparison across five seeds. ${s.protocol_comparisons} additional comparisons examine protocol and label sensitivity.`;
      el('tost-note').textContent = `TOST statistical equivalence: ${s.tost_claims} established claims. ${s.tost_statuses.insufficient_test_cells} groups have fewer than five test cells; ${s.tost_statuses.degenerate_difference_variance} have degenerate difference variance. Numerical agreement and statistical evidence are reported separately.`;
      options('dataset', [...data.datasets.map(d => [d.id, d.id.replace('dataset_', '') + ' · ' + d.name]), ['transfer', 'Cross-dataset SOH transfer']], 'dataset_01');
      profileOptions();
      el('content').hidden = false; el('loading').hidden = true;
    } catch (error) {
      data = undefined;
      el('loading').textContent = 'The results snapshot could not be loaded. Retry, or download the verified rankings CSV above.';
      el('retry').hidden = false;
    } finally { loading = false; }
  }
  el('task').addEventListener('change', profileOptions);
  el('dataset').addEventListener('change', profileOptions);
  el('profile').addEventListener('change', variantOptions);
  el('variant').addEventListener('change', protocolOptions);
  el('protocol').addEventListener('change', render);
  el('retry').addEventListener('click', load);
  // showPage uses replaceState; observe visibility without changing its router.
  const page = document.getElementById('page-benchmarks');
  const observer = new MutationObserver(() => { if (page.classList.contains('active')) void load(); });
  observer.observe(page, {attributes: true, attributeFilter: ['class']});
  if (page.classList.contains('active')) void load();
})();
