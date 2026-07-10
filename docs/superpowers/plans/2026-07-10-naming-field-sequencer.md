# Naming Field Sequencer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Naming Standard format panel with the approved light digital-laboratory field sequencer, including synchronized field motion, equal-size centered cards, accessible focus behavior, and responsive layouts.

**Architecture:** Keep the existing single-page static application. Replace only the `naming-formula` markup in `index.html`, append a final scoped override block to `styles/polish.css`, and isolate behavior in a new `js/naming-sequencer.js` IIFE that binds to `#naming-sequencer`. A dependency-free Python `unittest` file provides a static component contract before browser QA.

**Tech Stack:** HTML5, CSS custom properties and media queries, vanilla JavaScript, Python 3 standard-library `unittest`.

## Global Constraints

- The change is limited to the selected `Format Pattern` panel on `#page-naming`.
- Use the existing `Noto Sans` for interface text and `Source Code Pro` only for assembled names and examples.
- Use natural title case for interface labels; uppercase remains only in real dataset syntax and abbreviations.
- Use exact sizes: 23 px panel title, 16 px assembled example, 15 px field names, 14 px descriptions, and 13 px status and example text.
- Desktop layout is four equal cards followed by three equal cards centered as a group; tablet is two columns; mobile is one column.
- Automatic field stepping, hover/focus pause, synchronized preview/card/status/signal updates, dark mode, and reduced-motion behavior are required.
- Do not add images, icon libraries, fonts, routes, dependencies, or backend behavior.

---

## File Structure

- `index.html`: semantic component markup plus the script include.
- `styles/polish.css`: final scoped visual and responsive overrides for `#naming-sequencer`.
- `js/naming-sequencer.js`: field sequencing and hover/focus synchronization only.
- `tests/test_naming_sequencer.py`: static contract for required markup, styling hooks, and script behavior.

### Task 1: Add The Failing Component Contract

**Files:**
- Create: `tests/test_naming_sequencer.py`

**Interfaces:**
- Consumes: the existing `index.html` and `styles/polish.css` files.
- Produces: assertions for `#naming-sequencer`, fourteen `data-field-index` hooks, seven natural-case labels, the script include, responsive/reduced-motion CSS, and the JavaScript synchronization contract.

- [ ] **Step 1: Create the static contract test**

```python
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class NamingSequencerContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.css = (ROOT / "styles" / "polish.css").read_text(encoding="utf-8")
        script = ROOT / "js" / "naming-sequencer.js"
        cls.js = script.read_text(encoding="utf-8") if script.exists() else ""

    def test_markup_has_seven_preview_segments_and_seven_cards(self):
        self.assertIn('id="naming-sequencer"', self.html)
        self.assertEqual(self.html.count('data-field-index="'), 14)
        for label in (
            "Year",
            "Source",
            "Chemistry",
            "Form factor",
            "Charge rate",
            "Discharge rate",
            "Temperature",
        ):
            self.assertIn(f'<span class="naming-part-key">{label}</span>', self.html)

    def test_real_reference_example_and_script_are_present(self):
        self.assertIn("2007_NASA_PCoE_LCO_18650_1C_1C_25T", self.html)
        self.assertIn('<script src="js/naming-sequencer.js"></script>', self.html)

    def test_styles_cover_centered_cards_and_motion_preferences(self):
        self.assertRegex(self.css, r"#naming-sequencer\s+\.naming-parts\s*\{[^}]*justify-content:\s*center")
        self.assertIn("flex: 0 1 calc((100% - 33px) / 4)", self.css)
        self.assertIn("@media (prefers-reduced-motion: reduce)", self.css)
        self.assertIn("[data-theme=\"dark\"] #naming-sequencer", self.css)

    def test_script_synchronizes_status_signal_preview_and_cards(self):
        for marker in (
            "naming-sequencer-status",
            "naming-sequencer-signal",
            "is-active",
            "pointerenter",
            "focus",
            "prefers-reduced-motion: reduce",
        ):
            self.assertIn(marker, self.js)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```bash
python3 -m unittest tests/test_naming_sequencer.py -v
```

Expected: four failing tests because `#naming-sequencer`, the new script include, final CSS hooks, and `js/naming-sequencer.js` do not exist yet.

### Task 2: Implement The Approved Sequencer

**Files:**
- Modify: `index.html:917-939`
- Modify: `index.html:1938-1939`
- Modify: `styles/polish.css` at end of file
- Create: `js/naming-sequencer.js`
- Test: `tests/test_naming_sequencer.py`

**Interfaces:**
- Consumes: existing `--sans`, `--mono`, theme color tokens, `.np-*` field color tokens, and the `#page-naming` layout.
- Produces: `#naming-sequencer`, `#naming-sequencer-status`, `#naming-sequencer-signal`, fourteen matching `data-field-index` values, and `.is-active` state styling consumed by `js/naming-sequencer.js`.

- [ ] **Step 1: Replace the selected HTML block**

Replace `index.html:917-939` with:

```html
    <div class="naming-formula" id="naming-sequencer">
      <div class="naming-formula-head">
        <div>
          <div class="naming-formula-kicker">Format pattern &middot; Connected</div>
          <div class="naming-formula-title">BatteryLake reference name sequencer</div>
        </div>
        <div class="naming-formula-meta">Inspecting <strong id="naming-sequencer-status">Field 1 of 7</strong></div>
      </div>
      <div class="naming-pattern-shell" aria-label="Assembled BatteryLake reference name">
        <div class="naming-pattern-label">Assembled reference name</div>
        <code class="naming-pattern-code">
          <span class="pattern-token np-year" data-field-index="0">2007</span><span class="pattern-sep">_</span><span class="pattern-token np-source" data-field-index="1">NASA_PCoE</span><span class="pattern-sep">_</span><span class="pattern-token np-chem" data-field-index="2">LCO</span><span class="pattern-sep">_</span><span class="pattern-token np-form" data-field-index="3">18650</span><span class="pattern-sep">_</span><span class="pattern-token np-charge" data-field-index="4">1C</span><span class="pattern-sep">_</span><span class="pattern-token np-discharge" data-field-index="5">1C</span><span class="pattern-sep">_</span><span class="pattern-token np-temp" data-field-index="6">25T</span>
        </code>
      </div>
      <div class="naming-signal-track" aria-hidden="true"><span class="naming-signal" id="naming-sequencer-signal"></span></div>
      <div class="naming-parts" aria-label="Field definitions">
        <button class="naming-part np-year" type="button" data-field-index="0"><span class="naming-part-number">01</span><span class="naming-part-key">Year</span><span class="naming-part-desc">Dataset year</span><span class="naming-part-example">2007</span></button>
        <button class="naming-part np-source" type="button" data-field-index="1"><span class="naming-part-number">02</span><span class="naming-part-key">Source</span><span class="naming-part-desc">Lab or institution</span><span class="naming-part-example">NASA_PCoE</span></button>
        <button class="naming-part np-chem" type="button" data-field-index="2"><span class="naming-part-number">03</span><span class="naming-part-key">Chemistry</span><span class="naming-part-desc">Cell chemistry</span><span class="naming-part-example">LFP / NMC</span></button>
        <button class="naming-part np-form" type="button" data-field-index="3"><span class="naming-part-number">04</span><span class="naming-part-key">Form factor</span><span class="naming-part-desc">Cell format</span><span class="naming-part-example">18650 / Pouch</span></button>
        <button class="naming-part np-charge" type="button" data-field-index="4"><span class="naming-part-number">05</span><span class="naming-part-key">Charge rate</span><span class="naming-part-desc">Charging C-rate</span><span class="naming-part-example">1C / MultiC</span></button>
        <button class="naming-part np-discharge" type="button" data-field-index="5"><span class="naming-part-number">06</span><span class="naming-part-key">Discharge rate</span><span class="naming-part-desc">Discharging C-rate</span><span class="naming-part-example">1C / MultiC</span></button>
        <button class="naming-part np-temp" type="button" data-field-index="6"><span class="naming-part-number">07</span><span class="naming-part-key">Temperature</span><span class="naming-part-desc">Test temperature</span><span class="naming-part-example">25T</span></button>
      </div>
      <div class="naming-sequencer-hint"><span><strong>Interaction:</strong> automatic field walkthrough; hover or focus to inspect one field.</span><span>7 fields &middot; underscore-delimited</span></div>
    </div>
```

Add the behavior script immediately after `js/main.js`:

```html
<script src="js/main.js"></script>
<script src="js/naming-sequencer.js"></script>
```

- [ ] **Step 2: Append the final scoped CSS override**

Append to `styles/polish.css`:

```css
/* Naming Standard: approved light digital-laboratory field sequencer. */
#naming-sequencer {
  --signal-position: 5%;
  --signal-color: #b86606;
  padding: 26px;
  border-color: color-mix(in srgb, var(--accent) 15%, var(--border));
  border-radius: 20px;
  background:
    linear-gradient(rgba(37,99,235,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37,99,235,.035) 1px, transparent 1px),
    color-mix(in srgb, var(--surface, #fff) 96%, transparent);
  background-size: 28px 28px, 28px 28px, auto;
  box-shadow: 0 26px 60px -38px rgba(23,52,98,.45), inset 0 1px rgba(255,255,255,.9);
}

#naming-sequencer::before {
  height: 3px;
  background: linear-gradient(90deg, var(--accent), #22d3ee 50%, #2dd4bf);
  box-shadow: 0 2px 14px rgba(34,211,238,.3);
}

#naming-sequencer .naming-formula-head { margin-bottom: 20px; }

#naming-sequencer .naming-formula-kicker {
  gap: 9px;
  color: color-mix(in srgb, var(--accent) 82%, var(--text2));
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}

#naming-sequencer .naming-formula-kicker::before {
  width: 8px;
  height: 8px;
  border: 2px solid var(--surface, #fff);
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34,197,94,.14), 0 0 12px rgba(34,197,94,.38);
}

#naming-sequencer .naming-formula-title {
  margin-top: 6px;
  font-family: var(--sans);
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -.025em;
}

#naming-sequencer .naming-formula-meta {
  min-height: 34px;
  padding: 7px 13px;
  color: var(--text2);
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
}

#naming-sequencer .naming-formula-meta strong { margin-left: 5px; color: var(--accent); font-weight: 800; }

#naming-sequencer .naming-pattern-shell {
  position: relative;
  overflow: hidden;
  padding: 17px 18px 18px;
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
  border-radius: 14px;
  background: linear-gradient(135deg, var(--surface, #fff), color-mix(in srgb, var(--accent-light) 72%, #fff) 62%, color-mix(in srgb, #ccfbf1 45%, var(--surface, #fff)));
}

#naming-sequencer .naming-pattern-shell::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 120px;
  transform: translateX(-190px) skewX(-18deg);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.94), transparent);
  animation: naming-sequencer-scan 4.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes naming-sequencer-scan {
  0%, 52% { transform: translateX(-190px) skewX(-18deg); }
  82%, 100% { transform: translateX(1120px) skewX(-18deg); }
}

#naming-sequencer .naming-pattern-label { color: var(--text3); font-size: 13px; font-weight: 700; }

#naming-sequencer .naming-pattern-code {
  position: relative;
  z-index: 1;
  margin-top: 11px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  font-family: var(--mono);
  font-size: 16px;
  line-height: 1.55;
}

#naming-sequencer .pattern-token {
  min-height: 0;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: var(--text1);
  font-size: 16px;
  font-weight: 600;
  transition: color .22s ease, background .22s ease, box-shadow .22s ease;
}

#naming-sequencer .pattern-token.is-active {
  color: var(--token-color);
  background: color-mix(in srgb, var(--token-color) 11%, var(--surface, #fff));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--token-color) 9%, transparent);
}

#naming-sequencer .pattern-sep { color: var(--text3); font-size: 16px; font-weight: 600; }

#naming-sequencer .naming-signal-track { position: relative; height: 30px; margin: 5px 10px 0; }
#naming-sequencer .naming-signal-track::before { content: ""; position: absolute; left: 2%; right: 2%; top: 15px; height: 1px; background: linear-gradient(90deg, rgba(37,99,235,.12), rgba(14,165,233,.45), rgba(45,212,191,.18)); }
#naming-sequencer .naming-signal { position: absolute; left: var(--signal-position); top: 10px; width: 11px; height: 11px; border: 2px solid var(--surface, #fff); border-radius: 50%; background: var(--signal-color); box-shadow: 0 0 0 4px color-mix(in srgb, var(--signal-color) 14%, transparent), 0 0 18px var(--signal-color); transition: left .48s cubic-bezier(.2,.8,.2,1), background .22s ease; }

#naming-sequencer .naming-parts { display: flex; flex-wrap: wrap; justify-content: center; gap: 11px; margin-top: 0; }

#naming-sequencer .naming-part {
  position: relative;
  flex: 0 1 calc((100% - 33px) / 4);
  display: grid;
  min-width: 0;
  min-height: 110px;
  padding: 16px 14px 14px 48px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: color-mix(in srgb, var(--bg2) 72%, var(--surface, #fff));
  color: var(--text1);
  font-family: var(--sans);
  text-align: left;
  cursor: pointer;
  appearance: none;
  transition: transform .22s ease, border-color .22s ease, background .22s ease, box-shadow .22s ease;
}

#naming-sequencer .naming-part-number { position: absolute; left: 13px; top: 15px; display: grid; place-items: center; width: 25px; height: 25px; border-radius: 8px; background: color-mix(in srgb, var(--token-color) 11%, var(--surface, #fff)); color: color-mix(in srgb, var(--token-color) 82%, var(--text1)); font-size: 11px; font-weight: 800; }
#naming-sequencer .naming-part-key { color: color-mix(in srgb, var(--token-color) 76%, var(--text1)); font-family: var(--sans); font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
#naming-sequencer .naming-part-desc { margin-top: 8px; color: var(--text1); font-size: 14px; font-weight: 600; line-height: 1.35; }
#naming-sequencer .naming-part-example { margin-top: 7px; color: var(--text3); font-family: var(--mono); font-size: 13px; font-weight: 500; }

#naming-sequencer .naming-part.is-active,
#naming-sequencer .naming-part:hover,
#naming-sequencer .naming-part:focus-visible {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--token-color) 60%, var(--border));
  background: color-mix(in srgb, var(--token-color) 7%, var(--surface, #fff));
  box-shadow: 0 15px 30px -22px color-mix(in srgb, var(--token-color) 62%, transparent), inset 3px 0 var(--token-color);
  outline: none;
}

#naming-sequencer .naming-part:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent), 0 15px 30px -22px color-mix(in srgb, var(--token-color) 62%, transparent), inset 3px 0 var(--token-color); }

#naming-sequencer .naming-sequencer-hint { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 15px; color: var(--text3); font-size: 13px; line-height: 1.5; }
#naming-sequencer .naming-sequencer-hint strong { color: color-mix(in srgb, var(--accent) 62%, var(--text2)); }

[data-theme="dark"] #naming-sequencer { background-color: color-mix(in srgb, var(--surface, #0f172a) 94%, transparent); box-shadow: 0 26px 60px -38px rgba(0,0,0,.72); }
[data-theme="dark"] #naming-sequencer .naming-pattern-shell::after { background: linear-gradient(90deg, transparent, rgba(148,163,184,.15), transparent); }

@media (max-width: 760px) {
  #naming-sequencer .naming-part { flex-basis: calc((100% - 11px) / 2); }
  #naming-sequencer .naming-formula-head { display: block; }
  #naming-sequencer .naming-formula-meta { margin-top: 13px; }
  #naming-sequencer .naming-pattern-code { justify-content: flex-start; }
}

@media (max-width: 480px) {
  #naming-sequencer { padding: 20px; }
  #naming-sequencer .naming-part { flex-basis: 100%; }
  #naming-sequencer .naming-sequencer-hint { display: block; }
  #naming-sequencer .naming-sequencer-hint span:last-child { display: block; margin-top: 6px; }
}

@media (prefers-reduced-motion: reduce) {
  #naming-sequencer .naming-pattern-shell::after { display: none; animation: none; }
  #naming-sequencer .pattern-token,
  #naming-sequencer .naming-signal,
  #naming-sequencer .naming-part { transition: none; }
}
```

- [ ] **Step 3: Add the synchronization script**

Create `js/naming-sequencer.js`:

```javascript
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
```

- [ ] **Step 4: Run the contract and verify it passes**

Run:

```bash
python3 -m unittest tests/test_naming_sequencer.py -v
git diff --check
```

Expected: four tests pass, followed by no whitespace errors.

- [ ] **Step 5: Commit the implementation**

```bash
git add index.html styles/polish.css js/naming-sequencer.js tests/test_naming_sequencer.py
git commit -m "feat: redesign naming format sequencer"
```

### Task 3: Verify The Rendered Component

**Files:**
- Create: `design-qa.md`
- Modify only if QA finds a defect: `index.html`, `styles/polish.css`, `js/naming-sequencer.js`, `tests/test_naming_sequencer.py`

**Interfaces:**
- Consumes: the completed sequencer and the existing light/dark theme control.
- Produces: a rendered QA result covering the annotated desktop viewport, responsive widths, interactions, reduced motion, and scope integrity.

- [ ] **Step 1: Confirm the local server**

Run:

```bash
curl --noproxy '*' -I http://127.0.0.1:9009/
```

Expected: `HTTP/1.0 200 OK`. If the server is unavailable, run `python3 -m http.server 9009 --bind 127.0.0.1` from the repository root.

- [ ] **Step 2: Verify the annotated desktop state in the in-app browser**

Open `http://127.0.0.1:9009/#naming` at 1375 x 942 and confirm:

- the component remains on the existing light page surface;
- the title and labels use Noto Sans at the specified sizes;
- the sample uses Source Code Pro and reads `2007_NASA_PCoE_LCO_18650_1C_1C_25T`;
- fields 5, 6, and 7 match every other card and are centered as a three-card second row;
- the active preview segment, card, status, and signal update together;
- hovering and keyboard focusing a card pauses and locks the sequence.

- [ ] **Step 3: Verify responsive, theme, and motion states**

Confirm 900 px, 640 px, and 375 px widths have no horizontal overflow. Toggle the existing theme control and confirm dark-mode contrast without a black neon panel. Emulate `prefers-reduced-motion: reduce` and confirm the automatic interval and sweep are absent while focus states remain visible.

- [ ] **Step 4: Record design QA**

Create `design-qa.md` with:

```markdown
# Naming Field Sequencer Design QA

- Source: approved Field Sequencer typography/layout V4 mockup
- Desktop 1375 x 942: passed
- Responsive 900 / 640 / 375 px: passed
- Light and dark themes: passed
- Hover and keyboard synchronization: passed
- Reduced motion: passed
- Scope check: only the selected naming formula panel changed

final result: passed
```

- [ ] **Step 5: Run final checks and commit QA evidence**

```bash
python3 -m unittest tests/test_naming_sequencer.py -v
git diff --check
git status --short
git add design-qa.md
git commit -m "test: verify naming sequencer design"
```

Expected: all tests pass, no whitespace errors, and the worktree is clean after the QA commit.
