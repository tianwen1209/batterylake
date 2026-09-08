"""Browser checks for original-release statistics and CSV/fallback parity.

Run: python3 -m unittest discover -s tests -p test_home_metrics.py
Requires Playwright and its Chromium browser (already installed on the server).
"""
import functools
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = dict(datasets=40, labs=32, yearMin=2007, yearMax=2026, years=19,
                cycles=2038307, cells=2394)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class HomeMetricsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(reduced_motion='reduce')
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.route('https://**/*', lambda route: route.abort())
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/', wait_until='networkidle')

    def tearDown(self):
        self.page.close()

    def test_published_totals_and_successful_csv_sync(self):
        before = self.page.evaluate('computeHomeMetrics()')
        for field, value in EXPECTED.items():
            self.assertEqual(before[field], value, field)
        self.assertAlmostEqual(before['volumeGB'], 430.39329889, places=6)
        after = self.page.evaluate('async () => { await syncFromGitHub(true); return {metrics:computeHomeMetrics(), source:dataSource}; }')
        self.assertEqual(after['source'], 'github')
        self.assertEqual(after['metrics'], before)
        self.assertEqual(self.errors, [])

    def test_failed_csv_fetch_keeps_audited_fallback(self):
        self.page.route('**/dataset_registry.csv', lambda route: route.abort())
        result = self.page.evaluate('async () => { await syncFromGitHub(true); return computeHomeMetrics(); }')
        self.assertEqual(result['cells'], EXPECTED['cells'])
        self.assertEqual(self.page.evaluate('dataSource'), 'fallback')

    def test_local_subsets_cannot_replace_full_original_totals(self):
        result = self.page.evaluate('''() => {
          DATASETS = [{id:'subset', ref_name:'2026_Lab_LFP', cells:'9999', cycles:9999,
            size_mb:9999, stats_scope:'local_subset', cells_basis:'known',
            cycles_basis:'known', volume_basis:'known'}];
          return computeHomeMetrics();
        }''')
        self.assertEqual((result['cycles'], result['cells'], result['volumeGB']), (0, 0, 0))

    def test_shared_cells_hidden_internal_and_vehicle_units(self):
        result = self.page.evaluate('''() => {
          const row = (id,cells,size,group) => ({id,ref_name:'2026_Lab_LFP',cells,
            cycles:10,size_mb:size,stats_scope:'full_source',cells_basis:'known',
            cycles_basis:'known',volume_basis:'known',cells_group:group});
          DATASETS = [row('v1','228',1000,'same_cells'),row('v2','228',2000,'same_cells'),
            row('dataset_eee','16',500,''),row('vehicles','464 EVs',0,'')];
          return computeHomeMetrics();
        }''')
        self.assertEqual(result['datasets'], 3)
        self.assertEqual(result['cells'], 244)
        self.assertEqual(result['cycles'], 40)
        self.assertEqual(result['volumeGB'], 3.5)

    def test_mobile_metrics_without_note_and_no_overflow(self):
        self.page.set_viewport_size(dict(width=390, height=844))
        self.page.evaluate('animateHomeMetrics()')
        self.assertEqual(self.page.locator('#m-scope-note').count(), 0)
        self.assertEqual(self.page.get_by_text('Counting methodology and sources', exact=True).count(), 0)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertEqual(self.page.locator('#m-cells').inner_text(), '2,394')

if __name__ == '__main__':
    unittest.main()
