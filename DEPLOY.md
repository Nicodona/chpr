# CHPR Resources Hub — production deployment (shared CHPR droplet)

Deployed alongside REDCap, Corynth SMS, n8n, LIS on `159.89.50.227`. Read
`~/Desktop/Corynth Company/SERVER_HANDOVER_FOR_AGENTS.md` before touching the
server. Mirrors the Corynth SMS / Equipment Tracker pattern.

## Topology

```
Internet :443 ─ sslh ─ Apache 127.0.0.1:4443 (vhost: chpr-resource.org)
                          ├─ /media/  → Apache Alias → /opt/chpr/media   (host bind mount)
                          └─ /        → ProxyPass → gunicorn 127.0.0.1:8300 (web container)
                                                      ├─ React SPA (TemplateView)
                                                      ├─ /api/  (DRF)
                                                      ├─ /admin/
                                                      └─ /static/ (WhiteNoise)
web ── Postgres 127.0.0.1:55434 (chpr_postgres_data named volume)
```

Host ports (both 127.0.0.1 only): **8300** web, **55434** postgres. No new
public UFW port — traffic arrives via the existing :443/sslh path.

## First-time setup (on the droplet)

```bash
ssh root@159.89.50.227

# 1. Code
mkdir -p /opt/chpr && cd /opt/chpr
git clone git@github.com:Nicodona/chpr.git .   # or https
mkdir -p media                                  # Apache-served media bind mount

# 2. Secrets — copy template, fill in real values (generate strong SECRET_KEY
#    + POSTGRES_PASSWORD; set BEHIND_TLS_PROXY=True + CSRF_TRUSTED_ORIGINS).
cp deploy/.env.example .env && nano .env

# 3. Build + DB + first run (isolated compose project — never touches siblings)
bash deploy/deploy.sh full        # build, migrate, up, smoke

# 4. Superuser (temp password; reset on first login)
docker compose exec web python manage.py createsuperuser

# 5. ACME webroot + TLS cert (neutral webroot, NOT REDCap's docroot)
mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
cp deploy/apache/chpr-resource.org.conf /etc/apache2/sites-available/
a2ensite chpr-resource.org.conf
apache2ctl configtest && systemctl reload apache2
certbot certonly --webroot -w /var/www/letsencrypt \
    -d chpr-resource.org -d www.chpr-resource.org

# 6. Enable the TLS vhost (now that the cert exists)
cp deploy/apache/chpr-resource.org-le-ssl.conf /etc/apache2/sites-available/
a2ensite chpr-resource.org-le-ssl.conf
apache2ctl configtest && systemctl reload apache2

# 7. Verify externally
curl -I https://chpr-resource.org/
```

## Redeploys

```bash
ssh root@159.89.50.227 'cd /opt/chpr && bash deploy/deploy.sh full'
```

Modes: `full` (default) · `backend` · `migrate` · `restart` · `smoke`.

## Safety notes (shared host)

- vhost is `127.0.0.1:4443`, **never** `*:443` (SNI fall-through — §4.2).
- All headers are scoped inside the vhost — **never** global (§4.1 REDCap incident).
- Never `docker system/volume prune` — scope to `/opt/chpr` with `docker compose`.
- `chpr_postgres_data` is the live DB volume — never `docker volume rm` it.
- Back up before destructive migrations:
  `docker compose exec -T postgres pg_dump -U chpr chpr_hub | gzip > /opt/backups/chpr_hub-$(date +%F).sql.gz`
