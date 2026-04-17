"""In-memory rate limiter for API endpoints.

Uses a sliding window counter per session_id (P16).
Returns 429 Too Many Requests when limit is exceeded.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    """Sliding window rate limiter.

    Tracks request timestamps per key and rejects requests
    that exceed the configured limit within the time window.
    """

    def __init__(self, max_requests: int = 10, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        """Check if the request is within rate limits.

        Args:
            key: The rate limit key (e.g., session_id or IP).

        Raises:
            HTTPException: 429 if rate limit exceeded.
        """
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old entries
        self._requests[key] = [
            ts for ts in self._requests[key] if ts > window_start
        ]

        # Check limit
        if len(self._requests[key]) >= self.max_requests:
            retry_after = int(self._requests[key][0] + self.window_seconds - now) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

        # Record this request
        self._requests[key].append(now)


# Singleton instance for the chat endpoint
chat_rate_limiter = RateLimiter(max_requests=10, window_seconds=60)
