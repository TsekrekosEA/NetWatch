"""Tests for Stage 2: ML classifier wrapper."""

import pytest
from detection.stage2_ml import MLClassifier, _CLASS_SEVERITY


class TestMLClassifier:
    def test_predict_returns_none_when_not_loaded(self, sample_features):
        """When models aren't loaded, predict() should return None."""
        clf = MLClassifier(models_path="/nonexistent")
        assert clf.is_loaded is False
        assert clf.predict(sample_features) is None

    def test_load_missing_models(self, tmp_path):
        """Loading from a directory with no model files should log a warning and not crash."""
        clf = MLClassifier(models_path=str(tmp_path))
        clf.load()
        assert clf.is_loaded is False

    def test_class_severity_mapping(self):
        """All expected attack classes should have severity mappings."""
        assert _CLASS_SEVERITY["Benign"] == "NONE"
        assert _CLASS_SEVERITY["DoS"] == "CRITICAL"
        assert _CLASS_SEVERITY["DDoS"] == "CRITICAL"
        assert _CLASS_SEVERITY["BruteForce"] == "HIGH"

    def test_load_real_models_if_available(self):
        """If trained models exist, they should load successfully."""
        import os
        models_path = os.path.join(os.path.dirname(__file__), "..", "ml", "models")
        if not os.path.exists(os.path.join(models_path, "random_forest.joblib")):
            pytest.skip("Trained models not available")

        clf = MLClassifier(models_path=models_path)
        clf.load()
        assert clf.is_loaded is True

    def test_predict_with_real_models(self, sample_features):
        """Integration test: predict with real models if available."""
        import os
        models_path = os.path.join(os.path.dirname(__file__), "..", "ml", "models")
        if not os.path.exists(os.path.join(models_path, "random_forest.joblib")):
            pytest.skip("Trained models not available")

        clf = MLClassifier(models_path=models_path)
        clf.load()
        result = clf.predict(sample_features)
        assert result is not None
        assert "anomalous" in result
        assert "rf_class" in result
        assert "rf_confidence" in result
        assert "if_score" in result
        assert isinstance(result["rf_confidence"], float)
        assert 0 <= result["rf_confidence"] <= 1
