"""AI agent chat API routes.

POST /api/agent/chat — Send message to AI concierge.
Rate limited to 10 requests per minute per session (P16).

Security:
- OWASP A03: Request body validated via Pydantic model.
- OWASP A05: Exceptions caught and sanitized before response.
- Rate limited per session_id to prevent abuse.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.crowd.models import ChatRequest, ChatResponse
from app.middleware.rate_limiter import chat_rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["Agent"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    """Send a message to the AI venue concierge.

    The agent has access to live crowd data, predictions,
    and reward offers via function calling tools.

    Args:
        request: FastAPI request with app state.
        body: Chat message with session_id and seat_section.

    Returns:
        AI concierge response with suggestions.

    Raises:
        HTTPException: 429 if rate limited, 500 on internal error.
    """
    # OWASP A03: rate limit check using session_id (P16)
    chat_rate_limiter.check(body.session_id)

    try:
        concierge = request.app.state.concierge
        result = await concierge.chat(
            message=body.message,
            session_id=body.session_id,
            seat_section=body.seat_section,
        )
        return ChatResponse(**result)
    except HTTPException:
        raise
    except Exception:
        # OWASP A05: log full error server-side, never expose to client
        request_id = getattr(request.state, "request_id", "unknown")
        logger.exception(
            "Chat error [request_id=%s]", request_id
        )
        raise HTTPException(
            status_code=500,
            detail="An error occurred processing your message",
        )
