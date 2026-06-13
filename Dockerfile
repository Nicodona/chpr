# syntax=docker/dockerfile:1
#
# CHPR Resources Hub — production image.
#
# Stage 1 builds the React/Vite SPA into ../build (index.html + static/).
# Stage 2 is the Python runtime: installs deps + gunicorn, copies the app and
# the compiled frontend, and collects static (frontend hashed assets + Django
# admin) into staticfiles/ for WhiteNoise to serve. gunicorn serves the SPA
# (TemplateView catch-all), /api, /admin and /static; Apache serves /media.

# ---- Stage 1: frontend build ----------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
# Install deps first for layer caching.
COPY frontend/package.json frontend/package-lock.json* ./
# Prefer the reproducible lockfile install; fall back to npm install if the
# lock is out of sync (can't verify locally — no Docker on the dev box).
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY frontend/ ./
# vite.config.js emits to ../build (one level up = /app/build).
RUN npm run build

# ---- Stage 2: python runtime ----------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# psycopg (3.x binary wheel) needs no system libpq, but keep build-essential
# out — psycopg-binary ships the lib. Only need a clean slim base.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# App source.
COPY . .

# Bring in the compiled SPA from stage 1 (overwrites any stale local build/).
COPY --from=frontend /app/build ./build

# Collect static into staticfiles/ (frontend hashed assets via STATICFILES_DIRS
# + Django admin). WhiteNoise serves these at /static/. A dummy SECRET_KEY +
# DEBUG=False keep collectstatic from needing the real env or a DB.
RUN SECRET_KEY=build-time-dummy DEBUG=False DATABASE_URL=sqlite:////tmp/build.db \
    python manage.py collectstatic --noinput

EXPOSE 8000

# 3 workers is plenty for an internal staff tool on a 2-vCPU shared box;
# keep it modest so we don't starve REDCap / SMS. 120s timeout covers the
# occasional large media metadata response.
CMD ["gunicorn", "chpr_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
