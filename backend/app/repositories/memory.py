"""In-memory repository used for offline development and tests.

Implements the full `Repository` contract in memory. Results are paginated
with explicit limit/offset and ordered newest-first wherever `created_at` is
meaningful. No Astra DB is required.
"""

from __future__ import annotations

import json
import os
import pathlib
from datetime import datetime
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
from app.repositories.base import Repository


_env_data_file = os.environ.get("ARMYVERSE_DATA_FILE")
if _env_data_file is None:
    _DATA_FILE: Optional[pathlib.Path] = (
        pathlib.Path(__file__).resolve().parent.parent.parent / "data.json"
    )
else:
    _DATA_FILE = pathlib.Path(_env_data_file) if _env_data_file else None


class MemoryRepository(Repository):
    def __init__(self) -> None:
        self.users: dict[str, User] = {}
        self.posts: dict[str, Post] = {}
        self.comments: dict[str, Comment] = {}
        self.likes: dict[str, Like] = {}
        self.follows: dict[str, Follow] = {}
        self.saves: dict[str, Save] = {}
        self.notifications: dict[str, Notification] = {}
        self.stories: dict[str, Story] = {}
        self.story_views: dict[tuple, StoryView] = {}
        self.story_reactions: dict[tuple, StoryReaction] = {}
        self.story_replies: dict[str, StoryReply] = {}
        self.game_progress: dict[str, GameProgress] = {}
        self.reels: dict[str, Reel] = {}
        self.reel_likes: dict[tuple, ReelLike] = {}
        self.reel_saves: dict[tuple, ReelSave] = {}
        self.reel_comments: dict[str, ReelComment] = {}
        self.reel_views: dict[tuple, ReelView] = {}
        self._by_username: dict[str, str] = {}
        self._by_email: dict[str, str] = {}
        self._load()

    # ---- persistence ----
    def _load(self) -> None:
        if not _DATA_FILE or not _DATA_FILE.exists():
            return
        try:
            raw = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return

        for d in raw.get("users", []):
            u = User(
                id=d["id"], username=d["username"], email=d["email"],
                password_hash=d["password_hash"], display_name=d["display_name"],
                bio=d["bio"], profile_image=d["profile_image"],
                avatar_art=d["avatar_art"], flag=d["flag"],
                country=d["country"], verified=d["verified"],
                follower_count=d["follower_count"],
                following_count=d["following_count"],
                post_count=d["post_count"],
                created_at=datetime.fromisoformat(d["created_at"]),
                updated_at=datetime.fromisoformat(d["updated_at"]),
            )
            self.users[u.id] = u
            self._by_username[u.username.lower()] = u.id
            self._by_email[u.email.lower()] = u.id

        for d in raw.get("posts", []):
            p = Post(
                id=d["id"], author_id=d["author_id"],
                author_username=d["author_username"],
                author_display_name=d["author_display_name"],
                author_avatar=d["author_avatar"],
                author_avatar_art=d["author_avatar_art"],
                author_verified=d["author_verified"],
                country=d["country"], flag=d["flag"],
                caption=d["caption"], hashtags=d["hashtags"],
                media=d.get("media"), music=d.get("music"),
                location=d.get("location", ""),
                downloadable=d["downloadable"],
                like_count=d["like_count"], comment_count=d["comment_count"],
                created_at=datetime.fromisoformat(d["created_at"]),
                updated_at=datetime.fromisoformat(d["updated_at"]),
            )
            self.posts[p.id] = p

        for d in raw.get("comments", []):
            c = Comment(
                id=d["id"], post_id=d["post_id"], author_id=d["author_id"],
                author_username=d["author_username"],
                author_display_name=d["author_display_name"],
                author_avatar=d["author_avatar"],
                author_avatar_art=d["author_avatar_art"],
                text=d["text"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.comments[c.id] = c

        for d in raw.get("likes", []):
            lk = Like(
                id=d["id"], post_id=d["post_id"], user_id=d["user_id"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.likes[(lk.post_id, lk.user_id)] = lk

        for d in raw.get("follows", []):
            f = Follow(
                id=d["id"], follower_id=d["follower_id"],
                followed_id=d["followed_id"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.follows[(f.follower_id, f.followed_id)] = f

        for d in raw.get("saves", []):
            s = Save(
                id=d["id"], user_id=d["user_id"], post_id=d["post_id"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.saves[(s.user_id, s.post_id)] = s

        for d in raw.get("notifications", []):
            n = Notification(
                id=d["id"], user_id=d["user_id"], actor_id=d["actor_id"],
                actor_username=d["actor_username"],
                actor_display_name=d["actor_display_name"],
                actor_avatar=d["actor_avatar"],
                actor_avatar_art=d["actor_avatar_art"],
                type=d["type"], post_id=d.get("post_id"),
                text=d["text"], read=d["read"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.notifications[n.id] = n

        for d in raw.get("stories", []):
            st = Story(
                id=d["id"], author_id=d["author_id"],
                author_username=d["author_username"],
                author_display_name=d["author_display_name"],
                author_avatar=d["author_avatar"],
                author_avatar_art=d["author_avatar_art"],
                author_verified=d["author_verified"],
                caption=d["caption"], color=d["color"],
                media_type=d.get("media_type", ""),
                media=d.get("media"), music=d.get("music"),
                view_count=d["view_count"],
                created_at=datetime.fromisoformat(d["created_at"]),
                expires_at=datetime.fromisoformat(d["expires_at"]),
            )
            self.stories[st.id] = st

        for d in raw.get("story_views", []):
            sv = StoryView(
                id=d["id"], story_id=d["story_id"], user_id=d["user_id"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.story_views[(sv.story_id, sv.user_id)] = sv

        for d in raw.get("story_reactions", []):
            sr = StoryReaction(
                id=d["id"], story_id=d["story_id"], user_id=d["user_id"],
                type=d["type"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.story_reactions[(sr.story_id, sr.user_id)] = sr

        for d in raw.get("story_replies", []):
            rp = StoryReply(
                id=d["id"], story_id=d["story_id"], author_id=d["author_id"],
                author_username=d["author_username"],
                author_display_name=d["author_display_name"],
                author_avatar=d["author_avatar"],
                author_avatar_art=d["author_avatar_art"],
                text=d["text"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.story_replies[rp.id] = rp

        for d in raw.get("game_progress", []):
            gp = GameProgress(
                user_id=d["user_id"],
                xp=d.get("xp", 0),
                total_score=d.get("total_score", 0),
                best_score=d.get("best_score", 0),
                games_played=d.get("games_played", 0),
                best_streak=d.get("best_streak", 0),
                quiz_completed=d.get("quiz_completed", 0),
                quiz_history=d.get("quiz_history", []),
                created_at=datetime.fromisoformat(d["created_at"]),
                updated_at=datetime.fromisoformat(d["updated_at"]),
            )
            self.game_progress[gp.user_id] = gp

        for d in raw.get("reels", []):
            r = Reel(
                id=d["id"], author_id=d["author_id"],
                author_username=d["author_username"],
                author_display_name=d["author_display_name"],
                author_avatar=d["author_avatar"],
                author_avatar_art=d["author_avatar_art"],
                author_verified=d["author_verified"],
                caption=d["caption"], hashtags=d["hashtags"],
                media_url=d["media_url"], poster_url=d["poster_url"],
                crop=d.get("crop"),
                audio_name=d["audio_name"], duration=d["duration"],
                view_count=d["view_count"], like_count=d["like_count"],
                comment_count=d["comment_count"], share_count=d["share_count"],
                created_at=datetime.fromisoformat(d["created_at"]),
                updated_at=datetime.fromisoformat(d["updated_at"]),
            )
            self.reels[r.id] = r

        for d in raw.get("reel_likes", []):
            rl = ReelLike(
                id=d["id"], reel_id=d["reel_id"], user_id=d["user_id"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.reel_likes[(rl.reel_id, rl.user_id)] = rl

        for d in raw.get("reel_saves", []):
            rs = ReelSave(
                id=d["id"], reel_id=d["reel_id"], user_id=d["user_id"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.reel_saves[(rs.reel_id, rs.user_id)] = rs

        for d in raw.get("reel_comments", []):
            rc = ReelComment(
                id=d["id"], reel_id=d["reel_id"], author_id=d["author_id"],
                author_username=d["author_username"],
                author_display_name=d["author_display_name"],
                author_avatar=d["author_avatar"],
                author_avatar_art=d["author_avatar_art"],
                text=d["text"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.reel_comments[rc.id] = rc

        for d in raw.get("reel_views", []):
            rv = ReelView(
                id=d["id"], reel_id=d["reel_id"], user_id=d["user_id"],
                created_at=datetime.fromisoformat(d["created_at"]),
            )
            self.reel_views[(rv.reel_id, rv.user_id)] = rv

    def _save(self) -> None:
        if not _DATA_FILE:
            return

        def dt(v: datetime) -> str:
            return v.isoformat()

        data = {
            "users": [
                {
                    "id": u.id, "username": u.username, "email": u.email,
                    "password_hash": u.password_hash,
                    "display_name": u.display_name, "bio": u.bio,
                    "profile_image": u.profile_image, "avatar_art": u.avatar_art,
                    "flag": u.flag, "country": u.country, "verified": u.verified,
                    "follower_count": u.follower_count,
                    "following_count": u.following_count,
                    "post_count": u.post_count,
                    "created_at": dt(u.created_at),
                    "updated_at": dt(u.updated_at),
                }
                for u in self.users.values()
            ],
            "posts": [
                {
                    "id": p.id, "author_id": p.author_id,
                    "author_username": p.author_username,
                    "author_display_name": p.author_display_name,
                    "author_avatar": p.author_avatar,
                    "author_avatar_art": p.author_avatar_art,
                    "author_verified": p.author_verified,
                    "country": p.country, "flag": p.flag,
                    "caption": p.caption, "hashtags": p.hashtags,
                    "media": p.media, "music": p.music,
                    "location": p.location,
                    "downloadable": p.downloadable,
                    "like_count": p.like_count,
                    "comment_count": p.comment_count,
                    "created_at": dt(p.created_at),
                    "updated_at": dt(p.updated_at),
                }
                for p in self.posts.values()
            ],
            "comments": [
                {
                    "id": c.id, "post_id": c.post_id, "author_id": c.author_id,
                    "author_username": c.author_username,
                    "author_display_name": c.author_display_name,
                    "author_avatar": c.author_avatar,
                    "author_avatar_art": c.author_avatar_art,
                    "text": c.text, "created_at": dt(c.created_at),
                }
                for c in self.comments.values()
            ],
            "likes": [
                {
                    "id": lk.id, "post_id": lk.post_id, "user_id": lk.user_id,
                    "created_at": dt(lk.created_at),
                }
                for lk in self.likes.values()
            ],
            "follows": [
                {
                    "id": f.id, "follower_id": f.follower_id,
                    "followed_id": f.followed_id,
                    "created_at": dt(f.created_at),
                }
                for f in self.follows.values()
            ],
            "saves": [
                {
                    "id": s.id, "user_id": s.user_id, "post_id": s.post_id,
                    "created_at": dt(s.created_at),
                }
                for s in self.saves.values()
            ],
            "notifications": [
                {
                    "id": n.id, "user_id": n.user_id, "actor_id": n.actor_id,
                    "actor_username": n.actor_username,
                    "actor_display_name": n.actor_display_name,
                    "actor_avatar": n.actor_avatar,
                    "actor_avatar_art": n.actor_avatar_art,
                    "type": n.type, "post_id": n.post_id,
                    "text": n.text, "read": n.read,
                    "created_at": dt(n.created_at),
                }
                for n in self.notifications.values()
            ],
            "stories": [
                {
                    "id": st.id, "author_id": st.author_id,
                    "author_username": st.author_username,
                    "author_display_name": st.author_display_name,
                    "author_avatar": st.author_avatar,
                    "author_avatar_art": st.author_avatar_art,
                    "author_verified": st.author_verified,
                    "caption": st.caption, "color": st.color,
                    "media_type": st.media_type,
                    "media": st.media, "music": st.music,
                    "view_count": st.view_count,
                    "created_at": dt(st.created_at),
                    "expires_at": dt(st.expires_at),
                }
                for st in self.stories.values()
            ],
            "story_views": [
                {
                    "id": sv.id, "story_id": sv.story_id, "user_id": sv.user_id,
                    "created_at": dt(sv.created_at),
                }
                for sv in self.story_views.values()
            ],
            "story_reactions": [
                {
                    "id": sr.id, "story_id": sr.story_id, "user_id": sr.user_id,
                    "type": sr.type, "created_at": dt(sr.created_at),
                }
                for sr in self.story_reactions.values()
            ],
            "story_replies": [
                {
                    "id": rp.id, "story_id": rp.story_id,
                    "author_id": rp.author_id,
                    "author_username": rp.author_username,
                    "author_display_name": rp.author_display_name,
                    "author_avatar": rp.author_avatar,
                    "author_avatar_art": rp.author_avatar_art,
                    "text": rp.text, "created_at": dt(rp.created_at),
                }
                for rp in self.story_replies.values()
            ],
            "game_progress": [
                {
                    "user_id": gp.user_id,
                    "xp": gp.xp,
                    "total_score": gp.total_score,
                    "best_score": gp.best_score,
                    "games_played": gp.games_played,
                    "best_streak": gp.best_streak,
                    "quiz_completed": gp.quiz_completed,
                    "quiz_history": gp.quiz_history,
                    "created_at": dt(gp.created_at),
                    "updated_at": dt(gp.updated_at),
                }
                for gp in self.game_progress.values()
            ],
            "reels": [
                {
                    "id": r.id, "author_id": r.author_id,
                    "author_username": r.author_username,
                    "author_display_name": r.author_display_name,
                    "author_avatar": r.author_avatar,
                    "author_avatar_art": r.author_avatar_art,
                    "author_verified": r.author_verified,
                    "caption": r.caption, "hashtags": r.hashtags,
                    "media_url": r.media_url, "poster_url": r.poster_url,
                    "crop": r.crop,
                    "audio_name": r.audio_name, "duration": r.duration,
                    "view_count": r.view_count, "like_count": r.like_count,
                    "comment_count": r.comment_count, "share_count": r.share_count,
                    "created_at": dt(r.created_at),
                    "updated_at": dt(r.updated_at),
                }
                for r in self.reels.values()
            ],
            "reel_likes": [
                {"id": rl.id, "reel_id": rl.reel_id, "user_id": rl.user_id, "created_at": dt(rl.created_at)}
                for rl in self.reel_likes.values()
            ],
            "reel_saves": [
                {"id": rs.id, "reel_id": rs.reel_id, "user_id": rs.user_id, "created_at": dt(rs.created_at)}
                for rs in self.reel_saves.values()
            ],
            "reel_comments": [
                {
                    "id": rc.id, "reel_id": rc.reel_id, "author_id": rc.author_id,
                    "author_username": rc.author_username,
                    "author_display_name": rc.author_display_name,
                    "author_avatar": rc.author_avatar,
                    "author_avatar_art": rc.author_avatar_art,
                    "text": rc.text, "created_at": dt(rc.created_at),
                }
                for rc in self.reel_comments.values()
            ],
            "reel_views": [
                {"id": rv.id, "reel_id": rv.reel_id, "user_id": rv.user_id, "created_at": dt(rv.created_at)}
                for rv in self.reel_views.values()
            ],
        }
        tmp = _DATA_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(_DATA_FILE)

    # ---- users ----
    def create_user(self, user: User) -> User:
        self.users[user.id] = user
        self._by_username[user.username.lower()] = user.id
        self._by_email[user.email.lower()] = user.id
        self._save()
        return user

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        return self.users.get(user_id)

    def get_user_by_username(self, username: str) -> Optional[User]:
        uid = self._by_username.get(username.lower())
        return self.users.get(uid) if uid else None

    def get_user_by_email(self, email: str) -> Optional[User]:
        uid = self._by_email.get(email.lower())
        return self.users.get(uid) if uid else None

    def update_user(self, user_id: str, updates: dict) -> Optional[User]:
        user = self.users.get(user_id)
        if not user:
            return None
        for key, value in updates.items():
            if hasattr(user, key):
                setattr(user, key, value)
        if "username" in updates:
            for k in list(self._by_username.keys()):
                if self._by_username[k] == user_id:
                    del self._by_username[k]
            self._by_username[user.username.lower()] = user_id
        if "email" in updates:
            for k in list(self._by_email.keys()):
                if self._by_email[k] == user_id:
                    del self._by_email[k]
            self._by_email[user.email.lower()] = user_id
        self._save()
        return user

    def list_users_by_ids(self, ids: list[str]) -> list[User]:
        return [self.users[i] for i in ids if i in self.users]

    def search_users(self, query: str, limit: int, offset: int) -> list[User]:
        q = query.lower()
        matches = sorted(
            (
                u
                for u in self.users.values()
                if q in u.username.lower() or q in u.display_name.lower()
            ),
            key=lambda u: u.created_at,
            reverse=True,
        )
        return matches[offset : offset + limit]

    # ---- posts ----
    def create_post(self, post: Post) -> Post:
        self.posts[post.id] = post
        self._save()
        return post

    def get_post(self, post_id: str) -> Optional[Post]:
        return self.posts.get(post_id)

    def update_post(self, post_id: str, updates: dict) -> Optional[Post]:
        post = self.posts.get(post_id)
        if not post:
            return None
        for key, value in updates.items():
            if hasattr(post, key):
                setattr(post, key, value)
        self._save()
        return post

    def delete_post(self, post_id: str) -> None:
        self.posts.pop(post_id, None)
        self.likes = {k: v for k, v in self.likes.items() if v.post_id != post_id}
        self.comments = {k: v for k, v in self.comments.items() if v.post_id != post_id}
        self.saves = {k: v for k, v in self.saves.items() if v.post_id != post_id}
        self.notifications = {
            k: v for k, v in self.notifications.items() if v.post_id != post_id
        }
        self._save()

    def list_posts(
        self, author_id: Optional[str] = None, limit: int = 20, offset: int = 0
    ) -> list[Post]:
        items = (
            [p for p in self.posts.values() if p.author_id == author_id]
            if author_id
            else list(self.posts.values())
        )
        items.sort(key=lambda p: p.created_at, reverse=True)
        return items[offset : offset + limit]

    def list_posts_for_authors(
        self, author_ids: list[str], limit: int = 20
    ) -> list[Post]:
        idset = set(author_ids)
        items = [p for p in self.posts.values() if p.author_id in idset]
        items.sort(key=lambda p: p.created_at, reverse=True)
        return items[:limit]

    def search_posts(self, query: str, limit: int, offset: int) -> list[Post]:
        q = query.lower()
        matches = [
            p
            for p in self.posts.values()
            if q in p.caption.lower()
            or any(q in h.lower() for h in p.hashtags)
        ]
        matches.sort(key=lambda p: p.created_at, reverse=True)
        return matches[offset : offset + limit]

    def increment_post_like_count(self, post_id: str, delta: int = 1) -> None:
        post = self.posts.get(post_id)
        if post:
            post.like_count = max(0, post.like_count + delta)
        self._save()

    def increment_post_comment_count(self, post_id: str, delta: int = 1) -> None:
        post = self.posts.get(post_id)
        if post:
            post.comment_count = max(0, post.comment_count + delta)
        self._save()

    def increment_user_post_count(self, user_id: str, delta: int = 1) -> None:
        user = self.users.get(user_id)
        if user:
            user.post_count = max(0, user.post_count + delta)
        self._save()

    # ---- likes ----
    def add_like(self, like: Like) -> bool:
        key = (like.post_id, like.user_id)
        if self.has_liked(like.post_id, like.user_id):
            return False
        self.likes[key] = like
        self._save()
        return True

    def remove_like(self, post_id: str, user_id: str) -> bool:
        key = (post_id, user_id)
        if key in self.likes:
            del self.likes[key]
            self._save()
            return True
        return False

    def has_liked(self, post_id: str, user_id: str) -> bool:
        return (post_id, user_id) in self.likes

    def list_liked_post_ids(self, user_id: str) -> set[str]:
        return {post_id for (post_id, uid) in self.likes if uid == user_id}

    # ---- comments ----
    def create_comment(self, comment: Comment) -> Comment:
        self.comments[comment.id] = comment
        self._save()
        return comment

    def get_comment(self, comment_id: str) -> Optional[Comment]:
        return self.comments.get(comment_id)

    def delete_comment(self, comment_id: str) -> bool:
        result = self.comments.pop(comment_id, None) is not None
        self._save()
        return result

    def list_comments(
        self, post_id: str, limit: int = 20, offset: int = 0
    ) -> list[Comment]:
        items = [
            c for c in self.comments.values() if c.post_id == post_id
        ]
        items.sort(key=lambda c: c.created_at, reverse=True)
        return items[offset : offset + limit]

    # ---- follows ----
    def add_follow(self, follow: Follow) -> bool:
        key = (follow.follower_id, follow.followed_id)
        if key in self.follows:
            return False
        self.follows[key] = follow
        self._save()
        return True

    def remove_follow(self, follower_id: str, followed_id: str) -> bool:
        key = (follower_id, followed_id)
        if key in self.follows:
            del self.follows[key]
            self._save()
            return True
        return False

    def has_follow(self, follower_id: str, followed_id: str) -> bool:
        return (follower_id, followed_id) in self.follows

    def list_followers(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[str]:
        items = [f.follower_id for f in self.follows.values() if f.followed_id == user_id]
        items.sort(key=lambda i: i)
        return items[offset : offset + limit]

    def list_following(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[str]:
        items = [f.followed_id for f in self.follows.values() if f.follower_id == user_id]
        items.sort(key=lambda i: i)
        return items[offset : offset + limit]

    def list_following_ids(self, user_id: str) -> list[str]:
        return [f.followed_id for f in self.follows.values() if f.follower_id == user_id]

    def increment_follow_counts(
        self, follower_id: str, followed_id: str, delta: int = 1
    ) -> None:
        follower = self.users.get(follower_id)
        followed = self.users.get(followed_id)
        if follower:
            follower.following_count = max(0, follower.following_count + delta)
        if followed:
            followed.follower_count = max(0, followed.follower_count + delta)
        self._save()

    # ---- saves ----
    def add_save(self, save: Save) -> bool:
        key = (save.user_id, save.post_id)
        if key in self.saves:
            return False
        self.saves[key] = save
        self._save()
        return True

    def remove_save(self, user_id: str, post_id: str) -> bool:
        key = (user_id, post_id)
        if key in self.saves:
            del self.saves[key]
            self._save()
            return True
        return False

    def has_saved(self, user_id: str, post_id: str) -> bool:
        return (user_id, post_id) in self.saves

    def list_saved_post_ids(self, user_id: str) -> list[str]:
        items = [post_id for (uid, post_id) in self.saves if uid == user_id]
        items.reverse()
        return items

    # ---- notifications ----
    def create_notification(self, notification: Notification) -> Notification:
        self.notifications[notification.id] = notification
        self._save()
        return notification

    def get_notification(self, notification_id: str) -> Optional[Notification]:
        return self.notifications.get(notification_id)

    def list_notifications(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[Notification]:
        items = [
            n for n in self.notifications.values() if n.user_id == user_id
        ]
        items.sort(key=lambda n: n.created_at, reverse=True)
        return items[offset : offset + limit]

    def mark_notification_read(
        self, notification_id: str
    ) -> Optional[Notification]:
        n = self.notifications.get(notification_id)
        if n:
            n.read = True
            self._save()
        return n

    def mark_all_notifications_read(self, user_id: str) -> int:
        count = 0
        for n in self.notifications.values():
            if n.user_id == user_id and not n.read:
                n.read = True
                count += 1
        self._save()
        return count

    def count_unread_notifications(self, user_id: str) -> int:
        return sum(
            1 for n in self.notifications.values() if n.user_id == user_id and not n.read
        )

    # ---- stories ----
    def create_story(self, story: Story) -> Story:
        self.stories[story.id] = story
        self._save()
        return story

    def get_story(self, story_id: str) -> Optional[Story]:
        return self.stories.get(story_id)

    def delete_story(self, story_id: str) -> None:
        self.stories.pop(story_id, None)
        self.story_views = {
            k: v for k, v in self.story_views.items() if v.story_id != story_id
        }
        self.story_reactions = {
            k: v for k, v in self.story_reactions.items() if v.story_id != story_id
        }
        self.story_replies = {
            k: v for k, v in self.story_replies.items() if v.story_id != story_id
        }
        self._save()

    def list_active_stories(self, now) -> list[Story]:
        items = [s for s in self.stories.values() if s.expires_at > now]
        items.sort(key=lambda s: s.created_at, reverse=True)
        return items

    def prune_expired_stories(self, now) -> int:
        expired = [s.id for s in self.stories.values() if s.expires_at <= now]
        for sid in expired:
            self.delete_story(sid)
        return len(expired)

    # ---- story views ----
    def add_story_view(self, view: StoryView) -> bool:
        key = (view.story_id, view.user_id)
        if key in self.story_views:
            return False
        self.story_views[key] = view
        self._save()
        return True

    def has_viewed_story(self, story_id: str, user_id: str) -> bool:
        return (story_id, user_id) in self.story_views

    def increment_story_view_count(self, story_id: str, delta: int = 1) -> None:
        story = self.stories.get(story_id)
        if story:
            story.view_count = max(0, story.view_count + delta)
        self._save()

    # ---- story reactions ----
    def set_story_reaction(self, reaction: StoryReaction) -> None:
        self.story_reactions[(reaction.story_id, reaction.user_id)] = reaction
        self._save()

    def remove_story_reaction(self, story_id: str, user_id: str) -> bool:
        key = (story_id, user_id)
        if key in self.story_reactions:
            del self.story_reactions[key]
            self._save()
            return True
        return False

    def get_story_reaction(self, story_id: str, user_id: str) -> Optional[StoryReaction]:
        return self.story_reactions.get((story_id, user_id))

    # ---- story replies ----
    def create_story_reply(self, reply: StoryReply) -> StoryReply:
        self.story_replies[reply.id] = reply
        self._save()
        return reply

    def list_story_replies(
        self, story_id: str, limit: int = 20, offset: int = 0
    ) -> list[StoryReply]:
        items = [r for r in self.story_replies.values() if r.story_id == story_id]
        items.sort(key=lambda r: r.created_at, reverse=True)
        return items[offset : offset + limit]

    # ---- game progress ----
    def get_game_progress(self, user_id: str) -> Optional[GameProgress]:
        return self.game_progress.get(user_id)

    def upsert_game_progress(self, progress: GameProgress) -> GameProgress:
        self.game_progress[progress.user_id] = progress
        self._save()
        return progress

    # ---- reels ----
    def create_reel(self, reel: Reel) -> Reel:
        self.reels[reel.id] = reel
        self._save()
        return reel

    def get_reel(self, reel_id: str) -> Optional[Reel]:
        return self.reels.get(reel_id)

    def delete_reel(self, reel_id: str) -> None:
        self.reels.pop(reel_id, None)
        self.reel_likes = {k: v for k, v in self.reel_likes.items() if v.reel_id != reel_id}
        self.reel_saves = {k: v for k, v in self.reel_saves.items() if v.reel_id != reel_id}
        self.reel_comments = {k: v for k, v in self.reel_comments.items() if v.reel_id != reel_id}
        self.reel_views = {k: v for k, v in self.reel_views.items() if v.reel_id != reel_id}
        self._save()

    def list_reels(self, limit: int = 20, offset: int = 0) -> list[Reel]:
        items = list(self.reels.values())
        items.sort(key=lambda r: r.created_at, reverse=True)
        return items[offset: offset + limit]

    def list_reels_by_author(self, author_id: str, limit: int = 20, offset: int = 0) -> list[Reel]:
        items = [r for r in self.reels.values() if r.author_id == author_id]
        items.sort(key=lambda r: r.created_at, reverse=True)
        return items[offset: offset + limit]

    def increment_reel_field(self, reel_id: str, field: str, delta: int = 1) -> None:
        reel = self.reels.get(reel_id)
        if reel and hasattr(reel, field):
            setattr(reel, field, max(0, getattr(reel, field) + delta))
        self._save()

    # ---- reel likes ----
    def add_reel_like(self, like: ReelLike) -> bool:
        key = (like.reel_id, like.user_id)
        if key in self.reel_likes:
            return False
        self.reel_likes[key] = like
        self._save()
        return True

    def remove_reel_like(self, reel_id: str, user_id: str) -> bool:
        key = (reel_id, user_id)
        if key in self.reel_likes:
            del self.reel_likes[key]
            self._save()
            return True
        return False

    def has_liked_reel(self, reel_id: str, user_id: str) -> bool:
        return (reel_id, user_id) in self.reel_likes

    def list_liked_reel_ids(self, user_id: str) -> set[str]:
        return {reel_id for (reel_id, uid) in self.reel_likes if uid == user_id}

    # ---- reel saves ----
    def add_reel_save(self, save: ReelSave) -> bool:
        key = (save.reel_id, save.user_id)
        if key in self.reel_saves:
            return False
        self.reel_saves[key] = save
        self._save()
        return True

    def remove_reel_save(self, reel_id: str, user_id: str) -> bool:
        key = (reel_id, user_id)
        if key in self.reel_saves:
            del self.reel_saves[key]
            self._save()
            return True
        return False

    def has_saved_reel(self, reel_id: str, user_id: str) -> bool:
        return (reel_id, user_id) in self.reel_saves

    def list_saved_reel_ids(self, user_id: str) -> list[str]:
        items = [reel_id for (reel_id, uid) in self.reel_saves if uid == user_id]
        items.reverse()
        return items

    # ---- reel comments ----
    def create_reel_comment(self, comment: ReelComment) -> ReelComment:
        self.reel_comments[comment.id] = comment
        self._save()
        return comment

    def get_reel_comment(self, comment_id: str) -> Optional[ReelComment]:
        return self.reel_comments.get(comment_id)

    def delete_reel_comment(self, comment_id: str) -> bool:
        result = self.reel_comments.pop(comment_id, None) is not None
        self._save()
        return result

    def list_reel_comments(self, reel_id: str, limit: int = 20, offset: int = 0) -> list[ReelComment]:
        items = [c for c in self.reel_comments.values() if c.reel_id == reel_id]
        items.sort(key=lambda c: c.created_at, reverse=True)
        return items[offset: offset + limit]

    # ---- reel views ----
    def add_reel_view(self, view: ReelView) -> bool:
        key = (view.reel_id, view.user_id)
        if key in self.reel_views:
            return False
        self.reel_views[key] = view
        self._save()
        return True

    def has_viewed_reel(self, reel_id: str, user_id: str) -> bool:
        return (reel_id, user_id) in self.reel_views
