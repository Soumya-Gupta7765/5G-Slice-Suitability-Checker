"""
Requirement document parsing for the 5G Slice Advisor
=====================================================
Reads .txt / .md / .pdf requirement documents and turns them into the six
model parameters. Every value carries a confidence score and evidence so the
UI can autofill what is clear and ask the user about everything else.
"""

from __future__ import annotations

import io
import json
import re
from pathlib import Path
from typing import Any, Optional

SAMPLES_DIR = Path(__file__).resolve().parent / "samples"
SUPPORTED_EXTENSIONS = {".txt", ".md", ".markdown", ".pdf"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

# A value is autofilled at or above this confidence, and flagged for review
# below CONFIDENT_THRESHOLD.
AUTOFILL_THRESHOLD = 0.5
CONFIDENT_THRESHOLD = 0.7

NUMERIC_FIELDS = [
    "throughput_mbps",
    "latency_ms",
    "reliability_percent",
    "active_connections",
    "bandwidth_allocated_mhz",
]
FIELDS = ["use_case", *NUMERIC_FIELDS]

FIELD_LABELS = {
    "use_case": "use case",
    "throughput_mbps": "throughput",
    "latency_ms": "latency",
    "reliability_percent": "reliability",
    "active_connections": "active connections",
    "bandwidth_allocated_mhz": "bandwidth",
}

FIELD_UNITS = {
    "throughput_mbps": "Mbps",
    "latency_ms": "ms",
    "reliability_percent": "%",
    "active_connections": "connections",
    "bandwidth_allocated_mhz": "MHz",
}

# ── Text input ────────────────────────────────────────────────────────────────
def extract_text(filename: str, data: bytes) -> str:
    """Return the plain text of an uploaded .txt/.md/.pdf file."""
    suffix = Path(filename or "").suffix.lower()

    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise ValueError("PDF support is not installed on the server. Run: pip install pypdf") from exc

        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:
            raise ValueError(f"Could not read that PDF ({exc}). Try exporting it as text.") from exc

        text = text.strip()
        if not text:
            raise ValueError(
                "That PDF has no selectable text (it may be a scan). Upload a text-based PDF or paste the requirements instead."
            )
        return text

    if suffix in SUPPORTED_EXTENSIONS:
        for encoding in ("utf-8-sig", "utf-16", "latin-1"):
            try:
                return data.decode(encoding).strip()
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode that file as text.")

    raise ValueError("Unsupported file type. Upload a .txt, .md or .pdf file.")


# ── Extractors ────────────────────────────────────────────────────────────────
def blank_fields() -> dict[str, dict[str, Any]]:
    return {
        name: {"value": None, "confidence": 0.0, "evidence": "", "note": "", "suggestion": None}
        for name in FIELDS
    }


def _field(value=None, confidence: float = 0.0, evidence: str = "", note: str = "", suggestion=None):
    return {
        "value": value,
        "confidence": round(max(0.0, min(1.0, confidence)), 2),
        "evidence": evidence.strip()[:300],
        "note": note,
        "suggestion": suggestion if suggestion is not None else value,
    }


def _find(pattern: str, text: str) -> tuple[Optional[float], str]:
    match = re.search(pattern, text, re.I)
    if not match:
        return None, ""
    try:
        return float(match.group(1).replace(",", "")), match.group(0).strip()
    except (TypeError, ValueError):
        return None, ""


USE_CASE_KEYWORDS: dict[str, list[tuple[str, int]]] = {
    "4k_video": [("4k", 2), ("uhd", 2), ("ultra hd", 2), ("2160p", 2), ("8k", 1)],
    "video_streaming": [
        ("video streaming", 2), ("video-on-demand", 2), ("video on demand", 2),
        ("streaming", 1), ("vod", 2), ("netflix", 2), ("youtube", 2), ("ott", 2),
        ("live video", 1), ("broadcast", 1),
    ],
    "cloud_gaming": [
        ("cloud gaming", 3), ("gaming", 2), ("game streaming", 2), ("playstation", 2),
        ("xbox", 2), ("geforce now", 3), ("game", 1),
    ],
    "ar_vr": [
        ("virtual reality", 3), ("augmented reality", 3), ("headset", 2), ("vr", 2),
        ("ar ", 1), ("xr", 2), ("mixed reality", 3),
    ],
    "remote_surgery": [
        ("remote surgery", 3), ("surgery", 2), ("surgical", 2), ("hospital", 2),
        ("patient", 1), ("telemedicine", 2), ("medical", 1), ("ambulance", 2),
    ],
    "autonomous_vehicles": [
        ("autonomous", 2), ("self-driving", 3), ("driverless", 3), ("haulage", 2),
        ("vehicle", 1), ("drone", 2), ("lidar", 2), ("platoon", 2), ("truck", 1),
    ],
    "industrial_automation": [
        ("industrial automation", 3), ("factory", 2), ("robot", 2), ("robotic", 2),
        ("assembly line", 2), ("plc", 2), ("scada", 2), ("cobot", 2), ("automation", 1),
    ],
    "smart_grid": [
        ("smart grid", 3), ("substation", 2), ("power grid", 3), ("solar", 1),
        ("energy", 1), ("utility", 1), ("electricity", 1),
    ],
    "smart_city": [
        ("smart city", 3), ("street light", 2), ("traffic light", 2), ("parking", 2),
        ("surveillance", 2), ("camera network", 2), ("municipal", 1),
    ],
    "agriculture": [
        ("agriculture", 3), ("farm", 2), ("farming", 2), ("crop", 2), ("soil", 2),
        ("irrigation", 2), ("livestock", 2), ("harvest", 1),
    ],
    "environmental_monitoring": [
        ("environmental", 2), ("environment", 1), ("pollution", 2), ("air quality", 2),
        ("water quality", 2), ("weather", 1), ("climate", 1), ("emissions", 1),
    ],
    "iot_sensors": [
        ("iot", 3), ("sensor", 2), ("smart meter", 3), ("metering", 2), ("telemetry", 2),
        ("monitoring", 1), ("meter", 1), ("sensor grid", 3),
    ],
}

# Media workloads that are easy to confuse (e.g. a document about 4K films and
# cloud gaming). When more than one of them is clearly present we ask instead
# of silently picking one.
MEDIA_USE_CASES = {"4k_video", "video_streaming", "cloud_gaming", "ar_vr"}


def _score_use_cases(lower: str) -> dict[str, int]:
    scores: dict[str, int] = {}
    for use_case, keywords in USE_CASE_KEYWORDS.items():
        hits = 0
        for keyword, weight in keywords:
            pattern = r"\b" + re.escape(keyword.strip()) + r"\b"
            if re.search(pattern, lower):
                hits += weight
        if hits:
            scores[use_case] = hits
    return scores


def heuristic_extract(text: str) -> dict[str, Any]:
    """Rule-based extraction. Never fills a field the document does not support."""
    fields = blank_fields()
    lower = text.lower()

    # Latency ---------------------------------------------------------------
    value, evidence = _find(r"(\d+(?:\.\d+)?)\s*(?:ms|milliseconds?)\b", text)
    if value is None:
        value, evidence = _find(r"(\d+(?:\.\d+)?)\s*(?:µs|us|microseconds?)\b", text)
        if value is not None:
            value = round(value / 1000, 3)
    if value is not None:
        fields["latency_ms"] = _field(value, 0.9, evidence, "Explicit latency value found in the document.")
    elif re.search(r"\b(ultra[- ]low[- ]latency|low[- ]latency|sub-?\d+\s*ms|real[- ]time)\b", lower):
        fields["latency_ms"] = _field(
            10.0, 0.55, "", "Inferred 10 ms from a 'low latency' requirement — confirm this target.", 10.0
        )
    elif re.search(r"\b(delay[- ]tolerant|not latency[- ]sensitive)\b", lower):
        fields["latency_ms"] = _field(
            100.0, 0.45, "", "The document suggests latency is not critical — confirm a relaxed target.", 100.0
        )

    # Reliability -----------------------------------------------------------
    match = re.search(
        r"(?:reliab\w*|uptime|availability|up-time)[^.\n%]{0,40}?(\d{2}(?:\.\d+)?)\s*%", text, re.I
    ) or re.search(
        r"(\d{2}(?:\.\d+)?)\s*%\s*(?:reliab\w*|uptime|availability)", text, re.I
    )
    evidence = ""
    if match:
        value = float(match.group(1))
        evidence = match.group(0).strip()
        confidence = 0.92
    else:
        value, evidence = _find(r"\b(\d{2}(?:\.\d+)?)\s*%", text)
        confidence = 0.6
        if value is not None:
            evidence = f"{evidence} — confirm this percentage is the reliability target"
        else:
            nines = re.search(r"\b(five|four|three)\s+nines?\b", lower)
            if nines:
                value = {"three": 99.9, "four": 99.99, "five": 99.999}[nines.group(1)]
                evidence = nines.group(0)
                confidence = 0.9
            elif "ultra-reliable" in lower or "ultra reliable" in lower:
                value, confidence = 99.999, 0.55
                evidence = "inferred from 'ultra-reliable'"
            elif "high reliability" in lower or "highly reliable" in lower:
                value, confidence = 99.9, 0.5
                evidence = "inferred from 'high reliability'"
    if value is not None:
        fields["reliability_percent"] = _field(
            round(min(100.0, max(0.0, value)), 3),
            confidence,
            evidence,
            "Reliability target read from the document.",
        )

    # Throughput ------------------------------------------------------------
    value, evidence = _find(r"(\d+(?:\.\d+)?)\s*(?:gbps|gb/s|gbit/s|gigabits?)", text)
    if value is not None:
        fields["throughput_mbps"] = _field(round(value * 1000, 2), 0.9, evidence, "Throughput converted from Gbps.")
    else:
        value, evidence = _find(r"(\d+(?:\.\d+)?)\s*(?:mbps|mb/s|mbit/s|megabits?)", text)
        if value is not None:
            fields["throughput_mbps"] = _field(value, 0.9, evidence, "Explicit throughput value found in the document.")
        else:
            value, evidence = _find(r"(\d+(?:\.\d+)?)\s*(?:kbps|kb/s|kbit/s|kilobits?)", text)
            if value is not None:
                fields["throughput_mbps"] = _field(round(value / 1000, 3), 0.85, evidence, "Throughput converted from Kbps.")
            elif "gigabit" in lower or "multi-gigabit" in lower:
                fields["throughput_mbps"] = _field(
                    1000.0, 0.6, "gigabit", "Inferred 1000 Mbps from 'gigabit' — confirm the target."
                )
            elif re.search(r"\b8k\b", lower):
                fields["throughput_mbps"] = _field(
                    100.0, 0.45, "8K", "Typical 8K stream is ~100 Mbps — confirm before using.", 100.0
                )
            elif re.search(r"\b4k\b", lower) or "ultra hd" in lower:
                fields["throughput_mbps"] = _field(
                    25.0, 0.45, "4K", "Typical 4K stream is ~25 Mbps — confirm before using.", 25.0
                )
            elif "1080p" in lower or "full hd" in lower:
                fields["throughput_mbps"] = _field(
                    8.0, 0.45, "1080p", "Typical 1080p stream is ~8 Mbps — confirm before using.", 8.0
                )

    # Active connections ----------------------------------------------------
    match = re.search(
        r"(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|million|mn|m)?\s*"
        r"(?:concurrent\s+|active\s+|simultaneous\s+|connected\s+)?"
        r"(?:connections|devices|sensors|meters|users|nodes|vehicles|endpoints|subscribers|"
        r"machines|units|households|homes|sessions|players|customers|terminals)\b",
        text,
        re.I,
    )
    if match:
        raw, unit = match.group(1), (match.group(2) or "").lower()
        try:
            count = float(raw.replace(",", ""))
        except ValueError:
            count = 0.0
        if unit in ("k", "thousand"):
            count *= 1_000
        elif unit in ("million", "mn", "m"):
            count *= 1_000_000
        if count >= 1:
            fields["active_connections"] = _field(
                int(round(count)), 0.9, match.group(0).strip(), "Connection count read from the document."
            )
    else:
        for phrase, suggestion, confidence in (
            ("massive machine", 10_000, 0.4),
            ("massive iot", 10_000, 0.4),
            ("thousands of", 5_000, 0.35),
        ):
            if phrase in lower:
                fields["active_connections"] = _field(
                    suggestion, confidence, phrase,
                    f"'{phrase}' suggests a large device fleet (~{suggestion:,}) — confirm or enter the real count.",
                    suggestion,
                )
                break

    # Bandwidth allocated ---------------------------------------------------
    value, evidence = _find(r"(\d+(?:\.\d+)?)\s*mhz", text)
    if value is not None:
        fields["bandwidth_allocated_mhz"] = _field(round(value, 2), 0.9, evidence, "Bandwidth found in the document.")
    else:
        value, evidence = _find(r"(\d+(?:\.\d+)?)\s*ghz", text)
        if value is not None:
            fields["bandwidth_allocated_mhz"] = _field(
                round(value * 1000, 2), 0.85, evidence, "Bandwidth converted from GHz."
            )

    # Use case --------------------------------------------------------------
    scores = _score_use_cases(lower)
    ambiguous_use_cases: list[str] = []
    if scores:
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        top_use_case, top_score = ranked[0]
        ties = [name for name, score in ranked if score == top_score]
        media_matches = [name for name, score in ranked if name in MEDIA_USE_CASES and score >= 2]
        if len(media_matches) > 1:
            ambiguous_use_cases = media_matches
            fields["use_case"] = _field(
                None, 0.35, ", ".join(media_matches),
                "The document mixes more than one media workload — choose the primary one.",
                media_matches[0],
            )
        elif len(ties) > 1:
            ambiguous_use_cases = ties
            fields["use_case"] = _field(
                None, 0.35, ", ".join(ties),
                "The document mentions more than one equally plausible use case — pick the primary one.",
                ties[0],
            )
        elif top_score >= 2:
            fields["use_case"] = _field(top_use_case, 0.8, f"keyword score {top_score}", "Matched from the document wording.")
        else:
            fields["use_case"] = _field(
                top_use_case, 0.55, f"keyword score {top_score}",
                "Only a weak keyword match was found — confirm the use case."
            )

    # App name / description ------------------------------------------------
    lines = [line.strip(" #*-") for line in text.splitlines() if line.strip()]
    app_name = lines[0][:80] if lines else "Requirements document"
    if len(app_name) > 60:
        app_name = app_name[:57].rstrip() + "…"
    app_description = re.sub(r"\s+", " ", lines[0] if lines else text)[:200]

    return {
        "fields": fields,
        "app_name": app_name,
        "app_description": app_description,
        "ambiguous_use_cases": ambiguous_use_cases,
    }


def build_llm_prompt(text: str, use_case_values: list[str]) -> str:
    shape = {
        "app_name": "short title",
        "app_description": "one sentence summary",
        "fields": {
            name: {"value": None, "confidence": 0.0, "evidence": "exact quote from the document", "note": "why"}
            for name in FIELDS
        },
        "ambiguous": [
            {
                "field": "use_case",
                "question": "one clear question for the user",
                "options": [{"label": "human label", "value": "candidate value"}],
            }
        ],
    }
    return f"""You extract 5G network slice requirements from a document.

Return ONLY valid JSON, no markdown fences, matching this shape:
{json.dumps(shape, indent=2)}

Rules:
1. Use ONLY information in the document. Every "evidence" string must be copied from the document (or "").
2. use_case must be one of: {", ".join(use_case_values)} — otherwise null.
3. Units: throughput_mbps in Mbps, latency_ms in ms, reliability_percent as 0-100, active_connections as an integer, bandwidth_allocated_mhz in MHz. Convert Gbps/Kbps/µs/GHz when present.
4. You MAY infer a conventional engineering target when the document clearly implies it, e.g. "low latency" -> 10 ms, "4K video" -> 25 Mbps. For such inferences use confidence 0.5-0.65, quote the implication in evidence and explain it in note.
5. If the document does not state or clearly imply a value, set value to null and confidence 0. NEVER invent a number just to fill a field.
6. If two use cases are genuinely plausible (for example the document mentions both 4K video and cloud gaming), set use_case value to null, confidence below 0.5, and add an entry to "ambiguous" with a question and both options.
7. Add an "ambiguous" question for any field you inferred with confidence below 0.6.
8. Report the document's numbers even when they fall outside typical ranges.

DOCUMENT:
\"\"\"
{text[:12000]}
\"\"\"
"""


def parse_llm_output(raw: str, use_case_values: list[str]) -> Optional[dict[str, Any]]:
    """Parse a (possibly messy) LLM JSON reply into the extraction structure."""
    match = re.search(r"\{[\s\S]*\}", raw or "")
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None

    fields = blank_fields()
    raw_fields = data.get("fields") if isinstance(data.get("fields"), dict) else {}

    for name in FIELDS:
        entry = raw_fields.get(name, data.get(name))
        if entry is None:
            continue
        if isinstance(entry, dict):
            value = entry.get("value")
            confidence = entry.get("confidence", 0.6)
            evidence = entry.get("evidence", "") or ""
            note = entry.get("note", "") or ""
        else:
            value, confidence, evidence, note = entry, 0.6, "", ""
        try:
            confidence = float(confidence or 0)
        except (TypeError, ValueError):
            confidence = 0.0

        if name == "use_case":
            if isinstance(value, str):
                cleaned = value.strip().lower().replace(" ", "_").replace("-", "_")
                if cleaned in use_case_values:
                    fields[name] = _field(cleaned, confidence, str(evidence), str(note))
                else:
                    fields[name] = _field(None, min(confidence, 0.4), str(evidence), "The model returned an unknown use case.")
            continue

        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if name in ("active_connections", "bandwidth_allocated_mhz"):
            number = int(round(number))
        if name == "reliability_percent":
            number = min(100.0, max(0.0, number))
        if number < 0:
            continue
        fields[name] = _field(number, confidence, str(evidence), str(note))

    ambiguous = []
    for item in data.get("ambiguous", []) if isinstance(data.get("ambiguous"), list) else []:
        if not isinstance(item, dict) or item.get("field") not in FIELDS:
            continue
        options = []
        for option in item.get("options", []) if isinstance(item.get("options"), list) else []:
            if isinstance(option, dict) and option.get("value") is not None:
                options.append({"label": str(option.get("label") or option.get("value")), "value": option.get("value")})
            elif option is not None:
                options.append({"label": str(option), "value": option})
        ambiguous.append({
            "field": item["field"],
            "question": str(item.get("question") or "Please confirm this value."),
            "options": options,
        })

    return {
        "fields": fields,
        "app_name": str(data.get("app_name") or "").strip(),
        "app_description": str(data.get("app_description") or "").strip(),
        "ambiguous": ambiguous,
    }


def _labels_for(field: str, values: list[str]) -> list[dict[str, Any]]:
    if field == "use_case":
        return [{"label": v.replace("_", " "), "value": v} for v in values]
    return []


def merge_extractions(
    llm: Optional[dict[str, Any]],
    heuristic: dict[str, Any],
    use_case_values: list[str],
) -> dict[str, Any]:
    """Combine LLM + rule-based results, keeping only values we trust enough."""
    llm_fields = (llm or {}).get("fields", {})
    heuristic_fields = heuristic["fields"]
    fields: dict[str, dict[str, Any]] = {}
    ambiguous: list[dict[str, Any]] = []

    llm_ambiguous_fields = {
        item["field"] for item in (llm or {}).get("ambiguous", []) if isinstance(item, dict)
    }

    for name in FIELDS:
        candidates = [
            entry
            for entry in (llm_fields.get(name), heuristic_fields.get(name))
            if entry and entry.get("value") is not None
        ]
        chosen = max(candidates, key=lambda item: item.get("confidence", 0)) if candidates else None

        if chosen is None:
            fields[name] = _field()
        else:
            fields[name] = dict(chosen)
            if name in llm_ambiguous_fields:
                # The LLM explicitly flagged this field as ambiguous: ask the
                # user rather than trusting the heuristic's best guess.
                fields[name]["suggestion"] = chosen["value"]
                fields[name]["value"] = None
                fields[name]["confidence"] = min(fields[name]["confidence"], 0.45)
            if fields[name]["confidence"] < AUTOFILL_THRESHOLD:
                # Keep the guess as a suggestion, but leave the input empty so the
                # model never runs on an assumption the user did not confirm.
                fields[name]["suggestion"] = chosen["value"]
                fields[name]["value"] = None

    # Ambiguity questions from the LLM
    for item in (llm or {}).get("ambiguous", []):
        if item["field"] in FIELDS:
            ambiguous.append(item)

    # Low-confidence values we would otherwise leave empty
    for name in FIELDS:
        entry = fields[name]
        if entry["value"] is not None:
            continue
        if any(item["field"] == name for item in ambiguous):
            continue
        if name == "use_case":
            suggestions = heuristic.get("ambiguous_use_cases") or ([entry["suggestion"]] if entry["suggestion"] else [])
            if len(suggestions) > 0:
                ambiguous.append({
                    "field": "use_case",
                    "question": entry.get("note") or "Which use case best matches your application?",
                    "options": _labels_for("use_case", [s for s in suggestions if s in use_case_values]),
                })
            continue
        if entry.get("suggestion") is not None:
            suggestion = entry["suggestion"]
            label = f"{suggestion:g}" if isinstance(suggestion, float) else str(suggestion)
            unit = FIELD_UNITS.get(name, "")
            ambiguous.append({
                "field": name,
                "question": f"{entry.get('note') or 'Is this value right?'} (suggested: {label} {unit})",
                "options": [
                    {"label": f"Use {label} {unit}".strip(), "value": suggestion},
                    {"label": "Leave unset", "value": None},
                ],
            })

    # Ambiguity: a field the LLM could not fill but which has candidates
    for item in ambiguous:
        if item["field"] == "use_case" and not item["options"]:
            item["options"] = _labels_for("use_case", use_case_values[:6])

    filled = {name: entry for name, entry in fields.items() if entry["value"] is not None}
    missing_fields = [name for name in FIELDS if fields[name]["value"] is None]

    return {
        "fields": fields,
        "extracted": {name: entry["value"] for name, entry in filled.items()},
        "ambiguous": ambiguous,
        "missing_fields": missing_fields,
        "app_name": (llm or {}).get("app_name") or heuristic.get("app_name") or "Requirements document",
        "app_description": (llm or {}).get("app_description") or heuristic.get("app_description") or "",
        "suggestions": {name: entry.get("suggestion") for name, entry in fields.items() if entry.get("suggestion") is not None},
    }


def text_preview(text: str, limit: int = 700) -> str:
    cleaned = re.sub(r"\n{3,}", "\n\n", text.strip())
    return cleaned if len(cleaned) <= limit else cleaned[:limit].rstrip() + "…"


def list_samples() -> list[dict[str, str]]:
    """Return metadata for the bundled example requirement documents."""
    manifest = [
        {
            "id": "cloud_gaming",
            "filename": "cloud_gaming_4k.md",
            "title": "4K cloud gaming",
            "description": "Ambiguous document that mentions both 4K video and cloud gaming.",
        },
        {
            "id": "smart_metering",
            "filename": "smart_metering.pdf",
            "title": "Smart metering rollout (PDF)",
            "description": "Sparse PDF with several missing parameters to test follow-up prompts.",
        },
    ]
    return [item for item in manifest if (SAMPLES_DIR / item["filename"]).exists()]


def read_sample(sample_id: str) -> Optional[dict[str, Any]]:
    for sample in list_samples():
        if sample["id"] != sample_id:
            continue
        path = SAMPLES_DIR / sample["filename"]
        data = path.read_bytes()
        return {
            **sample,
            "text": extract_text(sample["filename"], data),
            "download_url": f"/api/sample-requirements/{sample_id}/download",
        }
    return None
