"""Tests for Google Cloud services integration.

Tests cover: Cloud Logging, Firestore, Secret Manager initialization
and graceful degradation when credentials are unavailable.
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.google_cloud import (
    firestore_get_document,
    firestore_save_analytics_snapshot,
    firestore_save_document,
    get_secret,
    init_firestore,
    initialize_google_services,
    setup_cloud_logging,
)


class TestSetupCloudLogging:
    """Tests for Cloud Logging initialization."""

    def test_returns_false_when_library_unavailable(self):
        """Cloud Logging falls back gracefully when not installed."""
        with patch.dict("sys.modules", {"google.cloud.logging": None}):
            # Reset state
            import app.services.google_cloud as gc
            gc._cloud_logging_enabled = False
            result = setup_cloud_logging()
            assert result is False

    def test_returns_false_when_credentials_missing(self):
        """Cloud Logging returns False without GCP credentials."""
        import app.services.google_cloud as gc
        gc._cloud_logging_enabled = False
        # Will fail because no credentials are available in test
        result = setup_cloud_logging("test-project")
        assert result is False


class TestInitFirestore:
    """Tests for Firestore client initialization."""

    def test_returns_false_when_credentials_missing(self):
        """Firestore returns False without GCP credentials."""
        import app.services.google_cloud as gc
        gc._firestore_client = None
        result = init_firestore("test-project")
        assert result is False

    def test_returns_true_when_already_initialized(self):
        """Firestore returns True if already initialized."""
        import app.services.google_cloud as gc
        gc._firestore_client = MagicMock()  # Simulate initialized
        result = init_firestore()
        assert result is True
        gc._firestore_client = None  # Cleanup


class TestFirestoreSaveDocument:
    """Tests for Firestore document operations."""

    @pytest.mark.asyncio
    async def test_returns_false_when_client_not_initialized(self):
        """Save returns False when Firestore client is None."""
        import app.services.google_cloud as gc
        gc._firestore_client = None
        result = await firestore_save_document("test", "doc1", {"key": "val"})
        assert result is False

    @pytest.mark.asyncio
    async def test_save_document_calls_firestore(self):
        """Save calls Firestore set with correct args."""
        import app.services.google_cloud as gc

        mock_doc = AsyncMock()
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc
        mock_client = MagicMock()
        mock_client.collection.return_value = mock_collection

        gc._firestore_client = mock_client
        result = await firestore_save_document("test_col", "doc1", {"key": "val"})
        assert result is True
        mock_client.collection.assert_called_with("test_col")
        mock_collection.document.assert_called_with("doc1")
        mock_doc.set.assert_called_once()
        gc._firestore_client = None  # Cleanup


class TestFirestoreGetDocument:
    """Tests for Firestore document retrieval."""

    @pytest.mark.asyncio
    async def test_returns_none_when_client_not_initialized(self):
        """Get returns None when Firestore client is None."""
        import app.services.google_cloud as gc
        gc._firestore_client = None
        result = await firestore_get_document("test", "doc1")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_document_not_found(self):
        """Get returns None when document doesn't exist."""
        import app.services.google_cloud as gc

        mock_doc = AsyncMock()
        mock_doc.exists = False
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get.return_value = mock_doc
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_client = MagicMock()
        mock_client.collection.return_value = mock_collection

        gc._firestore_client = mock_client
        result = await firestore_get_document("test", "nonexistent")
        assert result is None
        gc._firestore_client = None


class TestFirestoreAnalyticsSnapshot:
    """Tests for analytics snapshot persistence."""

    @pytest.mark.asyncio
    async def test_returns_false_when_client_unavailable(self):
        """Snapshot save returns False without Firestore."""
        import app.services.google_cloud as gc
        gc._firestore_client = None
        result = await firestore_save_analytics_snapshot({"test": True})
        assert result is False


class TestGetSecret:
    """Tests for Secret Manager integration."""

    def test_falls_back_to_env_var(self):
        """Secret Manager falls back to environment variable."""
        os.environ["TEST_SECRET_KEY"] = "env_value"
        result = get_secret("test-secret-key")
        assert result == "env_value"
        del os.environ["TEST_SECRET_KEY"]

    def test_returns_none_when_no_source_available(self):
        """Returns None when neither Secret Manager nor env var available."""
        result = get_secret("nonexistent-secret-xyz")
        assert result is None


class TestInitializeGoogleServices:
    """Tests for unified service initialization."""

    def test_skips_cloud_logging_in_development(self):
        """Cloud Logging is skipped in development mode."""
        import app.services.google_cloud as gc
        gc._cloud_logging_enabled = False
        gc._firestore_client = None
        results = initialize_google_services(is_production=False)
        assert results["cloud_logging"] is False

    def test_attempts_firestore_regardless_of_mode(self):
        """Firestore initialization is attempted in all modes."""
        import app.services.google_cloud as gc
        gc._firestore_client = None
        results = initialize_google_services(is_production=False)
        assert "firestore" in results
