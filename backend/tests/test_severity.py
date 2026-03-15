"""Tests for the severity scoring and stage combination logic."""

import pytest
from detection.severity import higher_severity, combine_stages


class TestHigherSeverity:
    def test_same_level(self):
        assert higher_severity("HIGH", "HIGH") == "HIGH"

    def test_left_higher(self):
        assert higher_severity("CRITICAL", "LOW") == "CRITICAL"

    def test_right_higher(self):
        assert higher_severity("LOW", "HIGH") == "HIGH"

    def test_all_levels(self):
        levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        for i, a in enumerate(levels):
            for j, b in enumerate(levels):
                result = higher_severity(a, b)
                assert result == levels[max(i, j)]


class TestCombineStages:
    def test_nothing_triggered(self):
        cat, sev, stage = combine_stages(
            {"anomalous": False}, None,
        )
        assert cat == ""
        assert sev == ""
        assert stage == ""

    def test_stat_only(self):
        cat, sev, stage = combine_stages(
            {"anomalous": True, "category": "DoS/Flood", "severity": "MEDIUM"},
            None,
        )
        assert cat == "DoS/Flood"
        assert sev == "MEDIUM"
        assert stage == "statistical"

    def test_ml_only(self):
        cat, sev, stage = combine_stages(
            {"anomalous": False},
            {"anomalous": True, "category": "DDoS", "severity": "CRITICAL"},
        )
        assert cat == "DDoS"
        assert sev == "CRITICAL"
        assert stage == "ml"

    def test_both_ml_preferred(self):
        """When both fire and ML has a specific category, ML wins."""
        cat, sev, stage = combine_stages(
            {"anomalous": True, "category": "Statistical Anomaly", "severity": "LOW"},
            {"anomalous": True, "category": "DoS", "severity": "CRITICAL"},
        )
        assert cat == "DoS"
        assert sev == "CRITICAL"
        assert stage == "both"

    def test_both_stat_preferred_over_unknown_anomaly(self):
        """When ML says 'Unknown Anomaly' and stat has a specific category, stat wins."""
        cat, sev, stage = combine_stages(
            {"anomalous": True, "category": "DoS/Flood", "severity": "MEDIUM"},
            {"anomalous": True, "category": "Unknown Anomaly", "severity": "MEDIUM"},
        )
        assert cat == "DoS/Flood"
        assert sev == "MEDIUM"
        assert stage == "both"

    def test_both_picks_higher_severity(self):
        cat, sev, stage = combine_stages(
            {"anomalous": True, "category": "Port Scan", "severity": "LOW"},
            {"anomalous": True, "category": "BruteForce", "severity": "HIGH"},
        )
        assert sev == "HIGH"
        assert stage == "both"

    def test_ml_not_anomalous_treated_as_none(self):
        cat, sev, stage = combine_stages(
            {"anomalous": True, "category": "RST Flood", "severity": "MEDIUM"},
            {"anomalous": False, "category": None, "severity": None},
        )
        assert cat == "RST Flood"
        assert stage == "statistical"
