# Benchmark publication status

[中文](BENCHMARK_RESULTS.zh-CN.md) · [Benchmark page](https://tianwen1209.github.io/batterylake/#benchmarks)

Quantitative experimental results are reserved for the paper and are not included in the current website publication.

The dataset and task selectors cover the nineteen frozen experimental datasets: 01, 03, 04, 05, 06, 07, 08, 09, 11, 17, 18, 19, 21, 23, 27, 36, 37, 38 and 41. Each selection shows qualitative availability, source, experimental scope, task definition and an unranked list of evaluated models. Availability applies to the selected subsets, not necessarily the full original release or every possible label definition.

The public availability text was checked against the server's frozen `Benchmark/harness_v1/manifest.json` and completed `Benchmark/reports/pinn4soh_v1/current_harness_metrics.csv` records on 2026-09-14. Only manually reviewed qualitative descriptions are embedded in `js/benchmark-results.js`; neither source file is exported to the website. Updating availability requires checking the experiment records again, rather than inferring completion from the dataset catalogue's display status.

The page retains the distinctions between BatteryLife copies and author originals, KIT endpoint-only inputs, Oxford's Group 5 scope, separate EVERLASTING time/operation profiles, and author-reported versus observed RUL endpoints. For Onori second-life (27) and the incident-screened HM subset (37), selecting RUL explains right-censoring and displays no evaluated-model list or prediction illustration. SOH remains selectable. Completion of a fit is not presented as proof of accuracy or statistical equivalence.

For available tasks, the page retains conceptual SOH and RUL comparison illustrations. These illustrations are drawn independently of experimental data, have no calibrated numerical axes, and do not represent measured model performance. The chart changes with the task; changing datasets changes the scope description, not the illustrative trajectory. This distinction is stated next to the chart. Animation can be paused and respects reduced-motion preferences. The local training-package workflow remains available.

The current publication excludes metric tables, rankings, paired statistics, real prediction curves, numerical snapshots, and experimental CSV/JSON or image downloads. The frontend does not request private results in the background. The previous numerical-asset directory is ignored by Git to prevent automatic backups from republishing regenerated files.

Full experiment artifacts and a verified copy of the numerical website are retained in a server-only archive outside this website's deployment tree. Restoring quantitative material requires a new publication instruction from the owner.

This change withdraws the current website files. It does not rewrite prior Git commits or retract copies that were already downloaded or cached.
