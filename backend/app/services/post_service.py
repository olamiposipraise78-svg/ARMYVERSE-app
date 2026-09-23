"""Post, feed and search business logic."""

from __future__ import annotations

from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models import Post, User
from app.repositories.base import Repository
from app.schemas.post import PostCreateRequest, PostUpdateRequest
from app.serializers.frontend import post_to_frontend
from app.utils.pagination import has_more


def _denormalize_author(post: Post, author: User) -> None:
    post.author_username = author.username
    post.author_display_name = author.display_name or author.username
    post.author_avatar = author.profile_image
    post.author_avatar_art = author.avatar_art
    post.author_verified = author.verified
    post.country = author.country
    post.flag = author.flag


def create_post(
    repo: Repository, author: User, payload: PostCreateRequest
) -> dict:
    if not payload.caption.strip() and payload.media is None:
        raise BadRequestError("A post needs a caption or media.")

    post = Post(
        author_id=author.id,
        caption=payload.caption.strip(),
        hashtags=[h.strip() for h in payload.hashtags if h.strip()],
        media=payload.media.dict() if payload.media else None,
        music=payload.music if payload.music else None,
        location=payload.location.strip(),
        downloadable=payload.downloadable,
    )
    _denormalize_author(post, author)
    created = repo.create_post(post)
    repo.increment_user_post_count(author.id, 1)
    return post_to_frontend(created)


def get_post(
    repo: Repository, post_id: str, viewer_id: str | None
) -> dict:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")
    repo.update_post(post_id, {"view_count": post.view_count + 1})
    post.view_count += 1
    liked = repo.has_liked(post_id, viewer_id) if viewer_id else False
    saved = repo.has_saved(viewer_id, post_id) if viewer_id else False
    return post_to_frontend(post, liked_by_user=liked, saved_by_user=saved)


def update_post(
    repo: Repository, post_id: str, actor_id: str, payload: PostUpdateRequest
) -> dict:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")
    if post.author_id != actor_id:
        raise ForbiddenError("You can only edit your own posts.")

    updates: dict = {}
    if payload.caption is not None:
        updates["caption"] = payload.caption.strip()
    if payload.hashtags is not None:
        updates["hashtags"] = [h.strip() for h in payload.hashtags if h.strip()]
    if payload.media is not None:
        updates["media"] = payload.media.dict()
    if payload.music is not None:
        updates["music"] = payload.music
    if payload.location is not None:
        updates["location"] = payload.location.strip()
    if payload.downloadable is not None:
        updates["downloadable"] = payload.downloadable

    if not updates:
        raise BadRequestError("Nothing to update.")
    updated = repo.update_post(post_id, updates)
    return post_to_frontend(updated)


def delete_post(repo: Repository, post_id: str, actor_id: str) -> None:
    post = repo.get_post(post_id)
    if not post:
        raise NotFoundError("Post not found.")
    if post.author_id != actor_id:
        raise ForbiddenError("You can only delete your own posts.")
    repo.delete_post(post_id)
    repo.increment_user_post_count(actor_id, -1)


def _serialize_posts(
    repo: Repository, posts: list[Post], viewer_id: str | None
) -> list[dict]:
    liked = repo.list_liked_post_ids(viewer_id) if viewer_id else set()
    return [
        post_to_frontend(p, liked_by_user=p.id in liked)
        for p in posts
    ]


def list_posts(
    repo: Repository,
    author_id: str | None,
    offset: int,
    limit: int,
    viewer_id: str | None,
) -> tuple[list[dict], bool]:
    posts = repo.list_posts(author_id, limit + 1, offset)
    has_more_posts = len(posts) > limit
    posts = posts[:limit]
    return _serialize_posts(repo, posts, viewer_id), has_more_posts


def feed(
    repo: Repository, viewer: User, offset: int, limit: int
) -> tuple[list[dict], bool]:
    following_ids = set(repo.list_following_ids(viewer.id))

    # Posts from followed users plus the viewer's own posts, merged with a
    # curated recent set. Fetched in bounded chunks to avoid full scans.
    pools: list[Post] = []
    if following_ids:
        pools.extend(repo.list_posts_for_authors(list(following_ids), limit + 1))
    pools.extend(repo.list_posts(viewer.id, limit + 1, 0))

    # Deduplicate by id, newest first.
    seen: set[str] = set()
    merged: list[Post] = []
    for p in pools:
        if p.id not in seen:
            seen.add(p.id)
            merged.append(p)
    merged.sort(key=lambda p: p.created_at, reverse=True)

    page = merged[offset : offset + limit]
    # If the followed-derived pool is short, top up with public recent posts.
    if len(page) < limit:
        extra = repo.list_posts(None, limit, 0)
        for p in extra:
            if p.id not in seen and len(page) < limit:
                seen.add(p.id)
                page.append(p)
                page.sort(key=lambda q: q.created_at, reverse=True)
    page = page[:limit]

    has_more_posts = False
    # Determine more from the merged pool.
    if len(merged) > offset + limit:
        has_more_posts = True
    return _serialize_posts(repo, page, viewer.id), has_more_posts


def search_posts(
    repo: Repository, query: str, offset: int, limit: int, viewer_id: str | None
) -> tuple[list[dict], bool]:
    posts = repo.search_posts(query, limit + 1, offset)
    more = len(posts) > limit
    posts = posts[:limit]
    return _serialize_posts(repo, posts, viewer_id), more


def search_users(
    repo: Repository, query: str, offset: int, limit: int
) -> tuple[list[dict], bool]:
    from app.serializers.frontend import user_to_frontend

    users = repo.search_users(query, limit + 1, offset)
    more = len(users) > limit
    users = users[:limit]
    return [user_to_frontend(u) for u in users], more
