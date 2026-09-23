"""Reel business logic."""

from __future__ import annotations

from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models import Reel, ReelComment, ReelLike, ReelSave, ReelView, User
from app.repositories.base import Repository
from app.schemas.reel import ReelCommentCreateRequest, ReelCreateRequest
from app.serializers.frontend import reel_comment_to_frontend, reel_to_frontend


def create_reel(
    repo: Repository, author: User, media_url: str, payload: ReelCreateRequest
) -> dict:
    if not media_url:
        raise BadRequestError("A video file is required to create a Reel.")

    reel = Reel(
        author_id=author.id,
caption=payload.caption.strip(),
        hashtags=[h.strip() for h in payload.hashtags if h.strip()],
        media_url=media_url,
        crop=payload.crop,
        audio_name=payload.audio_name,
        duration=payload.duration,
    )
    reel.author_username = author.username
    reel.author_display_name = author.display_name or author.username
    reel.author_avatar = author.profile_image
    reel.author_avatar_art = author.avatar_art
    reel.author_verified = author.verified
    created = repo.create_reel(reel)
    return reel_to_frontend(created)


def get_reel(
    repo: Repository, reel_id: str, viewer_id: str | None
) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    liked = repo.has_liked_reel(reel_id, viewer_id) if viewer_id else False
    saved = repo.has_saved_reel(reel_id, viewer_id) if viewer_id else False
    return reel_to_frontend(reel, liked_by_user=liked, saved_by_user=saved)


def list_reels(
    repo: Repository, offset: int, limit: int, viewer_id: str | None
) -> tuple[list[dict], bool]:
    reels = repo.list_reels(limit + 1, offset)
    has_more = len(reels) > limit
    reels = reels[:limit]
    liked = repo.list_liked_reel_ids(viewer_id) if viewer_id else set()
    saved = set(repo.list_saved_reel_ids(viewer_id)) if viewer_id else set()
    return [
        reel_to_frontend(r, liked_by_user=r.id in liked, saved_by_user=r.id in saved)
        for r in reels
    ], has_more


def delete_reel(repo: Repository, reel_id: str, actor_id: str) -> None:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    if reel.author_id != actor_id:
        raise ForbiddenError("You can only delete your own Reels.")
    repo.delete_reel(reel_id)


def like_reel(repo: Repository, reel_id: str, user: User) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    created = repo.add_reel_like(ReelLike(reel_id=reel_id, user_id=user.id))
    if created:
        repo.increment_reel_field(reel_id, "like_count", 1)
    fresh = repo.get_reel(reel_id) or reel
    return {"liked": True, "likeCount": fresh.like_count}


def unlike_reel(repo: Repository, reel_id: str, user_id: str) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    removed = repo.remove_reel_like(reel_id, user_id)
    if removed:
        repo.increment_reel_field(reel_id, "like_count", -1)
    fresh = repo.get_reel(reel_id) or reel
    return {"liked": False, "likeCount": fresh.like_count}


def save_reel(repo: Repository, reel_id: str, user_id: str) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    created = repo.add_reel_save(ReelSave(reel_id=reel_id, user_id=user_id))
    if created:
        repo.increment_reel_field(reel_id, "save_count", 1)
    return {"saved": True}


def unsave_reel(repo: Repository, reel_id: str, user_id: str) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    removed = repo.remove_reel_save(reel_id, user_id)
    if removed:
        repo.increment_reel_field(reel_id, "save_count", -1)
    return {"saved": False}


def view_reel(repo: Repository, reel_id: str, user_id: str) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    created = repo.add_reel_view(ReelView(reel_id=reel_id, user_id=user_id))
    if created:
        repo.increment_reel_field(reel_id, "view_count", 1)
    fresh = repo.get_reel(reel_id) or reel
    return {"viewed": True, "viewCount": fresh.view_count}


def share_reel(repo: Repository, reel_id: str) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    repo.increment_reel_field(reel_id, "share_count", 1)
    fresh = repo.get_reel(reel_id) or reel
    return {"shareCount": fresh.share_count}


def create_reel_comment(
    repo: Repository, reel_id: str, user: User, payload: ReelCommentCreateRequest
) -> dict:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    comment = ReelComment(
        reel_id=reel_id,
        author_id=user.id,
        author_username=user.username,
        author_display_name=user.display_name or user.username,
        author_avatar=user.profile_image,
        author_avatar_art=user.avatar_art,
        text=payload.text.strip(),
    )
    created = repo.create_reel_comment(comment)
    repo.increment_reel_field(reel_id, "comment_count", 1)
    return reel_comment_to_frontend(created)


def list_reel_comments(
    repo: Repository, reel_id: str, offset: int, limit: int
) -> tuple[list[dict], bool]:
    reel = repo.get_reel(reel_id)
    if not reel:
        raise NotFoundError("Reel not found.")
    comments = repo.list_reel_comments(reel_id, limit + 1, offset)
    has_more = len(comments) > limit
    comments = comments[:limit]
    return [reel_comment_to_frontend(c) for c in comments], has_more
