#!/usr/bin/env bash
#
# CHPR Resources Hub — production deploy script (runs ON the droplet at
# /opt/chpr). Mirrors the Corynth SMS deploy strategy, scoped to this one
# Docker Compose project so it can never touch REDCap / SMS / n8n.
#
# Modes:
#   full        (default) pull + build + migrate + collectstatic-in-image +
#               restart + smoke
#   backend     rebuild + restart the web container only (no git pull)
#   migrate     run Django migrations only
#   restart     restart containers, no rebuild
#   smoke       health checks only
#
# Safety: set -euo pipefail aborts before doing damage. Only ever acts on
# the compose project in THIS directory (docker compose, never a bare prune).
set -euo pipefail

cd "$(dirname "$0")/.."   # -> /opt/chpr
REPO_DIR="$(pwd)"
MODE="${1:-full}"

c_info()  { printf '\033[1;36m[chpr-deploy]\033[0m %s\n' "$*"; }
c_err()   { printf '\033[1;31m[chpr-deploy ERR]\033[0m %s\n' "$*" >&2; }

compose() { docker compose "$@"; }

require_env() {
    if [[ ! -f "${REPO_DIR}/.env" ]]; then
        c_err "Missing ${REPO_DIR}/.env — copy deploy/.env.example and fill it in."
        exit 1
    fi
}

pull_main() {
    c_info "Pulling origin/master…"
    git fetch --quiet origin
    git checkout --quiet master
    git reset --hard --quiet origin/master
    c_info "Now at $(git rev-parse --short HEAD)."
}

build_web() {
    c_info "Building web image (frontend + backend)…"
    compose build web
}

run_migrate() {
    c_info "Running migrations…"
    compose run --rm web python manage.py migrate --noinput
}

restart_stack() {
    c_info "Recreating containers…"
    compose up -d
}

smoke() {
    c_info "Smoke test…"
    compose ps
    c_info "  - postgres ready?"
    compose exec -T postgres pg_isready -U "${POSTGRES_USER:-chpr}" >/dev/null \
        && c_info "    postgres: OK" || { c_err "    postgres not ready"; return 1; }
    c_info "  - web /api/schema/ via loopback gunicorn (waiting up to ~60s)…"
    for i in $(seq 1 30); do
        code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8300/api/schema/ || true)
        if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "403" ]]; then
            c_info "    web up (HTTP $code)"; break
        fi
        sleep 2
        [[ "$i" == "30" ]] && { c_err "    web never came up (last HTTP $code)"; return 1; }
    done
    c_info "  - site via Apache (HTTPS)"
    curl -s -o /dev/null -w '    https://chpr-resource.org -> %{http_code}\n' \
        https://chpr-resource.org/ || true
    c_info "Smoke test passed."
}

case "$MODE" in
    full)
        require_env
        pull_main
        build_web
        run_migrate
        restart_stack
        smoke
        c_info "✔ Full deploy succeeded. Commit: $(git rev-parse --short HEAD)"
        ;;
    backend)
        require_env; build_web; restart_stack; smoke
        c_info "✔ Web rebuilt. Commit: $(git rev-parse --short HEAD)"
        ;;
    migrate)  require_env; run_migrate ;;
    restart)  require_env; restart_stack; smoke ;;
    smoke)    smoke ;;
    *) c_err "Unknown mode '$MODE' (full|backend|migrate|restart|smoke)"; exit 2 ;;
esac
