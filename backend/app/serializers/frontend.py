"""Serialization layer: maps backend model records -> frontend API shapes.

The existing React frontend was built against a specific mock data model.
Rather than rewiring every component, the backend returns API responses in the
shapes the current UI already understands (e.g. posts use `user` for the author
id, `text` for the caption, `likeCount` for the count; notifications carry
`type`/`user`/`caption`; users carry `avatar`/`avatarArt`/`flag`/`country`).

Internal model fields (password hashes, ids, counts, snake_case) are mapped here
and are never exposed verbatim.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.models import (
    Comment,
    Notification,
    Post,
    Reel,
    ReelComment,
    Story,
    StoryReply,
    User,
)


def iso_fmt(value: datetime | None) -> str:
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def user_to_frontend(user: User, is_current: bool = False) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name or user.username,
        "bio": user.bio,
        "avatar": user.profile_image,
        "avatarArt": user.avatar_art,
        "flag": user.flag,
        "country": user.country,
        "followers": user.follower_count,
        "following": user.following_count,
        "posts": user.post_count,
        "verified": user.verified,
        "isPremium": getattr(user, "is_premium", False),
        "createdAt": iso_fmt(user.created_at),
        "isCurrentUser": is_current,
    }


def post_to_frontend(
    post: Post,
    liked_by_user: bool = False,
    saved_by_user: bool = False,
    comments: Optional[list[dict]] = None,
) -> dict[str, Any]:
    return {
        "id": post.id,
        "user": post.author_id,
        "country": post.country,
        "flag": post.flag,
        "createdAt": iso_fmt(post.created_at),
        "text": post.caption,
        "caption": post.caption,
        "hashtags": post.hashtags,
        "media": post.media or {"type": "image", "src": ""},
        "music": normalize_music(post.music),
        "location": post.location,
        "likeCount": post.like_count,
        "commentCount": post.comment_count,
        "viewCount": post.view_count,
        "liked": liked_by_user,
        "saved": saved_by_user,
        "downloadable": post.downloadable,
        "comments": comments or [],
        "author": {
            "id": post.author_id,
            "username": post.author_username,
            "displayName": post.author_display_name,
            "avatar": post.author_avatar,
            "avatarArt": post.author_avatar_art,
            "verified": post.author_verified,
        },
    }


def comment_to_frontend(comment: Comment) -> dict[str, Any]:
    return {
        "id": comment.id,
        "user": comment.author_id,
        "text": comment.text,
        "time": iso_fmt(comment.created_at),
        "createdAt": iso_fmt(comment.created_at),
        "author": {
            "id": comment.author_id,
            "username": comment.author_username,
            "displayName": comment.author_display_name,
            "avatar": comment.author_avatar,
            "avatarArt": comment.author_avatar_art,
        },
    }


def notification_to_frontend(notification: Notification) -> dict[str, Any]:
    text_key_map = {
        "like": "liked your post",
        "comment": "commented on your post",
        "follow": "started following you",
    }
    text_key = text_key_map.get(notification.type, notification.type)
    return {
        "id": notification.id,
        "type": notification.type,
        "user": notification.actor_id,
        "postId": notification.post_id,
        "createdAt": iso_fmt(notification.created_at),
        "read": notification.read,
        "textKey": text_key,
        "text": notification.text or text_key,
        "caption": notification.text or "",
    }


def normalize_music(raw: Any) -> Any:
    """Normalize legacy music shapes to the standard format.

    Standard shape:
        id, title, artist, album, artworkUrl, duration, audioUrl,
        previewUrl, canPlay, provider, providerTrackId, era,
        startAt, endAt

    Handles these legacy shapes:
        {youtubeId}
        {previewUrl}
        {previewUrl: null}
        {audio, startAt, endAt}
        {youtubeId, startAt}
        {id, title, artist, album, cover, era, duration, audio, startAt, endAt}
    """
    if not raw or not isinstance(raw, dict):
        return None

    # Already standardized — has both id and title AND uses new field names
    if raw.get("id") and raw.get("title") and ("artworkUrl" in raw or "audioUrl" in raw):
        return raw

    # Already has id + title (old standardized shape with cover/audio)
    if raw.get("id") and raw.get("title"):
        return {
            "id": raw["id"],
            "title": raw["title"],
            "artist": raw.get("artist", "BTS"),
            "album": raw.get("album", ""),
            "artworkUrl": raw.get("artworkUrl") or raw.get("cover", ""),
            "cover": raw.get("cover") or raw.get("artworkUrl", ""),
            "duration": raw.get("duration"),
            "audioUrl": raw.get("audioUrl") or raw.get("audio"),
            "audio": raw.get("audio") or raw.get("audioUrl"),
            "previewUrl": raw.get("previewUrl"),
            "canPlay": bool(raw.get("audio") or raw.get("audioUrl") or raw.get("previewUrl")),
            "provider": raw.get("provider", "legacy"),
            "providerTrackId": raw.get("providerTrackId"),
            "era": raw.get("era"),
            "startAt": raw.get("startAt"),
            "endAt": raw.get("endAt"),
        }

    # youtubeId only — metadata-only entry
    if raw.get("youtubeId") and not raw.get("audio") and not raw.get("previewUrl"):
        return {
            "id": f"legacy-yt-{raw['youtubeId']}",
            "title": "BTS Song",
            "artist": "BTS",
            "album": "",
            "artworkUrl": "",
            "cover": "",
            "duration": None,
            "audioUrl": None,
            "audio": None,
            "previewUrl": None,
            "canPlay": False,
            "provider": "legacy",
            "providerTrackId": None,
            "era": None,
            "startAt": raw.get("startAt"),
            "endAt": raw.get("endAt"),
        }

    # Has audio URL — use it directly
    if raw.get("audio"):
        return {
            "id": raw.get("id") or f"legacy-audio-{hash(raw['audio']) & 0xFFFFFFFF:08x}",
            "title": raw.get("title", "BTS Song"),
            "artist": raw.get("artist", "BTS"),
            "album": raw.get("album", ""),
            "artworkUrl": raw.get("artworkUrl") or raw.get("cover", ""),
            "cover": raw.get("cover") or raw.get("artworkUrl", ""),
            "duration": raw.get("duration"),
            "audioUrl": raw["audio"],
            "audio": raw["audio"],
            "previewUrl": raw.get("previewUrl"),
            "canPlay": True,
            "provider": raw.get("provider", "legacy"),
            "providerTrackId": raw.get("providerTrackId"),
            "era": raw.get("era"),
            "startAt": raw.get("startAt"),
            "endAt": raw.get("endAt"),
        }

    # previewUrl (non-null) — Spotify embed metadata
    if raw.get("previewUrl") is not None:
        return {
            "id": raw.get("id") or f"legacy-preview",
            "title": raw.get("title", "BTS Song"),
            "artist": raw.get("artist", "BTS"),
            "album": raw.get("album", ""),
            "artworkUrl": raw.get("artworkUrl") or raw.get("cover", ""),
            "cover": raw.get("cover") or raw.get("artworkUrl", ""),
            "duration": raw.get("duration"),
            "audioUrl": None,
            "audio": None,
            "previewUrl": raw["previewUrl"],
            "canPlay": True,
            "provider": raw.get("provider", "spotify"),
            "providerTrackId": raw.get("providerTrackId"),
            "era": raw.get("era"),
            "startAt": raw.get("startAt"),
            "endAt": raw.get("endAt"),
        }

    # previewUrl is explicitly null
    if "previewUrl" in raw:
        return {
            "id": raw.get("id") or "legacy-null",
            "title": raw.get("title", "BTS Song"),
            "artist": raw.get("artist", "BTS"),
            "album": raw.get("album", ""),
            "artworkUrl": raw.get("artworkUrl") or raw.get("cover", ""),
            "cover": raw.get("cover") or raw.get("artworkUrl", ""),
            "duration": raw.get("duration"),
            "audioUrl": None,
            "audio": None,
            "previewUrl": None,
            "canPlay": False,
            "provider": raw.get("provider", "legacy"),
            "providerTrackId": raw.get("providerTrackId"),
            "era": raw.get("era"),
            "startAt": raw.get("startAt"),
            "endAt": raw.get("endAt"),
        }

    # Fallback — return as-is wrapped in standard keys
    return {
        "id": raw.get("id", "legacy-unknown"),
        "title": raw.get("title", "BTS Song"),
        "artist": raw.get("artist", "BTS"),
        "album": raw.get("album", ""),
        "artworkUrl": raw.get("artworkUrl") or raw.get("cover", ""),
        "cover": raw.get("cover") or raw.get("artworkUrl", ""),
        "duration": raw.get("duration"),
        "audioUrl": raw.get("audioUrl") or raw.get("audio"),
        "audio": raw.get("audio") or raw.get("audioUrl"),
        "previewUrl": raw.get("previewUrl"),
        "canPlay": bool(raw.get("audio") or raw.get("audioUrl") or raw.get("previewUrl")),
        "provider": raw.get("provider", "legacy"),
        "providerTrackId": raw.get("providerTrackId"),
        "era": raw.get("era"),
        "startAt": raw.get("startAt"),
        "endAt": raw.get("endAt"),
    }


def story_to_frontend(
    story: Story,
    viewer_id: str | None = None,
    reacted: bool = False,
    reaction_type: str = "",
    viewed_by_me: bool = False,
) -> dict[str, Any]:
    return {
        "id": story.id,
        "user": story.author_id,
        "createdAt": iso_fmt(story.created_at),
        "expiresAt": iso_fmt(story.expires_at),
        "caption": story.caption,
        "color": story.color,
        "mediaType": story.media_type,
        "media": story.media or {"type": "image", "src": ""},
        "src": (story.media or {}).get("url") or (story.media or {}).get("src", ""),
        "music": normalize_music(story.music),
        "viewers": story.view_count,
        "viewedByMe": viewed_by_me if viewer_id else False,
        "reacted": reacted,
        "reaction": reaction_type,
        "author": {
            "id": story.author_id,
            "username": story.author_username,
            "displayName": story.author_display_name,
            "avatar": story.author_avatar,
            "avatarArt": story.author_avatar_art,
            "verified": story.author_verified,
        },
    }


def story_reply_to_frontend(reply: StoryReply) -> dict[str, Any]:
    return {
        "id": reply.id,
        "user": reply.author_id,
        "text": reply.text,
        "time": iso_fmt(reply.created_at),
        "createdAt": iso_fmt(reply.created_at),
        "author": {
            "id": reply.author_id,
            "username": reply.author_username,
            "displayName": reply.author_display_name,
            "avatar": reply.author_avatar,
            "avatarArt": reply.author_avatar_art,
        },
    }


def reel_to_frontend(
    reel: Reel,
    liked_by_user: bool = False,
    saved_by_user: bool = False,
) -> dict[str, Any]:
    return {
        "id": reel.id,
        "user": reel.author_id,
        "src": reel.media_url,
        "poster": reel.poster_url,
        "crop": reel.crop,
        "alt": reel.caption[:100] if reel.caption else "",
        "caption": reel.caption,
        "hashtags": reel.hashtags,
        "audio": reel.audio_name,
        "duration": reel.duration,
        "likeCount": reel.like_count,
        "commentCount": reel.comment_count,
        "shareCount": reel.share_count,
        "saveCount": reel.save_count,
        "viewCount": reel.view_count,
        "liked": liked_by_user,
        "saved": saved_by_user,
        "createdAt": iso_fmt(reel.created_at),
        "author": {
            "id": reel.author_id,
            "username": reel.author_username,
            "displayName": reel.author_display_name,
            "avatar": reel.author_avatar,
            "avatarArt": reel.author_avatar_art,
            "verified": reel.author_verified,
        },
    }


def reel_comment_to_frontend(comment: ReelComment) -> dict[str, Any]:
    return {
        "id": comment.id,
        "user": comment.author_id,
        "text": comment.text,
        "time": iso_fmt(comment.created_at),
        "createdAt": iso_fmt(comment.created_at),
        "author": {
            "id": comment.author_id,
            "username": comment.author_username,
            "displayName": comment.author_display_name,
            "avatar": comment.author_avatar,
            "avatarArt": comment.author_avatar_art,
        },
    }
