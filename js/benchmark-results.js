/* Concept illustration only. Never fetch unpublished research results. */
(() => {
  'use strict';
  const root = document.getElementById('published-benchmarks');
  const button = document.getElementById('pbr-preview-play');
  if (!root || !button) return;
  const paths = [...root.querySelectorAll('.pbr-preview-line')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let animations = [], started = false;
  function pause() {
    const running = animations.some(a => a.playState === 'running');
    animations.forEach(a => {if (a.playState === 'running') a.pause();});
    if (running) {button.textContent = 'Resume illustration'; button.setAttribute('aria-pressed', 'false');}
  }
  function toggle() {
    if (animations.some(a => a.playState === 'running')) {pause(); return;}
    started = true;
    if (animations.some(a => a.playState === 'paused')) animations.forEach(a => a.play());
    else {
      animations.forEach(a => a.cancel());
      animations = paths.map(path => path.animate([
        {strokeDasharray: '1', strokeDashoffset: '1'},
        {strokeDasharray: '1', strokeDashoffset: '0'}
      ], {duration: 7000, fill: 'forwards', easing: 'linear'}));
      animations[0].onfinish = () => {button.textContent = 'Replay illustration'; button.setAttribute('aria-pressed', 'false');};
    }
    button.textContent = 'Pause illustration'; button.setAttribute('aria-pressed', 'true');
  }
  button.addEventListener('click', toggle);
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) pause();
    else if (!started && !reducedMotion.matches && !document.hidden) toggle();
  }, {threshold: .25}).observe(root);
  document.addEventListener('visibilitychange', () => {if (document.hidden) pause();});
  new MutationObserver(() => {
    if (!document.getElementById('page-benchmarks').classList.contains('active')) pause();
  }).observe(document.getElementById('page-benchmarks'), {attributes: true, attributeFilter: ['class']});
})();
