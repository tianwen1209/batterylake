"""Render verified real test predictions as PNGs without numerical annotations.

Uses the existing benchmark CPU environment (NumPy, Matplotlib, Pillow).
Only images and an allowlisted display index enter the website. Full provenance,
sample identities, scale limits and hashes are written to a server-only audit.
No training, smoothing, error-based selection or exported prediction arrays.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['path.simplify'] = False
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATASETS = [1, 3, 4, 5, 6, 7, 8, 9, 11, 17, 18, 19, 21, 23, 27, 36, 37, 38, 41]
MODELS = ['linear', 'rf', 'xgboost', 'lstm', 'transformer', 'cnn', 'pinn']
MODEL_NAMES = ['Linear Regression', 'Random Forest', 'XGBoost', 'LSTM', 'Transformer', 'CNN', 'PINN']
SELECTION_SEED = 20260910
SEED = 0
AXES = {
    'discharge_operations': 'Discharge operations',
    'source_summary_cycles': 'Recorded cycles',
    'source_aging_drive_cycles': 'Ageing drive cycles',
    'recorded_aging_discharge_operations': 'Recorded discharge operations',
    'source_cycle_number': 'Recorded cycles', 'source_cycle_count': 'Recorded cycles',
    'WLTP_drive_cycle_repetitions': 'WLTP repetitions',
    'source_charac_aging_cycles': 'Ageing cycles',
    'recorded_flight_mission_operations': 'Mission operations',
    'elapsed_calendar_days': 'Elapsed time',
    'completed_recorded_48_hour_synthetic_duty_cycles': 'Recorded duty cycles',
    'author_ageing_cycles': 'Author ageing cycles',
    'recorded_ageing_discharge_operations': 'Recorded discharge operations',
    'RPT_sequence_not_cycles': 'Diagnostic sequence',
    'source_cycle_key': 'Recorded cycles',
    'source_aging_discharge_slot': 'Ageing discharge slots',
}


def digest(payload):
    return hashlib.sha256(payload).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_job(bench, row):
    package = 'pinn4soh_v1' if row['model'] == 'pinn' else 'harness_v1'
    folder = bench / 'runs' / package / 'jobs' / row['job_id']
    receipt_bytes = (folder / 'result.json').read_bytes()
    receipt = json.loads(receipt_bytes)
    require(receipt['status'] == 'completed', 'Incomplete fit')
    for key in ['case_id', 'task', 'variant', 'protocol', 'model', 'lane', 'job_id']:
        require(receipt['spec'][key] == row[key], 'Wrong prediction identity: ' + key)
    require(receipt['spec']['seed'] == SEED, 'Wrong seed')
    require(receipt['code_identity'] == row['code_identity'], 'Code fingerprint mismatch')
    payload = (folder / 'predictions.npz').read_bytes()
    require(digest(payload) == receipt['outputs']['predictions.npz'], 'Prediction hash mismatch')
    with np.load(io.BytesIO(payload), allow_pickle=False) as archive:
        arrays = {k: archive[k] for k in ['prediction', 'y', 'valid', 'keys', 'cells', 'axis', 'split']}
    require(all(a.ndim == 1 and len(a) == len(arrays['y']) for a in arrays.values()), 'Array shape mismatch')
    require(arrays['valid'].dtype == np.dtype(bool), 'Invalid mask type')
    # Keep original within-cell positions so invalid/purged anchors break lines.
    positions = np.empty(len(arrays['y']), dtype=np.int64)
    for cell in np.unique(arrays['cells']):
        ids = np.flatnonzero(arrays['cells'] == cell)
        positions[ids] = np.arange(len(ids))
    arrays['position'] = positions
    keep = arrays['valid'] & (arrays['split'] == 'test')
    arrays = {k: a[keep] for k, a in arrays.items()}
    require(len(arrays['y']) == int(row['test_n']), 'Test anchor count mismatch')
    require(len(np.unique(arrays['cells'])) == int(row['test_cells']), 'Test cell count mismatch')
    require(len(set(arrays['keys'])) == len(arrays['keys']), 'Duplicate test identity')
    require(all(np.isfinite(arrays[k]).all() for k in ['y', 'prediction', 'axis']), 'Nonfinite valid test value')
    return arrays, {'job_id': row['job_id'], 'predictions_sha256': digest(payload),
                    'receipt_sha256': digest(receipt_bytes), 'code_identity': row['code_identity']}


def aligned(reference, candidate):
    for key in ['keys', 'cells', 'axis', 'y', 'valid', 'split', 'position']:
        require(np.array_equal(reference[key], candidate[key]), 'Prediction alignment mismatch: ' + key)


def choose_cell(arrays, case):
    cells = sorted(set(arrays['cells'].tolist()), key=lambda c: digest(
        json.dumps([SELECTION_SEED, case, c], separators=(',', ':')).encode()))
    require(bool(cells), 'No eligible test cell')
    return cells[0]


def segments(x, y, position):
    gaps = np.flatnonzero(np.diff(position) > 1) + 1
    return np.insert(x.astype(float), gaps, np.nan), np.insert(y.astype(float), gaps, np.nan)


def plot_image(path, axis, truth, processed, raw, position):
    require(np.all(np.diff(axis) >= 0), 'Life axis reverses within cell')
    values = np.concatenate([truth, processed] + ([] if raw is None else [raw]))
    low, high = float(values.min()), float(values.max())
    padding = (high - low) * .07 if high > low else max(abs(high) * .07, .01)
    xlow, xhigh = float(axis.min()), float(axis.max())
    xpadding = (xhigh - xlow) * .02 if xhigh > xlow else 1.
    fig = Figure(figsize=(8, 4), dpi=160, facecolor='none')
    FigureCanvasAgg(fig)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()
    ax.set_xlim(xlow-xpadding, xhigh+xpadding)
    ax.set_ylim(low-padding, high+padding)
    # No clipping to a plausible SOH/RUL range: retain observed model errors.
    for y, color, width, style in [(truth, '#10aa9c', 2.0, '-'),
                                   (raw, '#e99438', 3.4, '--'),
                                   (processed, '#578cf5', 1.6, '-')]:
        if y is not None:
            x, line = segments(axis, y, position)
            ax.plot(x, line, color=color, linewidth=width, linestyle=style,
                    marker='.', markersize=2.5, solid_capstyle='round')
    buffer = io.BytesIO()
    fig.savefig(buffer, format='png', transparent=True, dpi=160)
    # Strip all textual metadata; publish pixels only, never plot/source arrays.
    with Image.open(io.BytesIO(buffer.getvalue())) as image:
        image.convert('RGBA').save(path, format='PNG', optimize=True)
    fig.clear()
    return {'x_limits': [xlow-xpadding, xhigh+xpadding], 'y_limits': [low-padding, high+padding]}


def export(bench, output, audit_path):
    require(not audit_path.resolve().is_relative_to(ROOT.resolve()), 'Audit must remain outside website')
    report_dir = bench / 'reports/pinn4soh_v1'
    metrics_bytes = (report_dir / 'current_harness_metrics.csv').read_bytes()
    summary = json.loads((report_dir / 'FINAL_SUMMARY.json').read_text())
    require(digest(metrics_bytes) == summary['input_hashes']['current_harness_metrics.csv'], 'Metrics fingerprint changed')
    rows = list(csv.DictReader(io.StringIO(metrics_bytes.decode())))
    lookup = {}
    for row in rows:
        if row['seed'] == str(SEED) and row['variant'] == 'baseline':
            key = tuple(row[k] for k in ['case_id', 'task', 'protocol', 'model', 'lane'])
            require(key not in lookup, 'Duplicate fit identity')
            lookup[key] = row
    output.mkdir(parents=True, exist_ok=True)
    index = {'models': dict(zip(MODELS, MODEL_NAMES)), 'entries': []}
    audit = {'metrics_sha256': digest(metrics_bytes), 'script_sha256': digest(Path(__file__).read_bytes()),
             'seed': SEED, 'selection_seed': SELECTION_SEED, 'entries': []}
    for number in DATASETS:
        dataset = f'dataset_{number:02d}'
        for task in ['soh_estimation', 'rul_prediction']:
            if task == 'rul_prediction' and number in [27, 37]:
                continue
            suffix = 'rul' if task == 'rul_prediction' and number in [3, 38, 41] else 'primary'
            case = f'{dataset}__{suffix}'
            # XJTU RUL has no completed cross-cell fit. Display its temporal
            # experiment explicitly; never relabel it or substitute random split.
            protocol = 'temporal' if number == 9 and task == 'rul_prediction' else 'cross_cell'
            reference = None
            for model in MODELS:
                key = (case, task, protocol, model)
                row = lookup[key + ('processed',)]
                arrays, receipt = load_job(bench, row)
                if reference is None:
                    reference = arrays
                    cell = choose_cell(arrays, case)
                    selected = np.flatnonzero(arrays['cells'] == cell)
                aligned(reference, arrays)
                raw, raw_receipt = None, None
                if protocol == 'cross_cell':
                    raw, raw_receipt = load_job(bench, lookup[key + ('raw_a',)])
                    aligned(reference, raw)
                name = f'{dataset}-{task}-{model}.png'
                scale = plot_image(output / name, arrays['axis'][selected], arrays['y'][selected],
                                   arrays['prediction'][selected], None if raw is None else raw['prediction'][selected],
                                   arrays['position'][selected])
                profile = ('Author-endpoint profile' if number in [3, 41] and task == 'rul_prediction'
                           else 'Timestamp-matched profile' if number == 38 and task == 'rul_prediction'
                           else 'Elapsed-time profile' if number == 23
                           else 'Frozen baseline profile')
                public = {'dataset_id': dataset, 'task': task, 'model': model, 'image': name,
                          'cell': cell, 'profile': profile, 'axis_label': AXES[row['axis_unit']],
                          'protocol': 'Within-cell temporal test' if protocol == 'temporal' else 'Cross-cell test',
                          'raw_comparison': raw is not None}
                index['entries'].append(public)
                audit['entries'].append({**public, 'case_id': case, 'processed': receipt, 'raw': raw_receipt,
                                         'keys': arrays['keys'][selected].tolist(), 'points': len(selected),
                                         'image_sha256': digest((output / name).read_bytes()), **scale})
            print(f'{dataset} {task}: rendered verified curves', flush=True)
    (output / 'index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':'))+'\n')
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
    audit_path.chmod(0o600)
    print(f'Complete: {len(index["entries"])} images; private provenance at {audit_path}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark-root', type=Path, default=Path('/home/zhutianwen/BatteryLake2026/Benchmark'))
    parser.add_argument('--output', type=Path, default=ROOT/'assets/images/benchmark-curves')
    parser.add_argument('--audit', type=Path, required=True)
    args = parser.parse_args()
    export(args.benchmark_root, args.output, args.audit)
