"""Feed and search routes."""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user, get_db
from app.core.errors import BadRequestError
from app.models import User
from app.repositories.base import Repository
from app.services import post_service
from app.utils.pagination import clamp_offset, resolve_page_size

router = APIRouter(prefix="/api", tags=["feed", "search"])

MAX_QUERY_LENGTH = 100


def _clean_query(q: str) -> str:
    q = q.strip()
    if not q:
        raise BadRequestError("A search query is required.")
    if len(q) > MAX_QUERY_LENGTH:
        raise BadRequestError("Search query is too long.")
    return q


@router.get("/feed")
def get_feed(
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    posts, more = post_service.feed(repo, current_user, off, limit)
    return {"success": True, "posts": posts, "has_more": more, "offset": off, "limit": limit}


@router.get("/search/users")
def search_users(
    q: str = Query("", min_length=1, max_length=100),
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    repo: Repository = Depends(get_db),
):
    query = _clean_query(q)
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    users, more = post_service.search_users(repo, query, off, limit)
    return {"success": True, "users": users, "has_more": more}


@router.get("/search/posts")
def search_posts(
    q: str = Query("", min_length=1, max_length=100),
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    viewer: User | None = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    query = _clean_query(q)
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    posts, more = post_service.search_posts(repo, query, off, limit, viewer.id)
    return {"success": True, "posts": posts, "has_more": more}
