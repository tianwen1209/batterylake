"""Export deterministic, bounded test-prediction illustrations for the website.

Run with the benchmark CPU environment (NumPy required). No training, smoothing,
label inference, or selection by model error. Full predictions remain on server.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
KEY = ['case_id', 'task', 'variant', 'protocol', 'target_unit']
MAX_CELLS = 3
MAX_POINTS = 512
SELECTION_SEED = 20260910


def digest(b):
    return hashlib.sha256(b).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def condition_id(condition):
    return digest(json.dumps([condition[k] for k in KEY], separators=(',', ':')).encode())[:24]


def read_job(bench, row):
    package = 'pinn4soh_v1' if row['model'] == 'pinn' else 'harness_v1'
    folder = bench / 'runs' / package / 'jobs' / row['job_id']
    receipt_bytes = (folder / 'result.json').read_bytes()
    receipt = json.loads(receipt_bytes)
    spec = receipt['spec']
    require(receipt['status'] == 'completed', 'Incomplete fit: ' + row['job_id'])
    for k in ['case_id', 'task', 'variant', 'protocol', 'model', 'lane', 'job_id']:
        require(spec[k] == row[k], 'Wrong prediction identity: ' + k)
    require(spec['seed'] == 0 and receipt['code_identity'] == row['code_identity'], 'Seed or code mismatch')
    payload = (folder / 'predictions.npz').read_bytes()
    require(digest(payload) == receipt['outputs']['predictions.npz'], 'Prediction hash mismatch')
    with np.load(io.BytesIO(payload), allow_pickle=False) as archive:
        arrays = {k: archive[k] for k in ['prediction', 'y', 'valid', 'keys', 'cells', 'axis', 'split']}
    require(all(v.ndim == 1 and len(v) == len(arrays['y']) for v in arrays.values()), 'Array shape mismatch')
    keep = arrays['valid'] & (arrays['split'] == 'test')
    arrays = {k: v[keep] for k, v in arrays.items()}
    require(len(arrays['y']) == int(row['test_n']), 'Test record count mismatch')
    require(len(np.unique(arrays['cells'])) == int(row['test_cells']), 'Test cell count mismatch')
    require(len(set(arrays['keys'])) == len(arrays['keys']), 'Duplicate test identity')
    require(all(np.isfinite(arrays[k]).all() for k in ['y', 'prediction', 'axis']), 'Non-finite test value')
    return arrays, dict(job_id=row['job_id'], prediction_sha256=digest(payload), receipt_sha256=digest(receipt_bytes))


def aligned(reference, candidate):
    # Refuse row misalignment rather than comparing the wrong physical records.
    for k in ['keys', 'cells', 'axis', 'y', 'valid', 'split']:
        require(np.array_equal(reference[k], candidate[k]), 'Prediction alignment mismatch: ' + k)


def export(bench, output):
    parent = ROOT / 'assets/data/benchmark-results'
    snapshot_bytes = (parent / 'snapshot.json').read_bytes()
    snapshot = json.loads(snapshot_bytes)
    metrics_bytes = (parent / 'current_harness_metrics.csv').read_bytes()
    require(digest(metrics_bytes) == snapshot['source_hashes']['current_harness_metrics.csv'], 'Metrics fingerprint changed')
    metrics = list(csv.DictReader(io.StringIO(metrics_bytes.decode())))
    lookup = {tuple(r[k] for k in KEY) + (r['model'], r['lane']): r for r in metrics if r['seed'] == '0'}
    output.mkdir(parents=True, exist_ok=True)
    index = dict(schema_version=1, seed=0, snapshot_sha256=digest(snapshot_bytes),
                 selection='First three eligible test cells by SHA-256 of [20260910, case_id, cell_id]; independent of errors.',
                 sampling='At most 512 equally spaced recorded test anchors per cell, including first and last. No smoothing or interpolation of exported values.',
                 conditions=[])
    for condition in snapshot['conditions']:
        key = tuple(condition[k] for k in KEY)
        models = sorted(snapshot['models'])
        arrays, receipt = read_job(bench, lookup[key + (models[0], 'processed')])
        cells = sorted(set(arrays['cells'].tolist()), key=lambda c: digest(json.dumps([SELECTION_SEED, key[0], c], separators=(',', ':')).encode()))[:MAX_CELLS]
        selections = {}
        records = []
        for cell in cells:
            ids = np.flatnonzero(arrays['cells'] == cell)
            require(np.all(np.diff(arrays['axis'][ids]) >= 0), 'Life axis reverses within cell')
            positions = np.linspace(0, len(ids) - 1, min(len(ids), MAX_POINTS), dtype=int)
            picked = ids[positions]; selections[cell] = picked
            records.append(dict(id=cell, total_test_points=len(ids), plotted_points=len(picked),
                keys=arrays['keys'][picked].tolist(), axis=arrays['axis'][picked].tolist(), truth=arrays['y'][picked].tolist(),
                predictions={}, raw_predictions={}, breaks=(np.r_[True, np.diff(positions) > 1]).tolist()))
        sources = {}
        for model in models:
            a, receipt = (arrays, receipt) if model == models[0] else read_job(bench, lookup[key + (model, 'processed')])
            aligned(arrays, a); sources[model] = {'processed': receipt}
            for record in records:
                record['predictions'][model] = a['prediction'][selections[record['id']]].tolist()
            raw_key = key + (model, 'raw_a')
            if raw_key in lookup:
                raw, raw_receipt = read_job(bench, lookup[raw_key]); aligned(arrays, raw)
                sources[model]['raw_a'] = raw_receipt
                for record in records:
                    record['raw_predictions'][model] = raw['prediction'][selections[record['id']]].tolist()
        entry = {k: condition[k] for k in KEY}
        entry.update(seed=0, axis_unit=lookup[key + (models[0], 'processed')]['axis_unit'], cells=records, sources=sources)
        payload = (json.dumps(entry, allow_nan=False, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        name = condition_id(condition) + '.json'
        (output / name).write_bytes(payload)
        index['conditions'].append({**{k: condition[k] for k in KEY}, 'file': name, 'sha256': digest(payload),
            'cells': cells, 'plotted_points': sum(r['plotted_points'] for r in records)})
    (output / 'index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(dict(conditions=len(index['conditions']), seed=0,
                         cells=sum(len(c['cells']) for c in index['conditions']),
                         bytes=sum(f.stat().st_size for f in output.glob('*.json')))))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark-root', type=Path, default=Path('/home/zhutianwen/BatteryLake2026/Benchmark'))
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/data/benchmark-results/trajectories')
    args = parser.parse_args()
    export(args.benchmark_root, args.output)
