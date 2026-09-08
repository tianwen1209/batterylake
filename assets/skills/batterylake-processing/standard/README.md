# BatteryLake dataset processing and benchmark fidelity standard

[English](README.md) | [简体中文](README.zh-CN.md)

Version: 2.0.0 · 2026-09-07

Current server layout uses `Raw_Dataset/<category>/dataset_xx/` and `Processed_Dataset/<category>/dataset_xx/`. Flat paths below describe the earlier layout. New verified downloads are handled by the [incremental processing task](../scripts/processing/NEW_DOWNLOADS.md), with the same acceptance gates; source decoding and common signal projection do not automatically establish benchmark readiness.

This standard governs conversion from `Raw_Dataset/dataset_xx/` to the corresponding `Processed_Dataset/dataset_xx/` for common SOH, RUL, and other benchmarks. **A common structure must preserve original samples, signals, label definitions, and experimental tasks.** Original data is read-only. Conversion code, standard version, parameters, provenance, and validation results must be traceable.

Dataset conversions have been implemented. Assess completion using each dataset's `status.json`, reports, and actual outputs together; directory existence is insufficient.

## Entry points

- [Codex / Claude skill](skills/batterylake-processing/SKILL.md): dataset-by-dataset workflow.
- [Field and file contract](skills/batterylake-processing/references/schema.md): tables, keys, provenance, and labels.
- [Benchmark equivalence contract](skills/batterylake-processing/references/equivalence.md): comparison of independent original and standardized reading paths.
- [Tasks and dataset TODOs](../TASKS.md): processing order, available sources, risks, and acceptance stages.
- [Historical v1.1](README.v1.1.md): context for historical files; this version takes precedence in a conflict.

## 1. Two required layers

The **complete fidelity layer, `canonical/`**, preserves interpretable information from all original experiments: cycling aging, reference performance tests (RPT), independent capacity tests, HPPC, SOC drive profiles, calendar aging, safety tests, incomplete cycles, missing values, anomalies, author labels, and additional channels. Map common fields and retain unmapped fields as typed extensions. Keeping only current, voltage, and temperature is insufficient to claim complete fidelity.

**Task views, `views/<profile_id>/`**, select samples, input windows, and targets according to an explicit benchmark contract. A `cycling_aging_v2` view includes only protocol-confirmed aging cycles. RPT measurements may supply SOH targets through label links, but are not aging cycles themselves. Calendar aging uses time rather than invented cycles. SOC, thermal safety, and mechanical experiments retain their own meanings; their inclusion does not establish applicability to cycle-life prediction.

Recoverable source bytes, equivalent standardized signals, and equivalent benchmark behavior are different findings. Preserving an archive or link supports provenance but **does not replace decoding, standardization, or model-input validation**. Undecodable files remain unconverted. Copying, extraction, inventory generation, or empty CSV creation does not establish completed processing.

The v1.1 exclusions of RPT and incomplete cycles now apply only to specific task views; source information must still be retained. Existing common CSV fields remain in use, with the added layers and label contracts described in the field reference.

## 2. Evidence and completeness before processing

1. Inventory every file and archive member, including nested archives, workbook sheets, MAT/HDF5 objects, and JSON hierarchies. An initial inventory may cover files and ZIP central directories only, but must identify outstanding deep inspection and content checks.
2. Before conversion, compute input SHA-256 hashes and record sizes, relative paths, upstream versions, source links, and licenses (`unknown` when unresolved). Matching ZIP CRCs or sizes alone do not establish verified content. Confirm original hashes after conversion. Resume checkpoints must validate input, code, configuration, and schema fingerprints.
3. Identify `.part` files, empty files, corrupt archives, sample-only downloads, and missing archive volumes separately. Renaming extensions does not complete downloads. A local sample does not represent an unavailable full upstream dataset.
4. Establish experiment type, units, signs, cell identity, cycle boundaries, and capacity meaning from local author documentation, protocols, metadata, and original code. Consult official dataset pages or papers when necessary and record sections or pages. Filenames are clues; retain conflicting evidence and unresolved questions.
5. The same experiment may have CSV/MAT copies, raw and author-processed forms, or multiple releases. Record aliases and version relationships. Preserve each source, prevent duplicate counting in task views, and do not silently replace measurements with interpolated curves.
6. Maintain a field coverage ledger: every source field maps to a standard column, extension, author asset, or explicit unconverted item. Every source measurement needs a stable locator. Record counts, identities, and reasons for view exclusions.
7. Identify formats by magic bytes and actual structure, not extensions alone. In particular, a `.pkl` produced by `torch.save` may contain multiple serialization streams; decoding its MAGIC header does not decode its samples. Verify complete payloads, shapes, metadata, external storage, and EOF against the official format reader. Restrict deserialization types and record unknown types as errors. Invalidate header-only historical catalogue entries and rebuild complete payloads.

## 3. Boundaries of fidelity-preserving conversion

- Default operations are field mapping, reversible unit conversion, documented current sign conversion, and identity/provenance annotation. Charging is positive and discharging negative; retain source values/signs and formulas. Noise thresholds may classify steps, but must not zero small currents.
- Do not resample, interpolate, smooth, denoise, clip, normalize, impute, remove outliers, merge duplicate timestamps, or duplicate records in the fidelity layer. Retain and flag original duplicates; a task configuration must explicitly choose any deduplication.
- Preserve at least source precision. Do not universally cast to float32 or round to a fixed decimal count. Use round-trip representations for float64 CSV values. Never first cast large integers, counters, timestamps, Decimal values, or long IDs to floating point. Retain original strings, missing markers, non-finite values, and unparseable values in typed extras or source representations. Standard numeric nulls require missing-value reasons.
- CSV uses UTF-8, commas, and standard quoting. Numeric nulls use empty fields, never sentinel 0 or -1. Distinguish null strings from empty strings through the contract or extensions. Use genuine Parquet nulls. Do not flatten or stringify nested structures without a documented representation.
- Standard units are seconds, Ah, Wh, A, V, and degrees Celsius. SOC and SOH are ratios rather than percentages. Retain SOH greater than 1 when present; do not clip capacity recovery.
- Absolute timestamps retain source precision and known timezones. Do not guess UTC for an unknown timezone. Keep absolute, relative, step, and total test times distinct. Do not cast nanosecond Unix timestamps to float64 before subtraction.
- Retain record order and separate measurements at equal timestamps. Clock reversals or restarts require segment handling that preserves cross-segment order, original clocks, and offsets. Do not repair them by globally sorting on time or voltage. Explicitly flag gaps, duplicate timestamps, and restarts.
- Keep sensors, module/branch/cell currents, measured temperatures, and temperature setpoints distinct. Do not label a module as a single cell. Known records of one physical cell across files or life stages must share a `physical_cell_id`.
- Do not guess unknown units. Preserve native fields and withhold profiles that depend on unresolved interpretations while continuing work on confirmed portions.

## 4. Cycles, capacity, and labels

`cycle_id` is an internal table key, not a physical lifetime axis. Number cycles from 1 in experiment order for each cell. Separately retain source cycle numbers, actual accumulated aging cycles, equivalent full cycles (EFC), elapsed operating time, and missing intervals. View filtering must not renumber cycles. **Do not compute RUL from filtered row-number differences**, or count 300 WLTP repetitions between RPTs as one cycle.

Use protocols to distinguish repeated driving for aging, diagnostic driving, and preparation steps. One full cycle may span files or segments; one file may contain multiple cycles. Source `cycleNumber` can reset or be unreliable: check author guidance and step transitions rather than grouping by its values alone. Preserve uncertain boundaries and mark them unresolved.

### Capacity and SOH

- Distinguish nominal capacity, full discharge capacity, partial-SOC throughput, RPT reference capacity, and author Q/SOH. Partial throughput is not automatically health capacity. Do not combine capacities measured at different rates or temperatures into one target without explanation.
- Preserve author labels with their units, formulas, references, and provenance. Store standardized derived labels separately. A profile must explicitly choose and fix its SOH reference, which may be nominal capacity, initial RPT capacity, or the first eligible cycle capacity; do not force one reference across datasets.
- Use `labels` and `label_links` to associate RPT targets with samples. Record measurement time, availability time, preceding/following aging cycles, and linking method. Nearest-neighbor matching, forward filling, interpolation, and retrospective filling create derived labels and require provenance. Future RPTs may serve as supervised targets, but must not silently generate inputs available at an earlier prediction time.
- Capacity/energy integration must specify left rectangle, right rectangle, or trapezoidal integration; time source; noise threshold; counter resets; gap handling; and available coverage. Reproduce the author method first and retain any standard derivation separately. Unknown methods preclude a direct equivalence claim.
- Integrate only over genuinely continuous intervals, never across gaps, clock restarts, or uncertain step boundaries. Equal timestamps have zero delta time. `Σ IΔt/3600` is not a complete algorithm: specify the current endpoint. A cumulative counter's global maximum is not necessarily a cycle's capacity.
- Temperature means default to time-weighted means over valid continuous intervals, with integration/endpoint method and covered duration recorded. Do not bridge gaps. Leave the mean null for a single point or unavailable timing; separately identify any profile that chooses an arithmetic mean.

### EOL and RUL

- Preserve author EOL definitions and events. Distinguish threshold crossing, experiment termination, and failure exit. Use `soh<=0.80` only when a task explicitly selects it, label it `default_80pct`, and do not present it as an original dataset label.
- State threshold, first-crossing/consecutive-K/smoothed trigger, capacity reference, comparison operator, and lifetime axis. Retain author and benchmark EOL definitions side by side.
- `rul = max(eol_axis_value - current_axis_value, 0)` applies only to observed EOL on a common reliable lifetime axis. Specify aging cycles, EFC, hours, or days. Use `rul_cycles` only for actual cycles; `eol_cycle_id` is a relation key and is not automatically subtractable.
- An RPT first below threshold usually locates EOL between the previous passing test and that RPT. Preserve interval bounds or explicitly define a first-observed-failure convention; do not claim an exact intervening cycle.
- If EOL is unobserved, record right censoring and the observation endpoint. Do not turn the final file record into EOL. Distinguish author RUL, model estimates, and observed outcomes; model estimates are not ground truth by default. Retain post-EOL records and let profiles decide their inclusion.

## 5. Storage and conversion programs

Each dataset requires provenance inventories, field mappings, documentation, status, a fidelity layer, and validation reports, plus task views where applicable. See the [full contract](skills/batterylake-processing/references/schema.md).

Small tables may use CSV; large time series should use losslessly compressed Parquet shards. Keep logical schemas consistent. The manifest must list files, schemas, counts, types, hashes, and reading order; loaders must not guess formats or depend on filesystem enumeration. If both formats are published, compare them. Stable references between canonical data and views can avoid repeated copies.

Converters reside in `scripts/processing/`, separating shared reading/checking tools from dataset adapters. Rules, thresholds, input modes, and profiles must be auditable. After small-sample debugging, cover every available file. Stage outputs and publish atomically after checks. Preserve failure records without leaving apparently complete partial tables. Checkpoints depend on input, code, configuration, and schema fingerprints.

Stream by archive or cell and estimate extraction/output space first. Reject archive path traversal and do not execute code files as data. Review Pickle types and use isolation or restricted decoding. Inspect author scripts and dependencies before using them for independent comparisons.

## 6. Acceptance gates

| Stage | Required evidence | Permitted conclusion |
|---|---|---|
| I: inventory | Counts, bytes, formats, missing inputs, preliminary types, and inspection depth | Inventoried; not yet converted |
| S: semantics | Author evidence, identities, units, boundaries, field ledger, labels, and duplicate strategy | Adapter design confirmed |
| C: conversion | Full available-file coverage, typed extras, readable tables, input/output hashes, reproducible commands | Converted; fidelity not yet established |
| V: fidelity | Keys, counts, missingness, order, field coverage, full raw-to-standard numeric checks, and capacity comparison | `canonical_validated` |
| E: task equivalence | Independent raw and standard loaders; matching profile inputs, labels, splits, predictions, and training comparisons | `benchmark_verified`, scoped to that profile |

Core counts, identities, ordering, categories, and missing masks must match exactly. Before comparison, define per-field absolute and relative tolerances for unit conversions. Record maximum errors, quantiles, and the first differing record. Means or a few plotted curves are insufficient. Instrument noise must not conceal conversion loss.

The requirement that “CNN SOH results should be arbitrarily close to using original data” is operationalized as **the same samples, features, labels, splits, preprocessing, and training configuration, with conversion differences inside predeclared numeric and experimental repeatability tolerances**. Compare input tensors first, then predictions and training. Similar scores alone do not prove information preservation. Bitwise reproducibility is not guaranteed across hardware or versions; see the [PyTorch reproducibility notes](https://docs.pytorch.org/docs/stable/notes/randomness.html) and the [equivalence contract](skills/batterylake-processing/references/equivalence.md).

Non-SOH/RUL datasets still require fidelity-preserving conversion, with evidence for a `not_applicable` task status. Missing source data is `blocked_missing_source`; an unavailable parser dependency is `pending_dependency`; unresolved interpretation is `needs_semantic_review`. Never mark an unrun check as passed or substitute sample checks for full validation.

## 7. Inventory tools and historical examples

Run from the repository root:

```bash
python3 scripts/inventory_datasets.py
# Compute input SHA-256 hashes before conversion; original files remain read-only.
python3 scripts/inventory_datasets.py --dataset dataset_21 --sha256
```

The inventory tool writes file lists, first-level ZIP member indices, and inventory reports. It does not extract or convert data or overwrite existing task status. TAR/RAR/nested ZIP inspection remains tracked in dataset TODOs. Newly created status files explicitly indicate that conversion has not run.

The `cycle_summary.csv` and `time_series.csv` files here are historical **synthetic schema examples**, not training data or acceptance fixtures. Their sparse samples cannot reconstruct full capacity, and their example EOL of 900 is not observed in the sample. Implement and validate the v2 contract; do not copy those rows into real outputs.
