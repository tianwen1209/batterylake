/* Datasets page: catalogue cards, filters, sorting and the dataset popup.
 * Rows come from the BatteryLake metadata (js/dataset-metadata.js). The processed-files checklist and the
 * source / processed links still come from the dataset registry rows in main.js (DATASETS).
 * Shared helpers from main.js: DATASET_CATEGORIES, getDatasetPageCategory, getCatLabel, getCatClass.
 * The inline handlers in index.html and the assistant call the functions exported at the bottom. */
(() => {
'use strict';

const UNKNOWN = 'Unknown';
const UNKNOWN_CHEMISTRY = 'Unknown Chemistry';   // shown when a dataset has no cathode/anode data at all
let ROWS = [];
let status = 'idle';                              // idle | loading | ready | error

/* A registry row (dataset_registry.csv, via main.js) for the checklist and links. */
const registryRow = id => (typeof DATASETS !== 'undefined' && DATASETS.find(x => x.id === id)) || {};

const pageCat = raw => getDatasetPageCategory(raw);

/* Proper case for display: capitalise each word / hyphen part unless it already has an uppercase letter
   (so CC-CV, NMC811, eVTOL, Si-graphite -> Si-Graphite keep their shape). */
/* Display casing. "multi-stage CC(-CV)" is shown as the literature abbreviation MCC(-CV). */
const titleCase = s => String(s).replace(/\bmulti-?stage (CC(?:-CV)?)\b/i, (_, p) => 'M' + p.toUpperCase())
  .replace(/[^\s-]+/g, w => /[A-Z]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1));
const DOMAIN_LABELS = { lab: 'Lab', EV_field: 'EV Field', safety: 'Safety', HEV: 'HEV', eVTOL: 'eVTOL', grid_storage: 'Grid Storage' };
const domainLabel = v => DOMAIN_LABELS[v] || v;
const FORM_FACTOR_LABELS = { cylindrical: 'Cylindrical', pouch: 'Pouch', prismatic: 'Prismatic', pack: 'Pack' };
const formFactorLabel = v => FORM_FACTOR_LABELS[v] || (v ? v[0].toUpperCase() + v.slice(1) : v);
/* Format code → parent form factor (codes not listed fall under "Other codes"). */
const FORMAT_CODE_PARENT = { '18650': 'cylindrical', '21700': 'cylindrical', '26650': 'cylindrical', '14500': 'cylindrical', '502030': 'pouch', '302030': 'pouch', '533459': 'pouch' };
const ENTITY_UNITS = { cell: 'cells', vehicle: 'vehicles', module: 'modules' };

const cathodes = d => d.cathode_chemistries.length ? d.cathode_chemistries : [UNKNOWN];
const anodes = d => d.anode_chemistries.length ? d.anode_chemistries : [UNKNOWN];
/* A profile known for one side only (single_side_profiles) leaves the other side unknown, so "Unknown" also matches it in the Profile filter. */
const dynamicNames = d => (d.dynamic_subprofiles || []).map(x => x.name);
/* The dynamic sub-profiles (UDDS, WLTP, ...) a dataset runs on one side: those named by that side's rate rows; where no row names one
   (dynamic on both sides, or no rates recorded) every sub-profile of the dataset counts for each side that has a dynamic profile. */
function dynSubs(d, side) {
  const named = [...new Set((d.rate_combinations || []).map(r => r[side + '_subprofile']).filter(Boolean))];
  if (named.length) return named;
  return (side === 'charge' ? charges(d) : discharges(d)).includes('dynamic') ? dynamicNames(d) : [];
}
const SUB = 'sub:';
const isSub = v => v.startsWith(SUB);
const hasSingle = (d, side) => (d.single_side_profiles || []).some(x => x.side === side);
const charges = d => d.charge_profiles.length ? (hasSingle(d, 'discharge') ? d.charge_profiles.concat(UNKNOWN) : d.charge_profiles) : [UNKNOWN];
const discharges = d => d.discharge_profiles.length ? (hasSingle(d, 'charge') ? d.discharge_profiles.concat(UNKNOWN) : d.discharge_profiles) : [UNKNOWN];
const chemCombo = d => cathodes(d).join(' / ') + ' + ' + anodes(d).join(' / ');
const profCombo = d => charges(d).join('/') + ' → ' + discharges(d).join('/');
/* Chemistry summary for the card: a side with one value is named, a side with several is counted
   (e.g. "NMC - Graphite", "3 Cathodes - Graphite", "4 Cathodes - 2 Anodes"). Full lists go in the tooltip. */
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const chemSide = (list, word) => list.length === 0 ? UNKNOWN : list.length === 1 ? titleCase(list[0]) : plural(list.length, word);
/* Real cathode/anode pairings (electrode_combinations); falls back to the listed cathodes x anodes only when the record has none. */
function chemRows(d) {
  const u = v => v || UNKNOWN;
  if (d.electrode_combinations && d.electrode_combinations.length) {
    const seen = new Set();
    return d.electrode_combinations.map(c => ({ cathode: u(c.cathode), anode: u(c.anode) }))
      .filter(r => { const k = r.cathode + '\u0000' + r.anode; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  return cathodes(d).flatMap(c => anodes(d).map(a => ({ cathode: c, anode: a })));
}
function chemTagLabel(d) {
  if (!d.cathode_chemistries.length && !d.anode_chemistries.length) return UNKNOWN_CHEMISTRY;
  const rows = chemRows(d);
  const cs = [...new Set(rows.map(r => r.cathode))], as = [...new Set(rows.map(r => r.anode))];
  // one pairing is named ("NMC - Graphite"); several are counted ("3 Chemistries"). The tooltip lists them all.
  if (rows.length > 1) return rows.length + ' Chemistries';
  return titleCase(rows[0].cathode) + ' / ' + titleCase(rows[0].anode);
}
const chemTooltip = d => (!d.cathode_chemistries.length && !d.anode_chemistries.length && !(d.electrode_combinations || []).length) ? UNKNOWN_CHEMISTRY : chemRows(d).map(r => titleCase(r.cathode) + ' / ' + titleCase(r.anode)).join('\n');
const cathodeList = d => d.cathode_chemistries.length ? d.cathode_chemistries.join(' / ') : UNKNOWN;
const formStatLabel = d => d.cell_format_codes.length ? d.cell_format_codes.join(' | ') : d.form_factors.map(formFactorLabel).join(' | ');
/* Every charging × discharging pairing, e.g. "CC-CV → CC | CC-CV → dynamic" */
function profileRows(d) {
  const u = v => v || UNKNOWN, seen = new Set();
  const rows = profileCombos(d).map(p => ({ charge: u(p.charge), discharge: u(p.discharge) }))
    .filter(r => { const k = r.charge + '\u0000' + r.discharge; if (seen.has(k)) return false; seen.add(k); return true; });
  return rows.length ? rows : [{ charge: UNKNOWN, discharge: UNKNOWN }];
}
/* Profiles with data on one side only, written "CC Charging" / "dynamic Discharging" in the record (single_side_profiles). */
const singleSideLabels = d => (d.single_side_profiles || []).map(x => titleCase(x.label));
const profilePairList = d => {
  const pairs = (d.profile_combinations || []).length ? profileRows(d).map(r => titleCase(r.charge) + ' \u2192 ' + titleCase(r.discharge)) : [];
  const all = pairs.concat(singleSideLabels(d));
  return all.length ? all : [UNKNOWN];
};
/* A chip that opens a dropdown listing every item when there is more than one (chemistries, profiles). */
function dropChipHTML(type, label, panelInner) {
  const cls = 'dc-tag ' + filterTypeClass(type);
  return `<span class="chip-dd"><button type="button" class="${cls} chip-dd-btn" aria-expanded="false" aria-haspopup="true" onclick="toggleChipDD(event, this)">${esc(label)}</button>`
    + `<span class="chip-dd-panel" hidden onclick="event.stopPropagation()">${panelInner}</span></span>`;
}
function dropChip(type, label, items) {
  const cls = 'dc-tag ' + filterTypeClass(type);
  return dropChipHTML(type, label, items.map(i => `<span class="${cls}">${esc(i)}</span>`).join(''));
}
function closeChipDDs(except) {
  document.querySelectorAll('.chip-dd-panel:not([hidden])').forEach(p => {
    if (p === except) return;
    p.hidden = true; p.previousElementSibling.setAttribute('aria-expanded', 'false');
  });
}
function toggleChipDD(ev, btn) {
  ev.stopPropagation();                       // do not open the dataset popup
  const panel = btn.nextElementSibling, open = panel.hidden;
  closeChipDDs(panel);
  panel.hidden = !open; btn.setAttribute('aria-expanded', open);
}
document.addEventListener('click', () => closeChipDDs());
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChipDDs(); });
/* Profile chip: one pairing is shown as is; several collapse to "N Profiles" with a dropdown (alphabetical). */
function profileTag(d) {
  const all = profilePairList(d).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  if (all.length < 2) return `<span class="dc-tag ${filterTypeClass('profile')}" title="Charging → discharging">${esc(all[0] || UNKNOWN)}</span>`;
  return dropChip('profile', all.length + ' Profiles', all);
}
function chemistryTag(d) {
  if (chemTagLabel(d) === UNKNOWN_CHEMISTRY) return '';   // no chemistry data: no chip
  const rows = chemRows(d);
  if (rows.length < 2) return `<span class="dc-tag ${filterTypeClass('chemistry')}">${esc(chemTagLabel(d))}</span>`;
  return dropChip('chemistry', chemTagLabel(d), rows.map(r => titleCase(r.cathode) + ' / ' + titleCase(r.anode)));
}
/* Form chip: factor and format code share one chip ("Cylindrical \u00b7 18650"); several entries collapse to "N Formats". Codes are not stored per factor, so they are
   attached via FORMAT_CODE_PARENT; codes the filter does not know are not shown. */
function formGroups(d) {
  const factors = d.form_factors || [], codes = (d.cell_format_codes || []).filter(c => FORMAT_CODE_PARENT[c]);   // only codes the filter knows
  return factors.map(f => ({ factor: f, label: formFactorLabel(f), codes: codes.filter(c => FORMAT_CODE_PARENT[c] === f) }));
}
function formEntries(d) {
  return formGroups(d).flatMap(x => x.codes.length ? x.codes.map(c => x.label + ' \u00b7 ' + c) : [x.label]);
}
function formTag(d) {
  const e = formEntries(d);
  if (!e.length) return '';
  if (e.length === 1) return `<span class="dc-tag ${filterTypeClass('form')}">${esc(e[0])}</span>`;
  return dropChip('form', e.length + ' Formats', e);
}
const formTagLabel = d => d.form_factors.map(formFactorLabel).join(' | ');

function getChemClass(d) {
  const c = d.cathode_chemistries;
  if (!c.length) return 'chem-Unknown';
  if (c.length > 1) return 'chem-Multi';
  const s = c[0];
  if (s.includes('LFP')) return 'chem-LFP';
  if (s.includes('NMC') || s.includes('NCM')) return 'chem-NMC';
  if (s.includes('LCO')) return 'chem-LCO';
  if (s.includes('NCA')) return 'chem-NCA';
  return 'chem-Unknown';
}
const chemLetter = d => getChemClass(d).replace('chem-', '').charAt(0);


/* ── filter definitions (built from the data) ────────────────────── */
const uniq = arr => Array.from(new Set(arr));
/* Distinct values of a field in alphanumeric order of their displayed label (numbers by value, case-insensitive); Unknown goes last. */
const alphaCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const sortedValues = (getter, label = String) => {
  const seen = new Set();
  ROWS.forEach(d => getter(d).forEach(v => seen.add(v)));
  return Array.from(seen).sort((a, b) => (a === UNKNOWN) - (b === UNKNOWN) || alphaCollator.compare(label(a), label(b)));
};
/* Charging / Discharging: plain profile names, plus "sub:<name>" values for the sub-profiles of the dynamic profile (like format codes under a form factor).
   A selected "dynamic" stands for "this profile minus any sub-profile deselected afterwards": datasets whose only sub-profiles on this side are
   deselected drop out; datasets with no sub-profile on this side, or with at least one selected, stay. */
function profileFilter(side, word) {
  const list = side === 'charge' ? charges : discharges;
  return {
    type: 'profile',
    test: (d, v) => {
      if (isSub(v)) return dynSubs(d, side).includes(v.slice(SUB.length));
      if (v !== 'dynamic') return list(d).includes(v);
      if (!list(d).includes('dynamic')) return false;
      const own = dynSubs(d, side);
      return !own.length || own.some(n => active[side].has(SUB + n));
    },
    label: v => isSub(v) ? v.slice(SUB.length) : v,
    chipLabel: v => word + ': ' + (isSub(v) ? v.slice(SUB.length) : v),
    raw: isSub                                    // sub-profile names are shown exactly as recorded
  };
}
const FILTERS = {
  cat:       { type: 'category',  test: (d, v) => pageCat(d.category) === v, label: v => getCatLabel(v) },
  domain:    { type: 'domain',    test: (d, v) => d.application_domain === v, label: domainLabel },
  form:      { type: 'form',      test: (d, v) => {
                 const [k, x] = v.split(':');
                 if (k !== 'factor') return d.cell_format_codes.includes(x);
                 /* A selected factor stands for "this factor minus any of its codes deselected afterwards": datasets whose only codes for this
                    factor are deselected drop out; datasets with no code for it, or with at least one selected code, stay. */
                 if (!d.form_factors.includes(x)) return false;
                 const own = d.cell_format_codes.filter(c => FORMAT_CODE_PARENT[c] === x);
                 return !own.length || own.some(c => active.form.has('code:' + c));
               },
               label: v => { const [k, x] = v.split(':'); return k === 'factor' ? formFactorLabel(x) : x; } },
  cathode:   { type: 'chemistry', test: (d, v) => cathodes(d).includes(v), label: v => v === UNKNOWN ? 'Unknown cathode' : v },
  anode:     { type: 'chemistry', test: (d, v) => anodes(d).includes(v), label: v => v === UNKNOWN ? 'Unknown anode' : v },
  charge:    profileFilter('charge', 'Charging'),
  discharge: profileFilter('discharge', 'Discharging')
};
const FILTER_KEYS = Object.keys(FILTERS);
const newSets = () => Object.fromEntries(FILTER_KEYS.map(k => [k, new Set()]));
const active = newSets(), pending = newSets();
let pendingAllDatasets = false, allDatasetsApplied = false;
let activeSort = 'oldest';
let expandedDatasetCategories = new Set(['cycle_aging']);

/* Aliases kept for the assistant's agent tools (they add old-style values to these sets). */
const pendingChems = pending.cathode, pendingForms = pending.form, pendingCategories = pending.cat, pendingDomains = pending.domain, pendingDuties = new Set();
function normalizePendingAliases() {
  [...pending.form].forEach(v => {
    if (v.includes(':')) return;
    pending.form.delete(v);
    const low = v.toLowerCase();
    if (FORMAT_CODE_PARENT[v] || /^\d+$/.test(v)) pending.form.add('code:' + v);
    else { const f = 'factor:' + (low === 'cyl' ? 'cylindrical' : low); pending.form.add(f); linkFormSelection(pending.form, f); }
  });
  const DOM = { ev: 'EV_field', grid: 'grid_storage', lab: 'lab' };
  [...pending.domain].forEach(v => { if (DOM[v.toLowerCase()] && !DOMAIN_LABELS[v]) { pending.domain.delete(v); pending.domain.add(DOM[v.toLowerCase()]); } });
  pendingDuties.clear();
}

const FILTER_TYPE_STYLES = { chemistry: 'filter-type-chemistry', category: 'filter-type-category', profile: 'filter-type-profile', form: 'filter-type-form', domain: 'filter-type-domain', all: 'filter-type-all', status: 'filter-type-status' };
function filterTypeClass(type) { return 'filter-token ' + (FILTER_TYPE_STYLES[type] || FILTER_TYPE_STYLES.status); }

function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function escAttr(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function chip(key, value) {
  const f = FILTERS[key];
  return `<div class="filter-tag ${filterTypeClass(f.type)}" data-fk="${key}" data-fv="${esc(value)}" onclick="toggleFilterTag(this)">${esc(f.raw && f.raw(value) ? f.label(value) : titleCase(f.label(value)))}</div>`;
}
function buildFilterGrid() {
  const cats = sortedValues(d => [pageCat(d.category)], getCatLabel);
  const sub = (label, html) => `<div class="filter-subgroup"><span class="filter-sublabel">${label}</span>${html}</div>`;
  const chips = (key, values) => values.map(v => chip(key, v)).join('');
  /* Charging / Discharging chips; the dynamic profile becomes a grouped pill with its sub-profiles beside it (like a form factor and its format codes) */
  const profileChips = side => {
    const subs = sortedValues(d => dynSubs(d, side));
    return sortedValues(side === 'charge' ? charges : discharges).map(v => v === 'dynamic' && subs.length
      ? `<div class="filter-form-box" data-factor="dynamic">${chip(side, 'dynamic')}<div class="filter-form-codes">${chips(side, subs.map(n => SUB + n))}</div></div>`
      : chip(side, v)).join('');
  };

  // Form: each form factor followed by its format codes.
  const factors = sortedValues(d => d.form_factors, formFactorLabel);
  const codes = sortedValues(d => d.cell_format_codes);
  /* factors with format codes: a grouped box (factor chip as header, codes beneath); factors without codes: plain chips */
  const withCodes = factors.filter(f => codes.some(c => FORMAT_CODE_PARENT[c] === f));
  const plain = factors.filter(f => !withCodes.includes(f));
  const formRows = withCodes.map(f => `<div class="filter-form-box" data-factor="${esc(f)}">${chip('form', 'factor:' + f)}<div class="filter-form-codes">${chips('form', codes.filter(c => FORMAT_CODE_PARENT[c] === f).map(c => 'code:' + c))}</div></div>`).join('')
    + (plain.length ? `<div class="filter-form-row">${plain.map(f => chip('form', 'factor:' + f)).join('')}</div>` : '');
  const orphanCodes = codes.filter(c => !FORMAT_CODE_PARENT[c]);
  const formExtra = orphanCodes.length ? `<div class="filter-form-row"><span class="filter-sublabel">Other codes</span>${chips('form', orphanCodes.map(c => 'code:' + c))}</div>` : '';

  document.getElementById('dataset-filter-grid').innerHTML = `
    <div class="filter-group filter-group--category">
      <span class="filter-label">Category</span>${chips('cat', cats)}
    </div>
    <div class="filter-group">
      <span class="filter-label">Domain</span>${chips('domain', sortedValues(d => [d.application_domain], domainLabel))}
    </div>
    <div class="filter-group">
      <span class="filter-label">Form Factor</span>${formRows}${formExtra}
    </div>
    <div class="filter-group filter-group--wide">
      <span class="filter-label">Chemistry</span>
      ${sub('Cathode', chips('cathode', sortedValues(cathodes)))}
      ${sub('Anode', chips('anode', sortedValues(anodes)))}
    </div>
    <div class="filter-group filter-group--wide">
      <span class="filter-label">Profile</span>
      ${sub('Charging', profileChips('charge'))}
      ${sub('Discharging', profileChips('discharge'))}
    </div>`;
}

/* ── cards & sections ────────────────────────────────────────────── */
const toggleIcon = ex => ex
  ? '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>'
  : '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
const fmtCycles = n => n > 0 ? (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : n) : null;

function cardHTML(d) {
  const cy = fmtCycles(Number(d.n_cycles_total) || 0);
  const unit = ENTITY_UNITS[d.entity_type] || d.entity_type || 'cells';
  const tags = [
    `<span class="dc-tag ${filterTypeClass('category')}">${esc(getCatLabel(d.category))}</span>`,
    d.application_domain ? `<span class="dc-tag ${filterTypeClass('domain')}">${esc(domainLabel(d.application_domain))}</span>` : '',
    formTag(d),
    chemistryTag(d),
    (d.charge_profiles.length || d.discharge_profiles.length) ? profileTag(d) : ''
  ].join('');
  return `
    <div class="dataset-card" onclick="openDatasetModal('${escAttr(d.dataset_id)}')">
      <div class="dc-top">
        <div class="dc-icon ${getChemClass(d)}">${chemLetter(d)}</div>
        <div class="dc-body">
          <div class="dc-name">${esc(d.ref_name || d.dataset_name)}</div>
          ${d.ref_name && d.dataset_name && d.dataset_name !== d.ref_name ? `<div class="dc-refname">${esc(d.dataset_name)}</div>` : ''}
        </div>
      </div>
      <div class="dc-stats">
        ${d.n_entities ? `<span class="dc-stat"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg> <span class="stat-val">${Number(d.n_entities).toLocaleString('en-US')}</span> ${esc(unit)}</span>` : ''}
        ${cy ? `<span class="dc-stat"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> <span class="stat-val">${cy}</span> cycles</span>` : ''}
      </div>
      <div class="dc-tags">${tags}</div>
    </div>`;
}

const hasFilters = () => FILTER_KEYS.some(k => active[k].size);
const hasSearch = () => !!document.getElementById('searchInput').value.trim();
const resultsMode = () => hasSearch() || hasFilters() || allDatasetsApplied;

function renderDatasets(data) {
  const grid = document.getElementById('dataset-grid');
  const count = document.getElementById('filter-count');
  if (status !== 'ready') {
    count.textContent = status === 'error' ? 'Datasets unavailable' : 'Loading datasets\u2026';
    grid.innerHTML = status === 'error'
      ? '<div class="dataset-empty">Could not load the dataset catalogue. <button type="button" class="dataset-filter-action" onclick="DatasetsPage.reload()">Retry</button></div>'
      : '<div class="dataset-empty">Loading datasets\u2026</div>';
    return;
  }
  const rm = resultsMode();
  document.querySelector('.dataset-results-head').classList.toggle('browse', !rm);
  if (!data.length) { grid.innerHTML = '<div class="dataset-empty">No datasets match your filters.</div>'; count.textContent = '0 datasets found'; return; }
  count.textContent = data.length + ' datasets found';
  if (rm) { grid.innerHTML = `<div class="dataset-card-grid">${data.map(cardHTML).join('')}</div>`; return; }
  grid.innerHTML = DATASET_CATEGORIES
    .map(cat => ({ cat, items: data.filter(d => pageCat(d.category) === cat.key) }))
    .filter(e => e.items.length)
    .sort((a, b) => b.items.length - a.items.length || a.cat.label.localeCompare(b.cat.label))
    .map(({ cat, items }) => {
      const ex = expandedDatasetCategories.has(cat.key);
      return `
      <section class="dataset-section ${ex ? 'is-expanded' : 'is-collapsed'}">
        <div class="dataset-section-head" role="button" tabindex="0" aria-expanded="${ex}" onclick="toggleDatasetCategorySection('${cat.key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDatasetCategorySection('${cat.key}')}">
          <div class="dataset-section-title">
            <span class="dataset-section-icon ${getCatClass(cat.key)}">${cat.icon}</span>
            <h2>${esc(cat.label)}</h2>
            <span class="dataset-section-meta">${items.length}</span>
          </div>
          <button class="dataset-see-all" type="button" aria-label="${ex ? 'Collapse' : 'Expand'} ${escAttr(cat.label)}" onclick="event.stopPropagation();toggleDatasetCategorySection('${cat.key}')">${toggleIcon(ex)}</button>
        </div>
        ${ex ? `<div class="dataset-card-grid">${items.map(cardHTML).join('')}</div>` : ''}
      </section>`;
    }).join('');
}

function sortDatasets(arr, mode) {
  const c = arr.slice();
  const year = d => d.year || 0, cells = d => d.n_entities || 0, cyc = d => d.n_cycles_total || 0;
  if (mode === 'oldest') c.sort((a, b) => year(a) - year(b));
  else if (mode === 'most-entities') c.sort((a, b) => cells(b) - cells(a));
  else if (mode === 'most-cycles') c.sort((a, b) => cyc(b) - cyc(a));
  else if (mode === 'az') c.sort((a, b) => (a.dataset_name || '').localeCompare(b.dataset_name || ''));
  else c.sort((a, b) => year(b) - year(a));
  return c;
}
/* Filter logic: values within a group are OR-ed, groups are AND-ed.
   Chemistry (cathode OR anode) and Profile (charging OR discharging) each combine their two sub-filters with OR:
   a dataset matches when it has any selected cathode or any selected anode, any selected charging or discharging profile. */
const FILTER_GROUPS = [['cat'], ['domain'], ['form'], ['cathode', 'anode'], ['charge', 'discharge']];
function matchesGroup(d, keys) {
  const sel = keys.flatMap(k => [...active[k]].map(v => [k, v]));
  return !sel.length || sel.some(([k, v]) => FILTERS[k].test(d, v));
}
function getFiltered() {
  if (allDatasetsApplied) return sortDatasets(ROWS, activeSort);
  const tokens = document.getElementById('searchInput').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return sortDatasets(ROWS.filter(d => {
    if (!FILTER_GROUPS.every(keys => matchesGroup(d, keys))) return false;
    if (tokens.length) {
      const hay = [dynamicNames(d).join(' '), d.dataset_id, d.dataset_name, d.ref_name, d.notes, d.institution, d.year, getCatLabel(d.category),
        domainLabel(d.application_domain), cathodes(d).join(' '), anodes(d).join(' '), charges(d).join(' '), discharges(d).join(' '), charges(d).concat(discharges(d)).map(titleCase).join(' '), d.form_factors.join(' '), d.cell_format_codes.join(' ')].join(' ').toLowerCase();
      if (!tokens.every(t => hay.includes(t))) return false;
    }
    return true;
  }), activeSort);
}
function filterDatasets() { renderDatasets(getFiltered()); }
function toggleDatasetCategorySection(cat) {
  expandedDatasetCategories.has(cat) ? expandedDatasetCategories.delete(cat) : expandedDatasetCategories.add(cat);
  filterDatasets();
}
function changeSort(m) { activeSort = m; filterDatasets(); }

/* ── filter popover ──────────────────────────────────────────────── */
function syncTags() {
  document.querySelectorAll('#dataset-filter-grid .filter-tag[data-fk]').forEach(t => t.classList.toggle('active', pending[t.dataset.fk].has(t.dataset.fv)));
  /* a factor that is not selected but has any of its codes selected shows a "partial" state */
  document.querySelectorAll('#dataset-filter-grid .filter-form-box').forEach(box => {
    const codeTags = [...box.querySelectorAll('.filter-form-codes .filter-tag')], n = codeTags.filter(c => c.classList.contains('active')).length;
    const parent = box.querySelector(':scope > .filter-tag');
    /* a selected Dynamic chip with some of its sub-profiles deselected is partial as well (it then narrows the results); form factors keep their own rule */
    const narrowed = box.dataset.factor === 'dynamic' && parent.classList.contains('active') && n < codeTags.length;
    parent.classList.toggle('partial', n > 0 && (!parent.classList.contains('active') || narrowed));
  });
  document.querySelectorAll('#page-datasets .filter-tag[data-all-datasets]').forEach(t => t.classList.toggle('active', pendingAllDatasets));
}
function copyInto(dst, src) { FILTER_KEYS.forEach(k => { dst[k].clear(); src[k].forEach(v => dst[k].add(v)); }); }
function syncPendingFromActive() { copyInto(pending, active); pendingAllDatasets = allDatasetsApplied; syncTags(); }
/* Form Factor: selecting a factor also selects all of its format codes. The link is one-way: deselecting a factor leaves its codes selected,
   and selecting every code of a factor does not select the factor. */
function linkFormSelection(set, v) {
  const [k, x] = v.split(':');
  if (k === 'factor' && set.has(v)) Object.keys(FORMAT_CODE_PARENT).filter(c => FORMAT_CODE_PARENT[c] === x).forEach(c => set.add('code:' + c));
}
/* Charging / Discharging: selecting "dynamic" also selects all its sub-profiles (deselecting it by click clears them too, see toggleFilterTag). */
function linkProfileSelection(side, set, v) {
  if (v === 'dynamic' && set.has(v)) sortedValues(d => dynSubs(d, side)).forEach(n => set.add(SUB + n));
}
function linkSelection(key, set, v) {
  if (key === 'form') linkFormSelection(set, v);
  else if (key === 'charge' || key === 'discharge') linkProfileSelection(key, set, v);
}
function toggleFilterTag(el) {
  pendingAllDatasets = false;
  const s = pending[el.dataset.fk], v = el.dataset.fv;
  /* a Dynamic chip in the partial state clears itself and all its sub-profiles */
  if ((el.dataset.fk === 'charge' || el.dataset.fk === 'discharge') && v === 'dynamic' && el.classList.contains('partial')) {
    [...s].filter(x => x === v || isSub(x)).forEach(x => s.delete(x));
    syncTags(); return;
  }
  s.has(v) ? s.delete(v) : s.add(v);
  linkSelection(el.dataset.fk, s, v);
  /* clicking the Dynamic chip toggles all its sub-profiles with it (unlike a form factor, whose codes stay when it is deselected) */
  const side = el.dataset.fk;
  if ((side === 'charge' || side === 'discharge') && v === 'dynamic' && !s.has(v)) [...s].filter(isSub).forEach(x => s.delete(x));
  syncTags();
}
function toggleAllDatasetsFilter() {
  pendingAllDatasets = !pendingAllDatasets;
  if (pendingAllDatasets) FILTER_KEYS.forEach(k => pending[k].clear());
  syncTags();
}
function toggleDatasetFilters() {
  const pop = document.getElementById('dataset-filter-popover');
  const open = !pop.classList.contains('open');
  if (open) syncPendingFromActive();
  pop.classList.toggle('open', open);
  document.querySelector('#page-datasets .dataset-filter-toggle').setAttribute('aria-expanded', open);
}
function closeDatasetFilters() {
  document.getElementById('dataset-filter-popover').classList.remove('open');
  document.querySelector('#page-datasets .dataset-filter-toggle').setAttribute('aria-expanded', 'false');
}
function applyDatasetFilters() {
  normalizePendingAliases();
  allDatasetsApplied = pendingAllDatasets;
  if (pendingAllDatasets) FILTER_KEYS.forEach(k => pending[k].clear());
  copyInto(active, pending);
  closeDatasetFilters(); renderChips(); filterDatasets();
}
function clearPendingDatasetFilters() {
  FILTER_KEYS.forEach(k => { pending[k].clear(); active[k].clear(); });
  pendingAllDatasets = allDatasetsApplied = false;
  syncTags(); renderChips(); filterDatasets(); closeDatasetFilters();
}
document.addEventListener('click', e => {
  const pop = document.getElementById('dataset-filter-popover');
  if (!pop.classList.contains('open')) return;
  if (e.target.closest('#dataset-filter-popover') || e.target.closest('#page-datasets .dataset-filter-toggle')) return;
  closeDatasetFilters();
});
function renderChips() {
  const box = document.getElementById('applied-filter-chips');
  const chips = [];
  if (allDatasetsApplied) chips.push(['all', 'all', 'all', 'All datasets']);
  FILTER_KEYS.forEach(k => active[k].forEach(v => { const l = (FILTERS[k].chipLabel || FILTERS[k].label)(v); chips.push([k, FILTERS[k].type, v, FILTERS[k].raw && FILTERS[k].raw(v) ? l : titleCase(l)]); }));
  box.classList.toggle('has-chips', chips.length > 0);
  box.innerHTML = chips.map(([k, t, v, l]) => `<span class="applied-chip ${filterTypeClass(t)}">${esc(l)}<button aria-label="Remove ${esc(l)} filter" onclick="removeAppliedFilter('${k}','${escAttr(v)}')">×</button></span>`).join('');
}
function removeAppliedFilter(k, v) {
  if (k === 'all') allDatasetsApplied = false; else { active[k].delete(v); linkSelection(k, active[k], v); }
  syncPendingFromActive(); renderChips(); filterDatasets();
}

/* ── search ──────────────────────────────────────────────────────── */
function onSearchInput() {
  const input = document.getElementById('searchInput');
  document.getElementById('search-box').classList.toggle('has-text', !!input.value);
  if (input.value.trim() && allDatasetsApplied) { allDatasetsApplied = false; syncPendingFromActive(); renderChips(); }
  filterDatasets();
}
function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = ''; document.getElementById('search-box').classList.remove('has-text');
  input.focus(); filterDatasets();
}
/* ── detail popup (reads the per-dataset + research records) ────── */
const PROFILE_PAIR_COLLAPSE_OVER = 3;            // profile combinations: collapse into a dropdown above this count
const fmtNum = x => String(+x);                  // 2.0 -> "2", 0.75 -> "0.75"
const fmtRate = (x, frac) => x == null ? '—' : frac ? fracLabel(frac) : fmtNum(x) + 'C';
const chipHTML = (type, text) => `<span class="dc-tag ${filterTypeClass(type)}">${esc(text)}</span>`;

/* A native <details> dropdown: keyboard accessible, collapsed by default. */
function dropdownHTML(summary, inner, cls) {
  return `<details class="md-dropdown ${cls || ''}"><summary><span>${esc(summary)}</span></summary><div class="md-dropdown-body">${inner}</div></details>`;
}

/* Cathode - anode pairings. Uses the record's electrode_combinations; where the record has none it
   falls back to the listed cathodes with an unknown anode. */
function chemistryCombos(d) {
  const label = (c, a) => titleCase(c || UNKNOWN) + ' / ' + titleCase(a || UNKNOWN);
  if (d.electrode_combinations && d.electrode_combinations.length) return d.electrode_combinations.map(x => label(x.cathode, x.anode));
  if (!d.cathode_chemistries.length && !d.anode_chemistries.length) return [UNKNOWN_CHEMISTRY];
  return cathodes(d).flatMap(c => anodes(d).map(a => label(c === UNKNOWN ? null : c, a === UNKNOWN ? null : a)));
}
function chemistryHTML(d) {
  const combos = chemistryCombos(d);
  const chips = `<div class="md-chips">${combos.map(c => chipHTML('chemistry', c)).join('')}</div>`;
  return chips;
}

/* Charge -> discharge pairings from profile_combinations (falls back to the listed profiles). */
function profileCombos(d) {
  if (d.profile_combinations && d.profile_combinations.length) return d.profile_combinations.map(p => ({ charge: p.charge, discharge: p.discharge }));
  if (!d.charge_profiles.length && !d.discharge_profiles.length) return [];
  if ((d.single_side_profiles || []).length) return [];   // unpaired profiles are shown as "CC Charging" chips, not as "CC \u2192 Unknown"
  return charges(d).flatMap(c => discharges(d).map(x => ({ charge: c === UNKNOWN ? null : c, discharge: x === UNKNOWN ? null : x })));
}
/* C-rate combinations are nested under CC-CV -> CC / CC-CV profiles only (multi-stage and other charge types excluded). */
const hasRateNesting = p => p.charge === 'CC-CV' && (p.discharge === 'CC' || p.discharge === 'CC-CV');
const isCC = x => x === 'CC' || x === 'CC-CV';
/* Rate summary per profile pairing: plain lists for small sets (0.5, 1C), "min - maxC (N rates)" above RATE_SET_MAX values,
   plus the number of distinct charge/discharge combinations (so a partial pairing is never read as a full cross product). */
const RATE_SET_MAX = 5;
const RATE_PAIRS_MAX = 5;                        // many-to-many: list every charge \u2192 discharge pair up to this many
/* A metadata fraction "n/d" of 1C is shown as C/d or nC/d ("1/3" -> "C/3", "5/3" -> "5C/3"); without one the decimal is shown. */
const fracLabel = f => { const [n, d] = String(f).split('/'); return (n === '1' ? '' : n) + 'C/' + d; };
function rateSet(rates, side) {
  const frac = new Map();                         // numeric rate -> its fraction label, when the metadata gives one
  rates.forEach(r => { const v = r[side + '_c_rate']; if (v != null && !frac.has(v)) frac.set(v, null); if (v != null && r[side + '_c_rate_fraction']) frac.set(v, fracLabel(r[side + '_c_rate_fraction'])); });
  const u = [...frac.keys()].sort((a, b) => a - b);
  if (!u.length) return '';
  const anyFrac = u.some(v => frac.get(v));
  /* with a fraction in the list every item carries its own C ("C/3, 1C, 5C/3"); otherwise one C closes the list ("0.5, 1C") */
  const one = v => frac.get(v) || (anyFrac ? fmtNum(v) + 'C' : fmtNum(v));
  const tail = anyFrac ? '' : 'C';
  if (u.length === 1) return frac.get(u[0]) || fmtNum(u[0]) + 'C';
  return u.length <= RATE_SET_MAX ? u.map(one).join(', ') + tail : one(u[0]) + ' - ' + one(u[u.length - 1]) + tail + ' (' + u.length + ' rates)';
}
const rateRow = (label, v) => `<div class="md-rate-line"><span class="md-rate-k">${label}</span> ${esc(v)}</div>`;
function rateSummaryHTML(rates, showCharge, showDischarge, chargeName, dischargeName) {
  const distinct = vals => new Set(vals.filter(v => v != null)).size;
  const cs = showCharge ? rateSet(rates, 'charge') : '';
  const ds = showDischarge ? rateSet(rates, 'discharge') : '';
  if (!cs && !ds) return '';
  const line = t => `<div class="md-rates"><div class="md-rate-line">${esc(t)}</div></div>`;
  /* not many-to-many (one side CC only, a rate missing, or a single rate on either side): one arrow line, e.g. "2, 3C → 1C", "0.3, 1C → Dynamic" */
  if (!(cs && ds) || distinct(rates.map(r => r.charge_c_rate)) < 2 || distinct(rates.map(r => r.discharge_c_rate)) < 2)
    return line((cs || chargeName) + ' \u2192 ' + (ds || dischargeName));
  /* many-to-many: separate rows plus the number of distinct combinations (a partial pairing is never read as a full cross product) */
  const pairs = new Set(rates.filter(r => r.charge_c_rate != null && r.discharge_c_rate != null).map(r => r.charge_c_rate + '|' + r.discharge_c_rate)).size;
  /* up to RATE_PAIRS_MAX combinations: list every charge \u2192 discharge pair instead of the two summary rows */
  if (pairs <= RATE_PAIRS_MAX) {
    const lab = (r, side) => r[side + '_c_rate_fraction'] ? fracLabel(r[side + '_c_rate_fraction']) : fmtNum(r[side + '_c_rate']) + 'C';
    const seen = new Map();
    rates.filter(r => r.charge_c_rate != null && r.discharge_c_rate != null).forEach(r => seen.set(r.charge_c_rate + '|' + r.discharge_c_rate, r));
    const lines = [...seen.values()].sort((a, b) => a.charge_c_rate - b.charge_c_rate || a.discharge_c_rate - b.discharge_c_rate)
      .map(r => `<div class="md-rate-line">${esc(lab(r, 'charge') + ' \u2192 ' + lab(r, 'discharge'))}</div>`);
    return `<div class="md-rates">${lines.join('')}</div>`;
  }
  return `<div class="md-rates">${rateRow('Charge', cs)}${rateRow('Discharge', ds)}${pairs > 1 ? `<div class="md-rate-line md-rate-note">${pairs} combinations</div>` : ''}</div>`;
}
/* Rates of the CC / CC-CV side of a profile whose other side is dynamic, pulse or multi-stage, from the rows of rate_combinations
   that belong to this pairing. The other side keeps its name; a dynamic side never shows rates, a pulse side shows its pulse
   currents ("Pulse (0.5C)"). */
const DYNAMIC_KINDS = { drive_cycle: 'drive cycle', real_driving: 'real driving', duty_cycle: 'duty cycle', square_wave: 'square wave' };
/* "UDDS (drive cycle)": the sub-profile with its kind, the kind left out when the name already says it ("Square wave", "Residential grid-storage duty cycle", "Real driving (city)") */
function subLabel(d, name) {
  const x = (d.dynamic_subprofiles || []).find(y => y.name === name), kind = x && (DYNAMIC_KINDS[x.kind] || x.kind);
  return kind && !String(name).toLowerCase().includes(kind.toLowerCase()) ? name + ' (' + kind + ')' : name;
}
function rateGroupHTML(rows, p, ccC, chargeName, dischargeName, d) {
  const ccSide = ccC ? 'charge' : 'discharge', otherSide = ccC ? 'discharge' : 'charge';
  const cc = rateSet(rows, ccSide);
  if (!cc) return '';
  const otherProfile = ccC ? p.discharge : p.charge, otherName = ccC ? dischargeName : chargeName;
  const otherRates = otherProfile !== 'dynamic' ? rateSet(rows, otherSide) : '';
  const o = otherRates ? otherName + ' (' + otherRates + ')' : otherName;
  /* rows that name the dynamic side's sub-profile ("Square wave", "UDDS") read "0.75C \u2192 Square wave": one line per sub-profile, with the rates run with it */
  const subKey = otherSide + '_subprofile';
  if (otherProfile === 'dynamic' && rows.some(r => r[subKey])) {
    const subs = [...new Set(rows.map(r => r[subKey]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    const lines = subs.map(n => { const set = rateSet(rows.filter(r => r[subKey] === n), ccSide), lab = d ? subLabel(d, n) : n; return ccC ? set + ' \u2192 ' + lab : lab + ' \u2192 ' + set; });
    return `<div class="md-rates">${lines.map(l => `<div class="md-rate-line">${esc(l)}</div>`).join('')}</div>`;
  }
  return `<div class="md-rates"><div class="md-rate-line">${esc(ccC ? cc + ' \u2192 ' + o : o + ' \u2192 ' + cc)}</div></div>`;
}
function formFactorHTML(d) {
  const e = formEntries(d);
  return `<div class="md-chips">${(e.length ? e : [UNKNOWN]).map(v => chipHTML('form', v)).join('')}</div>`;
}
/* What the dynamic profile consists of (UDDS, WLTP, eVTOL mission, ...): one line per entry of dynamic_subprofiles, the detail as hover text. */
/* One line per sub-profile. Given a pairing with a dynamic side on one side only ("MCC-CV \u2192 Dynamic"), each line carries the other
   side: "MCC-CV \u2192 UDDS (drive cycle)", "MCC \u2192 Real driving". */
function dynamicBlock(d, p) {
  const sub = d.dynamic_subprofiles || [];
  if (!sub.length) return '';
  const dc = p && isDynamic(p.charge), dd = p && isDynamic(p.discharge);
  const line = x => { const lab = subLabel(d, x.name); return dd && !dc ? titleCase(p.charge || UNKNOWN) + ' \u2192 ' + lab : dc && !dd ? lab + ' \u2192 ' + titleCase(p.discharge || UNKNOWN) : lab; };
  return `<div class="md-rates md-dynamic">`
    + sub.map(x => `<div class="md-rate-line"${x.detail ? ` title="${esc(x.detail).replace(/"/g, '&quot;')}"` : ''}>${esc(line(x))}</div>`).join('') + '</div>';
}
const isDynamic = x => x === 'dynamic';
function profilesHTML(d) {
  const combos = profileCombos(d), singles = d.single_side_profiles || [];
  if ((!combos.length || combos.every(p => !p.charge && !p.discharge)) && !singles.length) return '';   // charge and discharge both unknown: no chips, and the caller drops the Profiles field
  const name = p => titleCase(p.charge || UNKNOWN) + ' → ' + titleCase(p.discharge || UNKNOWN);
  /* any combination involving CC / CC-CV with rate data gets a dropdown of charge → discharge rates ("0.75C → 0.5/1/2C"); the rest are plain chips */
  const items = combos.map(p => {
    if (!(isCC(p.charge) || isCC(p.discharge))) {
      if (!(isDynamic(p.charge) || isDynamic(p.discharge)) || !(d.dynamic_subprofiles || []).length) return chipHTML('profile', name(p));
      return `<details class="md-chipdd dc-tag ${filterTypeClass('profile')}"><summary>${esc(name(p))}</summary><div class="md-chipdd-body">${dynamicBlock(d, p)}</div></details>`;
    }
    const ccC = isCC(p.charge), ccD = isCC(p.discharge);
    const rows = (d.rate_combinations || []).filter(r => r.charge_profile === p.charge && r.discharge_profile === p.discharge);
    let body = '';
    const cn = titleCase(p.charge || UNKNOWN), dn = titleCase(p.discharge || UNKNOWN);
    if (ccC && ccD) body = rateSummaryHTML(rows, true, true, cn, dn);
    else body = rateGroupHTML(rows, p, ccC, cn, dn, d);     /* one side CC(-CV), the other dynamic / pulse / multi-stage */
    if (!body) {
      /* no recorded rates: fall back to the maximum rates, else say so */
      const mx = [];
      if (ccC && d.charge_c_rate_max != null) mx.push(`<div class="md-rate-line">Max charge rate: ${esc(fmtRate(d.charge_c_rate_max, d.charge_c_rate_max_fraction))}</div>`);
      if (ccD && d.discharge_c_rate_max != null) mx.push(`<div class="md-rate-line">Max discharge rate: ${esc(fmtRate(d.discharge_c_rate_max, d.discharge_c_rate_max_fraction))}</div>`);
      body = `<div class="md-rates">${mx.join('') || '<div class="md-rate-line">No C-rate data</div>'}</div>`;
    }
    if ((isDynamic(p.charge) || isDynamic(p.discharge)) && !rows.some(r => r.charge_subprofile || r.discharge_subprofile)) body += dynamicBlock(d, p);    /* CC(-CV) paired with a dynamic profile: the rates, then the dynamic sub-profiles */
    return `<details class="md-chipdd dc-tag ${filterTypeClass('profile')}"><summary>${esc(name(p))}</summary><div class="md-chipdd-body">${body}</div></details>`;
  }).join('');
  /* single-side profiles ("CC Charging"): CC / CC-CV ones get a dropdown listing every rate of that side recorded for this profile
     (rate_combinations rows whose <side>_profile is this profile and whose <side>_c_rate is set).
     No such rate: "No C-rate data". Other profiles stay plain chips. */
  const singleItems = singles.map(x => {
    if (isDynamic(x.profile) && (d.dynamic_subprofiles || []).length) return `<details class="md-chipdd dc-tag ${filterTypeClass('profile')}"><summary>${esc(titleCase(x.label))}</summary><div class="md-chipdd-body">${dynamicBlock(d)}</div></details>`;
    if (!isCC(x.profile)) return chipHTML('profile', titleCase(x.label));
    const side = x.side === 'discharge' ? 'discharge' : 'charge';
    const set = rateSet((d.rate_combinations || []).filter(r => r[side + '_profile'] === x.profile && r[side + '_c_rate'] != null), side);
    const body = `<div class="md-rates"><div class="md-rate-line">${esc(set || 'No C-rate data')}</div></div>`;
    return `<details class="md-chipdd dc-tag ${filterTypeClass('profile')}"><summary>${esc(titleCase(x.label))}</summary><div class="md-chipdd-body">${body}</div></details>`;
  }).join('');
  return `<div class="md-chips md-profile-items">${items}${singleItems}</div>`;
}

function openDatasetModal(id) {
  const d = ROWS.find(item => item.dataset_id === id);
  if (!d) { if (status !== 'ready') ensureLoaded().then(() => { if (ROWS.some(r => r.dataset_id === id)) openDatasetModal(id); }); return; }
  const unit = ENTITY_UNITS[d.entity_type] || 'cells';
  const field = (label, value, extra) => `<div class="modal-field${extra ? ' ' + extra : ''}"><div class="modal-label">${label}</div><div class="modal-value">${value}</div></div>`;
  document.getElementById('modal-name').textContent = d.dataset_name;
  document.getElementById('modal-refname').textContent = d.ref_name;
  const capacities = (d.nominal_capacities_Ah || []).slice().sort((a, b) => a - b);
  const chem = chemistryHTML(d), prof = profilesHTML(d);
  const cell = (label, inner) => `<div class="modal-field"><div class="modal-label">${label}</div>${inner}</div>`;
  const wide = (label, inner) => `<div class="modal-field modal-field--wide"><div class="modal-label">${label}</div>${inner}</div>`;
  /* first seven plain fields split evenly over two rows; chip fields (category, form factor, chemistry, profiles) share one row */
  const plain = [
    `<div class="modal-field"><div class="modal-label">ID</div><div class="modal-value mono">${esc(d.dataset_id)}</div></div>`,
    field('Year', esc(d.year != null ? d.year : '\u2014')),
    d.institution ? field('Institution', esc(d.institution)) : '',
    d.manufacturer ? field('Manufacturer', esc(d.manufacturer)) : '',
    d.n_entities != null ? field(titleCase(unit), esc(Number(d.n_entities).toLocaleString('en-US'))) : '',
    d.n_cycles_total ? field('Cycles', esc(Number(d.n_cycles_total).toLocaleString('en-US'))) : '',
    capacities.length ? field('Capacity', esc(capacities.map(c => fmtNum(c) + '\u00a0Ah').join(', '))) : ''
  ].filter(Boolean);
  /* 4 or fewer: one row of four columns. 5 or 6: two rows of three columns. 7: 4 + 3 on the four-column grid. */
  const n = plain.length, half = Math.ceil(n / 2), subrow = (items, cls) => `<div class="modal-field modal-field--wide modal-chiprow${cls ? ' ' + cls : ''}">${items.join('')}</div>`;
  const detailRows = n <= 4 ? [plain] : [plain.slice(0, half), plain.slice(half)], rowCls = (n === 5 || n === 6) ? 'modal-chiprow--thirds' : '';
  document.getElementById('modal-details').innerHTML = [
    ...detailRows.map(r => subrow(r, rowCls)),
    subrow([
      cell('Category', `<div class="md-chips">${chipHTML('category', getCatLabel(d.category))}</div>`),
      d.application_domain ? cell('Domain', `<div class="md-chips">${chipHTML('domain', domainLabel(d.application_domain))}</div>`) : '',
      cell('Form Factor', formFactorHTML(d)),
      chemistryCombos(d)[0] === UNKNOWN_CHEMISTRY ? '' : cell('Chemistry', chem)
    ].filter(Boolean)),
    prof ? wide('Profiles', prof) : '',   /* own row, all profiles on a single line */
    d.count_basis ? `<div class="modal-field modal-field--wide"><div class="modal-label">Count basis</div><div class="modal-value modal-value--note">${esc(d.count_basis)}</div></div>` : ''
  ].join('');

  /* Processing checklist and links stay with the dataset registry (the shared DATASETS list in main.js). */
  const lg = registryRow(d.dataset_id);
  const checks = ['meta', 'ts', 'cs', 'qc'], labels = ['Metadata', 'Time-series', 'Cycle Summary', 'QC'];
  document.getElementById('modal-checklist').innerHTML = checks.map((k, i) =>
    `<div class="check-item"><span class="ci-icon ${lg[k] === 'yes' ? 'ci-yes' : 'ci-no'}">${lg[k] === 'yes' ? '✓' : '—'}</span>${labels[i]}</div>`).join('');
  document.getElementById('modal-notes').textContent = d.notes || '';
  const hasDoi = lg.doi && lg.doi.startsWith('http');
  const hasProc = lg.processed_url && lg.processed_url.startsWith('http');
  const extIcon = `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  const dlIcon = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const qaIcon = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M8 15l2.3-4.2 2.4 2 3.3-6.1"/></svg>`;
  const track = type => `onclick="if(window.BatteryLakeAnalytics)BatteryLakeAnalytics.trackDatasetDownload({download_type:'${type}',dataset_id:'${escAttr(d.dataset_id)}',dataset_name:'${escAttr(lg.name || d.dataset_name)}'})"`;
  const row = (ok, href, label, icon, btn, type) => ok
    ? `<a class="modal-link-row modal-link-row--dl" href="${esc(href)}" target="_blank" rel="noopener noreferrer" ${track(type)}><span class="modal-link-label">${label}</span><span class="modal-link-dl-btn">${icon} ${btn}</span></a>`
    : `<div class="modal-link-row modal-link-row--na"><span class="modal-link-label">${label}</span><span class="modal-link-dl-btn modal-link-btn-na">${icon} ${btn}</span></div>`;
  const qa = `<button class="modal-link-row modal-link-row--dl" type="button" onclick="closeModal(); showDatasetQuality('${esc(d.dataset_id)}')"><span class="modal-link-label">Quality Report</span><span class="modal-link-dl-btn">${qaIcon} View</span></button>`;
  document.getElementById('modal-links').innerHTML = `<div class="modal-links-row">${row(hasDoi, lg.doi, 'Source Dataset', extIcon, 'Source', 'source_dataset')}${row(hasProc, lg.processed_url, 'Processed Dataset', dlIcon, 'Download', 'processed_dataset')}${qa}</div>`;
  document.getElementById('modal-links-section').style.display = 'block';
  document.getElementById('modal').classList.add('show'); document.documentElement.classList.add('modal-open');
}
function closeModal() { document.getElementById('modal').classList.remove('show'); document.documentElement.classList.remove('modal-open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });



/* ── loading ─────────────────────────────────────────────────────── */
function ensureLoaded() {
  if (status === 'ready') return Promise.resolve();
  if (status !== 'loading') {
    status = 'loading';
    ensureLoaded.promise = BatteryLakeDatasetMetadata.loadCatalog().then(rows => {
      /* aliases read by the assistant (knowledge base + agent tools) */
      ROWS = rows.map(d => Object.assign({}, d, {
        id: d.dataset_id, name: d.dataset_name,
        cells: d.n_entities != null ? String(d.n_entities) : '',
        cycles: d.n_cycles_total || 0,
        size_mb: d.raw_bytes ? d.raw_bytes / 1e6 : null
      }));
      ROWS.forEach(d => { d.chemistry = cathodeList(d); d.form = formStatLabel(d); });
      status = 'ready';
      buildFilterGrid();
      syncPendingFromActive(); renderChips(); filterDatasets();
    }).catch(err => {
      console.warn('Dataset metadata failed to load:', err && err.message);
      status = 'error'; filterDatasets();
    });
  }
  return ensureLoaded.promise;
}
function reload() { if (status === 'error') status = 'idle'; filterDatasets(); return ensureLoaded(); }

/* ── page-level entry points used by main.js ─────────────────────── */
function clearAllFilters() { FILTER_KEYS.forEach(k => active[k].clear()); allDatasetsApplied = false; }
/* Show one category (home-page tiles, #datasets-<category> links). */
function showCategory(cat) {
  clearAllFilters();
  active.cat.add(pageCat(cat));
  syncPendingFromActive(); renderChips(); filterDatasets();
}
function showAllCategories() { clearAllFilters(); syncPendingFromActive(); renderChips(); filterDatasets(); }
/* The search box was filled from outside (topbar search): leave "All datasets" mode and refresh. */
function searchChanged() { allDatasetsApplied = false; syncPendingFromActive(); renderChips(); filterDatasets(); }

window.DatasetsPage = { ensureLoaded, reload, showCategory, showAllCategories, searchChanged };
Object.assign(window, {
  filterDatasets, getFiltered, renderAppliedFilterChips: renderChips, syncPendingFromActive, removeAppliedFilter,
  toggleFilterTag, toggleAllDatasetsFilter, toggleDatasetFilters, closeDatasetFilters, applyDatasetFilters, clearPendingDatasetFilters,
  toggleDatasetCategorySection, toggleChipDD, changeSort, onSearchInput, clearSearch,
  openDatasetModal, closeModal, pendingChems, pendingForms, pendingCategories, pendingDomains, pendingDuties
});
renderDatasets([]);
setTimeout(ensureLoaded, 1200);   // start fetching shortly after startup so the first visit and the assistant find it ready
})();
