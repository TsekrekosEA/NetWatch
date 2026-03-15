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
    STAT_THRESHOLD: float = 3.5
    ROLLING_WINDOW_SIZE: int = 1000
    ML_MODELS_PATH: str = "./ml/models"
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
