"""Post, like, save and comment routes (post-scoped)."""

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile

from app.api.dependencies import get_current_user, get_db, get_optional_user
from app.core.errors import BadRequestError
from app.core.rate_limit import limiter, comment_limit, create_post_limit
from app.models import User
from app.repositories.base import Repository
from app.schemas.comment import CommentCreateRequest
from app.schemas.post import PostCreateRequest, PostUpdateRequest
from app.services import post_service, social_service
from app.services.media_storage import upload_media
from app.utils.pagination import clamp_offset, resolve_page_size

router = APIRouter(prefix="/api/posts", tags=["posts"])


# -------- posts --------
@router.post("/upload")
@limiter.limit(lambda: create_post_limit())
def upload_post_media(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload image/video media for a post.

    Returns the media type and URL to be included in the post creation payload.
    """
    if not file.content_type:
        raise BadRequestError("Could not determine file type.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise BadRequestError("File is empty.")

    media = upload_media(file_bytes, file.content_type, folder="posts")
    return {"success": True, "media": media}


@router.post("")
@limiter.limit(lambda: create_post_limit())
def create_post(
    request: Request,
    payload: PostCreateRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = post_service.create_post(repo, current_user, payload)
    return {"success": True, "post": data}


@router.get("")
def list_posts(
    request: Request,
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    viewer: User | None = Depends(get_optional_user),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    posts, more = post_service.list_posts(repo, None, off, limit, viewer.id if viewer else None)
    return {"success": True, "posts": posts, "has_more": more, "offset": off, "limit": limit}


@router.get("/{post_id}")
def get_post(
    post_id: str,
    viewer: User | None = Depends(get_optional_user),
    repo: Repository = Depends(get_db),
):
    data = post_service.get_post(repo, post_id, viewer.id if viewer else None)
    return {"success": True, "post": data}


@router.patch("/{post_id}")
def update_post(
    post_id: str,
    payload: PostUpdateRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = post_service.update_post(repo, post_id, current_user.id, payload)
    return {"success": True, "post": data}


@router.delete("/{post_id}")
def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    post_service.delete_post(repo, post_id, current_user.id)
    return {"success": True, "message": "Post deleted."}


# -------- likes --------
@router.post("/{post_id}/like")
def like_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **social_service.like_post(repo, post_id, current_user)}


@router.delete("/{post_id}/like")
def unlike_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **social_service.unlike_post(repo, post_id, current_user.id)}


# -------- saves --------
@router.post("/{post_id}/save")
def save_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **social_service.save_post(repo, post_id, current_user.id)}


@router.delete("/{post_id}/save")
def unsave_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **social_service.unsave_post(repo, post_id, current_user.id)}


# -------- comments --------
@router.post("/{post_id}/comments")
@limiter.limit(lambda: comment_limit())
def create_comment(
    request: Request,
    post_id: str,
    payload: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = social_service.create_comment(repo, post_id, current_user, payload)
    return {"success": True, "comment": data}


@router.get("/{post_id}/comments")
def list_comments(
    post_id: str,
    request: Request,
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    comments, more = social_service.list_comments(repo, post_id, off, limit)
    return {"success": True, "comments": comments, "has_more": more}
