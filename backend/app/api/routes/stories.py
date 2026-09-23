"""Stories routes."""

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile

from app.api.dependencies import get_current_user, get_db, get_optional_user
from app.core.errors import BadRequestError
from app.core.rate_limit import limiter, create_post_limit, reply_limit
from app.models import User
from app.repositories.base import Repository
from app.schemas.story import (
    StoryCreateRequest,
    StoryReactionRequest,
    StoryReplyRequest,
)
from app.services import story_service
from app.services.media_storage import upload_media
from app.utils.pagination import clamp_offset, resolve_page_size

router = APIRouter(prefix="/api/stories", tags=["stories"])


@router.post("/upload")
@limiter.limit(lambda: create_post_limit())
def upload_story_media(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload media (image/video/audio) for a story.

    Returns the media type and URL to be included in the story creation payload.
    """
    if not file.content_type:
        raise BadRequestError("Could not determine file type.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise BadRequestError("File is empty.")

    media = upload_media(file_bytes, file.content_type, folder="stories")
    return {"success": True, "media": media}


@router.post("")
@limiter.limit(lambda: create_post_limit())
def create_story(
    request: Request,
    payload: StoryCreateRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = story_service.create_story(repo, current_user, payload)
    return {"success": True, "story": data}


@router.get("")
def list_stories(
    request: Request,
    viewer: User | None = Depends(get_optional_user),
    repo: Repository = Depends(get_db),
):
    data = story_service.get_stories(repo, viewer.id if viewer else None)
    return {"success": True, "stories": data, "total": len(data)}


@router.get("/{story_id}")
def get_story(
    story_id: str,
    viewer: User | None = Depends(get_optional_user),
    repo: Repository = Depends(get_db),
):
    data = story_service.get_story(repo, story_id, viewer.id if viewer else None)
    return {"success": True, "story": data}


@router.delete("/{story_id}")
def delete_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    story_service.delete_story(repo, story_id, current_user.id)
    return {"success": True, "message": "Story deleted."}


@router.post("/{story_id}/view")
def view_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = story_service.view_story(repo, story_id, current_user)
    return {"success": True, **data}


@router.post("/{story_id}/reaction")
def react_to_story(
    story_id: str,
    payload: StoryReactionRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = story_service.react_to_story(
        repo, story_id, current_user, payload.type
    )
    return {"success": True, **data}


@router.post("/{story_id}/replies")
@limiter.limit(lambda: reply_limit())
def reply_to_story(
    request: Request,
    story_id: str,
    payload: StoryReplyRequest,
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    data = story_service.reply_to_story(repo, story_id, current_user, payload)
    return {"success": True, "reply": data}


@router.get("/{story_id}/replies")
def list_replies(
    story_id: str,
    request: Request,
    offset: int = Query(0, ge=0),
    page_size: int | None = Query(None),
    repo: Repository = Depends(get_db),
):
    limit = resolve_page_size(page_size)
    off = clamp_offset(offset)
    replies, more = story_service.list_story_replies(repo, story_id, off, limit)
    return {"success": True, "replies": replies, "has_more": more}
