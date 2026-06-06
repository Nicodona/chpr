# CHPR Resources Hub — Django + React

A Django REST Framework backend with a React (Vite) single-page frontend.
Django serves the API under `/api/`, the admin under `/admin/`, and the compiled
React build for everything else.

```
chpr_hub/
├── manage.py
├── requirements.txt
├── .env.example              # copy to .env
├── chpr_backend/             # Django project (settings, urls, wsgi/asgi)
├── chpr/                     # Django app: models, serializers, admin, urls, views, seed cmd
├── frontend/                 # React (Vite) app — builds into frontend/dist
└── _legacy/                  # archived pre-React static mockup (not served; kept for reference)
```

All data is live from the database — there is no hardcoded/mock content. Resources
are created from the React app's **Add Resource** form (`/resources/new`, multipart
upload) or from the Django admin; projects are managed in the Django admin.

## Models (`chpr/models.py`)

| Model | Purpose |
|-------|---------|
| `Project` | A programme (BREATHE, PROMPT TB) with `status` = active/completed |
| `Resource` | Uploadable resource (`file`) typed alg/job/vid/pos + pool tests (expert/trunat/hiv); pool fields: `test_platform`, `sample_type`, `pool_size` |
| `ResourceComment` | Staff comments on a resource |
| `ContactMessage` | "Contact us" enquiries |

## API (`/api/`)

- `GET/POST /api/projects/`, `GET/PUT/DELETE /api/projects/<slug>/`
- `GET/POST /api/resources/` — POST accepts `multipart/form-data` for file upload
  - filters: `?project=<slug>`, `?type=<key|pool>`, `?activity=<hf|hc>`, `?search=<text>`
- `GET/POST /api/comments/?resource=<id>`
- `GET/POST /api/contact-messages/`

## Backend setup

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt

# 1. Create the PostgreSQL database, then copy .env.example -> .env and set DATABASE_URL
createdb chpr_hub                  # or use psql / pgAdmin

# 2. Migrate and create an admin user (data is entered via the app / admin)
python manage.py migrate
python manage.py createsuperuser

python manage.py runserver         # http://localhost:8000
```

> **Always activate the virtualenv before running `manage.py`.** This project uses
> the **psycopg 3** driver, which is installed only inside `.venv`. If you run
> `python manage.py …` with a different Python on your PATH (e.g. Anaconda or a
> system Python), Django fails with *"Error loading psycopg2 or psycopg module."*
> Activate the venv first (`.venv\Scripts\activate`), or call it explicitly:
>
> ```powershell
> .\.venv\Scripts\python.exe manage.py createsuperuser
> ```

> No PostgreSQL yet? You can develop against SQLite by setting
> `DATABASE_URL=sqlite:///db.sqlite3` in `.env`.

## Frontend setup

```bash
cd frontend
npm install
npm run build                 # outputs straight to ../build (the project root)
```

That's the only step — Vite is configured (`build.outDir: "../build"`) to emit the
app directly into the project-root `build/` folder. `chpr_backend/urls.py` serves
`index.html` and the `/static/` assets from there (Vite emits assets under
`build/static/`; see `FRONTEND_BUILD_DIR` in settings). The React app calls the API
on the same origin (`/api`), so no extra config is needed.

API docs are available at `/api/schema/swagger-ui/` and `/api/schema/redoc/`
(raw OpenAPI schema at `/api/schema/`).

```bash
python manage.py runserver    # http://localhost:8000  (React app + API)
```

For live-reload development against the API instead:

```bash
cd frontend && npm run dev    # http://localhost:5173 (proxies /api & /media to :8000)
```
