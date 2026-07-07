#!/usr/bin/env sh
set -e

# If Litestream isn't configured, boot the server directly. Zero overhead
# for anyone not paying for S3 yet.
if [ -z "$LITESTREAM_S3_BUCKET" ]; then
  echo "→ Litestream not configured (LITESTREAM_S3_BUCKET unset). Booting plain."
  exec node server.js
fi

# Litestream present → restore-if-empty then replicate while the server runs.
# `-if-db-not-exists` and `-if-replica-exists` keep this idempotent across
# deploy restarts and cold boots.
DB_PATH="${DB_PATH:-/var/data/kidsbrain.sqlite}"

if [ ! -f "$DB_PATH" ]; then
  echo "→ DB not found on disk; attempting restore from S3…"
  litestream restore \
    -config /app/litestream.yml \
    -if-replica-exists \
    "$DB_PATH" || true
fi

echo "→ Starting Litestream + Node in the foreground."
exec litestream replicate -config /app/litestream.yml -exec "node server.js"
