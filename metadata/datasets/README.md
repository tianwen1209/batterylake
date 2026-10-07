# Dataset records

[English](README.md) | [简体中文](README.zh-CN.md)

One `dataset_NN.json` per dataset, described by `../schema/batterylake-dataset-2.0.json`. These
files are **build outputs** — never edit them; see [../docs/pipeline.md](../docs/pipeline.md) for
how to correct a value. Quality flags are defined in [../docs/flags.md](../docs/flags.md); the
research-oriented layer built on top of these records is in [../research/](../research/README.md).

Every value is read from `Raw_Dataset/` — the measurement files, their names, and the
documentation shipped with them. Where those cannot supply a value, it is taken from the dataset's
landing page or paper (as listed in the registry) and cited as such. **Nothing is read from a
delivery URL.** A field that no source documents is `null`.

## Reading a record

- **`null` means not documented.** Nominal capacity, chemistry or a voltage window is `null` when
  neither the raw data, its documentation nor the landing page states it. It never means zero.
- **`content.observed` is measured; `cell.*` is documented.** `observed` holds the ranges seen in
  the raw data (voltage, current, temperature, discharge capacity, resistance ...); `cell.voltage_min_V`
  and `voltage_max_V` are the protocol's cutoffs. They can disagree — see the excursion flags.
- **Check `quality.flags` before using a dataset for a task.** `usable_for()` in `read.py` takes
  the flags to exclude as an argument, so each consumer decides which ones block it.

```python
soh_ready = usable_for(index, "SOH", exclude_flags=(
    "capacity_exceeds_nominal", "duplicate_of_other_dataset"))
```

## Field reference

Fields whose meaning is not obvious from the name. Everything else is what it says.

### Identity

| Field | Meaning |
|---|---|
| `ref_name` | The project's reference name, `YEAR_INSTITUTION_CHEMISTRY_FORMAT_CONDITIONS`, from the registry (or the raw README when the registry has none). |
| `ref_name_aliases` | Every other name the dataset has gone by, so an old reference still resolves. Each entry has `name`, `status` (`historical`: a superseded name for the same study; `mismatched`: a name that belongs to a different study) and `seen_in` (`registry_history` for a name the registry carried in an earlier commit, `raw_readme` for the raw README's "Other names" line). The index row carries the names only. |
| `doi` vs `paper_doi` | `doi` identifies the dataset itself; `paper_doi` the publication describing it. Each is recorded only where the registry's landing pages, the raw documentation or the landing-page metadata state it. Often only one exists. |
| `source_url` | Where the data came from upstream, from the registry. |
| `notes` | A one-line description in the registry's style, e.g. `94 LFP/graphite 18650 cells (124 declared); multi-policy fast charging ...; Severson et al. Nature Energy 2019`. It leads with the count, chemistry and format of what the raw data delivers (`scale.n_entities`, with the declared count in brackets when it differs), then a few curated facts about the tests, then the linked paper (`paper_doi`). Counts, chemistry and the citation are composed by `build.py` from this record's own fields, so they cannot drift from it; the middle clauses restate `conditions.*`, `content.*` and `quality.notes`. It is the text to show readers. `quality.notes` is different: it records caveats and source conflicts for people working with the data, and may mention the registry's mistakes. |

### Cell

| Field | Meaning |
|---|---|
| `chemistry_label_raw` | The original chemistry string before normalization. |
| `dimensions_mm.basis` | `stated` when a source gave dimensions, `inferred_from_format_code` when they were derived from the size code (an 18650 is 18 mm x 65 mm). Only the second is a convention rather than a measurement. |
| `capacity_basis` | `rated` is the manufacturer's nameplate figure; `measured` means the value is what the cells actually delivered. |
| `voltage_level` | `cell` or `pack`. Where the raw data reports pack voltage against per-cell cutoffs the two are not comparable (flag `pack_level_voltage`). |
| `voltage_min_V` / `voltage_max_V` | The protocol's cutoff window as documented, not the observed range. |
| `form_factors` / `cell_format_codes` | Every form factor (`cylindrical`, `pouch`, `prismatic`, `pack` ...) and every size code (`18650`, `21700`, `502030` ...) present in the dataset, from a stated size code or one derivable from the model. Empty when none is documented. |
| `cathode_chemistries` / `anode_chemistries` | Every cathode and every anode chemistry present, as separate sorted lists, normalized to a controlled vocabulary. Empty when none is documented. Two or more entries mean the dataset spans several (`chemistry_is_multi`), and the per-cell value is then in `cells[]`. There is no single-value field for these, nor for form factor or size code: a reader that wants one value takes the list when it has exactly one entry. |
| `electrode_combinations` | The cathode-anode pairs that occur together on the same cells, as `{cathode, anode}` objects. A pair is left out when either electrode is undocumented. |
| `nominal_capacities_Ah` | Every nominal capacity present as a discrete, sorted value (the per-cell values in `cells[]` plus the dataset-level one). In datasets 34 and 35 some per-cell values come from file names or measured means rather than ratings; the dataset notes say which. |

### Conditions

| Field | Meaning |
|---|---|
| `temperature_basis` | What the temperature figure is. `chamber_setpoint`: the commanded test temperature. `measured`: taken from the raw data, used where no setpoint is documented. `onset`: the value is an onset temperature (accelerating-rate calorimetry), not a test temperature. `unspecified`: none recorded. |
| `temperature_setpoints_C` | Every distinct temperature in the dataset (from documentation or raw names), so a multi-temperature study is visible as more than a min and max. |
| `charge_c_rate_max` / `discharge_c_rate_max` | The highest rate stated in the protocol text or encoded in raw names. `null` means none is stated, which is common for drive-cycle and field data. |
| `c_rate_profile` | The shape of the current, not its size: `constant`, `multistage`, `dynamic`, `drive_cycle`. |
| `protocol_class` | A coarse classification for filtering: `CC-CV`, `multistage_CC`, `drive_cycle`, `calendar_hold`, `pulse`, `RPT_only`, `abuse`, `mixed`. The verbatim text stays in `protocol_charge_raw` and `protocol_discharge_raw`. |
| `charging_profile` | The cycling profile type, taken from the dominant protocol and read only from the raw files and the documentation shipped with them: `CC-CV` (one standard constant-current then constant-voltage protocol, with the same charge and discharge rates for every cell and cycle), `dynamic` (a time-varying load: pulses, HPPC, drive-cycle or duty-cycle profiles), `multi-rate` (the charge or discharge C-rate differs from cycle to cycle within a cell, or between the cells of the dataset). When a dataset mixes types, the one covering most cells wins and `quality.notes` names the others. `null` where the raw files and documentation do not show the protocol; `quality.notes` says why. Unlike `protocol_class`, which keyword-classifies the protocol text, this is cited in `provenance.field_sources` to the measurement files or documents it was read from. |
| `profile_combinations` | The charging and discharging profile types applied together, as `{charge, discharge}` objects. A pair is left out when either profile is undocumented. Charging types: `CC`, `CC-CV`, `multi-stage CC`, `multi-stage CC-CV`, `pulse`, `dynamic`. Discharging types: `CC`, `CC-CV`, `multi-stage CC`, `pulse`, `dynamic`. `dynamic` is a time-varying current or power profile (drive cycle, duty cycle, mission). A dataset's list of charge profiles and of discharge profiles is not stored: it is the profiles of these pairs plus `single_side_profiles` (the index carries the derived lists as `charge_profiles` and `discharge_profiles`). |
| `single_side_profiles` | Profiles that sit in no charge/discharge pair because the data covers one side only (charging snippets from a vehicle, discharge-only tests), as `{side, profile}`. A frontend writes the chip label as the profile plus "Charging" or "Discharging" ("CC Charging", "dynamic Discharging") and shows each as its own chip beside the pairs. Empty when every profile is in a pair. |
| `dynamic_subprofiles` | What the `dynamic` profile consists of, as `{name, kind, detail}`: `name` is the profile (`UDDS`, `WLTP`, `Artemis Urban`, `Square wave`, `eVTOL mission`, `Residential grid-storage duty cycle`), `kind` is `drive_cycle`, `real_driving`, `duty_cycle` or `square_wave`, and `detail` is free text (parameters, which cells) or `null`. Filled for every dataset with a dynamic profile, empty otherwise (`validate.py` enforces both). Each entry was checked against the raw files (file or sheet names, current waveforms) and the evidence is in `provenance.field_sources`. HPPC and other pulse tests are not listed here. |
| `rate_combinations` | The C-rates the sources state, as one list of rows `{charge_profile, charge_c_rate, discharge_profile, discharge_c_rate}`. A row belongs to a pair in `profile_combinations`, or to one profile in `single_side_profiles` (the other side's profile is then `null`). `charge_c_rate` is the constant-current stage. A rate is `null` where no source gives it for that side, for example a dynamic or multi-stage side (a pulse side may carry its pulse currents). One rate facing several on the other side is repeated on each row; several facing several, when the source does not say which meets which, get rows of their own with the other rate `null`, so no pairing is invented. Empty where no rate is documented; the dataset notes say why. A row whose charge or discharge side is `dynamic` also carries `charge_subprofile` or `discharge_subprofile`, the name of the `dynamic_subprofiles` entry that side runs, so a row reads "0.75C → Square wave" instead of "0.75C → Dynamic"; a dataset with several dynamic profiles has one row per rate and profile it was run with. |
| `charge_c_rate_max_fraction` / `discharge_c_rate_max_fraction` | The exact fraction of 1C (`"1/3"`, `"5/3"`) when the source writes the maximum rate as a fraction and the decimal recurs; `null` otherwise. See *Displaying C-rates* below. |
| `aging_type` | What ages the cell: `cyclic`, `calendar`, `profile` (a repeated load profile), `second_life`, `field`, `abuse_mechanical`, `abuse_thermal`, `characterization` (no aging), `mixed`. |
| `soc_window_*` | Percent, 0-100. |

#### Displaying C-rates

C-rates are numbers in multiples of 1C, in `charge_c_rate_max`, `discharge_c_rate_max` and inside every `rate_combinations` entry. How to show them:

- **Rounding.** A rate measured from the raw current (an estimate, cited as `raw_data` in the provenance) is rounded to 2 decimals. A rate the source states (a paper, a readme, file names, the authors' tables) keeps the precision the source gives, up to 4 decimals for recurring ones such as `0.3333`.
- **Fractions.** When the source writes a rate as a fraction and its decimal recurs (C/3, 5/3 C), the record also carries the exact fraction as a string `"n/d"` in the matching field: `charge_c_rate_max_fraction` and `discharge_c_rate_max_fraction` in `conditions`, and `charge_c_rate_fraction` and `discharge_c_rate_fraction` inside a `rate_combinations` entry. The scalar fields are `null` and the entry fields are absent when there is no fraction.
- **Frontend rule.** If the fraction field is present, show the fraction of C: `"1/3"` as `C/3`, `"5/3"` as `5C/3`, `"2/3"` as `2C/3`. If it is absent, show the decimal. Do not try to turn a decimal into a fraction yourself: `3.33` in dataset 19 is the paper's own decimal, not 10/3. Rates that terminate (0.5, 0.2, 0.05) are always decimals and never carry a fraction.
- **Consistency.** Every fraction string is checked against its numeric value to within 0.0001, so the number is always safe to sort and filter on.

### Scale

| Field | Meaning |
|---|---|
| `entity_type` | What one row in `cells[]` is: a `cell`, a `module`, or a `vehicle`. `n_entities` counts these, so it is not always a cell count. |
| `n_entities` vs `n_entities_declared` | Entities found in the raw data versus the count the registry declares. A gap sets `partial_raw`. |
| `n_cycles_total` | Cycles counted in the raw data: per file the number of distinct cycle ids, summed over files (testers restart the counter per file). For non-cycling datasets a unit is a test or a checkpoint, not a cycle; `content.cycle_basis` says which. |
| `cycles_per_entity_median` | The median per entity, which describes a dataset better than the total when cells differ widely in life. |
| `n_raw_files`, `raw_bytes` | Files and bytes at the top level of the dataset's `Raw_Dataset` folder (archives count once). |

### Content

| Field | Meaning |
|---|---|
| `signals` | Channels found in the raw data, mapped to a controlled vocabulary by column name. Empty where the raw files carry no column names (datasets 12 and 30). |
| `signals_basis` | How `signals` was established: `raw_data` (column names read from the measurement files); `raw_docs`, `landing_page` or `paper` when the files carry no headers and the channels are taken from documentation, unverified against the files. `null` when there are no signals at all. |
| `raw_columns` | The raw headers behind `signals`, verbatim. |
| `has_waveforms` | True when per-sample voltage data exists, as opposed to per-cycle or per-test summary tables. |
| `cycle_basis` | What one cycle is in this dataset (see `n_cycles_total`). |
| `count_basis` | What the entity and cycle counts count (the unit, the scope and any exclusions), in the data publisher's or registry's own scope; it can differ from `n_entities` and `n_cycles_total`, which are counted from the delivered files. `null` when the registry gives no basis. |
| `observed` | Ranges measured across all entities: `voltage_V`, `current_A`, `temperature_C`, `discharge_capacity_Ah`, `discharge_capacity_Ah_median_of_entity_max`, resistance and SOC where present. |
| `source_format` | File formats in `Raw_Dataset` (including inside archives): csv, mat, xlsx, pkl ... |
| `supported_tasks` | Tasks the dataset can support in principle, from the raw documentation. Check `quality.flags` as well — a dataset can list SOH and still be unusable for it. |

### Cells

`cells[]` stores **only the fields where a cell differs from the dataset-level value**, so a
uniform dataset gives one line per cell. `read.py`'s `iter_cells()` resolves each cell against
the dataset defaults and yields complete rows.

| Field | Meaning |
|---|---|
| `cell_id` | The entity id found in the raw data (file stem, folder or in-file id). Unique within a dataset. |
| `labels` | Source-provided labels kept verbatim: `anomaly_label` (12), `fault_label` (30), `observed_score` and `calculated_score` (34), SOC windows and C-rates encoded in raw names. |

### Provenance

`provenance` records where a record's values came from.

| Field | Meaning |
|---|---|
| `field_sources` | Maps a field path, or a group with `*`, to where its value came from. The values are listed below. |
| `confidence` | `verified` when the raw data was parsed, `asserted` when values were taken on trust from documentation only. |
| `last_verified` | When the raw data was last read, so a stale record is visible. |
| `raw_evidence` | The per-entity evidence file this record was built from, `evidence/raw/dataset_NN.json`. |
| `landing_evidence` | The cached landing pages and DOI records consulted, `evidence/landing/dataset_NN.json`. |

What each value of `field_sources` means:

| Value | Meaning | Typical fields |
|---|---|---|
| `raw_data` | Measured from the raw measurement files: headers, values, row and cycle counts. | `content.signals`, `content.observed`, `scale.n_entities`, `scale.n_cycles_total` |
| `raw_filenames` | Parsed from raw file or folder names (temperature, SOC, C-rate, cell id). | `conditions.temperature_setpoints_C`, `cells[].labels` |
| `raw_docs` | Read from a README, PDF or spreadsheet shipped inside `Raw_Dataset`. | `cell.nominal_capacity_Ah`, `conditions.protocol_charge_raw` |
| `raw_inventory` | Counted from the raw file listing without opening the files. | `scale.n_raw_files`, `scale.raw_bytes`, `content.source_format` |
| `registry` | Taken from the sibling project's `dataset_registry.csv` (read-only). | `identity.dataset_name`, `identity.source_url`, `identity.ref_name`, `scale.n_entities_declared` |
| `landing_page` | Read from the dataset's public landing page (the registry's `source_url`), for a value the raw data does not state. | `cell.cathode_chemistries` on a dataset whose files carry only V and I |
| `paper` | Read from the linked paper (via its DOI), for a value neither the raw data nor the landing page states. | `cell.nominal_capacity_Ah` |
| `datasheet` | Read from the physical cell's own manufacturer datasheet (fetched by model number), for a value no source about the *dataset* states. | `cell.nominal_capacity_Ah`, `cell.voltage_min_V`/`voltage_max_V`, `cell.dimensions_mm` |
| `relationships` | Taken from `source_relationships.json`, the hand-maintained note of which datasets share an upstream study. | `identity.study_group` |
| `ref_name` | Parsed out of the reference name. | `identity.year` |
| `derived` | Computed from another field by a fixed rule; no new information. | `cell.dimensions_mm`, `quality.flags` |
| `curated` | A human judgement recorded in `curation/dataset_curation.json`. | `conditions.aging_type`, `content.supported_tasks`, `scale.entity_type` |

The point of `field_sources` is that a `null` and a checked absence look identical without it, and a
consumer that wants only measured facts can filter to `raw_data`, `raw_filenames` and `raw_inventory`.

## Conventions

- **Missing is `null`**, never `"unknown"`, `"ambient"`, `"dynamic"` or `0`. `validate.py` rejects
  placeholder strings.
- **Units are in the field name** (`_Ah`, `_V`, `_C`, `_pct`). Ranges are two numeric fields, or a
  two-element `[min, max]` under `content.observed`, never a string such as `"10/25/35/45"`.
- **Controlled vocabularies** are defined in `$defs` in the dataset schema; the raw source text is
  preserved alongside in `*_raw` fields so nothing is lost.
- **Cells carry only overrides.** A `cells[]` entry lists a field only where that cell differs from
  the dataset-level value; `iter_cells()` resolves them.
- **Units are never guessed from magnitude.** A unit comes from a column name or the author's
  documentation; where neither states one the value is left out.
