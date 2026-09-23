"""Standalone comment routes (delete)."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user, get_db
from app.models import User
from app.repositories.base import Repository
from app.services import social_service

router = APIRouter(prefix="/api/comments", tags=["comments"])


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    social_service.delete_comment(repo, comment_id, current_user.id)
    return {"success": True, "message": "Comment deleted."}
