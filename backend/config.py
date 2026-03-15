"""
NetWatch Backend — Application configuration.

All settings are read from environment variables with sensible defaults for
local development and Docker Compose deployment.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Backend configuration loaded from environment variables."""

    DATABASE_URL: str = "sqlite+aiosqlite:///./netwatch.db"
    CAPTURE_TOKEN: str = "change-me-in-production"
    ML_MODELS_PATH: str = "./ml/models"
    LOG_LEVEL: str = "INFO"

    # Stage 1: Statistical baseline
    STAT_THRESHOLD: float = 3.5
    ROLLING_WINDOW_SIZE: int = 1000
    STAT_WARMUP: int = 30
    SEVERITY_MEDIUM_THRESHOLD: int = 3
    SEVERITY_HIGH_THRESHOLD: int = 6

    # Stage 2: ML classifier
    IF_THRESHOLD: float = -0.2
    RF_CONFIDENCE_THRESHOLD: float = 0.4

    # Alert rate limiting (seconds) — suppress duplicate alerts per src_ip+category
    ALERT_RATE_LIMIT_SECONDS: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
