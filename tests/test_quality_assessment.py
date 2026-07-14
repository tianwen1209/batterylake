"""Minimal contract tests for Quality Assessment Path A wiring."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


class QualityAssessmentEngineTest(unittest.TestCase):
    def test_assess_dataset_frontend_schema(self):
        from quality.quality_assessment import assess_dataset, report_to_frontend_schema

        n = 120
        df = pd.DataFrame({
            "timestamp": np.arange(n, dtype=float),
            "cycle_number": np.repeat(np.arange(1, 7), n // 6),
            "voltage_V": 3.6 + 0.3 * np.sin(np.linspace(0, 8 * np.pi, n)),
            "current_A": np.where((np.arange(n) // 10) % 2 == 0, 1.0, -1.0),
            "temperature_C": np.full(n, 25.0),
            "capacity_Ah": np.linspace(2.0, 1.8, n),
            "charge_capacity_Ah": np.linspace(2.02, 1.82, n),
            "coulombic_efficiency": np.full(n, 0.99),
        })
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "timeseries.csv"
            df.to_csv(path, index=False)
            report = assess_dataset(path, dataset_id="2007_NASA_PCoE_LCO_18650_1C_1C_25T")
            payload = report_to_frontend_schema(report)

        self.assertEqual(report["chemistry"], "LCO")
        self.assertIn(payload["gate"], ("ready", "ready_with_warning"))
        for key in ("completeness", "consistency", "accuracy", "validity"):
            self.assertIn(key, payload["quality_score"])
        self.assertEqual(len(payload["checks_detail"]), 6)
        self.assertEqual(set(payload["checks_detail"][0]), {"key", "name", "detail", "status"})
        self.assertEqual(payload["overall"], round(sum(payload["quality_score"].values()) / 4, 2))

    def test_unknown_chemistry_label(self):
        from quality.quality_assessment import assess_dataset

        df = pd.DataFrame({
            "voltage_V": [3.5, 3.6, 3.4],
            "current_A": [1.0, -1.0, 0.5],
            "timestamp": [0.0, 1.0, 2.0],
        })
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.csv"
            df.to_csv(path, index=False)
            report = assess_dataset(path, dataset_id="unknown_pack")
        self.assertEqual(report["chemistry"], "unknown")


class QualityAssessmentPathAWiringTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.main_js = (ROOT / "js" / "main.js").read_text(encoding="utf-8")
        cls.reports = ROOT / "quality_reports"

    def test_path_a_loaders_are_wired(self):
        self.assertIn("async function loadQualityReport(datasetId)", self.main_js)
        self.assertIn("async function showDatasetQuality(datasetId)", self.main_js)
        self.assertIn("quality_reports/${id}_quality_report.json", self.main_js)
        self.assertIn("window.showDatasetQuality = showDatasetQuality", self.main_js)
        # Path A uses precomputed fetch — not the live /api/quality endpoint.
        self.assertNotIn("/api/quality", self.main_js)

    def test_precomputed_reports_exist_for_default_demo(self):
        report_path = self.reports / "dataset_03_quality_report.json"
        self.assertTrue(report_path.exists(), "dataset_03 report missing")
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertIn("quality_score", payload)
        self.assertIn("checks_detail", payload)
        self.assertEqual(payload["gate"], "ready_with_warning")
        self.assertEqual(payload["warn_count"], 1)

    def test_index_lists_reports(self):
        index_path = self.reports / "index.json"
        self.assertTrue(index_path.exists())
        index = json.loads(index_path.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(index), 9)


if __name__ == "__main__":
    unittest.main()
