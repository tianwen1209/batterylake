# BatteryLake metadata

[English](README.md) | [简体中文](README.zh-CN.md)

Machine-readable dataset metadata: **one JSON record per dataset** plus a **global index**
that is the single source of truth for dataset pages, the benchmark, the data platform and
the studio. A second, research-oriented layer says what each dataset can be used for.

Every value is read from the dataset's raw files: the measurement files themselves, their names and
folder layout, and the documentation shipped with them. Where the raw data cannot supply a field,
the fallback is the dataset's public landing page and its linked paper, as named by
<<<<<<< Updated upstream
`dataset_registry.csv` and the dataset and paper DOIs. Delivery URLs are not a source. A field
=======
`dataset_registry.csv` and the dataset and paper DOIs. A field
>>>>>>> Stashed changes
that no source documents is `null`.

## Where to look

| I want to... | Read |
|---|---|
| query the metadata from code | [Reading it](#reading-it) below |
| understand a field or a provenance value | [datasets/README.md](datasets/README.md) |
| know what a quality flag means | [docs/flags.md](docs/flags.md) |
| find which datasets suit SOH, RUL, digital-twin, thermal, simulation or synthetic-data work | [research/README.md](research/README.md) |
| see where a value came from and how far to trust it | [docs/pipeline.md](docs/pipeline.md) |

```
metadata/
<<<<<<< Updated upstream
  index.json                  <- read this first: one row per dataset + facet vocabularies
  index_research.json         <- filterable index of the research profiles in research/
  README.md / README.zh-CN.md this overview (English / Simplified Chinese)
  datasets/                   full records, including per-cell rows
    README.md / README.zh-CN.md   field reference, provenance, conventions
    dataset_NN.json               40 records (dataset_01 .. dataset_41, no dataset_10)
  research/                   research-oriented profiles built from datasets/
    README.md / README.zh-CN.md   what each field means and how it is derived
    dataset_NN.json               40 profiles
  docs/
    flags.md / flags.zh-CN.md         quality flag vocabulary
    pipeline.md / pipeline.zh-CN.md   where each value comes from and how far to trust it
  schema/
    batterylake-dataset-2.0.json         record schema
    batterylake-index-2.0.json           index schema
    batterylake-research-2.0.json        research profile schema
    batterylake-research-index-2.0.json  research index schema
  read.py                     dependency-free reader used by the benchmark and platform
=======
├── index.json                     read this first: one row per dataset + facet vocabularies
├── index_research.json            filterable index of the research profiles in research/
├── read.py                        dependency-free reader used by the benchmark and platform
├── README.md, README.zh-CN.md     this overview (English / Simplified Chinese)
│
├── datasets/                      full records, including per-cell rows
│   ├── README.md, README.zh-CN.md     field reference, provenance, conventions
│   └── dataset_NN.json                40 records (dataset_01 .. dataset_41, no dataset_10)
│
├── research/                      research-oriented profiles built from datasets/
│   ├── README.md, README.zh-CN.md     what each field means and how it is derived
│   └── dataset_NN.json                40 profiles
│
├── docs/
│   ├── flags.md, flags.zh-CN.md           quality flag vocabulary
│   └── pipeline.md, pipeline.zh-CN.md     where each value comes from, how far to trust it
│
└── schema/
    ├── batterylake-dataset-2.0.json           record schema
    ├── batterylake-index-2.0.json             index schema
    ├── batterylake-research-2.0.json          research profile schema
    └── batterylake-research-index-2.0.json    research index schema
>>>>>>> Stashed changes
```

## Reading it

### The index is the entry point

`index.json` carries `counts`, `facets` and `datasets`. Filter on `datasets`, then open
a record through `record_path` only when per-cell detail is needed. `facets` lists every
value present for each filterable field, so a filter UI never has to scan the rows.

```python
from metadata.read import load_index, find, load_record, iter_cells, usable_for, by_ref_name

index = load_index()
<<<<<<< Updated upstream
find(index, cathode_chemistry="LFP", form_factor="cylindrical", min_n_entities=10)
=======
find(index, cathode_chemistry="LFP", form_factor="cylindrical", min_n_entities=10)   # single-value names filter the lists: LFP among the cathodes
>>>>>>> Stashed changes
find(index, application_domain=["EV_field", "HEV"], supported_tasks="SOH")
record = load_record("dataset_41")
by_ref_name(index, "2021_KIT_NMC-SiO_18650_MultiC_MultiT")   # an old name still finds dataset_14
for cell in iter_cells(record):       # dataset defaults resolved into each cell
    print(cell["cell_id"], cell["nominal_capacity_Ah"], cell["temperature_C"])
```

```ts
// dataset page / studio: the index is plain JSON, no loader needed
import index from "../metadata/index.json";

const rows = index.datasets.filter(
<<<<<<< Updated upstream
  (d) => d.cathode_chemistry === "NMC" && d.n_entities >= 20,
);
const options = index.facets.form_factor;          // build filter controls
=======
  (d) => d.cathode_chemistries.includes("NMC") && d.n_entities >= 20,
);
const options = index.facets.form_factors;         // build filter controls
>>>>>>> Stashed changes
const record = await fetch(`/metadata/${rows[0].record_path}`).then((r) => r.json());
```

### From the index to a value

1. **Filter the index.** `find(index, ...)` returns index rows; `facets(index)` lists the values
   each filter accepts; `by_ref_name(index, name)` resolves a current or superseded reference name.
2. **Open the record** with `load_record(row["dataset_id"])` only when you need more than the row
   holds. `iter_cells(record)` yields one complete row per cell, with dataset-level values filled in.
3. **Treat `null` as "not documented"**, never zero. `provenance.field_sources` says where every
   filled field came from, and `content.observed` holds what the raw data actually measured.
4. **Check `quality.flags`** ([docs/flags.md](docs/flags.md)) before using a dataset for a task.
   `usable_for(index, task, exclude_flags=...)` applies that check across the index.
5. **For modelling suitability**, use `index_research.json` and the profile in `research/`
   ([research/README.md](research/README.md)).

### Fields worth filtering on

<<<<<<< Updated upstream
`cathode_chemistry`, `anode_chemistry`, `form_factor`, `cell_format_code`,
`manufacturer`, `institution`, `year`, `aging_type`, `application_domain`,
`protocol_class`, `c_rate_profile`, `entity_type`, `supported_tasks`, `signals`,
`source_format`, `quality_flags`, and the numeric ranges `nominal_capacity_Ah`,
`nominal_voltage_V`, `voltage_min_V` / `voltage_max_V`, `temperature_min_C` /
`temperature_max_C`, `charge_c_rate_max` / `discharge_c_rate_max`, `n_entities`, `raw_bytes`.
=======
| Group | Fields |
|---|---|
| Identity | `institution`, `year`, `manufacturer` |
| Cell | `cathode_chemistries`, `anode_chemistries`, `form_factors`, `cell_format_codes` |
| Test conditions | `aging_type`, `application_domain`, `protocol_class`, `charging_profile`, `c_rate_profile`, `charge_profiles`, `discharge_profiles` |
| Scale and content | `entity_type`, `supported_tasks`, `signals`, `source_format` |
| Quality | `quality_flags` |
| Numeric ranges (`min_` / `max_` prefix) | `nominal_capacity_Ah`, `nominal_voltage_V`, `voltage_min_V`, `voltage_max_V`, `temperature_min_C`, `temperature_max_C`, `charge_c_rate_max`, `discharge_c_rate_max`, `n_entities`, `raw_bytes` |
>>>>>>> Stashed changes

## Coverage as built

40 datasets, 3,451 entities (cells, modules or vehicles, as `entity_type` says), 4,135 raw files,
300.8 GB, and a sum of 7,848,847 recorded cycle counts. Count definitions differ by dataset;
<<<<<<< Updated upstream
read `content.cycle_basis` before comparing them. All 40 datasets were parsed from their raw files
(`provenance.confidence: verified`); known missing, unreadable and unparsed inputs are noted in each record.

| Field | Datasets with a value |
|---|---:|
| cathode chemistry | 36 of 40 |
| form factor | 36 of 40 |
| nominal capacity | 29 of 40 |
| complete voltage cutoffs | 23 of 40 |
| DOI of the dataset / of its paper | 31 / 14 of 40 |
| named signals | 38 of 40 (12 and 30 store unlabelled channels) |
| cycle count | 29 of 40 (11 remain null, including cycling datasets 19, 36 and 37) |

Some fields stay `null` because the raw data and its documentation do not state them — nominal
capacity for many datasets, for example, appears only in a paper that ships with neither the data nor its README. `datasets/README.md` explains how to read a `null`, and `provenance.field_sources` in
each record says where every filled field came from.
=======
read `content.cycle_basis` and `content.count_basis` before comparing them. All 40 datasets were parsed from their raw files
(`provenance.confidence: verified`); known missing, unreadable and unparsed inputs are noted in each record.

Every field that is `null` in at least one dataset, with the number of datasets (out of 40) where it is
missing. Fields not listed are filled in all 40. `dimensions_mm` counts a dataset only when none of its
dimensions is known; `ref_name_aliases` and `study_group` are left out because most datasets legitimately
have neither. `observed.*` are `content.observed` ranges and are `null` where the raw data has no such channel.

| Group | Field | Datasets with `null` |
|---|---|---:|
| identity | `paper_doi` | 5 |
| identity | `doi` | 8 |
| cell | `nominal_voltage_V` | 26 |
| cell | `manufacturer` | 17 |
| cell | `model` | 19 |
| cell | `voltage_level` | 8 |
| cell | `voltage_max_V` | 8 |
| cell | `voltage_min_V` | 7 |
| cell | `capacity_basis` | 10 |
| cell | `dimensions_mm` | 11 |
| cell | `nominal_capacity_Ah` | 13 |
| cell | `anode_chemistries` | 13 |
| cell | `electrode_combinations` | 13 |
| cell | `cell_format_codes` | 8 |
| cell | `cathode_chemistries` | 1 |
| cell | `nominal_capacities_Ah` | 1 |
| conditions | `soc_window_max_pct` | 32 |
| conditions | `soc_window_min_pct` | 32 |
| conditions | `protocol_discharge_raw` | 7 |
| conditions | `c_rate_profile` | 4 |
| conditions | `protocol_charge_raw` | 4 |
| conditions | `protocol_class` | 3 |
| conditions | `charging_profile` | 6 |
| conditions | `temperature_max_C` | 8 |
| conditions | `temperature_min_C` | 8 |
| conditions | `temperature_setpoints_C` | 8 |
| conditions | `charge_c_rate_max` | 4 |
| conditions | `discharge_c_rate_max` | 4 |
| conditions | `rate_combinations` | 5 |
| conditions | `profile_combinations` | 3 |
| scale | `cycles_per_entity_median` | 11 |
| scale | `n_cycles_total` | 11 |
| scale | `n_entities_declared` | 8 |
| content | `observed.discharge_capacity_Ah_max` | 20 |
| content | `observed.discharge_capacity_Ah_median_of_entity_max` | 20 |
| content | `observed.temperature_C` | 12 |
| content | `observed.current_A` | 8 |
| content | `observed.voltage_V` | 5 |
| content | `raw_columns` | 1 |
| content | `signals` | 1 |
| content | `signals_basis` | 1 |
| content | `count_basis` | 8 |

A `null` means the raw data, its documentation, the landing page and the paper do not state the value
(or, for `observed.*`, that no such channel was recorded); some are `null` by nature, such as
`soc_window_*` for studies that do not fix an SOC window. Many nominal capacities, for example, appear
only in a paper that ships with neither the data nor its README. `datasets/README.md` explains how to read
a `null`, and `provenance.field_sources` in each record says where every filled field came from.
>>>>>>> Stashed changes

Some cell counts differ from the registry's because a record counts what the raw data delivers
(`scale.n_entities`) while the registry may count the whole upstream study
(`scale.n_entities_declared`); the `partial_raw` flag marks those datasets.
