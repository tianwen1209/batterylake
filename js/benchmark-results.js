/* Public availability metadata only, reviewed against the frozen harness manifest
 * and completed result receipts. Do not import scores, rankings or predictions.
 * The task illustrations are independent of every dataset's experimental data. */
(() => {
  'use strict';
  const author = 'Author-published data → canonical';
  const observedRul = 'Remaining life to the first observed capacity-threshold event on the frozen life axis. Censored histories do not supply point-value labels.';
  const copySource = 'BatteryLife processed copy → canonical';
  const copyScope = 'Selected full-depth-of-discharge histories from the BatteryLife release. This comparison does not validate the unavailable BatteryArchive original CSV files.';
  const copySoh = 'Source discharge capacity relative to the source nominal capacity.';
  const datasets = [
    {id: 'dataset_01', name: 'NASA PCoE', source: author,
      scope: 'Selected local discharge histories with author capacity measurements.',
      soh: 'Author discharge capacity relative to nominal capacity.', rul: observedRul},
    {id: 'dataset_03', name: 'Stanford / MIT / TRI · MATR', source: author,
      scope: 'The main batch and the author-linked continuation subset are separate SOH cases.',
      soh: 'Source discharge capacity relative to nominal capacity. Continued histories retain their own frozen profile.',
      rul: 'Author-reported cycle life minus the source cycle index. This is an author-endpoint track; it does not establish an independently observed threshold event.'},
    {id: 'dataset_04', name: 'Oxford · Degradation Dataset', source: author,
      scope: 'Selected diagnostic reference-discharge histories. The example discharge file is not counted as another cell.',
      soh: 'Diagnostic discharge capacity relative to nominal capacity.', rul: observedRul},
    {id: 'dataset_05', name: 'RWTH Aachen', source: author,
      scope: 'Available cells with ageing logs and complete reference discharges. Partial-range diagnostics are excluded; the scope does not imply a complete upstream release.',
      soh: 'Complete reference-discharge capacity relative to the first eligible capacity.', rul: observedRul},
    {id: 'dataset_06', name: 'SNL · BatteryArchive', source: copySource, scope: copyScope, soh: copySoh, rul: observedRul},
    {id: 'dataset_07', name: 'HNEI · BatteryArchive', source: copySource, scope: copyScope, soh: copySoh, rul: observedRul},
    {id: 'dataset_08', name: 'UL-PUR · BatteryArchive', source: copySource, scope: copyScope, soh: copySoh, rul: observedRul},
    {id: 'dataset_09', name: 'XJTU', source: author,
      scope: 'Selected cycling histories, supervised only at author-designated capacity tests. Capacity labels are not interpolated.',
      soh: 'Author capacity-test discharge capacity relative to nominal capacity.', rul: observedRul},
    {id: 'dataset_11', name: 'KIT', source: 'Author v2 results → canonical',
      scope: 'Selected cyclic/profile cells from v2 results. Temperature endpoint features only; voltage and current waveforms are missing. This is not a waveform benchmark.',
      soh: 'Measured checkup discharge capacity relative to nominal capacity.',
      rul: 'Observed capacity-threshold events on the author operation-count axis, using the same restricted endpoint-feature profile.'},
    {id: 'dataset_17', name: 'A123 · HEV / WLTP', source: author,
      scope: 'Selected case-cell diagnostic histories. Repeated diagnostics are resolved at each recorded WLTP count.',
      soh: 'Eligible diagnostic discharge capacity relative to nominal capacity.',
      rul: 'Remaining recorded WLTP repetitions to an observed capacity-threshold event.'},
    {id: 'dataset_18', name: 'A123 · Calendar / Cycle Ageing', source: author,
      scope: 'Selected reference-performance-test records. The benchmark does not include all cycling waveform records.',
      soh: 'Eligible reference-test charge capacity relative to the first eligible reference-test capacity.', rul: observedRul},
    {id: 'dataset_19', name: 'Oxford · Path Dependent Ageing', source: author,
      scope: 'Group 5 continuous-cycling control cohort only. Coupled calendar groups and the pure-calendar group are excluded.',
      soh: 'Selected diagnostic discharge capacity relative to nominal capacity.',
      rul: 'Observed capacity-threshold events on a recorded-discharge-operation axis. Operations are not asserted to be complete physical cycles.'},
    {id: 'dataset_21', name: 'CMU · eVTOL', source: author,
      scope: 'Selected mission-cell histories with eligible reference tests; incomplete diagnostics are masked and repeats are resolved per mission count.',
      soh: 'Reference-test discharge capacity relative to nominal capacity.',
      rul: 'Remaining recorded mission operations to an observed capacity-threshold event.'},
    {id: 'dataset_23', name: 'EVERLASTING · 4TU', source: author,
      scope: 'Selected cycling/driving cells shared with the EVERLASTING source alias. Elapsed-time and recorded-operation profiles are separate experiments.',
      soh: 'Complete reference-discharge capacity relative to nominal capacity, with the profiles kept separate.',
      rul: 'The primary profile measures remaining elapsed days; a separate constant-current subset measures completed discharge operations. Their errors are not pooled.'},
    {id: 'dataset_27', name: 'Stanford Onori · Second Life', source: author,
      scope: 'Selected second-life diagnostic histories from a fixed-duration experiment. Calendar pauses do not advance the recorded-operation axis.',
      soh: 'Eligible diagnostic discharge capacity relative to the frozen nominal reference.',
      rul: null,
      unavailable: 'The selected histories are right-censored: no eligible fixed capacity-threshold endpoint is observed. The experiment end is not substituted for an end-of-life event.'},
    {id: 'dataset_36', name: 'Imperial · Kirkaldy', source: 'Author diagnostic CSV and performance summary → canonical',
      scope: 'Selected diagnostic curves matched to the author performance summary. Duplicate file formats and other diagnostic protocols are excluded.',
      soh: 'Author diagnostic capacity relative to the first eligible diagnostic capacity.', rul: observedRul},
    {id: 'dataset_37', name: 'HM · Multistage Ageing', source: author,
      scope: 'Incident-screened v7 cycling subset only. The frozen discharge-capacity and recorded-operation definitions are retained.',
      soh: 'Integrated diagnostic discharge capacity relative to nominal capacity. This profile does not use the author charge/discharge mean or an equivalent-full-cycle axis.',
      rul: null,
      unavailable: 'After incident screening, the retained histories have no eligible observed threshold endpoints for point-value RUL evaluation. They remain right-censored under the frozen definition.'},
    {id: 'dataset_38', name: 'ISU / ILCC', source: author,
      scope: 'Selected author diagnostic records. SOH and the timestamp-matched RUL extension use distinct frozen profiles.',
      soh: 'Author reference-test discharge capacity relative to the same cell’s first reference-test capacity.',
      rul: 'Observed reference-capacity threshold events joined to unambiguous ageing-discharge slots. Missing slots retain their positions on the life axis.'},
    {id: 'dataset_41', name: 'HUST', source: author,
      scope: 'Selected source cycling histories, with separate relative-capacity and author-reported remaining-life tracks.',
      soh: 'Source discharge-capacity proxy relative to the same cell’s first value; this is not a nominal-capacity SOH claim.',
      rul: 'Native author-reported remaining cycle counts. The author endpoint is kept separate from a locally observed capacity-threshold event.'}
  ];
  const root = document.getElementById('published-benchmarks');
  const button = document.getElementById('pbr-preview-play');
  if (!root || !button) return;
  const datasetSelect = document.getElementById('pbr-dataset');
  const taskSelect = document.getElementById('pbr-task');
  const figures = [...root.querySelectorAll('[data-pbr-task]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let animations = [], started = false, inView = false;
  datasets.forEach(dataset => datasetSelect.add(new Option(`${dataset.id.replace('dataset_', '')} · ${dataset.name}`, dataset.id)));
  function text(id, value) {document.getElementById(id).textContent = value;}
  function render() {
    animations.forEach(a => {a.onfinish = null; a.cancel();});
    animations = []; started = false;
    const dataset = datasets.find(d => d.id === datasetSelect.value);
    const isSoh = taskSelect.value === 'soh_estimation';
    const definition = isSoh ? dataset.soh : dataset.rul;
    const available = Boolean(definition);
    text('pbr-selection-title', dataset.name);
    text('pbr-task-name', isSoh ? 'SOH estimation' : 'RUL prediction');
    text('pbr-status', available ? 'Experiments completed · Results withheld' : 'Point-value RUL unavailable');
    document.getElementById('pbr-status').dataset.state = available ? 'completed' : 'unavailable';
    text('pbr-source', dataset.source);
    text('pbr-scope-note', dataset.scope);
    text('pbr-task-note', definition || dataset.unavailable);
    text('pbr-unavailable-note', dataset.unavailable || '');
    document.getElementById('pbr-models').hidden = !available;
    document.getElementById('pbr-unavailable').hidden = available;
    document.getElementById('pbr-preview-controls').hidden = !available;
    document.getElementById('pbr-illustration-note').hidden = !available;
    figures.forEach(figure => {figure.hidden = !available || figure.dataset.pbrTask !== taskSelect.value;});
    button.disabled = !available;
    button.textContent = 'Play illustration'; button.setAttribute('aria-pressed', 'false');
    if (available && inView && !reducedMotion.matches && !document.hidden) toggle();
  }
  function pause() {
    const running = animations.some(a => a.playState === 'running');
    animations.forEach(a => {if (a.playState === 'running') a.pause();});
    if (running) {button.textContent = 'Resume illustration'; button.setAttribute('aria-pressed', 'false');}
  }
  function toggle() {
    if (button.disabled) return;
    if (animations.some(a => a.playState === 'running')) {pause(); return;}
    started = true;
    if (animations.some(a => a.playState === 'paused')) animations.forEach(a => a.play());
    else {
      animations.forEach(a => a.cancel());
      const paths = figures.filter(figure => !figure.hidden).flatMap(figure => [...figure.querySelectorAll('.pbr-preview-line')]);
      animations = paths.map(path => path.animate([
        {strokeDasharray: '1', strokeDashoffset: '1'},
        {strokeDasharray: '1', strokeDashoffset: '0'}
      ], {duration: 7000, fill: 'forwards', easing: 'linear'}));
      animations[0].onfinish = () => {button.textContent = 'Replay illustration'; button.setAttribute('aria-pressed', 'false');};
    }
    button.textContent = 'Pause illustration'; button.setAttribute('aria-pressed', 'true');
  }
  datasetSelect.addEventListener('change', render);
  taskSelect.addEventListener('change', render);
  render();
  button.addEventListener('click', toggle);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (!inView) pause();
    else if (!started && !reducedMotion.matches && !document.hidden) toggle();
  }, {threshold: .25}).observe(document.getElementById('pbr-previews'));
  reducedMotion.addEventListener('change', () => {if (reducedMotion.matches) pause();});
  document.addEventListener('visibilitychange', () => {if (document.hidden) pause();});
  new MutationObserver(() => {
    if (!document.getElementById('page-benchmarks').classList.contains('active')) pause();
  }).observe(document.getElementById('page-benchmarks'), {attributes: true, attributeFilter: ['class']});
})();
