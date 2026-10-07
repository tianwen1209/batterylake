#!/usr/bin/env python3
"""Read-only helpers for the BatteryLake metadata index.

Import this from the benchmark, the data platform or any script. It has no
dependencies beyond the standard library and never writes.

    from metadata.read import load_index, find, load_record, iter_cells

    index = load_index()
    lfp = find(index, cathode_chemistry="LFP", min_entities=10)
    record = load_record("dataset_41")
    for cell in iter_cells(record):
        ...

If this folder is copied into another repo (e.g. the sibling batterylake project), each
copy's index.json carries a content_hash over its dataset rows. Use diverged_from() to check
whether two copies have skewed instead of diffing every dataset file by hand:

    from metadata.read import load_index, diverged_from
    diverged_from(load_index(), load_index("/path/to/other/copy/index.json"))

Filtering rules:
  * scalar field -> exact match, or a list/tuple/set to mean "any of"
  * list field (signals, supported_tasks, quality_flags, source_format, cathode_chemistries,
    anode_chemistries, form_factors, cell_format_codes, charge_profiles, discharge_profiles)
    -> every value given must be present in the dataset's list
  * cathode_chemistry, anode_chemistry, form_factor and cell_format_code are accepted as names for
    the lists above, so find(index, cathode_chemistry="LFP") means "LFP is among the dataset's
    cathode_chemistries" (a dataset that mixes LFP with other cathodes matches too)
  * min_* / max_* prefixes compare numerically against the field that follows
"""
from __future__ import annotations

import json
import os
from typing import Any, Iterable, Iterator

HERE = os.path.dirname(os.path.abspath(__file__))
LIST_FIELDS = {"signals", "supported_tasks", "quality_flags", "source_format", "cathode_chemistries",
               "anode_chemistries", "form_factors", "cell_format_codes", "charge_profiles", "discharge_profiles"}
# the single-value names that these lists replaced in the records and the index
ALIASES = {"cathode_chemistry": "cathode_chemistries", "anode_chemistry": "anode_chemistries",
           "form_factor": "form_factors", "cell_format_code": "cell_format_codes"}


def load_index(path: str | None = None) -> dict:
    """The global index: counts, facet vocabularies and one row per dataset."""
    with open(path or os.path.join(HERE, "index.json"), encoding="utf-8") as handle:
        return json.load(handle)


def load_record(dataset_id: str, path: str | None = None) -> dict:
    """The full record for one dataset, including per-cell rows."""
    target = path or os.path.join(HERE, "datasets", f"{dataset_id}.json")
    with open(target, encoding="utf-8") as handle:
        return json.load(handle)


def facets(index: dict) -> dict[str, list]:
    """Every value present per filterable field, for building filter controls."""
    return index["facets"]


def find(index: dict, **filters: Any) -> list[dict]:
    """Index rows matching every filter. See the module docstring for the rules."""
    rows = index["datasets"]
    for key, wanted in filters.items():
        if wanted is None:
            continue
        key = ALIASES.get(key, key)
        if key.startswith(("min_", "max_")):
            bound, field = key.split("_", 1)
            rows = [
                row for row in rows
                if row.get(field) is not None
                and (row[field] >= wanted if bound == "min" else row[field] <= wanted)
            ]
        elif key in LIST_FIELDS:
            needed = [wanted] if isinstance(wanted, str) else list(wanted)
            rows = [row for row in rows if all(n in (row.get(key) or []) for n in needed)]
        elif isinstance(wanted, (list, tuple, set)):
            rows = [row for row in rows if row.get(key) in wanted]
        else:
            rows = [row for row in rows if row.get(key) == wanted]
    return rows


def by_ref_name(index: dict, name: str) -> dict | None:
    """The index row a reference name belongs to, whether current or superseded."""
    for row in index["datasets"]:
        if name == row.get("ref_name") or name in (row.get("ref_name_aliases") or []):
            return row
    return None


def content_hash(index: dict) -> str | None:
    """The index's dataset-content hash, or None for an index built before this field existed."""
    return index.get("content_hash")


def diverged_from(index: dict, other: dict) -> bool:
    """Whether two loaded indexes disagree on dataset content.

    Meant for copies of this metadata folder living in more than one repo (e.g. this one and
    the sibling batterylake project's): load both indexes and compare them to tell whether one
    has been regenerated since the copy, without diffing every dataset file by hand. Always
    True if either index predates content_hash, since that can't be verified.
    """
    a, b = content_hash(index), content_hash(other)
    return a is None or b is None or a != b


def iter_cells(record: dict) -> Iterator[dict]:
    """Per-cell rows with dataset-level defaults filled in.

    A record stores only the values where a cell differs from its dataset, so
    this resolves each cell to a complete row before yielding it.
    """
    def sole(values):
        """The one value of a dataset-level list, or None when it holds several (the cell rows say which)."""
        return values[0] if len(values) == 1 else None

    defaults = {
        "manufacturer": record["cell"]["manufacturer"],
        "model": record["cell"]["model"],
        "cathode_chemistry": sole(record["cell"]["cathode_chemistries"]),
        "anode_chemistry": sole(record["cell"]["anode_chemistries"]),
        "form_factor": sole(record["cell"]["form_factors"]),
        "nominal_capacity_Ah": record["cell"]["nominal_capacity_Ah"],
        "nominal_voltage_V": record["cell"]["nominal_voltage_V"],
        "voltage_min_V": record["cell"]["voltage_min_V"],
        "voltage_max_V": record["cell"]["voltage_max_V"],
        "protocol_charge_raw": record["conditions"]["protocol_charge_raw"],
        "protocol_discharge_raw": record["conditions"]["protocol_discharge_raw"],
        "temperature_C": (
            record["conditions"]["temperature_setpoints_C"][0]
            if len(record["conditions"]["temperature_setpoints_C"]) == 1 else None
        ),
    }
    for cell in record["cells"]:
        resolved = dict(defaults)
        resolved.update({k: v for k, v in cell.items() if v is not None})
        resolved["dataset_id"] = record["dataset_id"]
        yield resolved


def usable_for(index: dict, task: str, exclude_flags: Iterable[str] = ()) -> list[dict]:
    """Datasets that declare `task` and carry none of `exclude_flags`.

    The benchmark should call this rather than filtering on supported_tasks alone:
    a dataset can declare SOH and still be unusable because its capacity
    exceeds the nominal capacity many times over (capacity_exceeds_nominal).
    """
    blocked = set(exclude_flags)
    return [
        row for row in find(index, supported_tasks=task)
        if not blocked & set(row.get("quality_flags") or [])
    ]


if __name__ == "__main__":
    index = load_index()
    counts = index["counts"]
    print(f"{counts['datasets']} datasets, {counts['entities']} entities, "
          f"{counts['raw_files']} raw files, "
          f"{counts['raw_bytes'] / 1e9:.1f} GB")
    print("\nLFP datasets with 10+ entities:")
    for row in find(index, cathode_chemistry="LFP", min_n_entities=10):
        print(f"  {row['dataset_id']:11} {row['ref_name']}")
    print("\nSOH datasets not flagged capacity_exceeds_nominal or duplicate_of_other_dataset:")
    ready = usable_for(index, "SOH", exclude_flags=(
        "capacity_exceeds_nominal", "duplicate_of_other_dataset"))
    print("  " + ", ".join(r["dataset_id"] for r in ready))
