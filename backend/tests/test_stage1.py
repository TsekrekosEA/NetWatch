"""Tests for Stage 1: Statistical baseline engine."""

import pytest
from detection.stage1_statistical import (
    RollingBaseline,
    _classify_anomaly,
    FEATURE_NAMES,
)


class TestRollingBaseline:
    """Tests for the RollingBaseline z-score detector."""

    def test_no_anomaly_during_warmup(self, sample_features):
        """During the warmup period, nothing should be flagged."""
        bl = RollingBaseline(window_size=100, threshold=3.0, warmup=30)
        for _ in range(29):
            result = bl.update_and_check(sample_features)
            assert result["anomalous"] is False

    def test_identical_values_not_anomalous(self, sample_features):
        """Constant features → zero std → no anomalies."""
        bl = RollingBaseline(window_size=100, threshold=3.0, warmup=10)
        for _ in range(50):
            result = bl.update_and_check(sample_features)
        assert result["anomalous"] is False

    def test_spike_detected_after_warmup(self, sample_features):
        """A large spike after warmup should be flagged as anomalous."""
        import random
        random.seed(42)
        bl = RollingBaseline(window_size=100, threshold=3.0, warmup=10)
        # Fill warmup with slightly varying values to establish a non-zero std
        for _ in range(50):
            noisy = [v * (1 + random.gauss(0, 0.01)) for v in sample_features]
            bl.update_and_check(noisy)

        # Inject a massive spike in multiple features
        spike = [v * 100 for v in sample_features]
        result = bl.update_and_check(spike)
        assert result["anomalous"] is True
        assert len(result["anomalous_features"]) > 0
        assert result["severity"] in ("LOW", "MEDIUM", "HIGH")
        assert result["category"] is not None

    def test_severity_thresholds(self, sample_features):
        """Severity scales with number of anomalous features."""
        bl = RollingBaseline(
            window_size=100, threshold=3.0, warmup=10,
            severity_medium=3, severity_high=6,
        )
        # 1 anomalous features → LOW
        assert bl._compute_severity(1) == "LOW"
        assert bl._compute_severity(2) == "LOW"
        # 3-5 → MEDIUM
        assert bl._compute_severity(3) == "MEDIUM"
        assert bl._compute_severity(5) == "MEDIUM"
        # 6+ → HIGH
        assert bl._compute_severity(6) == "HIGH"
        assert bl._compute_severity(10) == "HIGH"

    def test_custom_severity_thresholds(self):
        """Custom severity thresholds should work."""
        bl = RollingBaseline(severity_medium=2, severity_high=4)
        assert bl._compute_severity(1) == "LOW"
        assert bl._compute_severity(2) == "MEDIUM"
        assert bl._compute_severity(4) == "HIGH"

    def test_window_count_matches_feature_names(self):
        """Number of rolling windows should match FEATURE_NAMES length."""
        bl = RollingBaseline()
        assert len(bl._windows) == len(FEATURE_NAMES)


class TestClassifyAnomaly:
    """Tests for the anomaly classification logic."""

    def test_port_scan(self):
        result = _classify_anomaly([("syn_flag_count", 5.0), ("duration", 4.0)])
        assert result == "Port Scan"

    def test_dos_flood(self):
        result = _classify_anomaly([("fwd_packet_rate", 6.0), ("fwd_byte_rate", 7.0)])
        assert result == "DoS/Flood"

    def test_rst_flood(self):
        result = _classify_anomaly([("rst_flag_count", 5.0)])
        assert result == "RST Flood"

    def test_syn_storm(self):
        result = _classify_anomaly([("total_fwd_packets", 5.0), ("mean_packet_length", 4.0)])
        assert result == "SYN Storm"

    def test_generic_anomaly(self):
        result = _classify_anomaly([("total_bwd_bytes", 5.0)])
        assert result == "Statistical Anomaly"

    def test_priority_port_scan_over_dos(self):
        """Port Scan takes priority when both patterns match."""
        features = [
            ("syn_flag_count", 5.0),
            ("duration", 4.0),
            ("fwd_packet_rate", 6.0),
            ("fwd_byte_rate", 7.0),
        ]
        result = _classify_anomaly(features)
        assert result == "Port Scan"
