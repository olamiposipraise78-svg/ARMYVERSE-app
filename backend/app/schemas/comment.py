"""Pydantic schemas for comments, notifications, and misc."""

from pydantic import BaseModel, Field


class CommentCreateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class CommentResponse(BaseModel):
    success: bool = True
    comment: dict


class CommentListResponse(BaseModel):
    success: bool = True
    comments: list[dict]
    total: int


class NotificationListResponse(BaseModel):
    success: bool = True
    notifications: list[dict]
    unread_count: int
    total: int
