# Dataset records

[English](README.md) | [简体中文](README.zh-CN.md)

One `dataset_NN.json` per dataset, described by `../schema/batterylake-dataset-2.0.json`. These
files are read-only data. [../docs/pipeline.md](../docs/pipeline.md) explains where each value comes
from. Quality flags are defined in [../docs/flags.md](../docs/flags.md); the research-oriented layer
built on top of these records is in [../research/](../research/README.md).

Every value is read from the dataset's raw files — the measurement files, their names, and the
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

### Cell

| Field | Meaning |
|---|---|
| `cathode_chemistry` / `anode_chemistry` | Normalized to a controlled vocabulary. `mixed` means the dataset spans several; the per-cell value is then in `cells[]`. |
| `chemistry_label_raw` | The original chemistry string before normalization. |
| `cell_format_code` | The industry size code (`18650`, `21700`, `26650`, `14500`, `502030`) when one is stated or derivable. |
| `dimensions_mm.basis` | `stated` when a source gave dimensions, `inferred_from_format_code` when they were derived from the size code (an 18650 is 18 mm x 65 mm). Only the second is a convention rather than a measurement. |
| `capacity_basis` | `rated` is the manufacturer's nameplate figure; `measured` means the value is what the cells actually delivered. |
| `voltage_level` | `cell` or `pack`. Where the raw data reports pack voltage against per-cell cutoffs the two are not comparable (flag `pack_level_voltage`). |
| `voltage_min_V` / `voltage_max_V` | The protocol's cutoff window as documented, not the observed range. |

### Conditions

| Field | Meaning |
|---|---|
| `temperature_basis` | What the temperature figure is. `chamber_setpoint`: the commanded test temperature. `measured`: taken from the raw data, used where no setpoint is documented. `onset`: the value is an onset temperature (accelerating-rate calorimetry), not a test temperature. `unspecified`: none recorded. |
| `temperature_setpoints_C` | Every distinct temperature in the dataset (from documentation or raw names), so a multi-temperature study is visible as more than a min and max. |
| `charge_c_rate_max` / `discharge_c_rate_max` | The highest rate stated in the protocol text or encoded in raw names. `null` means none is stated, which is common for drive-cycle and field data. |
| `c_rate_profile` | The shape of the current, not its size: `constant`, `multistage`, `dynamic`, `drive_cycle`. |
| `protocol_class` | A coarse classification for filtering: `CC-CV`, `multistage_CC`, `drive_cycle`, `calendar_hold`, `pulse`, `RPT_only`, `abuse`, `mixed`. The verbatim text stays in `protocol_charge_raw` and `protocol_discharge_raw`. |
| `aging_type` | What ages the cell: `cyclic`, `calendar`, `profile` (a repeated load profile), `second_life`, `field`, `abuse_mechanical`, `abuse_thermal`, `characterization` (no aging), `mixed`. |
| `soc_window_*` | Percent, 0-100. |

### Scale

| Field | Meaning |
|---|---|
| `entity_type` | What one row in `cells[]` is: a `cell`, a `module`, or a `vehicle`. `n_entities` counts these, so it is not always a cell count. |
| `n_entities` vs `n_entities_declared` | Entities found in the raw data versus the count the registry declares. A gap sets `partial_raw`. |
| `n_cycles_total` | Cycles counted in the raw data: per file the number of distinct cycle ids, summed over files (testers restart the counter per file). For non-cycling datasets a unit is a test or a checkpoint, not a cycle; `content.cycle_basis` says which. |
| `cycles_per_entity_median` | The median per entity, which describes a dataset better than the total when cells differ widely in life. |
| `n_raw_files`, `raw_bytes` | Files and bytes at the top level of the dataset's raw data folder (archives count once). |

### Content

| Field | Meaning |
|---|---|
| `signals` | Channels found in the raw data, mapped to a controlled vocabulary by column name. Empty where the raw files carry no column names (datasets 12 and 30). |
| `signals_basis` | How `signals` was established: `raw_data` (column names read from the measurement files); `raw_docs`, `landing_page` or `paper` when the files carry no headers and the channels are taken from documentation, unverified against the files. `null` when there are no signals at all. |
| `raw_columns` | The raw headers behind `signals`, verbatim. |
| `has_waveforms` | True when per-sample voltage data exists, as opposed to per-cycle or per-test summary tables. |
| `cycle_basis` | What one cycle is in this dataset (see `n_cycles_total`). |
| `observed` | Ranges measured across all entities: `voltage_V`, `current_A`, `temperature_C`, `discharge_capacity_Ah`, `discharge_capacity_Ah_median_of_entity_max`, resistance and SOC where present. |
| `source_format` | File formats in the raw data (including inside archives): csv, mat, xlsx, pkl ... |
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
| `raw_evidence` | Reference to the per-entity raw extraction this record was built from. |
| `landing_evidence` | Reference to the landing pages and DOI records consulted. |

What each value of `field_sources` means:

| Value | Meaning | Typical fields |
|---|---|---|
| `raw_data` | Measured from the raw measurement files: headers, values, row and cycle counts. | `content.signals`, `content.observed`, `scale.n_entities`, `scale.n_cycles_total` |
| `raw_filenames` | Parsed from raw file or folder names (temperature, SOC, C-rate, cell id). | `conditions.temperature_setpoints_C`, `cells[].labels` |
| `raw_docs` | Read from a README, PDF or spreadsheet shipped with the raw data. | `cell.nominal_capacity_Ah`, `conditions.protocol_charge_raw` |
| `raw_inventory` | Counted from the raw file listing without opening the files. | `scale.n_raw_files`, `scale.raw_bytes`, `content.source_format` |
| `registry` | Taken from the registry, `dataset_registry.csv` (read-only). | `identity.dataset_name`, `identity.source_url`, `identity.ref_name`, `scale.n_entities_declared` |
| `landing_page` | Read from the dataset's public landing page (the registry's `source_url`), for a value the raw data does not state. | `cell.cathode_chemistry` on a dataset whose files carry only V and I |
| `paper` | Read from the linked paper (via its DOI), for a value neither the raw data nor the landing page states. | `cell.nominal_capacity_Ah` |
| `datasheet` | Read from the physical cell's own manufacturer datasheet (fetched by model number), for a value no source about the *dataset* states. | `cell.nominal_capacity_Ah`, `cell.voltage_min_V`/`voltage_max_V`, `cell.dimensions_mm` |
| `relationships` | Taken from the hand-maintained record of which datasets share an upstream study. | `identity.study_group` |
| `ref_name` | Parsed out of the reference name. | `identity.year` |
| `derived` | Computed from another field by a fixed rule; no new information. | `cell.dimensions_mm`, `quality.flags` |
| `curated` | A human judgement grounded in a named source. | `conditions.aging_type`, `content.supported_tasks`, `scale.entity_type` |

The point of `field_sources` is that a `null` and a checked absence look identical without it, and a
consumer that wants only measured facts can filter to `raw_data`, `raw_filenames` and `raw_inventory`.

## Conventions

- **Missing is `null`**, never `"unknown"`, `"ambient"`, `"dynamic"` or `0`. Placeholder strings are
  never used.
- **Units are in the field name** (`_Ah`, `_V`, `_C`, `_pct`). Ranges are two numeric fields, or a
  two-element `[min, max]` under `content.observed`, never a string such as `"10/25/35/45"`.
- **Controlled vocabularies** are defined in `$defs` in the dataset schema; the raw source text is
  preserved alongside in `*_raw` fields so nothing is lost.
- **Cells carry only overrides.** A `cells[]` entry lists a field only where that cell differs from
  the dataset-level value; `iter_cells()` resolves them.
- **Units are never guessed from magnitude.** A unit comes from a column name or the author's
  documentation; where neither states one the value is left out.
