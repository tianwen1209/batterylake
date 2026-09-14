"""Source-value and corruption tests; run with the benchmark NumPy environment."""
import csv
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

try:
    import numpy as np
except ImportError:
    np = None

ROOT = Path(__file__).resolve().parents[1]
BENCH = Path('/home/zhutianwen/BatteryLake2026/Benchmark')
if np is not None:
    spec = importlib.util.spec_from_file_location('curve_export', ROOT / 'scripts/export_benchmark_trajectories.py')
    exporter = importlib.util.module_from_spec(spec); spec.loader.exec_module(exporter)


@unittest.skipUnless(np is not None and (BENCH / 'runs/harness_v1/jobs').is_dir(), 'Requires NumPy and server prediction archives')
class TrajectorySourceTest(unittest.TestCase):
    def test_displayed_values_and_endpoints_equal_saved_predictions(self):
        with (ROOT / 'assets/data/benchmark-results/current_harness_metrics.csv').open() as f:
            metrics = list(csv.DictReader(f))
        base = ROOT / 'assets/data/benchmark-results/trajectories'
        index = json.loads((base / 'index.json').read_text())
        # Real SOH, RUL, sparse random protocol, and the author PINN replacement.
        conditions = [c for c in index['conditions'] if c['case_id'] == 'dataset_01__primary' and c['variant'] == 'baseline']
        for c in conditions:
            data = json.loads((base / c['file']).read_text())
            for model in ['cnn', 'pinn']:
                row = next(r for r in metrics if all(r[k] == c[k] for k in exporter.KEY) and r['seed'] == '0' and r['lane'] == 'processed' and r['model'] == model)
                arrays, receipt = exporter.read_job(BENCH, row)
                self.assertEqual(receipt, data['sources'][model]['processed'])
                lookup = {str(k): i for i, k in enumerate(arrays['keys'])}
                for cell in data['cells']:
                    ids = [lookup[k] for k in cell['keys']]
                    self.assertEqual(arrays['prediction'][ids].tolist(), cell['predictions'][model])
                    self.assertEqual(arrays['y'][ids].tolist(), cell['truth'])
                    self.assertEqual(arrays['axis'][ids].tolist(), cell['axis'])
                    all_ids = np.flatnonzero(arrays['cells'] == cell['id'])
                    self.assertEqual(ids[0], all_ids[0]); self.assertEqual(ids[-1], all_ids[-1])

    def test_tampered_prediction_archive_is_rejected(self):
        with (ROOT / 'assets/data/benchmark-results/current_harness_metrics.csv').open() as f:
            row = next(r for r in csv.DictReader(f) if r['model'] == 'cnn' and r['seed'] == '0' and r['lane'] == 'processed')
        with tempfile.TemporaryDirectory() as tmp:
            relative = Path('runs/harness_v1/jobs') / row['job_id']
            target = Path(tmp) / relative; target.mkdir(parents=True)
            for name in ['result.json', 'predictions.npz']:
                shutil.copyfile(BENCH / relative / name, target / name)
            with (target / 'predictions.npz').open('ab') as f:
                f.write(b'changed')
            with self.assertRaisesRegex(ValueError, 'Prediction hash mismatch'):
                exporter.read_job(Path(tmp), row)


if __name__ == '__main__':
    unittest.main()
