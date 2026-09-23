"""Repository interface for ARMYVERSE persistence.

Routes -> Services -> Repositories -> Storage (Astra DB or in-memory).

This abstract base defines the contract both the Astra-backed repository and
the offline in-memory repository must satisfy, keeping database concerns out
of API handlers and services.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.models import (
    Comment,
    Follow,
    GameProgress,
    Like,
    Notification,
    Post,
    Reel,
    ReelComment,
    ReelLike,
    ReelSave,
    ReelView,
    Save,
    Story,
    StoryReaction,
    StoryReply,
    StoryView,
    User,
)


class Repository(ABC):
    # ---- users ----
    @abstractmethod
    def create_user(self, user: User) -> User: ...

    @abstractmethod
    def get_user_by_id(self, user_id: str) -> Optional[User]: ...

    @abstractmethod
    def get_user_by_username(self, username: str) -> Optional[User]: ...

    @abstractmethod
    def get_user_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    def update_user(self, user_id: str, updates: dict) -> Optional[User]: ...

    @abstractmethod
    def list_users_by_ids(self, ids: list[str]) -> list[User]: ...

    @abstractmethod
    def search_users(self, query: str, limit: int, offset: int) -> list[User]: ...

    # ---- posts ----
    @abstractmethod
    def create_post(self, post: Post) -> Post: ...

    @abstractmethod
    def get_post(self, post_id: str) -> Optional[Post]: ...

    @abstractmethod
    def update_post(self, post_id: str, updates: dict) -> Optional[Post]: ...

    @abstractmethod
    def delete_post(self, post_id: str) -> None: ...

    @abstractmethod
    def list_posts(
        self, author_id: Optional[str] = None, limit: int = 20, offset: int = 0
    ) -> list[Post]: ...

    @abstractmethod
    def list_posts_for_authors(
        self, author_ids: list[str], limit: int = 20
    ) -> list[Post]: ...

    @abstractmethod
    def search_posts(
        self, query: str, limit: int, offset: int
    ) -> list[Post]: ...

    @abstractmethod
    def increment_post_like_count(self, post_id: str, delta: int = 1) -> None: ...

    @abstractmethod
    def increment_post_comment_count(self, post_id: str, delta: int = 1) -> None: ...

    @abstractmethod
    def increment_user_post_count(self, user_id: str, delta: int = 1) -> None: ...

    # ---- likes ----
    @abstractmethod
    def add_like(self, like: Like) -> bool: ...

    @abstractmethod
    def remove_like(self, post_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def has_liked(self, post_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def list_liked_post_ids(self, user_id: str) -> set[str]: ...

    # ---- comments ----
    @abstractmethod
    def create_comment(self, comment: Comment) -> Comment: ...

    @abstractmethod
    def get_comment(self, comment_id: str) -> Optional[Comment]: ...

    @abstractmethod
    def delete_comment(self, comment_id: str) -> bool: ...

    @abstractmethod
    def list_comments(
        self, post_id: str, limit: int = 20, offset: int = 0
    ) -> list[Comment]: ...

    # ---- follows ----
    @abstractmethod
    def add_follow(self, follow: Follow) -> bool: ...

    @abstractmethod
    def remove_follow(self, follower_id: str, followed_id: str) -> bool: ...

    @abstractmethod
    def has_follow(self, follower_id: str, followed_id: str) -> bool: ...

    @abstractmethod
    def list_followers(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[str]: ...

    @abstractmethod
    def list_following(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[str]: ...

    @abstractmethod
    def list_following_ids(self, user_id: str) -> list[str]: ...

    @abstractmethod
    def increment_follow_counts(self, follower_id: str, followed_id: str, delta: int = 1) -> None: ...

    # ---- saves ----
    @abstractmethod
    def add_save(self, save: Save) -> bool: ...

    @abstractmethod
    def remove_save(self, user_id: str, post_id: str) -> bool: ...

    @abstractmethod
    def has_saved(self, user_id: str, post_id: str) -> bool: ...

    @abstractmethod
    def list_saved_post_ids(self, user_id: str) -> list[str]: ...

    # ---- notifications ----
    @abstractmethod
    def create_notification(self, notification: Notification) -> Notification: ...

    @abstractmethod
    def get_notification(self, notification_id: str) -> Optional[Notification]: ...

    @abstractmethod
    def list_notifications(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[Notification]: ...

    @abstractmethod
    def mark_notification_read(self, notification_id: str) -> Optional[Notification]: ...

    @abstractmethod
    def mark_all_notifications_read(self, user_id: str) -> int: ...

    @abstractmethod
    def count_unread_notifications(self, user_id: str) -> int: ...

    # ---- stories ----
    @abstractmethod
    def create_story(self, story: Story) -> Story: ...

    @abstractmethod
    def get_story(self, story_id: str) -> Optional[Story]: ...

    @abstractmethod
    def delete_story(self, story_id: str) -> None: ...

    @abstractmethod
    def list_active_stories(self, now) -> list[Story]: ...

    @abstractmethod
    def prune_expired_stories(self, now) -> int: ...

    # ---- story views ----
    @abstractmethod
    def add_story_view(self, view: StoryView) -> bool: ...

    @abstractmethod
    def has_viewed_story(self, story_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def increment_story_view_count(self, story_id: str, delta: int = 1) -> None: ...

    # ---- story reactions ----
    @abstractmethod
    def set_story_reaction(self, reaction: StoryReaction) -> None: ...

    @abstractmethod
    def remove_story_reaction(self, story_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def get_story_reaction(self, story_id: str, user_id: str) -> Optional[StoryReaction]: ...

    # ---- story replies ----
    @abstractmethod
    def create_story_reply(self, reply: StoryReply) -> StoryReply: ...

    @abstractmethod
    def list_story_replies(
        self, story_id: str, limit: int = 20, offset: int = 0
    ) -> list[StoryReply]: ...

    # ---- game progress ----
    @abstractmethod
    def get_game_progress(self, user_id: str) -> Optional[GameProgress]: ...

    @abstractmethod
    def upsert_game_progress(self, progress: GameProgress) -> GameProgress: ...

    # ---- reels ----
    @abstractmethod
    def create_reel(self, reel: Reel) -> Reel: ...

    @abstractmethod
    def get_reel(self, reel_id: str) -> Optional[Reel]: ...

    @abstractmethod
    def delete_reel(self, reel_id: str) -> None: ...

    @abstractmethod
    def list_reels(self, limit: int = 20, offset: int = 0) -> list[Reel]: ...

    @abstractmethod
    def list_reels_by_author(self, author_id: str, limit: int = 20, offset: int = 0) -> list[Reel]: ...

    @abstractmethod
    def increment_reel_field(self, reel_id: str, field: str, delta: int = 1) -> None: ...

    # ---- reel likes ----
    @abstractmethod
    def add_reel_like(self, like: ReelLike) -> bool: ...

    @abstractmethod
    def remove_reel_like(self, reel_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def has_liked_reel(self, reel_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def list_liked_reel_ids(self, user_id: str) -> set[str]: ...

    # ---- reel saves ----
    @abstractmethod
    def add_reel_save(self, save: ReelSave) -> bool: ...

    @abstractmethod
    def remove_reel_save(self, reel_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def has_saved_reel(self, reel_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def list_saved_reel_ids(self, user_id: str) -> list[str]: ...

    # ---- reel comments ----
    @abstractmethod
    def create_reel_comment(self, comment: ReelComment) -> ReelComment: ...

    @abstractmethod
    def get_reel_comment(self, comment_id: str) -> Optional[ReelComment]: ...

    @abstractmethod
    def delete_reel_comment(self, comment_id: str) -> bool: ...

    @abstractmethod
    def list_reel_comments(self, reel_id: str, limit: int = 20, offset: int = 0) -> list[ReelComment]: ...

    # ---- reel views ----
    @abstractmethod
    def add_reel_view(self, view: ReelView) -> bool: ...

    @abstractmethod
    def has_viewed_reel(self, reel_id: str, user_id: str) -> bool: ...
