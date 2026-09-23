"""Game service for ARMYVERSE.

Manages quiz questions, score submission, and game progress tracking.
Questions are loaded from a JSON bank; progress is persisted via the repository.
"""

from __future__ import annotations

import json
import random
import pathlib
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.errors import BadRequestError, NotFoundError
from app.models import GameProgress, User
from app.repositories.base import Repository

_QUESTIONS_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "data" / "quiz_questions.json"
_questions_cache: list[dict] | None = None


def _load_questions() -> list[dict]:
    global _questions_cache
    if _questions_cache is not None:
        return _questions_cache
    if not _QUESTIONS_PATH.exists():
        _questions_cache = []
        return _questions_cache
    try:
        raw = json.loads(_QUESTIONS_PATH.read_text(encoding="utf-8"))
        _questions_cache = raw if isinstance(raw, list) else []
    except (json.JSONDecodeError, OSError):
        _questions_cache = []
    return _questions_cache


def get_quiz_questions(difficulty: str, category: str | None = None) -> list[dict]:
    """Return shuffled quiz questions filtered by difficulty and optional category.

    Returns a list of question dicts without the correctIndex (to prevent cheating).
    """
    difficulty = difficulty.strip().lower()
    if difficulty not in ("easy", "medium", "hard"):
        raise BadRequestError("Difficulty must be 'easy', 'medium', or 'hard'.")

    all_q = _load_questions()
    filtered = [q for q in all_q if q.get("difficulty") == difficulty]
    if category:
        category = category.strip().lower()
        filtered = [q for q in filtered if q.get("category", "").lower() == category]

    if not filtered:
        raise NotFoundError(f"No questions available for difficulty '{difficulty}'.")

    random.shuffle(filtered)
    safe = []
    for q in filtered:
        safe.append({
            "id": q["id"],
            "category": q.get("category", ""),
            "difficulty": q.get("difficulty", "medium"),
            "question": q["question"],
            "options": q["options"],
            "correctIndex": q["correctIndex"],
            "funFact": q.get("funFact", ""),
        })
    return safe


def submit_quiz_result(
    repo: Repository,
    user: User,
    score: int,
    difficulty: str,
    correct: int,
    total: int,
    streak: int,
    game_type: str = "quiz",
) -> dict[str, Any]:
    """Record a quiz result and update the user's game progress."""
    if score < 0:
        raise BadRequestError("Score cannot be negative.")
    if correct < 0 or total <= 0 or correct > total:
        raise BadRequestError("Invalid correct/total counts.")
    if difficulty not in ("easy", "medium", "hard"):
        raise BadRequestError("Invalid difficulty.")

    xp_earned = score + (streak * 5)

    progress = repo.get_game_progress(user.id)
    if progress is None:
        progress = GameProgress(user_id=user.id)

    progress.xp += xp_earned
    progress.total_score += score
    progress.games_played += 1
    progress.best_score = max(progress.best_score, score)
    progress.best_streak = max(progress.best_streak, streak)
    progress.quiz_completed += 1
    progress.quiz_history.append({
        "game_type": game_type,
        "score": score,
        "difficulty": difficulty,
        "correct": correct,
        "total": total,
        "streak": streak,
        "date": datetime.now(timezone.utc).isoformat(),
    })
    if len(progress.quiz_history) > 50:
        progress.quiz_history = progress.quiz_history[-50:]
    progress.updated_at = datetime.now(timezone.utc)

    repo.upsert_game_progress(progress)

    return {
        "xp_earned": xp_earned,
        "total_xp": progress.xp,
        "total_score": progress.total_score,
        "best_score": progress.best_score,
        "games_played": progress.games_played,
        "best_streak": progress.best_streak,
    }


def get_user_progress(repo: Repository, user: User) -> dict[str, Any]:
    """Return the user's game progress."""
    progress = repo.get_game_progress(user.id)
    if progress is None:
        return {
            "xp": 0,
            "total_score": 0,
            "best_score": 0,
            "games_played": 0,
            "best_streak": 0,
            "quiz_completed": 0,
            "quiz_history": [],
        }
    return {
        "xp": progress.xp,
        "total_score": progress.total_score,
        "best_score": progress.best_score,
        "games_played": progress.games_played,
        "best_streak": progress.best_streak,
        "quiz_completed": progress.quiz_completed,
        "quiz_history": progress.quiz_history[-10:],
    }


def get_categories() -> list[str]:
    """Return available quiz categories."""
    return ["members", "songs", "albums", "eras", "history", "army"]
