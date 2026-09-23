"""Domain models for ARMYVERSE.

These are plain dataclasses representing records persisted in the database.
They are the source of truth for the backend; API serialization to frontend
shapes happens in `app/serializers`.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def uuid_str() -> str:
    return uuid.uuid4().hex


@dataclass
class User:
    id: str = field(default_factory=uuid_str)
    username: str = ""
    email: str = ""
    password_hash: str = ""
    display_name: str = ""
    bio: str = ""
    profile_image: str = ""
    avatar_art: str = ""
    flag: str = ""
    country: str = ""
    verified: bool = False
    is_premium: bool = False
    follower_count: int = 0
    following_count: int = 0
    post_count: int = 0
    created_at: datetime = field(default_factory=now_utc)
    updated_at: datetime = field(default_factory=now_utc)


@dataclass
class Post:
    id: str = field(default_factory=uuid_str)
    author_id: str = ""
    author_username: str = ""
    author_display_name: str = ""
    author_avatar: str = ""
    author_avatar_art: str = ""
    author_verified: bool = False
    country: str = ""
    flag: str = ""
    caption: str = ""
    hashtags: list[str] = field(default_factory=list)
    media: Optional[dict[str, Any]] = None
    music: Optional[dict[str, Any]] = None
    location: str = ""
    downloadable: bool = False
    like_count: int = 0
    comment_count: int = 0
    view_count: int = 0
    created_at: datetime = field(default_factory=now_utc)
    updated_at: datetime = field(default_factory=now_utc)


@dataclass
class Comment:
    id: str = field(default_factory=uuid_str)
    post_id: str = ""
    author_id: str = ""
    author_username: str = ""
    author_display_name: str = ""
    author_avatar: str = ""
    author_avatar_art: str = ""
    text: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class Like:
    id: str = field(default_factory=uuid_str)
    post_id: str = ""
    user_id: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class Follow:
    id: str = field(default_factory=uuid_str)
    follower_id: str = ""
    followed_id: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class Save:
    id: str = field(default_factory=uuid_str)
    user_id: str = ""
    post_id: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class Story:
    id: str = field(default_factory=uuid_str)
    author_id: str = ""
    author_username: str = ""
    author_display_name: str = ""
    author_avatar: str = ""
    author_avatar_art: str = ""
    author_verified: bool = False
    caption: str = ""
    color: str = ""
    media_type: str = ""  # "image" or "video"
    media: Optional[dict[str, Any]] = None
    music: Optional[dict[str, Any]] = None
    view_count: int = 0
    created_at: datetime = field(default_factory=now_utc)
    expires_at: datetime = field(default_factory=now_utc)


@dataclass
class StoryView:
    id: str = field(default_factory=uuid_str)
    story_id: str = ""
    user_id: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class StoryReaction:
    id: str = field(default_factory=uuid_str)
    story_id: str = ""
    user_id: str = ""
    type: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class StoryReply:
    id: str = field(default_factory=uuid_str)
    story_id: str = ""
    author_id: str = ""
    author_username: str = ""
    author_display_name: str = ""
    author_avatar: str = ""
    author_avatar_art: str = ""
    text: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class GameProgress:
    user_id: str = ""
    xp: int = 0
    total_score: int = 0
    best_score: int = 0
    games_played: int = 0
    best_streak: int = 0
    quiz_completed: int = 0
    quiz_history: list = field(default_factory=list)
    created_at: datetime = field(default_factory=now_utc)
    updated_at: datetime = field(default_factory=now_utc)


@dataclass
class Reel:
    id: str = field(default_factory=uuid_str)
    author_id: str = ""
    author_username: str = ""
    author_display_name: str = ""
    author_avatar: str = ""
    author_avatar_art: str = ""
    author_verified: bool = False
    caption: str = ""
    hashtags: list[str] = field(default_factory=list)
    media_url: str = ""
    poster_url: str = ""
    crop: dict | None = None
    audio_name: str = ""
    duration: float = 0.0
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    save_count: int = 0
    created_at: datetime = field(default_factory=now_utc)
    updated_at: datetime = field(default_factory=now_utc)


@dataclass
class ReelLike:
    id: str = field(default_factory=uuid_str)
    reel_id: str = ""
    user_id: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class ReelSave:
    id: str = field(default_factory=uuid_str)
    reel_id: str = ""
    user_id: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class ReelComment:
    id: str = field(default_factory=uuid_str)
    reel_id: str = ""
    author_id: str = ""
    author_username: str = ""
    author_display_name: str = ""
    author_avatar: str = ""
    author_avatar_art: str = ""
    text: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class ReelView:
    id: str = field(default_factory=uuid_str)
    reel_id: str = ""
    user_id: str = ""
    created_at: datetime = field(default_factory=now_utc)


@dataclass
class Notification:
    id: str = field(default_factory=uuid_str)
    user_id: str = ""  # recipient
    actor_id: str = ""
    actor_username: str = ""
    actor_display_name: str = ""
    actor_avatar: str = ""
    actor_avatar_art: str = ""
    type: str = ""  # like | comment | follow
    post_id: Optional[str] = None
    text: str = ""
    read: bool = False
    created_at: datetime = field(default_factory=now_utc)
