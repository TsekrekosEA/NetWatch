"""
NetWatch Backend — Stage 2: ML classifier wrapper.

Loads pre-trained Isolation Forest and Random Forest models from disk and
runs inference on incoming flow feature vectors. Degrades gracefully if
models are not yet trained — the pipeline simply skips ML detection.
"""

import logging
import os
from typing import Optional

import numpy as np
import joblib

logger = logging.getLogger("netwatch.detection.stage2")

# Attack class → severity mapping (matches simplified labels from training)
_CLASS_SEVERITY: dict[str, str] = {
    "Benign": "NONE",
    "DoS": "CRITICAL",
    "DDoS": "CRITICAL",
    "BruteForce": "HIGH",
    "Infiltration": "HIGH",
}


class MLClassifier:
    """Wrapper around the two-model ML detection stage."""

    def __init__(self, models_path: str) -> None:
        self.models_path = models_path
        self.scaler = None
        self.isolation_forest = None
        self.random_forest = None
        self.is_loaded = False

    def load(self) -> None:
        """Attempt to load scaler, Isolation Forest, and Random Forest models."""
        scaler_path = os.path.join(self.models_path, "scaler.joblib")
        if_path = os.path.join(self.models_path, "isolation_forest.joblib")
        rf_path = os.path.join(self.models_path, "random_forest.joblib")

        if not all(os.path.exists(p) for p in [scaler_path, if_path, rf_path]):
            logger.warning(
                "ML model files not found in %s — ML detection will be skipped. "
                "Run 'python -m ml.train' to train models.",
                self.models_path,
            )
            return

        try:
            self.scaler = joblib.load(scaler_path)
            self.isolation_forest = joblib.load(if_path)
            self.random_forest = joblib.load(rf_path)
            self.is_loaded = True
            logger.info("ML models loaded successfully.")
        except Exception as exc:
            logger.error("Failed to load ML models: %s", exc)
            self.is_loaded = False

    def predict(self, features: list[float]) -> Optional[dict]:
        """
        Run the two-model prediction pipeline on a feature vector.

        Returns None if models are not loaded, or a dict with:
          - anomalous: bool
          - if_score: float (Isolation Forest anomaly score)
          - rf_class: str (Random Forest predicted class)
          - rf_confidence: float (max class probability)
          - category: str
          - severity: str
        """
        if not self.is_loaded:
            return None

        try:
            X = np.array(features).reshape(1, -1)
            X_scaled = self.scaler.transform(X)

            # Isolation Forest: negative scores indicate anomalies
            if_score = float(self.isolation_forest.decision_function(X_scaled)[0])
            if_anomalous = if_score < -0.2

            # Random Forest classification
            rf_class = self.random_forest.predict(X_scaled)[0]
            rf_proba = self.random_forest.predict_proba(X_scaled)[0]
            rf_confidence = float(rf_proba.max())

            if rf_class == "Benign" and not if_anomalous:
                return {
                    "anomalous": False,
                    "if_score": if_score,
                    "rf_class": rf_class,
                    "rf_confidence": rf_confidence,
                    "category": None,
                    "severity": None,
                }

            # Determine category and severity
            if if_anomalous and rf_class != "Benign":
                severity = _CLASS_SEVERITY.get(rf_class, "MEDIUM")
                # Both models agree — escalate to at least HIGH
                if severity in ("LOW", "MEDIUM"):
                    severity = "HIGH"
                category = rf_class
            elif if_anomalous:
                severity = "MEDIUM"
                category = "Unknown Anomaly"
            else:
                severity = _CLASS_SEVERITY.get(rf_class, "MEDIUM")
                category = rf_class

            return {
                "anomalous": True,
                "if_score": if_score,
                "rf_class": rf_class,
                "rf_confidence": rf_confidence,
                "category": category,
                "severity": severity,
            }

        except Exception as exc:
            logger.error("ML prediction failed: %s", exc)
            return None
