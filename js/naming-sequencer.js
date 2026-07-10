(() => {
  const root = document.getElementById('naming-sequencer');
  if (!root) return;

  const cards = Array.from(root.querySelectorAll('.naming-part[data-field-index]'));
  const segments = Array.from(root.querySelectorAll('.pattern-token[data-field-index]'));
  const status = document.getElementById('naming-sequencer-status');
  const signal = document.getElementById('naming-sequencer-signal');
  const positions = ['5%', '20%', '35%', '50%', '65%', '80%', '94%'];
  const colors = ['#b86606', '#2563eb', '#0b8a7d', '#7040c7', '#1d4ed8', '#0277a9', '#c64f3b'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let paused = false;

  function setNamingField(index) {
    activeIndex = index;
    cards.forEach((card, itemIndex) => card.classList.toggle('is-active', itemIndex === index));
    segments.forEach((segment, itemIndex) => segment.classList.toggle('is-active', itemIndex === index));
    status.textContent = `Field ${index + 1} of 7`;
    root.style.setProperty('--signal-position', positions[index]);
    root.style.setProperty('--signal-color', colors[index]);
    signal.dataset.fieldIndex = String(index);
  }

  cards.forEach((card) => {
    const index = Number(card.dataset.fieldIndex);
    card.addEventListener('pointerenter', () => { paused = true; setNamingField(index); });
    card.addEventListener('pointerleave', () => { paused = false; });
    card.addEventListener('focus', () => { paused = true; setNamingField(index); });
    card.addEventListener('blur', () => { paused = false; });
  });

  setNamingField(0);
  if (!reducedMotion) {
    window.setInterval(() => {
      if (!paused) setNamingField((activeIndex + 1) % cards.length);
    }, 1100);
  }
})();
