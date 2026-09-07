#!/usr/bin/env python3
"""Regenerate dataset_registry.csv from the dataset catalog embedded in js/main.js.

The website renders FALLBACK_DATASETS from js/main.js, so that array is the single
source of truth for the catalog. This script mirrors it into dataset_registry.csv
(the machine-readable registry referenced on the Documentation page and used by
app.py for assistant context), preserving the curation-tracking columns that only
exist in the CSV (assigned_student, reviewed_by, dataset_note_done, source).

Usage:
    python3 scripts/export_dataset_registry.py            # rewrite dataset_registry.csv
    python3 scripts/export_dataset_registry.py --check    # exit 1 if the CSV is stale
"""
from __future__ import annotations

import argparse
import csv
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN_JS = ROOT / "js" / "main.js"
REGISTRY = ROOT / "dataset_registry.csv"

COLUMNS = [
    "dataset_id", "dataset_name", "ref_name", "data_category", "source", "source_url",
    "processed_url", "chemistry", "form_factor", "cells", "cycles", "size_mb",
    "assigned_student", "reviewed_by", "status",
    "metadata_done", "timeseries_done", "cycle_summary_done", "dataset_note_done", "qc_done",
    "last_updated", "notes",
]
PRESERVED = ["source", "assigned_student", "reviewed_by", "dataset_note_done"]

_ROW_RE = re.compile(r"^\s*\{ id:'", re.M)
_FIELD_RE = re.compile(r"(\w+):\s*('(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"|-?\d+(?:\.\d+)?)")


def _unquote(value: str) -> str:
    if value[:1] in ("'", '"'):
        return value[1:-1].replace("\\'", "'").replace('\\"', '"').strip()
    return value


def load_catalog() -> list[dict]:
    text = MAIN_JS.read_text(encoding="utf-8")
    start = text.index("const FALLBACK_DATASETS")
    end = text.index("\n];", start)
    rows = []
    for line in text[start:end].splitlines():
        if not _ROW_RE.match(line):
            continue
        rows.append({key: _unquote(value) for key, value in _FIELD_RE.findall(line)})
    return rows


def load_existing() -> dict[str, dict]:
    if not REGISTRY.exists():
        return {}
    with REGISTRY.open(encoding="utf-8", newline="") as handle:
        return {row["dataset_id"]: row for row in csv.DictReader(handle) if row.get("dataset_id")}


def build_rows() -> list[dict]:
    existing = load_existing()
    out = []
    for d in load_catalog():
        old = existing.get(d["id"], {})
        row = {
            "dataset_id": d["id"],
            "dataset_name": d.get("name", ""),
            "ref_name": d.get("ref_name", ""),
            "data_category": d.get("category", ""),
            "source": old.get("source", "") or d.get("doi", ""),
            "source_url": d.get("doi", ""),
            "processed_url": d.get("processed_url", ""),
            "chemistry": d.get("chemistry", ""),
            "form_factor": d.get("form", ""),
            "cells": d.get("cells", ""),
            "cycles": d.get("cycles", "0"),
            "size_mb": d.get("size_mb", "0"),
            "assigned_student": old.get("assigned_student", "") or d.get("student", ""),
            "reviewed_by": old.get("reviewed_by", ""),
            "status": d.get("status", "pending"),
            "metadata_done": d.get("meta", "no"),
            "timeseries_done": d.get("ts", "no"),
            "cycle_summary_done": d.get("cs", "no"),
            "dataset_note_done": old.get("dataset_note_done", "") or "no",
            "qc_done": d.get("qc", "no"),
            "last_updated": d.get("updated", ""),
            "notes": d.get("notes", ""),
        }
        for key in ("cells", "last_updated"):
            if row[key] in ("—", "-"):
                row[key] = ""
        out.append(row)
    return out


def render(rows: list[dict]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--check", action="store_true", help="only report whether the CSV is up to date")
    args = parser.parse_args()
    rendered = render(build_rows())
    current = REGISTRY.read_text(encoding="utf-8") if REGISTRY.exists() else ""
    if args.check:
        if rendered == current:
            print("dataset_registry.csv is up to date")
            return 0
        print("dataset_registry.csv is stale; run scripts/export_dataset_registry.py", file=sys.stderr)
        return 1
    REGISTRY.write_text(rendered, encoding="utf-8")
    print(f"Wrote {REGISTRY.name} with {rendered.count(chr(10)) - 1} datasets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
