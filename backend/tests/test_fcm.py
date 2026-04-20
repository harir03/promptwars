# Coverage target: 70%+ | External calls: all mocked | Test types: unit, edge-case, error-path
"""Tests for the Firebase Cloud Messaging module.

Covers: initialize_firebase, register_token, get_all_tokens,
send_notification, send_broadcast.
"""

import pytest
from unittest.mock import MagicMock, patch

import app.notifications.fcm as fcm_module


@pytest.fixture(autouse=True)
def _reset_fcm_state():
    """Reset the FCM module's global state before each test."""
    fcm_module._fcm_tokens.clear()
    original_init = fcm_module._firebase_initialized
    fcm_module._firebase_initialized = False
    yield
    fcm_module._fcm_tokens.clear()
    fcm_module._firebase_initialized = original_init


class TestRegisterToken:
    """Tests for register_token."""

    def test_registers_new_token_for_user(self):
        fcm_module.register_token("user_1", "token_abc")
        assert fcm_module._fcm_tokens["user_1"] == "token_abc"

    def test_overwrites_existing_token_for_same_user(self):
        fcm_module.register_token("user_1", "old_token")
        fcm_module.register_token("user_1", "new_token")
        assert fcm_module._fcm_tokens["user_1"] == "new_token"

    def test_supports_multiple_users(self):
        fcm_module.register_token("user_1", "token_a")
        fcm_module.register_token("user_2", "token_b")
        assert len(fcm_module._fcm_tokens) == 2


class TestGetAllTokens:
    """Tests for get_all_tokens."""

    def test_returns_empty_dict_when_no_tokens_registered(self):
        assert fcm_module.get_all_tokens() == {}

    def test_returns_copy_not_reference(self):
        fcm_module.register_token("user_1", "token_a")
        tokens = fcm_module.get_all_tokens()
        tokens["user_1"] = "modified"
        assert fcm_module._fcm_tokens["user_1"] == "token_a"


class TestInitializeFirebase:
    """Tests for initialize_firebase."""

    def test_returns_false_for_empty_credentials_path(self):
        result = fcm_module.initialize_firebase("")
        assert result is False

    def test_returns_true_if_already_initialized(self):
        fcm_module._firebase_initialized = True
        result = fcm_module.initialize_firebase("any_path")
        assert result is True

    def test_returns_false_when_credentials_file_does_not_exist(self):
        """When the credentials file path is invalid, should return False."""
        result = fcm_module.initialize_firebase("/nonexistent/path/creds.json")
        assert result is False


class TestSendNotification:
    """Tests for send_notification (async)."""

    @pytest.mark.asyncio
    async def test_returns_false_when_user_has_no_token(self):
        result = await fcm_module.send_notification(
            user_id="unknown_user",
            title="Test",
            body="Hello",
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_true_when_simulated_and_token_exists(self):
        fcm_module.register_token("user_1", "fake_token")
        fcm_module._firebase_initialized = False
        result = await fcm_module.send_notification(
            user_id="user_1",
            title="Order Ready",
            body="Pick up at Counter 3",
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_accepts_optional_data_payload(self):
        fcm_module.register_token("user_1", "fake_token")
        result = await fcm_module.send_notification(
            user_id="user_1",
            title="Alert",
            body="Surge incoming",
            data={"type": "surge_alert", "vibrate": "true"},
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_when_user_id_not_found(self):
        result = await fcm_module.send_notification(
            user_id="nonexistent",
            title="Test",
            body="Body",
        )
        assert result is False


class TestSendBroadcast:
    """Tests for send_broadcast (async)."""

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_users_registered(self):
        sent = await fcm_module.send_broadcast(
            title="Alert",
            body="Everyone leave",
        )
        assert sent == 0

    @pytest.mark.asyncio
    async def test_sends_to_all_registered_users(self):
        fcm_module.register_token("user_1", "token_a")
        fcm_module.register_token("user_2", "token_b")
        fcm_module._firebase_initialized = False  # Simulated mode

        sent = await fcm_module.send_broadcast(
            title="Broadcast",
            body="Stadium closing",
        )
        assert sent == 2
