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
        self.assertEqual(section.locator('table, a[download], select').count(),0)
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
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a => a.effect.target.classList.contains("pbr-preview-line") && a.playState === "running").length'),4)
        button.click()
        self.assertEqual(button.inner_text(),'Resume illustration')
        self.assertEqual(self.page.evaluate('document.getAnimations().filter(a => a.effect.target.classList.contains("pbr-preview-line") && a.playState === "paused").length'),4)
        self.page.locator('#bw-flow [data-bwr-task="SOH Estimation"]').click()
        self.page.locator('#bw-wizard-next').click()
        self.assertTrue(self.page.locator('#bw-flow [data-bwr-panel="2"]').is_visible())

    def test_responsive_light_and_dark_preview(self):
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':1000})
            for theme in ['light','dark']:
                self.page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                self.page.locator('#published-benchmarks').screenshot(path=f'/tmp/batterylake-withheld-{width}-{theme}.png')


if __name__ == '__main__':
    unittest.main()
