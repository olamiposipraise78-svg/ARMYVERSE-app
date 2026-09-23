"""Pydantic schemas for users and profiles."""

from pydantic import BaseModel, Field


class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(None, max_length=50)
    bio: str | None = Field(None, max_length=300)
    profile_image: str | None = Field(None, max_length=1000)
    avatar_art: str | None = Field(None, max_length=1000)
    flag: str | None = Field(None, max_length=10)
    country: str | None = Field(None, max_length=50)

    # Only the whitelisted fields above are ever applied by the service, so any
    # other field a client submits (id, password_hash, verified, email, ...) is
    # silently ignored -> protects against mass assignment.


class UserPublicResponse(BaseModel):
    id: str
    username: str
    display_name: str
    bio: str
    profile_image: str
    avatar_art: str
    flag: str
    country: str
    verified: bool
    follower_count: int
    following_count: int
    post_count: int
    created_at: str


class UserListResponse(BaseModel):
    success: bool = True
    users: list[UserPublicResponse]
    total: int
