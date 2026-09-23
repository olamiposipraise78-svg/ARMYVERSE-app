"""Notifications routes."""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user, get_db
from app.models import User
from app.repositories.base import Repository
from app.services import social_service
from app.utils.pagination import clamp_offset, resolve_page_size

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    data = social_service.list_notifications(repo, current_user.id, off, limit)
    return {"success": True, **data}


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = social_service.mark_notification_read(repo, notification_id, current_user.id)
    return {"success": True, "notification": data}


@router.patch("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    count = social_service.mark_all_notifications_read(repo, current_user.id)
    return {"success": True, "updated": count}
