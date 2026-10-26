"""
5G Slice Advisor — Model Training Script
=========================================
Trains a Random Forest classifier on the Nigerian Telecom 5G Network Slicing dataset.
Dataset: electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria (Hugging Face)

Features used (per user spec):
  - use_case        (categorical)
  - throughput_mbps  (numeric)
  - latency_ms       (numeric)
  - reliability_percent (numeric)
  - active_connections  (numeric)
  - bandwidth_allocated_mhz (numeric)

Target: slice_type (eMBB / URLLC / mMTC)
"""

import os
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import json
import time
import warnings
import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler, OrdinalEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
    classification_report,
)
import joblib

warnings.filterwarnings("ignore")

# ── Constants ──────────────────────────────────────────────────────────────────
RANDOM_SEED = 42
TEST_SIZE = 0.15
VAL_SIZE = 0.15  # from remaining after test split

FEATURE_COLS = [
    "use_case",
    "throughput_mbps",
    "latency_ms",
    "reliability_percent",
    "active_connections",
    "bandwidth_allocated_mhz",
]
TARGET_COL = "slice_type"
NUMERIC_FEATURES = [
    "throughput_mbps",
    "latency_ms",
    "reliability_percent",
    "active_connections",
    "bandwidth_allocated_mhz",
]
CATEGORICAL_FEATURES = ["use_case"]

MODEL_DIR = Path(__file__).resolve().parent / "model_artifacts"
MODEL_DIR.mkdir(exist_ok=True)


def load_dataset() -> pd.DataFrame:
    """Load dataset from Hugging Face via the datasets library, falling back to CSV URL."""
    print("=" * 70)
    print("STEP 1: Loading dataset")
    print("=" * 70)

    dataset_name = "electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria"
    df = None

    # Attempt 1: HuggingFace datasets library
    try:
        from datasets import load_dataset as hf_load

        print(f"Loading from HuggingFace: {dataset_name}")
        ds = hf_load(dataset_name, split="train")
        df = ds.to_pandas()
        print(f"  ✓ Loaded {len(df):,} rows via HuggingFace datasets library")
    except Exception as e:
        print(f"  ✗ HuggingFace datasets library failed: {e}")

    # Attempt 2: Direct CSV download
    if df is None:
        csv_url = f"https://huggingface.co/datasets/{dataset_name}/resolve/main/fifth_generation_network_slicing_datasets.csv"
        try:
            print(f"Trying direct CSV download...")
            df = pd.read_csv(csv_url)
            print(f"  ✓ Loaded {len(df):,} rows via direct CSV")
        except Exception as e:
            print(f"  ✗ Direct CSV failed: {e}")

    # Attempt 3: Parquet
    if df is None:
        parquet_url = f"https://huggingface.co/datasets/{dataset_name}/resolve/main/fifth_generation_network_slicing_datasets.parquet"
        try:
            print(f"Trying parquet download...")
            df = pd.read_parquet(parquet_url)
            print(f"  ✓ Loaded {len(df):,} rows via parquet")
        except Exception as e:
            print(f"  ✗ Parquet failed: {e}")

    if df is None:
        print("\n⚠ FATAL: Could not load dataset from any source.")
        sys.exit(1)

    return df


def inspect_dataset(df: pd.DataFrame) -> None:
    """Print dataset inspection report."""
    print("\n" + "=" * 70)
    print("STEP 2: Dataset Inspection")
    print("=" * 70)

    print(f"\nShape: {df.shape[0]:,} rows × {df.shape[1]} columns")
    print(f"\nColumns: {list(df.columns)}")
    print(f"\nData types:\n{df.dtypes.to_string()}")
    print(f"\nMissing values:\n{df.isnull().sum().to_string()}")
    print(f"\nDuplicate rows: {df.duplicated().sum():,}")

    if TARGET_COL in df.columns:
        print(f"\nClass distribution ({TARGET_COL}):")
        dist = df[TARGET_COL].value_counts()
        for cls, count in dist.items():
            print(f"  {cls}: {count:,} ({count / len(df) * 100:.1f}%)")

    # Verify required columns exist
    missing_cols = [c for c in FEATURE_COLS + [TARGET_COL] if c not in df.columns]
    if missing_cols:
        print(f"\n⚠ Missing required columns: {missing_cols}")
        print(f"  Available columns: {list(df.columns)}")
        sys.exit(1)

    print(f"\nNumeric feature statistics:")
    print(df[NUMERIC_FEATURES].describe().to_string())


def preprocess_and_split(df: pd.DataFrame):
    """Clean, preprocess, and split data."""
    print("\n" + "=" * 70)
    print("STEP 3: Preprocessing & Splitting")
    print("=" * 70)

    # Select only the columns we need
    df_model = df[FEATURE_COLS + [TARGET_COL]].copy()

    # Drop rows with missing values in our columns
    before = len(df_model)
    df_model.dropna(subset=FEATURE_COLS + [TARGET_COL], inplace=True)
    after = len(df_model)
    if before != after:
        print(f"  Dropped {before - after:,} rows with missing values")

    # Remove duplicates
    before = len(df_model)
    df_model.drop_duplicates(inplace=True)
    after = len(df_model)
    if before != after:
        print(f"  Dropped {before - after:,} duplicate rows")

    print(f"  Using {len(df_model):,} rows for modeling")

    # Encode target
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(df_model[TARGET_COL])
    X = df_model[FEATURE_COLS]

    print(f"  Target classes: {list(label_encoder.classes_)}")
    print(f"  Target encoding: {dict(zip(label_encoder.classes_, label_encoder.transform(label_encoder.classes_)))}")

    # Split: first separate test, then split remainder into train/val
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y
    )
    val_fraction = VAL_SIZE / (1 - TEST_SIZE)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_fraction, random_state=RANDOM_SEED, stratify=y_temp
    )

    print(f"\n  Split sizes:")
    print(f"    Train:      {len(X_train):>8,} ({len(X_train)/len(X)*100:.1f}%)")
    print(f"    Validation: {len(X_val):>8,} ({len(X_val)/len(X)*100:.1f}%)")
    print(f"    Test:       {len(X_test):>8,} ({len(X_test)/len(X)*100:.1f}%)")

    return X_train, X_val, X_test, y_train, y_val, y_test, label_encoder


def build_pipeline() -> Pipeline:
    """Build sklearn pipeline with preprocessing and Random Forest."""
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=200,
            max_depth=20,
            min_samples_split=5,
            min_samples_leaf=2,
            max_features="sqrt",
            random_state=RANDOM_SEED,
            n_jobs=-1,
            class_weight="balanced",
        )),
    ])

    return pipeline


def train_and_evaluate(pipeline, X_train, X_val, X_test, y_train, y_val, y_test, label_encoder):
    """Train model and produce evaluation metrics."""
    print("\n" + "=" * 70)
    print("STEP 4: Training Random Forest")
    print("=" * 70)

    start_time = time.time()
    pipeline.fit(X_train, y_train)
    train_time = time.time() - start_time
    print(f"  Training completed in {train_time:.2f}s")

    # Validation evaluation
    y_val_pred = pipeline.predict(X_val)
    val_acc = accuracy_score(y_val, y_val_pred)
    val_f1 = f1_score(y_val, y_val_pred, average="macro")
    print(f"\n  Validation Accuracy:  {val_acc:.4f}")
    print(f"  Validation Macro F1:  {val_f1:.4f}")

    # Test evaluation
    print("\n" + "=" * 70)
    print("STEP 5: Test Set Evaluation")
    print("=" * 70)

    y_test_pred = pipeline.predict(X_test)
    y_test_proba = pipeline.predict_proba(X_test)

    test_acc = accuracy_score(y_test, y_test_pred)
    test_f1 = f1_score(y_test, y_test_pred, average="macro")
    test_precision = precision_score(y_test, y_test_pred, average=None)
    test_recall = recall_score(y_test, y_test_pred, average=None)
    cm = confusion_matrix(y_test, y_test_pred)

    class_names = list(label_encoder.classes_)

    print(f"\n  Test Accuracy:   {test_acc:.4f}")
    print(f"  Test Macro F1:   {test_f1:.4f}")
    print(f"\n  Per-class metrics:")
    for i, cls in enumerate(class_names):
        print(f"    {cls:>6s}  —  Precision: {test_precision[i]:.4f}  |  Recall: {test_recall[i]:.4f}")

    print(f"\n  Confusion Matrix:")
    print(f"  {'':>8s}  " + "  ".join(f"{c:>8s}" for c in class_names) + "  (predicted)")
    for i, cls in enumerate(class_names):
        row = "  ".join(f"{cm[i, j]:>8,}" for j in range(len(class_names)))
        print(f"  {cls:>8s}  {row}")

    # Feature importance
    rf_model = pipeline.named_steps["classifier"]
    preprocessor = pipeline.named_steps["preprocessor"]

    # Get feature names after transformation
    feature_names = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    importances = rf_model.feature_importances_

    # Map importances to feature names
    feature_importance = dict(zip(feature_names, importances.tolist()))
    sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)

    print(f"\n  Feature Importance:")
    for name, imp in sorted_importance:
        bar = "█" * int(imp * 50)
        print(f"    {name:<28s}  {imp:.4f}  {bar}")

    # Collect all metrics
    metrics = {
        "dataset_source": "electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria",
        "dataset_note": "Synthetic 5G network slicing data from Electric Sheep Africa catalog. Labels represent simulated slice assignments, not verified real-world optimal allocations.",
        "total_rows_used": len(X_train) + len(X_val) + len(X_test),
        "num_features": len(FEATURE_COLS),
        "feature_names": FEATURE_COLS,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "target_column": TARGET_COL,
        "class_names": class_names,
        "split_sizes": {
            "train": len(X_train),
            "validation": len(X_val),
            "test": len(X_test),
        },
        "class_distribution": {
            cls: int((y_train == i).sum() + (y_val == i).sum() + (y_test == i).sum())
            for i, cls in enumerate(class_names)
        },
        "validation_metrics": {
            "accuracy": round(val_acc, 4),
            "macro_f1": round(val_f1, 4),
        },
        "test_metrics": {
            "accuracy": round(test_acc, 4),
            "macro_f1": round(test_f1, 4),
            "per_class_precision": {cls: round(test_precision[i], 4) for i, cls in enumerate(class_names)},
            "per_class_recall": {cls: round(test_recall[i], 4) for i, cls in enumerate(class_names)},
            "confusion_matrix": cm.tolist(),
        },
        "feature_importance": {name: round(imp, 4) for name, imp in sorted_importance},
        "model_params": {
            "n_estimators": 200,
            "max_depth": 20,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "max_features": "sqrt",
            "class_weight": "balanced",
            "random_seed": RANDOM_SEED,
        },
        "training_time_seconds": round(train_time, 2),
        "model_version": "1.0.0",
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # Compute numeric feature ranges for input validation
    all_X = pd.concat([X_train, X_val, X_test])
    feature_ranges = {}
    for col in NUMERIC_FEATURES:
        feature_ranges[col] = {
            "min": float(all_X[col].min()),
            "max": float(all_X[col].max()),
            "mean": float(all_X[col].mean()),
            "std": float(all_X[col].std()),
        }
    metrics["feature_ranges"] = feature_ranges

    # Get unique use_case values
    metrics["use_case_values"] = sorted(all_X["use_case"].unique().tolist())

    return pipeline, metrics


def save_artifacts(pipeline, label_encoder, metrics):
    """Save model, label encoder, and metrics."""
    print("\n" + "=" * 70)
    print("STEP 6: Saving Artifacts")
    print("=" * 70)

    pipeline_path = MODEL_DIR / "pipeline.joblib"
    encoder_path = MODEL_DIR / "label_encoder.joblib"
    metrics_path = MODEL_DIR / "metrics.json"

    joblib.dump(pipeline, pipeline_path)
    print(f"  ✓ Pipeline saved to {pipeline_path}")

    joblib.dump(label_encoder, encoder_path)
    print(f"  ✓ Label encoder saved to {encoder_path}")

    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  ✓ Metrics saved to {metrics_path}")

    print(f"\n  Total artifact size: {sum(f.stat().st_size for f in MODEL_DIR.iterdir()) / 1024 / 1024:.1f} MB")


def main():
    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║          5G Slice Advisor — Model Training Pipeline                 ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")
    print()

    df = load_dataset()
    inspect_dataset(df)
    X_train, X_val, X_test, y_train, y_val, y_test, label_encoder = preprocess_and_split(df)
    pipeline = build_pipeline()
    pipeline, metrics = train_and_evaluate(pipeline, X_train, X_val, X_test, y_train, y_val, y_test, label_encoder)
    save_artifacts(pipeline, label_encoder, metrics)

    print("\n" + "=" * 70)
    print("✓ Training complete! Artifacts saved to:", MODEL_DIR)
    print("=" * 70)


if __name__ == "__main__":
    main()
