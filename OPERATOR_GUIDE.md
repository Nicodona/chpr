# CHPR Resources Hub — Operator's Guide

A practical guide for running and changing **chpr-resource.org** yourself. No prior
knowledge assumed. Keep this file; it lives in the repo so it's always available.

---

## 1. The two admin areas (and how to log in)

There are **two** places to manage the site. Use whichever fits the task.

| Area | Address | What it's for |
|---|---|---|
| **Manage panel** (simple, day-to-day) | `https://chpr-resource.org/manage` | Add/edit resources, users, FAQ, site text — the everyday stuff |
| **Django admin** (full control) | `https://chpr-resource.org/chpr-console/` | Everything: resources, projects, users, quizzes, raw data |

> ⚠️ The Django admin is **NOT** at `/admin/` anymore. It was moved to a private URL for
> security. The current path is **`/chpr-console/`**. Bookmark it.

**Login:** same username + password you've always used. If you forget the admin password,
see §7 (reset a password).

---

## 2. Add or edit a resource (documents **and** YouTube videos)

**Easiest way — the Manage panel or the "Add Resource" page:**

1. Go to `https://chpr-resource.org/manage` → **Resources**, or open **Add Resource**.
2. Fill in **Name**, choose the **Project**, **Type**, and **Target users** (audience).
   - *Target users = "Everyone"* makes it public (visitors see it). The others are staff-only.
3. Then EITHER:
   - **Upload a file** (PDF / image / video) in the **File** box, **or**
   - **Paste a YouTube link** in the **"YouTube video link"** box (and leave File empty).
4. Save.

**About YouTube videos (the embed):**
- Set **Type = Video** and paste the normal YouTube link (e.g. `https://www.youtube.com/watch?v=XXXX`).
- The video will **play embedded on the site**, with a **"Watch on YouTube"** button.
- Use the real YouTube title as the resource **Name** so they match.
- Don't upload the video file — embedding is lighter and faster.

---

## 3. Edit page text (without touching code)

Wording on the site (menus, headings, footer, search placeholder, etc.) is editable:

- **Manage panel → Content tab**, or **Django admin → Site text**.
- Change the **value**, Save. The page updates — no deploy needed.
- You can only edit existing text slots. Adding a brand-new editable spot needs a code change (§6).

---

## 4. Projects, users, FAQs

All in the **Django admin** (`/chpr-console/`) or the **Manage panel**:
- **Projects** — the groupings resources belong to (logo, colours, order).
- **Users** — create staff/admin accounts, set their role & department.
- **FAQs** — the help questions shown by the floating FAQ button.

---

## 5. How the site is built (the 30-second architecture)

- **Backend:** Django (Python) — serves the API, the admin, and the React app shell.
- **Frontend:** React (built with Vite) — the pages visitors see.
- **Database:** PostgreSQL.
- **Where it runs:** a DigitalOcean droplet at **`159.89.50.227`**, inside **Docker**, in the
  folder **`/opt/chpr`**. Apache sits in front, terminates HTTPS, serves `/media/` files
  directly, and proxies everything else to the app.
- **Code repo:** `github.com/Nicodona/chpr` (branch `master`).

```
Visitor ─HTTPS─▶ Apache ─┬─ /media/  → files on disk (uploads)
                         └─ everything else → Django/gunicorn (:8300) ─▶ PostgreSQL
```

---

## 6. Changing the code and deploying (the full loop)

You need: the code on your laptop, GitHub push access (you have it as `Romarick36925`),
and SSH access to the droplet (your key is installed).

**Your working copy** is at `~/chpr-dev` (a lightweight clone).

```bash
cd ~/chpr-dev
git pull origin master              # get the latest first

# ... make your edits (frontend in frontend/src/, backend in chpr/) ...

git add <the files you changed>
git commit -m "Describe the change"
git push origin master              # pushes to GitHub

# deploy to the live site:
ssh root@159.89.50.227 'cd /opt/chpr && bash deploy/deploy.sh full'
```

`deploy.sh full` pulls your commit, rebuilds, runs any database migrations, restarts the
app, and runs a smoke test. If the smoke test fails it tells you.

**Deploy modes:** `full` (everything) · `backend` · `migrate` · `restart` · `smoke`.

**⚠️ Before deploying a frontend change,** sanity-check it builds (a broken build can blank
pages). Quick check on the droplet:
```bash
rsync -az --exclude='.git' ~/chpr-dev/ root@159.89.50.227:/tmp/chk/
ssh root@159.89.50.227 'cd /tmp/chk && docker build -t chpr-buildcheck . && rm -rf /tmp/chk'
```
If that build succeeds, your frontend compiles.

---

## 7. Common operations (copy-paste)

All of these run **on the droplet**: `ssh root@159.89.50.227` first, then `cd /opt/chpr`.

**Change the admin URL** (e.g. back to something else you'll remember):
```bash
cd /opt/chpr
cp .env .env.bak.$(date +%s)
sed -i 's|^ADMIN_URL=.*|ADMIN_URL=your-new-path/|' .env
docker compose up -d web            # recreates the app with the new URL
# admin is now at https://chpr-resource.org/your-new-path/
```

**Reset a user's / admin password:**
```bash
docker compose exec web python manage.py changepassword <username>
```

**Create a new admin (superuser):**
```bash
docker compose exec web python manage.py createsuperuser
```

**Restart the app** (no code change):
```bash
docker compose restart web
```

**See the app logs** (to diagnose an error):
```bash
docker compose logs --tail=100 web
```

**Back up the database:**
```bash
docker compose exec -T postgres pg_dump -U chpr chpr > ~/chpr-db-$(date +%F).sql
```

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **"Can't find the admin / `/admin/` 404s"** | It moved. Use `https://chpr-resource.org/chpr-console/` (§1). |
| **A `/projects/...` or resource page is blank** | A frontend build/JS error. Re-check the build (§6), redeploy. |
| **YouTube video shows "Error 153 / configuration error"** | The site's referrer policy must be `strict-origin-when-cross-origin` (already set). If it returns, check `SECURE_REFERRER_POLICY` in `chpr_backend/settings.py`. |
| **Previews re-download every time** | Media needs a `Cache-Control` header on Apache's `/media/` block (already set to 7 days). |
| **"CSRF verification failed" on login** | The site's https origin must be in `CSRF_TRUSTED_ORIGINS` in the `.env`. |
| **Site down after a deploy** | `docker compose logs --tail=100 web` to see the error; redeploy the last good commit. |

---

## 9. Shared-droplet safety rules (important)

This droplet **also hosts REDCap** (patient data) and other apps. When touching Apache or Docker here:
- **Never** `systemctl restart apache2`. Only `apache2ctl configtest && systemctl reload apache2` (graceful).
- Apache header/config changes go **inside the chpr vhost only**, never globally.
- **Never** `docker compose down -v` or prune Docker volumes — `chpr_postgres_data` is live data.
- Media lives in a bind-mount at `/opt/chpr/media` — don't delete it.

---

## 10. Key locations at a glance

| Thing | Where |
|---|---|
| Live site | `https://chpr-resource.org` · admin `…/chpr-console/` · staff panel `…/manage` |
| Server | `ssh root@159.89.50.227` → app in `/opt/chpr` (Docker) |
| Config/secrets | `/opt/chpr/.env` (on the server only — holds DB password, admin URL) |
| Uploaded files | `/opt/chpr/media/` (served by Apache at `/media/`) |
| Apache vhost | `/etc/apache2/sites-available/chpr-resource.org-le-ssl.conf` |
| Code (GitHub) | `github.com/Nicodona/chpr`, branch `master` |
| Your working copy | `~/chpr-dev` on your laptop |
| Backend code | `chpr/` (models, views, admin) · settings in `chpr_backend/settings.py` |
| Frontend code | `frontend/src/` (pages in `frontend/src/pages/`) |
| Deploy script | `/opt/chpr/deploy/deploy.sh` (`full`/`backend`/`migrate`/`restart`/`smoke`) |

---

*Keep this guide updated as the site changes. When in doubt, read the logs (§7) before changing anything.*
