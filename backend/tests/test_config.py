# Coverage target: 70%+ | External calls: all mocked | Test types: unit, edge-case, error-path
"""Tests for the application configuration module.

Covers: Settings, cors_origin_list, is_production, get_settings,
validate_startup_secrets.
"""

import os

import pytest
from unittest.mock import patch

from app.config import Settings, get_settings, validate_startup_secrets


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    """Ensure settings cache is fresh for each test."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class TestSettings:
    """Tests for the Settings Pydantic model."""

    def test_default_environment_is_development(self):
        settings = Settings(admin_passkey="test", google_api_key="")
        assert settings.environment == "development"

    def test_default_google_api_key_is_empty(self):
        settings = Settings()
        assert settings.google_api_key == ""

    def test_default_admin_passkey_is_empty_when_no_env_set(self):
        with patch.dict(os.environ, {"ADMIN_PASSKEY": ""}, clear=False):
            settings = Settings()
            assert settings.admin_passkey == ""

    def test_simulation_speed_defaults_to_1(self):
        settings = Settings()
        assert settings.simulation_speed == 1.0

    def test_tick_interval_defaults_to_3_seconds(self):
        settings = Settings()
        assert settings.tick_interval_seconds == 3.0


class TestCorsOriginList:
    """Tests for Settings.cors_origin_list parsing."""

    def test_parses_comma_separated_origins(self):
        settings = Settings(cors_origins="http://a.com,http://b.com")
        assert settings.cors_origin_list == ["http://a.com", "http://b.com"]

    def test_strips_whitespace_from_origins(self):
        settings = Settings(cors_origins=" http://a.com , http://b.com ")
        assert settings.cors_origin_list == ["http://a.com", "http://b.com"]

    def test_ignores_empty_entries(self):
        settings = Settings(cors_origins="http://a.com,,http://b.com,")
        assert settings.cors_origin_list == ["http://a.com", "http://b.com"]

    def test_single_origin(self):
        settings = Settings(cors_origins="http://localhost:3000")
        assert settings.cors_origin_list == ["http://localhost:3000"]

    def test_empty_string_returns_empty_list(self):
        settings = Settings(cors_origins="")
        assert settings.cors_origin_list == []


class TestIsProduction:
    """Tests for Settings.is_production property."""

    def test_returns_true_for_production_environment(self):
        settings = Settings(environment="production")
        assert settings.is_production is True

    def test_returns_false_for_development_environment(self):
        settings = Settings(environment="development")
        assert settings.is_production is False

    def test_returns_false_for_nonstandard_environment(self):
        settings = Settings(environment="staging")
        assert settings.is_production is False


class TestGetSettings:
    """Tests for the cached get_settings function."""

    def test_returns_settings_instance(self):
        settings = get_settings()
        assert isinstance(settings, Settings)

    def test_returns_same_cached_instance_on_repeat_calls(self):
        first = get_settings()
        second = get_settings()
        assert first is second


class TestValidateStartupSecrets:
    """Tests for validate_startup_secrets."""

    def test_does_not_raise_in_development_without_secrets(self):
        """In dev mode, missing secrets emit warnings but don't crash."""
        with patch.dict(os.environ, {
            "ENVIRONMENT": "development",
            "GOOGLE_API_KEY": "",
            "ADMIN_PASSKEY": "",
        }):
            get_settings.cache_clear()
            validate_startup_secrets()  # Should not raise

    def test_raises_in_production_without_google_api_key(self):
        with patch.dict(os.environ, {
            "ENVIRONMENT": "production",
            "GOOGLE_API_KEY": "",
            "ADMIN_PASSKEY": "some-key",
        }):
            get_settings.cache_clear()
            with pytest.raises(AssertionError, match="GOOGLE_API_KEY"):
                validate_startup_secrets()

    def test_raises_in_production_without_admin_passkey(self):
        with patch.dict(os.environ, {
            "ENVIRONMENT": "production",
            "GOOGLE_API_KEY": "some-key",
            "ADMIN_PASSKEY": "",
        }):
            get_settings.cache_clear()
            with pytest.raises(AssertionError, match="ADMIN_PASSKEY"):
                validate_startup_secrets()
