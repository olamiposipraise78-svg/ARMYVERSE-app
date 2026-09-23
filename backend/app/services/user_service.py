"""User and profile business logic."""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.errors import BadRequestError, NotFoundError
from app.models import User
from app.repositories.base import Repository
from app.schemas.user import UserUpdateRequest
from app.serializers.frontend import user_to_frontend


def get_public_user(repo: Repository, user_id: str) -> dict:
    # Resolve by internal id first, then by username (profile URLs use usernames).
    user = repo.get_user_by_id(user_id) or repo.get_user_by_username(user_id)
    if not user:
        raise NotFoundError("User not found.")
    return user_to_frontend(user)


def update_profile(
    repo: Repository, user_id: str, payload: UserUpdateRequest
) -> dict:
    user = repo.get_user_by_id(user_id)
    if not user:
        raise NotFoundError("User not found.")

    updates: dict = {}
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name.strip()
    if payload.bio is not None:
        updates["bio"] = payload.bio.strip()
    if payload.profile_image is not None:
        updates["profile_image"] = payload.profile_image.strip()
    if payload.avatar_art is not None:
        updates["avatar_art"] = payload.avatar_art.strip()
    if payload.flag is not None:
        updates["flag"] = payload.flag.strip()
    if payload.country is not None:
        updates["country"] = payload.country.strip()

    if not updates:
        raise BadRequestError("Nothing to update.")

    updates["updated_at"] = datetime.now(timezone.utc)
    updated = repo.update_user(user_id, updates)
    return user_to_frontend(updated, is_current=True)


def list_followers(
    repo: Repository, user_id: str, offset: int, limit: int
) -> tuple[list[dict], int]:
    target = repo.get_user_by_id(user_id)
    if not target:
        raise NotFoundError("User not found.")
    ids = repo.list_followers(user_id, limit, offset)
    users = repo.list_users_by_ids(ids)
    return [user_to_frontend(u) for u in users], target.follower_count


def list_following(
    repo: Repository, user_id: str, offset: int, limit: int
) -> tuple[list[dict], int]:
    target = repo.get_user_by_id(user_id)
    if not target:
        raise NotFoundError("User not found.")
    ids = repo.list_following(user_id, limit, offset)
    users = repo.list_users_by_ids(ids)
    return [user_to_frontend(u) for u in users], target.following_count
