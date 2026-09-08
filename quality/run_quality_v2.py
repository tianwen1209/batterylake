"""
BatteryLake — Quality Assessment over v2 canonical datasets
===========================================================

Walks a `Processed_Dataset/<category>/dataset_XX/` tree (BatteryLake standard
v2.0.0), samples the canonical time-series shards of every dataset that has
them, runs the quality engine, and writes the precomputed reports the Quality
Assessment page fetches:

    quality_reports/dataset_XX_quality_report.json
    quality_reports/<ref_name>_quality_report.json      (same content)
    quality_reports/index.json

Optionally it also cuts small CSV excerpts that the page offers as "try it"
samples (`--samples assets/examples/quality`).

Usage
-----
    python quality/run_quality_v2.py --root /path/to/BatteryLake2026/Processed_Dataset \
        --out quality_reports --registry dataset_registry.csv \
        --samples assets/examples/quality

Sampling keeps memory bounded: shards are picked evenly across the shard list
until `--target-rows` rows are loaded (or `--max-shards` shards), and every
report records how much of the dataset it saw (`sample`).
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quality_assessment import assess_frame, report_to_frontend_schema  # noqa: E402

# Canonical v2 columns the engine can use (others are skipped to save memory).
WANTED = [
    "cell_id", "physical_cell_id", "entity_id", "source_id", "source_file",
    "source_cycle_id", "cycle_id", "timestamp", "elapsed_test_s", "time_s",
    "voltage_V", "current_A", "temperature_C",
    "charge_capacity_Ah", "discharge_capacity_Ah",
]

# Hand-picked "try it" samples for the page: (dataset_id, cells to keep, rows).
SAMPLE_SPECS = [
    ("dataset_21", 2, 4000, "Full channel set (V, I, T, capacities, elapsed time, cycle ids) from the CMU eVTOL duty-cycle test. Expect a clean pass."),
    ("dataset_17", 2, 4000, "A123 LFP cells under a HEV drive cycle with temperature and cycle ids. Good example of an LFP voltage window."),
    ("dataset_05", 2, 4000, "RWTH NMC cycling with ISO timestamps but no temperature or capacity columns. Shows how missing channels lower completeness."),
    ("dataset_35", 6, 3000, "ARC calorimetry (thermal runaway) specimens: only time and temperature are populated. Shows an out-of-scope file scoring low."),
]


def load_registry(path: Path | None) -> dict[str, dict]:
    if not path or not path.exists():
        return {}
    out = {}
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            out[row.get("id") or row.get("dataset_id")] = row
    return out


def chemistry_from_registry(row: dict | None) -> str | None:
    if not row:
        return None
    chem = str(row.get("chemistry") or "").upper()
    for key in ("NMC811", "LFP", "LCO", "NCA", "NMC"):
        if chem.startswith(key):
            return key
    return None


def pick_shards(shards: list[Path], max_shards: int) -> list[Path]:
    if len(shards) <= max_shards:
        return shards
    step = len(shards) / max_shards
    return [shards[int(i * step)] for i in range(max_shards)]


def read_shard(path: Path, max_rows: int | None = None) -> pd.DataFrame:
    schema = pq.read_schema(path)
    cols = [c for c in WANTED if c in schema.names]
    pf = pq.ParquetFile(path)
    if max_rows is None or pf.metadata.num_rows <= max_rows:
        return pf.read(columns=cols).to_pandas()
    # Large shard: read leading batches only, so more shards (cells) fit the budget.
    batches, got = [], 0
    for batch in pf.iter_batches(batch_size=min(max_rows, 65536), columns=cols):
        batches.append(batch)
        got += batch.num_rows
        if got >= max_rows:
            break
    import pyarrow as pa
    df = pa.Table.from_batches(batches).to_pandas().head(max_rows)
    # Drop the truncated final cycle so per-cycle checks only see complete cycles.
    if "source_cycle_id" in df.columns and df["source_cycle_id"].nunique(dropna=True) > 1:
        last = df["source_cycle_id"].iloc[-1]
        df = df[df["source_cycle_id"] != last]
    return df


def load_sample(ts_dir: Path, max_shards: int, target_rows: int):
    shards = sorted(ts_dir.glob("*.parquet"))
    if not shards:
        return None, None
    chosen = pick_shards(shards, max_shards)
    # Spread the row budget over at least 12 shards when the dataset has them.
    per_shard = max(20_000, target_rows // max(1, min(len(chosen), 12)))
    frames, used, rows = [], 0, 0
    for shard in chosen:
        df = read_shard(shard, per_shard)
        if df.empty:
            continue
        frames.append(df)
        used += 1
        rows += len(df)
        if rows >= target_rows:
            break
    if not frames:
        return None, None
    df = pd.concat(frames, ignore_index=True)
    # Make sure a grouping column exists for per-cell checks.
    if "cell_id" not in df.columns or df["cell_id"].isna().all():
        fallback = next((c for c in ("physical_cell_id", "entity_id", "source_id") if c in df.columns and df[c].notna().any()), None)
        if fallback:
            df["cell_id"] = df[fallback]
    sample = {
        "shards_total": len(shards),
        "shards_used": used,
        "rows_loaded": int(len(df)),
        "rows_per_shard_cap": per_shard,
        "note": "evenly spaced canonical time-series shards, leading rows per shard" if used < len(shards) else "all canonical time-series shards (leading rows per shard)",
    }
    return df, sample


def write_sample_csv(df: pd.DataFrame, out: Path, n_cells: int, n_rows: int) -> dict:
    keep = [c for c in ("cell_id", "source_cycle_id", "timestamp", "elapsed_test_s", "voltage_V", "current_A",
                        "temperature_C", "charge_capacity_Ah", "discharge_capacity_Ah") if c in df.columns]
    sub = df[keep].copy()
    def head_whole_cycles(g: pd.DataFrame, budget: int) -> pd.DataFrame:
        """Leading rows of a cell, cut at a cycle boundary so every cycle is complete."""
        if "source_cycle_id" in g.columns and g["source_cycle_id"].notna().any():
            keep_idx, count = [], 0
            for _, cyc in g.groupby("source_cycle_id", sort=False):
                if count and count + len(cyc) > budget:
                    break
                keep_idx.extend(cyc.index.tolist())
                count += len(cyc)
                if count >= budget:
                    break
            out = g.loc[keep_idx]
            # A single cycle can exceed the budget (fine-grained loggers): decimate
            # uniformly so every cycle stays complete but the file stays small.
            if len(out) > budget * 1.3:
                step = -(-len(out) // budget)
                out = out.iloc[::step]
            return out
        return g.head(budget)

    if "cell_id" in sub.columns and sub["cell_id"].notna().any():
        cells = list(dict.fromkeys(sub["cell_id"].dropna().astype(str)))[:n_cells]
        sub = sub[sub["cell_id"].astype(str).isin(cells)]
        per = max(1, n_rows // max(1, len(cells)))
        sub = pd.concat([head_whole_cycles(g, per) for _, g in sub.groupby("cell_id", sort=False)], ignore_index=True)
    else:
        sub = head_whole_cycles(sub, n_rows)
    sub.to_csv(out, index=False)
    return {"rows": int(len(sub)), "cells": int(sub["cell_id"].nunique()) if "cell_id" in sub.columns else 1, "columns": keep}


def main() -> int:
    ap = argparse.ArgumentParser(description="BatteryLake v2 quality assessment batch runner")
    ap.add_argument("--root", required=True, help="Processed_Dataset root (category/dataset_XX layout)")
    ap.add_argument("--out", default="quality_reports")
    ap.add_argument("--registry", default="dataset_registry.csv", help="website registry CSV for ref_name / chemistry")
    ap.add_argument("--samples", default=None, help="write 'try it' CSV excerpts into this folder")
    ap.add_argument("--max-shards", type=int, default=160)
    ap.add_argument("--target-rows", type=int, default=600_000)
    ap.add_argument("--only", default=None, help="comma-separated dataset ids to (re)run")
    args = ap.parse_args()

    root = Path(args.root)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    registry = load_registry(Path(args.registry) if args.registry else None)
    only = set(args.only.split(",")) if args.only else None
    samples_dir = Path(args.samples) if args.samples else None
    if samples_dir:
        samples_dir.mkdir(parents=True, exist_ok=True)
    sample_specs = {d: (c, n, note) for d, c, n, note in SAMPLE_SPECS}

    index, samples_manifest = [], []
    for ts_dir in sorted(root.glob("*/dataset_*/canonical/time_series")):
        ds_dir = ts_dir.parent.parent
        ds_id = ds_dir.name
        if only and ds_id not in only:
            continue
        df, sample = load_sample(ts_dir, args.max_shards, args.target_rows)
        if df is None:
            print(f"  - {ds_id}: no time-series shards", file=sys.stderr)
            continue
        reg = registry.get(ds_id)
        ref_name = (reg or {}).get("ref_name") or ds_id
        chem = chemistry_from_registry(reg)
        status = {}
        try:
            status = json.loads((ds_dir / "status.json").read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
        extra = {
            "sample": sample,
            "ref_name": ref_name,
            "category": ds_dir.parent.name,
            "processing_status": status.get("status"),
        }
        report = assess_frame(df, dataset_id=ds_id, chemistry=chem,
                              file_name=f"canonical/time_series ({sample['shards_used']}/{sample['shards_total']} shards)",
                              extra=extra)
        report["source"] = "canonical_v2_sample"
        payload = report_to_frontend_schema(report)
        payload["ref_name"] = ref_name
        payload["category"] = extra["category"]
        payload["processing_status"] = extra["processing_status"]
        for name in {ds_id, ref_name}:
            (out_dir / f"{name}_quality_report.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
        flag = "OK" if report["warn_count"] == 0 else "!!"
        print(f"  {flag} {ds_id:<11} {ref_name:<58} overall={report['overall']:.2f} warnings={report['warn_count']} "
              f"rows={sample['rows_loaded']:,} shards={sample['shards_used']}/{sample['shards_total']}")
        index.append({
            "dataset_id": ref_name, "catalog_id": ds_id, "category": extra["category"],
            "overall": report["overall"], "gate": report["gate"], "warn_count": report["warn_count"],
            "n_rows": sample["rows_loaded"], "file": f"{ds_id}_quality_report.json",
        })

        if samples_dir and ds_id in sample_specs:
            n_cells, n_rows, note = sample_specs[ds_id]
            csv_path = samples_dir / f"{ds_id}_timeseries_sample.csv"
            info = write_sample_csv(df, csv_path, n_cells, n_rows)
            samples_manifest.append({
                "file": csv_path.name, "dataset_id": ds_id, "ref_name": ref_name,
                "name": next((reg[k] for k in ("name", "dataset_name", "title") if reg and reg.get(k)), ds_id), "chemistry": (reg or {}).get("chemistry"),
                "rows": info["rows"], "cells": info["cells"], "columns": info["columns"], "note": note,
                "size_kb": round(csv_path.stat().st_size / 1024, 1),
            })
            print(f"     sample -> {csv_path} ({info['rows']} rows, {info['cells']} cells)")

    index_path = out_dir / "index.json"
    if only and index_path.exists():
        # Partial rerun: merge into the existing index instead of replacing it.
        try:
            previous = json.loads(index_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            previous = []
        done = {e["catalog_id"] for e in index}
        index = [e for e in previous if e.get("catalog_id") not in done] + index
        index.sort(key=lambda e: e.get("catalog_id", ""))
    index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
    if samples_dir:
        manifest_path = samples_dir / "samples.json"
        if only and manifest_path.exists():
            try:
                previous = json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                previous = []
            done = {e["dataset_id"] for e in samples_manifest}
            samples_manifest = [e for e in previous if e.get("dataset_id") not in done] + samples_manifest
            order = [d for d, *_ in SAMPLE_SPECS]
            samples_manifest.sort(key=lambda e: order.index(e["dataset_id"]) if e["dataset_id"] in order else 99)
        manifest_path.write_text(json.dumps(samples_manifest, indent=2), encoding="utf-8")
    print(f"\nDone. {len(index)} report(s) -> {out_dir}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
