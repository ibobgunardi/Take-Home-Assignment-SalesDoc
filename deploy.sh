#!/usr/bin/env bash
# Deploy the app to the VPS reached through the SSH host alias `salesdoc`
# (D-19). No credential appears here - the alias in ~/.ssh/config carries the
# host, user and key. See DEPLOYMENT.md for the one-time server provisioning.
#
# Usage:  ./deploy.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-salesdoc}"
APP_DIR="${DEPLOY_DIR:-/opt/salesdoc-dialer}"
SERVICE="${DEPLOY_SERVICE:-salesdoc-dialer}"

echo "==> Building client bundle"
npm run build

echo "==> Packaging"
BUNDLE="$(mktemp -t dialer-XXXXXX.tgz)"
tar czf "$BUNDLE" \
  package.json package-lock.json \
  server/package.json server/src \
  client/package.json client/dist

echo "==> Shipping to ${HOST}:${APP_DIR}"
ssh "$HOST" "mkdir -p '${APP_DIR}' && rm -rf '${APP_DIR}/server/src' '${APP_DIR}/client/dist'"
ssh "$HOST" "tar xzf - -C '${APP_DIR}'" < "$BUNDLE"
rm -f "$BUNDLE"

echo "==> Installing production dependencies"
ssh "$HOST" "cd '${APP_DIR}' && npm install --omit=dev --no-audit --no-fund"

echo "==> Restarting ${SERVICE}"
ssh "$HOST" "systemctl restart '${SERVICE}' && sleep 1 && systemctl is-active '${SERVICE}'"

echo "==> Done"
