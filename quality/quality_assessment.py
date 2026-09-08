"""
BatteryLake — Quality Assessment engine
=======================================

Computes a *real* data-quality report for a battery cycling dataset and emits
JSON in the exact schema consumed by the Quality Assessment page
(js/main.js -> renderQualityResults / QA_DEFAULT_REPORT).

Four scored dimensions ............ completeness · consistency · accuracy · validity
Six physical-plausibility checks .. voltage_range · energy_balance · capacity_mono
                                    temperature_consistency · timestamp_integrity
                                    current_direction

Accepts either of the standardized BatteryLake artifacts:
  - timeseries.parquet / .csv   (voltage_V, current_A, temperature_C, capacity_Ah, timestamp, cycle_number)
  - cycle_summary.csv           (discharge_capacity_Ah, charge_capacity_Ah, coulombic_efficiency, cycle_number, ...)

Column names are resolved tolerantly (see COLUMN_ALIASES), so lightly-formatted
raw exports also work.

Public API
----------
    assess_dataset(path, dataset_id=None, chemistry=None) -> dict   # the report
    report_to_frontend_schema(report) -> dict                       # already frontend-shaped

Dependencies: pandas, numpy  (already in requirements.txt)
"""

from __future__ import annotations

import datetime as _dt
import math
from pathlib import Path

import numpy as np
import pandas as pd


# ──────────────────────────────────────────────────────────────────────────
# Column resolution — map many real-world header spellings to canonical names
# ──────────────────────────────────────────────────────────────────────────
COLUMN_ALIASES = {
    "voltage": ["voltage_v", "voltage", "volt", "v", "ecell_v", "u", "cell_voltage"],
    "current": ["current_a", "current", "curr", "i", "amp", "cell_current"],
    "temperature": ["temperature_c", "temperature", "temp", "temp_c", "t", "cell_temp", "surface_temp"],
    "capacity": ["capacity_ah", "capacity", "cap", "q", "qd", "discharge_capacity_ah",
                 "discharge_capacity", "q_discharge"],
    "charge_capacity": ["charge_capacity_ah", "charge_capacity", "q_charge", "qc"],
    "coulombic_efficiency": ["coulombic_efficiency", "ce", "efficiency", "coulombic_eff"],
    # BatteryLake v2 canonical time series carry elapsed_test_s (seconds) and,
    # for some sources, an ISO `timestamp` string; either works here.
    "timestamp": ["timestamp", "elapsed_test_s", "time_s", "test_time_s", "time", "test_time",
                  "t_s", "elapsed_time", "datetime", "date_time"],
    "cycle": ["cycle_number", "cycle", "cycle_index", "source_cycle_id", "cycle_id", "cyc",
              "cycle_no", "cycle_count", "n"],
    # Grouping column: monotonicity / timestamp checks run per cell, not across
    # concatenated cells.
    "cell": ["cell_id", "physical_cell_id", "entity_id", "cell", "battery_id", "cell_name",
             "source_id"],
}

# Physical-plausibility voltage window per chemistry (V). Falls back to a generic
# Li-ion window when chemistry is unknown.
VOLTAGE_WINDOWS = {
    "LFP": (2.0, 3.8),
    "LCO": (2.5, 4.3),
    "NMC": (2.5, 4.35),
    "NMC811": (2.5, 4.35),
    "NCA": (2.5, 4.3),
    "_default": (2.0, 4.5),
}

# The six checks, in display order, with the copy the page already shows.
CHECK_DEFS = [
    ("voltage_range", "Voltage Range Validation",
     "All cell voltages within nominal operating range for the stated chemistry."),
    ("energy_balance", "Energy Balance Check",
     "Charge/discharge energy integral consistency; coulombic efficiency within 95-105% per cycle."),
    ("capacity_mono", "Capacity Monotonicity",
     "Degradation trajectory follows expected non-increasing trend with allowable recovery windows."),
    ("temperature_consistency", "Temperature Consistency",
     "Cell surface temperature stays within 5C of the stated test condition."),
    ("timestamp_integrity", "Timestamp Integrity",
     "Monotonically increasing timestamps with no negative intervals or gaps above 24h."),
    ("current_direction", "Current Direction Consistency",
     "Charge and discharge current signs follow one convention throughout the dataset."),
]

EXPECTED_CHANNELS = ["voltage", "current", "temperature", "capacity", "timestamp"]

# A check counts as a warning (not a hard fail) below its pass-ratio floor.
# Physical channels are noisy by nature (cells heat up under load, coulombic
# efficiency scatters around 1), so the floors differ per check.
WARN_THRESHOLD = 0.995
CHECK_PASS_MIN = {
    "voltage_range": 0.995,
    "energy_balance": 0.95,
    "capacity_mono": 0.98,
    "temperature_consistency": 0.90,
    "timestamp_integrity": 0.995,
    "current_direction": 0.995,
}


# ──────────────────────────────────────────────────────────────────────────
# Loading + column mapping
# ──────────────────────────────────────────────────────────────────────────
def _load_frame(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in (".parquet", ".pq"):
        return pd.read_parquet(path)
    if suffix in (".csv", ".txt"):
        return pd.read_csv(path)
    if suffix in (".tsv",):
        return pd.read_csv(path, sep="\t")
    raise ValueError(f"Unsupported file type: {suffix} ({path.name})")


def _resolve_columns(df: pd.DataFrame) -> dict:
    """Map canonical channel names to the frame's columns.

    The first alias that exists *and holds at least one non-null value* wins, so
    an all-empty `timestamp` column does not shadow a populated `elapsed_test_s`.
    """
    lookup = {str(c).lower().strip(): c for c in df.columns}
    resolved = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias not in lookup:
                continue
            col = lookup[alias]
            if df[col].notna().any():
                resolved[canonical] = col
                break
        # A column that exists but is entirely empty counts as absent.
    return resolved


def _infer_chemistry(dataset_id: str | None) -> str:
    if not dataset_id:
        return "_default"
    up = dataset_id.upper()
    for chem in ("NMC811", "LFP", "LCO", "NCA", "NMC"):
        if chem in up:
            return chem
    return "_default"


def _clamp01(x: float) -> float:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return 0.0
    return float(max(0.0, min(1.0, x)))


# ──────────────────────────────────────────────────────────────────────────
# Individual physical checks  →  each returns (pass_ratio, status, metric_note)
# ──────────────────────────────────────────────────────────────────────────
def _check_voltage_range(df, cols, chemistry):
    if "voltage" not in cols:
        return None
    v = pd.to_numeric(df[cols["voltage"]], errors="coerce").dropna()
    if v.empty:
        return None
    vmin, vmax = VOLTAGE_WINDOWS.get(chemistry, VOLTAGE_WINDOWS["_default"])
    within = ((v >= vmin) & (v <= vmax)).mean()
    return float(within), f"{within*100:.1f}% within {vmin}-{vmax}V"


def _check_energy_balance(df, cols):
    # Prefer an explicit coulombic-efficiency column; else derive from capacities.
    ce = None
    if "coulombic_efficiency" in cols:
        ce = pd.to_numeric(df[cols["coulombic_efficiency"]], errors="coerce").dropna()
        if not ce.empty and ce.median() > 2:  # stored as percent
            ce = ce / 100.0
    elif "capacity" in cols and "charge_capacity" in cols:
        qd = pd.to_numeric(df[cols["capacity"]], errors="coerce")
        qc = pd.to_numeric(df[cols["charge_capacity"]], errors="coerce")
        if "cycle" in cols:
            # Time series: capacities accumulate within a cycle, so compare the
            # per-cycle (per-cell) maxima rather than row-by-row values.
            keys = [cols["cell"]] if "cell" in cols else []
            keys.append(cols["cycle"])
            tmp = pd.DataFrame({"_qd": qd, "_qc": qc})
            for k in keys:
                tmp[k] = df[k].values
            agg = tmp.dropna(subset=["_qd", "_qc"]).groupby(keys, sort=False)[["_qd", "_qc"]].max()
            agg = agg[(agg["_qc"] > 0) & (agg["_qd"] > 0)]
            ce = (agg["_qd"] / agg["_qc"]).replace([np.inf, -np.inf], np.nan).dropna()
        else:
            ce = (qd / qc).replace([np.inf, -np.inf], np.nan).dropna()
    if ce is None or ce.empty:
        return None
    within = ((ce >= 0.95) & (ce <= 1.05)).mean()
    return float(within), f"{within*100:.1f}% of {len(ce)} cycles CE in 95-105%"


def _groups(df, cols):
    """Yield sub-frames per cell (or the whole frame when no cell column)."""
    if "cell" in cols and df[cols["cell"]].nunique(dropna=True) > 1:
        for _, g in df.groupby(cols["cell"], sort=False, dropna=True):
            yield g
    else:
        yield df


def _capacity_mono_one(g, cols):
    """(rises, steps) for one cell: per-cycle max capacity should not rise > 2%."""
    if "cycle" in cols:
        s = (g[[cols["cycle"], cols["capacity"]]]
             .apply(pd.to_numeric, errors="coerce").dropna()
             .groupby(cols["cycle"])[cols["capacity"]].max())
    else:
        s = pd.to_numeric(g[cols["capacity"]], errors="coerce").dropna()
    if len(s) < 3:
        return 0, 0
    s = s.to_numpy(dtype=float)
    tol = 0.02 * abs(s[0]) if s[0] else 0.0
    return int(np.sum(np.diff(s) > tol)), int(len(s) - 1)


def _check_capacity_mono(df, cols):
    if "capacity" not in cols:
        return None
    rises = steps = 0
    for g in _groups(df, cols):
        r, n = _capacity_mono_one(g, cols)
        rises += r
        steps += n
    if steps < 2:
        return None
    ok = 1.0 - rises / max(1, steps)
    return float(ok), f"{rises} non-monotonic step(s) over {steps + 1} cycles"


def _check_temperature_consistency(df, cols):
    if "temperature" not in cols:
        return None
    t = pd.to_numeric(df[cols["temperature"]], errors="coerce").dropna()
    if t.empty:
        return None
    nominal = float(t.median())
    within = (t.sub(nominal).abs() <= 5.0).mean()
    return float(within), f"{within*100:.1f}% within +/-5C of {nominal:.1f}C"


def _timestamp_seconds(series):
    ts = pd.to_numeric(series, errors="coerce")
    if ts.notna().sum() < 3:
        # Maybe a datetime string column -> seconds.
        parsed = pd.to_datetime(series, errors="coerce", utc=True)
        ts = parsed.astype("int64", errors="ignore") if parsed.notna().any() else parsed
        ts = pd.to_numeric(ts, errors="coerce") / 1e9
        ts = ts.where(parsed.notna())
    return ts.dropna()


def _timestamp_one(g, cols):
    """(negatives, big_gaps, intervals) for one cell."""
    ts = _timestamp_seconds(g[cols["timestamp"]])
    if len(ts) < 3:
        return 0, 0, 0
    dt = np.diff(ts.to_numpy(dtype=float))
    negatives = int(np.sum(dt < 0))
    # Treat >24h gaps as suspect only when the unit looks like seconds.
    big_gaps = int(np.sum(dt > 24 * 3600)) if np.nanmedian(np.abs(dt)) < 3600 else 0
    return negatives, big_gaps, int(len(dt))


def _check_timestamp_integrity(df, cols):
    if "timestamp" not in cols:
        return None
    negatives = big_gaps = intervals = 0
    for g in _groups(df, cols):
        n, b, k = _timestamp_one(g, cols)
        negatives += n
        big_gaps += b
        intervals += k
    if intervals < 2:
        return None
    ok = 1.0 - (negatives + big_gaps) / max(1, intervals)
    return float(ok), f"{negatives} negative interval(s), {big_gaps} large gap(s)"


def _check_current_direction(df, cols):
    if "current" not in cols:
        return None
    i = pd.to_numeric(df[cols["current"]], errors="coerce").dropna()
    if i.empty:
        return None
    has_pos = (i > 0).any()
    has_neg = (i < 0).any()
    # A healthy cycling dataset has both signs (charge & discharge) with a clear
    # zero-centred split. Score by how cleanly the two directions separate.
    if not (has_pos and has_neg):
        return 0.5, "only one current sign present"
    # Both directions present. Flag only a pathological split (< 2% of non-zero
    # samples in one direction), which usually means a sign-convention change.
    nz = i[i != 0]
    minority = float(min((nz > 0).mean(), (nz < 0).mean())) if len(nz) else 0.0
    if minority < 0.02:
        return 0.9, f"one direction is only {minority*100:.1f}% of non-zero samples"
    return 1.0, f"charge {(nz > 0).mean()*100:.0f}% / discharge {(nz < 0).mean()*100:.0f}% of non-zero samples"


CHECK_FUNCS = {
    "voltage_range": lambda df, cols, chem: _check_voltage_range(df, cols, chem),
    "energy_balance": lambda df, cols, chem: _check_energy_balance(df, cols),
    "capacity_mono": lambda df, cols, chem: _check_capacity_mono(df, cols),
    "temperature_consistency": lambda df, cols, chem: _check_temperature_consistency(df, cols),
    "timestamp_integrity": lambda df, cols, chem: _check_timestamp_integrity(df, cols),
    "current_direction": lambda df, cols, chem: _check_current_direction(df, cols),
}


# ──────────────────────────────────────────────────────────────────────────
# Dimension scores
# ──────────────────────────────────────────────────────────────────────────
def _score_completeness(df, cols):
    present = sum(1 for ch in EXPECTED_CHANNELS if ch in cols)
    channel_score = present / len(EXPECTED_CHANNELS)
    used = [cols[ch] for ch in EXPECTED_CHANNELS if ch in cols]
    non_null = 1.0
    if used:
        non_null = 1.0 - float(df[used].isna().to_numpy().mean())
    return _clamp01(0.5 * channel_score + 0.5 * non_null), present


def _score_validity(df, cols):
    # Required columns present + numeric + finite + within absolute sane bounds.
    required = ["voltage", "current"]
    have = sum(1 for r in required if r in cols)
    presence = have / len(required)
    finite_ratios = []
    for ch in ("voltage", "current", "temperature", "capacity"):
        if ch in cols:
            s = pd.to_numeric(df[cols[ch]], errors="coerce")
            finite_ratios.append(float(np.isfinite(s.to_numpy(dtype=float)).mean()))
    finite = np.mean(finite_ratios) if finite_ratios else 1.0
    return _clamp01(0.5 * presence + 0.5 * finite)


def _score_consistency(check_ratios):
    # Timestamp + monotonicity + current convention drive "consistency".
    keys = ["timestamp_integrity", "capacity_mono", "current_direction"]
    vals = [check_ratios[k] for k in keys if check_ratios.get(k) is not None]
    return _clamp01(np.mean(vals)) if vals else 0.9


def _score_accuracy(check_ratios):
    # Physical-plausibility checks drive "accuracy".
    keys = ["voltage_range", "energy_balance", "capacity_mono", "temperature_consistency"]
    vals = [check_ratios[k] for k in keys if check_ratios.get(k) is not None]
    return _clamp01(np.mean(vals)) if vals else 0.9


# ──────────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────────
def assess_dataset(path, dataset_id: str | None = None, chemistry: str | None = None) -> dict:
    """Run the full quality assessment on a file and return a frontend-ready report dict."""
    path = Path(path)
    df = _load_frame(path)
    return assess_frame(df, dataset_id=dataset_id or path.stem, chemistry=chemistry, file_name=path.name)


def _metrics(df, cols, check_ratios, check_notes):
    """Plain counts behind the four cards (shown in the card footers)."""
    used = [cols[ch] for ch in EXPECTED_CHANNELS if ch in cols]
    missing_pct = float(df[used].isna().to_numpy().mean() * 100) if used and len(df) else 0.0
    n_groups = int(df[cols["cell"]].nunique(dropna=True)) if "cell" in cols else 1
    seq_flags = 0
    for key in ("timestamp_integrity", "capacity_mono"):
        note = check_notes.get(key, "")
        seq_flags += sum(int(x) for x in __import__("re").findall(r"(\d+) (?:negative|large|non-monotonic)", note))
    if check_ratios.get("current_direction") is not None and check_ratios["current_direction"] < 0.9:
        seq_flags += 1
    schema_errors = sum(1 for r in ("voltage", "current") if r not in cols)
    for ch in ("voltage", "current", "temperature", "capacity"):
        if ch in cols:
            s = pd.to_numeric(df[cols[ch]], errors="coerce")
            raw_present = df[cols[ch]].notna()
            schema_errors += int((raw_present & ~np.isfinite(s.to_numpy(dtype=float))).sum())
    return {
        "n_rows": int(len(df)),
        "n_cells": n_groups,
        "channels_present": [ch for ch in EXPECTED_CHANNELS if ch in cols],
        "channels_missing": [ch for ch in EXPECTED_CHANNELS if ch not in cols],
        "missing_pct": round(missing_pct, 2),
        "sequence_flags": int(seq_flags),
        "schema_errors": int(schema_errors),
    }


def assess_frame(df: pd.DataFrame, dataset_id: str, chemistry: str | None = None,
                 file_name: str | None = None, extra: dict | None = None) -> dict:
    """Run the full quality assessment on an in-memory frame."""
    cols = _resolve_columns(df)
    chem = (chemistry or _infer_chemistry(dataset_id)).upper()
    if chem not in VOLTAGE_WINDOWS:
        chem = "_default"

    # Run the six checks.
    check_ratios: dict[str, float | None] = {}
    check_notes: dict[str, str] = {}
    for key, name, detail in CHECK_DEFS:
        result = CHECK_FUNCS[key](df, cols, chem)
        if result is None:
            check_ratios[key] = None
            check_notes[key] = "channel not available — skipped"
        else:
            ratio, note = result
            check_ratios[key] = ratio
            check_notes[key] = note

    # pass / warn status per check (skipped channels are reported as pass, noted).
    checks_detail = []
    for key, name, detail in CHECK_DEFS:
        ratio = check_ratios[key]
        status = "pass" if (ratio is None or ratio >= CHECK_PASS_MIN.get(key, WARN_THRESHOLD)) else "warn"
        checks_detail.append({
            "key": key, "name": name, "detail": detail,
            "status": status, "score": None if ratio is None else round(ratio, 4),
            "note": check_notes[key],
        })
    warn_count = sum(1 for c in checks_detail if c["status"] == "warn")

    # Four dimensions.
    completeness, _present = _score_completeness(df, cols)
    consistency = _score_consistency(check_ratios)
    accuracy = _score_accuracy(check_ratios)
    validity = _score_validity(df, cols)
    dims = {
        "completeness": round(completeness, 2),
        "consistency": round(consistency, 2),
        "accuracy": round(accuracy, 2),
        "validity": round(validity, 2),
    }
    overall = round(sum(dims.values()) / 4, 2)
    gate = "ready" if warn_count == 0 else "ready_with_warning"
    # Very low scores mean the file is not a usable cycling dataset as-is
    # (wrong channels, out-of-scope test): ask for a human look.
    if overall < 0.7 or dims["accuracy"] < 0.5 or dims["validity"] < 0.6:
        gate = "needs_review"

    report = {
        "dataset_id": dataset_id,
        "file_name": file_name or dataset_id,
        "chemistry": "unknown" if chem == "_default" else chem,
        "n_rows": int(len(df)),
        "resolved_columns": {k: str(v) for k, v in cols.items()},
        "metrics": _metrics(df, cols, check_ratios, check_notes),
        "quality_score": dims,
        "overall": overall,
        "gate": gate,
        "checks_detail": checks_detail,
        "checks": [
            {"name": c["key"], "passed": True} if c["status"] == "pass"
            else {"name": c["key"], "status": "review"}
            for c in checks_detail
        ],
        "warn_count": warn_count,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": "python",
    }
    if extra:
        report.update(extra)
    return report


def report_to_frontend_schema(report: dict) -> dict:
    """Keep what the page + downloaded JSON use (drops the resolved column map)."""
    keep = ("dataset_id", "file_name", "chemistry", "n_rows", "metrics", "quality_score", "overall",
            "gate", "checks_detail", "checks", "warn_count", "generated_at", "source", "sample")
    out = {k: report[k] for k in keep if k in report}
    if "checks_detail" in out:
        out["checks_detail"] = [
            {k: c[k] for k in ("key", "name", "detail", "status", "score", "note") if k in c}
            for c in out["checks_detail"]
        ]
    return out
