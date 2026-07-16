#!/usr/bin/env python3
"""Export BatteryLake public counters from GA4 into assets/data/site-stats.json.

Requires environment variables:
  GA4_PROPERTY_ID              — numeric GA4 property id (or properties/NNNN)
  GA4_SERVICE_ACCOUNT_JSON     — full service-account JSON string

Never prints or writes credentials to disk.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

START_DATE = "2026-07-15"
REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "assets" / "data" / "site-stats.json"
CITY_COORDS_PATH = REPO_ROOT / "scripts" / "data" / "city-coordinates.json"
SCOPES = ("https://www.googleapis.com/auth/analytics.readonly",)
LOCATION_METRIC = "activeUsers"
LOCATION_LIMIT = 200
CITY_LOCATION_LIMIT = 250


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def _property_resource(property_id: str) -> str:
    property_id = property_id.strip()
    if property_id.startswith("properties/"):
        return property_id
    return f"properties/{property_id}"


def _metric_total(response) -> int:
    """Return the first metric cell as int, or 0 when the report has no rows."""
    if not response.rows:
        return 0
    raw = response.rows[0].metric_values[0].value
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0


def _sum_metric_rows(response) -> int:
    if not response.rows:
        return 0
    total = 0
    for row in response.rows:
        try:
            total += int(row.metric_values[0].value or 0)
        except (TypeError, ValueError):
            continue
    return total


def _build_client(sa_json: str):
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.oauth2 import service_account

    info = json.loads(sa_json)
    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=SCOPES,
    )
    return BetaAnalyticsDataClient(credentials=credentials)


def fetch_screen_page_views(client, property_name: str, end_date: str) -> int:
    from google.analytics.data_v1beta.types import DateRange, Metric, RunReportRequest

    request = RunReportRequest(
        property=property_name,
        metrics=[Metric(name="screenPageViews")],
        date_ranges=[DateRange(start_date=START_DATE, end_date=end_date)],
    )
    return _metric_total(client.run_report(request))


def fetch_event_count(
    client,
    property_name: str,
    end_date: str,
    event_name: str,
) -> int:
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Filter,
        FilterExpression,
        Metric,
        RunReportRequest,
    )

    request = RunReportRequest(
        property=property_name,
        dimensions=[Dimension(name="eventName")],
        metrics=[Metric(name="eventCount")],
        date_ranges=[DateRange(start_date=START_DATE, end_date=end_date)],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="eventName",
                string_filter=Filter.StringFilter(value=event_name),
            )
        ),
    )
    return _sum_metric_rows(client.run_report(request))


def fetch_event_counts_by_model_id(
    client,
    property_name: str,
    end_date: str,
    event_name: str,
) -> dict[str, int]:
    """Aggregate event counts keyed by custom event parameter model_id.

    Requires a GA4 event-scoped custom dimension mapped to parameter model_id
    (API name: customEvent:model_id). Returns {} if the dimension is missing.
    """
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Filter,
        FilterExpression,
        Metric,
        RunReportRequest,
    )

    request = RunReportRequest(
        property=property_name,
        dimensions=[Dimension(name="customEvent:model_id")],
        metrics=[Metric(name="eventCount")],
        date_ranges=[DateRange(start_date=START_DATE, end_date=end_date)],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="eventName",
                string_filter=Filter.StringFilter(value=event_name),
            )
        ),
    )
    try:
        response = client.run_report(request)
    except Exception as exc:  # noqa: BLE001 — keep daily export resilient
        print(
            f"Warning: could not fetch {event_name} by model_id ({exc})",
            file=sys.stderr,
        )
        return {}

    counts: dict[str, int] = {}
    for row in response.rows or []:
        model_id = (row.dimension_values[0].value or "").strip()
        if not model_id or model_id == "(not set)":
            continue
        try:
            value = int(row.metric_values[0].value or 0)
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue
        counts[model_id] = counts.get(model_id, 0) + value
    return counts


def _is_unknown_country(country: str, country_code: str) -> bool:
    name = (country or "").strip()
    code = (country_code or "").strip().upper()
    if not name or name.lower() in {"(not set)", "unknown", "not set"}:
        return True
    if not code or code in {"(NOT SET)", "ZZ", "UNKNOWN"}:
        return True
    return False


def _is_unknown_city(city: str) -> bool:
    name = (city or "").strip()
    return not name or name.lower() in {"(not set)", "unknown", "not set", "null"}


def load_city_coordinates() -> dict[str, list[float]]:
    """Static city-center lookup keyed by 'CC|city' (casefold). No network calls."""
    if not CITY_COORDS_PATH.exists():
        return {}
    try:
        raw = json.loads(CITY_COORDS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, list[float]] = {}
    for key, value in raw.items():
        if not isinstance(value, (list, tuple)) or len(value) < 2:
            continue
        try:
            out[str(key)] = [float(value[0]), float(value[1])]
        except (TypeError, ValueError):
            continue
    return out


def lookup_city_coordinates(
    coords_lookup: dict[str, list[float]],
    country_code: str,
    city: str,
) -> list[float] | None:
    code = (country_code or "").strip().upper()
    name = (city or "").strip()
    if not code or not name:
        return None
    key = f"{code}|{name.casefold()}"
    hit = coords_lookup.get(key)
    if hit:
        return hit
    # Mild normalization for common GA4 variants.
    alt = name.replace(".", "").replace(",", "").strip().casefold()
    if alt != name.casefold():
        hit = coords_lookup.get(f"{code}|{alt}")
        if hit:
            return hit
    return None


def normalize_country_rows(rows: list[tuple[str, str, int]]) -> list[dict[str, Any]]:
    """Aggregate GA4 country rows into map-ready country records.

    - Coerces visitors to int and drops non-positive counts.
    - Aggregates empty / (not set) rows as Unknown (omitted from output;
      map rendering must never show Unknown).
    - Aggregates duplicate country codes.
    - Returns countries sorted by visitors descending.
    """
    by_code: dict[str, dict[str, Any]] = {}
    unknown_visitors = 0

    for country, country_code, visitors in rows:
        try:
            count = int(visitors)
        except (TypeError, ValueError):
            continue
        if count <= 0:
            continue

        name = (country or "").strip()
        code = (country_code or "").strip().upper()
        if _is_unknown_country(name, code):
            unknown_visitors += count
            continue

        existing = by_code.get(code)
        if existing:
            existing["visitors"] = int(existing["visitors"]) + count
            if name and (not existing["country"] or existing["country"] == "Unknown"):
                existing["country"] = name
        else:
            by_code[code] = {
                "country": name,
                "countryCode": code,
                "visitors": count,
            }

    # unknown_visitors is intentionally not exported — map must never render Unknown.
    _ = unknown_visitors

    countries = list(by_code.values())
    countries.sort(key=lambda row: (-int(row["visitors"]), row["countryCode"]))
    return countries


def normalize_city_rows(
    rows: list[tuple[str, str, str, int]],
    coords_lookup: dict[str, list[float]] | None = None,
) -> list[dict[str, Any]]:
    """Aggregate GA4 city rows into map-ready city records with static centers.

    Cities without a static coordinate match are omitted (frontend falls back to
    country-level markers). Unknown / (not set) cities are never exported.
    """
    coords_lookup = coords_lookup if coords_lookup is not None else load_city_coordinates()
    by_key: dict[tuple[str, str], dict[str, Any]] = {}

    for country, country_code, city, visitors in rows:
        try:
            count = int(visitors)
        except (TypeError, ValueError):
            continue
        if count <= 0:
            continue

        name = (country or "").strip()
        code = (country_code or "").strip().upper()
        city_name = (city or "").strip()
        if _is_unknown_country(name, code) or _is_unknown_city(city_name):
            continue

        coord = lookup_city_coordinates(coords_lookup, code, city_name)
        if not coord:
            continue

        key = (code, city_name.casefold())
        existing = by_key.get(key)
        if existing:
            existing["visitors"] = int(existing["visitors"]) + count
        else:
            by_key[key] = {
                "country": name,
                "countryCode": code,
                "city": city_name,
                "visitors": count,
                "lng": coord[0],
                "lat": coord[1],
            }

    cities = list(by_key.values())
    cities.sort(
        key=lambda row: (
            -int(row["visitors"]),
            row["countryCode"],
            str(row["city"]).casefold(),
        )
    )
    return cities


def fetch_visitors_by_country(
    client,
    property_name: str,
    end_date: str,
) -> list[dict[str, Any]] | None:
    """Country-level activeUsers with ISO country codes.

    Returns a sorted list on success (possibly empty).
    Returns None when the GA4 report fails so callers can preserve prior data.
    """
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Metric,
        OrderBy,
        RunReportRequest,
    )

    request = RunReportRequest(
        property=property_name,
        dimensions=[
            Dimension(name="country"),
            Dimension(name="countryId"),
        ],
        metrics=[Metric(name=LOCATION_METRIC)],
        date_ranges=[DateRange(start_date=START_DATE, end_date=end_date)],
        order_bys=[
            OrderBy(
                metric=OrderBy.MetricOrderBy(metric_name=LOCATION_METRIC),
                desc=True,
            )
        ],
        limit=LOCATION_LIMIT,
    )
    try:
        response = client.run_report(request)
    except Exception as exc:  # noqa: BLE001 — keep daily export resilient
        print(
            f"Warning: could not fetch visitors by country ({exc})",
            file=sys.stderr,
        )
        return None

    raw_rows: list[tuple[str, str, int]] = []
    for row in response.rows or []:
        country = (row.dimension_values[0].value or "").strip()
        country_code = (row.dimension_values[1].value or "").strip()
        try:
            visitors = int(row.metric_values[0].value or 0)
        except (TypeError, ValueError):
            continue
        raw_rows.append((country, country_code, visitors))
    return normalize_country_rows(raw_rows)


def fetch_visitors_by_city(
    client,
    property_name: str,
    end_date: str,
    coords_lookup: dict[str, list[float]] | None = None,
) -> list[dict[str, Any]] | None:
    """City-level activeUsers. Returns None on query failure, list on success."""
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Metric,
        OrderBy,
        RunReportRequest,
    )

    request = RunReportRequest(
        property=property_name,
        dimensions=[
            Dimension(name="country"),
            Dimension(name="countryId"),
            Dimension(name="city"),
        ],
        metrics=[Metric(name=LOCATION_METRIC)],
        date_ranges=[DateRange(start_date=START_DATE, end_date=end_date)],
        order_bys=[
            OrderBy(
                metric=OrderBy.MetricOrderBy(metric_name=LOCATION_METRIC),
                desc=True,
            )
        ],
        limit=CITY_LOCATION_LIMIT,
    )
    try:
        response = client.run_report(request)
    except Exception as exc:  # noqa: BLE001 — keep daily export resilient
        print(
            f"Warning: could not fetch visitors by city ({exc})",
            file=sys.stderr,
        )
        return None

    raw_rows: list[tuple[str, str, str, int]] = []
    for row in response.rows or []:
        country = (row.dimension_values[0].value or "").strip()
        country_code = (row.dimension_values[1].value or "").strip()
        city = (row.dimension_values[2].value or "").strip()
        try:
            visitors = int(row.metric_values[0].value or 0)
        except (TypeError, ValueError):
            continue
        raw_rows.append((country, country_code, city, visitors))
    return normalize_city_rows(raw_rows, coords_lookup=coords_lookup)


def read_previous_locations() -> dict[str, Any] | None:
    """Return the previous locations block from site-stats.json, if valid."""
    if not OUTPUT_PATH.exists():
        return None
    try:
        previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(previous, dict):
        return None
    locations = previous.get("locations")
    if not isinstance(locations, dict):
        return None
    countries = locations.get("countries")
    cities = locations.get("cities")
    if not isinstance(countries, list) and not isinstance(cities, list):
        return None
    return locations


def build_locations_payload(
    countries: list[dict[str, Any]],
    *,
    updated_at: str,
    end_date: str,
    cities: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "updatedAt": updated_at,
        "metric": LOCATION_METRIC,
        "dateRange": {
            "startDate": START_DATE,
            "endDate": end_date,
        },
        "countries": countries,
        "cities": cities if cities is not None else [],
    }


def resolve_locations_payload(
    fetched_countries: list[dict[str, Any]] | None,
    *,
    updated_at: str,
    end_date: str,
    fetched_cities: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build locations JSON, preserving prior data when location queries fail."""
    if fetched_countries is None and fetched_cities is None:
        previous = read_previous_locations()
        if previous is not None:
            print(
                "Warning: location queries failed; preserving previous locations data",
                file=sys.stderr,
            )
            return previous
        return build_locations_payload(
            [],
            updated_at=updated_at,
            end_date=end_date,
            cities=[],
        )

    countries = fetched_countries if fetched_countries is not None else []
    # City query failure → keep country markers only (graceful fallback).
    cities = fetched_cities if fetched_cities is not None else []
    return build_locations_payload(
        countries,
        updated_at=updated_at,
        end_date=end_date,
        cities=cities,
    )


def main() -> int:
    property_id = _require_env("GA4_PROPERTY_ID")
    sa_json = _require_env("GA4_SERVICE_ACCOUNT_JSON")

    client = _build_client(sa_json)
    property_name = _property_resource(property_id)
    end_date = date.today().isoformat()

    total_visits = fetch_screen_page_views(client, property_name, end_date)
    dataset_downloads = fetch_event_count(
        client, property_name, end_date, "dataset_download"
    )
    skill_uses = fetch_event_count(
        client, property_name, end_date, "skill_use"
    )
    model_downloads = fetch_event_counts_by_model_id(
        client, property_name, end_date, "model_download"
    )
    model_runs = fetch_event_counts_by_model_id(
        client, property_name, end_date, "model_run"
    )
    coords_lookup = load_city_coordinates()
    location_countries = fetch_visitors_by_country(client, property_name, end_date)
    location_cities = fetch_visitors_by_city(
        client, property_name, end_date, coords_lookup=coords_lookup
    )
    updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    locations = resolve_locations_payload(
        location_countries,
        updated_at=updated_at,
        end_date=end_date,
        fetched_cities=location_cities,
    )

    payload = {
        "updated_at": updated_at,
        "total_visits": total_visits,
        "dataset_downloads": dataset_downloads,
        "skill_uses": skill_uses,
        "model_downloads": model_downloads,
        "model_runs": model_runs,
        "locations": locations,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    country_count = len(locations.get("countries") or [])
    city_count = len(locations.get("cities") or [])
    print(
        f"Wrote {OUTPUT_PATH.relative_to(REPO_ROOT)} "
        f"(visits={total_visits}, datasets={dataset_downloads}, skills={skill_uses}, "
        f"model_downloads={sum(model_downloads.values())}, "
        f"model_runs={sum(model_runs.values())}, "
        f"countries={country_count}, cities={city_count})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
