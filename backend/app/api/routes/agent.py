"""AI agent chat API routes.

POST /api/agent/chat — Send message to AI concierge.
Rate limited to 10 requests per minute per session (P16).
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.crowd.models import ChatRequest, ChatResponse
from app.middleware.rate_limiter import chat_rate_limiter

router = APIRouter(prefix="/api/agent", tags=["Agent"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    """Send a message to the AI venue concierge.

    The agent has access to live crowd data, predictions,
    and reward offers via function calling tools.
    """
    # Rate limit check (P16)
    chat_rate_limiter.check(body.session_id)

    # Get the concierge from app state
    concierge = request.app.state.concierge

    result = await concierge.chat(
        message=body.message,
        session_id=body.session_id,
        seat_section=body.seat_section,
    )

    return ChatResponse(**result)
