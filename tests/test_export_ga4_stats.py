#!/usr/bin/env python3
"""Minimal unit tests for GA4 location normalization."""

from __future__ import annotations

import unittest

from scripts.export_ga4_stats import (
    normalize_city_rows,
    normalize_country_rows,
    resolve_locations_payload,
)


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


class NormalizeCityRowsTests(unittest.TestCase):
    def test_aggregates_cities_with_static_coords(self):
        coords = {
            "SG|singapore": [103.85, 1.29],
            "US|san francisco": [-122.419, 37.775],
            "US|new york": [-74.006, 40.714],
        }
        out = normalize_city_rows(
            [
                ("Singapore", "SG", "Singapore", 10),
                ("Singapore", "SG", "Singapore", 5),
                ("United States", "US", "San Francisco", 8),
                ("United States", "US", "New York", 4),
                ("United States", "US", "(not set)", 9),
                ("Germany", "DE", "TinyUnknownTown", 3),  # no coords → omitted
            ],
            coords_lookup=coords,
        )
        self.assertEqual(
            out,
            [
                {
                    "country": "Singapore",
                    "countryCode": "SG",
                    "city": "Singapore",
                    "visitors": 15,
                    "lng": 103.85,
                    "lat": 1.29,
                },
                {
                    "country": "United States",
                    "countryCode": "US",
                    "city": "San Francisco",
                    "visitors": 8,
                    "lng": -122.419,
                    "lat": 37.775,
                },
                {
                    "country": "United States",
                    "countryCode": "US",
                    "city": "New York",
                    "visitors": 4,
                    "lng": -74.006,
                    "lat": 40.714,
                },
            ],
        )


class ResolveLocationsPayloadTests(unittest.TestCase):
    def test_builds_schema_on_success(self):
        payload = resolve_locations_payload(
            [{"country": "Singapore", "countryCode": "SG", "visitors": 10}],
            updated_at="2026-07-16T00:00:00Z",
            end_date="2026-07-16",
            fetched_cities=[
                {
                    "country": "Singapore",
                    "countryCode": "SG",
                    "city": "Singapore",
                    "visitors": 10,
                    "lng": 103.85,
                    "lat": 1.29,
                }
            ],
        )
        self.assertEqual(payload["metric"], "activeUsers")
        self.assertEqual(
            payload["dateRange"],
            {"startDate": "2026-07-15", "endDate": "2026-07-16"},
        )
        self.assertEqual(len(payload["countries"]), 1)
        self.assertEqual(len(payload["cities"]), 1)

    def test_city_failure_keeps_countries(self):
        payload = resolve_locations_payload(
            [{"country": "Singapore", "countryCode": "SG", "visitors": 10}],
            updated_at="2026-07-16T00:00:00Z",
            end_date="2026-07-16",
            fetched_cities=None,
        )
        self.assertEqual(len(payload["countries"]), 1)
        self.assertEqual(payload["cities"], [])


if __name__ == "__main__":
    unittest.main()
