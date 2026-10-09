"""The Datasets page reads its catalogue from metadata/ (js/dataset-metadata.js) and renders it in js/datasets-page.js."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
META = ROOT/'metadata'
FG = '#dataset-filter-grid .filter-tag[data-fk="%s"][data-fv="%s"]'
OPEN = '#page-datasets .dataset-filter-toggle'
APPLY = '#dataset-filter-popover .dataset-filter-action.apply'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class DatasetsPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, args=['--no-sandbox'])
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.index = json.loads((META/'index.json').read_text())['datasets']

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1400, 'height': 1000})
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        for pattern in ('**/googletagmanager.com/**', '**/fonts.googleapis.com/**', '**/fonts.gstatic.com/**'):
            self.page.route(pattern, lambda route: route.abort())
        self.page.goto(self.url + 'index.html#datasets')
        self.page.wait_for_function("document.querySelectorAll('#dataset-grid .dataset-section').length > 0")

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def count(self):
        return int(self.page.inner_text('#filter-count').split()[0])

    def apply(self, *chips):
        self.page.click(OPEN)
        for key, value in chips:
            self.page.click(FG % (key, value))
        self.page.click(APPLY)

    def expected(self, test):
        """Dataset ids selected by a predicate over the per-dataset records."""
        out = set()
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            if test(rec['cell'], rec['conditions']):
                out.add(row['dataset_id'])
        return out

    def shown_ids(self):
        return set(self.page.evaluate("getFiltered().map(d => d.dataset_id)"))

    # ── loader ──
    def test_catalogue_has_one_row_per_indexed_dataset_in_index_order(self):
        ids = self.page.evaluate("BatteryLakeDatasetMetadata.loadCatalog().then(rows => rows.map(r => r.dataset_id))")
        self.assertEqual(ids, [r['dataset_id'] for r in self.index])
        self.assertEqual(self.count(), len(self.index))

    def test_rows_come_from_the_index_files_and_load_no_records(self):
        requested = []
        page = self.browser.new_page()
        page.on('request', lambda r: requested.append(r.url))
        for pattern in ('**/googletagmanager.com/**', '**/fonts.googleapis.com/**', '**/fonts.gstatic.com/**'):
            page.route(pattern, lambda route: route.abort())
        page.goto(self.url + 'index.html#datasets')
        page.wait_for_function("document.querySelectorAll('#dataset-grid .dataset-section').length > 0")
        page.close()
        self.assertTrue(any(u.endswith('metadata/index.json') for u in requested))
        # the per-dataset records are preloaded once each with the catalogue, never once per popup
        records = [u for u in requested if '/metadata/datasets/' in u or '/metadata/research/' in u]
        self.assertEqual(len(records), len(set(records)))
        rows = {r['dataset_id']: r for r in self.page.evaluate("BatteryLakeDatasetMetadata.loadCatalog()")}
        research = {r['dataset_id']: r for r in json.loads((META/'index_research.json').read_text())['datasets']}
        for row in self.index:
            got = rows[row['dataset_id']]
            for key in ('ref_name', 'electrode_combinations', 'rate_combinations', 'profile_combinations', 'dynamic_subprofiles',
                        'charge_profiles', 'discharge_profiles', 'n_entities', 'n_cycles_total', 'entity_type', 'application_domain'):
                self.assertEqual(got[key], row[key], (row['dataset_id'], key))
            # the loader only adds a label to each single-side entry
            self.assertEqual([{k: v for k, v in x.items() if k != 'label'} for x in got['single_side_profiles']], row['single_side_profiles'])
            self.assertEqual([x['label'] for x in got['single_side_profiles']], [self.label(x) for x in row['single_side_profiles']])
            self.assertEqual(got['category'], research[row['dataset_id']]['category'])

    def test_opening_a_popup_requests_no_metadata(self):
        self.page.wait_for_function("getFiltered().length > 0 && getFiltered().every(d => d.detailReady)")
        requested = []
        self.page.on('request', lambda r: requested.append(r.url))
        self.page.evaluate("openDatasetModal('dataset_08')")
        self.page.wait_for_function("document.getElementById('modal-details').textContent.includes('Has temperature time-series')")
        self.page.evaluate("closeModal()")
        self.assertEqual([u for u in requested if '/metadata/' in u], [])

    def test_index_entries_match_their_records(self):
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            for key in ('electrode_combinations',):
                self.assertEqual(row[key], rec['cell'][key], (row['dataset_id'], key))
            for key in ('profile_combinations', 'single_side_profiles', 'dynamic_subprofiles', 'rate_combinations'):
                self.assertEqual(row[key], rec['conditions'][key], (row['dataset_id'], key))
            self.assertEqual(row['charge_profiles'], sorted(self.profiles(rec['conditions'], 'charge')))
            self.assertEqual(row['discharge_profiles'], sorted(self.profiles(rec['conditions'], 'discharge')))

    def test_popup_reads_count_basis_from_the_record(self):
        rid = self.index[0]['dataset_id']
        rec = json.loads((META/'datasets'/f'{rid}.json').read_text())
        self.page.evaluate(f"openDatasetModal('{rid}')")
        self.page.wait_for_function("document.querySelector('#modal-body, #modal')?.innerText.includes('Count basis')")
        self.assertIn(rec['content']['count_basis'][:30], self.page.inner_text('#modal'))

    # ── filters ──
    def test_records_do_not_store_what_the_loader_derives(self):
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            k = rec['conditions']
            for gone in ('charge_profiles', 'discharge_profiles', 'rate_groups'):
                self.assertNotIn(gone, k, row['dataset_id'])
            for gone in ('cathode_chemistry', 'anode_chemistry', 'form_factor', 'cell_format_code'):
                self.assertNotIn(gone, rec['cell'], row['dataset_id'])
            self.assertTrue(all(set(x) == {'side', 'profile'} for x in k['single_side_profiles']), row['dataset_id'])
            pairs = {(p['charge'], p['discharge']) for p in k['profile_combinations']}
            for r in k['rate_combinations']:   # every rate row names a pair, or one single-side profile with the other side null
                cp, dp = r['charge_profile'], r['discharge_profile']
                if cp and dp:
                    self.assertIn((cp, dp), pairs, (row['dataset_id'], r))
                else:
                    self.assertIn(('charge', cp) if cp else ('discharge', dp), {(x['side'], x['profile']) for x in k['single_side_profiles']}, (row['dataset_id'], r))

    def test_form_factor_selects_its_codes_and_matches_the_factor(self):
        self.apply(('form', 'factor:cylindrical'))
        chips = self.page.inner_text('#applied-filter-chips').replace('×', '').split()
        self.assertIn('Cylindrical', chips)
        self.assertTrue({'18650', '21700'} <= set(chips))
        self.assertEqual(self.shown_ids(), self.expected(lambda c, k: 'cylindrical' in c['form_factors']))

    def test_deselecting_codes_narrows_a_selected_factor(self):
        self.apply(('form', 'factor:cylindrical'), ('form', 'code:18650'))
        parent = {'18650': 'cylindrical', '21700': 'cylindrical', '26650': 'cylindrical'}
        def keep(c, k):
            if 'cylindrical' not in c['form_factors']:
                return False
            own = [x for x in c['cell_format_codes'] if parent.get(x) == 'cylindrical']
            return not own or any(x != '18650' for x in own)
        self.assertEqual(self.shown_ids(), self.expected(keep))

    def test_codes_without_the_factor_match_on_the_code_and_show_a_dashed_factor(self):
        self.apply(('form', 'code:21700'))
        self.assertEqual(self.shown_ids(), self.expected(lambda c, k: '21700' in c['cell_format_codes']))
        self.page.click(OPEN)
        self.assertTrue(self.page.evaluate(
            "document.querySelector('.filter-form-box[data-factor=cylindrical] > .filter-tag').classList.contains('partial')"))

    def test_removing_the_factor_chip_keeps_its_code_chips(self):
        self.apply(('form', 'factor:pouch'))
        self.page.click('#applied-filter-chips .applied-chip button >> nth=0')
        remaining = self.page.inner_text('#applied-filter-chips')
        self.assertNotIn('Pouch', remaining.replace('502030', '').replace('302030', ''))
        self.assertIn('502030', remaining)

    def test_chemistry_matches_cathode_or_anode(self):
        self.apply(('cathode', 'LFP'), ('anode', 'graphite'))
        self.assertEqual(self.shown_ids(), self.expected(
            lambda c, k: 'LFP' in c['cathode_chemistries'] or 'graphite' in c['anode_chemistries']))

    def test_profile_matches_charging_or_discharging(self):
        self.apply(('charge', 'CC-CV'), ('discharge', 'dynamic'))
        self.assertEqual(self.shown_ids(), self.expected(
            lambda c, k: 'CC-CV' in self.profiles(k, 'charge') or 'dynamic' in self.profiles(k, 'discharge')))

    # ── cards and sorting ──
    def test_sort_menu_says_most_entities_and_orders_by_entities(self):
        self.page.fill('#searchInput', 'a'); self.page.dispatch_event('#searchInput', 'input')
        self.page.select_option('#sort-select', 'most-entities')
        counts = self.page.evaluate("getFiltered().map(d => d.n_entities || 0)")
        self.assertEqual(counts, sorted(counts, reverse=True))
        self.assertIn('Most entities', self.page.inner_text('#sort-select'))

    def test_card_chips_follow_the_fixed_order(self):
        self.page.fill('#searchInput', 'nasa'); self.page.dispatch_event('#searchInput', 'input')
        kinds = self.page.evaluate(
            "[...document.querySelectorAll('.dataset-card')][0].querySelectorAll('.dc-tags .dc-tag')"
            ".length && [...document.querySelector('.dataset-card').querySelectorAll('.dc-tags .dc-tag')]"
            ".map(t => [...t.classList].find(c => c.startsWith('filter-type-')))")
        self.assertEqual(kinds[:3], ['filter-type-category', 'filter-type-domain', 'filter-type-form'])

    # ── popup ──
    def test_popup_shows_metadata_notes_and_registry_checklist_and_locks_the_page(self):
        self.page.evaluate("openDatasetModal('dataset_01')")
        rec = json.loads((META/'datasets'/'dataset_01.json').read_text())
        self.assertEqual(self.page.inner_text('#modal-notes'), rec['identity']['notes'])
        self.assertEqual(self.page.locator('#modal-checklist .check-item').count(), 4)
        self.assertTrue(self.page.evaluate("document.documentElement.classList.contains('modal-open')"))
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate("document.documentElement.classList.contains('modal-open')"))

    @staticmethod
    def label(x):
        """The label of a single-side entry: its profile plus Charging or Discharging."""
        return f"{x['profile']} {'Charging' if x['side'] == 'charge' else 'Discharging'}"

    @staticmethod
    def profiles(k, side):
        """A record's charge or discharge profile types: those of its pairs plus its single-side entries."""
        return {p[side] for p in k['profile_combinations'] if p[side]} | {x['profile'] for x in k['single_side_profiles'] if x['side'] == side}

    @staticmethod
    def shown_label(label):
        """The page's title-casing of a profile label ("multi-stage CC Charging" -> "MCC Charging")."""
        label = label.replace('multi-stage CC-CV', 'MCC-CV').replace('multi-stage CC', 'MCC')
        return ' '.join(w if any(ch.isupper() for ch in w) else w[:1].upper() + w[1:] for w in label.split(' '))

    def test_popup_lists_single_side_profiles_as_charging_or_discharging_chips(self):
        checked = 0
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            singles = rec['conditions']['single_side_profiles']
            if not singles:
                continue
            self.page.evaluate(f"openDatasetModal('{row['dataset_id']}')")
            chips = self.page.eval_on_selector_all('#modal-details .md-profile-items > *', 'els => els.map(e => (e.querySelector("summary") || e).textContent.trim())')
            for x in singles:
                self.assertIn(self.shown_label(self.label(x)), chips, row['dataset_id'])
            self.assertEqual(len(chips), len(rec['conditions']['profile_combinations']) + len(singles), row['dataset_id'])
            self.assertFalse([c for c in chips if 'Unknown' in c], (row['dataset_id'], chips))
            checked += 1
        self.assertGreaterEqual(checked, 3)   # 12, 35, 40; 17, 20, 21, 29 and 37 became real pairs once both directions were checked in the raw files

    def test_single_side_cc_chips_list_their_rates_or_say_there_are_none(self):
        # no single-side CC profile currently has a rate row, so only the "No C-rate data" path has data
        for ds, label, expected in [('dataset_12', 'CC Charging', 'No C-rate data'), ('dataset_35', 'CC Charging', 'No C-rate data')]:
            self.page.evaluate(f"openDatasetModal('{ds}')")
            body = self.page.eval_on_selector(
                f'#modal-details details.md-chipdd:has(summary:text-is("{label}")) .md-chipdd-body > .md-rates:not(.md-dynamic)', 'e => e.textContent.trim()')    # the dynamic sub-profile list is tested separately
            self.assertEqual(body, expected, ds)
        self.page.evaluate("openDatasetModal('dataset_40')")   # pulse discharging is not CC: plain chip (dataset 40 has no electrical data in the raw files; the pulse is documented only)
        self.assertEqual(self.page.locator('#modal-details details:has(summary:text-is("Pulse Discharging"))').count(), 0)
        self.assertGreaterEqual(self.page.locator('#modal-details .md-profile-items > *', has_text='Pulse Discharging').count(), 1)

    def test_one_sided_cc_chips_take_their_rates_from_rate_combinations(self):
        def chip_body(ds, label):
            self.page.evaluate(f"openDatasetModal('{ds}')")
            return self.page.eval_on_selector(
                f'#modal-details details.md-chipdd:has(summary:text-is("{label}")) .md-chipdd-body > .md-rates:not(.md-dynamic)', 'e => e.textContent.trim()')   # the dynamic sub-profile list has its own test
        def lines(ds, label):
            self.page.evaluate(f"openDatasetModal('{ds}')")
            return self.page.eval_on_selector_all(
                f'#modal-details details.md-chipdd:has(summary:text-is("{label}")) .md-chipdd-body > .md-rates:not(.md-dynamic) .md-rate-line', 'els => els.map(e => e.textContent.trim())')
        # a dynamic side shows its sub-profile instead of "Dynamic" and never shows rates of its own
        self.assertEqual(lines('dataset_25', 'CC-CV → Dynamic'), ['0.25, 0.5, 1, 3C → UDDS (drive cycle)'])   # the paper calls the charge CC-CV
        self.assertEqual(lines('dataset_28', 'CC-CV → Dynamic'), ['1C → HPPC + WLTP (drive cycle)', '1C → Shifted WLTP (drive cycle)', '1C → WLTP (drive cycle)'])
        self.assertEqual(lines('dataset_01', 'CC-CV → Dynamic'), ['0.75C → Square wave'])
        self.assertEqual(chip_body('dataset_27', 'CC-CV → Pulse'), '0.3C → Pulse (0.5C)')   # pulse currents are shown
        self.assertEqual(lines('dataset_11', 'CC-CV → Dynamic'), ['C/3 → WLTP Class 3b (drive cycle)', '5C/3 → WLTP Class 3b Extra High (drive cycle)'])

    def test_unknown_profile_filter_also_matches_single_side_profiles(self):
        def ids_for(side, other_side):
            def test(c, k):
                singles = [x for x in k['single_side_profiles'] if x['side'] == other_side]
                return not self.profiles(k, side) or bool(singles)
            return self.expected(test)
        self.apply(('discharge', 'Unknown'))      # a charge-only profile leaves discharging unknown
        self.assertEqual(self.shown_ids(), ids_for('discharge', 'charge'))
        self.assertIn('dataset_12', self.shown_ids())
        self.page.click(OPEN); self.page.click(FG % ('discharge', 'Unknown')); self.page.click(FG % ('charge', 'Unknown')); self.page.click(APPLY)
        self.assertEqual(self.shown_ids(), ids_for('charge', 'discharge'))
        self.assertIn('dataset_40', self.shown_ids())   # pulse discharging only

    @staticmethod
    def dyn_subs(k, side):
        """Sub-profiles of the dynamic profile on one side: named by that side's rate rows, else all of them where the side is dynamic."""
        named = {r[side + '_subprofile'] for r in k['rate_combinations'] if r.get(side + '_subprofile')}
        if named:
            return named
        dynamic = any(p[side] == 'dynamic' for p in k['profile_combinations']) or any(
            x['side'] == side and x['profile'] == 'dynamic' for x in k['single_side_profiles'])
        return {s['name'] for s in k['dynamic_subprofiles']} if dynamic else set()

    def has_dynamic(self, k, side):
        return any(p[side] == 'dynamic' for p in k['profile_combinations']) or any(
            x['side'] == side and x['profile'] == 'dynamic' for x in k['single_side_profiles'])

    def test_dynamic_profile_is_a_pill_with_its_sub_profiles_like_a_form_factor(self):
        self.page.click(OPEN)
        subs = self.page.eval_on_selector_all(
            '#dataset-filter-grid .filter-form-box[data-factor=dynamic]:has(.filter-tag[data-fk=discharge]) .filter-form-codes .filter-tag',
            'els => els.map(e => e.textContent)')
        names = set()
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            names |= self.dyn_subs(rec['conditions'], 'discharge')
        self.assertEqual(sorted(subs), sorted(names))   # as recorded (no title-casing)
        self.assertEqual(len(subs), len(set(subs)))

    def test_selecting_dynamic_selects_its_sub_profiles_and_deselecting_them_narrows(self):
        self.page.click(OPEN); self.page.click(FG % ('discharge', 'dynamic'))
        n_subs = self.page.locator('#dataset-filter-grid .filter-form-box:has(.filter-tag[data-fk=discharge]) .filter-form-codes .filter-tag.active').count()
        self.assertGreater(n_subs, 5)
        self.page.click(APPLY)
        self.assertEqual(self.shown_ids(), self.expected(lambda c, k: self.has_dynamic(k, 'discharge')))
        self.page.click(OPEN); self.page.click(FG % ('discharge', 'sub:WLTP')); self.page.click(APPLY)
        def keep(c, k):
            if not self.has_dynamic(k, 'discharge'):
                return False
            own = self.dyn_subs(k, 'discharge')
            return not own or bool(own - {'WLTP'})
        self.assertEqual(self.shown_ids(), self.expected(keep))
        self.assertIn('Discharging: UDDS', self.page.inner_text('#applied-filter-chips'))

    def test_clicking_dynamic_again_clears_its_sub_profiles_too(self):
        self.page.click(OPEN); self.page.click(FG % ('discharge', 'dynamic'))
        self.page.click(FG % ('discharge', 'sub:WLTP'))      # a sub-profile deselected on its own stays deselected
        self.page.click(FG % ('discharge', 'dynamic'))        # dynamic off
        self.assertEqual(self.page.locator('#dataset-filter-grid .filter-form-box:has(.filter-tag[data-fk=discharge]) .filter-tag.active').count(), 0)
        self.page.click(FG % ('discharge', 'sub:UDDS'))       # a lone sub-profile keeps the dashed pill, and Dynamic stays off
        self.assertFalse(self.page.evaluate("document.querySelector(\"#dataset-filter-grid .filter-tag[data-fk=discharge][data-fv=dynamic]\").classList.contains('active')"))
        self.assertTrue(self.page.evaluate("document.querySelector('.filter-form-box[data-factor=dynamic]:has(.filter-tag[data-fk=discharge]) > .filter-tag').classList.contains('partial')"))

    def test_dynamic_turns_partial_when_a_sub_profile_is_deselected(self):
        pill = "document.querySelector('.filter-form-box[data-factor=dynamic]:has(.filter-tag[data-fk=discharge]) > .filter-tag').classList.contains('%s')"
        self.page.click(OPEN); self.page.click(FG % ('discharge', 'dynamic'))
        self.assertTrue(self.page.evaluate(pill % 'active')); self.assertFalse(self.page.evaluate(pill % 'partial'))
        self.page.click(FG % ('discharge', 'sub:WLTP'))
        self.assertTrue(self.page.evaluate(pill % 'partial'))
        self.page.click(FG % ('discharge', 'sub:WLTP'))      # back to all selected
        self.assertFalse(self.page.evaluate(pill % 'partial'))

    def test_clicking_a_partial_dynamic_clears_it_and_all_its_sub_profiles(self):
        sel = "#dataset-filter-grid .filter-form-box:has(.filter-tag[data-fk=discharge][data-fv=dynamic]) .filter-tag.active"
        self.page.click(OPEN); self.page.click(FG % ('discharge', 'dynamic')); self.page.click(FG % ('discharge', 'sub:WLTP'))   # partial
        self.page.click(FG % ('discharge', 'dynamic'))
        self.assertEqual(self.page.locator(sel).count(), 0)
        self.page.click(FG % ('discharge', 'sub:UDDS'))                                                                          # partial, Dynamic off
        self.page.click(FG % ('discharge', 'dynamic'))
        self.assertEqual(self.page.locator(sel).count(), 0)
        self.page.click(FG % ('discharge', 'dynamic'))                                                                           # fully off: selects all again
        self.assertGreater(self.page.locator(sel).count(), 5)

    def test_sub_profile_alone_matches_by_name_shows_a_dashed_pill_and_survives_removing_the_pill_chip(self):
        self.apply(('discharge', 'sub:UDDS'))
        self.assertEqual(self.shown_ids(), self.expected(lambda c, k: 'UDDS' in self.dyn_subs(k, 'discharge')))
        self.page.click(OPEN)
        self.assertTrue(self.page.evaluate(
            "document.querySelector('.filter-form-box[data-factor=dynamic]:has(.filter-tag[data-fk=discharge]) > .filter-tag').classList.contains('partial')"))
        self.page.click(OPEN)
        self.page.click(OPEN); self.page.click('#dataset-filter-popover .dataset-filter-action:not(.apply)')   # start again from nothing selected
        self.apply(('discharge', 'dynamic'))
        chips_before = self.page.locator('#applied-filter-chips .applied-chip').count()
        self.page.click('#applied-filter-chips .applied-chip:has-text("Discharging: Dynamic") button')
        self.assertEqual(self.page.locator('#applied-filter-chips .applied-chip').count(), chips_before - 1)
        self.assertIn('Discharging: UDDS', self.page.inner_text('#applied-filter-chips'))

    def test_card_profile_chip_counts_single_side_profiles(self):
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            k = rec['conditions']
            if not k['single_side_profiles']:
                continue
            total = len(k['profile_combinations']) + len(k['single_side_profiles'])
            self.page.fill('#searchInput', rec['identity']['dataset_name']); self.page.dispatch_event('#searchInput', 'input')
            card = self.page.locator('.dataset-card', has_text=rec['identity']['dataset_name']).first
            text = card.inner_text()
            if total > 1:
                self.assertIn(f'{total} Profiles', text, row['dataset_id'])
            else:
                self.assertIn(self.shown_label(self.label(k['single_side_profiles'][0])), text, row['dataset_id'])

    def test_popup_dynamic_chips_list_the_dynamic_subprofiles(self):
        checked = 0
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            k = rec['conditions']
            sub = [x['name'] for x in k['dynamic_subprofiles']]
            has_dynamic = any('dynamic' in (p['charge'], p['discharge']) for p in k['profile_combinations']) \
                or any(x['profile'] == 'dynamic' for x in k['single_side_profiles'])
            self.assertEqual(bool(sub), has_dynamic, row['dataset_id'])
            if not sub:
                continue
            self.page.evaluate(f"openDatasetModal('{row['dataset_id']}')")
            self.page.evaluate("document.querySelectorAll('#modal-details details.md-chipdd').forEach(d => d.open = true)")
            # the names appear in the chip dropdowns: on the rate lines ("0.75C → Square wave") or, where no rate row names them, as a list
            shown = self.page.eval_on_selector_all('#modal-details details.md-chipdd .md-chipdd-body', 'els => els.map(e => e.textContent).join(" | ")')
            for name in sub:
                self.assertIn(name, shown, row['dataset_id'])
            self.assertNotIn('Dynamic:', shown, row['dataset_id'])
            checked += 1
        self.assertGreaterEqual(checked, 16)

    def test_popup_hides_profiles_and_chemistry_when_there_is_no_data(self):
        for row in self.index:
            rec = json.loads((META/'datasets'/f"{row['dataset_id']}.json").read_text())
            c, k = rec['cell'], rec['conditions']
            self.page.evaluate(f"openDatasetModal('{row['dataset_id']}')")
            labels = self.page.eval_on_selector_all('#modal-details .modal-label', 'els => els.map(e => e.textContent)')
            no_chem = not c['cathode_chemistries'] and not c['anode_chemistries'] and not c['electrode_combinations']
            self.assertEqual('Chemistry' in labels, not no_chem, row['dataset_id'])
            no_prof = not k['profile_combinations'] and not k['single_side_profiles']
            self.assertEqual('Profiles' in labels, not no_prof, row['dataset_id'])


if __name__ == '__main__':
    unittest.main()
