"""Games routes.

Provides endpoints for the BTS Quiz game: question retrieval, score submission,
and user progress tracking.
"""

import time
from typing import Optional

import httpx
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, Query, Request

from app.api.dependencies import get_current_user, get_db, get_optional_user
from app.core.rate_limit import limiter, default_limit
from app.models import User
from app.repositories.base import Repository
from app.services import game_service

router = APIRouter(prefix="/api/games", tags=["games"])

# Deezer preview URLs are signed with a short-lived token (~1 hour), so cache
# each resolved URL together with the time it was fetched and re-fetch once it
# has expired.
_preview_cache: dict[int, tuple[str, float]] = {}
_PREVIEW_CACHE_TTL_SECONDS = 45 * 60


class PreviewsRequest(BaseModel):
    deezerIds: list[int] = Field(..., min_length=1, max_length=30)


@router.post("/songs/previews")
async def get_song_previews(payload: PreviewsRequest):
    """Resolve Deezer track IDs to their 30-second preview MP3 URLs.

    Deezer's public API has no CORS support, so the backend proxies the
    lookups and caches the preview URLs in memory (with a short TTL because
    the signed links expire).
    """
    now = time.time()
    to_fetch = [
        did
        for did in payload.deezerIds
        if did not in _preview_cache
        or now - _preview_cache[did][1] > _PREVIEW_CACHE_TTL_SECONDS
    ]

    if to_fetch:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for did in to_fetch:
                try:
                    response = await client.get(f"https://api.deezer.com/track/{did}")
                    if response.status_code == 200:
                        data = response.json()
                        if isinstance(data, dict) and data.get("preview"):
                            _preview_cache[did] = (data["preview"], now)
                except httpx.HTTPError:
                    continue

    previews = {
        did: url
        for did in payload.deezerIds
        if (entry := _preview_cache.get(did)) and (url := entry[0])
    }
    return {"success": True, "previews": previews}


@router.get("/quiz/questions")
def get_quiz_questions(
    request: Request,
    difficulty: str = Query("easy", pattern="^(easy|medium|hard)$"),
    category: Optional[str] = Query(None),
    viewer: User | None = Depends(get_optional_user),
):
    """Get shuffled quiz questions for the given difficulty.

    No authentication required — guests can play, but progress won't be saved.
    """
    questions = game_service.get_quiz_questions(difficulty, category)
    return {
        "success": True,
        "questions": questions,
        "total": len(questions),
        "difficulty": difficulty,
        "authenticated": viewer is not None,
    }


@router.post("/quiz/submit")
@limiter.limit(lambda: default_limit())
def submit_quiz(
    request: Request,
    payload: dict,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    """Submit quiz results and update game progress (auth required)."""
    score = payload.get("score", 0)
    difficulty = payload.get("difficulty", "easy")
    correct = payload.get("correct", 0)
    total = payload.get("total", 0)
    streak = payload.get("streak", 0)
    game_type = payload.get("game_type", "quiz")

    result = game_service.submit_quiz_result(
        repo=repo,
        user=current_user,
        score=score,
        difficulty=difficulty,
        correct=correct,
        total=total,
        streak=streak,
        game_type=game_type,
    )
    return {"success": True, **result}


@router.get("/progress")
def get_progress(
    request: Request,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    """Get the current user's game progress (auth required)."""
    progress = game_service.get_user_progress(repo, current_user)
    return {"success": True, "progress": progress}


@router.get("/categories")
def get_categories():
    """Get available quiz categories."""
    categories = game_service.get_categories()
    return {"success": True, "categories": categories}
