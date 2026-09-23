"""AI chat routes.

Provides a chat endpoint that proxies messages to Google Gemini
with a BTS/ARMY-focused personality.  When no AI provider is configured,
returns a friendly fallback message.
"""

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, Request

from app.api.dependencies import get_current_user
from app.core.rate_limit import limiter, ai_limit_for_user
from app.models import User
from app.services.ai_service import send_message

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: list[dict] = Field(default_factory=list, max_length=20)


@router.get("/status")
def ai_status():
    """Check if the AI provider is configured."""
    from app.core.config import get_settings

    configured = get_settings().ai_configured
    return {
        "success": True,
        "configured": configured,
        "message": (
            "ARMY AI is ready to chat!"
            if configured
            else "ARMY AI is not configured yet. The admin can enable it by adding a Gemini API key."
        ),
    }


@router.post("/chat")
@limiter.limit(lambda request: ai_limit_for_user(getattr(request.state, "_ai_user_premium", False)))
async def chat(
    request: Request,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a message to ARMY AI and get a response."""
    request.state._ai_user_premium = getattr(current_user, "is_premium", False)

    clean_history = []
    for msg in payload.history[-20:]:
        if isinstance(msg, dict) and msg.get("role") in ("user", "assistant"):
            clean_history.append({
                "role": msg["role"],
                "content": str(msg.get("content", ""))[:1000],
            })

    result = await send_message(
        message=payload.message,
        history=clean_history,
        user=current_user,
    )
    return {"success": True, **result}
