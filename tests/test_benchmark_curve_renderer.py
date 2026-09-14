"""Run with the benchmark CPU environment to verify provenance safeguards."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

AVAILABLE = all(importlib.util.find_spec(x) for x in ['numpy', 'matplotlib', 'PIL'])
if AVAILABLE:
    import numpy as np
    from PIL import Image
    spec = importlib.util.spec_from_file_location('renderer', Path(__file__).resolve().parents[1]/'scripts/render_benchmark_curves.py')
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)


@unittest.skipUnless(AVAILABLE, 'Use the existing benchmark CPU environment')
class RendererTest(unittest.TestCase):
    def fixture(self, root):
        row = {'case_id': 'dataset_01__primary', 'task': 'soh_estimation', 'model': 'cnn',
               'lane': 'processed', 'variant': 'baseline', 'protocol': 'cross_cell',
               'job_id': 'fixture', 'code_identity': 'fixture-code', 'test_n': '2', 'test_cells': '1'}
        folder=root/'runs/harness_v1/jobs/fixture';folder.mkdir(parents=True)
        np.savez(folder/'predictions.npz', prediction=[.9,.8,.7], y=[1.,.9,.8],
                 valid=[True,False,True], keys=['a','b','c'], cells=['cell']*3,
                 axis=[1.,2.,3.], split=['test']*3)
        receipt={'status':'completed','spec':{**row,'seed':0},'code_identity':row['code_identity'],
                 'outputs':{'predictions.npz':renderer.digest((folder/'predictions.npz').read_bytes())}}
        (folder/'result.json').write_text(json.dumps(receipt))
        return row,folder

    def test_source_tampering_and_wrong_run_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);row,folder=self.fixture(root)
            arrays,_=renderer.load_job(root,row)
            np.testing.assert_array_equal(arrays['position'],[0,2])
            with self.assertRaisesRegex(ValueError,'identity'):
                renderer.load_job(root,{**row,'task':'rul_prediction'})
            payload=(folder/'predictions.npz').read_bytes()
            (folder/'predictions.npz').write_bytes(payload+b'tamper')
            with self.assertRaisesRegex(ValueError,'hash mismatch'):
                renderer.load_job(root,row)

    def test_prediction_error_does_not_choose_cell_and_alignment_is_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);row,_=self.fixture(root)
            a,_=renderer.load_job(root,row)
            a['cells']=np.array(['cell-a','cell-b'])
            first=renderer.choose_cell(a,row['case_id'])
            changed={k:v.copy() for k,v in a.items()};changed['prediction'][:]=1e6
            self.assertEqual(first,renderer.choose_cell(changed,row['case_id']))
            for key in ['keys','axis','y','valid','position']:
                changed={k:v.copy() for k,v in a.items()}
                changed[key]=changed[key][::-1] if key!='valid' else ~changed[key]
                with self.assertRaisesRegex(ValueError,'alignment mismatch'):
                    renderer.aligned(a,changed)

    def test_gaps_and_outlying_predictions_are_retained_without_numeric_metadata(self):
        axis=np.array([1.,3.,4.]);position=np.array([0,2,3])
        x,y=renderer.segments(axis,np.array([1.1,.9,.8]),position)
        self.assertTrue(np.isnan(x[1]) and np.isnan(y[1]))
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'curve.png'
            bounds=renderer.plot_image(path,axis,np.array([1.1,.9,.8]),np.array([-2.,3.,.7]),None,position)
            self.assertLess(bounds['y_limits'][0],-2.)
            self.assertGreater(bounds['y_limits'][1],3.)
            with Image.open(path) as image:
                self.assertEqual(image.info,{})
                self.assertEqual(image.size,(1280,640))
            with self.assertRaisesRegex(ValueError,'reverses'):
                renderer.plot_image(path,axis[::-1],y[:3],y[:3],None,position)


if __name__ == '__main__':
    unittest.main()
