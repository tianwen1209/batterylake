#!/usr/bin/env python3
"""Minimal unit tests for GA4 country location normalization."""

from __future__ import annotations

import unittest

from scripts.export_ga4_stats import normalize_country_rows, resolve_locations_payload


class NormalizeCountryRowsTests(unittest.TestCase):
    def test_aggregates_sorts_and_drops_zeros(self):
        rows = [
            ("Singapore", "SG", 10),
            ("United States", "US", 0),
            ("Singapore", "SG", 5),
            ("Germany", "DE", 3),
            ("", "", 7),  # unknown — omitted from map export
            ("(not set)", "(not set)", 2),
        ]
        out = normalize_country_rows(rows)
        self.assertEqual(
            out,
            [
                {"country": "Singapore", "countryCode": "SG", "visitors": 15},
                {"country": "Germany", "countryCode": "DE", "visitors": 3},
            ],
        )

    def test_unknown_never_exported(self):
        out = normalize_country_rows(
            [
                ("Unknown", "ZZ", 9),
                ("(not set)", "ZZ", 4),
            ]
        )
        self.assertEqual(out, [])


class ResolveLocationsPayloadTests(unittest.TestCase):
    def test_builds_schema_on_success(self):
        payload = resolve_locations_payload(
            [{"country": "Singapore", "countryCode": "SG", "visitors": 10}],
            updated_at="2026-07-16T00:00:00Z",
            end_date="2026-07-16",
        )
        self.assertEqual(payload["metric"], "activeUsers")
        self.assertEqual(
            payload["dateRange"],
            {"startDate": "2026-07-15", "endDate": "2026-07-16"},
        )
        self.assertEqual(len(payload["countries"]), 1)


if __name__ == "__main__":
    unittest.main()
