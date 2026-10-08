/* Particle ribbons for the illustrative Studio calibration cycle. */
(function () {
  'use strict';
  const map = document.querySelector('#page-studio .studio-calibration-map');
  if (!map) return;
  const canvas = map.querySelector('.studio-particle-flow');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const visuals = ['.studio-data-visual', '.studio-model-visual', '.studio-fit-preview']
    .map(selector => map.querySelector(selector));
  const timingNode = map.querySelector('.studio-dataset-picked');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#27b6a8', '#36c4e3', '#3b9bf1', '#686de9', '#a27be8'];
  const endLanes = [1, 0, 3, 4, 2];
  const waves = [
    { from: 0, to: 1, start: .10, end: .21 },
    { from: 1, to: 2, start: .32, end: .43 },
    { from: 0, to: 1, start: .57, end: .68 },
    { from: 1, to: 2, start: .75, end: .86 }
  ];
  let visible = false;
  let frame = 0;
  let geometry = [];
  let fallbackStart = performance.now();
  const random = seed => {
    const value = Math.sin(seed * 127.1 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  const point = (curve, t) => {
    const k = 1 - t;
    return {
      x: k*k*k*curve[0].x + 3*k*k*t*curve[1].x + 3*k*t*t*curve[2].x + t*t*t*curve[3].x,
      y: k*k*k*curve[0].y + 3*k*k*t*curve[1].y + 3*k*t*t*curve[2].y + t*t*t*curve[3].y
    };
  };
  function measure() {
    const bounds = map.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const rects = visuals.map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left - bounds.left, right: rect.right - bounds.left,
        top: rect.top - bounds.top, bottom: rect.bottom - bounds.top,
        width: rect.width, height: rect.height };
    });
    const vertical = rects[1].top > rects[0].bottom;
    geometry = waves.map(wave => Array.from({ length: 5 }, (_, lane) => {
      const from = rects[wave.from];
      const to = rects[wave.to];
      const a = .27 + lane * .115;
      const b = .27 + endLanes[lane] * .115;
      if (vertical) {
        const start = { x: from.left + from.width * a, y: from.bottom - 28 };
        const end = { x: to.left + to.width * b, y: to.top + 28 };
        const reach = (end.y - start.y) * .43;
        return [start, { x: start.x + (lane - 2) * 10, y: start.y + reach },
          { x: end.x - (lane - 2) * 10, y: end.y - reach }, end];
      }
      const start = { x: from.left + from.width * .38, y: from.top + from.height * a };
      const end = { x: to.left + to.width * .62, y: to.top + to.height * b };
      const reach = (end.x - start.x) * .43;
      return [start, { x: start.x + reach, y: start.y + (lane - 2) * 7 },
        { x: end.x - reach, y: end.y - (lane - 2) * 7 }, end];
    }));
    if (reducedMotion.matches) drawStatic();
  }
  function drawRibbon(curve, color, progress, alpha) {
    ctx.beginPath();
    for (let step = 0; step <= 24; step++) {
      const p = point(curve, progress * step / 24);
      if (step) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function drawWave(index, progress, staticView) {
    const fade = staticView ? 1 : Math.min(1, progress * 8, (1 - progress) * 9);
    if (fade <= 0) return;
    const curves = geometry[index];
    curves.forEach((curve, lane) => {
      drawRibbon(curve, colors[lane], staticView ? 1 : Math.min(1, progress * 1.4),
        staticView ? .11 : .18 * fade);
      for (let i = 0; i < 19; i++) {
        const seed = index * 113 + lane * 29 + i;
        const delay = random(seed + 1) * .62;
        const travel = .27 + random(seed + 2) * .17;
        const t = staticView ? random(seed + 3) : (progress - delay) / travel;
        if (t < 0 || t > 1) continue;
        const p = point(curve, t);
        const spread = (random(seed + 4) - .5) * 10;
        const radius = 1.1 + random(seed + 5) * 1.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y + spread, radius, 0, Math.PI * 2);
        ctx.fillStyle = colors[lane];
        ctx.globalAlpha = staticView ? .15 + random(seed + 6) * .2
          : fade * (.38 + random(seed + 6) * .58);
        ctx.shadowColor = colors[lane];
        ctx.shadowBlur = 5;
        ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  function drawStatic() {
    if (!geometry.length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWave(0, .55, true);
    drawWave(1, .55, true);
  }
  function currentPhase() {
    const animation = timingNode.getAnimations && timingNode.getAnimations()[0];
    const time = animation && animation.currentTime != null
      ? Number(animation.currentTime) : performance.now() - fallbackStart;
    return ((time % 20000) + 20000) % 20000 / 20000;
  }
  function tick() {
    if (!visible || document.hidden || reducedMotion.matches) { frame = 0; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWave(0, .55, true);
    drawWave(1, .55, true);
    const phase = currentPhase();
    waves.forEach((wave, index) => {
      if (phase >= wave.start && phase <= wave.end) {
        drawWave(index, (phase - wave.start) / (wave.end - wave.start), false);
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
