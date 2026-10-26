# 5G Slice Advisor (NC-02)

> **AI-assisted 5G network slice recommendations, explained simply.**

A functional, polished web application built for the **NC-02 Hackathon** problem statement. It assists application developers and telecom network engineers in identifying the optimal 3GPP 5G network slice (`eMBB`, `URLLC`, or `mMTC`) matching their connectivity requirements.

The system uses a **trained Scikit-learn Random Forest classifier for all predictions**, and integrates **Qualcomm Cloud AI** for natural-language requirement extraction (Step 1) and plain-English prediction explanations (Step 8).

---

## 5G Slice Categories

| Slice Category | Full Name | Primary Traits | Typical Applications |
| :--- | :--- | :--- | :--- |
| **URLLC** | Ultra-Reliable Low-Latency Communications | Sub-10ms latency, $\ge 99.999\%$ reliability | Autonomous vehicles, emergency medical telemetry, remote industrial control |
| **eMBB** | Enhanced Mobile Broadband | High throughput ($>100$ Mbps), wide bandwidth | VR/AR, 4K/8K video streaming, cloud gaming, high-speed downloads |
| **mMTC** | Massive Machine-Type Communications | Millions of connections/km², low power, bursty payload | Smart electricity meters, environmental sensors, fleet tracking, smart cities |

---

## Architecture & Workflow

```
[User Input]
   ├─ Mode A: Structured Requirements Form
   └─ Mode B: Natural Language Prompt ("Monitoring patients in ambulances...")
            │
            ▼
[Qualcomm Cloud AI (Step 1)]
   (Extracts structured fields: throughput, latency, reliability, etc.)
            │
            ▼
[Feature Validation & Range Bounds Check]
   (Validates against training distribution; generates warnings if out-of-bounds)
            │
            ▼
[Saved Scikit-learn Pipeline]
   (ColumnTransformer: StandardScaler + OrdinalEncoder)
            │
            ▼
[Trained Random Forest Classifier (Inference Only)]
   (Calculates predicted_slice + internal confidence scores)
            │
            ▼
[Qualcomm Cloud AI (Step 8)]
   (Generates plain-English markdown explanation connecting features to 5G traits)
   * Transparent template explanation fallback if API key is not provided
            │
            ▼
[Interactive Dashboard UI]
   ├─ Main Predictor (Prediction card, confidence scores, feature importance, explanation)
   ├─ What-If Simulator (Real-time delta comparison on parameter shifts)
   ├─ Model Evaluation Dashboard (Accuracy, Macro F1, Confusion Matrix, Distribution)
   └─ About & Methodology (Disclaimers, provenance, limitations)
```

---

## Dataset & Training Specification

- **Source:** Hugging Face [`electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria`](https://huggingface.co/datasets/electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria)
- **Provenance:** Synthetic 5G telecom slice dataset from Electric Sheep Africa catalog.
- **Rows Utilized:** All **300,000 rows**.
- **Target Label:** `slice_type` (`embb`, `urllc`, `mmtc`).
- **Input Features Used:**
  1. `use_case` (categorical)
  2. `throughput_mbps` (numeric)
  3. `latency_ms` (numeric)
  4. `reliability_percent` (numeric)
  5. `active_connections` (numeric)
  6. `bandwidth_allocated_mhz` (numeric)
- **Target Leaking Exclusions:** All identifier and post-facto metrics (`slice_id`, `timestamp`, `tower_id`, `city`, `operator`, `resource_utilization_percent`, `sla_met`) are excluded.

### Model Evaluation Results (Held-Out Test Set)
- **Train / Val / Test Split:** 70% / 15% / 15% (210,000 train / 45,000 val / 45,000 test), stratified with fixed seed `42`.
- **Test Accuracy:** 100.0%
- **Macro F1 Score:** 1.0000
- **Per-Class Metrics:**
  - `eMBB`: Precision 1.0000, Recall 1.0000
  - `URLLC`: Precision 1.0000, Recall 1.0000
  - `mMTC`: Precision 1.0000, Recall 1.0000
- **Feature Importance:**
  - `throughput_mbps`: 35.4%
  - `latency_ms`: 34.6%
  - `reliability_percent`: 17.6%
  - `active_connections`: 9.2%
  - `use_case`: 3.1%
  - `bandwidth_allocated_mhz`: 0.0%

---

## Quick Start (Local Development)

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# (Optional) Retrain model on all 300,000 rows
python train_model.py

# Start FastAPI server (runs on http://localhost:8000)
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```

Visit **http://localhost:5173** in your browser.

---

## Qualcomm Cloud AI Configuration

The application uses Qualcomm Cloud AI for:
1. Extracting structured metrics from conversational application descriptions.
2. Generating intuitive, non-technical explanations of the Random Forest's recommendation.

You can configure your key in either of two ways:
1. **Via `.env` file:** Copy `backend/.env.example` to `backend/.env` and insert `QUALCOMM_API_KEY=your_key`.
2. **Directly in the Web UI:** Click the **Connect Qualcomm AI** button in the top navigation bar, enter your key, and click Save.

*Note: If no API key is provided, the application runs seamlessly in fallback mode using transparent template-based explanations.*

---

## Vercel Deployment Guide

This project is configured for **1-click fullstack deployment on Vercel**:

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import the repository.
4. Set Environment Variables in the Vercel dashboard:
   - `QUALCOMM_API_KEY`: Your Qualcomm Cloud AI API key.
   - `QUALCOMM_API_URL`: `https://api.cloud.qualcomm.com/v1/chat/completions` (default)
   - `QUALCOMM_MODEL`: `Qwen2.5-Coder-32B-Instruct` (default)
5. Click **Deploy**.

Vercel will automatically:
- Build the static React frontend from `frontend/`.
- Deploy the Python FastAPI backend as a serverless function via `api/index.py` using `vercel.json`.

---

## Limitations & Disclaimers

- **Prototype Demonstration:** This software is a prototype built for the NC-02 hackathon. It does not connect to a live 5G Core (5GC) or provision real network slices.
- **Dataset Context:** The model is trained on synthetic simulated 5G slicing data from Electric Sheep Africa. Labels reflect the dataset's generative rules rather than negotiated operator SLAs.
- **Model Confidence:** Probability scores are model internal Softmax/tree confidence metrics, not guaranteed real-world availability percentages.
- **Human in the Loop:** Always consult telecom network engineers and operator-specific QoS specifications before provisioning production 5G network resources.
