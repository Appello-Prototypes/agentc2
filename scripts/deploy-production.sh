#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"
DO_HOST="${DO_HOST:-}"
DO_USER="${DO_USER:-deploy}"
HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-}"
HEALTHCHECK_TIMEOUT="${DEPLOY_HEALTHCHECK_TIMEOUT:-120}"
HEALTHCHECK_INTERVAL="${DEPLOY_HEALTHCHECK_INTERVAL:-5}"
SKIP_CHECKS="${SKIP_CHECKS:-0}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
DEPLOY_LOG_LINES="${DEPLOY_LOG_LINES:-200}"

log_info() {
    echo "[INFO] $1"
}

log_warn() {
    echo "[WARN] $1"
}

log_error() {
    echo "[ERROR] $1"
}

trap 'log_error "Deployment failed. Check output above for details."' ERR

if [ -z "$DO_HOST" ]; then
    log_error "Missing DO_HOST. Set DO_HOST and optionally DO_USER."
    exit 1
fi

cd "$ROOT_DIR"

if [ "$ALLOW_DIRTY" != "1" ]; then
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_error "Working tree is not clean. Commit or stash changes first."
        exit 1
    fi
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    log_error "Current branch is '$CURRENT_BRANCH'. Switch to '$BRANCH' or set DEPLOY_BRANCH."
    exit 1
fi

if [ "$SKIP_CHECKS" != "1" ]; then
    log_info "Running pre-deploy checks..."
    bun run type-check
    bun run lint
    bun run format
    if ! git diff --quiet; then
        log_error "Formatting produced changes. Review and commit them before deploy."
        exit 1
    fi
    bun run build
else
    log_warn "Skipping checks (SKIP_CHECKS=1)."
fi

log_info "Pushing $BRANCH to $REMOTE..."
git push "$REMOTE" "HEAD:$BRANCH"

log_info "Deploying to $DO_USER@$DO_HOST..."
DEPLOY_BRANCH="$BRANCH" "$ROOT_DIR/scripts/deploy-do.sh" "$DO_HOST" "$DO_USER"

if [ -n "$HEALTHCHECK_URL" ]; then
    log_info "Waiting for healthcheck: $HEALTHCHECK_URL"
    end_time=$((SECONDS + HEALTHCHECK_TIMEOUT))
    until curl -fsS "$HEALTHCHECK_URL" > /dev/null; do
        if [ $SECONDS -ge $end_time ]; then
            log_error "Healthcheck failed after ${HEALTHCHECK_TIMEOUT}s."
            log_info "Collecting remote status and logs..."
            ssh -o StrictHostKeyChecking=accept-new "$DO_USER@$DO_HOST" \
                "pm2 status && pm2 logs --lines $DEPLOY_LOG_LINES --nostream"
            exit 1
        fi
        sleep "$HEALTHCHECK_INTERVAL"
    done
    log_info "Healthcheck passed."
else
    log_warn "DEPLOY_HEALTHCHECK_URL not set; skipping healthcheck."
fi

log_info "Deployment completed successfully."
