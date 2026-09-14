"""Real prediction images remain interactive without exposing numerical results."""
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import struct
import subprocess
import threading
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'assets/images/benchmark-curves'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class BenchmarkCurvesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, args=['--no-sandbox'])
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
        self.errors=[]; self.requests=[]
        self.page.on('pageerror', lambda e:self.errors.append(str(e)))
        self.page.on('request', lambda r:self.requests.append(r.url))
        self.page.route('https://**/*', lambda route:route.abort())
        self.page.goto(self.url+'#benchmarks', wait_until='networkidle')
        expect(self.page.locator('#pbr-real-chart')).to_be_visible()

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def ready(self, dataset, task, model='cnn'):
        expected=f'{dataset}-{task}-{model}.png'
        self.page.wait_for_function('(name)=>{const i=document.getElementById("pbr-curve-image"); return !document.getElementById("pbr-real-chart").hidden && i.src.includes(name) && i.complete && i.naturalWidth>0;}',arg=expected)

    def test_no_numerical_result_assets_or_annotations(self):
        section=self.page.locator('#published-benchmarks')
        self.assertNotIn('Illustrative',section.inner_text())
        self.assertNotIn('No experimental data',section.inner_text())
        self.assertNotIn('illustration',section.inner_text().lower())
        self.assertEqual(section.locator('table, a[download], svg, canvas').count(),0)
        self.assertEqual(section.locator('select').count(),3)
        self.assertEqual(section.locator('[title], [data-tooltip]').count(),0)
        self.assertFalse(any('/assets/data/benchmark-results/' in u for u in self.requests))
        self.assertFalse((ROOT/'assets/data/benchmark-results').exists())
        index=json.loads((ASSETS/'index.json').read_text())
        fields={'dataset_id','task','model','image','cell','profile','axis_label','protocol','raw_comparison'}
        self.assertEqual(set(index),{'models','entries'})
        self.assertEqual(len(index['entries']),252)
        for entry in index['entries']:
            self.assertEqual(set(entry),fields)
            self.assertTrue(all(isinstance(v,(str,bool)) for v in entry.values()))
            data=(ASSETS/entry['image']).read_bytes()
            self.assertEqual(data[:8],b'\x89PNG\r\n\x1a\n')
            offset=8
            while offset<len(data):
                length=struct.unpack('>I',data[offset:offset+4])[0]
                kind=data[offset+4:offset+8]
                self.assertIn(kind,[b'IHDR',b'IDAT',b'IEND'])
                offset+=12+length

    def test_old_data_urls_are_unavailable_and_ignored(self):
        for name in ['snapshot.json','model_rankings.csv','current_harness_metrics.csv',
                     'current_harness_equivalence.json','current_harness_rankings.json',
                     'FINAL_SUMMARY.json','trajectories/index.json']:
            self.assertEqual(self.page.request.get(self.url+'assets/data/benchmark-results/'+name).status,404)
        result=subprocess.run(['git','check-ignore','--no-index','assets/data/benchmark-results/snapshot.json'],cwd=ROOT,capture_output=True)
        self.assertEqual(result.returncode,0)

    def test_real_animation_and_training_wizard(self):
        button=self.page.locator('#pbr-preview-play')
        self.assertEqual(button.inner_text(),'Play prediction')
        button.click()
        self.assertEqual(button.get_attribute('aria-pressed'),'true')
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a=>a.effect.target.id==="pbr-curve-image" && a.playState==="running").length'),1)
        button.click()
        self.assertEqual(button.inner_text(),'Resume prediction')
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a=>a.effect.target.id==="pbr-curve-image" && a.playState==="paused").length'),1)
        self.page.locator('#pbr-task').select_option('rul_prediction')
        self.ready('dataset_01','rul_prediction')
        self.assertEqual(button.inner_text(),'Play prediction')
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a=>a.effect.target.id==="pbr-curve-image").length'),0)
        self.page.locator('#bw-flow [data-bwr-task="SOH Estimation"]').click()
        self.page.locator('#bw-wizard-next').click()
        self.assertTrue(self.page.locator('#bw-flow [data-bwr-panel="2"]').is_visible())

    def test_all_dataset_task_choices_and_censored_results(self):
        datasets=self.page.locator('#pbr-dataset option').evaluate_all('(options)=>options.map(o=>o.value)')
        expected=[f'dataset_{i:02d}' for i in [1,3,4,5,6,7,8,9,11,17,18,19,21,23,27,36,37,38,41]]
        self.assertEqual(datasets,expected)
        for dataset in datasets:
            self.page.locator('#pbr-dataset').select_option(dataset)
            for task in ['soh_estimation','rul_prediction']:
                self.page.locator('#pbr-task').select_option(task)
                unavailable=task=='rul_prediction' and dataset in ['dataset_27','dataset_37']
                if not unavailable:
                    self.ready(dataset,task)
                self.assertEqual(self.page.locator('#pbr-status').get_attribute('data-state'),'unavailable' if unavailable else 'completed')
                self.assertEqual(self.page.locator('#pbr-unavailable').is_visible(),unavailable)
                self.assertEqual(self.page.locator('#pbr-models').is_visible(),not unavailable)
                self.assertEqual(self.page.locator('#pbr-preview-play').is_disabled(),unavailable)
                self.assertEqual(self.page.locator('#pbr-real-chart').is_visible(),not unavailable)
                self.assertEqual(self.page.locator('#pbr-task').input_value(),task)
                if unavailable:
                    self.assertIn('right-censored',self.page.locator('#pbr-task-note').inner_text())

    def test_models_change_real_images_and_scopes_remain_distinct(self):
        hashes=[]
        for model in ['linear','rf','xgboost','lstm','transformer','cnn','pinn']:
            self.page.locator('#pbr-model').select_option(model)
            self.ready('dataset_01','soh_estimation',model)
            hashes.append(hashlib.sha256((ASSETS/f'dataset_01-soh_estimation-{model}.png').read_bytes()).hexdigest())
        self.assertEqual(len(set(hashes)),7)
        self.page.locator('#pbr-model').select_option('cnn')
        for dataset in ['dataset_06','dataset_07','dataset_08']:
            self.page.locator('#pbr-dataset').select_option(dataset)
            self.ready(dataset,'soh_estimation')
            self.assertIn('BatteryLife processed copy',self.page.locator('#pbr-source').inner_text())
            self.assertEqual(self.page.locator('#pbr-raw-label').inner_text(),'Source-copy prediction')
        self.page.locator('#pbr-dataset').select_option('dataset_11')
        self.assertIn('Temperature endpoint features only',self.page.locator('#pbr-scope-note').inner_text())
        self.page.locator('#pbr-dataset').select_option('dataset_19')
        self.assertIn('Group 5',self.page.locator('#pbr-scope-note').inner_text())
        self.page.locator('#pbr-dataset').select_option('dataset_09')
        self.page.locator('#pbr-task').select_option('rul_prediction')
        self.ready('dataset_09','rul_prediction')
        self.assertEqual(self.page.locator('#pbr-curve-context').inner_text(),'Within-cell temporal test')
        self.assertFalse(self.page.locator('#pbr-raw-legend').is_visible())
        self.page.locator('#pbr-dataset').select_option('dataset_23')
        self.ready('dataset_23','rul_prediction')
        self.assertIn('Elapsed-time profile',self.page.locator('#pbr-chart-subtitle').inner_text())
        self.assertTrue(self.page.locator('#pbr-raw-legend').is_visible())
        for dataset in ['dataset_03','dataset_41']:
            self.page.locator('#pbr-dataset').select_option(dataset)
            self.ready(dataset,'rul_prediction')
            self.assertIn('Author-endpoint profile',self.page.locator('#pbr-chart-subtitle').inner_text())

    def test_image_failure_and_late_response_do_not_show_wrong_result(self):
        pending=[]
        pattern='**/dataset_03-soh_estimation-cnn.png*'
        self.page.route(pattern,lambda route:pending.append(route))
        self.page.locator('#pbr-dataset').select_option('dataset_03')
        self.page.wait_for_timeout(100)
        self.assertFalse(self.page.locator('#pbr-real-chart').is_visible())
        self.page.locator('#pbr-dataset').select_option('dataset_04')
        self.ready('dataset_04','soh_estimation')
        self.assertEqual(len(pending),1)
        pending[0].fulfill(content_type='image/png',body=(ASSETS/'dataset_03-soh_estimation-cnn.png').read_bytes())
        self.page.wait_for_timeout(100)
        self.ready('dataset_04','soh_estimation')
        self.page.route('**/dataset_05-soh_estimation-cnn.png*',lambda route:route.abort())
        self.page.locator('#pbr-dataset').select_option('dataset_05')
        expect(self.page.locator('#pbr-chart-message')).to_contain_text('could not be loaded')
        self.assertFalse(self.page.locator('#pbr-real-chart').is_visible())
        self.assertTrue(self.page.locator('#pbr-preview-play').is_disabled())

    def test_responsive_light_and_dark(self):
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':1000})
            for theme in ['light','dark']:
                self.page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                self.page.locator('#published-benchmarks').screenshot(path=f'/tmp/batterylake-real-curves-{width}-{theme}.png')


if __name__ == '__main__':
    unittest.main()
