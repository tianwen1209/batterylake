import json
import mimetypes
import os
import re
import time
from collections import Counter
from email.parser import BytesParser
from email.policy import default
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from urllib import error, parse, request

import pandas as pd


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.getenv("PORT", "8000"))
METADATA_FIELDS = [
    "chemistry",
    "cathode_material",
    "anode_material",
    "nominal_capacity_Ah",
    "nominal_voltage_V",
    "temperature_C",
    "charge_protocol",
    "discharge_protocol",
    "C_rate",
    "cutoff_voltage_upper",
    "cutoff_voltage_lower",
    "brand_or_manufacturer",
    "form_factor",
    "paper_url",
    "source_url",
    "license",
]
METADATA_MISSING_VALUE = "Source page not stated"


def load_dotenv():
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_project_context():
    parts = []
    for relative_path in [
        "README.md",
        "README_EN.md",
        "docs/schema/schema_overview.md",
        "dataset_registry.csv",
    ]:
        path = ROOT / relative_path
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        parts.append(f"[{relative_path}]\n{text[:3500]}")
    return "\n\n".join(parts)


load_dotenv()
PROJECT_CONTEXT = load_project_context()


def build_system_prompt():
    return (
        "You are the BatteryTwin project assistant. Answer in English by default. "
        "Only answer in another language when the user explicitly asks you to. "
        "If the user asks in Chinese or another language, understand the request and still respond in English. "
        "Help with battery datasets, schema, ETL scripts, quality checks, and benchmark workflows. "
        "Use the project context below when it is relevant.\n\n"
        f"{PROJECT_CONTEXT}"
    )


def post_json(url, payload, headers):
    body = json.dumps(payload).encode("utf-8")

    for attempt in range(3):
        req = request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", **headers},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            if exc.code in {500, 502, 503, 504} and attempt < 2:
                time.sleep(1 + attempt)
                continue
            raise RuntimeError(f"AI API error {exc.code}: {detail}") from exc
        except Exception as exc:
            if attempt < 2:
                time.sleep(1 + attempt)
                continue
            raise RuntimeError(f"AI API request failed: {exc}") from exc

    raise RuntimeError("AI API request failed after retries.")


def call_openai_compatible(message):
    api_key = os.getenv("AI_API_KEY")
    api_url = os.getenv("AI_API_URL")
    model = os.getenv("AI_MODEL", "deepseek-chat")

    if not api_key or not api_url:
        return (
            "The AI backend is connected, but AI_API_KEY and AI_API_URL are not configured yet.\n\n"
            "You can use this message to confirm that the chat window is working. To connect a real model, "
            "create a .env file in the project root, add AI_API_KEY, AI_API_URL, and AI_MODEL, then restart python app.py."
        )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": message},
        ],
        "temperature": 0.3,
    }
    data = post_json(api_url, payload, {"Authorization": f"Bearer {api_key}"})

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected AI API response: {data}") from exc


def call_gemini(message):
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("AI_API_KEY")
    model = os.getenv("GEMINI_MODEL") or os.getenv("AI_MODEL", "gemini-2.5-flash")
    api_url = os.getenv("GEMINI_API_URL")

    if not api_url:
        encoded_model = parse.quote(model, safe="")
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{encoded_model}:generateContent"

    if not api_key:
        return (
            "The Gemini backend is connected, but GEMINI_API_KEY is not configured yet.\n\n"
            "Create a .env file in the project root, add GEMINI_API_KEY, then restart python app.py."
        )

    payload = {
        "systemInstruction": {
            "parts": [{"text": build_system_prompt()}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": message}],
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
        },
    }
    data = post_json(api_url, payload, {"x-goog-api-key": api_key})

    try:
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(part.get("text", "") for part in parts).strip() or "Gemini did not return any text content."
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected Gemini API response: {data}") from exc


def call_ai(message):
    provider = os.getenv("AI_PROVIDER", "").strip().lower()
    if not provider and os.getenv("GEMINI_API_KEY"):
        provider = "gemini"
    if provider == "gemini":
        return call_gemini(message)
    return call_openai_compatible(message)


def confidence_field(name, value, evidence, confidence):
    return {
        "name": name,
        "value": value or "Needs confirmation",
        "evidence": evidence,
        "confidence": confidence,
        "pending": not bool(value),
    }


def inspect_dataframe(frame, filename):
    columns = [str(column).strip() for column in frame.columns]
    lowered = [column.lower() for column in columns]
    sample = frame.head(200)
    missing = int(sample.isna().sum().sum())
    values = int(sample.size)
    numeric = sample.select_dtypes(include="number")
    anomalies = 0
    if not numeric.empty:
        for column in numeric.columns:
            series = numeric[column].dropna()
            if len(series) < 4:
                continue
            q1, q3 = series.quantile([0.25, 0.75])
            spread = q3 - q1
            if spread:
                anomalies += int(((series < q1 - 3 * spread) | (series > q3 + 3 * spread)).sum())
    return {
        "filename": filename,
        "columns": columns,
        "rows_sampled": len(sample),
        "missing": missing,
        "values": values,
        "anomalies": anomalies,
        "lowered": lowered,
        "sample_rows": json.loads(sample.head(5).to_json(orient="records", date_format="iso")),
    }


def collect_json_summary(value, prefix="", keys=None, scalars=None):
    keys = keys if keys is not None else []
    scalars = scalars if scalars is not None else []
    if len(keys) >= 120 and len(scalars) >= 40:
        return keys, scalars
    if isinstance(value, dict):
        for key, item in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if len(keys) < 120:
                keys.append(path)
            collect_json_summary(item, path, keys, scalars)
    elif isinstance(value, list):
        if value:
            collect_json_summary(value[0], f"{prefix}[0]" if prefix else "[0]", keys, scalars)
    elif prefix and len(scalars) < 40:
        text = str(value)
        scalars.append({"key": prefix, "value": text[:160]})
    return keys, scalars


def classify_file_role(details):
    columns = " ".join(str(column).lower() for column in details.get("columns", []))
    json_keys = " ".join(str(key).lower() for key in details.get("json_keys", []))
    filename = str(details.get("filename", "")).lower()
    suffix = str(details.get("suffix", "")).lower()
    measurement_hits = sum(token in columns for token in [
        "voltage", "current", "time", "cycle", "capacity", "temperature", "step"
    ])
    if measurement_hits >= 2:
        return "measurement_data", "Measurement-like columns were detected."
    metadata_hits = sum(token in json_keys or token in filename for token in [
        "datacite", "contributors", "creator", "identifier", "doi", "publisher", "publicationyear", "description", "rights"
    ])
    if suffix == ".json" and metadata_hits >= 2:
        return "metadata_only", "Citation/project metadata keys were detected; no battery measurement columns were found."
    if suffix in {".pdf", ".docx", ".md", ".html"}:
        return "metadata_only", "Document-like file; useful for source metadata evidence, not direct timeseries conversion."
    return "unknown", "No reliable measurement columns or source-metadata signature was detected."


def inspect_file(filename, content=None, path=None):
    suffix = Path(filename).suffix.lower()
    source = BytesIO(content) if content is not None else path
    size_bytes = len(content) if content is not None else (Path(path).stat().st_size if path else 0)
    details = {"filename": filename, "suffix": suffix, "size_bytes": size_bytes, "columns": [], "rows_sampled": 0, "missing": 0, "values": 0, "anomalies": 0}
    try:
        if suffix in {".csv", ".txt", ".tsv"}:
            separator = "\t" if suffix == ".tsv" else None
            frame = pd.read_csv(source, sep=separator, engine="python", nrows=250)
            details.update(inspect_dataframe(frame, filename))
        elif suffix in {".xlsx", ".xls"}:
            frame = pd.read_excel(source, nrows=250)
            details.update(inspect_dataframe(frame, filename))
        elif suffix == ".parquet":
            frame = pd.read_parquet(source).head(250)
            details.update(inspect_dataframe(frame, filename))
        elif suffix == ".json":
            raw = content if content is not None else Path(path).read_bytes()
            parsed = json.loads(raw.decode("utf-8-sig"))
            keys, scalars = collect_json_summary(parsed)
            details["json_keys"] = keys
            details["json_scalars"] = scalars
            details["columns"] = keys[:80]
            details["sample_rows"] = scalars[:8]
            details["rows_sampled"] = 1
        elif suffix == ".mat":
            from scipy.io import whosmat
            variables = whosmat(source)
            details["columns"] = [name for name, _, _ in variables]
            details["mat_keys"] = details["columns"]
        elif suffix in {".h5", ".hdf5"}:
            frame = pd.read_hdf(source).head(250)
            details.update(inspect_dataframe(frame, filename))
        else:
            details["note"] = "Filename, extension and file size inspected; tabular sampling is not available for this format."
    except Exception as exc:
        details["read_error"] = str(exc)
    role, role_reason = classify_file_role(details)
    details["file_role"] = role
    details["role_reason"] = role_reason
    return details


def infer_inspection(file_details, source_label):
    names = " ".join(item["filename"] for item in file_details)
    columns = []
    for item in file_details:
        columns.extend(item.get("columns", []))
    corpus = (names + " " + " ".join(columns)).lower()
    extensions = Counter(item["suffix"].lstrip(".").upper() or "UNKNOWN" for item in file_details)
    formats = " + ".join(extensions.keys())

    dataset_type = None
    type_evidence = "No decisive experiment-type token was found in filenames or sampled headers."
    if any(token in corpus for token in ["calendar", "storage", "shelf"]):
        dataset_type = "Calendar aging"
        type_evidence = "Filename/header evidence contains calendar-storage terminology."
    elif any(token in corpus for token in ["thermal runaway", "abuse", "nail", "overcharge", "dtdt", "dT/dt".lower()]):
        dataset_type = "Thermal abuse"
        type_evidence = "Filename/header evidence contains thermal-abuse or temperature-rise terminology."
    elif any(token in corpus for token in ["eis", "hppc", "rpt", "characterization", "characterisation"]):
        dataset_type = "Characterization test"
        type_evidence = "Filename/header evidence contains EIS, HPPC, RPT or characterization terminology."
    elif any(token in corpus for token in ["cycle", "capacity", "charge", "discharge"]):
        dataset_type = "Cycle aging"
        type_evidence = "Sampled headers contain cycling/capacity terminology."

    year_match = re.search(r"\b(19|20)\d{2}\b", names)
    chemistry_match = next((label for token, label in [
        ("nmc811", "NMC811"), ("nmc", "NMC"), ("lfp", "LFP"), ("nca", "NCA"),
        ("lco", "LCO"), ("lmno", "LMNO"), ("graphite", "Graphite")
    ] if token in corpus), None)
    form_match = next((form for form in ["21700", "18650", "26650", "4680", "pouch", "prismatic"] if form in corpus), None)
    temperatures = sorted(set(re.findall(r"(?<!\d)(-?\d{1,3})\s*°?\s*c\b", corpus, re.I)))
    rates = sorted(set(re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)\s*c(?:rate)?\b", corpus, re.I)))

    id_candidates = []
    for filename in names.split():
        stem = Path(filename).stem
        match = re.search(r"(?:cell|bat|battery|sample|c)[_-]?(\d{1,4})", stem, re.I)
        if match:
            id_candidates.append(match.group(0))
    cell_count = len(set(id_candidates)) or None

    fields = [
        confidence_field("Dataset type", dataset_type, type_evidence, 0.88 if dataset_type else 0.25),
        confidence_field("Data format", formats, f"Detected {len(file_details)} file(s): " + ", ".join(f"{count} {ext}" for ext, count in extensions.items()), 1.0),
        confidence_field("Year", year_match.group(0) if year_match else None, "Year token extracted from source filenames." if year_match else "No unambiguous four-digit year found.", 0.82 if year_match else 0.2),
        confidence_field("Source / lab", None, f"No authoritative lab/source statement was available in {source_label}.", 0.15),
        confidence_field("Chemistry", chemistry_match, "Chemistry token found in filename or sampled headers." if chemistry_match else "No recognized chemistry token found.", 0.86 if chemistry_match else 0.2),
        confidence_field("Form factor", form_match.title() if form_match else None, "Form-factor token found in filename or sampled headers." if form_match else "No recognized cell-size or form-factor token found.", 0.9 if form_match else 0.2),
        confidence_field("C-rate", ", ".join(f"{rate}C" for rate in rates) if rates else None, "C-rate token extracted from filenames or sampled headers." if rates else "A reliable C-rate requires current and nominal-capacity evidence.", 0.75 if rates else 0.3),
        confidence_field("Temperature", ", ".join(f"{temp} °C" for temp in temperatures) if temperatures else None, "Temperature token extracted from filenames or sampled headers." if temperatures else "No explicit temperature token found.", 0.82 if temperatures else 0.25),
        confidence_field("Cell count", str(cell_count) if cell_count else None, f"{cell_count} unique cell-like filename identifiers detected." if cell_count else "No stable cell-ID pattern could be counted from filenames.", 0.78 if cell_count else 0.25),
        confidence_field("Cell ID rule", "Source filename" if cell_count else None, "Repeated cell-like identifiers occur in source filenames." if cell_count else "No stable filename or header rule was established.", 0.76 if cell_count else 0.2),
        confidence_field("License", None, "License cannot be inferred safely from measurement files alone.", 0.1),
    ]
    inferred = sum(not field["pending"] for field in fields)
    role_counts = Counter(item.get("file_role", "unknown") for item in file_details)
    total_values = sum(item.get("values", 0) for item in file_details)
    missing = sum(item.get("missing", 0) for item in file_details)
    columns_lower = [column.lower() for column in columns]
    mappings = {
        "voltage_V": next((column for column in columns if "volt" in column.lower()), None),
        "current_A": next((column for column in columns if "curr" in column.lower()), None),
        "cycle_index": next((column for column in columns if "cycle" in column.lower()), None),
        "capacity_Ah": next((column for column in columns if "cap" in column.lower()), None),
        "temperature_C": next((column for column in columns if "temp" in column.lower()), None),
        "time_s": next((column for column in columns if "time" in column.lower()), None),
    }
    result = {
        "source": source_label,
        "file_count": len(file_details),
        "sampled_count": sum(bool(item.get("columns")) for item in file_details),
        "file_roles": dict(role_counts),
        "fields": fields,
        "inferred_count": inferred,
        "pending_count": len(fields) - inferred,
        "overall_confidence": round(sum(field["confidence"] for field in fields) / len(fields), 2),
        "audit": {
            "missing_percent": round((missing / total_values * 100), 2) if total_values else 0,
            "anomalies": sum(item.get("anomalies", 0) for item in file_details),
            "unit_conversions": sum(1 for column in columns_lower if any(unit in column for unit in ["mv", "ma", "mah", "kelvin"])),
            "unmapped_fields": max(0, len(set(columns)) - sum(bool(value) for value in mappings.values())),
        },
        "mappings": mappings,
        "files": file_details,
    }
    return enhance_inspection_with_ai(result)


def extract_json_object(text):
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S | re.I)
    candidate = fenced.group(1) if fenced else text
    start, end = candidate.find("{"), candidate.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("AI response did not contain a JSON object.")
    return json.loads(candidate[start:end + 1])


def fetch_source_text(url):
    parsed = parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http(s) source URLs are supported.")
    req = request.Request(url, headers={"User-Agent": "BatteryTwinMetadataAgent/1.0"})
    with request.urlopen(req, timeout=20) as response:
        content_type = response.headers.get("Content-Type", "")
        raw = response.read(2_000_000)
    text = raw.decode("utf-8", errors="replace")
    if "html" in content_type.lower() or "<html" in text[:1000].lower():
        text = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", text)
        text = re.sub(r"(?is)<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
    return text[:24000]


def metadata_not_recorded_result(url, reason, source_text=""):
    rows = []
    for field in METADATA_FIELDS:
        rows.append({
            "field": field,
            "value": url if field == "source_url" else METADATA_MISSING_VALUE,
            "evidence": reason if field != "source_url" else "User-provided source URL.",
            "confidence": 0.0 if field != "source_url" else 1.0,
            "status": "missing" if field != "source_url" else "found",
        })
    return {
        "source_url": url,
        "fields": rows,
        "source_excerpt": source_text[:1200],
        "status": "fallback",
        "message": reason,
    }


def extract_metadata_from_url(url):
    source_text = fetch_source_text(url)
    provider = os.getenv("AI_PROVIDER", "").strip().lower()
    has_ai = bool(os.getenv("GEMINI_API_KEY")) if provider == "gemini" else bool(os.getenv("AI_API_KEY") and os.getenv("AI_API_URL"))
    if not provider and os.getenv("GEMINI_API_KEY"):
        has_ai = True
    if not has_ai:
        return metadata_not_recorded_result(url, "AI is not configured; source page text was fetched but not interpreted.", source_text)
    prompt = (
        "You extract BatteryLake dataset metadata from source page text. Return strict JSON only. "
        "Use only the supplied source text. Do not infer from general knowledge. "
        f"For missing fields, value must be '{METADATA_MISSING_VALUE}'. Evidence must cite exact short text from the source page or say '{METADATA_MISSING_VALUE}'. "
        f"Fields: {', '.join(METADATA_FIELDS)}. "
        'Shape: {"fields":[{"field":"chemistry","value":"LFP","evidence":"...","confidence":0.9,"status":"found"}]}. '
        f"Source URL: {url}\nSource text:\n{source_text}"
    )
    try:
        ai_data = extract_json_object(call_ai(prompt))
        by_field = {str(item.get("field", "")).strip(): item for item in ai_data.get("fields", [])}
        rows = []
        for field in METADATA_FIELDS:
            item = by_field.get(field, {})
            value = str(item.get("value") or "").strip() or METADATA_MISSING_VALUE
            evidence = str(item.get("evidence") or "").strip() or ("User-provided source URL." if field == "source_url" else METADATA_MISSING_VALUE)
            try:
                confidence = float(item.get("confidence") or 0)
            except (TypeError, ValueError):
                confidence = 0
            rows.append({
                "field": field,
                "value": url if field == "source_url" and value == METADATA_MISSING_VALUE else value,
                "evidence": evidence,
                "confidence": min(1, max(0, confidence)),
                "status": "missing" if value == METADATA_MISSING_VALUE else "found",
            })
        return {
            "source_url": url,
            "fields": rows,
            "source_excerpt": source_text[:1200],
            "status": "ai_extracted",
            "message": "Metadata extracted from source page text.",
        }
    except Exception as exc:
        return metadata_not_recorded_result(url, f"Metadata AI extraction failed: {exc}", source_text)


def metadata_not_recorded_result(url, reason, source_text="", source_type="source"):
    rows = []
    for field in METADATA_FIELDS:
        rows.append({
            "field": field,
            "value": url if field == "source_url" else METADATA_MISSING_VALUE,
            "evidence": reason if field != "source_url" else "User-provided source URL.",
            "confidence": 0.0 if field != "source_url" else 1.0,
            "status": "missing" if field != "source_url" else "found",
            "source_type": source_type,
        })
    return {
        "source_url": url,
        "source_type": source_type,
        "fields": rows,
        "source_excerpt": source_text[:1200],
        "status": "fallback",
        "message": reason,
    }


def extract_metadata_from_url(url, source_type="source"):
    source_text = fetch_source_text(url)
    provider = os.getenv("AI_PROVIDER", "").strip().lower()
    has_ai = bool(os.getenv("GEMINI_API_KEY")) if provider == "gemini" else bool(os.getenv("AI_API_KEY") and os.getenv("AI_API_URL"))
    if not provider and os.getenv("GEMINI_API_KEY"):
        has_ai = True
    if not has_ai:
        return metadata_not_recorded_result(url, "AI is not configured; page text was fetched but not interpreted.", source_text, source_type)
    prompt = (
        f"You extract BatteryLake dataset metadata from a dataset {source_type} page. Return strict JSON only. "
        "Use only the supplied page text. Do not infer from general knowledge. "
        f"For missing fields, value must be '{METADATA_MISSING_VALUE}'. "
        f"Evidence must cite exact short text from the page or say '{METADATA_MISSING_VALUE}'. "
        f"Fields: {', '.join(METADATA_FIELDS)}. "
        'Shape: {"fields":[{"field":"chemistry","value":"LFP","evidence":"...","confidence":0.9,"status":"found"}]}. '
        f"URL: {url}\nPage text:\n{source_text}"
    )
    try:
        ai_data = extract_json_object(call_ai(prompt))
        by_field = {str(item.get("field", "")).strip(): item for item in ai_data.get("fields", [])}
        rows = []
        for field in METADATA_FIELDS:
            item = by_field.get(field, {})
            value = str(item.get("value") or "").strip() or METADATA_MISSING_VALUE
            evidence = str(item.get("evidence") or "").strip() or ("User-provided URL." if field == "source_url" else METADATA_MISSING_VALUE)
            try:
                confidence = float(item.get("confidence") or 0)
            except (TypeError, ValueError):
                confidence = 0
            rows.append({
                "field": field,
                "value": url if field == "source_url" and value == METADATA_MISSING_VALUE else value,
                "evidence": evidence,
                "confidence": min(1, max(0, confidence)),
                "status": "missing" if value == METADATA_MISSING_VALUE else "found",
                "source_type": source_type,
            })
        return {
            "source_url": url,
            "source_type": source_type,
            "fields": rows,
            "source_excerpt": source_text[:1200],
            "status": "ai_extracted",
            "message": f"Metadata extracted from {source_type} page text.",
        }
    except Exception as exc:
        return metadata_not_recorded_result(url, f"Metadata AI extraction failed: {exc}", source_text, source_type)


def enhance_inspection_with_ai(result):
    provider = os.getenv("AI_PROVIDER", "").strip().lower()
    has_ai = bool(os.getenv("GEMINI_API_KEY")) if provider == "gemini" else bool(os.getenv("AI_API_KEY") and os.getenv("AI_API_URL"))
    if not provider and os.getenv("GEMINI_API_KEY"):
        has_ai = True
    if not has_ai:
        result["ai_status"] = {"used": False, "reason": "App AI is not configured; local structural inspection was used."}
        return result

    compact_files = [{
        "filename": item["filename"],
        "format": item["suffix"],
        "columns": item.get("columns", [])[:80],
        "sample_rows": item.get("sample_rows", [])[:3],
        "json_keys": item.get("json_keys", [])[:80],
        "json_scalars": item.get("json_scalars", [])[:12],
        "read_error": item.get("read_error"),
    } for item in result["files"][:8]]
    allowed_evidence_tokens = {
        str(item.get("filename", "")).lower()
        for item in result["files"]
        if item.get("filename")
    }
    for item in result["files"]:
        allowed_evidence_tokens.update(str(column).lower() for column in item.get("columns", [])[:80])
        allowed_evidence_tokens.update(str(key).lower() for key in item.get("json_keys", [])[:80])
    prompt = (
        "Inspect this battery dataset evidence and return strict JSON only. "
        "Do not guess. For each supported field return value, evidence, confidence from 0 to 1; use null when unsupported. "
        "Fields: Dataset type, Year, Source / lab, Chemistry, Form factor, C-rate, Temperature, Cell count, Cell ID rule, License. "
        "Dataset type must be one of Cycle aging, Calendar aging, Characterization test, Thermal abuse, or null. "
        "Evidence must cite a filename, header, or sample value from the supplied evidence. "
        'Shape: {"fields":[{"name":"Chemistry","value":"LFP","evidence":"...","confidence":0.9}]}. '
        f"Evidence: {json.dumps(compact_files, ensure_ascii=False, default=str)}"
    )
    try:
        ai_data = extract_json_object(call_ai(prompt))
        local_by_name = {field["name"]: field for field in result["fields"]}
        accepted = 0
        for ai_field in ai_data.get("fields", []):
            name = str(ai_field.get("name", "")).strip()
            value = ai_field.get("value")
            evidence = str(ai_field.get("evidence", "")).strip()
            try:
                confidence = float(ai_field.get("confidence") or 0)
            except (TypeError, ValueError):
                confidence = 0
            if name not in local_by_name or not value or not evidence or confidence < 0.45:
                continue
            evidence_lower = evidence.lower()
            if allowed_evidence_tokens and not any(token and token in evidence_lower for token in allowed_evidence_tokens):
                continue
            local = local_by_name[name]
            if local["pending"] or confidence > local["confidence"]:
                local.update(value=str(value), evidence=f"AI: {evidence}", confidence=min(1, max(0, confidence)), pending=False)
                accepted += 1
        result["inferred_count"] = sum(not field["pending"] for field in result["fields"])
        result["pending_count"] = len(result["fields"]) - result["inferred_count"]
        result["overall_confidence"] = round(sum(field["confidence"] for field in result["fields"]) / len(result["fields"]), 2)
        result["ai_status"] = {"used": True, "accepted_fields": accepted, "reason": "App AI reviewed filenames, headers and limited sample rows."}
    except Exception as exc:
        result["ai_status"] = {"used": False, "reason": f"AI enhancement failed; local inspection retained: {exc}"}
    return result


class BatteryTwinHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_GET(self):
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 100 * 1024 * 1024:
                self.send_json({"error": "Upload exceeds the 100 MB inspection limit."}, status=413)
                return
            raw_body = self.rfile.read(length)

            if self.path == "/api/chat":
                payload = json.loads(raw_body.decode("utf-8") or "{}")
                message = str(payload.get("message", "")).strip()
                if not message:
                    self.send_json({"reply": "Please enter a question."}, status=400)
                    return
                self.send_json({"reply": call_ai(message)})
                return

            if self.path == "/api/metadata-extract":
                payload = json.loads(raw_body.decode("utf-8") or "{}")
                url = str(payload.get("url", "")).strip()
                source_type = str(payload.get("source_type", "source")).strip() or "source"
                if not url:
                    self.send_json({"error": "Missing source URL."}, status=400)
                    return
                self.send_json(extract_metadata_from_url(url, source_type))
                return

            if self.path == "/api/inspect":
                content_type = self.headers.get("Content-Type", "")
                message = BytesParser(policy=default).parsebytes(
                    f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + raw_body
                )
                files = []
                for part in message.iter_parts():
                    filename = part.get_filename()
                    if not filename:
                        continue
                    content = part.get_payload(decode=True) or b""
                    files.append(inspect_file(Path(filename).name, content=content))
                if not files:
                    self.send_json({"error": "No files were received."}, status=400)
                    return
                self.send_json(infer_inspection(files, "uploaded files"))
                return

            if self.path == "/api/inspect-path":
                payload = json.loads(raw_body.decode("utf-8") or "{}")
                requested = Path(str(payload.get("path", "")).strip()).expanduser()
                if not requested.exists():
                    self.send_json({"error": f"Path does not exist: {requested}"}, status=404)
                    return
                candidates = [requested] if requested.is_file() else [
                    path for path in requested.rglob("*")
                    if path.is_file()
                ]
                candidates = candidates[:50]
                if not candidates:
                    self.send_json({"error": "No files were found at this path."}, status=400)
                    return
                files = [inspect_file(path.name, path=path) for path in candidates]
                self.send_json(infer_inspection(files, str(requested.resolve())))
                return

            self.send_error(404, "Not found")
        except Exception as exc:
            self.send_json({"error": f"Inspection backend error: {exc}"}, status=500)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    mimetypes.add_type("text/html; charset=utf-8", ".html")
    server = ThreadingHTTPServer((HOST, PORT), BatteryTwinHandler)
    print(f"BatteryTwin AI server running at http://{HOST}:{PORT}/")
    server.serve_forever()
