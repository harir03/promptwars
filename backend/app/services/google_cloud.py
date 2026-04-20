"""Google Cloud service integrations for VenuePulse.

Provides unified initialization and access to Google Cloud services:
- Cloud Logging: Structured log transport for production monitoring
- Firestore: Persistent storage for rewards, wallets, and analytics
- Secret Manager: Secure secret retrieval for production credentials

All integrations degrade gracefully — if credentials are unavailable,
the system falls back to local implementations (in-memory storage,
stderr logging, environment variables).

Google Services:
- Cloud Logging (google-cloud-logging)
- Firestore (google-cloud-firestore)
- Secret Manager (google-cloud-secret-manager)
- Gemini AI (google-genai) — initialized in agent/concierge.py
- Firebase Cloud Messaging (firebase-admin) — initialized in notifications/fcm.py
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ── State ────────────────────────────────────────────────────────────────
_firestore_client: Any = None
_cloud_logging_enabled: bool = False


# ── Cloud Logging ────────────────────────────────────────────────────────

def setup_cloud_logging(project_id: str = "") -> bool:
    """Initialize Google Cloud Logging for structured log transport.

    Replaces stderr logging with Cloud Logging in production.
    All Python logger output is automatically sent to Cloud Logging.

    Args:
        project_id: Google Cloud project ID. Auto-detected if omitted.

    Returns:
        True if Cloud Logging was set up, False if falling back to stderr.
    """
    global _cloud_logging_enabled

    if _cloud_logging_enabled:
        return True

    try:
        import google.cloud.logging as cloud_logging

        client = cloud_logging.Client(project=project_id or None)
        client.setup_logging(log_level=logging.INFO)
        _cloud_logging_enabled = True
        logger.info("Cloud Logging initialized — logs routed to Google Cloud")
        return True
    except Exception as e:
        logger.warning(
            "Cloud Logging not available — using stderr: %s", e
        )
        return False


# ── Firestore ────────────────────────────────────────────────────────────

def init_firestore(project_id: str = "") -> bool:
    """Initialize Firestore client for persistent data storage.

    Used for storing:
    - Reward offer history
    - User wallets and points
    - Crowd analytics snapshots
    - Session audit logs

    Args:
        project_id: Google Cloud project ID. Auto-detected if omitted.

    Returns:
        True if Firestore was initialized, False otherwise.
    """
    global _firestore_client

    if _firestore_client is not None:
        return True

    try:
        from google.cloud import firestore

        _firestore_client = firestore.AsyncClient(project=project_id or None)
        logger.info("Firestore client initialized — persistent storage active")
        return True
    except Exception as e:
        logger.warning(
            "Firestore not available — using in-memory storage: %s", e
        )
        return False


def get_firestore_client() -> Any:
    """Get the Firestore client instance.

    Returns:
        Firestore AsyncClient or None if not initialized.
    """
    return _firestore_client


async def firestore_save_document(
    collection: str, doc_id: str, data: dict
) -> bool:
    """Save a document to Firestore.

    Args:
        collection: Firestore collection name.
        doc_id: Document ID.
        data: Document data as a dict.

    Returns:
        True if saved successfully, False if Firestore unavailable.
    """
    if _firestore_client is None:
        return False

    try:
        doc_ref = _firestore_client.collection(collection).document(doc_id)
        await doc_ref.set(data, merge=True)
        logger.info(
            "Firestore: saved %s/%s", collection, doc_id
        )
        return True
    except Exception as e:
        logger.error(
            "Firestore write failed for %s/%s: %s", collection, doc_id, e
        )
        return False


async def firestore_get_document(
    collection: str, doc_id: str
) -> dict | None:
    """Retrieve a document from Firestore.

    Args:
        collection: Firestore collection name.
        doc_id: Document ID.

    Returns:
        Document data as dict, or None if not found or unavailable.
    """
    if _firestore_client is None:
        return None

    try:
        doc_ref = _firestore_client.collection(collection).document(doc_id)
        doc = await doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        logger.error(
            "Firestore read failed for %s/%s: %s", collection, doc_id, e
        )
        return None


async def firestore_save_analytics_snapshot(snapshot_data: dict) -> bool:
    """Save a crowd analytics snapshot to Firestore for historical tracking.

    Args:
        snapshot_data: Crowd snapshot data dict.

    Returns:
        True if saved, False if Firestore unavailable.
    """
    import time

    doc_id = f"snapshot_{int(time.time())}"
    return await firestore_save_document("analytics_snapshots", doc_id, snapshot_data)


# ── Secret Manager ───────────────────────────────────────────────────────

def get_secret(secret_id: str, project_id: str = "") -> str | None:
    """Retrieve a secret from Google Cloud Secret Manager.

    Falls back to environment variables if Secret Manager is unavailable.

    Args:
        secret_id: The secret name in Secret Manager.
        project_id: Google Cloud project ID. Auto-detected if omitted.

    Returns:
        The secret value as a string, or None if not found.
    """
    # Try Secret Manager first
    try:
        from google.cloud import secretmanager

        client = secretmanager.SecretManagerServiceClient()
        project = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT", "")

        if not project:
            raise ValueError("No project ID available")

        name = f"projects/{project}/secrets/{secret_id}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        secret_value = response.payload.data.decode("UTF-8")
        logger.info("Secret '%s' loaded from Secret Manager", secret_id)
        return secret_value
    except Exception as e:
        logger.debug(
            "Secret Manager not available for '%s', falling back to env: %s",
            secret_id, e,
        )

    # Fallback: environment variable (uppercase, underscore-separated)
    env_key = secret_id.upper().replace("-", "_")
    value = os.environ.get(env_key)
    if value:
        logger.info("Secret '%s' loaded from environment variable", secret_id)
    return value


# ── Unified Initialization ───────────────────────────────────────────────

def initialize_google_services(
    project_id: str = "",
    is_production: bool = False,
) -> dict[str, bool]:
    """Initialize all Google Cloud services.

    Called during FastAPI lifespan startup. Each service initializes
    independently — failure in one does not affect others.

    Args:
        project_id: Google Cloud project ID.
        is_production: Whether running in production mode.

    Returns:
        Dict mapping service name to initialization success.
    """
    results: dict[str, bool] = {}

    # Cloud Logging — production only (local dev uses stderr)
    if is_production:
        results["cloud_logging"] = setup_cloud_logging(project_id)
    else:
        results["cloud_logging"] = False
        logger.info("Cloud Logging skipped — development mode")

    # Firestore — always try (falls back to in-memory)
    results["firestore"] = init_firestore(project_id)

    logger.info(
        "Google Cloud services initialized: %s",
        {k: "✓" if v else "✗" for k, v in results.items()},
    )

    return results
