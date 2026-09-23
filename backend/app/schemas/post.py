"""Pydantic schemas for posts."""

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class MediaItem(BaseModel):
    type: str = "image"
    src: str = Field(..., max_length=2000)
    mimeType: Optional[str] = Field(None, max_length=100)
    thumbnail: Optional[str] = Field(None, max_length=2000)
    alt: Optional[str] = Field(None, max_length=300)
    fallback: Optional[str] = Field(None, max_length=2000)
    crop: Optional[dict] = Field(None, description="Non-destructive crop {aspect, zoom, x, y}")
    images: Optional[list[dict]] = Field(None, max_length=10)

    @field_validator("src", "thumbnail", "fallback", mode="before")
    @classmethod
    def reject_data_uris(cls, value):
        if isinstance(value, str) and value.startswith("data:"):
            raise ValueError(
                "Upload media through /api/posts/upload and send the returned URL."
            )
        return value


class PostCreateRequest(BaseModel):
    caption: str = Field("", max_length=1000)
    hashtags: list[str] = Field(default_factory=list, max_length=20)
    media: Optional[MediaItem] = None
    music: Optional[dict] = Field(None, description="Music {title, artist, cover, audio}")
    location: str = Field("", max_length=200)
    downloadable: bool = False


class PostUpdateRequest(BaseModel):
    caption: str | None = Field(None, max_length=1000)
    hashtags: list[str] | None = Field(None, max_length=20)
    media: Optional[MediaItem] = None
    music: Optional[dict] = Field(None, description="Music {title, artist, cover, audio}")
    location: str | None = Field(None, max_length=200)
    downloadable: bool | None = None


class PostResponse(BaseModel):
    success: bool = True
    post: dict


class PostListResponse(BaseModel):
    success: bool = True
    posts: list[dict]
    total: int