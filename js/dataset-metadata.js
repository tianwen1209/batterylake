/* Loader for the metadata/ folder, shaped for the Datasets page (js/datasets-page.js).
 *
 *   const rows = await BatteryLakeDatasetMetadata.loadCatalog();
 *
 * One flat row per dataset, built from two files (the per-dataset records are not read):
 *   metadata/index.json            the dataset list (ids and order) and the fields the cards and filters use
 *   metadata/index_research.json   the Datasets-page category
 * Only the label of each single-side entry ("CC Charging") is derived here, because the index does not store it.
 * loadDetail(id) reads one record on demand, for the few popup-only fields the index does not carry
 * (count_basis and the max C-rate fractions). A metadata fix shows up on the page as soon as the file is deployed.
 * A dataset without an index entry is not listed; one without a research row gets category ''. */
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

  const sideLabel = x => x.profile + (x.side === 'charge' ? ' Charging' : ' Discharging');

  /* An index entry -> the flat row the page reads. */
  function toRow(entry, research) {
    return {
      ...entry,
      form_factors: list(entry.form_factors),
      cell_format_codes: list(entry.cell_format_codes),
      cathode_chemistries: list(entry.cathode_chemistries),
      anode_chemistries: list(entry.anode_chemistries),
      electrode_combinations: list(entry.electrode_combinations),
      nominal_capacities_Ah: list(entry.nominal_capacities_Ah),
      charge_profiles: list(entry.charge_profiles),
      discharge_profiles: list(entry.discharge_profiles),
      profile_combinations: list(entry.profile_combinations),
      single_side_profiles: list(entry.single_side_profiles).map(x => ({ ...x, label: sideLabel(x) })),
      dynamic_subprofiles: list(entry.dynamic_subprofiles),
      rate_combinations: list(entry.rate_combinations),
      category: research ? research.category : ''
    };
  }

  /* The popup-only fields of one dataset, from its record and its research profile.
   * A dataset without a research profile keeps has_temperature_timeseries undefined. */
  function loadDetail(id) {
    const research = fetchJSON(`research/${id}.json`).catch(() => null);
    return Promise.all([fetchJSON(`datasets/${id}.json`), research]).then(([rec, profile]) => {
      const cond = rec.conditions || {};
      return {
        charge_c_rate_max_fraction: cond.charge_c_rate_max_fraction,
        discharge_c_rate_max_fraction: cond.discharge_c_rate_max_fraction,
        count_basis: (rec.content || {}).count_basis,
        has_temperature_timeseries: profile ? (profile.timeseries || {}).has_temperature_timeseries : undefined
      };
    });
  }

  let catalog = null;
  function loadCatalog() {
    if (!catalog) {
      catalog = Promise.all([fetchJSON('index.json'), fetchJSON('index_research.json')]).then(([index, researchIndex]) => {
        const research = new Map(list(researchIndex.datasets).map(r => [r.dataset_id, r]));
        return list(index.datasets).map(entry => toRow(entry, research.get(entry.dataset_id)));
      });
      catalog.catch(() => { catalog = null; });   // allow a retry after a failed load
    }
    return catalog;
  }

  window.BatteryLakeDatasetMetadata = { loadCatalog, loadDetail, toRow };
})();
