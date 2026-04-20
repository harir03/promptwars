"""Security middleware for FastAPI.

Adds security headers (P17), request logging, and CORS configuration.
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Generate request ID for tracing
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        # Time the request
        start = time.time()

        response = await call_next(request)

        duration = time.time() - start

        # Security headers (OWASP A05)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https://www.google-analytics.com; "
            "connect-src 'self' ws: wss: https://www.google-analytics.com "
            "https://generativelanguage.googleapis.com; "
            "frame-ancestors 'none'"
        )
        response.headers["X-Request-ID"] = request_id

        # Structured logging — parameterized format (no f-string in hot path)
        logger.info(
            "[%s] %s %s → %s (%.3fs)",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration,
        )

        return response
