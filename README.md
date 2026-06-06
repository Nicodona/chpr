# CHPR Resources Hub

A full-stack web application for CHPR (Centre for Health Promotion and Research) staff. Built with **Django REST Framework** (backend API) and **React + Vite** (single-page frontend).

Healthcare workers can browse, read, and test their understanding of resources (PDFs and videos). Admins manage resources, users, and quiz questions through the built-in management panel.

```
chpr_hub/
├── manage.py
├── requirements.txt
├── .env.example                  # copy to .env and fill in values
├── chpr_backend/                 # Django project config (settings, urls, wsgi, asgi)
├── chpr/                         # Django app — models, views, serializers, admin, urls
│   └── migrations/               # Database migrations (auto-generated)
├── frontend/                     # React (Vite) SPA
│   ├── public/                   # Static files served as-is (favicon, etc.)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── context/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── media/                        # Uploaded resource files (created at runtime)
├── build/                        # Compiled React app (created by `npm run build`)
└── _legacy/                      # Archived static mockup — not served
```

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Python | 3.10+ | 3.12 recommended |
| Node.js | 18+ | |
| npm | 9+ | comes with Node |
| PostgreSQL | 14+ | or use SQLite for local dev (no install needed) |
| Git | any | |

---

## 1. Clone the repository

```bash
git clone <repo-url>
cd chpr_hub
```

---

## 2. Database setup

### Option A — PostgreSQL (recommended for production and staging)

#### Install PostgreSQL

**Windows**
Download and run the installer from https://www.postgresql.org/download/windows/  
The installer adds `psql` and `createdb` to your PATH (may require a new terminal).

**macOS** (Homebrew)
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu / Debian**
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Create a database and user

```sql
-- Connect as the postgres superuser:
-- Windows / macOS:  psql -U postgres
-- Linux:            sudo -u postgres psql

CREATE USER chpr WITH PASSWORD 'chpr';
CREATE DATABASE chpr_hub OWNER chpr;
GRANT ALL PRIVILEGES ON DATABASE chpr_hub TO chpr;
\q
```

The resulting `DATABASE_URL` for your `.env` is:
```
DATABASE_URL=postgres://chpr:chpr@localhost:5432/chpr_hub
```

Adjust the username, password, host, or port to match your setup.

---

### Option B — SQLite (quick local development, no installation needed)

Skip the PostgreSQL steps above. In your `.env` file (step 4) use:
```
DATABASE_URL=sqlite:///db.sqlite3
```

This creates a `db.sqlite3` file in the project root. Do **not** use SQLite in production.

---

## 3. Python virtual environment

Always use a dedicated virtual environment. The `psycopg[binary]` PostgreSQL driver is installed inside it; running `manage.py` with a system Python will fail.

```bash
# Create the venv (run once)
python -m venv .venv

# Activate — Windows PowerShell
.venv\Scripts\Activate.ps1

# Activate — Windows cmd.exe
.venv\Scripts\activate.bat

# Activate — macOS / Linux
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

> **Tip (Windows):** If PowerShell blocks script execution, run:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

---

## 4. Environment variables

Copy the example file and edit it:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` and set the values:

```ini
# ── Security ──────────────────────────────────────────────────────────────────
# Generate a secret key:  python -c "import secrets; print(secrets.token_hex(50))"
SECRET_KEY=change-me-to-a-long-random-string

# Set to False in production
DEBUG=True

# Space-separated hostnames (comma-separated in .env)
ALLOWED_HOSTS=localhost,127.0.0.1

# ── Database ──────────────────────────────────────────────────────────────────
# PostgreSQL:
DATABASE_URL=postgres://chpr:chpr@localhost:5432/chpr_hub

# SQLite (local dev only):
# DATABASE_URL=sqlite:///db.sqlite3

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the Vite dev server to call the API from a different port
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# ── Email ─────────────────────────────────────────────────────────────────────
# In development the console backend prints emails to stdout — no SMTP needed.
# For production, uncomment and fill in the SMTP settings below:
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USE_TLS=True
# EMAIL_HOST_USER=your@email.com
# EMAIL_HOST_PASSWORD=your-app-password
# DEFAULT_FROM_EMAIL=CHPR Resources Hub <noreply@chprhealth.org>

# ── Site URL (used in emails) ─────────────────────────────────────────────────
# SITE_URL=https://your-domain.com
```

---

## 5. Database migrations

With the virtual environment active and `.env` configured:

```bash
python manage.py migrate
```

This creates all tables including:
- `auth_user`, `authtoken_token` — Django auth
- `chpr_project`, `chpr_resource`, `chpr_resourcecomment` — core content
- `chpr_quizquestion`, `chpr_quizattempt` — quiz system
- `chpr_readingprogress` — per-user reading progress
- `chpr_contactmessage`, `chpr_staffprofile` — staff and enquiries

---

## 6. Create an admin user

```bash
python manage.py createsuperuser
```

Enter a username, email, and password when prompted. This account can log in at `/admin/` and will have full access to the management panel on the frontend.

> **Note:** `createsuperuser` accounts do not have a `StaffProfile` row — the app handles this automatically by detecting `is_superuser=True`.

---

## 7. (Optional) Add initial data

Use the Django admin at `http://localhost:8000/admin/` to create:
- **Projects** — e.g. "BREATHE", "PROMPT TB" (set slug, name, colour, status)
- **Resources** — upload PDFs or videos linked to a project

Or create staff accounts through the **Admin Panel** in the React app (`/manage`) once you are logged in as admin.

---

## 8. Run the development servers

### Backend only (serves the compiled React build)

```bash
# Make sure .venv is active
python manage.py runserver
```

Open http://localhost:8000 — Django serves both the API and the React app.

### Frontend dev server (hot-reload, proxies API to Django)

In a **second terminal**:

```bash
cd frontend
npm install          # first time only
npm run dev
```

Open http://localhost:5173 — Vite serves the React app with hot reload;  
`/api` and `/media` requests are proxied to Django on port 8000.

Both servers must be running at the same time when using the Vite dev server.

---

## 9. Build for production

```bash
cd frontend
npm run build
```

Vite compiles the app into `../build/` (the project root). Django is already configured to serve `build/index.html` for all non-API routes and `build/static/` for hashed JS/CSS assets via WhiteNoise.

After building, a single `python manage.py runserver` (or gunicorn) serves everything.

---

## 10. Production deployment checklist

| Step | Command / action |
|------|-----------------|
| Set `DEBUG=False` in `.env` | |
| Set a strong `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(50))"` |
| Set `ALLOWED_HOSTS` to your domain | e.g. `ALLOWED_HOSTS=chprhealth.org,www.chprhealth.org` |
| Set `SITE_URL` | e.g. `SITE_URL=https://chprhealth.org` |
| Configure SMTP email | See `.env.example` |
| Collect static files | `python manage.py collectstatic` |
| Run with gunicorn | `gunicorn chpr_backend.wsgi:application --bind 0.0.0.0:8000` |
| Reverse proxy with nginx | Point `/` to gunicorn, serve `/media/` directly |

---

## Environment variables reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | insecure dev key | Django secret key — change in production |
| `DEBUG` | No | `True` | Set `False` in production |
| `ALLOWED_HOSTS` | No | `localhost,127.0.0.1` | Comma-separated allowed hostnames |
| `DATABASE_URL` | Yes | postgres://chpr:chpr@localhost:5432/chpr_hub | Full database connection URL |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Allowed CORS origins (Vite dev server) |
| `EMAIL_BACKEND` | No | console backend | Set to `smtp` backend for production |
| `EMAIL_HOST` | No | — | SMTP host |
| `EMAIL_PORT` | No | `587` | SMTP port |
| `EMAIL_USE_TLS` | No | `True` | Enable STARTTLS |
| `EMAIL_HOST_USER` | No | — | SMTP username |
| `EMAIL_HOST_PASSWORD` | No | — | SMTP password |
| `DEFAULT_FROM_EMAIL` | No | `noreply@chprhealth.org` | Sender address for system emails |
| `SITE_URL` | No | `http://localhost:5173` | Public URL — used in welcome emails |
| `FRONTEND_BUILD_DIR` | No | auto-detected | Override path to compiled React build |

---

## API reference

Base URL: `/api/`

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login/` | POST | `{ username, password }` → `{ token, user }` |
| `/api/auth/logout/` | POST | Invalidates session and token |
| `/api/auth/me/` | GET | Returns current user info |
| `/api/auth/change-password/` | POST | `{ current_password, new_password, confirm_password }` |
| `/api/auth/create-user/` | POST | Admin-only — creates a staff account and emails credentials |
| `/api/auth/users/` | GET | Admin-only — lists all staff accounts |
| `/api/csrf/` | GET | Returns CSRF token (called once by the React app before first POST) |

### Content

| Endpoint | Method | Filters | Description |
|----------|--------|---------|-------------|
| `/api/projects/` | GET, POST | — | List or create projects |
| `/api/projects/<slug>/` | GET, PUT, PATCH, DELETE | — | Single project by slug |
| `/api/resources/` | GET, POST | `?project=<slug>` `?type=<key\|pool>` `?activity=<hf\|hc>` `?search=<text>` | List or upload resources |
| `/api/resources/<id>/` | GET, PUT, PATCH, DELETE | — | Single resource |
| `/api/resources/<id>/submit-quiz/` | POST | — | Submit quiz answers; returns score + results |
| `/api/resources/<id>/my-progress/` | GET, POST | — | Read or save reading progress (authenticated) |
| `/api/resources/<id>/my-attempts/` | GET | — | List past quiz attempts (authenticated) |
| `/api/comments/` | GET, POST | `?resource=<id>` | Resource comments |
| `/api/quiz-questions/` | GET, POST | `?resource=<id>` | Quiz questions — admin-only writes |
| `/api/contact-messages/` | GET, POST | — | Contact enquiries |

### Schema / docs

| URL | Description |
|-----|-------------|
| `/api/schema/` | Raw OpenAPI 3 schema (JSON) |
| `/api/schema/swagger-ui/` | Interactive Swagger UI |
| `/api/schema/redoc/` | ReDoc documentation |

---

## Data models

| Model | Key fields | Purpose |
|-------|-----------|---------|
| `Project` | `slug`, `name`, `status`, `color` | A CHPR programme (BREATHE, PROMPT TB, …) |
| `Resource` | `project`, `type_key`, `file`, `name` | Uploaded PDF/video/document in a project |
| `StaffProfile` | `user`, `role` | Extends Django `User` with `admin`/`staff` role |
| `ResourceComment` | `resource`, `author_name`, `body` | Staff discussion thread on a resource |
| `QuizQuestion` | `resource`, `question`, `option_a–d`, `correct` | MCQ question for a resource's quiz |
| `QuizAttempt` | `user`, `resource`, `score`, `percent`, `passed` | Saved quiz result per user |
| `ReadingProgress` | `user`, `resource`, `progress`, `seen_pages` | Per-user reading progress (0–100%) |
| `ContactMessage` | `name`, `email`, `message` | Public "contact us" enquiry |

---

## Common issues

### "Error loading psycopg2 or psycopg module"

You are running `manage.py` with a Python that is outside the virtual environment. Always activate the venv first:

```powershell
# Windows
.venv\Scripts\Activate.ps1
python manage.py migrate
```

Or call the venv Python directly:
```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

---

### PostgreSQL connection refused / password authentication failed

1. Confirm PostgreSQL is running: `pg_isready -h localhost`
2. Check the credentials in `.env` match the user you created in psql
3. Confirm the database exists: `psql -U chpr -d chpr_hub -c "\l"`

---

### "CSRF verification failed" on POST requests

The React app fetches a CSRF token from `/api/csrf/` before its first mutating request. If you are calling the API from a custom client:

1. `GET /api/csrf/` — this sets the `csrftoken` cookie
2. Include `X-CSRFToken: <token>` header on every POST/PUT/PATCH/DELETE
3. Send credentials (`credentials: "include"` in fetch, or `withCredentials: true` in axios)

---

### Admin Panel button not visible after login

The **Admin Panel** button only appears for users with `role = "admin"` or Django superusers. To promote an existing staff user to admin, go to `/admin/` → **Staff profiles** → edit the user and set Role to "Admin".

---

### Vite dev server shows a blank page or API errors

Ensure Django is running on port 8000 before starting the Vite dev server. Vite proxies `/api` and `/media` to `http://localhost:8000`.

```bash
# Terminal 1
python manage.py runserver        # must be on :8000

# Terminal 2
cd frontend && npm run dev        # runs on :5173
```
