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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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
    use_case: str = Field(..., description="Application use case category")
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

@app.get("/api/health")
async def health():
    api_key, _, _ = get_llm_config()
    return {
        "status": "healthy",
        "model_loaded": pipeline is not None,
        "llm_configured": bool(api_key),
    }


@app.post("/api/set-api-key")
async def set_api_key(req: SetApiKeyRequest):
    global QUALCOMM_API_KEY
    QUALCOMM_API_KEY = req.api_key.strip()
    return {"success": True, "llm_configured": bool(QUALCOMM_API_KEY)}


@app.get("/api/model-info")
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


@app.get("/api/feature-schema")
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


@app.post("/api/predict")
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
    if metrics and "use_case_values" in metrics:
        if request.use_case not in metrics["use_case_values"]:
            warnings_list.append(
                f"Use case '{request.use_case}' was not seen during training. "
                f"Known values: {metrics['use_case_values']}. "
                f"Prediction reliability may be reduced."
            )

    # Predict
    try:
        predicted_class_idx = pipeline.predict(input_data)[0]
        predicted_proba = pipeline.predict_proba(input_data)[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {str(e)}")

    raw_slice = label_encoder.inverse_transform([predicted_class_idx])[0]
    predicted_slice = normalize_slice_name(raw_slice)
    class_names = [normalize_slice_name(cls) for cls in label_encoder.classes_]
    probabilities = {cls: round(float(p), 4) for cls, p in zip(class_names, predicted_proba)}

    # Check model confidence
    max_prob = max(predicted_proba)
    if max_prob < 0.5:
        warnings_list.append(
            f"The model's highest confidence score is only {max_prob:.1%}. "
            f"This suggests the input may not clearly match any single slice category."
        )

    # Feature values for explanation
    feature_values = {
        "use_case": request.use_case,
        "throughput_mbps": request.throughput_mbps,
        "latency_ms": request.latency_ms,
        "reliability_percent": request.reliability_percent,
        "active_connections": request.active_connections,
        "bandwidth_allocated_mhz": request.bandwidth_allocated_mhz,
    }

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
- Use Case: {request.use_case}
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
    }


@app.post("/api/extract-requirements")
async def extract_requirements(request: NLPExtractionRequest):
    """Use LLM to extract structured requirements from natural language."""
    api_key, _, _ = get_llm_config()
    if not api_key:
        return {
            "success": False,
            "error": "LLM service not configured. Please enter requirements manually.",
            "extracted": None,
        }

    # Get valid use cases
    use_case_values = metrics.get("use_case_values", []) if metrics else []

    extraction_prompt = f"""Analyze this 5G application description:
"{request.description}"

Identify the appropriate network parameters. Choose the closest use_case from:
{', '.join(use_case_values)}

Provide the extracted values line by line:
use_case: (one of the choices above)
throughput_mbps: (estimated number in Mbps)
latency_ms: (estimated number in ms)
reliability_percent: (estimated percentage, e.g. 99.99)
active_connections: (estimated integer)
bandwidth_allocated_mhz: (estimated integer)
app_name: (short title for the app)
app_description: (one sentence summary)
confidence_notes: (notes on estimates)"""

    result = await call_qualcomm_llm([
        {"role": "user", "content": extraction_prompt},
    ])

    if result:
        import re
        cleaned = result.strip()
        extracted = {}

        # 1. Try parsing JSON if present
        json_match = re.search(r"\{[\s\S]*\}", cleaned)
        if json_match:
            try:
                extracted = json.loads(json_match.group(0))
            except Exception:
                pass

        # 2. Extract use_case by matching against known values
        detected_uc = None
        for uc in use_case_values:
            if uc in cleaned.lower() or uc.replace("_", " ") in cleaned.lower():
                detected_uc = uc
                break
        if not detected_uc:
            # Domain keyword heuristics
            text_lower = (request.description + " " + cleaned).lower()
            if any(w in text_lower for w in ["surgery", "hospital", "patient", "ambulance", "vital", "medical", "doctor"]):
                detected_uc = "remote_surgery" if "remote_surgery" in use_case_values else "iot_sensors"
            elif any(w in text_lower for w in ["vehicle", "car", "driving", "traffic", "autonomous", "drone", "lidar"]):
                detected_uc = "autonomous_vehicles"
            elif any(w in text_lower for w in ["vr", "virtual", "headset", "ar", "augmented"]):
                detected_uc = "ar_vr"
            elif any(w in text_lower for w in ["game", "gaming", "playstation", "xbox"]):
                detected_uc = "cloud_gaming"
            elif any(w in text_lower for w in ["stream", "streaming", "video", "youtube", "netflix"]):
                detected_uc = "video_streaming"
            elif any(w in text_lower for w in ["sensor", "meter", "smart parking", "parking", "farm", "crop", "soil", "agriculture"]):
                detected_uc = "iot_sensors"
            elif any(w in text_lower for w in ["factory", "robot", "industrial", "scada", "assembly", "automation"]):
                detected_uc = "industrial_automation"
            elif any(w in text_lower for w in ["grid", "energy", "power", "solar"]):
                detected_uc = "smart_grid"
            elif any(w in text_lower for w in ["city", "street", "lamp"]):
                detected_uc = "smart_city"
            elif any(w in text_lower for w in ["pollution", "air", "water", "environment"]):
                detected_uc = "environmental_monitoring"
            elif any(w in text_lower for w in ["4k", "8k", "hd"]):
                detected_uc = "4k_video"
            else:
                detected_uc = use_case_values[0] if use_case_values else "iot_sensors"

        extracted["use_case"] = detected_uc

        # 3. Extract throughput
        if "throughput_mbps" not in extracted or not extracted["throughput_mbps"]:
            m_tp = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(?:mbps|mb/s)", cleaned, re.I)
            if not m_tp:
                m_tp = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(?:gbps|gb/s)", cleaned, re.I)
                extracted["throughput_mbps"] = float(m_tp.group(1)) * 1000.0 if m_tp else None
            else:
                extracted["throughput_mbps"] = float(m_tp.group(1))

            if not extracted.get("throughput_mbps"):
                m_tp_num = re.search(r"(?:throughput|bandwidth)\D*([0-9]+(?:\.[0-9]+)?)", cleaned, re.I)
                extracted["throughput_mbps"] = float(m_tp_num.group(1)) if m_tp_num else 50.0

        # 4. Extract latency
        if "latency_ms" not in extracted or not extracted["latency_ms"]:
            m_lat = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*ms", cleaned, re.I)
            if not m_lat:
                m_lat = re.search(r"(?:latency|lag|delay)\D*([0-9]+(?:\.[0-9]+)?)", cleaned, re.I)
            extracted["latency_ms"] = float(m_lat.group(1)) if m_lat else 15.0

        # 5. Extract reliability
        if "reliability_percent" not in extracted or not extracted["reliability_percent"]:
            m_rel = re.search(r"([0-9]{2}(?:\.[0-9]+)?)\s*%", cleaned)
            if not m_rel:
                m_rel = re.search(r"(?:reliability)\D*([0-9]{2}(?:\.[0-9]+)?)", cleaned, re.I)
            extracted["reliability_percent"] = min(99.999, max(90.0, float(m_rel.group(1)))) if m_rel else 99.9

        # 6. Extract active connections
        if "active_connections" not in extracted or not extracted["active_connections"]:
            m_conn = re.search(r"(?:active_connections|connections|users|devices|nodes)\D*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)", cleaned, re.I)
            if m_conn:
                val = m_conn.group(1).replace(",", "")
                extracted["active_connections"] = min(1000, max(1, int(float(val))))
            else:
                extracted["active_connections"] = 100

        # 7. Extract bandwidth allocated (MHz)
        if "bandwidth_allocated_mhz" not in extracted or not extracted["bandwidth_allocated_mhz"]:
            m_bw = re.search(r"([0-9]+)\s*mhz", cleaned, re.I)
            if not m_bw:
                m_bw = re.search(r"(?:bandwidth)\D*([0-9]+)", cleaned, re.I)
            extracted["bandwidth_allocated_mhz"] = min(100, max(20, int(m_bw.group(1)))) if m_bw else 50

        # 8. App Name & Description
        if not extracted.get("app_name"):
            m_name = re.search(r"(?:app_name|app name)\**\s*[:=]\s*([^\n\r]+)", cleaned, re.I)
            extracted["app_name"] = m_name.group(1).strip().strip("*\"' ") if m_name else "5G Application"

        if not extracted.get("app_description"):
            extracted["app_description"] = request.description

        extracted["confidence_notes"] = "Parameters extracted and normalized from natural-language description using Qualcomm AI reasoning."

        return {
            "success": True,
            "extracted": extracted,
            "error": None,
        }

    return {
        "success": False,
        "error": "LLM service did not respond. Please enter requirements manually.",
        "extracted": None,
    }


@app.post("/api/what-if")
async def what_if(request: WhatIfRequest):
    """Compare predictions between original and modified inputs."""
    if pipeline is None or label_encoder is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    async def run_prediction(req: PredictionRequest):
        input_data = pd.DataFrame([{
            "use_case": req.use_case,
            "throughput_mbps": req.throughput_mbps,
            "latency_ms": req.latency_ms,
            "reliability_percent": req.reliability_percent,
            "active_connections": req.active_connections,
            "bandwidth_allocated_mhz": req.bandwidth_allocated_mhz,
        }])
        predicted_class_idx = pipeline.predict(input_data)[0]
        predicted_proba = pipeline.predict_proba(input_data)[0]
        raw_slice = label_encoder.inverse_transform([predicted_class_idx])[0]
        predicted_slice = normalize_slice_name(raw_slice)
        class_names = [normalize_slice_name(cls) for cls in label_encoder.classes_]
        probabilities = {cls: round(float(p), 4) for cls, p in zip(class_names, predicted_proba)}
        return predicted_slice, probabilities

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


@app.post("/api/explain")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
