"""Pydantic schemas for reels."""

from typing import Optional

from pydantic import BaseModel, Field


class ReelCreateRequest(BaseModel):
    caption: str = Field("", max_length=1000)
    hashtags: list[str] = Field(default_factory=list, max_length=20)
    audio_name: str = Field("", max_length=200)
    duration: float = Field(0.0, ge=0)
    crop: Optional[dict] = Field(None, description="Non-destructive crop {aspect, zoom, x, y}")


class ReelResponse(BaseModel):
    success: bool = True
    reel: dict


class ReelListResponse(BaseModel):
    success: bool = True
    reels: list[dict]
    has_more: bool = False
    offset: int = 0
    limit: int = 20


class ReelCommentCreateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class ReelCommentListResponse(BaseModel):
    success: bool = True
    comments: list[dict]
    has_more: bool = False
