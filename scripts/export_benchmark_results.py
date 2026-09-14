"""Publish a small, auditable website snapshot of the completed benchmark.

Reads only frozen manifests and lightweight reports; never runs training or
copies datasets, predictions, checkpoints, logs, or private configuration.
"""
import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import statistics
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MODELS = dict(linear="Linear Regression", rf="Random Forest", xgboost="XGBoost",
              lstm="LSTM", transformer="Transformer", cnn="CNN", pinn="PINN4SOH")
KEY = ["case_id", "task", "variant", "protocol", "target_unit"]
PROFILE_NAMES = dict(primary="Primary profile", rul="RUL profile",
                     continued="May / June continuation", operations="Recorded operation axis")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def build(bench):
    source = bench / "reports/pinn4soh_v1"
    names = ["FINAL_SUMMARY.json", "model_rankings.csv", "current_harness_metrics.csv",
             "current_harness_equivalence.json", "current_harness_rankings.json"]
    payload = {n: (source / n).read_bytes() for n in names}
    summary = json.loads(payload["FINAL_SUMMARY.json"])
    # Fail closed if a periodic report refresh changed any frozen result.
    for name, expected in summary["input_hashes"].items():
        require(sha(payload[name]) == expected, "Summary fingerprint mismatch: " + name)
    require(sha(payload["model_rankings.csv"]) == summary["ranking_sha256"], "Ranking fingerprint mismatch")
    metrics = list(csv.DictReader(io.StringIO(payload["current_harness_metrics.csv"].decode())))
    rankings = list(csv.DictReader(io.StringIO(payload["model_rankings.csv"].decode())))
    pairs = json.loads(payload["current_harness_equivalence.json"])
    manifest_bytes = (bench / "harness_v1/manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    transfer_bytes = (bench / "harness_v1/transfer_manifest.json").read_bytes()
    transfers = json.loads(transfer_bytes)
    require(len(metrics) == summary["verified_fits"] == summary["planned_fits"], "Fit coverage incomplete")
    require(not summary["incomplete_ranking_conditions"], "Incomplete ranking conditions")
    require(len({r['job_id'] for r in metrics}) == len(metrics), "Duplicate fits")
    groups = defaultdict(list)
    for row in metrics:
        groups[tuple(row[k] for k in KEY) + (row['model'], row['lane'])].append(row)

    cases = []
    for p in manifest['training_profiles']:
        cases.append(dict(id=p['id'], dataset_id=p['dataset_id'],
                          name=PROFILE_NAMES[p['id'].split('__')[1]],
                          selected_cells=len(p['cells']), split_cells={k: len(v) for k, v in p['splits'].items()},
                          source_reference=p['source_reference'], label=p['label'],
                          baseline_ready_tasks=p['baseline_ready_tasks']))
    for p in transfers['pairs']:
        a, b = p['from_case'].split('__')[0], p['to_case'].split('__')[0]
        cases.append(dict(id=p['id'], dataset_id='transfer', name=a + ' → ' + b,
                          selected_cells=None, split_cells=None, source_reference=p['source_kind'],
                          label='Q / source nominal capacity. Train and validate on ' + a + '; test on ' + b + '.',
                          baseline_ready_tasks=['soh_estimation']))
    registry = {r['dataset_id']: r for r in csv.DictReader((ROOT / 'dataset_registry.csv').open())}
    datasets = [dict(id=d, name=registry[d].get('name') or registry[d]['ref_name'])
                for d in sorted({p['dataset_id'] for p in manifest['training_profiles']})]
    conditions = {}
    for row in rankings:
        key = tuple(row[k] for k in KEY)
        source_rows = groups[key + (row['model'], 'processed')]
        require(len(source_rows) == 5 and {int(r['seed']) for r in source_rows} == set(range(5)), "Five-seed coverage missing")
        for stat, field in [('cell_equal_rmse_mean', 'cell_equal_rmse'), ('cell_equal_mae_mean', 'cell_equal_mae')]:
            require(math.isclose(float(row[stat]), statistics.mean(float(r[field]) for r in source_rows), rel_tol=1e-12),
                    "Published aggregate disagrees with processed lane")
        for field in ['test_n', 'test_cells']:
            require(len({r[field] for r in source_rows}) == 1, "Test scope differs between seeds")
        condition = conditions.setdefault(key, dict(zip(KEY, key), models=[]))
        condition['models'].append(dict(model=row['model'], rank=float(row['rank_by_cell_equal_rmse']),
            rmse=float(row['cell_equal_rmse_mean']), sd=float(row['cell_equal_rmse_seed_sd']),
            mae=float(row['cell_equal_mae_mean']), sample_rmse=float(row['sample_rmse_mean']),
            sample_mae=float(row['sample_mae_mean']), seeds=int(row['seeds']),
            test_cells=int(source_rows[0]['test_cells']), test_n=int(source_rows[0]['test_n'])))
    for condition in conditions.values():
        require(len(condition['models']) == 7 and {r['model'] for r in condition['models']} == set(MODELS), "Seven-model coverage missing")
        for row in condition['models']:
            require(all(math.isfinite(row[k]) for k in ['rank', 'rmse', 'sd', 'mae']), "Non-finite metric")
    require(len(conditions) == summary['ranking_conditions'], "Condition coverage mismatch")
    public_pairs = []
    for pair in pairs:
        key = (pair['case_id'], pair['task'])
        # Paired training was preregistered only for baseline / cross-cell.
        condition = next(c for c in conditions.values() if (c['case_id'], c['task']) == key
                         and c['variant'] == 'baseline' and c['protocol'] == 'cross_cell')
        prefix = tuple(condition[k] for k in KEY) + (pair['model'],)
        lane_rmse = {}
        for lane in ['raw_a', 'raw_b', 'processed']:
            rs = groups[prefix + (lane,)]
            require(len(rs) == 5 and {int(r['seed']) for r in rs} == set(range(5)), 'Paired seed coverage incomplete')
            lane_rmse[lane] = statistics.mean(float(r['cell_equal_rmse']) for r in rs)
        public_pairs.append(dict(case_id=pair['case_id'], task=pair['task'], model=pair['model'],
            status=pair['status'], seeds=pair['completed_paired_seeds'],
            raw_repeat_max_abs=max(s['raw_repeat_max_abs'] for s in pair['seeds']),
            paired_max_abs=max(s['paired_max_abs'] for s in pair['seeds']),
            fixed_inference_passed=all(s['fixed_inference_status'] == 'passed' for s in pair['seeds']),
            tost_status=pair['tost']['status'], **lane_rmse))
    require(dict(Counter(p['status'] for p in pairs)) == summary['paired_statuses'], 'Paired report mismatch')
    commit = subprocess.check_output(['git', '-C', str(bench.parent), 'rev-parse', 'HEAD'], text=True).strip()
    data = dict(schema_version=1, exported_at=datetime.now(timezone.utc).isoformat(timespec='seconds'),
        results_at=summary['updated_at'], data_repository_commit=commit,
        summary=dict(fits=len(metrics), task_fits=dict(Counter(r['task'] for r in metrics)),
            datasets=manifest['dataset_count'], profiles=len(manifest['training_profiles']),
            models=len(MODELS), seeds=[0, 1, 2, 3, 4], conditions=len(conditions),
            protocol_comparisons=summary['protocol_comparisons'], paired_groups=len(pairs),
            paired_statuses=summary['paired_statuses'], tost_statuses=summary['tost_statuses'],
            tost_claims=summary['final_tost_equivalence_claims']),
        models=MODELS, datasets=datasets, cases=cases, conditions=list(conditions.values()), pairs=public_pairs,
        source_hashes={**{n: sha(b) for n, b in payload.items()},
                       'harness_v1/manifest.json': sha(manifest_bytes), 'harness_v1/transfer_manifest.json': sha(transfer_bytes)})
    return data, payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark-root', type=Path, default=Path('/home/zhutianwen/BatteryLake2026/Benchmark'))
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/data/benchmark-results')
    args = parser.parse_args()
    data, payload = build(args.benchmark_root)
    args.output.mkdir(parents=True, exist_ok=True)
    for name, content in payload.items():
        (args.output / name).write_bytes(content)
    (args.output / 'snapshot.json').write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n')
    print(json.dumps(data['summary'], indent=2))


if __name__ == '__main__':
    main()
