# BatteryLake metadata

[English](README.md) | [简体中文](README.zh-CN.md)

Machine-readable dataset metadata: **one JSON record per dataset** plus a **global index**
that is the single source of truth for dataset pages, the benchmark, the data platform and
the studio. A second, research-oriented layer says what each dataset can be used for.

Every value is read from the dataset's raw files: the measurement files themselves, their names and
folder layout, and the documentation shipped with them. Where the raw data cannot supply a field,
the fallback is the dataset's public landing page and its linked paper, as named by
`dataset_registry.csv` and the dataset and paper DOIs. Delivery URLs are not a source. A field
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
```

## Reading it

### The index is the entry point

`index.json` carries `counts`, `facets` and `datasets`. Filter on `datasets`, then open
a record through `record_path` only when per-cell detail is needed. `facets` lists every
value present for each filterable field, so a filter UI never has to scan the rows.

```python
from metadata.read import load_index, find, load_record, iter_cells, usable_for, by_ref_name

index = load_index()
find(index, cathode_chemistry="LFP", form_factor="cylindrical", min_n_entities=10)
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
  (d) => d.cathode_chemistry === "NMC" && d.n_entities >= 20,
);
const options = index.facets.form_factor;          // build filter controls
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

`cathode_chemistry`, `anode_chemistry`, `form_factor`, `cell_format_code`,
`manufacturer`, `institution`, `year`, `aging_type`, `application_domain`,
`protocol_class`, `c_rate_profile`, `entity_type`, `supported_tasks`, `signals`,
`source_format`, `quality_flags`, and the numeric ranges `nominal_capacity_Ah`,
`nominal_voltage_V`, `voltage_min_V` / `voltage_max_V`, `temperature_min_C` /
`temperature_max_C`, `charge_c_rate_max` / `discharge_c_rate_max`, `n_entities`, `raw_bytes`.

## Coverage as built

40 datasets, 3,451 entities (cells, modules or vehicles, as `entity_type` says), 4,135 raw files,
300.8 GB, and a sum of 7,848,847 recorded cycle counts. Count definitions differ by dataset;
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

Some cell counts differ from the registry's because a record counts what the raw data delivers
(`scale.n_entities`) while the registry may count the whole upstream study
(`scale.n_entities_declared`); the `partial_raw` flag marks those datasets.
