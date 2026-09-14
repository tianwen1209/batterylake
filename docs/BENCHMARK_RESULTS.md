# Published benchmark results

[中文](BENCHMARK_RESULTS.zh-CN.md) · [Explore results](https://tianwen1209.github.io/batterylake/#benchmarks)

The **Benchmark results** section displays recorded experiments from BatteryLake2026. The training-package wizard below it remains an independent workflow for a visitor's own experiments.

## Completed scope

The frozen campaign covers 19 cycle-aging datasets, 24 profiles, seven models and seeds 0–4. It contains **8,540 verified fits: 5,145 SOH and 3,395 RUL**, including six separate SOH transfer directions. Each original profile selects at most 18 training, 6 validation and 6 test cells from its inherited partitions. Complete available histories of the selected cells are retained. These are **experimental subsets**, not the full-release statistics on the home page.

Dataset IDs: 01, 03, 04, 05, 06, 07, 08, 09, 11, 17, 18, 19, 21, 23, 27, 36, 37, 38 and 41. Continuation and alternative life-axis profiles do not count as additional independent datasets.

Models: Linear Regression, Random Forest, XGBoost, LSTM, Transformer, CNN and **PINN4SOH**. The current table includes the author-network PINN4SOH replacement and excludes the superseded MLP baseline. The separate 1,571-fit replacement total includes 351 historical reruns and is not added to the 8,540-fit campaign total.

## Reading the table

- Select a dataset, task, profile, label definition and split protocol. Only executed conditions appear; unavailable point-value RUL tasks show an explicit empty state.
- Rankings use **processed inputs**, with mean **cell-equal RMSE** across five seeds. Compute RMSE within each test cell, then give every cell equal weight; average those results across seeds. MAE uses the same weighting. The displayed SD is the sample standard deviation across seeds (`ddof=1`), not a confidence interval. Exact ties receive an average rank.
- SOH errors are in **ratio units**. Multiply by 100 for percentage points. RUL units are profile-specific: source cycles, recorded operations, elapsed days, or author-defined life axes. Do not pool different units or labels into an overall leaderboard.
- The 168 ranking conditions include cross-cell, temporal, random and the separately identified transfer experiments. There are also 287 protocol/label ranking comparisons, including comparisons on common test anchors where available.
- Cross-cell separates physical cells. Temporal excludes the first 15 window anchors after boundaries. Random deliberately permits same-cell and history-window leakage as a negative control; it is not part of a leakage-free leaderboard. All scalers fit training data only.
- Test-cell and test-sample counts refer to the eligible test scope of the selected condition. The profile's inherited split counts describe the selected cells before task-specific eligibility checks and are not the effective split for temporal/random experiments.

## Raw / processed evidence

The expandable comparison shows independent **raw-A**, repeat **raw-B**, and **processed** runs only for the frozen baseline label with cross-cell splits. It displays five-seed mean RMSE and the maximum individual raw/processed prediction difference. Fixed-checkpoint inference is also recorded in the downloadable paired report.

**266/266 model/task groups passed direct comparison.** This does not establish statistical TOST equivalence: 140 groups have fewer than five effective test cells; 126 have degenerate difference variance. There are **zero established TOST equivalence claims**. The preregistered RMSE-ratio interval is 0.95–1.05. Other protocols, alternative labels and transfer runs do not inherit these paired claims.

Scope restrictions remain visible:

- **06/07/08:** the source lane is a BatteryLife processed copy. No claim is made about unacquired BatteryArchive original CSVs. The six transfer directions use these three sources.
- **11 KIT:** v2 EOC temperature-endpoint profile, with V/I missing; not a waveform benchmark.
- **19 Oxford:** Group 5 only.
- **27/37:** no eligible observed endpoint in the frozen cohorts, so point-value RUL is unavailable. 37 uses incident-screened v7 identities.
- **03/41:** author-reported RUL is kept in its own profile, separate from independently observed threshold events. Initial-capacity SOH and nominal-capacity SOH remain separate.
- CALCE and other excluded or blocked combinations are not silently counted as successful results.

LLM conversion experiments, human Gold/review, and cross-machine reproduction are separate evaluations; training completion does not complete them.

## Public files and refresh

All public files are hosted with the static website, so visitors do not need access to the server or data repository:

| File in `assets/data/benchmark-results/` | Content |
|---|---|
| `snapshot.json` | Compact explorer data, scope, source hashes and data-repository commit |
| `model_rankings.csv` | 1,176 rows: seven models × 168 ranking conditions |
| `current_harness_metrics.csv` | All 8,540 per-fit metrics, lane/seed identifiers and code fingerprints |
| `current_harness_equivalence.json` | Direct comparisons, fixed inference and TOST limitations |
| `current_harness_rankings.json` | Protocol/label comparisons |
| `FINAL_SUMMARY.json` | Original summary with input hashes |

The exporter copies the five original report files byte-for-byte. It checks their summary hashes, unique fit IDs, seven-model/five-seed coverage, and the agreement of displayed aggregates with processed-lane metrics. It does not retrain models or copy predictions, weights, source data, runtime logs, or private configuration.

```bash
cd /home/zhutianwen/batterylake
python3 scripts/export_benchmark_results.py \
  --benchmark-root /home/zhutianwen/BatteryLake2026/Benchmark
python3 -m unittest discover -s tests -p test_benchmark_results.py
```

The site is a **published snapshot**, not a live server monitor. Its result date comes from the frozen source summary. After a reviewed refresh, commit and push the website; publication remains subject to GitHub Pages deployment. The exporter stops if the source summary and reports disagree rather than publishing an inconsistent snapshot.
