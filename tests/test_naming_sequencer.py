import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class NamingSequencerContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.css = (ROOT / "styles" / "polish.css").read_text(encoding="utf-8")
        script = ROOT / "js" / "naming-sequencer.js"
        cls.js = script.read_text(encoding="utf-8") if script.exists() else ""

    def test_markup_has_seven_preview_segments_and_seven_cards(self):
        self.assertIn('id="naming-sequencer"', self.html)
        self.assertEqual(self.html.count('data-field-index="'), 14)
        for label in (
            "Year",
            "Source",
            "Chemistry",
            "Form factor",
            "Charge rate",
            "Discharge rate",
            "Temperature",
        ):
            self.assertIn(f'<span class="naming-part-key">{label}</span>', self.html)

    def test_real_reference_example_and_script_are_present(self):
        self.assertIn("2007_NASA_PCoE_LCO_18650_1C_1C_25T", self.html)
        self.assertIn('<script src="js/naming-sequencer.js"></script>', self.html)

    def test_styles_cover_centered_cards_and_motion_preferences(self):
        self.assertRegex(
            self.css,
            r"#naming-sequencer\s+\.naming-parts\s*\{[^}]*justify-content:\s*center",
        )
        self.assertIn("flex: 0 1 calc((100% - 33px) / 4)", self.css)
        self.assertRegex(
            self.css,
            r"@media \(max-width: 900px\)\s*\{\s*#naming-sequencer \.naming-part \{ flex-basis: calc\(\(100% - 11px\) / 2\); \}",
        )
        self.assertIn("@media (prefers-reduced-motion: reduce)", self.css)
        self.assertIn('[data-theme="dark"] #naming-sequencer', self.css)

    def test_script_synchronizes_status_signal_preview_and_cards(self):
        for marker in (
            "naming-sequencer-status",
            "naming-sequencer-signal",
            "is-active",
            "pointerenter",
            "focus",
            "prefers-reduced-motion: reduce",
        ):
            self.assertIn(marker, self.js)


if __name__ == "__main__":
    unittest.main()
