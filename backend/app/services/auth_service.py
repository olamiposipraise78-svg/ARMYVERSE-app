"""Authentication and registration business logic."""

from __future__ import annotations

from app.core.errors import (
    AuthenticationError,
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    revoke_access_token,
    revoke_refresh_token,
    validate_access_token,
    validate_refresh_token,
    verify_password,
)
from app.models import User
from app.repositories.base import Repository
from app.schemas.auth import LoginRequest, RegisterRequest
from app.serializers.frontend import user_to_frontend


def register(
    repo: Repository, payload: RegisterRequest
) -> dict:
    username = payload.username.strip()
    email = payload.email.strip().lower()

    if repo.get_user_by_username(username):
        raise ConflictError("That username is already taken.")
    if repo.get_user_by_email(email):
        raise ConflictError("An account with that email already exists.")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip() or username,
        bio=payload.bio.strip(),
        country=payload.country.strip(),
    )
    created = repo.create_user(user)
    access, _, _ = create_access_token(created.id)
    refresh, _, _ = create_refresh_token(created.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "user": user_to_frontend(created),
    }


def login(repo: Repository, payload: LoginRequest) -> dict:
    identifier = payload.identifier.strip().lower()
    user = repo.get_user_by_username(identifier) or repo.get_user_by_email(
        identifier
    )
    if not user:
        raise AuthenticationError("Invalid email/username or password.")
    if not verify_password(payload.password, user.password_hash):
        raise AuthenticationError("Invalid email/username or password.")

    access, _, _ = create_access_token(user.id)
    refresh, _, _ = create_refresh_token(user.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "user": user_to_frontend(user),
    }


def refresh_tokens(repo: Repository, refresh_token: str) -> dict:
    payload = validate_refresh_token(refresh_token)
    if not payload:
        raise AuthenticationError("Invalid or expired refresh token.")

    user_id = payload.get("sub")
    user = repo.get_user_by_id(user_id) if user_id else None
    if not user:
        raise AuthenticationError("Invalid or expired refresh token.")

    # Rotate the refresh token: revoke the old one, issue a new pair.
    revoke_refresh_token(payload.get("jti"))
    access, _, _ = create_access_token(user.id)
    refresh, _, _ = create_refresh_token(user.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "user": user_to_frontend(user),
    }


def logout(refresh_token: str, authorization: str = "") -> None:
    payload = validate_refresh_token(refresh_token)
    if payload:
        revoke_refresh_token(payload.get("jti"))
    # Revoke the current access token so it cannot be reused after logout.
    if authorization.lower().startswith("bearer "):
        access_token = authorization.split(" ", 1)[1].strip()
        access_payload = validate_access_token(access_token)
        if access_payload:
            revoke_access_token(access_payload.get("jti"))


def get_me(repo: Repository, user_id: str) -> dict:
    user = repo.get_user_by_id(user_id)
    if not user:
        raise NotFoundError("User not found.")
    return user_to_frontend(user, is_current=True)
