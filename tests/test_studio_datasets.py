"""The Studio's Data Preparation list shows the Datasets page's cycle-aging datasets: the same rows, cards, filters, search and sort."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
NO_MOTION = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}'
# Dataset ids of the cards on a page: the Datasets page puts them in onclick, the Studio in data-dataset-id.
CARD_IDS = r"""els => els.map(e => { const m = (e.getAttribute('onclick') || '').match(/openDatasetModal\('([^']+)'\)/); return m ? m[1] : e.dataset.datasetId; })"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class StudioDatasetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, args=['--no-sandbox'])
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/index.html'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def open(self, hash_, ready):
        page = self.browser.new_page(viewport={'width': 1400, 'height': 1000})
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        for pattern in ('**/googletagmanager.com/**', '**/fonts.googleapis.com/**', '**/fonts.gstatic.com/**'):
            page.route(pattern, lambda route: route.abort())
        page.goto(self.url + hash_, wait_until='load')
        page.add_style_tag(content=NO_MOTION)
        page.wait_for_selector(ready, timeout=20000)
        page.wait_for_timeout(200)
        self.pages.append(page)
        return page

    def setUp(self):
        self.pages = []
        self.errors = []
        self.datasets = self.open('#datasets', '#dataset-grid .dataset-section')
        self.studio = self.open('#studio', '#studio-dataset-list > *')

    def tearDown(self):
        for page in self.pages:
            page.close()
        self.assertEqual(self.errors, [])

    @staticmethod
    def studio_ids(page):
        """Dataset ids over every page of the Studio list, in order."""
        ids = []
        while True:
            ids += page.eval_on_selector_all('#studio-dataset-list .dataset-card', CARD_IDS)
            nxt = page.query_selector('#studio-pager button[aria-label="Next dataset page"]')
            if not nxt or nxt.is_disabled():
                return ids
            nxt.click()
            page.wait_for_timeout(20)

    def datasets_ids(self):
        return self.datasets.eval_on_selector_all('#dataset-grid .dataset-card', CARD_IDS)

    def datasets_apply(self, chips):
        """Datasets page: Cycle Aging plus the given chips (fk, fv)."""
        self.datasets.click('#page-datasets .dataset-filter-toggle')
        self.datasets.click('#dataset-filter-popover .dataset-filter-action:not(.apply)')
        self.datasets.click('#page-datasets .dataset-filter-toggle')
        for fk, fv in [('cat', 'cycle_aging')] + chips:
            self.datasets.click(f'#dataset-filter-grid .filter-tag[data-fk="{fk}"][data-fv="{fv}"]')
        self.datasets.click('#dataset-filter-popover .dataset-filter-action.apply')

    def studio_apply(self, chips):
        self.studio.click('#studio-filter-toggle')
        self.studio.click('#studio-filter-clear')
        self.studio.click('#studio-filter-toggle')
        for fk, fv in chips:
            self.studio.click(f'#studio-filter-grid .filter-tag[data-fk="{fk}"][data-fv="{fv}"]')
        self.studio.click('#studio-filter-apply')

    def first_values(self):
        values = {}
        for fk, fv in self.studio.eval_on_selector_all('#studio-filter-grid .filter-tag[data-fk]', 'els => els.map(e => [e.dataset.fk, e.dataset.fv])'):
            values.setdefault(fk, fv)
        return values

    def test_default_list_is_the_datasets_page_cycle_aging_section(self):
        self.assertEqual(self.studio_ids(self.studio), self.datasets_ids())
        self.assertEqual(self.studio.inner_text('#studio-filter-count').strip(), '23 datasets found')

    def test_filters_search_and_sort_give_the_same_datasets(self):
        values = self.first_values()
        combos = [
            [('domain', values['domain'])],
            [('cathode', values['cathode'])],
            [('charge', values['charge'])],
            [('domain', values['domain']), ('cathode', values['cathode'])],
        ]
        for chips in combos:
            with self.subTest(chips=chips):
                self.datasets_apply(chips)
                want = self.datasets_ids()
                self.studio_apply(chips)
                self.assertEqual(self.studio_ids(self.studio), want)

        self.studio_apply([])
        self.datasets_apply([])
        self.datasets.fill('#searchInput', 'NMC')
        want = self.datasets_ids()
        self.studio.fill('#studio-search', 'NMC')
        self.assertEqual(self.studio_ids(self.studio), want)

        self.datasets.fill('#searchInput', '')
        self.datasets.dispatch_event('#searchInput', 'input')
        self.studio.fill('#studio-search', '')
        self.studio.dispatch_event('#studio-search', 'input')
        for sort in ['newest', 'az', 'most-cycles']:
            with self.subTest(sort=sort):
                self.datasets.select_option('#sort-select', sort)
                want = self.datasets_ids()
                self.studio.select_option('#studio-sort', sort)
                self.assertEqual(self.studio_ids(self.studio), want)

    def test_card_click_selects_the_dataset_without_opening_the_popup(self):
        dataset_id = self.studio.query_selector('#studio-dataset-list .dataset-card').get_attribute('data-dataset-id')
        self.studio.click(f'#studio-dataset-list .dataset-card[data-dataset-id="{dataset_id}"]')
        # a click re-renders the list, so the card is looked up again
        card = self.studio.query_selector(f'#studio-dataset-list .dataset-card[data-dataset-id="{dataset_id}"]')
        self.assertEqual(card.get_attribute('aria-pressed'), 'true')
        self.assertIn('studio-selected', card.get_attribute('class'))
        self.assertFalse(self.studio.query_selector('#modal.show'))
        self.studio.click('#studio-confirm')
        self.assertEqual(self.studio.inner_text('#studio-confirm').strip(), 'Dataset in use')
        self.assertEqual(self.studio.query_selector('#studio-dataset-list .dataset-card.studio-selected').get_attribute('data-dataset-id'), dataset_id)

    def test_chip_removal_and_reset_restore_the_full_list(self):
        full = self.studio_ids(self.studio)
        self.studio_apply([('cathode', self.first_values()['cathode'])])
        self.assertLess(len(self.studio_ids(self.studio)), len(full))
        self.studio.click('#studio-applied-filter-chips .applied-chip button')
        self.assertEqual(self.studio_ids(self.studio), full)
        self.studio_apply([('cathode', self.first_values()['cathode'])])
        self.studio.click('#studio-reset')
        self.assertEqual(self.studio_ids(self.studio), full)


if __name__ == '__main__':
    unittest.main()
