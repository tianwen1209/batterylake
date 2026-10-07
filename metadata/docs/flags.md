# Quality flag vocabulary

[English](flags.md) | [简体中文](flags.zh-CN.md)

Flags live in `quality.flags` of each `../datasets/dataset_NN.json` record and are inherited as
`source_quality_flags` by the research profiles. This file is the one place they are defined.
See [../datasets/README.md](../datasets/README.md) for how to filter on them.

Every flag is computed from the raw data, the raw file listing or the registry
(`sample_only_raw` is the one exception: it is set by hand for a dataset whose raw folder holds only a
file named `sample_data`). None is a guess, and none is set by hand except that one. They fall into
three groups. The **Where it appears** column lists the datasets that carry the flag.

**Blocking — the data is wrong or misleading for modelling.**

| Flag | Meaning | Where it appears |
|---|---|---|
| `capacity_exceeds_nominal` | The median over entities of the largest observed discharge capacity is more than 3x the nominal capacity. Either a channel accumulates charge moved instead of resetting each cycle, or the nominal value describes another cell. SOH computed as capacity divided by nominal is meaningless. Dataset 05 reaches 164 Ah on a 1.85 Ah cell; datasets 22 and 23 reach about 500 Ah on 3.5 Ah cells; dataset 02 reaches 55 Ah on a 1.1 Ah cell (CALCE's well-known cumulative Arbin export). | 02, 05, 22, 23 |

**Partial — the data is sound but incomplete or overlapping.**

| Flag | Meaning | Where it appears |
|---|---|---|
| `partial_raw` | Fewer entities were found in the raw data than the registry declares; compare `n_entities` with `n_entities_declared`. | 03, 08, 16, 19, 25, 29, 30 |
| `sample_only_raw` | The raw data is an excerpt of the source, not the full series. Set by hand. | 15 |
| `incomplete_raw_files` | Partial-download markers (`*.part`, lock files) sit among the raw files, so some files were not fully downloaded. | 17, 29 |
| `unreadable_raw_files` | Some raw files are empty, corrupt or not the format they claim, and could not be parsed. | 05, 14 |
| `shared_cells_with_other_dataset` | The same physical cells appear under more than one dataset id: entity ids intersect, or the maintained record of shared studies links the two. Pooling or train/test-splitting the two datasets as independent samples leaks. | 11, 13 (228 cells), 25, 27 |
| `duplicate_of_other_dataset` | Most of this dataset's files reappear in another dataset with identical row counts, so it is a copy or a repackaging. Use one of the two. | 22, 23 |

**Informational — worth knowing, blocks nothing.**

| Flag | Meaning | Where it appears |
|---|---|---|
<<<<<<< Updated upstream
| `multi_chemistry` | The dataset spans more than one cathode chemistry, so `cathode_chemistry` is `mixed` and the real value is per cell. | 06, 16, 20, 24, 26, 29, 33, 34, 35, 40 |
=======
| `multi_chemistry` | The dataset spans more than one cathode chemistry, so `chemistry_is_multi` is true, `cathode_chemistries` lists several values and the per-cell value is in `cells[]`. | 06, 16, 20, 24, 26, 29, 31, 33, 34, 35, 39, 40 |
>>>>>>> Stashed changes
| `voltage_excursion_below_cutoff` / `voltage_excursion_above_cutoff` | The observed voltage passes the documented cutoff by more than 0.05 V. Usually a sensor spike, a rest-step artefact or a documentation mismatch; check `content.observed.voltage_V` before trimming. | below: 01, 05, 06, 07, 08, 11, 13, 19, 22, 23, 38 · above: 01, 02, 05, 06, 07, 09, 19, 21, 22, 23, 28, 38 |
| `pack_level_voltage` | Observed voltage is more than 10x the cell-level cutoff, so the raw data is pack level. Replaces the above-cutoff flag. | none at present |
| `temperature_basis_differs_from_data` | The documented test temperature lies more than 10 C away from the temperatures the raw data measures, so the recorded temperature is a setpoint, an onset value or another quantity rather than what was measured. Read `temperature_basis`. | none at present |
