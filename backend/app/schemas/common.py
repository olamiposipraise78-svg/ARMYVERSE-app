"""Shared Pydantic response envelope and pagination schemas."""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorResponse(BaseModel):
    success: bool = False
    message: str


class SuccessResponse(BaseModel):
    success: bool = True
    message: str


class PaginationMeta(BaseModel):
    offset: int
    limit: int
    total: int
    has_more: bool


class AuthTokenPayload(BaseModel):
    access_token: str
    token_type: str = "bearer"
