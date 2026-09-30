# Research-oriented dataset profiles

[English](README.md) | [简体中文](README.zh-CN.md)

One `dataset_NN.json` per dataset, derived from `../datasets/dataset_NN.json`. Where `datasets/`
describes what the raw data *contains*, this layer answers what a researcher can *do with it*: which
physical quantities are present or derivable, and which modelling tasks the dataset actually supports.

Treat the profiles and `../index_research.json` as read-only data. Cell specifications and testing
setpoints stay in the base records that `provenance.derived_from` points to. A missing cycle count or
chamber setpoint does not invalidate a supported waveform channel. Measured cell temperature counts
only where finite temperature values exist in the raw data; a chamber setpoint is not a logged
temperature. Dataset 32's temperature-versus-frequency EIS values are a temperature record but do not
supply a temperature time series.

`../index_research.json` is the entry point for filtering: one flat row per dataset, trimmed to
just the fields worth filtering on (`complete_v_i_t_timeseries`, `soc_computable`,
`soh_computable`, `capacity_degradation_present`, `ocv_present`,
`internal_resistance_present`, `eis_present`, `thermal_characterization`, `suitable_tasks`,
`source_confidence`) plus a `facets` block listing every
`category`, `suitable_tasks` and `source_confidence` value present, so a filter UI never has
to scan the rows or open every file. Open a full profile through `record_path` once a specific
dataset is picked — the index row is not a substitute for it. Schemas:
`../schema/batterylake-research-2.0.json` (a profile) and
`../schema/batterylake-research-index-2.0.json` (`index_research.json`).

## Fields

| Field | Meaning |
|---|---|
| `timeseries` | Whether voltage, current and temperature channels are present, and at what `resolution`: `full_waveforms` (V, I and T all present as waveforms), `partial_waveforms` (waveforms, but a channel is missing), `waveform_sample_only` (an excerpt of the source, flag `sample_only_raw`), `summary_tables_only` (per-cycle or per-test tables, no waveforms), `unlabelled_channels` (data exists but its columns carry no name or unit, datasets 12 and 30). A temperature header requires finite measured values in the raw evidence; phase angles in degrees and all-NaN placeholder columns do not count. `caveats` lists the base-record flags that qualify it. |
| `soc.computable` | True when voltage and current waveforms allow coulomb-counting SOC, or an explicit `soc` channel exists. |
| `soh.computable` | True only when the **curated** `supported_tasks` lists `SOH`, a capacity channel exists in the raw data, and no blocking flag is set (`capacity_exceeds_nominal`). Curation carries domain knowledge a column check cannot see — for instance that a capacity column is a throughput counter. |
| `capacity_degradation` | Whether a longitudinal fade trend exists: a capacity channel, an `aging_type` of `cyclic`, `calendar`, `profile`, `field`, `mixed` or `second_life`, and more than one cycle. A dataset can have `soh.computable: true` (a snapshot label) with `capacity_degradation.present: false` (no aging axis). |
| `ocv` | `present: true` only where a raw README, a raw file layout or a raw column states an OCV, pseudo-OCV, GITT or relaxation measurement. `confidence` is `confirmed` (a dedicated protocol) or `estimated` (a column of authors' OCV estimates, datasets 11 and 13). `basis` cites the raw file or document. |
| `internal_resistance` | `present: true` where the raw data holds a populated resistance channel or table, or the raw documentation says DC-IR was measured. `confidence: derivable` means impedance spectra exist from which the high-frequency resistance could be read. A resistance header that is empty throughout does not count. |
| `eis` | `present: true` where the raw data holds impedance spectra (frequency and impedance channels or EIS files). Relaxation studies are scored under `ocv`, not here. |
| `thermal.thermal_characterization` | True for abuse/thermal-runaway studies (`aging_type: abuse_thermal` or `application_domain: safety`), distinct from `thermal.temperature_logging`, which requires a named temperature channel with finite measured values. Chamber setpoints are not logged temperatures. |
| `research_applicability` | Five booleans: `parameter_identification` (needs V and I), `piml_calibration` (needs full V/I/T waveforms plus a degradation or thermal-characterization axis), `soh_rul_prediction`, `simulation` (full V/I/T waveforms), `synthetic_data_generation` (full V/I/T waveforms plus at least 20 cycles and 3 entities). |
| `suitable_tasks` | The task labels this dataset is fit for: `SOH_estimation`, `RUL_prediction`, `SOC_estimation`, `digital_twin_calibration`, `thermal_modelling`, `simulation`, `synthetic_data_generation`, `EIS_characterization`, `OCV_curve_extraction`, `fault_diagnosis`. |
| `source_quality_flags` | Inherited verbatim from `datasets/dataset_NN.json` — see [../docs/flags.md](../docs/flags.md). Cross-dataset facts such as `shared_cells_with_other_dataset` live in the base metadata; they are not computed here. |

## Provenance

Each profile carries a `provenance` block, modelled on the one in `datasets/dataset_NN.json`.

| Field | Meaning |
|---|---|
| `derived_from` | The base record the profile was computed from. |
| `generated` | Date the profile was last generated. |
| `field_sources` | Maps each field group to where its value came from. The values are listed below. |
| `confidence` | Inherited from the base record. A profile cannot be more certain than its input. |
| `last_verified` | Inherited: when the base record's inputs were last read from the raw data. |

| Value | Meaning | Used for |
|---|---|---|
| `dataset_record` | Copied unchanged from `datasets/dataset_NN.json`. | `ref_name`, `source_quality_flags` |
| `derived` | Computed from base-record fields by a fixed rule. For `ocv.*` it also marks datasets where no raw source states an OCV measurement, meaning "not shown to be present". | `timeseries.*`, `soc.*`, `soh.*`, `capacity_degradation.*`, `thermal.*`, `research_applicability.*`, `suitable_tasks` |
| `raw_data` | Read from the per-entity evidence extracted from the raw data: resistance columns, impedance files, EIS spectra. Also the value when the raw data shows nothing. | `internal_resistance.*`, `eis.*` |
| `hand_checked` | An entry in the sourced tables of confirmed OCV and internal-resistance measurements: a fact read from a raw README, raw file layout or raw column that the base schema does not hold. Each entry's `basis` names the raw file. | `ocv.*` (04, 11, 13, 18, 19, 26, 28, 31), `internal_resistance.*` (05, 11, 13, 38) |
| `folder_layout` | The category folder the dataset sits in. | `category` |

## What this is not

This layer does not re-parse the raw data; it recombines `datasets/` records, reads the
resistance and EIS evidence extracted from the raw files, and adds the few hand-checked
facts above. Every non-obvious boolean traces to one of those places.
