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

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Filter,
    FilterExpression,
    Metric,
    RunReportRequest,
)
from google.oauth2 import service_account

START_DATE = "2026-07-15"
REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "assets" / "data" / "site-stats.json"
SCOPES = ("https://www.googleapis.com/auth/analytics.readonly",)


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


def _build_client(sa_json: str) -> BetaAnalyticsDataClient:
    info = json.loads(sa_json)
    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=SCOPES,
    )
    return BetaAnalyticsDataClient(credentials=credentials)


def fetch_screen_page_views(client: BetaAnalyticsDataClient, property_name: str, end_date: str) -> int:
    request = RunReportRequest(
        property=property_name,
        metrics=[Metric(name="screenPageViews")],
        date_ranges=[DateRange(start_date=START_DATE, end_date=end_date)],
    )
    return _metric_total(client.run_report(request))


def fetch_event_count(
    client: BetaAnalyticsDataClient,
    property_name: str,
    end_date: str,
    event_name: str,
) -> int:
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
    client: BetaAnalyticsDataClient,
    property_name: str,
    end_date: str,
    event_name: str,
) -> dict[str, int]:
    """Aggregate event counts keyed by custom event parameter model_id.

    Requires a GA4 event-scoped custom dimension mapped to parameter model_id
    (API name: customEvent:model_id). Returns {} if the dimension is missing.
    """
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

    payload = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_visits": total_visits,
        "dataset_downloads": dataset_downloads,
        "skill_uses": skill_uses,
        "model_downloads": model_downloads,
        "model_runs": model_runs,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUTPUT_PATH.relative_to(REPO_ROOT)} "
        f"(visits={total_visits}, datasets={dataset_downloads}, skills={skill_uses}, "
        f"model_downloads={sum(model_downloads.values())}, "
        f"model_runs={sum(model_runs.values())})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
