"""
BatteryLake — Quality Assessment batch runner
=============================================

Runs the quality engine over one file or a whole folder of datasets and writes
one `<dataset_id>_quality_report.json` per dataset into an output directory that
the Quality Assessment page can fetch directly.

Usage
-----
    # single file
    python quality/run_quality.py --input path/to/timeseries.parquet

    # a folder of processed datasets (recurses for timeseries.* / cycle_summary.csv)
    python quality/run_quality.py --input data/ --out quality_reports/

    # also write an index the frontend can list
    python quality/run_quality.py --input data/ --out quality_reports/ --index

Output
------
    quality_reports/
        <dataset_id>_quality_report.json     # frontend-schema report, one per dataset
        index.json                           # [{dataset_id, overall, gate, warn_count, file}]  (with --index)

The JSON matches the schema in js/main.js (renderQualityResults / downloadQualityReport),
so the page can load a report without any recomputation.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running as `python quality/run_quality.py` from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from quality_assessment import assess_dataset, report_to_frontend_schema  # noqa: E402


# Files we treat as an assessable dataset artifact.
DATASET_GLOBS = ("timeseries.parquet", "timeseries.csv", "cycle_summary.csv")


def _discover(input_path: Path) -> list[tuple[str, Path]]:
    """Return [(dataset_id, file_path)] for a file or a directory tree."""
    if input_path.is_file():
        return [(input_path.stem, input_path)]

    found: list[tuple[str, Path]] = []
    for pattern in DATASET_GLOBS:
        for f in input_path.rglob(pattern):
            # dataset_id = the folder name that holds the artifact (BatteryLake ref_name),
            # falling back to the file stem for loose files.
            ds_id = f.parent.name if f.parent != input_path else f.stem
            found.append((ds_id, f))
    # De-duplicate: prefer timeseries over cycle_summary for the same dataset_id.
    best: dict[str, Path] = {}
    for ds_id, f in found:
        if ds_id not in best or "timeseries" in f.name:
            best[ds_id] = f
    return sorted(best.items())


def main() -> int:
    ap = argparse.ArgumentParser(description="BatteryLake quality assessment batch runner")
    ap.add_argument("--input", "-i", required=True, help="Dataset file or a folder of datasets")
    ap.add_argument("--out", "-o", default="quality_reports", help="Output directory for JSON reports")
    ap.add_argument("--chemistry", default=None, help="Override chemistry (LFP/NMC/LCO/NCA); else inferred from id")
    ap.add_argument("--index", action="store_true", help="Also write index.json summarising all reports")
    ap.add_argument("--full", action="store_true", help="Keep backend-only fields (columns, notes) in the JSON")
    args = ap.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"error: input not found: {input_path}", file=sys.stderr)
        return 2

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = _discover(input_path)
    if not targets:
        print(f"error: no dataset artifacts found under {input_path}", file=sys.stderr)
        return 2

    index = []
    for ds_id, file_path in targets:
        try:
            report = assess_dataset(file_path, dataset_id=ds_id, chemistry=args.chemistry)
        except Exception as exc:  # noqa: BLE001 — report and continue the batch
            print(f"  ✗ {ds_id}: {exc}", file=sys.stderr)
            continue

        payload = report if args.full else report_to_frontend_schema(report)
        out_file = out_dir / f"{ds_id}_quality_report.json"
        out_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

        flag = "✓" if report["warn_count"] == 0 else "!"
        print(f"  {flag} {ds_id:<52} overall={report['overall']:.2f}  "
              f"gate={report['gate']:<18} warnings={report['warn_count']}")
        index.append({
            "dataset_id": ds_id,
            "overall": report["overall"],
            "gate": report["gate"],
            "warn_count": report["warn_count"],
            "file": out_file.name,
        })

    if args.index:
        (out_dir / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
        print(f"\nWrote index.json with {len(index)} report(s) → {out_dir/'index.json'}")

    print(f"\nDone. {len(index)} report(s) written to {out_dir}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
