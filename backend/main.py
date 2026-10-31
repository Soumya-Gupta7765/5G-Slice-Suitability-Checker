"""
5G Slice Advisor — FastAPI Backend
===================================
Serves the trained Random Forest model for 5G slice prediction,
integrates with Qualcomm Cloud AI for NLP extraction and explanation.
"""

import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import json
import traceback
from pathlib import Path
from typing import Optional

import httpx
import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import requirements_extractor as rq

load_dotenv()

# ── App Setup ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="5G Slice Advisor API",
    version="1.0.0",
    description="AI-assisted 5G network slice recommendations",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model Loading ─────────────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).resolve().parent / "model_artifacts"

pipeline = None
label_encoder = None
metrics = None


def normalize_slice_name(name: str) -> str:
    n = str(name).strip().upper()
    if n == "EMBB":
        return "eMBB"
    elif n == "URLLC":
        return "URLLC"
    elif n == "MMTC":
        return "mMTC"
    return name


def load_model():
    global pipeline, label_encoder, metrics
    pipeline_path = MODEL_DIR / "pipeline.joblib"
    encoder_path = MODEL_DIR / "label_encoder.joblib"
    metrics_path = MODEL_DIR / "metrics.json"

    if pipeline_path.exists() and encoder_path.exists():
        pipeline = joblib.load(pipeline_path)
        label_encoder = joblib.load(encoder_path)
        print("✓ Model loaded successfully")
    else:
        print("⚠ Model artifacts not found. Run train_model.py first.")

    if metrics_path.exists():
        with open(metrics_path) as f:
            metrics = json.load(f)
        print("✓ Metrics loaded successfully")
    else:
        print("⚠ Metrics file not found.")


# Load immediately on module initialization
load_model()


@app.on_event("startup")
async def startup():
    if pipeline is None:
        load_model()


# ── Schemas ────────────────────────────────────────────────────────────────────
class PredictionRequest(BaseModel):
    use_case: Optional[str] = Field(
        None,
        description="Application use case category. Omit or pass 'none' to predict from the other parameters only.",
    )
    throughput_mbps: float = Field(..., ge=0, description="Required throughput in Mbps")
    latency_ms: float = Field(..., ge=0, description="Required latency in milliseconds")
    reliability_percent: float = Field(..., ge=0, le=100, description="Reliability target (%)")
    active_connections: int = Field(..., ge=0, description="Number of active connections")
    bandwidth_allocated_mhz: int = Field(..., ge=0, description="Bandwidth allocated in MHz")
    app_name: Optional[str] = Field(None, description="Application name for explanation context")
    app_description: Optional[str] = Field(None, description="Application description for explanation context")


class NLPExtractionRequest(BaseModel):
    description: str = Field(..., min_length=10, description="Natural language description of the application")


class ExplanationRequest(BaseModel):
    predicted_slice: str
    class_probabilities: dict
    feature_values: dict
    feature_importance: dict
    app_name: Optional[str] = None
    app_description: Optional[str] = None


class WhatIfRequest(BaseModel):
    original: PredictionRequest
    modified: PredictionRequest


class SetApiKeyRequest(BaseModel):
    api_key: str


# ── LLM Integration ───────────────────────────────────────────────────────────
QUALCOMM_API_KEY = os.getenv("QUALCOMM_API_KEY", "")
QUALCOMM_API_URL = os.getenv(
    "QUALCOMM_API_URL",
    "https://aisuite.cirrascale.com/apis/v2/chat/completions"
)
QUALCOMM_MODEL = os.getenv("QUALCOMM_MODEL", "Llama-3.1-8B")


def get_llm_config():
    load_dotenv(override=True)
    api_key = os.getenv("QUALCOMM_API_KEY", "") or QUALCOMM_API_KEY
    api_url = os.getenv("QUALCOMM_API_URL", "https://aisuite.cirrascale.com/apis/v2/chat/completions")
    if api_url.rstrip("/").endswith("/apis/v2"):
        api_url = f"{api_url.rstrip('/')}/chat/completions"
    model = os.getenv("QUALCOMM_MODEL", "Llama-3.1-8B")
    if "bge" in model.lower():
        model = "Llama-3.1-8B"
    return api_key, api_url, model


async def call_qualcomm_llm(messages: list[dict], temperature: float = 0.3) -> Optional[str]:
    """Call Qualcomm Cloud AI / Cirrascale for LLM inference."""
    api_key, api_url, model = get_llm_config()
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 1024,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"LLM call failed ({api_url}, {model}): {e}")
        return None


# Use case values that mean "leave the use case out of the prediction".
NO_USE_CASE_VALUES = {"", "none", "none_of_these", "none of these", "__none__", "not_applicable", "n/a"}


def has_use_case(value: Optional[str]) -> bool:
    return bool(value) and str(value).strip().lower() not in NO_USE_CASE_VALUES


def predict_distribution(numeric: dict, use_case: Optional[str]):
    """Predict without a use case by averaging over every use case in training.

    This keeps the model intact while genuinely dropping the use case from the
    request, instead of substituting an arbitrary category.
    """
    if pipeline is None or label_encoder is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")

    if has_use_case(use_case):
        frame = pd.DataFrame([{**numeric, "use_case": use_case}])
        probabilities_array = pipeline.predict_proba(frame)[0]
    else:
        options = (metrics or {}).get("use_case_values", [])
        if not options:
            raise HTTPException(
                status_code=400,
                detail="No use case was supplied and the model has no use case list to average over.",
            )
        frame = pd.DataFrame([{**numeric, "use_case": uc} for uc in options])
        probabilities_array = pipeline.predict_proba(frame).mean(axis=0)

    class_names = [normalize_slice_name(cls) for cls in label_encoder.classes_]
    probabilities = {
        cls: round(float(p), 4) for cls, p in zip(class_names, probabilities_array)
    }
    predicted_slice = class_names[int(np.argmax(probabilities_array))]
    return predicted_slice, probabilities


def assess_feasibility(feature_values: dict) -> tuple[float, list[str]]:
    """Heuristic "none of these" risk for a requirement profile.

    This is NOT a model class. It flags combinations that no single 3GPP slice
    profile can serve well (and inputs far outside the training distribution),
    which a classifier trained on synthetic labels will happily classify anyway.
    """
    reasons: list[str] = []
    score = 0.0

    throughput = float(feature_values["throughput_mbps"])
    latency = float(feature_values["latency_ms"])
    reliability = float(feature_values["reliability_percent"])
    connections = float(feature_values["active_connections"])
    bandwidth = float(feature_values["bandwidth_allocated_mhz"])

    if latency <= 10 and throughput >= 500:
        score += 0.35
        reasons.append(
            f"≤{latency:g} ms latency together with {throughput:,.0f} Mbps is hard to hold on one slice: "
            "URLLC targets latency, eMBB targets throughput."
        )
    if latency <= 10 and connections >= 10_000:
        score += 0.3
        reasons.append(
            f"{connections:,.0f} concurrent connections at ≤{latency:g} ms exceeds a typical mMTC density/latency profile."
        )
    if reliability >= 99.999 and throughput >= 1_000:
        score += 0.2
        reasons.append(
            f"{reliability:g}% reliability with {throughput:,.0f} Mbps is beyond standard URLLC/eMBB envelope values."
        )
    if throughput >= 1_000 and connections >= 100_000:
        score += 0.25
        reasons.append(
            "Very high throughput for a very large device fleet is a capacity profile operators usually split across slices."
        )
    if latency <= 1 or bandwidth >= 400:
        score += 0.15
        reasons.append("One requirement sits at an extreme edge of what commercial 5G deployments offer.")

    numeric_ranges = (metrics or {}).get("feature_ranges", {})
    z_scores = []
    for name in ("throughput_mbps", "latency_ms", "reliability_percent", "active_connections", "bandwidth_allocated_mhz"):
        bounds = numeric_ranges.get(name) or {}
        std = bounds.get("std") or 0
        if std > 0:
            z_scores.append(abs(float(feature_values[name]) - bounds["mean"]) / std)
    if z_scores:
        mean_z = sum(z_scores) / len(z_scores)
        if mean_z > 1.5:
            score += min(0.45, (mean_z - 1.5) / 5.0)
        if mean_z > 3:
            reasons.append(
                "These values sit far outside the range the model was trained on, so its answer is extrapolation."
            )

    # Capped below 1.0: this is a plausibility hint, not a verdict.
    return round(min(0.95, score), 3), reasons


def generate_template_explanation(predicted_slice: str, probabilities: dict, feature_values: dict, feature_importance: dict, app_name: str = None) -> str:
    """Generate a template-based explanation when LLM is unavailable."""
    slice_info = {
        "URLLC": {
            "full_name": "Ultra-Reliable Low-Latency Communications",
            "description": "designed for applications requiring extremely low latency and high reliability, such as industrial automation, autonomous vehicles, and remote surgery",
            "key_traits": "very low latency (<10ms) and ultra-high reliability (>99.999%)",
        },
        "eMBB": {
            "full_name": "Enhanced Mobile Broadband",
            "description": "optimized for high data throughput applications like video streaming, virtual reality, cloud gaming, and large file transfers",
            "key_traits": "high throughput (>100 Mbps) and large bandwidth allocation",
        },
        "mMTC": {
            "full_name": "Massive Machine-Type Communications",
            "description": "designed for scenarios with a massive number of connected devices transmitting small amounts of data, such as smart meters, environmental sensors, and smart parking",
            "key_traits": "support for many simultaneous connections with lower per-device bandwidth needs",
        },
    }

    info = slice_info.get(predicted_slice, slice_info["eMBB"])
    app_label = f'"{app_name}"' if app_name else "your application"

    # Find top contributing features
    sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    top_features = sorted_features[:3]

    feature_descriptions = {
        "throughput_mbps": f"throughput requirement of {feature_values.get('throughput_mbps', 'N/A')} Mbps",
        "latency_ms": f"latency requirement of {feature_values.get('latency_ms', 'N/A')} ms",
        "reliability_percent": f"reliability target of {feature_values.get('reliability_percent', 'N/A')}%",
        "active_connections": f"{feature_values.get('active_connections', 'N/A')} active connections",
        "bandwidth_allocated_mhz": f"bandwidth allocation of {feature_values.get('bandwidth_allocated_mhz', 'N/A')} MHz",
        "use_case": f"use case category '{feature_values.get('use_case', 'N/A')}'",
    }

    contributing_factors = ", ".join(
        feature_descriptions.get(f, f) for f, _ in top_features
    )

    # Build comparison text
    other_slices = [s for s in ["URLLC", "eMBB", "mMTC"] if s != predicted_slice]
    comparison_parts = []
    for s in other_slices:
        s_info = slice_info.get(s, {})
        prob = probabilities.get(s, 0)
        comparison_parts.append(
            f"**{s}** ({s_info.get('full_name', s)}, model score: {prob:.1%}) — {s_info.get('description', 'N/A')}"
        )

    explanation = f"""## Recommendation: {predicted_slice} — {info['full_name']}

Based on the model's analysis, {app_label} is recommended for the **{predicted_slice}** network slice, which is {info['description']}.

### Why {predicted_slice}?
The key factors driving this recommendation are: {contributing_factors}. The {predicted_slice} slice is characterized by {info['key_traits']}, which aligns with the provided requirements.

### Model Confidence
The model assigned {predicted_slice} a score of {probabilities.get(predicted_slice, 0):.1%}. This score reflects the model's internal confidence based on training data patterns and should not be interpreted as a guaranteed real-world probability.

### How do the other slices compare?
{chr(10).join(f"- {p}" for p in comparison_parts)}

### ⚠ Important Limitations
- This is a prototype recommendation based on a trained machine learning model, not verified network-provisioning advice.
- The model was trained on synthetic data from the Electric Sheep Africa catalog and may not capture all real-world 5G network characteristics.
- Actual slice selection in production networks depends on operator policies, network conditions, and SLA negotiations.
- Always consult with your network operator for production deployments.

*Note: This explanation was generated using a template because the LLM service is currently unavailable.*"""

    return explanation


# ── API Endpoints ──────────────────────────────────────────────────────────────
from fastapi import APIRouter

api_router = APIRouter()


@api_router.get("/health")
async def health():
    api_key, _, _ = get_llm_config()
    return {
        "status": "healthy",
        "model_loaded": pipeline is not None,
        "llm_configured": bool(api_key),
    }


@api_router.post("/set-api-key")
async def set_api_key(req: SetApiKeyRequest):
    global QUALCOMM_API_KEY
    QUALCOMM_API_KEY = req.api_key.strip()
    return {"success": True, "llm_configured": bool(QUALCOMM_API_KEY)}


@api_router.get("/model-info")
async def model_info():
    """Return model metadata and evaluation metrics with normalized class names."""
    if metrics is None:
        raise HTTPException(status_code=503, detail="Model not trained yet. Run train_model.py first.")
    
    info = json.loads(json.dumps(metrics))
    info["class_names"] = [normalize_slice_name(c) for c in info.get("class_names", [])]
    if "class_distribution" in info:
        info["class_distribution"] = {
            normalize_slice_name(k): v for k, v in info["class_distribution"].items()
        }
    if "test_metrics" in info:
        tm = info["test_metrics"]
        if "per_class_precision" in tm:
            tm["per_class_precision"] = {
                normalize_slice_name(k): v for k, v in tm["per_class_precision"].items()
            }
        if "per_class_recall" in tm:
            tm["per_class_recall"] = {
                normalize_slice_name(k): v for k, v in tm["per_class_recall"].items()
            }
    return info


@api_router.get("/feature-schema")
async def feature_schema():
    """Return the feature schema for the frontend form."""
    if metrics is None:
        raise HTTPException(status_code=503, detail="Model not trained yet.")

    return {
        "features": metrics["feature_names"],
        "numeric_features": metrics["numeric_features"],
        "categorical_features": metrics["categorical_features"],
        "feature_ranges": metrics.get("feature_ranges", {}),
        "use_case_values": metrics.get("use_case_values", []),
        "class_names": [normalize_slice_name(c) for c in metrics.get("class_names", [])],
    }


@api_router.post("/predict")
async def predict(request: PredictionRequest):
    """Run prediction through the trained Random Forest model."""
    if pipeline is None or label_encoder is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")

    # Build input dataframe
    input_data = pd.DataFrame([{
        "use_case": request.use_case,
        "throughput_mbps": request.throughput_mbps,
        "latency_ms": request.latency_ms,
        "reliability_percent": request.reliability_percent,
        "active_connections": request.active_connections,
        "bandwidth_allocated_mhz": request.bandwidth_allocated_mhz,
    }])

    # Check for out-of-range values
    warnings_list = []
    if metrics and "feature_ranges" in metrics:
        for col, ranges in metrics["feature_ranges"].items():
            val = input_data[col].iloc[0]
            if val < ranges["min"] or val > ranges["max"]:
                warnings_list.append(
                    f"{col} value ({val}) is outside the training data range "
                    f"[{ranges['min']:.1f}, {ranges['max']:.1f}]. "
                    f"Prediction reliability may be reduced."
                )

    # Check use_case validity
    if has_use_case(request.use_case):
        if metrics and "use_case_values" in metrics:
            if request.use_case not in metrics["use_case_values"]:
                warnings_list.append(
                    f"Use case '{request.use_case}' was not seen during training. "
                    f"Known values: {metrics['use_case_values']}. "
                    f"Prediction reliability may be reduced."
                )
    else:
        warnings_list.append(
            "No use case selected: the prediction averages the model over all use cases, "
            "so only the other parameters decide the result."
        )

    # Predict
    numeric_values = {
        "throughput_mbps": request.throughput_mbps,
        "latency_ms": request.latency_ms,
        "reliability_percent": request.reliability_percent,
        "active_connections": request.active_connections,
        "bandwidth_allocated_mhz": request.bandwidth_allocated_mhz,
    }
    try:
        predicted_slice, probabilities = predict_distribution(numeric_values, request.use_case)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {str(e)}")

    class_names = list(probabilities.keys())
    predicted_proba = np.array([probabilities[c] for c in class_names])

    # Check model confidence
    max_prob = max(predicted_proba)
    if max_prob < 0.5:
        warnings_list.append(
            f"The model's highest confidence score is only {max_prob:.1%}. "
            f"This suggests the input may not clearly match any single slice category."
        )

    # Feature values for explanation
    feature_values = {
        "use_case": request.use_case if has_use_case(request.use_case) else "none of these",
        "throughput_mbps": request.throughput_mbps,
        "latency_ms": request.latency_ms,
        "reliability_percent": request.reliability_percent,
        "active_connections": request.active_connections,
        "bandwidth_allocated_mhz": request.bandwidth_allocated_mhz,
    }

    # Heuristic "none of these" risk (not a model class)
    feasibility_score, feasibility_reasons = assess_feasibility(feature_values)

    feature_importance = metrics.get("feature_importance", {}) if metrics else {}

    # Try LLM explanation
    explanation = None
    llm_used = False
    api_key, _, _ = get_llm_config()

    if api_key:
        explanation_prompt = f"""You are a 5G network slicing expert advisor. A machine learning model (Random Forest) has predicted the following:

Predicted Slice: {predicted_slice}
Model Confidence Scores: {json.dumps(probabilities)}
Application Name: {request.app_name or 'Not specified'}
Application Description: {request.app_description or 'Not specified'}
Requirements:
- Use Case: {request.use_case if has_use_case(request.use_case) else 'not specified (averaged over all use cases)'}
- Throughput: {request.throughput_mbps} Mbps
- Latency: {request.latency_ms} ms
- Reliability: {request.reliability_percent}%
- Active Connections: {request.active_connections}
- Bandwidth: {request.bandwidth_allocated_mhz} MHz

Feature Importance from the model: {json.dumps(feature_importance)}

Please explain this prediction in plain English following these rules:
1. Explain what the predicted slice ({predicted_slice}) means and why it fits the application's requirements.
2. Connect the explanation to the specific requirements provided.
3. Briefly compare with the other two slice categories.
4. Mention any trade-offs, missing information, or limitations.
5. Do NOT invent measurements, feature contributions, or confidence values beyond what is provided.
6. Do NOT claim that a slice has been provisioned on a real network.
7. Keep the explanation concise but informative (3-4 paragraphs).
8. Format the response in markdown."""

        explanation = await call_qualcomm_llm([
            {"role": "system", "content": "You are a helpful 5G network expert. Explain ML predictions clearly. Never override the model's prediction."},
            {"role": "user", "content": explanation_prompt},
        ])
        if explanation:
            llm_used = True

    # Fallback to template
    if not explanation:
        explanation = generate_template_explanation(
            predicted_slice, probabilities, feature_values, feature_importance,
            app_name=request.app_name,
        )

    return {
        "predicted_slice": predicted_slice,
        "class_probabilities": probabilities,
        "explanation": explanation,
        "llm_used": llm_used,
        "warnings": warnings_list,
        "feature_values": feature_values,
        "feature_importance": feature_importance,
        "feasibility_score": feasibility_score,
        "feasibility_reasons": feasibility_reasons,
    }


async def run_requirements_extraction(text: str, source: str = "text") -> dict:
    """Extract parameters from requirement text using the LLM plus rule-based fallbacks.

    Values the extractor is not confident about are returned as `null` with a
    follow-up question, so the UI can ask the user instead of guessing.
    """
    use_case_values = metrics.get("use_case_values", []) if metrics else []
    heuristic = rq.heuristic_extract(text)

    llm_result = None
    api_key, _, _ = get_llm_config()
    if api_key:
        raw = await call_qualcomm_llm(
            [
                {"role": "system", "content": "You extract structured network requirements and reply with JSON only."},
                {"role": "user", "content": rq.build_llm_prompt(text, use_case_values)},
            ],
            temperature=0.1,
        )
        if raw:
            llm_result = rq.parse_llm_output(raw, use_case_values)

    result = rq.merge_extractions(llm_result, heuristic, use_case_values)
    found_something = bool(result["extracted"]) or llm_result is not None
    result.update(
        {
            "success": found_something,
            "llm_used": llm_result is not None,
            "source": source,
            "text_preview": rq.text_preview(text),
            "error": None
            if found_something
            else "No parameters could be read from this document. Add more detail or fill the form manually.",
        }
    )
    return result


@api_router.post("/extract-requirements")
async def extract_requirements(request: NLPExtractionRequest):
    """Extract structured requirements from a natural-language description."""
    return await run_requirements_extraction(request.description, source="text")


@api_router.post("/extract-requirements-file")
async def extract_requirements_file(file: UploadFile = File(...)):
    """Extract structured requirements from an uploaded .txt, .md or .pdf document."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > rq.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 5 MB. Upload a shorter document.")

    try:
        text = rq.extract_text(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if len(text) < 10:
        raise HTTPException(status_code=400, detail="The document does not contain enough text to extract requirements.")

    return await run_requirements_extraction(text, source=file.filename or "upload")


@api_router.get("/sample-requirements")
async def sample_requirements():
    """List the bundled example requirement documents."""
    return {"samples": rq.list_samples()}


@api_router.get("/sample-requirements/{sample_id}")
async def sample_requirements_detail(sample_id: str):
    """Return the extracted text of a bundled example document."""
    sample = rq.read_sample(sample_id)
    if sample is None:
        raise HTTPException(status_code=404, detail="Sample document not found.")
    return sample


@api_router.get("/sample-requirements/{sample_id}/download")
async def sample_requirements_download(sample_id: str):
    """Download a bundled example document as a file."""
    sample = next((s for s in rq.list_samples() if s["id"] == sample_id), None)
    if sample is None:
        raise HTTPException(status_code=404, detail="Sample document not found.")
    path = rq.SAMPLES_DIR / sample["filename"]
    media_type = {
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".pdf": "application/pdf",
    }.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=sample["filename"])


@api_router.post("/what-if")
async def what_if(request: WhatIfRequest):
    """Compare predictions between original and modified inputs."""
    if pipeline is None or label_encoder is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    async def run_prediction(req: PredictionRequest):
        numeric_values = {
            "throughput_mbps": req.throughput_mbps,
            "latency_ms": req.latency_ms,
            "reliability_percent": req.reliability_percent,
            "active_connections": req.active_connections,
            "bandwidth_allocated_mhz": req.bandwidth_allocated_mhz,
        }
        return predict_distribution(numeric_values, req.use_case)

    original_slice, original_proba = await run_prediction(request.original)
    modified_slice, modified_proba = await run_prediction(request.modified)

    # Compute changes
    changes = {}
    orig_dict = request.original.model_dump()
    mod_dict = request.modified.model_dump()
    for key in ["use_case", "throughput_mbps", "latency_ms", "reliability_percent", "active_connections", "bandwidth_allocated_mhz"]:
        if orig_dict[key] != mod_dict[key]:
            changes[key] = {"from": orig_dict[key], "to": mod_dict[key]}

    slice_changed = original_slice != modified_slice

    # Try LLM explanation of changes
    change_explanation = None
    api_key, _, _ = get_llm_config()
    if api_key and changes:
        change_prompt = f"""A user modified their 5G application requirements and the model prediction changed.

Original prediction: {original_slice} (scores: {json.dumps(original_proba)})
Modified prediction: {modified_slice} (scores: {json.dumps(modified_proba)})
Changes made: {json.dumps(changes)}

Explain in 2-3 sentences:
1. What changed in the requirements
2. Why this affected the prediction (or didn't)
3. What this means for the application

Be concise and practical. Format in markdown."""

        change_explanation = await call_qualcomm_llm([
            {"role": "system", "content": "You explain 5G network slice prediction changes concisely."},
            {"role": "user", "content": change_prompt},
        ])

    if not change_explanation:
        if slice_changed:
            change_explanation = (
                f"Changing {', '.join(changes.keys())} shifted the recommendation from **{original_slice}** to **{modified_slice}**. "
                f"This suggests these parameters are significant factors in slice selection for your application profile."
            )
        else:
            change_explanation = (
                f"Despite changes to {', '.join(changes.keys())}, the recommendation remains **{original_slice}**. "
                f"The modified values still align with the characteristics of this slice category."
            )

    return {
        "original": {
            "predicted_slice": original_slice,
            "class_probabilities": original_proba,
        },
        "modified": {
            "predicted_slice": modified_slice,
            "class_probabilities": modified_proba,
        },
        "changes": changes,
        "slice_changed": slice_changed,
        "explanation": change_explanation,
    }


@api_router.post("/explain")
async def explain(request: ExplanationRequest):
    """Generate or regenerate an explanation for a prediction."""
    explanation = None
    llm_used = False

    if QUALCOMM_API_KEY:
        prompt = f"""Explain this 5G slice prediction:
Predicted: {request.predicted_slice}
Scores: {json.dumps(request.class_probabilities)}
App: {request.app_name or 'Not specified'} — {request.app_description or 'Not specified'}
Requirements: {json.dumps(request.feature_values)}
Feature importance: {json.dumps(request.feature_importance)}

Provide a clear, plain-English explanation in markdown. Never override the prediction."""

        explanation = await call_qualcomm_llm([
            {"role": "system", "content": "You are a 5G network expert. Explain ML predictions clearly."},
            {"role": "user", "content": prompt},
        ])
        if explanation:
            llm_used = True

    if not explanation:
        explanation = generate_template_explanation(
            request.predicted_slice,
            request.class_probabilities,
            request.feature_values,
            request.feature_importance,
            app_name=request.app_name,
        )

    return {"explanation": explanation, "llm_used": llm_used}


# Mount API router both with and without /api prefix
app.include_router(api_router, prefix="/api")
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
