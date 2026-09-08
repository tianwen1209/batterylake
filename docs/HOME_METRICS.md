# Home page metrics

[English](HOME_METRICS.md) | [简体中文](HOME_METRICS.zh-CN.md)

The Home page describes **complete original source releases**, including releases for which the server holds only a subset. It does not describe the number of downloaded files, local disk usage, converted table rows, or benchmark acceptance.

The 2026-09-08 audit gives 40 visible catalog entries, 32 source/lab groups, a 19-year span (2007–2026), 2,038,307 known source cycles, 2,394 known cells, and approximately 430.4 GB of original release files. These are **known totals**, not a claim that every source has published every statistic. The page lists how many entries still have unknown totals. See the [per-dataset audit](home-metrics-audit.json) for the values, previous values, evidence and source links.

## Definitions

| Metric | Definition |
| --- | --- |
| Curated datasets | Visible catalog entries; the three hidden internal IDs remain excluded. Versions and historical aliases can remain separate catalog entries. |
| Worldwide institutions | Existing catalog convention: distinct source/lab keys extracted from `ref_name`. This is a count of catalog source groups, not an independently verified census of legal institutions or countries. |
| Years span | Maximum minus minimum four-digit year in `ref_name`, including internal entries. This is not a count of years of continuous measurements. |
| Total cycles | Known original-source cycle totals. Preserve each author's cycle definition; partial-DoD cycles are not converted to equivalent full cycles. Do not substitute time-series rows, RPT row counts, or a processed subset's cycles. |
| Total cells | Known numeric cell counts for the original study/release. EV counts and values labelled as specimens remain excluded under the existing catalog convention. Confirmed shared physical-cell groups contribute their maximum count once. Unknown overlap is not resolved by guessing. |
| Data volume | Original release file sizes in decimal GB: `size_mb = bytes / 1,000,000`, then `volumeGB = sum(size_mb) / 1,000`. Count compressed releases in their published form; do not add locally extracted or canonical copies. Distinct source versions can have distinct volume contributions. Some archive-only releases exclude small accompanying guides, as recorded in each row's evidence. |

Cycles, cells, release volume and the year/source calculations continue to include the three hidden internal entries. Their unknown values are not invented. The internal 240 MiB figure is retained as a legacy reported amount, converted to decimal MB.

## Source corrections affecting the totals

- **MATR (03):** all three original batches (May 2017, June 2017 and April 2018), 8,269,341,808 bytes from upstream HEAD responses. The later 2019 extension is outside this release. The old 96,000-cycle estimate is withheld pending a complete audit.
- **SNL/HNEI/UL-PUR (06–08):** the size of a BatteryLife processed ZIP is not the original CSV release size. Original CSV sizes remain unknown. [BatteryArchive's study summary](https://www.batteryarchive.org/study_summaries.html) identifies **21** original UL-PUR Part I cells; the local processed copy has only 10. The processed-copy cycle counts are not promoted to full original cycle totals.
- **KIT (11/13):** v1 has 69,375,563,264 bytes; v2 logs have 81,909,759,488 bytes according to the official RADAR `contentSize` metadata. Both releases refer to the same 228-cell study, so cells count once. The [official version relationship](https://publikationen.bibliothek.kit.edu/1000174529) explains the separation between logs and results.
- **Characterization (14):** the [author paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC12394511/) identifies 45 Molicel P42A cells and Stanford/Onori authorship. The complete author OSF archive is 2,745,069,193 bytes.
- **Changan (15):** both parts of the complete upstream split archive total 74,306,376,155 bytes. The approximately 108 MB server sample does not set the Home metric.
- **EVERLASTING (22/23):** both current IDs map to the [corrected cycling release](https://data.4tu.nl/datasets/e19fe272-4f46-450c-9125-6545c4c1a98b): 17 per-cell CSV files plus README, 9,134,458,452 bytes. The README is not an eighteenth cell. Count this identical release once. The old e42bca59 calendar record is a different source and is not substituted for this corrected release.
- **Onori (25/27):** the complete original UDDS release size remains unknown while traversal is incomplete. Do not count its downloaded subset as the release. The [second-life paper](https://pangea.stanford.edu/ERE/pdf/OnoriPDF/Journals/97.pdf) continues six cells from the first-life study; the two entries share one physical-cell count group, but their release files remain distinct.
- **Calendar aging (29):** the [author cell-ID table](https://github.com/viveklam/Joule-Decade-Calendar-Aging/blob/main/Joule_cell_id.csv) has 259 unique IDs, including 27 cells excluded from the paper's 232-cell analysis. Count the source release, including those excluded cells. Raw and summary archives total 850,754,705 bytes; extracted copies are not added.
- **Beihang (30):** the [complete seven-file release](https://zenodo.org/records/10656500) is listed as **38.1 GB**, rounded by the publisher. All QAS packages contribute even though this acquisition selected GIS and DTI only. Its 515 vehicles do not become 515 cells.
- **THI (40):** the complete ZIP is 79,545 bytes. Count 108 `(chemistry, Cell Identity Number)` keys once across alternate CSV/XLSX/TAB formats. Its 478 CSV observations are calendar capacity observations, not 478 aging cycles.

The old Oxford PathDep and TUM cycle estimates are also withheld where a complete original-cycle total has not been established. Large existing full-source cycle counts retain their recorded author definitions and audit evidence; they do not imply that an SOH/RUL benchmark has passed.

## Maintaining the data

1. Update each row in `FALLBACK_DATASETS` in `js/main.js`. `cells`, `cycles` and `size_mb` describe the complete source; do not copy local acquisition counters into them.
2. Set `stats_scope: 'full_source'`. Set `cells_basis`, `cycles_basis` and `volume_basis` to `known`, `unknown`, or `not_applicable`. Volume also permits `author_rounded` and `legacy_reported`; document why. A zero paired with `unknown` is a storage placeholder, not a measured zero.
3. Use `cells_group`, `cycles_group` and `volume_group` only for confirmed overlaps. The corresponding aggregate takes the maximum within that group. The group must represent identical coverage or a proven subset; do not use it for partially overlapping populations that need a more detailed identity mapping.
4. Record the release, source URL, counting method and completeness evidence in `evidence`, and update `docs/home-metrics-audit.json`. Track download and processing progress separately in the data repository.
5. Run `python3 scripts/export_dataset_registry.py`, then its `--check` mode. The deployed page loads the adjacent `dataset_registry.csv`, so its online and offline catalogs are from the same repository version.
6. Run `python3 -m unittest discover -s tests -p test_home_metrics.py` with Playwright/Chromium installed. The browser checks cover CSV parity and failure, exclusion of local subsets, shared-cell counting, hidden internal rows, vehicle units and mobile layout.

Source-identity overrides must not overwrite audited metrics. Uploaded CSV files without an explicit full-source scope are not admitted into the numeric totals.
