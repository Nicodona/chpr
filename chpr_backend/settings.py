"""
Django settings for the CHPR Resources Hub backend.

Configuration is read from environment variables (a local .env file is loaded
automatically) via django-environ. See .env.example for the supported keys.
"""
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
env = environ.Env(
    DEBUG=(bool, True),
    ALLOWED_HOSTS=(list, ["*"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:5173","http://192.168.1.236:5173", "http://127.0.0.1:5173"]),
)
# Load .env if present (does nothing if the file is missing).
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="django-insecure-dev-key-change-me-in-production")
DEBUG = env.bool("DEBUG")
ALLOWED_HOSTS = ["*"]

# The compiled React build that Django serves. Run `npm run build` in frontend/
# and copy the produced folder into the project root as `build/`; urls.py serves
# its index.html and /static/ assets from here (Vite emits the app under
# build/static/). Falls back to the frontend's own dist/ so it also works without
# copying. Override via .env.
_FRONTEND_BUILD_CANDIDATES = [
    BASE_DIR / "build",
    BASE_DIR / "dist",
    BASE_DIR / "frontend" / "dist",
]
FRONTEND_BUILD_DIR = Path(
    env(
        "FRONTEND_BUILD_DIR",
        default=str(
            next(
                (p for p in _FRONTEND_BUILD_CANDIDATES if p.exists()),
                _FRONTEND_BUILD_CANDIDATES[0],
            )
        ),
    )
)

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework.authtoken",
    # Third party
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
    # Local
    "chpr",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise serves the React build's static assets in production.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "chpr_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # The React build's index.html is served as a template by the SPA catch-all.
        "DIRS": [FRONTEND_BUILD_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "chpr_backend.wsgi.application"
ASGI_APPLICATION = "chpr_backend.asgi.application"

# ---------------------------------------------------------------------------
# Database — PostgreSQL
# ---------------------------------------------------------------------------
# Reads DATABASE_URL (e.g. postgres://USER:PASSWORD@HOST:PORT/NAME). The default
# below targets a local PostgreSQL instance; override it in .env.
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://chpr:chpr@localhost:5432/chpr_hub",
    )
}

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Douala"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media files
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
# Vite emits hashed assets into build/static/ (assetsDir="static"), referenced at
# /static/…, so the build's static subfolder maps onto STATIC_URL.
_FRONTEND_STATIC_DIR = FRONTEND_BUILD_DIR / "static"
STATICFILES_DIRS = [_FRONTEND_STATIC_DIR] if _FRONTEND_STATIC_DIR.exists() else []
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_AUTHENTICATION_CLASSES": [          # ← add this block
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CHPR Resources Hub API",
    "DESCRIPTION": "Projects, resources, comments, and contact messages for the CHPR Resources Hub.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ---------------------------------------------------------------------------
# CORS — only needed when running the Vite dev server on a different origin.
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")
# Required so the browser sends/receives the session & CSRF cookies
# when the Vite dev server runs on a different port.
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Email — console backend in dev; configure SMTP vars in production .env
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL",
    default="CHPR Resources Hub <noreply@chprhealth.org>",
)

# Public URL for links inside emails (no trailing slash).
SITE_URL = env("SITE_URL", default="http://localhost:5173")


# ---------------------------------------------------------------------------
# Production hardening (behind the Apache reverse proxy on the shared droplet)
# ---------------------------------------------------------------------------
# All opt-in via env so local dev is unaffected. Set these in the production
# .env (see deploy/.env.example):
#   BEHIND_TLS_PROXY=True
#   CSRF_TRUSTED_ORIGINS=https://chpr-resource.org,https://www.chpr-resource.org
#
# Why each is needed when Apache terminates TLS and proxies to gunicorn:
#   - SECURE_PROXY_SSL_HEADER: Apache sets `X-Forwarded-Proto: https`; without
#     this Django thinks the request is plain HTTP and (a) marks secure cookies
#     unsendable and (b) builds http:// absolute URLs.
#   - CSRF_TRUSTED_ORIGINS: Django 4+ checks the Origin/Referer against this
#     list on any unsafe (POST/PUT/DELETE) request over HTTPS. The SPA's
#     session-auth login POST and the /admin/ login both fail with
#     "CSRF verification failed" without the site's https origin listed.
#   - Secure cookies: the session + CSRF cookies must only travel over HTTPS.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

if env.bool("BEHIND_TLS_PROXY", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
