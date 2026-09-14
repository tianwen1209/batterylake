"""Publication hold: no real result requests or accessible numerical assets."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class WithheldResultsTest(unittest.TestCase):
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

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def test_no_experimental_values_requests_or_downloads(self):
        section=self.page.locator('#published-benchmarks')
        self.assertIn('will be released with the paper',section.inner_text())
        self.assertIn('No experimental data',section.inner_text())
        self.assertEqual(section.locator('table, a[download]').count(),0)
        self.assertEqual(section.locator('select').count(),2)
        self.assertFalse(any('/assets/data/benchmark-results/' in u for u in self.requests))
        self.assertEqual(section.locator('svg').count(),2)
        self.assertFalse((ROOT/'assets/data/benchmark-results').exists())

    def test_old_data_urls_are_unavailable_and_ignored(self):
        for name in ['snapshot.json','model_rankings.csv','current_harness_metrics.csv',
                     'current_harness_equivalence.json','current_harness_rankings.json',
                     'FINAL_SUMMARY.json','trajectories/index.json','trajectories/0002d882e208f015767ca5fe.json']:
            self.assertEqual(self.page.request.get(self.url+'assets/data/benchmark-results/'+name).status,404)
        result=subprocess.run(['git','check-ignore','--no-index','assets/data/benchmark-results/snapshot.json'],cwd=ROOT,capture_output=True)
        self.assertEqual(result.returncode,0)
        self.assertFalse((ROOT/'scripts/export_benchmark_results.py').exists())
        self.assertFalse((ROOT/'scripts/export_benchmark_trajectories.py').exists())

    def test_concept_animation_and_training_wizard(self):
        button=self.page.locator('#pbr-preview-play')
        self.assertEqual(button.inner_text(),'Play illustration')
        button.click()
        self.assertEqual(button.get_attribute('aria-pressed'),'true')
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a => a.effect.target.classList.contains("pbr-preview-line") && a.playState === "running").length'),2)
        button.click()
        self.assertEqual(button.inner_text(),'Resume illustration')
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a => a.effect.target.classList.contains("pbr-preview-line") && a.playState === "paused").length'),2)
        self.page.locator('#pbr-task').select_option('rul_prediction')
        self.assertEqual(button.inner_text(),'Play illustration')
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a => a.effect.target.classList.contains("pbr-preview-line")).length'),0)
        self.assertTrue(self.page.locator('[data-pbr-task="rul_prediction"]').is_visible())
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
                self.assertEqual(self.page.locator('#pbr-status').get_attribute('data-state'),'unavailable' if unavailable else 'completed')
                self.assertEqual(self.page.locator('#pbr-unavailable').is_visible(),unavailable)
                self.assertEqual(self.page.locator('#pbr-models').is_visible(),not unavailable)
                self.assertEqual(self.page.locator('#pbr-preview-play').is_disabled(),unavailable)
                self.assertEqual(self.page.locator(f'[data-pbr-task="{task}"]').is_visible(),not unavailable)
                self.assertEqual(self.page.locator('#pbr-task').input_value(),task)
                if unavailable:
                    self.assertIn('right-censored',self.page.locator('#pbr-task-note').inner_text())
                else:
                    self.assertIn('Results withheld',self.page.locator('#pbr-status').inner_text())
        self.assertFalse(any('/assets/data/benchmark-results/' in u for u in self.requests))

    def test_scope_distinctions_without_fake_dataset_curves(self):
        soh_path=self.page.locator('[data-pbr-task="soh_estimation"] .pbr-preview-prediction').get_attribute('d')
        for dataset in ['dataset_06','dataset_07','dataset_08']:
            self.page.locator('#pbr-dataset').select_option(dataset)
            self.assertIn('BatteryLife processed copy',self.page.locator('#pbr-source').inner_text())
            self.assertIn('unavailable BatteryArchive original CSV',self.page.locator('#pbr-scope-note').inner_text())
        self.page.locator('#pbr-dataset').select_option('dataset_11')
        self.assertIn('Temperature endpoint features only',self.page.locator('#pbr-scope-note').inner_text())
        self.page.locator('#pbr-dataset').select_option('dataset_19')
        self.assertIn('Group 5',self.page.locator('#pbr-scope-note').inner_text())
        self.assertEqual(self.page.locator('[data-pbr-task="soh_estimation"] .pbr-preview-prediction').get_attribute('d'),soh_path)
        self.assertIn('not a dataset-specific result curve',self.page.locator('#pbr-illustration-note').inner_text())
        self.page.locator('#pbr-task').select_option('rul_prediction')
        self.page.locator('#pbr-dataset').select_option('dataset_23')
        self.assertIn('remaining elapsed days',self.page.locator('#pbr-task-note').inner_text())
        self.assertIn('completed discharge operations',self.page.locator('#pbr-task-note').inner_text())
        for dataset in ['dataset_03','dataset_41']:
            self.page.locator('#pbr-dataset').select_option(dataset)
            self.assertIn('author',self.page.locator('#pbr-task-note').inner_text().lower())

    def test_responsive_light_and_dark_preview(self):
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':1000})
            for theme in ['light','dark']:
                self.page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                self.page.locator('#published-benchmarks').screenshot(path=f'/tmp/batterylake-scope-{width}-{theme}.png')


if __name__ == '__main__':
    unittest.main()
