"""Firebase Cloud Messaging integration for push notifications.

Handles sending notifications to attendees for:
- Surge alerts
- Reward offers
- Food order ready (wristband demo)

FCM tokens stored in-memory (P18 — production would use Firestore).
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# In-memory FCM token store (user_id → token)
_fcm_tokens: dict[str, str] = {}

# Firebase app initialization flag
_firebase_initialized = False


def initialize_firebase(credentials_path: str) -> bool:
    """Initialize Firebase Admin SDK.

    Args:
        credentials_path: Path to the service account JSON file.

    Returns:
        True if initialized successfully, False otherwise.
    """
    global _firebase_initialized

    if _firebase_initialized:
        return True

    if not credentials_path:
        logger.warning("No Firebase credentials path configured — FCM will be simulated")
        return False

    try:
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(credentials_path)
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
        return True
    except Exception as e:
        logger.error("Failed to initialize Firebase: %s", e)
        return False


def register_token(user_id: str, token: str) -> None:
    """Register or update an FCM token for a user.

    Args:
        user_id: User identifier.
        token: FCM registration token from the client.
    """
    _fcm_tokens[user_id] = token
    logger.info("FCM token registered for user %s", user_id)


def get_all_tokens() -> dict[str, str]:
    """Get all registered FCM tokens."""
    return dict(_fcm_tokens)


async def send_notification(
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """Send a push notification to a specific user.

    Args:
        user_id: Target user.
        title: Notification title.
        body: Notification body text.
        data: Optional data payload (includes vibrate flag for wristband).

    Returns:
        True if sent successfully, False if failed or simulated.
    """
    token = _fcm_tokens.get(user_id)

    if not token:
        logger.debug("No FCM token for user %s — notification skipped", user_id)
        return False

    if not _firebase_initialized:
        logger.info("[SIMULATED] FCM to %s: %s — %s", user_id, title, body)
        return True

    try:
        from firebase_admin import messaging

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=token,
        )

        response = messaging.send(message)
        logger.info("FCM sent to %s: %s", user_id, response)
        return True
    except Exception as e:
        logger.error("FCM send failed for %s: %s", user_id, e)
        return False


async def send_broadcast(
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    """Send a notification to all registered users.

    Args:
        title: Notification title.
        body: Notification body text.
        data: Optional data payload.

    Returns:
        Number of notifications sent successfully.
    """
    sent = 0
    for user_id in list(_fcm_tokens.keys()):
        if await send_notification(user_id, title, body, data):
            sent += 1
    return sent
