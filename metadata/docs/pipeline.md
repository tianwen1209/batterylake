# Where the metadata comes from

[English](pipeline.md) | [简体中文](pipeline.zh-CN.md)

How to tell where a value in `../datasets/*.json` and `../index.json` came from, how much to trust
it, and what its derived fields mean. Field meanings are in
[../datasets/README.md](../datasets/README.md); flag definitions in [flags.md](flags.md).

Every filled field says where it came from in the record's `provenance.field_sources`, so a
consumer never has to guess. A field that no source documents is `null`.

## Source order

Values are read from the dataset's own raw files and from nowhere else that describes the data.
Delivery URLs are not a source. When the raw files cannot supply a field, the fallback is the
dataset's own public landing page and its linked paper. The sources, in order of preference:

1. **The raw data itself** — every measurement file is parsed: column names and units, value
   ranges, row and cycle counts, entity (cell/module/vehicle) identity, file formats.
2. **The raw file names and folder layout** — test temperature, SOC, C-rate and cell identity
   that the authors encoded in names (`..._25C_0.5C_...`).
3. **Author documentation shipped with the raw data** — READMEs, PDFs, author spreadsheets
   (`main.xlsx`, `Labels.xls`, `Readme.txt`).
4. **The registry** — `dataset_registry.csv`: `dataset_name`, `ref_name`, `source_url` and the
   bookkeeping columns.
5. **Landing pages and papers** — the dataset's public landing page and the paper its DOI points
   to, for values 1-3 cannot supply (chemistry, nominal capacity, protocol).
6. **The physical cell's own manufacturer datasheet** — when nothing about the *dataset* (1-5)
   states a cell's nominal capacity, voltage range or dimensions, but the raw data, its
   documentation or its landing page names a real manufacturer and model (e.g. "Molicel
   INR-21700-P42A"), that model's official datasheet supplies the value. A spec is never guessed
   from a part-number naming convention. A model that is not identified (an internal label like
   "Cell A", or only a chemistry name) is not looked up, and the field stays `null`.
7. A field none of these documents stays `null`. Nothing is guessed from a magnitude — a unit
   comes from a column name or the author's documentation, never from how large the numbers look.

## Reading provenance

`provenance.field_sources` maps a field path (or a group of fields) to an origin. The origins
are defined in [../datasets/README.md](../datasets/README.md#provenance). To keep only measured
facts, keep the fields whose origin is `raw_data`, `raw_filenames` or `raw_inventory`. To see how
much of a record is documented rather than measured, count `raw_docs`, `landing_page`, `paper`
and `datasheet`. `provenance.confidence` is `verified` when the raw data was parsed and
`asserted` when a value rests on documentation alone.

## Where each field comes from

### 1. Measured from the raw data (`raw_data`)

Each dataset's raw files are read into a list of entities with row counts, cycle counts and the
observed range of each quantity (voltage, current, temperature, capacity, resistance, SOC, OCV),
plus the raw column headers, the file inventory and any files that could not be read. These
become `content.observed`, `content.signals`, `content.raw_columns`, `scale.n_entities` and
`scale.n_cycles_total`.

How to read those values:

- Column headers map to signals by name only. Unit scales come from the header (`mA`, `mAh`,
  `mV`); a bare `capacity` column is never rescaled. Where a scale had to be confirmed it was
  checked against the data, e.g. dataset 20's mA/mAh columns by integrating current against
  capacity.
- **Cycles** are counted per file as the number of distinct cycle ids, then summed, because
  testers restart the counter in each file. Datasets with checkpointed characterizations record a
  `content.cycle_basis` explaining what a "cycle" is (dataset 04: the aging cycle of each 100-cycle
  checkpoint; for abuse or pulse datasets a unit is a test).
- Formats read: CSV, XLSX/XLS, MATLAB v5 and v7.3 (including MATLAB tables), HDF5, Python
  pickles, `.mpt` (BioLogic), and zip/rar/7z/tar.gz archives, nested ones included.
- Pickles are read with a **restricted unpickler** that allows only numpy, pandas, collections and
  the torch tensor-rebuild functions. A pickle that needs anything else is refused, not run.
- Files that cannot be read (zero-byte members, lock files, partial downloads) are never dropped
  silently: they raise the `unreadable_raw_files` and `incomplete_raw_files` flags
  (see [flags.md](flags.md)).

### 2. Read from raw filenames, folders or documents (`raw_filenames`, `raw_docs`, `raw_inventory`)

`raw_filenames`: parsed from names and folder paths (temperature, SOC, C-rate, cell id).
`raw_docs`: read from an author README, PDF or spreadsheet shipped with the raw data.
`raw_inventory`: counted from the file listing without opening the files (`scale.n_raw_files`,
`scale.raw_bytes`, `content.source_format`).

### 3. Read from the registry, landing pages and papers (`registry`, `landing_page`, `paper`)

`registry` for `identity.dataset_name`, `ref_name`, `source_url` and `scale.n_entities_declared`.
`landing_page` and `paper` for values a fetched page states — e.g. the chemistry of a dataset whose
raw files record only voltage and current. The DOIs in `identity.doi` / `paper_doi` are ones the
registry's landing pages, the raw documentation or the landing-page metadata state; a DOI that only
appeared in a secondary listing is not recorded.

### 3a. Read from a manufacturer datasheet (`datasheet`)

For a specific, identified commercial cell (a real manufacturer and model, not an internal study
label), `cell.nominal_capacity_Ah`, `cell.voltage_min_V`/`voltage_max_V` and `cell.dimensions_mm`
are read from that model's own official datasheet when nothing about the dataset itself states
them. The citation in the record names the document that was read. Datasets that identify a cell
only by an internal label ("Cell A") or by chemistry alone have no model to look up, and these
fields stay `null` rather than being guessed.

### 4. Derived by rule (`derived`)

| Field | Rule |
|---|---|
| `cell.cell_format_codes` | first size code found in the form factor or model string: 18650, 21700, 26650, 14500, 502030, 20700, 32700 |
| `cell.dimensions_mm` | from the size code by convention (18650 = 18 x 65 mm), marked `basis: inferred_from_format_code`; a stated size is parsed instead (`basis: stated`) |
| `conditions.charge_c_rate_max`, `discharge_c_rate_max` | largest rate for each direction, parsed separately from the protocol or the rates encoded in raw names (`0.5C`, `C/5`, `1/3 C`), aggregated across all entities. Where a rate was estimated from the signed observed current divided by nominal Ah, the origin is `raw_data` and the record's notes say it is an observed-current estimate. |
| `conditions.c_rate_profile` | WLTP, UDDS, Artemis, US06, FUDS or DST → `drive_cycle`; dynamic, profile or flight → `dynamic`; multistage or step → `multistage`; otherwise `constant` |
| `conditions.protocol_class` | keyword match on the protocol text, in order: abuse/indentation/ARC/runaway, calendar/storage, pulse/relaxation, drive cycle, multistage, RPT, CC-CV, else `mixed` |
| `cell.chemistry_is_multi` | true when more than one distinct cathode chemistry appears |
| `identity.notes` | the lead (count, chemistry, format, entity type; declared count in brackets when it differs) and the paper citation (`paper_doi` looked up in `evidence/paper_metadata.json`) are composed from the record's own fields; the clauses between them are curated (`notes_detail` in curation) and restate this record's `conditions.*`, `content.*` and `quality.notes`. Origin `curated`. |
| `identity.year` | the leading four digits of `ref_name` |
| `scale.n_cycles_total`, `cycles_per_entity_median` | from the per-entity cycle counts above |
| `quality.flags` | computed from the raw data, the file listing and the registry — see [flags.md](flags.md) |
| index `facets` | every value present per field, collected across the records |

### 5. Curated (`curated`)

A curated value is a human judgement that rests on a named source. Curated values cover:

| Field group | Content |
|---|---|
| `institution`, `aging_type`, `application_domain`, `entity_type`, `supported_tasks` | judgements grounded in a literal statement in the raw documentation, landing page, paper or registry. `application_domain` (`lab`) and `entity_type` (`cell`) default when nothing indicates otherwise. |
| `charging_profile` | `CC-CV`, `dynamic` or `multi-rate`, labelled by the dominant cycling protocol and read only from the raw measurement files (the charge current of sampled cycles) or the documentation shipped with them. `null` where they do not show the protocol. |
| `cell`, `conditions` | facts read from documentation, a landing page or a paper (chemistry, nominal capacity, voltage window, temperature setpoints, protocol text) |
| `doi`, `paper_doi` | DOIs stated by the raw documentation or the landing pages |
| per-entity values | values such as temperature or SOC read from raw names rather than typed in |
| `quality.notes` and a few flags | what was found, and flags a person set (`sample_only_raw`) |

## Reading a value you doubt

- Look up its path in `provenance.field_sources` to see the origin.
- Compare a documented value in `cell.*` with the measured range in `content.observed`. A gap
  raises a voltage-excursion or capacity flag (see [flags.md](flags.md)).
- Read `quality.notes` and `content.cycle_basis`; they carry what a single field cannot, such as
  what a "cycle" means or why a value is `null`.
- A registry count higher than `scale.n_entities` sets `partial_raw`, and
  `scale.n_entities_declared` holds the registry's figure. The metadata counts what the raw data
  delivers; the registry often counts the whole upstream study.
