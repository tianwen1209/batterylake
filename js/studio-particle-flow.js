/* Smooth particle bands timed to the Studio calibration cycle. */
(function () {
  'use strict';
  const map = document.querySelector('#page-studio .studio-calibration-map');
  if (!map) return;
  const canvas = map.querySelector('.studio-particle-flow');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const visuals = ['.studio-data-visual', '.studio-model-visual', '.studio-fit-preview',
    '.studio-validation-visual', '.studio-generation-visual']
    .map(selector => map.querySelector(selector));
  const feedback = map.querySelector('.studio-feedback');
  const timingNode = map.querySelector('.studio-dataset-picked');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = {
    data: '#28b7a9', model: '#3b9bf1', validation: '#e69b55',
    feedback: '#a478e6', output: '#2cba88'
  };
  const waves = [
    { from: 0, to: 1, start: .08, end: .16, kind: 'data' },
    { from: 1, to: 2, start: .24, end: .32, kind: 'model' },
    { from: 2, to: 3, start: .40, end: .47, kind: 'validation' },
    { from: 3, to: 2, start: .48, end: .55, kind: 'feedback' },
    { from: 0, to: 1, start: .56, end: .63, kind: 'data' },
    { from: 1, to: 2, start: .70, end: .78, kind: 'model' },
    { from: 2, to: 3, start: .85, end: .89, kind: 'validation' },
    { from: 3, to: 4, start: .90, end: .95, kind: 'output' }
  ];
  let visible = false;
  let frame = 0;
  let geometry = [];
  let fallbackStart = performance.now();
  const centerX = rect => (rect.left + rect.right) / 2;
  const centerY = rect => (rect.top + rect.bottom) / 2;
  const noise = seed => {
    const value = Math.sin(seed * 127.1 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  function measure() {
    const bounds = map.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const rects = visuals.map(node => {
      const rect = node.closest('.studio-process-node').getBoundingClientRect();
      return { left: rect.left - bounds.left, right: rect.right - bounds.left,
        top: rect.top - bounds.top, bottom: rect.bottom - bounds.top,
        width: rect.width, height: rect.height };
    });
    const feedbackRect = feedback.getBoundingClientRect();
    const returnPath = { left: feedbackRect.left - bounds.left, right: feedbackRect.right - bounds.left,
      top: feedbackRect.top - bounds.top, bottom: feedbackRect.bottom - bounds.top,
      width: feedbackRect.width, height: feedbackRect.height };
    const vertical = rects[1].top > rects[0].bottom;
    geometry = waves.map(wave => {
      const from = rects[wave.from];
      const to = rects[wave.to];
      if (wave.kind === 'feedback') {
        if (vertical) {
          const outerX = bounds.width - 12;
          return { type: 'return', width: 22, points: [
            { x: from.right - 5, y: centerY(from) },
            { x: outerX, y: centerY(from) },
            { x: outerX, y: centerY(to) },
            { x: to.right - 5, y: centerY(to) }
          ] };
        }
        const lowerY = returnPath.top + returnPath.height * .6;
        return { type: 'return', width: 22, points: [
          { x: centerX(from), y: from.bottom - 5 },
          { x: centerX(from), y: lowerY },
          { x: centerX(to), y: lowerY },
          { x: centerX(to), y: to.bottom - 5 }
        ] };
      }
      if (vertical) {
        return { type: 'straight', vertical: true, x: (centerX(from) + centerX(to)) / 2,
          start: from.bottom - 5, end: to.top + 5, width: 68, bend: wave.from % 2 ? -7 : 7 };
      }
      return { type: 'straight', vertical: false, y: (centerY(from) + centerY(to)) / 2,
        start: from.right - 5, end: to.left + 5, width: 56, bend: wave.from % 2 ? -7 : 7 };
    });
    if (reducedMotion.matches) drawStatic();
  }
  function bandPoint(shape, t, offset) {
    const length = shape.end - shape.start;
    const wave = shape.bend * Math.sin(Math.PI * t);
    const displacement = offset * shape.width / 2;
    return shape.vertical
      ? { x: shape.x + wave + displacement, y: shape.start + length * t }
      : { x: shape.start + length * t, y: shape.y + wave + displacement };
  }
  function drawChannel(shape, color) {
    ctx.fillStyle = color;
    if (shape.type === 'straight') {
      ctx.beginPath();
      for (let step = 0; step <= 30; step++) {
        const p = bandPoint(shape, step / 30, 1);
        step ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      for (let step = 30; step >= 0; step--) {
        const p = bandPoint(shape, step / 30, -1);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.globalAlpha = .28;
      ctx.fill();
    } else {
      ctx.beginPath();
      shape.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.globalAlpha = .58;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }
  function pointOnChannel(shape, t, offset) {
    if (shape.type === 'straight') return bandPoint(shape, t, offset);
    const segments = shape.points.slice(1).map((end, i) => {
      const start = shape.points[i];
      return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
    });
    let distance = t * segments.reduce((sum, segment) => sum + segment.length, 0);
    for (const segment of segments) {
      if (distance <= segment.length) {
        const dx = (segment.end.x - segment.start.x) / segment.length;
        const dy = (segment.end.y - segment.start.y) / segment.length;
        return { x: segment.start.x + dx * distance - dy * offset * shape.width * .38,
          y: segment.start.y + dy * distance + dx * offset * shape.width * .38 };
      }
      distance -= segment.length;
    }
    return shape.points[shape.points.length - 1];
  }
  function drawParticles(index, progress) {
    const shape = geometry[index];
    const color = colors[waves[index].kind];
    const earlyData = waves[index].kind === 'data' || waves[index].kind === 'model';
    const count = earlyData ? 58 : 34;
    const travel = earlyData ? .42 : .58;
    for (let i = 0; i < count; i++) {
      const seed = index * 101 + i * 7;
      const delay = noise(seed) * .28;
      const t = (progress - delay) / travel;
      if (t < 0 || t > 1) continue;
      const offset = (noise(seed + 2) - .5) * 1.55;
      const p = pointOnChannel(shape, t, offset);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.15 + noise(seed + 3) * 1.45, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = .75 + noise(seed + 4) * .25;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawFeedbackSignal(progress) {
    const shape = geometry[3];
    const head = (progress - .04) / .78;
    for (let i = 0; i < 3; i++) {
      const t = head - i * .035;
      if (t < 0 || t > 1) continue;
      const p = pointOnChannel(shape, t, 0);
      const before = pointOnChannel(shape, Math.max(0, t - .004), 0);
      const after = pointOnChannel(shape, Math.min(1, t + .004), 0);
      const angle = Math.atan2(after.y - before.y, after.x - before.x);
      ctx.beginPath();
      ctx.moveTo(p.x - 7 * Math.cos(angle - .65), p.y - 7 * Math.sin(angle - .65));
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x - 7 * Math.cos(angle + .65), p.y - 7 * Math.sin(angle + .65));
      ctx.strokeStyle = colors.feedback;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1 - i * .23;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawStatic() {
    if (!geometry.length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    [0, 1, 2, 3, 7].forEach(index => drawChannel(geometry[index], colors[waves[index].kind]));
  }
  function currentPhase() {
    const animation = timingNode.getAnimations && timingNode.getAnimations()[0];
    const time = animation && animation.currentTime != null
      ? Number(animation.currentTime) : performance.now() - fallbackStart;
    return ((time % 36000) + 36000) % 36000 / 36000;
  }
  function tick() {
    if (!visible || document.hidden || reducedMotion.matches) { frame = 0; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const phase = currentPhase();
    [0, 1, 2, 3, 7].forEach(index => drawChannel(geometry[index], colors[waves[index].kind]));
    waves.forEach((wave, index) => {
      if (phase >= wave.start && phase <= wave.end) {
        const progress = (phase - wave.start) / (wave.end - wave.start);
        if (wave.kind === 'feedback') drawFeedbackSignal(progress);
        else drawParticles(index, progress);
      }
    });
    frame = requestAnimationFrame(tick);
  }
  function update() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    measure();
    if (visible && !document.hidden && !reducedMotion.matches) tick();
  }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) update();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  });
  observer.observe(map);
  new ResizeObserver(update).observe(map);
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
})();
