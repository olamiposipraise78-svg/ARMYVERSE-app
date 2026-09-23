"""Pydantic schemas for stories."""

from typing import Optional

from pydantic import BaseModel, Field


class StoryCreateRequest(BaseModel):
    caption: str = Field("", max_length=300)
    color: Optional[str] = Field(None, max_length=20)
    media: Optional[dict] = Field(None, description="Story media {type, src, ...}")
    music: Optional[dict] = Field(
        None,
        description=(
            "Music attached to the story.  Deezer shape: "
            "{id, deezerId, provider: 'deezer', providerTrackId, title, artist, "
            "album, artworkUrl, cover, duration, previewUrl, canPlay, startAt, endAt}. "
            "Deezer preview URLs are time-limited, so viewers resolve a fresh URL at "
            "view time via /api/games/songs/previews.  Legacy external-provider shapes "
            "are also accepted and normalized."
        ),
    )


class StoryReactionRequest(BaseModel):
    type: str = Field(..., min_length=1, max_length=16)


class StoryReplyRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class StoryResponse(BaseModel):
    success: bool = True
    story: dict


class StoryListResponse(BaseModel):
    success: bool = True
    stories: list[dict]
    total: int


class StoryReplyListResponse(BaseModel):
    success: bool = True
    replies: list[dict]
    total: int
