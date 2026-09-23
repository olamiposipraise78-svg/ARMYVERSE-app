"""Reel routes."""

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile

from app.api.dependencies import get_current_user, get_db, get_optional_user
from app.core.errors import BadRequestError
from app.core.rate_limit import limiter, create_post_limit, comment_limit
from app.models import User
from app.repositories.base import Repository
from app.schemas.reel import ReelCommentCreateRequest, ReelCreateRequest
from app.services import reel_service
from app.services.media_storage import upload_media
from app.utils.pagination import clamp_offset, resolve_page_size

router = APIRouter(prefix="/api/reels", tags=["reels"])


@router.post("/upload")
@limiter.limit(lambda: create_post_limit())
def upload_reel_media(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file.content_type:
        raise BadRequestError("Could not determine file type.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise BadRequestError("File is empty.")

    media = upload_media(file_bytes, file.content_type, folder="reels")
    return {"success": True, "media": media}


@router.post("")
@limiter.limit(lambda: create_post_limit())
def create_reel(
    request: Request,
    payload: ReelCreateRequest,
    media_url: str = Query(..., description="Uploaded media URL"),
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = reel_service.create_reel(repo, current_user, media_url, payload)
    return {"success": True, "reel": data}


@router.get("")
def list_reels(
    request: Request,
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    viewer: User | None = Depends(get_optional_user),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    reels, more = reel_service.list_reels(repo, off, limit, viewer.id if viewer else None)
    return {"success": True, "reels": reels, "has_more": more, "offset": off, "limit": limit}


@router.get("/{reel_id}")
def get_reel(
    reel_id: str,
    viewer: User | None = Depends(get_optional_user),
    repo: Repository = Depends(get_db),
):
    data = reel_service.get_reel(repo, reel_id, viewer.id if viewer else None)
    return {"success": True, "reel": data}


@router.delete("/{reel_id}")
def delete_reel(
    reel_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    reel_service.delete_reel(repo, reel_id, current_user.id)
    return {"success": True, "message": "Reel deleted."}


@router.post("/{reel_id}/like")
def like_reel(
    reel_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **reel_service.like_reel(repo, reel_id, current_user)}


@router.delete("/{reel_id}/like")
def unlike_reel(
    reel_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **reel_service.unlike_reel(repo, reel_id, current_user.id)}


@router.post("/{reel_id}/save")
def save_reel(
    reel_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **reel_service.save_reel(repo, reel_id, current_user.id)}


@router.delete("/{reel_id}/save")
def unsave_reel(
    reel_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **reel_service.unsave_reel(repo, reel_id, current_user.id)}


@router.post("/{reel_id}/view")
def view_reel(
    reel_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {"success": True, **reel_service.view_reel(repo, reel_id, current_user.id)}


@router.post("/{reel_id}/share")
def share_reel(
    reel_id: str,
    repo: Repository = Depends(get_db),
):
    return {"success": True, **reel_service.share_reel(repo, reel_id)}


@router.post("/{reel_id}/comments")
@limiter.limit(lambda: comment_limit())
def create_reel_comment(
    request: Request,
    reel_id: str,
    payload: ReelCommentCreateRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = reel_service.create_reel_comment(repo, reel_id, current_user, payload)
    return {"success": True, "comment": data}


@router.get("/{reel_id}/comments")
def list_reel_comments(
    reel_id: str,
    request: Request,
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    comments, more = reel_service.list_reel_comments(repo, reel_id, off, limit)
    return {"success": True, "comments": comments, "has_more": more}
