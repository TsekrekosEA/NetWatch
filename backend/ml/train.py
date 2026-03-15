"""
NetWatch Backend — Offline ML training script.

Trains an Isolation Forest (unsupervised, on benign traffic) and a Random
Forest classifier (supervised, on all labelled classes) from the CIC-IDS-2018
dataset. Run once before deploying the system with ML detection enabled.

Usage:
    cd backend
    python -m ml.train
"""

import logging
import os
import sys

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from ml.preprocess import load_cic_csvs, FEATURE_COLUMNS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("netwatch.ml.train")

DATA_DIR = os.environ.get("DATA_DIR", os.path.join("..", "data"))
MODELS_DIR = os.environ.get("MODELS_DIR", os.path.join("ml", "models"))


def main() -> None:
    """Entry point for training pipeline."""
    logger.info("=" * 60)
    logger.info("NetWatch ML Training Pipeline")
    logger.info("=" * 60)

    # ── Load and preprocess data ──────────────────────────────────────
    logger.info("Loading CIC-IDS-2018 data from %s …", DATA_DIR)
    df = load_cic_csvs(DATA_DIR)

    # Drop rows where the label is a header artefact (e.g. "Label")
    valid_mask = ~df["label"].isin(["Label", "label", ""])
    df = df[valid_mask].reset_index(drop=True)

    X = df[FEATURE_COLUMNS].to_numpy(dtype=np.float64, na_value=0.0)
    y = df["label"].to_numpy()

    logger.info("Dataset shape: %s", X.shape)
    logger.info("Class distribution:")
    unique, counts = np.unique(y, return_counts=True)
    for cls, cnt in zip(unique, counts):
        logger.info("  %-30s %d (%.1f%%)", cls, cnt, 100 * cnt / len(y))

    # ── Split data ────────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )
    logger.info("Train: %d | Test: %d", len(X_train), len(X_test))

    # ── Fit scaler on benign training data ────────────────────────────
    benign_mask = y_train == "Benign"
    X_benign = X_train[benign_mask]
    logger.info("Benign training samples: %d", len(X_benign))

    scaler = StandardScaler()
    scaler.fit(X_benign)

    X_train_scaled = scaler.transform(X_train)
    X_benign_scaled = scaler.transform(X_benign)

    # ── Train Isolation Forest ────────────────────────────────────────
    logger.info("Training Isolation Forest (n_estimators=100, contamination=0.05) …")
    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )
    iso_forest.fit(X_benign_scaled)
    logger.info("Isolation Forest trained.")

    # ── Train Random Forest ───────────────────────────────────────────
    logger.info("Training Random Forest (n_estimators=200, max_depth=20) …")
    rf_classifier = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )
    rf_classifier.fit(X_train_scaled, y_train)
    logger.info("Random Forest trained.")

    # ── Save models ───────────────────────────────────────────────────
    os.makedirs(MODELS_DIR, exist_ok=True)

    scaler_path = os.path.join(MODELS_DIR, "scaler.joblib")
    if_path = os.path.join(MODELS_DIR, "isolation_forest.joblib")
    rf_path = os.path.join(MODELS_DIR, "random_forest.joblib")

    joblib.dump(scaler, scaler_path)
    joblib.dump(iso_forest, if_path)
    joblib.dump(rf_classifier, rf_path)

    logger.info("Models saved:")
    logger.info("  Scaler          → %s", scaler_path)
    logger.info("  Isolation Forest → %s", if_path)
    logger.info("  Random Forest   → %s", rf_path)

    # ── Save test split for evaluation ────────────────────────────────
    test_path = os.path.join(MODELS_DIR, "test_split.npz")
    np.savez(test_path, X_test=X_test, y_test=y_test)
    logger.info("Test split saved → %s", test_path)

    logger.info("=" * 60)
    logger.info("Training complete. Run 'python -m ml.evaluate' to evaluate.")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
