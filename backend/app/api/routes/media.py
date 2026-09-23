"""Media file serving routes.

Serves uploaded media files (story images, videos) from local storage.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.media_storage import get_media_path

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/{path:path}")
def serve_media(path: str):
    """Serve a media file from local storage."""
    file_path = get_media_path(f"/api/media/{path}")
    if not file_path:
        raise HTTPException(status_code=404, detail="Media not found.")

    # Determine content type from extension
    ext = file_path.suffix.lower()
    content_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
    }
    media_type = content_type_map.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
