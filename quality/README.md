# Quality Assessment — Backend Scripts & Integration Guide

Backend for the **Quality Assessment** page (`#quality`). It replaces the current
placeholder in `js/main.js` (`generateQualityReport()` produces seeded-random
scores from the file name) with a **real** analysis of battery data.

The output JSON matches the schema the page already renders, so wiring it in is
a small, backward-compatible change.

```
quality/
├── quality_assessment.py   # engine: assess_dataset(path) -> report dict (4 dims + 6 checks)
├── run_quality.py          # batch runner: file/folder -> <id>_quality_report.json
├── __init__.py             # makes `from quality import assess_dataset` work
└── README.md               # this file
```

Dependencies are already in `requirements.txt` (pandas, numpy, pyarrow).

---

## 1. What it computes

**Four scored dimensions** (0–1) → shown on the four cards + overall ring:

| Dimension | Driven by |
|---|---|
| `completeness` | expected channels present + non-null coverage |
| `consistency`  | timestamp monotonicity + capacity monotonicity + current convention |
| `accuracy`     | physical-plausibility checks (voltage / CE / capacity / temperature) |
| `validity`     | required columns present, numeric, finite |

**Six physical checks** → shown in the diagnostics list (each `pass` / `warn`):
`voltage_range` · `energy_balance` · `capacity_mono` · `temperature_consistency` ·
`timestamp_integrity` · `current_direction`

`overall = mean(4 dims)`, and `gate = "ready"` when there are no warnings else
`"ready_with_warning"` — exactly the fields `renderQualityResults()` reads.

**Input:** a standardized artifact (`timeseries.parquet` / `timeseries.csv` /
`cycle_summary.csv`) or any CSV/Parquet with recognizable columns. Column names
are resolved tolerantly (`voltage_V` / `voltage` / `V` all map to voltage, etc.).

---

## 2. Run it (offline / batch)

```bash
pip install -r requirements.txt

# one dataset
python quality/run_quality.py --input path/to/timeseries.parquet --out quality_reports/

# a whole folder of processed datasets (recurses for timeseries.* / cycle_summary.csv)
python quality/run_quality.py --input data/ --out quality_reports/ --index
```

This writes one `quality_reports/<dataset_id>_quality_report.json` per dataset
(plus `index.json` with `--index`). These are static files the page can `fetch()`.

---

## 3. Wire it into the page — pick ONE of two paths

### Path A — Precomputed reports (works on GitHub Pages, no server) ✅ recommended

1. Run the batch runner and commit the `quality_reports/` folder.
2. In `js/main.js`, load the real report when a catalog dataset's quality view
   opens, instead of the random generator:

```js
// NEW — fetch a precomputed report; returns null if none exists yet.
async function loadQualityReport(datasetId) {
  try {
    const res = await fetch(`quality_reports/${datasetId}_quality_report.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Example use when opening the page for a specific dataset:
async function showDatasetQuality(datasetId) {
  const report = await loadQualityReport(datasetId);
  if (report) { qaLastReport = report; renderQualityResults(report); }
}
```

`renderQualityResults()` already accepts this exact JSON shape — nothing else changes.

### Path B — Live upload endpoint (for the local `python app.py` server)

Adds a real "Run Assessment" that analyses the uploaded file server-side.

**(a) `app.py`** — add one import near the top:

```python
import tempfile
from quality import assess_dataset, report_to_frontend_schema
```

and one branch inside `do_POST` (mirror the existing `/api/inspect` block):

```python
            if self.path == "/api/quality":
                content_type = self.headers.get("Content-Type", "")
                message = BytesParser(policy=default).parsebytes(
                    f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + raw_body
                )
                for part in message.iter_parts():
                    filename = part.get_filename()
                    if not filename:
                        continue
                    content = part.get_payload(decode=True) or b""
                    suffix = Path(filename).suffix or ".csv"
                    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
                        tmp.write(content); tmp.flush()
                        report = assess_dataset(tmp.name, dataset_id=Path(filename).stem)
                    self.send_json(report_to_frontend_schema(report))
                    return
                self.send_json({"error": "No file was received."}, status=400)
                return
```

**(b) `js/main.js`** — make `runQualityAssessment()` call the backend, with a
graceful fallback to the current client-side heuristic when no server is present:

```js
async function runQualityAssessment() {
  if (!qaSelectedFile) { showToast('Choose a dataset file first.', 'error'); return; }
  const runBtn = document.getElementById('qaRunBtn');
  const label = runBtn ? runBtn.textContent : 'Run Assessment';
  if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Analyzing...'; }
  showToast('Running quality assessment...', 'info', 1600);

  let report = null;
  try {
    const fd = new FormData();
    fd.append('file', qaSelectedFile);
    const res = await fetch('/api/quality', { method: 'POST', body: fd });
    if (res.ok) report = await res.json();
  } catch { /* backend not running — fall through */ }

  if (!report) report = generateQualityReport(qaSelectedFile); // static-host fallback
  qaLastReport = report;
  renderQualityResults(report);
  if (runBtn) { runBtn.disabled = false; runBtn.textContent = label; }
  showToast('Assessment complete - report ready to download.', 'success');
  document.getElementById('qaResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

Keep `generateQualityReport()` — it becomes the offline fallback for GitHub Pages.

---

## 4. Report schema (contract between backend and page)

```jsonc
{
  "dataset_id": "2007_NASA_PCoE_LCO_18650_1C_1C_25T",
  "file_name":  "timeseries.parquet",
  "quality_score": { "completeness": 0.97, "consistency": 0.95, "accuracy": 0.92, "validity": 1.00 },
  "overall": 0.96,
  "gate": "ready_with_warning",              // "ready" | "ready_with_warning"
  "checks_detail": [                          // 6 items, drives the diagnostics list
    { "key": "voltage_range", "name": "Voltage Range Validation",
      "detail": "...", "status": "pass" }     // status: "pass" | "warn"
    // ...
  ],
  "checks": [                                 // compact form used in the code panel + download
    { "name": "voltage_range", "passed": true },
    { "name": "temperature_consistency", "status": "review" }
  ],
  "warn_count": 1,
  "generated_at": "2026-07-12T09:00:00Z"
}
```

If you change a field name here, update `renderQualityResults()` /
`downloadQualityReport()` in `js/main.js` to match.

---

## 5. Recommendation

Use **Path A** for the deployed GitHub Pages site (precomputed reports, zero
server), and optionally **Path B** locally so contributors can drop in a new file
and get a live score before it is committed. The two paths share the same schema,
so they render identically.
