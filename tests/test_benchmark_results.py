"""Real exported metrics, protocol scoping, navigation and browser regression."""
import csv
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import statistics
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets/data/benchmark-results'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class PublishedResultsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = json.loads((DATA / 'snapshot.json').read_text())
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
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.route('https://**/*', lambda route: route.abort())

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def open_results(self):
        self.page.goto(self.url + '#benchmarks', wait_until='networkidle')
        self.page.wait_for_selector('#pbr-content', state='visible')

    def test_snapshot_hashes_and_processed_aggregates(self):
        for name, expected in self.snapshot['source_hashes'].items():
            if '/' not in name:
                self.assertEqual(hashlib.sha256((DATA / name).read_bytes()).hexdigest(), expected)
        with (DATA / 'current_harness_metrics.csv').open() as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual(len(rows), 8540)
        self.assertEqual(len({r['job_id'] for r in rows}), 8540)
        groups = {}
        for r in rows:
            if r['lane'] == 'processed':
                key = tuple(r[k] for k in ['case_id','task','variant','protocol','target_unit','model'])
                groups.setdefault(key, []).append(r)
        self.assertEqual(len(self.snapshot['conditions']), 168)
        for c in self.snapshot['conditions']:
            self.assertEqual(len(c['models']), 7)
            for m in c['models']:
                key = tuple(c[k] for k in ['case_id','task','variant','protocol','target_unit']) + (m['model'],)
                rs = groups.pop(key)
                self.assertEqual({int(r['seed']) for r in rs}, set(range(5)))
                self.assertAlmostEqual(m['rmse'], statistics.mean(float(r['cell_equal_rmse']) for r in rs), delta=max(1e-12, abs(m['rmse'])*1e-12))
        self.assertFalse(groups)

    def test_every_published_condition_is_reachable_and_correctly_ranked(self):
        self.open_results()
        errors = self.page.evaluate('''snapshot => {
          const select = (id, value) => {const e = document.getElementById('pbr-' + id); e.value=value; e.dispatchEvent(new Event('change'));};
          const errors = [];
          for (const c of snapshot.conditions) {
            const p = snapshot.cases.find(p => p.id === c.case_id);
            select('dataset', p.dataset_id); select('task', c.task);
            select('profile', c.case_id); select('variant', c.variant); select('protocol', c.protocol);
            const rows = [...document.querySelectorAll('#pbr-rows tr')];
            const rank = [...c.models].sort((a,b) => a.rank-b.rank || a.model.localeCompare(b.model));
            if(rows.length !== 7 || rows.some((r,i) => r.dataset.model !== rank[i].model)) errors.push(c);
          }
          return errors;
        }''', self.snapshot)
        self.assertEqual(errors, [])

    def test_raw_comparison_only_applies_to_frozen_baseline_cross_cell(self):
        self.open_results()
        self.page.select_option('#pbr-task', 'rul_prediction')
        self.assertIn('8.34313', self.page.locator('#pbr-rows tr').first.inner_text())
        self.assertIn('7/7', self.page.locator('#pbr-pair-badge').inner_text())
        self.page.locator('#pbr-pair-panel summary').click()
        self.assertEqual(self.page.locator('#pbr-pair-rows tr').count(), 7)
        self.page.select_option('#pbr-protocol', 'random')
        self.assertIn('Deliberate leakage control', self.page.locator('#pbr-protocol-note').inner_text())
        self.assertTrue(self.page.locator('#pbr-pair-table-area').is_hidden())
        self.assertIn('Not run', self.page.locator('#pbr-pair-badge').inner_text())

    def test_censored_empty_state_and_source_qualifications(self):
        self.open_results()
        self.page.select_option('#pbr-dataset', 'dataset_27')
        self.page.select_option('#pbr-task', 'rul_prediction')
        self.assertIn('Right-censored', self.page.locator('#pbr-empty').inner_text())
        self.assertTrue(self.page.locator('#pbr-table-area').is_hidden())
        self.page.select_option('#pbr-dataset', 'dataset_11')
        self.assertIn('temperature endpoints', self.page.locator('#pbr-scope').inner_text())
        self.page.select_option('#pbr-dataset', 'dataset_07')
        self.assertIn('BatteryLife processed copy', self.page.locator('#pbr-scope').inner_text())

    def test_failed_fetch_has_retry_and_download(self):
        self.page.route('**/benchmark-results/snapshot.json', lambda route: route.abort())
        self.page.goto(self.url + '#benchmarks', wait_until='networkidle')
        self.assertTrue(self.page.locator('#pbr-retry').is_visible())
        self.assertTrue(self.page.locator('#published-benchmarks a[download]').first.is_visible())
        self.page.unroute('**/benchmark-results/snapshot.json')
        self.page.locator('#pbr-retry').click()
        self.page.wait_for_selector('#pbr-content', state='visible')

    def test_sidebar_navigation_lazy_loads_and_wizard_still_works(self):
        requests = []
        self.page.on('request', lambda r: requests.append(r.url) if r.url.endswith('/snapshot.json') else None)
        self.page.goto(self.url, wait_until='networkidle')
        self.assertEqual(requests, [])
        self.page.locator('.sidebar-nav a[onclick*="benchmarks"]').click()
        self.page.wait_for_selector('#pbr-content', state='visible')
        self.assertEqual(len(requests), 1)
        self.page.locator('#bw-flow [data-bwr-task="SOH Estimation"]').click()
        self.page.locator('#bw-wizard-next').click()
        self.assertTrue(self.page.locator('#bw-flow [data-bwr-panel="2"]').is_visible())
        self.assertEqual(self.page.locator('#pbr-rows tr').count(), 7)

    def test_responsive_light_dark_and_downloads(self):
        self.open_results()
        for size in [dict(width=1440, height=1100), dict(width=390, height=844)]:
            self.page.set_viewport_size(size)
            for theme in ['light', 'dark']:
                self.page.evaluate('(theme) => document.documentElement.dataset.theme = theme', theme)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                self.page.locator('#published-benchmarks').screenshot(path=f'/tmp/batterylake-results-{size["width"]}-{theme}.png')
        for a in self.page.locator('#published-benchmarks a[download]').all():
            response = self.page.request.get(self.url + a.get_attribute('href'))
            self.assertEqual(response.status, 200)
            self.assertGreater(len(response.body()), 1000)

    def test_real_trajectory_replay_pause_scrub_and_export(self):
        self.open_results()
        self.page.wait_for_selector('#pbt-body', state='visible')
        self.assertEqual(self.page.locator('#pbt-model').input_value(), 'cnn')
        self.assertIn('SOH reference target', self.page.locator('#pbt-svg-title').text_content())
        self.assertEqual(self.page.locator('#pbt-play').inner_text(), 'Play')  # reduced-motion preference
        self.page.locator('#pbt-reset').click()
        self.assertEqual(self.page.locator('#pbt-position').input_value(), '0')
        self.page.locator('#pbt-play').click()
        self.page.wait_for_function('Number(document.getElementById("pbt-position").value) > 0')
        self.page.locator('#pbt-play').click()
        position = self.page.locator('#pbt-position').input_value()
        self.page.wait_for_timeout(150)
        self.assertEqual(self.page.locator('#pbt-position').input_value(), position)
        self.page.locator('#pbt-position').fill('1')
        self.assertTrue(self.page.locator('#pbt-counter').inner_text().startswith('2 /'))
        with self.page.expect_download() as event:
            self.page.locator('#pbt-download').click()
        download = event.value
        self.assertTrue(download.suggested_filename.endswith('-cnn-seed0.svg'))
        text = Path(download.path()).read_text()
        self.assertIn('Reference', text)
        self.assertIn('seed 0', text)
        self.assertIn('Life axis:', text)

    def test_curve_model_overlay_task_and_censoring(self):
        self.open_results()
        self.page.wait_for_selector('#pbt-body', state='visible')
        original = self.page.locator('#pbt-pred-path').get_attribute('d')
        self.page.select_option('#pbt-model', 'rf')
        self.assertNotEqual(self.page.locator('#pbt-pred-path').get_attribute('d'), original)
        self.page.locator('#pbt-raw').check()
        self.assertEqual(self.page.locator('#pbt-raw-path').get_attribute('d'), self.page.locator('#pbt-pred-path').get_attribute('d'))
        self.page.locator('[data-pbt-task="rul_prediction"]').click()
        self.page.wait_for_function('document.getElementById("pbt-svg-title")?.textContent.startsWith("RUL")')
        self.assertEqual(self.page.locator('#pbr-task').input_value(), 'rul_prediction')
        self.page.select_option('#pbr-dataset', 'dataset_27')
        self.page.wait_for_function('document.getElementById("pbt-state").textContent.includes("Censored")')
        self.assertTrue(self.page.locator('#pbt-body').is_hidden())

    def test_curve_download_failure_retry_and_selection_race(self):
        self.page.route('**/trajectories/*.json', lambda route: route.abort())
        self.open_results()
        self.page.wait_for_selector('#pbt-retry', state='visible')
        self.assertEqual(self.page.locator('#pbr-rows tr').count(), 7)
        self.page.unroute('**/trajectories/*.json')
        self.page.locator('#pbt-retry').click()
        self.page.wait_for_selector('#pbt-body', state='visible')
        self.page.evaluate('''() => {
          const e=document.getElementById('pbr-task');
          for(const t of ['rul_prediction','soh_estimation','rul_prediction']) {
            e.value=t; e.dispatchEvent(new Event('change'));
          }
        }''')
        self.page.wait_for_function('document.getElementById("pbt-svg-title")?.textContent.startsWith("RUL") && !document.getElementById("pbt-body").hidden')
        self.assertEqual(self.page.locator('[data-pbt-task="rul_prediction"]').get_attribute('aria-pressed'), 'true')

    def test_all_curve_payloads_match_snapshot_and_responsive_plot(self):
        index = json.loads((DATA / 'trajectories/index.json').read_text())
        self.assertEqual(len(index['conditions']), len(self.snapshot['conditions']))
        for entry in index['conditions']:
            content = (DATA / 'trajectories' / entry['file']).read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(), entry['sha256'])
            curve = json.loads(content)
            self.assertEqual(curve['seed'], 0)
            for cell in curve['cells']:
                self.assertLessEqual(cell['plotted_points'], 512)
                self.assertEqual(cell['plotted_points'], len(cell['truth']))
                self.assertEqual(set(cell['predictions']), set(self.snapshot['models']))
                self.assertEqual(cell['axis'], sorted(cell['axis']))
        self.open_results()
        self.page.wait_for_selector('#pbt-body', state='visible')
        for width in [1440, 390]:
            self.page.set_viewport_size({'width': width, 'height': 1000})
            for theme in ['light', 'dark']:
                self.page.evaluate('(theme) => document.documentElement.dataset.theme=theme', theme)
                self.page.wait_for_timeout(150)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                self.page.locator('#pbt-panel').screenshot(path=f'/tmp/batterylake-trajectory-{width}-{theme}.png')


if __name__ == '__main__':
    unittest.main()
