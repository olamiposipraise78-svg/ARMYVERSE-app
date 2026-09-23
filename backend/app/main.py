"""ARMYVERSE FastAPI application entry point."""

import pathlib

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes import API_ROUTERS
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.rate_limit import limiter
from app.middleware.security import SecurityHeadersMiddleware

settings = get_settings()

app = FastAPI(
    title="ARMYVERSE API",
    description="Backend API for ARMYVERSE, a social platform for BTS ARMY.",
    version="1.0.0",
)

# ---- Rate limiter ----
# Enforcement is controlled by slowapi's RATELIMIT_ENABLED env var
# (tests set RATELIMIT_ENABLED=false to disable it).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---- Security headers ----
app.add_middleware(SecurityHeadersMiddleware)

# ---- CORS (restricted to the frontend origin) ----
# FRONTEND_URL may be a single origin or a comma-separated list, so a custom
# domain plus the platform URL can all be allowed in production.
allowed_origins = [
    origin.strip()
    for origin in settings.frontend_url.split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---- Centralised error handling ----
register_exception_handlers(app)

# ---- Routers ----
for router in API_ROUTERS:
    app.include_router(router)


@app.get("/api/health")
def health():
    storage = "r2" if settings.r2_configured else "local"
    return {
        "success": True,
        "status": "ok",
        "database": "astra" if settings.astra_configured else "memory",
        "storage": storage,
    }


# ---- Built frontend (production, same-origin) ----
# When the React app has been built (frontend/dist exists), serve it from the
# same FastAPI process so the SPA and the /api share one origin (no CORS,
# no localhost assumption). API routes above take priority; anything else is
# either a real static file or the SPA's index.html (client-side routing).
_FRONTEND_DIST = (
    pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
)


def _safe_dist_path(rel: str) -> pathlib.Path | None:
    candidate = (_FRONTEND_DIST / rel).resolve()
    root = _FRONTEND_DIST.resolve()
    if root not in candidate.parents and candidate != root:
        return None
    return candidate


if _FRONTEND_DIST.is_dir():
    if (_FRONTEND_DIST / "assets").is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=_FRONTEND_DIST / "assets"),
            name="assets",
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        # Unknown API paths must stay JSON 404s, not the SPA's HTML shell.
        if full_path.startswith("api/"):
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Not found"},
            )
        if not full_path:
            return FileResponse(_FRONTEND_DIST / "index.html")
        candidate = _safe_dist_path(full_path)
        if candidate is not None and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
