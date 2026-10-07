/* Loader for the metadata/ folder, shaped for the Datasets page (js/datasets-page.js).
 *
 *   const rows = await BatteryLakeDatasetMetadata.loadCatalog();
 *
 * One flat row per dataset, built from three sources:
 *   metadata/index.json            the dataset list (ids and order)
 *   metadata/datasets/<id>.json    identity, cell, conditions, scale and content blocks
 *   metadata/index_research.json   the Datasets-page category
 * Beyond renaming and flattening, only three things are derived here, because the records do not store them:
 * the charge and discharge profile lists (the profiles of the record's pairs plus its single-side entries) and the
 * label of each single-side entry ("CC Charging"). A metadata fix shows up on the page as soon as the file is deployed.
 * A dataset without a record is dropped; one without a research row gets category ''. */
(() => {
  'use strict';

  const BASE = new URL('metadata/', document.baseURI).href;
  const cache = new Map();

  function fetchJSON(path) {
    if (!cache.has(path)) {
      const request = fetch(BASE + path).then(res => {
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        return res.json();
      });
      // a failed fetch must not stay cached, or the page could never retry
      request.catch(() => cache.delete(path));
      cache.set(path, request);
    }
    return cache.get(path);
  }

  const list = v => (Array.isArray(v) ? v : []);

  /* The profile types of one side: those of the pairs plus the single-side entries, sorted like the metadata's own lists. */
  function profileList(side, combos, singles) {
    const found = new Set(combos.map(p => p[side]).filter(Boolean));
    singles.filter(x => x.side === side).forEach(x => found.add(x.profile));
    return [...found].sort();
  }
  const sideLabel = x => x.profile + (x.side === 'charge' ? ' Charging' : ' Discharging');

  /* A per-dataset record -> the flat row the page reads. */
  function toRow(rec, research) {
    const id = rec.identity || {}, cell = rec.cell || {}, cond = rec.conditions || {}, scale = rec.scale || {}, content = rec.content || {};
    const combos = list(cond.profile_combinations);
    const singles = list(cond.single_side_profiles).map(x => ({ ...x, label: sideLabel(x) }));
    return {
      dataset_id: rec.dataset_id,
      ref_name: id.ref_name,
      dataset_name: id.dataset_name,
      notes: id.notes,
      institution: id.institution,
      year: id.year,
      manufacturer: cell.manufacturer,
      category: research ? research.category : '',
      application_domain: cond.application_domain,
      form_factors: list(cell.form_factors),
      cell_format_codes: list(cell.cell_format_codes),
      cathode_chemistries: list(cell.cathode_chemistries),
      anode_chemistries: list(cell.anode_chemistries),
      electrode_combinations: list(cell.electrode_combinations),
      nominal_capacities_Ah: list(cell.nominal_capacities_Ah),
      charge_profiles: profileList('charge', combos, singles),
      discharge_profiles: profileList('discharge', combos, singles),
      profile_combinations: combos,
      single_side_profiles: singles,
      dynamic_subprofiles: list(cond.dynamic_subprofiles),
      rate_combinations: list(cond.rate_combinations),
      charge_c_rate_max: cond.charge_c_rate_max,
      discharge_c_rate_max: cond.discharge_c_rate_max,
      charge_c_rate_max_fraction: cond.charge_c_rate_max_fraction,
      discharge_c_rate_max_fraction: cond.discharge_c_rate_max_fraction,
      entity_type: scale.entity_type,
      n_entities: scale.n_entities,
      n_cycles_total: scale.n_cycles_total,
      raw_bytes: scale.raw_bytes,
      count_basis: content.count_basis,
    };
  }

  let catalog = null;
  function loadCatalog() {
    if (!catalog) {
      catalog = Promise.all([fetchJSON('index.json'), fetchJSON('index_research.json')]).then(async ([index, researchIndex]) => {
        const research = new Map(list(researchIndex.datasets).map(r => [r.dataset_id, r]));
        const records = await Promise.all(list(index.datasets).map(r => fetchJSON(`datasets/${r.dataset_id}.json`)));
        return records.map(rec => toRow(rec, research.get(rec.dataset_id)));
      });
      catalog.catch(() => { catalog = null; });   // allow a retry after a failed load
    }
    return catalog;
  }

  window.BatteryLakeDatasetMetadata = { loadCatalog, toRow };
})();
