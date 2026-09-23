"""Centralised exception types and a global exception handler.

All application errors surface as a consistent JSON envelope:
    {"success": false, "message": "..."}
Internal details are never leaked to clients in production.
"""

from typing import Any, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application error with an HTTP status code."""

    def __init__(
        self,
        status_code: int = 400,
        message: str = "Something went wrong",
        error_code: Optional[str] = None,
    ) -> None:
        self.status_code = status_code
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(status_code=404, message=message, error_code="not_found")


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(status_code=409, message=message, error_code="conflict")


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid credentials") -> None:
        super().__init__(
            status_code=401, message=message, error_code="unauthorized"
        )


class ForbiddenError(AppError):
    def __init__(self, message: str = "Permission denied") -> None:
        super().__init__(status_code=403, message=message, error_code="forbidden")


class BadRequestError(AppError):
    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(status_code=400, message=message, error_code="bad_request")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(
        _request: Request, exc: AppError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": exc.message},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Produce a concise, safe summary instead of leaking raw internals.
        first = (exc.errors() or [{}])[0]
        loc = first.get("loc", ())
        msg = first.get("msg", "Invalid input")
        field = str(loc[-1]) if loc else "request"
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "message": f"Invalid value for '{field}': {msg}",
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(
        _request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Something went wrong",
            },
        )
