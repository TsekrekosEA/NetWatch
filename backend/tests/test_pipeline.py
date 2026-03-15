"""Tests for the detection pipeline — rate limiting and orchestration."""

import time
import pytest
from detection.pipeline import _is_rate_limited, _last_alert


class TestRateLimiter:
    def setup_method(self):
        """Clear the rate limiter state before each test."""
        _last_alert.clear()

    def test_first_alert_not_limited(self):
        assert _is_rate_limited("10.0.0.1", "DoS") is False

    def test_repeat_alert_limited(self):
        _is_rate_limited("10.0.0.1", "DoS")
        assert _is_rate_limited("10.0.0.1", "DoS") is True

    def test_different_ip_not_limited(self):
        _is_rate_limited("10.0.0.1", "DoS")
        assert _is_rate_limited("10.0.0.2", "DoS") is False

    def test_different_category_not_limited(self):
        _is_rate_limited("10.0.0.1", "DoS")
        assert _is_rate_limited("10.0.0.1", "BruteForce") is False

    def test_alert_allowed_after_window(self, monkeypatch):
        """After the rate limit window expires, a new alert is allowed."""
        from config import settings
        _is_rate_limited("10.0.0.1", "DoS")
        # Move time forward past the window
        future = time.time() + settings.ALERT_RATE_LIMIT_SECONDS + 1
        monkeypatch.setattr(time, "time", lambda: future)
        assert _is_rate_limited("10.0.0.1", "DoS") is False
