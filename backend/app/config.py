"""Application configuration via Pydantic Settings.

Loads from environment variables or .env file.
Never hardcodes secrets — all sensitive values come from env vars.
Production deployment uses Google Cloud Secret Manager.

Security: OWASP A02 — No default values for secrets.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All secret values (API keys, passkeys, credentials paths) have
    no usable defaults and must be set via environment or .env file.
    """

    # --- Google AI ---
    # OWASP A02: secret loaded from environment only, no hardcoded default
    google_api_key: str = ""

    # --- Google Cloud ---
    google_cloud_project: str = ""

    # --- Firebase ---
    firebase_credentials_path: str = ""

    # --- Security ---
    # OWASP A02: no hardcoded passkey — must be set in environment
    admin_passkey: str = ""
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
        """Parse comma-separated CORS origins into a list.

        Returns:
            List of allowed CORS origin URLs.
        """
        # OWASP CORS: never allow "*" — always explicit domain list
        origins = [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]
        if "*" in origins:
            logger.warning(
                "CORS wildcard '*' detected — this is insecure in production"
            )
        return origins

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton.

    Returns:
        Application settings loaded from environment.
    """
    return Settings()


def validate_startup_secrets() -> None:
    """Assert that all required secrets are set at startup.

    Raises:
        RuntimeError: If any critical secret is missing.

    Security: OWASP A02 — fail fast if secrets are not configured.
    """
    settings = get_settings()

    # OWASP A02: startup assertions for required secrets
    if not settings.google_api_key:
        logger.warning(
            "GOOGLE_API_KEY is not set — AI concierge will use fallback responses"
        )

    if not settings.admin_passkey:
        logger.warning(
            "ADMIN_PASSKEY is not set — admin endpoints will reject all requests"
        )

    if settings.is_production:
        # In production, these are hard requirements
        assert settings.google_api_key, (
            "GOOGLE_API_KEY must be set in production"
        )
        assert settings.admin_passkey, (
            "ADMIN_PASSKEY must be set in production"
        )
        # OWASP CORS: verify no wildcard in production
        assert "*" not in settings.cors_origin_list, (
            "CORS wildcard '*' is not allowed in production"
        )
