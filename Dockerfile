# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# ARMYVERSE — single Railway service.
#
# The FastAPI backend serves both /api routes and the built React SPA
# (frontend/dist) on the same origin, so the SPA shares the backend origin.
# Stage 1 builds the React/Vite app; Stage 2 installs the Python backend and
# copies the built SPA into the exact location the app resolves at runtime
# (<repo root>/frontend/dist, relative to backend/app/main.py).
# ---------------------------------------------------------------------------

# ---------- Stage 1: build the React/Vite frontend ----------
FROM node:24-alpine AS frontend-build
WORKDIR /build/frontend

# Install dependencies first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: FastAPI backend + static frontend ----------
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install backend dependencies first for better layer caching
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt

# Copy the backend, preserving the monorepo layout the app expects
COPY backend /app/backend

# Copy the built SPA into <repo root>/frontend/dist (see app.main:74-76)
COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

WORKDIR /app/backend

# Railway injects PORT; fall back to 8000 so local runs also work.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]