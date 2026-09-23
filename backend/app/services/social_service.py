"""Likes, comments, follows, saved posts and notifications business logic."""

from __future__ import annotations

from app.core.errors import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.models import (
    Comment,
    Follow,
    Like,
    Notification,
    Save,
    User,
)
from app.repositories.base import Repository
from app.schemas.comment import CommentCreateRequest
from app.serializers.frontend import (
    comment_to_frontend,
    notification_to_frontend,
    post_to_frontend,
    user_to_frontend,
)


# ---------------------------------------------------------------------------
# Likes
# ---------------------------------------------------------------------------
def like_post(repo: Repository, post_id: str, user: User) -> dict:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")
    created = repo.add_like(Like(post_id=post_id, user_id=user.id))
    if created:
        repo.increment_post_like_count(post_id, 1)
        if post.author_id != user.id:
            _notify_like(repo, post, user)
    fresh = repo.get_post(post_id) or post
    return {"liked": True, "likeCount": fresh.like_count}


def unlike_post(repo: Repository, post_id: str, user_id: str) -> dict:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")
    removed = repo.remove_like(post_id, user_id)
    if removed:
        repo.increment_post_like_count(post_id, -1)
    fresh = repo.get_post(post_id) or post
    return {"liked": False, "likeCount": fresh.like_count}


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
def create_comment(
    repo: Repository, post_id: str, user: User, payload: CommentCreateRequest
) -> dict:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")

    comment = Comment(
        post_id=post_id,
        author_id=user.id,
        author_username=user.username,
        author_display_name=user.display_name or user.username,
        author_avatar=user.profile_image,
        author_avatar_art=user.avatar_art,
        text=payload.text.strip(),
    )
    created = repo.create_comment(comment)
    repo.increment_post_comment_count(post_id, 1)

    if post.author_id != user.id:
        _notify_comment(repo, post, user, created.text)
    return comment_to_frontend(created)


def list_comments(
    repo: Repository, post_id: str, offset: int, limit: int
) -> tuple[list[dict], bool]:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")
    comments = repo.list_comments(post_id, limit + 1, offset)
    more = len(comments) > limit
    comments = comments[:limit]
    return [comment_to_frontend(c) for c in comments], more


def delete_comment(
    repo: Repository, comment_id: str, user_id: str
) -> None:
    comment = repo.get_comment(comment_id)
    if not comment:
        raise NotFoundError("Comment not found.")
    post = repo.get_post(comment.post_id)
    if comment.author_id != user_id:
        # Only the comment author (or post owner) may delete.
        if not post or post.author_id != user_id:
            raise ForbiddenError("You can only delete your own comments.")
    if repo.delete_comment(comment_id):
        repo.increment_post_comment_count(comment.post_id, -1)


# ---------------------------------------------------------------------------
# Follows
# ---------------------------------------------------------------------------
def follow_user(repo: Repository, target_id: str, user: User) -> dict:
    if target_id == user.id:
        raise BadRequestError("You cannot follow yourself.")
    target = repo.get_user_by_id(target_id)
    if not target:
        raise NotFoundError("User not found.")

    created = repo.add_follow(Follow(follower_id=user.id, followed_id=target_id))
    if created:
        repo.increment_follow_counts(user.id, target_id, 1)
        _notify_follow(repo, target_id, user)
    return {"following": True}


def unfollow_user(repo: Repository, target_id: str, user_id: str) -> dict:
    removed = repo.remove_follow(user_id, target_id)
    if removed:
        repo.increment_follow_counts(user_id, target_id, -1)
    return {"following": False}


# ---------------------------------------------------------------------------
# Saved posts
# ---------------------------------------------------------------------------
def save_post(repo: Repository, post_id: str, user_id: str) -> dict:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")
    created = repo.add_save(Save(user_id=user_id, post_id=post_id))
    if created:
        return {"saved": True}
    return {"saved": True}


def unsave_post(repo: Repository, post_id: str, user_id: str) -> dict:
    repo.remove_save(user_id, post_id)
    return {"saved": False}


def list_saved(
    repo: Repository, user_id: str, offset: int, limit: int
) -> tuple[list[dict], bool]:
    post_ids = repo.list_saved_post_ids(user_id)
    page_ids = post_ids[offset : offset + limit]
    posts = []
    for pid in page_ids:
        p = repo.get_post(pid)
        if p:
            posts.append(post_to_frontend(p, saved_by_user=True))
    more = offset + limit < len(post_ids)
    return posts, more


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
def _notify_like(
    repo: Repository, post: object, actor: User
) -> None:
    repo.create_notification(
        Notification(
            user_id=post.author_id,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_display_name=actor.display_name or actor.username,
            actor_avatar=actor.profile_image,
            actor_avatar_art=actor.avatar_art,
            type="like",
            post_id=post.id,
            text=post.caption,
        )
    )


def _notify_comment(
    repo: Repository, post: object, actor: User, text: str
) -> None:
    repo.create_notification(
        Notification(
            user_id=post.author_id,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_display_name=actor.display_name or actor.username,
            actor_avatar=actor.profile_image,
            actor_avatar_art=actor.avatar_art,
            type="comment",
            post_id=post.id,
            text=text,
        )
    )


def _notify_follow(repo: Repository, target_id: str, actor: User) -> None:
    repo.create_notification(
        Notification(
            user_id=target_id,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_display_name=actor.display_name or actor.username,
            actor_avatar=actor.profile_image,
            actor_avatar_art=actor.avatar_art,
            type="follow",
            text="started following you",
        )
    )


def list_notifications(
    repo: Repository, user_id: str, offset: int, limit: int
) -> dict:
    notifications = repo.list_notifications(user_id, limit + 1, offset)
    more = len(notifications) > limit
    notifications = notifications[:limit]
    unread = repo.count_unread_notifications(user_id)
    return {
        "notifications": [notification_to_frontend(n) for n in notifications],
        "unread_count": unread,
        "has_more": more,
    }


def mark_notification_read(
    repo: Repository, notification_id: str, user_id: str
) -> dict:
    notification = repo.get_notification(notification_id)
    if not notification:
        raise NotFoundError("Notification not found.")
    if notification.user_id != user_id:
        raise ForbiddenError("You cannot read another user's notification.")
    updated = repo.mark_notification_read(notification_id)
    return notification_to_frontend(updated)


def mark_all_notifications_read(repo: Repository, user_id: str) -> int:
    return repo.mark_all_notifications_read(user_id)
