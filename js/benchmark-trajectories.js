/* Animate real saved predictions; no synthetic degradation curves. */
(() => {
  'use strict';
  const panel = document.getElementById('pbt-panel');
  if (!panel) return;
  const el = id => document.getElementById('pbt-' + id);
  const make = (tag, text) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n;};
  const svgNode = (tag, attrs = {}, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const format = n => n === 0 ? '0' : Math.abs(n) >= 10000 || Math.abs(n) < .001
    ? n.toExponential(2) : n.toLocaleString('en-US', {maximumSignificantDigits: 5});
  const unit = text => text.replaceAll('_', ' ');
  const key = c => ['case_id', 'task', 'variant', 'protocol', 'target_unit'].map(k => c[k]).join('|');
  const base = new URL('assets/data/benchmark-results/trajectories/', document.baseURI);
  let current, index, curves, request, pending, revision = 0, frame = 0, startTime = null, startPosition = 0;
  let geometry, clip, cursor, dots = [], position = 0, autoPlayed = false, visible = false;
  const cache = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function pause() {
    cancelAnimationFrame(frame); frame = 0; startTime = null;
    el('play').textContent = 'Play'; el('play').setAttribute('aria-pressed', 'false');
  }
  function setOptions(id, options, fallback) {
    const select = el(id), old = select.value;
    select.replaceChildren(...options.map(([v, label]) => {const n = make('option', label); n.value = v; return n;}));
    select.disabled = !options.length;
    select.value = options.some(x => x[0] === old) ? old : options.some(x => x[0] === fallback) ? fallback : options[0]?.[0] || '';
  }
  async function getJSON(url, signal) {
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error('Unavailable curve data');
    return response.json();
  }
  async function load(detail) {
    const token = ++revision;
    pause(); request?.abort(); request = new AbortController(); curves = null;
    current = detail; el('body').hidden = true; el('state').hidden = false; el('retry').hidden = true;
    setOptions('cell', []); setOptions('model', []); el('raw').disabled = true;
    panel.querySelectorAll('[data-pbt-task]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pbtTask === detail.task)));
    if (!detail.condition) {
      el('state').textContent = detail.task === 'rul_prediction' ? 'No eligible point-value RUL trajectory in this scope. Censored records are not given invented endpoints.' : 'No saved prediction trajectory for this condition.';
      return;
    }
    el('state').textContent = 'Loading verified test predictions…';
    try {
      if (!index) {
        const loaded = await getJSON(new URL('index.json', base), request.signal);
        if (token !== revision) return;
        if (loaded.schema_version !== 1 || loaded.seed !== 0) throw new Error('Unsupported curve snapshot');
        index = loaded;
      }
      const entry = index.conditions.find(c => key(c) === key(detail.condition));
      if (!entry) throw new Error('Curve condition missing');
      const loaded = cache.get(entry.file) || await getJSON(new URL(entry.file, base), request.signal);
      if (token !== revision) return;
      if (key(loaded) !== key(detail.condition) || loaded.seed !== 0 || !loaded.cells?.length) throw new Error('Curve identity mismatch');
      cache.set(entry.file, loaded);
      if (cache.size > 8) cache.delete(cache.keys().next().value);
      curves = loaded;
      setOptions('model', Object.entries(detail.models), 'cnn');
      setOptions('cell', curves.cells.map(c => [c.id, c.id]));
      el('body').hidden = false; el('state').hidden = true;
      draw();
      maybeAutoplay();
    } catch (error) {
      if (token !== revision || error.name === 'AbortError') return;
      el('state').textContent = 'Prediction curves could not be loaded. The metric table remains available.';
      el('retry').hidden = false;
    }
  }
  function cell() {return curves?.cells.find(c => c.id === el('cell').value);}
  function draw() {
    pause();
    const c = cell(); if (!c) return;
    const model = el('model').value, predicted = c.predictions[model];
    const raw = c.raw_predictions[model];
    el('raw').disabled = !raw;
    if (!raw) el('raw').checked = false;
    el('raw-key').hidden = !el('raw').checked;
    const width = panel.clientWidth < 600 ? 420 : 960, height = 380;
    const left = 72, right = width - 26, top = 70, bottom = height - 68;
    const style = getComputedStyle(panel);
    const color = name => style.getPropertyValue(name).trim();
    const allY = [...c.truth, ...predicted, ...(el('raw').checked ? raw : [])];
    let lo = Math.min(...allY), hi = Math.max(...allY);
    const padding = (hi - lo || Math.max(Math.abs(hi), 1)) * .08; lo -= padding; hi += padding;
    const xmin = c.axis[0], xmax = c.axis[c.axis.length - 1];
    const x = v => left + (v - xmin) / (xmax - xmin || 1) * (right - left);
    const y = v => bottom - (v - lo) / (hi - lo) * (bottom - top);
    geometry = {x, y, left, right, top, bottom};
    const svg = svgNode('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'pbt-svg-title pbt-svg-desc', xmlns: 'http://www.w3.org/2000/svg', style: 'font-family:Arial,sans-serif'});
    svg.append(svgNode('title', {id: 'pbt-svg-title'}, `${curves.task === 'soh_estimation' ? 'SOH' : 'RUL'} reference target and ${current.models[model]} prediction for ${c.id}`));
    svg.append(svgNode('desc', {id: 'pbt-svg-desc'}, `Seed 0, processed test predictions. ${curves.case_id}; ${curves.variant}; ${curves.protocol}. ${c.plotted_points} displayed recorded points from ${c.total_test_points} eligible test observations. Lines connect recorded anchors; intermediate observations are not inferred.`));
    svg.append(svgNode('rect', {width, height, fill: color('--surface')}));
    const task = curves.task === 'soh_estimation' ? 'SOH estimation' : 'RUL prediction';
    svg.append(svgNode('text', {x: left, y: 24, fill: color('--text1'), 'font-size': 15, 'font-weight': 600}, task + ' · ' + current.models[model] + ' · seed 0'));
    const longCell = c.id.length > (width < 600 ? 48 : 95) ? c.id.slice(0, width < 600 ? 45 : 92) + '…' : c.id;
    svg.append(svgNode('text', {x: left, y: 44, fill: color('--text3'), 'font-size': 11}, `${longCell} · ${curves.protocol} · ${curves.variant}`));
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4, yy = y(v);
      svg.append(svgNode('line', {x1: left, x2: right, y1: yy, y2: yy, stroke: color('--border'), 'stroke-width': 1}));
      svg.append(svgNode('text', {x: left - 10, y: yy + 4, 'text-anchor': 'end', fill: color('--text3'), 'font-size': 12}, format(v)));
      const xx = left + (right - left) * i / 4;
      svg.append(svgNode('text', {x: xx, y: bottom + 22, 'text-anchor': 'middle', fill: color('--text3'), 'font-size': 12}, format(xmin + (xmax - xmin) * i / 4)));
    }
    svg.append(svgNode('text', {x: (left + right) / 2, y: height - 17, 'text-anchor': 'middle', fill: color('--text2'), 'font-size': width < 600 ? 10 : 12}, 'Life axis: ' + unit(curves.axis_unit)));
    svg.append(svgNode('text', {x: left, y: top - 8, fill: color('--text2'), 'font-size': 11}, curves.target_unit === 'SOH ratio' ? 'SOH (ratio)' : 'RUL (' + unit(curves.target_unit) + ')'));
    const defs = svgNode('defs'), clipPath = svgNode('clipPath', {id: 'pbt-curve-clip'});
    clip = svgNode('rect', {x: left - 3, y: top - 5, width: right - left + 6, height: bottom - top + 10});
    clipPath.append(clip); defs.append(clipPath); svg.append(defs);
    const layer = svgNode('g', {'clip-path': 'url(#pbt-curve-clip)'});
    const series = [[c.truth, '#0d9488', 'pbt-truth-path', ''], [predicted, '#2563eb', 'pbt-pred-path', '']];
    if (el('raw').checked) series.push([raw, '#d97706', 'pbt-raw-path', '7 5']);
    for (const [values, stroke, id, dash] of series) {
      const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(c.axis[i]).toFixed(3)},${y(v).toFixed(3)}`).join(' ');
      layer.append(svgNode('path', {id, d, fill: 'none', stroke, 'stroke-width': 2.4, 'stroke-dasharray': dash, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}));
    }
    svg.append(layer);
    cursor = svgNode('line', {x1: right, x2: right, y1: top, y2: bottom, stroke: color('--text4'), 'stroke-dasharray': '3 4'}); svg.append(cursor);
    dots = series.map(([values, color]) => {
      const dot = svgNode('circle', {r: 4.5, fill: color, stroke: color, 'stroke-width': 1}); svg.append(dot); return {dot, values};
    });
    el('figure').replaceChildren(svg);
    el('position').max = String(c.axis.length - 1); el('play').disabled = c.axis.length < 2;
    const thirdParty = current.profile?.source_reference === 'third_party_processed_copy';
    el('note').textContent = `Illustration only · seed 0 · ${c.plotted_points} of ${c.total_test_points} eligible test observations shown${c.total_test_points > c.plotted_points ? ' (equally spaced record selection, no smoothing)' : ''}. Up to three test cells are selected by a fixed identity hash, not by prediction quality. Replay reveals saved observations; it does not run inference. ${thirdParty ? 'Raw-A is the BatteryLife processed copy. ' : ''}${raw ? 'Coincident raw/processed lines indicate equal displayed predictions. ' : ''}The table reports all eligible test cells and five seeds.`;
    seek(c.axis.length - 1);
  }
  function seek(value) {
    const c = cell(); if (!c || !geometry) return;
    position = Math.max(0, Math.min(c.axis.length - 1, Math.floor(value)));
    const xx = geometry.x(c.axis[position]);
    clip.setAttribute('width', String(xx - geometry.left + 6));
    cursor.setAttribute('x1', xx); cursor.setAttribute('x2', xx);
    dots.forEach(({dot, values}) => {dot.setAttribute('cx', xx); dot.setAttribute('cy', geometry.y(values[position]));});
    el('position').value = String(position);
    el('position').setAttribute('aria-valuetext', `Recorded point ${position + 1} of ${c.axis.length}; life axis ${c.axis[position]}`);
    el('counter').textContent = `${position + 1} / ${c.axis.length}`;
    el('readout').replaceChildren(...[`Life axis ${format(c.axis[position])}`, `Reference ${format(c.truth[position])}`, `Predicted ${format(c.predictions[el('model').value][position])}`].map(t => make('span', t)));
  }
  function play() {
    const c = cell(); if (!c || c.axis.length < 2) return;
    if (frame) {pause(); return;}
    if (position >= c.axis.length - 1) seek(0);
    startPosition = position; startTime = null;
    el('play').textContent = 'Pause'; el('play').setAttribute('aria-pressed', 'true');
    function tick(time) {
      if (startTime === null) startTime = time;
      const elapsed = (time - startTime) / 10000;
      seek(startPosition + elapsed * (c.axis.length - 1));
      if (position >= c.axis.length - 1) pause();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function maybeAutoplay() {
    if (!autoPlayed && visible && curves && !reducedMotion.matches && !document.hidden) {autoPlayed = true; play();}
  }
  function update(detail) {
    clearTimeout(pending); pause(); request?.abort(); ++revision;
    current = detail; curves = null; el('body').hidden = true; el('state').hidden = false;
    el('state').textContent = 'Loading verified test predictions…';
    pending = setTimeout(() => load(detail), 100);
  }
  document.addEventListener('batterylake:benchmark-condition', e => update(e.detail));
  el('model').addEventListener('change', draw); el('cell').addEventListener('change', draw); el('raw').addEventListener('change', draw);
  el('play').addEventListener('click', play);
  el('reset').addEventListener('click', () => {pause(); seek(0);});
  el('position').addEventListener('input', () => {pause(); seek(Number(el('position').value));});
  el('retry').addEventListener('click', () => load(current));
  panel.querySelectorAll('[data-pbt-task]').forEach(button => button.addEventListener('click', () => {
    const target = document.getElementById('pbr-task'); target.value = button.dataset.pbtTask; target.dispatchEvent(new Event('change'));
  }));
  el('download').addEventListener('click', () => {
    if (!curves) return;
    pause(); seek(cell().axis.length - 1);
    const clone = el('figure').querySelector('svg').cloneNode(true);
    // Include the legend in the standalone image, with no external CSS required.
    const box = clone.getAttribute('viewBox').split(' ').map(Number);
    clone.setAttribute('viewBox', `0 0 ${box[2]} ${box[3] + 30}`);
    clone.setAttribute('width', box[2]); clone.setAttribute('height', box[3] + 30);
    const bg = getComputedStyle(panel).getPropertyValue('--surface').trim();
    clone.append(svgNode('rect', {x: 0, y: box[3], width: box[2], height: 30, fill: bg}));
    const legend = [['Reference', '#0d9488'], ['Processed', '#2563eb']];
    if (el('raw').checked) legend.push(['Raw-A', '#d97706']);
    legend.forEach(([label, fill], i) => clone.append(svgNode('text', {x: 72 + i * 135, y: box[3] + 20, fill, 'font-size': 12}, '━ ' + label)));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob), a = make('a'); a.href = url;
    a.download = `${curves.case_id}-${curves.task}-${el('model').value}-seed0.svg`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.addEventListener('visibilitychange', () => {if (document.hidden) pause();});
  const page = document.getElementById('page-benchmarks');
  new MutationObserver(() => {if (!page.classList.contains('active')) pause();}).observe(page, {attributes: true, attributeFilter: ['class']});
  new MutationObserver(() => {if (curves) draw();}).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  new IntersectionObserver(entries => {visible = entries[0].isIntersecting; if (!visible) pause(); else maybeAutoplay();}, {threshold: .15}).observe(panel);
  let resizeTimer;
  window.addEventListener('resize', () => {clearTimeout(resizeTimer); resizeTimer = setTimeout(() => {if (curves) draw();}, 100);});
  if (window.BatteryLakePublishedCondition) update(window.BatteryLakePublishedCondition);
})();
