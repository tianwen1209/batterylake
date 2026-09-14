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


if __name__ == '__main__':
    unittest.main()
