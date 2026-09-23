"""Authentication routes."""

from fastapi import APIRouter, Body, Depends, Request
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user, get_db
from app.core.rate_limit import (
    limiter,
    login_limit,
    refresh_limit,
    register_limit,
)
from app.models import User
from app.repositories.base import Repository
from app.schemas.auth import LoginRequest, RegisterRequest, RefreshRequest
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LogoutRequest(BaseModel):
    refresh_token: str = ""


@router.post("/register")
@limiter.limit(lambda: register_limit())
def register(
    request: Request,
    payload: RegisterRequest,
    repo: Repository = Depends(get_db),
):
    return auth_service.register(repo, payload)


@router.post("/login")
@limiter.limit(lambda: login_limit())
def login(
    request: Request,
    payload: LoginRequest,
    repo: Repository = Depends(get_db),
):
    return auth_service.login(repo, payload)


@router.post("/refresh")
@limiter.limit(lambda: refresh_limit())
def refresh(
    request: Request,
    payload: RefreshRequest,
    repo: Repository = Depends(get_db),
):
    return auth_service.refresh_tokens(repo, payload.refresh_token)


@router.post("/logout")
def logout(request: Request, payload: LogoutRequest | None = None):
    token = payload.refresh_token if payload else ""
    auth_service.logout(token, request.headers.get("authorization", ""))
    return {"success": True, "message": "Logged out."}


@router.get("/me")
def me(
    current_user: User = Depends(get_current_user),
    repo: Repository = Depends(get_db),
):
    return {
        "success": True,
        "user": auth_service.get_me(repo, current_user.id),
    }
