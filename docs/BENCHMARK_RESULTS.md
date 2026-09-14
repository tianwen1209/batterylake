# Benchmark curve publication

[中文](BENCHMARK_RESULTS.zh-CN.md) · [Benchmark page](https://tianwen1209.github.io/batterylake/#benchmarks)

The public benchmark page displays **real recorded test targets and saved model predictions**. Dataset, task and model selectors change the displayed experiment. Numerical tick labels, value tooltips, metrics and rankings are omitted, as requested for the paper. The previous conceptual animations have been removed.

The scope covers nineteen datasets: 01, 03, 04, 05, 06, 07, 08, 09, 11, 17, 18, 19, 21, 23, 27, 36, 37, 38 and 41. SOH curves are available for each; point-value RUL is unavailable for the right-censored Onori second-life (27) and incident-screened HM (37) subsets. Each available task has images for Linear Regression, Random Forest, XGBoost, LSTM, Transformer, CNN and PINN. The PINN images use the completed PINN4SOH replacement runs. The original local training-package workflow remains available.

## What each chart represents

- The frozen baseline label, a fixed seed (`0`), and one test cell per dataset/task. The cell is selected by sorting SHA-256 hashes of `[20260910, case_id, cell_id]` and taking the first eligible identity. Selection is independent of prediction error and is shared across models and raw/processed runs.
- Cross-cell test predictions, except **XJTU RUL**, whose completed baseline runs are temporal and random only. Its chart explicitly uses the temporal test and displays the reference and processed prediction; it does not invent a paired raw run or claim a cross-cell result.
- The primary SOH case is displayed. MATR continuation and EVERLASTING recorded-operation experiments remain separate server-side results. EVERLASTING charts use the primary elapsed-time profile. MATR/HUST RUL charts use author-reported endpoints; ILCC RUL uses its timestamp-matched extension.
- BatteryLife source-copy predictions for 06/07/08, KIT temperature-endpoint inputs, Oxford Group 5 and HM incident-screened v7 retain their stated scope. This does not claim full-release coverage or validation of unavailable BatteryArchive original CSVs.

The teal curve is the reference target, the orange dashed curve is the raw-input prediction (source-copy prediction for BatteryLife), and the blue curve is the processed-input prediction. Coincident predictions can overlap. Each plot uses all valid recorded test anchors for the selected cell, without smoothing, interpolation of new samples, clipping model errors, averaging seeds or selection by score. Straight segments connect adjacent available observations; omitted/invalid anchors break the line. The animation reveals the saved chart from earlier to later along the life axis; it is not live inference.

Both target and predictions share the same affine plot scale. Bounds include all displayed values, including outlying or negative predictions. Scales are calculated separately for each selected chart; apparent pixel errors should not be used as cross-model or cross-dataset numerical metrics. A single cell is a visual example, not an aggregate performance ranking.

## Rendering and provenance

`scripts/render_benchmark_curves.py` verifies the current metrics hash against `FINAL_SUMMARY.json`, each completed job's identity, seed, code fingerprint and prediction-file hash, then checks exact sample/target/axis/mask alignment between models and raw/processed runs. It fails on source mismatches instead of substituting data.

The public `assets/images/benchmark-curves/` directory contains PNG pixels and a strict display-only `index.json` (dataset, task, model, cell identity, profile, protocol, axis label and image filename). It contains no target/prediction arrays, scale limits, metrics or numerical PNG metadata. The frontend does not fetch the underlying result files. The curve geometry itself is intentionally public; images are not a guarantee against approximate visual digitization.

Full provenance, selected sample keys, plot bounds and source/image SHA-256 hashes remain in the server-only audit:

```text
/home/zhutianwen/BatteryLake2026/Benchmark/runs/website_curve_exports/20260914-real-curves/audit.json
```

To regenerate using the existing CPU environment, without training:

```bash
cd /home/zhutianwen/batterylake
/home/zhutianwen/BatteryLake2026/Benchmark/runs/harness-cpu-env/bin/python \
  scripts/render_benchmark_curves.py \
  --audit /home/zhutianwen/BatteryLake2026/Benchmark/runs/website_curve_exports/20260914-real-curves/audit.json
```

Availability and scope were checked against the frozen harness manifest and completed reports on 2026-09-14. Do not infer completion from the main dataset catalogue's display status. Future changes should recheck the source receipts and retain explicit task/protocol distinctions.

The old numerical website assets remain absent and Git-ignored. Full experiment artifacts and the prior numerical website archive stay on the server. Earlier public Git commits and cached copies were not rewritten by this change.
