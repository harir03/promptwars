"""Tests for the rate limiter middleware.

Covers:
- Allowing requests within limit
- Blocking requests over limit
- Sliding window expiry
- Per-key isolation
"""

import time

import pytest
from fastapi import HTTPException

from app.middleware.rate_limiter import RateLimiter


@pytest.fixture
def limiter() -> RateLimiter:
    return RateLimiter(max_requests=3, window_seconds=5)


# ── Basic Functionality ───────────────────────────────────────────

class TestRateLimiterBasic:
    def test_allows_requests_within_limit(self, limiter: RateLimiter):
        for _ in range(3):
            limiter.check("user1")  # Should not raise

    def test_blocks_over_limit(self, limiter: RateLimiter):
        for _ in range(3):
            limiter.check("user1")
        with pytest.raises(HTTPException) as exc_info:
            limiter.check("user1")
        assert exc_info.value.status_code == 429

    def test_429_has_retry_after(self, limiter: RateLimiter):
        for _ in range(3):
            limiter.check("user1")
        with pytest.raises(HTTPException) as exc_info:
            limiter.check("user1")
        assert "Retry-After" in exc_info.value.headers


# ── Key Isolation ─────────────────────────────────────────────────

class TestKeyIsolation:
    def test_different_keys_independent(self, limiter: RateLimiter):
        for _ in range(3):
            limiter.check("user1")
        # user2 should be unaffected
        limiter.check("user2")  # Should not raise

    def test_block_only_offending_key(self, limiter: RateLimiter):
        for _ in range(3):
            limiter.check("user1")
        with pytest.raises(HTTPException):
            limiter.check("user1")
        # user2 still fine
        limiter.check("user2")


# ── Sliding Window ────────────────────────────────────────────────

class TestSlidingWindow:
    def test_expired_requests_cleaned(self):
        limiter = RateLimiter(max_requests=2, window_seconds=1)
        limiter.check("user1")
        limiter.check("user1")
        # Wait for window to expire
        time.sleep(1.1)
        limiter.check("user1")  # Should be allowed now
