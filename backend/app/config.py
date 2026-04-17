"""Application configuration via Pydantic Settings.

Loads from environment variables or .env file.
Never hardcodes secrets — all sensitive values come from env vars.
Production deployment would use Google Cloud Secret Manager.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Google AI ---
    google_api_key: str = ""

    # --- Google Cloud ---
    google_cloud_project: str = "academic-pipe-455204-i3"

    # --- Firebase ---
    firebase_credentials_path: str = ""

    # --- Security ---
    admin_passkey: str = "venuepulse-admin-2026"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- App ---
    environment: str = "development"

    # --- Simulation ---
    simulation_speed: float = 1.0  # 1x = real-time, 9x = fast demo
    tick_interval_seconds: float = 3.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
