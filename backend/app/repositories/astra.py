"""Astra DB-backed repository (DataStax Data API).

This implementation targets the DataStax Astra DB Data API via the `astrapy`
client. It mirrors the `Repository` contract. It is selected automatically when
Astra DB credentials are present in the environment; otherwise `MemoryRepository`
is used (offline development and tests).

Data model (document collections, one per domain):
  - users            keyed by user id, with unique username/email lookups
  - posts            keyed by post id, authored-user field for scoped feeds
  - comments         keyed by comment id, scoped by post id
  - likes            compound document keyed by post_id+user_id (idempotent)
  - follows          compound document keyed by follower+followed (idempotent)
  - saves            compound document keyed by user+post (idempotent)
  - notifications    keyed by notification id, scoped by recipient user id

Compound-key documents (likes/follows/saves) guarantee uniqueness and make
duplicate-insert prevention a natural part of the data model.
"""

from __future__ import annotations

from typing import Optional

from app.core.config import get_settings
from app.models import (
    Comment,
    Follow,
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
from app.repositories import memory as _memory


class AstraRepository(Repository):
    def __init__(self) -> None:
        settings = get_settings()
        from astrapy import DataAPIClient

        client = DataAPIClient(settings.astra_db_application_token)
        self.database = client.get_database(
            settings.astra_db_api_endpoint,
            keyspace=settings.astra_db_keyspace or None,
        )
        self.users = self.database.get_collection("users")
        self.posts = self.database.get_collection("posts")
        self.comments = self.database.get_collection("comments")
        self.likes = self.database.get_collection("likes")
        self.follows = self.database.get_collection("follows")
        self.saves = self.database.get_collection("saves")
        self.notifications = self.database.get_collection("notifications")
        self.stories = self.database.get_collection("stories")
        self.story_views = self.database.get_collection("story_views")
        self.story_reactions = self.database.get_collection("story_reactions")
        self.story_replies = self.database.get_collection("story_replies")
        self.reels = self.database.get_collection("reels")
        self.reel_likes = self.database.get_collection("reel_likes")
        self.reel_saves = self.database.get_collection("reel_saves")
        self.reel_comments = self.database.get_collection("reel_comments")
        self.reel_views = self.database.get_collection("reel_views")

    # ---------------- helpers ----------------
    @staticmethod
    def _doc(model) -> dict:
        """Serialize a model to a document for the Data API."""
        d = {}
        for field_name in model.__dataclass_fields__:
            value = getattr(model, field_name)
            if hasattr(value, "isoformat"):
                value = value.isoformat()
            d[field_name] = value
        return d

    # ---------------- users ----------------
    def create_user(self, user: User) -> User:
        self.users.insert_one(self._doc(user))
        return user

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        doc = self.users.find_one({"_id": user_id})
        return self._from_doc(User, doc) if doc else None

    def get_user_by_username(self, username: str) -> Optional[User]:
        doc = self.users.find_one({"username": username})
        return self._from_doc(User, doc) if doc else None

    def get_user_by_email(self, email: str) -> Optional[User]:
        doc = self.users.find_one({"email": email})
        return self._from_doc(User, doc) if doc else None

    def update_user(self, user_id: str, updates: dict) -> Optional[User]:
        self.users.update_one({"_id": user_id}, {"$set": updates})
        return self.get_user_by_id(user_id)

    def list_users_by_ids(self, ids: list[str]) -> list[User]:
        if not ids:
            return []
        docs = self.users.find({"_id": {"$in": ids}})
        return [self._from_doc(User, d) for d in docs]

    def search_users(self, query: str, limit: int, offset: int) -> list[User]:
        docs = self.users.find(
            {
                "$or": [
                    {"username": {"$regex": query, "$options": "i"}},
                    {"display_name": {"$regex": query, "$options": "i"}},
                ]
            },
            skip=offset,
            limit=limit,
        )
        return [self._from_doc(User, d) for d in docs]

    # ---------------- posts ----------------
    def create_post(self, post: Post) -> Post:
        self.posts.insert_one(self._doc(post))
        return post

    def get_post(self, post_id: str) -> Optional[Post]:
        doc = self.posts.find_one({"_id": post_id})
        return self._from_doc(Post, doc) if doc else None

    def update_post(self, post_id: str, updates: dict) -> Optional[Post]:
        self.posts.update_one({"_id": post_id}, {"$set": updates})
        return self.get_post(post_id)

    def delete_post(self, post_id: str) -> None:
        self.posts.delete_one({"_id": post_id})
        self.comments.delete_many({"post_id": post_id})
        self.likes.delete_many({"post_id": post_id})
        self.saves.delete_many({"post_id": post_id})

    def list_posts(
        self, author_id: Optional[str] = None, limit: int = 20, offset: int = 0
    ) -> list[Post]:
        filt = {"author_id": author_id} if author_id else {}
        docs = self.posts.find(
            filt, skip=offset, limit=limit, sort={"created_at": -1}
        )
        return [self._from_doc(Post, d) for d in docs]

    def list_posts_for_authors(
        self, author_ids: list[str], limit: int = 20
    ) -> list[Post]:
        if not author_ids:
            return []
        docs = self.posts.find(
            {"author_id": {"$in": author_ids}},
            limit=limit,
            sort={"created_at": -1},
        )
        return [self._from_doc(Post, d) for d in docs]

    def search_posts(self, query: str, limit: int, offset: int) -> list[Post]:
        docs = self.posts.find(
            {
                "$or": [
                    {"caption": {"$regex": query, "$options": "i"}},
                    {"hashtags": {"$regex": query, "$options": "i"}},
                ]
            },
            skip=offset,
            limit=limit,
            sort={"created_at": -1},
        )
        return [self._from_doc(Post, d) for d in docs]

    def increment_post_like_count(self, post_id: str, delta: int = 1) -> None:
        self.posts.update_one(
            {"_id": post_id}, {"$inc": {"like_count": delta}}
        )

    def increment_post_comment_count(self, post_id: str, delta: int = 1) -> None:
        self.posts.update_one(
            {"_id": post_id}, {"$inc": {"comment_count": delta}}
        )

    def increment_user_post_count(self, user_id: str, delta: int = 1) -> None:
        self.users.update_one(
            {"_id": user_id}, {"$inc": {"post_count": delta}}
        )

    # ---------------- likes ----------------
    def add_like(self, like: Like) -> bool:
        key = f"like:{like.post_id}:{like.user_id}"
        try:
            self.likes.insert_one({"_id": key, **self._doc(like)})
            return True
        except Exception:
            return False

    def remove_like(self, post_id: str, user_id: str) -> bool:
        key = f"like:{post_id}:{user_id}"
        result = self.likes.delete_one({"_id": key})
        return bool(getattr(result, "deleted_count", result) > 0)

    def has_liked(self, post_id: str, user_id: str) -> bool:
        key = f"like:{post_id}:{user_id}"
        return self.likes.find_one({"_id": key}) is not None

    def list_liked_post_ids(self, user_id: str) -> set[str]:
        docs = self.likes.find({"user_id": user_id}, projection={"post_id": 1})
        return {d["post_id"] for d in docs}

    # ---------------- comments ----------------
    def create_comment(self, comment: Comment) -> Comment:
        self.comments.insert_one(self._doc(comment))
        return comment

    def get_comment(self, comment_id: str) -> Optional[Comment]:
        doc = self.comments.find_one({"_id": comment_id})
        return self._from_doc(Comment, doc) if doc else None

    def delete_comment(self, comment_id: str) -> bool:
        result = self.comments.delete_one({"_id": comment_id})
        return bool(getattr(result, "deleted_count", result) > 0)

    def list_comments(
        self, post_id: str, limit: int = 20, offset: int = 0
    ) -> list[Comment]:
        docs = self.comments.find(
            {"post_id": post_id},
            skip=offset,
            limit=limit,
            sort={"created_at": -1},
        )
        return [self._from_doc(Comment, d) for d in docs]

    # ---------------- follows ----------------
    def add_follow(self, follow: Follow) -> bool:
        key = f"follow:{follow.follower_id}:{follow.followed_id}"
        try:
            self.follows.insert_one({"_id": key, **self._doc(follow)})
            return True
        except Exception:
            return False

    def remove_follow(self, follower_id: str, followed_id: str) -> bool:
        key = f"follow:{follower_id}:{followed_id}"
        result = self.follows.delete_one({"_id": key})
        return bool(getattr(result, "deleted_count", result) > 0)

    def has_follow(self, follower_id: str, followed_id: str) -> bool:
        key = f"follow:{follower_id}:{followed_id}"
        return self.follows.find_one({"_id": key}) is not None

    def list_followers(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[str]:
        docs = self.follows.find(
            {"followed_id": user_id},
            projection={"follower_id": 1},
            skip=offset,
            limit=limit,
        )
        return [d["follower_id"] for d in docs]

    def list_following(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[str]:
        docs = self.follows.find(
            {"follower_id": user_id},
            projection={"followed_id": 1},
            skip=offset,
            limit=limit,
        )
        return [d["followed_id"] for d in docs]

    def list_following_ids(self, user_id: str) -> list[str]:
        docs = self.follows.find(
            {"follower_id": user_id}, projection={"followed_id": 1}
        )
        return [d["followed_id"] for d in docs]

    def increment_follow_counts(
        self, follower_id: str, followed_id: str, delta: int = 1
    ) -> None:
        self.users.update_one(
            {"_id": follower_id}, {"$inc": {"following_count": delta}}
        )
        self.users.update_one(
            {"_id": followed_id}, {"$inc": {"follower_count": delta}}
        )

    # ---------------- saves ----------------
    def add_save(self, save: Save) -> bool:
        key = f"save:{save.user_id}:{save.post_id}"
        try:
            self.saves.insert_one({"_id": key, **self._doc(save)})
            return True
        except Exception:
            return False

    def remove_save(self, user_id: str, post_id: str) -> bool:
        key = f"save:{user_id}:{post_id}"
        result = self.saves.delete_one({"_id": key})
        return bool(getattr(result, "deleted_count", result) > 0)

    def has_saved(self, user_id: str, post_id: str) -> bool:
        key = f"save:{user_id}:{post_id}"
        return self.saves.find_one({"_id": key}) is not None

    def list_saved_post_ids(self, user_id: str) -> list[str]:
        docs = self.saves.find(
            {"user_id": user_id},
            projection={"post_id": 1},
            sort={"created_at": -1},
        )
        return [d["post_id"] for d in docs]

    # ---------------- notifications ----------------
    def create_notification(self, notification: Notification) -> Notification:
        self.notifications.insert_one(self._doc(notification))
        return notification

    def get_notification(self, notification_id: str) -> Optional[Notification]:
        doc = self.notifications.find_one({"_id": notification_id})
        return self._from_doc(Notification, doc) if doc else None

    def list_notifications(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[Notification]:
        docs = self.notifications.find(
            {"user_id": user_id},
            skip=offset,
            limit=limit,
            sort={"created_at": -1},
        )
        return [self._from_doc(Notification, d) for d in docs]

    def mark_notification_read(
        self, notification_id: str
    ) -> Optional[Notification]:
        self.notifications.update_one(
            {"_id": notification_id}, {"$set": {"read": True}}
        )
        return self.get_notification(notification_id)

    def mark_all_notifications_read(self, user_id: str) -> int:
        result = self.notifications.update_many(
            {"user_id": user_id, "read": False}, {"$set": {"read": True}}
        )
        return int(getattr(result, "modified_count", result) or 0)

    def count_unread_notifications(self, user_id: str) -> int:
        return int(
            self.notifications.count_documents(
                {"user_id": user_id, "read": False}
            )
        )

    # ---------------- stories ----------------
    def create_story(self, story: Story) -> Story:
        self.stories.insert_one(self._doc(story))
        return story

    def get_story(self, story_id: str) -> Optional[Story]:
        doc = self.stories.find_one({"_id": story_id})
        return self._from_doc(Story, doc) if doc else None

    def delete_story(self, story_id: str) -> None:
        self.stories.delete_one({"_id": story_id})
        self.story_views.delete_many({"story_id": story_id})
        self.story_reactions.delete_many({"story_id": story_id})
        self.story_replies.delete_many({"story_id": story_id})

    def list_active_stories(self, now) -> list[Story]:
        docs = self.stories.find(
            {"expires_at": {"$gt": now.isoformat()}},
            sort={"created_at": -1},
        )
        return [self._from_doc(Story, d) for d in docs]

    def prune_expired_stories(self, now) -> int:
        expired = self.stories.find(
            {"expires_at": {"$lte": now.isoformat()}}, projection={"_id": 1}
        )
        ids = [d["_id"] for d in expired]
        for sid in ids:
            self.delete_story(sid)
        return len(ids)

    # ---------------- story views ----------------
    def add_story_view(self, view: StoryView) -> bool:
        key = f"storyview:{view.story_id}:{view.user_id}"
        try:
            self.story_views.insert_one({"_id": key, **self._doc(view)})
            return True
        except Exception:
            return False

    def has_viewed_story(self, story_id: str, user_id: str) -> bool:
        key = f"storyview:{story_id}:{user_id}"
        return self.story_views.find_one({"_id": key}) is not None

    def increment_story_view_count(self, story_id: str, delta: int = 1) -> None:
        self.stories.update_one(
            {"_id": story_id}, {"$inc": {"view_count": delta}}
        )

    # ---------------- story reactions ----------------
    def set_story_reaction(self, reaction: StoryReaction) -> None:
        key = f"storyreaction:{reaction.story_id}:{reaction.user_id}"
        self.story_reactions.update_one(
            {"_id": key},
            {"$set": self._doc(reaction)},
            upsert=True,
        )

    def remove_story_reaction(self, story_id: str, user_id: str) -> bool:
        key = f"storyreaction:{story_id}:{user_id}"
        result = self.story_reactions.delete_one({"_id": key})
        return bool(getattr(result, "deleted_count", result) > 0)

    def get_story_reaction(self, story_id: str, user_id: str) -> Optional[StoryReaction]:
        key = f"storyreaction:{story_id}:{user_id}"
        doc = self.story_reactions.find_one({"_id": key})
        return self._from_doc(StoryReaction, doc) if doc else None

    # ---------------- story replies ----------------
    def create_story_reply(self, reply: StoryReply) -> StoryReply:
        self.story_replies.insert_one(self._doc(reply))
        return reply

    def list_story_replies(
        self, story_id: str, limit: int = 20, offset: int = 0
    ) -> list[StoryReply]:
        docs = self.story_replies.find(
            {"story_id": story_id},
            skip=offset,
            limit=limit,
            sort={"created_at": -1},
        )
        return [self._from_doc(StoryReply, d) for d in docs]

    # ---------------- reels ----------------
    def create_reel(self, reel: Reel) -> Reel:
        self.reels.insert_one(self._doc(reel))
        return reel

    def get_reel(self, reel_id: str) -> Optional[Reel]:
        doc = self.reels.find_one({"_id": reel_id})
        return self._from_doc(Reel, doc) if doc else None

    def delete_reel(self, reel_id: str) -> None:
        self.reels.delete_one({"_id": reel_id})
        self.reel_likes.delete_many({"reel_id": reel_id})
        self.reel_saves.delete_many({"reel_id": reel_id})
        self.reel_comments.delete_many({"reel_id": reel_id})
        self.reel_views.delete_many({"reel_id": reel_id})

    def list_reels(self, limit: int = 20, offset: int = 0) -> list[Reel]:
        docs = self.reels.find(skip=offset, limit=limit, sort={"created_at": -1})
        return [self._from_doc(Reel, d) for d in docs]

    def list_reels_by_author(self, author_id: str, limit: int = 20, offset: int = 0) -> list[Reel]:
        docs = self.reels.find(
            {"author_id": author_id}, skip=offset, limit=limit, sort={"created_at": -1}
        )
        return [self._from_doc(Reel, d) for d in docs]

    def increment_reel_field(self, reel_id: str, field: str, delta: int = 1) -> None:
        self.reels.update_one({"_id": reel_id}, {"$inc": {field: delta}})

    # ---------------- reel likes ----------------
    def add_reel_like(self, like: ReelLike) -> bool:
        key = f"reellike:{like.reel_id}:{like.user_id}"
        try:
            self.reel_likes.insert_one({"_id": key, **self._doc(like)})
            return True
        except Exception:
            return False

    def remove_reel_like(self, reel_id: str, user_id: str) -> bool:
        key = f"reellike:{reel_id}:{user_id}"
        result = self.reel_likes.delete_one({"_id": key})
        return bool(getattr(result, "deleted_count", result) > 0)

    def has_liked_reel(self, reel_id: str, user_id: str) -> bool:
        key = f"reellike:{reel_id}:{user_id}"
        return self.reel_likes.find_one({"_id": key}) is not None

    def list_liked_reel_ids(self, user_id: str) -> set[str]:
        docs = self.reel_likes.find({"user_id": user_id}, projection={"reel_id": 1})
        return {d["reel_id"] for d in docs}

    # ---------------- reel saves ----------------
    def add_reel_save(self, save: ReelSave) -> bool:
        key = f"reelsave:{save.reel_id}:{save.user_id}"
        try:
            self.reel_saves.insert_one({"_id": key, **self._doc(save)})
            return True
        except Exception:
            return False

    def remove_reel_save(self, reel_id: str, user_id: str) -> bool:
        key = f"reelsave:{reel_id}:{user_id}"
        result = self.reel_saves.delete_one({"_id": key})
        return bool(getattr(result, "deleted_count", result) > 0)

    def has_saved_reel(self, reel_id: str, user_id: str) -> bool:
        key = f"reelsave:{reel_id}:{user_id}"
        return self.reel_saves.find_one({"_id": key}) is not None

    def list_saved_reel_ids(self, user_id: str) -> list[str]:
        docs = self.reel_saves.find(
            {"user_id": user_id}, projection={"reel_id": 1}, sort={"created_at": -1}
        )
        return [d["reel_id"] for d in docs]

    # ---------------- reel comments ----------------
    def create_reel_comment(self, comment: ReelComment) -> ReelComment:
        self.reel_comments.insert_one(self._doc(comment))
        return comment

    def get_reel_comment(self, comment_id: str) -> Optional[ReelComment]:
        doc = self.reel_comments.find_one({"_id": comment_id})
        return self._from_doc(ReelComment, doc) if doc else None

    def delete_reel_comment(self, comment_id: str) -> bool:
        result = self.reel_comments.delete_one({"_id": comment_id})
        return bool(getattr(result, "deleted_count", result) > 0)

    def list_reel_comments(self, reel_id: str, limit: int = 20, offset: int = 0) -> list[ReelComment]:
        docs = self.reel_comments.find(
            {"reel_id": reel_id}, skip=offset, limit=limit, sort={"created_at": -1}
        )
        return [self._from_doc(ReelComment, d) for d in docs]

    # ---------------- reel views ----------------
    def add_reel_view(self, view: ReelView) -> bool:
        key = f"reelview:{view.reel_id}:{view.user_id}"
        try:
            self.reel_views.insert_one({"_id": key, **self._doc(view)})
            return True
        except Exception:
            return False

    def has_viewed_reel(self, reel_id: str, user_id: str) -> bool:
        key = f"reelview:{reel_id}:{user_id}"
        return self.reel_views.find_one({"_id": key}) is not None

    # ---------------- serialisation helper ----------------
    @staticmethod
    def _from_doc(model_cls, doc: dict):
        if not doc:
            return None
        data = dict(doc)
        data.pop("_id", None)
        return model_cls(**data)


# Backward compatibility for offline code paths that reference MemoryRepository
