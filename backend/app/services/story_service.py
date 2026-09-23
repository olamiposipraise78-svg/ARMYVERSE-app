"""Stories business logic."""

from __future__ import annotations

from datetime import timedelta

from app.core.config import get_settings
from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models import Notification, Story, StoryReaction, StoryReply, StoryView, User
from app.models.entity import now_utc
from app.repositories.base import Repository
from app.schemas.story import StoryCreateRequest, StoryReplyRequest
from app.serializers.frontend import (
    story_reply_to_frontend,
    story_to_frontend,
)
from app.services.media_storage import delete_media

ALLOWED_REACTIONS = {"like", "heart", "laugh", "wow", "sad", "fire"}

# Allowed media types for stories
ALLOWED_STORY_MEDIA_TYPES = {"image", "video"}


def _denormalize_author(story: Story, author: User) -> None:
    story.author_username = author.username
    story.author_display_name = author.display_name or author.username
    story.author_avatar = author.profile_image
    story.author_avatar_art = author.avatar_art
    story.author_verified = author.verified


def _resolve_story(repo: Repository, story_id: str) -> Story:
    story = repo.get_story(story_id)
    if not story:
        raise NotFoundError("Story not found.")
    if story.expires_at <= now_utc():
        raise NotFoundError("Story has expired.")
    return story


def _validate_story_media(media: dict | None) -> str:
    """Validate story media and return the media_type.

    Raises BadRequestError if media is invalid.
    """
    if not media:
        return ""

    media_type = media.get("type", "")
    if media_type not in ALLOWED_STORY_MEDIA_TYPES:
        raise BadRequestError(
            f"Invalid media type '{media_type}'. Must be 'image' or 'video'."
        )

    # Accept either 'url' (new upload flow) or 'src' (legacy/base64 flow)
    url = media.get("url", "") or media.get("src", "")
    if not url:
        raise BadRequestError("Media URL is required.")

    return media_type


def create_story(
    repo: Repository, author: User, payload: StoryCreateRequest
) -> dict:
    if not payload.caption.strip() and not payload.media:
        raise BadRequestError("A story needs a caption or media.")

    media_type = _validate_story_media(payload.media)

    ttl = timedelta(hours=get_settings().story_ttl_hours)
    story = Story(
        author_id=author.id,
        caption=payload.caption.strip(),
        color=payload.color or "",
        media_type=media_type,
        media=payload.media if payload.media else None,
        music=payload.music if payload.music else None,
        created_at=now_utc(),
        expires_at=now_utc() + ttl,
    )
    _denormalize_author(story, author)
    created = repo.create_story(story)
    return story_to_frontend(created, viewer_id=author.id, viewed_by_me=False)


def get_stories(
    repo: Repository, viewer_id: str | None
) -> list[dict]:
    active = repo.list_active_stories(now_utc())
    active.sort(key=lambda s: s.created_at, reverse=True)
    result: list[dict] = []
    for s in active:
        viewed = repo.has_viewed_story(s.id, viewer_id) if viewer_id else False
        reaction = repo.get_story_reaction(s.id, viewer_id) if viewer_id else None
        result.append(
            story_to_frontend(
                s,
                viewer_id=viewer_id,
                viewed_by_me=viewed,
                reacted=reaction is not None,
                reaction_type=reaction.type if reaction else "",
            )
        )
    return result


def get_story(repo: Repository, story_id: str, viewer_id: str | None) -> dict:
    story = _resolve_story(repo, story_id)
    viewed = repo.has_viewed_story(story_id, viewer_id) if viewer_id else False
    reaction = repo.get_story_reaction(story_id, viewer_id) if viewer_id else None
    return story_to_frontend(
        story,
        viewer_id=viewer_id,
        viewed_by_me=viewed,
        reacted=reaction is not None,
        reaction_type=reaction.type if reaction else "",
    )


def delete_story(repo: Repository, story_id: str, actor_id: str) -> None:
    story = repo.get_story(story_id)
    if not story:
        raise NotFoundError("Story not found.")
    if story.author_id != actor_id:
        raise ForbiddenError("You can only delete your own stories.")
    # Clean up media files before deleting the story
    if story.media and story.media.get("url"):
        delete_media(story.media["url"])
    repo.delete_story(story_id)


def view_story(repo: Repository, story_id: str, viewer: User) -> dict:
    story = _resolve_story(repo, story_id)
    if story.author_id == viewer.id:
        # Own stories don't count as views.
        return get_story(repo, story_id, viewer.id)
    added = repo.add_story_view(
        StoryView(story_id=story_id, user_id=viewer.id)
    )
    if added:
        repo.increment_story_view_count(story_id, 1)
    return get_story(repo, story_id, viewer.id)


def react_to_story(
    repo: Repository, story_id: str, actor: User, reaction_type: str
) -> dict:
    _resolve_story(repo, story_id)
    reaction_type = reaction_type.strip().lower()
    if reaction_type not in ALLOWED_REACTIONS:
        raise BadRequestError("Unsupported reaction type.")
    reaction = StoryReaction(
        story_id=story_id, user_id=actor.id, type=reaction_type
    )
    existing = repo.get_story_reaction(story_id, actor.id)
    if existing and existing.type == reaction_type:
        # Toggle off — remove reaction.
        repo.remove_story_reaction(story_id, actor.id)
    else:
        repo.set_story_reaction(reaction)
    return get_story(repo, story_id, actor.id)


def reply_to_story(
    repo: Repository, story_id: str, actor: User, payload: StoryReplyRequest
) -> dict:
    story = _resolve_story(repo, story_id)
    reply = StoryReply(story_id=story_id, author_id=actor.id, text=payload.text.strip())
    reply.author_username = actor.username
    reply.author_display_name = actor.display_name or actor.username
    reply.author_avatar = actor.profile_image
    reply.author_avatar_art = actor.avatar_art
    created = repo.create_story_reply(reply)
    if story.author_id != actor.id:
        repo.create_notification(
            Notification(
                user_id=story.author_id,
                actor_id=actor.id,
                actor_username=actor.username,
                actor_display_name=actor.display_name or actor.username,
                actor_avatar=actor.profile_image,
                actor_avatar_art=actor.avatar_art,
                type="story_reply",
                post_id=None,
                text=reply.text,
            )
        )
    return story_reply_to_frontend(created)


def list_story_replies(
    repo: Repository, story_id: str, offset: int, limit: int
) -> tuple[list[dict], bool]:
    _resolve_story(repo, story_id)
    replies = repo.list_story_replies(story_id, limit + 1, offset)
    more = len(replies) > limit
    replies = replies[:limit]
    return [story_reply_to_frontend(r) for r in replies], more


def prune_expired_stories(repo: Repository) -> int:
    return repo.prune_expired_stories(now_utc())
