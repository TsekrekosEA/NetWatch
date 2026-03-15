"""
NetWatch Backend — Model evaluation script.

Evaluates the trained Isolation Forest and Random Forest models on the
held-out test split, computing per-class precision, recall, and F1 as
well as the overall false positive rate on benign traffic.

Usage:
    cd backend
    python -m ml.evaluate
"""

import logging
import os
import sys

import joblib
import numpy as np
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("netwatch.ml.evaluate")

MODELS_DIR = os.environ.get("MODELS_DIR", os.path.join("ml", "models"))


def main() -> None:
    """Run evaluation on the held-out test split."""
    logger.info("=" * 60)
    logger.info("NetWatch ML Evaluation")
    logger.info("=" * 60)

    # ── Load models and test data ─────────────────────────────────────
    scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.joblib"))
    iso_forest = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.joblib"))
    rf_classifier = joblib.load(os.path.join(MODELS_DIR, "random_forest.joblib"))

    test_data = np.load(os.path.join(MODELS_DIR, "test_split.npz"), allow_pickle=True)
    X_test = test_data["X_test"]
    y_test = test_data["y_test"]

    logger.info("Test set: %d samples", len(X_test))

    X_test_scaled = scaler.transform(X_test)

    # ── Isolation Forest evaluation ───────────────────────────────────
    logger.info("\n" + "─" * 40)
    logger.info("ISOLATION FOREST (unsupervised)")
    logger.info("─" * 40)

    if_scores = iso_forest.decision_function(X_test_scaled)
    if_preds = (if_scores < -0.1).astype(int)  # 1 = anomalous

    benign_mask = y_test == "Benign"
    attack_mask = ~benign_mask

    if_tp = if_preds[attack_mask].sum()
    if_fn = len(if_preds[attack_mask]) - if_tp
    if_fp = if_preds[benign_mask].sum()
    if_tn = len(if_preds[benign_mask]) - if_fp

    logger.info("True Positives  (attacks flagged):     %d", if_tp)
    logger.info("False Negatives (attacks missed):      %d", if_fn)
    logger.info("False Positives (benign flagged):      %d", if_fp)
    logger.info("True Negatives  (benign correct):      %d", if_tn)

    if (if_tp + if_fn) > 0:
        logger.info("Detection Rate: %.2f%%", 100 * if_tp / (if_tp + if_fn))
    if (if_fp + if_tn) > 0:
        logger.info("False Positive Rate: %.2f%%", 100 * if_fp / (if_fp + if_tn))

    # ── Random Forest evaluation ──────────────────────────────────────
    logger.info("\n" + "─" * 40)
    logger.info("RANDOM FOREST (supervised)")
    logger.info("─" * 40)

    rf_preds = rf_classifier.predict(X_test_scaled)

    logger.info("Overall Accuracy: %.2f%%", 100 * accuracy_score(y_test, rf_preds))

    logger.info("\nPer-class classification report:")
    report = classification_report(y_test, rf_preds, zero_division=0)
    for line in report.split("\n"):
        logger.info("  %s", line)

    # False positive rate on benign traffic
    benign_preds = rf_preds[benign_mask]
    fpr = (benign_preds != "Benign").sum() / len(benign_preds) if len(benign_preds) > 0 else 0
    logger.info("Benign False Positive Rate: %.2f%%", 100 * fpr)

    # ── Confusion matrix ──────────────────────────────────────────────
    logger.info("\n" + "─" * 40)
    logger.info("CONFUSION MATRIX")
    logger.info("─" * 40)

    classes = sorted(np.unique(y_test))
    cm = confusion_matrix(y_test, rf_preds, labels=classes)

    header = f"{'':>28s}" + "".join(f"{c[:8]:>10s}" for c in classes)
    logger.info(header)
    for i, cls in enumerate(classes):
        row = f"{cls:>28s}" + "".join(f"{cm[i, j]:>10d}" for j in range(len(classes)))
        logger.info(row)

    logger.info("\n" + "=" * 60)
    logger.info("Evaluation complete.")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
