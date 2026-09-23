"""User and profile routes."""

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile

from app.api.dependencies import get_current_user, get_db
from app.core.errors import BadRequestError
from app.models import User
from app.repositories.base import Repository
from app.schemas.user import UserUpdateRequest
from app.services import user_service
from app.services.media_storage import upload_media
from app.utils.pagination import has_more, clamp_offset, resolve_page_size

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}")
def get_user(user_id: str, repo: Repository = Depends(get_db)):
    data = user_service.get_public_user(repo, user_id)
    return {"success": True, "user": data}


@router.patch("/me")
def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = user_service.update_profile(repo, current_user.id, payload)
    return {"success": True, "user": data}


@router.post("/me/avatar")
def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    if not file.content_type:
        raise BadRequestError("Could not determine file type.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise BadRequestError("File is empty.")

    media = upload_media(file_bytes, file.content_type, folder="avatars")
    data = user_service.update_profile(
        repo, current_user.id, UserUpdateRequest(profile_image=media["url"])
    )
    return {"success": True, "user": data}


@router.get("/me/saved")
def my_saved(
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    from app.services import social_service

    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    posts, more = social_service.list_saved(repo, current_user.id, off, limit)
    return {"success": True, "saved": posts, "has_more": more, "total": len(posts)}


@router.get("/{user_id}/followers")
def followers(
    user_id: str,
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    users, total = user_service.list_followers(repo, user_id, off, limit)
    return {
        "success": True,
        "users": users,
        "total": total,
        "has_more": has_more(total, off, limit),
    }


@router.get("/{user_id}/following")
def following(
    user_id: str,
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    users, total = user_service.list_following(repo, user_id, off, limit)
    return {
        "success": True,
        "users": users,
        "total": total,
        "has_more": has_more(total, off, limit),
    }


@router.post("/{user_id}/follow")
def follow(
    user_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    from app.services import social_service

    data = social_service.follow_user(repo, user_id, current_user)
    return {"success": True, **data}


@router.delete("/{user_id}/follow")
def unfollow(
    user_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    from app.services import social_service

    return {"success": True, **social_service.unfollow_user(repo, user_id, current_user.id)}
