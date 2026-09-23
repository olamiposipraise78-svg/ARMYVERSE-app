"""Media storage abstraction for ARMYVERSE.

Provides a clean interface for uploading, deleting, and serving media files.

Storage backends (selected automatically from environment variables):
  - Cloudflare R2 (S3-compatible) when `R2_*` credentials are configured. This
    is the production backend: durable, cheap (free tier), and survives Render
    restarts/redeploys. Returns permanent public URLs.
  - Local disk (dev/tests) otherwise, mapped to the existing `/api/media`
    serving route.
"""

from __future__ import annotations

import hashlib
import os
import pathlib
import uuid
from typing import Optional

from app.core.config import get_settings
from app.core.errors import BadRequestError

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_UPLOAD_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent / "uploads"
_STORIES_DIR = _UPLOAD_ROOT / "stories"

# Allowed MIME types and their extensions
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
}

ALLOWED_AUDIO_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/aac": ".aac",
}

ALL_ALLOWED_TYPES = {
    **ALLOWED_IMAGE_TYPES,
    **ALLOWED_VIDEO_TYPES,
    **ALLOWED_AUDIO_TYPES,
}

# File size limits (bytes)
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Cloudflare R2 (S3-compatible object storage)
# ---------------------------------------------------------------------------

_r2_client = None


def _get_r2_client():
    """Return a lazily-initialised boto3 S3 client bound to Cloudflare R2."""
    global _r2_client
    if _r2_client is None:
        import boto3

        settings = get_settings()
        _r2_client = boto3.client(
            "s3",
            endpoint_url=(
                f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
            ),
            region_name="auto",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
        )
    return _r2_client


def _r2_base_url() -> str:
    return get_settings().r2_public_base_url.rstrip("/")


def _is_r2_url(url: str) -> bool:
    base = _r2_base_url()
    return bool(base) and url.startswith(base + "/")


def _r2_url_to_key(url: str) -> str:
    return url[len(_r2_base_url()) + 1:]


def _ensure_dirs() -> None:
    """Create upload directories if they don't exist."""
    _STORIES_DIR.mkdir(parents=True, exist_ok=True)


def _generate_filename(content_type: str) -> str:
    """Generate a unique filename based on content type."""
    ext = ALL_ALLOWED_TYPES.get(content_type, ".bin")
    unique = uuid.uuid4().hex[:16]
    return f"{unique}{ext}"


def validate_media_type(content_type: str) -> str:
    """Validate and return the media category ('image', 'video', or 'audio').

    Raises BadRequestError if the type is not supported.
    """
    if content_type in ALLOWED_IMAGE_TYPES:
        return "image"
    if content_type in ALLOWED_VIDEO_TYPES:
        return "video"
    if content_type in ALLOWED_AUDIO_TYPES:
        return "audio"
    raise BadRequestError(
        f"File type '{content_type}' is not supported. "
        "Please use JPG, PNG, WEBP, MP4, WEBM, MP3, M4A, OGG, WAV, or AAC."
    )


def validate_file_size(content_type: str, size: int) -> None:
    """Validate file size against limits.

    Raises BadRequestError if the file is too large.
    """
    if content_type in ALLOWED_AUDIO_TYPES:
        limit = MAX_AUDIO_SIZE
        kind = "Audio"
    elif content_type in ALLOWED_VIDEO_TYPES:
        limit = MAX_VIDEO_SIZE
        kind = "Video"
    else:
        limit = MAX_IMAGE_SIZE
        kind = "Image"
    if size > limit:
        limit_mb = limit / (1024 * 1024)
        size_mb = size / (1024 * 1024)
        raise BadRequestError(
            f"{kind} is too large ({size_mb:.1f}MB). Maximum size is {limit_mb:.0f}MB."
        )


def upload_media(
    file_bytes: bytes,
    content_type: str,
    folder: str = "stories",
) -> dict:
    """Upload media to the active storage backend.

    Args:
        file_bytes: Raw file content.
        content_type: MIME type of the file.
        folder: Subdirectory/prefix for the object (default: 'stories').

    Returns:
        Dict with 'type' ('image'/'video'/'audio'), 'url' (absolute R2 public
        URL in production, or a relative '/api/media/...' URL in local dev) and
        'mimeType' (the original content type).
    """
    media_type = validate_media_type(content_type)
    validate_file_size(content_type, len(file_bytes))

    settings = get_settings()

    if settings.r2_configured:
        filename = _generate_filename(content_type)
        key = f"{folder}/{filename}"
        _get_r2_client().put_object(
            Bucket=settings.r2_bucket_name,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
            CacheControl="public, max-age=86400",
        )
        return {
            "type": media_type,
            "url": f"{_r2_base_url()}/{key}",
            "mimeType": content_type,
        }

    # --- local disk fallback (development / tests) ---
    _ensure_dirs()

    target_dir = _UPLOAD_ROOT / folder
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = _generate_filename(content_type)
    filepath = target_dir / filename
    filepath.write_bytes(file_bytes)

    return {
        "type": media_type,
        "url": f"/api/media/{folder}/{filename}",
        "mimeType": content_type,
    }


def delete_media(url: str) -> bool:
    """Delete a media file by its stored URL (R2 public URL or local path).

    Args:
        url: Either an R2 public URL (https://pub-.../folder/file.jpg) or a
             local relative URL path (e.g., '/api/media/stories/abc.jpg').

    Returns:
        True if deleted, False if not found or not ours.
    """
    if not url:
        return False

    if _is_r2_url(url):
        try:
            _get_r2_client().delete_object(
                Bucket=get_settings().r2_bucket_name,
                Key=_r2_url_to_key(url),
            )
            return True
        except Exception:
            return False

    if not url.startswith("/api/media/"):
        return False

    # Extract relative path after /api/media/
    rel_path = url[len("/api/media/"):]
    filepath = _UPLOAD_ROOT / rel_path

    if filepath.exists() and filepath.is_file():
        filepath.unlink()
        return True
    return False


def get_media_path(url: str) -> Optional[pathlib.Path]:
    """Resolve a media URL to its filesystem path.

    Args:
        url: The relative URL path.

    Returns:
        Path object if valid, None otherwise.
    """
    if not url or not url.startswith("/api/media/"):
        return None

    rel_path = url[len("/api/media/"):]
    filepath = _UPLOAD_ROOT / rel_path

    if filepath.exists() and filepath.is_file():
        return filepath
    return None
